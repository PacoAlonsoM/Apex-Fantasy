import "server-only";

import { matchesDnfPick } from "@/src/lib/resultHelpers";

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

function toNumber(value) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function hasCompleteSprintResults(results) {
  return Boolean(results?.sp_pole && results?.sp_winner && results?.sp_p2 && results?.sp_p3);
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

// Apply per-league scoring weights + sprint multiplier overlays. Returns an
// adjusted score + breakdown where every line's pts has been re-weighted.
function applyLeagueWeights(rawBreakdown, leagueSettings = {}, isSprintScope = false) {
  const weights = leagueSettings?.scoring_weights || leagueSettings?.pick_weights || null;
  const sprintMult = leagueSettings?.sprint_multiplier;
  let total = 0;
  const out = [];
  for (const entry of rawBreakdown) {
    let pts = entry.pts;
    // Per-category override (e.g. league sets winner = 30 instead of 25).
    if (weights && Object.prototype.hasOwnProperty.call(weights, entry.key)) {
      const override = Number(weights[entry.key]);
      if (Number.isFinite(override)) {
        const scale = entry.pts !== 0 ? override / Math.abs(entry.pts) : 0;
        pts = entry.pts < 0 ? -override : override;
        // Note: perfect_podium uses its own default; weights[perfect_podium] also overrides if present.
        void scale;
      }
    }
    // Sprint multiplier applies to sprint-prefixed keys.
    if (isSprintScope && entry.key?.startsWith("sp_") && Number.isFinite(Number(sprintMult))) {
      pts = Math.round(pts * Number(sprintMult));
    }
    out.push({ ...entry, pts });
    total += pts;
  }
  return { points: total, breakdown: out };
}

// Per-league mode-aware scoring. Wraps calculateRoundScore and then layers
// (1) custom scoring weights + sprint multiplier from league settings, then
// (2) game-mode adjustments — Double Down 3× (or -1 on miss), Budget Picks
// +bet/-bet, Survival uses the standard score (elimination happens after).
//
// `submission` is the per-league entry from picks.__league_submissions[id]:
//   { picks, betAmounts, doubleDownKey, gameMode }
// `leagueSettings` is the league.settings JSONB (scoring_weights, etc.).
//
// Returns { points, breakdown, gameMode }.
export function scoreLeagueRound(submission, results, { scope = "full", leagueSettings = {} } = {}) {
  const gameMode = submission?.gameMode || "standard";
  const leaguePicks = submission?.picks || {};

  // Start from the standard score using the league-specific picks.
  const raw = calculateRoundScore(leaguePicks, results, { scope });
  // Apply per-league weight + sprint-multiplier overlays.
  const weighted = applyLeagueWeights(raw.breakdown, leagueSettings, scope === "sprint" || scope === "full");
  const baseScore = weighted.points;
  const breakdown = weighted.breakdown;

  if (gameMode === "double_down") {
    const ddKey = submission?.doubleDownKey || null;
    if (ddKey && leaguePicks[ddKey]) {
      // Find the breakdown entry for this category, if it was a hit.
      const hitEntry = breakdown.find((entry) => entry.key === ddKey);
      if (hitEntry) {
        // Triple the points for this pick. We already counted `hitEntry.pts`
        // once in baseScore; add 2x more to get 3x total.
        const bonus = hitEntry.pts * 2;
        return {
          points: baseScore + bonus,
          breakdown: [
            ...breakdown,
            { key: `${ddKey}__dd_bonus`, label: `Double Down × 3 (${hitEntry.label})`, pts: bonus },
          ],
          gameMode,
        };
      }
      // The double-down pick missed — apply the -1 penalty.
      return {
        points: baseScore - 1,
        breakdown: [
          ...breakdown,
          { key: `${ddKey}__dd_penalty`, label: `Double Down miss (${ddKey})`, pts: -1 },
        ],
        gameMode,
      };
    }
    // No DD armed — score normally.
    return { points: baseScore, breakdown, gameMode };
  }

  if (gameMode === "budget_picks") {
    // Budget mode: each pick's contribution is its bet amount (+ on hit, - on
    // miss). Override the standard category points entirely.
    const bets = submission?.betAmounts || {};
    let points = 0;
    const detail = [];
    const hitKeys = new Set(breakdown.map((entry) => entry.key));
    for (const [key, amount] of Object.entries(bets)) {
      const bet = Number(amount);
      if (!Number.isFinite(bet) || bet <= 0) continue;
      if (hitKeys.has(key)) {
        points += bet;
        detail.push({ key, label: `Budget hit (${key}): +${bet}`, pts: bet });
      } else if (leaguePicks[key]) {
        points -= bet;
        detail.push({ key, label: `Budget miss (${key}): -${bet}`, pts: -bet });
      }
    }
    return { points, breakdown: detail, gameMode };
  }

  // Standard, Survival, Draft, Head-to-Head → standard scoring.
  // (Survival's elimination happens separately after scoring.)
  return { points: baseScore, breakdown, gameMode };
}

// Returns the set of user_ids to eliminate for a given league after this round.
// Lowest unique scorer is out; ties = no elimination. Returns empty set if the
// elimination window hasn't started yet for this league.
export function pickSurvivalEliminations({ leagueSettings = {}, scoresByUser, raceRound }) {
  const startsAt = leagueSettings?.elimination_starts_round ?? 3;
  if (raceRound < startsAt) return [];
  const entries = [...scoresByUser.entries()];
  if (entries.length <= 1) return [];
  entries.sort(([, a], [, b]) => a - b);
  const lowest = entries[0][1];
  const lowestUsers = entries.filter(([, score]) => score === lowest);
  if (lowestUsers.length !== 1) return [];
  return [lowestUsers[0][0]];
}

export function calculateRoundScore(picks, results, { scope = "full" } = {}) {
  let points = 0;
  const breakdown = [];
  const includeRace = scope !== "sprint";
  const includeSprint = scope === "sprint" || scope === "full";

  if (!picks || !results) return { points, breakdown };

  if (includeRace) {
    if (picks.pole && picks.pole === results.pole) { points += PTS.pole; breakdown.push({ key: "pole", label: "Pole Position", pts: PTS.pole }); }
    if (picks.winner && picks.winner === results.winner) { points += PTS.winner; breakdown.push({ key: "winner", label: "Race Winner", pts: PTS.winner }); }
    if (picks.p2 && picks.p2 === results.p2) { points += PTS.p2; breakdown.push({ key: "p2", label: "2nd Place", pts: PTS.p2 }); }
    if (picks.p3 && picks.p3 === results.p3) { points += PTS.p3; breakdown.push({ key: "p3", label: "3rd Place", pts: PTS.p3 }); }
    if (picks.winner && picks.p2 && picks.p3 && picks.winner === results.winner && picks.p2 === results.p2 && picks.p3 === results.p3) {
      points += PTS.perfectPodium;
      breakdown.push({ key: "perfect_podium", label: "Perfect Podium Bonus", pts: PTS.perfectPodium });
    }
    if (matchesDnfPick(picks.dnf, results)) { points += PTS.dnf; breakdown.push({ key: "dnf", label: "DNF Driver", pts: PTS.dnf }); }
    if (picks.fl && picks.fl === results.fastest_lap) { points += PTS.fl; breakdown.push({ key: "fl", label: "Fastest Lap", pts: PTS.fl }); }
    if (picks.dotd && picks.dotd === results.dotd) { points += PTS.dotd; breakdown.push({ key: "dotd", label: "Driver of the Day", pts: PTS.dotd }); }
    if (picks.ctor && picks.ctor === results.best_constructor) { points += PTS.ctor; breakdown.push({ key: "ctor", label: "Best Constructor", pts: PTS.ctor }); }
    if (picks.sc && picks.sc === "Yes" && results.safety_car) { points += PTS.sc; breakdown.push({ key: "sc", label: "Safety Car", pts: PTS.sc }); }
    if (picks.rf && picks.rf === "Yes" && results.red_flag) { points += PTS.rf; breakdown.push({ key: "rf", label: "Red Flag", pts: PTS.rf }); }
  }

  if (includeSprint) {
    if (picks.sp_pole && picks.sp_pole === results.sp_pole) { points += PTS.sp_pole; breakdown.push({ key: "sp_pole", label: "Sprint Pole", pts: PTS.sp_pole }); }
    if (picks.sp_winner && picks.sp_winner === results.sp_winner) { points += PTS.sp_winner; breakdown.push({ key: "sp_winner", label: "Sprint Winner", pts: PTS.sp_winner }); }
    if (picks.sp_p2 && picks.sp_p2 === results.sp_p2) { points += PTS.sp_p2; breakdown.push({ key: "sp_p2", label: "Sprint 2nd", pts: PTS.sp_p2 }); }
    if (picks.sp_p3 && picks.sp_p3 === results.sp_p3) { points += PTS.sp_p3; breakdown.push({ key: "sp_p3", label: "Sprint 3rd", pts: PTS.sp_p3 }); }
  }

  return { points, breakdown };
}

export async function awardRoundPoints(supabase, raceRound, { scope = "full" } = {}) {
  const { data: results, error: resultsError } = await supabase
    .from("race_results")
    .select("*")
    .eq("race_round", raceRound)
    .single();

  if (resultsError || !results) {
    throw new Error("No published results found for this round.");
  }
  if (scope === "sprint") {
    if (!hasCompleteSprintResults(results)) {
      throw new Error("No complete sprint result found for this round.");
    }
  } else if (!results.results_entered) {
    throw new Error("No published results found for this round.");
  }
  const scoringScope = scope === "sprint" && results.results_entered ? "full" : scope;

  const { data: predictions, error: predictionsError } = await supabase
    .from("predictions")
    .select("user_id,race_round,picks,score,score_breakdown")
    .eq("race_round", raceRound);

  if (predictionsError) throw predictionsError;
  if (!predictions?.length) {
    return {
      raceRound,
      scope,
      repaired: 0,
      changedUsers: 0,
      changes: [],
      message: "No predictions were submitted for this round.",
    };
  }

  const recalculated = predictions.map((prediction) => {
    // Standard score uses the top-level picks (legacy free-mode behavior). The
    // mode-aware per-league scores are computed below and written separately.
    const { points, breakdown } = calculateRoundScore(prediction.picks || {}, results, { scope: scoringScope });
    const previousScore = toNumber(prediction.score);

    return {
      prediction,
      previousScore,
      nextScore: points,
      delta: points - previousScore,
      breakdown,
    };
  });

  for (const entry of recalculated) {
    const { error } = await supabase
      .from("predictions")
      .update({
        score: entry.nextScore,
        score_breakdown: entry.breakdown,
      })
      .eq("user_id", entry.prediction.user_id)
      .eq("race_round", raceRound);

    if (error) throw error;
  }

  // ─── Per-league mode-aware scoring ────────────────────────────────────────
  // For every prediction, pull each league submission embedded in
  // picks.__league_submissions and score it under that league's game mode +
  // settings. Write the result to league_round_scores so standings show the
  // mode-adjusted points.
  const leagueIdsSeen = new Set();
  for (const entry of recalculated) {
    const submissions = entry.prediction.picks?.__league_submissions || {};
    for (const id of Object.keys(submissions)) {
      if (isUuidLike(id)) leagueIdsSeen.add(id);
    }
  }
  const leagueSettingsById = new Map();
  if (leagueIdsSeen.size) {
    const { data: leagueRows } = await supabase
      .from("leagues")
      .select("id, settings, game_mode")
      .in("id", [...leagueIdsSeen]);
    for (const row of leagueRows || []) {
      leagueSettingsById.set(row.id, { settings: row.settings || {}, gameMode: row.game_mode || "standard" });
    }
  }

  const leagueScoreRows = [];
  for (const entry of recalculated) {
    const picksJson = entry.prediction.picks || {};
    const leagueSubmissions = picksJson?.__league_submissions || {};
    for (const [leagueId, submission] of Object.entries(leagueSubmissions)) {
      if (!isUuidLike(leagueId)) continue;
      const leagueMeta = leagueSettingsById.get(leagueId) || { settings: {}, gameMode: submission?.gameMode || "standard" };
      // The submission's own gameMode is the source of truth (what the user
      // saved against), but if missing fall back to the league's mode.
      const submissionWithMode = { ...submission, gameMode: submission?.gameMode || leagueMeta.gameMode };
      const { points, breakdown, gameMode } = scoreLeagueRound(submissionWithMode, results, {
        scope: scoringScope,
        leagueSettings: leagueMeta.settings,
      });
      leagueScoreRows.push({
        league_id:  leagueId,
        user_id:    entry.prediction.user_id,
        race_round: raceRound,
        score:      points,
        breakdown,
        game_mode:  gameMode,
        computed_at: new Date().toISOString(),
      });
    }
  }

  const leagueScoreKeys = new Set(
    leagueScoreRows.map((row) => `${row.league_id}:${row.user_id}:${row.race_round}`)
  );
  const recalculatedByUserId = new Map(
    recalculated.map((entry) => [entry.prediction.user_id, entry])
  );
  const scoringUserIds = [...recalculatedByUserId.keys()];
  if (scoringUserIds.length) {
    const { data: standardMemberships, error: membershipError } = await supabase
      .from("league_members")
      .select("user_id, league_id, status, leagues(id, game_mode, settings)")
      .in("user_id", scoringUserIds)
      .in("status", ["active", "eliminated"]);

    if (membershipError) {
      console.warn("[scoring] standard league membership fallback skipped:", membershipError.message);
    } else {
      for (const membership of standardMemberships || []) {
        const league = membership.leagues || {};
        if ((league.game_mode || "standard") !== "standard") continue;

        const key = `${membership.league_id}:${membership.user_id}:${raceRound}`;
        if (leagueScoreKeys.has(key)) continue;

        const entry = recalculatedByUserId.get(membership.user_id);
        if (!entry) continue;

        const { points, breakdown, gameMode } = scoreLeagueRound(
          { picks: entry.prediction.picks || {}, gameMode: "standard" },
          results,
          {
            scope: scoringScope,
            leagueSettings: league.settings || {},
          }
        );

        leagueScoreRows.push({
          league_id: membership.league_id,
          user_id: entry.prediction.user_id,
          race_round: raceRound,
          score: points,
          breakdown,
          game_mode: gameMode,
          computed_at: new Date().toISOString(),
        });
        leagueScoreKeys.add(key);
      }
    }
  }

  if (leagueScoreRows.length) {
    const { error: leagueScoreErr } = await supabase
      .from("league_round_scores")
      .upsert(leagueScoreRows, { onConflict: "league_id,user_id,race_round" });
    if (leagueScoreErr) {
      // Don't break the whole award if the per-league write fails — log only.
      console.warn("[scoring] league_round_scores upsert failed:", leagueScoreErr.message);
    }
  }

  // ─── Survival eliminations ────────────────────────────────────────────────
  // For every Survival league, find the unique lowest scorer this round and
  // mark them eliminated.
  try {
    const survivalLeagueIds = [...new Set(leagueScoreRows.map((row) => row.league_id))];
    if (survivalLeagueIds.length) {
      const { data: survivalLeagues } = await supabase
        .from("leagues")
        .select("id, settings")
        .in("id", survivalLeagueIds)
        .eq("game_mode", "survival")
        .eq("is_active", true);
      for (const league of survivalLeagues || []) {
        const scoresByUser = new Map(
          leagueScoreRows
            .filter((row) => row.league_id === league.id)
            .map((row) => [row.user_id, row.score])
        );
        // Ensure every active member has an entry — non-pickers count as 0.
        const { data: members } = await supabase
          .from("league_members")
          .select("user_id")
          .eq("league_id", league.id)
          .eq("status", "active");
        for (const m of members || []) {
          if (!scoresByUser.has(m.user_id)) scoresByUser.set(m.user_id, 0);
        }
        const toEliminate = pickSurvivalEliminations({
          leagueSettings: league.settings || {},
          scoresByUser,
          raceRound,
        });
        if (toEliminate.length) {
          // Resolve race_round → race id for eliminated_at_race_id stamp.
          const { data: raceRow } = await supabase
            .from("races")
            .select("id")
            .eq("round", raceRound)
            .maybeSingle();
          await supabase
            .from("league_members")
            .update({ status: "eliminated", eliminated_at_race_id: raceRow?.id || null })
            .eq("league_id", league.id)
            .in("user_id", toEliminate);
        }
      }
    }
  } catch (err) {
    console.warn("[scoring] survival elimination failed:", err?.message || err);
  }

  const deltasByUser = recalculated.reduce((map, entry) => {
    const current = map.get(entry.prediction.user_id) || 0;
    map.set(entry.prediction.user_id, current + entry.delta);
    return map;
  }, new Map());

  const userIds = [...new Set(recalculated.map((entry) => entry.prediction.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,username,points")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const changes = [];

  for (const userId of userIds) {
    const profile = profileMap.get(userId);
    const delta = deltasByUser.get(userId) || 0;
    const previousPoints = toNumber(profile?.points);
    const nextPoints = previousPoints + delta;

    if (delta !== 0) {
      const { error } = await supabase
        .from("profiles")
        .update({ points: nextPoints })
        .eq("id", userId);

      if (error) throw error;
    }

    const roundEntry = recalculated.find((entry) => entry.prediction.user_id === userId);
    changes.push({
      user_id: userId,
      username: profile?.username || userId,
      previousScore: roundEntry?.previousScore || 0,
      nextScore: roundEntry?.nextScore || 0,
      previousPoints,
      nextPoints,
      delta,
    });
  }

  return {
    raceRound,
    scope,
    scoringScope,
    repaired: changes.length,
    changedUsers: changes.filter((item) => item.delta !== 0).length,
    changes: changes.sort((left, right) => right.nextPoints - left.nextPoints),
    message: changes.some((item) => item.delta !== 0)
      ? `Awarded or repaired ${scope === "sprint" ? "sprint " : ""}scores for ${changes.length} predictions.`
      : `Rechecked ${changes.length} predictions. Stored scores already matched the ${scope === "sprint" ? "sprint" : "published"} results.`,
  };
}
