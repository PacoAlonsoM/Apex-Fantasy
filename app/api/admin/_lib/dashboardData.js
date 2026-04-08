import "server-only";

import { CAL, nextRace } from "@/src/constants/calendar";
import { chooseInsightForRace } from "@/src/lib/aiInsight";
import { mergeRaceCalendarRows, summarizeCalendarOverrides } from "@/src/lib/raceCalendar";
import { applyRoundControlToRace, normalizeWeekendSession, resolveBoardLock, sortWeekendSessions } from "@/src/lib/raceWeekend";
import { getLatestOperationRun, roundStoreKey } from "./localAdminStore";

function buildSeasonMap(storeSection = {}, season = 2026) {
  return Object.entries(storeSection || {}).reduce((map, [key, value]) => {
    const [itemSeason, round] = String(key).split(":").map(Number);
    if (itemSeason !== Number(season)) return map;
    map[Number(round)] = value;
    return map;
  }, {});
}

function safeDate(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? value : null;
}

function buildPredictionStats(rows = []) {
  return rows.reduce((map, row) => {
    const round = Number(row?.race_round || 0);
    if (!round) return map;
    const current = map.get(round) || { total: 0, scored: 0 };
    current.total += 1;
    if (row?.score_breakdown !== null && row?.score_breakdown !== undefined) {
      current.scored += 1;
    }
    map.set(round, current);
    return map;
  }, new Map());
}

function buildResultsMap(rows = []) {
  return new Map((rows || []).map((row) => [Number(row.race_round || 0), row]));
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildHistoryEntry(row = null) {
  if (!row) return null;

  const raceOutcome = safeObject(row.race_outcome);
  const qualifyingOutcome = safeObject(row.qualifying_outcome);
  const volatilitySummary = safeObject(row.volatility_summary);
  const podium = Array.isArray(raceOutcome.podium)
    ? raceOutcome.podium.filter(Boolean).slice(0, 3)
    : [raceOutcome.winner, raceOutcome.p2, raceOutcome.p3].filter(Boolean);

  return {
    round: Number(row.race_round || 0),
    name: row.race_name || null,
    date: row.race_date || null,
    updatedAt: safeDate(row.updated_at) || safeDate(row.last_synced_at),
    winner: raceOutcome.winner || null,
    pole: qualifyingOutcome.pole || null,
    podium,
    bestConstructor: raceOutcome.best_constructor || null,
    finishersCount: Number(raceOutcome.finishers_count || 0) || 0,
    dnfCount: Number(volatilitySummary.dnf_count ?? raceOutcome.dnf_count ?? 0) || 0,
    safetyCar: Boolean(volatilitySummary.safety_car || Number(raceOutcome.safety_car_count || 0) > 0),
    redFlag: Boolean(volatilitySummary.red_flag || Number(raceOutcome.red_flag_count || 0) > 0),
  };
}

export async function loadAdminCalendarState({ supabase, store, season = 2026 }) {
  const { data, error } = await supabase
    .from("race_calendar")
    .select("*")
    .eq("season", season)
    .order("source_round_number", { ascending: true })
    .order("race_date", { ascending: true });

  if (error) {
    console.warn("Dashboard calendar fallback", error.message);
  }

  const controlsByRound = buildSeasonMap(store.roundControls, season);
  const sessionsByRound = Object.entries(buildSeasonMap(store.scheduleSessions, season)).reduce((map, [round, sessions]) => {
    map[Number(round)] = sortWeekendSessions((sessions || []).map((session) => normalizeWeekendSession(session)));
    return map;
  }, {});
  const calendarSummary = summarizeCalendarOverrides(data || [], CAL);

  const mergedCalendar = (data && data.length ? mergeRaceCalendarRows(data, CAL, { includeCancelled: true }) : CAL)
    .map((race) => applyRoundControlToRace(race, controlsByRound[race.r]));

  return {
    calendar: mergedCalendar,
    controlsByRound,
    sessionsByRound,
    warnings: calendarSummary.warnings,
  };
}

function scheduleStateForRound(race, sessions = [], control = null) {
  const raceLock = resolveBoardLock({ race, control, sessions, isSprintBoard: false });
  const sprintLock = race?.sprint ? resolveBoardLock({ race, control, sessions, isSprintBoard: true }) : null;

  return {
    sessionCount: sessions.length,
    ready: sessions.length > 0,
    raceLockAt: raceLock?.lockAt || null,
    sprintLockAt: sprintLock?.lockAt || null,
    raceLockSource: raceLock?.source || null,
    sprintLockSource: sprintLock?.source || null,
    eventStatus: control?.event_status_override || race?.status || "scheduled",
  };
}

export function buildDashboardPayload({
  calendar,
  controlsByRound,
  sessionsByRound,
  store,
  resultsRows,
  predictionRows,
  historyRows,
  newsRows,
  newsRunRows,
  insightRows,
  aiRunRows,
  season = 2026,
}) {
  const draftsByRound = buildSeasonMap(store.resultsDrafts, season);
  const resultsByRound = buildResultsMap(resultsRows);
  const predictionStats = buildPredictionStats(predictionRows);
  const historyRounds = new Set((historyRows || []).map((row) => Number(row.race_round || 0)).filter(Boolean));
  const historyEntries = (historyRows || [])
    .map((row) => buildHistoryEntry(row))
    .filter((entry) => entry?.round);
  const latestHistoryEntry = historyEntries[0] || null;
  const latestNewsRun = newsRunRows?.[0] || null;
  const latestNewsArticle = newsRows?.[0] || null;
  const latestAiRun = aiRunRows?.[0] || null;
  const currentRace = nextRace(calendar) || calendar[0] || null;
  const currentInsight = chooseInsightForRace(insightRows || [], currentRace);

  const rounds = calendar.map((race) => {
    const round = Number(race.r || 0);
    const draft = draftsByRound[round] || null;
    const official = resultsByRound.get(round) || null;
    const prediction = predictionStats.get(round) || { total: 0, scored: 0 };
    const latestPublishRun = getLatestOperationRun(store, "results-publish", round);
    const latestAwardRun = getLatestOperationRun(store, "award-points", round);
    const schedule = scheduleStateForRound(race, sessionsByRound[round] || [], controlsByRound[round] || null);
    const officialPublished = !!official?.results_entered;
    const scoredAfterPublish = latestAwardRun && latestPublishRun
      ? new Date(latestAwardRun.updatedAt).getTime() >= new Date(latestPublishRun.updatedAt).getTime()
      : latestAwardRun && officialPublished;

    return {
      round,
      name: race.n,
      date: race.date,
      status: race.status || "scheduled",
      sprint: !!race.sprint,
      schedule,
      draftStatus: draft ? draft.status || "draft" : "missing",
      draftUpdatedAt: draft?.updatedAt || null,
      officialPublished,
      officialLockedAt: official?.locked_at || null,
      scoreStatus: !officialPublished
        ? "pending"
        : prediction.total === 0
          ? "no-picks"
          : scoredAfterPublish && prediction.scored === prediction.total
            ? "scored"
            : "stale",
      predictionCount: prediction.total,
      scoredCount: prediction.scored,
      historyReady: historyRounds.has(round),
      latestPublishRun,
      latestAwardRun,
    };
  });

  const currentRound = currentRace
    ? rounds.find((row) => row.round === currentRace.r) || null
    : null;

  return {
    season,
    calendar,
    controlsByRound,
    sessionsByRound,
    currentRound,
    rounds,
    health: {
      schedule: currentRound?.schedule || null,
      nextLockAt: currentRound?.schedule?.raceLockAt || null,
      newsFreshness: latestNewsRun?.finished_at || latestNewsArticle?.published_at || null,
      resultsStatus: currentRound?.officialPublished ? "published" : currentRound?.draftStatus,
      scoringStatus: currentRound?.scoreStatus || "pending",
      aiBriefStatus: currentInsight?.generated_at || latestAiRun?.finished_at || null,
    },
    coverage: {
      completedHistoryRounds: historyRounds.size,
      publishedResults: rounds.filter((row) => row.officialPublished).length,
      savedDrafts: Object.values(draftsByRound).filter(Boolean).length,
      latestHistoryAt: latestHistoryEntry?.updatedAt || null,
      latestNewsAt: latestNewsRun?.finished_at || latestNewsArticle?.published_at || null,
      latestAiAt: currentInsight?.generated_at || latestAiRun?.finished_at || null,
      historyEntries,
      missingHistoryRounds: rounds.filter((row) => !row.historyReady).map((row) => ({ round: row.round, name: row.name })),
    },
    latestRuns: {
      news: latestNewsRun,
      ai: latestAiRun,
      schedule: getLatestOperationRun(store, "schedule-sync"),
      history: getLatestOperationRun(store, "history-backfill") || (latestHistoryEntry
        ? {
            updatedAt: latestHistoryEntry.updatedAt,
            round: latestHistoryEntry.round,
            message: latestHistoryEntry.name
              ? `Latest synced history row: ${latestHistoryEntry.name}.`
              : "Latest synced history row found in Supabase.",
          }
        : null),
    },
    latestInsight: currentInsight || null,
    latestNewsArticle,
  };
}

export function getDraftForRound(store, season, round) {
  return store.resultsDrafts?.[roundStoreKey(season, round)] || null;
}

export function getRoundControls(store, season, round) {
  return store.roundControls?.[roundStoreKey(season, round)] || null;
}

export function getRoundSessions(store, season, round) {
  return store.scheduleSessions?.[roundStoreKey(season, round)] || [];
}
