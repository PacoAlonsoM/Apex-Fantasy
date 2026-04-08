import { jsonError, jsonOk } from "../_lib/response";
import { appendOperationRun, buildOperationRun, updateLocalAdminStore } from "../_lib/localAdminStore";
import { isLocalAdminRequest } from "../_lib/localAdminAccess";
import { invokeSupabaseFunction, requireServiceRole } from "../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isLocalAdminRequest(request)) {
    return jsonError("The local admin routes only run on localhost.", 403);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const season = Number(body?.year || body?.season || 2026) || 2026;
    const payload = {
      year: season,
      backfillSeason: body?.backfillSeason !== false,
      historyOnly: true,
      persistRaceResults: false,
      persistRaceContextHistory: true,
      score: false,
    };

    requireServiceRole("AI history backfills");

    const response = await invokeSupabaseFunction("race-results-sync", payload, {
      secretEnv: "RACE_RESULTS_SYNC_SECRET",
      secretHeader: "x-sync-secret",
      requireSecret: false,
      preferSecretAuth: true,
    });

    const run = buildOperationRun("history-backfill", {
      season,
      message: `Backfilled ${response?.syncedCount || 0} rounds into AI history.`,
      warnings: response?.errors || [],
      counts: {
        synced: response?.syncedCount || 0,
        errors: response?.errorCount || 0,
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
      response,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Historical context backfill failed.");
  }
}
