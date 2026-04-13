import { CAL, raceSessions } from "@/src/constants/calendar";
import { jsonError, jsonOk } from "../../_lib/response";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { appendOperationRun, buildOperationRun, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { buildAiContext, buildAiRacePredictionRows, generateInsightPayload } from "../../_lib/aiBrief";
import { getSupabaseAdmin, invokeSupabaseFunction, requireServiceRole } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickRaceByRound(round) {
  const targetRound = Number(round || 0) || 0;
  if (!targetRound) return null;

  return CAL.find((race) => {
    const direct = Number(race?.r || 0);
    const display = Number(race?.displayRound || 0);
    return direct === targetRound || display === targetRound;
  }) || null;
}

function parseRequestedRounds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => Number(item || 0)).filter((item) => item > 0))];
  }

  if (typeof value === "string") {
    return [...new Set(
      value
        .split(",")
        .map((item) => Number(item.trim() || 0))
        .filter((item) => item > 0)
    )];
  }

  const single = Number(value || 0);
  return single > 0 ? [single] : [];
}

async function safeRows(task, fallback = []) {
  try {
    const { data, error } = await task();
    if (error) throw error;
    return data || fallback;
  } catch (error) {
    console.warn("AI replay fallback", error?.message || error);
    return fallback;
  }
}

function buildRaceSessions(race) {
  return raceSessions(race).map((session) => ({
    session_name: session.label,
    session_type: session.key,
    scheduled_start: session.date instanceof Date ? session.date.toISOString() : new Date(session.date).toISOString(),
    status: "scheduled",
  }));
}

async function loadReplayInputs({ supabase, season, round }) {
  const race = pickRaceByRound(round);
  if (!race) {
    throw new Error(`No calendar race found for round ${round}.`);
  }

  const raceDate = new Date(`${race.date}T23:59:59Z`);
  const newsWindowStart = new Date(raceDate.getTime() - (28 * 24 * 60 * 60 * 1000));

  const [articles, historyRows, resultsRows, predictionRows] = await Promise.all([
    safeRows(() => supabase
      .from("news_articles")
      .select("id,title,summary,url,source,published_at,source_priority,metadata")
      .lte("published_at", raceDate.toISOString())
      .gte("published_at", newsWindowStart.toISOString())
      .order("published_at", { ascending: false })
      .limit(48)),
    safeRows(() => supabase
      .from("race_context_history")
      .select("race_round,race_name,race_date,race_outcome,qualifying_outcome,sprint_outcome,weather_summary,strategy_summary,driver_results,constructor_results,volatility_summary,source_payload")
      .eq("season", season)
      .lt("race_round", round)
      .order("race_round", { ascending: false })
      .limit(20)),
    safeRows(() => supabase
      .from("race_results")
      .select("*")
      .eq("results_entered", true)
      .lt("race_round", round)
      .order("race_round", { ascending: false })
      .limit(20)),
    safeRows(() => supabase
      .from("predictions")
      .select("race_round,picks,score")
      .not("score", "is", null)
      .lt("race_round", round)
      .order("race_round", { ascending: false })
      .limit(600)),
  ]);

  return {
    race: {
      r: race.r,
      displayRound: race.displayRound,
      n: race.n,
      circuit: race.circuit,
      cc: race.cc,
      date: race.date,
      sprint: race.sprint,
    },
    sessions: buildRaceSessions(race),
    articles,
    historyRows,
    resultsRows,
    predictionRows,
  };
}

async function generateReplayInsight({ season, inputs }) {
  const hasLocalOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
  const hasRemoteAiProxy = Boolean(process.env.RACE_RESULTS_SYNC_SECRET);

  if (hasLocalOpenAiKey) {
    return generateInsightPayload(inputs);
  }

  if (!hasRemoteAiProxy) {
    throw new Error("Missing OPENAI_API_KEY and missing RACE_RESULTS_SYNC_SECRET for historical AI replay backfill.");
  }

  const { context, categoryOptions } = buildAiContext(inputs);
  const requestedModel = process.env.OPENAI_MODEL || "gpt-4.1";
  const response = await invokeSupabaseFunction(
    "ai-race-brief",
    {
      season,
      raceRound: Number(inputs?.race?.r || 0) || undefined,
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
  const remoteInsight = response?.insight && typeof response.insight === "object" ? response.insight : null;

  if (!remoteInsight?.headline || !Array.isArray(remoteInsight?.category_predictions) || !remoteInsight.category_predictions.length) {
    throw new Error("The remote AI replay proxy returned no usable insight payload.");
  }

  return {
    ...remoteInsight,
    mode,
    model: response?.model || remoteInsight?.model || requestedModel,
  };
}

function toReplayPredictionRows(inputs, insight) {
  const generatedAt = new Date().toISOString();
  return buildAiRacePredictionRows({
    race: inputs.race,
    sessions: inputs.sessions,
    insight,
    generatedAt,
  }).map((row) => ({
    ...row,
    insight_key: `historical_replay_r${row.race_round}`,
    scope: "historical_replay",
    provider: insight.mode === "fallback" ? "fallback_replay" : "openai_replay",
    generated_at: generatedAt,
  }));
}

async function persistReplayRound({ supabase, round, inputs, insight, overwrite }) {
  const predictionRows = toReplayPredictionRows(inputs, insight);
  if (!predictionRows.length) {
    throw new Error(`Round ${round} produced no usable replay predictions.`);
  }

  if (overwrite !== false) {
    const { error: deleteError } = await supabase.from("ai_race_predictions").delete().eq("race_round", round);
    if (deleteError) throw deleteError;
  }

  const { error: insertError } = await supabase.from("ai_race_predictions").insert(predictionRows);
  if (insertError) throw insertError;

  await supabase.from("ai_insight_runs").insert({
    scope: "historical_replay",
    race_name: inputs.race.n,
    status: insight.mode === "fallback" ? "partial" : "ok",
    model: predictionRows[0]?.model || null,
    source_count: inputs.articles.length,
    article_count: inputs.articles.length,
    error_text: insight.mode === "fallback" ? insight.note || "Historical replay used fallback generation." : null,
    started_at: predictionRows[0]?.generated_at,
    finished_at: predictionRows[0]?.generated_at,
  });

  return predictionRows;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    const season = Number(body?.year || body?.season || 2026) || 2026;
    const requestedRounds = parseRequestedRounds(body?.rounds || body?.raceRounds || body?.round || null);
    const overwrite = body?.overwrite !== false;

    requireServiceRole("historical AI replay backfills");
    const supabase = getSupabaseAdmin();

    const completedResults = await safeRows(() => supabase
      .from("race_results")
      .select("race_round")
      .eq("results_entered", true)
      .order("race_round", { ascending: true }));

    const completedRounds = completedResults
      .map((row) => Number(row?.race_round || 0))
      .filter((round) => round > 0);

    const rounds = requestedRounds.length ? requestedRounds : completedRounds;
    if (!rounds.length) {
      return jsonError("No completed rounds are available for AI replay backfill.", 422);
    }

    const successes = [];
    const errors = [];

    for (const round of rounds) {
      try {
        const inputs = await loadReplayInputs({ supabase, season, round });
        const insight = await generateReplayInsight({ season, inputs });
        const predictionRows = await persistReplayRound({ supabase, round, inputs, insight, overwrite });

        successes.push({
          round,
          raceName: inputs.race.n,
          categories: predictionRows.length,
          provider: predictionRows[0]?.provider || null,
          mode: insight.mode,
        });
      } catch (error) {
        errors.push({
          round,
          error: error instanceof Error ? error.message : "Unknown replay backfill error.",
        });
      }
    }

    const run = buildOperationRun("ai-history-replay", {
      season,
      status: errors.length && !successes.length ? "error" : errors.length ? "partial" : "ok",
      message: successes.length
        ? `Stored replay AI history for ${successes.length} round${successes.length === 1 ? "" : "s"}.`
        : "AI replay backfill did not store any rounds.",
      warnings: errors.map((entry) => `Round ${entry.round}: ${entry.error}`),
      counts: {
        replayedRounds: successes.length,
        failedRounds: errors.length,
      },
    });

    await updateLocalAdminStore((store) => {
      appendOperationRun(store, run);
      return store;
    });

    if (!successes.length) {
      return jsonError(run.warnings[0] || run.message, 500);
    }

    return jsonOk(run.message, {
      runId: run.id,
      season,
      counts: run.counts,
      warnings: run.warnings,
      rounds: successes,
    });
  } catch (error) {
    return adminAccessErrorResponse(error, "Historical AI replay backfill failed.");
  }
}
