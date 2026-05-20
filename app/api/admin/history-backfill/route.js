import { jsonError, jsonOk } from "../_lib/response";
import { upsertCanonicalHistoryFromResults } from "../_lib/canonicalHistory";
import { appendOperationRun, buildOperationRun, updateLocalAdminStore } from "../_lib/localAdminStore";
import { adminAccessErrorResponse, requireAdminRequest } from "../_lib/localAdminAccess";
import { getSupabaseAdmin, requireServiceRole } from "../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    const season = Number(body?.year || body?.season || 2026) || 2026;

    requireServiceRole("AI history backfills");
    const supabase = getSupabaseAdmin();

    const { data: publishedResults, error } = await supabase
      .from("race_results")
      .select("*")
      .eq("results_entered", true)
      .order("race_round", { ascending: true });

    if (error) throw error;

    const response = await upsertCanonicalHistoryFromResults(supabase, publishedResults || [], { season });
    const warnings = response.count
      ? []
      : ["No published race results were available to backfill."];

    const run = buildOperationRun("history-backfill", {
      season,
      message: `Backfilled ${response.count} published result round${response.count === 1 ? "" : "s"} into AI history.`,
      warnings,
      counts: {
        synced: response.count,
        errors: 0,
      },
    });

    await updateLocalAdminStore((store) => {
      appendOperationRun(store, run);
      return store;
    });

    return jsonOk(run.message, {
      runId: run.id,
      season,
      warnings: run.warnings,
      counts: run.counts,
      rounds: response.rows,
      response,
    });
  } catch (error) {
    return adminAccessErrorResponse(error, "Historical context backfill failed.");
  }
}
