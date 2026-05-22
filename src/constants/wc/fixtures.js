import { WC_TEAM_BY_CODE, WC_YEAR } from "@/src/constants/wc/teams";

export const WC_FIXTURE_SOURCE_NOTE = "Official FIFA World Cup 26 match schedule, published April 2026.";

const VENUES = {
  VANCOUVER: { venue: "BC Place", city: "Vancouver", country: "Canada" },
  SEATTLE: { venue: "Lumen Field", city: "Seattle", country: "United States" },
  SAN_FRANCISCO_BAY_AREA: { venue: "Levi's Stadium", city: "Santa Clara", country: "United States" },
  LOS_ANGELES: { venue: "SoFi Stadium", city: "Inglewood", country: "United States" },
  GUADALAJARA: { venue: "Estadio Akron", city: "Zapopan", country: "Mexico" },
  MEXICO_CITY: { venue: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
  MONTERREY: { venue: "Estadio BBVA", city: "Guadalupe", country: "Mexico" },
  HOUSTON: { venue: "NRG Stadium", city: "Houston", country: "United States" },
  DALLAS: { venue: "AT&T Stadium", city: "Arlington", country: "United States" },
  KANSAS_CITY: { venue: "Arrowhead Stadium", city: "Kansas City", country: "United States" },
  ATLANTA: { venue: "Mercedes-Benz Stadium", city: "Atlanta", country: "United States" },
  MIAMI: { venue: "Hard Rock Stadium", city: "Miami Gardens", country: "United States" },
  TORONTO: { venue: "BMO Field", city: "Toronto", country: "Canada" },
  BOSTON: { venue: "Gillette Stadium", city: "Foxborough", country: "United States" },
  PHILADELPHIA: { venue: "Lincoln Financial Field", city: "Philadelphia", country: "United States" },
  NEW_YORK_NEW_JERSEY: { venue: "MetLife Stadium", city: "East Rutherford", country: "United States" },
};

const WC_OFFICIAL_FIXTURE_ROWS = [
  [1, "group", "A", "MEX", "RSA", "2026-06-11T19:00:00Z", "MEXICO_CITY"],
  [2, "group", "A", "KOR", "CZE", "2026-06-12T02:00:00Z", "GUADALAJARA"],
  [3, "group", "B", "CAN", "BIH", "2026-06-12T19:00:00Z", "TORONTO"],
  [4, "group", "D", "USA", "PAR", "2026-06-13T01:00:00Z", "LOS_ANGELES"],
  [5, "group", "C", "HAI", "SCO", "2026-06-14T01:00:00Z", "BOSTON"],
  [6, "group", "D", "AUS", "TUR", "2026-06-14T04:00:00Z", "VANCOUVER"],
  [7, "group", "C", "BRA", "MAR", "2026-06-13T22:00:00Z", "NEW_YORK_NEW_JERSEY"],
  [8, "group", "B", "QAT", "SUI", "2026-06-13T19:00:00Z", "SAN_FRANCISCO_BAY_AREA"],
  [9, "group", "E", "CIV", "ECU", "2026-06-14T23:00:00Z", "PHILADELPHIA"],
  [10, "group", "E", "GER", "CUW", "2026-06-14T17:00:00Z", "HOUSTON"],
  [11, "group", "F", "NED", "JPN", "2026-06-14T20:00:00Z", "DALLAS"],
  [12, "group", "F", "SWE", "TUN", "2026-06-15T02:00:00Z", "MONTERREY"],
  [13, "group", "H", "KSA", "URU", "2026-06-15T22:00:00Z", "MIAMI"],
  [14, "group", "H", "ESP", "CPV", "2026-06-15T16:00:00Z", "ATLANTA"],
  [15, "group", "G", "IRN", "NZL", "2026-06-16T01:00:00Z", "LOS_ANGELES"],
  [16, "group", "G", "BEL", "EGY", "2026-06-15T19:00:00Z", "SEATTLE"],
  [17, "group", "I", "FRA", "SEN", "2026-06-16T19:00:00Z", "NEW_YORK_NEW_JERSEY"],
  [18, "group", "I", "IRQ", "NOR", "2026-06-16T22:00:00Z", "BOSTON"],
  [19, "group", "J", "ARG", "ALG", "2026-06-17T01:00:00Z", "KANSAS_CITY"],
  [20, "group", "J", "AUT", "JOR", "2026-06-17T04:00:00Z", "SAN_FRANCISCO_BAY_AREA"],
  [21, "group", "L", "GHA", "PAN", "2026-06-17T23:00:00Z", "TORONTO"],
  [22, "group", "L", "ENG", "CRO", "2026-06-17T20:00:00Z", "DALLAS"],
  [23, "group", "K", "POR", "COD", "2026-06-17T17:00:00Z", "HOUSTON"],
  [24, "group", "K", "UZB", "COL", "2026-06-18T02:00:00Z", "MEXICO_CITY"],
  [25, "group", "A", "CZE", "RSA", "2026-06-18T16:00:00Z", "ATLANTA"],
  [26, "group", "B", "SUI", "BIH", "2026-06-18T19:00:00Z", "LOS_ANGELES"],
  [27, "group", "B", "CAN", "QAT", "2026-06-18T22:00:00Z", "VANCOUVER"],
  [28, "group", "A", "MEX", "KOR", "2026-06-19T01:00:00Z", "GUADALAJARA"],
  [29, "group", "C", "BRA", "HAI", "2026-06-20T00:30:00Z", "PHILADELPHIA"],
  [30, "group", "C", "SCO", "MAR", "2026-06-19T22:00:00Z", "BOSTON"],
  [31, "group", "D", "TUR", "PAR", "2026-06-20T03:00:00Z", "SAN_FRANCISCO_BAY_AREA"],
  [32, "group", "D", "USA", "AUS", "2026-06-19T22:00:00Z", "SEATTLE"],
  [33, "group", "E", "GER", "CIV", "2026-06-20T20:00:00Z", "TORONTO"],
  [34, "group", "E", "ECU", "CUW", "2026-06-21T00:00:00Z", "KANSAS_CITY"],
  [35, "group", "F", "NED", "SWE", "2026-06-20T17:00:00Z", "HOUSTON"],
  [36, "group", "F", "TUN", "JPN", "2026-06-21T04:00:00Z", "MONTERREY"],
  [37, "group", "H", "URU", "CPV", "2026-06-21T22:00:00Z", "MIAMI"],
  [38, "group", "H", "ESP", "KSA", "2026-06-21T16:00:00Z", "ATLANTA"],
  [39, "group", "G", "BEL", "IRN", "2026-06-21T19:00:00Z", "LOS_ANGELES"],
  [40, "group", "G", "NZL", "EGY", "2026-06-22T01:00:00Z", "VANCOUVER"],
  [41, "group", "I", "NOR", "SEN", "2026-06-23T00:00:00Z", "NEW_YORK_NEW_JERSEY"],
  [42, "group", "I", "FRA", "IRQ", "2026-06-22T21:00:00Z", "PHILADELPHIA"],
  [43, "group", "J", "ARG", "AUT", "2026-06-22T17:00:00Z", "DALLAS"],
  [44, "group", "J", "JOR", "ALG", "2026-06-23T03:00:00Z", "SAN_FRANCISCO_BAY_AREA"],
  [45, "group", "L", "ENG", "GHA", "2026-06-23T20:00:00Z", "BOSTON"],
  [46, "group", "L", "PAN", "CRO", "2026-06-23T23:00:00Z", "TORONTO"],
  [47, "group", "K", "POR", "UZB", "2026-06-23T17:00:00Z", "HOUSTON"],
  [48, "group", "K", "COL", "COD", "2026-06-24T02:00:00Z", "GUADALAJARA"],
  [49, "group", "C", "SCO", "BRA", "2026-06-24T22:00:00Z", "MIAMI"],
  [50, "group", "C", "MAR", "HAI", "2026-06-24T22:00:00Z", "ATLANTA"],
  [51, "group", "B", "SUI", "CAN", "2026-06-24T19:00:00Z", "VANCOUVER"],
  [52, "group", "B", "BIH", "QAT", "2026-06-24T19:00:00Z", "SEATTLE"],
  [53, "group", "A", "CZE", "MEX", "2026-06-25T01:00:00Z", "MEXICO_CITY"],
  [54, "group", "A", "RSA", "KOR", "2026-06-25T01:00:00Z", "MONTERREY"],
  [55, "group", "E", "CUW", "CIV", "2026-06-25T20:00:00Z", "PHILADELPHIA"],
  [56, "group", "E", "ECU", "GER", "2026-06-25T20:00:00Z", "NEW_YORK_NEW_JERSEY"],
  [57, "group", "F", "JPN", "SWE", "2026-06-25T23:00:00Z", "DALLAS"],
  [58, "group", "F", "TUN", "NED", "2026-06-25T23:00:00Z", "KANSAS_CITY"],
  [59, "group", "D", "TUR", "USA", "2026-06-26T02:00:00Z", "LOS_ANGELES"],
  [60, "group", "D", "PAR", "AUS", "2026-06-26T02:00:00Z", "SAN_FRANCISCO_BAY_AREA"],
  [61, "group", "I", "NOR", "FRA", "2026-06-26T19:00:00Z", "BOSTON"],
  [62, "group", "I", "SEN", "IRQ", "2026-06-26T19:00:00Z", "TORONTO"],
  [63, "group", "G", "EGY", "IRN", "2026-06-27T03:00:00Z", "SEATTLE"],
  [64, "group", "G", "NZL", "BEL", "2026-06-27T03:00:00Z", "VANCOUVER"],
  [65, "group", "H", "CPV", "KSA", "2026-06-27T00:00:00Z", "HOUSTON"],
  [66, "group", "H", "URU", "ESP", "2026-06-27T00:00:00Z", "GUADALAJARA"],
  [67, "group", "L", "PAN", "ENG", "2026-06-27T21:00:00Z", "NEW_YORK_NEW_JERSEY"],
  [68, "group", "L", "CRO", "GHA", "2026-06-27T21:00:00Z", "PHILADELPHIA"],
  [69, "group", "J", "ALG", "AUT", "2026-06-28T02:00:00Z", "KANSAS_CITY"],
  [70, "group", "J", "JOR", "ARG", "2026-06-28T02:00:00Z", "DALLAS"],
  [71, "group", "K", "COL", "POR", "2026-06-27T23:30:00Z", "MIAMI"],
  [72, "group", "K", "COD", "UZB", "2026-06-27T23:30:00Z", "ATLANTA"],
  [73, "round_of_32", null, null, null, "2026-06-28T19:00:00Z", "LOS_ANGELES", "Runner-up Group A", "Runner-up Group B"],
  [74, "round_of_32", null, null, null, "2026-06-29T20:30:00Z", "BOSTON", "Winner Group E", "Third Group A/B/C/D/F"],
  [75, "round_of_32", null, null, null, "2026-06-30T01:00:00Z", "MONTERREY", "Winner Group F", "Runner-up Group C"],
  [76, "round_of_32", null, null, null, "2026-06-29T17:00:00Z", "HOUSTON", "Winner Group C", "Runner-up Group F"],
  [77, "round_of_32", null, null, null, "2026-06-30T21:00:00Z", "NEW_YORK_NEW_JERSEY", "Winner Group I", "Third Group C/D/F/G/H"],
  [78, "round_of_32", null, null, null, "2026-06-30T17:00:00Z", "DALLAS", "Runner-up Group E", "Runner-up Group I"],
  [79, "round_of_32", null, null, null, "2026-07-01T01:00:00Z", "MEXICO_CITY", "Winner Group A", "Third Group C/E/F/H/I"],
  [80, "round_of_32", null, null, null, "2026-07-01T16:00:00Z", "ATLANTA", "Winner Group L", "Third Group E/H/I/J/K"],
  [81, "round_of_32", null, null, null, "2026-07-02T00:00:00Z", "SAN_FRANCISCO_BAY_AREA", "Winner Group D", "Third Group B/E/F/I/J"],
  [82, "round_of_32", null, null, null, "2026-07-01T20:00:00Z", "SEATTLE", "Winner Group G", "Third Group A/E/H/I/J"],
  [83, "round_of_32", null, null, null, "2026-07-02T23:00:00Z", "TORONTO", "Runner-up Group K", "Runner-up Group L"],
  [84, "round_of_32", null, null, null, "2026-07-02T19:00:00Z", "LOS_ANGELES", "Winner Group H", "Runner-up Group J"],
  [85, "round_of_32", null, null, null, "2026-07-03T03:00:00Z", "VANCOUVER", "Winner Group B", "Third Group E/F/G/I/J"],
  [86, "round_of_32", null, null, null, "2026-07-03T22:00:00Z", "MIAMI", "Winner Group J", "Runner-up Group H"],
  [87, "round_of_32", null, null, null, "2026-07-04T01:30:00Z", "KANSAS_CITY", "Winner Group K", "Third Group D/E/I/J/L"],
  [88, "round_of_32", null, null, null, "2026-07-03T18:00:00Z", "DALLAS", "Runner-up Group D", "Runner-up Group G"],
  [89, "round_of_16", null, null, null, "2026-07-04T21:00:00Z", "PHILADELPHIA", "Winner Match 74", "Winner Match 77"],
  [90, "round_of_16", null, null, null, "2026-07-04T17:00:00Z", "HOUSTON", "Winner Match 73", "Winner Match 75"],
  [91, "round_of_16", null, null, null, "2026-07-05T20:00:00Z", "NEW_YORK_NEW_JERSEY", "Winner Match 76", "Winner Match 78"],
  [92, "round_of_16", null, null, null, "2026-07-06T00:00:00Z", "MEXICO_CITY", "Winner Match 79", "Winner Match 80"],
  [93, "round_of_16", null, null, null, "2026-07-06T19:00:00Z", "DALLAS", "Winner Match 83", "Winner Match 84"],
  [94, "round_of_16", null, null, null, "2026-07-07T00:00:00Z", "SEATTLE", "Winner Match 81", "Winner Match 82"],
  [95, "round_of_16", null, null, null, "2026-07-07T16:00:00Z", "ATLANTA", "Winner Match 86", "Winner Match 88"],
  [96, "round_of_16", null, null, null, "2026-07-07T20:00:00Z", "VANCOUVER", "Winner Match 85", "Winner Match 87"],
  [97, "quarterfinal", null, null, null, "2026-07-09T20:00:00Z", "BOSTON", "Winner Match 89", "Winner Match 90"],
  [98, "quarterfinal", null, null, null, "2026-07-10T19:00:00Z", "LOS_ANGELES", "Winner Match 93", "Winner Match 94"],
  [99, "quarterfinal", null, null, null, "2026-07-11T21:00:00Z", "MIAMI", "Winner Match 91", "Winner Match 92"],
  [100, "quarterfinal", null, null, null, "2026-07-12T01:00:00Z", "KANSAS_CITY", "Winner Match 95", "Winner Match 96"],
  [101, "semifinal", null, null, null, "2026-07-14T19:00:00Z", "DALLAS", "Winner Match 97", "Winner Match 98"],
  [102, "semifinal", null, null, null, "2026-07-15T19:00:00Z", "ATLANTA", "Winner Match 99", "Winner Match 100"],
  [103, "third_place", null, null, null, "2026-07-18T21:00:00Z", "MIAMI", "Loser Match 101", "Loser Match 102"],
  [104, "final", null, null, null, "2026-07-19T19:00:00Z", "NEW_YORK_NEW_JERSEY", "Winner Match 101", "Winner Match 102"],
];

function teamLabel(code, fallback) {
  return WC_TEAM_BY_CODE[code]?.name || fallback || "TBD";
}

function createMatch(row) {
  const [matchNumber, stage, groupCode, homeCode, awayCode, kickoffAt, venueKey, homeLabel, awayLabel] = row;
  const venue = VENUES[venueKey] || {};

  return {
    id: `wc-m${String(matchNumber).padStart(3, "0")}`,
    match_number: matchNumber,
    stage,
    group_code: groupCode,
    home_team_code: homeCode,
    away_team_code: awayCode,
    home_label: teamLabel(homeCode, homeLabel),
    away_label: teamLabel(awayCode, awayLabel),
    kickoff_at: kickoffAt,
    lock_at: kickoffAt,
    venue: venue.venue || "Venue TBD",
    city: venue.city || "City TBD",
    country: venue.country || "Country TBD",
    status: "scheduled",
    source_note: WC_FIXTURE_SOURCE_NOTE,
  };
}

export const WC_FALLBACK_MATCHES = WC_OFFICIAL_FIXTURE_ROWS.map(createMatch);

export const WC_FALLBACK_SEASON = {
  year: WC_YEAR,
  tournamentStart: "2026-06-11T19:00:00Z",
  matches: WC_FALLBACK_MATCHES,
};

export function wcMatchTeams(match) {
  return {
    home: {
      code: match.home_team_code,
      name: teamLabel(match.home_team_code, match.home_label),
    },
    away: {
      code: match.away_team_code,
      name: teamLabel(match.away_team_code, match.away_label),
    },
  };
}

export function wcStageLabel(stage) {
  const labels = {
    group: "Group",
    round_of_32: "Round of 32",
    round_of_16: "Round of 16",
    quarterfinal: "Quarterfinal",
    semifinal: "Semifinal",
    third_place: "Third place",
    final: "Final",
  };
  return labels[stage] || "Match";
}
