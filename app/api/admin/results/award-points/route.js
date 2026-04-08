import { jsonError, jsonOk } from "../../_lib/response";
import { appendOperationRun, buildOperationRun, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { isLocalAdminRequest } from "../../_lib/localAdminAccess";
import { getSupabaseAdmin, requireServiceRole } from "../../_lib/supabaseAdmin";
import { awardRoundPoints } from "../../_lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isLocalAdminRequest(request)) {
    return jsonError("The local admin routes only run on localhost.", 403);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const season = Number(body?.season || 2026) || 2026;
    const round = Number(body?.round || body?.raceRound || 0);

    if (!round) {
      return jsonError("Missing round for points award.", 400);
    }

    requireServiceRole("awarding points");
    const scoring = await awardRoundPoints(getSupabaseAdmin(), round);

    const message = scoring?.message || `Awarded points for round ${round}.`;
    const run = buildOperationRun("award-points", {
      season,
      round,
      message,
      counts: {
        repaired: Number(scoring?.repaired || 0) || 0,
        changedUsers: Number(scoring?.changedUsers || 0) || 0,
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
      },
      changes: scoring.changes,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not award points.");
  }
}
