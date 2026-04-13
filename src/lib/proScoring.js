import "server-only";

/**
 * Pro game mode scoring engine.
 *
 * All scoring runs server-side after race results are entered.
 * The existing predictions/race_results system is unchanged.
 * This engine works with the new `picks` table and `races` table.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Default league settings
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PICK_WEIGHTS = {
  pole:        1,
  winner:      2,
  p2:          1,
  p3:          1,
  fastest_lap: 1,
  dnf:         1,
};

function getPickWeights(settings) {
  return { ...DEFAULT_PICK_WEIGHTS, ...(settings?.pick_weights ?? {}) };
}

function getDoublePointsRaces(settings) {
  return new Set(settings?.double_points_races ?? []);
}

function getSprintMultiplier(settings, isSprint) {
  if (!isSprint) return 1;
  if (settings?.sprint_multiplier === undefined) return 0.5;
  return settings.sprint_multiplier;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.1 Standard mode scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a single pick in Standard mode.
 *
 * @param {{ pick_type: string, picked_value: string, is_correct: boolean }} pick
 * @param {object} settings  League settings JSONB
 * @param {boolean} isSprint Is this a sprint race?
 * @param {boolean} isDoublePoints Is this a double-points race?
 * @returns {number}
 */
export function scoreStandardPick(pick, settings, isSprint = false, isDoublePoints = false) {
  if (!pick.is_correct) return 0;
  const weights      = getPickWeights(settings);
  const weight       = weights[pick.pick_type] ?? 1;
  const sprintMult   = getSprintMultiplier(settings, isSprint);
  const doublePoints = isDoublePoints ? 2 : 1;
  return Math.round(weight * sprintMult * doublePoints);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.4 Double Down mode scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a pick in Double Down mode.
 * Exactly one pick per race must have is_double_down = true.
 * Correct double-down → weight * 3; incorrect double-down → -1.
 */
export function scoreDoubleDownPick(pick, settings, isSprint = false) {
  if (!pick.is_double_down) {
    // Normal pick — standard scoring
    return scoreStandardPick(pick, settings, isSprint, false);
  }
  if (pick.is_correct) {
    const weights = getPickWeights(settings);
    const weight  = weights[pick.pick_type] ?? 1;
    return weight * 3;
  }
  return -1; // Incorrect double-down
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.6 Budget Picks mode scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a pick in Budget Picks mode.
 * is_correct → +bet_amount; incorrect → -bet_amount.
 */
export function scoreBudgetPick(pick) {
  const bet = pick.bet_amount ?? 0;
  if (pick.is_correct) return bet;
  return -bet;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate Double Down picks for a user/race.
 * Returns an error string or null if valid.
 *
 * @param {Array<{ is_double_down: boolean }>} picks
 * @returns {string|null}
 */
export function validateDoubleDown(picks) {
  const ddCount = picks.filter((p) => p.is_double_down).length;
  if (ddCount === 0) return "Exactly one Double Down pick is required.";
  if (ddCount > 1)  return `Only one Double Down pick allowed, but ${ddCount} were submitted.`;
  return null;
}

/**
 * Validate Budget Picks totals for a user/race.
 * Each bet must be 1–20 and the sum must equal exactly 50.
 *
 * @param {Array<{ bet_amount: number }>} picks
 * @returns {string|null}
 */
export function validateBudgetPicks(picks) {
  for (const pick of picks) {
    const bet = pick.bet_amount;
    if (!Number.isInteger(bet) || bet < 1 || bet > 20) {
      return `Each bet must be between 1 and 20. Got: ${bet}`;
    }
  }
  const total = picks.reduce((sum, p) => sum + (p.bet_amount ?? 0), 0);
  if (total !== 50) return `Budget bets must sum to exactly 50. Got: ${total}`;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Correctness checking — compare picked_value against race_results
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a single pick row and the race_results row, determine is_correct.
 * The race_results table (existing) uses field names compatible with the
 * existing scoring system.
 *
 * @param {{ pick_type: string, picked_value: string }} pick
 * @param {object} results  Row from race_results table
 * @returns {boolean}
 */
export function isPickCorrect(pick, results) {
  if (!results || !pick.picked_value) return false;

  switch (pick.pick_type) {
    case "pole":        return results.pole         === pick.picked_value;
    case "winner":      return results.winner       === pick.picked_value;
    case "p2":          return results.p2           === pick.picked_value;
    case "p3":          return results.p3           === pick.picked_value;
    case "fastest_lap": return results.fastest_lap  === pick.picked_value;
    case "dnf": {
      // DNF: any of the dnf_drivers matches
      const dnfs = Array.isArray(results.dnf_drivers) ? results.dnf_drivers : [];
      return dnfs.includes(pick.picked_value);
    }
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main scoring runner — called after race results are entered
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score all picks for a given race across all Pro leagues.
 * Handles all game modes. Called server-side after awardRoundPoints.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase  Admin client
 * @param {string} raceId  UUID of the race in the `races` table
 * @returns {Promise<{ scored: number, errors: string[] }>}
 */
export async function scoreRacePicks(supabase, raceId) {
  const errors = [];
  let scored = 0;

  // 1. Fetch the race and its results
  const { data: race, error: raceErr } = await supabase
    .from("races")
    .select("*")
    .eq("id", raceId)
    .single();

  if (raceErr || !race) {
    return { scored: 0, errors: [`Race ${raceId} not found`] };
  }

  // Look up results via race_round + season (existing race_results table)
  const { data: results, error: resultsErr } = await supabase
    .from("race_results")
    .select("*")
    .eq("race_round", race.round)
    .single();

  if (resultsErr || !results || !results.results_entered) {
    return { scored: 0, errors: [`No published results for round ${race.round}`] };
  }

  // 2. Fetch all picks for this race
  const { data: picks, error: picksErr } = await supabase
    .from("picks")
    .select("*")
    .eq("race_id", raceId);

  if (picksErr) return { scored: 0, errors: [picksErr.message] };
  if (!picks?.length) return { scored: 0, errors: [] };

  // 3. Group picks by user
  const userPickMap = new Map();
  for (const pick of picks) {
    if (!userPickMap.has(pick.user_id)) userPickMap.set(pick.user_id, []);
    userPickMap.get(pick.user_id).push(pick);
  }

  // 4. For each user, determine their league(s) and game mode(s)
  const userIds = [...userPickMap.keys()];
  const { data: memberships } = await supabase
    .from("league_members")
    .select("user_id, league_id, leagues(id, game_mode, settings, season)")
    .in("user_id", userIds)
    .eq("status", "active");

  // Map: userId → array of { league_id, game_mode, settings }
  const userLeagueMap = new Map();
  for (const m of memberships ?? []) {
    if (!userLeagueMap.has(m.user_id)) userLeagueMap.set(m.user_id, []);
    if (m.leagues?.season === race.season) {
      userLeagueMap.get(m.user_id).push({
        league_id: m.league_id,
        game_mode: m.leagues.game_mode,
        settings:  m.leagues.settings,
      });
    }
  }

  const isDouble = getDoublePointsRaces(null).has(race.round);

  // 5. Score each pick
  for (const [userId, userPicks] of userPickMap) {
    const leagues = userLeagueMap.get(userId) ?? [];
    // If user is in multiple leagues, score picks for each game mode
    // (In practice, each pick set maps to one race, one game mode per league)
    // For simplicity: score once using the first league's game mode
    const league   = leagues[0];
    const gameMode = league?.game_mode ?? "standard";
    const settings = league?.settings ?? {};

    for (const pick of userPicks) {
      const correct = isPickCorrect(pick, results);
      let points = 0;

      switch (gameMode) {
        case "double_down":
          points = scoreDoubleDownPick({ ...pick, is_correct: correct }, settings, race.is_sprint);
          break;
        case "budget_picks":
          points = scoreBudgetPick({ ...pick, is_correct: correct });
          break;
        case "survival":
        case "draft":
        case "head_to_head":
        case "standard":
        default:
          points = scoreStandardPick({ ...pick, is_correct: correct }, settings, race.is_sprint, isDouble);
          break;
      }

      const { error: updateErr } = await supabase
        .from("picks")
        .update({ is_correct: correct, points_earned: points })
        .eq("id", pick.id);

      if (updateErr) {
        errors.push(`Failed to update pick ${pick.id}: ${updateErr.message}`);
      } else {
        scored++;
      }
    }
  }

  // 6. Survival mode — run elimination check
  await runSurvivalElimination(supabase, raceId, race.round).catch((err) => {
    errors.push(`Survival elimination error: ${err.message}`);
  });

  return { scored, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.2 Survival Mode — post-race elimination
// ─────────────────────────────────────────────────────────────────────────────

/**
 * After scoring, eliminate the lowest-scorer in each Survival league.
 * Ties = no elimination that race.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} raceId
 * @param {number} raceRound
 */
async function runSurvivalElimination(supabase, raceId, raceRound) {
  // Find all survival leagues
  const { data: survivalLeagues } = await supabase
    .from("leagues")
    .select("id, settings")
    .eq("game_mode", "survival")
    .eq("is_active", true);

  if (!survivalLeagues?.length) return;

  for (const league of survivalLeagues) {
    const eliminationStartRound = league.settings?.elimination_starts_round ?? 3;
    if (raceRound < eliminationStartRound) continue;

    // Get active members
    const { data: members } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", league.id)
      .eq("status", "active");

    if (!members?.length || members.length <= 1) continue;

    const memberIds = members.map((m) => m.user_id);

    // Sum points_earned for this race per member
    const { data: racePicks } = await supabase
      .from("picks")
      .select("user_id, points_earned")
      .eq("race_id", raceId)
      .in("user_id", memberIds);

    const scoreMap = new Map();
    for (const pick of racePicks ?? []) {
      const prev = scoreMap.get(pick.user_id) ?? 0;
      scoreMap.set(pick.user_id, prev + (pick.points_earned ?? 0));
    }

    // Ensure all members have a score (0 if no picks)
    for (const id of memberIds) {
      if (!scoreMap.has(id)) scoreMap.set(id, 0);
    }

    const scores = [...scoreMap.entries()].sort(([, a], [, b]) => a - b);
    const minScore = scores[0][1];
    const lowestScorers = scores.filter(([, s]) => s === minScore);

    // Tie = no elimination
    if (lowestScorers.length > 1) continue;

    const eliminatedUserId = lowestScorers[0][0];
    await supabase
      .from("league_members")
      .update({ status: "eliminated", eliminated_at_race_id: raceId })
      .eq("league_id", league.id)
      .eq("user_id", eliminatedUserId);
  }
}
