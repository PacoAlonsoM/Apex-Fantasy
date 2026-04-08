import { jsonError, jsonOk } from "../../_lib/response";
import { appendOperationRun, buildOperationRun, readLocalAdminStore, roundStoreKey, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { isLocalAdminRequest } from "../../_lib/localAdminAccess";
import { getSupabaseAdmin, getSupabaseReadClient, requireServiceRole } from "../../_lib/supabaseAdmin";
import { loadAdminCalendarState } from "../../_lib/dashboardData";
import { buildScheduleSessionsByRound, fetchOpenF1Sessions, syncRaceCalendarLocally } from "../../_lib/scheduleSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isLocalAdminRequest(request)) {
    return jsonError("The local admin routes only run on localhost.", 403);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const season = Number(body?.season || 2026) || 2026;
    requireServiceRole("schedule sync");
    const adminSupabase = getSupabaseAdmin();
    const sessions = await fetchOpenF1Sessions(season);
    const syncPayload = await syncRaceCalendarLocally({
      supabase: adminSupabase,
      season,
      sessions,
    });
    const warnings = Array.isArray(syncPayload?.warnings) ? syncPayload.warnings : [];

    const existingStore = await readLocalAdminStore();
    const supabase = getSupabaseReadClient();
    const calendarState = await loadAdminCalendarState({ supabase, store: existingStore, season });
    const byRound = buildScheduleSessionsByRound(calendarState.calendar, sessions, season);

    const run = buildOperationRun("schedule-sync", {
      season,
      status: "ok",
      message: `Updated ${Object.keys(byRound).length} race weekends and refreshed the canonical race calendar locally.`,
      warnings,
      counts: {
        calendarRows: Number(syncPayload?.upsertedCount || 0),
        rounds: Object.keys(byRound).length,
        sessions: sessions.length,
        unmatchedMeetings: Number(syncPayload?.unmatchedMeetingCount || 0),
      },
    });

    await updateLocalAdminStore((store) => {
      Object.entries(byRound).forEach(([round, sessionRows]) => {
        store.scheduleSessions[roundStoreKey(season, round)] = sessionRows;
      });

      appendOperationRun(store, run);
      return store;
    });

    return jsonOk(run.message, {
      runId: run.id,
      season,
      warnings,
      counts: run.counts,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Schedule sync failed.");
  }
}
