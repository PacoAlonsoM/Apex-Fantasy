import { jsonError, jsonOk } from "../../_lib/response";
import { upsertCanonicalHistoryFromResults } from "../../_lib/canonicalHistory";
import { appendOperationRun, buildOperationRun, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { getSupabaseAdmin, requireServiceRole } from "../../_lib/supabaseAdmin";
import { awardRoundPoints } from "../../_lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    const season = Number(body?.season || 2026) || 2026;
    const round = Number(body?.round || body?.raceRound || 0);

    if (!round) {
      return jsonError("Missing round for points award.", 400);
    }

    requireServiceRole("awarding points");
    const supabase = getSupabaseAdmin();
    const scoring = await awardRoundPoints(supabase, round);
    let warnings = [];
    let historySync = { count: 0, rows: [] };

    try {
      const { data: officialResult, error: resultError } = await supabase
        .from("race_results")
        .select("*")
        .eq("race_round", round)
        .eq("results_entered", true)
        .maybeSingle();

      if (resultError) throw resultError;

      if (officialResult) {
        historySync = await upsertCanonicalHistoryFromResults(supabase, officialResult, { season });
      } else {
        warnings = [...warnings, "AI history refresh skipped: no published result row was found for this round."];
      }
    } catch (error) {
      warnings = [...warnings, `AI history refresh skipped: ${error instanceof Error ? error.message : "unknown error"}`];
    }

    const message = scoring?.message || `Awarded points for round ${round}.`;
    const run = buildOperationRun("award-points", {
      season,
      round,
      message,
      status: warnings.length ? "partial" : "ok",
      warnings,
      counts: {
        repaired: Number(scoring?.repaired || 0) || 0,
        changedUsers: Number(scoring?.changedUsers || 0) || 0,
        historyRows: historySync.count,
      },
    });

    await updateLocalAdminStore((store) => {
      appendOperationRun(store, run);
      return store;
    });

    return jsonOk(message, {
      runId: run.id,
      season,
      round,
      counts: {
        repaired: Number(scoring?.repaired || 0) || 0,
        changedUsers: Number(scoring?.changedUsers || 0) || 0,
        historyRows: historySync.count,
      },
      warnings,
      historyRows: historySync.rows,
      changes: scoring.changes,
    });
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not award points.");
  }
}
