import { WC_SCORING, WC_STAGE_SCORING } from "@/src/constants/wc/scoring";
import { WC_TEAM_BY_CODE } from "@/src/constants/wc/teams";

export function wcMatchOutcome(homeScore, awayScore) {
  const home = Number(homeScore);
  const away = Number(awayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

function numberOrNull(value) {
  const next = Number(value);
  return Number.isInteger(next) && next >= 0 ? next : null;
}

// Normalize a player name for fuzzy scorer matching. Lowercase, strip
// diacritics, strip non-letters, and prefer the last whitespace token
// so "Kylian Mbappé" → "mbappe". This lets a user typing a last name
// match a feed entry that includes a first name.
export function normalizeScorerName(value) {
  if (!value || typeof value !== "string") return "";
  const cleaned = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) return "";
  const tokens = cleaned.split(" ");
  return tokens[tokens.length - 1];
}

function stageRow(stage) {
  return WC_STAGE_SCORING[stage] || WC_STAGE_SCORING.group;
}

export function isCompletedWcMatch(match) {
  return match?.status === "completed"
    && numberOrNull(match?.home_score) !== null
    && numberOrNull(match?.away_score) !== null;
}

export function wcGroupCompletedMatchCount(matches = [], groupCode) {
  return matches.filter((match) =>
    match.stage === "group"
    && match.group_code === groupCode
    && isCompletedWcMatch(match)
  ).length;
}

export function isWcGroupComplete(matches = [], groupCode) {
  return wcGroupCompletedMatchCount(matches, groupCode) >= 6;
}

export function scoreWcMatchPrediction(prediction, match) {
  const breakdown = [];
  if (!isCompletedWcMatch(match)) {
    return { points: 0, breakdown };
  }

  const homeScore = numberOrNull(match?.home_score);
  const awayScore = numberOrNull(match?.away_score);
  const predictedHome = numberOrNull(prediction?.predicted_home_score);
  const predictedAway = numberOrNull(prediction?.predicted_away_score);

  if (homeScore === null || awayScore === null || predictedHome === null || predictedAway === null) {
    return { points: 0, breakdown };
  }

  const stage = match?.stage || "group";
  const rules = stageRow(stage);
  const knockout = stage !== "group";

  const actualOutcome = wcMatchOutcome(homeScore, awayScore);
  const predictedOutcome = wcMatchOutcome(predictedHome, predictedAway);
  let points = 0;

  if (knockout) {
    const predictedWinner = prediction?.predicted_winner_team_code || (
      predictedOutcome === "home" ? match?.home_team_code : predictedOutcome === "away" ? match?.away_team_code : null
    );
    const actualWinner = match?.winner_team_code || (
      actualOutcome === "home" ? match?.home_team_code : actualOutcome === "away" ? match?.away_team_code : null
    );

    if (predictedWinner && actualWinner && predictedWinner === actualWinner) {
      points += rules.outcome;
      breakdown.push({ label: "Correct advancer", pts: rules.outcome });
    }
  } else if (predictedOutcome === actualOutcome) {
    points += rules.outcome;
    breakdown.push({ label: "Correct outcome", pts: rules.outcome });
  }

  if (predictedHome === homeScore && predictedAway === awayScore) {
    points += rules.exact;
    breakdown.push({ label: "Exact score", pts: rules.exact });
  } else if (!knockout && rules.gd && predictedHome - predictedAway === homeScore - awayScore) {
    points += rules.gd;
    breakdown.push({ label: "Goal difference", pts: rules.gd });
  }

  const scorerPick = normalizeScorerName(prediction?.predicted_scorer_name);
  if (scorerPick && match?.scorers && typeof match.scorers === "object") {
    const pool = [
      ...(Array.isArray(match.scorers.home) ? match.scorers.home : []),
      ...(Array.isArray(match.scorers.away) ? match.scorers.away : []),
    ].map((name) => normalizeScorerName(name));
    if (pool.includes(scorerPick)) {
      points += rules.scorer;
      breakdown.push({ label: "Goalscorer", pts: rules.scorer });
    }
  }

  return { points, breakdown };
}

export function buildWcGroupTables(matches = []) {
  const tables = new Map();

  const ensureTeam = (group, code, name) => {
    if (!group || !code) return null;
    if (!tables.has(group)) tables.set(group, new Map());
    const groupTable = tables.get(group);
    if (!groupTable.has(code)) {
      groupTable.set(code, {
        code,
        name,
        group,
        seed: WC_TEAM_BY_CODE[code]?.seed || 99,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
      });
    }
    return groupTable.get(code);
  };

  matches.filter((match) => match.stage === "group").forEach((match) => {
    if (!isCompletedWcMatch(match)) return;

    const home = ensureTeam(match.group_code, match.home_team_code, match.home_label);
    const away = ensureTeam(match.group_code, match.away_team_code, match.away_label);
    const homeScore = numberOrNull(match.home_score);
    const awayScore = numberOrNull(match.away_score);
    if (!home || !away || homeScore === null || awayScore === null) return;

    home.played += 1;
    away.played += 1;
    home.gf += homeScore;
    home.ga += awayScore;
    away.gf += awayScore;
    away.ga += homeScore;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    if (homeScore > awayScore) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (awayScore > homeScore) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return Object.fromEntries(
    [...tables.entries()].map(([group, groupTable]) => [
      group,
      [...groupTable.values()].sort((left, right) =>
        right.points - left.points
        || right.gd - left.gd
        || right.gf - left.gf
        || left.seed - right.seed
        || left.name.localeCompare(right.name)
      ),
    ])
  );
}

// Best-third-place table. WC 2026 advances the top 8 third-placed
// teams across all 12 groups into the Round of 32, ranked by the
// same FIFA tiebreakers we use for group sort.
export function buildWcThirdPlaceTable(groupTables) {
  const tables = groupTables || {};
  const thirdPlaceRows = Object.values(tables)
    .map((rows) => rows?.[2])
    .filter(Boolean)
    .sort((left, right) =>
      right.points - left.points
      || right.gd - left.gd
      || right.gf - left.gf
      || left.seed - right.seed
      || left.name.localeCompare(right.name)
    )
    .map((row, index) => ({ ...row, rank: index + 1, advancing: index < 8 }));
  return thirdPlaceRows;
}

export function scoreWcBracketPrediction(prediction, matches = [], awards = {}) {
  const picks = prediction?.picks || {};
  const groupTables = buildWcGroupTables(matches);
  const breakdown = [];
  let points = 0;

  Object.entries(groupTables).forEach(([group, rows]) => {
    if (!isWcGroupComplete(matches, group)) return;

    const winner = rows[0]?.code;
    const runner = rows[1]?.code;
    const pickedWinner = picks.groupWinners?.[group];
    const pickedRunner = picks.groupRunnersUp?.[group];

    if (pickedWinner && (pickedWinner === winner || pickedWinner === runner)) {
      points += WC_SCORING.groupQualifier;
      breakdown.push({ label: `Group ${group} qualifier`, pts: WC_SCORING.groupQualifier });
    }

    if (pickedRunner && (pickedRunner === winner || pickedRunner === runner)) {
      points += WC_SCORING.groupQualifier;
      breakdown.push({ label: `Group ${group} qualifier`, pts: WC_SCORING.groupQualifier });
    }

    if (pickedWinner && pickedWinner === winner) {
      points += WC_SCORING.exactGroupWinner;
      breakdown.push({ label: `Group ${group} winner`, pts: WC_SCORING.exactGroupWinner });
    }
  });

  const final = matches.find((match) => match.stage === "final" && match.winner_team_code);
  if (final?.winner_team_code && picks.champion === final.winner_team_code) {
    points += WC_SCORING.champion;
    breakdown.push({ label: "Champion", pts: WC_SCORING.champion });
  }

  if (awards.goldenBoot && picks.goldenBoot && String(picks.goldenBoot).trim().toLowerCase() === String(awards.goldenBoot).trim().toLowerCase()) {
    points += WC_SCORING.goldenBoot;
    breakdown.push({ label: "Golden Boot", pts: WC_SCORING.goldenBoot });
  }

  if (awards.goldenBall && picks.goldenBall && String(picks.goldenBall).trim().toLowerCase() === String(awards.goldenBall).trim().toLowerCase()) {
    points += WC_SCORING.goldenBall;
    breakdown.push({ label: "Golden Ball", pts: WC_SCORING.goldenBall });
  }

  return { points, breakdown };
}
