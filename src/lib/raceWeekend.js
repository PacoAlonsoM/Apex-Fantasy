const SESSION_TYPE_ALIASES = {
  race: "race",
  qualifying: "qualifying",
  "sprint qualifying": "sprint_qualifying",
  sprintqualifying: "sprint_qualifying",
  "sprint shootout": "sprint_qualifying",
  sprintshootout: "sprint_qualifying",
  sprint: "sprint",
  practice: "practice",
  fp1: "practice_1",
  "practice 1": "practice_1",
  fp2: "practice_2",
  "practice 2": "practice_2",
  fp3: "practice_3",
  "practice 3": "practice_3",
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

function deriveSessionStatus(session, now) {
  const start = new Date(session?.scheduled_start || session?.date_start || session?.actual_start || 0).getTime();
  const end = new Date(session?.scheduled_end || session?.date_end || session?.actual_end || session?.scheduled_start || 0).getTime();

  if (Number.isFinite(end) && end <= now) return "completed";
  if (Number.isFinite(start) && start <= now && (!Number.isFinite(end) || end > now)) return "live";
  return "scheduled";
}

export function normalizeSessionType(value) {
  const normalized = normalizeText(value);
  return SESSION_TYPE_ALIASES[normalized] || normalized.replace(/\s+/g, "_");
}

export function normalizeWeekendSession(session, now = Date.now()) {
  const sessionType = normalizeSessionType(session?.session_type || session?.session_name);

  return {
    session_name: session?.session_name || null,
    session_type: sessionType,
    scheduled_start: session?.scheduled_start || session?.date_start || null,
    scheduled_end: session?.scheduled_end || session?.date_end || null,
    actual_start: session?.actual_start || null,
    actual_end: session?.actual_end || null,
    session_key: session?.session_key || null,
    meeting_key: session?.meeting_key || null,
    source: session?.source || "OpenF1",
    status: session?.status || deriveSessionStatus(session, now),
    location: session?.location || null,
  };
}

export function sortWeekendSessions(sessions = []) {
  return [...sessions].sort((left, right) => {
    const leftTime = new Date(left?.scheduled_start || left?.date_start || 0).getTime();
    const rightTime = new Date(right?.scheduled_start || right?.date_start || 0).getTime();
    return leftTime - rightTime;
  });
}

export function getBoardLockSessionType(isSprintBoard) {
  return isSprintBoard ? "sprint_qualifying" : "qualifying";
}

export function findBoardLockSession(sessions = [], isSprintBoard = false) {
  const target = getBoardLockSessionType(isSprintBoard);
  return sortWeekendSessions(sessions).find((session) => normalizeSessionType(session?.session_type || session?.session_name) === target) || null;
}

export function applyRoundControlToRace(race, control) {
  if (!race) return race;
  const nextStatus = control?.event_status_override || race?.status || null;
  return {
    ...race,
    status: nextStatus,
    controlNote: control?.admin_note || null,
    raceLockOverrideAt: control?.race_lock_override_at || null,
    sprintLockOverrideAt: control?.sprint_lock_override_at || null,
  };
}

export function resolveBoardLock({ race, control, sessions = [], isSprintBoard = false, now = Date.now() }) {
  const overrideAt = isSprintBoard ? control?.sprint_lock_override_at : control?.race_lock_override_at;
  if (overrideAt) {
    const diff = new Date(overrideAt).getTime() - now;
    return {
      source: "override",
      session: null,
      lockAt: overrideAt,
      locked: diff <= 0,
      diff,
    };
  }

  const session = findBoardLockSession(sessions, isSprintBoard);
  if (session?.scheduled_start) {
    const diff = new Date(session.scheduled_start).getTime() - now;
    return {
      source: "session",
      session,
      lockAt: session.scheduled_start,
      locked: diff <= 0,
      diff,
    };
  }

  return null;
}

