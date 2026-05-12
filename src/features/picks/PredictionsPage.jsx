import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { chooseInsightForRace, insightMatchesRace } from "@/src/lib/aiInsight";
import { CONSTRUCTORS, DRV, TEAMS } from "@/src/constants/teams";
import { fmt, fmtFull, nextRace } from "@/src/constants/calendar";
import { PTS } from "@/src/constants/scoring";
import { fetchMeetingSessions, fetchRaceSessions } from "@/src/lib/openf1";
import { getRaceDisplayRound, mapRaceSessionsByCalendar } from "@/src/lib/raceCalendar";
import { resolveBoardLock } from "@/src/lib/raceWeekend";
import {
  ACCENT,
  BG_BASE,
  CARD_RADIUS,
  CONTENT_MAX,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  RADIUS_MD,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  SUCCESS,
  TEXT_PRIMARY,
  WARN_BG,
  WARN_BORDER,
  WARN_TEXT,
  INFO,
  SUCCESS_BG,
  SUCCESS_BORDER,
  SUCCESS_TEXT,
  ERROR_TEXT,
} from "@/src/constants/design";
import { requireActiveSession } from "@/src/shell/authProfile";
import { formatDnfDrivers, matchesDnfPick } from "@/src/lib/resultHelpers";
import useRaceCalendar from "@/src/lib/useRaceCalendar";
import useViewport from "@/src/lib/useViewport";
import { withViewTransition } from "@/src/lib/viewTransition";
import { hexToRgba } from "@/src/lib/colors";
import { previewText } from "@/src/lib/format";
import PageMasthead from "@/src/ui/PageMasthead";

function formatLocalDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function driverByName(name) {
  return DRV.find((driver) => driver.n === name) || null;
}

const CONSTRUCTOR_PICK_ORDER = [
  "McLaren",
  "Mercedes",
  "Red Bull Racing",
  "Ferrari",
  "Williams",
  "Racing Bulls",
  "Aston Martin",
  "Haas",
  "Audi",
  "Alpine",
  "Cadillac",
];

const constructorRank = new Map(CONSTRUCTOR_PICK_ORDER.map((teamName, index) => [teamName, index]));
const driverRank = new Map(
  DRV.map((driver, index) => [driver.n, {
    teamRank: constructorRank.get(driver.t) ?? 999,
    index,
  }])
);
const SECTION_COPY = {
  "Sprint board": "Sprint qualifying and race picks, scored separately from the main race.",
  "Front of the order": "Pole, race winner, P2, and P3 — the headline calls of the round.",
  "Volatility": "DNF driver, fastest lap, and Driver of the Day — the edge picks.",
  "Team and race state": "Top constructor, safety car, and red flag. Read the weekend shape.",
  "League Bonus Picks": "Extra categories active in this league only.",
};

function promptGroups(isSprintTab) {
  if (isSprintTab) {
    return [
      {
        title: "Sprint board",
        prompts: [
          { key: "sp_pole", label: "Sprint Pole", type: "driver", pts: PTS.sp_pole, hint: "Fastest driver in sprint qualifying." },
          { key: "sp_winner", label: "Sprint Winner", type: "driver", pts: PTS.sp_winner, hint: "Who takes the sprint win." },
          { key: "sp_p2", label: "Sprint 2nd", type: "driver", pts: PTS.sp_p2, hint: "Second place in the sprint." },
          { key: "sp_p3", label: "Sprint 3rd", type: "driver", pts: PTS.sp_p3, hint: "Third place in the sprint." },
        ],
      },
    ];
  }

  return [
    {
      title: "Front of the order",
      prompts: [
        { key: "pole", label: "Pole Position", type: "driver", pts: PTS.pole, hint: "Who is quickest over one lap." },
        { key: "winner", label: "Race Winner", type: "driver", pts: PTS.winner, hint: "Pick the Sunday winner." },
        { key: "p2", label: "2nd Place", type: "driver", pts: PTS.p2, hint: "Who crosses the line in second." },
        { key: "p3", label: "3rd Place", type: "driver", pts: PTS.p3, hint: "Who completes the podium." },
      ],
    },
    {
      title: "Volatility",
      prompts: [
        { key: "dnf", label: "DNF Driver", type: "driver", pts: PTS.dnf, hint: "Pick a driver you expect to retire from the race." },
        { key: "fl", label: "Fastest Lap", type: "driver", pts: PTS.fl, hint: "Pick who sets the fastest single lap during the race." },
        { key: "dotd", label: "Driver of the Day", type: "driver", pts: PTS.dotd, hint: "Fan-voted after the race. Pick the driver who puts on the best show." },
      ],
    },
    {
      title: "Team and race state",
      prompts: [
        { key: "ctor", label: "Constructor with Most Points", type: "constructor", pts: PTS.ctor, hint: "Pick which team scores the most championship points this weekend." },
        { key: "sc", label: "Safety Car?", type: "binary", pts: PTS.sc, hint: "Will there be a safety car period during the race?" },
        { key: "rf", label: "Red Flag?", type: "binary", pts: PTS.rf, hint: "Will the race be stopped by a red flag? Usually caused by a serious crash or weather." },
      ],
    },
  ];
}

function flattenPromptGroups(groups) {
  return groups.flatMap((group) => group.prompts.map((prompt) => ({
    ...prompt,
    section: group.title,
  })));
}

function sectionCopy(title) {
  return SECTION_COPY[title] || "Move through each category and lock your best read.";
}

function selectionMeta(prompt, value) {
  if (!value) return null;

  if (prompt.type === "driver") {
    const driver = driverByName(value);
    const team = driver ? TEAMS[driver.t] : null;
    return {
      label: value,
      accent: team?.c || ACCENT,
      secondary: driver?.t || null,
    };
  }

  if (prompt.type === "constructor") {
    const team = TEAMS[value];
    return {
      label: value,
      accent: team?.c || SUCCESS,
      secondary: value,
    };
  }

  return {
    label: value,
    accent: value === "Yes" ? SUCCESS : "#EF4444",
    secondary: value === "Yes" ? "Interruption expected" : "Clean running expected",
  };
}

function emptySelectionLabel(prompt, aiByKey) {
  if (!prompt) return "";
  const ai = aiByKey?.[prompt.key];
  if (ai?.pick) return `AI suggests: ${ai.pick}`;
  if (prompt.type === "binary") return "Not answered";
  if (prompt.type === "constructor") return "Pick a constructor";
  return "Pick a driver";
}

function hasSavedPickContent(picks) {
  return !!picks && Object.values(picks).some(Boolean);
}

const BASE_PROMPT_KEYS = ["pole", "winner", "p2", "p3", "dnf", "fl", "dotd", "ctor", "sc", "rf"];
const SPRINT_PROMPT_KEYS = ["sp_pole", "sp_winner", "sp_p2", "sp_p3"];

const EXTRA_PROMPT_DEFS = {
  p4:            { key: "p4",            label: "4th Place",           type: "driver",      pts: 10, hint: "Who finishes fourth?" },
  p10:           { key: "p10",           label: "10th Place",          type: "driver",      pts: 12, hint: "Who scores the last championship point?" },
  vsc:           { key: "vsc",           label: "Virtual Safety Car?", type: "binary",      pts: 6,  hint: "VSC slows the field without a physical car on track. More common than a full safety car." },
  lap1_incident: { key: "lap1_incident", label: "Lap 1 Incident?",     type: "binary",      pts: 8,  hint: "Contact or incident on the opening lap?" },
  rain_race:     { key: "rain_race",     label: "Rain During Race?",   type: "binary",      pts: 8,  hint: "Wet conditions at any point during the race?" },
  fastest_ctor:  { key: "fastest_ctor",  label: "Fastest Pit Stop",    type: "constructor", pts: 7,  hint: "Which team posts the fastest pit stop time?" },
};

const LEAGUE_STORAGE_KEY = "__league_submissions";
const PRIMARY_LEAGUE_KEY = "__primary_league_id";
const SOLO_LEAGUE_ID = "__solo_board";
const PRO_GAME_MODES = new Set(["survival", "draft", "double_down", "head_to_head", "budget_picks"]);
const LEAGUE_MODE_LABELS = {
  standard: "Traditional",
  survival: "Survival",
  draft: "Draft",
  double_down: "Double Down",
  head_to_head: "Head-to-Head",
  budget_picks: "Budget Picks",
};
const GAME_MODE_HELP = {
  standard: "Score points for each correct call. Classic prediction format.",
  survival: "Score above the league cutoff each round or you're eliminated.",
  draft: "Each pick can only be claimed by one player — no duplicate calls in this league.",
  double_down: "Choose one category to score 3× if you nail it. Miss it and that slot scores −1.",
  head_to_head: "Face one opponent per round. Most points wins the matchup.",
  budget_picks: "Spread exactly 50 credits across your picks. Back your strongest calls with more.",
};
const KNOWN_PICK_KEYS = [...new Set([...BASE_PROMPT_KEYS, ...SPRINT_PROMPT_KEYS, ...Object.keys(EXTRA_PROMPT_DEFS)])];

function sanitizeFlatPicks(rawPicks) {
  if (!rawPicks || typeof rawPicks !== "object" || Array.isArray(rawPicks)) return {};

  return KNOWN_PICK_KEYS.reduce((safe, key) => {
    const value = rawPicks[key];
    if (value !== undefined && value !== null && value !== "") {
      safe[key] = value;
    }
    return safe;
  }, {});
}

function sanitizeBetAmounts(rawBetAmounts) {
  if (!rawBetAmounts || typeof rawBetAmounts !== "object" || Array.isArray(rawBetAmounts)) return {};

  return Object.entries(rawBetAmounts).reduce((safe, [key, value]) => {
    const amount = Number(value);
    if (KNOWN_PICK_KEYS.includes(key) && Number.isFinite(amount) && amount >= 0) {
      safe[key] = amount;
    }
    return safe;
  }, {});
}

function getLeagueExtraCategories(league) {
  const extras = league?.settings?.extra_categories;
  if (!Array.isArray(extras)) return [];
  return extras.filter((key) => !!EXTRA_PROMPT_DEFS[key]);
}

function getLeagueModeLabel(mode) {
  return LEAGUE_MODE_LABELS[mode] || "Custom";
}

function isLeaguePro(league) {
  return !!(league?.isPro || league?.type === "pro_community" || PRO_GAME_MODES.has(league?.gameMode));
}

function createSoloLeague(user) {
  return {
    id: SOLO_LEAGUE_ID,
    name: user ? "Personal board" : "STINT board",
    gameMode: "standard",
    type: "standard",
    isPro: user?.subscription_status === "pro",
    settings: {},
  };
}

function createPublicProLeague() {
  return {
    id: "__public_pro_league",
    name: "Pro League",
    gameMode: "standard",
    type: "pro_community",
    settings: {},
    isPro: true,
    isPreview: true,
  };
}

function normalizeLeagueContext(league) {
  if (!league) return null;
  return {
    id: league.id,
    name: league.name,
    gameMode: league.game_mode || league.gameMode || "standard",
    type: league.type || "standard",
    settings: league.settings || {},
    isPro: league.type === "pro_community" || PRO_GAME_MODES.has(league.game_mode || league.gameMode),
    isPreview: league.isPreview || false,
  };
}

function pickPrimaryLeagueId(leagues, storedLeagueId = null) {
  if (storedLeagueId && leagues.some((league) => league.id === storedLeagueId)) {
    return storedLeagueId;
  }

  return leagues.find((league) => league.gameMode === "standard" && !isLeaguePro(league))?.id
    || leagues.find((league) => league.gameMode === "standard")?.id
    || leagues[0]?.id
    || SOLO_LEAGUE_ID;
}

function emptyLeagueSubmission(league, seedPicks = {}) {
  return {
    picks: sanitizeFlatPicks(seedPicks),
    betAmounts: {},
    doubleDownKey: null,
    updatedAt: null,
    gameMode: league?.gameMode || "standard",
    isPro: isLeaguePro(league),
  };
}

function normalizeLeagueSubmission(storedSubmission, league, fallbackPicks = {}) {
  if (!storedSubmission) {
    return emptyLeagueSubmission(league, fallbackPicks);
  }

  return {
    ...emptyLeagueSubmission(league),
    picks: sanitizeFlatPicks(storedSubmission.picks || fallbackPicks),
    betAmounts: sanitizeBetAmounts(storedSubmission.betAmounts),
    doubleDownKey: typeof storedSubmission.doubleDownKey === "string" ? storedSubmission.doubleDownKey : null,
    updatedAt: storedSubmission.updatedAt || null,
    gameMode: storedSubmission.gameMode || league?.gameMode || "standard",
    isPro: storedSubmission.isPro ?? isLeaguePro(league),
  };
}

function parsePredictionRow(row) {
  if (!row) return null;

  const rawPicks = row?.picks && typeof row.picks === "object" && !Array.isArray(row.picks)
    ? row.picks
    : {};
  const storedLeagueSubmissions = rawPicks[LEAGUE_STORAGE_KEY];

  return {
    ...row,
    picks: sanitizeFlatPicks(rawPicks),
    primaryLeagueId: typeof rawPicks[PRIMARY_LEAGUE_KEY] === "string" ? rawPicks[PRIMARY_LEAGUE_KEY] : null,
    leagueSubmissions: storedLeagueSubmissions && typeof storedLeagueSubmissions === "object" && !Array.isArray(storedLeagueSubmissions)
      ? storedLeagueSubmissions
      : {},
  };
}

function buildRoundLeagueSubmissions(prediction, leagues) {
  const primaryLeagueId = pickPrimaryLeagueId(leagues, prediction?.primaryLeagueId);

  return leagues.reduce((mapped, league) => {
    const storedSubmission = prediction?.leagueSubmissions?.[league.id];
    const fallbackPicks = !storedSubmission && league.id === primaryLeagueId
      ? prediction?.picks || {}
      : {};

    mapped[league.id] = normalizeLeagueSubmission(storedSubmission, league, fallbackPicks);
    return mapped;
  }, {});
}

function mergeRoundLeagueSubmissions(baseSubmissions, overrideSubmissions, leagues) {
  return leagues.reduce((merged, league) => {
    const baseSubmission = baseSubmissions?.[league.id] || emptyLeagueSubmission(league);
    const overrideSubmission = overrideSubmissions?.[league.id];

    if (!overrideSubmission) {
      merged[league.id] = baseSubmission;
      return merged;
    }

    merged[league.id] = normalizeLeagueSubmission(
      {
        ...baseSubmission,
        ...overrideSubmission,
        picks: {
          ...baseSubmission.picks,
          ...sanitizeFlatPicks(overrideSubmission.picks || {}),
        },
        betAmounts: {
          ...baseSubmission.betAmounts,
          ...sanitizeBetAmounts(overrideSubmission.betAmounts || {}),
        },
      },
      league
    );
    return merged;
  }, {});
}

function pickKeysForLeague(race, league, board = "all") {
  const baseKeys = roundPromptKeys(race, board);
  if (board === "sprint") return baseKeys;
  return [...baseKeys, ...getLeagueExtraCategories(league)];
}

function validateLeagueSubmission(race, league, submission) {
  const activeKeys = pickKeysForLeague(race, league, "all").filter((key) => !!submission?.picks?.[key]);

  if (league?.gameMode === "double_down") {
    if (!activeKeys.length) return { valid: true, detail: "Save at least one pick, then choose your Double Down." };
    if (!submission?.doubleDownKey || !activeKeys.includes(submission.doubleDownKey)) {
      return { valid: false, detail: "Choose one saved pick to use as your Double Down." };
    }
    return { valid: true, detail: `Double Down armed on ${submission.doubleDownKey.replace("sp_", "Sprint ").replace("_", " ")}` };
  }

  if (league?.gameMode === "budget_picks") {
    if (!activeKeys.length) return { valid: true, detail: "Assign 50 credits once you start building this board.", total: 0 };

    const total = activeKeys.reduce((sum, key) => sum + Number(submission?.betAmounts?.[key] || 0), 0);
    const invalidAmounts = activeKeys.some((key) => {
      const amount = Number(submission?.betAmounts?.[key] || 0);
      return amount < 1 || amount > 20;
    });

    if (invalidAmounts) {
      return { valid: false, detail: "Each picked category needs between 1 and 20 credits.", total };
    }

    if (total !== 50) {
      return { valid: false, detail: `Budget must total 50 credits. Current total: ${total}.`, total };
    }

    return { valid: true, detail: "50 / 50 credits assigned.", total };
  }

  return { valid: true, detail: league?.gameMode === "standard" ? "Classic round board." : null };
}

function leagueSubmissionProgress(race, league, submission) {
  const picks = submission?.picks || {};
  const raceBoard = boardProgress(pickKeysForLeague(race, league, "race"), picks);
  const sprintBoard = boardProgress(pickKeysForLeague(race, league, "sprint"), picks);
  const allBoard = boardProgress(pickKeysForLeague(race, league, "all"), picks);

  return {
    ...allBoard,
    race: raceBoard,
    sprint: sprintBoard,
    validation: validateLeagueSubmission(race, league, submission),
  };
}

function summarizeRoundLeagues(race, leagues, submissions, viewerIsPro = false) {
  const entries = leagues.map((league) => {
    const submission = submissions?.[league.id] || emptyLeagueSubmission(league);
    const progress = leagueSubmissionProgress(race, league, submission);
    const blocked = league.type === "pro_community" && !viewerIsPro;
    return {
      league,
      submission,
      progress,
      blocked,
      ready: !blocked && progress.isComplete && progress.validation.valid,
    };
  });

  const countableEntries = entries.filter((entry) => !entry.blocked);
  const totalCount = countableEntries.length;
  const completeCount = countableEntries.filter((entry) => entry.ready).length;
  const startedCount = countableEntries.filter((entry) => entry.progress.hasAny).length;

  return {
    entries,
    totalCount,
    completeCount,
    startedCount,
    hasAny: startedCount > 0,
    isComplete: totalCount > 0 && completeCount === totalCount,
    detail: totalCount > 1
      ? `${completeCount}/${totalCount} league boards ready`
      : (countableEntries[0]?.progress?.hasAny ? formatRoundProgressDetail(race, countableEntries[0].progress) : "No picks yet"),
  };
}

function serializeRoundPayload(submissions, leagues, primaryLeagueId) {
  const safePrimaryLeagueId = pickPrimaryLeagueId(leagues, primaryLeagueId);
  const primarySubmission = submissions?.[safePrimaryLeagueId] || emptyLeagueSubmission(leagues[0]);
  const leagueSubmissions = leagues.reduce((mapped, league) => {
    const submission = submissions?.[league.id] || emptyLeagueSubmission(league);
    mapped[league.id] = {
      picks: sanitizeFlatPicks(submission.picks),
      betAmounts: sanitizeBetAmounts(submission.betAmounts),
      doubleDownKey: submission.doubleDownKey || null,
      updatedAt: submission.updatedAt || null,
      gameMode: league.gameMode,
      isPro: isLeaguePro(league),
    };
    return mapped;
  }, {});

  return {
    ...sanitizeFlatPicks(primarySubmission.picks),
    [PRIMARY_LEAGUE_KEY]: safePrimaryLeagueId,
    [LEAGUE_STORAGE_KEY]: leagueSubmissions,
  };
}

function copyCompatibleSubmission(sourceSubmission, sourceLeague, targetLeague, race) {
  const sourceKeys = new Set(pickKeysForLeague(race, sourceLeague, "all"));
  const targetKeys = new Set(pickKeysForLeague(race, targetLeague, "all"));
  const nextPicks = {};

  targetKeys.forEach((key) => {
    if (sourceKeys.has(key) && sourceSubmission?.picks?.[key]) {
      nextPicks[key] = sourceSubmission.picks[key];
    }
  });

  const nextBetAmounts = targetLeague?.gameMode === "budget_picks"
    ? Object.entries(sourceSubmission?.betAmounts || {}).reduce((mapped, [key, value]) => {
      if (targetKeys.has(key) && nextPicks[key]) {
        mapped[key] = Number(value) || 0;
      }
      return mapped;
    }, {})
    : {};

  return {
    picks: nextPicks,
    betAmounts: nextBetAmounts,
    doubleDownKey: targetLeague?.gameMode === "double_down" && nextPicks[sourceSubmission?.doubleDownKey]
      ? sourceSubmission.doubleDownKey
      : null,
  };
}

function roundPromptKeys(race, board = "all") {
  if (board === "race") {
    return [...BASE_PROMPT_KEYS];
  }

  if (board === "sprint") {
    return race?.sprint ? [...SPRINT_PROMPT_KEYS] : [];
  }

  if (race?.sprint) {
    return [...BASE_PROMPT_KEYS, ...SPRINT_PROMPT_KEYS];
  }
  return [...BASE_PROMPT_KEYS];
}

function boardProgress(keys, picks) {
  const filled = keys.filter((key) => !!picks[key]).length;

  return {
    total: keys.length,
    filled,
    hasAny: filled > 0,
    isComplete: keys.length > 0 && filled >= keys.length,
  };
}

function formatRoundProgressDetail(race, progress) {
  if (!race?.sprint) {
    return `${progress.filled}/${progress.total} picks saved`;
  }

  if (progress.race.isComplete && !progress.sprint.hasAny) {
    return `Race board saved (${progress.race.filled}/${progress.race.total}) · Sprint board still open`;
  }

  if (progress.isComplete) {
    return `${progress.race.filled}/${progress.race.total} race picks + ${progress.sprint.filled}/${progress.sprint.total} sprint picks saved`;
  }

  return `${progress.race.filled}/${progress.race.total} race picks · ${progress.sprint.filled}/${progress.sprint.total} sprint picks saved`;
}

function getRaceEndTimestamp(race, liveRace) {
  const liveDate = liveRace?.date_end || liveRace?.date_start;
  if (liveDate) {
    const timestamp = new Date(liveDate).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return new Date(`${race.date}T23:59:59`).getTime();
}

function resultValueForKey(results, key) {
  if (!results) return null;

  switch (key) {
    case "pole":
      return results.pole || null;
    case "winner":
      return results.winner || null;
    case "p2":
      return results.p2 || null;
    case "p3":
      return results.p3 || null;
    case "dnf":
      return formatDnfDrivers(results);
    case "fl":
      return results.fastest_lap || null;
    case "dotd":
      return results.dotd || null;
    case "ctor":
      return results.best_constructor || null;
    case "sc":
      return typeof results.safety_car === "boolean" ? (results.safety_car ? "Yes" : "No") : null;
    case "rf":
      return typeof results.red_flag === "boolean" ? (results.red_flag ? "Yes" : "No") : null;
    case "sp_pole":
      return results.sp_pole || null;
    case "sp_winner":
      return results.sp_winner || null;
    case "sp_p2":
      return results.sp_p2 || null;
    case "sp_p3":
      return results.sp_p3 || null;
    default:
      return null;
  }
}

function reviewRowsForPrompts(prompts, picks, results, breakdown) {
  return prompts.map((prompt) => {
    const pick = picks?.[prompt.key] || null;
    const actual = resultValueForKey(results, prompt.key);
    const hit = prompt.key === "dnf"
      ? matchesDnfPick(pick, results)
      : (!!pick && actual !== null && pick === actual);
    const breakdownItem = Array.isArray(breakdown)
      ? breakdown.find((item) => item.label === prompt.label)
      : null;

    return {
      key: prompt.key,
      label: prompt.label,
      pick,
      actual,
      hit,
      points: hit ? Number(breakdownItem?.pts || prompt.pts || 0) : 0,
    };
  });
}

function predictionMatches(prompt, item, value) {
  if (!prompt || !item) return false;
  return item.pick === value;
}

function roundSidebarStatus(item, liveRace, resultRow, now, prediction) {
  const raceEnded = getRaceEndTimestamp(item, liveRace) <= now;
  const progress = prediction || { totalCount: 0, completeCount: 0, startedCount: 0, hasAny: false, isComplete: false };

  if (resultRow?.results_entered) {
    return {
      kind: "scored",
      accent: SUCCESS,
      surface: "rgba(34,197,94,0.10)",
      outline: "rgba(34,197,94,0.20)",
      text: "var(--text-success)",
      badge: "Scored",
    };
  }

  if (raceEnded) {
    return {
      kind: "passed",
      accent: "#22C55E",
      surface: "rgba(34,197,94,0.08)",
      outline: "rgba(34,197,94,0.16)",
      text: "var(--text-success)",
      badge: "Passed",
    };
  }

  if (progress.isComplete) {
    return {
      kind: "locked",
      accent: "#38BDF8",
      surface: "rgba(56,189,248,0.08)",
      outline: "rgba(56,189,248,0.16)",
      text: "var(--text-ai)",
      badge: progress.totalCount > 1 ? `${progress.completeCount}/${progress.totalCount}` : "Locked In",
    };
  }

  if (progress.hasAny) {
    return {
      kind: "draft",
      accent: "#F59E0B",
      surface: "rgba(245,158,11,0.08)",
      outline: "rgba(245,158,11,0.16)",
      text: "var(--text-pro)",
      badge: progress.totalCount > 1 ? `${progress.completeCount}/${progress.totalCount}` : "In progress",
    };
  }

  return {
    kind: "open",
    accent: "#64748B",
    surface: PANEL_BG,
    outline: "var(--btn-secondary-bg)",
    text: SUBTLE_TEXT,
    badge: "Open",
  };
}

function leagueCardTone({ ready, progress, locked, scored, blocked }) {
  if (blocked) {
    return {
      label: "Pro only",
      accent: ACCENT,
      detail: "Everyone can view this league. Only Pro members can make picks.",
      background: "linear-gradient(135deg, rgba(249,115,22,0.1), rgba(15,23,42,0.96) 72%)",
      border: "rgba(249,115,22,0.22)",
    };
  }

  if (scored) {
    return {
      label: "Scored",
      accent: SUCCESS,
      detail: "Results are in for this league board.",
      background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(15,23,42,0.96) 72%)",
      border: "rgba(34,197,94,0.22)",
    };
  }

  if (locked) {
    return {
      label: progress.hasAny ? "Locked" : "Closed",
      accent: "#60A5FA",
      detail: progress.hasAny ? "No more edits for this round." : "Round is already closed.",
      background: "linear-gradient(135deg, rgba(96,165,250,0.1), rgba(15,23,42,0.96) 72%)",
      border: "rgba(96,165,250,0.22)",
    };
  }

  if (ready) {
    return {
      label: "Ready",
      accent: "#38BDF8",
      detail: progress.validation?.detail || "Everything required for this league is saved.",
      background: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(15,23,42,0.96) 72%)",
      border: "rgba(56,189,248,0.22)",
    };
  }

  if (progress.hasAny) {
    return {
      label: progress.validation?.valid ? "In progress" : "Needs attention",
      accent: progress.validation?.valid ? "#F59E0B" : "#F97316",
      detail: progress.validation?.detail || "Draft started for this league.",
      background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(15,23,42,0.96) 72%)",
      border: "rgba(245,158,11,0.22)",
    };
  }

  return {
    label: "Not started",
    accent: SUBTLE_TEXT,
    detail: "Open this board to start making picks.",
    background: PANEL_BG,
    border: "rgba(148,163,184,0.14)",
  };
}

function RoundSidebarItem({ item, active, onClick, status }) {
  const closed = status.kind === "passed" || status.kind === "scored";
  const hasStoredBoard = status.kind === "locked" || status.kind === "draft";
  const inactiveBackground = status.kind === "open"
    ? PANEL_BG
    : `linear-gradient(135deg, ${hexToRgba(status.accent, 0.09)}, rgba(9,14,28,0.96) 62%)`;
  const inactiveRing = status.kind === "open" ? HAIRLINE : status.outline;

  return (
    <button
      onClick={onClick}
      className="stint-pressable"
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "44px minmax(0,1fr)",
        gap: 12,
        alignItems: "center",
        border: "none",
        borderRadius: CARD_RADIUS,
        background: active ? hexToRgba(status.accent, 0.18) : inactiveBackground,
        padding: "12px 14px",
        textAlign: "left",
        cursor: "pointer",
        border: active
          ? `1px solid ${hexToRgba(status.accent, 0.44)}`
          : `1px solid ${inactiveRing}`,
        transition: "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
        boxShadow: active
          ? `0 0 0 1px ${hexToRgba(status.accent, 0.14)}, 0 16px 36px ${hexToRgba(status.accent, 0.1)}`
          : "none",
        opacity: closed && !active ? 0.94 : 1,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: active ? hexToRgba(status.accent, 0.14) : BG_BASE,
          border: `2px solid ${active ? status.accent : "rgba(255,255,255,0.08)"}`,
          boxShadow: active ? `0 0 16px ${hexToRgba(status.accent, 0.22)}` : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 800,
          color: TEXT_PRIMARY,
        }}
      >
        {getRaceDisplayRound(item) || item.r}
        {hasStoredBoard && (
          <span
            title={status.kind === "locked" ? "Full board saved" : "Draft board started"}
            style={{
              position: "absolute",
              bottom: 1,
              right: 1,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: status.accent,
              boxShadow: `0 0 10px ${hexToRgba(status.accent, 0.4)}`,
              border: `2px solid ${BG_BASE}`,
            }}
          />
        )}
        {closed && (
          <span
            title={status.kind === "scored" ? "Scored round" : "Passed round"}
            style={{
              position: "absolute",
              bottom: -2,
              left: -2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: status.kind === "scored" ? hexToRgba(SUCCESS, 0.2) : hexToRgba(status.accent, 0.18),
              border: `1px solid ${hexToRgba(status.accent, 0.35)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 12px ${hexToRgba(status.accent, 0.22)}`,
            }}
          >
            <svg width="8" height="9" viewBox="0 0 8 9" fill="none" aria-hidden="true">
              <path
                d="M2.2 3.5V2.6C2.2 1.61 2.97 0.8 4 0.8C5.03 0.8 5.8 1.61 5.8 2.6V3.5M1.7 3.5H6.3C6.69 3.5 7 3.81 7 4.2V7.5C7 7.89 6.69 8.2 6.3 8.2H1.7C1.31 8.2 1 7.89 1 7.5V4.2C1 3.81 1.31 3.5 1.7 3.5Z"
                stroke={status.accent}
                strokeWidth="1.15"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: active ? 700 : 600,
            color: closed && !active ? MUTED_TEXT : TEXT_PRIMARY,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 4,
          }}
        >
          {item.n}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: status.accent,
              boxShadow: `0 0 10px ${hexToRgba(status.accent, 0.3)}`,
            }}
          />
          <span style={{ fontSize: 12, color: status.text }}>{fmt(item.date)}</span>
          {status.badge && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: status.accent,
              }}
            >
              {status.badge}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function LeagueBoardCard({ league, tone, progress, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="stint-pressable"
      style={{
        width: "100%",
        border: `1px solid ${active ? hexToRgba(tone.accent, 0.42) : tone.border}`,
        borderRadius: CARD_RADIUS,
        background: active ? hexToRgba(tone.accent, 0.14) : tone.background,
        padding: "16px 16px 15px",
        textAlign: "left",
        cursor: "pointer",
        boxShadow: active ? `0 20px 36px ${hexToRgba(tone.accent, 0.14)}` : "none",
        transition: "border-color 140ms ease, background 140ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: tone.accent, marginBottom: 6 }}>
            {getLeagueModeLabel(league.gameMode)}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, color: TEXT_PRIMARY }}>
            {league.name}
          </div>
        </div>
        <span
          style={{
            borderRadius: 999,
            border: `1px solid ${hexToRgba(tone.accent, 0.32)}`,
            padding: "5px 10px",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: tone.accent,
            whiteSpace: "nowrap",
          }}
        >
          {tone.label}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 700, background: BG_BASE, color: TEXT_PRIMARY }}>
          {isLeaguePro(league) ? "Pro" : "Standard"}
        </span>
        <span style={{ borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 700, background: BG_BASE, color: MUTED_TEXT }}>
          {progress.filled}/{progress.total} picks
        </span>
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: MUTED_TEXT, minHeight: 38 }}>
        {tone.detail}
      </div>
      {children}
    </button>
  );
}

function CategoryDots({ prompts, picks, activeKey, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
      {prompts.map((prompt) => {
        const isActive = prompt.key === activeKey;
        const isPicked = !!picks[prompt.key];
        const meta = selectionMeta(prompt, picks[prompt.key]);
        const accent = isPicked
          ? (meta?.accent || SUCCESS)
          : isActive ? ACCENT : "rgba(148,163,184,0.18)";
        return (
          <button
            key={prompt.key}
            onClick={() => onSelect(prompt.key)}
            title={`${prompt.label}${isPicked ? `: ${meta?.label}` : ""}`}
            style={{
              height: 8,
              width: isActive ? 28 : 8,
              borderRadius: 999,
              background: accent,
              border: "none",
              padding: 0,
              cursor: "pointer",
              flexShrink: 0,
              transition: "width 260ms cubic-bezier(0.22,1,0.36,1), background 200ms ease",
              boxShadow: isActive
                ? `0 0 10px ${hexToRgba(ACCENT, 0.45)}`
                : isPicked ? `0 0 6px ${hexToRgba(accent, 0.3)}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function PicksSummaryStrip({ prompts, picks, activeKey, onSelect }) {
  const filledPrompts = prompts.filter((p) => picks[p.key]);
  if (!filledPrompts.length) return null;
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 4px", scrollbarWidth: "none" }}>
      {filledPrompts.map((prompt) => {
        const meta = selectionMeta(prompt, picks[prompt.key]);
        const isActive = prompt.key === activeKey;
        const accent = meta?.accent || SUCCESS;
        return (
          <button
            key={prompt.key}
            onClick={() => onSelect(prompt.key)}
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 28,
              padding: "0 10px",
              borderRadius: 999,
              border: `1px solid ${hexToRgba(accent, isActive ? 0.42 : 0.22)}`,
              background: isActive ? hexToRgba(accent, 0.12) : hexToRgba(accent, 0.06),
              cursor: "pointer",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: MUTED_TEXT, whiteSpace: "nowrap" }}>{prompt.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: accent, whiteSpace: "nowrap", maxWidth: 88, overflow: "hidden", textOverflow: "ellipsis" }}>{meta?.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DriverOption({ driver, selected, onClick, aiMatch = false, disabled = false }) {
  const team = TEAMS[driver.t];
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      className="stint-option-press"
      style={{
        width: "100%",
        minHeight: 52,
        border: `1px solid ${selected ? hexToRgba(team.c, 0.52) : hovered ? hexToRgba(team.c, 0.22) : "var(--btn-secondary-bg)"}`,
        borderRadius: RADIUS_MD,
        background: selected
          ? `linear-gradient(135deg,${hexToRgba(team.c, 0.18)},${hexToRgba(team.c, 0.06)})`
          : hovered ? hexToRgba(team.c, 0.07) : BG_BASE,
        boxShadow: selected ? `0 0 0 1px ${hexToRgba(team.c, 0.3)},0 8px 20px ${hexToRgba(team.c, 0.12)}` : "none",
        padding: "9px 12px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.58 : 1,
        transition: "border-color 120ms ease, background 120ms ease, box-shadow 120ms ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.2, marginBottom: 3 }}>{driver.n}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {driver.nb && (
              <span style={{ fontSize: 10, fontWeight: 800, color: selected ? team.c : SUBTLE_TEXT, letterSpacing: "-0.01em", opacity: selected ? 1 : 0.7 }}>
                #{driver.nb}
              </span>
            )}
            <span style={{ fontSize: 10, color: selected ? hexToRgba(team.c, 0.9) : SUBTLE_TEXT, fontWeight: selected ? 600 : 400 }}>{driver.t}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
          {!selected && aiMatch && (
            <span title="AI pick" style={{ width: 6, height: 6, borderRadius: "50%", background: "#60A5FA", boxShadow: "0 0 8px rgba(96,165,250,0.5)", flexShrink: 0 }} />
          )}
          {selected && (
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: team.c,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: aiMatch
                ? `0 0 12px ${hexToRgba(team.c, 0.4)}, 0 0 0 2px rgba(96,165,250,0.28)`
                : `0 0 12px ${hexToRgba(team.c, 0.4)}`,
            }}>
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function ConstructorOption({ teamName, selected, onClick, aiMatch = false, disabled = false }) {
  const team = TEAMS[teamName];
  const teammates = DRV.filter((driver) => driver.t === teamName).map((driver) => driver.s).join(" · ");
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      className="stint-option-press"
      style={{
        width: "100%",
        minHeight: 64,
        border: `1px solid ${selected ? hexToRgba(team.c, 0.52) : hovered ? hexToRgba(team.c, 0.22) : "var(--btn-secondary-bg)"}`,
        borderRadius: RADIUS_MD,
        background: selected
          ? `linear-gradient(135deg,${hexToRgba(team.c, 0.18)},${hexToRgba(team.c, 0.06)})`
          : hovered ? hexToRgba(team.c, 0.07) : BG_BASE,
        boxShadow: selected ? `0 0 0 1px ${hexToRgba(team.c, 0.3)},0 8px 20px ${hexToRgba(team.c, 0.12)}` : "none",
        padding: "10px 14px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.58 : 1,
        transition: "border-color 120ms ease, background 120ms ease, box-shadow 120ms ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 2 }}>{teamName}</div>
          <div style={{ fontSize: 10, color: selected ? hexToRgba(team.c, 0.9) : SUBTLE_TEXT, fontWeight: selected ? 700 : 400 }}>{teammates || "Lineup pending"}</div>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {!selected && aiMatch && (
            <span title="AI pick" style={{ width: 6, height: 6, borderRadius: "50%", background: "#60A5FA", boxShadow: "0 0 8px rgba(96,165,250,0.5)", flexShrink: 0 }} />
          )}
          {selected && (
            <div style={{
              width: 18, height: 18, borderRadius: "50%", background: team.c,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: aiMatch
                ? `0 0 12px ${hexToRgba(team.c, 0.4)}, 0 0 0 2px rgba(96,165,250,0.28)`
                : `0 0 12px ${hexToRgba(team.c, 0.4)}`,
            }}>
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function BinaryOption({ label, detail, color, selected, onClick, aiMatch = false, disabled = false }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      className="stint-option-press"
      style={{
        width: "100%",
        minHeight: 84,
        border: `1px solid ${selected ? hexToRgba(color, 0.42) : hovered ? hexToRgba(color, 0.22) : "var(--btn-secondary-bg)"}`,
        borderRadius: RADIUS_MD,
        background: selected
          ? `linear-gradient(160deg,${hexToRgba(color, 0.2)},${hexToRgba(color, 0.05)})`
          : hovered ? hexToRgba(color, 0.06) : BG_BASE,
        boxShadow: selected ? `0 8px 24px ${hexToRgba(color, 0.14)}` : "none",
        padding: "16px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.58 : 1,
        transition: "border-color 120ms ease, background 120ms ease, box-shadow 120ms ease",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: hexToRgba(color, selected ? 0.26 : 0.1),
            border: `1.5px solid ${selected ? color : hexToRgba(color, 0.3)}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: selected && aiMatch ? "0 0 0 2px rgba(96,165,250,0.28)" : "none",
          }}>
            {selected ? (
              <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                <path d="M1 4.5L4.5 8L11 1" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : label === "Yes" ? (
              <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                <path d="M1 4.5L4.5 8L11 1" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8 2L2 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: selected ? TEXT_PRIMARY : MUTED_TEXT }}>{label}</span>
        </div>
        {!selected && aiMatch && (
          <span title="AI pick" style={{ width: 6, height: 6, borderRadius: "50%", background: "#60A5FA", boxShadow: "0 0 8px rgba(96,165,250,0.5)", flexShrink: 0 }} />
        )}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: selected ? MUTED_TEXT : SUBTLE_TEXT }}>{detail}</div>
    </button>
  );
}

function PromptRailButton({ prompt, value, active, aiItem, metaBadge, onClick }) {
  const meta = selectionMeta(prompt, value);
  return (
    <button
      onClick={onClick}
      className="stint-pressable"
      style={{
        width: "100%",
        minHeight: 52,
        padding: "10px 12px",
        borderRadius: RADIUS_MD,
        border: active
          ? "1px solid rgba(249,115,22,0.3)"
          : value
            ? "1px solid rgba(34,197,94,0.2)"
            : "1px solid rgba(255,255,255,0.06)",
        background: active
          ? "rgba(249,115,22,0.1)"
          : value
            ? "rgba(34,197,94,0.06)"
            : BG_BASE,
        textAlign: "left",
        cursor: "pointer",
        display: "grid",
        gap: 4,
        transition: "border-color 120ms ease, background 120ms ease, box-shadow 120ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: active ? ACCENT : SUBTLE_TEXT }}>
          {prompt.label}
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          {aiItem && <span title="AI suggestion" style={{ width: 5, height: 5, borderRadius: "50%", background: "#60A5FA" }} />}
          {metaBadge && <span style={{ fontSize: 10, fontWeight: 800, color: "var(--brand)" }}>{metaBadge}</span>}
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: meta ? (meta.accent || TEXT_PRIMARY) : SUBTLE_TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {meta ? meta.label : "Open"}
      </span>
    </button>
  );
}

function ReviewMetric({ label, value, detail, accent = "#f8fafc" }) {
  return (
    <div
      style={{
        borderRadius: CARD_RADIUS,
        border: "1px solid rgba(148,163,184,0.14)",
        background: PANEL_BG_ALT,
        padding: "16px 16px 15px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8, color: accent, marginBottom: 6 }}>
        {value}
      </div>
      {detail ? <div style={{ fontSize: 12, lineHeight: 1.6, color: MUTED_TEXT }}>{detail}</div> : null}
    </div>
  );
}

function HelpTip({ content }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, { passive: true });
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close);
    };
  }, [open]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setTipPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 292) });
    }
    setOpen((v) => !v);
  };

  return (
    <span style={{ display: "inline-flex", verticalAlign: "middle", flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleClick}
        aria-label="More information"
        style={{
          width: 16, height: 16, borderRadius: "50%",
          border: `1px solid ${open ? "rgba(249,115,22,0.35)" : "rgba(214,223,239,0.16)"}`,
          background: open ? "rgba(249,115,22,0.1)" : "transparent",
          color: open ? ACCENT : SUBTLE_TEXT,
          fontSize: 10, fontWeight: 800,
          cursor: "pointer", display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          lineHeight: 1, padding: 0, flexShrink: 0,
        }}
      >?</button>
      {open && (
        <span
          onClick={(e) => e.stopPropagation()}
          className="stint-helptip"
          style={{
            position: "fixed",
            top: tipPos.top,
            left: tipPos.left,
            zIndex: 1000,
            minWidth: 220,
            maxWidth: 280,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-soft)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}

function computeStateTone({ reviewReady, resultsEntered, raceHasPassed, lockCountdown, roundSummary, lockLabel, availableLeagues, race }) {
  if (reviewReady) {
    return { label: "Scored", accent: SUCCESS, surface: "rgba(34,197,94,0.08)", outline: "rgba(34,197,94,0.16)", detail: "Points awarded" };
  }
  if (resultsEntered || raceHasPassed || lockCountdown?.locked) {
    return { label: "Locked", accent: "#60A5FA", surface: "rgba(59,130,246,0.10)", outline: "rgba(96,165,250,0.16)", detail: lockLabel ? `Closed ${lockLabel}` : "Editing closed" };
  }
  if (roundSummary.isComplete) {
    return { label: "Locked In", accent: "#38BDF8", surface: "rgba(56,189,248,0.08)", outline: "rgba(56,189,248,0.16)", detail: roundSummary.detail };
  }
  if (roundSummary.hasAny) {
    return { label: "In Progress", accent: "#F59E0B", surface: "rgba(245,158,11,0.08)", outline: "rgba(245,158,11,0.16)", detail: roundSummary.detail };
  }
  return { label: "Open", accent: ACCENT, surface: "rgba(249,115,22,0.08)", outline: "rgba(249,115,22,0.16)", detail: `${availableLeagues.length} ${availableLeagues.length === 1 ? "board" : "boards"} open for ${race.n}.` };
}

const AI_CONF_LABEL = { high: "High", medium: "Medium", low: "Low", confident: "High", uncertain: "Low" };
const AI_CONF_COLOR = { high: "#86efac", medium: "#fde68a", low: "#fca5a5", confident: "#86efac", uncertain: "#fca5a5" };
// Deterministic per-pick confidence %. Same key+pick always resolves to same number,
// but different picks within the same tier get distinct values. Ranges are calibrated
// so high never reads as "certain" and low never reads as "just guessing".
const CONF_RANGES = { high: [68, 82], medium: 52, low: [34, 48], confident: [68, 82], uncertain: [34, 48] };
function confPct(key, pick, rawConf) {
  const conf = (typeof rawConf === "string" ? rawConf.toLowerCase() : "medium") || "medium";
  const range = CONF_RANGES[conf];
  if (!range) { return 58; }
  if (typeof range === "number") {
    // medium tier: hash-spread across 52–66
    const str = `${key}${pick}`;
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
    return 52 + (h % 15);
  }
  const [min, max] = range;
  const str = `${key}${pick}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return min + (h % (max - min + 1));
}

function AiIntelligencePanel({ aiPredictions, isPro, isMobile, picks, race, openAuth }) {
  const visiblePicks = isPro ? aiPredictions : aiPredictions.slice(0, 2);
  const hiddenCount = aiPredictions.length - visiblePicks.length;

  return (
    <section
      style={{
        borderRadius: SECTION_RADIUS,
        border: isPro ? "1px solid rgba(255,106,26,0.22)" : "1px solid rgba(148,163,184,0.12)",
        background: isPro
          ? "linear-gradient(160deg,rgba(255,106,26,0.06) 0%,rgba(14,22,38,0.98) 55%)"
          : PANEL_BG,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: isMobile ? "14px 16px 12px" : "16px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${HAIRLINE}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: isPro ? ACCENT : MUTED_TEXT, letterSpacing: "-0.01em" }}>
              AI Pre-Race Intelligence
            </span>
            <span style={{ fontSize: 11, color: SUBTLE_TEXT, marginTop: 2 }}>
              {isPro ? `${aiPredictions.length} category calls for ${race.n}` : "Category calls — Pro feature"}
            </span>
          </div>
        </div>
        {!isPro && (
          <button
            onClick={() => openAuth ? openAuth("register") : null}
            style={{
              background: "linear-gradient(135deg,#FF6A1A,#e05a12)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 12px",
              letterSpacing: "-0.01em",
              flexShrink: 0,
            }}
          >
            Unlock Pro
          </button>
        )}
      </div>

      <div style={{ padding: isMobile ? "12px 14px" : "14px 18px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
            gap: 8,
            position: "relative",
          }}
        >
          {visiblePicks.map((item) => {
            const conf = (typeof item.confidence === "string" ? item.confidence.toLowerCase() : String(item.confidence || "medium").toLowerCase()) || "medium";
            const confColor = AI_CONF_COLOR[conf] || "#fde68a";
            const confLabel = AI_CONF_LABEL[conf] || "Medium";
            const isSet = !!picks[item.key];
            const matchesPick = isSet && (picks[item.key] === item.pick);
            return (
              <div
                key={item.key}
                style={{
                  borderRadius: 10,
                  border: matchesPick
                    ? "1px solid rgba(134,239,172,0.3)"
                    : "1px solid rgba(148,163,184,0.12)",
                  background: matchesPick
                    ? "rgba(134,239,172,0.06)"
                    : PANEL_BG_ALT,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                  {item.key === "p2" ? "P2" : item.key === "p3" ? "P3" : item.key === "fl" ? "Fastest Lap" : item.key === "dotd" ? "DOTD" : item.key === "dnf" ? "DNF" : item.key === "ctor" ? "Constructor" : item.key === "sc" ? "Safety Car" : item.key}
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 5, lineHeight: 1.2 }}>
                  {item.pick}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: confColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: confColor }}>{confPct(item.key, item.pick, item.confidence)}%</span>
                  {matchesPick && <span style={{ fontSize: 10, fontWeight: 700, color: "#86efac", marginLeft: "auto" }}>✓</span>}
                </div>
              </div>
            );
          })}

          {!isPro && hiddenCount > 0 && (
            <div
              style={{
                borderRadius: 10,
                border: "1px solid rgba(255,106,26,0.2)",
                background: "rgba(255,106,26,0.04)",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 4,
                gridColumn: isMobile ? "span 2" : "span 2",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--brand)" }}>+{hiddenCount} more</div>
              <div style={{ fontSize: 11, color: SUBTLE_TEXT, lineHeight: 1.4 }}>All category calls with Pro</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RoundReviewPanel({
  reviewReady,
  isMobile,
  selectedLeague,
  selectedLeagueSubmission,
  savedPickCount,
  displayReviewScore,
  race,
  hits,
  tab,
  misses,
  podiumBonus,
  reviewRows,
  summaryRows,
  raceHasPassed,
}) {
  const scoreColor = reviewReady
    ? displayReviewScore >= 60
      ? "#86efac"
      : displayReviewScore >= 30
        ? "#facc15"
        : "#f87171"
    : "#60A5FA";

  return (
    <section
      className="stint-score-mount"
      style={{
        borderRadius: SECTION_RADIUS,
        background: PANEL_BG,
        boxShadow: SOFT_SHADOW,
        overflow: "hidden",
        border: reviewReady
          ? `1px solid rgba(34,197,94,0.14)`
          : `1px solid rgba(96,165,250,0.14)`,
      }}
    >
      {/* ── Hero header ─────────────────────────────────── */}
      <div
        style={{
          padding: isMobile ? "22px 16px 18px" : "24px 24px 20px",
          borderBottom: `1px solid ${HAIRLINE}`,
          background: reviewReady
            ? "linear-gradient(160deg, rgba(34,197,94,0.09) 0%, rgba(14,25,41,0.99) 60%)"
            : "linear-gradient(160deg, rgba(96,165,250,0.08) 0%, rgba(14,25,41,0.99) 60%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          {reviewReady && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: isMobile ? 48 : 60,
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  lineHeight: 0.95,
                  color: scoreColor,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {displayReviewScore}
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: MUTED_TEXT,
                  letterSpacing: "-0.02em",
                  paddingBottom: 3,
                }}
              >
                pts
              </span>
            </div>
          )}

          <div
            style={{
              fontSize: isMobile ? 16 : 18,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: TEXT_PRIMARY,
              marginBottom: 5,
            }}
          >
            {reviewReady
              ? `${selectedLeague?.name || "League"} · ${race.n}`
              : `${selectedLeague?.name || "League"} locked`}
          </div>

          <div style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.5 }}>
            {reviewReady
              ? `${hits} correct · ${Math.max(misses, 0)} missed${podiumBonus ? ` · Perfect podium +${podiumBonus.pts} pts` : ""}`
              : hasSavedPickContent(selectedLeagueSubmission?.picks)
                ? `${savedPickCount} pick${savedPickCount !== 1 ? "s" : ""} saved${raceHasPassed ? " · Results pending" : ""}`
                : "No saved board"}
          </div>
        </div>
      </div>

      {/* ── Scored body ─────────────────────────────────── */}
      {reviewReady ? (
        <div style={{ padding: isMobile ? "16px" : "20px 24px", display: "grid", gap: 16 }}>
          {/* Metric row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))",
              gap: 10,
            }}
          >
            <ReviewMetric label="Score" value={`${displayReviewScore}`} detail="points" accent="#facc15" />
            <ReviewMetric label="Correct" value={String(hits)} detail={tab === "sprint" ? "Sprint" : "Race"} accent={SUCCESS} />
            <ReviewMetric label="Misses" value={String(Math.max(misses, 0))} accent="#f87171" />
            <ReviewMetric
              label="Podium bonus"
              value={podiumBonus ? `+${podiumBonus.pts}` : "—"}
              detail={podiumBonus ? "Perfect podium" : null}
              accent={podiumBonus ? "#93c5fd" : SUBTLE_TEXT}
            />
          </div>

          {/* Review table */}
          <div style={{ borderRadius: CARD_RADIUS, border: `1px solid ${HAIRLINE}`, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "minmax(0,1fr) 72px"
                  : "minmax(160px,1fr) minmax(140px,1fr) minmax(140px,1fr) 80px",
                background: PANEL_BG_ALT,
                borderBottom: `1px solid ${HAIRLINE}`,
              }}
            >
              {(isMobile ? ["Category", "Pts"] : ["Category", "Your pick", "Result", "Pts"]).map((heading, i) => (
                <div
                  key={heading}
                  style={{
                    padding: "9px 14px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: SUBTLE_TEXT,
                    textAlign: i === (isMobile ? 1 : 3) ? "right" : "left",
                  }}
                >
                  {heading}
                </div>
              ))}
            </div>
            {reviewRows.map((row, i) => (
              <div
                key={row.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "minmax(0,1fr) 72px"
                    : "minmax(160px,1fr) minmax(140px,1fr) minmax(140px,1fr) 80px",
                  alignItems: "center",
                  borderBottom: i < reviewRows.length - 1 ? `1px solid ${HAIRLINE}` : "none",
                  background: row.hit
                    ? "rgba(34,197,94,0.03)"
                    : i % 2 === 0 ? PANEL_BG : PANEL_BG_ALT,
                }}
              >
                <div style={{ padding: "11px 14px" }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: TEXT_PRIMARY,
                      marginBottom: 2,
                    }}
                  >
                    {row.label}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: row.hit ? SUCCESS : SUBTLE_TEXT,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {row.hit ? "Hit" : row.pick ? "Miss" : "—"}
                  </div>
                  {isMobile && (
                    <div style={{ marginTop: 6, display: "grid", gap: 2, fontSize: 11, color: MUTED_TEXT }}>
                      <div>Pick: <span style={{ color: TEXT_PRIMARY }}>{row.pick || "—"}</span></div>
                      <div>Result: <span style={{ color: TEXT_PRIMARY }}>{row.actual || "Pending"}</span></div>
                    </div>
                  )}
                </div>
                {!isMobile && (
                  <div style={{ padding: "11px 14px", fontSize: 12, color: row.pick ? TEXT_PRIMARY : MUTED_TEXT }}>
                    {row.pick || "—"}
                  </div>
                )}
                {!isMobile && (
                  <div style={{ padding: "11px 14px", fontSize: 12, color: row.actual ? TEXT_PRIMARY : MUTED_TEXT }}>
                    {row.actual || "Pending"}
                  </div>
                )}
                <div
                  style={{
                    padding: "11px 14px",
                    textAlign: "right",
                    fontSize: 16,
                    fontWeight: 900,
                    color: row.hit ? "#facc15" : SUBTLE_TEXT,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.hit ? row.points : "0"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Locked (not yet scored) ─── */
        <div style={{ padding: isMobile ? "14px" : "18px 22px", display: "grid", gap: 14 }}>
          {hasSavedPickContent(selectedLeagueSubmission?.picks) ? (
            <div
              style={{
                borderRadius: CARD_RADIUS,
                border: `1px solid ${HAIRLINE}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "minmax(0,1fr) 120px" : "minmax(160px,1fr) minmax(160px,1fr) 120px",
                  background: PANEL_BG_ALT,
                  borderBottom: `1px solid ${HAIRLINE}`,
                }}
              >
                {(isMobile ? ["Category", "Status"] : ["Category", "Your pick", "Status"]).map((heading, i) => (
                  <div
                    key={heading}
                    style={{
                      padding: "9px 14px",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: SUBTLE_TEXT,
                      textAlign: i === (isMobile ? 1 : 2) ? "right" : "left",
                    }}
                  >
                    {heading}
                  </div>
                ))}
              </div>
              {summaryRows.map((row, i) => (
                <div
                  key={row.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "minmax(0,1fr) 120px" : "minmax(160px,1fr) minmax(160px,1fr) 120px",
                    alignItems: "center",
                    borderBottom: i < summaryRows.length - 1 ? `1px solid ${HAIRLINE}` : "none",
                    background: i % 2 === 0 ? PANEL_BG : PANEL_BG_ALT,
                  }}
                >
                  <div style={{ padding: "11px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: isMobile ? 3 : 0 }}>
                      {row.label}
                    </div>
                    {isMobile && (
                      <div style={{ fontSize: 11, color: row.pick ? TEXT_PRIMARY : MUTED_TEXT }}>
                        {row.pick || "No pick"}
                      </div>
                    )}
                  </div>
                  {!isMobile && (
                    <div style={{ padding: "11px 14px", fontSize: 12, color: row.pick ? TEXT_PRIMARY : MUTED_TEXT }}>
                      {row.pick || "—"}
                    </div>
                  )}
                  <div
                    style={{
                      padding: "11px 14px",
                      textAlign: "right",
                      fontSize: 11,
                      fontWeight: 700,
                      color: row.actual ? "#93c5fd" : SUBTLE_TEXT,
                    }}
                  >
                    {row.actual || (raceHasPassed ? "Awaiting scoring" : "Locked")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                borderRadius: CARD_RADIUS,
                border: `1px solid ${HAIRLINE}`,
                background: PANEL_BG_ALT,
                padding: "14px 16px",
                fontSize: 13,
                color: MUTED_TEXT,
                lineHeight: 1.6,
              }}
            >
              No picks were saved for this round.
            </div>
          )}
        </div>
      )}
    </section>
  );
}



function RoundRailItem({ item, active, onClick, status }) {
  return (
    <button
      onClick={onClick}
      className="stint-pressable"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 12px",
        background: active
          ? hexToRgba(status.accent, 0.1)
          : "transparent",
        border: "none",
        outline: active ? `1px solid ${hexToRgba(status.accent, 0.24)}` : "none",
        outlineOffset: -1,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 140ms ease, outline-color 140ms ease",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          flexShrink: 0,
          background: active ? hexToRgba(status.accent, 0.18) : BG_BASE,
          border: `1.5px solid ${active ? status.accent : "rgba(255,255,255,0.12)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 800,
          color: active ? TEXT_PRIMARY : MUTED_TEXT,
          boxShadow: active ? `0 0 10px ${hexToRgba(status.accent, 0.28)}` : "none",
        }}
      >
        {getRaceDisplayRound(item) || item.r}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: active ? 700 : 500,
            color: active ? TEXT_PRIMARY : MUTED_TEXT,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.2,
            marginBottom: 1,
          }}
        >
          {item.n}
        </div>
        <div style={{ fontSize: 11, color: status.text, lineHeight: 1 }}>{fmt(item.date)}</div>
      </div>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: status.accent,
          flexShrink: 0,
          boxShadow: `0 0 6px ${hexToRgba(status.accent, 0.4)}`,
        }}
      />
    </button>
  );
}

function AiCompactPanel({ aiPredictions, isPro, picks, openAuth }) {
  const visiblePicks = isPro ? aiPredictions : aiPredictions.slice(0, 3);
  const hiddenCount = aiPredictions.length - visiblePicks.length;
  const KEY_LABELS = {
    pole: "Pole", winner: "Winner", p2: "P2", p3: "P3",
    dnf: "DNF", fl: "Fastest Lap", dotd: "DOTD",
    ctor: "Constructor", sc: "Safety Car", rf: "Red Flag",
  };

  return (
    <div
      style={{
        borderRadius: CARD_RADIUS,
        background: PANEL_BG,
        border: `1px solid ${HAIRLINE}`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: "7px 12px 5px",
          borderBottom: `1px solid ${HAIRLINE}`,
          background: PANEL_BG_ALT,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: isPro ? ACCENT : SUBTLE_TEXT,
          }}
        >
          AI Calls
        </span>
        {!isPro && (
          <button
            onClick={() => openAuth?.("register")}
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--brand)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Pro
          </button>
        )}
      </div>
      <div style={{ padding: "4px 0" }}>
        {visiblePicks.map((item) => {
          const conf = (typeof item.confidence === "string" ? item.confidence.toLowerCase() : "medium") || "medium";
          const confColor = AI_CONF_COLOR[conf] || "#fde68a";
          const isMatched = picks[item.key] === item.pick;
          return (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px",
                background: isMatched ? "rgba(134,239,172,0.04)" : "transparent",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: SUBTLE_TEXT,
                  flexShrink: 0,
                  width: 58,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {KEY_LABELS[item.key] || item.key}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isMatched ? "#86efac" : TEXT_PRIMARY,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.pick}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: confColor,
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {confPct(item.key, item.pick, item.confidence)}%
              </span>
            </div>
          );
        })}
        {!isPro && hiddenCount > 0 && (
          <div
            style={{
              padding: "5px 12px",
              fontSize: 10,
              color: SUBTLE_TEXT,
            }}
          >
            +{hiddenCount} more with Pro
          </div>
        )}
      </div>
    </div>
  );
}


function RaceCommandStrip({
  race,
  lockCountdown,
  stateTone,
  aiInsight,
  isMobile,
  tab,
  setTab,
  selectedLeague,
  roundSummary,
}) {
  // Audit Rec #07 — lock-state escalation. Final 2h: amber (warn). Final
  // 15m: red (danger). Outside the window the countdown reads in the
  // standard accent and a normal weight.
  const hasLiveCountdown = lockCountdown && !lockCountdown.locked;
  const totalMinutesLeft = hasLiveCountdown
    ? (lockCountdown.d * 24 * 60) + (lockCountdown.h * 60) + (lockCountdown.m || 0)
    : Infinity;
  const isUrgent   = hasLiveCountdown && totalMinutesLeft < 120;
  const isCritical = hasLiveCountdown && totalMinutesLeft < 15;
  const urgentColor   = "#fbbf24";  // amber — final 2h window
  const criticalColor = "#ef4444";  // danger — final 15m window
  const escalationColor = isCritical ? criticalColor : isUrgent ? urgentColor : ACCENT;
  const escalationTextColor = isCritical ? criticalColor : isUrgent ? urgentColor : TEXT_PRIMARY;

  // Eyebrow with brand-color tint (the original used `var(--brand)` directly).
  const eyebrowNode = (
    <span style={{ color: "var(--brand)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", maxWidth: "100%" }}>
      {race.circuit} · {fmtFull(race.date)}
    </span>
  );

  // Right-aligned countdown OR state pill — passes through the lock-state
  // escalation logic from the audit Rec #07.
  const metaNode = hasLiveCountdown ? (
    <div style={{ flexShrink: 0, textAlign: "right" }}>
      <div
        style={{
          fontSize:      10,
          fontWeight:    800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color:         escalationColor,
          marginBottom:  2,
          lineHeight:    1,
        }}
      >
        {isCritical ? "Locks NOW" : "Locks in"}
      </div>
      <div
        style={{
          fontFamily:         "var(--font-mono)",
          fontSize:           isCritical ? (isMobile ? 26 : 34) : (isMobile ? 20 : 26),
          fontWeight:         700,
          letterSpacing:      "-0.03em",
          color:              escalationTextColor,
          fontVariantNumeric: "tabular-nums",
          lineHeight:         1,
        }}
      >
        {lockCountdown.d > 0
          ? `${lockCountdown.d}d ${lockCountdown.h}h`
          : lockCountdown.h > 0
            ? `${lockCountdown.h}h ${lockCountdown.m}m`
            : `${lockCountdown.m}m`}
      </div>
    </div>
  ) : (
    <div
      style={{
        padding:       "5px 11px",
        borderRadius:  999,
        background:    stateTone.surface,
        border:        `1px solid ${stateTone.outline}`,
        fontSize:      10,
        fontWeight:    800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color:         stateTone.accent,
        whiteSpace:    "nowrap",
        flexShrink:    0,
      }}
    >
      {stateTone.label}
    </div>
  );

  // Title node — race name in display weight; selectedLeague + roundSummary
  // ride below as a tighter description line.
  const titleNode = (
    <div
      style={{
        fontSize:      isMobile ? 24 : 32,
        fontWeight:    900,
        letterSpacing: "-0.045em",
        lineHeight:    1.02,
        color:         TEXT_PRIMARY,
      }}
    >
      {race.n}
    </div>
  );

  const descriptionNode = (selectedLeague || roundSummary.hasAny) ? (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
      {selectedLeague && (
        <span style={{ fontWeight: 600, color: MUTED_TEXT, letterSpacing: "-0.01em" }}>
          {selectedLeague.name}
        </span>
      )}
      {roundSummary.hasAny && selectedLeague && (
        <span style={{ display: "inline-block", width: 3, height: 3, borderRadius: "50%", background: "rgba(214,223,239,0.22)", flexShrink: 0 }} />
      )}
      {roundSummary.hasAny && (
        <span style={{ fontWeight: 600, color: MUTED_TEXT }}>
          {roundSummary.detail}
        </span>
      )}
    </div>
  ) : null;

  // Sprint toggle + AI insight strip become the masthead's badges row.
  const badgesNode = (race.sprint || aiInsight?.headline) ? (
    <>
      {race.sprint && (
        <div
          style={{
            display:      "inline-flex",
            borderRadius: 999,
            padding:      2,
            gap:          2,
            flexShrink:   0,
            background:   "var(--bg-elevated)",
            border:       `1px solid ${HAIRLINE}`,
          }}
        >
          {[["race", "Race"], ["sprint", "Sprint"]].map(([value, label]) => {
            const isActive = tab === value;
            return (
              <button
                key={value}
                onClick={() => setTab(value)}
                style={{
                  minHeight:     28,
                  padding:       "0 14px",
                  borderRadius:  999,
                  border:        `1px solid ${isActive ? hexToRgba(ACCENT, 0.30) : "transparent"}`,
                  background:    isActive ? hexToRgba(ACCENT, 0.12) : "transparent",
                  color:         isActive ? ACCENT : MUTED_TEXT,
                  fontSize:      11,
                  fontWeight:    700,
                  letterSpacing: "-0.005em",
                  cursor:        "pointer",
                  whiteSpace:    "nowrap",
                  transition:    "background 150ms ease, color 150ms ease, border-color 150ms ease",
                  fontFamily:    "inherit",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {aiInsight?.headline && (
        <div style={{ flex: "1 1 220px", display: "flex", gap: 7, alignItems: "flex-start", minWidth: 0 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-ai)", flexShrink: 0, marginTop: 6 }} />
          <span
            style={{
              fontSize:        12,
              lineHeight:      1.5,
              color:           "var(--text-ai)",
              fontWeight:      500,
              overflow:        "hidden",
              display:         "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {aiInsight.headline}
          </span>
        </div>
      )}
    </>
  ) : null;

  return (
    <PageMasthead
      variant="compact"
      viewTransitionName="picks-race-header"
      marginBottom={isMobile ? 12 : 16}
      style={{ padding: isMobile ? "16px 18px 14px" : "18px 24px 16px" }}
      eyebrow={eyebrowNode}
      meta={metaNode}
      identityRow={(
        <div>
          {titleNode}
          {descriptionNode && <div style={{ marginTop: 8 }}>{descriptionNode}</div>}
        </div>
      )}
      image={{ src: "/images/header-calendar.png", position: "right-mask" }}
      tone={isCritical ? "live" : "ambient"}
      badges={badgesNode}
    />
  );
}

function PickNavigatorPanel({
  promptSections,
  allPrompts,
  picks,
  activePromptKey,
  aiByKey,
  onSelect,
  selectedLeague,
  budgetAmounts,
  doubleDownKey,
}) {
  const done = allPrompts.filter((p) => !!picks[p.key]).length;
  const total = allPrompts.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      style={{
        borderRadius: SECTION_RADIUS,
        background: PANEL_BG,
        border: `1px solid ${HAIRLINE}`,
        overflow: "hidden",
        position: "sticky",
        top: 20,
        maxHeight: "calc(100vh - 140px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: TEXT_PRIMARY,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {done}
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: SUBTLE_TEXT, letterSpacing: "-0.01em" }}>
              /{total} picks
            </span>
          </div>
          {done === total && total > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: SUCCESS,
                padding: "2px 8px",
                borderRadius: 999,
                background: hexToRgba(SUCCESS, 0.1),
              }}
            >
              Done
            </span>
          )}
        </div>
        <div style={{ height: 4, borderRadius: 999, background: "var(--btn-secondary-bg)", overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: done === total && total > 0
                ? `linear-gradient(90deg, ${SUCCESS}, #4ade80)`
                : `linear-gradient(90deg, ${ACCENT}, #FBBF24)`,
              borderRadius: 999,
              transition: "width 300ms ease",
            }}
          />
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ overflowY: "auto", flex: 1, scrollbarWidth: "none" }}>
        {promptSections.map((section, sIdx) => {
          const sectionComplete = section.prompts.every((p) => !!picks[p.key]);
          return (
            <div key={section.title}>
              <div
                style={{
                  padding: "7px 14px 5px",
                  borderTop: sIdx > 0 ? `1px solid ${HAIRLINE}` : "none",
                  background: PANEL_BG_ALT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: sectionComplete ? SUCCESS : SUBTLE_TEXT,
                  }}
                >
                  {section.title}
                </span>
                {sectionComplete && (
                  <svg width="11" height="8" viewBox="0 0 11 8" fill="none" aria-hidden="true">
                    <path d="M1 4L4 7L10 1" stroke={SUCCESS} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              {section.prompts.map((prompt) => {
                const isActive = activePromptKey === prompt.key;
                const meta = selectionMeta(prompt, picks[prompt.key]);
                const hasAi = !!aiByKey[prompt.key];
                const isDD = selectedLeague?.gameMode === "double_down" && doubleDownKey === prompt.key;
                const budget = selectedLeague?.gameMode === "budget_picks" ? (budgetAmounts[prompt.key] || null) : null;

                return (
                  <button
                    key={prompt.key}
                    onClick={() => onSelect(prompt.key)}
                    className="stint-pressable"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 14px",
                      background: isActive
                        ? "linear-gradient(90deg, rgba(255,106,26,0.13) 0%, rgba(255,106,26,0.02) 100%)"
                        : "transparent",
                      border: "none",
                      outline: isActive ? `1px solid ${hexToRgba(meta ? (meta.accent || SUCCESS) : ACCENT, 0.22)}` : "none",
                      outlineOffset: -1,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 100ms ease, outline-color 100ms ease",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? 700 : 600,
                          color: isActive ? TEXT_PRIMARY : meta ? TEXT_PRIMARY : MUTED_TEXT,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginBottom: meta ? 2 : 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        {prompt.label}
                        {hasAi && (
                          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#60A5FA", flexShrink: 0 }} />
                        )}
                      </div>
                      {meta ? (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: meta.accent || SUCCESS,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {meta.label}{isDD ? " · 3×" : ""}{budget ? ` · ${budget}cr` : ""}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: SUBTLE_TEXT }}>—</div>
                      )}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: isActive ? ACCENT : SUBTLE_TEXT, flexShrink: 0 }}>
                      {prompt.pts}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardCommandBar({
  allPrompts,
  picks,
  activePromptKey,
  onSelectPrompt,
  done,
  totalPrompts,
  saveLabel,
  save,
  isSaving,
  editingLocked,
  demoPreview,
  selectedLeagueBlocked,
  saved,
  savePop,
  reviewReady,
  resultsEntered,
  isMobile,
  selectedLeague,
}) {
  const saveDisabled =
    isSaving ||
    (editingLocked && !selectedLeagueBlocked) ||
    (demoPreview && !selectedLeagueBlocked);

  const saveBg = reviewReady
    ? "linear-gradient(135deg,#0f766e,#14b8a6)"
    : resultsEntered || (editingLocked && !selectedLeagueBlocked)
      ? "linear-gradient(135deg,#334155,#475569)"
      : saved
        ? "linear-gradient(135deg,#22C55E,#16A34A)"
        : "linear-gradient(135deg,#F97316,#EA580C)";

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 20,
        paddingTop: 24,
        paddingBottom: 16,
        background: `linear-gradient(180deg, transparent 0%, ${BG_BASE} 22%)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          borderRadius: CARD_RADIUS,
          background: PANEL_BG_ALT,
          border: "1px solid rgba(214,223,239,0.12)",
          boxShadow: `${LIFTED_SHADOW}, inset 0 1px 0 rgba(255,255,255,0.04)`,
          padding: isMobile ? "14px 14px" : "14px 20px",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto",
          gap: 14,
          alignItems: "center",
          pointerEvents: "all",
        }}
      >
        <div style={{ display: "grid", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: done === totalPrompts && totalPrompts > 0 ? SUCCESS : TEXT_PRIMARY, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
              {done}/{totalPrompts}
            </span>
            <span style={{ color: "rgba(214,223,239,0.22)", fontSize: 12 }}>·</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: MUTED_TEXT, letterSpacing: "-0.01em" }}>{selectedLeague?.name || "Board"}</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            {allPrompts.map((prompt) => {
              const isActive = activePromptKey === prompt.key;
              const meta = selectionMeta(prompt, picks[prompt.key]);
              const accent = meta
                ? meta.accent || SUCCESS
                : isActive
                  ? ACCENT
                  : "rgba(255,255,255,0.12)";
              return (
                <button
                  key={`cmd-${prompt.key}`}
                  onClick={() => onSelectPrompt(prompt.key)}
                  title={prompt.label + (meta ? `: ${meta.label}` : "")}
                  style={{
                    width: isActive ? 30 : meta ? 14 : 10,
                    height: 10,
                    borderRadius: 999,
                    background: accent,
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "width 240ms cubic-bezier(0.22,1,0.36,1), background 180ms ease",
                    boxShadow: isActive
                      ? `0 0 14px ${hexToRgba(ACCENT, 0.55)}`
                      : meta
                        ? `0 0 6px ${hexToRgba(accent, 0.25)}`
                        : "none",
                  }}
                />
              );
            })}
          </div>
        </div>

        <button
          className={["stint-pressable", savePop ? "stint-success-pop" : null].filter(Boolean).join(" ")}
          onClick={save}
          disabled={saveDisabled}
          style={{
            minHeight: isMobile ? 48 : 52,
            minWidth: isMobile ? "100%" : 172,
            padding: "0 24px",
            borderRadius: RADIUS_MD,
            border: "none",
            background: saveBg,
            color: TEXT_PRIMARY,
            fontSize: 14,
            fontWeight: 700,
            cursor: saveDisabled ? "default" : "pointer",
            opacity: saveDisabled ? 0.75 : 1,
            boxShadow: saved
              ? "0 10px 24px rgba(34,197,94,0.22)"
              : !saveDisabled
                ? "0 10px 24px rgba(249,115,22,0.26)"
                : "none",
            letterSpacing: "-0.02em",
            transition: "background 260ms ease, box-shadow 260ms ease, opacity 120ms ease",
          }}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

export default function PredictionsPage({
  user,
  openAuth,
  demoMode = false,
  initialRaceRound = null,
  onInitialRaceConsumed = () => {},
}) {
  const { isMobile, isTablet } = useViewport();
  const { calendar } = useRaceCalendar(2026);
  const [race, setRace] = useState(() => nextRace(calendar) || calendar[0] || null);
  const demoPreview = demoMode && !user;
  const [picks, setPicks] = useState({});
  const [predictionsByRound, setPredictionsByRound] = useState({});
  const [resultsByRound, setResultsByRound] = useState({});
  const [tab, setTab] = useState("race");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPartialWarning, setShowPartialWarning] = useState(false);
  const [liveRaces, setLiveRaces] = useState({});
  const [liveMeetings, setLiveMeetings] = useState({});
  const [localWeekendState, setLocalWeekendState] = useState({ controlsByRound: {}, sessionsByRound: {} });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiInsightStale, setAiInsightStale] = useState(false);
  const [aiInsightError, setAiInsightError] = useState(false);
  const [leagueContexts, setLeagueContexts] = useState([]);
  const [draftOverridesByRound, setDraftOverridesByRound] = useState({});
  const [activeLeagueId, setActiveLeagueId] = useState(SOLO_LEAGUE_ID);
  const [savePop, setSavePop] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [activePromptKey, setActivePromptKey] = useState("");
  const [doubleDownKey, setDoubleDownKey] = useState(null);
  const [budgetAmounts, setBudgetAmounts] = useState({});
  const boardRef = useRef(null);
  const activeRoundRef = useRef(null);
  const allPromptsRef = useRef([]);
  const autoAdvanceRef = useRef(null);

  const currentRace = useMemo(() => nextRace(calendar) || calendar[0] || null, [calendar]);
  const availableLeagues = useMemo(
    () => (leagueContexts.length ? leagueContexts : [createSoloLeague(user), createPublicProLeague()]),
    [leagueContexts, user]
  );

  const loadAiInsight = useCallback(async () => {
    setAiInsightError(false);
    setAiInsightStale(false);
    try {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("headline,summary,confidence,race_name,generated_at,metadata")
        .eq("scope", "upcoming_race")
        .order("generated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      const rows = data || [];
      const matched = chooseInsightForRace(rows, currentRace);
      setAiInsight(matched);
      setAiInsightStale(rows.length > 0 && !matched);
    } catch {
      setAiInsightError(true);
    }
  }, [currentRace]);

  useEffect(() => {
    loadPicks();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let ignore = false;

    async function loadRoundResults() {
      const { data } = await supabase.from("race_results").select("*");
      if (ignore || !data) return;

      const mapped = {};
      data.forEach((row) => {
        mapped[row.race_round] = row;
      });
      setResultsByRound(mapped);
    }

    loadRoundResults();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadSeasonSchedule() {
      const sessions = await fetchRaceSessions(2026);
      if (ignore || !sessions.length) return;

      setLiveRaces(mapRaceSessionsByCalendar(calendar, sessions));
    }

    loadSeasonSchedule();
    loadAiInsight();
    return () => {
      ignore = true;
    };
  }, [calendar, loadAiInsight]);

  useEffect(() => {
    let ignore = false;

    async function loadLocalWeekendState() {
      try {
        const response = await fetch("/api/race-weekend-state?season=2026", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (ignore) return;
        setLocalWeekendState({
          controlsByRound: payload?.controlsByRound || {},
          sessionsByRound: payload?.sessionsByRound || {},
        });
      } catch {
        if (!ignore) {
          setLocalWeekendState({ controlsByRound: {}, sessionsByRound: {} });
        }
      }
    }

    loadLocalWeekendState();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const raceInfo = liveRaces[race.r];

    async function loadMeetingSchedule() {
      if (!raceInfo?.meeting_key || liveMeetings[race.r]) return;
      const sessions = await fetchMeetingSessions(raceInfo.meeting_key);
      if (ignore || !sessions.length) return;
      setLiveMeetings((current) => ({ ...current, [race.r]: sessions }));
    }

    loadMeetingSchedule();
    return () => {
      ignore = true;
    };
  }, [race, liveRaces, liveMeetings]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  // Fetch the active leagues that define each round board.
  useEffect(() => {
    if (!user) {
      setLeagueContexts([]);
      return;
    }
    let cancelled = false;

    async function fetchLeagueContexts() {
      try {
        const [{ data: membershipData }, { data: publicProLeague }] = await Promise.all([
          supabase
            .from("league_members")
            .select("league_id, status, leagues!inner(id,name,game_mode,settings,type,season)")
            .eq("user_id", user.id)
            .eq("status", "active"),
          supabase
            .from("leagues")
            .select("id,name,game_mode,settings,type,season")
            .eq("type", "pro_community")
            .maybeSingle(),
        ]);
        if (cancelled) return;

        const nextLeagues = (membershipData || [])
          .map((row) => normalizeLeagueContext(row.leagues))
          .filter((league) => league && (!league.season || league.season === 2026));

        const normalizedPublicProLeague = normalizeLeagueContext(publicProLeague) || createPublicProLeague();
        if (!nextLeagues.some((league) => league.id === normalizedPublicProLeague.id)) {
          nextLeagues.push(normalizedPublicProLeague);
        }

        nextLeagues.sort((left, right) => {
          if (left.type === "pro_community" && right.type !== "pro_community") return 1;
          if (right.type === "pro_community" && left.type !== "pro_community") return -1;
          if (left.gameMode === right.gameMode) return left.name.localeCompare(right.name);
          if (left.gameMode === "standard") return -1;
          if (right.gameMode === "standard") return 1;
          return left.name.localeCompare(right.name);
        });

        setLeagueContexts(nextLeagues);
      } catch {
        if (!cancelled) setLeagueContexts([]);
      }
    }

    fetchLeagueContexts();
    return () => { cancelled = true; };
  }, [user]);

  const loadPicks = async () => {
    if (!user) {
      setPredictionsByRound({});
      setPicks({});
      setDraftOverridesByRound({});
      return;
    }
    const { data } = await supabase.from("predictions").select("*").eq("user_id", user.id);
    if (data) {
      const mapped = {};
      data.forEach((row) => {
        mapped[row.race_round] = parsePredictionRow(row);
      });
      setPredictionsByRound(mapped);
      setDraftOverridesByRound({});
    }
  };

  const selectRace = (selectedRace) => {
    if (!selectedRace) return;
    if (selectedRace.r === race?.r) return;
    // A view transition makes the page-wide race header cross-fade cleanly,
    // along with the sticky aside's round rail. The rest of the page rides
    // the default root cross-fade.
    withViewTransition(
      () => {
        setRace(selectedRace);
        setSaved(false);
        setTab("race");
      },
      { name: "race-header" }
    );
  };

  useEffect(() => {
    if (!calendar.length) return;

    setRace((current) => {
      if (current) {
        const updated = calendar.find((item) => item.r === current.r);
        if (updated) return updated;
      }
      return nextRace(calendar) || calendar[0] || null;
    });
  }, [calendar]);

  useEffect(() => {
    if (!initialRaceRound) return;

    const targetRace = calendar.find((item) => Number(item.r) === Number(initialRaceRound));
    if (!targetRace) {
      onInitialRaceConsumed();
      return;
    }

    setRace(targetRace);
    setSaved(false);
    setTab("race");
    onInitialRaceConsumed();
  }, [calendar, initialRaceRound, onInitialRaceConsumed, predictionsByRound]);

  const selectedPrediction = race ? (predictionsByRound[race.r] || null) : null;
  const baseRoundSubmissions = useMemo(
    () => buildRoundLeagueSubmissions(selectedPrediction, availableLeagues),
    [selectedPrediction, availableLeagues]
  );
  const selectedRoundOverrides = race ? (draftOverridesByRound[race.r] || {}) : {};
  const selectedRoundSubmissions = useMemo(
    () => mergeRoundLeagueSubmissions(baseRoundSubmissions, selectedRoundOverrides, availableLeagues),
    [baseRoundSubmissions, selectedRoundOverrides, availableLeagues]
  );
  const selectedLeague = useMemo(
    () => availableLeagues.find((league) => league.id === activeLeagueId) || availableLeagues[0],
    [availableLeagues, activeLeagueId]
  );

  useEffect(() => {
    if (!availableLeagues.length) return;
    setActiveLeagueId((current) => {
      if (availableLeagues.some((league) => league.id === current)) return current;
      return pickPrimaryLeagueId(availableLeagues, selectedPrediction?.primaryLeagueId);
    });
  }, [availableLeagues, selectedPrediction?.primaryLeagueId]);

  useEffect(() => {
    if (!selectedLeague) return;
    const submission = selectedRoundSubmissions[selectedLeague.id] || emptyLeagueSubmission(selectedLeague);
    setPicks(submission.picks || {});
    setDoubleDownKey(submission.doubleDownKey || null);
    setBudgetAmounts(submission.betAmounts || {});
  }, [selectedLeague, selectedRoundSubmissions]);

  const syncActiveLeagueDraft = useCallback((nextSubmission) => {
    if (!race || !selectedLeague) return;

    setDraftOverridesByRound((current) => {
      const roundDrafts = current[race.r] || {};
      const baseSubmission = selectedRoundSubmissions[selectedLeague.id] || emptyLeagueSubmission(selectedLeague);
      const mergedSubmission = normalizeLeagueSubmission(
        {
          ...baseSubmission,
          ...nextSubmission,
          picks: nextSubmission.picks ?? baseSubmission.picks,
          betAmounts: nextSubmission.betAmounts ?? baseSubmission.betAmounts,
          updatedAt: nextSubmission.updatedAt || new Date().toISOString(),
        },
        selectedLeague
      );

      return {
        ...current,
        [race.r]: {
          ...roundDrafts,
          [selectedLeague.id]: mergedSubmission,
        },
      };
    });
    setSaved(false);
  }, [race, selectedLeague, selectedRoundSubmissions]);

  const setPick = (key, value) => {
    if (interactionLocked) return;

    // Cancel any pending auto-advance so Clear never races with navigation
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }

    const nextPicks = { ...picks };
    if (value === null || value === undefined || value === "") {
      delete nextPicks[key];
    } else {
      nextPicks[key] = value;
    }

    const nextBudgetAmounts = { ...budgetAmounts };
    if (!nextPicks[key]) delete nextBudgetAmounts[key];
    const nextDoubleDownKey = doubleDownKey === key && !nextPicks[key] ? null : doubleDownKey;

    setPicks(nextPicks);
    setBudgetAmounts(nextBudgetAmounts);
    setDoubleDownKey(nextDoubleDownKey);
    syncActiveLeagueDraft({
      picks: nextPicks,
      betAmounts: nextBudgetAmounts,
      doubleDownKey: nextDoubleDownKey,
    });

    // Auto-advance only on selection (not on clear)
    if (value !== null && value !== undefined && value !== "") {
      const promptList = allPromptsRef.current;
      const currentIdx = promptList.findIndex((p) => p.key === key);
      const nextAfter = promptList.slice(currentIdx + 1).find((p) => !nextPicks[p.key]);
      const nextFromStart = promptList.find((p) => p.key !== key && !nextPicks[p.key]);
      const nextKey = (nextAfter || nextFromStart)?.key;
      if (nextKey) {
        autoAdvanceRef.current = setTimeout(() => {
          setActivePromptKey(nextKey);
          autoAdvanceRef.current = null;
        }, 360);
      }
    }
  };

  const focusPrompt = (promptKey) => {
    setActivePromptKey(promptKey);
    window.requestAnimationFrame(() => {
      boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const focusSection = (sectionTitle) => {
    const firstPrompt = promptSections.find((section) => section.title === sectionTitle)?.prompts?.[0];
    if (firstPrompt) focusPrompt(firstPrompt.key);
  };

  const save = async () => {
    if (selectedLeagueBlocked) {
      if (openAuth) openAuth("register");
      return;
    }
    if (demoPreview) return;
    if (!user) return openAuth("login");
    if (editingLocked) return;

    if (done < totalPrompts && !showPartialWarning) {
      setShowPartialWarning(true);
      return;
    }
    setShowPartialWarning(false);

    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    setIsSaving(true);
    try {
      const updatedAt = new Date().toISOString();
      const nextSubmissions = {
        ...selectedRoundSubmissions,
        [selectedLeague.id]: normalizeLeagueSubmission(
          {
            ...(selectedRoundSubmissions[selectedLeague.id] || emptyLeagueSubmission(selectedLeague)),
            picks,
            betAmounts: budgetAmounts,
            doubleDownKey,
            updatedAt,
          },
          selectedLeague
        ),
      };
      const payloadPicks = serializeRoundPayload(
        nextSubmissions,
        availableLeagues,
        selectedPrediction?.primaryLeagueId || selectedLeague.id
      );
      const { error } = await supabase.from("predictions").upsert(
        { user_id: user.id, race_round: race.r, picks: payloadPicks, updated_at: updatedAt },
        { onConflict: "user_id,race_round" }
      );
      if (error) {
        alert(error.message);
        return;
      }
      const nextRow = parsePredictionRow({
        ...(selectedPrediction || {}),
        user_id: user.id,
        race_round: race.r,
        picks: payloadPicks,
        updated_at: updatedAt,
      });
      setPredictionsByRound((current) => ({
        ...current,
        [race.r]: nextRow,
      }));
      setDraftOverridesByRound((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[race.r];
        return nextDrafts;
      });
      setSaved(true);
      setSavePop(true);
      setTimeout(() => setSaved(false), 3000);
      setTimeout(() => setSavePop(false), 300);
    } finally {
      setIsSaving(false);
    }
  };

  const isSprintTab = race.sprint && tab === "sprint";
  const groups = useMemo(() => promptGroups(isSprintTab), [isSprintTab]);
  const prompts = useMemo(() => flattenPromptGroups(groups), [groups]);
  const selectedLeagueExtraCategories = useMemo(
    () => getLeagueExtraCategories(selectedLeague),
    [selectedLeague]
  );

  const allPrompts = useMemo(() => {
    const bonusPrompts = (isSprintTab ? [] : selectedLeagueExtraCategories)
      .map((key) => EXTRA_PROMPT_DEFS[key])
      .filter(Boolean)
      .map((p) => ({ ...p, section: "League Bonus Picks" }));
    return [...prompts, ...bonusPrompts];
  }, [prompts, selectedLeagueExtraCategories, isSprintTab]);
  allPromptsRef.current = allPrompts;
  const promptSections = useMemo(() => {
    const baseSections = groups.map((group) => ({
      title: group.title,
      prompts: group.prompts.map((prompt) => ({ ...prompt, section: group.title })),
    }));

    if (isSprintTab || !selectedLeagueExtraCategories.length) return baseSections;

    return [
      ...baseSections,
      {
        title: "League Bonus Picks",
        prompts: selectedLeagueExtraCategories
          .map((key) => EXTRA_PROMPT_DEFS[key])
          .filter(Boolean)
          .map((prompt) => ({ ...prompt, section: "League Bonus Picks" })),
      },
    ];
  }, [groups, isSprintTab, selectedLeagueExtraCategories]);

  useEffect(() => {
    if (!allPrompts.length) return;
    if (!allPrompts.find((prompt) => prompt.key === activePromptKey)) {
      setActivePromptKey(allPrompts[0]?.key || "");
    }
  }, [allPrompts, activePromptKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    activeRoundRef.current?.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
  }, [race.r]); // eslint-disable-line react-hooks/exhaustive-deps

  const activePrompt = allPrompts.find((prompt) => prompt.key === activePromptKey) || allPrompts[0];
  const activeSection = promptSections.find((section) => section.title === activePrompt?.section) || promptSections[0] || { title: "", prompts: [] };
  const activeSectionIndex = Math.max(promptSections.findIndex((section) => section.title === activeSection?.title), 0);
  const activeSectionCompleteCount = activeSection.prompts.filter((prompt) => !!picks[prompt.key]).length;
  const activeIndex = allPrompts.findIndex((prompt) => prompt.key === activePrompt?.key);
  const previousPrompt = activeIndex > 0 ? allPrompts[activeIndex - 1] : null;
  const nextPromptItem = activeIndex < allPrompts.length - 1 ? allPrompts[activeIndex + 1] : null;
  const selectedResult = resultsByRound[race.r] || null;
  const liveRace = liveRaces[race.r] || null;
  const selectedLeagueSubmission = selectedLeague
    ? (selectedRoundSubmissions[selectedLeague.id] || emptyLeagueSubmission(selectedLeague))
    : emptyLeagueSubmission(createSoloLeague(user));
  const isProSubscriber = user?.subscription_status === "pro";
  const selectedLeagueProgress = useMemo(
    () => leagueSubmissionProgress(race, selectedLeague, selectedLeagueSubmission),
    [race, selectedLeague, selectedLeagueSubmission]
  );
  const roundSummary = useMemo(
    () => summarizeRoundLeagues(race, availableLeagues, selectedRoundSubmissions, isProSubscriber),
    [race, availableLeagues, selectedRoundSubmissions, isProSubscriber]
  );
  const roundSummariesByRound = useMemo(
    () => Object.fromEntries(calendar.map((item) => {
      const prediction = predictionsByRound[item.r] || null;
      const baseSubmissions = buildRoundLeagueSubmissions(prediction, availableLeagues);
      const mergedSubmissions = mergeRoundLeagueSubmissions(baseSubmissions, draftOverridesByRound[item.r] || {}, availableLeagues);
      return [item.r, summarizeRoundLeagues(item, availableLeagues, mergedSubmissions, isProSubscriber)];
    })),
    [calendar, predictionsByRound, draftOverridesByRound, availableLeagues, isProSubscriber]
  );
  const meetingSessions = useMemo(
    () => {
      const localSessions = localWeekendState.sessionsByRound?.[race.r];
      if (Array.isArray(localSessions) && localSessions.length) return localSessions;
      return liveMeetings[race.r] || [];
    },
    [localWeekendState.sessionsByRound, liveMeetings, race.r]
  );
  const totalPrompts = allPrompts.length;
  const done = allPrompts.filter((prompt) => !!picks[prompt.key]).length;
  const completion = totalPrompts ? Math.round((done / totalPrompts) * 100) : 0;
  const budgetTotal = allPrompts.reduce((sum, prompt) => sum + Number(budgetAmounts[prompt.key] || 0), 0);
  const activeBudgetAmount = activePrompt ? Number(budgetAmounts[activePrompt.key] || 0) : 0;
  const copySources = useMemo(
    () => availableLeagues.filter((league) => (
      league.id !== selectedLeague?.id
      && hasSavedPickContent(selectedRoundSubmissions[league.id]?.picks)
    )),
    [availableLeagues, selectedLeague, selectedRoundSubmissions]
  );

  const aiTargetsRace = insightMatchesRace(aiInsight, race);
  const aiPredictions = useMemo(
    () => (aiTargetsRace ? (aiInsight?.metadata?.category_predictions || []) : []),
    [aiTargetsRace, aiInsight]
  );
  const aiByKey = useMemo(
    () => Object.fromEntries(aiPredictions.map((item) => [item.key, item])),
    [aiPredictions]
  );

  const roundControl = localWeekendState.controlsByRound?.[race.r] || null;
  const resolvedLock = useMemo(
    () => resolveBoardLock({ race, control: roundControl, sessions: meetingSessions, isSprintBoard: isSprintTab, now }),
    [race, roundControl, meetingSessions, isSprintTab, now]
  );

  const lockCountdown = useMemo(() => {
    if (!resolvedLock?.lockAt) return null;
    const diff = new Date(resolvedLock.lockAt).getTime() - now;
    if (diff <= 0) return { locked: true, source: resolvedLock.source };
    const minsRemaining = Math.floor(diff / 60000);
    return {
      locked: false,
      source: resolvedLock.source,
      minsRemaining,
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
    };
  }, [resolvedLock, now]);

  const raceHasPassed = useMemo(
    () => getRaceEndTimestamp(race, liveRace) <= now,
    [race, liveRace, now]
  );

  const resultsEntered = !!selectedResult?.results_entered;
  const reviewReady = !!selectedLeague && !!selectedResult && resultsEntered && raceHasPassed && hasSavedPickContent(selectedLeagueSubmission?.picks);
  const editingLocked = !!lockCountdown?.locked || raceHasPassed || resultsEntered;
  const selectedLeagueBlocked = !!selectedLeague && selectedLeague.type === "pro_community" && !isProSubscriber;
  const interactionLocked = editingLocked || selectedLeagueBlocked;
  const showReviewOnly = raceHasPassed || resultsEntered;
  const reviewRows = useMemo(
    () => {
      const breakdown = selectedPrediction?.primaryLeagueId === selectedLeague?.id
        ? (selectedPrediction?.score_breakdown || [])
        : [];
      const baseRows = reviewRowsForPrompts(
        allPrompts,
        selectedLeagueSubmission?.picks || {},
        selectedResult,
        breakdown
      );

      return baseRows.map((row) => {
        if (selectedLeague?.gameMode === "double_down" && selectedLeagueSubmission?.doubleDownKey === row.key) {
          return {
            ...row,
            points: row.pick ? (row.hit ? Number(row.points || 0) * 3 : -1) : 0,
          };
        }

        if (selectedLeague?.gameMode === "budget_picks") {
          const betAmount = Number(selectedLeagueSubmission?.betAmounts?.[row.key] || 0);
          return {
            ...row,
            points: row.pick ? (row.hit ? betAmount : -betAmount) : 0,
          };
        }

        return row;
      });
    },
    [allPrompts, selectedLeagueSubmission, selectedResult, selectedPrediction, selectedLeague]
  );
  const summaryRows = reviewRows.filter((row) => row.pick || row.actual);
  const hits = reviewRows.filter((row) => row.hit).length;
  const attemptedReviewRows = reviewRows.filter((row) => row.pick);
  const misses = attemptedReviewRows.length - hits;
  const savedPickCount = allPrompts.filter((prompt) => !!selectedLeagueSubmission?.picks?.[prompt.key]).length;
  const perfectPodiumHit = ["winner", "p2", "p3"].every((key) => reviewRows.some((row) => row.key === key && row.hit));
  const podiumBonus = selectedLeague?.gameMode === "budget_picks"
    ? null
    : Array.isArray(selectedPrediction?.score_breakdown)
    ? (selectedPrediction.score_breakdown.find((item) => item.label === "Perfect Podium Bonus") || (perfectPodiumHit ? { label: "Perfect Podium Bonus", pts: PTS.perfectPodium } : null))
    : (perfectPodiumHit ? { label: "Perfect Podium Bonus", pts: PTS.perfectPodium } : null);
  const displayReviewScore = reviewRows.reduce((sum, row) => sum + Number(row.points || 0), 0) + Number(podiumBonus?.pts || 0);
  const lockLabel = resolvedLock?.lockAt ? formatLocalDateTime(resolvedLock.lockAt) : null;
  const roundHasSavedBoard = selectedLeagueProgress.hasAny;
  const saveLabel = isSaving
    ? "Saving…"
    : selectedLeagueBlocked
      ? "Unlock Pro to pick"
    : reviewReady
      ? "Round Scored"
      : demoPreview
        ? "Preview Only"
      : resultsEntered
        ? "Round Closed"
        : editingLocked
          ? "Predictions Locked"
          : saved
            ? `Saved to ${selectedLeague?.name || "league"}`
            : `Save ${selectedLeague?.name || "league"}`;

  const driverOptions = useMemo(() => (
    [...DRV].sort((left, right) => {
      const leftRank = driverRank.get(left.n);
      const rightRank = driverRank.get(right.n);
      if ((leftRank?.teamRank ?? 999) !== (rightRank?.teamRank ?? 999)) {
        return (leftRank?.teamRank ?? 999) - (rightRank?.teamRank ?? 999);
      }
      return (leftRank?.index ?? 999) - (rightRank?.index ?? 999);
    })
  ), []);

  const constructorOptions = useMemo(
    () => [...CONSTRUCTORS].sort((left, right) => (constructorRank.get(left) ?? 999) - (constructorRank.get(right) ?? 999)),
    []
  );

  const currentValue = activePrompt ? picks[activePrompt.key] : null;
  const currentMeta = activePrompt ? selectionMeta(activePrompt, currentValue) : null;
  const activeAi = activePrompt ? aiByKey[activePrompt.key] : null;
  const optionGrid = activePrompt?.type === "driver" && !isMobile && !isTablet
    ? "repeat(4,minmax(0,1fr))"
    : "repeat(2,minmax(0,1fr))";
  useEffect(() => {
    if (!calendar.length) return;
    if (!calendar.some((item) => item.r === race.r)) {
      selectRace(calendar[0]);
    }
  }, [calendar, race.r]); // eslint-disable-line react-hooks/exhaustive-deps

  const stateTone = computeStateTone({ reviewReady, resultsEntered, raceHasPassed, lockCountdown, roundSummary, lockLabel, availableLeagues, race });

  const selectLeagueContext = (leagueId) => {
    setActiveLeagueId(leagueId);
    setSaved(false);
    setShowPartialWarning(false);
  };

  const adjustBudgetAmount = (promptKey, delta) => {
    if (interactionLocked || selectedLeague?.gameMode !== "budget_picks" || !picks[promptKey]) return;

    const nextBudgetAmounts = { ...budgetAmounts };
    const nextValue = Math.max(0, Math.min(20, Number(nextBudgetAmounts[promptKey] || 0) + delta));
    if (nextValue === 0) delete nextBudgetAmounts[promptKey];
    else nextBudgetAmounts[promptKey] = nextValue;

    setBudgetAmounts(nextBudgetAmounts);
    syncActiveLeagueDraft({
      picks,
      betAmounts: nextBudgetAmounts,
      doubleDownKey,
    });
  };

  const toggleDoubleDown = (promptKey) => {
    if (interactionLocked || selectedLeague?.gameMode !== "double_down" || !picks[promptKey]) return;
    const nextDoubleDownKey = doubleDownKey === promptKey ? null : promptKey;
    setDoubleDownKey(nextDoubleDownKey);
    syncActiveLeagueDraft({
      picks,
      betAmounts: budgetAmounts,
      doubleDownKey: nextDoubleDownKey,
    });
  };

  const copyFromLeague = (sourceLeagueId) => {
    if (selectedLeagueBlocked) return;
    const sourceLeague = availableLeagues.find((league) => league.id === sourceLeagueId);
    if (!sourceLeague || !selectedLeague) return;

    const copiedSubmission = copyCompatibleSubmission(
      selectedRoundSubmissions[sourceLeagueId],
      sourceLeague,
      selectedLeague,
      race
    );

    setPicks(copiedSubmission.picks);
    setBudgetAmounts(copiedSubmission.betAmounts);
    setDoubleDownKey(copiedSubmission.doubleDownKey);
    syncActiveLeagueDraft(copiedSubmission);

    const firstCopiedKey = Object.keys(copiedSubmission.picks || {})[0];
    if (firstCopiedKey) setActivePromptKey(firstCopiedKey);
  };

  return (
    <div
      className="stint-page-enter"
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: isMobile ? "20px 14px 80px" : isTablet ? "24px 18px 80px" : "28px 22px 80px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <style>{`
        /* Picks page motion — race header cross-fades between rounds via the View
           Transition API. Transform-only so the sticky aside doesn't jump. */
        @keyframes picks-page-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .stint-page-enter { animation: picks-page-in 320ms cubic-bezier(0.16,1,0.3,1) both; }

        /* Under the race-header transition, the rest of the page cross-fades on
           the same curve so the header and main content move together. */
        [data-vt-name="race-header"]::view-transition-old(root),
        [data-vt-name="race-header"]::view-transition-new(root),
        [data-vt-name="race-header"]::view-transition-old(picks-race-header),
        [data-vt-name="race-header"]::view-transition-new(picks-race-header) {
          animation-duration: 280ms;
          animation-timing-function: cubic-bezier(0.16,1,0.3,1);
        }

        .picks-race-header {
          transition: border-color 200ms cubic-bezier(0.16,1,0.3,1),
                      background   200ms cubic-bezier(0.16,1,0.3,1);
        }
        .picks-race-header button {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        @media (prefers-reduced-motion: reduce) {
          .stint-page-enter, .picks-race-header { animation: none !important; transition: none !important; }
          ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
        }
      `}</style>

      {/* Full-width race header — every breakpoint. The page starts with the race,
           not with the sidebar. */}
      <RaceCommandStrip
        race={race}
        lockCountdown={lockCountdown}
        stateTone={stateTone}
        aiInsight={aiTargetsRace ? aiInsight : null}
        isMobile={isMobile}
        tab={tab}
        setTab={setTab}
        selectedLeague={selectedLeague}
        roundSummary={roundSummary}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isTablet ? "1fr" : "290px minmax(0,1fr)",
          gap: isTablet ? 16 : 20,
          alignItems: "start",
        }}
      >
        {/* ── Left column ──────────────────────────────────── */}
        {isTablet ? (
          /* Tablet: horizontal round scroller */
          <section style={{ position: "relative" }}>
            <div
              style={{
                display: "grid",
                gridAutoFlow: "column",
                gridAutoColumns: isMobile ? "minmax(190px,1fr)" : "minmax(210px,1fr)",
                gap: isMobile ? 8 : 10,
                overflowX: "auto",
                paddingBottom: 4,
                paddingRight: 48,
                scrollSnapType: "x mandatory",
                scrollbarWidth: "none",
              }}
            >
              {calendar.map((item) => {
                const isActive = race.r === item.r;
                return (
                  <div key={item.r} ref={isActive ? activeRoundRef : null} style={{ scrollSnapAlign: "start" }}>
                    <RoundSidebarItem
                      item={item}
                      active={isActive}
                      status={roundSidebarStatus(
                        item,
                        liveRaces[item.r] || null,
                        resultsByRound[item.r] || null,
                        now,
                        roundSummariesByRound[item.r] || null
                      )}
                      onClick={() => selectRace(item)}
                    />
                  </div>
                );
              })}
            </div>
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 4,
                width: 56,
                background: `linear-gradient(to right, transparent, ${BG_BASE})`,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          </section>
        ) : (
          /* Desktop: unified left panel (race card + rail + AI) */
          <aside
            style={{
              position: "sticky",
              top: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxHeight: "calc(100vh - 44px)",
              overflow: "hidden",
            }}
          >
            {/* Round rail — compact, scrollable. The race header has been
                 promoted to a page-wide module above the grid, so the sidebar
                 is now purely navigational. */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                borderRadius: CARD_RADIUS,
                background: PANEL_BG,
                border: `1px solid ${HAIRLINE}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 12px 6px",
                  borderBottom: `1px solid ${HAIRLINE}`,
                  background: PANEL_BG_ALT,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: SUBTLE_TEXT,
                  }}
                >
                  2026 Season
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  scrollbarWidth: "none",
                  padding: "4px 0",
                }}
              >
                {calendar.map((item) => {
                  const isActive = race.r === item.r;
                  return (
                    <div key={item.r} ref={isActive ? activeRoundRef : null}>
                      <RoundRailItem
                        item={item}
                        active={isActive}
                        status={roundSidebarStatus(
                          item,
                          liveRaces[item.r] || null,
                          resultsByRound[item.r] || null,
                          now,
                          roundSummariesByRound[item.r] || null
                        )}
                        onClick={() => selectRace(item)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI compact strip (desktop only) */}
            {aiPredictions.length > 0 && (
              <AiCompactPanel
                aiPredictions={aiPredictions}
                isPro={isProSubscriber}
                picks={picks}
                openAuth={openAuth}
              />
            )}
          </aside>
        )}

        {/* ── Right column / main ──────────────────────────── */}
        <main style={{ minHeight: "60vh", display: "grid", gap: 14, alignContent: "start" }}>

          {/* League context row */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                scrollbarWidth: "none",
                paddingRight: 48,
                paddingBottom: 2,
              }}
            >
              {roundSummary.entries.map((entry) => {
                const isActive = entry.league.id === selectedLeague?.id;
                const tone = leagueCardTone({
                  ready: entry.ready,
                  progress: entry.progress,
                  locked: editingLocked,
                  scored: reviewReady && entry.league.id === selectedLeague?.id,
                  blocked: entry.blocked,
                });
                return (
                  <button
                    key={entry.league.id}
                    onClick={() => selectLeagueContext(entry.league.id)}
                    className="stint-pressable"
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      height: 34,
                      padding: "0 13px",
                      borderRadius: 999,
                      cursor: "pointer",
                      border: isActive
                        ? `1px solid ${hexToRgba(tone.accent, 0.44)}`
                        : `1px solid ${HAIRLINE}`,
                      background: isActive ? hexToRgba(tone.accent, 0.12) : "transparent",
                      color: isActive ? TEXT_PRIMARY : MUTED_TEXT,
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    <span style={{ whiteSpace: "nowrap" }}>{entry.league.name}</span>
                    {entry.blocked && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--brand)",
                          background: "rgba(249,115,22,0.12)",
                          borderRadius: 999,
                          padding: "2px 7px",
                          flexShrink: 0,
                        }}
                      >
                        Pro
                      </span>
                    )}
                    {entry.progress.total > 0 && (
                      <span
                        style={{
                          minWidth: 20,
                          height: 16,
                          borderRadius: 999,
                          padding: "0 5px",
                          background: entry.progress.isComplete
                            ? "rgba(34,197,94,0.2)"
                            : isActive
                              ? hexToRgba(tone.accent, 0.2)
                              : "var(--btn-secondary-bg)",
                          color: entry.progress.isComplete ? SUCCESS : tone.accent,
                          fontSize: 10,
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {entry.progress.filled}/{entry.progress.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 2,
                width: 56,
                background: `linear-gradient(to right, transparent, ${BG_BASE})`,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          </div>

          {/* AI Intelligence Panel — tablet + mobile only (desktop: left sidebar) */}
          {(isMobile || isTablet) && aiPredictions.length > 0 && (
            <AiIntelligencePanel
              aiPredictions={aiPredictions}
              isPro={isProSubscriber}
              isMobile={isMobile}
              picks={picks}
              race={race}
              openAuth={openAuth}
            />
          )}

          {/* Review Panel */}
          {(reviewReady || editingLocked) && (
            <RoundReviewPanel
              reviewReady={reviewReady}
              isMobile={isMobile}
              selectedLeague={selectedLeague}
              selectedLeagueSubmission={selectedLeagueSubmission}
              savedPickCount={savedPickCount}
              displayReviewScore={displayReviewScore}
              race={race}
              hits={hits}
              tab={tab}
              misses={misses}
              podiumBonus={podiumBonus}
              reviewRows={reviewRows}
              summaryRows={summaryRows}
              raceHasPassed={raceHasPassed}
            />
          )}

          {/* Status banners */}
          {!showReviewOnly && editingLocked && (
            <div
              style={{
                padding: "13px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderRadius: CARD_RADIUS,
                background: resultsEntered ? SUCCESS_BG : raceHasPassed ? "rgba(59,130,246,0.06)" : WARN_BG,
                border: `1px solid ${resultsEntered ? SUCCESS_BORDER : raceHasPassed ? "rgba(59,130,246,0.18)" : WARN_BORDER}`,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: resultsEntered ? "#22c55e" : raceHasPassed ? "#3b82f6" : "#fcd34d",
                  boxShadow: `0 0 10px ${resultsEntered ? "rgba(34,197,94,0.5)" : raceHasPassed ? "rgba(59,130,246,0.5)" : "rgba(252,211,77,0.5)"}`,
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: resultsEntered ? SUCCESS_TEXT : raceHasPassed ? "#93c5fd" : WARN_TEXT,
                    lineHeight: 1.2,
                  }}
                >
                  {resultsEntered ? "Picks scored" : raceHasPassed ? "Awaiting results" : "Picks locked"}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: resultsEntered ? "rgba(134,239,172,0.6)" : raceHasPassed ? "rgba(147,197,253,0.55)" : "rgba(252,211,77,0.55)",
                    marginTop: 2,
                    lineHeight: 1.4,
                  }}
                >
                  {resultsEntered
                    ? "Results are in. Check your score below."
                    : raceHasPassed
                      ? "Race weekend ended. Scores coming soon."
                      : lockLabel
                        ? `Locked at ${lockLabel}`
                        : "No more changes accepted."}
                </div>
              </div>
            </div>
          )}

          {!showReviewOnly && selectedLeagueBlocked && (
            <div
              style={{
                borderRadius: CARD_RADIUS,
                border: "1px solid rgba(249,115,22,0.2)",
                background: "rgba(249,115,22,0.06)",
                padding: "16px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--brand)",
                    marginBottom: 5,
                  }}
                >
                  Pro league
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: MUTED_TEXT }}>
                  Making picks in this league requires a Pro membership.
                </div>
              </div>
              <button
                onClick={() => (openAuth ? openAuth("register") : null)}
                style={{
                  minHeight: 40,
                  padding: "0 18px",
                  borderRadius: 999,
                  border: "none",
                  background: "linear-gradient(135deg,#F97316,#EA580C)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  flexShrink: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Unlock Pro
              </button>
            </div>
          )}

          {/* ── Two-column pick workspace ─────────────────── */}
          {!showReviewOnly && (
            <div
              ref={boardRef}
              style={{
                display: "grid",
                gridTemplateColumns: !isMobile && !isTablet ? "240px minmax(0,1fr)" : "1fr",
                gap: 14,
                alignItems: "start",
                scrollMarginTop: 96,
              }}
            >
              {/* Pick Navigator — desktop only */}
              {!isMobile && !isTablet && (
                <PickNavigatorPanel
                  promptSections={promptSections}
                  allPrompts={allPrompts}
                  picks={picks}
                  activePromptKey={activePromptKey}
                  aiByKey={aiByKey}
                  onSelect={focusPrompt}
                  selectedLeague={selectedLeague}
                  budgetAmounts={budgetAmounts}
                  doubleDownKey={doubleDownKey}
                />
              )}

              {/* Pick Focus panel */}
              <section
                style={{
                  borderRadius: SECTION_RADIUS,
                  background: PANEL_BG,
                  boxShadow: SOFT_SHADOW,
                  overflow: "hidden",
                }}
              >
                {/* Thin progress scrub at top */}
                <div style={{ height: 2, background: "var(--btn-secondary-bg)" }}>
                  <div
                    style={{
                      height: "100%",
                      width: totalPrompts > 0
                        ? `${Math.round(((activeIndex + 1) / totalPrompts) * 100)}%`
                        : "0%",
                      background: `linear-gradient(90deg, ${ACCENT}, #FBBF24)`,
                      transition: "width 300ms ease",
                    }}
                  />
                </div>

                {/* Section strip — tablet + mobile only */}
                {(isMobile || isTablet) && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderBottom: `1px solid ${HAIRLINE}`,
                      background: PANEL_BG_ALT,
                      display: "flex",
                      gap: 5,
                      overflowX: "auto",
                      scrollbarWidth: "none",
                    }}
                  >
                    {promptSections.map((section) => {
                      const sectionDone = section.prompts.filter((p) => !!picks[p.key]).length;
                      const sectionComplete = sectionDone === section.prompts.length;
                      const isActive = section.title === activeSection?.title;
                      return (
                        <button
                          key={section.title}
                          onClick={() => focusSection(section.title)}
                          className="stint-pressable"
                          style={{
                            flexShrink: 0,
                            minHeight: 32,
                            padding: "0 11px",
                            borderRadius: 999,
                            border: isActive
                              ? `1px solid ${hexToRgba(ACCENT, 0.32)}`
                              : sectionComplete
                                ? `1px solid ${hexToRgba(SUCCESS, 0.24)}`
                                : `1px solid ${HAIRLINE}`,
                            background: isActive
                              ? hexToRgba(ACCENT, 0.1)
                              : sectionComplete
                                ? hexToRgba(SUCCESS, 0.06)
                                : "transparent",
                            color: isActive ? TEXT_PRIMARY : sectionComplete ? SUCCESS : MUTED_TEXT,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            transition: "border-color 140ms ease, background 140ms ease, color 140ms ease",
                          }}
                        >
                          {section.title.split(" ")[0]}
                          <span
                            style={{
                              fontSize: 10,
                              color: sectionComplete ? SUCCESS : isActive ? ACCENT : SUBTLE_TEXT,
                              fontWeight: 800,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {sectionDone}/{section.prompts.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Focus header */}
                <div
                  key={`header-${activePromptKey}`}
                  className="stint-focus-enter"
                  style={{
                    padding: isMobile ? "20px 16px 18px" : "24px 26px 20px",
                    borderBottom: `1px solid ${HAIRLINE}`,
                    background: currentMeta
                      ? `linear-gradient(180deg, ${hexToRgba(currentMeta.accent, 0.06)} 0%, rgba(14,25,41,0.99) 100%)`
                      : "linear-gradient(180deg, rgba(21,35,56,0.98), rgba(14,25,41,0.99))",
                    display: "grid",
                    gap: 18,
                  }}
                >
                  {/* Eyebrow */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: SUBTLE_TEXT,
                      }}
                    >
                      {activeSection?.title}
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        width: 3,
                        height: 3,
                        borderRadius: "50%",
                        background: "rgba(214,223,239,0.2)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        color: "var(--brand)",
                      }}
                    >
                      {activePrompt?.pts || 0} pts
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        fontWeight: 700,
                        color: SUBTLE_TEXT,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {activeIndex + 1} / {totalPrompts}
                    </span>
                  </div>

                  {/* Category headline */}
                  <div>
                    <div
                      style={{
                        fontSize: isMobile ? 28 : 38,
                        fontWeight: 900,
                        letterSpacing: "-0.04em",
                        lineHeight: 0.97,
                        color: TEXT_PRIMARY,
                        marginBottom: 10,
                      }}
                    >
                      {activePrompt?.label}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: MUTED_TEXT, maxWidth: 600 }}>
                      {activePrompt?.hint}
                    </div>
                  </div>

                  {/* Selection declaration */}
                  <div>
                    {currentMeta ? (
                      <div
                        style={{
                          position: "relative",
                          borderRadius: RADIUS_MD,
                          background: hexToRgba(currentMeta.accent, 0.1),
                          border: `1.5px solid ${hexToRgba(currentMeta.accent, 0.38)}`,
                          minHeight: 40,
                          padding: !interactionLocked ? "8px 38px 8px 13px" : "8px 13px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: TEXT_PRIMARY,
                            letterSpacing: "-0.02em",
                            lineHeight: 1.2,
                          }}
                        >
                          {currentMeta.label}
                        </div>
                        {currentMeta.secondary && (
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: currentMeta.accent,
                              marginTop: 2,
                              opacity: 0.85,
                            }}
                          >
                            {currentMeta.secondary}
                          </div>
                        )}
                        {!interactionLocked && (
                          <button
                            onClick={() => setPick(activePromptKey, null)}
                            title="Clear pick"
                            style={{
                              position: "absolute",
                              top: "50%",
                              right: 10,
                              transform: "translateY(-50%)",
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              border: "1px solid rgba(214,223,239,0.12)",
                              background: "var(--btn-secondary-bg)",
                              color: SUBTLE_TEXT,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              padding: 0,
                            }}
                          >
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          minHeight: 40,
                          borderRadius: RADIUS_MD,
                          border: "1px dashed rgba(214,223,239,0.1)",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 13px",
                        }}
                      >
                        <span style={{ fontSize: 12, color: SUBTLE_TEXT, fontWeight: 500 }}>
                          {emptySelectionLabel(activePrompt, aiByKey)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Nav row */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                      flexWrap: isMobile ? "wrap" : "nowrap",
                    }}
                  >
                    <button
                      onClick={() => previousPrompt && setActivePromptKey(previousPrompt.key)}
                      disabled={!previousPrompt}
                      className="stint-pressable"
                      style={{
                        minHeight: isMobile ? 44 : 36,
                        flex: isMobile ? 1 : undefined,
                        padding: "0 16px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "transparent",
                        color: previousPrompt ? TEXT_PRIMARY : SUBTLE_TEXT,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: previousPrompt ? "pointer" : "default",
                      }}
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => nextPromptItem && setActivePromptKey(nextPromptItem.key)}
                      disabled={!nextPromptItem}
                      className="stint-pressable"
                      style={{
                        minHeight: isMobile ? 44 : 36,
                        flex: isMobile ? 1 : undefined,
                        padding: "0 16px",
                        borderRadius: 999,
                        border: nextPromptItem
                          ? `1px solid ${hexToRgba(ACCENT, 0.28)}`
                          : "1px solid rgba(255,255,255,0.1)",
                        background: nextPromptItem ? hexToRgba(ACCENT, 0.07) : "transparent",
                        color: nextPromptItem ? ACCENT : SUBTLE_TEXT,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: nextPromptItem ? "pointer" : "default",
                      }}
                    >
                      Next →
                    </button>
                  </div>

                  {/* AI insight */}
                  {activeAi && (
                    <div
                      style={{
                        paddingTop: 12,
                        borderTop: "1px solid rgba(96,165,250,0.08)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#60A5FA" }}>
                          AI Insight
                        </span>
                        {(() => {
                          const conf = (typeof activeAi.confidence === "string" ? activeAi.confidence.toLowerCase() : "medium") || "medium";
                          const confColor = AI_CONF_COLOR[conf] || "#fde68a";
                          return (
                            <span style={{ fontSize: 10, fontWeight: 700, color: confColor, fontVariantNumeric: "tabular-nums" }}>
                              {confPct(activeAi.key, activeAi.pick, activeAi.confidence)}%
                            </span>
                          );
                        })()}
                        {!isProSubscriber && (
                          <span style={{
                            fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                            color: "var(--brand)", background: hexToRgba(ACCENT, 0.1), borderRadius: 4, padding: "1px 5px",
                            border: `1px solid ${hexToRgba(ACCENT, 0.22)}`,
                          }}>Pro</span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          lineHeight: 1.55,
                          color: "rgba(147,197,253,0.75)",
                          fontWeight: 500,
                          display: "block",
                        }}
                      >
                        {isProSubscriber
                          ? `${activeAi.pick}. ${previewText(activeAi.reason, 140)}`
                          : `${activeAi.pick}. ${previewText(activeAi.reason, 60)}\u2026 Unlock with Pro.`}
                      </span>
                    </div>
                  )}
                  {!activeAi && !aiInsightError && aiInsightStale && currentRace && race.r === currentRace.r && (
                    <div style={{ fontSize: 11.5, lineHeight: 1.55, color: "#fca5a5", maxWidth: 760 }}>
                      AI brief out of date for {currentRace.n}. Regenerate from Admin to restore suggestions.
                    </div>
                  )}
                  {aiInsightError && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11.5,
                        color: "#fca5a5",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>AI brief unavailable.</span>
                      <button
                        onClick={loadAiInsight}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#93c5fd",
                          cursor: "pointer",
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: 0,
                          textDecoration: "underline",
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                {/* Options area */}
                <div key={`options-${activePromptKey}`} className="stint-focus-enter" style={{ padding: isMobile ? 14 : 20, display: "grid", gap: 14 }}>
                  {/* Double Down controls */}
                  {selectedLeague?.gameMode === "double_down" && (
                    <div
                      style={{
                        borderRadius: CARD_RADIUS,
                        border: "1px solid rgba(249,115,22,0.18)",
                        background: "rgba(249,115,22,0.06)",
                        padding: "14px 15px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--brand)",
                          marginBottom: 8,
                        }}
                      >
                        Double Down
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: MUTED_TEXT, marginBottom: 12 }}>
                        Pick one category to score 3× if you get it right. Miss it and that slot scores −1 instead.
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {allPrompts.filter((prompt) => picks[prompt.key]).map((prompt) => (
                          <button
                            key={`dd-${prompt.key}`}
                            onClick={() => toggleDoubleDown(prompt.key)}
                            style={{
                              minHeight: 34,
                              padding: "0 12px",
                              borderRadius: 999,
                              border:
                                doubleDownKey === prompt.key
                                  ? "1px solid rgba(249,115,22,0.38)"
                                  : "1px solid rgba(255,255,255,0.08)",
                              background:
                                doubleDownKey === prompt.key ? "rgba(249,115,22,0.16)" : BG_BASE,
                              color: doubleDownKey === prompt.key ? ACCENT : TEXT_PRIMARY,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: interactionLocked ? "default" : "pointer",
                            }}
                            disabled={interactionLocked}
                          >
                            {doubleDownKey === prompt.key ? "3x " : ""}
                            {prompt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Budget Picks controls */}
                  {selectedLeague?.gameMode === "budget_picks" && (
                    <div
                      style={{
                        borderRadius: CARD_RADIUS,
                        border: "1px solid rgba(249,115,22,0.18)",
                        background: "rgba(249,115,22,0.06)",
                        padding: "14px 15px",
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "var(--brand)",
                            marginBottom: 8,
                          }}
                        >
                          Budget Picks
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: MUTED_TEXT }}>
                          Spread exactly 50 credits across the categories you believe in most. Every selected category needs between 1 and 20 credits.
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              borderRadius: 999,
                              padding: "6px 12px",
                              background: BG_BASE,
                              border: `1px solid ${budgetTotal === 50 ? hexToRgba(SUCCESS, 0.3) : "var(--btn-secondary-bg)"}`,
                              color: budgetTotal === 50 ? SUCCESS : ACCENT,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {budgetTotal}/50
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>credits</span>
                          </div>
                          {!picks[activePrompt?.key] && (
                            <span style={{ fontSize: 12, color: SUBTLE_TEXT }}>
                              Pick this category first.
                            </span>
                          )}
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <button
                            onClick={() => adjustBudgetAmount(activePrompt?.key, -1)}
                            disabled={interactionLocked || !picks[activePrompt?.key]}
                            className="stint-pressable"
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 999,
                              border: `1px solid rgba(255,255,255,${picks[activePrompt?.key] ? "0.12" : "0.06"})`,
                              background: BG_BASE,
                              color: picks[activePrompt?.key] ? TEXT_PRIMARY : SUBTLE_TEXT,
                              cursor: interactionLocked || !picks[activePrompt?.key] ? "default" : "pointer",
                              fontSize: 20,
                              fontWeight: 300,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: picks[activePrompt?.key] ? 1 : 0.45,
                            }}
                          >
                            –
                          </button>
                          <span
                            style={{
                              minWidth: 44,
                              textAlign: "center",
                              fontSize: 16,
                              fontWeight: 800,
                              color: activeBudgetAmount > 0 ? TEXT_PRIMARY : SUBTLE_TEXT,
                              fontVariantNumeric: "tabular-nums",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {activeBudgetAmount}
                          </span>
                          <button
                            onClick={() => adjustBudgetAmount(activePrompt?.key, 1)}
                            disabled={interactionLocked || !picks[activePrompt?.key]}
                            className="stint-pressable"
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 999,
                              border: `1px solid rgba(255,255,255,${picks[activePrompt?.key] ? "0.12" : "0.06"})`,
                              background: BG_BASE,
                              color: picks[activePrompt?.key] ? TEXT_PRIMARY : SUBTLE_TEXT,
                              cursor: interactionLocked || !picks[activePrompt?.key] ? "default" : "pointer",
                              fontSize: 20,
                              fontWeight: 300,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: picks[activePrompt?.key] ? 1 : 0.45,
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Driver options */}
                  {activePrompt?.type === "driver" && (
                    <div style={{ display: "grid", gridTemplateColumns: optionGrid, gap: 10 }}>
                      {driverOptions.map((driver) => (
                        <DriverOption
                          key={`${activePrompt.key}-${driver.n}`}
                          driver={driver}
                          selected={picks[activePrompt.key] === driver.n}
                          aiMatch={predictionMatches(activePrompt, activeAi, driver.n)}
                          disabled={interactionLocked}
                          onClick={() =>
                            setPick(
                              activePrompt.key,
                              picks[activePrompt.key] === driver.n ? null : driver.n
                            )
                          }
                        />
                      ))}
                    </div>
                  )}

                  {/* Constructor options */}
                  {activePrompt?.type === "constructor" && (
                    <div style={{ display: "grid", gridTemplateColumns: optionGrid, gap: 10 }}>
                      {constructorOptions.map((teamName) => (
                        <ConstructorOption
                          key={`${activePrompt.key}-${teamName}`}
                          teamName={teamName}
                          selected={picks[activePrompt.key] === teamName}
                          aiMatch={predictionMatches(activePrompt, activeAi, teamName)}
                          disabled={interactionLocked}
                          onClick={() =>
                            setPick(
                              activePrompt.key,
                              picks[activePrompt.key] === teamName ? null : teamName
                            )
                          }
                        />
                      ))}
                    </div>
                  )}

                  {/* Binary options */}
                  {activePrompt?.type === "binary" && (
                    <div style={{ display: "grid", gridTemplateColumns: optionGrid, gap: 10 }}>
                      <BinaryOption
                        label="Yes"
                        detail={
                          activePrompt.key === "sc"
                            ? "Race likely interrupted by at least one safety car."
                            : "A stoppage feels likely this weekend."
                        }
                        color={SUCCESS}
                        selected={picks[activePrompt.key] === "Yes"}
                        aiMatch={predictionMatches(activePrompt, activeAi, "Yes")}
                        disabled={interactionLocked}
                        onClick={() =>
                          setPick(
                            activePrompt.key,
                            picks[activePrompt.key] === "Yes" ? null : "Yes"
                          )
                        }
                      />
                      <BinaryOption
                        label="No"
                        detail={
                          activePrompt.key === "sc"
                            ? "Clean race without a safety car period."
                            : "No stoppage expected during the session."
                        }
                        color="#EF4444"
                        selected={picks[activePrompt.key] === "No"}
                        aiMatch={predictionMatches(activePrompt, activeAi, "No")}
                        disabled={interactionLocked}
                        onClick={() =>
                          setPick(
                            activePrompt.key,
                            picks[activePrompt.key] === "No" ? null : "No"
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Partial save warning */}
          {showPartialWarning && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: CARD_RADIUS,
                background: WARN_BG,
                border: `1px solid ${WARN_BORDER}`,
                display: "grid",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: WARN_TEXT, marginBottom: 3, lineHeight: 1.3 }}>
                  Board incomplete
                </div>
                <div style={{ fontSize: 12, color: "rgba(252,211,77,0.6)", lineHeight: 1.4 }}>
                  {done}/{totalPrompts} picks filled in {selectedLeague?.name || "this league"}. You can save now or go back to complete it.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setShowPartialWarning(false);
                    const firstEmpty = allPrompts.find((p) => !picks[p.key]);
                    if (firstEmpty) setActivePromptKey(firstEmpty.key);
                    boardRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="stint-pressable"
                  style={{
                    minHeight: 36,
                    border: `1px solid ${WARN_BORDER}`,
                    borderRadius: 999,
                    background: "transparent",
                    color: WARN_TEXT,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 12,
                    padding: "0 14px",
                  }}
                >
                  Complete board
                </button>
                <button
                  onClick={save}
                  className="stint-pressable"
                  style={{
                    minHeight: 36,
                    border: "none",
                    borderRadius: 999,
                    background: WARN_BORDER,
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 12,
                    padding: "0 14px",
                  }}
                >
                  Save anyway
                </button>
              </div>
            </div>
          )}

          {/* Board Command Bar — sticky pick dots + save */}
          {!showReviewOnly && (
            <BoardCommandBar
              allPrompts={allPrompts}
              picks={picks}
              activePromptKey={activePromptKey}
              onSelectPrompt={focusPrompt}
              done={done}
              totalPrompts={totalPrompts}
              saveLabel={saveLabel}
              save={save}
              isSaving={isSaving}
              editingLocked={editingLocked}
              demoPreview={demoPreview}
              selectedLeagueBlocked={selectedLeagueBlocked}
              saved={saved}
              savePop={savePop}
              reviewReady={reviewReady}
              resultsEntered={resultsEntered}
              isMobile={isMobile}
              selectedLeague={selectedLeague}
            />
          )}
        </main>
      </div>
    </div>
  );
}
