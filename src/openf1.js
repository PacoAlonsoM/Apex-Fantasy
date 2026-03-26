import { CONSTRUCTORS, DRV } from "./constants/teams";
import { CAL } from "./constants/calendar";
import { mapRaceSessionsByCalendar } from "./raceCalendar";
import { IS_SNAPSHOT } from "./runtimeFlags";
import { serializeDnfDrivers } from "./resultHelpers";

const BASE = "https://api.openf1.org/v1";
const REQUEST_GAP_MS = IS_SNAPSHOT ? 900 : 450;
const RACE_POINTS = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };
const SPRINT_POINTS = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };
const responseCache = new Map();

const LOCAL_DRIVER_MAP = Object.fromEntries(DRV.map((driver) => [String(driver.nb), driver.n]));
const LOCAL_DRIVER_DETAILS = new Map(
  DRV.map((driver) => [String(driver.nb), { name: driver.n, team: driver.t, driverNumber: driver.nb }])
);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sortByDate(items = []) {
  return [...items].sort((left, right) => new Date(left.date_start || 0) - new Date(right.date_start || 0));
}

function isRateLimitPayload(payload) {
  if (Array.isArray(payload)) return false;
  const text = `${payload?.message || ""} ${payload?.error || ""}`.trim();
  return /rate limit/i.test(text);
}

async function fetchJson(path, options = {}) {
  const { retries = 2 } = options;

  if (responseCache.has(path)) {
    return responseCache.get(path);
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(`${BASE}${path}`);
    const payload = await response.json();

    if (Array.isArray(payload)) {
      responseCache.set(path, payload);
      return payload;
    }

    if ((response.status === 429 || isRateLimitPayload(payload)) && attempt < retries) {
      await wait(REQUEST_GAP_MS * (attempt + 1));
      continue;
    }

    return payload;
  }

  return [];
}

function pointsForResult(row, kind) {
  const nativePoints = Number(row?.points);
  if (Number.isFinite(nativePoints) && nativePoints > 0) return nativePoints;

  const position = Number(row?.position);
  if (!Number.isFinite(position)) return 0;

  return kind === "sprint" ? (SPRINT_POINTS[position] || 0) : (RACE_POINTS[position] || 0);
}

function buildDriverStanding(existing, details, points, kind, position) {
  return {
    name: existing?.name || details.name || `#${details.driverNumber || "?"}`,
    driverNumber: existing?.driverNumber || details.driverNumber || null,
    team: existing?.team || details.team || "Unknown",
    points: (existing?.points || 0) + points,
    wins: (existing?.wins || 0) + (kind === "race" && position === 1 ? 1 : 0),
    podiums: (existing?.podiums || 0) + (kind === "race" && position >= 1 && position <= 3 ? 1 : 0),
    sprintWins: (existing?.sprintWins || 0) + (kind === "sprint" && position === 1 ? 1 : 0),
    bestFinish: Math.min(existing?.bestFinish || 99, position),
  };
}

function buildConstructorStanding(existing, team, points, kind, position) {
  return {
    team,
    points: (existing?.points || 0) + points,
    wins: (existing?.wins || 0) + (kind === "race" && position === 1 ? 1 : 0),
    podiums: (existing?.podiums || 0) + (kind === "race" && position >= 1 && position <= 3 ? 1 : 0),
    sprintWins: (existing?.sprintWins || 0) + (kind === "sprint" && position === 1 ? 1 : 0),
  };
}

function rankEntries(entries, compare) {
  return entries.sort(compare).map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function withLeaderGap(entries) {
  const leaderPoints = entries[0]?.points || 0;
  return entries.map((entry) => ({
    ...entry,
    gapToLeader: entry.rank === 1 ? 0 : leaderPoints - entry.points,
  }));
}

function isSessionCompleted(session, now) {
  const sessionMoment = new Date(session?.date_end || session?.date_start || 0).getTime();
  return Number.isFinite(sessionMoment) && sessionMoment <= now;
}

export async function fetchSeasonStandings(year, options = {}) {
  const { includeSprints = true } = options;
  const now = Date.now();
  const raceSessions = sortByDate(asArray(await fetchJson(`/sessions?year=${year}&session_name=Race`)))
    .filter((session) => isSessionCompleted(session, now));

  let sprintSessions = [];
  if (includeSprints) {
    await wait(REQUEST_GAP_MS);
    sprintSessions = sortByDate(asArray(await fetchJson(`/sessions?year=${year}&session_name=Sprint`)))
      .filter((session) => isSessionCompleted(session, now));
  }

  const sessions = [
    ...raceSessions.map((session) => ({ ...session, __kind: "race" })),
    ...sprintSessions.map((session) => ({ ...session, __kind: "sprint" })),
  ].sort((left, right) => new Date(left.date_start || 0) - new Date(right.date_start || 0));

  const driverStandings = new Map();
  const constructorStandings = new Map();

  for (let index = 0; index < sessions.length; index += 1) {
    if (index > 0) await wait(REQUEST_GAP_MS);

    const session = sessions[index];
    const results = asArray(await fetchJson(`/session_result?session_key=${session.session_key}`));

    for (const row of results) {
      const position = Number(row?.position);
      if (!Number.isFinite(position)) continue;

      const details = LOCAL_DRIVER_DETAILS.get(String(row?.driver_number || "")) || {
        name: `#${row?.driver_number || "?"}`,
        team: "Unknown",
        driverNumber: row?.driver_number || null,
      };
      const team = details.team || "Unknown";
      const points = pointsForResult(row, session.__kind);
      const driverKey = String(row?.driver_number || details.name);

      driverStandings.set(
        driverKey,
        buildDriverStanding(driverStandings.get(driverKey), details, points, session.__kind, position)
      );

      constructorStandings.set(
        team,
        buildConstructorStanding(constructorStandings.get(team), team, points, session.__kind, position)
      );
    }
  }

  const drivers = withLeaderGap(rankEntries([...driverStandings.values()], (left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (right.wins !== left.wins) return right.wins - left.wins;
    if (right.podiums !== left.podiums) return right.podiums - left.podiums;
    if (left.bestFinish !== right.bestFinish) return left.bestFinish - right.bestFinish;
    return String(left.name).localeCompare(String(right.name));
  }));

  const constructors = withLeaderGap(rankEntries([...constructorStandings.values()], (left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (right.wins !== left.wins) return right.wins - left.wins;
    if (right.podiums !== left.podiums) return right.podiums - left.podiums;

    const leftKnown = CONSTRUCTORS.includes(left.team);
    const rightKnown = CONSTRUCTORS.includes(right.team);
    if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;

    return String(left.team).localeCompare(String(right.team));
  }));

  const lastRace = raceSessions[raceSessions.length - 1] || null;

  return {
    year,
    completedRounds: raceSessions.length,
    completedSprints: sprintSessions.length,
    lastRace: lastRace
      ? {
          name: lastRace.meeting_name || (lastRace.country_name ? `${lastRace.country_name} GP` : `Round ${raceSessions.length}`),
          country: lastRace.country_name || null,
          date: lastRace.date_start || null,
        }
      : null,
    drivers,
    constructors,
  };
}

export async function fetchRaceSessions(year) {
  try {
    const data = asArray(await fetchJson(`/sessions?year=${year}&session_name=Race`));
    return sortByDate(data);
  } catch (e) {
    console.error("fetchRaceSessions error:", e);
    return [];
  }
}

export async function fetchMeetingSessions(meetingKey) {
  try {
    const data = asArray(await fetchJson(`/sessions?meeting_key=${meetingKey}`));
    return sortByDate(data);
  } catch (e) {
    console.error("fetchMeetingSessions error:", e);
    return [];
  }
}

// Busca la session_key de una carrera específica por año y número de ronda
export async function getSessionKey(year, round) {
  try {
    const races = await fetchRaceSessions(year);
    const mapped = mapRaceSessionsByCalendar(CAL, races);
    return mapped[round]?.session_key || null;
  } catch (e) {
    console.error("getSessionKey error:", e);
    return null;
  }
}

// Trae los resultados finales de una carrera
export async function getRaceResults(sessionKey) {
  try {
    const data = asArray(await fetchJson(`/session_result?session_key=${sessionKey}`));
    return data.sort((a, b) => (a.position || 99) - (b.position || 99));
  } catch (e) {
    console.error("getRaceResults error:", e);
    return [];
  }
}

// Trae mensajes de race control (safety car, red flag)
export async function getRaceControl(sessionKey) {
  try {
    return asArray(await fetchJson(`/race_control?session_key=${sessionKey}`));
  } catch (e) {
    console.error("getRaceControl error:", e);
    return [];
  }
}

// Trae el fastest lap de la carrera
export async function getFastestLap(sessionKey) {
  try {
    const laps = asArray(await fetchJson(`/laps?session_key=${sessionKey}&is_pit_out_lap=false`));
    if (!laps.length) return null;
    const fastest = laps.reduce((min, l) => 
      l.lap_duration && (!min || l.lap_duration < min.lap_duration) ? l : min, null
    );
    return fastest;
  } catch (e) {
    console.error("getFastestLap error:", e);
    return null;
  }
}

// Trae los drivers de una sesión (para mapear número → nombre)
export async function getDrivers(sessionKey) {
  try {
    return asArray(await fetchJson(`/drivers?session_key=${sessionKey}`));
  } catch (e) {
    console.error("getDrivers error:", e);
    return [];
  }
}

// Función principal: trae todos los datos de una carrera y los formatea
export async function fetchRaceData(year, round) {
  const sessionKey = await getSessionKey(year, round);
  if (!sessionKey) return null;

  const results = await getRaceResults(sessionKey);
  await wait(REQUEST_GAP_MS);

  const raceControl = await getRaceControl(sessionKey);
  await wait(REQUEST_GAP_MS);

  const flData = await getFastestLap(sessionKey);
  await wait(REQUEST_GAP_MS);

  const drivers = await getDrivers(sessionKey);

  // Mapa número de driver → nombre completo
  const driverMap = { ...LOCAL_DRIVER_MAP };
  drivers.forEach(d => {
    driverMap[d.driver_number] = driverMap[d.driver_number] || d.full_name;
  });

  // Resultados ordenados por posición
  const sorted = results
    .filter(r => r.position)
    .sort((a, b) => a.position - b.position);

  const winner = driverMap[sorted[0]?.driver_number] || null;
  const p2 = driverMap[sorted[1]?.driver_number] || null;
  const p3 = driverMap[sorted[2]?.driver_number] || null;

  // DNF = clasificados en posición mayor a los finishers normales o con status de abandono
  const dnfNames = [...new Set(
    results
      .filter(r => r.dnf || (r.position === null && !r.dns && !r.dsq))
      .map(r => driverMap[r.driver_number])
      .filter(Boolean)
  )];

  // Safety car y red flag desde race control
  const safetyCar = raceControl.some(m =>
    /SAFETY CAR/i.test(String(m.message || "")) || String(m.category || "").replace(/\s+/g, "").toLowerCase().includes("safetycar")
  );
  const redFlag = raceControl.some(m =>
    m.flag === "RED" || /RED FLAG/i.test(String(m.message || ""))
  );

  const fastestLap = flData ? driverMap[flData.driver_number] : null;

  return {
    winner,
    p2,
    p3,
    dnf: serializeDnfDrivers(dnfNames),
    dnf_list: dnfNames,
    fastest_lap: fastestLap,
    safety_car: safetyCar,
    red_flag: redFlag,
    raw_results: sorted.map(r => ({
      position: r.position,
      driver: driverMap[r.driver_number],
      driver_number: r.driver_number,
    }))
  };
}
