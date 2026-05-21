// Survivor pool reference data and helpers.
// Each round maps to a `match_number` range from the canonical WC fixture
// list (group stage is 1..72, knockouts begin at 73). The matchday breakdown
// for groups is a 24-match window so every team plays once per matchday.

import { WC_SURVIVOR_STAGE_POINTS } from "@/src/constants/wc/scoring";

export const WC_SURVIVOR_ROUND_KEYS = [
  "group_md1",
  "group_md2",
  "group_md3",
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "final",
];

export const WC_SURVIVOR_ROUNDS = {
  group_md1: { label: "Matchday 1", stage: "group", matchStart: 1, matchEnd: 24 },
  group_md2: { label: "Matchday 2", stage: "group", matchStart: 25, matchEnd: 48 },
  group_md3: { label: "Matchday 3", stage: "group", matchStart: 49, matchEnd: 72 },
  round_of_32: { label: "Round of 32", stage: "round_of_32" },
  round_of_16: { label: "Round of 16", stage: "round_of_16" },
  quarterfinal: { label: "Quarter-finals", stage: "quarterfinal" },
  semifinal: { label: "Semi-finals", stage: "semifinal" },
  final: { label: "Final", stage: "final" },
};

export function matchInSurvivorRound(match, roundKey) {
  const round = WC_SURVIVOR_ROUNDS[roundKey];
  if (!round || !match) return false;
  if (match.stage !== round.stage) return false;
  if (round.matchStart && Number(match.match_number) < round.matchStart) return false;
  if (round.matchEnd && Number(match.match_number) > round.matchEnd) return false;
  return true;
}

export function findSurvivorMatchForTeam(matches, roundKey, teamCode) {
  if (!teamCode) return null;
  return [...matches].sort((a, b) => {
    const aNumber = Number(a.match_number || 0);
    const bNumber = Number(b.match_number || 0);
    return aNumber - bNumber;
  }).find((match) =>
    matchInSurvivorRound(match, roundKey)
    && (match.home_team_code === teamCode || match.away_team_code === teamCode)
  ) || null;
}

// Survivor scoring (per-stage points scale up with the round):
//   Win  → +WC_SURVIVOR_STAGE_POINTS[round], status='correct'
//   Draw → 0 pts, status='eliminated'
//   Loss → 0 pts, status='eliminated'
// We only score once the underlying match is completed.
export function scoreSurvivorPick(pick, match) {
  if (!pick || !match || match.status !== "completed") {
    return { points: null, status: "pending" };
  }
  const home = Number(match.home_score);
  const away = Number(match.away_score);
  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    return { points: null, status: "pending" };
  }
  const isHome = match.home_team_code === pick.picked_team_code;
  const isAway = match.away_team_code === pick.picked_team_code;
  if (!isHome && !isAway) {
    return { points: 0, status: "eliminated" };
  }
  const won = (isHome && home > away) || (isAway && away > home);
  const winPoints = WC_SURVIVOR_STAGE_POINTS[pick.round_key] ?? 5;
  return won
    ? { points: winPoints, status: "correct" }
    : { points: 0, status: "eliminated" };
}

// Server-side helper: given a completed match and the supabase admin client,
// score every survivor pick attached to it. Returns the count of picks
// rescored. Used by the publish/sync/full-rescore flows.
export async function rescoreSurvivorPicksForMatch(supabase, match) {
  if (!match || match.status !== "completed") return 0;
  const { data: picks, error } = await supabase
    .from("wc_survivor_picks")
    .select("*")
    .eq("match_id", match.id);
  if (error) throw error;
  let count = 0;
  for (const pick of picks || []) {
    const result = scoreSurvivorPick(pick, match);
    const { error: updateError } = await supabase
      .from("wc_survivor_picks")
      .update({
        points: result.points,
        status: result.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pick.id);
    if (updateError) throw updateError;
    count += 1;
  }
  return count;
}

// Once a user is eliminated in any prior round, every future round is
// frozen as "eliminated" too — this is how survivor pools work.
export function applySurvivorElimination(picks) {
  const ordered = WC_SURVIVOR_ROUND_KEYS;
  let eliminated = false;
  return ordered.map((key) => {
    const pick = picks.find((p) => p.round_key === key) || null;
    if (!pick) return null;
    if (eliminated && pick.status !== "eliminated") {
      return { ...pick, status: "eliminated" };
    }
    if (pick.status === "eliminated") {
      eliminated = true;
    }
    return pick;
  }).filter(Boolean);
}
