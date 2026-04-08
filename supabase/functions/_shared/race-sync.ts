// @ts-nocheck

const OPENF1_BASE = "https://api.openf1.org/v1";
const OPENF1_RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const RACE_POINTS = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

const SPRINT_POINTS = {
  1: 8,
  2: 7,
  3: 6,
  4: 5,
  5: 4,
  6: 3,
  7: 2,
  8: 1,
};

const PTS = {
  pole: 10,
  winner: 25,
  p2: 18,
  p3: 15,
  dnf: 12,
  sc: 5,
  rf: 8,
  fl: 7,
  dotd: 6,
  ctor: 8,
  perfectPodium: 15,
  sp_pole: 5,
  sp_winner: 12,
  sp_p2: 9,
  sp_p3: 7,
};

const DRIVER_NAME_ALIASES = {
  "Andrea Kimi Antonelli": "Kimi Antonelli",
  "Alex Albon": "Alexander Albon",
  "Gabriel Bortoleto": "Gabriel Bortoleto",
  "Franco Colapinto": "Franco Colapinto",
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toFiniteNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function roundMetric(value: number | null, digits = 1) {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function average(values: Array<unknown>, digits = 1) {
  const numbers = values
    .map(toFiniteNumber)
    .filter((value): value is number => value !== null);

  if (!numbers.length) return null;

  return roundMetric(
    numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
    digits,
  );
}

function normalizeListValue(value: unknown) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  if (typeof value === "string") {
    return [...new Set(
      value
        .split(/\s*\|\s*|\s*,\s*/)
        .map((item) => item.trim())
        .filter(Boolean)
    )];
  }

  if (value) {
    const normalized = String(value).trim();
    return normalized ? [normalized] : [];
  }

  return [];
}

function serializeListValue(value: unknown) {
  const normalized = normalizeListValue(value);
  return normalized.length ? normalized.join(" | ") : null;
}

export function sortByDate(list: Array<Record<string, unknown>>, field = "date_start") {
  return [...list].sort((left, right) => new Date(String(left[field] || 0)).getTime() - new Date(String(right[field] || 0)).getTime());
}

export function normalizeDriverName(name: string | null | undefined) {
  const clean = String(name || "").trim();
  if (!clean) return null;
  return DRIVER_NAME_ALIASES[clean] || clean;
}

export function normalizeTeamName(name: string | null | undefined) {
  const clean = String(name || "").trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();

  if (lower.includes("mclaren")) return "McLaren";
  if (lower.includes("ferrari")) return "Ferrari";
  if (lower.includes("mercedes")) return "Mercedes";
  if (lower.includes("red bull")) return "Red Bull Racing";
  if (lower.includes("racing bulls") || lower.includes("cash app") || lower.includes("visa rb") || lower === "rb") return "Racing Bulls";
  if (lower.includes("aston")) return "Aston Martin";
  if (lower.includes("alpine")) return "Alpine";
  if (lower.includes("haas")) return "Haas";
  if (lower.includes("williams")) return "Williams";
  if (lower.includes("audi") || lower.includes("sauber")) return "Audi";
  if (lower.includes("cadillac")) return "Cadillac";

  return clean;
}

export async function fetchOpenF1(path: string, options: { optional?: boolean; fallbackValue?: unknown; retries?: number } = {}) {
  const {
    optional = false,
    fallbackValue = [],
    retries = 6,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${OPENF1_BASE}${path}`, {
        headers: {
          accept: "application/json",
          "user-agent": "stint-race-sync/1.0",
        },
      });

      if (response.ok) {
        return await response.json();
      }

      lastError = new Error(`OpenF1 ${path}: ${response.status} ${response.statusText}`);

      if (!OPENF1_RETRYABLE_STATUS.has(response.status) || attempt === retries - 1) {
        break;
      }

      const retryAfterHeader = Number(response.headers.get("retry-after"));
      const retryDelay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : 400 * (attempt + 1) * (attempt + 2);

      await delay(retryDelay);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`OpenF1 ${path}: request failed`);
      if (attempt === retries - 1) break;
      await delay(400 * (attempt + 1) * (attempt + 2));
    }
  }

  if (optional) return fallbackValue;
  throw lastError || new Error(`OpenF1 ${path}: request failed`);
}

function getSessionMoment(session: Record<string, unknown>) {
  return new Date(String(session.date_end || session.date_start || 0)).getTime();
}

function firstByPosition(rows: Array<Record<string, unknown>>, driverLookup: Record<string, Record<string, unknown>>) {
  const sorted = [...rows]
    .filter((row) => Number.isFinite(Number(row.position)))
    .sort((left, right) => Number(left.position) - Number(right.position));

  const winner = sorted[0];
  if (!winner) return null;

  return (
    driverLookup[String(winner.driver_number)]?.name
    || normalizeDriverName(String(winner.full_name || ""))
    || `#${winner.driver_number}`
  );
}

function buildDriverLookup(...driverGroups: Array<Array<Record<string, unknown>>>) {
  const lookup: Record<string, Record<string, unknown>> = {};

  for (const drivers of driverGroups) {
    for (const driver of drivers || []) {
      const numberKey = String(driver.driver_number);
      const rawName = driver.full_name
        || driver.broadcast_name
        || (driver.first_name && driver.last_name ? `${driver.first_name} ${driver.last_name}` : null)
        || driver.name_acronym
        || "";
      const fullName = normalizeDriverName(String(rawName));
      const teamName = normalizeTeamName(String(driver.team_name || driver.team || ""));

      lookup[numberKey] = {
        name: fullName || lookup[numberKey]?.name || `#${numberKey}`,
        team: teamName || lookup[numberKey]?.team || null,
      };
    }
  }

  return lookup;
}

function extractPodium(results: Array<Record<string, unknown>>, driverLookup: Record<string, Record<string, unknown>>) {
  const sorted = [...results]
    .filter((row) => Number.isFinite(Number(row.position)))
    .sort((left, right) => Number(left.position) - Number(right.position));

  return {
    winner: sorted[0] ? driverLookup[String(sorted[0].driver_number)]?.name || `#${sorted[0].driver_number}` : null,
    p2: sorted[1] ? driverLookup[String(sorted[1].driver_number)]?.name || `#${sorted[1].driver_number}` : null,
    p3: sorted[2] ? driverLookup[String(sorted[2].driver_number)]?.name || `#${sorted[2].driver_number}` : null,
  };
}

function extractDnf(results: Array<Record<string, unknown>>, driverLookup: Record<string, Record<string, unknown>>) {
  const dnf = results.find((row) => row.position === null || row.classified_position === null || String(row.status || "").toLowerCase().includes("retired"));
  if (!dnf) return null;
  return driverLookup[String(dnf.driver_number)]?.name || `#${dnf.driver_number}`;
}

function isDnfRow(row: Record<string, unknown>) {
  const position = toFiniteNumber(row?.position);
  const classifiedPosition = toFiniteNumber(row?.classified_position);
  const status = String(row?.status || "").toLowerCase();

  return position === null
    || classifiedPosition === null
    || status.includes("retired")
    || status.includes("accident");
}

function extractDnfDrivers(results: Array<Record<string, unknown>>, driverLookup: Record<string, Record<string, unknown>>) {
  return [...new Set(
    (results || [])
      .filter((row) => isDnfRow(row))
      .map((row) => driverLookup[String(row.driver_number)]?.name || `#${row.driver_number}`)
      .filter(Boolean)
  )];
}

function extractFastestLap(laps: Array<Record<string, unknown>>, driverLookup: Record<string, Record<string, unknown>>) {
  const validLaps = laps.filter((lap) => Number.isFinite(Number(lap.lap_duration)));
  if (!validLaps.length) return null;

  const fastest = validLaps.reduce((best, current) => {
    if (!best) return current;
    return Number(current.lap_duration) < Number(best.lap_duration) ? current : best;
  }, null);

  if (!fastest) return null;
  return driverLookup[String(fastest.driver_number)]?.name || `#${fastest.driver_number}`;
}

function hasSafetyCar(raceControl: Array<Record<string, unknown>>) {
  return raceControl.some((item) => {
    const category = String(item.category || "").toLowerCase();
    const flag = String(item.flag || "").toUpperCase();
    const message = String(item.message || "").toUpperCase();
    return category.includes("safety") || flag === "YELLOW" && message.includes("SAFETY CAR") || message.includes("SAFETY CAR");
  });
}

function hasRedFlag(raceControl: Array<Record<string, unknown>>) {
  return raceControl.some((item) => {
    const flag = String(item.flag || "").toUpperCase();
    const message = String(item.message || "").toUpperCase();
    return flag === "RED" || message.includes("RED FLAG");
  });
}

function sumSessionPoints(
  results: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
  fallbackMap: Record<number, number>,
  extraPointDriverName: string | null = null,
) {
  const totals = new Map<string, number>();
  let usedNativePoints = false;

  for (const row of results || []) {
    const position = Number(row.position);
    if (!Number.isFinite(position)) continue;

    const driverInfo = driverLookup[String(row.driver_number)];
    const teamName = driverInfo?.team;
    if (!teamName) continue;

    const nativePoints = Number(row.points);
    const awarded = Number.isFinite(nativePoints) && nativePoints > 0 ? nativePoints : (fallbackMap[position] || 0);
    if (Number.isFinite(nativePoints) && nativePoints > 0) usedNativePoints = true;

    totals.set(teamName, (totals.get(teamName) || 0) + awarded);
  }

  if (!usedNativePoints && extraPointDriverName) {
    const entry = Object.values(driverLookup).find((driver) => driver.name === extraPointDriverName);
    if (entry?.team) {
      totals.set(entry.team, (totals.get(entry.team) || 0) + 1);
    }
  }

  return totals;
}

function mergeTeamTotals(...maps: Array<Map<string, number>>) {
  const totals = new Map<string, number>();

  for (const map of maps) {
    for (const [team, points] of map.entries()) {
      totals.set(team, (totals.get(team) || 0) + points);
    }
  }

  return totals;
}

function pickBestConstructor(teamTotals: Map<string, number>) {
  const ranked = [...teamTotals.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  });
  return ranked[0]?.[0] || null;
}

function getDnfDrivers(results: Record<string, unknown>) {
  const fromList = normalizeListValue(results?.dnf_list);
  if (fromList.length) return fromList;
  return normalizeListValue(results?.dnf);
}

function pointsForRow(row: Record<string, unknown>, fallbackMap: Record<number, number>) {
  const nativePoints = toFiniteNumber(row?.points);
  if (nativePoints !== null && nativePoints > 0) return nativePoints;

  const position = toFiniteNumber(row?.position);
  if (position === null) return 0;

  return fallbackMap[position] || 0;
}

function buildSessionPositionRows(
  results: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
  fallbackMap: Record<number, number> = {},
) {
  return [...(results || [])]
    .filter((row) => toFiniteNumber(row?.position) !== null)
    .sort((left, right) => Number(left.position) - Number(right.position))
    .map((row) => {
      const driverNumber = String(row.driver_number || "");
      const driver = driverLookup[driverNumber];
      return {
        driver_number: driverNumber ? Number(driverNumber) : null,
        driver: driver?.name || normalizeDriverName(String(row.full_name || "")) || `#${driverNumber || "?"}`,
        team: driver?.team || normalizeTeamName(String(row.team_name || "")) || null,
        position: Number(row.position),
        points: pointsForRow(row, fallbackMap),
        status: String(row.status || "").trim() || null,
        dnf: isDnfRow(row),
      };
    });
}

function countRaceControlEvents(
  raceControl: Array<Record<string, unknown>>,
  predicate: (item: Record<string, unknown>) => boolean,
) {
  const keys = new Set<string>();

  for (const item of raceControl || []) {
    if (!predicate(item)) continue;

    const lap = toFiniteNumber(item.lap_number);
    const date = String(item.date || "").trim();
    const message = String(item.message || "").trim().toUpperCase();
    const key = lap !== null
      ? `lap:${lap}:${message}`
      : date
        ? `date:${date}:${message}`
        : `msg:${message}`;

    keys.add(key);
  }

  return keys.size;
}

function isSafetyCarControl(item: Record<string, unknown>) {
  const category = String(item.category || "").toLowerCase();
  const flag = String(item.flag || "").toUpperCase();
  const message = String(item.message || "").toUpperCase();

  return category.includes("safety")
    || (flag === "YELLOW" && message.includes("SAFETY CAR"))
    || message.includes("SAFETY CAR");
}

function isVirtualSafetyCarControl(item: Record<string, unknown>) {
  const category = String(item.category || "").toLowerCase();
  const message = String(item.message || "").toUpperCase();

  return category.includes("virtual")
    || message.includes("VIRTUAL SAFETY CAR");
}

function isRedFlagControl(item: Record<string, unknown>) {
  const flag = String(item.flag || "").toUpperCase();
  const message = String(item.message || "").toUpperCase();
  return flag === "RED" || message.includes("RED FLAG");
}

function buildWeatherSummary(weatherRows: Array<Record<string, unknown>>) {
  const rows = Array.isArray(weatherRows) ? weatherRows : [];

  return {
    sample_count: rows.length,
    air_temperature_avg: average(rows.map((row) => row.air_temperature), 1),
    air_temperature_min: roundMetric(Math.min(...rows.map((row) => Number(row.air_temperature)).filter(Number.isFinite)), 1),
    air_temperature_max: roundMetric(Math.max(...rows.map((row) => Number(row.air_temperature)).filter(Number.isFinite)), 1),
    track_temperature_avg: average(rows.map((row) => row.track_temperature), 1),
    humidity_avg: average(rows.map((row) => row.humidity), 1),
    pressure_avg: average(rows.map((row) => row.pressure), 1),
    wind_speed_avg: average(rows.map((row) => row.wind_speed), 1),
    rainfall: rows.some((row) => {
      const rainfall = row?.rainfall;
      if (typeof rainfall === "boolean") return rainfall;
      const numeric = toFiniteNumber(rainfall);
      return numeric !== null && numeric > 0;
    }),
  };
}

function buildStrategySummary(
  stints: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
) {
  const grouped = new Map<string, Array<Record<string, unknown>>>();

  for (const stint of stints || []) {
    const key = String(stint.driver_number || "");
    if (!key) continue;
    const current = grouped.get(key) || [];
    current.push(stint);
    grouped.set(key, current);
  }

  const openingCompounds: Record<string, number> = {};
  const compoundUsage: Record<string, number> = {};
  const driverStintCounts = [...grouped.entries()].map(([driverNumber, rows]) => {
    const sortedRows = [...rows].sort((left, right) => Number(left.stint_number || 0) - Number(right.stint_number || 0));
    const driver = driverLookup[driverNumber];
    const compounds = sortedRows.map((row) => String(row.compound || "").trim()).filter(Boolean);
    const openingCompound = compounds[0] || null;
    const stintCount = sortedRows.length;
    const pitStops = Math.max(stintCount - 1, 0);

    if (openingCompound) {
      openingCompounds[openingCompound] = (openingCompounds[openingCompound] || 0) + 1;
    }

    for (const compound of compounds) {
      compoundUsage[compound] = (compoundUsage[compound] || 0) + 1;
    }

    return {
      driver: driver?.name || `#${driverNumber}`,
      team: driver?.team || null,
      stint_count: stintCount,
      pit_stops: pitStops,
      opening_compound: openingCompound,
      compounds,
    };
  });

  const mostCommonByCount = (counts: Record<string, number>) => (
    Object.entries(counts)
      .sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1];
        return left[0].localeCompare(right[0]);
      })[0]?.[0] || null
  );

  return {
    sample_driver_count: driverStintCounts.length,
    average_stints_per_driver: average(driverStintCounts.map((item) => item.stint_count), 2),
    average_pit_stops_per_driver: average(driverStintCounts.map((item) => item.pit_stops), 2),
    zero_stop_drivers: driverStintCounts.filter((item) => item.pit_stops === 0).length,
    one_stop_drivers: driverStintCounts.filter((item) => item.pit_stops === 1).length,
    two_stop_drivers: driverStintCounts.filter((item) => item.pit_stops === 2).length,
    three_plus_stop_drivers: driverStintCounts.filter((item) => item.pit_stops >= 3).length,
    most_common_opening_compound: mostCommonByCount(openingCompounds),
    most_common_compound: mostCommonByCount(compoundUsage),
    opening_compounds: openingCompounds,
    compound_usage: compoundUsage,
    driver_stint_counts: driverStintCounts,
  };
}

function buildDriverResults(
  driverLookup: Record<string, Record<string, unknown>>,
  raceResults: Array<Record<string, unknown>>,
  qualifyingResults: Array<Record<string, unknown>>,
  sprintResults: Array<Record<string, unknown>>,
  sprintQualifyingResults: Array<Record<string, unknown>>,
  fastestLap: string | null,
) {
  const raceRows = buildSessionPositionRows(raceResults, driverLookup, RACE_POINTS);
  const qualifyingRows = buildSessionPositionRows(qualifyingResults, driverLookup);
  const sprintRows = buildSessionPositionRows(sprintResults, driverLookup, SPRINT_POINTS);
  const sprintQualifyingRows = buildSessionPositionRows(sprintQualifyingResults, driverLookup);

  const raceByDriver = new Map(raceRows.map((row) => [String(row.driver_number), row]));
  const qualifyingByDriver = new Map(qualifyingRows.map((row) => [String(row.driver_number), row]));
  const sprintByDriver = new Map(sprintRows.map((row) => [String(row.driver_number), row]));
  const sprintQualifyingByDriver = new Map(sprintQualifyingRows.map((row) => [String(row.driver_number), row]));
  const driverNumbers = [...new Set([
    ...raceByDriver.keys(),
    ...qualifyingByDriver.keys(),
    ...sprintByDriver.keys(),
    ...sprintQualifyingByDriver.keys(),
  ])];

  return driverNumbers
    .map((driverNumber) => {
      const raceRow = raceByDriver.get(driverNumber);
      const qualifyingRow = qualifyingByDriver.get(driverNumber);
      const sprintRow = sprintByDriver.get(driverNumber);
      const sprintQualifyingRow = sprintQualifyingByDriver.get(driverNumber);
      const fallbackDriver = driverLookup[driverNumber];
      const driverName = raceRow?.driver || qualifyingRow?.driver || sprintRow?.driver || sprintQualifyingRow?.driver || fallbackDriver?.name || `#${driverNumber}`;
      const teamName = raceRow?.team || qualifyingRow?.team || sprintRow?.team || sprintQualifyingRow?.team || fallbackDriver?.team || null;
      const raceFinish = toFiniteNumber(raceRow?.position);
      const qualifyingFinish = toFiniteNumber(qualifyingRow?.position);
      const sprintFinish = toFiniteNumber(sprintRow?.position);
      const sprintQualifyingFinish = toFiniteNumber(sprintQualifyingRow?.position);
      const racePoints = toFiniteNumber(raceRow?.points) || 0;
      const sprintPoints = toFiniteNumber(sprintRow?.points) || 0;

      return {
        driver: driverName,
        team: teamName,
        race_finish: raceFinish,
        qualifying_finish: qualifyingFinish,
        sprint_finish: sprintFinish,
        sprint_qualifying_finish: sprintQualifyingFinish,
        race_points: racePoints,
        sprint_points: sprintPoints,
        weekend_points: racePoints + sprintPoints,
        won_race: raceFinish === 1,
        podium: raceFinish !== null && raceFinish >= 1 && raceFinish <= 3,
        pole: qualifyingFinish === 1,
        fastest_lap: fastestLap === driverName,
        dnf: Boolean(raceRow?.dnf),
        status: raceRow?.status || null,
      };
    })
    .sort((left, right) => {
      const leftFinish = left.race_finish ?? 999;
      const rightFinish = right.race_finish ?? 999;
      if (leftFinish !== rightFinish) return leftFinish - rightFinish;

      const leftQualifying = left.qualifying_finish ?? 999;
      const rightQualifying = right.qualifying_finish ?? 999;
      if (leftQualifying !== rightQualifying) return leftQualifying - rightQualifying;

      return String(left.driver).localeCompare(String(right.driver));
    });
}

function buildConstructorResults(
  driverResults: Array<Record<string, unknown>>,
  raceTeamTotals: Map<string, number>,
  sprintTeamTotals: Map<string, number>,
  bestConstructor: string | null,
) {
  const driverCounts = new Map<string, Array<Record<string, unknown>>>();

  for (const entry of driverResults || []) {
    const team = String(entry.team || "").trim();
    if (!team) continue;
    const current = driverCounts.get(team) || [];
    current.push(entry);
    driverCounts.set(team, current);
  }

  return [...new Set([
    ...driverCounts.keys(),
    ...raceTeamTotals.keys(),
    ...sprintTeamTotals.keys(),
  ])]
    .map((team) => {
      const teamDrivers = driverCounts.get(team) || [];
      const racePoints = raceTeamTotals.get(team) || 0;
      const sprintPoints = sprintTeamTotals.get(team) || 0;

      return {
        team,
        race_points: racePoints,
        sprint_points: sprintPoints,
        weekend_points: racePoints + sprintPoints,
        wins: teamDrivers.filter((entry) => entry.won_race).length,
        podiums: teamDrivers.filter((entry) => entry.podium).length,
        top10_finishes: teamDrivers.filter((entry) => {
          const finish = toFiniteNumber(entry.race_finish);
          return finish !== null && finish <= 10;
        }).length,
        best_constructor: bestConstructor === team,
        drivers: teamDrivers.map((entry) => entry.driver),
      };
    })
    .sort((left, right) => {
      if (right.weekend_points !== left.weekend_points) return right.weekend_points - left.weekend_points;
      if (right.wins !== left.wins) return right.wins - left.wins;
      if (right.podiums !== left.podiums) return right.podiums - left.podiums;
      return left.team.localeCompare(right.team);
    });
}

function buildQualifyingOutcome(
  qualifyingResults: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
) {
  const qualifyingRows = buildSessionPositionRows(qualifyingResults, driverLookup);
  return {
    pole: qualifyingRows[0]?.driver || null,
    front_row: qualifyingRows.slice(0, 2).map((row) => row.driver),
    top_10: qualifyingRows.slice(0, 10).map((row) => row.driver),
    positions: qualifyingRows.slice(0, 10),
  };
}

function buildSprintOutcome(
  sprintResults: Array<Record<string, unknown>>,
  sprintQualifyingResults: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
) {
  const sprintRows = buildSessionPositionRows(sprintResults, driverLookup, SPRINT_POINTS);
  const sprintQualifyingRows = buildSessionPositionRows(sprintQualifyingResults, driverLookup);

  return {
    has_sprint: sprintRows.length > 0 || sprintQualifyingRows.length > 0,
    sprint_pole: sprintQualifyingRows[0]?.driver || null,
    podium: sprintRows.slice(0, 3).map((row) => row.driver),
    positions: sprintRows.slice(0, 8),
  };
}

function buildVolatilitySummary(
  raceControl: Array<Record<string, unknown>>,
  dnfDrivers: Array<string>,
) {
  const safetyCarCount = countRaceControlEvents(raceControl, isSafetyCarControl);
  const virtualSafetyCarCount = countRaceControlEvents(raceControl, isVirtualSafetyCarControl);
  const redFlagCount = countRaceControlEvents(raceControl, isRedFlagControl);

  return {
    dnf_count: dnfDrivers.length,
    dnf_drivers: dnfDrivers,
    safety_car: safetyCarCount > 0,
    safety_car_count: safetyCarCount,
    virtual_safety_car_count: virtualSafetyCarCount,
    red_flag: redFlagCount > 0,
    red_flag_count: redFlagCount,
  };
}

function buildRaceOutcome(
  podium: { winner: string | null; p2: string | null; p3: string | null },
  dnfDrivers: Array<string>,
  fastestLap: string | null,
  bestConstructor: string | null,
  raceResults: Array<Record<string, unknown>>,
  volatilitySummary: Record<string, unknown>,
) {
  const classifiedResults = (raceResults || []).filter((row) => toFiniteNumber(row.position) !== null);

  return {
    winner: podium.winner,
    p2: podium.p2,
    p3: podium.p3,
    podium: [podium.winner, podium.p2, podium.p3].filter(Boolean),
    fastest_lap: fastestLap,
    best_constructor: bestConstructor,
    dnf_driver: dnfDrivers[0] || null,
    dnf_drivers: dnfDrivers,
    dnf_count: dnfDrivers.length,
    finishers_count: classifiedResults.length,
    safety_car_count: Number(volatilitySummary.safety_car_count || 0),
    red_flag_count: Number(volatilitySummary.red_flag_count || 0),
  };
}

function sortByEventMoment(items: Array<Record<string, unknown>>, dateField = "date") {
  return [...(items || [])].sort((left, right) => {
    const leftLap = toFiniteNumber(left?.lap_number);
    const rightLap = toFiniteNumber(right?.lap_number);
    if (leftLap !== null && rightLap !== null && leftLap !== rightLap) return leftLap - rightLap;

    const leftTime = new Date(String(left?.[dateField] || 0)).getTime();
    const rightTime = new Date(String(right?.[dateField] || 0)).getTime();
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;

    return 0;
  });
}

function buildMeetingSessionMetadata(meetingSessions: Array<Record<string, unknown>>) {
  return sortByDate(meetingSessions || []).map((session) => ({
    session_key: toFiniteNumber(session?.session_key),
    meeting_key: toFiniteNumber(session?.meeting_key),
    session_name: session?.session_name || null,
    session_type: session?.session_type || null,
    date_start: session?.date_start || null,
    date_end: session?.date_end || null,
    country_name: session?.country_name || null,
    location: session?.location || null,
    circuit_short_name: session?.circuit_short_name || null,
  }));
}

function buildClassificationDetail(
  results: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
  fallbackMap: Record<number, number> = {},
) {
  return buildSessionPositionRows(results, driverLookup, fallbackMap);
}

function buildStartingGridRows(
  startingGrid: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
) {
  return [...(startingGrid || [])]
    .filter((row) => toFiniteNumber(row?.position) !== null)
    .sort((left, right) => Number(left.position) - Number(right.position))
    .map((row) => {
      const driverNumber = String(row?.driver_number || "");
      const driver = driverLookup[driverNumber];
      return {
        position: Number(row.position),
        driver_number: driverNumber ? Number(driverNumber) : null,
        driver: driver?.name || `#${driverNumber || "?"}`,
        team: driver?.team || null,
      };
    });
}

function buildRaceControlEventList(
  raceControl: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
) {
  return sortByEventMoment(raceControl || []).map((item) => {
    const driverNumber = String(item?.driver_number || "").trim();
    return {
      lap_number: toFiniteNumber(item?.lap_number),
      date: item?.date || null,
      category: item?.category || null,
      flag: item?.flag || null,
      scope: item?.scope || null,
      message: item?.message || null,
      driver_number: driverNumber ? Number(driverNumber) : null,
      driver: driverNumber ? driverLookup[driverNumber]?.name || `#${driverNumber}` : null,
    };
  });
}

function pickSparseSamples(rows: Array<Record<string, unknown>>, limit = 12) {
  if (!rows.length || rows.length <= limit) return rows;

  const samples = [];
  for (let index = 0; index < limit; index += 1) {
    const rowIndex = Math.min(rows.length - 1, Math.round((index * (rows.length - 1)) / Math.max(limit - 1, 1)));
    samples.push(rows[rowIndex]);
  }

  return samples.filter((row, index) => samples.findIndex((candidate) => candidate === row) === index);
}

function buildWeatherTimeline(weatherRows: Array<Record<string, unknown>>) {
  const ordered = sortByEventMoment(weatherRows || []);
  return pickSparseSamples(ordered, 12).map((row) => ({
    date: row?.date || null,
    air_temperature: toFiniteNumber(row?.air_temperature),
    track_temperature: toFiniteNumber(row?.track_temperature),
    humidity: toFiniteNumber(row?.humidity),
    pressure: toFiniteNumber(row?.pressure),
    wind_speed: toFiniteNumber(row?.wind_speed),
    rainfall: typeof row?.rainfall === "boolean" ? row.rainfall : toFiniteNumber(row?.rainfall),
  }));
}

function buildLapSummary(
  raceLaps: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
) {
  const validLaps = (raceLaps || []).filter((lap) => toFiniteNumber(lap?.lap_duration) !== null);
  const grouped = new Map<string, Array<Record<string, unknown>>>();

  for (const lap of validLaps) {
    const driverNumber = String(lap?.driver_number || "").trim();
    if (!driverNumber) continue;
    const current = grouped.get(driverNumber) || [];
    current.push(lap);
    grouped.set(driverNumber, current);
  }

  const fastestLaps = [...validLaps]
    .sort((left, right) => Number(left.lap_duration) - Number(right.lap_duration))
    .slice(0, 10)
    .map((lap) => {
      const driverNumber = String(lap?.driver_number || "").trim();
      return {
        lap_number: toFiniteNumber(lap?.lap_number),
        lap_duration: roundMetric(lap?.lap_duration, 3),
        sector_1: roundMetric(lap?.duration_sector_1, 3),
        sector_2: roundMetric(lap?.duration_sector_2, 3),
        sector_3: roundMetric(lap?.duration_sector_3, 3),
        driver_number: driverNumber ? Number(driverNumber) : null,
        driver: driverNumber ? driverLookup[driverNumber]?.name || `#${driverNumber}` : null,
        team: driverNumber ? driverLookup[driverNumber]?.team || null : null,
      };
    });

  const driverPace = [...grouped.entries()]
    .map(([driverNumber, laps]) => ({
      driver_number: Number(driverNumber),
      driver: driverLookup[driverNumber]?.name || `#${driverNumber}`,
      team: driverLookup[driverNumber]?.team || null,
      lap_count: laps.length,
      best_lap: roundMetric(Math.min(...laps.map((lap) => Number(lap.lap_duration)).filter(Number.isFinite)), 3),
      average_lap: average(laps.map((lap) => lap.lap_duration), 3),
    }))
    .sort((left, right) => {
      const leftBest = toFiniteNumber(left?.best_lap) ?? Number.POSITIVE_INFINITY;
      const rightBest = toFiniteNumber(right?.best_lap) ?? Number.POSITIVE_INFINITY;
      if (leftBest !== rightBest) return leftBest - rightBest;
      return String(left.driver || "").localeCompare(String(right.driver || ""));
    });

  return {
    sampled_laps: validLaps.length,
    fastest_laps: fastestLaps,
    driver_pace: driverPace.slice(0, 22),
  };
}

function buildStrategyDetail(
  stints: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
) {
  const grouped = new Map<string, Array<Record<string, unknown>>>();

  for (const stint of stints || []) {
    const driverNumber = String(stint?.driver_number || "").trim();
    if (!driverNumber) continue;
    const current = grouped.get(driverNumber) || [];
    current.push(stint);
    grouped.set(driverNumber, current);
  }

  return {
    stints_by_driver: [...grouped.entries()].map(([driverNumber, rows]) => ({
      driver_number: Number(driverNumber),
      driver: driverLookup[driverNumber]?.name || `#${driverNumber}`,
      team: driverLookup[driverNumber]?.team || null,
      stints: [...rows]
        .sort((left, right) => Number(left?.stint_number || 0) - Number(right?.stint_number || 0))
        .map((row) => ({
          stint_number: toFiniteNumber(row?.stint_number),
          compound: row?.compound || null,
          lap_start: toFiniteNumber(row?.lap_start),
          lap_end: toFiniteNumber(row?.lap_end),
          tyre_age_at_start: toFiniteNumber(row?.tyre_age_at_start),
        })),
    })),
  };
}

function buildPitStopSummary(
  pitStops: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
) {
  const grouped = new Map<string, Array<Record<string, unknown>>>();

  for (const stop of pitStops || []) {
    const driverNumber = String(stop?.driver_number || "").trim();
    if (!driverNumber) continue;
    const current = grouped.get(driverNumber) || [];
    current.push(stop);
    grouped.set(driverNumber, current);
  }

  const byDriver = [...grouped.entries()].map(([driverNumber, rows]) => ({
    driver_number: Number(driverNumber),
    driver: driverLookup[driverNumber]?.name || `#${driverNumber}`,
    team: driverLookup[driverNumber]?.team || null,
    stop_count: rows.length,
    average_pit_duration: average(rows.map((row) => row?.pit_duration), 3),
    longest_pit_duration: roundMetric(Math.max(...rows.map((row) => Number(row?.pit_duration)).filter(Number.isFinite)), 3),
    stops: sortByEventMoment(rows).map((row) => ({
      lap_number: toFiniteNumber(row?.lap_number),
      date: row?.date || null,
      pit_duration: roundMetric(row?.pit_duration, 3),
    })),
  }));

  return {
    total_pit_events: (pitStops || []).length,
    by_driver: byDriver.sort((left, right) => Number(right.stop_count || 0) - Number(left.stop_count || 0)),
  };
}

function buildOvertakeSummary(
  overtakes: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
) {
  const overtakerCounts: Record<string, number> = {};
  const overtakenCounts: Record<string, number> = {};
  const notableMoves = sortByEventMoment(overtakes || []).slice(0, 40).map((move) => {
    const overtakingNumber = String(move?.overtaking_driver_number || "").trim();
    const overtakenNumber = String(move?.overtaken_driver_number || "").trim();

    if (overtakingNumber) overtakerCounts[overtakingNumber] = (overtakerCounts[overtakingNumber] || 0) + 1;
    if (overtakenNumber) overtakenCounts[overtakenNumber] = (overtakenCounts[overtakenNumber] || 0) + 1;

    return {
      lap_number: toFiniteNumber(move?.lap_number),
      date: move?.date || null,
      overtaking_driver_number: overtakingNumber ? Number(overtakingNumber) : null,
      overtaking_driver: overtakingNumber ? driverLookup[overtakingNumber]?.name || `#${overtakingNumber}` : null,
      overtaken_driver_number: overtakenNumber ? Number(overtakenNumber) : null,
      overtaken_driver: overtakenNumber ? driverLookup[overtakenNumber]?.name || `#${overtakenNumber}` : null,
    };
  });

  const rankCounts = (counts: Record<string, number>, key: "driver" | "victim") => (
    Object.entries(counts)
      .map(([driverNumber, count]) => ({
        driver_number: Number(driverNumber),
        driver: driverLookup[driverNumber]?.name || `#${driverNumber}`,
        team: driverLookup[driverNumber]?.team || null,
        count,
      }))
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return String(left.driver || "").localeCompare(String(right.driver || ""));
      })
      .slice(0, 10)
  );

  return {
    total_overtakes: (overtakes || []).length,
    top_overtakers: rankCounts(overtakerCounts, "driver"),
    most_overtaken: rankCounts(overtakenCounts, "victim"),
    notable_moves: notableMoves,
  };
}

function buildPositionSummary(
  positionRows: Array<Record<string, unknown>>,
  driverLookup: Record<string, Record<string, unknown>>,
) {
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  const ordered = sortByEventMoment(positionRows || []);

  for (const row of ordered) {
    const driverNumber = String(row?.driver_number || "").trim();
    if (!driverNumber) continue;
    const current = grouped.get(driverNumber) || [];
    current.push(row);
    grouped.set(driverNumber, current);
  }

  const byDriver = [...grouped.entries()].map(([driverNumber, rows]) => ({
    driver_number: Number(driverNumber),
    driver: driverLookup[driverNumber]?.name || `#${driverNumber}`,
    team: driverLookup[driverNumber]?.team || null,
    sample_count: rows.length,
    best_position: Math.min(...rows.map((row) => Number(row?.position)).filter(Number.isFinite)),
    worst_position: Math.max(...rows.map((row) => Number(row?.position)).filter(Number.isFinite)),
    average_position: average(rows.map((row) => row?.position), 2),
    latest_position: toFiniteNumber(rows[rows.length - 1]?.position),
  }))
    .sort((left, right) => {
      const leftBest = toFiniteNumber(left?.best_position) ?? Number.POSITIVE_INFINITY;
      const rightBest = toFiniteNumber(right?.best_position) ?? Number.POSITIVE_INFINITY;
      if (leftBest !== rightBest) return leftBest - rightBest;
      return String(left.driver || "").localeCompare(String(right.driver || ""));
    });

  const leaderTimeline = [];
  for (const row of ordered) {
    if (toFiniteNumber(row?.position) !== 1) continue;
    const driverNumber = String(row?.driver_number || "").trim();
    const driver = driverLookup[driverNumber]?.name || `#${driverNumber || "?"}`;
    const previous = leaderTimeline[leaderTimeline.length - 1];
    if (previous?.driver === driver) continue;
    leaderTimeline.push({
      date: row?.date || null,
      driver_number: driverNumber ? Number(driverNumber) : null,
      driver,
    });
  }

  return {
    sampled_points: ordered.length,
    leader_changes: Math.max(leaderTimeline.length - 1, 0),
    leader_timeline: leaderTimeline.slice(0, 20),
    by_driver: byDriver.slice(0, 22),
  };
}

function buildHistorySourcePayload({
  raceSession,
  meetingSessions,
  raceResults,
  qualifyingResults,
  sprintResults,
  sprintQualifyingResults,
  driverLookup,
  raceControl,
  raceLaps,
  weatherRows,
  stints,
  pitStops,
  overtakes,
  positionRows,
  startingGrid,
}: {
  raceSession: Record<string, unknown>;
  meetingSessions: Array<Record<string, unknown>>;
  raceResults: Array<Record<string, unknown>>;
  qualifyingResults: Array<Record<string, unknown>>;
  sprintResults: Array<Record<string, unknown>>;
  sprintQualifyingResults: Array<Record<string, unknown>>;
  driverLookup: Record<string, Record<string, unknown>>;
  raceControl: Array<Record<string, unknown>>;
  raceLaps: Array<Record<string, unknown>>;
  weatherRows: Array<Record<string, unknown>>;
  stints: Array<Record<string, unknown>>;
  pitStops: Array<Record<string, unknown>>;
  overtakes: Array<Record<string, unknown>>;
  positionRows: Array<Record<string, unknown>>;
  startingGrid: Array<Record<string, unknown>>;
}) {
  return {
    meeting_name: raceSession?.meeting_name || null,
    country_name: raceSession?.country_name || null,
    circuit: raceSession?.circuit_short_name || null,
    session_names: (meetingSessions || []).map((session) => session?.session_name).filter(Boolean),
    meeting_sessions: buildMeetingSessionMetadata(meetingSessions),
    starting_grid: buildStartingGridRows(startingGrid, driverLookup),
    race_classification: buildClassificationDetail(raceResults, driverLookup, RACE_POINTS),
    qualifying_classification: buildClassificationDetail(qualifyingResults, driverLookup),
    sprint_classification: buildClassificationDetail(sprintResults, driverLookup, SPRINT_POINTS),
    sprint_qualifying_classification: buildClassificationDetail(sprintQualifyingResults, driverLookup),
    race_control_events: buildRaceControlEventList(raceControl, driverLookup),
    race_control_summary: buildVolatilitySummary(raceControl, extractDnfDrivers(raceResults, driverLookup)),
    lap_summary: buildLapSummary(raceLaps, driverLookup),
    weather_summary_detail: buildWeatherSummary(weatherRows),
    weather_timeline: buildWeatherTimeline(weatherRows),
    strategy_detail: buildStrategyDetail(stints, driverLookup),
    pit_stop_summary: buildPitStopSummary(pitStops, driverLookup),
    overtake_summary: buildOvertakeSummary(overtakes, driverLookup),
    position_summary: buildPositionSummary(positionRows, driverLookup),
    counts: {
      race_results: (raceResults || []).length,
      qualifying_results: (qualifyingResults || []).length,
      sprint_results: (sprintResults || []).length,
      sprint_qualifying_results: (sprintQualifyingResults || []).length,
      race_control: (raceControl || []).length,
      laps: (raceLaps || []).length,
      weather: (weatherRows || []).length,
      stints: (stints || []).length,
      pit_stops: (pitStops || []).length,
      overtakes: (overtakes || []).length,
      positions: (positionRows || []).length,
      starting_grid: (startingGrid || []).length,
    },
  };
}

function buildRaceIntegritySummary({
  raceSession,
  raceResults,
  podium,
  dnfDrivers,
}: {
  raceSession: Record<string, unknown> | null;
  raceResults: Array<Record<string, unknown>>;
  podium: { winner: string | null; p2: string | null; p3: string | null };
  dnfDrivers: string[];
}) {
  const classifiedResults = (raceResults || []).filter((row) => toFiniteNumber(row.position) !== null);
  const uniqueDrivers = new Set(
    (raceResults || [])
      .map((row) => String(row?.driver_number || "").trim())
      .filter(Boolean),
  );
  const podiumPositions = new Set(classifiedResults.map((row) => Number(row.position)));
  const sessionMoment = raceSession ? getSessionMoment(raceSession) : Number.NaN;
  const sessionCompleted = Number.isFinite(sessionMoment) && sessionMoment < Date.now();
  const hasPodium = Boolean(podium?.winner && podium?.p2 && podium?.p3);
  const hasTopThreePositions = [1, 2, 3].every((position) => podiumPositions.has(position));
  const classifiedCount = classifiedResults.length;
  const totalRows = (raceResults || []).length;
  const dnfCount = dnfDrivers.length;

  const isSafeToPersist = sessionCompleted
    && totalRows >= 15
    && uniqueDrivers.size >= 15
    && classifiedCount >= 10
    && hasPodium
    && hasTopThreePositions
    && dnfCount < totalRows;

  return {
    sessionCompleted,
    totalRows,
    uniqueDriverCount: uniqueDrivers.size,
    classifiedCount,
    dnfCount,
    hasPodium,
    hasTopThreePositions,
    isSafeToPersist,
  };
}

export async function getRaceSessions(year: number) {
  const raw = await fetchOpenF1(`/sessions?year=${year}&session_name=Race`);
  return sortByDate(raw);
}

async function findCalendarRowForRound({
  supabase,
  year,
  round,
}: {
  supabase?: unknown;
  year: number;
  round: number;
}) {
  if (!supabase || !round) return null;

  const byInternal = await supabase
    .from("race_calendar")
    .select("event_slug,meeting_key,race_session_key,source_round_number,internal_round_number")
    .eq("season", year)
    .eq("internal_round_number", round)
    .maybeSingle();

  if (byInternal?.data) return byInternal.data;

  const bySource = await supabase
    .from("race_calendar")
    .select("event_slug,meeting_key,race_session_key,source_round_number,internal_round_number")
    .eq("season", year)
    .eq("source_round_number", round)
    .maybeSingle();

  return bySource?.data || null;
}

async function findCalendarRowForSession({
  supabase,
  year,
  session,
}: {
  supabase?: unknown;
  year: number;
  session: Record<string, unknown> | null;
}) {
  if (!supabase || !session?.session_key) return null;

  const bySessionKey = await supabase
    .from("race_calendar")
    .select("event_slug,meeting_key,race_session_key,source_round_number,internal_round_number")
    .eq("season", year)
    .eq("race_session_key", Number(session.session_key))
    .maybeSingle();

  if (bySessionKey?.data) return bySessionKey.data;

  if (!session?.meeting_key) return null;

  const byMeetingKey = await supabase
    .from("race_calendar")
    .select("event_slug,meeting_key,race_session_key,source_round_number,internal_round_number")
    .eq("season", year)
    .eq("meeting_key", Number(session.meeting_key))
    .maybeSingle();

  return byMeetingKey?.data || null;
}

export async function inferLatestCompletedRound(year: number, options: { supabase?: unknown } = {}) {
  const { supabase } = options;
  const raceSessions = await getRaceSessions(year);
  const now = Date.now();
  const completed = raceSessions
    .map((session, index) => ({ session, round: index + 1 }))
    .filter(({ session }) => getSessionMoment(session) < now);

  const latest = completed[completed.length - 1] || null;
  if (!latest) return null;

  try {
    const calendarRow = await findCalendarRowForSession({ supabase, year, session: latest.session });
    if (calendarRow?.internal_round_number) {
      return { ...latest, round: Number(calendarRow.internal_round_number) };
    }
    if (calendarRow?.source_round_number) {
      return { ...latest, round: Number(calendarRow.source_round_number) };
    }
  } catch (_error) {
    // Fall back to OpenF1 ordering if race_calendar is not available yet.
  }

  return latest;
}

export async function inferCompletedRounds(year: number, options: { supabase?: unknown } = {}) {
  const { supabase } = options;
  const raceSessions = await getRaceSessions(year);
  const now = Date.now();
  const completed = raceSessions
    .map((session, index) => ({ session, round: index + 1 }))
    .filter(({ session }) => getSessionMoment(session) < now);

  const mapped = await Promise.all(
    completed.map(async ({ session, round }) => {
      try {
        const calendarRow = await findCalendarRowForSession({ supabase, year, session });
        if (calendarRow?.internal_round_number) {
          return Number(calendarRow.internal_round_number);
        }
        if (calendarRow?.source_round_number) {
          return Number(calendarRow.source_round_number);
        }
      } catch (_error) {
        // Fall back to OpenF1 ordering if race_calendar is not available yet.
      }

      return round;
    }),
  );

  return [...new Set(mapped.filter((round) => Number.isFinite(round) && round > 0))]
    .sort((left, right) => left - right);
}

export async function syncRaceRoundFromOpenF1({
  supabase,
  year,
  round,
  persist = true,
  persistRaceResults,
  persistRaceContextHistory,
}: {
  supabase: unknown;
  year: number;
  round: number;
  persist?: boolean;
  persistRaceResults?: boolean;
  persistRaceContextHistory?: boolean;
}) {
  const shouldPersistRaceResults = typeof persistRaceResults === "boolean" ? persistRaceResults : persist;
  const shouldPersistRaceContextHistory = typeof persistRaceContextHistory === "boolean" ? persistRaceContextHistory : persist;
  const raceSessions = await getRaceSessions(year);
  let raceSession = null;
  let calendarRow = null;

  try {
    calendarRow = await findCalendarRowForRound({ supabase, year, round });
    raceSession = raceSessions.find((session) => (
      (calendarRow?.race_session_key && Number(session.session_key) === Number(calendarRow.race_session_key))
      || (calendarRow?.meeting_key && Number(session.meeting_key) === Number(calendarRow.meeting_key))
    )) || null;
  } catch (_error) {
    raceSession = null;
  }

  if (!raceSession && !calendarRow) {
    raceSession = raceSessions[round - 1] || null;
  }

  if (!raceSession) {
    throw new Error(`No OpenF1 race session found for year ${year} round ${round}.`);
  }

  const meetingSessions = sortByDate(
    await fetchOpenF1(`/sessions?meeting_key=${raceSession.meeting_key}`, { optional: true, fallbackValue: [raceSession] })
  );

  const qualifyingSession = meetingSessions.find((session) => {
    const name = String(session.session_name || "").toLowerCase();
    return name.includes("qualifying") && !name.includes("sprint");
  }) || null;

  const sprintSession = meetingSessions.find((session) => String(session.session_name || "").toLowerCase() === "sprint") || null;
  const sprintQualifyingSession = meetingSessions.find((session) => {
    const name = String(session.session_name || "").toLowerCase();
    return name.includes("sprint") && (name.includes("qualifying") || name.includes("shootout"));
  }) || null;

  const [
    raceResults,
    raceDrivers,
    raceControl,
    raceLaps,
    weatherRows,
    stints,
    pitStops,
    overtakes,
    positionRows,
    startingGrid,
    qualifyingResults,
    qualifyingDrivers,
    sprintResults,
    sprintDrivers,
    sprintQualifyingResults,
    sprintQualifyingDrivers,
  ] = await Promise.all([
    fetchOpenF1(`/session_result?session_key=${raceSession.session_key}`),
    fetchOpenF1(`/drivers?session_key=${raceSession.session_key}`),
    fetchOpenF1(`/race_control?session_key=${raceSession.session_key}`, { optional: true, fallbackValue: [] }),
    fetchOpenF1(`/laps?session_key=${raceSession.session_key}&is_pit_out_lap=false`, { optional: true, fallbackValue: [] }),
    fetchOpenF1(`/weather?meeting_key=${raceSession.meeting_key}`, { optional: true, fallbackValue: [] }),
    fetchOpenF1(`/stints?session_key=${raceSession.session_key}`, { optional: true, fallbackValue: [] }),
    fetchOpenF1(`/pit?session_key=${raceSession.session_key}`, { optional: true, fallbackValue: [] }),
    fetchOpenF1(`/overtakes?session_key=${raceSession.session_key}`, { optional: true, fallbackValue: [] }),
    fetchOpenF1(`/position?session_key=${raceSession.session_key}`, { optional: true, fallbackValue: [] }),
    fetchOpenF1(`/starting_grid?session_key=${raceSession.session_key}`, { optional: true, fallbackValue: [] }),
    qualifyingSession ? fetchOpenF1(`/session_result?session_key=${qualifyingSession.session_key}`, { optional: true, fallbackValue: [] }) : [],
    qualifyingSession ? fetchOpenF1(`/drivers?session_key=${qualifyingSession.session_key}`, { optional: true, fallbackValue: [] }) : [],
    sprintSession ? fetchOpenF1(`/session_result?session_key=${sprintSession.session_key}`, { optional: true, fallbackValue: [] }) : [],
    sprintSession ? fetchOpenF1(`/drivers?session_key=${sprintSession.session_key}`, { optional: true, fallbackValue: [] }) : [],
    sprintQualifyingSession ? fetchOpenF1(`/session_result?session_key=${sprintQualifyingSession.session_key}`, { optional: true, fallbackValue: [] }) : [],
    sprintQualifyingSession ? fetchOpenF1(`/drivers?session_key=${sprintQualifyingSession.session_key}`, { optional: true, fallbackValue: [] }) : [],
  ]);

  const driverLookup = buildDriverLookup(
    raceDrivers,
    qualifyingDrivers,
    sprintDrivers,
    sprintQualifyingDrivers,
  );

  const podium = extractPodium(raceResults, driverLookup);
  const fastestLap = extractFastestLap(raceLaps, driverLookup);
  const dnfDrivers = extractDnfDrivers(raceResults, driverLookup);
  const warnings = [];
  const integrity = buildRaceIntegritySummary({
    raceSession,
    raceResults,
    podium,
    dnfDrivers,
  });
  const integrityMessage = `OpenF1 race payload looks incomplete or mismatched `
    + `(classified ${integrity.classifiedCount}/${integrity.totalRows}, `
    + `unique drivers ${integrity.uniqueDriverCount}, dnfs ${integrity.dnfCount}, `
    + `session completed ${integrity.sessionCompleted ? "yes" : "no"}).`;

  if (!integrity.isSafeToPersist) {
    if (shouldPersistRaceResults) {
      throw new Error(`Refusing to save round ${round}: ${integrityMessage}`);
    }

    warnings.push(`Official results skipped for round ${round}: ${integrityMessage}`);
  }

  const raceTeamTotals = sumSessionPoints(raceResults, driverLookup, RACE_POINTS, fastestLap);
  const sprintTeamTotals = sprintResults?.length ? sumSessionPoints(sprintResults, driverLookup, SPRINT_POINTS) : new Map();
  const teamTotals = mergeTeamTotals(raceTeamTotals, sprintTeamTotals);

  const existingResults = shouldPersistRaceResults
    ? await supabase.from("race_results").select("*").eq("race_round", round).maybeSingle()
    : { data: null };

  const existing = existingResults.data || null;
  const bestConstructor = pickBestConstructor(teamTotals) || existing?.best_constructor || null;
  const weatherSummary = buildWeatherSummary(weatherRows);
  const strategySummary = buildStrategySummary(stints, driverLookup);
  const volatilitySummary = buildVolatilitySummary(raceControl, dnfDrivers);
  const driverResults = buildDriverResults(
    driverLookup,
    raceResults,
    qualifyingResults,
    sprintResults,
    sprintQualifyingResults,
    fastestLap,
  );
  const constructorResults = buildConstructorResults(
    driverResults,
    raceTeamTotals,
    sprintTeamTotals,
    bestConstructor,
  );
  const qualifyingOutcome = buildQualifyingOutcome(qualifyingResults, driverLookup);
  const sprintOutcome = buildSprintOutcome(sprintResults, sprintQualifyingResults, driverLookup);
  const raceOutcome = buildRaceOutcome(
    podium,
    dnfDrivers,
    fastestLap,
    bestConstructor,
    raceResults,
    volatilitySummary,
  );

  const row = {
    race_round: round,
    pole: firstByPosition(qualifyingResults || [], driverLookup) || existing?.pole || null,
    winner: podium.winner || existing?.winner || null,
    p2: podium.p2 || existing?.p2 || null,
    p3: podium.p3 || existing?.p3 || null,
    dnf: serializeListValue(dnfDrivers) || extractDnf(raceResults, driverLookup) || existing?.dnf || null,
    fastest_lap: fastestLap || existing?.fastest_lap || null,
    dotd: existing?.dotd || null,
    best_constructor: bestConstructor,
    safety_car: hasSafetyCar(raceControl),
    red_flag: hasRedFlag(raceControl),
    sp_pole: firstByPosition(sprintQualifyingResults || [], driverLookup) || existing?.sp_pole || null,
    sp_winner: extractPodium(sprintResults || [], driverLookup).winner || existing?.sp_winner || null,
    sp_p2: extractPodium(sprintResults || [], driverLookup).p2 || existing?.sp_p2 || null,
    sp_p3: extractPodium(sprintResults || [], driverLookup).p3 || existing?.sp_p3 || null,
    results_entered: true,
    locked_at: existing?.locked_at || new Date().toISOString(),
  };

  const historyRow = {
    season: year,
    race_round: round,
    race_name: raceSession.country_name || raceSession.meeting_name || `Round ${round}`,
    race_date: raceSession.date_start || null,
    meeting_key: Number(raceSession.meeting_key || 0) || null,
    session_key: Number(raceSession.session_key || 0) || null,
    race_outcome: raceOutcome,
    qualifying_outcome: qualifyingOutcome,
    sprint_outcome: sprintOutcome,
    weather_summary: weatherSummary,
    strategy_summary: strategySummary,
    driver_results: driverResults,
    constructor_results: constructorResults,
    volatility_summary: volatilitySummary,
    source_payload: buildHistorySourcePayload({
      raceSession,
      meetingSessions,
      raceResults,
      qualifyingResults,
      sprintResults,
      sprintQualifyingResults,
      driverLookup,
      raceControl,
      raceLaps,
      weatherRows,
      stints,
      pitStops,
      overtakes,
      positionRows,
      startingGrid,
    }),
    last_synced_at: new Date().toISOString(),
  };

  if (!qualifyingSession) warnings.push("Pole Position could not be derived because no qualifying session was found in OpenF1.");
  if (!row.dotd) warnings.push("Driver of the Day is not provided by OpenF1. Leave it manual if you want that category scored.");
  if (!row.best_constructor) warnings.push("Constructor with Most Points could not be derived from the available OpenF1 session data.");

  if (shouldPersistRaceResults) {
    const { error } = await supabase.from("race_results").upsert(row, { onConflict: "race_round" });
    if (error) throw error;
  }

  if (shouldPersistRaceContextHistory) {
    const { error: historyError } = await supabase
      .from("race_context_history")
      .upsert(historyRow, { onConflict: "season,race_round" });

    if (historyError) throw historyError;
  }

  return {
    saved: shouldPersistRaceResults || shouldPersistRaceContextHistory,
    persisted: {
      raceResults: shouldPersistRaceResults,
      raceContextHistory: shouldPersistRaceContextHistory,
    },
    raceRound: round,
    year,
    raceName: raceSession.country_name || raceSession.meeting_name || `Round ${round}`,
    sessionKey: raceSession.session_key || null,
    meetingKey: raceSession.meeting_key || null,
    warnings,
    results: row,
    history: historyRow,
  };
}

export function calculatePoints(picks: Record<string, unknown>, results: Record<string, unknown>) {
  let points = 0;
  const breakdown: Array<{ label: string; pts: number }> = [];

  if (!picks || !results) return { points, breakdown };

  if (picks.pole && picks.pole === results.pole) { points += PTS.pole; breakdown.push({ label: "Pole Position", pts: PTS.pole }); }
  if (picks.winner && picks.winner === results.winner) { points += PTS.winner; breakdown.push({ label: "Race Winner", pts: PTS.winner }); }
  if (picks.p2 && picks.p2 === results.p2) { points += PTS.p2; breakdown.push({ label: "2nd Place", pts: PTS.p2 }); }
  if (picks.p3 && picks.p3 === results.p3) { points += PTS.p3; breakdown.push({ label: "3rd Place", pts: PTS.p3 }); }
  if (picks.winner && picks.p2 && picks.p3 && picks.winner === results.winner && picks.p2 === results.p2 && picks.p3 === results.p3) {
    points += PTS.perfectPodium;
    breakdown.push({ label: "Perfect Podium Bonus", pts: PTS.perfectPodium });
  }
  if (picks.dnf && getDnfDrivers(results).includes(String(picks.dnf))) { points += PTS.dnf; breakdown.push({ label: "DNF Driver", pts: PTS.dnf }); }
  if (picks.fl && picks.fl === results.fastest_lap) { points += PTS.fl; breakdown.push({ label: "Fastest Lap", pts: PTS.fl }); }
  if (picks.dotd && picks.dotd === results.dotd) { points += PTS.dotd; breakdown.push({ label: "Driver of the Day", pts: PTS.dotd }); }
  if (picks.ctor && picks.ctor === results.best_constructor) { points += PTS.ctor; breakdown.push({ label: "Best Constructor", pts: PTS.ctor }); }
  if (picks.sc && picks.sc === "Yes" && results.safety_car) { points += PTS.sc; breakdown.push({ label: "Safety Car", pts: PTS.sc }); }
  if (picks.rf && picks.rf === "Yes" && results.red_flag) { points += PTS.rf; breakdown.push({ label: "Red Flag", pts: PTS.rf }); }
  if (picks.sp_pole && picks.sp_pole === results.sp_pole) { points += PTS.sp_pole; breakdown.push({ label: "Sprint Pole", pts: PTS.sp_pole }); }
  if (picks.sp_winner && picks.sp_winner === results.sp_winner) { points += PTS.sp_winner; breakdown.push({ label: "Sprint Winner", pts: PTS.sp_winner }); }
  if (picks.sp_p2 && picks.sp_p2 === results.sp_p2) { points += PTS.sp_p2; breakdown.push({ label: "Sprint 2nd", pts: PTS.sp_p2 }); }
  if (picks.sp_p3 && picks.sp_p3 === results.sp_p3) { points += PTS.sp_p3; breakdown.push({ label: "Sprint 3rd", pts: PTS.sp_p3 }); }

  return { points, breakdown };
}

export async function scoreRaceRound({ supabase, raceRound }: { supabase: unknown; raceRound: number }) {
  const { data: results, error: resultError } = await supabase
    .from("race_results")
    .select("*")
    .eq("race_round", raceRound)
    .single();

  if (resultError || !results || !results.results_entered) {
    return { status: "missing_results", scored: 0, message: "No saved race results found for this round." };
  }

  const { data: predictions, error: predictionError } = await supabase
    .from("predictions")
    .select("*")
    .eq("race_round", raceRound);

  if (predictionError) throw predictionError;
  if (!predictions?.length) return { status: "no_predictions", scored: 0, message: "No predictions found for this round." };

  const unscored = predictions.filter((prediction) => !prediction.score || prediction.score === 0);
  if (!unscored.length) {
    return { status: "already_scored", scored: 0, message: "This round was already scored." };
  }

  for (const prediction of unscored) {
    const { points, breakdown } = calculatePoints(prediction.picks || {}, results);

    const { error: predictionUpdateError } = await supabase
      .from("predictions")
      .update({ score: points, score_breakdown: breakdown })
      .eq("user_id", prediction.user_id)
      .eq("race_round", raceRound);

    if (predictionUpdateError) throw predictionUpdateError;

    const { data: profile, error: profileReadError } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", prediction.user_id)
      .single();

    if (profileReadError) throw profileReadError;

    const currentPoints = Number(profile?.points || 0);
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ points: currentPoints + points })
      .eq("id", prediction.user_id);

    if (profileUpdateError) throw profileUpdateError;
  }

  return { status: "ok", scored: unscored.length, message: `Scored ${unscored.length} users.` };
}
