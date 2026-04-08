import { jsonError, jsonOk } from "../_lib/response";
import { buildLocalAdminCapabilities, getSupabaseReadClient } from "../_lib/supabaseAdmin";
import { readLocalAdminStore } from "../_lib/localAdminStore";
import { buildDashboardPayload, loadAdminCalendarState } from "../_lib/dashboardData";
import { isLocalAdminRequest } from "../_lib/localAdminAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function safeTableRows(task, fallback = []) {
  try {
    const { data, error } = await task();
    if (error) throw error;
    return data || fallback;
  } catch (error) {
    console.warn("Admin dashboard table fallback", error?.message || error);
    return fallback;
  }
}

export async function GET(request) {
  if (!isLocalAdminRequest(request)) {
    return jsonError("The local admin dashboard only runs on localhost.", 403);
  }

  try {
    const season = Number(new URL(request.url).searchParams.get("season") || 2026) || 2026;
    const supabase = getSupabaseReadClient();
    const store = await readLocalAdminStore();
    const calendarState = await loadAdminCalendarState({ supabase, store, season });

    const [
      resultsRows,
      predictionRows,
      historyRows,
      newsRows,
      newsRunRows,
      insightRows,
      aiRunRows,
    ] = await Promise.all([
      safeTableRows(() => supabase.from("race_results").select("*").order("race_round", { ascending: true })),
      safeTableRows(() => supabase.from("predictions").select("race_round,score_breakdown").order("race_round", { ascending: true })),
      safeTableRows(() => supabase.from("race_context_history").select("race_round,race_name,race_date,race_outcome,qualifying_outcome,volatility_summary,last_synced_at,updated_at").eq("season", season).order("race_round", { ascending: false })),
      safeTableRows(() => supabase.from("news_articles").select("id,title,published_at").order("published_at", { ascending: false }).limit(12)),
      safeTableRows(() => supabase.from("news_ingest_runs").select("*").order("started_at", { ascending: false }).limit(6)),
      safeTableRows(() => supabase.from("ai_insights").select("headline,race_name,generated_at,metadata,source_count,provider,model").eq("scope", "upcoming_race").order("generated_at", { ascending: false }).limit(6)),
      safeTableRows(() => supabase.from("ai_insight_runs").select("*").order("started_at", { ascending: false }).limit(6)),
    ]);

    const dashboard = buildDashboardPayload({
      ...calendarState,
      store,
      resultsRows,
      predictionRows,
      historyRows,
      newsRows,
      newsRunRows,
      insightRows,
      aiRunRows,
      season,
    });

    const capabilities = buildLocalAdminCapabilities();
    dashboard.capabilities = capabilities;
    dashboard.warnings = [...(calendarState.warnings || []), ...(capabilities.warnings || [])];
    dashboard.health = {
      ...(dashboard.health || {}),
      adminWriteStatus: capabilities.hasServiceRole ? "ready" : "blocked",
      adminWriteReason: capabilities.hasServiceRole
        ? "Server-side admin writes are enabled."
        : capabilities.publishReason,
    };

    return jsonOk("Admin dashboard loaded.", {
      season,
      dashboard,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load admin dashboard.");
  }
}
