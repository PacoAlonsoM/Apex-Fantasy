import "server-only";

import { CAL, isRaceCancelled } from "@/src/constants/calendar";
import { mapRaceSessionsByCalendar } from "@/src/lib/raceCalendar";
import { normalizeWeekendSession } from "@/src/lib/raceWeekend";

const OPENF1_BASE = "https://api.openf1.org/v1";

function sortByDate(items = []) {
  return [...items].sort((left, right) => new Date(left?.date_start || 0) - new Date(right?.date_start || 0));
}

export async function fetchOpenF1Sessions(year) {
  const response = await fetch(`${OPENF1_BASE}/sessions?year=${year}`, {
    headers: {
      accept: "application/json",
      "user-agent": "stint-admin-control-center/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenF1 sessions failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? sortByDate(payload) : [];
}

function groupSessionsByMeeting(sessions) {
  const map = new Map();

  for (const session of sessions || []) {
    const meetingKey = Number(session?.meeting_key || 0);
    if (!meetingKey) continue;
    const current = map.get(meetingKey) || [];
    current.push(session);
    map.set(meetingKey, current);
  }

  return map;
}

function groupRaceMeetings(sessions) {
  return [...groupSessionsByMeeting(sessions).entries()]
    .map(([meetingKey, meetingSessions]) => {
      const sorted = sortByDate(meetingSessions);
      const raceSession = sorted.find((session) => String(session?.session_name || "").toLowerCase() === "race") || null;
      if (!raceSession) return null;
      return { meetingKey: Number(meetingKey), sessions: sorted, raceSession };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(left?.raceSession?.date_start || 0) - new Date(right?.raceSession?.date_start || 0));
}

export function buildScheduleSessionsByRound(calendar, allSessions, season = 2026) {
  const raceSessions = sortByDate((allSessions || []).filter((session) => String(session?.session_name || "").toLowerCase() === "race"));
  const byRoundRaceSession = mapRaceSessionsByCalendar(calendar, raceSessions);
  const sessionsByMeeting = groupSessionsByMeeting(allSessions);

  return Object.entries(byRoundRaceSession).reduce((map, [round, raceSession]) => {
    const roundNumber = Number(round);
    const meetingKey = Number(raceSession?.meeting_key || 0);
    const meetingSessions = sortByDate(sessionsByMeeting.get(meetingKey) || []);

    map[roundNumber] = meetingSessions.map((session) => normalizeWeekendSession({
      ...session,
      season,
      round: roundNumber,
      source: "OpenF1",
      scheduled_start: session?.date_start || null,
      scheduled_end: session?.date_end || null,
    }));

    return map;
  }, {});
}

function buildCanonicalCalendarRow(race, raceSession, meetingSessions, existingRow, season, syncedAt) {
  const overrideStatus = existingRow?.override_status || null;
  const derivedStatus = isRaceCancelled(race)
    ? String(race?.status || "cancelled").toLowerCase()
    : String(raceSession?.date_end || raceSession?.date_start || "").trim()
      ? new Date(String(raceSession?.date_end || raceSession?.date_start)).getTime() < Date.now()
        ? "completed"
        : "scheduled"
      : String(existingRow?.event_status || "").trim().toLowerCase() || "scheduled";

  return {
    season,
    event_slug: race.slug,
    official_name: String(
      raceSession?.meeting_official_name
      || raceSession?.meeting_name
      || existingRow?.official_name
      || race.n
      || ""
    ).trim() || null,
    display_name: race.n || existingRow?.display_name || "Grand Prix",
    country_name: String(raceSession?.country_name || existingRow?.country_name || race.cc || "").trim() || null,
    city_name: String(raceSession?.location || existingRow?.city_name || race.city || "").trim() || null,
    circuit_name: String(raceSession?.circuit_short_name || existingRow?.circuit_name || race.circuit || "").trim() || null,
    race_type: race.type || existingRow?.race_type || null,
    race_date: String(raceSession?.date_start || existingRow?.race_date || race.date || "").slice(0, 10) || null,
    weekend_start: meetingSessions[0]?.date_start || existingRow?.weekend_start || null,
    weekend_end: meetingSessions[meetingSessions.length - 1]?.date_end || meetingSessions[meetingSessions.length - 1]?.date_start || existingRow?.weekend_end || null,
    sprint: meetingSessions.length
      ? meetingSessions.some((session) => String(session?.session_name || "").toLowerCase() === "sprint")
      : Boolean(existingRow?.sprint ?? race.sprint),
    source_round_number: Number(race.displayRound || existingRow?.source_round_number || 0) || null,
    internal_round_number: Number(race.r || existingRow?.internal_round_number || 0) || null,
    meeting_key: Number(raceSession?.meeting_key || existingRow?.meeting_key || 0) || null,
    race_session_key: Number(raceSession?.session_key || existingRow?.race_session_key || 0) || null,
    event_status: overrideStatus || derivedStatus,
    override_status: overrideStatus,
    override_note: existingRow?.override_note || null,
    source_name: raceSession ? "Curated calendar + OpenF1" : "Curated calendar",
    source_url: `${OPENF1_BASE}/sessions?year=${season}`,
    source_payload: {
      sync_mode: "local-admin",
      canonical_round: Number(race.r || 0) || null,
      canonical_display_round: Number(race.displayRound || 0) || null,
      canonical_status: race.status || null,
      meeting_name: raceSession?.meeting_name || null,
      meeting_official_name: raceSession?.meeting_official_name || null,
      session_names: meetingSessions.map((session) => session?.session_name).filter(Boolean),
    },
    last_synced_at: syncedAt,
    updated_at: syncedAt,
  };
}

export async function syncRaceCalendarLocally({ supabase, season = 2026, sessions = null } = {}) {
  if (!supabase) {
    throw new Error("Missing Supabase admin client for local schedule sync.");
  }

  const syncedAt = new Date().toISOString();
  const startedAt = syncedAt;
  const allSessions = Array.isArray(sessions) ? sortByDate(sessions) : await fetchOpenF1Sessions(season);
  const raceSessions = allSessions.filter((session) => String(session?.session_name || "").toLowerCase() === "race");
  const byRoundRaceSession = mapRaceSessionsByCalendar(CAL, raceSessions);
  const sessionsByMeeting = groupSessionsByMeeting(allSessions);
  const raceMeetings = groupRaceMeetings(allSessions);

  const { data: existingRows, error: existingError } = await supabase
    .from("race_calendar")
    .select("event_slug,official_name,display_name,country_name,city_name,circuit_name,race_type,race_date,weekend_start,weekend_end,sprint,source_round_number,internal_round_number,meeting_key,race_session_key,event_status,override_status,override_note")
    .eq("season", season);

  if (existingError) {
    throw existingError;
  }

  const existingBySlug = new Map((existingRows || []).map((row) => [String(row?.event_slug || "").trim().toLowerCase(), row]));
  const matchedMeetingKeys = new Set();
  const rows = CAL.map((race) => {
    const round = Number(race?.r || 0);
    const raceSession = byRoundRaceSession[round] || null;
    const meetingKey = Number(raceSession?.meeting_key || 0);
    const meetingSessions = meetingKey ? sortByDate(sessionsByMeeting.get(meetingKey) || []) : [];
    if (meetingKey) matchedMeetingKeys.add(meetingKey);

    return buildCanonicalCalendarRow(
      race,
      raceSession,
      meetingSessions,
      existingBySlug.get(String(race?.slug || "").trim().toLowerCase()) || null,
      season,
      syncedAt
    );
  });

  const unmatchedMeetings = raceMeetings.filter((meeting) => !matchedMeetingKeys.has(Number(meeting?.meetingKey || 0)));

  const { error: upsertError } = await supabase
    .from("race_calendar")
    .upsert(rows, { onConflict: "season,event_slug" });

  if (upsertError) {
    await supabase.from("race_calendar_sync_runs").insert({
      season,
      status: "error",
      source_name: "Curated calendar + OpenF1",
      error_text: upsertError.message,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    throw upsertError;
  }

  const warnings = [];
  if (unmatchedMeetings.length) {
    warnings.push(`Ignored ${unmatchedMeetings.length} unmatched OpenF1 meeting${unmatchedMeetings.length === 1 ? "" : "s"} that did not map cleanly to the curated calendar.`);
  }

  await supabase.from("race_calendar_sync_runs").insert({
    season,
    status: "ok",
    source_name: "Curated calendar + OpenF1",
    active_count: rows.filter((row) => String(row?.event_status || "").toLowerCase() !== "cancelled").length,
    cancelled_count: rows.filter((row) => String(row?.event_status || "").toLowerCase() === "cancelled").length,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });

  return {
    season,
    upsertedCount: rows.length,
    matchedMeetingCount: matchedMeetingKeys.size,
    unmatchedMeetingCount: unmatchedMeetings.length,
    warnings,
  };
}
