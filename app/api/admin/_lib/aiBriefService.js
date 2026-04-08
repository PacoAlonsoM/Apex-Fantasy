import "server-only";

import { nextRace } from "@/src/constants/calendar";
import { buildAiContext, buildAiInsightRow, generateInsightPayload } from "./aiBrief";
import { loadAdminCalendarState } from "./dashboardData";
import { appendOperationRun, buildOperationRun, readLocalAdminStore, updateLocalAdminStore } from "./localAdminStore";
import { getSupabaseAdmin, invokeSupabaseFunction } from "./supabaseAdmin";

function toRoundNumber(value) {
  return Number(value || 0) || null;
}

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
  const requestedRound = toRoundNumber(preferredRound);
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

export async function loadAiBriefInputs({ supabase, store, season, preferredRound = null }) {
  const calendarState = await loadAdminCalendarState({ supabase, store, season });
  const race = pickTargetRace(calendarState.calendar, preferredRound);

  if (!race) {
    throw new Error("No active race found for AI brief generation.");
  }

  const sessions = calendarState.sessionsByRound[race.r] || [];
  const [articles, historyRows, resultsRows, predictionRows] = await Promise.all([
    safeRows(() => supabase.from("news_articles").select("id,title,summary,url,source,published_at,source_priority,metadata").order("published_at", { ascending: false }).limit(48)),
    safeRows(() => supabase.from("race_context_history").select("race_round,race_name,race_date,race_outcome,qualifying_outcome,sprint_outcome,weather_summary,strategy_summary,driver_results,constructor_results,volatility_summary,source_payload,updated_at,last_synced_at").eq("season", season).order("race_round", { ascending: false }).limit(20)),
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

export async function persistAiBrief({
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

  return await persistAiBrief({
    supabase,
    season,
    ...inputs,
    insight,
  });
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
      raceRound: toRoundNumber(preferredRound || inputs.race?.sourceRoundNumber || inputs.race?.displayRound || inputs.race?.r),
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

export async function runAiBriefGeneration({ season = 2026, preferredRound = null } = {}) {
  const hasLocalOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
  const hasRemoteAiProxy = Boolean(process.env.RACE_RESULTS_SYNC_SECRET);

  if (hasLocalOpenAiKey) {
    return await generateBriefLocally(season, preferredRound);
  }

  if (!hasRemoteAiProxy) {
    throw new Error("Missing OPENAI_API_KEY on the server and missing RACE_RESULTS_SYNC_SECRET for the remote AI brief proxy.");
  }

  return await generateBriefViaRemoteProxy(season, preferredRound);
}

export async function markUpcomingAiBriefStale({ reason, round = null } = {}) {
  const supabase = getSupabaseAdmin();
  const { data: currentInsight, error } = await supabase
    .from("ai_insights")
    .select("id,metadata")
    .eq("insight_key", "upcoming_race_brief")
    .maybeSingle();

  if (error) throw error;
  if (!currentInsight?.id) return null;

  const metadata = {
    ...(currentInsight.metadata && typeof currentInsight.metadata === "object" ? currentInsight.metadata : {}),
    freshness_status: "stale",
    stale_reason: reason || "Official results changed.",
    stale_at: new Date().toISOString(),
    stale_source_round: round ?? null,
  };

  const { error: updateError } = await supabase
    .from("ai_insights")
    .update({ metadata })
    .eq("id", currentInsight.id);

  if (updateError) throw updateError;
  return metadata;
}
