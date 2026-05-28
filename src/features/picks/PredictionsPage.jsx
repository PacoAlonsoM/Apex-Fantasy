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
  CARD_SHADOW,
  CONTENT_MAX,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  RADIUS_MD,
  RADIUS_PILL,
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
  rgbaFromHex,
} from "@/src/constants/design";
import useReveal from "@/src/lib/useReveal";
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
      className="stint-pressable picks-sidebar-item"
      data-active={active ? "true" : "false"}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "44px minmax(0,1fr)",
        gap: 12,
        alignItems: "center",
        borderRadius: CARD_RADIUS,
        background: active ? hexToRgba(status.accent, 0.18) : inactiveBackground,
        padding: "12px 14px",
        textAlign: "left",
        cursor: "pointer",
        border: active
          ? `1px solid ${hexToRgba(status.accent, 0.44)}`
          : `1px solid ${inactiveRing}`,
        boxShadow: active
          ? `0 0 0 1px ${hexToRgba(status.accent, 0.14)}, 0 18px 36px ${hexToRgba(status.accent, 0.14)}`
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
            fontFamily: "Sora, sans-serif",
            fontSize: 14,
            fontWeight: active ? 800 : 700,
            letterSpacing: "-0.025em",
            color: closed && !active ? MUTED_TEXT : TEXT_PRIMARY,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 4,
            lineHeight: 1.15,
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
              boxShadow: `0 0 10px ${hexToRgba(status.accent, 0.32)}`,
            }}
          />
          <span style={{ fontSize: 12, color: status.text, fontFamily: "Manrope, sans-serif" }}>{fmt(item.date)}</span>
          {status.badge && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: status.accent,
                background: hexToRgba(status.accent, 0.12),
                border: `1px solid ${hexToRgba(status.accent, 0.28)}`,
                padding: "3px 7px",
                borderRadius: RADIUS_PILL,
                fontFamily: "Manrope, sans-serif",
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
  const interactive = !disabled;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => interactive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      className="stint-option-press picks-driver-card"
      data-selected={selected ? "true" : "false"}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        minHeight: 70,
        border: `1px solid ${selected ? hexToRgba(team.c, 0.55) : hovered ? hexToRgba(team.c, 0.28) : HAIRLINE}`,
        borderRadius: CARD_RADIUS,
        background: selected
          ? `linear-gradient(135deg, ${hexToRgba(team.c, 0.22)} 0%, ${hexToRgba(team.c, 0.06)} 60%, ${PANEL_BG_ALT} 100%)`
          : hovered
            ? `linear-gradient(135deg, ${hexToRgba(team.c, 0.10)} 0%, ${hexToRgba(team.c, 0.02)} 60%, ${BG_BASE} 100%)`
            : BG_BASE,
        boxShadow: selected
          ? `0 10px 26px ${hexToRgba(team.c, 0.22)}, inset 0 1px 0 rgba(255,255,255,0.04)`
          : hovered
            ? `0 4px 14px ${hexToRgba(team.c, 0.14)}`
            : "none",
        padding: "12px 14px 12px 16px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.55 : 1,
        transition: "border-color 200ms cubic-bezier(0.16,1,0.3,1), background 200ms ease, box-shadow 220ms ease, transform 180ms cubic-bezier(0.23,1,0.32,1)",
        transform: hovered && interactive ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {/* Left team-tone rail */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: team.c,
        opacity: selected ? 0.95 : hovered ? 0.55 : 0.30,
        transition: "opacity 200ms ease",
      }} />

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto",
        gap: 12,
        alignItems: "center",
      }}>
        {/* Name + team + number */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 15,
            fontWeight: 900,
            color: TEXT_PRIMARY,
            lineHeight: 1.16,
            letterSpacing: "-0.025em",
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-display)",
          }}>{driver.n}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "nowrap", overflow: "hidden" }}>
            {driver.nb && (
              <span style={{
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: selected ? team.c : SUBTLE_TEXT,
                opacity: selected ? 1 : 0.78,
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}>#{driver.nb}</span>
            )}
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: selected ? team.c : SUBTLE_TEXT,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}>{driver.t}</span>
          </div>
        </div>

        {/* Right: AI match pill OR animated check ring */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          {!selected && aiMatch && (
            <span title="AI pick" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 8px 3px 6px",
              borderRadius: RADIUS_PILL,
              background: "rgba(96,165,250,0.14)",
              border: "1px solid rgba(96,165,250,0.32)",
            }}>
              <span aria-hidden="true" style={{
                width: 5, height: 5, borderRadius: "50%", background: "#60A5FA",
                boxShadow: "0 0 6px rgba(96,165,250,0.62)",
              }} />
              <span style={{
                fontSize: 9, fontWeight: 900,
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: "#93c5fd",
              }}>AI</span>
            </span>
          )}
          {selected && (
            <div className="picks-check-pop" style={{
              width: 28, height: 28, borderRadius: "50%",
              background: team.c,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: aiMatch
                ? `0 0 18px ${hexToRgba(team.c, 0.62)}, 0 0 0 3px rgba(96,165,250,0.32), inset 0 1px 0 rgba(255,255,255,0.24)`
                : `0 0 18px ${hexToRgba(team.c, 0.62)}, inset 0 1px 0 rgba(255,255,255,0.24)`,
              flexShrink: 0,
            }}>
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                <path d="M1.5 5L4.5 8L10.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
  const interactive = !disabled;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => interactive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      className="stint-option-press picks-constructor-card"
      data-selected={selected ? "true" : "false"}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        minHeight: 80,
        border: `1px solid ${selected ? hexToRgba(team.c, 0.55) : hovered ? hexToRgba(team.c, 0.28) : HAIRLINE}`,
        borderRadius: CARD_RADIUS,
        background: selected
          ? `linear-gradient(135deg, ${hexToRgba(team.c, 0.24)} 0%, ${hexToRgba(team.c, 0.06)} 60%, ${PANEL_BG_ALT} 100%)`
          : hovered
            ? `linear-gradient(135deg, ${hexToRgba(team.c, 0.10)} 0%, ${hexToRgba(team.c, 0.02)} 60%, ${BG_BASE} 100%)`
            : BG_BASE,
        boxShadow: selected
          ? `0 10px 26px ${hexToRgba(team.c, 0.24)}, inset 0 1px 0 rgba(255,255,255,0.04)`
          : hovered
            ? `0 4px 14px ${hexToRgba(team.c, 0.14)}`
            : "none",
        padding: "14px 14px 14px 18px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.55 : 1,
        transition: "border-color 200ms cubic-bezier(0.16,1,0.3,1), background 200ms ease, box-shadow 220ms ease, transform 180ms cubic-bezier(0.23,1,0.32,1)",
        transform: hovered && interactive ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {/* Left team-tone rail (thicker on constructor) */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 4,
        background: team.c,
        opacity: selected ? 0.95 : hovered ? 0.55 : 0.30,
        transition: "opacity 200ms ease",
      }} />

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 17,
            fontWeight: 900,
            color: TEXT_PRIMARY,
            lineHeight: 1.12,
            letterSpacing: "-0.028em",
            marginBottom: 5,
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>{teamName}</div>
          <div style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: selected ? hexToRgba(team.c, 0.92) : SUBTLE_TEXT,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>{teammates || "Lineup pending"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          {!selected && aiMatch && (
            <span title="AI pick" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 8px 3px 6px",
              borderRadius: RADIUS_PILL,
              background: "rgba(96,165,250,0.14)",
              border: "1px solid rgba(96,165,250,0.32)",
            }}>
              <span aria-hidden="true" style={{
                width: 5, height: 5, borderRadius: "50%", background: "#60A5FA",
                boxShadow: "0 0 6px rgba(96,165,250,0.62)",
              }} />
              <span style={{
                fontSize: 9, fontWeight: 900,
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: "#93c5fd",
              }}>AI</span>
            </span>
          )}
          {selected && (
            <div className="picks-check-pop" style={{
              width: 28, height: 28, borderRadius: "50%",
              background: team.c,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: aiMatch
                ? `0 0 18px ${hexToRgba(team.c, 0.62)}, 0 0 0 3px rgba(96,165,250,0.32), inset 0 1px 0 rgba(255,255,255,0.24)`
                : `0 0 18px ${hexToRgba(team.c, 0.62)}, inset 0 1px 0 rgba(255,255,255,0.24)`,
              flexShrink: 0,
            }}>
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                <path d="M1.5 5L4.5 8L10.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function BinaryOption({ label, detail, color, selected, onClick, aiMatch = false, disabled = false }) {
  const [hovered, setHovered] = useState(false);
  const interactive = !disabled;
  const isYes = label === "Yes";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => interactive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      className="stint-option-press picks-binary-card"
      data-selected={selected ? "true" : "false"}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        minHeight: 116,
        border: `1px solid ${selected ? hexToRgba(color, 0.50) : hovered ? hexToRgba(color, 0.28) : HAIRLINE}`,
        borderRadius: CARD_RADIUS,
        background: selected
          ? `linear-gradient(160deg, ${hexToRgba(color, 0.24)} 0%, ${hexToRgba(color, 0.06)} 60%, ${PANEL_BG_ALT} 100%)`
          : hovered
            ? `linear-gradient(160deg, ${hexToRgba(color, 0.10)} 0%, ${hexToRgba(color, 0.02)} 60%, ${BG_BASE} 100%)`
            : BG_BASE,
        boxShadow: selected
          ? `0 12px 28px ${hexToRgba(color, 0.20)}, inset 0 1px 0 rgba(255,255,255,0.04)`
          : hovered
            ? `0 4px 14px ${hexToRgba(color, 0.14)}`
            : "none",
        padding: "18px 18px 18px 20px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.55 : 1,
        transition: "border-color 200ms cubic-bezier(0.16,1,0.3,1), background 200ms ease, box-shadow 220ms ease, transform 180ms cubic-bezier(0.23,1,0.32,1)",
        transform: hovered && interactive ? "translateY(-1px)" : "translateY(0)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Top tone rail spanning the full card top */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${color} 30%, ${color} 70%, transparent)`,
        opacity: selected ? 0.85 : hovered ? 0.40 : 0.18,
        transition: "opacity 200ms ease",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Big iconography ring */}
          <div className={selected ? "picks-check-pop" : undefined} style={{
            width: 44, height: 44, borderRadius: "50%",
            background: selected ? color : hexToRgba(color, 0.12),
            border: selected ? `2px solid ${color}` : `2px solid ${hexToRgba(color, 0.34)}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: selected
              ? aiMatch
                ? `0 0 20px ${hexToRgba(color, 0.55)}, 0 0 0 3px rgba(96,165,250,0.32), inset 0 1px 0 rgba(255,255,255,0.20)`
                : `0 0 20px ${hexToRgba(color, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.20)`
              : "none",
            flexShrink: 0,
            transition: "background 220ms ease, border-color 220ms ease, box-shadow 220ms ease",
          }}>
            {isYes ? (
              <svg width="16" height="13" viewBox="0 0 16 13" fill="none">
                <path d="M1.5 6.5L6 11L14.5 1.5" stroke={selected ? "white" : color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity={selected ? 1 : 0.7} />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke={selected ? "white" : color} strokeWidth="2.2" strokeLinecap="round" opacity={selected ? 1 : 0.7} />
              </svg>
            )}
          </div>
          <span style={{
            fontSize: 22,
            fontWeight: 900,
            color: selected ? TEXT_PRIMARY : MUTED_TEXT,
            letterSpacing: "-0.035em",
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            lineHeight: 1,
          }}>{label}</span>
        </div>
        {!selected && aiMatch && (
          <span title="AI pick" style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px 3px 7px",
            borderRadius: RADIUS_PILL,
            background: "rgba(96,165,250,0.14)",
            border: "1px solid rgba(96,165,250,0.32)",
            flexShrink: 0,
          }}>
            <span aria-hidden="true" style={{
              width: 5, height: 5, borderRadius: "50%", background: "#60A5FA",
              boxShadow: "0 0 6px rgba(96,165,250,0.62)",
            }} />
            <span style={{
              fontSize: 9, fontWeight: 900,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#93c5fd",
            }}>AI</span>
          </span>
        )}
      </div>
      <div style={{
        fontSize: 13,
        lineHeight: 1.55,
        color: selected ? "rgba(214,223,239,0.82)" : SUBTLE_TEXT,
        letterSpacing: "-0.005em",
        fontWeight: 500,
      }}>{detail}</div>
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

const AI_CAT_LABEL = {
  pole: "Pole", winner: "Winner", p2: "P2", p3: "P3",
  fl: "Fastest Lap", dotd: "Driver of the Day", dnf: "DNF",
  ctor: "Constructor", sc: "Safety Car", rf: "Red Flag",
};

function AiIntelligencePanel({ aiPredictions, isPro, isMobile, picks, race, openAuth }) {
  const visiblePicks = isPro ? aiPredictions : aiPredictions.slice(0, 2);
  const hiddenCount = aiPredictions.length - visiblePicks.length;
  const matchCount = visiblePicks.reduce((n, item) => n + (picks[item.key] === item.pick ? 1 : 0), 0);

  return (
    <section
      className="picks-ai-panel"
      style={{
        position: "relative",
        borderRadius: SECTION_RADIUS,
        border: isPro ? `1px solid ${rgbaFromHex(ACCENT, 0.24)}` : `1px solid ${HAIRLINE}`,
        background: isPro
          ? `radial-gradient(120% 100% at 0% 0%, ${rgbaFromHex(ACCENT, 0.10)} 0%, transparent 55%), linear-gradient(180deg, ${PANEL_BG_ALT} 0%, ${PANEL_BG} 100%)`
          : PANEL_BG,
        overflow: "hidden",
        boxShadow: isPro ? `0 14px 38px ${rgbaFromHex(ACCENT, 0.10)}` : SOFT_SHADOW,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 4,
          background: isPro
            ? `linear-gradient(180deg, ${ACCENT} 0%, ${rgbaFromHex(ACCENT, 0.35)} 100%)`
            : "rgba(148,163,184,0.18)",
          zIndex: 2,
        }}
      />

      {/* ── Header ────────────────────────────── */}
      <div
        style={{
          padding: isMobile ? "16px 18px 14px 22px" : "20px 24px 16px 26px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
          <span
            className="stint-kicker picks-ai-kicker"
            style={{
              display: "inline-flex",
              width: "fit-content",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: RADIUS_PILL,
              background: isPro ? rgbaFromHex(ACCENT, 0.12) : "rgba(148,163,184,0.10)",
              border: isPro ? `1px solid ${rgbaFromHex(ACCENT, 0.34)}` : `1px solid rgba(148,163,184,0.18)`,
              color: isPro ? ACCENT : SUBTLE_TEXT,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            <span
              aria-hidden="true"
              className="picks-ai-spark"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isPro ? ACCENT : "#94a3b8",
                boxShadow: isPro ? `0 0 0 4px ${rgbaFromHex(ACCENT, 0.18)}` : "none",
              }}
            />
            AI Pre-race Intel
          </span>
          <h2
            className="stint-section-title"
            style={{
              fontFamily: "Sora, sans-serif",
              fontSize: isMobile ? 20 : 24,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              color: TEXT_PRIMARY,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {isPro ? `Coach calls for ${race.n}` : "Coach calls"}
          </h2>
          <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.5, fontFamily: "Manrope, sans-serif" }}>
            {isPro
              ? matchCount > 0
                ? `You match the AI on ${matchCount} of ${visiblePicks.length}`
                : `${aiPredictions.length} category calls`
              : "Unlock all category calls with Pro"}
          </div>
        </div>
        {!isPro && (
          <button
            onClick={() => openAuth ? openAuth("register") : null}
            className="stint-pressable"
            style={{
              background: `linear-gradient(135deg, ${ACCENT} 0%, #e05a12 100%)`,
              border: "none",
              borderRadius: RADIUS_PILL,
              color: "#fff",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 900,
              padding: "9px 16px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              flexShrink: 0,
              boxShadow: `0 10px 24px ${rgbaFromHex(ACCENT, 0.32)}`,
              fontFamily: "Manrope, sans-serif",
            }}
          >
            Unlock Pro
          </button>
        )}
      </div>

      {/* ── Cards ────────────────────────────── */}
      <div style={{ padding: isMobile ? "14px" : "18px 22px" }}>
        <div
          className="picks-ai-grid"
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
            gap: 10,
          }}
        >
          {visiblePicks.map((item, idx) => {
            const conf = (typeof item.confidence === "string" ? item.confidence.toLowerCase() : String(item.confidence || "medium").toLowerCase()) || "medium";
            const confColor = AI_CONF_COLOR[conf] || "#fde68a";
            const confPercent = confPct(item.key, item.pick, item.confidence);
            const isSet = !!picks[item.key];
            const matchesPick = isSet && (picks[item.key] === item.pick);
            return (
              <div
                key={item.key}
                className="picks-ai-card"
                style={{
                  "--ai-i": idx,
                  position: "relative",
                  borderRadius: CARD_RADIUS,
                  border: matchesPick
                    ? `1px solid ${rgbaFromHex(SUCCESS, 0.40)}`
                    : `1px solid ${HAIRLINE}`,
                  background: matchesPick
                    ? `linear-gradient(160deg, ${rgbaFromHex(SUCCESS, 0.12)} 0%, ${PANEL_BG_ALT} 100%)`
                    : PANEL_BG_ALT,
                  padding: "14px 14px 12px",
                  display: "grid",
                  gap: 6,
                  overflow: "hidden",
                }}
              >
                {matchesPick && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: rgbaFromHex(SUCCESS, 0.22),
                      border: `1px solid ${rgbaFromHex(SUCCESS, 0.55)}`,
                      color: SUCCESS,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </span>
                )}
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: SUBTLE_TEXT,
                    fontFamily: "Manrope, sans-serif",
                  }}
                >
                  {AI_CAT_LABEL[item.key] || item.key}
                </div>
                <div
                  style={{
                    fontFamily: "Sora, sans-serif",
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: "-0.025em",
                    lineHeight: 1.15,
                    color: TEXT_PRIMARY,
                    paddingRight: matchesPick ? 22 : 0,
                  }}
                >
                  {item.pick}
                </div>
                {/* Confidence bar */}
                <div style={{ display: "grid", gap: 4, marginTop: 2 }}>
                  <div
                    style={{
                      position: "relative",
                      height: 4,
                      borderRadius: 999,
                      background: "rgba(148,163,184,0.14)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="picks-ai-conf-fill"
                      style={{
                        position: "absolute",
                        inset: "0 auto 0 0",
                        width: `${Math.min(100, Math.max(4, confPercent))}%`,
                        background: `linear-gradient(90deg, ${confColor} 0%, ${rgbaFromHex(confColor, 0.55)} 100%)`,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: confColor, letterSpacing: "0.04em", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                      {confPercent}%
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: SUBTLE_TEXT, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Manrope, sans-serif" }}>
                      {AI_CONF_LABEL[conf] || "Medium"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {!isPro && hiddenCount > 0 && (
            <button
              onClick={() => openAuth ? openAuth("register") : null}
              className="picks-ai-card stint-pressable"
              style={{
                "--ai-i": visiblePicks.length,
                borderRadius: CARD_RADIUS,
                border: `1px solid ${rgbaFromHex(ACCENT, 0.30)}`,
                background: `linear-gradient(160deg, ${rgbaFromHex(ACCENT, 0.10)} 0%, ${PANEL_BG_ALT} 100%)`,
                padding: "14px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 6,
                gridColumn: isMobile ? "span 2" : "span 2",
                cursor: "pointer",
                color: ACCENT,
                fontFamily: "Manrope, sans-serif",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900, color: ACCENT, fontFamily: "Sora, sans-serif", letterSpacing: "-0.03em" }}>+{hiddenCount} more</div>
              <div style={{ fontSize: 11, color: MUTED_TEXT, lineHeight: 1.4 }}>Unlock all calls with Pro</div>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function useCountUp(target, { duration = 900, enabled = true } = {}) {
  const [value, setValue] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return undefined;
    }
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || target <= 0) {
      setValue(target);
      return undefined;
    }
    const start = performance.now();
    const startVal = 0;
    let raf = 0;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(startVal + (target - startVal) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return value;
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

  const railColor = reviewReady ? scoreColor : "#60A5FA";
  const railRgba = reviewReady
    ? displayReviewScore >= 60
      ? "rgba(134,239,172,"
      : displayReviewScore >= 30
        ? "rgba(250,204,21,"
        : "rgba(248,113,113,"
    : "rgba(96,165,250,";

  const countedScore = useCountUp(displayReviewScore, { enabled: reviewReady, duration: 1100 });
  const countedHits = useCountUp(hits, { enabled: reviewReady, duration: 900 });
  const countedMisses = useCountUp(Math.max(misses, 0), { enabled: reviewReady, duration: 900 });

  const kickerLabel = reviewReady ? "Round review" : raceHasPassed ? "Awaiting results" : "Picks locked";
  const titleText = reviewReady
    ? `${race.n}`
    : hasSavedPickContent(selectedLeagueSubmission?.picks)
      ? `${selectedLeague?.name || "League"} board locked`
      : `${selectedLeague?.name || "League"} round`;
  const subText = reviewReady
    ? `${hits} correct · ${Math.max(misses, 0)} missed${tab === "sprint" ? " · Sprint" : ""}`
    : hasSavedPickContent(selectedLeagueSubmission?.picks)
      ? `${savedPickCount} pick${savedPickCount !== 1 ? "s" : ""} saved${raceHasPassed ? " · Results pending" : ""}`
      : "No saved board";

  return (
    <section
      className="stint-score-mount picks-review-mount"
      style={{
        position: "relative",
        borderRadius: SECTION_RADIUS,
        background: PANEL_BG,
        boxShadow: SOFT_SHADOW,
        overflow: "hidden",
        border: `1px solid ${railRgba}0.18)`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 4,
          background: `linear-gradient(180deg, ${railRgba}0.95) 0%, ${railRgba}0.35) 100%)`,
          zIndex: 2,
        }}
      />

      {/* ── Hero header ─────────────────────────────────── */}
      <div
        style={{
          padding: isMobile ? "22px 18px 20px 22px" : "26px 28px 22px 30px",
          borderBottom: `1px solid ${HAIRLINE}`,
          background: reviewReady
            ? `radial-gradient(120% 100% at 0% 0%, ${railRgba}0.13) 0%, transparent 55%), linear-gradient(180deg, ${PANEL_BG_ALT} 0%, ${PANEL_BG} 100%)`
            : `radial-gradient(120% 100% at 0% 0%, ${railRgba}0.10) 0%, transparent 55%), linear-gradient(180deg, ${PANEL_BG_ALT} 0%, ${PANEL_BG} 100%)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 8 }}>
          <span
            className="stint-kicker"
            style={{
              display: "inline-flex",
              width: "fit-content",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: RADIUS_PILL,
              background: `${railRgba}0.10)`,
              border: `1px solid ${railRgba}0.32)`,
              color: railColor,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {reviewReady ? (
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: railColor,
                  boxShadow: `0 0 0 4px ${railRgba}0.18)`,
                }}
              />
            ) : null}
            {kickerLabel}
          </span>

          {reviewReady ? (
            <div
              className="picks-review-score"
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginTop: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: isMobile ? 64 : 84,
                  fontWeight: 700,
                  letterSpacing: "-0.05em",
                  lineHeight: 0.9,
                  color: scoreColor,
                  fontVariantNumeric: "tabular-nums",
                  textShadow: `0 4px 36px ${railRgba}0.32)`,
                }}
              >
                {countedScore}
              </span>
              <span
                style={{
                  fontSize: isMobile ? 16 : 18,
                  fontWeight: 800,
                  color: MUTED_TEXT,
                  letterSpacing: "-0.02em",
                  paddingBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                pts
              </span>
            </div>
          ) : null}

          <h2
            className="stint-section-title picks-review-title"
            style={{
              fontFamily: "Sora, sans-serif",
              fontSize: isMobile ? 22 : 28,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              color: TEXT_PRIMARY,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {titleText}
          </h2>

          <div style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.55, fontFamily: "Manrope, sans-serif" }}>
            {subText}
          </div>

          {reviewReady && podiumBonus ? (
            <div
              className="picks-review-bonus"
              style={{
                display: "inline-flex",
                width: "fit-content",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                marginTop: 6,
                borderRadius: RADIUS_PILL,
                background: "linear-gradient(135deg, rgba(147,197,253,0.18) 0%, rgba(96,165,250,0.06) 100%)",
                border: "1px solid rgba(147,197,253,0.32)",
                color: "#bfdbfe",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.03em",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 14 }}>★</span>
              Perfect podium · +{podiumBonus.pts} pts
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Scored body ─────────────────────────────────── */}
      {reviewReady ? (
        <div style={{ padding: isMobile ? "18px 16px 22px" : "22px 26px 26px", display: "grid", gap: 18 }}>
          {/* Metric row */}
          <div
            className="picks-review-metrics"
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))",
              gap: 10,
            }}
          >
            <ReviewMetric label="Score" value={`${countedScore}`} detail="points" accent="#facc15" />
            <ReviewMetric label="Correct" value={String(countedHits)} detail={tab === "sprint" ? "Sprint" : "Race"} accent={SUCCESS} />
            <ReviewMetric label="Misses" value={String(countedMisses)} accent="#f87171" />
            <ReviewMetric
              label="Podium bonus"
              value={podiumBonus ? `+${podiumBonus.pts}` : "—"}
              detail={podiumBonus ? "Perfect podium" : null}
              accent={podiumBonus ? "#93c5fd" : SUBTLE_TEXT}
            />
          </div>

          {/* Section divider with kicker */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <span
              className="stint-kicker"
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: SUBTLE_TEXT,
                fontFamily: "Manrope, sans-serif",
              }}
            >
              Pick-by-pick
            </span>
            <span style={{ flex: 1, height: 1, background: HAIRLINE }} />
          </div>

          {/* Review table */}
          <div style={{ borderRadius: CARD_RADIUS, border: `1px solid ${HAIRLINE}`, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "28px minmax(0,1fr) 72px"
                  : "28px minmax(150px,1fr) minmax(140px,1fr) minmax(140px,1fr) 80px",
                background: PANEL_BG_ALT,
                borderBottom: `1px solid ${HAIRLINE}`,
              }}
            >
              <div />
              {(isMobile ? ["Category", "Pts"] : ["Category", "Your pick", "Result", "Pts"]).map((heading, i) => (
                <div
                  key={heading}
                  style={{
                    padding: "10px 14px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: SUBTLE_TEXT,
                    fontFamily: "Manrope, sans-serif",
                    textAlign: i === (isMobile ? 1 : 3) ? "right" : "left",
                  }}
                >
                  {heading}
                </div>
              ))}
            </div>
            {reviewRows.map((row, i) => {
              const rowTint = row.hit
                ? "rgba(34,197,94,0.06)"
                : row.pick
                  ? i % 2 === 0 ? PANEL_BG : PANEL_BG_ALT
                  : i % 2 === 0 ? PANEL_BG : PANEL_BG_ALT;
              return (
                <div
                  key={row.key}
                  className="picks-review-row"
                  style={{
                    "--row-i": i,
                    display: "grid",
                    gridTemplateColumns: isMobile
                      ? "28px minmax(0,1fr) 72px"
                      : "28px minmax(150px,1fr) minmax(140px,1fr) minmax(140px,1fr) 80px",
                    alignItems: "center",
                    borderBottom: i < reviewRows.length - 1 ? `1px solid ${HAIRLINE}` : "none",
                    background: rowTint,
                    position: "relative",
                  }}
                >
                  {/* Hit / miss indicator column */}
                  <div style={{ display: "flex", justifyContent: "center", paddingLeft: 6 }}>
                    {row.hit ? (
                      <span
                        className="picks-review-tick"
                        aria-hidden="true"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "rgba(34,197,94,0.18)",
                          border: "1px solid rgba(34,197,94,0.45)",
                          color: SUCCESS,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 900,
                          lineHeight: 1,
                        }}
                      >
                        ✓
                      </span>
                    ) : row.pick ? (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "transparent",
                          border: "1px solid rgba(148,163,184,0.28)",
                        }}
                      />
                    ) : (
                      <span aria-hidden="true" style={{ width: 16, height: 1, background: "rgba(148,163,184,0.28)" }} />
                    )}
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: TEXT_PRIMARY,
                        marginBottom: 2,
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      {row.label}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: row.hit ? SUCCESS : SUBTLE_TEXT,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
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
                    <div style={{ padding: "12px 14px", fontSize: 12, color: row.pick ? TEXT_PRIMARY : MUTED_TEXT }}>
                      {row.pick || "—"}
                    </div>
                  )}
                  {!isMobile && (
                    <div style={{ padding: "12px 14px", fontSize: 12, color: row.actual ? TEXT_PRIMARY : MUTED_TEXT }}>
                      {row.actual || "Pending"}
                    </div>
                  )}
                  <div
                    style={{
                      padding: "12px 14px",
                      textAlign: "right",
                      fontSize: 18,
                      fontWeight: 900,
                      color: row.hit ? "#facc15" : SUBTLE_TEXT,
                      fontFamily: "var(--font-mono)",
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {row.hit ? row.points : "0"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Locked (not yet scored) ─── */
        <div style={{ padding: isMobile ? "16px" : "22px 26px 24px", display: "grid", gap: 14 }}>
          {hasSavedPickContent(selectedLeagueSubmission?.picks) ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  className="stint-kicker"
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: SUBTLE_TEXT,
                    fontFamily: "Manrope, sans-serif",
                  }}
                >
                  Saved board
                </span>
                <span style={{ flex: 1, height: 1, background: HAIRLINE }} />
              </div>
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
                        padding: "10px 14px",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: SUBTLE_TEXT,
                        fontFamily: "Manrope, sans-serif",
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
                    className="picks-review-row"
                    style={{
                      "--row-i": i,
                      display: "grid",
                      gridTemplateColumns: isMobile ? "minmax(0,1fr) 120px" : "minmax(160px,1fr) minmax(160px,1fr) 120px",
                      alignItems: "center",
                      borderBottom: i < summaryRows.length - 1 ? `1px solid ${HAIRLINE}` : "none",
                      background: i % 2 === 0 ? PANEL_BG : PANEL_BG_ALT,
                    }}
                  >
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: isMobile ? 3 : 0, fontFamily: "Manrope, sans-serif" }}>
                        {row.label}
                      </div>
                      {isMobile && (
                        <div style={{ fontSize: 11, color: row.pick ? TEXT_PRIMARY : MUTED_TEXT }}>
                          {row.pick || "No pick"}
                        </div>
                      )}
                    </div>
                    {!isMobile && (
                      <div style={{ padding: "12px 14px", fontSize: 12, color: row.pick ? TEXT_PRIMARY : MUTED_TEXT }}>
                        {row.pick || "—"}
                      </div>
                    )}
                    <div
                      style={{
                        padding: "12px 14px",
                        textAlign: "right",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: row.actual ? "#93c5fd" : SUBTLE_TEXT,
                      }}
                    >
                      {row.actual || (raceHasPassed ? "Awaiting" : "Locked")}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                borderRadius: CARD_RADIUS,
                border: `1px solid ${HAIRLINE}`,
                background: PANEL_BG_ALT,
                padding: "16px 18px",
                fontSize: 13,
                color: MUTED_TEXT,
                lineHeight: 1.6,
                fontFamily: "Manrope, sans-serif",
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
      className="stint-pressable picks-rail-item"
      data-active={active ? "true" : "false"}
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px 9px 14px",
        background: active
          ? hexToRgba(status.accent, 0.12)
          : "transparent",
        border: "none",
        outline: active ? `1px solid ${hexToRgba(status.accent, 0.30)}` : "1px solid transparent",
        outlineOffset: -1,
        borderRadius: RADIUS_MD,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {active && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 999,
            background: status.accent,
            boxShadow: `0 0 12px ${hexToRgba(status.accent, 0.5)}`,
          }}
        />
      )}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          flexShrink: 0,
          background: active ? hexToRgba(status.accent, 0.20) : BG_BASE,
          border: `1.5px solid ${active ? status.accent : "rgba(255,255,255,0.12)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 800,
          color: active ? TEXT_PRIMARY : MUTED_TEXT,
          boxShadow: active ? `0 0 12px ${hexToRgba(status.accent, 0.32)}` : "none",
          fontFamily: "var(--font-mono)",
          letterSpacing: "-0.02em",
        }}
      >
        {getRaceDisplayRound(item) || item.r}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: "Sora, sans-serif",
            fontSize: 13,
            fontWeight: active ? 800 : 600,
            color: active ? TEXT_PRIMARY : MUTED_TEXT,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.2,
            marginBottom: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {item.n}
        </div>
        <div style={{ fontSize: 11, color: status.text, lineHeight: 1, fontFamily: "Manrope, sans-serif" }}>{fmt(item.date)}</div>
      </div>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: status.accent,
          flexShrink: 0,
          boxShadow: `0 0 6px ${hexToRgba(status.accent, 0.45)}`,
        }}
      />
    </button>
  );
}

function AiCompactPanel({ aiPredictions, isPro, picks, openAuth }) {
  const visiblePicks = isPro ? aiPredictions : aiPredictions.slice(0, 3);
  const hiddenCount = aiPredictions.length - visiblePicks.length;
  const matchCount = visiblePicks.reduce((n, item) => n + (picks[item.key] === item.pick ? 1 : 0), 0);

  return (
    <div
      className="picks-ai-compact"
      style={{
        position: "relative",
        borderRadius: CARD_RADIUS,
        background: isPro
          ? `radial-gradient(120% 100% at 0% 0%, ${rgbaFromHex(ACCENT, 0.07)} 0%, transparent 60%), ${PANEL_BG}`
          : PANEL_BG,
        border: isPro ? `1px solid ${rgbaFromHex(ACCENT, 0.20)}` : `1px solid ${HAIRLINE}`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 3,
          background: isPro
            ? `linear-gradient(180deg, ${ACCENT} 0%, ${rgbaFromHex(ACCENT, 0.30)} 100%)`
            : "rgba(148,163,184,0.18)",
          zIndex: 2,
        }}
      />
      <div
        style={{
          padding: "10px 12px 8px 14px",
          borderBottom: `1px solid ${HAIRLINE}`,
          background: PANEL_BG_ALT,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            aria-hidden="true"
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: isPro ? ACCENT : "#94a3b8",
              boxShadow: isPro ? `0 0 0 3px ${rgbaFromHex(ACCENT, 0.16)}` : "none",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: isPro ? ACCENT : SUBTLE_TEXT,
              fontFamily: "Manrope, sans-serif",
            }}
          >
            AI Calls
          </span>
          {isPro && matchCount > 0 && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: SUCCESS,
                background: rgbaFromHex(SUCCESS, 0.14),
                border: `1px solid ${rgbaFromHex(SUCCESS, 0.32)}`,
                padding: "2px 6px",
                borderRadius: RADIUS_PILL,
                fontFamily: "Manrope, sans-serif",
              }}
            >
              {matchCount}✓
            </span>
          )}
        </div>
        {!isPro && (
          <button
            onClick={() => openAuth?.("register")}
            className="stint-pressable"
            style={{
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#fff",
              background: `linear-gradient(135deg, ${ACCENT} 0%, #e05a12 100%)`,
              border: "none",
              borderRadius: RADIUS_PILL,
              cursor: "pointer",
              padding: "4px 9px",
              boxShadow: `0 6px 14px ${rgbaFromHex(ACCENT, 0.30)}`,
              fontFamily: "Manrope, sans-serif",
            }}
          >
            Pro
          </button>
        )}
      </div>
      <div style={{ padding: "6px 0" }}>
        {visiblePicks.map((item, idx) => {
          const conf = (typeof item.confidence === "string" ? item.confidence.toLowerCase() : "medium") || "medium";
          const confColor = AI_CONF_COLOR[conf] || "#fde68a";
          const confPercent = confPct(item.key, item.pick, item.confidence);
          const isMatched = picks[item.key] === item.pick;
          return (
            <div
              key={item.key}
              className="picks-ai-compact-row"
              style={{
                "--ai-i": idx,
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px 7px 14px",
                background: isMatched ? rgbaFromHex(SUCCESS, 0.06) : "transparent",
                borderLeft: isMatched ? `2px solid ${rgbaFromHex(SUCCESS, 0.55)}` : "2px solid transparent",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: SUBTLE_TEXT,
                  flexShrink: 0,
                  width: 60,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                {AI_CAT_LABEL[item.key] || item.key}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: isMatched ? "#86efac" : TEXT_PRIMARY,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "Sora, sans-serif",
                  letterSpacing: "-0.015em",
                }}
              >
                {item.pick}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: confColor,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: confColor,
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {confPercent}%
                </span>
              </span>
            </div>
          );
        })}
        {!isPro && hiddenCount > 0 && (
          <button
            onClick={() => openAuth?.("register")}
            className="stint-pressable"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              padding: "8px 12px 8px 14px",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: ACCENT,
              background: "transparent",
              border: "none",
              borderTop: `1px solid ${HAIRLINE}`,
              cursor: "pointer",
              fontFamily: "Manrope, sans-serif",
              textAlign: "left",
            }}
          >
            <span style={{ flex: 1 }}>+{hiddenCount} more with Pro</span>
            <span aria-hidden="true" style={{ fontSize: 12 }}>→</span>
          </button>
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

  const allFilled = totalPrompts > 0 && done === totalPrompts;

  // Save button visual state — derived from the save flow status
  const buttonTone = reviewReady
    ? { bg: "linear-gradient(135deg,#0f766e,#14b8a6)", glow: "rgba(20,184,166,0.32)", label: "Scored" }
    : resultsEntered || (editingLocked && !selectedLeagueBlocked)
      ? { bg: "linear-gradient(135deg,#334155,#475569)", glow: "none", label: "Locked" }
      : saved
        ? { bg: "linear-gradient(135deg,#22C55E,#16A34A)", glow: "0 10px 28px rgba(34,197,94,0.36)", label: "Saved" }
        : allFilled
          ? { bg: "linear-gradient(135deg,#F97316,#EA580C)", glow: "0 14px 38px rgba(249,115,22,0.48)", label: "Ready" }
          : { bg: "linear-gradient(135deg,#F97316,#EA580C)", glow: "0 10px 24px rgba(249,115,22,0.26)", label: "Pending" };

  // Progress percent for the inline bar
  const pct = totalPrompts > 0 ? Math.round((done / totalPrompts) * 100) : 0;

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 20,
        paddingTop: 26,
        paddingBottom: 16,
        background: `linear-gradient(180deg, transparent 0%, ${BG_BASE} 22%)`,
        pointerEvents: "none",
      }}
    >
      <div
        className={allFilled && !saved ? "picks-cmd-ready" : undefined}
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: CARD_RADIUS,
          background: allFilled && !saved
            ? `linear-gradient(135deg, ${hexToRgba(ACCENT, 0.10)} 0%, ${hexToRgba(ACCENT, 0.02)} 50%, ${PANEL_BG_ALT} 100%)`
            : PANEL_BG_ALT,
          border: allFilled && !saved
            ? `1px solid ${hexToRgba(ACCENT, 0.34)}`
            : "1px solid rgba(214,223,239,0.12)",
          boxShadow: allFilled && !saved
            ? `${LIFTED_SHADOW}, 0 0 0 1px ${hexToRgba(ACCENT, 0.16)}, inset 0 1px 0 rgba(255,255,255,0.06)`
            : `${LIFTED_SHADOW}, inset 0 1px 0 rgba(255,255,255,0.04)`,
          padding: isMobile ? "14px 14px 12px" : "16px 22px 14px",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto",
          gap: isMobile ? 14 : 18,
          alignItems: "center",
          pointerEvents: "all",
          transition: "background 240ms ease, border-color 240ms ease, box-shadow 240ms ease",
        }}
      >
        {/* Top tone rail when ready */}
        {allFilled && !saved && (
          <span aria-hidden="true" style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${ACCENT} 70%, transparent)`,
            opacity: 0.78,
          }} />
        )}

        <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
          {/* Headline: progress + league */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, fontWeight: 900,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: allFilled ? SUCCESS : ACCENT,
            }}>{allFilled ? "Board ready" : "Your board"}</span>
            <span aria-hidden="true" style={{ color: "rgba(214,223,239,0.22)", fontSize: 11 }}>·</span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 16,
              fontWeight: 700,
              color: allFilled ? SUCCESS : TEXT_PRIMARY,
              letterSpacing: "-0.04em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}>{done}/{totalPrompts}</span>
            <span aria-hidden="true" style={{ color: "rgba(214,223,239,0.22)", fontSize: 11 }}>·</span>
            <span style={{
              fontSize: 11.5, fontWeight: 700,
              color: MUTED_TEXT,
              letterSpacing: "-0.005em",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>{selectedLeague?.name || "Board"}</span>
          </div>

          {/* Progress bar — replaces dot pattern with cleaner narrative */}
          <div style={{
            position: "relative",
            height: 5,
            borderRadius: 999,
            background: "rgba(148,163,184,0.10)",
            overflow: "hidden",
          }}>
            <div className="picks-cmd-fill" style={{
              width: `${pct}%`,
              height: "100%",
              background: allFilled
                ? `linear-gradient(90deg, ${SUCCESS}, #4ade80)`
                : `linear-gradient(90deg, ${ACCENT}, #fbbf24)`,
              borderRadius: 999,
              boxShadow: allFilled
                ? `0 0 12px ${hexToRgba(SUCCESS, 0.46)}`
                : `0 0 12px ${hexToRgba(ACCENT, 0.36)}`,
              transition: "width 360ms cubic-bezier(0.16,1,0.3,1), background 240ms ease, box-shadow 240ms ease",
            }} />
          </div>

          {/* Inline category jump pills — compact, scrollable, animated active */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            {allPrompts.map((prompt) => {
              const isActive = activePromptKey === prompt.key;
              const meta = selectionMeta(prompt, picks[prompt.key]);
              const accent = meta
                ? meta.accent || SUCCESS
                : isActive
                  ? ACCENT
                  : "rgba(148,163,184,0.30)";
              return (
                <button
                  key={`cmd-${prompt.key}`}
                  onClick={() => onSelectPrompt(prompt.key)}
                  title={prompt.label + (meta ? `: ${meta.label}` : "")}
                  className="picks-cmd-dot"
                  style={{
                    width: isActive ? 34 : meta ? 16 : 12,
                    height: meta || isActive ? 10 : 8,
                    borderRadius: 999,
                    background: accent,
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    flexShrink: 0,
                    boxShadow: isActive
                      ? `0 0 14px ${hexToRgba(ACCENT, 0.62)}`
                      : meta
                        ? `0 0 8px ${hexToRgba(accent, 0.36)}`
                        : "none",
                    transition: "width 280ms cubic-bezier(0.22,1,0.36,1), height 240ms cubic-bezier(0.22,1,0.36,1), background 200ms ease, box-shadow 220ms ease",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Save button */}
        <button
          className={["stint-pressable", savePop ? "stint-success-pop" : null, allFilled && !saved ? "picks-cmd-pulse" : null].filter(Boolean).join(" ")}
          onClick={save}
          disabled={saveDisabled}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: isMobile ? 52 : 56,
            minWidth: isMobile ? "100%" : 188,
            padding: "0 26px",
            borderRadius: RADIUS_PILL,
            border: "none",
            background: buttonTone.bg,
            color: "#fff",
            fontSize: 14,
            fontWeight: 900,
            cursor: saveDisabled ? "default" : "pointer",
            opacity: saveDisabled ? 0.78 : 1,
            boxShadow: buttonTone.glow === "none" ? "none" : buttonTone.glow,
            letterSpacing: "-0.005em",
            fontFamily: "inherit",
            transition: "background 260ms ease, box-shadow 260ms ease, opacity 120ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1)",
          }}
        >
          {saved && (
            <svg width="14" height="11" viewBox="0 0 12 10" fill="none" aria-hidden="true">
              <path d="M1.5 5L4.5 8L10.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span>{saveLabel}</span>
          {!saved && !saveDisabled && (
            <span aria-hidden="true" style={{ fontSize: 13, marginLeft: 2 }}>→</span>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── NEW visual components (rebuild) ──────────────────────────────────────────
// These replace the previous RaceCommandStrip + inline league strip + section
// chrome. They wrap the existing data shape — every prop comes from state
// already computed inside PredictionsPage. The original sub-components above
// (RaceCommandStrip, PickNavigatorPanel, RoundSidebarItem, RoundRailItem,
// AiCompactPanel, AiIntelligencePanel) are kept in place for revertibility:
// `git checkout HEAD -- src/features/picks/` restores the previous render.

// Cinematic race hero — replaces RaceCommandStrip.
// Hero-Main.png backdrop, top accent rail, kicker, big uppercase race title
// with letter-by-letter reveal, live lock countdown that ramps up urgency.
function PicksRaceHero({ race, lockCountdown, stateTone, aiInsight, isMobile, isTablet, selectedLeague, roundSummary }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Lock countdown — derive d/h/m for the protagonist display.
  const cd = lockCountdown?.delta ? (() => {
    const ms = lockCountdown.delta;
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return { d: days, h: hours, m: mins, total: ms };
  })() : null;

  const urgency = cd ? (cd.total < 3600000 ? "critical" : cd.total < 86400000 ? "warning" : "calm") : null;
  const urgencyColor = urgency === "critical" ? "#f87171" : urgency === "warning" ? "#fbbf24" : ACCENT;

  // Header title — letter-by-letter typing reveal, ACCENT-tinted last word
  const titleText = (race?.n || "").replace(/grand prix/i, "").trim() || "Race week";
  const titleChars = titleText.split("");

  // Mini progress strip — count the user's filled picks across leagues
  const totalEntries = roundSummary?.entries?.length || 0;
  const filledLeagues = roundSummary?.entries?.filter((e) => e.progress?.isComplete).length || 0;

  return (
    <section
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       PANEL_BORDER,
        background:   `
          linear-gradient(140deg, ${hexToRgba(urgencyColor, 0.30)} 0%, ${hexToRgba(urgencyColor, 0.08)} 38%, rgba(6,16,27,0.96) 100%),
          url("/images/Hero-Main.png") center / cover no-repeat,
          ${PANEL_BG}
        `,
        boxShadow:    LIFTED_SHADOW,
        marginBottom: isMobile ? 18 : 22,
        padding:      isMobile ? "22px 20px 22px" : isTablet ? "28px 28px 28px" : "34px 36px 32px",
        viewTransitionName: "picks-race-hero",
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${urgencyColor} 30%, ${urgencyColor} 70%, transparent)`,
        opacity: 0.92,
      }} />

      {/* Row 1: kicker + lock countdown chip */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: isMobile ? 14 : 18,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 9,
          padding: "5px 12px", borderRadius: RADIUS_PILL,
          background: hexToRgba(urgencyColor, 0.14),
          border: `1px solid ${hexToRgba(urgencyColor, 0.32)}`,
        }}>
          <span aria-hidden="true" style={{
            width: 6, height: 6, borderRadius: "50%", background: urgencyColor,
            boxShadow: `0 0 0 4px ${hexToRgba(urgencyColor, 0.22)}`,
          }} />
          <span style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: urgencyColor,
            fontVariantNumeric: "tabular-nums",
          }}>
            Race week · R{String(race?.r || "—").padStart(2, "0")}{race?.date ? ` · ${fmtFull(race.date)}` : ""}
          </span>
        </div>

        {/* Lock countdown chip */}
        {cd && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderRadius: RADIUS_PILL,
            background: "rgba(6,16,27,0.46)",
            border: `1px solid ${hexToRgba(urgencyColor, 0.30)}`,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: urgencyColor,
            }}>{urgency === "critical" ? "Locks in" : "Picks lock in"}</span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 700,
              color: "rgba(255,255,255,0.96)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
            }}>
              {cd.d > 0 ? `${cd.d}d ${cd.h}h` : cd.h > 0 ? `${cd.h}h ${cd.m}m` : `${cd.m}m`}
            </span>
          </span>
        )}
        {!cd && stateTone?.label && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "5px 12px", borderRadius: RADIUS_PILL,
            background: "rgba(6,16,27,0.46)",
            border: `1px solid ${hexToRgba(stateTone.accent || ACCENT, 0.30)}`,
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: stateTone.accent || "rgba(255,255,255,0.84)",
          }}>{stateTone.label}</span>
        )}
      </div>

      {/* Row 2: BIG title with letter-by-letter reveal */}
      <h1 className="stint-page-title picks-title" style={{
        margin: 0,
        fontSize: isMobile ? "clamp(34px, 9.5vw, 56px)" : "clamp(54px, 7.2vw, 84px)",
        letterSpacing: "-0.05em",
        lineHeight: 0.92,
        color: "rgba(255,255,255,0.98)",
        textShadow: "0 2px 18px rgba(0,0,0,0.32)",
        textTransform: "uppercase",
        maxWidth: "18ch",
      }}>
        {titleChars.map((ch, i) => (
          <span
            key={`${ch}-${i}-${race?.r}`}
            className="picks-title-char"
            style={{ animationDelay: `${80 + i * 36}ms` }}
          >{ch === " " ? " " : ch}</span>
        ))}
      </h1>

      {/* Sub-line: circuit + city */}
      {(race?.circuit || race?.city) && (
        <div className="picks-hero-sub" style={{
          marginTop: 10,
          display: "inline-flex", alignItems: "baseline", gap: 10,
          fontSize: isMobile ? 13 : 15,
          fontWeight: 600,
          color: "rgba(255,255,255,0.78)",
          letterSpacing: "-0.005em",
        }}>
          {race?.circuit && <span>{race.circuit}</span>}
          {race?.city && (
            <>
              <span style={{ color: "rgba(255,255,255,0.38)" }}>·</span>
              <span>{race.city}{race?.cc ? `, ${race.cc}` : ""}</span>
            </>
          )}
        </div>
      )}

      {/* Row 4: AI insight inline + filled-leagues progress */}
      <div className="picks-hero-meta" style={{
        marginTop: isMobile ? 22 : 26,
        paddingTop: isMobile ? 16 : 20,
        borderTop: "1px solid rgba(255,255,255,0.10)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 14, flexWrap: "wrap",
      }}>
        {/* AI brief (left) */}
        {aiInsight?.headline ? (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            minWidth: 0, flex: 1,
          }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: "50%", background: "#60a5fa",
              boxShadow: "0 0 0 4px rgba(96,165,250,0.18)",
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: "#93c5fd",
              flexShrink: 0,
            }}>AI Brief</span>
            <span style={{
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              color: "rgba(226,232,240,0.78)",
              letterSpacing: "-0.005em",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>{previewText(aiInsight.headline, isMobile ? 60 : 120)}</span>
          </div>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "rgba(255,255,255,0.56)",
            letterSpacing: "-0.005em",
          }}>{race?.len ? `${race.len} km · ${race.laps} laps · ${race.turns} turns` : "Race details loading"}</span>
        )}

        {/* Leagues progress (right) */}
        {totalEntries > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 11px", borderRadius: RADIUS_PILL,
            background: "rgba(6,16,27,0.42)",
            border: `1px solid ${filledLeagues === totalEntries ? hexToRgba(SUCCESS, 0.36) : "rgba(255,255,255,0.14)"}`,
          }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: "50%",
              background: filledLeagues === totalEntries ? SUCCESS : "rgba(148,163,184,0.6)",
            }} />
            <span style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: filledLeagues === totalEntries ? "rgba(187,247,208,0.92)" : "rgba(255,255,255,0.72)",
              fontVariantNumeric: "tabular-nums",
            }}>{filledLeagues} / {totalEntries} {totalEntries === 1 ? "league filled" : "leagues filled"}</span>
          </span>
        )}
      </div>
    </section>
  );
}

// League switcher pills — canonical filter-pill pattern with view-transition
// morph + progress badge per league. Replaces inline league tab strip.
function LeagueSwitcherPills({ roundSummary, selectedLeague, editingLocked, reviewReady, onSelect, isMobile }) {
  if (!roundSummary?.entries?.length) return null;

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          gap: isMobile ? 8 : 10,
          overflowX: "auto",
          scrollbarWidth: "none",
          paddingRight: 56,
          paddingBottom: 4,
        }}
      >
        {roundSummary.entries.map((entry) => {
          const isActive = entry.league.id === selectedLeague?.id;
          const isComplete = entry.progress.isComplete;
          const tone = entry.blocked ? "#f97316" : isComplete ? SUCCESS : ACCENT;
          return (
            <button
              key={entry.league.id}
              onClick={() => onSelect(entry.league.id)}
              className="picks-league-pill"
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                padding: isMobile ? "10px 16px" : "10px 18px",
                minHeight: isMobile ? 42 : 40,
                borderRadius: RADIUS_PILL,
                background: isActive ? hexToRgba(tone, 0.13) : "rgba(148,163,184,0.04)",
                border: isActive ? `1px solid ${hexToRgba(tone, 0.34)}` : `1px solid ${HAIRLINE}`,
                color: isActive ? tone : TEXT_PRIMARY,
                cursor: "pointer",
                fontWeight: 800,
                fontSize: isMobile ? 12.5 : 13.5,
                letterSpacing: "-0.005em",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                viewTransitionName: isActive ? "picks-active-league" : undefined,
                boxShadow: isActive ? `0 4px 14px ${hexToRgba(tone, 0.18)}` : "none",
                transition: "background 200ms ease, border-color 200ms ease, color 200ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1)",
              }}
            >
              <span>{entry.league.name}</span>
              {entry.blocked && (
                <span style={{
                  fontSize: 9, fontWeight: 900,
                  letterSpacing: "0.10em", textTransform: "uppercase",
                  color: "#f97316",
                  background: hexToRgba("#f97316", 0.12),
                  border: `1px solid ${hexToRgba("#f97316", 0.28)}`,
                  borderRadius: 999,
                  padding: "2px 7px",
                }}>Pro</span>
              )}
              {entry.progress.total > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 900,
                  letterSpacing: "0.06em",
                  fontVariantNumeric: "tabular-nums",
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: isComplete
                    ? hexToRgba(SUCCESS, 0.18)
                    : isActive ? hexToRgba(tone, 0.18) : "rgba(148,163,184,0.10)",
                  color: isComplete ? SUCCESS : isActive ? tone : SUBTLE_TEXT,
                  border: isComplete
                    ? `1px solid ${hexToRgba(SUCCESS, 0.32)}`
                    : isActive ? `1px solid ${hexToRgba(tone, 0.30)}` : `1px solid ${HAIRLINE}`,
                  minWidth: 26, textAlign: "center",
                }}>{entry.progress.filled}/{entry.progress.total}</span>
              )}
            </button>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0, right: 0, bottom: 4,
          width: 56,
          background: `linear-gradient(to right, transparent, ${BG_BASE})`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// Rounds list — sidebar/scroller of all 24 calendar rounds. Wraps the
// existing RoundRailItem (desktop) / RoundSidebarItem (tablet) components so
// the data flow stays identical, but the container chrome is cleaner.
function PicksRoundsList({ calendar, race, liveRaces, resultsByRound, now, roundSummariesByRound, activeRoundRef, onSelect, isMobile, isTablet }) {
  // Tablet: horizontal snap-scroller (mobile-ish)
  if (isTablet) {
    return (
      <section style={{ position: "relative" }}>
        <div
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: isMobile ? "minmax(190px, 1fr)" : "minmax(210px, 1fr)",
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
                  onClick={() => onSelect(item)}
                />
              </div>
            );
          })}
        </div>
        <div
          aria-hidden="true"
          style={{
            position: "absolute", top: 0, right: 0, bottom: 4,
            width: 56,
            background: `linear-gradient(to right, transparent, ${BG_BASE})`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      </section>
    );
  }

  // Desktop: vertical rail in a polished card
  const scoredCount = calendar.reduce((n, item) => {
    const s = roundSidebarStatus(
      item,
      liveRaces[item.r] || null,
      resultsByRound[item.r] || null,
      now,
      roundSummariesByRound[item.r] || null
    );
    return n + (s.kind === "scored" ? 1 : 0);
  }, 0);
  const activeRoundNumber = getRaceDisplayRound(race) || race.r;
  return (
    <div
      className="picks-rounds-list"
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: CARD_RADIUS,
        background: PANEL_BG,
        border: `1px solid ${HAIRLINE}`,
        overflow: "hidden",
        boxShadow: CARD_SHADOW,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 3,
          background: `linear-gradient(180deg, ${ACCENT} 0%, ${rgbaFromHex(ACCENT, 0.30)} 100%)`,
          zIndex: 2,
        }}
      />
      <div
        style={{
          padding: "14px 16px 12px 18px",
          borderBottom: `1px solid ${HAIRLINE}`,
          background: `radial-gradient(120% 100% at 0% 0%, ${rgbaFromHex(ACCENT, 0.10)} 0%, transparent 55%), ${PANEL_BG_ALT}`,
          flexShrink: 0,
          display: "grid",
          gap: 6,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            width: "fit-content",
            alignItems: "center",
            gap: 6,
            padding: "4px 9px",
            borderRadius: RADIUS_PILL,
            background: rgbaFromHex(ACCENT, 0.12),
            border: `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
            color: ACCENT,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          <span aria-hidden="true" style={{
            width: 5, height: 5, borderRadius: "50%", background: ACCENT,
            boxShadow: `0 0 0 3px ${rgbaFromHex(ACCENT, 0.18)}`,
          }} />
          Season
        </span>
        <h3
          style={{
            margin: 0,
            fontFamily: "Sora, sans-serif",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: TEXT_PRIMARY,
            lineHeight: 1.1,
          }}
        >
          2026 Calendar
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: MUTED_TEXT, fontFamily: "Manrope, sans-serif" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: TEXT_PRIMARY, fontWeight: 800 }}>
            R{activeRoundNumber}
          </span>
          <span>·</span>
          <span><span style={{ color: SUCCESS, fontWeight: 800, fontFamily: "var(--font-mono)" }}>{scoredCount}</span> scored</span>
          <span>·</span>
          <span><span style={{ color: TEXT_PRIMARY, fontWeight: 800, fontFamily: "var(--font-mono)" }}>{Math.max(0, calendar.length - scoredCount)}</span> to go</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "6px 0" }}>
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
                onClick={() => onSelect(item)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Progress navigator — desktop left rail showing category sections + fill
// state. Replaces the original PickNavigatorPanel. Cleaner chrome, polished
// section pills, animated progress arc per section.
function PicksProgressNavigator({ promptSections, picks, activePromptKey, aiByKey, onSelect, selectedLeague, budgetAmounts, doubleDownKey }) {
  // Total filled count for the headline counter
  const allPrompts = promptSections.flatMap((s) => s.prompts);
  const total = allPrompts.length;
  const filled = allPrompts.filter((p) => !!picks[p.key]).length;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  return (
    <aside
      style={{
        position: "sticky",
        top: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxHeight: "calc(100vh - 44px)",
      }}
    >
      {/* Header card with progress ring style */}
      <div style={{
        borderRadius: CARD_RADIUS,
        background: PANEL_BG,
        border: `1px solid ${HAIRLINE}`,
        padding: "14px 16px 12px",
        boxShadow: CARD_SHADOW,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 900,
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: ACCENT, marginBottom: 6,
        }}>Your board</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 28,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 0.92,
          }}>{filled}</span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: MUTED_TEXT,
            letterSpacing: "-0.005em",
          }}>of {total} picks in</span>
        </div>
        <div style={{
          height: 5,
          borderRadius: 999,
          background: "rgba(148,163,184,0.10)",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: pct === 100
              ? `linear-gradient(90deg, ${SUCCESS}, #4ade80)`
              : `linear-gradient(90deg, ${ACCENT}, #fbbf24)`,
            borderRadius: 999,
            transition: "width 360ms cubic-bezier(0.16,1,0.3,1), background 200ms ease",
            boxShadow: `0 0 12px ${hexToRgba(pct === 100 ? SUCCESS : ACCENT, 0.32)}`,
          }} />
        </div>
      </div>

      {/* Sections */}
      <div style={{
        borderRadius: CARD_RADIUS,
        background: PANEL_BG,
        border: `1px solid ${HAIRLINE}`,
        overflow: "hidden",
        flex: 1, minHeight: 0,
        display: "flex", flexDirection: "column",
        boxShadow: CARD_SHADOW,
      }}>
        <div style={{
          padding: "10px 14px 8px",
          borderBottom: `1px solid ${HAIRLINE}`,
          background: PANEL_BG_ALT,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: SUBTLE_TEXT,
          }}>Categories</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "8px 8px 12px" }}>
          {promptSections.map((section) => {
            const sectionDone = section.prompts.filter((p) => !!picks[p.key]).length;
            const sectionComplete = sectionDone === section.prompts.length && section.prompts.length > 0;
            return (
              <div key={section.title} style={{ marginBottom: 10 }}>
                <div style={{
                  display: "flex", alignItems: "baseline", justifyContent: "space-between",
                  gap: 8, padding: "6px 8px 4px",
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 900,
                    letterSpacing: "0.14em", textTransform: "uppercase",
                    color: sectionComplete ? SUCCESS : SUBTLE_TEXT,
                  }}>{section.title}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 900,
                    color: sectionComplete ? SUCCESS : SUBTLE_TEXT,
                    fontVariantNumeric: "tabular-nums",
                  }}>{sectionDone}/{section.prompts.length}</span>
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  {section.prompts.map((prompt) => {
                    const value = picks[prompt.key];
                    const meta = selectionMeta(prompt, value);
                    const isActive = activePromptKey === prompt.key;
                    const isDoubleDown = doubleDownKey === prompt.key;
                    const budgetAmt = budgetAmounts?.[prompt.key];
                    const hasAi = !!aiByKey?.[prompt.key];

                    return (
                      <button
                        key={prompt.key}
                        onClick={() => onSelect(prompt.key)}
                        className="picks-nav-row"
                        style={{
                          width: "100%",
                          display: "grid",
                          gridTemplateColumns: "auto minmax(0, 1fr) auto",
                          alignItems: "center",
                          gap: 9,
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: isActive
                            ? `1px solid ${hexToRgba(ACCENT, 0.36)}`
                            : meta
                              ? `1px solid ${hexToRgba(meta.accent || SUCCESS, 0.20)}`
                              : `1px solid ${HAIRLINE}`,
                          background: isActive
                            ? hexToRgba(ACCENT, 0.10)
                            : meta
                              ? hexToRgba(meta.accent || SUCCESS, 0.05)
                              : "rgba(148,163,184,0.03)",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                          minHeight: 38,
                        }}
                      >
                        {/* Status dot */}
                        <span aria-hidden="true" style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: meta
                            ? (meta.accent || SUCCESS)
                            : isActive ? ACCENT : "rgba(148,163,184,0.32)",
                          boxShadow: meta
                            ? `0 0 8px ${hexToRgba(meta.accent || SUCCESS, 0.42)}`
                            : "none",
                          flexShrink: 0,
                        }} />
                        {/* Label */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, fontWeight: 800,
                            color: isActive ? ACCENT : TEXT_PRIMARY,
                            letterSpacing: "-0.005em",
                            lineHeight: 1.2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>{prompt.label}</div>
                          {meta && (
                            <div style={{
                              fontSize: 10.5,
                              color: meta.accent || SUBTLE_TEXT,
                              fontWeight: 600,
                              marginTop: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>{meta.label}</div>
                          )}
                        </div>
                        {/* Right side: pts / AI / 3x / budget */}
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          flexShrink: 0,
                        }}>
                          {isDoubleDown && (
                            <span style={{
                              fontSize: 9, fontWeight: 900,
                              color: "#f97316",
                              background: "rgba(249,115,22,0.16)",
                              border: "1px solid rgba(249,115,22,0.30)",
                              borderRadius: 999,
                              padding: "1px 6px",
                              letterSpacing: "0.05em",
                            }}>3×</span>
                          )}
                          {selectedLeague?.gameMode === "budget_picks" && typeof budgetAmt === "number" && budgetAmt > 0 && (
                            <span style={{
                              fontSize: 9, fontWeight: 900,
                              color: ACCENT,
                              background: hexToRgba(ACCENT, 0.10),
                              border: `1px solid ${hexToRgba(ACCENT, 0.24)}`,
                              borderRadius: 999,
                              padding: "1px 6px",
                              letterSpacing: "-0.005em",
                              fontVariantNumeric: "tabular-nums",
                            }}>{budgetAmt}c</span>
                          )}
                          {hasAi && !meta && (
                            <span title="AI suggestion" aria-hidden="true" style={{
                              width: 5, height: 5, borderRadius: "50%",
                              background: "#60a5fa",
                              boxShadow: "0 0 6px rgba(96,165,250,0.5)",
                            }} />
                          )}
                          <span style={{
                            fontSize: 9, fontWeight: 900,
                            color: SUBTLE_TEXT,
                            fontVariantNumeric: "tabular-nums",
                            letterSpacing: "0.02em",
                          }}>{prompt.pts || 0}p</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

// Focus header — cinematic category header inside the focus panel. Replaces
// the in-line eyebrow + title + selection-declaration + nav row above.
function PickFocusHeader({
  activeSection,
  activePrompt,
  activePromptKey,
  activeIndex,
  totalPrompts,
  currentMeta,
  interactionLocked,
  emptyLabel,
  onClear,
  onPrev,
  onNext,
  previousPrompt,
  nextPromptItem,
  activeAi,
  isProSubscriber,
  AI_CONF_COLOR,
  confPctOf,
  isMobile,
}) {
  // Section eyebrow + category title + pts
  return (
    <div
      key={`header-${activePromptKey}`}
      className="picks-focus-enter"
      style={{
        padding: isMobile ? "22px 18px 20px" : "28px 30px 24px",
        borderBottom: `1px solid ${HAIRLINE}`,
        background: currentMeta
          ? `linear-gradient(180deg, ${hexToRgba(currentMeta.accent, 0.10)} 0%, ${hexToRgba(currentMeta.accent, 0.02)} 50%, ${PANEL_BG} 100%)`
          : `linear-gradient(180deg, ${hexToRgba(ACCENT, 0.06)} 0%, ${PANEL_BG} 50%)`,
        display: "grid",
        gap: 16,
        position: "relative",
        transition: "background 300ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Top tone rail */}
      {currentMeta && (
        <span aria-hidden="true" style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${currentMeta.accent} 30%, ${currentMeta.accent} 70%, transparent)`,
          opacity: 0.78,
        }} />
      )}

      {/* Eyebrow row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 10, fontWeight: 900,
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: currentMeta?.accent || ACCENT,
        }}>{activeSection?.title}</span>
        <span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(214,223,239,0.20)" }} />
        <span style={{
          fontSize: 10, fontWeight: 900,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: ACCENT,
          fontVariantNumeric: "tabular-nums",
        }}>{activePrompt?.pts || 0} pts</span>
        <span style={{
          marginLeft: "auto",
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "4px 10px",
          borderRadius: RADIUS_PILL,
          background: "rgba(148,163,184,0.08)",
          border: `1px solid ${HAIRLINE}`,
          fontSize: 10.5, fontWeight: 800,
          color: SUBTLE_TEXT,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.005em",
        }}>
          <span style={{ color: TEXT_PRIMARY }}>{activeIndex + 1}</span>
          <span style={{ color: "rgba(148,163,184,0.4)" }}>/</span>
          <span>{totalPrompts}</span>
        </span>
      </div>

      {/* Category headline */}
      <div>
        <div className="picks-cat-title" style={{
          fontSize: isMobile ? 30 : 42,
          fontWeight: 900,
          letterSpacing: "-0.045em",
          lineHeight: 0.96,
          color: TEXT_PRIMARY,
          marginBottom: 10,
          textTransform: "uppercase",
        }}>
          {activePrompt?.label}
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.6, color: MUTED_TEXT, maxWidth: 620, letterSpacing: "-0.005em" }}>
          {activePrompt?.hint}
        </div>
      </div>

      {/* Current selection declaration */}
      <div>
        {currentMeta ? (
          <div
            className="picks-selection-card"
            style={{
              position: "relative",
              borderRadius: CARD_RADIUS,
              background: `linear-gradient(135deg, ${hexToRgba(currentMeta.accent, 0.16)} 0%, ${hexToRgba(currentMeta.accent, 0.04)} 60%, ${PANEL_BG_ALT} 100%)`,
              border: `1px solid ${hexToRgba(currentMeta.accent, 0.40)}`,
              minHeight: 56,
              padding: !interactionLocked ? "12px 44px 12px 16px" : "12px 16px",
              boxShadow: `0 6px 18px ${hexToRgba(currentMeta.accent, 0.18)}`,
            }}
          >
            <span aria-hidden="true" style={{
              position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
              background: currentMeta.accent,
              opacity: 0.85,
            }} />
            <div style={{
              fontSize: 17,
              fontWeight: 900,
              color: TEXT_PRIMARY,
              letterSpacing: "-0.025em",
              lineHeight: 1.16,
            }}>{currentMeta.label}</div>
            {currentMeta.secondary && (
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: currentMeta.accent,
                marginTop: 3,
                opacity: 0.92,
                letterSpacing: "-0.005em",
              }}>{currentMeta.secondary}</div>
            )}
            {!interactionLocked && (
              <button
                onClick={onClear}
                title="Clear pick"
                style={{
                  position: "absolute",
                  top: "50%",
                  right: 12,
                  transform: "translateY(-50%)",
                  width: 26, height: 26,
                  borderRadius: "50%",
                  border: "1px solid rgba(214,223,239,0.14)",
                  background: "var(--btn-secondary-bg)",
                  color: SUBTLE_TEXT,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 0,
                }}
              >
                <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              minHeight: 56,
              borderRadius: CARD_RADIUS,
              border: "1px dashed rgba(214,223,239,0.14)",
              display: "flex", alignItems: "center",
              padding: "0 16px",
              fontSize: 13, color: SUBTLE_TEXT, fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            {emptyLabel}
          </div>
        )}
      </div>

      {/* Nav row */}
      <div style={{
        display: "flex", gap: 10,
        justifyContent: "flex-end",
        flexWrap: isMobile ? "wrap" : "nowrap",
      }}>
        <button
          onClick={onPrev}
          disabled={!previousPrompt}
          style={{
            minHeight: isMobile ? 44 : 38,
            flex: isMobile ? 1 : undefined,
            padding: "0 18px",
            borderRadius: RADIUS_PILL,
            border: "1px solid rgba(255,255,255,0.12)",
            background: previousPrompt ? "rgba(148,163,184,0.06)" : "transparent",
            color: previousPrompt ? TEXT_PRIMARY : SUBTLE_TEXT,
            fontSize: 12.5,
            fontWeight: 800,
            cursor: previousPrompt ? "pointer" : "default",
            fontFamily: "inherit",
            letterSpacing: "-0.005em",
          }}
        >← Prev</button>
        <button
          onClick={onNext}
          disabled={!nextPromptItem}
          style={{
            minHeight: isMobile ? 44 : 38,
            flex: isMobile ? 1 : undefined,
            padding: "0 18px",
            borderRadius: RADIUS_PILL,
            border: nextPromptItem
              ? `1px solid ${hexToRgba(ACCENT, 0.34)}`
              : "1px solid rgba(255,255,255,0.10)",
            background: nextPromptItem ? hexToRgba(ACCENT, 0.10) : "transparent",
            color: nextPromptItem ? ACCENT : SUBTLE_TEXT,
            fontSize: 12.5,
            fontWeight: 900,
            cursor: nextPromptItem ? "pointer" : "default",
            fontFamily: "inherit",
            letterSpacing: "-0.005em",
            boxShadow: nextPromptItem ? `0 4px 14px ${hexToRgba(ACCENT, 0.20)}` : "none",
          }}
        >Next →</button>
      </div>

      {/* AI hint inline */}
      {activeAi && (
        <div style={{
          paddingTop: 14,
          borderTop: "1px solid rgba(96,165,250,0.12)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span aria-hidden="true" style={{
              width: 5, height: 5, borderRadius: "50%", background: "#60a5fa",
            }} />
            <span style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: "#93c5fd",
            }}>AI Insight</span>
            {(() => {
              const conf = (typeof activeAi.confidence === "string" ? activeAi.confidence.toLowerCase() : "medium") || "medium";
              const confColor = AI_CONF_COLOR[conf] || "#fde68a";
              const pct = confPctOf(activeAi.key, activeAi.pick, activeAi.confidence);
              return (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 10, fontWeight: 900,
                  letterSpacing: "0.10em", textTransform: "uppercase",
                  color: confColor,
                  fontVariantNumeric: "tabular-nums",
                  padding: "2px 8px", borderRadius: 999,
                  background: hexToRgba(confColor, 0.10),
                  border: `1px solid ${hexToRgba(confColor, 0.24)}`,
                }}>
                  <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: "50%", background: confColor }} />
                  {pct}%
                </span>
              );
            })()}
            {!isProSubscriber && (
              <span style={{
                fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "var(--brand)",
                background: hexToRgba(ACCENT, 0.12),
                borderRadius: 999, padding: "2px 7px",
                border: `1px solid ${hexToRgba(ACCENT, 0.26)}`,
              }}>Pro</span>
            )}
          </div>
          <div style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "rgba(214,223,239,0.78)",
            fontWeight: 500,
            letterSpacing: "-0.005em",
          }}>
            <span style={{ color: TEXT_PRIMARY, fontWeight: 800 }}>{activeAi.pick}.</span>{" "}
            {isProSubscriber
              ? previewText(activeAi.reason, 160)
              : <>{previewText(activeAi.reason, 70)}… <span style={{ color: ACCENT, fontWeight: 700 }}>Unlock with Pro.</span></>}
          </div>
        </div>
      )}
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
        /* ─── Picks page — new motion system ───────────────────────────── */

        @keyframes picks-page-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .stint-page-enter { animation: picks-page-in 320ms cubic-bezier(0.16,1,0.3,1) both; }

        /* Hero title — letter-by-letter typing reveal */
        @keyframes picks-char-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .picks-title-char {
          display: inline-block;
          opacity: 0;
          transform: translateY(8px);
          animation: picks-char-in 360ms cubic-bezier(0.16,1,0.3,1) forwards;
        }

        @keyframes picks-fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .picks-hero-sub, .picks-hero-meta {
          opacity: 0;
          animation: picks-fade-up 460ms cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .picks-hero-sub  { animation-delay: 460ms; }
        .picks-hero-meta { animation-delay: 620ms; }

        /* View Transition — race header cross-fades when switching rounds */
        ::view-transition-old(picks-race-hero),
        ::view-transition-new(picks-race-hero) {
          animation-duration: 320ms;
          animation-timing-function: cubic-bezier(0.16,1,0.3,1);
        }
        ::view-transition-old(picks-active-league),
        ::view-transition-new(picks-active-league) {
          animation-duration: 240ms;
          animation-timing-function: cubic-bezier(0.16,1,0.3,1);
        }

        /* Pick focus panel — header morphs between categories */
        @keyframes picks-focus-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .picks-focus-enter { animation: picks-focus-in 320ms cubic-bezier(0.16,1,0.3,1) both; }

        /* Selection card — gentle scale-in when a pick lands */
        @keyframes picks-selection-pop {
          from { transform: scale(0.97); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .picks-selection-card { animation: picks-selection-pop 280ms cubic-bezier(0.23,1,0.32,1) both; }

        /* Category title — subtle bloom each time it changes */
        @keyframes picks-cat-bloom {
          from { opacity: 0; transform: translateY(4px); letter-spacing: -0.030em; }
          to   { opacity: 1; transform: translateY(0); letter-spacing: -0.045em; }
        }
        .picks-cat-title { animation: picks-cat-bloom 360ms cubic-bezier(0.16,1,0.3,1) both; }

        /* League pill press feedback */
        .picks-league-pill:active { transform: scale(0.97); }

        /* Nav row press feedback (inside ProgressNavigator) */
        .picks-nav-row {
          transition: background 180ms ease, border-color 180ms ease, transform 140ms cubic-bezier(0.23,1,0.32,1);
          -webkit-tap-highlight-color: transparent;
        }
        @media (hover: hover) and (pointer: fine) {
          .picks-nav-row:hover { background: rgba(255,255,255,0.025) !important; }
        }
        .picks-nav-row:active { transform: scale(0.98); }

        /* Pick option check pop — when a selection lands, the colored ring scales in */
        @keyframes picks-check-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .picks-check-pop { animation: picks-check-pop 380ms cubic-bezier(0.16,1,0.3,1) both; }

        /* BoardCommandBar progress fill bloom on intersection */
        .picks-cmd-fill { will-change: width, background; }

        /* Command bar dots — slight hover scale */
        .picks-cmd-dot {
          transition: width 280ms cubic-bezier(0.22,1,0.36,1),
                      height 240ms cubic-bezier(0.22,1,0.36,1),
                      background 200ms ease,
                      box-shadow 220ms ease,
                      transform 160ms cubic-bezier(0.23,1,0.32,1);
        }
        @media (hover: hover) and (pointer: fine) {
          .picks-cmd-dot:hover { transform: scale(1.18); }
        }
        .picks-cmd-dot:active { transform: scale(0.94); }

        /* "Ready to save" pulse — the save bar glows when the board is full and unsaved */
        @keyframes picks-cmd-ready-pulse {
          0%, 100% {
            box-shadow: 0 14px 38px rgba(249,115,22,0.32), 0 0 0 0 rgba(249,115,22,0);
          }
          50% {
            box-shadow: 0 14px 38px rgba(249,115,22,0.46), 0 0 0 12px rgba(249,115,22,0);
          }
        }
        .picks-cmd-pulse { animation: picks-cmd-ready-pulse 2200ms cubic-bezier(0.16,1,0.3,1) infinite; }

        /* Round review — celebratory mount cascade */
        @keyframes picks-review-rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .picks-review-mount { animation: picks-review-rise 480ms cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes picks-review-score-in {
          0%   { opacity: 0; transform: scale(0.82); letter-spacing: -0.02em; }
          70%  { opacity: 1; transform: scale(1.03); letter-spacing: -0.05em; }
          100% { opacity: 1; transform: scale(1); letter-spacing: -0.05em; }
        }
        .picks-review-score { animation: picks-review-score-in 720ms cubic-bezier(0.16,1,0.3,1) 120ms both; transform-origin: left center; }
        @keyframes picks-review-title-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .picks-review-title { animation: picks-review-title-in 460ms cubic-bezier(0.16,1,0.3,1) 280ms both; }
        @keyframes picks-review-bonus-in {
          from { opacity: 0; transform: translateY(4px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .picks-review-bonus { animation: picks-review-bonus-in 420ms cubic-bezier(0.16,1,0.3,1) 460ms both; }
        @keyframes picks-review-row-in {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .picks-review-row {
          opacity: 0;
          animation: picks-review-row-in 360ms cubic-bezier(0.16,1,0.3,1) forwards;
          animation-delay: calc(420ms + var(--row-i, 0) * 60ms);
        }
        @keyframes picks-review-tick-in {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .picks-review-tick {
          animation: picks-review-tick-in 380ms cubic-bezier(0.16,1,0.3,1) forwards;
          animation-delay: calc(540ms + var(--row-i, 0) * 60ms);
        }
        .picks-review-metrics > * {
          opacity: 0;
          animation: picks-review-row-in 380ms cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .picks-review-metrics > *:nth-child(1) { animation-delay: 320ms; }
        .picks-review-metrics > *:nth-child(2) { animation-delay: 380ms; }
        .picks-review-metrics > *:nth-child(3) { animation-delay: 440ms; }
        .picks-review-metrics > *:nth-child(4) { animation-delay: 500ms; }

        /* Round rail / sidebar — hover affordance */
        .picks-rail-item, .picks-sidebar-item {
          transition: background 180ms ease, outline-color 180ms ease, border-color 180ms ease,
                      box-shadow 220ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1);
        }
        @media (hover: hover) and (pointer: fine) {
          .picks-rail-item[data-active="false"]:hover {
            background: rgba(255,255,255,0.035);
            outline-color: rgba(255,255,255,0.10);
          }
          .picks-sidebar-item[data-active="false"]:hover {
            transform: translateY(-1px);
            border-color: rgba(255,255,255,0.18);
            box-shadow: 0 10px 22px rgba(0,0,0,0.28);
          }
        }
        .picks-rail-item:active, .picks-sidebar-item:active { transform: scale(0.99); }

        /* AI panel — spark pulse on Pro */
        @keyframes picks-ai-spark-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(249,115,22,0.18); }
          50%      { box-shadow: 0 0 0 6px rgba(249,115,22,0.10); }
        }
        .picks-ai-kicker .picks-ai-spark { animation: picks-ai-spark-pulse 2400ms cubic-bezier(0.16,1,0.3,1) infinite; }

        /* AI card stagger reveal */
        @keyframes picks-ai-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .picks-ai-card {
          opacity: 0;
          animation: picks-ai-card-in 420ms cubic-bezier(0.16,1,0.3,1) forwards;
          animation-delay: calc(140ms + var(--ai-i, 0) * 70ms);
          transition: transform 200ms cubic-bezier(0.23,1,0.32,1), box-shadow 220ms ease, border-color 200ms ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .picks-ai-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 28px rgba(0,0,0,0.30);
          }
        }

        /* AI confidence fill — width grows in */
        @keyframes picks-ai-conf-grow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        .picks-ai-conf-fill {
          transform-origin: left center;
          animation: picks-ai-conf-grow 720ms cubic-bezier(0.16,1,0.3,1) 240ms both;
        }

        /* Compact AI row stagger */
        @keyframes picks-ai-compact-in {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .picks-ai-compact-row {
          opacity: 0;
          animation: picks-ai-compact-in 340ms cubic-bezier(0.16,1,0.3,1) forwards;
          animation-delay: calc(120ms + var(--ai-i, 0) * 50ms);
        }

        /* Ready-state container highlight — gentle backdrop breathing */
        @keyframes picks-cmd-ready-bg {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .picks-cmd-ready {
          background-size: 200% 100%;
          animation: picks-cmd-ready-bg 5600ms ease-in-out infinite alternate;
        }

        @media (prefers-reduced-motion: reduce) {
          .stint-page-enter,
          .picks-title-char, .picks-hero-sub, .picks-hero-meta,
          .picks-focus-enter, .picks-selection-card, .picks-cat-title,
          .picks-league-pill, .picks-nav-row,
          .picks-check-pop, .picks-cmd-fill, .picks-cmd-dot, .picks-cmd-pulse, .picks-cmd-ready,
          .picks-review-mount, .picks-review-score, .picks-review-title, .picks-review-bonus,
          .picks-review-row, .picks-review-tick, .picks-review-metrics > *,
          .picks-ai-kicker .picks-ai-spark, .picks-ai-card, .picks-ai-conf-fill, .picks-ai-compact-row,
          .picks-rail-item, .picks-sidebar-item {
            animation: none !important;
            transition: none !important;
            opacity: 1 !important;
            transform: none !important;
            letter-spacing: -0.045em !important;
          }
          ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
        }
      `}</style>

      {/* ── 1. Cinematic race hero (replaces RaceCommandStrip) ── */}
      <PicksRaceHero
        race={race}
        lockCountdown={lockCountdown}
        stateTone={stateTone}
        aiInsight={aiTargetsRace ? aiInsight : null}
        isMobile={isMobile}
        isTablet={isTablet}
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
        {/* ── 2. Left column: round list + (desktop) AI compact ── */}
        {isTablet ? (
          <PicksRoundsList
            calendar={calendar}
            race={race}
            liveRaces={liveRaces}
            resultsByRound={resultsByRound}
            now={now}
            roundSummariesByRound={roundSummariesByRound}
            activeRoundRef={activeRoundRef}
            onSelect={selectRace}
            isMobile={isMobile}
            isTablet={isTablet}
          />
        ) : (
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
            <PicksRoundsList
              calendar={calendar}
              race={race}
              liveRaces={liveRaces}
              resultsByRound={resultsByRound}
              now={now}
              roundSummariesByRound={roundSummariesByRound}
              activeRoundRef={activeRoundRef}
              onSelect={selectRace}
              isMobile={isMobile}
              isTablet={isTablet}
            />

            {/* AI compact strip (desktop only) — kept */}
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

          {/* ── 3. League switcher pills (replaces inline league strip) ── */}
          <LeagueSwitcherPills
            roundSummary={roundSummary}
            selectedLeague={selectedLeague}
            editingLocked={editingLocked}
            reviewReady={reviewReady}
            onSelect={selectLeagueContext}
            isMobile={isMobile}
          />

          {/* Hidden — preserved as dead code for revertibility */}
          {false && (<div style={{ position: "relative" }}>
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
          </div>)}

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

          {/* ── Status banners — tone rail + cinematic typography ── */}
          {!showReviewOnly && editingLocked && (() => {
            const tone = resultsEntered
              ? { color: "#4ade80", bg: SUCCESS_BG, border: SUCCESS_BORDER, kicker: "Scored", title: "Picks scored", body: "Results are in — check your score below.", textColor: SUCCESS_TEXT, glow: "rgba(34,197,94,0.5)" }
              : raceHasPassed
                ? { color: "#60a5fa", bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.22)", kicker: "Awaiting", title: "Awaiting results", body: "Race weekend ended. Scores coming soon.", textColor: "#93c5fd", glow: "rgba(59,130,246,0.5)" }
                : { color: "#fcd34d", bg: WARN_BG, border: WARN_BORDER, kicker: "Locked", title: "Picks locked", body: lockLabel ? `Locked at ${lockLabel} · no more changes accepted` : "No more changes accepted.", textColor: WARN_TEXT, glow: "rgba(252,211,77,0.5)" };

            return (
              <div style={{
                position: "relative",
                overflow: "hidden",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                borderRadius: CARD_RADIUS,
                background: `linear-gradient(135deg, ${hexToRgba(tone.color, 0.08)} 0%, ${hexToRgba(tone.color, 0.02)} 60%, ${PANEL_BG} 100%)`,
                border: `1px solid ${tone.border}`,
                boxShadow: CARD_SHADOW,
              }}>
                <span aria-hidden="true" style={{
                  position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                  background: tone.color,
                  opacity: 0.72,
                }} />
                <span aria-hidden="true" style={{
                  width: 9, height: 9, borderRadius: "50%",
                  background: tone.color,
                  boxShadow: `0 0 0 4px ${hexToRgba(tone.color, 0.16)}, 0 0 12px ${tone.glow}`,
                  flexShrink: 0,
                }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 900,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    color: tone.textColor,
                    marginBottom: 4,
                  }}>{tone.kicker}</div>
                  <div className="stint-card-title" style={{
                    fontSize: 17, fontWeight: 900,
                    letterSpacing: "-0.025em", lineHeight: 1.16,
                    color: TEXT_PRIMARY,
                    marginBottom: 2,
                  }}>{tone.title}</div>
                  <div style={{
                    fontSize: 12.5, fontWeight: 600,
                    color: MUTED_TEXT,
                    letterSpacing: "-0.005em",
                    lineHeight: 1.5,
                  }}>{tone.body}</div>
                </div>
              </div>
            );
          })()}

          {/* ── Pro League blocking banner — matches Pro page design language ── */}
          {!showReviewOnly && selectedLeagueBlocked && (
            <div style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: SECTION_RADIUS,
              border: `1px solid ${hexToRgba(ACCENT, 0.32)}`,
              background: `linear-gradient(135deg, ${hexToRgba(ACCENT, 0.18)} 0%, ${hexToRgba(ACCENT, 0.04)} 50%, ${PANEL_BG} 100%)`,
              padding: "20px 22px",
              boxShadow: LIFTED_SHADOW,
              display: "flex",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
            }}>
              <span aria-hidden="true" style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${ACCENT} 70%, transparent)`,
                opacity: 0.92,
              }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "4px 11px", borderRadius: RADIUS_PILL,
                  background: hexToRgba(ACCENT, 0.14),
                  border: `1px solid ${hexToRgba(ACCENT, 0.32)}`,
                  marginBottom: 10,
                }}>
                  <span aria-hidden="true" style={{
                    width: 5, height: 5, borderRadius: "50%", background: ACCENT,
                    boxShadow: `0 0 0 3px ${hexToRgba(ACCENT, 0.20)}`,
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 900,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    color: ACCENT,
                  }}>Pro League</span>
                </div>
                <div className="stint-card-title" style={{
                  fontSize: 17, fontWeight: 900,
                  letterSpacing: "-0.025em", lineHeight: 1.16,
                  color: TEXT_PRIMARY,
                  marginBottom: 4,
                }}>This league is Pro-only</div>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: MUTED_TEXT,
                  letterSpacing: "-0.005em",
                  lineHeight: 1.55,
                  maxWidth: "52ch",
                }}>Unlock Stint Pro to make picks here, automatic Pro Community League entry, and the AI Coach.</div>
              </div>
              <button
                onClick={() => (openAuth ? openAuth("register") : null)}
                className="stint-pressable"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  minHeight: 48,
                  padding: "0 24px",
                  borderRadius: RADIUS_PILL,
                  border: "none",
                  background: "linear-gradient(135deg,#F97316,#EA580C)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: "pointer",
                  flexShrink: 0,
                  letterSpacing: "-0.005em",
                  fontFamily: "inherit",
                  boxShadow: `0 10px 28px ${hexToRgba(ACCENT, 0.38)}`,
                }}
              >
                Unlock Pro
                <span aria-hidden="true" style={{ fontSize: 13 }}>→</span>
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
              {/* ── 5. Pick Progress Navigator (desktop only) — replaces PickNavigatorPanel ── */}
              {!isMobile && !isTablet && (
                <PicksProgressNavigator
                  promptSections={promptSections}
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

                {/* ── 4. Focus header (replaces inline eyebrow + title + selection + nav + AI) ── */}
                <PickFocusHeader
                  activeSection={activeSection}
                  activePrompt={activePrompt}
                  activePromptKey={activePromptKey}
                  activeIndex={activeIndex}
                  totalPrompts={totalPrompts}
                  currentMeta={currentMeta}
                  interactionLocked={interactionLocked}
                  emptyLabel={emptySelectionLabel(activePrompt, aiByKey)}
                  onClear={() => setPick(activePromptKey, null)}
                  onPrev={() => previousPrompt && setActivePromptKey(previousPrompt.key)}
                  onNext={() => nextPromptItem && setActivePromptKey(nextPromptItem.key)}
                  previousPrompt={previousPrompt}
                  nextPromptItem={nextPromptItem}
                  activeAi={activeAi}
                  isProSubscriber={isProSubscriber}
                  AI_CONF_COLOR={AI_CONF_COLOR}
                  confPctOf={confPct}
                  isMobile={isMobile}
                />

                {/* Hidden — preserved as dead code for revertibility */}
                {false && (<div
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
                </div>)}

                {/* Options area */}
                <div key={`options-${activePromptKey}`} className="stint-focus-enter" style={{ padding: isMobile ? 14 : 20, display: "grid", gap: 14 }}>
                  {/* ── Double Down controls — Home-level card ── */}
                  {selectedLeague?.gameMode === "double_down" && (
                    <div style={{
                      position: "relative",
                      overflow: "hidden",
                      borderRadius: CARD_RADIUS,
                      border: `1px solid ${hexToRgba(ACCENT, 0.28)}`,
                      background: `linear-gradient(135deg, ${hexToRgba(ACCENT, 0.12)} 0%, ${hexToRgba(ACCENT, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
                      padding: "16px 18px",
                      boxShadow: CARD_SHADOW,
                    }}>
                      <span aria-hidden="true" style={{
                        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                        background: ACCENT, opacity: 0.78,
                      }} />
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        padding: "3px 10px", borderRadius: RADIUS_PILL,
                        background: hexToRgba(ACCENT, 0.14),
                        border: `1px solid ${hexToRgba(ACCENT, 0.32)}`,
                        marginBottom: 10,
                      }}>
                        <span aria-hidden="true" style={{ fontSize: 13, fontWeight: 900, color: ACCENT, fontFamily: "var(--font-mono)", letterSpacing: "-0.04em", lineHeight: 1 }}>3×</span>
                        <span style={{
                          fontSize: 10, fontWeight: 900,
                          letterSpacing: "0.16em", textTransform: "uppercase",
                          color: ACCENT,
                        }}>Double Down</span>
                      </div>
                      <div style={{
                        fontSize: 13.5, lineHeight: 1.6, color: MUTED_TEXT,
                        marginBottom: 14,
                        letterSpacing: "-0.005em",
                        fontWeight: 500,
                        maxWidth: "60ch",
                      }}>
                        Pick one category to score 3× if you get it right. Miss it and that slot scores <span style={{ color: "#f87171", fontWeight: 800 }}>−1</span> instead.
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {allPrompts.filter((prompt) => picks[prompt.key]).length === 0 ? (
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: SUBTLE_TEXT,
                            fontStyle: "italic",
                            letterSpacing: "-0.005em",
                          }}>Pick a category first, then come back to arm it.</span>
                        ) : (
                          allPrompts.filter((prompt) => picks[prompt.key]).map((prompt) => {
                            const isArmed = doubleDownKey === prompt.key;
                            return (
                              <button
                                key={`dd-${prompt.key}`}
                                onClick={() => toggleDoubleDown(prompt.key)}
                                className="stint-pressable"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 7,
                                  minHeight: 38,
                                  padding: "0 14px",
                                  borderRadius: RADIUS_PILL,
                                  border: isArmed
                                    ? `1px solid ${hexToRgba(ACCENT, 0.46)}`
                                    : `1px solid ${HAIRLINE}`,
                                  background: isArmed
                                    ? `linear-gradient(135deg, ${hexToRgba(ACCENT, 0.22)}, ${hexToRgba(ACCENT, 0.06)})`
                                    : "rgba(148,163,184,0.05)",
                                  color: isArmed ? ACCENT : TEXT_PRIMARY,
                                  fontSize: 12.5,
                                  fontWeight: 800,
                                  cursor: interactionLocked ? "default" : "pointer",
                                  fontFamily: "inherit",
                                  letterSpacing: "-0.005em",
                                  boxShadow: isArmed ? `0 6px 16px ${hexToRgba(ACCENT, 0.20)}` : "none",
                                  transition: "background 200ms ease, border-color 200ms ease, box-shadow 220ms ease",
                                }}
                                disabled={interactionLocked}
                              >
                                {isArmed && (
                                  <span style={{
                                    fontSize: 11, fontWeight: 900,
                                    fontFamily: "var(--font-mono)",
                                    letterSpacing: "-0.04em",
                                    color: ACCENT,
                                  }}>3×</span>
                                )}
                                {prompt.label}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Budget Picks controls — Home-level card with mono counter ── */}
                  {selectedLeague?.gameMode === "budget_picks" && (() => {
                    const isBalanced = budgetTotal === 50;
                    const isOver = budgetTotal > 50;
                    const counterColor = isBalanced ? SUCCESS : isOver ? "#f87171" : ACCENT;
                    return (
                      <div style={{
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: CARD_RADIUS,
                        border: `1px solid ${hexToRgba(ACCENT, 0.28)}`,
                        background: `linear-gradient(135deg, ${hexToRgba(ACCENT, 0.12)} 0%, ${hexToRgba(ACCENT, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
                        padding: "16px 18px",
                        boxShadow: CARD_SHADOW,
                        display: "grid", gap: 14,
                      }}>
                        <span aria-hidden="true" style={{
                          position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                          background: ACCENT, opacity: 0.78,
                        }} />
                        <div>
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 7,
                            padding: "3px 10px", borderRadius: RADIUS_PILL,
                            background: hexToRgba(ACCENT, 0.14),
                            border: `1px solid ${hexToRgba(ACCENT, 0.32)}`,
                            marginBottom: 10,
                          }}>
                            <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>💰</span>
                            <span style={{
                              fontSize: 10, fontWeight: 900,
                              letterSpacing: "0.16em", textTransform: "uppercase",
                              color: ACCENT,
                            }}>Budget Picks</span>
                          </div>
                          <div style={{
                            fontSize: 13.5, lineHeight: 1.6, color: MUTED_TEXT,
                            letterSpacing: "-0.005em",
                            fontWeight: 500,
                            maxWidth: "60ch",
                          }}>
                            Spread exactly <span style={{ color: TEXT_PRIMARY, fontWeight: 800 }}>50 credits</span> across the categories you believe in most. Every selected category needs between <span style={{ color: TEXT_PRIMARY, fontWeight: 800 }}>1 and 20</span> credits.
                          </div>
                        </div>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          gap: 14, flexWrap: "wrap",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                              display: "inline-flex", alignItems: "baseline", gap: 8,
                              padding: "8px 14px", borderRadius: RADIUS_PILL,
                              background: "rgba(6,16,27,0.50)",
                              border: `1px solid ${hexToRgba(counterColor, 0.34)}`,
                            }}>
                              <span style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 18, fontWeight: 700,
                                color: counterColor,
                                letterSpacing: "-0.04em",
                                fontVariantNumeric: "tabular-nums",
                                lineHeight: 1,
                              }}>{budgetTotal}<span style={{ color: "rgba(148,163,184,0.45)", margin: "0 2px" }}>/</span>50</span>
                              <span style={{
                                fontSize: 9, fontWeight: 900,
                                letterSpacing: "0.16em", textTransform: "uppercase",
                                color: counterColor,
                              }}>{isBalanced ? "balanced" : isOver ? "over" : "credits"}</span>
                            </div>
                            {!picks[activePrompt?.key] && (
                              <span style={{
                                fontSize: 12, fontWeight: 600,
                                color: SUBTLE_TEXT,
                                letterSpacing: "-0.005em",
                                fontStyle: "italic",
                              }}>Pick this category first.</span>
                            )}
                          </div>
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: 4,
                            borderRadius: RADIUS_PILL,
                            background: "rgba(6,16,27,0.42)",
                            border: `1px solid ${HAIRLINE}`,
                          }}>
                            <button
                              onClick={() => adjustBudgetAmount(activePrompt?.key, -1)}
                              disabled={interactionLocked || !picks[activePrompt?.key]}
                              className="stint-pressable"
                              style={{
                                width: 38, height: 38, borderRadius: "50%",
                                border: "none",
                                background: picks[activePrompt?.key] ? hexToRgba(ACCENT, 0.10) : "transparent",
                                color: picks[activePrompt?.key] ? ACCENT : SUBTLE_TEXT,
                                cursor: interactionLocked || !picks[activePrompt?.key] ? "default" : "pointer",
                                fontSize: 20, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: picks[activePrompt?.key] ? 1 : 0.45,
                                transition: "background 180ms ease",
                              }}
                            >−</button>
                            <span style={{
                              minWidth: 40,
                              textAlign: "center",
                              fontFamily: "var(--font-mono)",
                              fontSize: 20, fontWeight: 700,
                              color: activeBudgetAmount > 0 ? TEXT_PRIMARY : SUBTLE_TEXT,
                              letterSpacing: "-0.04em",
                              fontVariantNumeric: "tabular-nums",
                              lineHeight: 1,
                            }}>{activeBudgetAmount}</span>
                            <button
                              onClick={() => adjustBudgetAmount(activePrompt?.key, 1)}
                              disabled={interactionLocked || !picks[activePrompt?.key]}
                              className="stint-pressable"
                              style={{
                                width: 38, height: 38, borderRadius: "50%",
                                border: "none",
                                background: picks[activePrompt?.key] ? hexToRgba(ACCENT, 0.10) : "transparent",
                                color: picks[activePrompt?.key] ? ACCENT : SUBTLE_TEXT,
                                cursor: interactionLocked || !picks[activePrompt?.key] ? "default" : "pointer",
                                fontSize: 20, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: picks[activePrompt?.key] ? 1 : 0.45,
                                transition: "background 180ms ease",
                              }}
                            >+</button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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

          {/* ── Partial save warning — Home-level card with tone rail ── */}
          {showPartialWarning && (
            <div style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: CARD_RADIUS,
              border: `1px solid ${WARN_BORDER}`,
              background: `linear-gradient(135deg, ${hexToRgba("#fcd34d", 0.10)} 0%, ${hexToRgba("#fcd34d", 0.02)} 60%, ${PANEL_BG} 100%)`,
              padding: "18px 22px",
              boxShadow: CARD_SHADOW,
              display: "grid", gap: 14,
            }}>
              <span aria-hidden="true" style={{
                position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                background: "#fcd34d", opacity: 0.78,
              }} />
              <div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  marginBottom: 8,
                }}>
                  <span aria-hidden="true" style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#fcd34d",
                    boxShadow: "0 0 0 4px rgba(252,211,77,0.16)",
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 900,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    color: WARN_TEXT,
                  }}>Board incomplete</span>
                </div>
                <div className="stint-card-title" style={{
                  fontSize: 17, fontWeight: 900,
                  letterSpacing: "-0.025em", lineHeight: 1.16,
                  color: TEXT_PRIMARY,
                  marginBottom: 5,
                }}>{done} of {totalPrompts} picks filled</div>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: MUTED_TEXT,
                  letterSpacing: "-0.005em",
                  lineHeight: 1.55,
                  maxWidth: "60ch",
                }}>You can save partial in {selectedLeague?.name || "this league"}, or go back to complete it before locking in.</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setShowPartialWarning(false);
                    const firstEmpty = allPrompts.find((p) => !picks[p.key]);
                    if (firstEmpty) setActivePromptKey(firstEmpty.key);
                    boardRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="stint-pressable"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    minHeight: 40,
                    border: `1px solid ${WARN_BORDER}`,
                    borderRadius: RADIUS_PILL,
                    background: hexToRgba("#fcd34d", 0.10),
                    color: WARN_TEXT,
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 13,
                    padding: "0 18px",
                    fontFamily: "inherit",
                    letterSpacing: "-0.005em",
                  }}
                >
                  Complete board
                  <span aria-hidden="true" style={{ fontSize: 12 }}>→</span>
                </button>
                <button
                  onClick={save}
                  className="stint-pressable"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    minHeight: 40,
                    border: "none",
                    borderRadius: RADIUS_PILL,
                    background: "linear-gradient(135deg, #fcd34d, #f59e0b)",
                    color: "#1a1a1a",
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 13,
                    padding: "0 20px",
                    fontFamily: "inherit",
                    letterSpacing: "-0.005em",
                    boxShadow: "0 8px 20px rgba(252,211,77,0.30)",
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
