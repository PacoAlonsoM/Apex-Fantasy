import { jsonError, jsonOk } from "../../_lib/response";
import { appendOperationRun, buildOperationRun, roundStoreKey, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { isLocalAdminRequest } from "../../_lib/localAdminAccess";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isLocalAdminRequest(request)) {
    return jsonError("The local admin routes only run on localhost.", 403);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const season = Number(body?.season || 2026) || 2026;
    const round = Number(body?.round || 0);
    const eventStatusOverride = body?.event_status_override || body?.overrideStatus || null;
    const raceLockOverrideAt = body?.race_lock_override_at || null;
    const sprintLockOverrideAt = body?.sprint_lock_override_at || null;
    const adminNote = body?.admin_note || "";

    if (!round) {
      return jsonError("Missing round for schedule override.", 400);
    }

    const updatedAt = new Date().toISOString();
    const run = buildOperationRun("schedule-override", {
      season,
      round,
      message: `Updated schedule controls for round ${round}.`,
      counts: {
        overrides: [eventStatusOverride, raceLockOverrideAt, sprintLockOverrideAt].filter(Boolean).length,
      },
      updatedAt,
    });

    await updateLocalAdminStore(async (store) => {
      store.roundControls[roundStoreKey(season, round)] = {
        season,
        round,
        event_status_override: eventStatusOverride,
        race_lock_override_at: raceLockOverrideAt,
        sprint_lock_override_at: sprintLockOverrideAt,
        admin_note: adminNote || null,
        updatedAt,
      };

      appendOperationRun(store, run);
      return store;
    });

    try {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("race_calendar")
        .update({
          override_status: eventStatusOverride || null,
          override_note: eventStatusOverride ? (adminNote || "Local admin override") : null,
          last_synced_at: updatedAt,
        })
        .eq("season", season)
        .eq("internal_round_number", round);
    } catch (error) {
      console.warn("Local override remote calendar fallback", error?.message || error);
    }

    return jsonOk(run.message, {
      runId: run.id,
      season,
      round,
      controls: {
        event_status_override: eventStatusOverride,
        race_lock_override_at: raceLockOverrideAt,
        sprint_lock_override_at: sprintLockOverrideAt,
        admin_note: adminNote || null,
        updatedAt,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not save schedule override.");
  }
}
