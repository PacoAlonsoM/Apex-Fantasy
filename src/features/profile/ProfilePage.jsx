"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { ACTIVE_CAL, ACTIVE_RACE_COUNT, CAL, isRaceCancelled, nextRace } from "@/src/constants/calendar";
import { PTS } from "@/src/constants/scoring";
import {
  ACCENT,
  AI_BLUE,
  AI_BLUE_BORDER,
  AI_BLUE_SOFT,
  AI_BLUE_TEXT,
  AVATAR_THEMES,
  BRAND_GRADIENT,
  CARD_RADIUS,
  CARD_SHADOW,
  DEFAULT_AVATAR_COLOR,
  ERROR_BG,
  ERROR_BORDER,
  ERROR_TEXT,
  HAIRLINE,
  LIFTED_SHADOW,
  LIVE_GREEN,
  LIVE_GREEN_GLOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  PRO_AMBER_BG,
  PRO_AMBER_BORDER,
  PRO_AMBER_DOT,
  PRO_AMBER_TEXT,
  RADIUS_MD,
  RADIUS_PILL,
  SECTION_RADIUS,
  SUBTLE_TEXT,
  SUCCESS_BG,
  SUCCESS_BORDER,
  SUCCESS_TEXT,
  TEAM_AVATAR_OPTIONS,
  TEXT_PRIMARY,
  avatarTheme,
  isAdminUser,
  rgbaFromHex,
  teamSupportKey,
} from "@/src/constants/design";
import { backfillAiReplayHistory } from "@/src/features/admin/adminApi";
import { formatDnfDrivers, matchesDnfPick } from "@/src/lib/resultHelpers";
import { isUsernameTaken, requireActiveSession, sanitizeUsername } from "@/src/shell/authProfile";
import { pageToHref } from "@/src/shell/routing";
import useViewport from "@/src/lib/useViewport";
import useThemePreference from "@/src/lib/useThemePreference";
import useDensityPreference from "@/src/lib/useDensityPreference";
import Kicker from "@/src/ui/Kicker";
import PageShell from "@/src/ui/PageShell";
import { animateNumber, withViewTransition } from "@/src/lib/viewTransition";
import useReveal from "@/src/lib/useReveal";
import ProBadge from "@/src/ui/ProBadge";
import IdentityAvatar from "@/src/ui/IdentityAvatar";

// ─── Constants ────────────────────────────────────────────────────────────────

const INSIGHT_CATEGORY_META = [
  { key: "winner",    label: "Race Winner",      shortLabel: "Winner"          },
  { key: "pole",      label: "Pole Position",    shortLabel: "Pole"            },
  { key: "p2",        label: "2nd Place",        shortLabel: "P2"              },
  { key: "p3",        label: "3rd Place",        shortLabel: "P3"              },
  { key: "dnf",       label: "DNF Driver",       shortLabel: "DNF"             },
  { key: "fl",        label: "Fastest Lap",      shortLabel: "Fastest Lap"     },
  { key: "dotd",      label: "Driver of the Day", shortLabel: "Driver of the Day" },
  { key: "ctor",      label: "Best Constructor", shortLabel: "Constructor"     },
  { key: "sc",        label: "Safety Car",       shortLabel: "Safety Car"      },
  { key: "rf",        label: "Red Flag",         shortLabel: "Red Flag"        },
  { key: "sp_winner", label: "Sprint Winner",    shortLabel: "Sprint Winner"   },
  { key: "sp_pole",   label: "Sprint Pole",      shortLabel: "Sprint Pole"     },
  { key: "sp_p2",     label: "Sprint 2nd",       shortLabel: "Sprint P2"       },
  { key: "sp_p3",     label: "Sprint 3rd",       shortLabel: "Sprint P3"       },
];

const FOUNDATION_KEYS = new Set(["winner", "pole", "ctor", "sp_winner", "sp_pole"]);
const PODIUM_KEYS     = new Set(["p2", "p3", "sp_p2", "sp_p3"]);
const VOLATILITY_KEYS = new Set(["dnf", "fl", "dotd", "sc", "rf"]);

const SAMPLE_INSIGHTS = [
  {
    label:    "Race Debrief",
    raceName: "Bahrain Grand Prix",
    date:     "Mar 2",
    content:  "Strong race this weekend — you nailed pole and the winner, which put you in the top 20% of the room. Your DNF call didn't land, but the fastest lap pick was a smart read given the tyre degradation pattern. For the next race, lean harder on the P2/P3 categories where you've been leaving points on the table.",
  },
  {
    label:    "Pre-Race Tip",
    raceName: "Saudi Arabian Grand Prix",
    date:     "Mar 9",
    content:  "Jeddah rewards raw pace over tyre management, which historically makes the pole-sitter the safest winner pick of the season. Your recent accuracy on winner picks (68%) is your strongest category — prioritise it. The DNF rate here is high due to wall proximity; a midfield pick has a real chance of landing.",
  },
  {
    label:    "Season Report",
    raceName: null,
    date:     "Mar 31",
    content:  "March was your best month so far: 71% accuracy across 18 picks and 47 points. Your pole picks are nearly automatic at 85% — keep trusting that read. Fastest lap is your weakest at 33%; consider fading the obvious leader and targeting the first car to pit late. You're currently on a 4-pick correct streak going into April.",
  },
];

const TABS = [
  { key: "history",  label: "History",  pro: true },
  { key: "insights", label: "Insights", pro: true },
  { key: "account",  label: "Account",  pro: false },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function isScoredPrediction(prediction) {
  return prediction?.score_breakdown !== null && prediction?.score_breakdown !== undefined;
}

function raceNameForRound(round) {
  return CAL.find((item) => item.r === round)?.n || `Round ${round}`;
}

function insightTypeLabel(type) {
  if (type === "post_race") return "Race Debrief";
  if (type === "pre_race")  return "Pre-Race Tip";
  return "Season Report";
}

// Rough reading time in minutes — assumes ~210 wpm, rounded up to whole minutes.
function readingMinutes(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 1;
  return Math.max(1, Math.round(words / 210));
}

// Color key for insight type — used for cover + reader accents
function insightTypeAccent(type) {
  if (type === "monthly")   return ACCENT;        // Season report — brand
  if (type === "pre_race")  return "#fbbf24";    // Pre-race — amber
  return AI_BLUE_TEXT;                            // Race debrief — blue (default)
}

async function parseJsonResponse(response, fallbackMessage) {
  const raw = await response.text();
  if (!raw) {
    if (!response.ok) throw new Error(fallbackMessage);
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(response.ok ? "Unexpected response from the server." : fallbackMessage);
  }
}

async function buildInsightRequestHeaders(userId, includeJson = false) {
  const headers = { "x-user-id": userId };
  if (includeJson) headers["Content-Type"] = "application/json";
  try {
    const session = await requireActiveSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  } catch (_error) {
    // Fall back to the existing user-id header path.
  }
  return headers;
}

async function persistSupportMetadata(payload) {
  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      avatar_color:  payload.avatar_color,
      favorite_team: payload.favorite_team,
    },
  });
  return metadataError || null;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function formatSubscriptionEndLabel(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ─── Season + AI breakdown ────────────────────────────────────────────────────

function buildSeasonBreakdown(predictions) {
  const scoredPredictions = (predictions || [])
    .filter(isScoredPrediction)
    .sort((a, b) => (a.race_round || 0) - (b.race_round || 0));

  const categories = new Map(
    INSIGHT_CATEGORY_META.map((category) => [category.key, { ...category, total: 0, correct: 0, points: 0 }])
  );

  let totalPoints = 0;
  let totalPicks = 0;
  let totalCorrect = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let bestRace = null;
  const recentRaces = [];

  for (const prediction of scoredPredictions) {
    const breakdown = Array.isArray(prediction?.score_breakdown) ? prediction.score_breakdown : [];
    const pointsByLabel = new Map(breakdown.map((item) => [item?.label, Number(item?.pts || 0)]));

    let raceCorrect = 0;
    let raceTotal = 0;

    for (const category of INSIGHT_CATEGORY_META) {
      const pickedValue = prediction?.picks?.[category.key];
      if (!pickedValue) continue;

      raceTotal += 1;
      totalPicks += 1;

      const entry = categories.get(category.key);
      entry.total += 1;

      if (pointsByLabel.has(category.label)) {
        const scoredPoints = Number(pointsByLabel.get(category.label) || 0);
        entry.correct += 1;
        entry.points += scoredPoints;
        totalCorrect += 1;
        raceCorrect += 1;
        currentStreak += 1;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    const raceScore = Number(prediction?.score || 0);
    const raceSummary = {
      round:     prediction?.race_round || 0,
      raceName:  raceNameForRound(prediction?.race_round),
      score:     raceScore,
      correct:   raceCorrect,
      total:     raceTotal,
      accuracy:  raceTotal ? Math.round((raceCorrect / raceTotal) * 100) : 0,
    };

    totalPoints += raceScore;
    recentRaces.push(raceSummary);
    if (!bestRace || raceScore > bestRace.score) bestRace = raceSummary;
  }

  const rankedCategories = [...categories.values()]
    .filter((category) => category.total > 0)
    .map((category) => ({
      ...category,
      accuracy: category.total ? Math.round((category.correct / category.total) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.total - a.total;
    });

  const eligibleCategories = rankedCategories.filter((category) => category.total >= 2);
  const strongestPool = eligibleCategories.length ? eligibleCategories : rankedCategories;
  const strongestCategory = strongestPool[0] || null;
  const weakestCategory = [...strongestPool]
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      if (a.points !== b.points) return a.points - b.points;
      return b.total - a.total;
    })[0] || null;

  const recentForm = [...recentRaces].sort((a, b) => b.round - a.round).slice(0, 5);
  const recentAverage = recentForm.length
    ? Math.round(recentForm.reduce((sum, race) => sum + race.score, 0) / recentForm.length)
    : 0;
  const averageScore = scoredPredictions.length ? Math.round(totalPoints / scoredPredictions.length) : 0;

  return {
    scoredRounds:       scoredPredictions.length,
    totalPoints,
    totalPicks,
    totalCorrect,
    accuracy:           totalPicks ? Math.round((totalCorrect / totalPicks) * 100) : 0,
    averageScore,
    recentAverage,
    trendDelta:         recentAverage - averageScore,
    currentStreak,
    longestStreak,
    bestRace,
    strongestCategory,
    weakestCategory,
    categories:         rankedCategories,
    recentForm,
  };
}

function didPredictionHit(categoryKey, pickedValue, results) {
  if (!results || !pickedValue) return false;
  switch (categoryKey) {
    case "pole":      return pickedValue === results.pole;
    case "winner":    return pickedValue === results.winner;
    case "p2":        return pickedValue === results.p2;
    case "p3":        return pickedValue === results.p3;
    case "dnf":       return matchesDnfPick(pickedValue, results);
    case "fl":        return pickedValue === results.fastest_lap;
    case "dotd":      return pickedValue === results.dotd;
    case "ctor":      return pickedValue === results.best_constructor;
    case "sc":        return pickedValue === "Yes" && !!results.safety_car;
    case "rf":        return pickedValue === "Yes" && !!results.red_flag;
    case "sp_pole":   return pickedValue === results.sp_pole;
    case "sp_winner": return pickedValue === results.sp_winner;
    case "sp_p2":     return pickedValue === results.sp_p2;
    case "sp_p3":     return pickedValue === results.sp_p3;
    default:          return false;
  }
}

function actualForCategory(categoryKey, results) {
  if (!results) return null;
  switch (categoryKey) {
    case "pole":      return results.pole || null;
    case "winner":    return results.winner || null;
    case "p2":        return results.p2 || null;
    case "p3":        return results.p3 || null;
    case "dnf":       return formatDnfDrivers(results) || null;
    case "fl":        return results.fastest_lap || null;
    case "dotd":      return results.dotd || null;
    case "ctor":      return results.best_constructor || null;
    case "sc":        return results.safety_car ? "Yes" : "No";
    case "rf":        return results.red_flag ? "Yes" : "No";
    case "sp_pole":   return results.sp_pole || null;
    case "sp_winner": return results.sp_winner || null;
    case "sp_p2":     return results.sp_p2 || null;
    case "sp_p3":     return results.sp_p3 || null;
    default:          return null;
  }
}

function aiPredictionProviderInfo(row) {
  const provider = String(row?.provider || "").trim().toLowerCase();
  const scope = String(row?.scope || "").trim().toLowerCase();
  const isReplay = provider.includes("replay") || scope.includes("replay");
  const isFallback = provider.includes("fallback");
  const isOpenAi = provider.includes("openai") && !isFallback;

  return {
    provider,
    scope,
    isReplay,
    isFallback,
    isOpenAi,
    priority: !isReplay && isOpenAi ? 50
      : isReplay && isOpenAi ? 40
        : !isReplay && !isFallback ? 30
          : !isReplay && isFallback ? 20
            : isReplay && isFallback ? 10
              : 0,
  };
}

function chooseAiBenchmarkRow(current, candidate) {
  if (!current) return candidate;

  const currentInfo = aiPredictionProviderInfo(current);
  const candidateInfo = aiPredictionProviderInfo(candidate);
  if (candidateInfo.priority !== currentInfo.priority) {
    return candidateInfo.priority > currentInfo.priority ? candidate : current;
  }

  const currentTime = new Date(current?.generated_at || 0).getTime();
  const candidateTime = new Date(candidate?.generated_at || 0).getTime();
  return candidateTime >= currentTime ? candidate : current;
}

function summarizeAiHistorySource(rows) {
  const counts = rows.reduce((summary, row) => {
    const info = aiPredictionProviderInfo(row);
    if (info.isReplay) summary.replay += 1;
    else summary.live += 1;
    if (info.isOpenAi) summary.openai += 1;
    if (info.isFallback) summary.fallback += 1;
    return summary;
  }, { live: 0, replay: 0, openai: 0, fallback: 0 });

  const hasLiveOpenAi = rows.some((row) => {
    const info = aiPredictionProviderInfo(row);
    return !info.isReplay && info.isOpenAi;
  });
  const hasReplayOpenAi = rows.some((row) => {
    const info = aiPredictionProviderInfo(row);
    return info.isReplay && info.isOpenAi;
  });
  const hasLiveFallback = rows.some((row) => {
    const info = aiPredictionProviderInfo(row);
    return !info.isReplay && info.isFallback;
  });

  if (hasLiveOpenAi) {
    return { mode: "live", label: "Live AI history", detail: "latest pre-race OpenAI board", counts };
  }
  if (hasReplayOpenAi) {
    return { mode: "replay", label: "Replay AI history", detail: "historical OpenAI replay benchmark", counts };
  }
  if (hasLiveFallback) {
    return { mode: "fallback", label: "Fallback AI history", detail: "stored fallback board", counts };
  }
  return { mode: "fallback_replay", label: "Fallback replay history", detail: "historical fallback benchmark", counts };
}

function describeRaceDrillDown(prediction, result) {
  const breakdown = Array.isArray(prediction?.score_breakdown) ? prediction.score_breakdown : [];
  const pointsByLabel = new Map(breakdown.map((row) => [row?.label, Number(row?.pts || 0)]));

  return INSIGHT_CATEGORY_META
    .map((category) => {
      const pick = prediction?.picks?.[category.key] || null;
      if (!pick) return null;
      const pts = Number(pointsByLabel.get(category.label) || 0);
      const hit = pts > 0 || didPredictionHit(category.key, pick, result);
      return {
        key:        category.key,
        label:      category.label,
        shortLabel: category.shortLabel,
        pick,
        actual:     actualForCategory(category.key, result),
        hit,
        pts,
      };
    })
    .filter(Boolean);
}

function buildAiHistoryBreakdown(predictionRows, resultsRows) {
  const resultsByRound = new Map(
    (Array.isArray(resultsRows) ? resultsRows : [])
      .filter((row) => row?.results_entered)
      .map((row) => [Number(row?.race_round || 0), row])
  );

  const latestRowsByCategoryRace = new Map();
  let eligibleStoredRows = 0;
  for (const row of Array.isArray(predictionRows) ? predictionRows : []) {
    const round = Number(row?.race_round || 0);
    const categoryKey = String(row?.category_key || "");
    if (!round || !categoryKey || !resultsByRound.has(round)) continue;

    const dedupeKey = `${round}:${categoryKey}`;
    eligibleStoredRows += 1;
    const existing = latestRowsByCategoryRace.get(dedupeKey);
    latestRowsByCategoryRace.set(dedupeKey, chooseAiBenchmarkRow(existing, row));
  }

  const categories = new Map(
    INSIGHT_CATEGORY_META.map((category) => [category.key, { ...category, total: 0, correct: 0, points: 0 }])
  );

  let totalPoints = 0;
  let totalPicks = 0;
  let totalCorrect = 0;
  let latestGeneratedAt = null;
  const raceSummaries = new Map();
  const benchmarkRows = [...latestRowsByCategoryRace.values()].sort((a, b) => (a.race_round || 0) - (b.race_round || 0));
  const sourceSummary = summarizeAiHistorySource(benchmarkRows);

  for (const row of benchmarkRows) {
    const round = Number(row?.race_round || 0);
    const categoryKey = String(row?.category_key || "");
    const result = resultsByRound.get(round);
    const category = categories.get(categoryKey);
    if (!result || !category) continue;

    const hit = didPredictionHit(categoryKey, row?.predicted_value, result);
    const awardedPoints = hit ? Number(PTS[categoryKey] || 0) : 0;

    totalPicks += 1;
    category.total += 1;
    if (hit) {
      totalCorrect += 1;
      totalPoints += awardedPoints;
      category.correct += 1;
      category.points += awardedPoints;
    }

    const summary = raceSummaries.get(round) || {
      round,
      raceName: row?.race_name || raceNameForRound(round),
      score: 0, correct: 0, total: 0, accuracy: 0,
    };
    summary.total += 1;
    if (hit) { summary.correct += 1; summary.score += awardedPoints; }
    summary.accuracy = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
    raceSummaries.set(round, summary);

    if (!latestGeneratedAt || new Date(row?.generated_at || 0).getTime() > new Date(latestGeneratedAt).getTime()) {
      latestGeneratedAt = row?.generated_at || latestGeneratedAt;
    }
  }

  const rankedCategories = [...categories.values()]
    .filter((category) => category.total > 0)
    .map((category) => ({
      ...category,
      accuracy: category.total ? Math.round((category.correct / category.total) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.total - a.total;
    });

  const raceList = [...raceSummaries.values()];
  const recentForm = [...raceList].sort((a, b) => b.round - a.round).slice(0, 5);
  const bestRace = [...raceList].sort((a, b) => b.score - a.score)[0] || null;

  return {
    available:       raceList.length > 0,
    mode:            sourceSummary.mode,
    sourceLabel:     sourceSummary.label,
    sourceDetail:    sourceSummary.detail,
    sourceCounts:    sourceSummary.counts,
    storedRows:      eligibleStoredRows,
    benchmarkRows:   benchmarkRows.length,
    scoredRounds:    raceList.length,
    totalPoints,
    totalPicks,
    totalCorrect,
    accuracy:        totalPicks ? Math.round((totalCorrect / totalPicks) * 100) : 0,
    averageScore:    raceList.length ? Math.round(totalPoints / raceList.length) : 0,
    categories:      rankedCategories,
    recentForm,
    bestRace,
    latestGeneratedAt,
  };
}

function buildAiCoach(breakdown, aiHistory) {
  const categoryRows = breakdown?.categories || [];
  const foundationAccuracy = average(categoryRows.filter((row) => FOUNDATION_KEYS.has(row.key)).map((row) => row.accuracy));
  const podiumAccuracy     = average(categoryRows.filter((row) => PODIUM_KEYS.has(row.key)).map((row) => row.accuracy));
  const volatilityAccuracy = average(categoryRows.filter((row) => VOLATILITY_KEYS.has(row.key)).map((row) => row.accuracy));

  const archetypeCandidates = [
    { key: "front-runner", label: "Front-Runner Reader", score: foundationAccuracy, description: "Your edge shows up when the board runs through pole, winner, and constructor reads before the chaos categories kick in." },
    { key: "podium",       label: "Podium Sculptor",      score: podiumAccuracy,     description: "You separate from the room by finding value in the supporting podium slots instead of relying only on the obvious headline picks." },
    { key: "chaos",        label: "Chaos Hunter",         score: volatilityAccuracy, description: "You create upside when weekends get messy and the swing categories start moving the board." },
  ].filter((candidate) => candidate.score !== null);

  const archetype = archetypeCandidates.sort((a, b) => (b.score || 0) - (a.score || 0))[0] || {
    key:         "balanced",
    label:       "Balanced Board",
    score:       breakdown?.accuracy ?? 0,
    description: "Your profile is still broad, so the AI sees more of an all-rounder than a single-category specialist right now.",
  };

  const confidence = breakdown?.scoredRounds >= 6 && breakdown?.totalPicks >= 45
    ? { label: "High confidence",     detail: "Enough scored volume to trust the model read." }
    : breakdown?.scoredRounds >= 3 && breakdown?.totalPicks >= 24
      ? { label: "Building confidence", detail: "The model has a useful read, but more rounds will sharpen it." }
      : { label: "Early read",          detail: "This is directional until more scored races come in." };

  const trend = breakdown?.trendDelta >= 5
    ? { label: "Heating up", detail: "Recent weekends are running above your season pace." }
    : breakdown?.trendDelta <= -5
      ? { label: "Cooling off", detail: "Recent form has dropped below your season baseline." }
      : { label: "Stable",      detail: "Recent form is tracking close to your season baseline." };

  const aiCategoryMap = new Map((aiHistory?.categories || []).map((category) => [category.key, category]));
  const comparisonRows = categoryRows
    .map((category) => {
      const aiCategory = aiCategoryMap.get(category.key);
      if (!aiCategory) return null;
      return { ...category, aiAccuracy: aiCategory.accuracy, aiPoints: aiCategory.points, delta: category.accuracy - aiCategory.accuracy };
    })
    .filter(Boolean);

  const comparisonWins   = [...comparisonRows].filter((row) => row.delta >= 0).sort((a, b) => b.delta - a.delta);
  const comparisonLosses = [...comparisonRows].filter((row) => row.delta < 0).sort((a, b) => a.delta - b.delta);
  const comparisonAvailable = !!aiHistory?.available && comparisonRows.length > 0;
  const comparisonDelta = comparisonAvailable ? (breakdown?.accuracy || 0) - (aiHistory?.accuracy || 0) : null;

  const verdict = comparisonAvailable
    ? comparisonDelta >= 8 ? "Outscoring stored AI picks"
      : comparisonDelta >= 2 ? "Slightly ahead of stored AI picks"
        : comparisonDelta <= -8 ? "Stored AI picks still have the edge"
          : "Running level with stored AI picks"
    : breakdown?.accuracy >= 60 && (breakdown?.trendDelta ?? 0) >= 0 ? "Your read is getting sharper"
      : breakdown?.accuracy >= 50 ? "Solid board, still early"
        : (breakdown?.trendDelta ?? 0) >= 5 ? "Form is improving"
          : "Early pattern read";

  const historyStatusLabel  = comparisonAvailable ? (aiHistory?.sourceLabel || "AI history") : "No AI history";
  const historyStatusDetail = comparisonAvailable
    ? `${aiHistory.scoredRounds} race${aiHistory.scoredRounds === 1 ? "" : "s"} · ${aiHistory.totalPicks} benchmark picks`
    : "No stored races yet";
  const comparisonSummary   = comparisonAvailable
    ? `${comparisonWins.length}/${comparisonRows.length} tracked categories are ahead of ${String(aiHistory?.sourceLabel || "stored AI").toLowerCase()}.`
    : "No stored AI history yet.";

  let nextMoveTitle  = "Protect the floor";
  let nextMoveDetail = `Keep leaning on ${breakdown?.strongestCategory?.shortLabel || "your strongest reads"} while tightening ${breakdown?.weakestCategory?.shortLabel || "your weakest category"} so the board stops leaking easy points.`;

  if (comparisonAvailable && (comparisonDelta ?? 0) >= 5 && (breakdown?.trendDelta ?? 0) >= 0) {
    nextMoveTitle  = "Press the edge";
    nextMoveDetail = `The coach would keep trusting ${breakdown?.strongestCategory?.shortLabel || "your strongest category"} and only make one deliberate upgrade in ${breakdown?.weakestCategory?.shortLabel || "your weakest spot"} instead of changing everything at once.`;
  } else if ((foundationAccuracy ?? 0) < 40) {
    nextMoveTitle  = "Rebuild the foundation";
    nextMoveDetail = "Simplify the board around pole, winner, and constructor reads first, then reintroduce the higher-volatility categories after the core is stable.";
  } else if ((volatilityAccuracy ?? 0) > (foundationAccuracy ?? 0) + 8) {
    nextMoveTitle  = "Use the chaos selectively";
    nextMoveDetail = "Your upside comes from the swing categories, but the coach would still anchor the board with one or two dependable front-runner calls before chasing variance.";
  } else if ((breakdown?.trendDelta ?? 0) <= -5) {
    nextMoveTitle  = "Cut the noise";
    nextMoveDetail = `Recent form is trailing your season pace, so the coach would stop overextending in ${breakdown?.weakestCategory?.shortLabel || "the noisiest category"} and go back to high-conviction picks only.`;
  }

  return {
    archetype,
    confidence,
    trend,
    verdict,
    comparisonAvailable,
    comparisonRows,
    comparisonWins,
    comparisonLosses,
    comparisonDelta,
    comparisonSummary,
    historyStatusLabel,
    historyStatusDetail,
    protectCategory:   breakdown?.strongestCategory || null,
    challengeCategory: breakdown?.weakestCategory || null,
    nextMoveTitle,
    nextMoveDetail,
  };
}

function normalizeInsights(insights) {
  const sorted = [...(Array.isArray(insights) ? insights : [])].sort((a, b) =>
    new Date(b?.generated_at || 0).getTime() - new Date(a?.generated_at || 0).getTime()
  );

  let hasMonthly = false;
  return sorted.filter((insight) => {
    if (insight?.insight_type !== "monthly") return true;
    if (hasMonthly) return false;
    hasMonthly = true;
    return true;
  });
}

// ─── Presentational sub-components ────────────────────────────────────────────

// Shared section head used across all four tabs — kicker (uppercase, color-keyed)
// + big Sora 800 title + optional right-aligned meta. Replaces the ad-hoc
// header markup the page used to inline at every section.
function SectionHead({ kicker, title, meta, color = ACCENT, isMobile }) {
  return (
    <header style={{
      display:        "flex",
      alignItems:     "baseline",
      justifyContent: "space-between",
      gap:            12,
      marginBottom:   isMobile ? 14 : 18,
      flexWrap:       "wrap",
    }}>
      <div style={{ minWidth: 0 }}>
        {kicker && (
          <div style={{
            display:       "inline-flex",
            alignItems:    "center",
            gap:           6,
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color,
            marginBottom:  6,
          }}>
            <span aria-hidden="true" style={{
              display:    "inline-block",
              width:      14,
              height:     1,
              background: color,
              opacity:    0.6,
            }} />
            {kicker}
          </div>
        )}
        <h2 className="stint-section-title" style={{
          margin: 0,
          fontSize:      isMobile ? 22 : 28,
          letterSpacing: "-0.035em",
          lineHeight:    1.12,
        }}>
          {title}
        </h2>
      </div>
      {meta && (
        <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: SUBTLE_TEXT, letterSpacing: "-0.005em" }}>
          {meta}
        </div>
      )}
    </header>
  );
}

function StatTile({ label, value, detail, color, isMobile, size = "md" }) {
  const isHero = size === "hero";
  return (
    <div className="p-stat-tile f1-hoverable" style={{
      position:     "relative",
      overflow:     "hidden",
      borderRadius: CARD_RADIUS,
      border:       `1px solid ${rgbaFromHex(color, 0.22)}`,
      background:   `linear-gradient(135deg, ${rgbaFromHex(color, 0.12)} 0%, ${rgbaFromHex(color, 0.03)} 60%, ${PANEL_BG_ALT} 100%)`,
      padding:      isHero ? (isMobile ? "18px 18px 16px" : "22px 22px 20px") : (isMobile ? "16px 16px 14px" : "18px 18px 16px"),
      boxShadow:    CARD_SHADOW,
    }}>
      {/* Left tone rail */}
      <span aria-hidden="true" style={{
        position:   "absolute",
        top:        0,
        bottom:     0,
        left:       0,
        width:      3,
        background: color,
        opacity:    0.72,
      }} />
      <div style={{
        fontSize:       10,
        fontWeight:     900,
        letterSpacing:  "0.14em",
        textTransform:  "uppercase",
        color:          SUBTLE_TEXT,
        marginBottom:   isHero ? 10 : 8,
        overflow:       "hidden",
        textOverflow:   "ellipsis",
        whiteSpace:     "nowrap",
      }}>{label}</div>
      <div style={{
        fontFamily:         "var(--font-mono)",
        fontSize:           isHero ? (isMobile ? 34 : 44) : (isMobile ? 24 : 30),
        fontWeight:         700,
        letterSpacing:      "-0.045em",
        color,
        fontVariantNumeric: "tabular-nums",
        lineHeight:         1,
      }}>{value}</div>
      {detail && (
        <div style={{
          fontSize:   11.5,
          fontWeight: 600,
          color:      MUTED_TEXT,
          marginTop:  isHero ? 10 : 7,
          letterSpacing: "-0.005em",
          overflow:   "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {detail}
        </div>
      )}
    </div>
  );
}


// Mini sparkline canvas — draws the last-5 race scores as a connected line,
// animating from a flat baseline up to the actual values on mount.
function CoachSparkline({ races, accent = AI_BLUE_TEXT, isMobile }) {
  const canvasRef = useRef(null);
  const data = (races || []).slice(-5).map((r) => r.score || 0);
  const width = isMobile ? 120 : 156;
  const height = isMobile ? 36 : 44;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const max = Math.max(8, ...data);
    const stepX = data.length > 1 ? width / (data.length - 1) : width;
    const points = data.map((v, i) => [i * stepX, height - (v / max) * (height - 8) - 4]);

    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let cancelled = false;
    let frame = 0;
    const draw = (t) => {
      if (cancelled) return;
      ctx.clearRect(0, 0, width, height);

      // Filled area under line
      ctx.beginPath();
      ctx.moveTo(0, height);
      points.forEach(([x, y], i) => {
        const animatedY = prefersReduced ? y : (height - (height - y) * t);
        if (i === 0) ctx.lineTo(x, animatedY);
        else ctx.lineTo(x, animatedY);
      });
      ctx.lineTo(width, height);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, rgbaFromHex(accent, 0.32));
      grad.addColorStop(1, rgbaFromHex(accent, 0.02));
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      points.forEach(([x, y], i) => {
        const animatedY = prefersReduced ? y : (height - (height - y) * t);
        if (i === 0) ctx.moveTo(x, animatedY);
        else ctx.lineTo(x, animatedY);
      });
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // End-cap dot
      const [lx, ly] = points[points.length - 1];
      const animatedLy = prefersReduced ? ly : (height - (height - ly) * t);
      ctx.beginPath();
      ctx.arc(lx, animatedLy, 3, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, animatedLy, 5, 0, Math.PI * 2);
      ctx.strokeStyle = rgbaFromHex(accent, 0.45);
      ctx.lineWidth = 1;
      ctx.stroke();

      if (!prefersReduced && t < 1) {
        frame++;
        const next = Math.min(1, t + 0.025);
        requestAnimationFrame(() => draw(next));
      }
    };
    draw(prefersReduced ? 1 : 0);
    return () => { cancelled = true; };
  }, [data, width, height, accent]);

  if (!data.length) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block" }}
      aria-hidden="true"
    />
  );
}

function CoachHero({ coach, breakdown, isPro, isMobile, recentRaces }) {
  const targetAccuracy = breakdown?.accuracy ?? 0;
  const [displayAccuracy, setDisplayAccuracy] = useState(0);
  const twoColumn = !isMobile;
  const archetypeLabel = coach.archetype.label || "";

  // Count-up the accuracy from 0 to target on mount.
  useEffect(() => {
    const stop = animateNumber({
      from: 0,
      to: targetAccuracy,
      duration: 1400,
      onUpdate: (v) => setDisplayAccuracy(v),
    });
    return stop;
  }, [targetAccuracy]);

  return (
    <div
      className="ov-hero f1-hoverable"
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       `1px solid ${rgbaFromHex(AI_BLUE, 0.30)}`,
        background:   `linear-gradient(135deg, ${rgbaFromHex(AI_BLUE, 0.22)} 0%, ${rgbaFromHex(AI_BLUE, 0.06)} 50%, ${PANEL_BG} 100%)`,
        padding:      isMobile ? "24px 20px 22px" : "32px 34px 28px",
        boxShadow:    LIFTED_SHADOW,
      }}
    >
      {/* Top accent rail */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${AI_BLUE_TEXT} 30%, ${AI_BLUE_TEXT} 70%, transparent)`,
        opacity: 0.85,
      }} />

      <div style={{
        position:             "relative",
        zIndex:               1,
        display:              "grid",
        gridTemplateColumns:  twoColumn ? "minmax(0,1fr) auto" : "1fr",
        gap:                  twoColumn ? 32 : 22,
        alignItems:           "center",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true" style={{
                width: 7, height: 7, borderRadius: "50%", background: AI_BLUE_TEXT,
                boxShadow: `0 0 0 4px ${rgbaFromHex(AI_BLUE, 0.22)}, 0 0 10px ${rgbaFromHex(AI_BLUE, 0.42)}`,
                animation: "ov-trophy-pulse 2400ms ease-in-out infinite",
              }} />
              <span style={{
                fontSize: 11, fontWeight: 900, letterSpacing: "0.18em",
                textTransform: "uppercase", color: AI_BLUE_TEXT,
              }}>AI Coach · Live read</span>
            </span>
            {!isPro && breakdown?.scoredRounds >= 3 && (
              <span style={{
                fontSize: 10, fontWeight: 900, letterSpacing: "0.12em",
                textTransform: "uppercase", color: ACCENT,
                background: rgbaFromHex(ACCENT, 0.14),
                border: `1px solid ${rgbaFromHex(ACCENT, 0.30)}`,
                borderRadius: RADIUS_PILL, padding: "3px 10px",
              }}>Preview</span>
            )}
          </div>

          {/* Typing-reveal archetype label */}
          <h2 className="stint-page-title" style={{
            margin:        "0 0 16px",
            fontSize:      isMobile ? 30 : 44,
            fontWeight:    900,
            letterSpacing: "-0.045em",
            lineHeight:    0.98,
            color:         TEXT_PRIMARY,
            textTransform: "uppercase",
          }}>
            {archetypeLabel.split("").map((ch, i) => (
              <span
                key={`${ch}-${i}`}
                className="ov-archetype-char"
                style={{ animationDelay: `${80 + i * 38}ms` }}
              >{ch === " " ? " " : ch}</span>
            ))}
          </h2>

          <p className="ov-hero-desc" style={{
            margin: 0,
            fontSize: isMobile ? 14 : 15.5,
            color: "rgba(226,232,240,0.86)",
            lineHeight: 1.65,
            maxWidth: "58ch",
            fontWeight: 500,
            letterSpacing: "-0.005em",
          }}>
            {coach.archetype.description}
          </p>

          <div className="ov-hero-chips" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 22 }}>
            <span style={{
              padding: "7px 14px", borderRadius: RADIUS_PILL,
              background: rgbaFromHex(AI_BLUE, 0.14),
              border: `1px solid ${rgbaFromHex(AI_BLUE, 0.32)}`,
              fontSize: 12.5, fontWeight: 900, color: TEXT_PRIMARY,
              letterSpacing: "-0.005em",
            }}>{coach.verdict}</span>
            <span style={{
              fontSize: 10, fontWeight: 900, color: "#bae6fd",
              background: "rgba(56,189,248,0.12)",
              border: "1px solid rgba(56,189,248,0.30)",
              borderRadius: RADIUS_PILL, padding: "5px 12px",
              letterSpacing: "0.14em", textTransform: "uppercase",
            }}>{coach.confidence.label}</span>
            <span style={{
              fontSize: 10, fontWeight: 900, color: "#fdba74",
              background: "rgba(249,115,22,0.12)",
              border: "1px solid rgba(249,115,22,0.30)",
              borderRadius: RADIUS_PILL, padding: "5px 12px",
              letterSpacing: "0.14em", textTransform: "uppercase",
            }}>{coach.trend.label}</span>
          </div>
        </div>

        {/* Season-accuracy — animated count-up protagonist */}
        {breakdown?.scoredRounds > 0 && (
          twoColumn ? (
            <div className="ov-accuracy-num" style={{
              flexShrink:   0,
              minWidth:     228,
              padding:      "24px 28px 22px",
              borderRadius: CARD_RADIUS,
              background:   `linear-gradient(160deg, rgba(6,16,27,0.74) 0%, rgba(6,16,27,0.48) 100%)`,
              border:       `1px solid ${rgbaFromHex(AI_BLUE, 0.28)}`,
              textAlign:    "right",
              position:     "relative",
              overflow:     "hidden",
              boxShadow:    `inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 22px rgba(0,0,0,0.32)`,
            }}>
              <span aria-hidden="true" style={{
                position: "absolute", top: 0, right: 0, width: 3, bottom: 0,
                background: AI_BLUE_TEXT, opacity: 0.65,
              }} />
              <div style={{
                fontSize: 10, fontWeight: 900, letterSpacing: "0.16em",
                textTransform: "uppercase", color: AI_BLUE_TEXT,
                marginBottom: 12,
              }}>Season accuracy</div>
              <div style={{
                fontFamily:         "var(--font-mono)",
                fontSize:           76,
                fontWeight:         700,
                letterSpacing:      "-0.05em",
                color:              AI_BLUE,
                lineHeight:         0.9,
                fontVariantNumeric: "tabular-nums",
              }}>
                {Math.round(displayAccuracy)}<span style={{ fontSize: "0.40em", color: AI_BLUE_TEXT, marginLeft: 5 }}>%</span>
              </div>
              <div style={{
                fontSize: 11.5, fontWeight: 700, color: MUTED_TEXT,
                marginTop: 12, fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.005em",
              }}>
                {breakdown.totalCorrect}/{breakdown.totalPicks} hits · {breakdown.scoredRounds} rounds
              </div>
            </div>
          ) : (
            <div className="ov-accuracy-num" style={{
              position:     "relative",
              overflow:     "hidden",
              display:      "flex",
              alignItems:   "center",
              gap:          16,
              padding:      "18px 20px",
              borderRadius: CARD_RADIUS,
              background:   `linear-gradient(160deg, rgba(6,16,27,0.74) 0%, rgba(6,16,27,0.48) 100%)`,
              border:       `1px solid ${rgbaFromHex(AI_BLUE, 0.28)}`,
            }}>
              <span aria-hidden="true" style={{
                position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                background: AI_BLUE_TEXT, opacity: 0.65,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 900, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: AI_BLUE_TEXT,
                  marginBottom: 6,
                }}>Season accuracy</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED_TEXT, fontVariantNumeric: "tabular-nums" }}>
                  {breakdown.totalCorrect}/{breakdown.totalPicks} hits · {breakdown.scoredRounds} rounds
                </div>
              </div>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize:           52,
                fontWeight:         700,
                letterSpacing:      "-0.05em",
                color:              AI_BLUE,
                lineHeight:         0.9,
                fontVariantNumeric: "tabular-nums",
                flexShrink:         0,
              }}>
                {Math.round(displayAccuracy)}<span style={{ fontSize: "0.40em", color: AI_BLUE_TEXT, marginLeft: 3 }}>%</span>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function CoachMoveCarousel({ coach, isPro, isMobile, onUnlock }) {
  const items = [
    { label: "Protect",   value: coach.protectCategory?.shortLabel   || "Best edge", detail: coach.protectCategory   ? `${coach.protectCategory.accuracy}% accuracy · ${coach.protectCategory.points} pts` : "Your best edge will appear here.", color: "#f97316", icon: "🛡" },
    { label: "Challenge", value: coach.challengeCategory?.shortLabel || "Main leak", detail: coach.challengeCategory ? `${coach.challengeCategory.accuracy}% accuracy · ${coach.challengeCategory.points} pts` : "The model does not see a weak spot yet.", color: "#fbbf24", icon: "⚡" },
    { label: "Next move", value: coach.nextMoveTitle, detail: coach.nextMoveDetail, color: "#7dd3fc", icon: "↗" },
  ];

  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  // Track which card is in view (mobile snap-scroll) so the dots update live.
  useEffect(() => {
    if (!isMobile) {
      setActive(0);
      return undefined;
    }
    const track = trackRef.current;
    if (!track) return undefined;
    const onScroll = () => {
      const w = track.offsetWidth;
      const idx = Math.round(track.scrollLeft / Math.max(1, w * 0.86));
      setActive(Math.max(0, Math.min(items.length - 1, idx)));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [isMobile, items.length]);

  // Keyboard ← → cycle on desktop (when focus is inside the carousel).
  useEffect(() => {
    if (isMobile) return undefined;
    const track = trackRef.current;
    if (!track) return undefined;
    const onKey = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setActive((cur) => {
        const next = e.key === "ArrowRight"
          ? Math.min(items.length - 1, cur + 1)
          : Math.max(0, cur - 1);
        return next;
      });
    };
    track.addEventListener("keydown", onKey);
    return () => track.removeEventListener("keydown", onKey);
  }, [isMobile, items.length]);

  const goTo = (idx) => {
    setActive(idx);
    if (isMobile && trackRef.current) {
      const child = trackRef.current.children[idx];
      if (child) trackRef.current.scrollTo({ left: child.offsetLeft - 2, behavior: "smooth" });
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={trackRef}
        className="ov-carousel"
        tabIndex={isMobile ? undefined : 0}
        role="group"
        aria-label="AI Coach moves"
        style={{ outline: "none" }}
      >
        {items.map((item, idx) => {
          const locked = !isPro && idx > 0;
          const isActive = idx === active && !isMobile;
          return (
            <div key={item.label} style={{ position: "relative" }}>
              <div
                className={locked ? undefined : "f1-hoverable"}
                onClick={isMobile ? () => goTo(idx) : undefined}
                style={{
                  position:      "relative",
                  overflow:      "hidden",
                  borderRadius:  CARD_RADIUS,
                  border:        `1px solid ${rgbaFromHex(item.color, isActive ? 0.42 : 0.22)}`,
                  background:    `linear-gradient(135deg, ${rgbaFromHex(item.color, isActive ? 0.18 : 0.12)} 0%, ${rgbaFromHex(item.color, 0.03)} 60%, ${PANEL_BG_ALT} 100%)`,
                  padding:       isMobile ? "20px 20px 18px" : "26px 24px 22px",
                  boxShadow:     isActive ? `0 12px 36px ${rgbaFromHex(item.color, 0.22)}, ${CARD_SHADOW}` : CARD_SHADOW,
                  filter:        locked ? "blur(6px)" : "none",
                  opacity:       locked ? 0.45 : 1,
                  userSelect:    locked ? "none" : "auto",
                  pointerEvents: locked ? "none" : "auto",
                  minHeight:     isMobile ? 150 : 168,
                  transition:    "transform 240ms cubic-bezier(0.23,1,0.32,1), box-shadow 240ms ease, border-color 240ms ease",
                  transform:     isActive ? "translateY(-2px)" : "translateY(0)",
                }}
              >
                <span aria-hidden="true" style={{
                  position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                  background: item.color, opacity: isActive ? 1 : 0.78,
                  boxShadow: isActive ? `0 0 14px ${rgbaFromHex(item.color, 0.42)}` : "none",
                }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{
                    fontSize:      10,
                    fontWeight:    900,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color:         item.color,
                    display:       "inline-flex",
                    alignItems:    "center",
                    gap:           7,
                  }}>
                    <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{item.icon}</span>
                    {item.label}
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 900,
                    fontFamily: "var(--font-mono)",
                    color: "rgba(148,163,184,0.46)",
                    fontVariantNumeric: "tabular-nums",
                  }}>{String(idx + 1).padStart(2, "0")} / 03</span>
                </div>
                <div className="stint-card-title" style={{
                  fontSize: isMobile ? 20 : 22,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.14,
                  marginBottom: 10,
                  color: TEXT_PRIMARY,
                }}>{item.value}</div>
                <div style={{
                  fontSize: 13,
                  color: MUTED_TEXT,
                  lineHeight: 1.6,
                  letterSpacing: "-0.005em",
                }}>{item.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination dots — mobile only */}
      {isMobile && (
        <div style={{
          display:       "flex",
          justifyContent: "center",
          alignItems:    "center",
          gap:           8,
          marginTop:     14,
        }}>
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              aria-label={`Show move ${idx + 1}`}
              aria-pressed={idx === active}
              className="ov-carousel-dot"
              data-active={idx === active}
              style={{
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Desktop nav arrows */}
      {!isMobile && (
        <div style={{
          marginTop: 14,
          display:   "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActive(idx)}
                aria-label={`Focus move ${idx + 1}`}
                aria-pressed={idx === active}
                className="ov-carousel-dot"
                data-active={idx === active}
                style={{ border: "none", cursor: "pointer", padding: 0 }}
              />
            ))}
          </div>
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            color: SUBTLE_TEXT,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
          }}>
            ← → to cycle
          </span>
        </div>
      )}

      {!isPro && (
        <div style={{
          position:  "absolute",
          right:     isMobile ? 14 : 18,
          bottom:    isMobile ? 46 : 70,
          display:   "flex",
          alignItems: "center",
          gap:        12,
          background: PANEL_BG,
          border:     `1px solid ${rgbaFromHex(ACCENT, 0.40)}`,
          borderRadius: RADIUS_PILL,
          padding:    "10px 16px 10px 14px",
          boxShadow:  `0 18px 40px rgba(0,0,0,0.45), 0 4px 16px ${rgbaFromHex(ACCENT, 0.24)}`,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: TEXT_PRIMARY,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>Unlock the full read</span>
          <button
            onClick={onUnlock}
            className="p-action-btn"
            style={{
              background:    BRAND_GRADIENT,
              border:        "none",
              borderRadius:  RADIUS_PILL,
              color:         "#fff",
              cursor:        "pointer",
              fontSize:      12,
              fontWeight:    900,
              padding:       "8px 16px",
              letterSpacing: "-0.005em",
              fontFamily:    "inherit",
              boxShadow:     `0 4px 14px ${rgbaFromHex(ACCENT, 0.32)}`,
            }}
          >Unlock Pro →</button>
        </div>
      )}
    </div>
  );
}

function CategoryStrengthsStrip({ categories }) {
  const containerRef = useRef(null);
  const isVisible = useReveal(containerRef, { threshold: 0.32 });
  const top = (categories || []).filter((c) => c.total >= 1).slice(0, 3);
  if (!top.length) return null;
  // Protagonist (#1) gets a slightly bigger row; #2/#3 are supporting.
  return (
    <div
      ref={containerRef}
      className={`ov-strengths f1-hoverable ${isVisible ? "is-visible" : ""}`}
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: CARD_RADIUS,
        border:       PANEL_BORDER,
        background:   PANEL_BG,
        padding:      "22px 24px 22px",
        boxShadow:    CARD_SHADOW,
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: ACCENT, opacity: 0.55,
      }} />
      <header style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "baseline",
        marginBottom:   20,
        gap:            8,
        flexWrap:       "wrap",
      }}>
        <div>
          <div style={{
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color:         ACCENT,
            marginBottom:  5,
          }}>Strengths</div>
          <h3 className="stint-card-title" style={{
            margin: 0, fontSize: 19,
            letterSpacing: "-0.028em",
            lineHeight: 1.16,
          }}>Top categories by points</h3>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 800,
          color: SUBTLE_TEXT,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
        }}>Top 3</span>
      </header>
      <div style={{ display: "grid", gap: 18 }}>
        {top.map((category, idx) => {
          const isLead = idx === 0;
          return (
            <div key={category.key} className="ov-strength-row">
              <div style={{
                display:        "flex",
                justifyContent: "space-between",
                gap:            10,
                marginBottom:   isLead ? 10 : 8,
                alignItems:     "baseline",
              }}>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{
                    fontSize: isLead ? 13 : 11,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: isLead ? ACCENT : "rgba(148,163,184,0.50)",
                    fontVariantNumeric: "tabular-nums",
                  }}>{String(idx + 1).padStart(2, "0")}</span>
                  <span style={{
                    fontSize: isLead ? 16 : 14,
                    fontWeight: 900,
                    letterSpacing: "-0.020em",
                    color: TEXT_PRIMARY,
                  }}>{category.label}</span>
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexShrink: 0 }}>
                  <span style={{
                    fontSize: isLead ? 22 : 18,
                    fontWeight: 900,
                    color: isLead ? ACCENT : TEXT_PRIMARY,
                    fontFamily: "var(--font-display)",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.035em",
                    lineHeight: 1,
                  }}>{category.accuracy}<span style={{ fontSize: "0.50em", marginLeft: 1, opacity: 0.6 }}>%</span></span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: SUBTLE_TEXT,
                    minWidth: 50,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.005em",
                  }}>{category.points} pts</span>
                </div>
              </div>
              <div style={{
                position:     "relative",
                height:       isLead ? 8 : 6,
                borderRadius: 999,
                background:   "rgba(148,163,184,0.10)",
                overflow:     "hidden",
              }}>
                <div className="ov-strength-fill" style={{
                  width: `${category.accuracy}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: isLead
                    ? `linear-gradient(90deg, ${ACCENT}, #fbbf24)`
                    : `linear-gradient(90deg, ${rgbaFromHex(ACCENT, 0.62)}, ${rgbaFromHex("#fbbf24", 0.62)})`,
                  boxShadow: isLead ? `0 0 14px ${rgbaFromHex(ACCENT, 0.46)}` : "none",
                }} />
              </div>
              {isLead && (
                <div style={{
                  fontSize: 11,
                  color: MUTED_TEXT,
                  marginTop: 6,
                  letterSpacing: "-0.005em",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  Best edge — {category.correct ?? Math.round(category.accuracy * (category.total || 0) / 100)}/{category.total} hits
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreBarChart({ races, isMobile, height = 120, scale }) {
  // `races` expected newest → oldest. We render oldest → newest so the chart reads left-to-right in time.
  const ordered = [...(races || [])].sort((a, b) => (a.round || 0) - (b.round || 0));
  if (!ordered.length) return null;
  const maxScore = scale ?? Math.max(24, ...ordered.map((r) => r.score || 0));
  const bestScore = Math.max(...ordered.map((r) => r.score || 0));

  return (
    <div style={{
      display:              "grid",
      gridTemplateColumns:  `repeat(${ordered.length}, minmax(0,1fr))`,
      gap:                  isMobile ? 6 : 8,
      alignItems:           "end",
      height,
    }}>
      {ordered.map((race) => {
        const pct = maxScore > 0 ? Math.max(4, Math.round((race.score / maxScore) * 100)) : 4;
        const isBest = race.score === bestScore && bestScore > 0;
        const tone = isBest ? "#fbbf24"
          : race.score >= 40 ? "#4ade80"
          : race.score >= 25 ? "#fdba74"
          : race.score >= 10 ? ACCENT
          : "#64748b";
        return (
          <div key={race.round} style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4, minWidth: 0, height: "100%" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: tone, textAlign: "center", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{race.score}</div>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
              <div style={{
                width:        "100%",
                height:       `${pct}%`,
                minHeight:    3,
                background:   `linear-gradient(180deg, ${tone} 0%, ${rgbaFromHex(tone, 0.5)} 100%)`,
                borderRadius: 3,
                boxShadow:    isBest ? `0 0 14px ${rgbaFromHex(tone, 0.5)}` : "none",
              }} />
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", color: SUBTLE_TEXT, textTransform: "uppercase", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              R{String(race.round).padStart(2, "0")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FormRibbon({ races, isMobile, breakdown, coach }) {
  const ribbonRef = useRef(null);
  const isVisible = useReveal(ribbonRef, { threshold: 0.32 });

  if (!races?.length) return null;

  // Reverse to oldest → newest so the ribbon reads left-to-right in time.
  const ordered = [...races].sort((a, b) => (a.round || 0) - (b.round || 0));
  const maxScore = Math.max(24, ...ordered.map((r) => r.score || 0));
  const bestScore = Math.max(...ordered.map((r) => r.score || 0));
  const trendDelta = breakdown?.trendDelta ?? 0;
  const trendColor = trendDelta >= 5 ? "#4ade80" : trendDelta <= -5 ? "#93c5fd" : "#fdba74";
  const trendArrow = trendDelta >= 5 ? "↗" : trendDelta <= -5 ? "↘" : "→";
  const avgScore  = breakdown?.averageScore ?? Math.round(ordered.reduce((s, r) => s + (r.score || 0), 0) / Math.max(1, ordered.length));
  const recentAvg = breakdown?.recentAverage ?? avgScore;

  return (
    <div
      ref={ribbonRef}
      className={`ov-ribbon f1-hoverable ${isVisible ? "is-visible" : ""}`}
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: CARD_RADIUS,
        border:       `1px solid ${rgbaFromHex(trendColor, 0.22)}`,
        background:   `linear-gradient(135deg, ${rgbaFromHex(trendColor, 0.10)} 0%, ${rgbaFromHex(trendColor, 0.02)} 60%, ${PANEL_BG} 100%)`,
        padding:      isMobile ? "20px 20px 22px" : "26px 26px 26px",
        boxShadow:    CARD_SHADOW,
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: trendColor, opacity: 0.7,
      }} />

      {/* Header: Form kicker + Avg/L5/Trend chip strip */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: 12, flexWrap: "wrap",
        marginBottom: isMobile ? 18 : 24,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 900, letterSpacing: "0.16em",
            textTransform: "uppercase", color: trendColor,
            marginBottom: 5,
          }}>Form ribbon · last {ordered.length}</div>
          <h3 className="stint-card-title" style={{
            margin: 0, fontSize: isMobile ? 18 : 22,
            letterSpacing: "-0.028em", lineHeight: 1.14,
          }}>How you&apos;re trending</h3>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Avg</span>
            <span style={{ fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 700, color: "#fdba74", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 0.92 }}>{avgScore}</span>
          </div>
          <span aria-hidden="true" style={{ width: 1, height: 18, background: HAIRLINE }} />
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: SUBTLE_TEXT }}>L5</span>
            <span style={{ fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 700, color: trendColor, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 0.92 }}>{recentAvg}</span>
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 11px", borderRadius: RADIUS_PILL,
            background: rgbaFromHex(trendColor, 0.14),
            border: `1px solid ${rgbaFromHex(trendColor, 0.32)}`,
            fontSize: 10, fontWeight: 900, color: trendColor,
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}>
            <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>{trendArrow}</span>
            {coach?.trend?.label || (trendDelta >= 5 ? "Trending up" : trendDelta <= -5 ? "Cooling off" : "Stable")}
          </span>
        </div>
      </div>

      {/* The ribbon bars — animate up from baseline on intersection */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${ordered.length}, minmax(0,1fr))`,
        gap: isMobile ? 8 : 12,
        alignItems: "end",
        height: isMobile ? 118 : 148,
      }}>
        {ordered.map((race, i) => {
          const pct = maxScore > 0 ? Math.max(6, Math.round((race.score / maxScore) * 100)) : 6;
          const isBest = race.score === bestScore && bestScore > 0;
          const tone = isBest ? "#fbbf24"
            : race.score >= 40 ? "#4ade80"
            : race.score >= 25 ? "#fdba74"
            : race.score >= 10 ? ACCENT
            : "#64748b";
          return (
            <div
              key={race.round}
              title={`Round ${race.round} — ${race.score} pts`}
              style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6, minWidth: 0, height: "100%" }}
            >
              <div style={{
                fontSize: 11, fontWeight: 900,
                color: isBest ? "#fbbf24" : tone,
                textAlign: "center", fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.025em",
                fontFamily: "var(--font-mono)",
              }}>{race.score}</div>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                <div className="ov-ribbon-bar" style={{
                  width:        "100%",
                  height:       `${pct}%`,
                  minHeight:    4,
                  background:   `linear-gradient(180deg, ${tone} 0%, ${rgbaFromHex(tone, 0.48)} 100%)`,
                  borderRadius: 4,
                  boxShadow:    isBest ? `0 0 18px ${rgbaFromHex(tone, 0.62)}, inset 0 1px 0 rgba(255,255,255,0.18)` : "inset 0 1px 0 rgba(255,255,255,0.08)",
                }} />
              </div>
              <div style={{
                fontSize: 9, fontWeight: 900,
                letterSpacing: "0.12em",
                color: i === ordered.length - 1 ? trendColor : SUBTLE_TEXT,
                textTransform: "uppercase",
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}>
                R{String(race.round).padStart(2, "0")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BestWeekendCard({ bestRace, onViewRound }) {
  const cardRef = useRef(null);
  const isVisible = useReveal(cardRef, { threshold: 0.40 });
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (!isVisible || !bestRace) return undefined;
    const stop = animateNumber({
      from: 0,
      to: bestRace.score || 0,
      duration: 1200,
      onUpdate: (v) => setDisplayScore(v),
    });
    return stop;
  }, [isVisible, bestRace]);

  if (!bestRace) return null;

  return (
    <div
      ref={cardRef}
      className="ov-best-card f1-hoverable"
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: CARD_RADIUS,
        border:       "1px solid rgba(250,204,21,0.32)",
        background:   `linear-gradient(135deg, rgba(250,204,21,0.20) 0%, rgba(250,204,21,0.05) 50%, ${PANEL_BG_ALT} 100%)`,
        padding:      "22px 24px 22px",
        boxShadow:    CARD_SHADOW,
      }}
    >
      {/* Left rail */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: "#fbbf24", opacity: 0.92,
      }} />
      {/* Top rail */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, #fbbf24 30%, #fbbf24 70%, transparent)",
        opacity: 0.78,
      }} />
      <div style={{
        fontSize:      10,
        fontWeight:    900,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color:         "#fbbf24",
        marginBottom:  12,
        display:       "inline-flex",
        alignItems:    "center",
        gap:           8,
      }}>
        <span className="ov-trophy" aria-hidden="true" style={{ fontSize: 16 }}>🏆</span>
        Best weekend so far
      </div>
      <div className="stint-card-title" style={{
        fontSize: 19,
        fontWeight: 900,
        letterSpacing: "-0.028em",
        marginBottom: 14,
        color: TEXT_PRIMARY,
        lineHeight: 1.14,
      }}>{bestRace.raceName}</div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 56,
        fontWeight: 700,
        letterSpacing: "-0.05em",
        color: "#fbbf24",
        lineHeight: 0.92,
        fontVariantNumeric: "tabular-nums",
        marginBottom: 14,
        textShadow: `0 0 26px ${rgbaFromHex("#fbbf24", 0.32)}`,
      }}>
        {Math.round(displayScore)}
        <span style={{ fontSize: "0.30em", color: PRO_AMBER_TEXT, marginLeft: 5, letterSpacing: "0.06em" }}>PTS</span>
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: MUTED_TEXT,
          letterSpacing: "-0.005em",
          fontVariantNumeric: "tabular-nums",
        }}>{bestRace.correct}/{bestRace.total} hits · {bestRace.accuracy}% accuracy</div>
        {onViewRound && (
          <button
            onClick={() => onViewRound(bestRace.round)}
            className="p-action-btn"
            style={{
              background: rgbaFromHex("#fbbf24", 0.14),
              border: "1px solid rgba(251,191,36,0.34)",
              borderRadius: RADIUS_PILL,
              color: "#fbbf24",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 900,
              padding: "7px 13px",
              fontFamily: "inherit",
              letterSpacing: "0.10em",
              textTransform: "uppercase",
            }}
          >Open round →</button>
        )}
      </div>
    </div>
  );
}

function UpgradeStrip({ headline, body }) {
  return (
    <a
      href="/pro"
      className="f1-hoverable p-unlock-link"
      style={{
        position:       "relative",
        overflow:       "hidden",
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        gap:            18,
        flexWrap:       "wrap",
        borderRadius:   CARD_RADIUS,
        border:         `1px solid ${rgbaFromHex(ACCENT, 0.28)}`,
        background:     `linear-gradient(135deg, ${rgbaFromHex(ACCENT, 0.14)} 0%, ${rgbaFromHex(ACCENT, 0.03)} 60%, ${PANEL_BG_ALT} 100%)`,
        padding:        "20px 22px",
        textDecoration: "none",
        color:          "inherit",
        boxShadow:      CARD_SHADOW,
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: ACCENT, opacity: 0.78,
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color:         ACCENT,
          marginBottom:  7,
        }}>Stint Pro</div>
        <div className="stint-card-title" style={{
          fontSize:      17,
          fontWeight:    900,
          letterSpacing: "-0.028em",
          marginBottom:  5,
          lineHeight:    1.16,
        }}>{headline}</div>
        <div style={{ fontSize: 12.5, color: MUTED_TEXT, lineHeight: 1.55, letterSpacing: "-0.005em" }}>{body}</div>
      </div>
      <span style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            8,
        background:     BRAND_GRADIENT,
        borderRadius:   RADIUS_PILL,
        color:          "#fff",
        fontSize:       13,
        fontWeight:     900,
        letterSpacing:  "-0.005em",
        padding:        "11px 20px",
        flexShrink:     0,
        whiteSpace:     "nowrap",
        boxShadow:      `0 4px 14px ${rgbaFromHex(ACCENT, 0.32)}`,
      }}>
        Unlock Pro
        <span style={{ fontSize: 12 }}>→</span>
      </span>
    </a>
  );
}

// ─── History — Season Storyline system ──────────────────────────────────────
//
// IA: Timeline (every race as a dot) → Highlight Reel (best/worst/streak/latest)
// → Filter Rail → grouped Race Log. Click a dot or highlight to focus on a
// specific round; click a filter pill to narrow the log.

function scoreTier(score) {
  if (score >= 40) return { color: "#4ade80", label: "Hot" };
  if (score >= 25) return { color: "#fdba74", label: "Solid" };
  if (score >= 10) return { color: ACCENT,    label: "Mixed" };
  return { color: "#64748b", label: "Cold" };
}

function SeasonTimeline({ predictions, breakdown, isMobile, activeRound, onRoundSelect }) {
  const ref = useRef(null);
  const isVisible = useReveal(ref, { threshold: 0.18 });

  // Map predictions by round for quick lookup
  const predByRound = new Map(predictions.map((p) => [Number(p.race_round), p]));
  const races = ACTIVE_CAL; // exclude cancelled

  // Next race in the future
  const upcomingRace = nextRace();
  const nextRound = upcomingRace?.r;

  // Build dot data for each active race
  const dots = races.map((race) => {
    const pred = predByRound.get(race.r);
    const isScored = pred?.score_breakdown !== null && pred?.score_breakdown !== undefined;
    const isPending = pred && !isScored;
    const isFuture = !pred && race.r >= (nextRound || Infinity);
    const isPast = !pred && !isFuture;
    const score = isScored ? Number(pred.score || 0) : null;
    const isBest = isScored && breakdown?.bestRace?.round === race.r;
    return {
      round: race.r, name: race.n, date: race.date,
      isScored, isPending, isFuture, isPast, isNext: race.r === nextRound,
      score, isBest,
    };
  });

  const scoredOnly = dots.filter((d) => d.isScored && Number.isFinite(d.score));
  const maxScore = Math.max(60, ...scoredOnly.map((d) => d.score || 0));

  // Build the trend line SVG path (only through scored dots)
  const pathPoints = scoredOnly.map((d) => {
    const idx = dots.findIndex((x) => x.round === d.round);
    const x = dots.length > 1 ? idx / (dots.length - 1) : 0;
    const y = 1 - (d.score / maxScore);
    return { x, y };
  });

  return (
    <section
      ref={ref}
      className={`hs-timeline f1-hoverable ${isVisible ? "is-visible" : ""}`}
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       PANEL_BORDER,
        background:   `linear-gradient(135deg, ${rgbaFromHex(ACCENT, 0.10)} 0%, ${rgbaFromHex(ACCENT, 0.02)} 50%, ${PANEL_BG} 100%)`,
        padding:      isMobile ? "22px 22px 24px" : "30px 32px 32px",
        boxShadow:    LIFTED_SHADOW,
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${ACCENT} 70%, transparent)`,
        opacity: 0.85,
      }} />
      <header style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "baseline", gap: 12, flexWrap: "wrap",
        marginBottom: isMobile ? 20 : 28,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: ACCENT, marginBottom: 6,
          }}>Season storyline · {ACTIVE_RACE_COUNT} rounds</div>
          <h2 className="stint-section-title" style={{
            margin: 0,
            fontSize: isMobile ? 22 : 30,
            letterSpacing: "-0.035em",
            lineHeight: 1.1,
          }}>Your season at a glance</h2>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} /> 40+
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fdba74" }} /> 25+
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT }} /> 10+
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748b" }} /> &lt;10
          </span>
        </div>
      </header>

      {/* Trend line + dots row */}
      <div style={{ position: "relative", padding: "10px 0" }}>
        {/* Score trend line */}
        {pathPoints.length >= 2 && (
          <svg
            aria-hidden="true"
            viewBox="0 0 1000 60"
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              inset: "8px 0",
              width: "100%",
              height: isMobile ? 56 : 72,
              pointerEvents: "none",
            }}
          >
            <path
              className="hs-timeline-line"
              d={pathPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * 1000} ${p.y * 60}`).join(" ")}
              fill="none"
              stroke={ACCENT}
              strokeWidth="2"
              strokeOpacity="0.55"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
            />
          </svg>
        )}

        {/* Dots */}
        <div style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: `repeat(${dots.length}, minmax(0, 1fr))`,
          alignItems: "center",
          gap: 0,
          height: isMobile ? 56 : 72,
        }}>
          {dots.map((d) => {
            const tier = d.isScored ? scoreTier(d.score) : null;
            const baseSize = isMobile ? 12 : 14;
            const size = d.isScored ? (d.isBest ? baseSize + 6 : baseSize) : baseSize - 2;
            const yPct = d.isScored ? (1 - d.score / maxScore) * 100 : 50;
            const color = d.isBest
              ? "#fbbf24"
              : d.isScored
                ? tier.color
                : d.isNext
                  ? ACCENT
                  : "rgba(148,163,184,0.30)";
            const isActive = activeRound === d.round;
            return (
              <button
                key={d.round}
                onClick={() => onRoundSelect?.(d.round, d.isScored)}
                title={`${d.name} · R${d.round}${d.isScored ? ` · ${d.score} pts` : d.isNext ? " · Next race" : ""}`}
                aria-label={`Round ${d.round} ${d.name}`}
                className={`hs-timeline-dot ${isActive ? "hs-dot-active" : ""}`}
                style={{
                  position: "relative",
                  height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  cursor: d.isScored || d.isNext ? "pointer" : "default",
                  padding: 0,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{
                  position: "absolute",
                  top: `${yPct}%`,
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  background: d.isScored ? color : "transparent",
                  border: d.isScored ? `1.5px solid ${color}` : `1.5px solid ${color}`,
                  boxShadow: d.isBest
                    ? `0 0 14px ${rgbaFromHex("#fbbf24", 0.55)}`
                    : d.isScored
                      ? `0 0 8px ${rgbaFromHex(tier.color, 0.32)}`
                      : "none",
                }}
                className={d.isNext ? "hs-dot-next" : ""}
                />
              </button>
            );
          })}
        </div>

        {/* Round axis — every 4th round to avoid clutter */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${dots.length}, minmax(0, 1fr))`,
          marginTop: 8,
          fontSize: 9, fontWeight: 800,
          letterSpacing: "0.12em",
          color: SUBTLE_TEXT,
          fontVariantNumeric: "tabular-nums",
          textTransform: "uppercase",
        }}>
          {dots.map((d, i) => (
            <span key={d.round} style={{ textAlign: "center" }}>
              {(i % (isMobile ? 4 : 3) === 0) || d.isBest || d.isNext ? `R${String(d.round).padStart(2, "0")}` : ""}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HighlightReel({ predictions, breakdown, isMobile, onSelect }) {
  const ref = useRef(null);
  const isVisible = useReveal(ref, { threshold: 0.18 });

  const scored = predictions.filter(isScoredPrediction);
  if (!scored.length) return null;

  // Best (already have via breakdown.bestRace)
  const best = breakdown.bestRace;
  // Worst — lowest-scoring scored race
  const worst = scored.reduce((acc, p) => {
    if (!acc || Number(p.score) < Number(acc.score)) return p;
    return acc;
  }, null);
  const worstRace = worst ? { round: Number(worst.race_round), score: Number(worst.score), raceName: raceNameForRound(Number(worst.race_round)) } : null;
  // Latest scored — highest round number in scored
  const latest = scored.reduce((acc, p) => {
    if (!acc || Number(p.race_round) > Number(acc.race_round)) return p;
    return acc;
  }, null);
  const latestRace = latest ? { round: Number(latest.race_round), score: Number(latest.score), raceName: raceNameForRound(Number(latest.race_round)) } : null;

  const cards = [
    best ? {
      kind: "best", color: "#fbbf24", icon: "🏆",
      kicker: "Best weekend", title: best.raceName, value: `${best.score} pts`,
      meta: `${best.accuracy}% accuracy · R${String(best.round).padStart(2, "0")}`,
      round: best.round,
    } : null,
    breakdown.longestStreak >= 2 ? {
      kind: "streak", color: "#4ade80", icon: "🔥",
      kicker: "Best streak", title: `${breakdown.longestStreak}-pick run`,
      value: `${breakdown.currentStreak} active`,
      meta: breakdown.currentStreak >= 2 ? "Riding it now" : "Earlier this season",
    } : null,
    worstRace ? {
      kind: "worst", color: "#f87171", icon: "❄",
      kicker: "Worst weekend", title: worstRace.raceName, value: `${worstRace.score} pts`,
      meta: `R${String(worstRace.round).padStart(2, "0")} · learn from it`,
      round: worstRace.round,
    } : null,
    latestRace ? {
      kind: "latest", color: "#7dd3fc", icon: "📍",
      kicker: "Latest scored", title: latestRace.raceName, value: `${latestRace.score} pts`,
      meta: `R${String(latestRace.round).padStart(2, "0")} · most recent`,
      round: latestRace.round,
    } : null,
  ].filter(Boolean);

  if (!cards.length) return null;

  return (
    <div
      ref={ref}
      className={`hs-hl ${isVisible ? "is-visible" : ""}`}
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(${cards.length}, minmax(0, 1fr))`,
        gap: isMobile ? 10 : 14,
      }}
    >
      {cards.map((c) => (
        <button
          key={c.kind}
          onClick={() => c.round && onSelect?.(c.round)}
          className="hs-hl-card f1-hoverable"
          style={{
            position: "relative", overflow: "hidden",
            textAlign: "left",
            borderRadius: CARD_RADIUS,
            border: `1px solid ${rgbaFromHex(c.color, 0.26)}`,
            background: `linear-gradient(135deg, ${rgbaFromHex(c.color, 0.14)} 0%, ${rgbaFromHex(c.color, 0.03)} 60%, ${PANEL_BG_ALT} 100%)`,
            padding: isMobile ? "16px 16px 14px" : "20px 20px 18px",
            boxShadow: CARD_SHADOW,
            cursor: c.round ? "pointer" : "default",
            fontFamily: "inherit", color: "inherit",
          }}
        >
          <span aria-hidden="true" style={{
            position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
            background: c.color, opacity: 0.85,
          }} />
          <div style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: c.color, marginBottom: 8,
            display: "inline-flex", alignItems: "center", gap: 7,
          }}>
            <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>{c.icon}</span>
            {c.kicker}
          </div>
          <div className="stint-card-title" style={{
            fontSize: isMobile ? 15 : 17,
            fontWeight: 900,
            letterSpacing: "-0.025em",
            lineHeight: 1.15,
            marginBottom: 8,
            color: TEXT_PRIMARY,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>{c.title}</div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: isMobile ? 22 : 26,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: c.color,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 0.94,
            marginBottom: 6,
          }}>{c.value}</div>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: MUTED_TEXT,
            letterSpacing: "-0.005em",
          }}>{c.meta}</div>
        </button>
      ))}
    </div>
  );
}

function FilterRail({ filters, active, onChange, isMobile }) {
  return (
    <div style={{
      display: "flex",
      gap: isMobile ? 8 : 10,
      flexWrap: "wrap",
      alignItems: "center",
    }}>
      {filters.map((f) => {
        const isActive = active === f.key;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className="hs-filter-pill"
            aria-pressed={isActive}
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              padding: isMobile ? "9px 14px" : "10px 16px",
              borderRadius: RADIUS_PILL,
              background: isActive ? rgbaFromHex(ACCENT, 0.14) : "rgba(148,163,184,0.04)",
              border: isActive ? `1px solid ${rgbaFromHex(ACCENT, 0.32)}` : `1px solid ${HAIRLINE}`,
              color: isActive ? ACCENT : TEXT_PRIMARY,
              fontFamily: "inherit",
              fontWeight: 800, fontSize: isMobile ? 12.5 : 13,
              letterSpacing: "-0.005em",
              minHeight: isMobile ? 42 : 38,
              cursor: "pointer",
              boxShadow: isActive ? `0 4px 12px ${rgbaFromHex(ACCENT, 0.18)}` : "none",
              viewTransitionName: isActive ? "history-filter-active" : undefined,
            }}
          >
            <span>{f.label}</span>
            <span className="hs-filter-count" style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.06em",
              fontVariantNumeric: "tabular-nums",
              padding: "2px 7px",
              borderRadius: 999,
              background: isActive ? rgbaFromHex(ACCENT, 0.20) : "rgba(148,163,184,0.10)",
              color: isActive ? ACCENT : SUBTLE_TEXT,
              border: isActive ? `1px solid ${rgbaFromHex(ACCENT, 0.30)}` : `1px solid ${HAIRLINE}`,
              minWidth: 22, textAlign: "center",
            }}>{f.count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── History drill-down ───────────────────────────────────────────────────────

function HistoryRaceRow({ prediction, race, result, isBestRace, isScored, isExpanded, onToggle, drillDown, isMobile }) {
  const pickCount = prediction.picks ? Object.values(prediction.picks).filter(Boolean).length : 0;
  const hitsCount = isScored ? drillDown.filter((row) => row.hit).length : 0;
  const accuracy = isScored && pickCount ? Math.round((hitsCount / pickCount) * 100) : null;
  const roundStr = String(prediction.race_round).padStart(2, "0");

  // Score-tier color — drives left tone rail + score color
  const scoreColor = !isScored
    ? "rgba(148,163,184,0.45)"
    : isBestRace ? "#fbbf24"
    : prediction.score >= 40 ? "#4ade80"
    : prediction.score >= 25 ? "#fdba74"
    : prediction.score >= 10 ? ACCENT
    : "#64748b";

  return (
    <div
      className={isScored ? "f1-hoverable" : undefined}
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: CARD_RADIUS,
        border:       isBestRace
          ? "1px solid rgba(251,191,36,0.32)"
          : `1px solid ${rgbaFromHex(scoreColor, 0.18)}`,
        background:   isBestRace
          ? `linear-gradient(135deg, rgba(251,191,36,0.14) 0%, rgba(251,191,36,0.03) 50%, ${PANEL_BG_ALT} 100%)`
          : isScored
            ? `linear-gradient(135deg, ${rgbaFromHex(scoreColor, 0.07)} 0%, ${rgbaFromHex(scoreColor, 0.01)} 50%, ${PANEL_BG} 100%)`
            : PANEL_BG,
        boxShadow:    CARD_SHADOW,
      }}
    >
      {/* Tone rail */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: scoreColor, opacity: isBestRace ? 0.9 : isScored ? 0.62 : 0.3,
      }} />
      <button
        onClick={isScored ? onToggle : undefined}
        aria-expanded={isExpanded}
        disabled={!isScored}
        className="p-history-row"
        style={{
          display:              "grid",
          gridTemplateColumns:  isMobile ? "54px minmax(0,1fr) auto" : "60px minmax(0,1fr) auto",
          gap:                  isMobile ? 14 : 18,
          alignItems:           "center",
          padding:              isMobile ? "16px 18px" : "20px 22px",
          width:                "100%",
          background:           "transparent",
          border:               "none",
          color:                TEXT_PRIMARY,
          cursor:               isScored ? "pointer" : "default",
          fontFamily:           "inherit",
          textAlign:            "left",
        }}
      >
        {/* Round badge */}
        <div style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            2,
          padding:        "8px 0",
          borderRadius:   10,
          background:     isScored ? rgbaFromHex(scoreColor, 0.08) : "rgba(148,163,184,0.06)",
          border:         `1px solid ${rgbaFromHex(scoreColor, isScored ? 0.18 : 0.12)}`,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 900,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: SUBTLE_TEXT,
          }}>RND</span>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: isMobile ? 18 : 20,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: isScored ? scoreColor : MUTED_TEXT,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}>{roundStr}</div>
        </div>

        {/* Race meta */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 5 }}>
            <span className="stint-card-title" style={{
              fontSize: isMobile ? 15.5 : 17,
              fontWeight: 900,
              letterSpacing: "-0.025em",
              lineHeight: 1.16,
              color: TEXT_PRIMARY,
            }}>{race?.n || `Round ${prediction.race_round}`}</span>
            {isBestRace && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 9, fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#fbbf24",
                background: "rgba(251,191,36,0.14)",
                border: "1px solid rgba(251,191,36,0.30)",
                borderRadius: RADIUS_PILL,
                padding: "3px 9px",
              }}>
                <span aria-hidden="true">🏆</span> Best
              </span>
            )}
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: MUTED_TEXT,
            letterSpacing: "-0.005em",
          }}>
            {pickCount} pick{pickCount !== 1 ? "s" : ""}{accuracy !== null ? ` · ${accuracy}% accuracy` : ""}{!isScored ? " · awaiting results" : ""}
          </div>

          {/* Inline category hit/miss strip — persistent visual summary, no expansion required. */}
          {isScored && drillDown.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 5, marginTop: 10, flexWrap: "wrap" }}>
              {drillDown.map((row) => (
                <span
                  key={row.key}
                  title={`${row.label}: ${row.hit ? `hit · +${row.pts}` : `missed · ${row.pick}`}`}
                  style={{
                    width:        isMobile ? 8 : 10,
                    height:       isMobile ? 8 : 10,
                    borderRadius: 3,
                    background:   row.hit ? "#4ade80" : "rgba(239,68,68,0.42)",
                    boxShadow:    row.hit ? "0 0 8px rgba(74,222,128,0.46)" : "none",
                    flexShrink:   0,
                  }}
                />
              ))}
              <span style={{
                marginLeft: 8,
                fontSize: 10, fontWeight: 900,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: SUBTLE_TEXT,
                fontVariantNumeric: "tabular-nums",
              }}>
                {drillDown.filter((r) => r.hit).length}/{drillDown.length} hits
              </span>
            </div>
          )}
        </div>

        {/* Score readout */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize:          isMobile ? 28 : 34,
              fontWeight:        700,
              letterSpacing:     "-0.045em",
              color:             scoreColor,
              fontVariantNumeric: "tabular-nums",
              lineHeight:        0.94,
            }}>{isScored ? prediction.score : "—"}</div>
            {isScored && (
              <div style={{
                fontSize: 9, color: SUBTLE_TEXT,
                textTransform: "uppercase",
                letterSpacing: "0.16em",
                fontWeight: 800,
                marginTop: 4,
              }}>pts</div>
            )}
          </div>
          {isScored && (
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                flexShrink: 0,
                color:      MUTED_TEXT,
                transform:  isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 220ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </button>

      {/* Expand drawer — animates grid-template-rows (modern, reflow-friendly) plus opacity.
           No layout thrash: the outer grid interpolates between 0fr → 1fr, and the inner
           wrapper hides overflow so the content is revealed rather than pushed. */}
      {isScored && (
        <div
          aria-hidden={!isExpanded}
          style={{
            display:          "grid",
            gridTemplateRows: isExpanded ? "1fr" : "0fr",
            transition:       "grid-template-rows 280ms cubic-bezier(0.23,1,0.32,1), opacity 200ms ease",
            opacity:          isExpanded ? 1 : 0,
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ borderTop: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, padding: "12px 16px 14px" }}>
              {result ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {drillDown.map((row, idx) => (
                    <div
                      key={row.key}
                      style={{
                        display:             "grid",
                        gridTemplateColumns: isMobile ? "minmax(0,1fr) auto auto" : "minmax(0,1.1fr) minmax(0,1.4fr) auto auto",
                        gap:                 isMobile ? 8 : 12,
                        alignItems:          "center",
                        padding:             isMobile ? "10px 10px" : "8px 10px",
                        borderRadius:        10,
                        background:          row.hit ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)",
                        border:              `1px solid ${row.hit ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)"}`,
                        /* Stagger rows in on expand — 28ms between rows, transform-only */
                        transform:           isExpanded ? "translateY(0)" : "translateY(4px)",
                        opacity:             isExpanded ? 1 : 0,
                        transition:          `transform 220ms cubic-bezier(0.23,1,0.32,1) ${isExpanded ? 80 + idx * 28 : 0}ms, opacity 220ms ease ${isExpanded ? 80 + idx * 28 : 0}ms`,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</div>
                        <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ color: SUBTLE_TEXT }}>Pick </span>{row.pick}
                        </div>
                        {/* Mobile: stack Result on a second line so users see actuals without going to desktop. */}
                        {isMobile && (
                          <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ color: SUBTLE_TEXT }}>Result </span>{row.actual || "—"}
                          </div>
                        )}
                      </div>
                      {!isMobile && (
                        <div style={{ fontSize: 11, color: MUTED_TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ color: SUBTLE_TEXT }}>Result </span>{row.actual || "—"}
                        </div>
                      )}
                      <div style={{ fontSize: 11, fontWeight: 800, color: row.hit ? SUCCESS_TEXT : ERROR_TEXT, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        {row.hit ? "Hit" : "Miss"}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: row.pts > 0 ? "#fdba74" : SUBTLE_TEXT, fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right" }}>
                        {row.pts > 0 ? `+${row.pts}` : "0"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: MUTED_TEXT, padding: "6px 10px" }}>
                  Category breakdown is waiting on the final race results to be published.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Insights pieces (preserved logic from prior version, tightened) ──────────

// ─── Insights — magazine reading system ────────────────────────────────────
// IA: Cover (hero) → Reader (article) → AI vs You spread → Category Lab →
// Studio (generate action) → Archive deck (older reports, grouped by month).
// Each surface owns its own motion + reading affordance.

function InsightCover({ insight, isPro, isMobile, onRead, onGenerate, generating, hasInsights }) {
  if (!insight) return null;
  const label = insightTypeLabel(insight.insight_type);
  const accent = insightTypeAccent(insight.insight_type);
  const titleLine = insight.race_name || label;
  const minutes = readingMinutes(insight.content);
  const issueNum = insight.metadata?.round || insight.race_round || "—";
  const generatedDate = insight.generated_at
    ? new Date(insight.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Just now";

  // First sentence of the body — used as the deck (subtitle pull)
  const deck = (() => {
    const raw = String(insight.content || insight.summary || "").trim();
    const firstPara = raw.split(/\n{2,}/)[0] || "";
    const firstSentence = firstPara.split(/(?<=[.!?])\s+/)[0] || firstPara;
    return firstSentence.slice(0, 220);
  })();

  return (
    <section
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       `1px solid ${rgbaFromHex(accent, 0.32)}`,
        background:   `
          linear-gradient(140deg, ${rgbaFromHex(accent, 0.30)} 0%, ${rgbaFromHex(accent, 0.08)} 40%, rgba(6,16,27,0.96) 100%),
          url("/images/header-insight.png") center / cover no-repeat,
          ${PANEL_BG}
        `,
        boxShadow:    LIFTED_SHADOW,
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${accent} 30%, ${accent} 70%, transparent)`,
        opacity: 0.92,
      }} />
      <div style={{ position: "relative", padding: isMobile ? "26px 22px 24px" : "40px 40px 36px" }}>
        {/* Issue stamp row */}
        <div className="in-cover-meta" style={{
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          marginBottom: isMobile ? 18 : 26,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 12px", borderRadius: RADIUS_PILL,
            background: rgbaFromHex(accent, 0.14),
            border: `1px solid ${rgbaFromHex(accent, 0.32)}`,
            fontSize: 10, fontWeight: 900, letterSpacing: "0.16em",
            textTransform: "uppercase", color: accent,
          }}>
            <span aria-hidden="true" style={{
              width: 5, height: 5, borderRadius: "50%", background: accent,
              boxShadow: `0 0 0 4px ${rgbaFromHex(accent, 0.22)}`,
            }} />
            {label}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 900, letterSpacing: "0.16em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.62)",
            fontVariantNumeric: "tabular-nums",
          }}>
            Issue № {String(issueNum).padStart(2, "0")} · {generatedDate}
          </span>
          <span style={{
            marginLeft: "auto",
            fontSize: 10, fontWeight: 900, letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.78)",
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 11px", borderRadius: RADIUS_PILL,
            background: "rgba(6,16,27,0.46)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>⏱</span>
            {minutes} min read
          </span>
        </div>

        {/* Big title — types in letter-by-letter */}
        <h2 className="stint-page-title" style={{
          margin: 0,
          fontSize:      isMobile ? 34 : 60,
          letterSpacing: "-0.05em",
          lineHeight:    0.95,
          color:         "rgba(255,255,255,0.98)",
          textShadow:    "0 2px 18px rgba(0,0,0,0.32)",
          textTransform: "uppercase",
          maxWidth:      "16ch",
        }}>
          {titleLine.split("").map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              className="in-cover-char"
              style={{ animationDelay: `${80 + i * 36}ms` }}
            >{ch === " " ? " " : ch}</span>
          ))}
        </h2>

        {/* Deck (excerpt) */}
        {deck && (
          <p className="in-cover-deck" style={{
            margin: isMobile ? "18px 0 0" : "22px 0 0",
            fontSize: isMobile ? 15 : 17,
            fontWeight: 500,
            color: "rgba(226,232,240,0.84)",
            lineHeight: 1.55,
            maxWidth: "60ch",
            letterSpacing: "-0.005em",
          }}>{deck}{deck.length === 220 ? "…" : ""}</p>
        )}

        {/* CTA row */}
        <div className="in-cover-cta" style={{
          marginTop: isMobile ? 22 : 30,
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <button
            onClick={onRead}
            className="p-action-btn f1-hoverable"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: BRAND_GRADIENT, border: "none",
              borderRadius: RADIUS_PILL, color: "#fff",
              fontSize: 13.5, fontWeight: 900, padding: "13px 24px",
              letterSpacing: "-0.005em", fontFamily: "inherit",
              boxShadow: `0 8px 24px ${rgbaFromHex(ACCENT, 0.32)}`,
              cursor: "pointer",
            }}
          >Read full report  →</button>
          {isPro && onGenerate && (
            <button
              onClick={onGenerate}
              disabled={generating}
              className="in-generate"
              data-busy={generating ? "true" : "false"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(6,16,27,0.42)",
                border: `1px solid ${rgbaFromHex(accent, 0.32)}`,
                borderRadius: RADIUS_PILL,
                color: generating ? MUTED_TEXT : "rgba(255,255,255,0.92)",
                fontSize: 12, fontWeight: 800, padding: "11px 18px",
                letterSpacing: "0.04em", textTransform: "uppercase",
                fontFamily: "inherit", cursor: generating ? "wait" : "pointer",
              }}
            >
              {generating ? "Generating…" : hasInsights ? "New report" : "Generate report"}
            </button>
          )}
          {insight.source_count && (
            <span style={{
              marginLeft: "auto",
              fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.62)",
              letterSpacing: "0.14em", textTransform: "uppercase",
              fontVariantNumeric: "tabular-nums",
            }}>{insight.source_count} sources read</span>
          )}
        </div>
      </div>
    </section>
  );
}

function InsightReader({ insight, coach, isMobile, accent, onTour }) {
  const articleRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const paraRefs = useRef([]);

  // Reading progress — measures how far through the article you've scrolled.
  useEffect(() => {
    if (!insight) return undefined;
    const article = articleRef.current;
    if (!article) return undefined;
    const onScroll = () => {
      const rect = article.getBoundingClientRect();
      const viewH = window.innerHeight || 1;
      // 0 when top of article hits viewport bottom; 1 when bottom hits viewport top.
      const total  = rect.height + viewH;
      const passed = viewH - rect.top;
      const pct    = Math.max(0, Math.min(1, passed / total));
      setProgress(pct);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [insight]);

  // Paragraph fade-in on scroll
  useEffect(() => {
    const paras = paraRefs.current.filter(Boolean);
    if (!paras.length) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      paras.forEach((p) => p.classList.add("is-visible"));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-visible"); }),
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    paras.forEach((p) => observer.observe(p));
    return () => observer.disconnect();
  }, [insight]);

  if (!insight) return null;
  const accentColor = accent || insightTypeAccent(insight.insight_type);
  const label = insightTypeLabel(insight.insight_type);
  const minutes = readingMinutes(insight.content);
  const generatedDate = insight.generated_at
    ? new Date(insight.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "Just now";
  const blocks = String(insight.content || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <article ref={articleRef} style={{ position: "relative" }}>
      {/* Reading progress bar — sticks just under the navbar */}
      <div className="in-progress-bar" aria-hidden="true">
        <div className="in-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {/* Article wrapper */}
      <div style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       PANEL_BORDER,
        background:   PANEL_BG,
        padding:      isMobile ? "28px 22px" : "44px 48px",
        boxShadow:    CARD_SHADOW,
      }}>
        <header style={{ marginBottom: isMobile ? 28 : 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: accentColor,
            }}>
              <span aria-hidden="true" style={{
                width: 5, height: 5, borderRadius: "50%", background: accentColor,
                boxShadow: `0 0 0 3px ${rgbaFromHex(accentColor, 0.20)}`,
              }} />
              {label}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: SUBTLE_TEXT,
            }}>
              {generatedDate} · {minutes} min read
            </span>
          </div>
          <h1 className="stint-section-title" style={{
            margin: 0,
            fontSize: isMobile ? 28 : 40,
            letterSpacing: "-0.04em",
            lineHeight: 1.04,
            color: TEXT_PRIMARY,
            maxWidth: "20ch",
          }}>{insight.race_name || label}</h1>
        </header>

        {/* Two-column: article body + margin notes (desktop) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) 240px",
          gap: isMobile ? 24 : 48,
        }}>
          {/* Article body */}
          <div style={{ maxWidth: 720 }}>
            {blocks.map((block, index) => {
              const isHeading = /^[A-Z][A-Z\s]+$/.test(block) && block.length < 32;
              const setRef = (el) => { paraRefs.current[index] = el; };
              if (isHeading) {
                return (
                  <div key={`h${index}`} ref={setRef} className="in-para">
                    {index > 0 && (
                      <div className="in-divider" aria-hidden="true">
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: accentColor, opacity: 0.6,
                        }} />
                      </div>
                    )}
                    <div style={{
                      fontSize: 10, fontWeight: 900,
                      letterSpacing: "0.18em", textTransform: "uppercase",
                      color: accentColor,
                      marginBottom: 12,
                    }}>{block}</div>
                  </div>
                );
              }
              // First paragraph after the header gets a drop cap
              const firstBodyIdx = blocks.findIndex((b) => !(/^[A-Z][A-Z\s]+$/.test(b) && b.length < 32));
              const isFirstBody = index === firstBodyIdx;
              return (
                <p
                  key={`p${index}`}
                  ref={setRef}
                  className={`in-para ${isFirstBody ? "in-dropcap" : ""}`}
                  style={{
                    margin: index === 0 ? "0 0 18px" : "0 0 18px",
                    fontSize: isMobile ? 15.5 : 17,
                    lineHeight: 1.78,
                    color: "rgba(226,232,240,0.88)",
                    letterSpacing: "-0.005em",
                  }}
                >{block}</p>
              );
            })}
          </div>

          {/* Margin notes (desktop only) */}
          {!isMobile && coach && (
            <aside style={{
              alignSelf: "start",
              position:  "sticky",
              top:       100,
              display:   "grid",
              gap:       10,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 900,
                letterSpacing: "0.16em", textTransform: "uppercase",
                color: accentColor, marginBottom: 4,
              }}>Margin notes</div>
              {[
                { label: "Confidence", value: coach.confidence.label, detail: coach.confidence.detail, color: "#7dd3fc" },
                { label: "Best edge",  value: coach.protectCategory?.shortLabel || "Forming", detail: coach.protectCategory ? `${coach.protectCategory.accuracy}% accuracy` : "More data soon", color: "#fdba74" },
                { label: "Next move",  value: coach.nextMoveTitle, detail: coach.nextMoveDetail, color: "#fbbf24" },
              ].map((item) => (
                <div key={item.label} className="f1-hoverable" style={{
                  position: "relative", overflow: "hidden",
                  borderRadius: CARD_RADIUS,
                  border: `1px solid ${rgbaFromHex(item.color, 0.20)}`,
                  background: PANEL_BG_ALT,
                  padding: "13px 14px 12px",
                }}>
                  <span aria-hidden="true" style={{
                    position: "absolute", top: 0, bottom: 0, left: 0,
                    width: 2, background: item.color, opacity: 0.7,
                  }} />
                  <div style={{
                    fontSize: 9, fontWeight: 900,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    color: item.color, marginBottom: 5,
                  }}>{item.label}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 900,
                    letterSpacing: "-0.018em", color: TEXT_PRIMARY,
                    lineHeight: 1.2, marginBottom: 4,
                  }}>{item.value}</div>
                  <div style={{
                    fontSize: 11, color: MUTED_TEXT,
                    lineHeight: 1.5,
                  }}>{item.detail}</div>
                </div>
              ))}
            </aside>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: isMobile ? 24 : 36,
          paddingTop: 18,
          borderTop: `1px solid ${HAIRLINE}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: SUBTLE_TEXT,
            letterSpacing: "-0.005em",
          }}>
            Stint AI · {generatedDate}{insight.source_count ? ` · ${insight.source_count} sources` : ""}
          </div>
          {onTour && (
            <button
              onClick={onTour}
              className="p-action-btn"
              style={{
                background: rgbaFromHex(accentColor, 0.12),
                border: `1px solid ${rgbaFromHex(accentColor, 0.30)}`,
                borderRadius: RADIUS_PILL,
                color: accentColor, cursor: "pointer",
                fontSize: 11, fontWeight: 900, padding: "8px 14px",
                fontFamily: "inherit",
                letterSpacing: "0.10em", textTransform: "uppercase",
              }}
            >Next report  →</button>
          )}
        </div>
      </div>
    </article>
  );
}

function InsightCard({ label, raceName, date, content, typeColor = ACCENT }) {
  const paragraphs = String(content || "").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return (
    <article
      className="f1-hoverable"
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: CARD_RADIUS,
        border:       `1px solid ${rgbaFromHex(typeColor, 0.22)}`,
        background:   `linear-gradient(135deg, ${rgbaFromHex(typeColor, 0.07)} 0%, ${rgbaFromHex(typeColor, 0.01)} 60%, ${PANEL_BG} 100%)`,
        padding:      "22px 24px 22px",
        boxShadow:    CARD_SHADOW,
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: typeColor, opacity: 0.7,
      }} />
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "flex-start",
        gap:            12,
        flexWrap:       "wrap",
        marginBottom:   14,
      }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: "50%", background: typeColor,
              boxShadow: `0 0 0 4px ${rgbaFromHex(typeColor, 0.20)}`,
            }} />
            <span style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: typeColor,
            }}>{label}</span>
          </div>
          {raceName && (
            <div className="stint-card-title" style={{
              fontSize: 17,
              fontWeight: 900,
              letterSpacing: "-0.028em",
              lineHeight: 1.16,
              color: TEXT_PRIMARY,
            }}>{raceName}</div>
          )}
        </div>
        {date && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: SUBTLE_TEXT,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}>{date}</span>
        )}
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {(paragraphs.length ? paragraphs : [String(content || "")]).map((paragraph, index) => {
          const isHeading = /^[A-Z][A-Z\s]+$/.test(paragraph) && paragraph.length < 32;
          if (isHeading) {
            return (
              <div key={`h${index}`} style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: typeColor,
                marginTop: index === 0 ? 0 : 6,
              }}>{paragraph}</div>
            );
          }
          return (
            <p key={`p${index}`} style={{
              margin: 0,
              fontSize: 14.5,
              lineHeight: 1.68,
              color: "rgba(214,223,239,0.88)",
              whiteSpace: "pre-line",
              maxWidth: "62ch",
              letterSpacing: "-0.005em",
            }}>
              {paragraph}
            </p>
          );
        })}
      </div>
    </article>
  );
}

function PrimaryInsightCard({ insight, coach, isMobile, isTablet }) {
  if (!insight) return null;
  const label = insightTypeLabel(insight.insight_type);
  const typeColor = insight.insight_type === "monthly" ? ACCENT : "#7dd3fc";
  const blocks = String(insight.content || "").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <article style={{
      position:     "relative",
      overflow:     "hidden",
      borderRadius: SECTION_RADIUS,
      border:       `1px solid ${rgbaFromHex(typeColor, 0.28)}`,
      background:   `linear-gradient(135deg, ${rgbaFromHex(typeColor, 0.14)} 0%, ${rgbaFromHex(typeColor, 0.03)} 50%, ${PANEL_BG} 100%)`,
      padding:      isMobile ? "24px 22px 22px" : "32px 34px 30px",
      boxShadow:    LIFTED_SHADOW,
    }}>
      {/* Top tone rail */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${typeColor} 30%, ${typeColor} 70%, transparent)`,
        opacity: 0.85,
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: isMobile ? 18 : 24 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: "50%", background: typeColor,
              boxShadow: `0 0 0 4px ${rgbaFromHex(typeColor, 0.22)}`,
            }} />
            <span style={{
              fontSize: 11, fontWeight: 900,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: typeColor,
            }}>{label} · Pro</span>
          </div>
          <h2 className="stint-page-title" style={{
            margin: "0 0 8px",
            fontSize: isMobile ? 28 : 40,
            letterSpacing: "-0.04em",
            lineHeight: 1.02,
            color: TEXT_PRIMARY,
            textTransform: "uppercase",
          }}>{insight.race_name || label}</h2>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: SUBTLE_TEXT,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontVariantNumeric: "tabular-nums",
          }}>
            {insight.generated_at
              ? new Date(insight.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "Just now"}
          </div>
        </div>

        <div style={{
          display:             "grid",
          gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0,1fr) 260px",
          gap:                 isMobile || isTablet ? 22 : 32,
        }}>
          {/* Body copy */}
          <div style={{ display: "grid", gap: 14, maxWidth: 720 }}>
            {blocks.map((block, index) => {
              const isHeading = /^[A-Z][A-Z\s]+$/.test(block) && block.length < 32;
              if (isHeading) {
                return (
                  <div key={`h${index}`} style={{
                    paddingTop: index === 0 ? 0 : 6,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: typeColor,
                  }}>{block}</div>
                );
              }
              return (
                <p key={`p${index}`} style={{
                  margin: 0,
                  fontSize: isMobile ? 14.5 : 15.5,
                  lineHeight: 1.72,
                  color: "rgba(226,232,240,0.88)",
                  maxWidth: "62ch",
                  letterSpacing: "-0.005em",
                }}>
                  {block}
                </p>
              );
            })}
          </div>

          {/* Right-rail stat cards */}
          <div style={{ display: "grid", gap: 10, alignSelf: "start" }}>
            {[
              { label: "Confidence", value: coach.confidence.label,                                detail: coach.confidence.detail,                                            accent: "#7dd3fc" },
              { label: "Best edge",  value: coach.protectCategory?.shortLabel || "Still forming", detail: coach.protectCategory ? `${coach.protectCategory.accuracy}% accuracy · ${coach.protectCategory.points} pts` : "The model needs more data.", accent: "#fdba74" },
              { label: "Next move",  value: coach.nextMoveTitle,                                  detail: coach.nextMoveDetail,                                                 accent: "#fbbf24" },
            ].map((item) => (
              <div
                key={item.label}
                className="f1-hoverable"
                style={{
                  position:     "relative",
                  overflow:     "hidden",
                  borderRadius: CARD_RADIUS,
                  border:       `1px solid ${rgbaFromHex(item.accent, 0.22)}`,
                  background:   `linear-gradient(135deg, ${rgbaFromHex(item.accent, 0.10)} 0%, ${rgbaFromHex(item.accent, 0.02)} 60%, rgba(8,14,26,0.82) 100%)`,
                  padding:      "16px 16px 15px",
                  boxShadow:    CARD_SHADOW,
                }}
              >
                <span aria-hidden="true" style={{
                  position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                  background: item.accent, opacity: 0.7,
                }} />
                <div style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: item.accent,
                  marginBottom: 7,
                }}>{item.label}</div>
                <div className="stint-card-title" style={{
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.18,
                  marginBottom: 5,
                  color: TEXT_PRIMARY,
                }}>{item.value}</div>
                <div style={{
                  fontSize: 12,
                  color: MUTED_TEXT,
                  lineHeight: 1.55,
                  letterSpacing: "-0.005em",
                }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function AiVsYouSpread({ coach, breakdown, history, isMobile }) {
  const ref = useRef(null);
  const isVisible = useReveal(ref, { threshold: 0.32 });
  if (!coach?.comparisonAvailable) return null;

  const aiCategoryMap = new Map((history?.categories || []).map((c) => [c.key, c]));
  const wins = (coach.comparisonWins || []).slice(0, 3);
  const losses = (coach.comparisonLosses || []).slice(0, 3);
  const delta = coach.comparisonDelta ?? 0;
  const deltaColor = delta >= 0 ? "#fdba74" : AI_BLUE_TEXT;

  // Hero comparison numbers
  const youPct = breakdown?.accuracy ?? 0;
  const aiPct  = history?.accuracy ?? Math.max(0, youPct - delta);

  return (
    <section
      ref={ref}
      className={`in-vs f1-hoverable ${isVisible ? "is-visible" : ""}`}
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: CARD_RADIUS,
        border:       `1px solid ${rgbaFromHex(AI_BLUE, 0.24)}`,
        background:   `linear-gradient(135deg, ${rgbaFromHex(AI_BLUE, 0.10)} 0%, ${rgbaFromHex(AI_BLUE, 0.02)} 60%, ${PANEL_BG} 100%)`,
        padding:      isMobile ? "22px 22px 24px" : "30px 32px 32px",
        boxShadow:    CARD_SHADOW,
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: AI_BLUE_TEXT, opacity: 0.65,
      }} />
      <header style={{ marginBottom: isMobile ? 22 : 28 }}>
        <div style={{
          fontSize: 10, fontWeight: 900,
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: AI_BLUE_TEXT, marginBottom: 6,
        }}>AI vs You · {history?.sourceLabel || "Stored benchmark"}</div>
        <h2 className="stint-section-title" style={{
          margin: 0,
          fontSize: isMobile ? 22 : 30,
          letterSpacing: "-0.035em",
          lineHeight: 1.1,
        }}>Who&apos;s reading the race better?</h2>
      </header>

      {/* Hero comparison — two big numbers facing each other */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto minmax(0,1fr)",
        gap: isMobile ? 16 : 24,
        alignItems: "center",
        marginBottom: isMobile ? 22 : 30,
      }}>
        {/* You */}
        <div style={{
          padding: isMobile ? "18px 20px" : "22px 24px",
          borderRadius: CARD_RADIUS,
          border: `1px solid ${rgbaFromHex(ACCENT, 0.30)}`,
          background: `linear-gradient(135deg, ${rgbaFromHex(ACCENT, 0.12)} 0%, ${rgbaFromHex(ACCENT, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
          textAlign: isMobile ? "left" : "right",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: ACCENT, marginBottom: 8,
          }}>You</div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: isMobile ? 48 : 64,
            fontWeight: 700, color: ACCENT,
            letterSpacing: "-0.05em", lineHeight: 0.92,
            fontVariantNumeric: "tabular-nums",
          }}>{youPct}<span style={{ fontSize: "0.45em", marginLeft: 4 }}>%</span></div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: MUTED_TEXT,
            marginTop: 8, fontVariantNumeric: "tabular-nums",
          }}>{breakdown?.totalCorrect}/{breakdown?.totalPicks} hits</div>
        </div>
        {/* vs */}
        {!isMobile && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            color: SUBTLE_TEXT,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 900,
              letterSpacing: "0.18em", textTransform: "uppercase",
            }}>vs</span>
            <span style={{
              fontSize: 18, fontWeight: 900, color: deltaColor,
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.03em",
            }}>{delta >= 0 ? "+" : ""}{delta}%</span>
          </div>
        )}
        {/* AI */}
        <div style={{
          padding: isMobile ? "18px 20px" : "22px 24px",
          borderRadius: CARD_RADIUS,
          border: `1px solid ${rgbaFromHex(AI_BLUE, 0.30)}`,
          background: `linear-gradient(135deg, ${rgbaFromHex(AI_BLUE, 0.12)} 0%, ${rgbaFromHex(AI_BLUE, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
          textAlign: "left",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: AI_BLUE_TEXT, marginBottom: 8,
          }}>Stint AI</div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: isMobile ? 48 : 64,
            fontWeight: 700, color: AI_BLUE,
            letterSpacing: "-0.05em", lineHeight: 0.92,
            fontVariantNumeric: "tabular-nums",
          }}>{aiPct}<span style={{ fontSize: "0.45em", marginLeft: 4 }}>%</span></div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: MUTED_TEXT,
            marginTop: 8,
          }}>{history?.sourceDetail || coach.historyStatusDetail || "Stored AI picks"}</div>
        </div>
      </div>

      {/* Summary */}
      <p style={{
        margin: "0 0 22px",
        fontSize: isMobile ? 14 : 15,
        lineHeight: 1.65,
        color: "rgba(226,232,240,0.82)",
        maxWidth: "62ch",
        fontWeight: 500,
      }}>{coach.comparisonSummary}</p>

      {/* Wins / Losses */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: isMobile ? 12 : 16,
      }}>
        {wins.length > 0 && (
          <div style={{
            position: "relative", overflow: "hidden",
            borderRadius: CARD_RADIUS,
            border: "1px solid rgba(253,186,116,0.22)",
            background: `linear-gradient(135deg, rgba(253,186,116,0.10) 0%, rgba(253,186,116,0.02) 60%, ${PANEL_BG_ALT} 100%)`,
            padding: "18px 20px",
          }}>
            <span aria-hidden="true" style={{
              position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
              background: "#fdba74", opacity: 0.7,
            }} />
            <div style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: "#fdba74", marginBottom: 12,
              display: "inline-flex", alignItems: "center", gap: 7,
            }}>
              <span aria-hidden="true">↗</span> You ahead in
            </div>
            {wins.map((row) => (
              <div key={row.key} style={{ marginBottom: 12 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "baseline", gap: 8, marginBottom: 6,
                }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: TEXT_PRIMARY }}>{row.label}</span>
                  <span style={{
                    fontSize: 16, fontWeight: 900, color: "#fdba74",
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.025em",
                  }}>+{row.delta}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 999, background: "rgba(148,163,184,0.10)", overflow: "hidden" }}>
                  <div className="in-vs-bar" style={{
                    width: `${Math.min(100, Math.abs(row.delta) * 3)}%`,
                    height: "100%", borderRadius: 999,
                    background: "linear-gradient(90deg, #fdba74, #fbbf24)",
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {losses.length > 0 && (
          <div style={{
            position: "relative", overflow: "hidden",
            borderRadius: CARD_RADIUS,
            border: `1px solid ${rgbaFromHex(AI_BLUE, 0.22)}`,
            background: `linear-gradient(135deg, ${rgbaFromHex(AI_BLUE, 0.10)} 0%, ${rgbaFromHex(AI_BLUE, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
            padding: "18px 20px",
          }}>
            <span aria-hidden="true" style={{
              position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
              background: AI_BLUE_TEXT, opacity: 0.7,
            }} />
            <div style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: AI_BLUE_TEXT, marginBottom: 12,
              display: "inline-flex", alignItems: "center", gap: 7,
            }}>
              <span aria-hidden="true">↘</span> AI ahead in
            </div>
            {losses.map((row) => (
              <div key={row.key} style={{ marginBottom: 12 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "baseline", gap: 8, marginBottom: 6,
                }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: TEXT_PRIMARY }}>{row.label}</span>
                  <span style={{
                    fontSize: 16, fontWeight: 900, color: AI_BLUE_TEXT,
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.025em",
                  }}>{row.delta}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 999, background: "rgba(148,163,184,0.10)", overflow: "hidden" }}>
                  <div className="in-vs-bar" style={{
                    width: `${Math.min(100, Math.abs(row.delta) * 3)}%`,
                    height: "100%", borderRadius: 999,
                    background: `linear-gradient(90deg, ${AI_BLUE_TEXT}, ${rgbaFromHex(AI_BLUE_TEXT, 0.6)})`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryLab({ breakdown, history, isMobile }) {
  const ref = useRef(null);
  const isVisible = useReveal(ref, { threshold: 0.18 });
  if (!breakdown?.scoredRounds) return null;
  const aiCategoryMap = new Map((history?.categories || []).map((c) => [c.key, c]));
  const showAi = !!history?.categories?.length;

  return (
    <section
      ref={ref}
      className={`in-lab f1-hoverable ${isVisible ? "is-visible" : ""}`}
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: CARD_RADIUS,
        border:       PANEL_BORDER,
        background:   PANEL_BG,
        padding:      isMobile ? "22px 22px" : "28px 32px",
        boxShadow:    CARD_SHADOW,
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: ACCENT, opacity: 0.55,
      }} />
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        gap: 12, flexWrap: "wrap", marginBottom: isMobile ? 18 : 24,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: ACCENT, marginBottom: 5,
          }}>Category lab</div>
          <h2 className="stint-section-title" style={{
            margin: 0,
            fontSize: isMobile ? 22 : 28,
            letterSpacing: "-0.035em",
            lineHeight: 1.12,
          }}>Every category, hits + misses</h2>
        </div>
        {showAi && (
          <span style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: SUBTLE_TEXT,
            display: "inline-flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 2, background: ACCENT, borderRadius: 2 }} />
              You
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 2, background: AI_BLUE_TEXT, borderRadius: 2 }} />
              {history?.sourceLabel || "AI"}
            </span>
          </span>
        )}
      </header>

      <div style={{ display: "grid", gap: 16 }}>
        {breakdown.categories.map((category) => {
          const aiCategory = aiCategoryMap.get(category.key) || null;
          return (
            <div key={category.key} className="in-cat-row">
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", gap: 10, marginBottom: 6,
              }}>
                <span style={{
                  fontSize: 14, fontWeight: 800,
                  letterSpacing: "-0.015em",
                  color: TEXT_PRIMARY,
                  minWidth: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{category.label}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 16, fontWeight: 900, color: ACCENT,
                    fontFamily: "var(--font-display)",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.03em",
                  }}>{category.accuracy}<span style={{ fontSize: "0.6em", opacity: 0.6 }}>%</span></span>
                  {showAi && (
                    <span style={{
                      fontSize: 12, fontWeight: 800, color: AI_BLUE_TEXT,
                      fontFamily: "var(--font-mono)",
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-0.02em",
                      minWidth: 44, textAlign: "right",
                    }}>{aiCategory ? `${aiCategory.accuracy}%` : "—"}</span>
                  )}
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: SUBTLE_TEXT,
                    fontVariantNumeric: "tabular-nums", minWidth: 50, textAlign: "right",
                  }}>{category.points} pts</span>
                </div>
              </div>
              {/* You bar — solid so the fill matches the labeled accuracy */}
              <div style={{
                position: "relative",
                height: 4, borderRadius: 999,
                background: "rgba(148,163,184,0.10)", overflow: "hidden",
                marginBottom: showAi && aiCategory ? 4 : 0,
              }}>
                <div className="in-cat-fill" style={{
                  width: `${category.accuracy}%`, height: "100%",
                  borderRadius: 999,
                  background: ACCENT,
                }} />
              </div>
              {/* AI bar — solid blue, no gradient tail */}
              {showAi && aiCategory && (
                <div style={{
                  position: "relative",
                  height: 4, borderRadius: 999,
                  background: "rgba(148,163,184,0.10)", overflow: "hidden",
                }}>
                  <div className="in-cat-fill" style={{
                    width: `${aiCategory.accuracy}%`, height: "100%",
                    borderRadius: 999,
                    background: AI_BLUE_TEXT,
                  }} />
                </div>
              )}
              <div style={{
                fontSize: 11, fontWeight: 600, color: SUBTLE_TEXT,
                marginTop: 6, letterSpacing: "-0.005em",
                fontVariantNumeric: "tabular-nums",
              }}>{category.correct}/{category.total} hits</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InsightStudio({ onGenerate, generating, hasInsights, isAdmin, onReplay, replayBusy, aiLoadError, aiMessage, isMobile }) {
  return (
    <section
      className="f1-hoverable"
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: CARD_RADIUS,
        border:       `1px solid ${rgbaFromHex(AI_BLUE, 0.24)}`,
        background:   `linear-gradient(135deg, ${rgbaFromHex(AI_BLUE, 0.12)} 0%, ${rgbaFromHex(AI_BLUE, 0.02)} 60%, ${PANEL_BG} 100%)`,
        padding:      isMobile ? "22px 22px" : "26px 30px",
        boxShadow:    CARD_SHADOW,
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
        background: AI_BLUE_TEXT, opacity: 0.7,
      }} />
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: AI_BLUE_TEXT, marginBottom: 6,
          }}>Studio</div>
          <h3 className="stint-card-title" style={{
            margin: "0 0 5px",
            fontSize: 17,
            letterSpacing: "-0.028em",
            lineHeight: 1.16,
            color: TEXT_PRIMARY,
          }}>{hasInsights ? "Generate a fresh report" : "Write your first report"}</h3>
          <div style={{ fontSize: 12.5, color: MUTED_TEXT, lineHeight: 1.55, maxWidth: "52ch" }}>
            Stint AI reads your last 5 rounds and writes a debrief in the same voice as the official briefs.
          </div>
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="in-generate p-action-btn"
          data-busy={generating ? "true" : "false"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: generating ? "rgba(96,165,250,0.14)" : BRAND_GRADIENT,
            border: "none", borderRadius: RADIUS_PILL,
            color: "#fff",
            cursor: generating ? "wait" : "pointer",
            fontWeight: 900, fontSize: 13.5,
            padding: "13px 24px", fontFamily: "inherit",
            letterSpacing: "-0.005em",
            boxShadow: generating ? "none" : `0 8px 24px ${rgbaFromHex(ACCENT, 0.32)}`,
            flexShrink: 0,
          }}
        >
          {generating ? "Generating…" : hasInsights ? "New report" : "Generate report"}
          <span style={{ fontSize: 13 }}>{generating ? "⏳" : "→"}</span>
        </button>
      </div>
      {(aiLoadError || aiMessage) && (
        <div style={{
          marginTop: 14,
          padding: "10px 14px",
          borderRadius: RADIUS_MD,
          border: aiLoadError ? "1px solid rgba(248,113,113,0.24)" : "1px solid rgba(96,165,250,0.22)",
          background: aiLoadError ? "rgba(127,29,29,0.16)" : "rgba(30,64,175,0.10)",
          fontSize: 12, color: aiLoadError ? "#fecaca" : "#bae6fd",
          lineHeight: 1.55,
          display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          alignItems: "center",
        }}>
          <span>{aiLoadError || aiMessage}</span>
          {isAdmin && (
            <button onClick={onReplay} disabled={replayBusy} style={{
              background: "rgba(59,130,246,0.18)", border: "1px solid rgba(96,165,250,0.30)",
              borderRadius: RADIUS_PILL, color: "#dbeafe",
              cursor: replayBusy ? "default" : "pointer",
              fontSize: 11, fontWeight: 800, padding: "6px 12px", fontFamily: "inherit",
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>{replayBusy ? "Building…" : "Retry replay"}</button>
          )}
        </div>
      )}
    </section>
  );
}

function InsightArchiveDeck({ insights, isMobile, onSelect, activeId }) {
  if (!insights?.length) return null;

  // Group by month using generated_at
  const groups = {};
  insights.forEach((ins) => {
    const d = ins.generated_at ? new Date(ins.generated_at) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!groups[key]) groups[key] = { key, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), items: [] };
    groups[key].items.push(ins);
  });
  const ordered = Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));

  return (
    <div style={{ display: "grid", gap: isMobile ? 22 : 28 }}>
      {ordered.map((group) => (
        <div key={group.key}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            marginBottom: isMobile ? 12 : 16,
          }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: "50%",
              background: SUBTLE_TEXT, opacity: 0.6,
            }} />
            <span style={{
              fontSize: 11, fontWeight: 900,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: TEXT_PRIMARY,
              fontFamily: "var(--font-display)",
            }}>{group.label}</span>
            <span aria-hidden="true" style={{ flex: 1, height: 1, background: HAIRLINE }} />
            <span style={{
              fontSize: 10, fontWeight: 800,
              letterSpacing: "0.10em",
              color: SUBTLE_TEXT,
              fontVariantNumeric: "tabular-nums",
            }}>{group.items.length} {group.items.length === 1 ? "report" : "reports"}</span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
            gap: isMobile ? 12 : 14,
          }}>
            {group.items.map((ins) => {
              const accent = insightTypeAccent(ins.insight_type);
              const label  = insightTypeLabel(ins.insight_type);
              const date   = ins.generated_at
                ? new Date(ins.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "—";
              const excerpt = String(ins.content || "").split(/\n{2,}/)[0] || "";
              const minutes = readingMinutes(ins.content);
              const isActive = ins.id === activeId;
              return (
                <button
                  key={ins.id}
                  type="button"
                  onClick={() => onSelect?.(ins)}
                  className="in-archive-card f1-hoverable"
                  style={{
                    position: "relative", overflow: "hidden",
                    textAlign: "left",
                    borderRadius: CARD_RADIUS,
                    border: `1px solid ${rgbaFromHex(accent, isActive ? 0.40 : 0.20)}`,
                    background: `linear-gradient(135deg, ${rgbaFromHex(accent, isActive ? 0.14 : 0.07)} 0%, ${rgbaFromHex(accent, 0.01)} 60%, ${PANEL_BG_ALT} 100%)`,
                    padding: "18px 20px",
                    boxShadow: isActive ? `0 10px 28px ${rgbaFromHex(accent, 0.22)}, ${CARD_SHADOW}` : CARD_SHADOW,
                    fontFamily: "inherit", color: "inherit",
                    cursor: "pointer",
                  }}
                  aria-pressed={isActive}
                >
                  <span aria-hidden="true" style={{
                    position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                    background: accent, opacity: isActive ? 0.95 : 0.7,
                  }} />
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "baseline", gap: 8, marginBottom: 10,
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 900,
                      letterSpacing: "0.16em", textTransform: "uppercase",
                      color: accent,
                    }}>{label}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      color: SUBTLE_TEXT, letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      fontVariantNumeric: "tabular-nums",
                    }}>{date} · {minutes}m</span>
                  </div>
                  <div className="stint-card-title" style={{
                    fontSize: 16, fontWeight: 900,
                    letterSpacing: "-0.024em", lineHeight: 1.2,
                    marginBottom: 8,
                    color: TEXT_PRIMARY,
                  }}>{ins.race_name || label}</div>
                  {excerpt && (
                    <div style={{
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      color: MUTED_TEXT,
                      letterSpacing: "-0.005em",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>{excerpt}</div>
                  )}
                  <div style={{
                    marginTop: 12, paddingTop: 10,
                    borderTop: `1px solid ${HAIRLINE}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    fontSize: 10, fontWeight: 900,
                    letterSpacing: "0.14em", textTransform: "uppercase",
                    color: accent,
                  }}>
                    <span>{isActive ? "Reading" : "Read"}</span>
                    <span aria-hidden="true">→</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function BreakdownPanel({
  breakdown, coach, history,
  isMobile, isTablet,
  onGenerate, generating, hasInsights,
  aiLoadError, aiMessage,
  isAdmin, onReplay, replayBusy,
}) {
  if (!breakdown?.scoredRounds) {
    return (
      <div style={{ borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG, padding: "36px 28px", textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>No scored races yet</div>
        <div style={{ fontSize: 13, color: MUTED_TEXT, maxWidth: 320, margin: "0 auto", lineHeight: 1.6 }}>
          Your breakdown and coach analysis appear here after your first race is scored.
        </div>
      </div>
    );
  }

  const aiStatusText = aiLoadError || aiMessage;
  const showAiHistoryColumn = coach.comparisonAvailable;
  const aiCategoryMap = new Map((history?.categories || []).map((c) => [c.key, c]));

  const metricCards = [
    { label: "Season accuracy", value: `${breakdown.accuracy}%`,           detail: `${breakdown.totalCorrect}/${breakdown.totalPicks} hits`, color: "#f97316" },
    { label: "Avg weekend",     value: `${breakdown.averageScore} pts`,    detail: `${breakdown.scoredRounds} rounds`,                       color: "#7dd3fc" },
    { label: "Recent form",     value: `${breakdown.recentAverage} pts`,   detail: coach.trend.label,                                        color: "#fbbf24" },
    { label: "Streak",          value: String(breakdown.currentStreak),    detail: `Best ${breakdown.longestStreak}`,                        color: "#34d399" },
  ];

  return (
    <div style={{ marginBottom: 16 }}>

      {/* Coach panel */}
      <div style={{
        borderRadius: 18,
        border:       `1px solid ${AI_BLUE_BORDER}`,
        background:   "rgba(9,17,30,0.90)",
        position:     "relative",
        overflow:     "hidden",
        padding:      isMobile ? "18px 16px 16px" : "22px 22px 20px",
        marginBottom: 12,
      }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(96,165,250,0.07) 0%, transparent 55%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: AI_BLUE_SOFT, border: `1px solid ${AI_BLUE_BORDER}`, borderRadius: RADIUS_PILL, padding: "4px 10px", marginBottom: 10 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: AI_BLUE }} />
                <Kicker color={AI_BLUE_TEXT}>AI Coach</Kicker>
              </div>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: 6 }}>
                {coach.archetype.label}
              </div>
              <div style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.65, maxWidth: "58ch" }}>
                {coach.archetype.description}
              </div>
            </div>
            <button
              onClick={onGenerate}
              disabled={generating}
              className="p-action-btn"
              style={{
                background:   generating ? "rgba(255,106,26,0.08)" : rgbaFromHex(ACCENT, 0.13),
                border:       `1px solid ${generating ? "rgba(255,106,26,0.14)" : rgbaFromHex(ACCENT, 0.30)}`,
                borderRadius: RADIUS_PILL,
                color:        generating ? MUTED_TEXT : ACCENT,
                cursor:       generating ? "default" : "pointer",
                fontWeight:   800,
                padding:      "10px 18px",
                fontSize:     13,
                fontFamily:   "inherit",
                flexShrink:   0,
                whiteSpace:   "nowrap",
              }}
            >
              {generating ? "Generating..." : hasInsights ? "New report" : "Generate report"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY }}>{coach.verdict}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#bae6fd", background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.18)", borderRadius: 999, padding: "4px 9px" }}>{coach.confidence.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fdba74", background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.18)", borderRadius: 999, padding: "4px 9px" }}>{coach.trend.label}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0,1fr))", gap: 10 }}>
            {[
              { label: "Protect",   value: coach.protectCategory?.shortLabel   || "Best edge", detail: coach.protectCategory   ? `${coach.protectCategory.accuracy}% accuracy · ${coach.protectCategory.points} pts` : "Your best edge will appear here.", color: "#f97316" },
              { label: "Challenge", value: coach.challengeCategory?.shortLabel || "Main leak", detail: coach.challengeCategory ? `${coach.challengeCategory.accuracy}% accuracy · ${coach.challengeCategory.points} pts` : "The model does not see a weak spot yet.", color: "#fbbf24" },
              { label: "Next move", value: coach.nextMoveTitle, detail: coach.nextMoveDetail, color: "#7dd3fc" },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.10)", background: "var(--btn-secondary-bg)", padding: "13px 14px 12px" }}>
                <Kicker color={item.color} style={{ display: "block", marginBottom: 7 }}>{item.label}</Kicker>
                <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, marginBottom: 5 }}>{item.value}</div>
                <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.55 }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Season metrics */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 12 }}>
        {metricCards.map((metric) => (
          <StatTile key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} color={metric.color} isMobile={isMobile} />
        ))}
      </div>

      {/* Categories + right column */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0,1.1fr) minmax(280px,0.9fr)", gap: 12 }}>

        <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: "18px 18px 10px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 14 }}>Category breakdown</div>

          {!showAiHistoryColumn && aiStatusText && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, padding: "10px 12px", borderRadius: 12, border: aiLoadError ? "1px solid rgba(248,113,113,0.28)" : "1px solid rgba(96,165,250,0.20)", background: aiLoadError ? "rgba(127,29,29,0.16)" : "rgba(30,64,175,0.08)", flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: aiLoadError ? "#fecaca" : "#bae6fd", lineHeight: 1.55 }}>{aiStatusText}</div>
              {isAdmin && (
                <button onClick={onReplay} disabled={replayBusy} style={{ background: "rgba(59,130,246,0.14)", border: "1px solid rgba(96,165,250,0.22)", borderRadius: 10, color: "#dbeafe", cursor: replayBusy ? "default" : "pointer", fontSize: 12, fontWeight: 800, padding: "6px 12px", fontFamily: "inherit" }}>
                  {replayBusy ? "Building..." : "Retry AI replay"}
                </button>
              )}
            </div>
          )}

          <div style={{ display: "grid", gap: 0 }}>
            {breakdown.categories.map((category, index) => {
              const aiCategory = aiCategoryMap.get(category.key) || null;
              return (
                <div key={category.key} style={{ paddingTop: 10, paddingBottom: 10, borderTop: `1px solid ${index === 0 ? HAIRLINE : "rgba(148,163,184,0.06)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{category.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      {showAiHistoryColumn && (
                        <span style={{ fontSize: 12, color: AI_BLUE_TEXT, fontVariantNumeric: "tabular-nums" }}>{aiCategory ? `AI ${aiCategory.accuracy}%` : "—"}</span>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 900, color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>{category.accuracy}%</span>
                      <span style={{ fontSize: 12, color: SUBTLE_TEXT, minWidth: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{category.points} pts</span>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: "rgba(148,163,184,0.10)" }}>
                    <div style={{ width: `${category.accuracy}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${ACCENT}, #fbbf24)` }} />
                  </div>
                  <div style={{ fontSize: 11, color: SUBTLE_TEXT, marginTop: 6 }}>{category.correct}/{category.total} hits</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: "16px 16px 10px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12 }}>Recent form</div>
            <div style={{ display: "grid", gap: 8 }}>
              {breakdown.recentForm.map((race, index) => (
                <div key={`${race.raceName}-${race.round}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: index < breakdown.recentForm.length - 1 ? "1px solid rgba(148,163,184,0.06)" : "none" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{race.raceName}</div>
                    <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 2 }}>{race.correct}/{race.total} · {race.accuracy}%</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fdba74", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{race.score} pts</div>
                </div>
              ))}
            </div>
          </div>

          {breakdown.bestRace && <BestWeekendCard bestRace={breakdown.bestRace} />}

          {showAiHistoryColumn && (
            <div style={{ borderRadius: 16, border: `1px solid ${AI_BLUE_BORDER}`, background: "rgba(96,165,250,0.03)", padding: "16px 16px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>AI vs you</div>
                {coach.comparisonDelta !== null && (
                  <span style={{ fontSize: 13, fontWeight: 900, color: coach.comparisonDelta >= 0 ? "#fdba74" : AI_BLUE_TEXT, fontVariantNumeric: "tabular-nums" }}>
                    {coach.comparisonDelta >= 0 ? "+" : ""}{coach.comparisonDelta}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.6, marginBottom: 10 }}>
                {coach.historyStatusDetail} · {history?.sourceDetail || "stored AI benchmark"} · {coach.comparisonSummary}
              </div>
              {coach.comparisonWins.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <Kicker color="#fdba74" style={{ display: "block", marginBottom: 5 }}>You ahead</Kicker>
                  {coach.comparisonWins.slice(0, 2).map((row) => (
                    <div key={row.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#fdba74", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>+{row.delta}</span>
                    </div>
                  ))}
                </div>
              )}
              {coach.comparisonLosses.length > 0 && (
                <div>
                  <Kicker color={AI_BLUE_TEXT} style={{ display: "block", marginBottom: 5 }}>AI ahead</Kicker>
                  {coach.comparisonLosses.slice(0, 2).map((row) => (
                    <div key={row.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 900, color: AI_BLUE_TEXT, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{row.delta}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isAdmin && !showAiHistoryColumn && (
            <div style={{ borderRadius: 16, border: `1px solid ${AI_BLUE_BORDER}`, background: "rgba(96,165,250,0.03)", padding: "14px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>AI replay history</div>
              <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.55, marginBottom: 10 }}>No stored AI picks yet.</div>
              {aiLoadError && (
                <div style={{ fontSize: 12, color: "#fecaca", marginBottom: 10, lineHeight: 1.55 }}>{aiLoadError}</div>
              )}
              <button
                onClick={onReplay}
                disabled={replayBusy}
                style={{ background: "rgba(59,130,246,0.14)", border: "1px solid rgba(96,165,250,0.22)", borderRadius: 10, color: "#dbeafe", cursor: replayBusy ? "default" : "pointer", fontSize: 12, fontWeight: 800, padding: "8px 12px", fontFamily: "inherit" }}
              >
                {replayBusy ? "Building AI replay..." : "Build AI replay now"}
              </button>
              {aiMessage && (
                <div style={{ fontSize: 12, color: "#bae6fd", lineHeight: 1.55, marginTop: 8 }}>{aiMessage}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Account tab pieces ───────────────────────────────────────────────────────

function AccountSection({ id, title, description, children, action, valueChip, tone = "neutral" }) {
  const isDanger = tone === "danger";
  const railColor = isDanger ? ERROR_TEXT : ACCENT;
  return (
    <section
      id={id}
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: CARD_RADIUS,
        border:       isDanger ? `1px solid ${rgbaFromHex(ERROR_TEXT, 0.22)}` : PANEL_BORDER,
        background:   isDanger
          ? `linear-gradient(135deg, ${rgbaFromHex(ERROR_TEXT, 0.04)} 0%, ${rgbaFromHex(ERROR_TEXT, 0.01)} 60%, ${PANEL_BG} 100%)`
          : PANEL_BG,
        scrollMarginTop: 100,
      }}
    >
      {/* Left tone rail — thinner on neutral sections, kept stronger on danger */}
      <span aria-hidden="true" style={{
        position:   "absolute",
        top:        0,
        bottom:     0,
        left:       0,
        width:      isDanger ? 3 : 2,
        background: railColor,
        opacity:    isDanger ? 0.65 : 0.35,
      }} />
      <header style={{
        padding:      "18px 22px 14px",
        borderBottom: `1px solid ${HAIRLINE}`,
        display:      "flex",
        justifyContent: "space-between",
        alignItems:    "flex-start",
        gap:           12,
        flexWrap:      "wrap",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color:         isDanger ? ERROR_TEXT : SUBTLE_TEXT,
            marginBottom:  5,
          }}>
            {isDanger ? "Danger zone" : "Settings"}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h3 className="stint-card-title" style={{
              margin: 0,
              fontSize: 18,
              letterSpacing: "-0.028em",
              lineHeight: 1.18,
              color: isDanger ? ERROR_TEXT : TEXT_PRIMARY,
            }}>{title}</h3>
            {valueChip}
          </div>
          {description && (
            <div style={{
              fontSize:   12.5,
              color:      MUTED_TEXT,
              marginTop:  5,
              lineHeight: 1.55,
              maxWidth:   "58ch",
            }}>{description}</div>
          )}
        </div>
        {action}
      </header>
      <div style={{ padding: "18px 22px 20px" }}>{children}</div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage({ user, setUser, setPage }) {
  const { isMobile, isTablet } = useViewport();

  // State
  const [profileTab, setProfileTab]           = useState(() => {
    if (typeof window === "undefined") return "history";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((tab) => tab.key === requested) ? requested : "history";
  });
  // Track the previous tab so we can tell the view-transition CSS which direction to slide.
  const profileTabRef = useRef(profileTab);

  function switchTab(nextKey) {
    if (nextKey === profileTabRef.current) return;
    const currentIndex = TABS.findIndex((t) => t.key === profileTabRef.current);
    const nextIndex    = TABS.findIndex((t) => t.key === nextKey);
    const direction    = nextIndex > currentIndex ? "forward" : "back";
    withViewTransition(() => {
      profileTabRef.current = nextKey;
      setProfileTab(nextKey);
    }, { name: "profile-tabs", direction });
  }
  const [predictions, setPredictions]         = useState([]);
  const [aiPredictionHistory, setAiPredictionHistory] = useState([]);
  const [raceResults, setRaceResults]         = useState([]);
  const [aiHistoryBusy, setAiHistoryBusy]     = useState(false);
  const [aiHistoryMessage, setAiHistoryMessage] = useState("");
  const [aiHistoryLoadError, setAiHistoryLoadError] = useState("");
  const [aiHistoryAttempted, setAiHistoryAttempted] = useState(false);
  const [rank, setRank]                       = useState(null);
  const [editing, setEditing]                 = useState(false);
  const [proInsights, setProInsights]         = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightGenerating, setInsightGenerating] = useState(false);
  const [insightError, setInsightError]       = useState("");
  const [insightNote, setInsightNote]         = useState("");
  const [newUsername, setNewUsername]         = useState(user?.username || "");
  const [pendingColor, setPendingColor]       = useState(user?.avatar_color || DEFAULT_AVATAR_COLOR);
  const [pendingTeam, setPendingTeam]         = useState(user?.favorite_team || TEAM_AVATAR_OPTIONS[0]?.team || "");
  const [saving, setSaving]                   = useState(false);
  const [supportSaving, setSupportSaving]     = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState("");
  const [note, setNote]                       = useState("");
  const [portalBusy, setPortalBusy]           = useState(false);
  const [signOutBusy, setSignOutBusy]         = useState(false);
  const [expandedHistoryRound, setExpandedHistoryRound] = useState(null);
  const [historyFilter, setHistoryFilter]   = useState("all");
  const historyRowRefs = useRef({});
  const [activeInsightId, setActiveInsightId] = useState(null);
  const readerRef = useRef(null);
  const [deleteStaged, setDeleteStaged]       = useState(false);
  const [deleteTyped, setDeleteTyped]         = useState("");
  const [proLeague, setProLeague]             = useState({ totalMembers: null, myRank: null, leaderboard: [] });
  const [notificationPrefs, setNotificationPrefs] = useState({
    race_lock:   true,
    results:     true,
    insights:    true,
    news_digest: false,
  });
  const [themePreference, setThemePreference] = useThemePreference();
  const [densityPreference, setDensityPreference] = useDensityPreference();

  const supportOptions = TEAM_AVATAR_OPTIONS;
  const isPro = user?.subscription_status === "pro";

  // ── Data loaders ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (user) {
      setNewUsername(user.username || "");
      setPendingColor(user.avatar_color || DEFAULT_AVATAR_COLOR);
      setPendingTeam(user.favorite_team || TEAM_AVATAR_OPTIONS[0]?.team || "");
      setAiHistoryMessage("");
      setAiHistoryAttempted(false);
      fetchData();
      if (isPro) fetchProLeagueSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isPro]);

  useEffect(() => {
    if (profileTab === "insights" && isPro && proInsights.length === 0) {
      setInsightsLoading(true);
      setInsightError("");
      let active = true;

      (async () => {
        try {
          const headers = await buildInsightRequestHeaders(user.id);
          const response = await fetch(`/api/insights/${user.id}`, { headers });
          const data = await parseJsonResponse(response, "Could not load insights.");
          if (!response.ok) throw new Error(data.error || "Could not load insights.");
          if (active) setProInsights(normalizeInsights(data.insights ?? []));
        } catch (loadError) {
          if (active) setInsightError(loadError?.message || "Could not load insights.");
        } finally {
          if (active) setInsightsLoading(false);
        }
      })();

      return () => { active = false; };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileTab, user?.id, isPro]);

  const seasonBreakdown = useMemo(() => buildSeasonBreakdown(predictions), [predictions]);
  const aiHistory       = useMemo(() => buildAiHistoryBreakdown(aiPredictionHistory, raceResults), [aiPredictionHistory, raceResults]);
  const aiCoach         = useMemo(() => buildAiCoach(seasonBreakdown, aiHistory), [seasonBreakdown, aiHistory]);
  const visibleInsights = useMemo(() => normalizeInsights(proInsights), [proInsights]);
  const featuredInsight = visibleInsights.find((insight) => insight?.insight_type === "monthly") || visibleInsights[0] || null;
  const supportingInsights = visibleInsights.filter((insight) => insight?.id !== featuredInsight?.id);

  const totalRaces             = seasonBreakdown.scoredRounds;
  const subscriptionEndsLabel  = formatSubscriptionEndLabel(user?.subscription_end);
  const scheduledToCancel      = Boolean(user?.subscription_cancel_at_period_end);
  const coachEligible          = seasonBreakdown.scoredRounds >= 3;
  const resultsByRound         = useMemo(() => new Map((raceResults || []).map((row) => [Number(row.race_round), row])), [raceResults]);

  useEffect(() => {
    if (profileTab !== "insights") return;
    if (!user || !isAdminUser(user)) return;
    if (loading || aiHistoryBusy || aiHistoryAttempted) return;
    if (aiPredictionHistory.length > 0 || seasonBreakdown.scoredRounds === 0) return;

    setAiHistoryAttempted(true);
    buildAiReplayHistoryAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileTab, user, loading, aiHistoryBusy, aiHistoryAttempted, aiPredictionHistory.length, seasonBreakdown.scoredRounds]);

  const fetchData = async () => {
    setLoading(true);
    const [predictionsResponse, profilesResponse, aiPredictionResponse, raceResultsResponse] = await Promise.all([
      supabase.from("predictions").select("*").eq("user_id", user.id).order("race_round", { ascending: true }),
      supabase.from("profiles").select("id,points").order("points", { ascending: false }),
      supabase.from("ai_race_predictions").select("race_round,race_name,insight_key,scope,category_key,category_label,category_type,predicted_value,reason,confidence,provider,model,generated_at").order("race_round", { ascending: true }),
      supabase.from("race_results").select("*").eq("results_entered", true).order("race_round", { ascending: true }),
    ]);
    const loadIssues = [];

    if (predictionsResponse.data) setPredictions(predictionsResponse.data);
    if (profilesResponse.data) setRank(profilesResponse.data.findIndex((profile) => profile.id === user.id) + 1);

    if (!aiPredictionResponse.error && aiPredictionResponse.data) {
      setAiPredictionHistory(aiPredictionResponse.data);
    } else {
      setAiPredictionHistory([]);
      if (aiPredictionResponse.error?.message) loadIssues.push(`Could not read stored AI history from Supabase: ${aiPredictionResponse.error.message}`);
    }
    if (!raceResultsResponse.error && raceResultsResponse.data) {
      setRaceResults(raceResultsResponse.data);
    } else {
      setRaceResults([]);
      if (raceResultsResponse.error?.message) loadIssues.push(`Could not read scored race results from Supabase: ${raceResultsResponse.error.message}`);
    }
    setAiHistoryLoadError(loadIssues.join(" "));
    setLoading(false);
  };

  const fetchProLeagueSnapshot = async () => {
    try {
      const res = await fetch(`/api/pro/leaderboard?userId=${encodeURIComponent(user.id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setProLeague({
        totalMembers: Number(data?.totalMembers ?? 0),
        myRank:       data?.myRank ?? null,
        leaderboard:  Array.isArray(data?.leaderboard) ? data.leaderboard : [],
      });
    } catch {
      /* silent — module is optional */
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const saveProfile = async () => {
    const username = sanitizeUsername(newUsername);
    setSaving(true);
    setError("");
    setNote("");

    if (!username) {
      setError("Enter a valid username.");
      setSaving(false);
      return;
    }

    try {
      const taken = await isUsernameTaken(username, user.id);
      if (taken) {
        setError("That username is already taken.");
        setSaving(false);
        return;
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ username, avatar_color: pendingColor, favorite_team: pendingTeam })
        .eq("id", user.id)
        .select("*")
        .single();

      if (updateError) {
        if (String(updateError.message || "").includes("avatar_color") || String(updateError.message || "").includes("favorite_team")) {
          await persistSupportMetadata({ avatar_color: pendingColor, favorite_team: pendingTeam });
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("profiles")
            .update({ username })
            .eq("id", user.id)
            .select("*")
            .single();

          if (fallbackError) {
            setError(fallbackError.message);
          } else if (fallbackData) {
            setUser({ ...fallbackData, avatar_color: pendingColor || user.avatar_color || DEFAULT_AVATAR_COLOR, favorite_team: pendingTeam || user.favorite_team || null });
            setEditing(false);
            setNote("Name updated.");
          }
        } else {
          setError(updateError.message);
        }
      } else if (data) {
        setUser(data);
        setEditing(false);
        setNote("Name updated.");
      }
    } catch (updateFailure) {
      setError(updateFailure?.message || "Could not update profile.");
    }

    setSaving(false);
  };

  const saveSupportPreferences = async (nextTeam) => {
    if (!user) return;
    setSupportSaving(true);
    setError("");
    setNote("");

    const nextColor = teamSupportKey(nextTeam);
    setPendingTeam(nextTeam);
    setPendingColor(nextColor);

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_color: nextColor, favorite_team: nextTeam })
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) {
      if (String(updateError.message || "").includes("avatar_color") || String(updateError.message || "").includes("favorite_team")) {
        await persistSupportMetadata({ avatar_color: nextColor, favorite_team: nextTeam });
        setUser({ ...user, avatar_color: nextColor, favorite_team: nextTeam });
        setNote("Team updated.");
      } else {
        setError(updateError.message);
      }
    } else if (data) {
      setUser(data);
      setNote("Team updated.");
    }

    setSupportSaving(false);
  };

  const generateInsight = async () => {
    if (!user || insightGenerating) return;
    setInsightGenerating(true);
    setInsightError("");
    setInsightNote("");
    const userStats = {
      overall: {
        correct:      seasonBreakdown.totalCorrect,
        total:        seasonBreakdown.totalPicks,
        accuracy:     seasonBreakdown.accuracy,
        totalPoints:  seasonBreakdown.totalPoints,
        racesScored:  seasonBreakdown.scoredRounds,
        averageScore: seasonBreakdown.averageScore,
      },
      byType: seasonBreakdown.categories.reduce((accumulator, category) => ({
        ...accumulator,
        [category.label]: { correct: category.correct, total: category.total, accuracy: category.accuracy, totalPoints: category.points },
      }), {}),
      streaks: { current: seasonBreakdown.currentStreak, longest: seasonBreakdown.longestStreak },
      bestRace: seasonBreakdown.bestRace
        ? { name: seasonBreakdown.bestRace.raceName, score: seasonBreakdown.bestRace.score, accuracy: seasonBreakdown.bestRace.accuracy }
        : null,
      strongestCategory: seasonBreakdown.strongestCategory
        ? { label: seasonBreakdown.strongestCategory.label, accuracy: seasonBreakdown.strongestCategory.accuracy, totalPoints: seasonBreakdown.strongestCategory.points }
        : null,
      weakestCategory: seasonBreakdown.weakestCategory
        ? { label: seasonBreakdown.weakestCategory.label, accuracy: seasonBreakdown.weakestCategory.accuracy, totalPoints: seasonBreakdown.weakestCategory.points }
        : null,
      recentForm: seasonBreakdown.recentForm.map((race) => `${race.raceName}: ${race.score} pts (${race.correct}/${race.total})`),
      aiCoach: {
        archetype:            aiCoach.archetype.label,
        verdict:              aiCoach.verdict,
        confidence:           aiCoach.confidence.label,
        nextMoveTitle:        aiCoach.nextMoveTitle,
        nextMoveDetail:       aiCoach.nextMoveDetail,
        protectCategory:      aiCoach.protectCategory?.label || null,
        challengeCategory:    aiCoach.challengeCategory?.label || null,
        historyStatus:        aiCoach.historyStatusLabel,
        historyDetail:        aiCoach.historyStatusDetail,
        comparisonSummary:    aiCoach.comparisonSummary,
        biggestComparisonWin: aiCoach.comparisonWins[0] ? `${aiCoach.comparisonWins[0].label} (+${aiCoach.comparisonWins[0].delta} vs stored AI)` : null,
        biggestComparisonLoss:aiCoach.comparisonLosses[0] ? `${aiCoach.comparisonLosses[0].label} (${aiCoach.comparisonLosses[0].delta} vs stored AI)` : null,
      },
    };
    try {
      const headers = await buildInsightRequestHeaders(user.id, true);
      const res = await fetch(`/api/insights/${user.id}`, {
        method: "POST",
        headers,
        body:   JSON.stringify({ type: "monthly", month: "2026 Season so far", userStats }),
      });
      const data = await parseJsonResponse(res, "Could not generate insight.");
      if (!res.ok) throw new Error(data.error || "Could not generate insight.");
      if (!data.insight) throw new Error("No insight was returned.");
      setProInsights((current) => normalizeInsights([data.insight, ...current.filter((insight) => insight.id !== data.insight.id)]));
      setInsightNote(
        data.insight.transient
          ? "Season summary generated. Saving to your history is unavailable right now."
          : "Season summary generated."
      );
    } catch (generationError) {
      setInsightError(generationError?.message || "Could not generate insight.");
    }
    setInsightGenerating(false);
  };

  const buildAiReplayHistoryAction = async () => {
    if (!user || aiHistoryBusy || !isAdminUser(user)) return;
    const season = Number(String(CAL[0]?.date || "").slice(0, 4)) || 2026;
    setAiHistoryBusy(true);
    setAiHistoryLoadError("");
    setAiHistoryMessage("Building replay AI history...");
    try {
      const response = await backfillAiReplayHistory(season);
      await fetchData();
      const replayedRounds = Number(response?.counts?.replayedRounds || 0);
      const warnings = Array.isArray(response?.warnings) ? response.warnings.filter(Boolean) : [];
      setAiHistoryMessage(
        replayedRounds > 0
          ? `Replay AI history built for ${replayedRounds} completed race${replayedRounds === 1 ? "" : "s"}.`
          : warnings[0] || "Replay AI history updated."
      );
    } catch (err) {
      setAiHistoryMessage(err instanceof Error ? err.message : "Could not build replay AI history.");
    } finally {
      setAiHistoryBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (signOutBusy) return;
    setSignOutBusy(true);
    try {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") window.location.href = "/";
    } catch (err) {
      setError(err?.message || "Could not sign out.");
      setSignOutBusy(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const session = await requireActiveSession();
      if (!session?.access_token) {
        setError("Your session expired. Sign in again to continue.");
        setPortalBusy(false);
        return;
      }
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body:   JSON.stringify({ mode: "manage" }),
      });
      const data = await res.json();
      if (data?.url && typeof window !== "undefined") {
        window.location.href = data.url;
      } else if (data?.error) {
        setError(data.error);
      }
    } catch {
      setError("Could not open billing portal.");
    } finally {
      setPortalBusy(false);
    }
  };

  const navTo = (page, raceRound = null) => {
    if (typeof setPage === "function") {
      setPage(page);
      return;
    }
    if (typeof window !== "undefined") {
      window.location.href = pageToHref(page, { raceRound });
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setNewUsername(user.username || "");
    setPendingColor(user.avatar_color || DEFAULT_AVATAR_COLOR);
    setPendingTeam(user.favorite_team || TEAM_AVATAR_OPTIONS[0]?.team || "");
    setError("");
    setNote("");
  };

  const downloadPicks = () => {
    if (!predictions?.length) return;
    const blob = new Blob([JSON.stringify(predictions, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `stint-picks-${user.username || user.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = () => {
    if (!deleteStaged || deleteTyped !== user.username) return;
    if (typeof window !== "undefined") {
      window.location.href = `mailto:support@stint-web.com?subject=${encodeURIComponent("Delete my Stint account")}&body=${encodeURIComponent(
        `Username: ${user.username}\nUser ID: ${user.id}\n\nI'd like my account and all associated data removed.`
      )}`;
    }
    setDeleteStaged(false);
    setDeleteTyped("");
  };

  if (!user) return null;

  // ── Derived hero data ─────────────────────────────────────────────────────

  const profileTheme      = avatarTheme(pendingColor || user.avatar_color || DEFAULT_AVATAR_COLOR);
  const selectedTeamLabel = supportOptions.find((option) => option.team === pendingTeam)?.label || pendingTeam;
  const upcomingRace      = nextRace();

  const formColor = seasonBreakdown.trendDelta >= 5 ? "#4ade80"
    : seasonBreakdown.trendDelta <= -5 ? "#93c5fd"
    : "#fdba74";
  const formDetail = seasonBreakdown.scoredRounds >= 2
    ? `${seasonBreakdown.trendDelta >= 0 ? "+" : ""}${seasonBreakdown.trendDelta} vs avg`
    : "Awaiting form";

  // Total Points takes the hero treatment. Rank / Races / Form ride alongside as supporting cards.
  const heroStat = {
    label: "Total points",
    value: String(user.points || 0),
    color: "#f97316",
    detail: seasonBreakdown.accuracy
      ? `${seasonBreakdown.accuracy}% accuracy · ${seasonBreakdown.totalCorrect}/${seasonBreakdown.totalPicks || 0} hits`
      : "Your score ledger starts here",
  };
  const supportingStats = [
    { label: "Global rank",  value: rank ? `#${rank}` : "—",                                     color: "#7dd3fc", detail: "All managers" },
    { label: "Races scored", value: `${totalRaces} / ${ACTIVE_RACE_COUNT}`,                      color: "#99f6e4", detail: upcomingRace ? `Next · ${upcomingRace.n}` : "—" },
    { label: "Form",         value: seasonBreakdown.scoredRounds >= 2 ? `${seasonBreakdown.recentAverage}` : "—", color: formColor, detail: formDetail },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <style>{`
      @keyframes profile-hero-in {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .profile-hero { animation: profile-hero-in 380ms cubic-bezier(0.16,1,0.3,1) both; }

      /* Identity credential enters just after the panel settles — a short,
         staggered follow-through that makes the hero feel orchestrated instead
         of flat. Transform-only; no layout shift. */
      @keyframes profile-credential-in {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .p-avatar-credential {
        animation: profile-credential-in 420ms cubic-bezier(0.16,1,0.3,1) 80ms both;
        will-change: transform;
      }
      @media (hover: hover) and (pointer: fine) {
        .profile-hero:hover .p-avatar-credential {
          transform: translateY(-1px);
          transition: transform 240ms cubic-bezier(0.16,1,0.3,1);
        }
      }

      @keyframes p-tab-in {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .p-tab-content {
        animation: p-tab-in 190ms cubic-bezier(0.23,1,0.32,1) both;
        view-transition-name: profile-tab-panel;
      }

      /* Direction-aware tab transitions (View Transitions API).
         Forward = later tab. Back = earlier tab. Transform-only, 240ms ease-out. */
      ::view-transition-old(profile-tab-panel),
      ::view-transition-new(profile-tab-panel) {
        animation-duration: 240ms;
        animation-timing-function: cubic-bezier(0.23,1,0.32,1);
        mix-blend-mode: normal;
      }
      [data-vt-name="profile-tabs"][data-vt-direction="forward"]::view-transition-old(profile-tab-panel) {
        animation-name: vt-panel-out-left;
      }
      [data-vt-name="profile-tabs"][data-vt-direction="forward"]::view-transition-new(profile-tab-panel) {
        animation-name: vt-panel-in-right;
      }
      [data-vt-name="profile-tabs"][data-vt-direction="back"]::view-transition-old(profile-tab-panel) {
        animation-name: vt-panel-out-right;
      }
      [data-vt-name="profile-tabs"][data-vt-direction="back"]::view-transition-new(profile-tab-panel) {
        animation-name: vt-panel-in-left;
      }
      /* The active tab pill morphs between positions as a single element. */
      [data-vt-name="profile-tabs"]::view-transition-old(profile-active-tab),
      [data-vt-name="profile-tabs"]::view-transition-new(profile-active-tab) {
        animation-duration: 260ms;
        animation-timing-function: cubic-bezier(0.23,1,0.32,1);
      }
      @keyframes vt-panel-out-left  { from { opacity: 1; transform: translateX(0); } to   { opacity: 0; transform: translateX(-22px); } }
      @keyframes vt-panel-in-right  { from { opacity: 0; transform: translateX(22px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes vt-panel-out-right { from { opacity: 1; transform: translateX(0); } to   { opacity: 0; transform: translateX(22px); } }
      @keyframes vt-panel-in-left   { from { opacity: 0; transform: translateX(-22px); } to { opacity: 1; transform: translateX(0); } }

      .p-tab-btn, .p-team-btn, .p-theme-btn, .p-action-btn, .p-unlock-link, .p-history-row, .p-account-link, .p-toggle {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }

      .p-tab-btn {
        transition: background 160ms cubic-bezier(0.23,1,0.32,1),
                    border-color 160ms cubic-bezier(0.23,1,0.32,1),
                    color 160ms cubic-bezier(0.23,1,0.32,1),
                    transform 110ms cubic-bezier(0.23,1,0.32,1);
      }
      @media (hover: hover) and (pointer: fine) {
        .p-tab-btn:not(.is-active):hover {
          background: rgba(148,163,184,0.06) !important;
          border-color: rgba(148,163,184,0.24) !important;
        }
      }
      .p-tab-btn { transition: background 160ms cubic-bezier(0.23,1,0.32,1), border-color 160ms cubic-bezier(0.23,1,0.32,1), color 160ms cubic-bezier(0.23,1,0.32,1), transform 120ms cubic-bezier(0.23,1,0.32,1); }
      .p-tab-btn:active { transform: scale(0.975); }

      .p-team-btn {
        transition: border-color 150ms cubic-bezier(0.23,1,0.32,1),
                    background 150ms cubic-bezier(0.23,1,0.32,1),
                    opacity 140ms ease,
                    transform 110ms cubic-bezier(0.23,1,0.32,1);
      }
      @media (hover: hover) and (pointer: fine) {
        .p-team-btn:not([aria-pressed="true"]):hover {
          border-color: rgba(148,163,184,0.28) !important;
          background: rgba(148,163,184,0.07) !important;
        }
      }
      .p-team-btn:active { transform: scale(0.96); }

      .p-theme-btn {
        transition: background 160ms cubic-bezier(0.23,1,0.32,1),
                    border-color 160ms cubic-bezier(0.23,1,0.32,1),
                    color 160ms ease,
                    transform 120ms cubic-bezier(0.23,1,0.32,1);
      }
      @media (hover: hover) and (pointer: fine) {
        .p-theme-btn:not([aria-pressed="true"]):hover {
          background: rgba(148,163,184,0.06) !important;
          color: rgba(214,223,239,0.92) !important;
        }
      }
      .p-theme-btn:active { transform: scale(0.975); transition-duration: 80ms; }

      .p-action-btn {
        transition: opacity 140ms ease, transform 140ms cubic-bezier(0.23,1,0.32,1), background 140ms ease, border-color 140ms ease;
      }
      @media (hover: hover) and (pointer: fine) {
        .p-action-btn:not(:disabled):hover { opacity: 0.85; }
      }
      .p-action-btn:not(:disabled):active { transform: scale(0.975); transition-duration: 80ms; }

      .p-unlock-link {
        transition: background 180ms cubic-bezier(0.23,1,0.32,1),
                    border-color 180ms cubic-bezier(0.23,1,0.32,1),
                    box-shadow 200ms cubic-bezier(0.23,1,0.32,1),
                    transform 140ms cubic-bezier(0.23,1,0.32,1);
      }
      @media (hover: hover) and (pointer: fine) {
        .p-unlock-link:hover {
          background: rgba(255,106,26,0.18) !important;
          border-color: rgba(255,106,26,0.42) !important;
          box-shadow: 0 8px 22px rgba(255,106,26,0.22);
        }
      }
      .p-unlock-link:active { transform: scale(0.975); transition-duration: 80ms; }

      /* StatTile: subtle lift on pointer. Keeps the timing-board feel
         — it's responsive to attention without drawing attention to itself. */
      .p-stat-tile { will-change: transform; }
      @media (hover: hover) and (pointer: fine) {
        .p-stat-tile:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.015);
        }
      }

      .p-history-row {
        transition: background 160ms cubic-bezier(0.23,1,0.32,1);
      }
      @media (hover: hover) and (pointer: fine) {
        .p-history-row:not(:disabled):hover { background: rgba(255,255,255,0.02) !important; }
      }

      .p-account-link {
        transition: background 140ms ease, color 140ms ease;
      }
      @media (hover: hover) and (pointer: fine) {
        .p-account-link:hover { background: rgba(148,163,184,0.06); }
      }

      .p-toggle {
        transition: background 160ms cubic-bezier(0.23,1,0.32,1);
      }

      /* ─── Overview tab — holistic motion system ──────────────────────── */

      /* Coach Hero — typing reveal of the archetype label */
      @keyframes ov-hero-bg-shimmer {
        0%   { background-position: 0% 50%; }
        100% { background-position: 100% 50%; }
      }
      .ov-hero { background-size: 200% 100%; animation: ov-hero-bg-shimmer 22s ease-in-out infinite alternate; }
      .ov-archetype-char {
        display: inline-block;
        opacity: 0;
        transform: translateY(8px);
        animation: ov-char-in 320ms cubic-bezier(0.16,1,0.3,1) forwards;
      }
      @keyframes ov-char-in {
        to { opacity: 1; transform: translateY(0); }
      }
      .ov-hero-desc, .ov-hero-chips, .ov-hero-sparkline {
        opacity: 0;
        transform: translateY(6px);
        animation: ov-fade-up 420ms cubic-bezier(0.16,1,0.3,1) forwards;
      }
      .ov-hero-desc      { animation-delay: 480ms; }
      .ov-hero-chips     { animation-delay: 620ms; }
      .ov-hero-sparkline { animation-delay: 380ms; }
      @keyframes ov-fade-up {
        to { opacity: 1; transform: translateY(0); }
      }

      /* Coach Hero — accuracy count-up is driven by JS, but the digit
         container scales in subtly on mount */
      @keyframes ov-num-bloom {
        from { opacity: 0; transform: scale(0.92); }
        to   { opacity: 1; transform: scale(1); }
      }
      .ov-accuracy-num { animation: ov-num-bloom 520ms cubic-bezier(0.16,1,0.3,1) 100ms both; }

      /* Move Carousel — track snap + page indicator */
      .ov-carousel {
        display: grid;
        grid-auto-columns: minmax(82%, 1fr);
        grid-auto-flow: column;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        -ms-overflow-style: none;
        gap: 14px;
        padding-bottom: 6px;
        scroll-padding-left: 2px;
      }
      .ov-carousel::-webkit-scrollbar { display: none; }
      .ov-carousel > * { scroll-snap-align: start; }
      @media (min-width: 820px) {
        .ov-carousel {
          grid-auto-columns: minmax(0, 1fr);
          grid-template-columns: repeat(3, minmax(0, 1fr));
          overflow: visible;
        }
      }
      .ov-carousel-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: rgba(148,163,184,0.30);
        transition: width 240ms cubic-bezier(0.23,1,0.32,1), background 200ms ease;
      }
      .ov-carousel-dot[data-active="true"] {
        width: 22px;
        background: var(--brand);
        border-radius: 999px;
      }

      /* Form Ribbon — each bar pops up from 0 to its height on intersection */
      .ov-ribbon-bar {
        transform-origin: bottom;
        transform: scaleY(0);
        opacity: 0;
        transition: transform 700ms cubic-bezier(0.16,1,0.3,1), opacity 320ms ease;
      }
      .ov-ribbon.is-visible .ov-ribbon-bar { transform: scaleY(1); opacity: 1; }
      .ov-ribbon.is-visible .ov-ribbon-bar:nth-child(1)  { transition-delay: 60ms; }
      .ov-ribbon.is-visible .ov-ribbon-bar:nth-child(2)  { transition-delay: 100ms; }
      .ov-ribbon.is-visible .ov-ribbon-bar:nth-child(3)  { transition-delay: 140ms; }
      .ov-ribbon.is-visible .ov-ribbon-bar:nth-child(4)  { transition-delay: 180ms; }
      .ov-ribbon.is-visible .ov-ribbon-bar:nth-child(5)  { transition-delay: 220ms; }
      .ov-ribbon.is-visible .ov-ribbon-bar:nth-child(6)  { transition-delay: 260ms; }
      .ov-ribbon.is-visible .ov-ribbon-bar:nth-child(7)  { transition-delay: 300ms; }
      .ov-ribbon.is-visible .ov-ribbon-bar:nth-child(8)  { transition-delay: 340ms; }
      .ov-ribbon.is-visible .ov-ribbon-bar:nth-child(9)  { transition-delay: 380ms; }
      .ov-ribbon.is-visible .ov-ribbon-bar:nth-child(10) { transition-delay: 420ms; }

      /* Category strengths — fill bars stretch on intersection */
      .ov-strength-fill {
        transform-origin: left center;
        transform: scaleX(0);
        transition: transform 900ms cubic-bezier(0.16,1,0.3,1);
      }
      .ov-strengths.is-visible .ov-strength-fill { transform: scaleX(1); }
      .ov-strength-row { opacity: 0; transform: translateY(6px); transition: opacity 360ms cubic-bezier(0.16,1,0.3,1), transform 360ms cubic-bezier(0.16,1,0.3,1); }
      .ov-strengths.is-visible .ov-strength-row { opacity: 1; transform: translateY(0); }
      .ov-strengths.is-visible .ov-strength-row:nth-child(1) { transition-delay: 60ms; }
      .ov-strengths.is-visible .ov-strength-row:nth-child(2) { transition-delay: 160ms; }
      .ov-strengths.is-visible .ov-strength-row:nth-child(3) { transition-delay: 260ms; }
      .ov-strengths.is-visible .ov-strength-fill:nth-of-type(1) { transition-delay: 120ms; }
      .ov-strengths.is-visible .ov-strength-fill:nth-of-type(2) { transition-delay: 220ms; }
      .ov-strengths.is-visible .ov-strength-fill:nth-of-type(3) { transition-delay: 320ms; }

      /* ─── Insights tab — magazine reading system ────────────────────── */

      /* Cover hero: title types in like Overview */
      .in-cover-char {
        display: inline-block;
        opacity: 0;
        transform: translateY(10px);
        animation: ov-char-in 380ms cubic-bezier(0.16,1,0.3,1) forwards;
      }
      .in-cover-meta, .in-cover-deck, .in-cover-cta {
        opacity: 0; transform: translateY(8px);
        animation: ov-fade-up 480ms cubic-bezier(0.16,1,0.3,1) forwards;
      }
      .in-cover-meta { animation-delay: 380ms; }
      .in-cover-deck { animation-delay: 520ms; }
      .in-cover-cta  { animation-delay: 680ms; }

      /* Reading progress bar — JS-driven width, smooth via transition */
      .in-progress-bar {
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        z-index: 4;
        height: 3px;
        background: rgba(148,163,184,0.10);
        border-radius: 4px;
        margin-bottom: 14px;
        overflow: hidden;
      }
      .in-progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, var(--text-ai), #fbbf24);
        border-radius: 4px;
        transition: width 120ms linear;
      }

      /* Drop cap on first paragraph after a heading */
      .in-dropcap::first-letter {
        float: left;
        font-family: var(--font-display);
        font-size: 4em;
        line-height: 0.88;
        padding: 6px 12px 0 0;
        font-weight: 900;
        letter-spacing: -0.06em;
        color: var(--text-ai);
        background: linear-gradient(180deg, var(--text-ai) 0%, #fbbf24 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: in-dropcap-bloom 620ms cubic-bezier(0.16,1,0.3,1) 220ms both;
      }
      @keyframes in-dropcap-bloom {
        from { opacity: 0; transform: translateY(6px) scale(0.92); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Reader paragraph reveal — intersection-observer */
      .in-para {
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 520ms cubic-bezier(0.16,1,0.3,1), transform 520ms cubic-bezier(0.16,1,0.3,1);
      }
      .in-para.is-visible { opacity: 1; transform: translateY(0); }

      /* Section divider — short rule + dot */
      .in-divider {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 28px 0 22px;
      }
      .in-divider::before,
      .in-divider::after {
        content: "";
        height: 1px;
        width: 56px;
        background: linear-gradient(90deg, transparent, rgba(148,163,184,0.30), transparent);
      }

      /* AI vs You — animated bars */
      .in-vs-bar {
        transform-origin: left center;
        transform: scaleX(0);
        transition: transform 900ms cubic-bezier(0.16,1,0.3,1);
      }
      .in-vs.is-visible .in-vs-bar { transform: scaleX(1); }
      .in-vs.is-visible .in-vs-bar:nth-of-type(odd)  { transition-delay: 100ms; }
      .in-vs.is-visible .in-vs-bar:nth-of-type(even) { transition-delay: 240ms; }

      /* Category Lab — staggered row reveal */
      .in-cat-row {
        opacity: 0; transform: translateY(8px);
        transition: opacity 420ms cubic-bezier(0.16,1,0.3,1), transform 420ms cubic-bezier(0.16,1,0.3,1);
      }
      .in-lab.is-visible .in-cat-row { opacity: 1; transform: translateY(0); }
      .in-lab.is-visible .in-cat-row:nth-child(1) { transition-delay: 40ms; }
      .in-lab.is-visible .in-cat-row:nth-child(2) { transition-delay: 100ms; }
      .in-lab.is-visible .in-cat-row:nth-child(3) { transition-delay: 160ms; }
      .in-lab.is-visible .in-cat-row:nth-child(4) { transition-delay: 220ms; }
      .in-lab.is-visible .in-cat-row:nth-child(5) { transition-delay: 280ms; }
      .in-lab.is-visible .in-cat-row:nth-child(6) { transition-delay: 340ms; }
      .in-lab.is-visible .in-cat-row:nth-child(n+7) { transition-delay: 400ms; }
      .in-cat-fill {
        transform-origin: left center;
        transform: scaleX(0);
        transition: transform 720ms cubic-bezier(0.16,1,0.3,1) 200ms;
      }
      .in-lab.is-visible .in-cat-fill { transform: scaleX(1); }

      /* Archive cards — hover lift + image zoom */
      .in-archive-card {
        transition: transform 240ms cubic-bezier(0.23,1,0.32,1), box-shadow 240ms ease, border-color 240ms ease;
        cursor: pointer;
      }
      @media (hover: hover) and (pointer: fine) {
        .in-archive-card:hover { transform: translateY(-3px); }
      }

      /* ─── History tab — season storyline system ─────────────────────── */

      /* Timeline dots — cascade in left to right on intersection */
      .hs-timeline-dot {
        opacity: 0;
        transform: translateY(4px) scale(0.6);
        transition: opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1);
      }
      .hs-timeline.is-visible .hs-timeline-dot { opacity: 1; transform: translateY(0) scale(1); }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(1)  { transition-delay: 20ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(2)  { transition-delay: 50ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(3)  { transition-delay: 80ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(4)  { transition-delay: 110ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(5)  { transition-delay: 140ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(6)  { transition-delay: 170ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(7)  { transition-delay: 200ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(8)  { transition-delay: 230ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(n+9)  { transition-delay: 260ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(n+12) { transition-delay: 320ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(n+16) { transition-delay: 380ms; }
      .hs-timeline.is-visible .hs-timeline-dot:nth-child(n+20) { transition-delay: 440ms; }
      .hs-timeline-line {
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        animation: hs-line-draw 1200ms cubic-bezier(0.16,1,0.3,1) 300ms forwards;
      }
      @keyframes hs-line-draw { to { stroke-dashoffset: 0; } }

      /* Next-race dot pulses */
      .hs-dot-next {
        animation: hs-dot-pulse 2400ms ease-out infinite;
      }
      @keyframes hs-dot-pulse {
        0%   { box-shadow: 0 0 0 0 var(--brand); }
        70%  { box-shadow: 0 0 0 10px rgba(255,106,26,0); }
        100% { box-shadow: 0 0 0 0 rgba(255,106,26,0); }
      }

      /* Active dot — selected via filter or clicked */
      .hs-dot-active { transform: scale(1.45); z-index: 2; }

      /* Highlight reel — fade up stagger */
      .hs-hl-card {
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 460ms cubic-bezier(0.16,1,0.3,1), transform 460ms cubic-bezier(0.16,1,0.3,1);
      }
      .hs-hl.is-visible .hs-hl-card { opacity: 1; transform: translateY(0); }
      .hs-hl.is-visible .hs-hl-card:nth-child(1) { transition-delay: 60ms; }
      .hs-hl.is-visible .hs-hl-card:nth-child(2) { transition-delay: 140ms; }
      .hs-hl.is-visible .hs-hl-card:nth-child(3) { transition-delay: 220ms; }
      .hs-hl.is-visible .hs-hl-card:nth-child(4) { transition-delay: 300ms; }

      /* Filter pill — count badge animates */
      .hs-filter-pill {
        transition: background 200ms ease, border-color 200ms ease, color 200ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1);
      }
      .hs-filter-pill:active { transform: scale(0.97); }
      .hs-filter-count {
        transition: background 200ms ease, color 200ms ease;
      }

      /* Race row — group cascade */
      .hs-race-row {
        opacity: 0;
        transform: translateY(6px);
        transition: opacity 360ms cubic-bezier(0.16,1,0.3,1), transform 360ms cubic-bezier(0.16,1,0.3,1);
      }
      .hs-race-row.is-visible { opacity: 1; transform: translateY(0); }

      /* Month divider — sticky-ish header that morphs as you scroll */
      .hs-month-divider {
        position: sticky;
        top: 0;
        z-index: 3;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        background: linear-gradient(180deg, rgba(6,16,27,0.92) 0%, rgba(6,16,27,0.78) 100%);
        margin: 0 -2px;
        padding: 10px 2px;
      }

      /* View-transition for filter changes */
      ::view-transition-old(history-log),
      ::view-transition-new(history-log) {
        animation-duration: 280ms;
        animation-timing-function: cubic-bezier(0.16,1,0.3,1);
      }

      /* Generate button — pulse when generating */
      @keyframes in-generate-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(96,165,250,0); }
        50%      { box-shadow: 0 0 20px 6px rgba(96,165,250,0.32); }
      }
      .in-generate[data-busy="true"] { animation: in-generate-pulse 1400ms ease-in-out infinite; }

      /* Best weekend — gold pulse + count-up */
      @keyframes ov-trophy-pulse {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50%      { transform: translateY(-2px) rotate(-4deg); }
      }
      .ov-trophy { display: inline-block; animation: ov-trophy-pulse 3200ms ease-in-out infinite; }
      @keyframes ov-gold-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
        50%      { box-shadow: 0 0 24px 6px rgba(251,191,36,0.10); }
      }
      .ov-best-card { animation: ov-gold-glow 4200ms ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .profile-hero, .p-tab-content, .p-avatar-credential { animation: none !important; opacity: 1 !important; transform: none !important; }
        .p-team-btn, .p-action-btn, .p-unlock-link, .p-tab-btn, .p-history-row, .p-account-link, .p-toggle, .p-stat-tile { transition: none !important; }
        .profile-hero:hover .p-avatar-credential { transform: none !important; }
        ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
        .ov-hero, .ov-archetype-char, .ov-hero-desc, .ov-hero-chips, .ov-hero-sparkline, .ov-accuracy-num,
        .ov-ribbon-bar, .ov-strength-fill, .ov-strength-row, .ov-trophy, .ov-best-card,
        .in-cover-char, .in-cover-meta, .in-cover-deck, .in-cover-cta,
        .in-para, .in-vs-bar, .in-cat-row, .in-cat-fill,
        .in-archive-card, .in-generate, .in-dropcap::first-letter,
        .hs-timeline-dot, .hs-timeline-line, .hs-dot-next, .hs-hl-card,
        .hs-filter-pill, .hs-filter-count, .hs-race-row, .hs-month-divider {
          animation: none !important;
          transition: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
      }
    `}</style>

    <PageShell tone="ambient" ambient="subtle">

      {/* ─── Profile hero — Home-level hero card with team-color accent ─── */}
      <section
        className="profile-hero f1-stagger-strong"
        style={{
          position:     "relative",
          overflow:     "hidden",
          borderRadius: SECTION_RADIUS,
          border:       PANEL_BORDER,
          background:   `
            linear-gradient(140deg, ${rgbaFromHex(profileTheme.accent || ACCENT, 0.34)} 0%, ${rgbaFromHex(profileTheme.accent || ACCENT, 0.10)} 38%, rgba(6,16,27,0.96) 100%),
            url("/images/Side%20to%20side%20racing.png") center / cover no-repeat,
            ${PANEL_BG}
          `,
          boxShadow:    LIFTED_SHADOW,
          marginBottom: isMobile ? 18 : 24,
          padding:      isMobile ? "22px 20px 24px" : isTablet ? "30px 32px 30px" : "36px 38px 36px",
        }}
      >
        {/* Top accent rail in team color */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, transparent, ${profileTheme.accent || ACCENT} 30%, ${profileTheme.accent || ACCENT} 70%, transparent)`,
            opacity: 0.92,
          }}
        />

        {/* Row 1: kicker (Manager · Tier · Team) */}
        <div style={{
          "--f1-i": 0,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            12,
          flexWrap:       "wrap",
          marginBottom:   isMobile ? 16 : 22,
        }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.78)", flexWrap: "wrap" }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: "50%", background: profileTheme.accent || ACCENT,
              boxShadow: `0 0 0 4px ${rgbaFromHex(profileTheme.accent || ACCENT, 0.22)}`,
            }} />
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.84)",
            }}>
              Manager · {isPro ? "Pro" : "Free"}{selectedTeamLabel ? ` · ${selectedTeamLabel}` : ""}
            </span>
          </div>
          {rank ? (
            <span style={{
              display:       "inline-flex",
              alignItems:    "center",
              gap:           7,
              padding:       "5px 12px",
              borderRadius:  RADIUS_PILL,
              background:    "rgba(6,16,27,0.42)",
              border:        `1px solid ${rgbaFromHex(profileTheme.accent || ACCENT, 0.26)}`,
              fontSize:      10,
              fontWeight:    900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color:         "rgba(255,255,255,0.92)",
              fontVariantNumeric: "tabular-nums",
            }}>
              Global rank <span style={{ color: profileTheme.accent || ACCENT }}>#{rank}</span>
            </span>
          ) : null}
        </div>

        {/* Row 2: Identity (avatar + username + chips + actions) */}
        <div style={{ "--f1-i": 1, display: "flex", alignItems: "flex-start", gap: isMobile ? 16 : 22, marginBottom: isMobile ? 22 : 28 }}>
          <IdentityAvatar
            className="p-avatar-credential"
            username={user.username}
            colorKey={pendingColor || user.avatar_color || DEFAULT_AVATAR_COLOR}
            size={isMobile ? 80 : 104}
            pro={isPro}
          />

          <div style={{ flex: 1, minWidth: 0, paddingTop: 2, overflow: "hidden" }}>
            {editing ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <input
                    style={{
                      background:    "rgba(6,16,27,0.55)",
                      border:        `1px solid ${rgbaFromHex(profileTheme.accent || ACCENT, 0.32)}`,
                      borderRadius:  12,
                      color:         "rgba(255,255,255,0.98)",
                      padding:       "10px 16px",
                      fontSize:      isMobile ? 26 : 36,
                      fontWeight:    900,
                      letterSpacing: "-0.04em",
                      outline:       "none",
                      fontFamily:    "var(--font-display)",
                      minWidth:      0,
                      maxWidth:      "100%",
                      width:         isMobile ? "100%" : 320,
                    }}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveProfile()}
                    autoFocus
                  />
                  <ProBadge subscriptionStatus={user.subscription_status} />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10, minWidth: 0 }}>
                <h1
                  className="stint-page-title"
                  style={{
                    margin:        0,
                    fontSize:      isMobile ? 30 : isTablet ? 42 : 52,
                    letterSpacing: "-0.045em",
                    lineHeight:    0.96,
                    color:         "rgba(255,255,255,0.98)",
                    textShadow:    "0 2px 18px rgba(0,0,0,0.32)",
                    minWidth:      0,
                    overflow:      "hidden",
                    textOverflow:  "ellipsis",
                    whiteSpace:    "nowrap",
                    maxWidth:      "100%",
                    textTransform: "uppercase",
                  }}
                >
                  {user.username}
                </h1>
                <ProBadge subscriptionStatus={user.subscription_status} />
              </div>
            )}

            {/* Status chips: archetype + cancel notice */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {coachEligible && (
                <span style={{
                  display:       "inline-flex",
                  alignItems:    "center",
                  gap:           6,
                  background:    "rgba(56,189,248,0.14)",
                  border:        `1px solid ${AI_BLUE_BORDER}`,
                  borderRadius:  RADIUS_PILL,
                  padding:       "4px 12px",
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: AI_BLUE }} />
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: AI_BLUE_TEXT,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}>
                    {aiCoach.archetype.label} · {aiCoach.trend.label}
                  </span>
                </span>
              )}
              {scheduledToCancel && (
                <span style={{
                  display:       "inline-flex",
                  alignItems:    "center",
                  gap:           7,
                  background:    PRO_AMBER_BG,
                  border:        `1px solid ${PRO_AMBER_BORDER}`,
                  borderRadius:  RADIUS_PILL,
                  padding:       "4px 12px",
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: PRO_AMBER_DOT }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: PRO_AMBER_TEXT, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Pro ends {subscriptionEndsLabel ? `${subscriptionEndsLabel}` : "this period"}
                  </span>
                </span>
              )}
            </div>

            {editing ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={saveProfile} disabled={saving} className="p-action-btn" style={{ background: SUCCESS_BG, border: `1px solid ${SUCCESS_BORDER}`, borderRadius: RADIUS_PILL, color: SUCCESS_TEXT, cursor: saving ? "default" : "pointer", fontWeight: 900, fontSize: 13, padding: "9px 18px", fontFamily: "inherit" }}>
                  {saving ? "Saving..." : "Save name"}
                </button>
                <button onClick={cancelEditing} className="p-action-btn" style={{ background: "rgba(6,16,27,0.42)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: RADIUS_PILL, color: "rgba(255,255,255,0.78)", cursor: "pointer", fontWeight: 700, fontSize: 13, padding: "9px 16px", fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => { setEditing(true); setError(""); setNote(""); }}
                  className="p-action-btn"
                  style={{
                    background:    "rgba(6,16,27,0.42)",
                    border:        "1px solid rgba(255,255,255,0.18)",
                    borderRadius:  RADIUS_PILL,
                    color:         "rgba(255,255,255,0.88)",
                    cursor:        "pointer",
                    fontWeight:    800,
                    fontSize:      12,
                    padding:       "8px 14px",
                    fontFamily:    "inherit",
                    letterSpacing: "-0.005em",
                  }}
                >
                  Edit name
                </button>
                <button
                  onClick={() => switchTab("account")}
                  className="p-action-btn"
                  style={{
                    background:    "transparent",
                    border:        "none",
                    color:         "rgba(255,255,255,0.66)",
                    cursor:        "pointer",
                    fontWeight:    700,
                    fontSize:      12,
                    padding:       0,
                    fontFamily:    "inherit",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Account settings →
                </button>
              </div>
            )}
          </div>
        </div>

        {(error || note) && (
          <div style={{ "--f1-i": 2, display: "grid", gap: 8, marginBottom: 14 }}>
            {error && <div style={{ padding: "10px 12px", borderRadius: 10, background: ERROR_BG, border: `1px solid ${ERROR_BORDER}`, color: ERROR_TEXT, fontSize: 12, lineHeight: 1.6 }}>{error}</div>}
            {note  && <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "var(--text-note)", fontSize: 12, lineHeight: 1.6 }}>{note}</div>}
          </div>
        )}

        {/* Stat strip — Home-level rhythm: kicker label + Sora display value + caption */}
        <div style={{
          "--f1-i": 3,
          paddingTop:    isMobile ? 16 : 22,
          borderTop:     "1px solid rgba(255,255,255,0.10)",
          display:       "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
          gap:           isMobile ? "16px 18px" : "0 22px",
        }}>
          {[heroStat, ...supportingStats].map((stat) => (
            <div key={stat.label} style={{ minWidth: 0 }}>
              <div style={{
                fontSize:      10,
                fontWeight:    900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color:         "rgba(255,255,255,0.62)",
                marginBottom:  6,
              }}>{stat.label}</div>
              <div style={{
                fontSize:           stat.label === "Total points" ? (isMobile ? 30 : 38) : (isMobile ? 22 : 26),
                fontWeight:         900,
                letterSpacing:      "-0.04em",
                lineHeight:         1.02,
                color:              stat.color || "rgba(255,255,255,0.96)",
                fontVariantNumeric: "tabular-nums",
                fontFamily:         "var(--font-mono)",
                overflow:           "hidden",
                textOverflow:       "ellipsis",
                whiteSpace:         "nowrap",
              }}>{stat.value}</div>
              {stat.detail && (
                <div style={{
                  fontSize:      11,
                  fontWeight:    600,
                  color:         "rgba(255,255,255,0.56)",
                  marginTop:     5,
                  letterSpacing: "-0.005em",
                  overflow:      "hidden",
                  textOverflow:  "ellipsis",
                  whiteSpace:    "nowrap",
                }}>{stat.detail}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Tab bar ─────────────────────────────────────────────────────────
           Home-level pills. Active fill morphs between tabs via shared
           view-transition-name. */}
      <div style={{
        display: "flex",
        gap: isMobile ? 8 : 10,
        marginBottom: isMobile ? 22 : 28,
        flexWrap: "wrap",
        position: "relative",
      }}>
        {TABS.map(({ key, label, pro }) => {
          const active = profileTab === key;
          const showProBadge = pro;
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`p-tab-btn${active ? " is-active" : ""}`}
              style={{
                display:            "inline-flex",
                alignItems:         "center",
                gap:                8,
                background:         active ? rgbaFromHex(ACCENT, 0.13) : "rgba(148,163,184,0.04)",
                border:             active ? `1px solid ${rgbaFromHex(ACCENT, 0.30)}` : `1px solid ${HAIRLINE}`,
                borderRadius:       RADIUS_PILL,
                color:              active ? ACCENT : TEXT_PRIMARY,
                cursor:             "pointer",
                fontWeight:         800,
                fontSize:           isMobile ? 13 : 14,
                letterSpacing:      "-0.005em",
                padding:            isMobile ? "12px 18px" : "11px 22px",
                minHeight:          isMobile ? 44 : 42,
                fontFamily:         "inherit",
                viewTransitionName: active ? "profile-active-tab" : undefined,
                boxShadow:          active ? `0 4px 14px ${rgbaFromHex(ACCENT, 0.18)}` : "none",
              }}
            >
              {label}
              {showProBadge && <ProBadge size="xs" title="Pro tab" />}
            </button>
          );
        })}
      </div>


      {/* ─── History tab ──────────────────────────────────────────────────── */}
      {profileTab === "history" && (
        <div className="p-tab-content f1-stagger-strong">
          {!isPro ? (
            (() => {
              // Pro gate — shows a teaser of the timeline + a focused upsell.
              // We render a sample timeline using the user's own scored history
              // (if any) so they see exactly what they'd unlock — but the
              // Highlight Reel, Filter Rail, and Race Log stay blurred behind
              // the gate to keep the value proposition concrete.
              return (
                <div style={{ display: "grid", gap: isMobile ? 22 : 32 }}>
                  {/* Pro hero card — top of page */}
                  <section style={{
                    "--f1-i": 0,
                    position:     "relative",
                    overflow:     "hidden",
                    borderRadius: SECTION_RADIUS,
                    border:       `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
                    background:   `
                      linear-gradient(140deg, ${rgbaFromHex(ACCENT, 0.30)} 0%, ${rgbaFromHex(ACCENT, 0.08)} 40%, rgba(6,16,27,0.96) 100%),
                      url("/images/Side%20to%20side%20racing.png") center / cover no-repeat,
                      ${PANEL_BG}
                    `,
                    boxShadow:    LIFTED_SHADOW,
                  }}>
                    <span aria-hidden="true" style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 3,
                      background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${ACCENT} 70%, transparent)`,
                      opacity: 0.92,
                    }} />
                    <div style={{ position: "relative", padding: isMobile ? "28px 22px" : "44px 40px" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        marginBottom: isMobile ? 16 : 22,
                        padding: "5px 12px", borderRadius: RADIUS_PILL,
                        background: rgbaFromHex(ACCENT, 0.14),
                        border: `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
                      }}>
                        <span aria-hidden="true" style={{
                          width: 5, height: 5, borderRadius: "50%", background: ACCENT,
                          boxShadow: `0 0 0 4px ${rgbaFromHex(ACCENT, 0.22)}`,
                        }} />
                        <span style={{
                          fontSize: 10, fontWeight: 900, letterSpacing: "0.18em",
                          textTransform: "uppercase", color: ACCENT,
                        }}>History · Pro</span>
                      </div>
                      <h2 className="stint-page-title" style={{
                        margin: "0 0 14px",
                        fontSize: isMobile ? 30 : 52,
                        letterSpacing: "-0.045em",
                        lineHeight: 0.98,
                        color: "rgba(255,255,255,0.98)",
                        textShadow: "0 2px 18px rgba(0,0,0,0.32)",
                        textTransform: "uppercase",
                        maxWidth: "16ch",
                      }}>
                        Your whole season,<br />round by round.
                      </h2>
                      <p style={{
                        margin: "0 0 24px",
                        fontSize: isMobile ? 14 : 16,
                        fontWeight: 500,
                        color: "rgba(226,232,240,0.86)",
                        lineHeight: 1.6,
                        maxWidth: "58ch",
                        letterSpacing: "-0.005em",
                      }}>
                        Pro unlocks the season timeline, your best and worst weekends, recent form, and every round&apos;s category-by-category breakdown — plus filters to slice by wins, top 5, or pending.
                      </p>
                      <a
                        href="/pro"
                        className="p-unlock-link f1-hoverable"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 10,
                          background: BRAND_GRADIENT, border: "none",
                          borderRadius: RADIUS_PILL, color: "#fff",
                          fontSize: 14, fontWeight: 900, padding: "14px 26px",
                          textDecoration: "none",
                          boxShadow: `0 8px 24px ${rgbaFromHex(ACCENT, 0.32)}`,
                          letterSpacing: "-0.005em",
                        }}
                      >
                        Unlock Stint Pro
                        <span style={{ fontSize: 13 }}>→</span>
                      </a>
                    </div>
                  </section>

                  {/* What you unlock — 4 feature cards */}
                  <div style={{ "--f1-i": 1, display: "grid", gap: isMobile ? 14 : 18 }}>
                    <SectionHead
                      kicker="What Pro unlocks"
                      title="A complete season replay"
                      color={ACCENT}
                      isMobile={isMobile}
                    />
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
                      gap: isMobile ? 12 : 14,
                    }}>
                      {[
                        { icon: "📈", label: "Season timeline",  body: "Every round as a dot — score, trend, best weekend, next race.", color: ACCENT },
                        { icon: "🔥", label: "Form ribbon",       body: "Your last 5 races at a glance with trend and L5 average.",       color: "#fdba74" },
                        { icon: "🏆", label: "Highlight reel",    body: "Best weekend, worst weekend, longest streak — all clickable.",   color: "#fbbf24" },
                        { icon: "🎯", label: "Round drill-down",  body: "Tap any race for the full category breakdown of hits + misses.", color: "#7dd3fc" },
                      ].map((feat) => (
                        <div key={feat.label} className="f1-hoverable" style={{
                          position: "relative", overflow: "hidden",
                          borderRadius: CARD_RADIUS,
                          border: `1px solid ${rgbaFromHex(feat.color, 0.22)}`,
                          background: `linear-gradient(135deg, ${rgbaFromHex(feat.color, 0.10)} 0%, ${rgbaFromHex(feat.color, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
                          padding: isMobile ? "16px 16px 14px" : "20px 20px 18px",
                          boxShadow: CARD_SHADOW,
                        }}>
                          <span aria-hidden="true" style={{
                            position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                            background: feat.color, opacity: 0.78,
                          }} />
                          <div style={{
                            fontSize: isMobile ? 18 : 22,
                            lineHeight: 1, marginBottom: 10,
                          }}>{feat.icon}</div>
                          <div style={{
                            fontSize: 10, fontWeight: 900,
                            letterSpacing: "0.14em", textTransform: "uppercase",
                            color: feat.color, marginBottom: 6,
                          }}>{feat.label}</div>
                          <div style={{
                            fontSize: 12.5,
                            color: MUTED_TEXT,
                            lineHeight: 1.55,
                            letterSpacing: "-0.005em",
                          }}>{feat.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom CTA — restates the value with a second-chance CTA */}
                  <section style={{
                    "--f1-i": 2,
                    position: "relative", overflow: "hidden",
                    borderRadius: CARD_RADIUS,
                    border: `1px solid ${rgbaFromHex(ACCENT, 0.28)}`,
                    background: `linear-gradient(135deg, ${rgbaFromHex(ACCENT, 0.14)} 0%, ${rgbaFromHex(ACCENT, 0.03)} 60%, ${PANEL_BG_ALT} 100%)`,
                    padding: isMobile ? "20px 22px" : "24px 28px",
                    boxShadow: CARD_SHADOW,
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: 16, flexWrap: "wrap",
                  }}>
                    <span aria-hidden="true" style={{
                      position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                      background: ACCENT, opacity: 0.78,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 900,
                        letterSpacing: "0.16em", textTransform: "uppercase",
                        color: ACCENT, marginBottom: 6,
                      }}>From $4/month</div>
                      <div className="stint-card-title" style={{
                        fontSize: 16,
                        fontWeight: 900,
                        letterSpacing: "-0.025em",
                        lineHeight: 1.18,
                        color: TEXT_PRIMARY,
                      }}>Ready to read your season properly?</div>
                    </div>
                    <a
                      href="/pro"
                      className="p-unlock-link"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        background: BRAND_GRADIENT, border: "none",
                        borderRadius: RADIUS_PILL, color: "#fff",
                        fontSize: 13, fontWeight: 900, padding: "12px 22px",
                        textDecoration: "none",
                        boxShadow: `0 8px 24px ${rgbaFromHex(ACCENT, 0.32)}`,
                        letterSpacing: "-0.005em",
                        whiteSpace: "nowrap",
                      }}
                    >Unlock Pro <span style={{ fontSize: 12 }}>→</span></a>
                  </section>
                </div>
              );
            })()
          ) : loading ? (
            <div style={{
              padding: isMobile ? 36 : 60,
              textAlign: "center",
              color: MUTED_TEXT,
              fontSize: 13,
              borderRadius: SECTION_RADIUS,
              border: PANEL_BORDER,
              background: PANEL_BG,
            }}>Loading your race log…</div>
          ) : predictions.length === 0 ? (
            <section style={{
              position:     "relative",
              overflow:     "hidden",
              padding:      isMobile ? "40px 24px" : "56px 38px",
              textAlign:    "center",
              borderRadius: SECTION_RADIUS,
              border:       `1px solid ${rgbaFromHex(ACCENT, 0.22)}`,
              background:   `linear-gradient(135deg, ${rgbaFromHex(ACCENT, 0.10)} 0%, ${rgbaFromHex(ACCENT, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
              boxShadow:    CARD_SHADOW,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 900, letterSpacing: "0.16em",
                textTransform: "uppercase", color: ACCENT, marginBottom: 14,
              }}>History · Empty</div>
              <h2 className="stint-page-title" style={{
                margin: "0 0 10px",
                fontSize: isMobile ? 24 : 32,
                letterSpacing: "-0.04em",
                lineHeight: 1.06,
              }}>No picks on your ledger yet</h2>
              <p style={{ margin: 0, fontSize: 14, color: MUTED_TEXT, lineHeight: 1.65, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
                Make your first picks to start building your race-by-race history.
              </p>
            </section>
          ) : (
            (() => {
              // ── Filter rail counts + applied filter ────────────────────────
              const scoredPreds = predictions.filter(isScoredPrediction);
              const wins  = scoredPreds.filter((p) => Number(p.score) >= 40);
              const pending = predictions.filter((p) => !isScoredPrediction(p));

              const bestSet = new Set();
              if (seasonBreakdown.bestRace) bestSet.add(seasonBreakdown.bestRace.round);
              [...scoredPreds].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 5).forEach((p) => bestSet.add(Number(p.race_round)));
              const worstSet = new Set();
              [...scoredPreds].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 5).forEach((p) => worstSet.add(Number(p.race_round)));

              const filters = [
                { key: "all",     label: "All",      count: predictions.length },
                { key: "wins",    label: "Wins 40+", count: wins.length },
                { key: "best",    label: "Top 5",    count: bestSet.size },
                { key: "worst",   label: "Bottom 5", count: worstSet.size },
                { key: "pending", label: "Pending",  count: pending.length },
              ].filter((f) => f.count > 0 || f.key === "all");

              const filterFn = (pred) => {
                const isScored = isScoredPrediction(pred);
                const r = Number(pred.race_round);
                if (historyFilter === "all")     return true;
                if (historyFilter === "wins")    return isScored && Number(pred.score) >= 40;
                if (historyFilter === "best")    return bestSet.has(r);
                if (historyFilter === "worst")   return worstSet.has(r);
                if (historyFilter === "pending") return !isScored;
                return true;
              };

              const filtered = [...predictions].filter(filterFn).reverse();

              // Group filtered predictions by month using CAL date
              const groups = {};
              filtered.forEach((pred) => {
                const race = CAL.find((c) => c.r === pred.race_round);
                const d = race?.date ? new Date(race.date) : new Date();
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                if (!groups[key]) groups[key] = { key, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), items: [] };
                groups[key].items.push(pred);
              });
              const ordered = Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));

              // Click a timeline dot or highlight card → scroll to the matching row + expand it
              const goToRound = (round, isScored) => {
                if (!isScored && round) {
                  // Future race — just highlight on the timeline, no log row
                  setExpandedHistoryRound(null);
                  return;
                }
                setExpandedHistoryRound(round);
                const node = historyRowRefs.current[round];
                if (node) {
                  // delay slightly so any filter change settles first
                  requestAnimationFrame(() => node.scrollIntoView({ behavior: "smooth", block: "center" }));
                }
              };

              return (
                <div style={{ display: "grid", gap: isMobile ? 22 : 32 }}>
                  {/* 1. Season storyline timeline */}
                  <div style={{ "--f1-i": 0 }}>
                    <SeasonTimeline
                      predictions={predictions}
                      breakdown={seasonBreakdown}
                      isMobile={isMobile}
                      activeRound={expandedHistoryRound}
                      onRoundSelect={goToRound}
                    />
                  </div>

                  {/* 2. Form ribbon — recent form bars + L5 trend (merged from Overview) */}
                  {seasonBreakdown.recentForm?.length > 0 && (
                    <div style={{ "--f1-i": 1 }}>
                      <FormRibbon
                        races={seasonBreakdown.recentForm}
                        breakdown={seasonBreakdown}
                        coach={aiCoach}
                        isMobile={isMobile}
                      />
                    </div>
                  )}

                  {/* 3. Highlight reel */}
                  {seasonBreakdown.scoredRounds > 0 && (
                    <div style={{ "--f1-i": 2 }}>
                      <SectionHead
                        kicker="Season highlights"
                        title="Moments that shaped your year"
                        color={ACCENT}
                        isMobile={isMobile}
                      />
                      <div style={{ marginTop: isMobile ? -4 : -2 }}>
                        <HighlightReel
                          predictions={predictions}
                          breakdown={seasonBreakdown}
                          isMobile={isMobile}
                          onSelect={(round) => goToRound(round, true)}
                        />
                      </div>
                    </div>
                  )}

                  {/* 4. Race log header */}
                  <div style={{ "--f1-i": 3, display: "grid", gap: isMobile ? 14 : 18 }}>
                    <SectionHead
                      kicker="Race log"
                      title="Round-by-round picks"
                      meta={`${filtered.length} ${filtered.length === 1 ? "race" : "races"}`}
                      color={ACCENT}
                      isMobile={isMobile}
                    />
                  </div>

                  {/* 5. Race log — grouped by month */}
                  <div style={{ "--f1-i": 4, viewTransitionName: "history-log" }}>
                    {filtered.length === 0 ? (
                      <section style={{
                        padding: isMobile ? "32px 22px" : "44px 32px",
                        textAlign: "center",
                        borderRadius: CARD_RADIUS,
                        border: PANEL_BORDER,
                        background: PANEL_BG,
                      }}>
                        <div style={{
                          fontSize: 10, fontWeight: 900,
                          letterSpacing: "0.16em", textTransform: "uppercase",
                          color: SUBTLE_TEXT, marginBottom: 10,
                        }}>No matches</div>
                        <h3 className="stint-section-title" style={{
                          margin: 0,
                          fontSize: isMobile ? 18 : 22,
                          letterSpacing: "-0.03em",
                        }}>No races match this filter</h3>
                      </section>
                    ) : (
                      <div style={{ display: "grid", gap: isMobile ? 18 : 22 }}>
                        {ordered.map((group) => (
                          <div key={group.key}>
                            <div className="hs-month-divider">
                              <div style={{
                                display: "flex", alignItems: "center", gap: 12,
                              }}>
                                <span aria-hidden="true" style={{
                                  width: 6, height: 6, borderRadius: "50%",
                                  background: ACCENT, opacity: 0.6,
                                }} />
                                <span style={{
                                  fontSize: 11, fontWeight: 900,
                                  letterSpacing: "0.18em", textTransform: "uppercase",
                                  color: TEXT_PRIMARY,
                                  fontFamily: "var(--font-display)",
                                }}>{group.label}</span>
                                <span aria-hidden="true" style={{ flex: 1, height: 1, background: HAIRLINE }} />
                                <span style={{
                                  fontSize: 10, fontWeight: 800,
                                  letterSpacing: "0.10em",
                                  color: SUBTLE_TEXT,
                                  fontVariantNumeric: "tabular-nums",
                                }}>
                                  {group.items.length} {group.items.length === 1 ? "race" : "races"}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                              {group.items.map((prediction) => {
                                const race       = CAL.find((item) => item.r === prediction.race_round);
                                const result     = resultsByRound.get(Number(prediction.race_round));
                                const scored     = isScoredPrediction(prediction);
                                const drillDown  = scored ? describeRaceDrillDown(prediction, result) : [];
                                const isBestRace = scored && seasonBreakdown.bestRace != null && prediction.score === seasonBreakdown.bestRace.score && prediction.race_round === seasonBreakdown.bestRace.round;
                                const r = Number(prediction.race_round);

                                return (
                                  <div
                                    key={r}
                                    ref={(el) => { historyRowRefs.current[r] = el; }}
                                    style={{ scrollMarginTop: 100 }}
                                  >
                                    <HistoryRaceRow
                                      prediction={prediction}
                                      race={race}
                                      result={result}
                                      isBestRace={isBestRace}
                                      isScored={scored}
                                      isExpanded={expandedHistoryRound === r}
                                      onToggle={() => setExpandedHistoryRound((current) => current === r ? null : r)}
                                      drillDown={drillDown}
                                      isMobile={isMobile}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ─── Insights tab ─────────────────────────────────────────────────── */}
      {profileTab === "insights" && (
        <div className="p-tab-content f1-stagger-strong">
          {!isPro ? (
            (() => {
              // Free path — give the user a real reading experience.
              // Sample 0 (Race Debrief) is fully readable as cover + reader,
              // then a teaser strip shows the other categories as locked covers.
              const normalize = (s, idx) => ({
                id: `sample-${idx}`,
                insight_type: idx === 0 ? "post_race" : idx === 1 ? "pre_race" : "monthly",
                race_name: s.raceName || s.label,
                content: s.content,
                summary: s.content,
                generated_at: null,
                source_count: 8 + idx * 2,
                metadata: { round: idx + 1 },
                _sampleDate: s.date,
              });
              const sample0 = normalize(SAMPLE_INSIGHTS[0], 0);
              const lockedSamples = SAMPLE_INSIGHTS.slice(1).map(normalize);
              const freeReaderRef = readerRef;
              const handleReadSample = () => {
                if (freeReaderRef.current) freeReaderRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
              };

              return (
                <div style={{ display: "grid", gap: isMobile ? 22 : 32 }}>
                  {/* 1. Intro kicker */}
                  <div style={{ "--f1-i": 0 }}>
                    <SectionHead
                      kicker="Insights · Free preview"
                      title="A sample issue, on the house"
                      meta="1 of 3 categories"
                      color={AI_BLUE_TEXT}
                      isMobile={isMobile}
                    />
                  </div>

                  {/* 2. Sample cover — fully readable */}
                  <div style={{ "--f1-i": 1 }}>
                    <InsightCover
                      insight={sample0}
                      isPro={false}
                      isMobile={isMobile}
                      onRead={handleReadSample}
                    />
                  </div>

                  {/* 3. Sample reader — full article with progress bar + drop cap + paragraph reveal */}
                  <div ref={freeReaderRef} style={{ "--f1-i": 2, scrollMarginTop: 80 }}>
                    <InsightReader
                      insight={sample0}
                      coach={aiCoach}
                      isMobile={isMobile}
                      accent={insightTypeAccent(sample0.insight_type)}
                    />
                  </div>

                  {/* 4. Pro unlock — flagship CTA between the read and the locked covers */}
                  <section style={{
                    "--f1-i": 3,
                    position:     "relative",
                    overflow:     "hidden",
                    borderRadius: SECTION_RADIUS,
                    border:       `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
                    background:   `linear-gradient(135deg, ${rgbaFromHex(ACCENT, 0.20)} 0%, ${rgbaFromHex(ACCENT, 0.04)} 60%, ${PANEL_BG} 100%)`,
                    padding:      isMobile ? "26px 22px" : "36px 36px",
                    boxShadow:    LIFTED_SHADOW,
                  }}>
                    <span aria-hidden="true" style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 3,
                      background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${ACCENT} 70%, transparent)`,
                      opacity: 0.92,
                    }} />
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto",
                      gap: isMobile ? 16 : 24,
                      alignItems: "center",
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 10, fontWeight: 900,
                          letterSpacing: "0.18em", textTransform: "uppercase",
                          color: ACCENT, marginBottom: 8,
                        }}>You&apos;ve just read a Pro debrief</div>
                        <h2 className="stint-page-title" style={{
                          margin: "0 0 10px",
                          fontSize: isMobile ? 26 : 36,
                          letterSpacing: "-0.04em",
                          lineHeight: 1.04,
                          color: TEXT_PRIMARY,
                          textTransform: "uppercase",
                          maxWidth: "20ch",
                        }}>Unlock every race-week read</h2>
                        <p style={{
                          margin: 0,
                          fontSize: isMobile ? 14 : 15,
                          color: MUTED_TEXT,
                          lineHeight: 1.65,
                          maxWidth: "52ch",
                          fontWeight: 500,
                        }}>
                          Pro publishes a fresh Race Debrief after every weekend, a Pre-Race Tip on Thursdays, and a monthly Season Report — plus AI vs You head-to-head and the full Category Lab.
                        </p>
                      </div>
                      <a
                        href="/pro"
                        className="p-unlock-link f1-hoverable"
                        style={{
                          display:        "inline-flex",
                          alignItems:     "center",
                          gap:            10,
                          background:     BRAND_GRADIENT,
                          border:         "none",
                          borderRadius:   RADIUS_PILL,
                          color:          "#fff",
                          fontSize:       14,
                          fontWeight:     900,
                          letterSpacing:  "-0.005em",
                          padding:        "14px 26px",
                          textDecoration: "none",
                          boxShadow:      `0 8px 24px ${rgbaFromHex(ACCENT, 0.32)}`,
                          flexShrink:     0,
                          whiteSpace:     "nowrap",
                          alignSelf:      "center",
                        }}
                      >
                        Unlock Stint Pro
                        <span style={{ fontSize: 13 }}>→</span>
                      </a>
                    </div>
                  </section>

                  {/* 5. Locked teasers — show the other 2 categories as preview covers */}
                  <div style={{ "--f1-i": 4, display: "grid", gap: isMobile ? 16 : 20 }}>
                    <SectionHead
                      kicker="Also in Pro"
                      title="Other report categories"
                      color={AI_BLUE_TEXT}
                      isMobile={isMobile}
                    />
                    <div style={{
                      position: "relative",
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                      gap: isMobile ? 14 : 18,
                    }}>
                      {lockedSamples.map((sample) => {
                        const accent = insightTypeAccent(sample.insight_type);
                        const label = insightTypeLabel(sample.insight_type);
                        const minutes = readingMinutes(sample.content);
                        const preview = String(sample.content || "").slice(0, 180);
                        return (
                          <div
                            key={sample.id}
                            className="in-archive-card"
                            style={{
                              position: "relative",
                              overflow: "hidden",
                              borderRadius: CARD_RADIUS,
                              border: `1px solid ${rgbaFromHex(accent, 0.28)}`,
                              background: `linear-gradient(135deg, ${rgbaFromHex(accent, 0.14)} 0%, ${rgbaFromHex(accent, 0.03)} 60%, ${PANEL_BG_ALT} 100%)`,
                              padding: isMobile ? "22px 20px 22px" : "26px 24px 26px",
                              boxShadow: CARD_SHADOW,
                              cursor: "default",
                            }}
                          >
                            <span aria-hidden="true" style={{
                              position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                              background: accent, opacity: 0.78,
                            }} />
                            {/* Lock badge — top-right corner */}
                            <span aria-hidden="true" style={{
                              position: "absolute",
                              top: 14, right: 14,
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "5px 11px",
                              borderRadius: RADIUS_PILL,
                              background: "rgba(6,16,27,0.74)",
                              border: `1px solid ${rgbaFromHex(accent, 0.32)}`,
                              fontSize: 10, fontWeight: 900,
                              color: accent,
                              letterSpacing: "0.14em", textTransform: "uppercase",
                            }}>
                              <span>🔒</span> Pro
                            </span>
                            <div style={{
                              fontSize: 10, fontWeight: 900,
                              letterSpacing: "0.16em", textTransform: "uppercase",
                              color: accent, marginBottom: 10,
                            }}>{label}</div>
                            <h3 className="stint-card-title" style={{
                              margin: "0 0 10px",
                              fontSize: isMobile ? 18 : 21,
                              letterSpacing: "-0.028em",
                              lineHeight: 1.16,
                              color: TEXT_PRIMARY,
                            }}>{sample.race_name}</h3>
                            <p style={{
                              margin: 0,
                              fontSize: 13,
                              color: MUTED_TEXT,
                              lineHeight: 1.65,
                              filter: "blur(2.5px)",
                              userSelect: "none",
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}>{preview}…</p>
                            <div style={{
                              marginTop: 16, paddingTop: 12,
                              borderTop: `1px solid ${rgbaFromHex(accent, 0.18)}`,
                              fontSize: 10, fontWeight: 900,
                              letterSpacing: "0.16em", textTransform: "uppercase",
                              color: SUBTLE_TEXT,
                            }}>{minutes} min read · Locked</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            (() => {
              // Pro path — resolve which insight is being read. Defaults to
              // featured; clicking an archive card sets activeInsightId.
              const activeInsight = activeInsightId
                ? visibleInsights.find((i) => i.id === activeInsightId) || featuredInsight
                : featuredInsight;
              const activeAccent = activeInsight ? insightTypeAccent(activeInsight.insight_type) : AI_BLUE_TEXT;

              // "Next report" — cycles through the visible list
              const goNext = () => {
                if (!visibleInsights.length) return;
                const currentIdx = activeInsight
                  ? visibleInsights.findIndex((i) => i.id === activeInsight.id)
                  : -1;
                const nextIdx = (currentIdx + 1) % visibleInsights.length;
                setActiveInsightId(visibleInsights[nextIdx].id);
                // Smooth scroll to the reader so the new article enters from below
                if (readerRef.current) {
                  readerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              };

              const handleReadFull = () => {
                if (readerRef.current) {
                  readerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              };

              return (
                <div style={{ display: "grid", gap: isMobile ? 22 : 32 }}>
                  {(insightError || insightNote) && (
                    <div style={{ "--f1-i": -1, display: "grid", gap: 8 }}>
                      {insightError && (
                        <div style={{ padding: "12px 14px", borderRadius: 12, background: ERROR_BG, border: `1px solid ${ERROR_BORDER}`, color: ERROR_TEXT, fontSize: 12, lineHeight: 1.6 }}>{insightError}</div>
                      )}
                      {insightNote && (
                        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "#bae6fd", fontSize: 12, lineHeight: 1.6 }}>{insightNote}</div>
                      )}
                    </div>
                  )}

                  {/* 1. Coach hero — typing-reveal archetype + count-up accuracy + sparkline (merged from Overview) */}
                  {seasonBreakdown.scoredRounds > 0 && (
                    <div style={{ "--f1-i": 0 }}>
                      <CoachHero
                        coach={aiCoach}
                        breakdown={seasonBreakdown}
                        isPro={isPro}
                        isMobile={isMobile}
                        recentRaces={seasonBreakdown.recentForm}
                      />
                    </div>
                  )}

                  {/* 2. Coach moves — swipeable carousel of Protect / Challenge / Next-move (merged from Overview) */}
                  {seasonBreakdown.scoredRounds > 0 && (
                    <div style={{ "--f1-i": 1, display: "grid", gap: isMobile ? 14 : 16 }}>
                      <SectionHead
                        kicker="Coach moves"
                        title="What to do next"
                        meta={isMobile ? "Swipe →" : null}
                        color={ACCENT}
                        isMobile={isMobile}
                      />
                      <CoachMoveCarousel
                        coach={aiCoach}
                        isPro={isPro}
                        isMobile={isMobile}
                        onUnlock={() => navTo("pro")}
                      />
                    </div>
                  )}

                  {/* 3. Cover hero — typing-reveal title + deck + CTA */}
                  {activeInsight && (
                    <div style={{ "--f1-i": 2 }}>
                      <InsightCover
                        insight={activeInsight}
                        isPro={isPro}
                        isMobile={isMobile}
                        onRead={handleReadFull}
                        onGenerate={generateInsight}
                        generating={insightGenerating}
                        hasInsights={visibleInsights.length > 0}
                      />
                    </div>
                  )}

                  {/* 4. Reader — article view with reading progress, drop cap, paragraph reveal */}
                  {activeInsight && (
                    <div ref={readerRef} style={{ "--f1-i": 3, scrollMarginTop: 80 }}>
                      <InsightReader
                        insight={activeInsight}
                        coach={aiCoach}
                        isMobile={isMobile}
                        accent={activeAccent}
                        onTour={visibleInsights.length > 1 ? goNext : null}
                      />
                    </div>
                  )}

                  {/* 5. AI vs You spread — only if comparison is available */}
                  {aiCoach.comparisonAvailable && (
                    <div style={{ "--f1-i": 4 }}>
                      <AiVsYouSpread
                        coach={aiCoach}
                        breakdown={seasonBreakdown}
                        history={aiHistory}
                        isMobile={isMobile}
                      />
                    </div>
                  )}

                  {/* 6. Category lab — full breakdown */}
                  <div style={{ "--f1-i": 5 }}>
                    <CategoryLab
                      breakdown={seasonBreakdown}
                      history={aiHistory}
                      isMobile={isMobile}
                    />
                  </div>

                  {/* 7. Studio — generate action */}
                  <div style={{ "--f1-i": 6 }}>
                    <InsightStudio
                      onGenerate={generateInsight}
                      generating={insightGenerating}
                      hasInsights={visibleInsights.length > 0}
                      isAdmin={isAdminUser(user)}
                      onReplay={buildAiReplayHistoryAction}
                      replayBusy={aiHistoryBusy}
                      aiLoadError={aiHistoryLoadError}
                      aiMessage={aiHistoryMessage}
                      isMobile={isMobile}
                    />
                  </div>

                  {/* 8. Archive — grouped by month */}
                  {insightsLoading ? (
                    <div style={{
                      "--f1-i": 7,
                      padding: isMobile ? 36 : 60,
                      textAlign: "center",
                      color: MUTED_TEXT,
                      fontSize: 13,
                      borderRadius: SECTION_RADIUS,
                      border: PANEL_BORDER,
                      background: PANEL_BG,
                    }}>Loading your insights…</div>
                  ) : visibleInsights.length === 0 ? (
                    <section style={{
                      "--f1-i": 7,
                      position:     "relative",
                      overflow:     "hidden",
                      padding:      isMobile ? "32px 22px" : "48px 36px",
                      textAlign:    "center",
                      borderRadius: SECTION_RADIUS,
                      border:       `1px solid ${rgbaFromHex(AI_BLUE, 0.24)}`,
                      background:   `linear-gradient(135deg, ${rgbaFromHex(AI_BLUE, 0.10)} 0%, ${rgbaFromHex(AI_BLUE, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
                      boxShadow:    CARD_SHADOW,
                    }}>
                      <div style={{
                        fontSize: 10, fontWeight: 900, letterSpacing: "0.16em",
                        textTransform: "uppercase", color: AI_BLUE_TEXT, marginBottom: 14,
                      }}>Archive · Empty</div>
                      <h3 className="stint-section-title" style={{ margin: "0 0 10px", fontSize: isMobile ? 22 : 28, letterSpacing: "-0.035em" }}>No reports yet</h3>
                      <p style={{ fontSize: 14, color: MUTED_TEXT, maxWidth: 420, margin: "0 auto", lineHeight: 1.65 }}>
                        {seasonBreakdown.scoredRounds > 0 ? "Hit Generate report above for your first written read." : "Reports start after a scored round."}
                      </p>
                    </section>
                  ) : (
                    <div style={{ "--f1-i": 7, display: "grid", gap: isMobile ? 16 : 20 }}>
                      <SectionHead
                        kicker="Archive"
                        title="Back issues"
                        meta={`${visibleInsights.length} ${visibleInsights.length === 1 ? "report" : "reports"}`}
                        color={SUBTLE_TEXT}
                        isMobile={isMobile}
                      />
                      <InsightArchiveDeck
                        insights={visibleInsights}
                        isMobile={isMobile}
                        onSelect={(ins) => {
                          setActiveInsightId(ins.id);
                          if (readerRef.current) {
                            readerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }}
                        activeId={activeInsight?.id}
                      />
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ─── Account tab ──────────────────────────────────────────────────── */}
      {profileTab === "account" && (
        <div className="p-tab-content" style={{ display: "grid", gap: isMobile ? 14 : 18 }}>

          {/* Page header */}
          <SectionHead
            kicker="Account"
            title="Manage your profile"
            meta={user?.email || ""}
            color={ACCENT}
            isMobile={isMobile}
          />

          {/* Quick-nav anchor pills — jumps to each section */}
          <nav
            aria-label="Account sections"
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              padding: "2px 0 6px",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <style>{`nav[aria-label="Account sections"]::-webkit-scrollbar { display: none; }`}</style>
            {[
              { id: "acc-identity",      label: "Identity"      },
              { id: "acc-appearance",    label: "Appearance"    },
              { id: "acc-subscription",  label: "Subscription"  },
              { id: "acc-notifications", label: "Notifications" },
              { id: "acc-data",          label: "Data"          },
              { id: "acc-zone",          label: "Account zone"  },
            ].map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: isMobile ? "8px 14px" : "8px 14px",
                  borderRadius: RADIUS_PILL,
                  background: "rgba(148,163,184,0.04)",
                  border: `1px solid ${HAIRLINE}`,
                  fontSize: 12,
                  fontWeight: 800,
                  color: MUTED_TEXT,
                  textDecoration: "none",
                  letterSpacing: "-0.005em",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >{link.label}</a>
            ))}
          </nav>

          {/* Identity */}
          <AccountSection
            id="acc-identity"
            title="Identity"
            description="Your name, the avatar that represents you, and the team you support."
            valueChip={
              <span style={{
                fontSize: 11, fontWeight: 800, color: profileTheme.accent || ACCENT,
                background: rgbaFromHex(profileTheme.accent || ACCENT, 0.10),
                border: `1px solid ${rgbaFromHex(profileTheme.accent || ACCENT, 0.26)}`,
                borderRadius: RADIUS_PILL, padding: "3px 10px",
                letterSpacing: "-0.005em",
                fontVariantNumeric: "tabular-nums",
              }}>{user.username}</span>
            }
          >
            <div style={{ display: "grid", gap: 24 }}>
              {/* Top row: live avatar preview + username field */}
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "auto 1fr" : "auto 1fr auto",
                gap: 16,
                alignItems: "center",
              }}>
                <IdentityAvatar
                  username={newUsername || user.username}
                  colorKey={pendingColor || user.avatar_color || DEFAULT_AVATAR_COLOR}
                  size={isMobile ? 56 : 64}
                  pro={isPro}
                />
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="acc-username" style={{
                    display: "block",
                    fontSize: 10, fontWeight: 900,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    color: SUBTLE_TEXT, marginBottom: 6,
                  }}>Username</label>
                  <input
                    id="acc-username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveProfile()}
                    placeholder="Your manager name"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="p-input"
                    style={{
                      width:         "100%",
                      background:    PANEL_BG_ALT,
                      border:        `1px solid ${HAIRLINE}`,
                      borderRadius:  RADIUS_MD,
                      color:         TEXT_PRIMARY,
                      padding:       isMobile ? "12px 14px" : "12px 16px",
                      fontSize:      15,
                      fontWeight:    700,
                      letterSpacing: "-0.015em",
                      minHeight:     44,
                      fontFamily:    "inherit",
                      outline:       "none",
                    }}
                  />
                </div>
                <button
                  onClick={saveProfile}
                  disabled={saving || newUsername === user.username}
                  className="p-action-btn"
                  style={{
                    gridColumn: isMobile ? "1 / -1" : "auto",
                    background: saving || newUsername === user.username
                      ? "rgba(148,163,184,0.10)"
                      : BRAND_GRADIENT,
                    border: saving || newUsername === user.username
                      ? `1px solid ${HAIRLINE}`
                      : "none",
                    borderRadius: RADIUS_PILL,
                    color: saving || newUsername === user.username ? SUBTLE_TEXT : "#fff",
                    cursor: saving || newUsername === user.username ? "default" : "pointer",
                    fontWeight: 900, fontSize: 13,
                    padding: "12px 22px",
                    letterSpacing: "-0.005em",
                    fontFamily: "inherit",
                    minHeight: 44,
                    boxShadow: saving || newUsername === user.username
                      ? "none"
                      : `0 4px 14px ${rgbaFromHex(ACCENT, 0.32)}`,
                  }}
                >
                  {saving ? "Saving…" : newUsername === user.username ? "Saved" : "Save name"}
                </button>
              </div>

              {/* Support team */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                  <label style={{
                    fontSize: 10, fontWeight: 900,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    color: SUBTLE_TEXT,
                  }}>Support team</label>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: MUTED_TEXT,
                    letterSpacing: "-0.005em",
                  }}>Tints your avatar + hero across the app</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {supportOptions.map(({ key, label, team }) => {
                    const option = AVATAR_THEMES[key];
                    if (!option) return null;
                    const isActive = pendingTeam === team;
                    return (
                      <button
                        key={key}
                        onClick={() => saveSupportPreferences(team)}
                        aria-pressed={isActive}
                        aria-label={label}
                        className="p-team-btn"
                        style={{
                          position:     "relative",
                          borderRadius: RADIUS_PILL,
                          border:       isActive ? `1px solid ${option.border}` : `1px solid ${HAIRLINE}`,
                          background:   isActive ? option.bg : "rgba(148,163,184,0.04)",
                          cursor:       supportSaving ? "default" : "pointer",
                          padding:      isMobile ? "10px 14px" : "9px 14px",
                          minHeight:    isMobile ? 42 : 38,
                          display:      "inline-flex",
                          alignItems:   "center",
                          gap:          9,
                          fontFamily:   "inherit",
                          opacity:      supportSaving && !isActive ? 0.6 : 1,
                        }}
                      >
                        <span style={{
                          width: 14, height: 14, borderRadius: "50%",
                          background: option.fill, flexShrink: 0,
                          boxShadow: isActive ? `0 0 0 3px ${rgbaFromHex(option.fill, 0.24)}` : "none",
                        }} />
                        <span style={{
                          fontSize: 13,
                          fontWeight: isActive ? 900 : 700,
                          color: isActive ? option.text : TEXT_PRIMARY,
                          letterSpacing: "-0.005em",
                        }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </AccountSection>

          {/* Appearance — theme + density */}
          <AccountSection
            id="acc-appearance"
            title="Appearance"
            description="How Stint looks on your device."
            valueChip={
              <span style={{
                fontSize: 11, fontWeight: 800, color: MUTED_TEXT,
                background: "rgba(148,163,184,0.08)",
                border: `1px solid ${HAIRLINE}`,
                borderRadius: RADIUS_PILL, padding: "3px 10px",
                letterSpacing: "-0.005em",
                textTransform: "capitalize",
              }}>{themePreference} · {densityPreference}</span>
            }
          >
            <div style={{ display: "grid", gap: 20 }}>
              {/* Theme */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: 10, fontWeight: 900,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: SUBTLE_TEXT, marginBottom: 10,
                }}>Theme</label>
                <div style={{
                  display:       "inline-flex",
                  gap:           4,
                  padding:       4,
                  background:    PANEL_BG_ALT,
                  border:        PANEL_BORDER,
                  borderRadius:  RADIUS_PILL,
                  width:         "fit-content",
                  maxWidth:      "100%",
                  flexWrap:      "wrap",
                }}>
                  {[
                    { key: "light", label: "Light",   icon: "☀" },
                    { key: "dark",  label: "Dark",    icon: "☾" },
                    { key: "auto",  label: "System",  icon: "◐" },
                  ].map(({ key, label, icon }) => {
                    const active = themePreference === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setThemePreference(key)}
                        aria-pressed={active}
                        className="p-theme-btn"
                        style={{
                          display:        "inline-flex",
                          alignItems:     "center",
                          gap:            8,
                          background:     active ? rgbaFromHex(ACCENT, 0.13) : "transparent",
                          border:         active ? `1px solid ${rgbaFromHex(ACCENT, 0.30)}` : "1px solid transparent",
                          borderRadius:   RADIUS_PILL,
                          padding:        isMobile ? "10px 16px" : "9px 16px",
                          minHeight:      isMobile ? 42 : 36,
                          color:          active ? ACCENT : MUTED_TEXT,
                          fontWeight:     active ? 900 : 700,
                          fontSize:       13,
                          letterSpacing:  "-0.005em",
                          fontFamily:     "inherit",
                          cursor:         "pointer",
                        }}
                      >
                        <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1, opacity: 0.78 }}>{icon}</span>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: SUBTLE_TEXT, lineHeight: 1.55, marginTop: 8 }}>
                  System matches your device. The Navbar toggle changes the same setting.
                </div>
              </div>

              {/* Density */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: 10, fontWeight: 900,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: SUBTLE_TEXT, marginBottom: 10,
                }}>Density</label>
                <div style={{
                  display:       "inline-flex",
                  gap:           4,
                  padding:       4,
                  background:    PANEL_BG_ALT,
                  border:        PANEL_BORDER,
                  borderRadius:  RADIUS_PILL,
                  width:         "fit-content",
                  maxWidth:      "100%",
                  flexWrap:      "wrap",
                }}>
                  {[
                    { key: "comfortable", label: "Comfortable" },
                    { key: "compact",     label: "Compact"     },
                  ].map(({ key, label }) => {
                    const active = densityPreference === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setDensityPreference(key)}
                        aria-pressed={active}
                        className="p-density-btn"
                        style={{
                          display:        "inline-flex",
                          alignItems:     "center",
                          gap:            8,
                          background:     active ? rgbaFromHex(ACCENT, 0.13) : "transparent",
                          border:         active ? `1px solid ${rgbaFromHex(ACCENT, 0.30)}` : "1px solid transparent",
                          borderRadius:   RADIUS_PILL,
                          padding:        isMobile ? "10px 16px" : "9px 16px",
                          minHeight:      isMobile ? 42 : 36,
                          color:          active ? ACCENT : MUTED_TEXT,
                          fontWeight:     active ? 900 : 700,
                          fontSize:       13,
                          letterSpacing:  "-0.005em",
                          fontFamily:     "inherit",
                          cursor:         "pointer",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: SUBTLE_TEXT, lineHeight: 1.55, marginTop: 8 }}>
                  Compact tightens row padding on long lists.
                </div>
              </div>
            </div>
          </AccountSection>

          {/* Subscription */}
          <AccountSection
            id="acc-subscription"
            title="Subscription"
            description={isPro
              ? scheduledToCancel
                ? `Pro · scheduled to end ${subscriptionEndsLabel || "at the end of the current billing period"}.`
                : subscriptionEndsLabel
                  ? `Pro · renews ${subscriptionEndsLabel}.`
                  : "Pro · active."
              : "Free · upgrade to unlock Pro features and the Pro Community League."}
            valueChip={(() => {
              const statusLabel = isPro ? (scheduledToCancel ? "Ending" : "Active") : "Free";
              const statusColor = isPro
                ? (scheduledToCancel ? PRO_AMBER_DOT : LIVE_GREEN)
                : SUBTLE_TEXT;
              const statusTextColor = isPro
                ? (scheduledToCancel ? PRO_AMBER_TEXT : SUCCESS_TEXT)
                : TEXT_PRIMARY;
              return (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 11, fontWeight: 800,
                  color: statusTextColor,
                  background: rgbaFromHex(statusColor, 0.10),
                  border: `1px solid ${rgbaFromHex(statusColor, 0.26)}`,
                  borderRadius: RADIUS_PILL, padding: "3px 10px",
                  letterSpacing: "-0.005em",
                }}>
                  <span aria-hidden="true" style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: statusColor,
                    boxShadow: isPro && !scheduledToCancel ? LIVE_GREEN_GLOW : "none",
                  }} />
                  {isPro ? "Pro" : "Free"} · {statusLabel}
                </span>
              );
            })()}
            action={
              isPro ? (
                <button
                  onClick={handleOpenBillingPortal}
                  disabled={portalBusy}
                  className="p-action-btn"
                  style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.18)", borderRadius: RADIUS_PILL, color: MUTED_TEXT, cursor: portalBusy ? "wait" : "pointer", fontWeight: 700, fontSize: 12, padding: "7px 13px", fontFamily: "inherit" }}
                >
                  {portalBusy ? "Opening…" : "Manage subscription"}
                </button>
              ) : (
                <a
                  href="/pro"
                  className="p-unlock-link"
                  style={{
                    display:        "inline-flex",
                    alignItems:     "center",
                    gap:            6,
                    background:     rgbaFromHex(ACCENT, 0.12),
                    border:         `1px solid ${rgbaFromHex(ACCENT, 0.28)}`,
                    borderRadius:   RADIUS_PILL,
                    color: "var(--brand)",
                    fontSize:       12,
                    fontWeight:     800,
                    padding:        "7px 13px",
                    textDecoration: "none",
                  }}
                >
                  Upgrade
                </a>
              )
            }
          >
            <div style={{ display: "grid", gap: 14 }}>
              {/* Key-value table for subscription details */}
              <dl style={{
                margin: 0,
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "auto 1fr",
                rowGap: 14,
                columnGap: 18,
              }}>
                <dt style={{
                  fontSize: 10, fontWeight: 900,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: SUBTLE_TEXT,
                  alignSelf: "center",
                }}>{scheduledToCancel ? "Access ends" : isPro ? "Renews" : "Upgrade"}</dt>
                <dd style={{
                  margin: 0,
                  fontSize: 15, fontWeight: 800,
                  color: TEXT_PRIMARY,
                  letterSpacing: "-0.015em",
                  fontVariantNumeric: "tabular-nums",
                }}>{subscriptionEndsLabel || (isPro ? "On subscription anniversary" : "From $4/month")}</dd>

                {isPro && (
                  <>
                    <dt style={{
                      fontSize: 10, fontWeight: 900,
                      letterSpacing: "0.16em", textTransform: "uppercase",
                      color: SUBTLE_TEXT,
                      alignSelf: "center",
                    }}>Pro League rank</dt>
                    <dd style={{
                      margin: 0,
                      fontSize: 15, fontWeight: 800,
                      color: TEXT_PRIMARY,
                      letterSpacing: "-0.015em",
                      fontVariantNumeric: "tabular-nums",
                    }}>{proLeague.myRank
                      ? `#${proLeague.myRank}${proLeague.totalMembers ? ` of ${proLeague.totalMembers} members` : ""}`
                      : proLeague.totalMembers
                        ? "Awaiting first scored pick"
                        : "Founding season"}</dd>
                  </>
                )}
              </dl>

              {scheduledToCancel && isPro && (
                <div style={{
                  padding: "12px 14px",
                  borderRadius: RADIUS_MD,
                  background: PRO_AMBER_BG,
                  border: `1px solid ${PRO_AMBER_BORDER}`,
                  color: PRO_AMBER_TEXT,
                  fontSize: 12.5,
                  fontWeight: 600,
                  lineHeight: 1.55,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>⚠</span>
                  <span>Your subscription is set to cancel. You keep full Pro access until the end of this billing period.</span>
                </div>
              )}
            </div>
          </AccountSection>

          {/* Notifications */}
          {(() => {
            const notifPrefs = [
              { key: "race_lock",   label: "Pick lock reminder",     hint: "Alert 60 minutes before qualifying locks picks." },
              { key: "results",     label: "Scoring ready",          hint: "When your weekend score is final and posted." },
              { key: "insights",    label: "AI insight ready",       hint: "When a fresh debrief or report lands in your Insights tab." },
              { key: "news_digest", label: "Weekly paddock digest",  hint: "Friday morning summary of the race week ahead." },
            ];
            const onCount = notifPrefs.filter((p) => notificationPrefs[p.key]).length;
            return (
              <AccountSection
                id="acc-notifications"
                title="Notifications"
                description="Email dispatch is coming soon — your toggles will activate automatically when it ships."
                valueChip={
                  <span style={{
                    fontSize: 11, fontWeight: 800,
                    color: onCount > 0 ? ACCENT : SUBTLE_TEXT,
                    background: onCount > 0 ? rgbaFromHex(ACCENT, 0.10) : "rgba(148,163,184,0.08)",
                    border: onCount > 0 ? `1px solid ${rgbaFromHex(ACCENT, 0.26)}` : `1px solid ${HAIRLINE}`,
                    borderRadius: RADIUS_PILL, padding: "3px 10px",
                    letterSpacing: "-0.005em",
                    fontVariantNumeric: "tabular-nums",
                  }}>{onCount} of {notifPrefs.length} on</span>
                }
              >
                <div style={{ display: "grid", gap: 0 }}>
                  {notifPrefs.map((pref, idx) => {
                    const on = !!notificationPrefs[pref.key];
                    return (
                      <div
                        key={pref.key}
                        style={{
                          display:      "flex",
                          justifyContent: "space-between",
                          alignItems:    "center",
                          gap:           14,
                          padding:       "14px 0",
                          borderTop:     idx === 0 ? "none" : `1px solid ${HAIRLINE}`,
                        }}
                      >
                        <div style={{ minWidth: 0, paddingRight: 8 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 800,
                            letterSpacing: "-0.015em",
                            lineHeight: 1.25,
                            color: TEXT_PRIMARY,
                            marginBottom: 3,
                          }}>{pref.label}</div>
                          <div style={{
                            fontSize: 12.5,
                            color: MUTED_TEXT,
                            lineHeight: 1.5,
                            letterSpacing: "-0.005em",
                          }}>{pref.hint}</div>
                        </div>
                        <button
                          onClick={() => setNotificationPrefs((current) => ({ ...current, [pref.key]: !current[pref.key] }))}
                          aria-pressed={on}
                          aria-label={`Toggle ${pref.label}`}
                          className="p-toggle"
                          style={{
                            width:        isMobile ? 48 : 44,
                            height:       isMobile ? 28 : 26,
                            borderRadius: 999,
                            border:       `1px solid ${on ? rgbaFromHex(ACCENT, 0.50) : "rgba(148,163,184,0.24)"}`,
                            background:   on ? rgbaFromHex(ACCENT, 0.50) : "rgba(148,163,184,0.10)",
                            position:     "relative",
                            cursor:       "pointer",
                            flexShrink:   0,
                            padding:      0,
                          }}
                        >
                          <span style={{
                            position:     "absolute",
                            top:          2,
                            left:         on ? (isMobile ? 22 : 20) : 2,
                            width:        isMobile ? 22 : 20,
                            height:       isMobile ? 22 : 20,
                            borderRadius: "50%",
                            background:   on ? "#fff" : "rgba(214,223,239,0.78)",
                            boxShadow:    on ? "0 1px 4px rgba(0,0,0,0.32)" : "none",
                            transition:   "left 180ms cubic-bezier(0.23,1,0.32,1)",
                          }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </AccountSection>
            );
          })()}

          {/* Data */}
          <AccountSection
            id="acc-data"
            title="Your data"
            description="Export what we've stored for you, or request removal."
            valueChip={
              <span style={{
                fontSize: 11, fontWeight: 800, color: MUTED_TEXT,
                background: "rgba(148,163,184,0.08)",
                border: `1px solid ${HAIRLINE}`,
                borderRadius: RADIUS_PILL, padding: "3px 10px",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.005em",
              }}>{predictions.length} {predictions.length === 1 ? "pick" : "picks"}</span>
            }
          >
            <div style={{ display: "grid", gap: 0 }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 14, padding: "14px 0",
                flexWrap: "wrap",
              }}>
                <div style={{ minWidth: 0, paddingRight: 8 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 800,
                    letterSpacing: "-0.015em", lineHeight: 1.25,
                    color: TEXT_PRIMARY, marginBottom: 3,
                  }}>Download your picks</div>
                  <div style={{
                    fontSize: 12.5, color: MUTED_TEXT,
                    lineHeight: 1.5, letterSpacing: "-0.005em",
                  }}>All your scored and pending picks as a JSON file.</div>
                </div>
                <button
                  onClick={downloadPicks}
                  disabled={!predictions.length}
                  className="p-action-btn"
                  style={{
                    background: predictions.length ? rgbaFromHex("#7dd3fc", 0.12) : "rgba(148,163,184,0.06)",
                    border: `1px solid ${predictions.length ? rgbaFromHex("#7dd3fc", 0.30) : HAIRLINE}`,
                    borderRadius: RADIUS_PILL,
                    color: predictions.length ? "#7dd3fc" : SUBTLE_TEXT,
                    cursor: predictions.length ? "pointer" : "not-allowed",
                    fontWeight: 800, fontSize: 12,
                    padding: "9px 14px", fontFamily: "inherit",
                    letterSpacing: "-0.005em",
                    opacity: predictions.length ? 1 : 0.6,
                    whiteSpace: "nowrap",
                  }}
                >
                  {predictions.length ? "Download JSON" : "No picks yet"}
                </button>
              </div>

              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 14, padding: "14px 0",
                borderTop: `1px solid ${HAIRLINE}`,
                flexWrap: "wrap",
              }}>
                <div style={{ minWidth: 0, paddingRight: 8 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 800,
                    letterSpacing: "-0.015em", lineHeight: 1.25,
                    color: TEXT_PRIMARY, marginBottom: 3,
                  }}>Written reports archive</div>
                  <div style={{
                    fontSize: 12.5, color: MUTED_TEXT,
                    lineHeight: 1.5, letterSpacing: "-0.005em",
                  }}>Coming soon — a consolidated PDF of every AI debrief we&apos;ve generated for you.</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 900,
                  color: SUBTLE_TEXT,
                  background: "rgba(148,163,184,0.08)",
                  border: `1px solid ${HAIRLINE}`,
                  borderRadius: RADIUS_PILL,
                  padding: "5px 11px",
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>Soon</span>
              </div>
            </div>
          </AccountSection>

          {/* Account zone — Session + Delete combined into one section */}
          <AccountSection
            id="acc-zone"
            title="Account zone"
            description="Sign out of this device, or permanently remove your account."
          >
            <div style={{ display: "grid", gap: 0 }}>
              {/* Sign out row */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 14, padding: "4px 0 16px",
                flexWrap: "wrap",
              }}>
                <div style={{ minWidth: 0, paddingRight: 8 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 800,
                    letterSpacing: "-0.015em", lineHeight: 1.25,
                    color: TEXT_PRIMARY, marginBottom: 3,
                  }}>Sign out of this device</div>
                  <div style={{
                    fontSize: 12.5, color: MUTED_TEXT,
                    lineHeight: 1.5, letterSpacing: "-0.005em",
                  }}>You&apos;ll need to sign back in to make picks or view your data.</div>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={signOutBusy}
                  className="p-action-btn"
                  style={{
                    background: rgbaFromHex(ACCENT, 0.10),
                    border: `1px solid ${rgbaFromHex(ACCENT, 0.28)}`,
                    borderRadius: RADIUS_PILL,
                    color: ACCENT,
                    cursor: signOutBusy ? "wait" : "pointer",
                    fontWeight: 800, fontSize: 12,
                    padding: "9px 16px", fontFamily: "inherit",
                    letterSpacing: "-0.005em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {signOutBusy ? "Signing out…" : "Sign out"}
                </button>
              </div>

              {/* Danger divider */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                margin: "4px 0 12px",
                paddingTop: 16,
                borderTop: `1px dashed ${rgbaFromHex(ERROR_TEXT, 0.28)}`,
              }}>
                <span aria-hidden="true" style={{
                  fontSize: 10, fontWeight: 900,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: ERROR_TEXT,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: ERROR_TEXT }} />
                  Danger zone
                </span>
              </div>

              {/* Delete account */}
              <div style={{
                display: deleteStaged ? "block" : "flex",
                justifyContent: "space-between",
                alignItems: "center", gap: 14,
                flexWrap: "wrap",
              }}>
                {!deleteStaged ? (
                  <>
                    <div style={{ minWidth: 0, paddingRight: 8 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 800,
                        letterSpacing: "-0.015em", lineHeight: 1.25,
                        color: ERROR_TEXT, marginBottom: 3,
                      }}>Delete account</div>
                      <div style={{
                        fontSize: 12.5, color: MUTED_TEXT,
                        lineHeight: 1.5, letterSpacing: "-0.005em",
                      }}>Removes your profile, picks, insights, and league memberships. This cannot be undone.</div>
                    </div>
                    <button
                      onClick={() => setDeleteStaged(true)}
                      className="p-action-btn"
                      style={{
                        background: "rgba(239,68,68,0.10)",
                        border: "1px solid rgba(239,68,68,0.28)",
                        borderRadius: RADIUS_PILL,
                        color: "#fca5a5", cursor: "pointer",
                        fontWeight: 800, fontSize: 12,
                        padding: "9px 16px", fontFamily: "inherit",
                        letterSpacing: "-0.005em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Delete account…
                    </button>
                  </>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ fontSize: 13, color: "#fecaca", lineHeight: 1.6 }}>
                      Type <strong style={{ color: TEXT_PRIMARY }}>{user.username}</strong> to confirm. We&apos;ll open an email to support with your identity pre-filled — an engineer will process the deletion within 24 hours.
                    </div>
                    <input
                      value={deleteTyped}
                      onChange={(e) => setDeleteTyped(e.target.value)}
                      placeholder="Type your username"
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      style={{
                        background:   PANEL_BG_ALT,
                        border:       "1px solid rgba(239,68,68,0.32)",
                        borderRadius: RADIUS_MD,
                        color:        TEXT_PRIMARY,
                        padding:      "11px 14px",
                        fontSize:     15,
                        minHeight:    44,
                        fontFamily:   "inherit",
                        outline:      "none",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteTyped !== user.username}
                        className="p-action-btn"
                        style={{
                          background: deleteTyped === user.username ? "rgba(239,68,68,0.22)" : "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.36)",
                          borderRadius: RADIUS_PILL,
                          color: "#fca5a5",
                          cursor: deleteTyped === user.username ? "pointer" : "not-allowed",
                          fontWeight: 800, fontSize: 13,
                          padding: "10px 18px", fontFamily: "inherit",
                          opacity: deleteTyped === user.username ? 1 : 0.55,
                          letterSpacing: "-0.005em",
                        }}
                      >
                        Request deletion
                      </button>
                      <button
                        onClick={() => { setDeleteStaged(false); setDeleteTyped(""); }}
                        className="p-action-btn"
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(148,163,184,0.18)",
                          borderRadius: RADIUS_PILL,
                          color: MUTED_TEXT,
                          cursor: "pointer",
                          fontWeight: 700, fontSize: 13,
                          padding: "10px 18px", fontFamily: "inherit",
                          letterSpacing: "-0.005em",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </AccountSection>

          <div style={{ textAlign: "center", fontSize: 11, color: SUBTLE_TEXT, padding: "4px 0 8px" }}>
            Stint · {user.id.slice(0, 8)} · <a href="mailto:support@stint-web.com" style={{ color: SUBTLE_TEXT, textDecoration: "underline" }}>support@stint-web.com</a>
          </div>
        </div>
      )}

    </PageShell>
    </>
  );
}
