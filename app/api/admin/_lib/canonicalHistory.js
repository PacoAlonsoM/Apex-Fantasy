import "server-only";

import { CAL } from "@/src/constants/calendar";
import { DRV } from "@/src/constants/teams";
import { getDnfDrivers } from "@/src/lib/resultHelpers";
import { normalizeOfficialResultsRow } from "./results";

const DRIVER_TEAM = new Map(DRV.map((driver) => [driver.n, driver.t]));

function toRound(value) {
  return Number(value || 0) || 0;
}

function raceForRound(round) {
  const target = toRound(round);
  return CAL.find((race) => {
    const direct = toRound(race?.r);
    const display = toRound(race?.displayRound);
    return direct === target || display === target;
  }) || null;
}

function raceDate(race) {
  return race?.date ? new Date(`${race.date}T20:00:00Z`).toISOString() : null;
}

function cleanList(values = []) {
  const seen = new Set();
  const rows = [];

  values.forEach((value) => {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    rows.push(text);
  });

  return rows;
}

function buildDriverResults(result) {
  const podium = cleanList([result.winner, result.p2, result.p3]);
  const dnfDrivers = getDnfDrivers(result);
  const rows = [];
  const seen = new Set();

  function addDriver(driver, details = {}) {
    const text = String(driver || "").trim();
    if (!text || seen.has(text)) return;

    rows.push({
      driver: text,
      team: DRIVER_TEAM.get(text) || null,
      weekend_points: 0,
      race_finish: null,
      won_race: false,
      podium: false,
      pole: text === result.pole,
      fastest_lap: text === result.fastest_lap,
      driver_of_the_day: text === result.dotd,
      dnf: false,
      ...details,
    });
    seen.add(text);
  }

  podium.forEach((driver, index) => {
    addDriver(driver, {
      race_finish: index + 1,
      position: index + 1,
      won_race: index === 0,
      podium: true,
      fastest_lap: driver === result.fastest_lap,
    });
  });

  addDriver(result.pole, { pole: true });
  addDriver(result.fastest_lap, { fastest_lap: true });
  addDriver(result.dotd, { driver_of_the_day: true });

  dnfDrivers.forEach((driver) => {
    addDriver(driver, {
      dnf: true,
      fastest_lap: driver === result.fastest_lap,
    });
  });

  return rows;
}

function buildConstructorResults(result) {
  const teams = new Map();
  const podium = cleanList([result.winner, result.p2, result.p3]);

  podium.forEach((driver, index) => {
    const team = DRIVER_TEAM.get(driver);
    if (!team) return;

    const current = teams.get(team) || {
      team,
      weekend_points: 0,
      wins: 0,
      podiums: 0,
      top10_finishes: 0,
      best_constructor: team === result.best_constructor,
    };

    current.wins += index === 0 ? 1 : 0;
    current.podiums += 1;
    current.top10_finishes += 1;
    teams.set(team, current);
  });

  if (result.best_constructor && !teams.has(result.best_constructor)) {
    teams.set(result.best_constructor, {
      team: result.best_constructor,
      weekend_points: 0,
      wins: 0,
      podiums: 0,
      top10_finishes: 0,
      best_constructor: true,
    });
  }

  return [...teams.values()].map((entry) => ({
    ...entry,
    best_constructor: entry.best_constructor || entry.team === result.best_constructor,
  }));
}

export function buildCanonicalHistoryRowFromResult(resultRow, { season = 2026 } = {}) {
  const result = normalizeOfficialResultsRow(resultRow);
  const round = toRound(result?.race_round);
  if (!round || !result?.results_entered) return null;

  const race = raceForRound(round);
  const dnfDrivers = getDnfDrivers(result);
  const podium = cleanList([result.winner, result.p2, result.p3]);
  const now = new Date().toISOString();
  const sprintPodium = cleanList([result.sp_winner, result.sp_p2, result.sp_p3]);

  return {
    season,
    race_round: round,
    race_name: race?.n || `Round ${round}`,
    race_date: raceDate(race),
    meeting_key: null,
    session_key: null,
    race_outcome: {
      source: "published_race_results",
      winner: result.winner || null,
      p2: result.p2 || null,
      p3: result.p3 || null,
      podium,
      fastest_lap: result.fastest_lap || null,
      best_constructor: result.best_constructor || null,
      dnf: dnfDrivers,
      dnf_count: dnfDrivers.length,
      safety_car: Boolean(result.safety_car),
      red_flag: Boolean(result.red_flag),
      safety_car_count: result.safety_car ? 1 : 0,
      red_flag_count: result.red_flag ? 1 : 0,
      dotd: result.dotd || null,
      driver_of_the_day: result.dotd || null,
    },
    qualifying_outcome: {
      source: "published_race_results",
      pole: result.pole || null,
    },
    sprint_outcome: {
      source: "published_race_results",
      pole: result.sp_pole || null,
      winner: result.sp_winner || null,
      p2: result.sp_p2 || null,
      p3: result.sp_p3 || null,
      podium: sprintPodium,
    },
    weather_summary: {},
    strategy_summary: {},
    driver_results: buildDriverResults(result),
    constructor_results: buildConstructorResults(result),
    volatility_summary: {
      source: "published_race_results",
      safety_car: Boolean(result.safety_car),
      red_flag: Boolean(result.red_flag),
      dnf_count: dnfDrivers.length,
    },
    source_payload: {
      source: "published_race_results",
      generated_at: now,
      race_results: result,
    },
    last_synced_at: now,
  };
}

export async function upsertCanonicalHistoryFromResults(supabase, resultsRows = [], { season = 2026 } = {}) {
  const rows = (Array.isArray(resultsRows) ? resultsRows : [resultsRows])
    .map((row) => buildCanonicalHistoryRowFromResult(row, { season }))
    .filter(Boolean);

  if (!rows.length) {
    return { rows: [], count: 0 };
  }

  const { data, error } = await supabase
    .from("race_context_history")
    .upsert(rows, { onConflict: "season,race_round" })
    .select("race_round,race_name");

  if (error) throw error;

  return {
    rows: data || rows.map((row) => ({ race_round: row.race_round, race_name: row.race_name })),
    count: rows.length,
  };
}
