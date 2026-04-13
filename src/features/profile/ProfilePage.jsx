import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { ACTIVE_RACE_COUNT, CAL } from "@/src/constants/calendar";
import { PTS } from "@/src/constants/scoring";
import { ACCENT, AVATAR_THEMES, BG_ELEVATED, CONTENT_MAX, DEFAULT_AVATAR_COLOR, PANEL_BG, PANEL_BG_ALT, PANEL_BORDER, MUTED_TEXT, SUBTLE_TEXT, TEAM_AVATAR_OPTIONS, avatarTheme, isAdminUser, teamSupportKey } from "@/src/constants/design";
import { backfillAiReplayHistory } from "@/src/features/admin/adminApi";
import { matchesDnfPick } from "@/src/lib/resultHelpers";
import { isUsernameTaken, sanitizeUsername } from "@/src/shell/authProfile";
import useViewport from "@/src/lib/useViewport";
import PageHeader from "@/src/ui/PageHeader";
import ProBadge from "@/src/ui/ProBadge";
import ProGate from "@/src/ui/ProGate";

const INSIGHT_CATEGORY_META = [
  { key: "winner", label: "Race Winner", shortLabel: "Winner" },
  { key: "pole", label: "Pole Position", shortLabel: "Pole" },
  { key: "p2", label: "2nd Place", shortLabel: "P2" },
  { key: "p3", label: "3rd Place", shortLabel: "P3" },
  { key: "dnf", label: "DNF Driver", shortLabel: "DNF" },
  { key: "fl", label: "Fastest Lap", shortLabel: "Fastest Lap" },
  { key: "dotd", label: "Driver of the Day", shortLabel: "Driver of the Day" },
  { key: "ctor", label: "Best Constructor", shortLabel: "Constructor" },
  { key: "sc", label: "Safety Car", shortLabel: "Safety Car" },
  { key: "rf", label: "Red Flag", shortLabel: "Red Flag" },
  { key: "sp_winner", label: "Sprint Winner", shortLabel: "Sprint Winner" },
  { key: "sp_pole", label: "Sprint Pole", shortLabel: "Sprint Pole" },
  { key: "sp_p2", label: "Sprint 2nd", shortLabel: "Sprint P2" },
  { key: "sp_p3", label: "Sprint 3rd", shortLabel: "Sprint P3" },
];

const FOUNDATION_KEYS = new Set(["winner", "pole", "ctor", "sp_winner", "sp_pole"]);
const PODIUM_KEYS = new Set(["p2", "p3", "sp_p2", "sp_p3"]);
const VOLATILITY_KEYS = new Set(["dnf", "fl", "dotd", "sc", "rf"]);

function isScoredPrediction(prediction) {
  return prediction?.score_breakdown !== null && prediction?.score_breakdown !== undefined;
}

function raceNameForRound(round) {
  return CAL.find((item) => item.r === round)?.n || `Round ${round}`;
}

async function parseJsonResponse(response, fallbackMessage) {
  const raw = await response.text();

  if (!raw) {
    if (!response.ok) {
      throw new Error(fallbackMessage);
    }
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(response.ok ? "Unexpected response from the server." : fallbackMessage);
  }
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

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
    const pointsByLabel = new Map(
      breakdown.map((item) => [item?.label, Number(item?.pts || 0)])
    );

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
      round: prediction?.race_round || 0,
      raceName: raceNameForRound(prediction?.race_round),
      score: raceScore,
      correct: raceCorrect,
      total: raceTotal,
      accuracy: raceTotal ? Math.round((raceCorrect / raceTotal) * 100) : 0,
    };

    totalPoints += raceScore;
    recentRaces.push(raceSummary);

    if (!bestRace || raceScore > bestRace.score) {
      bestRace = raceSummary;
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

  const eligibleCategories = rankedCategories.filter((category) => category.total >= 2);
  const strongestPool = eligibleCategories.length ? eligibleCategories : rankedCategories;
  const strongestCategory = strongestPool[0] || null;
  const weakestCategory = [...strongestPool]
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      if (a.points !== b.points) return a.points - b.points;
      return b.total - a.total;
    })[0] || null;

  const recentForm = [...recentRaces]
    .sort((a, b) => b.round - a.round)
    .slice(0, 5);

  const recentAverage = recentForm.length
    ? Math.round(recentForm.reduce((sum, race) => sum + race.score, 0) / recentForm.length)
    : 0;
  const averageScore = scoredPredictions.length ? Math.round(totalPoints / scoredPredictions.length) : 0;

  return {
    scoredRounds: scoredPredictions.length,
    totalPoints,
    totalPicks,
    totalCorrect,
    accuracy: totalPicks ? Math.round((totalCorrect / totalPicks) * 100) : 0,
    averageScore,
    recentAverage,
    trendDelta: recentAverage - averageScore,
    currentStreak,
    longestStreak,
    bestRace,
    strongestCategory,
    weakestCategory,
    categories: rankedCategories,
    recentForm,
  };
}

function didPredictionHit(categoryKey, pickedValue, results) {
  if (!results || !pickedValue) return false;

  switch (categoryKey) {
    case "pole":
      return pickedValue === results.pole;
    case "winner":
      return pickedValue === results.winner;
    case "p2":
      return pickedValue === results.p2;
    case "p3":
      return pickedValue === results.p3;
    case "dnf":
      return matchesDnfPick(pickedValue, results);
    case "fl":
      return pickedValue === results.fastest_lap;
    case "dotd":
      return pickedValue === results.dotd;
    case "ctor":
      return pickedValue === results.best_constructor;
    case "sc":
      return pickedValue === "Yes" && !!results.safety_car;
    case "rf":
      return pickedValue === "Yes" && !!results.red_flag;
    case "sp_pole":
      return pickedValue === results.sp_pole;
    case "sp_winner":
      return pickedValue === results.sp_winner;
    case "sp_p2":
      return pickedValue === results.sp_p2;
    case "sp_p3":
      return pickedValue === results.sp_p3;
    default:
      return false;
  }
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

    if (!existing || nextTime >= existingTime) {
      latestRowsByCategoryRace.set(dedupeKey, row);
    }
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
      score: 0,
      correct: 0,
      total: 0,
      accuracy: 0,
    };

    summary.total += 1;
    if (hit) {
      summary.correct += 1;
      summary.score += awardedPoints;
    }
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
    available: raceList.length > 0,
    mode: [...providers].some((provider) => provider.includes("replay")) ? "replay" : "live",
    scoredRounds: raceList.length,
    totalPoints,
    totalPicks,
    totalCorrect,
    accuracy: totalPicks ? Math.round((totalCorrect / totalPicks) * 100) : 0,
    averageScore: raceList.length ? Math.round(totalPoints / raceList.length) : 0,
    categories: rankedCategories,
    recentForm,
    bestRace,
    latestGeneratedAt,
  };
}

function buildAiCoach(breakdown, aiHistory) {
  const categoryRows = breakdown?.categories || [];
  const foundationAccuracy = average(categoryRows.filter((row) => FOUNDATION_KEYS.has(row.key)).map((row) => row.accuracy));
  const podiumAccuracy = average(categoryRows.filter((row) => PODIUM_KEYS.has(row.key)).map((row) => row.accuracy));
  const volatilityAccuracy = average(categoryRows.filter((row) => VOLATILITY_KEYS.has(row.key)).map((row) => row.accuracy));

  const archetypeCandidates = [
    {
      key: "front-runner",
      label: "Front-Runner Reader",
      score: foundationAccuracy,
      description: "Your edge shows up when the board runs through pole, winner, and constructor reads before the chaos categories kick in.",
    },
    {
      key: "podium",
      label: "Podium Sculptor",
      score: podiumAccuracy,
      description: "You separate from the room by finding value in the supporting podium slots instead of relying only on the obvious headline picks.",
    },
    {
      key: "chaos",
      label: "Chaos Hunter",
      score: volatilityAccuracy,
      description: "You create upside when weekends get messy and the swing categories start moving the board.",
    },
  ].filter((candidate) => candidate.score !== null);

  const archetype = archetypeCandidates.sort((a, b) => (b.score || 0) - (a.score || 0))[0] || {
    key: "balanced",
    label: "Balanced Board",
    score: breakdown?.accuracy ?? 0,
    description: "Your profile is still broad, so the AI sees more of an all-rounder than a single-category specialist right now.",
  };

  const confidence = breakdown?.scoredRounds >= 6 && breakdown?.totalPicks >= 45
    ? { label: "High confidence", detail: "Enough scored volume to trust the model read." }
    : breakdown?.scoredRounds >= 3 && breakdown?.totalPicks >= 24
      ? { label: "Building confidence", detail: "The model has a useful read, but more rounds will sharpen it." }
      : { label: "Early read", detail: "This is directional until more scored races come in." };

  const trend = breakdown?.trendDelta >= 5
    ? { label: "Heating up", detail: "Recent weekends are running above your season pace." }
    : breakdown?.trendDelta <= -5
      ? { label: "Cooling off", detail: "Recent form has dropped below your season baseline." }
      : { label: "Stable", detail: "Recent form is tracking close to your season baseline." };

  const aiCategoryMap = new Map((aiHistory?.categories || []).map((category) => [category.key, category]));
  const comparisonRows = categoryRows
    .map((category) => {
      const aiCategory = aiCategoryMap.get(category.key);
      if (!aiCategory) return null;

      return {
        ...category,
        aiAccuracy: aiCategory.accuracy,
        aiPoints: aiCategory.points,
        delta: category.accuracy - aiCategory.accuracy,
      };
    })
    .filter(Boolean);

  const comparisonWins = [...comparisonRows]
    .filter((row) => row.delta >= 0)
    .sort((a, b) => b.delta - a.delta);
  const comparisonLosses = [...comparisonRows]
    .filter((row) => row.delta < 0)
    .sort((a, b) => a.delta - b.delta);

  const comparisonAvailable = !!aiHistory?.available && comparisonRows.length > 0;
  const comparisonDelta = comparisonAvailable ? (breakdown?.accuracy || 0) - (aiHistory?.accuracy || 0) : null;

  const verdict = comparisonAvailable
    ? comparisonDelta >= 8
      ? "Outscoring stored AI picks"
      : comparisonDelta >= 2
        ? "Slightly ahead of stored AI picks"
        : comparisonDelta <= -8
          ? "Stored AI picks still have the edge"
          : "Running level with stored AI picks"
    : breakdown?.accuracy >= 60 && (breakdown?.trendDelta ?? 0) >= 0
      ? "Your read is getting sharper"
      : breakdown?.accuracy >= 50
        ? "Solid board, still early"
        : (breakdown?.trendDelta ?? 0) >= 5
          ? "Form is improving"
          : "Early pattern read";

  const historyStatusLabel = comparisonAvailable
    ? aiHistory?.mode === "replay"
      ? "Replay history"
      : "AI history"
    : "No AI history";
  const historyStatusDetail = comparisonAvailable
    ? aiHistory?.mode === "replay"
      ? `${aiHistory.scoredRounds} race${aiHistory.scoredRounds === 1 ? "" : "s"} loaded`
      : `${aiHistory.scoredRounds} race${aiHistory.scoredRounds === 1 ? "" : "s"} loaded`
    : "No stored races yet";
  const comparisonSummary = comparisonAvailable
    ? `${comparisonWins.length}/${comparisonRows.length} tracked categories are ahead of stored AI picks.`
    : "No stored AI history yet.";

  let nextMoveTitle = "Protect the floor";
  let nextMoveDetail = `Keep leaning on ${breakdown?.strongestCategory?.shortLabel || "your strongest reads"} while tightening ${breakdown?.weakestCategory?.shortLabel || "your weakest category"} so the board stops leaking easy points.`;

  if (comparisonAvailable && (comparisonDelta ?? 0) >= 5 && (breakdown?.trendDelta ?? 0) >= 0) {
    nextMoveTitle = "Press the edge";
    nextMoveDetail = `The coach would keep trusting ${breakdown?.strongestCategory?.shortLabel || "your strongest category"} and only make one deliberate upgrade in ${breakdown?.weakestCategory?.shortLabel || "your weakest spot"} instead of changing everything at once.`;
  } else if ((foundationAccuracy ?? 0) < 40) {
    nextMoveTitle = "Rebuild the foundation";
    nextMoveDetail = "Simplify the board around pole, winner, and constructor reads first, then reintroduce the higher-volatility categories after the core is stable.";
  } else if ((volatilityAccuracy ?? 0) > (foundationAccuracy ?? 0) + 8) {
    nextMoveTitle = "Use the chaos selectively";
    nextMoveDetail = "Your upside comes from the swing categories, but the coach would still anchor the board with one or two dependable front-runner calls before chasing variance.";
  } else if ((breakdown?.trendDelta ?? 0) <= -5) {
    nextMoveTitle = "Cut the noise";
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
    protectCategory: breakdown?.strongestCategory || null,
    challengeCategory: breakdown?.weakestCategory || null,
    nextMoveTitle,
    nextMoveDetail,
  };
}

function normalizeInsights(insights) {
  const sorted = [...(Array.isArray(insights) ? insights : [])].sort((a, b) => {
    const left = new Date(b?.generated_at || 0).getTime();
    const right = new Date(a?.generated_at || 0).getTime();
    return left - right;
  });

  let hasMonthly = false;

  return sorted.filter((insight) => {
    if (insight?.insight_type !== "monthly") return true;
    if (hasMonthly) return false;
    hasMonthly = true;
    return true;
  });
}

export default function ProfilePage({ user, setUser }) {
  const { isMobile, isTablet } = useViewport();
  const [profileTab, setProfileTab] = useState("profile");
  const [predictions, setPredictions] = useState([]);
  const [aiPredictionHistory, setAiPredictionHistory] = useState([]);
  const [raceResults, setRaceResults] = useState([]);
  const [aiHistoryBusy, setAiHistoryBusy] = useState(false);
  const [aiHistoryMessage, setAiHistoryMessage] = useState("");
  const [aiHistoryLoadError, setAiHistoryLoadError] = useState("");
  const [aiHistoryAttempted, setAiHistoryAttempted] = useState(false);
  const [rank, setRank] = useState(null);
  const [editing, setEditing] = useState(false);
  const [proInsights, setProInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightGenerating, setInsightGenerating] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [insightNote, setInsightNote] = useState("");
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [pendingColor, setPendingColor] = useState(user?.avatar_color || DEFAULT_AVATAR_COLOR);
  const [pendingTeam, setPendingTeam] = useState(user?.favorite_team || TEAM_AVATAR_OPTIONS[0]?.team || "");
  const [saving, setSaving] = useState(false);
  const [supportSaving, setSupportSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const supportOptions = TEAM_AVATAR_OPTIONS;

  useEffect(() => {
    if (user) {
      setNewUsername(user.username || "");
      setPendingColor(user.avatar_color || DEFAULT_AVATAR_COLOR);
      setPendingTeam(user.favorite_team || TEAM_AVATAR_OPTIONS[0]?.team || "");
      setAiHistoryMessage("");
      setAiHistoryAttempted(false);
      fetchData();
    }
  }, [user]); // eslint-disable-line

  useEffect(() => {
    if (profileTab === "insights" && user?.subscription_status === "pro" && proInsights.length === 0) {
      setInsightsLoading(true);
      setInsightError("");
      fetch(`/api/insights/${user.id}`, { headers: { "x-user-id": user.id } })
        .then(async (response) => {
          const data = await parseJsonResponse(response, "Could not load insights.");
          if (!response.ok) throw new Error(data.error || "Could not load insights.");
          return data;
        })
        .then((data) => setProInsights(normalizeInsights(data.insights ?? [])))
        .catch((loadError) => setInsightError(loadError?.message || "Could not load insights."))
        .finally(() => setInsightsLoading(false));
    }
  }, [profileTab, user]); // eslint-disable-line

  const generateInsight = async () => {
    if (!user || insightGenerating) return;
    setInsightGenerating(true);
    setInsightError("");
    setInsightNote("");
    const userStats = {
      overall: {
        correct: seasonBreakdown.totalCorrect,
        total: seasonBreakdown.totalPicks,
        accuracy: seasonBreakdown.accuracy,
        totalPoints: seasonBreakdown.totalPoints,
        racesScored: seasonBreakdown.scoredRounds,
        averageScore: seasonBreakdown.averageScore,
      },
      byType: seasonBreakdown.categories.reduce((accumulator, category) => ({
        ...accumulator,
        [category.label]: {
          correct: category.correct,
          total: category.total,
          accuracy: category.accuracy,
          totalPoints: category.points,
        },
      }), {}),
      streaks: {
        current: seasonBreakdown.currentStreak,
        longest: seasonBreakdown.longestStreak,
      },
      bestRace: seasonBreakdown.bestRace
        ? {
            name: seasonBreakdown.bestRace.raceName,
            score: seasonBreakdown.bestRace.score,
            accuracy: seasonBreakdown.bestRace.accuracy,
          }
        : null,
      strongestCategory: seasonBreakdown.strongestCategory
        ? {
            label: seasonBreakdown.strongestCategory.label,
            accuracy: seasonBreakdown.strongestCategory.accuracy,
            totalPoints: seasonBreakdown.strongestCategory.points,
          }
        : null,
      weakestCategory: seasonBreakdown.weakestCategory
        ? {
            label: seasonBreakdown.weakestCategory.label,
            accuracy: seasonBreakdown.weakestCategory.accuracy,
            totalPoints: seasonBreakdown.weakestCategory.points,
          }
        : null,
      recentForm: seasonBreakdown.recentForm.map((race) => `${race.raceName}: ${race.score} pts (${race.correct}/${race.total})`),
      aiCoach: {
        archetype: aiCoach.archetype.label,
        verdict: aiCoach.verdict,
        confidence: aiCoach.confidence.label,
        nextMoveTitle: aiCoach.nextMoveTitle,
        nextMoveDetail: aiCoach.nextMoveDetail,
        protectCategory: aiCoach.protectCategory?.label || null,
        challengeCategory: aiCoach.challengeCategory?.label || null,
        historyStatus: aiCoach.historyStatusLabel,
        historyDetail: aiCoach.historyStatusDetail,
        comparisonSummary: aiCoach.comparisonSummary,
        biggestComparisonWin: aiCoach.comparisonWins[0]
          ? `${aiCoach.comparisonWins[0].label} (+${aiCoach.comparisonWins[0].delta} vs stored AI)`
          : null,
        biggestComparisonLoss: aiCoach.comparisonLosses[0]
          ? `${aiCoach.comparisonLosses[0].label} (${aiCoach.comparisonLosses[0].delta} vs stored AI)`
          : null,
      },
    };
    try {
      const res = await fetch(`/api/insights/${user.id}`, {
        method: "POST",
        headers: { "x-user-id": user.id, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "monthly", month: "2026 Season so far", userStats }),
      });
      const data = await parseJsonResponse(res, "Could not generate insight.");
      if (!res.ok) {
        throw new Error(data.error || "Could not generate insight.");
      }
      if (!data.insight) {
        throw new Error("No insight was returned.");
      }
      setProInsights((current) => normalizeInsights([data.insight, ...current.filter((insight) => insight.id !== data.insight.id)]));
      setInsightNote(
        data.insight.transient
          ? "Season summary generated. Saving to your history is unavailable right now, so this one is shown locally for now."
          : "Season summary generated."
      );
    } catch (generationError) {
      setInsightError(generationError?.message || "Could not generate insight.");
    }
    setInsightGenerating(false);
  };

  const buildAiReplayHistory = async () => {
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
    } catch (error) {
      setAiHistoryMessage(error instanceof Error ? error.message : "Could not build replay AI history.");
    } finally {
      setAiHistoryBusy(false);
    }
  };

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
      if (aiPredictionResponse.error?.message) {
        loadIssues.push(`Could not read stored AI history from Supabase: ${aiPredictionResponse.error.message}`);
      }
    }
    if (!raceResultsResponse.error && raceResultsResponse.data) {
      setRaceResults(raceResultsResponse.data);
    } else {
      setRaceResults([]);
      if (raceResultsResponse.error?.message) {
        loadIssues.push(`Could not read scored race results from Supabase: ${raceResultsResponse.error.message}`);
      }
    }
    setAiHistoryLoadError(loadIssues.join(" "));
    setLoading(false);
  };

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
        .update({
          username,
          avatar_color: pendingColor,
          favorite_team: pendingTeam,
        })
        .eq("id", user.id)
        .select("*")
        .single();

      if (updateError) {
        if (
          String(updateError.message || "").includes("avatar_color") ||
          String(updateError.message || "").includes("favorite_team")
        ) {
          await persistSupportMetadata({
            avatar_color: pendingColor,
            favorite_team: pendingTeam,
          });
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("profiles")
            .update({ username })
            .eq("id", user.id)
            .select("*")
            .single();

          if (fallbackError) {
            setError(fallbackError.message);
          } else if (fallbackData) {
            setUser({
              ...fallbackData,
              avatar_color: pendingColor || user.avatar_color || DEFAULT_AVATAR_COLOR,
              favorite_team: pendingTeam || user.favorite_team || null,
            });
            setEditing(false);
            setNote("Name updated. Team stayed local until the latest profile migration is applied.");
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

  const seasonBreakdown = buildSeasonBreakdown(predictions);
  const aiHistory = buildAiHistoryBreakdown(aiPredictionHistory, raceResults);
  const aiCoach = buildAiCoach(seasonBreakdown, aiHistory);
  const visibleInsights = normalizeInsights(proInsights);
  const featuredInsight = visibleInsights.find((insight) => insight?.insight_type === "monthly") || visibleInsights[0] || null;
  const supportingInsights = visibleInsights.filter((insight) => insight?.id !== featuredInsight?.id);
  const totalRaces = seasonBreakdown.scoredRounds;

  useEffect(() => {
    if (profileTab !== "insights") return;
    if (!user || !isAdminUser(user)) return;
    if (loading || aiHistoryBusy || aiHistoryAttempted) return;
    if (aiPredictionHistory.length > 0 || seasonBreakdown.scoredRounds === 0) return;

    setAiHistoryAttempted(true);
    buildAiReplayHistory();
  }, [
    profileTab,
    user,
    loading,
    aiHistoryBusy,
    aiHistoryAttempted,
    aiPredictionHistory.length,
    seasonBreakdown.scoredRounds,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const inputStyle = {
    background: PANEL_BG_ALT,
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: 12,
    color: "#fff",
    padding: "10px 13px",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const persistSupportMetadata = async (payload) => {
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        avatar_color: payload.avatar_color,
        favorite_team: payload.favorite_team,
      },
    });

    return metadataError || null;
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
      .update({
        avatar_color: nextColor,
        favorite_team: nextTeam,
      })
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) {
      if (
        String(updateError.message || "").includes("avatar_color") ||
        String(updateError.message || "").includes("favorite_team")
      ) {
        await persistSupportMetadata({
          avatar_color: nextColor,
          favorite_team: nextTeam,
        });
        setUser({
          ...user,
          avatar_color: nextColor,
          favorite_team: nextTeam,
        });
        setNote("Team updated locally. Run the latest profile migration to sync it to the profiles table.");
      } else {
        setError(updateError.message);
      }
    } else if (data) {
      setUser(data);
      setNote("Team updated.");
    }

    setSupportSaving(false);
  };

  if (!user) return null;

  const cancelEditing = () => {
    setEditing(false);
    setNewUsername(user.username || "");
    setPendingColor(user.avatar_color || DEFAULT_AVATAR_COLOR);
    setPendingTeam(user.favorite_team || TEAM_AVATAR_OPTIONS[0]?.team || "");
    setError("");
    setNote("");
  };

  const statCards = [
    { label: "Total Points", value: String(user.points || 0), color: "#f97316", compact: false },
    { label: "Global Rank", value: rank ? `#${rank}` : "—", color: "#bfdbfe", compact: false },
    { label: "Races Scored", value: `${totalRaces} / ${ACTIVE_RACE_COUNT}`, color: "#99f6e4", compact: true },
  ];
  const profileTheme = avatarTheme(pendingColor || user.avatar_color || DEFAULT_AVATAR_COLOR);
  const selectedTeamLabel = supportOptions.find((option) => option.team === pendingTeam)?.label || pendingTeam;
  const profileInitials = String(user.username || "?").slice(0, 2).toUpperCase().split("");
  const headerButtonStyle = {
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    padding: "10px 14px",
    fontFamily: "inherit",
  };
  const sectionCardStyle = {
    borderRadius: 18,
    border: PANEL_BORDER,
    background: PANEL_BG,
    padding: isMobile ? "16px 16px 18px" : "18px 18px 20px",
  };
  const sectionEyebrowStyle = {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: SUBTLE_TEXT,
    marginBottom: 10,
  };

  const profileHeaderTitle = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: isMobile ? 12 : 16, flexWrap: "wrap", verticalAlign: "middle" }}>
      <span
        style={{
          width: isMobile ? 56 : 64,
          height: isMobile ? 56 : 64,
          borderRadius: isMobile ? 16 : 18,
          background: profileTheme.fill,
          border: `1px solid ${profileTheme.border}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: isMobile ? 20 : 24,
          fontWeight: 900,
          color: profileTheme.text,
          boxShadow: `0 18px 44px ${profileTheme.bg}, inset 0 0 0 1px rgba(255,255,255,0.08)`,
          flexShrink: 0,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
          {profileInitials.map((char, index) => (
            <span key={`${char}-${index}`} style={{ display: "inline-block", letterSpacing: "-0.01em" }}>
              {char}
            </span>
          ))}
        </span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span>{user.username}</span>
        <ProBadge subscriptionStatus={user.subscription_status} />
      </span>
    </span>
  );
  const profileHeaderAside = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
      {statCards.map((card) => (
        <div key={card.label} style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.02)", padding: "14px 15px 13px" }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8, color: card.color }}>{card.value}</div>
          <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>{card.label}</div>
        </div>
      ))}
    </div>
  );
  const profileHeaderActions = editing ? (
    <>
      <button onClick={saveProfile} disabled={saving} style={{ ...headerButtonStyle, border: "none", background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff" }}>
        {saving ? "Saving..." : "Save name"}
      </button>
      <button onClick={cancelEditing} style={{ ...headerButtonStyle, border: "1px solid rgba(148,163,184,0.16)", background: PANEL_BG_ALT, color: "#dbe4f0" }}>
        Cancel
      </button>
    </>
  ) : (
    <button onClick={() => { setEditing(true); setError(""); setNote(""); }} style={{ ...headerButtonStyle, border: "1px solid rgba(148,163,184,0.16)", background: PANEL_BG_ALT, color: "#dbe4f0" }}>
      Edit name
    </button>
  );

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : "44px 28px 80px", position: "relative", zIndex: 1 }}>
      <PageHeader
        eyebrow="Profile"
        title={profileHeaderTitle}
        description={null}
        aside={profileHeaderAside}
        actions={profileHeaderActions}
        asideWidth={360}
        marginBottom={18}
      />

      {/* ── Profile tabs ── */}
      <div>
        <section style={{ borderRadius: 28, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: "0 18px 36px rgba(4,11,22,0.32)", marginBottom: 18 }}>
          <div style={{ padding: "12px 24px", background: PANEL_BG, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["profile", "Profile"], ["history", "History"], ["insights", "Insights"]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setProfileTab(key)}
                style={{
                  background: profileTab === key ? "linear-gradient(180deg,rgba(255,255,255,0.1),#111c30)" : PANEL_BG_ALT,
                  border: profileTab === key ? "1px solid rgba(248,250,252,0.16)" : "1px solid rgba(148,163,184,0.12)",
                  borderRadius: 12,
                  color: profileTab === key ? "#fff" : MUTED_TEXT,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 12,
                  padding: "9px 12px",
                }}
              >
                {label}
                {key === "insights" && user.subscription_status !== "pro" && <span style={{ fontSize: 9, fontWeight: 800, color: ACCENT, background: "rgba(255,106,26,0.12)", borderRadius: 999, padding: "2px 5px", marginLeft: 6, letterSpacing: "0.06em" }}>PRO</span>}
              </button>
            ))}
          </div>
        </section>

        {profileTab === "profile" && (
          <>
            {(error || note) && (
              <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                {error && (
                  <div style={{ padding: "11px 12px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#fca5a5", fontSize: 12, lineHeight: 1.6 }}>
                    {error}
                  </div>
                )}
                {note && (
                  <div style={{ padding: "11px 12px", borderRadius: 12, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "#bae6fd", fontSize: 12, lineHeight: 1.6 }}>
                    {note}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: editing && !(isMobile || isTablet) ? "minmax(0,0.82fr) minmax(0,1.18fr)" : "1fr", gap: 14 }}>
              {editing && (
                <div style={sectionCardStyle}>
                  <div style={sectionEyebrowStyle}>Username</div>
                  <input
                    id="profile-username"
                    style={{ ...inputStyle, width: "100%", fontSize: isMobile ? 20 : 24, fontWeight: 900, letterSpacing: "-0.03em", minHeight: 60 }}
                    value={newUsername}
                    onChange={(event) => setNewUsername(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && saveProfile()}
                    autoFocus
                  />
                </div>
              )}

              <div style={sectionCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Team</div>
                  <div style={{ borderRadius: 999, border: `1px solid ${profileTheme.border}`, background: profileTheme.bg, color: profileTheme.text, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                    {selectedTeamLabel}
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {supportOptions.map(({ key, label, team }) => {
                    const option = AVATAR_THEMES[key];
                    if (!option) return null;

                    return (
                      <button
                        key={key}
                        onClick={() => saveSupportPreferences(team)}
                        aria-pressed={pendingTeam === team}
                        aria-label={label}
                        style={{
                          borderRadius: 999,
                          border: pendingTeam === team ? `1px solid ${option.border}` : "1px solid rgba(148,163,184,0.14)",
                          background: pendingTeam === team ? option.bg : PANEL_BG_ALT,
                          cursor: "pointer",
                          padding: "7px 10px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          minHeight: 36,
                          color: "#fff",
                          fontFamily: "inherit",
                        }}
                        title={label}
                      >
                        <span style={{ width: 18, height: 18, borderRadius: 999, background: option.fill, display: "inline-flex", alignItems: "center", justifyContent: "center", color: option.text, fontSize: 8, fontWeight: 900, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
                          {(label || "?").slice(0, 2).toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {profileTab === "history" && (
          loading ? (
            <div style={{ padding: 40, textAlign: "center", color: MUTED_TEXT, fontSize: 13 }}>Loading...</div>
          ) : predictions.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>No predictions yet</div>
              <div style={{ fontSize: 13, color: MUTED_TEXT }}>Make your first picks in the Predictions tab.</div>
            </div>
          ) : (
            <div style={{ borderRadius: 18, overflow: "hidden", border: PANEL_BORDER }}>
              <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 100px 100px", background: PANEL_BG_ALT, borderBottom: "1px solid rgba(148,163,184,0.14)" }}>
                {["Rnd", "Race", "Picks", "Score"].map((heading, index) => (
                  <div key={heading} style={{ padding: "10px 14px", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, textAlign: index > 1 ? "center" : "left" }}>{heading}</div>
                ))}
              </div>
              {predictions.map((prediction, index) => {
                const race = CAL.find((item) => item.r === prediction.race_round);
                const pickCount = prediction.picks ? Object.values(prediction.picks).filter(Boolean).length : 0;
                const isScored = isScoredPrediction(prediction);
                return (
                  <div key={prediction.race_round} style={{ display: "grid", gridTemplateColumns: "50px 1fr 100px 100px", borderBottom: index < predictions.length - 1 ? "1px solid rgba(148,163,184,0.12)" : "none", background: index % 2 === 0 ? PANEL_BG : PANEL_BG_ALT, alignItems: "center" }}>
                    <div style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: SUBTLE_TEXT }}>R{prediction.race_round}</div>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{race?.n || `Round ${prediction.race_round}`}</div>
                    </div>
                    <div style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#bfdbfe", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(96,165,250,0.22)", borderRadius: 10, padding: "3px 8px" }}>{pickCount} picks</span>
                    </div>
                    <div style={{ padding: "12px 14px", textAlign: "center", fontSize: 16, fontWeight: 900, color: isScored ? "#99f6e4" : SUBTLE_TEXT }}>
                      {isScored ? prediction.score : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {profileTab === "insights" && (() => {
          const isPro = user.subscription_status === "pro";

          function InsightCard({ label, raceName, date, content, typeColor = ACCENT }) {
            const paragraphs = String(content || "")
              .split(/\n{2,}/)
              .map((part) => part.trim())
              .filter(Boolean);
            return (
              <div style={{ borderRadius: 16, border: PANEL_BORDER, background: BG_ELEVATED, padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: typeColor }}>{label}</span>
                    {raceName && <span style={{ fontSize: 10, color: MUTED_TEXT, marginLeft: 8 }}>· {raceName}</span>}
                  </div>
                  {date && <span style={{ fontSize: 11, color: MUTED_TEXT }}>{date}</span>}
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {(paragraphs.length ? paragraphs : [String(content || "")]).map((paragraph, index) => {
                    const isHeading = /^[A-Z][A-Z\s]+$/.test(paragraph) && paragraph.length < 32;
                    if (isHeading) {
                      return (
                        <div key={`${label}-${index}`} style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: typeColor, marginTop: index === 0 ? 0 : 4 }}>
                          {paragraph}
                        </div>
                      );
                    }
                    return (
                      <p key={`${label}-${index}`} style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "rgba(214,223,239,0.85)", whiteSpace: "pre-line" }}>
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              </div>
            );
          }

          function PrimaryInsightCard({ insight, coach }) {
            if (!insight) return null;

            const label = insight.insight_type === "post_race"
              ? "Race Debrief"
              : insight.insight_type === "pre_race"
                ? "Pre-Race Tip"
                : "Season Report";
            const typeColor = insight.insight_type === "monthly" ? ACCENT : "#7dd3fc";
            const blocks = String(insight.content || "")
              .split(/\n{2,}/)
              .map((part) => part.trim())
              .filter(Boolean);

            return (
              <div style={{ borderRadius: 20, border: PANEL_BORDER, background: `linear-gradient(180deg, rgba(255,106,26,0.06), rgba(21,35,56,0.96) 26%, rgba(21,35,56,0.96))`, padding: isMobile ? "18px 16px" : "22px 22px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, letterSpacing: -0.7, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, color: MUTED_TEXT }}>
                      {insight.generated_at
                        ? new Date(insight.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "Just now"}
                      {insight.race_name ? ` · ${insight.race_name}` : ""}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0,1fr) 220px", gap: 18 }}>
                  <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
                    {blocks.map((block, index) => {
                      const isHeading = /^[A-Z][A-Z\s]+$/.test(block) && block.length < 32;
                      if (isHeading) {
                        return (
                          <div key={`featured-${index}`} style={{ paddingTop: index === 0 ? 0 : 6 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: typeColor, marginBottom: 8 }}>
                              {block}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <p key={`featured-${index}`} style={{ margin: 0, fontSize: 15, lineHeight: 1.78, color: "rgba(214,223,239,0.88)", maxWidth: "62ch" }}>
                          {block}
                        </p>
                      );
                    })}
                  </div>

                  <div style={{ display: "grid", gap: 10, alignSelf: "start" }}>
                    {[
                      {
                        label: "Confidence",
                        value: coach.confidence.label,
                        detail: coach.confidence.detail,
                        accent: "#7dd3fc",
                      },
                      {
                        label: "Best edge",
                        value: coach.protectCategory?.shortLabel || "Still forming",
                        detail: coach.protectCategory
                          ? `${coach.protectCategory.accuracy}% accuracy · ${coach.protectCategory.points} pts`
                          : "The model needs more data to identify it.",
                        accent: "#fdba74",
                      },
                      {
                        label: "Next move",
                        value: coach.nextMoveTitle,
                        detail: coach.nextMoveDetail,
                        accent: "#fbbf24",
                      },
                    ].map((item) => (
                      <div key={item.label} style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.12)", background: "rgba(8,14,26,0.82)", padding: "13px 13px 12px" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: item.accent, marginBottom: 7 }}>{item.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, marginBottom: 6 }}>{item.value}</div>
                        <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.55 }}>{item.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          function BreakdownPanel({ breakdown, coach, history }) {
            if (!breakdown?.scoredRounds) return null;

            const metricCards = [
              {
                label: "Season accuracy",
                value: `${breakdown.accuracy}%`,
                detail: `${breakdown.totalCorrect}/${breakdown.totalPicks} hits`,
                accent: "#f97316",
              },
              {
                label: "Average weekend",
                value: `${breakdown.averageScore} pts`,
                detail: `${breakdown.scoredRounds} rounds`,
                accent: "#7dd3fc",
              },
              {
                label: "Recent form",
                value: `${breakdown.recentAverage} pts`,
                detail: coach.trend.label,
                accent: "#fbbf24",
              },
              {
                label: "Current streak",
                value: `${breakdown.currentStreak}`,
                detail: `Best ${breakdown.longestStreak}`,
                accent: "#34d399",
              },
            ];

            const aiCategoryMap = new Map((history?.categories || []).map((category) => [category.key, category]));
            const showAiHistoryColumn = coach.comparisonAvailable;
            const aiHistoryStatusText = aiHistoryLoadError || aiHistoryMessage;

            return (
              <div style={{ marginBottom: 16, borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG, padding: isMobile ? 16 : 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
                  <div style={{ minWidth: 240 }}>
                    <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, letterSpacing: -0.7, marginBottom: 4 }}>Insights</div>
                  </div>
                  <button
                    onClick={generateInsight}
                    disabled={insightGenerating}
                    style={{
                      background: insightGenerating ? "rgba(255,106,26,0.12)" : "linear-gradient(135deg,#f97316,#ea580c)",
                      border: "none",
                      borderRadius: 12,
                      color: "#fff",
                      cursor: insightGenerating ? "default" : "pointer",
                      fontWeight: 800,
                      padding: "11px 18px",
                      fontSize: 13,
                      opacity: insightGenerating ? 0.7 : 1,
                      boxShadow: insightGenerating ? "none" : "0 6px 18px rgba(249,115,22,0.26)",
                    }}
                  >
                    {insightGenerating ? "Generating..." : visibleInsights.length > 0 ? "New report" : "Generate report"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0,1.06fr) minmax(280px,0.94fr)", gap: 14, marginBottom: 14 }}>
                  <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,17,30,0.84)", padding: "16px 16px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Coach</div>
                        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{coach.verdict}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                        {[
                          { label: coach.confidence.label, tone: "rgba(56,189,248,0.12)", color: "#bae6fd", border: "rgba(56,189,248,0.18)" },
                          { label: coach.trend.label, tone: "rgba(249,115,22,0.12)", color: "#fdba74", border: "rgba(249,115,22,0.18)" },
                        ].map((pill) => (
                          <span key={pill.label} style={{ fontSize: 11, fontWeight: 700, color: pill.color, background: pill.tone, border: `1px solid ${pill.border}`, borderRadius: 999, padding: "6px 9px" }}>
                            {pill.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{coach.archetype.label}</div>
                    <div style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.65, marginBottom: 14 }}>
                      {coach.archetype.description}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0,1fr))", gap: 10 }}>
                      {[
                        {
                          label: "Protect",
                          value: coach.protectCategory?.shortLabel || "Best edge",
                          detail: coach.protectCategory
                            ? `${coach.protectCategory.accuracy}% accuracy · ${coach.protectCategory.points} pts`
                            : "Your best edge will appear here.",
                          accent: "#f97316",
                        },
                        {
                          label: "Challenge",
                          value: coach.challengeCategory?.shortLabel || "Main leak",
                          detail: coach.challengeCategory
                            ? `${coach.challengeCategory.accuracy}% accuracy · ${coach.challengeCategory.points} pts`
                            : "The model does not see a weak spot yet.",
                          accent: "#fbbf24",
                        },
                        {
                          label: "Next move",
                          value: coach.nextMoveTitle,
                          detail: coach.nextMoveDetail,
                          accent: "#7dd3fc",
                        },
                      ].map((item) => (
                        <div key={item.label} style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.12)", background: "rgba(8,14,26,0.82)", padding: "13px 13px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: item.accent, marginBottom: 7 }}>{item.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, marginBottom: 6 }}>{item.value}</div>
                          <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.55 }}>{item.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,17,30,0.84)", padding: "16px 16px 14px" }}>
                    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>AI vs you</div>
                    <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.6, marginBottom: 14 }}>
                      {coach.comparisonAvailable
                        ? `${coach.historyStatusDetail} · ${coach.comparisonSummary}`
                        : "No stored AI picks yet."}
                    </div>

                    {coach.comparisonAvailable ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ fontSize: 12, color: "#dbeafe", lineHeight: 1.55 }}>{coach.comparisonSummary}</div>

                        <div style={{ borderRadius: 14, border: "1px solid rgba(249,115,22,0.16)", background: "rgba(249,115,22,0.06)", padding: "12px 12px 10px" }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fdba74", marginBottom: 8 }}>You ahead</div>
                          <div style={{ display: "grid", gap: 8 }}>
                            {coach.comparisonWins.slice(0, 3).map((row) => (
                              <div key={row.key} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</div>
                                  <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 2 }}>{row.accuracy}% vs {row.aiAccuracy}% stored AI</div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 900, color: "#fdba74" }}>+{row.delta}</div>
                              </div>
                            ))}
                            {coach.comparisonWins.length === 0 && (
                              <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.55 }}>The saved AI picks are matching or beating your hit rate across every tracked category so far.</div>
                            )}
                          </div>
                        </div>

                        <div style={{ borderRadius: 14, border: "1px solid rgba(56,189,248,0.16)", background: "rgba(56,189,248,0.05)", padding: "12px 12px 10px" }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7dd3fc", marginBottom: 8 }}>AI ahead</div>
                          <div style={{ display: "grid", gap: 8 }}>
                            {coach.comparisonLosses.slice(0, 3).map((row) => (
                              <div key={row.key} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</div>
                                  <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 2 }}>{row.accuracy}% vs {row.aiAccuracy}% stored AI</div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 900, color: "#7dd3fc" }}>{row.delta}</div>
                              </div>
                            ))}
                            {coach.comparisonLosses.length === 0 && (
                              <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.55 }}>You are matching or beating the stored AI picks across every tracked category right now.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ borderRadius: 14, border: "1px solid rgba(56,189,248,0.16)", background: "rgba(56,189,248,0.05)", padding: "12px 12px 10px" }}>
                        <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.6 }}>
                          No stored AI picks yet.
                        </div>
                        {aiHistoryLoadError && (
                          <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid rgba(248,113,113,0.28)", background: "rgba(127,29,29,0.22)", padding: "10px 12px", fontSize: 12, color: "#fecaca", lineHeight: 1.55 }}>
                            {aiHistoryLoadError}
                          </div>
                        )}
                        {isAdminUser(user) && (
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
                            <button
                              onClick={buildAiReplayHistory}
                              disabled={aiHistoryBusy}
                              style={{
                                background: aiHistoryBusy ? "rgba(56,189,248,0.12)" : "rgba(59,130,246,0.14)",
                                border: "1px solid rgba(96,165,250,0.22)",
                                borderRadius: 10,
                                color: "#dbeafe",
                                cursor: aiHistoryBusy ? "default" : "pointer",
                                fontSize: 12,
                                fontWeight: 800,
                                padding: "8px 12px",
                              }}
                            >
                              {aiHistoryBusy ? "Building AI replay..." : "Build AI replay now"}
                            </button>
                            {aiHistoryStatusText && (
                              <div style={{ fontSize: 12, color: aiHistoryLoadError ? "#fecaca" : "#bae6fd", lineHeight: 1.55 }}>
                                {aiHistoryStatusText}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 14 }}>
                  {metricCards.map((metric) => (
                    <div key={metric.label} style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(10,18,31,0.78)", padding: "14px 14px 13px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: metric.accent, marginBottom: 8 }}>{metric.label}</div>
                      <div style={{ fontSize: isMobile ? 22 : 24, fontWeight: 900, marginBottom: 6 }}>{metric.value}</div>
                      <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.5 }}>{metric.detail}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0,1.12fr) minmax(280px,0.88fr)", gap: 14 }}>
                  <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(8,16,28,0.84)", padding: "16px 16px 8px" }}>
                    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>Categories</div>
                    {!showAiHistoryColumn && aiHistoryStatusText && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 10,
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: aiHistoryLoadError ? "1px solid rgba(248,113,113,0.28)" : "1px solid rgba(96,165,250,0.22)",
                          background: aiHistoryLoadError ? "rgba(127,29,29,0.22)" : "rgba(30,64,175,0.12)",
                        }}
                      >
                        <div style={{ fontSize: 12, color: aiHistoryLoadError ? "#fecaca" : "#bae6fd", lineHeight: 1.55 }}>
                          {aiHistoryStatusText}
                        </div>
                        {isAdminUser(user) && (
                          <button
                            onClick={buildAiReplayHistory}
                            disabled={aiHistoryBusy}
                            style={{
                              background: aiHistoryBusy ? "rgba(56,189,248,0.12)" : "rgba(59,130,246,0.14)",
                              border: "1px solid rgba(96,165,250,0.22)",
                              borderRadius: 10,
                              color: "#dbeafe",
                              cursor: aiHistoryBusy ? "default" : "pointer",
                              fontSize: 12,
                              fontWeight: 800,
                              padding: "8px 12px",
                            }}
                          >
                            {aiHistoryBusy ? "Building AI replay..." : "Retry AI replay"}
                          </button>
                        )}
                      </div>
                    )}
                    <div style={{ display: "grid", gap: 2 }}>
                      {breakdown.categories.map((category, index) => {
                        const aiCategory = aiCategoryMap.get(category.key) || null;

                        return (
                          <div
                            key={category.key}
                            style={{
                              display: "grid",
                              gridTemplateColumns: showAiHistoryColumn ? "minmax(0,1fr) 72px 72px 70px" : "minmax(0,1fr) 72px 70px",
                              gap: 10,
                              alignItems: "center",
                              padding: "11px 0",
                              borderTop: index === 0 ? "1px solid rgba(148,163,184,0.12)" : "1px solid rgba(148,163,184,0.08)",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                                <span style={{ width: 7, height: 7, borderRadius: 999, background: index % 2 === 0 ? ACCENT : "#7dd3fc", flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{category.label}</span>
                              </div>
                              <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 4 }}>{category.correct}/{category.total} hits</div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 15, fontWeight: 900 }}>{category.accuracy}%</div>
                              <div style={{ fontSize: 10, color: SUBTLE_TEXT, textTransform: "uppercase", letterSpacing: "0.08em" }}>You</div>
                            </div>
                            {showAiHistoryColumn && (
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 15, fontWeight: 900, color: "#93c5fd" }}>{aiCategory ? `${aiCategory.accuracy}%` : "—"}</div>
                                <div style={{ fontSize: 10, color: SUBTLE_TEXT, textTransform: "uppercase", letterSpacing: "0.08em" }}>AI</div>
                              </div>
                            )}
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 15, fontWeight: 900, color: index % 2 === 0 ? "#fdba74" : "#bae6fd" }}>{category.points}</div>
                              <div style={{ fontSize: 10, color: SUBTLE_TEXT, textTransform: "uppercase", letterSpacing: "0.08em" }}>Points</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,17,30,0.84)", padding: "16px 16px 10px" }}>
                      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>Recent form</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {breakdown.recentForm.map((race, index) => (
                          <div key={`${race.raceName}-${race.round}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", paddingBottom: 8, borderBottom: index < breakdown.recentForm.length - 1 ? "1px solid rgba(148,163,184,0.08)" : "none" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{race.raceName}</div>
                              <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 3 }}>{race.correct}/{race.total} hits · {race.accuracy}% accuracy</div>
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#fdba74" }}>{race.score} pts</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {breakdown.bestRace && (
                      <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,17,30,0.84)", padding: "16px 16px 14px" }}>
                        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Best weekend</div>
                        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{breakdown.bestRace.raceName}</div>
                        <div style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.6 }}>
                          {breakdown.bestRace.score} pts · {breakdown.bestRace.correct}/{breakdown.bestRace.total} hits
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // Sample cards shown blurred to free users
          const SAMPLE_INSIGHTS = [
            {
              label: "Race Debrief",
              raceName: "Bahrain Grand Prix",
              date: "Mar 2",
              content: "Strong race this weekend — you nailed pole and the winner, which put you in the top 20% of the room. Your DNF call didn't land, but the fastest lap pick was a smart read given the tyre degradation pattern. For the next race, lean harder on the P2/P3 categories where you've been leaving points on the table.",
            },
            {
              label: "Pre-Race Tip",
              raceName: "Saudi Arabian Grand Prix",
              date: "Mar 9",
              content: "Jeddah rewards raw pace over tyre management, which historically makes the pole-sitter the safest winner pick of the season. Your recent accuracy on winner picks (68%) is your strongest category — prioritise it. The DNF rate here is high due to wall proximity; a midfield pick has a real chance of landing.",
            },
            {
              label: "Monthly Wrap-Up",
              raceName: null,
              date: "Mar 31",
              content: "March was your best month so far: 71% accuracy across 18 picks and 47 points. Your pole picks are nearly automatic at 85% — keep trusting that read. Fastest lap is your weakest at 33%; consider fading the obvious leader and targeting the first car to pit late. You're currently on a 4-pick correct streak going into April.",
            },
          ];

          if (!isPro) {
            return (
              <div>
                {/* What you get — feature bullets above the gate */}
                <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(255,106,26,0.04)", border: "1px solid rgba(255,106,26,0.12)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Pro unlocks</div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {[
                      ["🏁", "Post-race debriefs"],
                      ["🎯", "Pre-race tips"],
                      ["📅", "Monthly wrap-ups"],
                    ].map(([icon, text]) => (
                      <div key={text} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: MUTED_TEXT }}>
                        <span style={{ flexShrink: 0 }}>{icon}</span>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample insights behind the gate */}
                <ProGate feature="ai_insights" subscriptionStatus={user.subscription_status}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {SAMPLE_INSIGHTS.map((s) => (
                      <InsightCard key={s.label} {...s} />
                    ))}
                  </div>
                </ProGate>
              </div>
            );
          }

          // Pro user — real insights
          return (
            <div>
              {insightError && (
                <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: 12, lineHeight: 1.6 }}>
                  {insightError}
                </div>
              )}
              {insightNote && (
                <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "#bae6fd", fontSize: 12, lineHeight: 1.6 }}>
                  {insightNote}
                </div>
              )}
              <BreakdownPanel breakdown={seasonBreakdown} coach={aiCoach} history={aiHistory} />
              {insightsLoading ? (
                <div style={{ padding: 40, textAlign: "center", color: MUTED_TEXT, fontSize: 13 }}>Loading insights…</div>
              ) : visibleInsights.length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>No reports yet</div>
                  <div style={{ fontSize: 13, color: MUTED_TEXT, maxWidth: 340, margin: "0 auto", lineHeight: 1.6 }}>
                    {seasonBreakdown.scoredRounds > 0
                      ? "Use Generate report when you want a written read."
                      : "Reports start after a scored round."}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <PrimaryInsightCard insight={featuredInsight} coach={aiCoach} />

                  {supportingInsights.length > 0 && (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>Earlier reports</div>
                      <div style={{ display: "grid", gap: 12 }}>
                        {supportingInsights.map((insight) => (
                          <InsightCard
                            key={insight.id}
                            label={insight.insight_type === "post_race" ? "Race Debrief" : insight.insight_type === "pre_race" ? "Pre-Race Tip" : "Monthly Wrap-Up"}
                            raceName={insight.race_name}
                            date={insight.generated_at
                              ? new Date(insight.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "Just now"}
                            content={insight.content}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
