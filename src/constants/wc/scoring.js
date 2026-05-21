// Legacy flat scoring values. Still used by bracket prediction
// scoring (champion, golden boot/ball, group qualifier). Match
// scoring now uses WC_STAGE_SCORING below.
export const WC_SCORING = {
  groupOutcome: 3,
  groupExactScore: 2,
  groupGoalDifference: 1,
  knockoutAdvancer: 5,
  knockoutExactScore: 2,
  groupQualifier: 2,
  exactGroupWinner: 2,
  champion: 20,
  goldenBoot: 12,
  goldenBall: 12,
};

// Per-stage match prediction points. Outcomes get heavier the deeper
// into the tournament you go. `gd` (goal difference) is only awarded
// in the group stage — knockouts skip it.
export const WC_STAGE_SCORING = {
  group:        { outcome: 3,  exact: 2,  scorer: 2, gd: 1 },
  round_of_32:  { outcome: 5,  exact: 3,  scorer: 3 },
  round_of_16:  { outcome: 7,  exact: 3,  scorer: 3 },
  quarterfinal: { outcome: 10, exact: 4,  scorer: 4 },
  semifinal:    { outcome: 15, exact: 5,  scorer: 5 },
  third_place:  { outcome: 8,  exact: 3,  scorer: 3 },
  final:        { outcome: 25, exact: 10, scorer: 10 },
};

// Per-round survivor points. Surviving deeper rounds is worth far
// more than getting a group-stage matchday right.
export const WC_SURVIVOR_STAGE_POINTS = {
  group_md1: 3,
  group_md2: 3,
  group_md3: 3,
  round_of_32: 5,
  round_of_16: 8,
  quarterfinal: 12,
  semifinal: 18,
  final: 30,
};
