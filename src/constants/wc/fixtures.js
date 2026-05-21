import { WC_GROUPS, WC_TEAM_BY_CODE, WC_YEAR } from "@/src/constants/wc/teams";

const GROUP_PAIRINGS = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

const VENUES = [
  { venue: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
  { venue: "BMO Field", city: "Toronto", country: "Canada" },
  { venue: "SoFi Stadium", city: "Los Angeles", country: "United States" },
  { venue: "AT&T Stadium", city: "Dallas", country: "United States" },
  { venue: "MetLife Stadium", city: "New York New Jersey", country: "United States" },
  { venue: "Mercedes-Benz Stadium", city: "Atlanta", country: "United States" },
  { venue: "NRG Stadium", city: "Houston", country: "United States" },
  { venue: "BC Place", city: "Vancouver", country: "Canada" },
  { venue: "Estadio BBVA", city: "Monterrey", country: "Mexico" },
  { venue: "Lumen Field", city: "Seattle", country: "United States" },
];

function addDays(baseIso, days, hour = 19) {
  const date = new Date(baseIso);
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function teamLabel(code, fallback) {
  return WC_TEAM_BY_CODE[code]?.name || fallback || "TBD";
}

function createGroupMatches() {
  let matchNumber = 1;
  const matches = [];
  const groupEntries = Object.entries(WC_GROUPS);

  for (let round = 0; round < 3; round += 1) {
    groupEntries.forEach(([group, teams], groupIndex) => {
      const pairA = GROUP_PAIRINGS[round * 2];
      const pairB = GROUP_PAIRINGS[round * 2 + 1];
      [pairA, pairB].forEach((pair, pairIndex) => {
        const home = teams[pair[0]];
        const away = teams[pair[1]];
        const venue = VENUES[(matchNumber - 1) % VENUES.length];
        const dayOffset = Math.floor((matchNumber - 1) / 4);
        matches.push({
          id: `wc-m${String(matchNumber).padStart(3, "0")}`,
          match_number: matchNumber,
          stage: "group",
          group_code: group,
          home_team_code: home.code,
          away_team_code: away.code,
          home_label: home.name,
          away_label: away.name,
          kickoff_at: addDays("2026-06-11T19:00:00Z", dayOffset, pairIndex % 2 ? 22 : 19),
          lock_at: addDays("2026-06-11T19:00:00Z", dayOffset, pairIndex % 2 ? 22 : 19),
          venue: venue.venue,
          city: venue.city,
          country: venue.country,
          status: "scheduled",
        });
        matchNumber += 1;
      });
    });
  }

  return matches;
}

function createKnockoutMatches(startNumber) {
  const stages = [
    ["round_of_32", 16, "Round of 32"],
    ["round_of_16", 8, "Round of 16"],
    ["quarterfinal", 4, "Quarterfinal"],
    ["semifinal", 2, "Semifinal"],
    ["third_place", 1, "Third-place match"],
    ["final", 1, "Final"],
  ];

  let matchNumber = startNumber;
  let dayOffset = 17;
  const matches = [];

  stages.forEach(([stage, count, label]) => {
    for (let index = 0; index < count; index += 1) {
      const venue = VENUES[(matchNumber - 1) % VENUES.length];
      const final = stage === "final";
      const kickoff = final ? "2026-07-19T19:00:00Z" : addDays("2026-06-11T19:00:00Z", dayOffset + Math.floor(index / 2), index % 2 ? 22 : 19);
      matches.push({
        id: `wc-m${String(matchNumber).padStart(3, "0")}`,
        match_number: matchNumber,
        stage,
        group_code: null,
        home_team_code: null,
        away_team_code: null,
        home_label: `${label} slot ${index + 1}A`,
        away_label: `${label} slot ${index + 1}B`,
        kickoff_at: kickoff,
        lock_at: kickoff,
        venue: final ? "MetLife Stadium" : venue.venue,
        city: final ? "New York New Jersey" : venue.city,
        country: final ? "United States" : venue.country,
        status: "scheduled",
      });
      matchNumber += 1;
    }
    dayOffset += Math.max(2, Math.ceil(count / 2));
  });

  return matches;
}

export const WC_FALLBACK_MATCHES = [
  ...createGroupMatches(),
  ...createKnockoutMatches(73),
];

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
