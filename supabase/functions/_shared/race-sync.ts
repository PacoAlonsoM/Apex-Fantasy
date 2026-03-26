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
    retries = 4,
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

export async function syncRaceRoundFromOpenF1({
  supabase,
  year,
  round,
  persist = true,
}: {
  supabase: unknown;
  year: number;
  round: number;
  persist?: boolean;
}) {
  const raceSessions = await getRaceSessions(year);
  let raceSession = null;

  try {
    const calendarRow = await findCalendarRowForRound({ supabase, year, round });
    raceSession = raceSessions.find((session) => (
      (calendarRow?.race_session_key && Number(session.session_key) === Number(calendarRow.race_session_key))
      || (calendarRow?.meeting_key && Number(session.meeting_key) === Number(calendarRow.meeting_key))
    )) || null;
  } catch (_error) {
    raceSession = null;
  }

  if (!raceSession) {
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

  const raceTeamTotals = sumSessionPoints(raceResults, driverLookup, RACE_POINTS, fastestLap);
  const sprintTeamTotals = sprintResults?.length ? sumSessionPoints(sprintResults, driverLookup, SPRINT_POINTS) : new Map();
  const teamTotals = mergeTeamTotals(raceTeamTotals, sprintTeamTotals);

  const warnings = [];
  const existingResults = persist
    ? await supabase.from("race_results").select("*").eq("race_round", round).maybeSingle()
    : { data: null };

  const existing = existingResults.data || null;

  const row = {
    race_round: round,
    pole: firstByPosition(qualifyingResults || [], driverLookup) || existing?.pole || null,
    winner: podium.winner || existing?.winner || null,
    p2: podium.p2 || existing?.p2 || null,
    p3: podium.p3 || existing?.p3 || null,
    dnf: extractDnf(raceResults, driverLookup) || existing?.dnf || null,
    fastest_lap: fastestLap || existing?.fastest_lap || null,
    dotd: existing?.dotd || null,
    best_constructor: pickBestConstructor(teamTotals) || existing?.best_constructor || null,
    safety_car: hasSafetyCar(raceControl),
    red_flag: hasRedFlag(raceControl),
    sp_pole: firstByPosition(sprintQualifyingResults || [], driverLookup) || existing?.sp_pole || null,
    sp_winner: extractPodium(sprintResults || [], driverLookup).winner || existing?.sp_winner || null,
    sp_p2: extractPodium(sprintResults || [], driverLookup).p2 || existing?.sp_p2 || null,
    sp_p3: extractPodium(sprintResults || [], driverLookup).p3 || existing?.sp_p3 || null,
    results_entered: true,
    locked_at: existing?.locked_at || new Date().toISOString(),
  };

  if (!qualifyingSession) warnings.push("Pole Position could not be derived because no qualifying session was found in OpenF1.");
  if (!row.dotd) warnings.push("Driver of the Day is not provided by OpenF1. Leave it manual if you want that category scored.");
  if (!row.best_constructor) warnings.push("Constructor with Most Points could not be derived from the available OpenF1 session data.");

  if (persist) {
    const { error } = await supabase.from("race_results").upsert(row, { onConflict: "race_round" });
    if (error) throw error;
  }

  return {
    saved: persist,
    raceRound: round,
    year,
    raceName: raceSession.country_name || raceSession.meeting_name || `Round ${round}`,
    sessionKey: raceSession.session_key || null,
    meetingKey: raceSession.meeting_key || null,
    warnings,
    results: row,
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
  if (picks.dnf && picks.dnf === results.dnf) { points += PTS.dnf; breakdown.push({ label: "DNF Driver", pts: PTS.dnf }); }
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
