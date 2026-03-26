import { ACTIVE_CAL, CAL, isRaceCancelled, parseDate } from "./constants/calendar";

const CURATED_OVERRIDE_STATUSES = new Set(["cancelled", "postponed"]);

const COUNTRY_ALIASES = {
  usa: "usa",
  "united states": "usa",
  us: "usa",
  uk: "united kingdom",
  "great britain": "united kingdom",
  "united kingdom": "united kingdom",
  uae: "uae",
  "united arab emirates": "uae",
  brazil: "brazil",
  "sao paulo": "brazil",
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function normalizeCountry(value) {
  const normalized = normalizeText(value);
  return COUNTRY_ALIASES[normalized] || normalized;
}

function toTokenSet(values) {
  return new Set(
    values
      .flatMap((value) => normalizeText(value).split(" "))
      .filter((token) => token.length >= 3)
  );
}

function countSharedTokens(left, right) {
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared;
}

function parseCandidateDate(candidate) {
  const raw = candidate?.race_date
    || candidate?.date
    || candidate?.date_start
    || candidate?.weekend_end
    || candidate?.weekend_start
    || null;

  if (!raw) return Number.NaN;
  const date = new Date(raw);
  return date.getTime();
}

function buildCandidateBlob(candidate) {
  return [
    candidate?.slug,
    candidate?.event_slug,
    candidate?.n,
    candidate?.name,
    candidate?.display_name,
    candidate?.official_name,
    candidate?.meeting_name,
    candidate?.meeting_official_name,
    candidate?.country_name,
    candidate?.country,
    candidate?.cc,
    candidate?.city_name,
    candidate?.city,
    candidate?.location,
    candidate?.circuit_name,
    candidate?.circuit_short_name,
    candidate?.circuit,
    ...(Array.isArray(candidate?.aliases) ? candidate.aliases : []),
  ].filter(Boolean);
}

function scoreRaceMatch(race, candidate) {
  const candidateDate = parseCandidateDate(candidate);
  const raceDate = parseDate(race.date).getTime();
  const diffDays = Number.isFinite(candidateDate)
    ? Math.abs(candidateDate - raceDate) / 86400000
    : null;

  if (diffDays !== null && diffDays > 18) return Number.NEGATIVE_INFINITY;

  let score = 0;

  if (diffDays !== null) {
    score += Math.max(0, 48 - (diffDays * 5));
  }

  const raceCountry = normalizeCountry(race.cc);
  const candidateCountry = normalizeCountry(candidate?.country_name || candidate?.country || candidate?.cc);
  if (raceCountry && candidateCountry && raceCountry === candidateCountry) {
    score += 22;
  }

  const raceCity = normalizeText(race.city);
  const candidateCity = normalizeText(candidate?.city_name || candidate?.city || candidate?.location);
  if (raceCity && candidateCity && (raceCity === candidateCity || candidateCity.includes(raceCity) || raceCity.includes(candidateCity))) {
    score += 18;
  }

  const raceCircuit = normalizeText(race.circuit);
  const candidateCircuit = normalizeText(candidate?.circuit_name || candidate?.circuit_short_name || candidate?.circuit);
  if (raceCircuit && candidateCircuit && (raceCircuit.includes(candidateCircuit) || candidateCircuit.includes(raceCircuit))) {
    score += 14;
  }

  const raceBlob = normalizeText([
    race.slug,
    race.n,
    race.circuit,
    race.city,
    race.cc,
    ...(Array.isArray(race.aliases) ? race.aliases : []),
  ].join(" "));
  const candidateBlob = normalizeText(buildCandidateBlob(candidate).join(" "));

  if (race.slug && candidateBlob.includes(normalizeText(race.slug))) {
    score += 28;
  }

  if (candidateBlob && raceBlob && (candidateBlob.includes(raceBlob) || raceBlob.includes(candidateBlob))) {
    score += 10;
  }

  const raceTokens = toTokenSet([
    race.slug,
    race.n,
    race.city,
    race.cc,
    ...(Array.isArray(race.aliases) ? race.aliases : []),
  ]);
  const candidateTokens = toTokenSet(buildCandidateBlob(candidate));
  score += countSharedTokens(raceTokens, candidateTokens) * 4;

  return score;
}

export function getRaceDisplayRound(race) {
  const roundNumber = Number(
    race?.displayRound
    ?? race?.display_round_number
    ?? race?.sourceRoundNumber
    ?? race?.source_round_number
    ?? race?.r
  );
  return Number.isFinite(roundNumber) && roundNumber > 0 ? roundNumber : null;
}

export function activeCalendar(calendar = CAL) {
  return (Array.isArray(calendar) ? calendar : CAL).filter((race) => !isRaceCancelled(race));
}

export function getRaceEffectiveStatus(row, fallbackRace = null) {
  const overrideStatus = String(row?.override_status || row?.overrideStatus || "").trim().toLowerCase();
  if (overrideStatus) return overrideStatus;

  const fallbackStatus = String(fallbackRace?.status || row?.status || "").trim().toLowerCase();
  if (CURATED_OVERRIDE_STATUSES.has(fallbackStatus)) {
    return fallbackStatus;
  }

  const eventStatus = String(row?.event_status || row?.eventStatus || "").trim().toLowerCase();
  return eventStatus || fallbackStatus || "scheduled";
}

export function matchCalendarRace(calendar, candidate) {
  const races = Array.isArray(calendar) ? calendar : CAL;
  let bestRace = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let secondBestScore = Number.NEGATIVE_INFINITY;

  for (const race of races) {
    const score = scoreRaceMatch(race, candidate);
    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      bestRace = race;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  if (!bestRace) return null;
  if (bestScore < 24) return null;
  if (bestScore - secondBestScore < 3) return null;
  return bestRace;
}

export function mapRaceSessionsByCalendar(calendar, sessions) {
  const sourceCalendar = Array.isArray(calendar) ? calendar : ACTIVE_CAL;
  const remaining = [...sourceCalendar];
  const mapped = {};

  for (const session of [...(sessions || [])].sort((left, right) => new Date(left?.date_start || 0) - new Date(right?.date_start || 0))) {
    const match = matchCalendarRace(remaining, session);
    if (!match) continue;
    mapped[match.r] = session;

    const index = remaining.findIndex((race) => race.r === match.r);
    if (index >= 0) remaining.splice(index, 1);
  }

  return mapped;
}

function mergeRaceRowWithFallback(row, fallbackCalendar = CAL) {
  const fallbackRace = matchCalendarRace(fallbackCalendar, row);
  const status = getRaceEffectiveStatus(row, fallbackRace);
  const displayRound = Number(
    fallbackRace?.displayRound
    ?? row?.display_round_number
    ?? row?.source_round_number
    ?? fallbackRace?.r
    ?? 0
  ) || null;

  return {
    ...(fallbackRace || {}),
    r: fallbackRace?.r ?? Number(row?.internal_round_number || row?.source_round_number || displayRound || 0),
    displayRound,
    slug: fallbackRace?.slug || row?.event_slug || null,
    n: fallbackRace?.n || row?.display_name || row?.official_name || "Grand Prix",
    circuit: fallbackRace?.circuit || row?.circuit_name || "Circuit pending",
    city: fallbackRace?.city || row?.city_name || row?.location || "TBA",
    cc: fallbackRace?.cc || row?.country_name || row?.country || "TBA",
    date: row?.race_date || fallbackRace?.date || null,
    sprint: typeof row?.sprint === "boolean" ? row.sprint : Boolean(fallbackRace?.sprint),
    type: fallbackRace?.type || row?.race_type || "Permanent",
    status,
    meetingKey: row?.meeting_key || null,
    raceSessionKey: row?.race_session_key || null,
    weekendStart: row?.weekend_start || null,
    weekendEnd: row?.weekend_end || null,
    sourceRoundNumber: Number(row?.source_round_number || 0) || null,
    sourceUrl: row?.source_url || null,
    sourceName: row?.source_name || null,
    overrideStatus: row?.override_status || null,
    overrideNote: row?.override_note || null,
  };
}

export function mergeRaceCalendarRows(rows, fallbackCalendar = CAL, options = {}) {
  const { includeCancelled = false } = options;
  const merged = (rows || [])
    .map((row) => mergeRaceRowWithFallback(row, fallbackCalendar))
    .filter((race) => race?.date);

  const deduped = [];
  const seen = new Set();

  for (const race of merged.sort((left, right) => {
    const leftRound = getRaceDisplayRound(left) || 999;
    const rightRound = getRaceDisplayRound(right) || 999;
    if (leftRound !== rightRound) return leftRound - rightRound;
    return parseDate(left.date) - parseDate(right.date);
  })) {
    const key = `${race.r || "x"}:${race.slug || race.n}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(race);
  }

  return includeCancelled ? deduped : activeCalendar(deduped);
}
