import { nextRace } from "@/src/constants/calendar";
import { jsonError, jsonOk, jsonPartial } from "../../_lib/response";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { appendOperationRun, buildOperationRun, readLocalAdminStore, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { buildAiContext, buildAiInsightRow, buildAiRacePredictionRows, generateInsightPayload } from "../../_lib/aiBrief";
import { loadAdminCalendarState } from "../../_lib/dashboardData";
import { getSupabaseAdmin, invokeSupabaseFunction, requireServiceRole } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function safeRows(task, fallback = []) {
  try {
    const { data, error } = await task();
    if (error) throw error;
    return data || fallback;
  } catch (error) {
    console.warn("AI brief local fallback", error?.message || error);
    return fallback;
  }
}

function pickTargetRace(calendar = [], preferredRound = null) {
  const requestedRound = Number(preferredRound || 0) || null;
  if (requestedRound) {
    return calendar.find((race) => {
      const round = Number(race?.r || 0);
      const sourceRound = Number(race?.sourceRoundNumber || race?.source_round_number || 0);
      const displayRound = Number(race?.displayRound || race?.display_round_number || 0);
      return round === requestedRound || sourceRound === requestedRound || displayRound === requestedRound;
    }) || null;
  }

  return nextRace(calendar) || calendar[0] || null;
}

async function loadAiBriefInputs({ supabase, store, season, preferredRound = null }) {
  const calendarState = await loadAdminCalendarState({ supabase, store, season });
  const race = pickTargetRace(calendarState.calendar, preferredRound);

  if (!race) {
    throw new Error("No active race found for AI brief generation.");
  }

  const sessions = calendarState.sessionsByRound[race.r] || [];
  const [articles, historyRows, resultsRows, predictionRows] = await Promise.all([
    safeRows(() => supabase.from("news_articles").select("id,title,summary,url,source,published_at,source_priority,metadata").order("published_at", { ascending: false }).limit(48)),
    safeRows(() => supabase.from("race_context_history").select("race_round,race_name,race_date,race_outcome,qualifying_outcome,sprint_outcome,weather_summary,strategy_summary,driver_results,constructor_results,volatility_summary,source_payload").eq("season", season).order("race_round", { ascending: false }).limit(20)),
    safeRows(() => supabase.from("race_results").select("*").order("race_round", { ascending: false }).limit(20)),
    safeRows(() => supabase.from("predictions").select("race_round,picks,score").not("score", "is", null).order("race_round", { ascending: false }).limit(600)),
  ]);

  return {
    race,
    sessions,
    articles,
    historyRows,
    resultsRows,
    predictionRows,
  };
}

async function persistAiBrief({
  supabase,
  season,
  race,
  sessions,
  articles,
  historyRows,
  resultsRows,
  predictionRows,
  insight,
}) {
  const row = buildAiInsightRow({
    race,
    sessions,
    articles,
    historyRows,
    resultsRows,
    predictionRows,
    insight,
  });

  const { error: upsertError } = await supabase.from("ai_insights").upsert(row, { onConflict: "insight_key" });
  if (upsertError) throw upsertError;

  const predictionRows = buildAiRacePredictionRows({
    race,
    sessions,
    insight,
    generatedAt: row.generated_at,
  });

  if (predictionRows.length) {
    try {
      const raceRound = predictionRows[0]?.race_round || null;
      if (raceRound) {
        const { error: deleteError } = await supabase.from("ai_race_predictions").delete().eq("race_round", raceRound);
        if (deleteError) throw deleteError;
      }

      const { error: insertError } = await supabase.from("ai_race_predictions").insert(predictionRows);
      if (insertError) throw insertError;
    } catch (predictionError) {
      console.warn("AI race prediction history skipped", predictionError?.message || predictionError);
    }
  }

  const { error: runError } = await supabase.from("ai_insight_runs").insert({
    scope: "upcoming_race",
    race_name: race.n,
    status: insight.mode === "fallback" ? "partial" : "ok",
    model: row.model,
    source_count: row.source_count,
    article_count: articles.length,
    error_text: insight.mode === "fallback" ? insight.note : null,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  });

  if (runError) {
    console.warn("AI brief run logging skipped", runError.message);
  }

  const run = buildOperationRun("ai-generate", {
    season,
    round: race.r,
    status: insight.mode === "fallback" ? "partial" : "ok",
    message: aiMessage(insight.mode, race.n),
    counts: {
      articles: articles.length,
      sources: row.source_count || 0,
      historyRows: historyRows.length,
      predictions: predictionRows.length,
    },
    warnings: insight.mode === "fallback" && insight.note ? [insight.note] : [],
  });

  await updateLocalAdminStore((state) => {
    appendOperationRun(state, run);
    return state;
  });

  return {
    run,
    row,
    insight,
    race,
  };
}

async function generateBriefLocally(season, preferredRound = null) {
  const supabase = getSupabaseAdmin();
  const store = await readLocalAdminStore();
  const inputs = await loadAiBriefInputs({ supabase, store, season, preferredRound });
  const insight = await generateInsightPayload(inputs);

  return persistAiBrief({
    supabase,
    season,
    ...inputs,
    insight,
  });
}

function aiMessage(mode, raceName) {
  return mode === "fallback"
    ? `Fallback brief saved for ${raceName}.`
    : `Generated AI brief for ${raceName}.`;
}

function aiWarningsFromInsight(mode, insightRow, fallbackWarnings = []) {
  const warnings = [...(Array.isArray(fallbackWarnings) ? fallbackWarnings : [])];
  const fallbackNote = insightRow?.metadata?.fallback_note || null;

  if (mode === "fallback" && fallbackNote) {
    warnings.push(fallbackNote);
  }

  return warnings.filter(Boolean);
}

async function generateBriefViaRemoteProxy(season, preferredRound = null) {
  const supabase = getSupabaseAdmin();
  const store = await readLocalAdminStore();
  const inputs = await loadAiBriefInputs({ supabase, store, season, preferredRound });
  const { context, categoryOptions } = buildAiContext(inputs);
  const requestedModel = process.env.OPENAI_MODEL || "gpt-4.1";

  const response = await invokeSupabaseFunction(
    "ai-race-brief",
    {
      season,
      raceRound: Number(preferredRound || inputs.race?.sourceRoundNumber || inputs.race?.displayRound || inputs.race?.r || 0) || undefined,
      model: requestedModel,
      generateOnly: true,
      contextOverride: context,
      categoryOptionsOverride: categoryOptions,
    },
    {
      secretEnv: "RACE_RESULTS_SYNC_SECRET",
      secretHeader: "x-sync-secret",
      requireSecret: false,
      preferSecretAuth: true,
    },
  );

  const mode = String(response?.mode || response?.insight?.mode || "openai").trim().toLowerCase();
  const remoteInsight = response?.insight && typeof response.insight === "object"
    ? response.insight
    : null;

  if (!remoteInsight?.headline || !Array.isArray(remoteInsight?.category_predictions) || !remoteInsight.category_predictions.length) {
    throw new Error("The remote AI brief proxy returned no usable insight payload.");
  }

  const insight = {
    ...remoteInsight,
    mode,
    model: response?.model || remoteInsight?.model || requestedModel,
  };

  const persisted = await persistAiBrief({
    supabase,
    season,
    ...inputs,
    insight,
  });

  const savedInsightRow = {
    metadata: {
      fallback_note: insight.note || null,
    },
  };
  const warnings = aiWarningsFromInsight(mode, savedInsightRow);

  return {
    ...persisted,
    run: { ...persisted.run, warnings },
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    const season = Number(body?.season || 2026) || 2026;
    requireServiceRole("AI brief generation");
    const preferredRound = Number(body?.raceRound || body?.round || 0) || null;
    const hasLocalOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
    const hasRemoteAiProxy = Boolean(process.env.RACE_RESULTS_SYNC_SECRET);

    if (hasLocalOpenAiKey) {
      const localResult = await generateBriefLocally(season, preferredRound);
      const message = aiMessage(localResult.insight.mode, localResult.race.n);
      const responseExtras = {
        runId: localResult.run.id,
        season,
        round: localResult.race.r,
        counts: localResult.run.counts,
        warnings: localResult.run.warnings,
        headline: localResult.row.headline,
        mode: localResult.insight.mode,
        provider: localResult.row.provider,
        model: localResult.row.model,
        raceName: localResult.race.n,
        researchSourceCount: Array.isArray(localResult.insight.research_sources) ? localResult.insight.research_sources.length : 0,
      };

      return localResult.insight.mode === "fallback"
        ? jsonPartial(message, responseExtras)
        : jsonOk(message, responseExtras);
    }

    if (!hasRemoteAiProxy) {
      return jsonError("Missing OPENAI_API_KEY in local env and missing RACE_RESULTS_SYNC_SECRET for the remote AI brief proxy.", 500);
    }

    const remoteResult = await generateBriefViaRemoteProxy(season, preferredRound);

    const responseExtras = {
      runId: remoteResult.run.id,
      season,
      round: remoteResult.race.r,
      counts: remoteResult.run.counts,
      warnings: remoteResult.run.warnings,
      headline: remoteResult.row.headline,
      mode: remoteResult.insight.mode,
      provider: remoteResult.row.provider,
      model: remoteResult.row.model,
      raceName: remoteResult.race.n,
      researchSourceCount: Array.isArray(remoteResult.insight.research_sources) ? remoteResult.insight.research_sources.length : 0,
    };

    return remoteResult.insight.mode === "fallback"
      ? jsonPartial(remoteResult.run.message, responseExtras)
      : jsonOk(remoteResult.run.message, responseExtras);
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not generate AI brief.");
  }
}
