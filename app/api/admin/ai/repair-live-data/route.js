import { buildHistoricalContext } from "../../_lib/aiBrief";
import { runAiBriefGeneration } from "../../_lib/aiBriefService";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { appendOperationRun, buildOperationRun, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { jsonOk, jsonPartial } from "../../_lib/response";
import { getSupabaseAdmin, requireServiceRole } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function warningList(values = []) {
  return values.filter(Boolean);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    requireServiceRole("AI truth repairs");

    const season = Number(body?.season || 2026) || 2026;
    const supabase = getSupabaseAdmin();
    const [historyResponse, resultsResponse] = await Promise.all([
      supabase
        .from("race_context_history")
        .select("id,season,race_round,race_name,race_date,race_outcome,qualifying_outcome,sprint_outcome,weather_summary,strategy_summary,driver_results,constructor_results,volatility_summary,source_payload,updated_at,last_synced_at")
        .eq("season", season)
        .order("race_round", { ascending: false }),
      supabase
        .from("race_results")
        .select("*")
        .order("race_round", { ascending: false }),
    ]);

    if (historyResponse.error) throw historyResponse.error;
    if (resultsResponse.error) throw resultsResponse.error;

    const historyRows = historyResponse.data || [];
    const resultsRows = resultsResponse.data || [];
    const historicalContext = buildHistoricalContext({
      historyRows,
      resultsRows,
      predictionRows: [],
    });
    const canonicalRows = Array.isArray(historicalContext?.canonicalHistoryRows)
      ? historicalContext.canonicalHistoryRows
      : [];
    const historyByRound = new Map(historyRows.map((row) => [Number(row?.race_round || 0), row]));
    const repairedRounds = [];

    for (const canonicalRow of canonicalRows) {
      const round = Number(canonicalRow?.race_round || 0);
      if (!round) continue;

      const existingRow = historyByRound.get(round);
      if (!existingRow?.id) continue;

      const updates = {};
      for (const field of ["race_outcome", "qualifying_outcome", "volatility_summary"]) {
        if (stableJson(existingRow?.[field]) !== stableJson(canonicalRow?.[field])) {
          updates[field] = canonicalRow?.[field] || {};
        }
      }

      if (!Object.keys(updates).length) continue;

      updates.updated_at = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("race_context_history")
        .update(updates)
        .eq("id", existingRow.id);

      if (updateError) throw updateError;
      repairedRounds.push(round);
    }

    let briefResult = null;
    let briefError = null;

    try {
      briefResult = await runAiBriefGeneration({ season });
    } catch (error) {
      briefError = error instanceof Error ? error : new Error("Could not regenerate the AI brief after repairing canonical history.");
    }

    const warnings = warningList([
      repairedRounds.length
        ? null
        : "No race history rows needed reconciliation against canonical race results.",
      briefError?.message || null,
    ]);

    const run = buildOperationRun("ai-repair-live-data", {
      season,
      round: briefResult?.race?.r || null,
      status: briefError ? "partial" : "ok",
      message: briefError
        ? "Canonical AI history was repaired, but the upcoming brief still needs regeneration."
        : "Canonical AI history was repaired and the upcoming brief was regenerated.",
      counts: {
        repairedRounds: repairedRounds.length,
        regeneratedRound: briefResult?.race?.r || null,
      },
      warnings,
      details: {
        repairedRounds,
        regeneratedRace: briefResult?.race?.n || null,
      },
    });

    await updateLocalAdminStore((state) => {
      appendOperationRun(state, run);
      return state;
    });

    const extras = {
      runId: run.id,
      season,
      round: briefResult?.race?.r || null,
      counts: run.counts,
      warnings,
      repairedRounds,
      raceName: briefResult?.race?.n || null,
      mode: briefResult?.insight?.mode || null,
      provider: briefResult?.row?.provider || null,
      model: briefResult?.row?.model || null,
      researchSourceCount: Array.isArray(briefResult?.insight?.research_sources) ? briefResult.insight.research_sources.length : 0,
    };

    return briefError
      ? jsonPartial(run.message, extras)
      : jsonOk(run.message, extras);
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not repair canonical AI data.");
  }
}
