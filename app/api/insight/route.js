import { jsonError, jsonOk } from "../admin/_lib/response";
import { buildHistoricalContext } from "../admin/_lib/aiBrief";
import { loadAdminCalendarState } from "../admin/_lib/dashboardData";
import { readLocalAdminStore } from "../admin/_lib/localAdminStore";
import { getSupabaseReadClient } from "../admin/_lib/supabaseAdmin";
import { chooseInsightForRace } from "@/src/lib/aiInsight";
import { nextRace } from "@/src/constants/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createFallbackAdminStore() {
  return {
    version: 2,
    updatedAt: null,
    resultsDrafts: {},
    scheduleSessions: {},
    roundControls: {},
    operationRuns: [],
  };
}

async function loadPublicAdminStore() {
  try {
    return {
      store: await readLocalAdminStore(),
      warning: null,
    };
  } catch (error) {
    const message = String(error?.message || "Admin control center state is unavailable.");
    return {
      store: createFallbackAdminStore(),
      warning: message,
    };
  }
}

async function safeRows(task, fallback = []) {
  try {
    const { data, error } = await task();
    if (error) throw error;
    return {
      ok: true,
      data: data || fallback,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      data: fallback,
      error,
    };
  }
}

function buildInsightFreshness(insight, historicalContext) {
  const savedPreviousRace = insight?.metadata?.previous_race || null;
  const canonicalPreviousRace = historicalContext?.previousRace || null;
  const staleReasons = [];

  if (insight?.metadata?.freshness_status === "stale" && insight?.metadata?.stale_reason) {
    staleReasons.push(String(insight.metadata.stale_reason));
  }

  if (canonicalPreviousRace?.round && Number(savedPreviousRace?.round || 0) !== Number(canonicalPreviousRace.round || 0)) {
    staleReasons.push("Saved brief context is behind the latest completed canonical round.");
  }

  if (canonicalPreviousRace?.winner && savedPreviousRace?.winner && String(savedPreviousRace.winner) !== String(canonicalPreviousRace.winner)) {
    staleReasons.push("Saved previous-race winner does not match canonical results.");
  }

  return {
    status: staleReasons.length ? "stale" : "fresh",
    staleReason: staleReasons[0] || null,
  };
}

function mergeInsightWithCanonicalHistory(insight, historicalContext) {
  if (!insight) return null;

  const freshness = buildInsightFreshness(insight, historicalContext);

  return {
    ...insight,
    metadata: {
      ...(insight.metadata && typeof insight.metadata === "object" ? insight.metadata : {}),
      previous_race: historicalContext.previousRace || null,
      previous_race_weather: historicalContext.previousRaceWeather || null,
      previous_race_strategy: historicalContext.previousRaceStrategy || null,
      historical_form: {
        last_5_driver_form: historicalContext.historicalForm?.last_5_driver_form || [],
        last_5_constructor_form: historicalContext.historicalForm?.last_5_constructor_form || [],
      },
      season_stats: historicalContext.seasonStats || null,
      season_volatility: historicalContext.seasonVolatility || null,
      weather_strategy_patterns: historicalContext.weatherStrategyPatterns || null,
      fantasy_market: historicalContext.fantasyMarket || null,
      recent_results: historicalContext.recentResults || [],
      freshness_status: freshness.status,
      stale_reason: freshness.staleReason,
      freshness_checked_at: new Date().toISOString(),
      freshness_previous_race_round: historicalContext.previousRace?.round || null,
      freshness_previous_race_winner: historicalContext.previousRace?.winner || null,
    },
  };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const season = Number(url.searchParams.get("season") || 2026) || 2026;
    const supabase = getSupabaseReadClient();
    const { store, warning: storeWarning } = await loadPublicAdminStore();
    const calendarState = await loadAdminCalendarState({ supabase, store, season });
    const currentRace = nextRace(calendarState.calendar) || calendarState.calendar[0] || null;

    const [articlesResponse, insightsResponse, historyResponse, resultsResponse, predictionsResponse] = await Promise.all([
      safeRows(() => supabase.from("news_articles").select("id,title,summary,url,source,published_at,image_url").order("published_at", { ascending: false }).limit(80)),
      safeRows(() => supabase.from("ai_insights").select("headline,summary,confidence,key_factors,prediction_edges,watchlist,race_name,generated_at,source_count,provider,model,metadata").eq("scope", "upcoming_race").order("generated_at", { ascending: false }).limit(6)),
      safeRows(() => supabase.from("race_context_history").select("race_round,race_name,race_date,race_outcome,qualifying_outcome,sprint_outcome,weather_summary,strategy_summary,driver_results,constructor_results,volatility_summary,source_payload,updated_at,last_synced_at").eq("season", season).order("race_round", { ascending: false }).limit(20)),
      safeRows(() => supabase.from("race_results").select("*").order("race_round", { ascending: false }).limit(20)),
      safeRows(() => supabase.from("predictions").select("race_round,picks,score").not("score", "is", null).order("race_round", { ascending: false }).limit(600)),
    ]);

    const insights = insightsResponse.data || [];
    const matchedInsight = chooseInsightForRace(insights, currentRace);
    const historicalContext = buildHistoricalContext({
      historyRows: historyResponse.data || [],
      resultsRows: resultsResponse.data || [],
      predictionRows: predictionsResponse.data || [],
    });
    const canonicalInsight = mergeInsightWithCanonicalHistory(matchedInsight, historicalContext);
    const freshness = buildInsightFreshness(canonicalInsight, historicalContext);

    return jsonOk("Public AI insight payload loaded.", {
      season,
      currentRace,
      newsConfigured: articlesResponse.ok,
      warnings: storeWarning ? [storeWarning] : [],
      articles: articlesResponse.data || [],
      insight: canonicalInsight,
      insightStale: (insights.length > 0 && !matchedInsight) || freshness.status === "stale",
      historicalEdge: {
        previousRace: historicalContext.previousRace || null,
        previousRaceWeather: historicalContext.previousRaceWeather || null,
        previousRaceStrategy: historicalContext.previousRaceStrategy || null,
        historicalForm: historicalContext.historicalForm || null,
        seasonVolatility: historicalContext.seasonVolatility || null,
        fantasyMarket: historicalContext.fantasyMarket || null,
        recentResults: historicalContext.recentResults || [],
        freshness,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load the public AI insight payload.");
  }
}
