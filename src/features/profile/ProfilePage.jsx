"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { ACTIVE_RACE_COUNT, CAL, nextRace } from "@/src/constants/calendar";
import { PTS } from "@/src/constants/scoring";
import {
  ACCENT,
  AI_BLUE,
  AI_BLUE_BORDER,
  AI_BLUE_SOFT,
  AI_BLUE_TEXT,
  AVATAR_THEMES,
  BRAND_GRADIENT,
  CONTENT_MAX,
  DEFAULT_AVATAR_COLOR,
  ERROR_BG,
  ERROR_BORDER,
  ERROR_TEXT,
  HAIRLINE,
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
import PageMasthead from "@/src/ui/PageMasthead";
import { withViewTransition } from "@/src/lib/viewTransition";
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
  { key: "overview", label: "Overview" },
  { key: "history",  label: "History"  },
  { key: "insights", label: "Insights" },
  { key: "account",  label: "Account"  },
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
  for (const row of Array.isArray(predictionRows) ? predictionRows : []) {
    const round = Number(row?.race_round || 0);
    const categoryKey = String(row?.category_key || "");
    if (!round || !categoryKey || !resultsByRound.has(round)) continue;

    const dedupeKey = `${round}:${categoryKey}`;
    const existing = latestRowsByCategoryRace.get(dedupeKey);
    const existingTime = new Date(existing?.generated_at || 0).getTime();
    const nextTime = new Date(row?.generated_at || 0).getTime();
    if (!existing || nextTime >= existingTime) latestRowsByCategoryRace.set(dedupeKey, row);
  }

  const categories = new Map(
    INSIGHT_CATEGORY_META.map((category) => [category.key, { ...category, total: 0, correct: 0, points: 0 }])
  );

  let totalPoints = 0;
  let totalPicks = 0;
  let totalCorrect = 0;
  let latestGeneratedAt = null;
  const providers = new Set();
  const raceSummaries = new Map();

  for (const row of [...latestRowsByCategoryRace.values()].sort((a, b) => (a.race_round || 0) - (b.race_round || 0))) {
    const round = Number(row?.race_round || 0);
    const categoryKey = String(row?.category_key || "");
    const result = resultsByRound.get(round);
    const category = categories.get(categoryKey);
    if (!result || !category) continue;
    if (row?.provider) providers.add(String(row.provider));

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
    mode:            [...providers].some((provider) => provider.includes("replay")) ? "replay" : "live",
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

  const historyStatusLabel  = comparisonAvailable ? (aiHistory?.mode === "replay" ? "Replay history" : "AI history") : "No AI history";
  const historyStatusDetail = comparisonAvailable
    ? `${aiHistory.scoredRounds} race${aiHistory.scoredRounds === 1 ? "" : "s"} loaded`
    : "No stored races yet";
  const comparisonSummary   = comparisonAvailable
    ? `${comparisonWins.length}/${comparisonRows.length} tracked categories are ahead of stored AI picks.`
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

function StatTile({ label, value, detail, color, isMobile, size = "md" }) {
  const rgba22 = rgbaFromHex(color, 0.22);
  const rgba07 = rgbaFromHex(color, 0.07);
  const isHero = size === "hero";
  return (
    <div className="p-stat-tile" style={{
      borderRadius: 14,
      border:       `1px solid ${rgba22}`,
      background:   rgba07,
      padding:      isHero ? "16px 16px 14px" : "14px 14px 12px",
      position:     "relative",
      overflow:     "hidden",
      transition:   "transform 200ms cubic-bezier(0.23,1,0.32,1), border-color 200ms ease, background 200ms ease",
    }}>
      <div style={{
        fontSize:       10,
        fontWeight:     800,
        letterSpacing:  "0.1em",
        textTransform:  "uppercase",
        color:          SUBTLE_TEXT,
        overflow:       "hidden",
        textOverflow:   "ellipsis",
        whiteSpace:     "nowrap",
      }}>{label}</div>
      <div style={{
        fontFamily:         "var(--font-mono)",
        fontSize:           isHero ? (isMobile ? 32 : 40) : (isMobile ? 22 : 26),
        fontWeight:         700,
        letterSpacing:      "-0.04em",
        color,
        fontVariantNumeric: "tabular-nums",
        lineHeight:         1,
        marginTop:          isHero ? 10 : 8,
      }}>{value}</div>
      {detail && (
        <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: isHero ? 8 : 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {detail}
        </div>
      )}
      {/* Bottom accent hairline — timing-board signal */}
      <div aria-hidden="true" style={{
        position:   "absolute",
        left:       0,
        right:      0,
        bottom:     0,
        height:     2,
        background: `linear-gradient(90deg, ${color} 0%, ${rgbaFromHex(color, 0)} 100%)`,
        opacity:    0.55,
      }} />
    </div>
  );
}


function CoachPanel({ coach, breakdown, isPro, isMobile }) {
  const accuracy = breakdown?.accuracy ?? 0;
  const twoColumn = !isMobile;

  return (
    <div style={{
      borderRadius: 20,
      border:       `1px solid ${AI_BLUE_BORDER}`,
      background:   "rgba(9,17,30,0.90)",
      position:     "relative",
      overflow:     "hidden",
      padding:      isMobile ? "20px 18px 18px" : "26px 26px 22px",
    }}>
      {/* Blue-tinted depth wash — replaces a prior 7%-opacity insight texture
          that was effectively invisible once the overlay gradient layered on. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(96,165,250,0.08) 0%, transparent 55%)", pointerEvents: "none" }} />

      <div style={{
        position:             "relative",
        zIndex:               1,
        display:              "grid",
        gridTemplateColumns:  twoColumn ? "minmax(0,1fr) auto" : "1fr",
        gap:                  twoColumn ? 24 : 18,
        alignItems:           "center",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: AI_BLUE_SOFT, border: `1px solid ${AI_BLUE_BORDER}`, borderRadius: RADIUS_PILL, padding: "4px 10px" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: AI_BLUE }} />
              <Kicker color={AI_BLUE_TEXT}>AI Coach</Kicker>
            </div>
            {!isPro && breakdown?.scoredRounds >= 3 && (
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--brand)", background: rgbaFromHex(ACCENT, 0.10), border: `1px solid ${rgbaFromHex(ACCENT, 0.22)}`, borderRadius: 999, padding: "3px 9px" }}>Preview</span>
            )}
          </div>

          <div style={{
            fontSize:      isMobile ? 26 : 36,
            fontWeight:    900,
            letterSpacing: "-0.05em",
            lineHeight:    1.02,
            marginBottom:  10,
            color:         TEXT_PRIMARY,
          }}>{coach.archetype.label}</div>

          <p style={{ margin: 0, fontSize: 13, color: MUTED_TEXT, lineHeight: 1.7, maxWidth: "58ch" }}>
            {coach.archetype.description}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: TEXT_PRIMARY }}>{coach.verdict}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#bae6fd", background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.18)", borderRadius: 999, padding: "4px 9px" }}>{coach.confidence.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fdba74", background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.18)", borderRadius: 999, padding: "4px 9px" }}>{coach.trend.label}</span>
          </div>
        </div>

        {/* Season-accuracy read-out — visible on every breakpoint.
             Desktop: tall card on the right (stacked vertical rhythm).
             Mobile: horizontal strip under the archetype block so the number stays visible. */}
        {breakdown?.scoredRounds > 0 && (
          twoColumn ? (
            <div style={{
              flexShrink:   0,
              minWidth:     180,
              padding:      "18px 22px 16px",
              borderRadius: 16,
              background:   "var(--bg-elevated)",
              border:       "1px solid var(--border)",
              textAlign:    "right",
            }}>
              <Kicker color={AI_BLUE_TEXT} style={{ display: "block", marginBottom: 6 }}>Season accuracy</Kicker>
              <div style={{
                fontFamily:         "var(--font-mono)",
                fontSize:           56,
                fontWeight:         700,
                letterSpacing:      "-0.04em",
                color:              AI_BLUE,
                lineHeight:         1,
                fontVariantNumeric: "tabular-nums",
              }}>
                {accuracy}<span style={{ fontSize: "0.5em", color: AI_BLUE_TEXT, marginLeft: 2 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
                {breakdown.totalCorrect}/{breakdown.totalPicks} hits · {breakdown.scoredRounds} rounds
              </div>
            </div>
          ) : (
            <div style={{
              display:      "flex",
              alignItems:   "center",
              gap:          12,
              padding:      "12px 14px",
              borderRadius: 14,
              background:   "var(--bg-elevated)",
              border:       "1px solid var(--border)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Kicker color={AI_BLUE_TEXT} style={{ display: "block", marginBottom: 4 }}>Season accuracy</Kicker>
                <div style={{ fontSize: 11, color: MUTED_TEXT, fontVariantNumeric: "tabular-nums" }}>
                  {breakdown.totalCorrect}/{breakdown.totalPicks} hits · {breakdown.scoredRounds} rounds
                </div>
              </div>
              <div style={{
                fontSize:           36,
                fontWeight:         900,
                letterSpacing:      "-0.05em",
                color:              AI_BLUE,
                lineHeight:         1,
                fontVariantNumeric: "tabular-nums",
                flexShrink:         0,
              }}>
                {accuracy}<span style={{ fontSize: "0.5em", color: AI_BLUE_TEXT, marginLeft: 2 }}>%</span>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function CoachMoveCards({ coach, isPro, isMobile, onUnlock }) {
  const items = [
    { label: "Protect",   value: coach.protectCategory?.shortLabel   || "Best edge", detail: coach.protectCategory   ? `${coach.protectCategory.accuracy}% accuracy · ${coach.protectCategory.points} pts` : "Your best edge will appear here.", color: "#f97316" },
    { label: "Challenge", value: coach.challengeCategory?.shortLabel || "Main leak", detail: coach.challengeCategory ? `${coach.challengeCategory.accuracy}% accuracy · ${coach.challengeCategory.points} pts` : "The model does not see a weak spot yet.", color: "#fbbf24" },
    { label: "Next move", value: coach.nextMoveTitle, detail: coach.nextMoveDetail, color: "#7dd3fc" },
  ];

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 10 }}>
        {items.map((item, idx) => {
          const locked = !isPro && idx > 0;
          return (
            <div key={item.label} style={{ position: "relative" }}>
              <div style={{
                borderRadius: 14,
                border:       "1px solid rgba(148,163,184,0.10)",
                background:   "var(--btn-secondary-bg)",
                padding:      "14px 14px 13px",
                filter:       locked ? "blur(6px)" : "none",
                opacity:      locked ? 0.5 : 1,
                userSelect:   locked ? "none" : "auto",
                pointerEvents: locked ? "none" : "auto",
              }}>
                <Kicker color={item.color} style={{ marginBottom: 7, display: "block" }}>{item.label}</Kicker>
                <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, marginBottom: 5 }}>{item.value}</div>
                <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.55 }}>{item.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {!isPro && (
        <div style={{
          position:  "absolute",
          right:     isMobile ? 12 : 16,
          bottom:    isMobile ? 12 : 16,
          display:   "flex",
          alignItems: "center",
          gap:        10,
          background: "var(--bg-surface)",
          border:     `1px solid ${rgbaFromHex(ACCENT, 0.38)}`,
          borderRadius: RADIUS_PILL,
          padding:    "9px 14px 9px 12px",
          boxShadow:  "0 18px 40px rgba(0,0,0,0.45)",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: "-0.01em" }}>Unlock the full read</span>
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
              padding:       "7px 14px",
              letterSpacing: "-0.01em",
              fontFamily:    "inherit",
            }}
          >Unlock Pro</button>
        </div>
      )}
    </div>
  );
}

function CategoryStrengthsStrip({ categories }) {
  const top = (categories || []).filter((c) => c.total >= 1).slice(0, 3);
  if (!top.length) return null;
  return (
    <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em" }}>Category strengths</div>
        <Kicker>Top 3 by points</Kicker>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {top.map((category) => (
          <div key={category.key}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{category.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>{category.accuracy}%</span>
                <span style={{ fontSize: 12, color: SUBTLE_TEXT, minWidth: 40, textAlign: "right" }}>{category.points} pts</span>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: "rgba(148,163,184,0.10)" }}>
              <div style={{ width: `${category.accuracy}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${ACCENT}, #fbbf24)` }} />
            </div>
          </div>
        ))}
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

function RecentFormStrip({ races, isMobile }) {
  if (!races?.length) return null;
  return (
    <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: "16px 18px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em" }}>Recent form</div>
        <Kicker>Last {races.length}</Kicker>
      </div>
      <ScoreBarChart races={races} isMobile={isMobile} height={isMobile ? 90 : 110} />
    </div>
  );
}

function BestWeekendCard({ bestRace }) {
  if (!bestRace) return null;
  return (
    <div style={{
      borderRadius: 16,
      border:       "1px solid rgba(250,204,21,0.22)",
      background:   "linear-gradient(135deg, rgba(250,204,21,0.06), rgba(14,25,41,0.98))",
      padding:      "16px 18px 14px",
      overflow:     "hidden",
      position:     "relative",
    }}>
      <Kicker color="#fbbf24" style={{ display: "block", marginBottom: 8 }}>Best weekend</Kicker>
      <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 4 }}>{bestRace.raceName}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-pro)", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{bestRace.score} pts</div>
      <div style={{ fontSize: 12, color: MUTED_TEXT }}>{bestRace.correct}/{bestRace.total} hits · {bestRace.accuracy}% accuracy</div>
    </div>
  );
}

function UpgradeStrip({ headline, body }) {
  return (
    <div style={{
      borderRadius: 16,
      border:       "1px solid rgba(255,106,26,0.22)",
      background:   "linear-gradient(135deg, rgba(255,106,26,0.10), rgba(14,25,41,0.98))",
      padding:      "16px 18px",
      display:      "flex",
      justifyContent: "space-between",
      alignItems:     "center",
      gap:           16,
      flexWrap:      "wrap",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 3 }}>{headline}</div>
        <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.55 }}>{body}</div>
      </div>
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
          fontSize:       13,
          fontWeight:     800,
          letterSpacing:  "-0.01em",
          padding:        "9px 16px",
          textDecoration: "none",
          flexShrink:     0,
          whiteSpace:     "nowrap",
        }}
      >
        Unlock Pro
        <span style={{ fontSize: 12 }}>→</span>
      </a>
    </div>
  );
}

// ─── History drill-down ───────────────────────────────────────────────────────

function HistoryRaceRow({ prediction, race, result, isBestRace, isScored, isExpanded, onToggle, drillDown, isMobile }) {
  const pickCount = prediction.picks ? Object.values(prediction.picks).filter(Boolean).length : 0;
  const hitsCount = isScored ? drillDown.filter((row) => row.hit).length : 0;
  const accuracy = isScored && pickCount ? Math.round((hitsCount / pickCount) * 100) : null;
  const roundStr = String(prediction.race_round).padStart(2, "0");

  return (
    <div style={{
      borderRadius: 16,
      border:       isBestRace ? "1px solid rgba(251,191,36,0.28)" : PANEL_BORDER,
      background:   isBestRace ? "linear-gradient(135deg, rgba(251,191,36,0.05), rgba(14,25,41,0.98))" : PANEL_BG,
      overflow:     "hidden",
    }}>
      <button
        onClick={isScored ? onToggle : undefined}
        aria-expanded={isExpanded}
        disabled={!isScored}
        className="p-history-row"
        style={{
          display:              "grid",
          gridTemplateColumns:  "48px minmax(0,1fr) auto",
          gap:                  12,
          alignItems:           "center",
          padding:              "14px 16px",
          width:                "100%",
          background:           "transparent",
          border:               "none",
          color:                TEXT_PRIMARY,
          cursor:               isScored ? "pointer" : "default",
          fontFamily:           "inherit",
          textAlign:            "left",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
          <Kicker style={{ fontSize: 9 }}>R</Kicker>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.04em", color: MUTED_TEXT, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{roundStr}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em" }}>{race?.n || `Round ${prediction.race_round}`}</span>
            {isBestRace && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fbbf24", background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)", borderRadius: RADIUS_PILL, padding: "2px 6px" }}>Best</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: MUTED_TEXT, marginTop: 3 }}>
            {pickCount} pick{pickCount !== 1 ? "s" : ""}{accuracy !== null ? ` · ${accuracy}% accuracy` : ""}{!isScored ? " · awaiting results" : ""}
          </div>

          {/* Inline category hit/miss strip — persistent visual summary, no expansion required. */}
          {isScored && drillDown.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 3 : 4, marginTop: 8, flexWrap: "wrap" }}>
              {drillDown.map((row) => (
                <span
                  key={row.key}
                  title={`${row.label}: ${row.hit ? `hit · +${row.pts}` : `missed · ${row.pick}`}`}
                  style={{
                    width:        isMobile ? 6 : 8,
                    height:       isMobile ? 6 : 8,
                    borderRadius: 2,
                    background:   row.hit ? "#4ade80" : "rgba(239,68,68,0.38)",
                    boxShadow:    row.hit ? "0 0 6px rgba(74,222,128,0.35)" : "none",
                    flexShrink:   0,
                  }}
                />
              ))}
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: SUBTLE_TEXT, fontVariantNumeric: "tabular-nums" }}>
                {drillDown.filter((r) => r.hit).length}/{drillDown.length}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontSize:          isMobile ? 22 : 24,
              fontWeight:        900,
              letterSpacing:     "-0.04em",
              color:             isBestRace ? "#fbbf24" : isScored ? "#99f6e4" : SUBTLE_TEXT,
              fontVariantNumeric: "tabular-nums",
              lineHeight:        1,
            }}>{isScored ? prediction.score : "—"}</div>
            {isScored && <div style={{ fontSize: 10, color: SUBTLE_TEXT, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>pts</div>}
          </div>
          {isScored && (
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                flexShrink: 0,
                color:      MUTED_TEXT,
                transform:  isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 220ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

function InsightCard({ label, raceName, date, content, typeColor = ACCENT }) {
  const paragraphs = String(content || "").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return (
    <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: typeColor, flexShrink: 0 }} />
          <Kicker color={typeColor}>{label}</Kicker>
          {raceName && <span style={{ fontSize: 10, color: MUTED_TEXT }}>· {raceName}</span>}
        </div>
        {date && <span style={{ fontSize: 11, color: SUBTLE_TEXT }}>{date}</span>}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {(paragraphs.length ? paragraphs : [String(content || "")]).map((paragraph, index) => {
          const isHeading = /^[A-Z][A-Z\s]+$/.test(paragraph) && paragraph.length < 32;
          if (isHeading) {
            return (
              <Kicker key={`h${index}`} color={typeColor} style={{ display: "block", marginTop: index === 0 ? 0 : 4 }}>{paragraph}</Kicker>
            );
          }
          return (
            <p key={`p${index}`} style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "rgba(214,223,239,0.85)", whiteSpace: "pre-line" }}>
              {paragraph}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function PrimaryInsightCard({ insight, coach, isMobile, isTablet }) {
  if (!insight) return null;
  const label = insightTypeLabel(insight.insight_type);
  const typeColor = insight.insight_type === "monthly" ? ACCENT : "#7dd3fc";
  const blocks = String(insight.content || "").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <div style={{
      borderRadius: 20,
      border:       `1px solid ${AI_BLUE_BORDER}`,
      background:   "rgba(9,17,30,0.92)",
      position:     "relative",
      overflow:     "hidden",
      padding:      isMobile ? "18px 16px" : "22px 22px 24px",
    }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(96,165,250,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, letterSpacing: "-0.04em", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 13, color: MUTED_TEXT }}>
            {insight.generated_at
              ? new Date(insight.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "Just now"}
            {insight.race_name ? ` · ${insight.race_name}` : ""}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0,1fr) 220px", gap: 18 }}>
          <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
            {blocks.map((block, index) => {
              const isHeading = /^[A-Z][A-Z\s]+$/.test(block) && block.length < 32;
              if (isHeading) {
                return (
                  <div key={`h${index}`} style={{ paddingTop: index === 0 ? 0 : 4 }}>
                    <Kicker color={typeColor} style={{ display: "block", marginBottom: 6 }}>{block}</Kicker>
                  </div>
                );
              }
              return (
                <p key={`p${index}`} style={{ margin: 0, fontSize: 15, lineHeight: 1.78, color: "rgba(214,223,239,0.88)", maxWidth: "62ch" }}>
                  {block}
                </p>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: 10, alignSelf: "start" }}>
            {[
              { label: "Confidence", value: coach.confidence.label, detail: coach.confidence.detail, accent: "#7dd3fc" },
              { label: "Best edge",  value: coach.protectCategory?.shortLabel || "Still forming", detail: coach.protectCategory ? `${coach.protectCategory.accuracy}% accuracy · ${coach.protectCategory.points} pts` : "The model needs more data.", accent: "#fdba74" },
              { label: "Next move",  value: coach.nextMoveTitle, detail: coach.nextMoveDetail, accent: "#fbbf24" },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.10)", background: "rgba(8,14,26,0.82)", padding: "13px 13px 12px" }}>
                <Kicker color={item.accent} style={{ display: "block", marginBottom: 7 }}>{item.label}</Kicker>
                <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, marginBottom: 5 }}>{item.value}</div>
                <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.55 }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
                {coach.historyStatusDetail} · {coach.comparisonSummary}
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

function AccountSection({ title, description, children, action, tone = "neutral" }) {
  const borderTone = tone === "danger" ? "1px solid rgba(239,68,68,0.22)" : PANEL_BORDER;
  return (
    <section style={{
      borderRadius: 18,
      border:       borderTone,
      background:   PANEL_BG,
      overflow:     "hidden",
    }}>
      <header style={{
        padding:      "14px 18px",
        borderBottom: `1px solid ${HAIRLINE}`,
        display:      "flex",
        justifyContent: "space-between",
        alignItems:    "flex-start",
        gap:           12,
        flexWrap:      "wrap",
      }}>
        <div style={{ minWidth: 0 }}>
          <div className="stint-label" style={{ fontSize: 14 }}>{title}</div>
          {description && <div className="stint-body" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.55 }}>{description}</div>}
        </div>
        {action}
      </header>
      <div style={{ padding: "16px 18px 18px" }}>{children}</div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage({ user, setUser, setPage }) {
  const { isMobile, isTablet } = useViewport();

  // State
  const [profileTab, setProfileTab]           = useState(() => {
    if (typeof window === "undefined") return "overview";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((tab) => tab.key === requested) ? requested : "overview";
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
      supabase.from("ai_race_predictions").select("race_round,race_name,category_key,predicted_value,generated_at,provider").order("race_round", { ascending: true }),
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

      @media (prefers-reduced-motion: reduce) {
        .profile-hero, .p-tab-content, .p-avatar-credential { animation: none !important; opacity: 1 !important; transform: none !important; }
        .p-team-btn, .p-action-btn, .p-unlock-link, .p-tab-btn, .p-history-row, .p-account-link, .p-toggle, .p-stat-tile { transition: none !important; }
        .profile-hero:hover .p-avatar-credential { transform: none !important; }
        ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
      }
    `}</style>

    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "0 0 72px" : "0 0 80px" }}>

      {/* ─── Persistent hero — canonical PageMasthead with identityRow slot ─── */}
      <PageMasthead
        variant="full"
        marginBottom={16}
        image={{ src: "/images/Hero-Main.png", position: "right-mask" }}
        tone="ambient"
        style={{ padding: isMobile ? "20px 18px 18px" : "24px 28px 22px" }}
        identityRow={(
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 14 : 20, marginBottom: 20 }}>
            <IdentityAvatar
              className="p-avatar-credential"
              username={user.username}
              colorKey={pendingColor || user.avatar_color || DEFAULT_AVATAR_COLOR}
              size={isMobile ? 72 : 88}
              pro={isPro}
            />

            <div style={{ flex: 1, minWidth: 0, paddingTop: 2, overflow: "hidden" }}>
              {editing ? (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input
                      style={{
                        background:    PANEL_BG_ALT,
                        border:        "1px solid rgba(148,163,184,0.18)",
                        borderRadius:  12,
                        color:         TEXT_PRIMARY,
                        padding:       "7px 12px",
                        fontSize:      isMobile ? 20 : 24,
                        fontWeight:    900,
                        letterSpacing: "-0.04em",
                        outline:       "none",
                        fontFamily:    "inherit",
                        minWidth:      0,
                        maxWidth:      "100%",
                        width:         isMobile ? "100%" : 260,
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
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4, minWidth: 0 }}>
                  <h1 className="stint-section-title" style={{
                    margin:        0,
                    fontSize:      isMobile ? 22 : 30,
                    letterSpacing: "-0.045em",
                    lineHeight:    1.08,
                    minWidth:      0,
                    overflow:      "hidden",
                    textOverflow:  "ellipsis",
                    whiteSpace:    "nowrap",
                    maxWidth:      "100%",
                    wordBreak:     "break-word",
                  }}>
                    {user.username}
                  </h1>
                  <ProBadge subscriptionStatus={user.subscription_status} />
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: coachEligible ? 8 : 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: profileTheme.accent || ACCENT, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: MUTED_TEXT, fontWeight: 600 }}>{selectedTeamLabel}</span>
              </div>

              {/* Archetype pill — now available to any user with 3+ scored rounds, Pro or free */}
              {coachEligible && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: AI_BLUE_SOFT, border: `1px solid ${AI_BLUE_BORDER}`, borderRadius: RADIUS_PILL, padding: "3px 10px", marginBottom: 12 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: AI_BLUE, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: AI_BLUE_TEXT, letterSpacing: "-0.01em" }}>
                    {aiCoach.archetype.label} · {aiCoach.trend.label}
                  </span>
                </div>
              )}

              {scheduledToCancel && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: PRO_AMBER_BG, border: `1px solid ${PRO_AMBER_BORDER}`, borderRadius: 999, padding: "6px 12px", marginBottom: 12, maxWidth: "100%" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRO_AMBER_DOT, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: PRO_AMBER_TEXT, letterSpacing: "-0.01em" }}>
                    Pro ends {subscriptionEndsLabel ? `on ${subscriptionEndsLabel}` : "at the end of your billing period"}
                  </span>
                </div>
              )}

              {editing ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={saveProfile} disabled={saving} className="p-action-btn" style={{ background: SUCCESS_BG, border: `1px solid ${SUCCESS_BORDER}`, borderRadius: RADIUS_PILL, color: SUCCESS_TEXT, cursor: saving ? "default" : "pointer", fontWeight: 800, fontSize: 13, padding: "8px 16px", fontFamily: "inherit" }}>
                    {saving ? "Saving..." : "Save name"}
                  </button>
                  <button onClick={cancelEditing} className="p-action-btn" style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.16)", borderRadius: RADIUS_PILL, color: MUTED_TEXT, cursor: "pointer", fontWeight: 700, fontSize: 13, padding: "8px 14px", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => { setEditing(true); setError(""); setNote(""); }}
                    className="p-action-btn"
                    style={{
                      background:    "transparent",
                      border:        "1px solid rgba(148,163,184,0.18)",
                      borderRadius:  RADIUS_PILL,
                      color:         MUTED_TEXT,
                      cursor:        "pointer",
                      fontWeight:    700,
                      fontSize:      12,
                      padding:       "6px 13px",
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
                      color:         SUBTLE_TEXT,
                      cursor:        "pointer",
                      fontWeight:    600,
                      fontSize:      12,
                      padding:       0,
                      fontFamily:    "inherit",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    Account settings →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      >
        {(error || note) && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {error && <div style={{ padding: "10px 12px", borderRadius: 10, background: ERROR_BG, border: `1px solid ${ERROR_BORDER}`, color: ERROR_TEXT, fontSize: 12, lineHeight: 1.6 }}>{error}</div>}
            {note  && <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "var(--text-note)", fontSize: 12, lineHeight: 1.6 }}>{note}</div>}
          </div>
        )}

        {/* Stat tiles — Total Points leads, 3 supporting tiles ride alongside.
             Desktop: 1.35fr 1fr 1fr 1fr. Mobile: Total Points spans two columns on top row. */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "1.35fr 1fr 1fr 1fr",
          gap:                 10,
        }}>
          <div style={{ gridColumn: isMobile ? "span 2" : "auto" }}>
            <StatTile label={heroStat.label} value={heroStat.value} detail={heroStat.detail} color={heroStat.color} isMobile={isMobile} size="hero" />
          </div>
          {supportingStats.map((card) => (
            <StatTile key={card.label} label={card.label} value={card.value} detail={card.detail} color={card.color} isMobile={isMobile} />
          ))}
        </div>
      </PageMasthead>

      {/* ─── Tab bar ─────────────────────────────────────────────────────────
           The active tab carries a shared view-transition-name so the orange fill morphs
           between tabs as a single element rather than snapping. */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", position: "relative" }}>
        {TABS.map(({ key, label }) => {
          const active = profileTab === key;
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`p-tab-btn${active ? " is-active" : ""}`}
              style={{
                background:         active ? rgbaFromHex(ACCENT, 0.13) : "transparent",
                border:             active ? `1px solid ${rgbaFromHex(ACCENT, 0.30)}` : "1px solid rgba(148,163,184,0.14)",
                borderRadius:       RADIUS_PILL,
                color:              active ? ACCENT : MUTED_TEXT,
                cursor:             "pointer",
                fontWeight:         700,
                fontSize:           13,
                padding:            isMobile ? "11px 18px" : "9px 16px",
                minHeight:          isMobile ? 44 : 36,
                fontFamily:         "inherit",
                viewTransitionName: active ? "profile-active-tab" : undefined,
              }}
            >
              {label}
              {key === "insights" && !isPro && (
                <span style={{ fontSize: 9, fontWeight: 800, color: "var(--brand)", background: "rgba(255,106,26,0.12)", borderRadius: 999, padding: "2px 5px", marginLeft: 6, letterSpacing: "0.06em" }}>PRO</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Overview tab ─────────────────────────────────────────────────── */}
      {profileTab === "overview" && (
        <div className="p-tab-content">
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: MUTED_TEXT, fontSize: 13 }}>Loading…</div>
          ) : seasonBreakdown.scoredRounds === 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: isMobile ? "36px 22px" : "48px 32px", textAlign: "center" }}>
                <Kicker color={ACCENT} style={{ display: "block", marginBottom: 10 }}>Season hasn't started for you yet</Kicker>
                <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, letterSpacing: "-0.04em", marginBottom: 8 }}>
                  {upcomingRace ? `Your first race is ${upcomingRace.n}` : "Your season opens with your first picks"}
                </div>
                <div style={{ fontSize: 13, color: MUTED_TEXT, maxWidth: 440, margin: "0 auto 18px", lineHeight: 1.7 }}>
                  Your form, category strengths, and Coach read appear here after your first scored round.
                </div>
                <button
                  onClick={() => navTo("predictions", upcomingRace?.r)}
                  className="p-action-btn"
                  style={{ background: BRAND_GRADIENT, border: "none", borderRadius: RADIUS_PILL, color: "#fff", cursor: "pointer", fontWeight: 900, fontSize: 13, padding: "11px 22px", letterSpacing: "-0.01em", boxShadow: "0 4px 16px rgba(255,106,26,0.30)", fontFamily: "inherit" }}
                >
                  Make your picks
                </button>
              </div>
              {!isPro && (
                <UpgradeStrip
                  headline="Unlock the AI Coach and full insights"
                  body="Protect/Challenge/Next-move, written debriefs, and category depth from $4/mo."
                />
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <CoachPanel coach={aiCoach} breakdown={seasonBreakdown} isPro={isPro} isMobile={isMobile} />
              <CoachMoveCards coach={aiCoach} isPro={isPro} isMobile={isMobile} onUnlock={() => navTo("pro")} />
              <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0,1.2fr) minmax(280px,0.9fr)", gap: 12 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <CategoryStrengthsStrip categories={seasonBreakdown.categories} />
                  <RecentFormStrip races={seasonBreakdown.recentForm} isMobile={isMobile} />
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  <BestWeekendCard bestRace={seasonBreakdown.bestRace} />
                  {!isPro && (
                    <UpgradeStrip
                      headline="Unlock the full Coach read"
                      body="Protect, Challenge, and Next-move in full — plus category-level AI vs You comparison and written reports."
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── History tab ──────────────────────────────────────────────────── */}
      {profileTab === "history" && (
        <div className="p-tab-content">
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: MUTED_TEXT, fontSize: 13 }}>Loading…</div>
          ) : predictions.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>No picks yet</div>
              <div style={{ fontSize: 13, color: MUTED_TEXT }}>Make your first picks to start building your history.</div>
            </div>
          ) : (
            <>
              {seasonBreakdown.scoredRounds > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Season points", value: String(seasonBreakdown.totalPoints),                                     color: "#f97316", detail: `Avg ${seasonBreakdown.averageScore}/weekend` },
                    { label: "Accuracy",      value: `${seasonBreakdown.accuracy}%`,                                          color: "#7dd3fc", detail: `${seasonBreakdown.totalCorrect}/${seasonBreakdown.totalPicks} hits` },
                    { label: "Races scored",  value: `${seasonBreakdown.scoredRounds} / ${ACTIVE_RACE_COUNT}`,                 color: "#99f6e4", detail: "Of active calendar" },
                    { label: "Best weekend",  value: seasonBreakdown.bestRace ? `${seasonBreakdown.bestRace.score} pts` : "—", color: "#fbbf24", detail: seasonBreakdown.bestRace?.raceName || "—" },
                  ].map((metric) => (
                    <StatTile key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} color={metric.color} isMobile={isMobile} />
                  ))}
                </div>
              )}

              {seasonBreakdown.scoredRounds >= 2 && (() => {
                const trendLabel = seasonBreakdown.trendDelta >= 5 ? "Trending up" : seasonBreakdown.trendDelta <= -5 ? "Cooling off" : "Stable form";
                const trendColor = seasonBreakdown.trendDelta >= 5 ? "#4ade80" : seasonBreakdown.trendDelta <= -5 ? "#93c5fd" : "#fdba74";
                const allScored = [...predictions]
                  .filter(isScoredPrediction)
                  .map((p) => ({ round: Number(p.race_round || 0), score: Number(p.score || 0) }));
                const avg = Math.round(allScored.reduce((s, r) => s + r.score, 0) / Math.max(1, allScored.length));
                return (
                  <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: "16px 18px 14px", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em" }}>Season arc</div>
                        <Kicker>{allScored.length} scored</Kicker>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: SUBTLE_TEXT }}>Avg</span>
                        <span style={{ fontSize: 13, fontWeight: 900, color: "#fdba74", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{avg}</span>
                        <span style={{ fontSize: 11, color: SUBTLE_TEXT }}>· L5</span>
                        <span style={{ fontSize: 13, fontWeight: 900, color: trendColor, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{seasonBreakdown.recentAverage}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: trendColor, background: rgbaFromHex(trendColor, 0.10), border: `1px solid ${rgbaFromHex(trendColor, 0.22)}`, borderRadius: 999, padding: "3px 9px" }}>{trendLabel}</span>
                        {seasonBreakdown.currentStreak >= 2 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 999, padding: "3px 9px" }}>
                            {seasonBreakdown.currentStreak}-pick streak
                          </span>
                        )}
                      </div>
                    </div>
                    <ScoreBarChart races={allScored} isMobile={isMobile} height={isMobile ? 100 : 120} />
                    <div style={{ fontSize: 11, color: SUBTLE_TEXT, marginTop: 10, textAlign: "center" }}>
                      Tap any race below for the category-by-category breakdown.
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: "grid", gap: 8 }}>
                {[...predictions].reverse().map((prediction) => {
                  const race       = CAL.find((item) => item.r === prediction.race_round);
                  const result     = resultsByRound.get(Number(prediction.race_round));
                  const scored     = isScoredPrediction(prediction);
                  const drillDown  = scored ? describeRaceDrillDown(prediction, result) : [];
                  const isBestRace = scored && seasonBreakdown.bestRace != null && prediction.score === seasonBreakdown.bestRace.score && prediction.race_round === seasonBreakdown.bestRace.round;

                  return (
                    <HistoryRaceRow
                      key={prediction.race_round}
                      prediction={prediction}
                      race={race}
                      result={result}
                      isBestRace={isBestRace}
                      isScored={scored}
                      isExpanded={expandedHistoryRound === prediction.race_round}
                      onToggle={() => setExpandedHistoryRound((current) => current === prediction.race_round ? null : prediction.race_round)}
                      drillDown={drillDown}
                      isMobile={isMobile}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Insights tab ─────────────────────────────────────────────────── */}
      {profileTab === "insights" && (
        <div className="p-tab-content">
          {!isPro ? (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{
                borderRadius: SECTION_RADIUS,
                border:       PANEL_BORDER,
                background:   PANEL_BG,
                position:     "relative",
                overflow:     "hidden",
                minHeight:    isMobile ? 200 : 260,
                display:      "flex",
                alignItems:   "flex-end",
              }}>
                <img
                  src="/images/header-insight.png"
                  alt=""
                  aria-hidden="true"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 35%", opacity: isMobile ? "var(--hero-image-opacity-mobile)" : "var(--hero-image-opacity)", filter: "var(--hero-image-filter)", pointerEvents: "none" }}
                  onError={(e) => { e.target.style.display = "none"; }}
                />
                <div style={{ position: "absolute", inset: 0, background: "var(--header-vignette)", pointerEvents: "none" }} />
                <div style={{ position: "relative", zIndex: 1, padding: isMobile ? "24px 18px" : "32px 28px", width: "100%" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: AI_BLUE_SOFT, border: `1px solid ${AI_BLUE_BORDER}`, borderRadius: RADIUS_PILL, padding: "4px 10px", marginBottom: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: AI_BLUE }} />
                    <Kicker color={AI_BLUE_TEXT}>AI Insights · Pro</Kicker>
                  </div>
                  <h2 className="stint-section-title" style={{ margin: "0 0 8px", fontSize: isMobile ? 26 : 34, letterSpacing: "-0.04em", lineHeight: 1.05, maxWidth: 540 }}>Your picks. Decoded.</h2>
                  <p style={{ margin: "0 0 16px", fontSize: 13, color: MUTED_TEXT, lineHeight: 1.65, maxWidth: 520 }}>
                    Post-race debriefs, pre-race strategy tips, and a running breakdown of where you keep winning and where you keep leaking points.
                  </p>
                  <a
                    href="/pro"
                    className="p-unlock-link"
                    style={{
                      display:        "inline-flex",
                      alignItems:     "center",
                      gap:            8,
                      background:     BRAND_GRADIENT,
                      border:         "none",
                      borderRadius:   RADIUS_PILL,
                      color:          "#fff",
                      fontSize:       13,
                      fontWeight:     900,
                      letterSpacing:  "-0.01em",
                      padding:        "10px 18px",
                      textDecoration: "none",
                      boxShadow:      "0 4px 20px rgba(255,106,26,0.28)",
                    }}
                  >
                    Unlock Stint Pro
                    <span style={{ fontSize: 12 }}>→</span>
                  </a>
                </div>
              </div>

              {/* Free-user coach preview — already rendered on Overview; hide here to avoid dupe */}

              {/* First sample fully visible; remaining two blurred via ProGate-style treatment */}
              <div style={{ display: "grid", gap: 12 }}>
                <InsightCard {...SAMPLE_INSIGHTS[0]} typeColor={AI_BLUE} />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "grid", gap: 12, filter: "blur(6px)", opacity: 0.45, pointerEvents: "none", userSelect: "none" }} aria-hidden="true">
                    {SAMPLE_INSIGHTS.slice(1).map((insight) => (
                      <InsightCard key={insight.label} {...insight} typeColor={AI_BLUE} />
                    ))}
                  </div>
                  <div style={{
                    position:       "absolute",
                    inset:          0,
                    display:        "flex",
                    flexDirection:  "column",
                    alignItems:     "center",
                    justifyContent: "center",
                    gap:            14,
                    padding:        24,
                    textAlign:      "center",
                    background:     "linear-gradient(180deg, rgba(6,16,27,0.08) 0%, rgba(6,16,27,0.82) 45%, rgba(6,16,27,0.96) 100%)",
                    borderRadius:   "inherit",
                  }}>
                    <div style={{ fontSize: 28 }}>🔒</div>
                    <div style={{ maxWidth: 360 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 6 }}>
                        Pre-race tips and season reports unlock with Pro
                      </div>
                      <div style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.6 }}>
                        One Race Debrief is visible above so you can see the tone. Upgrade to get every weekend's read.
                      </div>
                    </div>
                    <a href="/pro" className="p-unlock-link" style={{
                      display:        "inline-flex",
                      alignItems:     "center",
                      gap:            8,
                      background:     BRAND_GRADIENT,
                      border:         "none",
                      borderRadius:   RADIUS_PILL,
                      color:          "#fff",
                      fontSize:       13,
                      fontWeight:     900,
                      letterSpacing:  "-0.01em",
                      padding:        "11px 22px",
                      textDecoration: "none",
                      boxShadow:      "0 4px 20px rgba(255,106,26,0.32)",
                    }}>
                      Unlock Stint Pro
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {insightError && (
                <div style={{ padding: "12px 14px", borderRadius: 12, background: ERROR_BG, border: `1px solid ${ERROR_BORDER}`, color: ERROR_TEXT, fontSize: 12, lineHeight: 1.6 }}>{insightError}</div>
              )}
              {insightNote && (
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "#bae6fd", fontSize: 12, lineHeight: 1.6 }}>{insightNote}</div>
              )}

              <BreakdownPanel
                breakdown={seasonBreakdown}
                coach={aiCoach}
                history={aiHistory}
                isMobile={isMobile}
                isTablet={isTablet}
                onGenerate={generateInsight}
                generating={insightGenerating}
                hasInsights={visibleInsights.length > 0}
                aiLoadError={aiHistoryLoadError}
                aiMessage={aiHistoryMessage}
                isAdmin={isAdminUser(user)}
                onReplay={buildAiReplayHistoryAction}
                replayBusy={aiHistoryBusy}
              />

              {insightsLoading ? (
                <div style={{ padding: 40, textAlign: "center", color: MUTED_TEXT, fontSize: 13 }}>Loading insights…</div>
              ) : visibleInsights.length === 0 ? (
                <div style={{ padding: 36, textAlign: "center", borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>No reports yet</div>
                  <div style={{ fontSize: 13, color: MUTED_TEXT, maxWidth: 320, margin: "0 auto", lineHeight: 1.6 }}>
                    {seasonBreakdown.scoredRounds > 0 ? "Hit Generate report above for a written read on your season." : "Reports start after a scored round."}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <PrimaryInsightCard insight={featuredInsight} coach={aiCoach} isMobile={isMobile} isTablet={isTablet} />
                  {supportingInsights.length > 0 && (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.01em", color: MUTED_TEXT }}>Earlier reports</div>
                      {supportingInsights.map((insight) => (
                        <InsightCard
                          key={insight.id}
                          label={insightTypeLabel(insight.insight_type)}
                          raceName={insight.race_name}
                          date={insight.generated_at ? new Date(insight.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Just now"}
                          content={insight.content}
                          typeColor={insight.insight_type === "monthly" ? ACCENT : AI_BLUE}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Account tab ──────────────────────────────────────────────────── */}
      {profileTab === "account" && (
        <div className="p-tab-content" style={{ display: "grid", gap: 14 }}>

          {/* Identity */}
          <AccountSection
            title="Identity"
            description="Name, avatar team, and how other managers see you."
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>Username</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveProfile()}
                    placeholder="Your manager name"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{
                      background:   PANEL_BG_ALT,
                      border:       "1px solid rgba(148,163,184,0.18)",
                      borderRadius: RADIUS_MD,
                      color:        TEXT_PRIMARY,
                      padding:      isMobile ? "12px 14px" : "10px 12px",
                      fontSize:     16,
                      minHeight:    44,
                      fontFamily:   "inherit",
                      minWidth:     220,
                      flex:         "1 1 220px",
                      outline:      "none",
                    }}
                  />
                  <button onClick={saveProfile} disabled={saving} className="p-action-btn" style={{ background: rgbaFromHex(ACCENT, 0.13), border: `1px solid ${rgbaFromHex(ACCENT, 0.30)}`, borderRadius: RADIUS_PILL, color: "var(--brand)", cursor: saving ? "default" : "pointer", fontWeight: 800, fontSize: 13, padding: "10px 18px", fontFamily: "inherit" }}>
                    {saving ? "Saving…" : "Save name"}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Support team</label>
                <div style={{ fontSize: 12, color: MUTED_TEXT, marginBottom: 10, lineHeight: 1.55 }}>Sets your avatar colour and hero tint across the app.</div>
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
                          borderRadius: RADIUS_PILL,
                          border:       isActive ? `1px solid ${option.border}` : "1px solid rgba(148,163,184,0.14)",
                          background:   isActive ? option.bg : "transparent",
                          cursor:       supportSaving ? "default" : "pointer",
                          padding:      isMobile ? "9px 14px" : "7px 12px",
                          minHeight:    isMobile ? 44 : 32,
                          display:      "inline-flex",
                          alignItems:   "center",
                          gap:          8,
                          fontFamily:   "inherit",
                          opacity:      supportSaving && !isActive ? 0.6 : 1,
                        }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: option.fill, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? option.text : MUTED_TEXT }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </AccountSection>

          {/* Appearance — theme + density. Theme also has a header toggle;
              density is a power-user preference (audit Rec #09). */}
          <AccountSection
            title="Appearance"
            description="Pick how Stint looks and how dense rows render."
          >
            <div style={{ display: "grid", gap: 10 }}>
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
                        padding:        isMobile ? "11px 18px" : "9px 16px",
                        minHeight:      isMobile ? 44 : 36,
                        color:          active ? ACCENT : MUTED_TEXT,
                        fontWeight:     700,
                        fontSize:       13,
                        letterSpacing:  "-0.01em",
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
              <div style={{ fontSize: 11, color: SUBTLE_TEXT, lineHeight: 1.55 }}>
                System matches your device. The toggle in the header changes the same setting.
              </div>

              {/* Density */}
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
                marginTop:     6,
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
                        padding:        isMobile ? "11px 18px" : "9px 16px",
                        minHeight:      isMobile ? 44 : 36,
                        color:          active ? ACCENT : MUTED_TEXT,
                        fontWeight:     700,
                        fontSize:       13,
                        letterSpacing:  "-0.01em",
                        fontFamily:     "inherit",
                        cursor:         "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: SUBTLE_TEXT, lineHeight: 1.55 }}>
                Compact tightens row padding for power users on long lists.
              </div>
            </div>
          </AccountSection>

          {/* Subscription */}
          <AccountSection
            title="Subscription"
            description={isPro
              ? scheduledToCancel
                ? `Pro · scheduled to end ${subscriptionEndsLabel || "at the end of the current billing period"}.`
                : subscriptionEndsLabel
                  ? `Pro · renews ${subscriptionEndsLabel}.`
                  : "Pro · active."
              : "Free · upgrade to unlock Pro features and the Pro Community League."}
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
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, minmax(0,1fr))", gap: 10 }}>
                {(() => {
                  const statusLabel = isPro ? (scheduledToCancel ? "Ending" : "Active") : "Free";
                  const statusColor = isPro
                    ? (scheduledToCancel ? PRO_AMBER_DOT : LIVE_GREEN)
                    : SUBTLE_TEXT;
                  const statusTextColor = isPro
                    ? (scheduledToCancel ? PRO_AMBER_TEXT : SUCCESS_TEXT)
                    : TEXT_PRIMARY;
                  return (
                    <div style={{ borderRadius: RADIUS_MD, border: PANEL_BORDER, background: PANEL_BG_ALT, padding: "12px 14px" }}>
                      <Kicker style={{ display: "block", marginBottom: 4 }}>Status</Kicker>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: isPro && !scheduledToCancel ? LIVE_GREEN_GLOW : "none", flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 800, color: statusTextColor, letterSpacing: "-0.01em" }}>{statusLabel}</span>
                      </div>
                    </div>
                  );
                })()}
                <div style={{ borderRadius: RADIUS_MD, border: PANEL_BORDER, background: PANEL_BG_ALT, padding: "12px 14px" }}>
                  <Kicker style={{ display: "block", marginBottom: 4 }}>{scheduledToCancel ? "Access ends" : isPro ? "Renews" : "Upgrade"}</Kicker>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{subscriptionEndsLabel || (isPro ? "On subscription anniversary" : "From $4/mo")}</div>
                </div>
                {isPro && (
                  <div style={{ borderRadius: RADIUS_MD, border: PANEL_BORDER, background: PANEL_BG_ALT, padding: "12px 14px" }}>
                    <Kicker style={{ display: "block", marginBottom: 4 }}>Pro League rank</Kicker>
                    <div style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                      {proLeague.myRank
                        ? `#${proLeague.myRank}${proLeague.totalMembers ? ` of ${proLeague.totalMembers}` : ""}`
                        : proLeague.totalMembers
                          ? "Awaiting first scored pick"
                          : "Founding season"}
                    </div>
                  </div>
                )}
              </div>

              {scheduledToCancel && isPro && (
                <div style={{ padding: "10px 14px", borderRadius: RADIUS_MD, background: PRO_AMBER_BG, border: `1px solid ${PRO_AMBER_BORDER}`, color: PRO_AMBER_TEXT, fontSize: 12, lineHeight: 1.6 }}>
                  Your subscription is set to cancel. You keep full Pro access until the end of this billing period.
                </div>
              )}
            </div>
          </AccountSection>

          {/* Notifications */}
          <AccountSection
            title="Notifications"
            description="We're wiring these into the email system this season — your preferences are saved locally for now."
          >
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { key: "race_lock",   label: "Pick lock reminder",     hint: "Alert 60 minutes before qualifying locks picks." },
                { key: "results",     label: "Scoring ready",          hint: "When your weekend score is final and posted." },
                { key: "insights",    label: "AI insight ready",       hint: "When a fresh debrief or report lands in your Insights tab." },
                { key: "news_digest", label: "Weekly paddock digest",  hint: "Friday morning summary of the race week ahead." },
              ].map((pref) => {
                const on = !!notificationPrefs[pref.key];
                return (
                  <div key={pref.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: RADIUS_MD, border: PANEL_BORDER, background: PANEL_BG_ALT }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{pref.label}</div>
                      <div style={{ fontSize: 12, color: MUTED_TEXT, marginTop: 2, lineHeight: 1.55 }}>{pref.hint}</div>
                    </div>
                    <button
                      onClick={() => setNotificationPrefs((current) => ({ ...current, [pref.key]: !current[pref.key] }))}
                      aria-pressed={on}
                      className="p-toggle"
                      style={{
                        width:        isMobile ? 48 : 44,
                        height:       isMobile ? 28 : 24,
                        borderRadius: 999,
                        border:       `1px solid ${on ? rgbaFromHex(ACCENT, 0.45) : "rgba(148,163,184,0.24)"}`,
                        background:   on ? rgbaFromHex(ACCENT, 0.45) : "rgba(148,163,184,0.08)",
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
                        width:        isMobile ? 22 : 18,
                        height:       isMobile ? 22 : 18,
                        borderRadius: "50%",
                        background:   on ? "#fff" : "rgba(214,223,239,0.72)",
                        transition:   "left 180ms cubic-bezier(0.23,1,0.32,1)",
                      }} />
                    </button>
                  </div>
                );
              })}
              <div style={{ fontSize: 11, color: SUBTLE_TEXT, marginTop: 2 }}>
                Email dispatch is coming soon. Your toggles will activate automatically when it ships.
              </div>
            </div>
          </AccountSection>

          {/* Data */}
          <AccountSection
            title="Your data"
            description="Export what we've stored for you, or request removal."
          >
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: RADIUS_MD, border: PANEL_BORDER, background: PANEL_BG_ALT, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>Download your picks</div>
                  <div style={{ fontSize: 12, color: MUTED_TEXT, marginTop: 2, lineHeight: 1.55 }}>All your scored and pending picks as JSON.</div>
                </div>
                <button onClick={downloadPicks} disabled={!predictions.length} className="p-action-btn" style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.18)", borderRadius: RADIUS_PILL, color: MUTED_TEXT, cursor: predictions.length ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12, padding: "7px 13px", fontFamily: "inherit", opacity: predictions.length ? 1 : 0.5 }}>
                  {predictions.length ? "Download JSON" : "No picks yet"}
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: RADIUS_MD, border: PANEL_BORDER, background: PANEL_BG_ALT, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>Written reports archive</div>
                  <div style={{ fontSize: 12, color: MUTED_TEXT, marginTop: 2, lineHeight: 1.55 }}>Coming soon — a consolidated PDF of every AI debrief we've generated for you.</div>
                </div>
                <span style={{ fontSize: 11, color: SUBTLE_TEXT, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Soon</span>
              </div>
            </div>
          </AccountSection>

          {/* Sign out */}
          <AccountSection title="Session" description="Signed in as this browser and device.">
            <button
              onClick={handleSignOut}
              disabled={signOutBusy}
              className="p-action-btn"
              style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.18)", borderRadius: RADIUS_PILL, color: MUTED_TEXT, cursor: signOutBusy ? "wait" : "pointer", fontWeight: 700, fontSize: 13, padding: "9px 16px", fontFamily: "inherit" }}
            >
              {signOutBusy ? "Signing out…" : "Sign out"}
            </button>
          </AccountSection>

          {/* Danger zone */}
          <AccountSection
            title="Delete account"
            description="Removes your profile and all picks, insights, and league memberships. This cannot be undone."
            tone="danger"
          >
            {!deleteStaged ? (
              <button
                onClick={() => setDeleteStaged(true)}
                className="p-action-btn"
                style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.28)", borderRadius: RADIUS_PILL, color: "#fca5a5", cursor: "pointer", fontWeight: 800, fontSize: 13, padding: "9px 16px", fontFamily: "inherit" }}
              >
                I want to delete my account
              </button>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 13, color: "#fecaca", lineHeight: 1.6 }}>
                  Type <strong style={{ color: TEXT_PRIMARY }}>{user.username}</strong> to confirm. We'll send you to support with your identity pre-filled — an engineer will process the deletion within 24 hours.
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
                    border:       "1px solid rgba(239,68,68,0.28)",
                    borderRadius: RADIUS_MD,
                    color:        TEXT_PRIMARY,
                    padding:      isMobile ? "12px 14px" : "10px 12px",
                    fontSize:     16,
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
                    style={{ background: deleteTyped === user.username ? "rgba(239,68,68,0.22)" : "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.36)", borderRadius: RADIUS_PILL, color: "#fca5a5", cursor: deleteTyped === user.username ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 13, padding: "9px 16px", fontFamily: "inherit", opacity: deleteTyped === user.username ? 1 : 0.55 }}
                  >
                    Request deletion
                  </button>
                  <button
                    onClick={() => { setDeleteStaged(false); setDeleteTyped(""); }}
                    className="p-action-btn"
                    style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.18)", borderRadius: RADIUS_PILL, color: MUTED_TEXT, cursor: "pointer", fontWeight: 700, fontSize: 13, padding: "9px 16px", fontFamily: "inherit" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </AccountSection>

          <div style={{ textAlign: "center", fontSize: 11, color: SUBTLE_TEXT, padding: "4px 0 8px" }}>
            Stint · {user.id.slice(0, 8)} · <a href="mailto:support@stint-web.com" style={{ color: SUBTLE_TEXT, textDecoration: "underline" }}>support@stint-web.com</a>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
