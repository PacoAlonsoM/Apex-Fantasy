export const WC_YEAR = 2026;
export const WC_TOURNAMENT_START = "2026-06-11T19:00:00Z";

export const WC_GROUPS = {
  A: [
    { code: "MEX", name: "Mexico", flag: "MX" },
    { code: "RSA", name: "South Africa", flag: "ZA" },
    { code: "KOR", name: "Korea Republic", flag: "KR" },
    { code: "CZE", name: "Czechia", flag: "CZ" },
  ],
  B: [
    { code: "CAN", name: "Canada", flag: "CA" },
    { code: "BIH", name: "Bosnia and Herzegovina", flag: "BA" },
    { code: "QAT", name: "Qatar", flag: "QA" },
    { code: "SUI", name: "Switzerland", flag: "CH" },
  ],
  C: [
    { code: "BRA", name: "Brazil", flag: "BR" },
    { code: "MAR", name: "Morocco", flag: "MA" },
    { code: "HAI", name: "Haiti", flag: "HT" },
    { code: "SCO", name: "Scotland", flag: "GB-SCT" },
  ],
  D: [
    { code: "USA", name: "United States", flag: "US" },
    { code: "PAR", name: "Paraguay", flag: "PY" },
    { code: "AUS", name: "Australia", flag: "AU" },
    { code: "TUR", name: "Turkiye", flag: "TR" },
  ],
  E: [
    { code: "GER", name: "Germany", flag: "DE" },
    { code: "CUW", name: "Curacao", flag: "CW" },
    { code: "CIV", name: "Cote d'Ivoire", flag: "CI" },
    { code: "ECU", name: "Ecuador", flag: "EC" },
  ],
  F: [
    { code: "NED", name: "Netherlands", flag: "NL" },
    { code: "JPN", name: "Japan", flag: "JP" },
    { code: "SWE", name: "Sweden", flag: "SE" },
    { code: "TUN", name: "Tunisia", flag: "TN" },
  ],
  G: [
    { code: "BEL", name: "Belgium", flag: "BE" },
    { code: "EGY", name: "Egypt", flag: "EG" },
    { code: "IRN", name: "IR Iran", flag: "IR" },
    { code: "NZL", name: "New Zealand", flag: "NZ" },
  ],
  H: [
    { code: "ESP", name: "Spain", flag: "ES" },
    { code: "CPV", name: "Cabo Verde", flag: "CV" },
    { code: "KSA", name: "Saudi Arabia", flag: "SA" },
    { code: "URU", name: "Uruguay", flag: "UY" },
  ],
  I: [
    { code: "FRA", name: "France", flag: "FR" },
    { code: "SEN", name: "Senegal", flag: "SN" },
    { code: "IRQ", name: "Iraq", flag: "IQ" },
    { code: "NOR", name: "Norway", flag: "NO" },
  ],
  J: [
    { code: "ARG", name: "Argentina", flag: "AR" },
    { code: "ALG", name: "Algeria", flag: "DZ" },
    { code: "AUT", name: "Austria", flag: "AT" },
    { code: "JOR", name: "Jordan", flag: "JO" },
  ],
  K: [
    { code: "POR", name: "Portugal", flag: "PT" },
    { code: "COD", name: "DR Congo", flag: "CD" },
    { code: "UZB", name: "Uzbekistan", flag: "UZ" },
    { code: "COL", name: "Colombia", flag: "CO" },
  ],
  L: [
    { code: "ENG", name: "England", flag: "GB-ENG" },
    { code: "CRO", name: "Croatia", flag: "HR" },
    { code: "GHA", name: "Ghana", flag: "GH" },
    { code: "PAN", name: "Panama", flag: "PA" },
  ],
};

export const WC_TEAMS = Object.entries(WC_GROUPS).flatMap(([group, teams]) =>
  teams.map((team, index) => ({
    ...team,
    group,
    seed: index + 1,
  }))
);

export const WC_TEAM_BY_CODE = Object.fromEntries(WC_TEAMS.map((team) => [team.code, team]));

export function wcTeamName(code, fallback = "TBD") {
  return WC_TEAM_BY_CODE[code]?.name || fallback;
}

// External feeds (TheSportsDB, FIFA wires) use a mix of common-English and
// older names. Keep this table small and explicit — the lookup is keyed by
// a normalized lowercase string and falls back to the canonical name set.
const WC_EXTERNAL_NAME_TO_CODE = {
  "mexico": "MEX",
  "south africa": "RSA",
  "korea republic": "KOR",
  "south korea": "KOR",
  "republic of korea": "KOR",
  "czechia": "CZE",
  "czech republic": "CZE",
  "canada": "CAN",
  "bosnia and herzegovina": "BIH",
  "bosnia-herzegovina": "BIH",
  "bosnia": "BIH",
  "qatar": "QAT",
  "switzerland": "SUI",
  "brazil": "BRA",
  "morocco": "MAR",
  "haiti": "HAI",
  "scotland": "SCO",
  "united states": "USA",
  "usa": "USA",
  "us": "USA",
  "united states of america": "USA",
  "paraguay": "PAR",
  "australia": "AUS",
  "turkiye": "TUR",
  "turkey": "TUR",
  "türkiye": "TUR",
  "germany": "GER",
  "curacao": "CUW",
  "curaçao": "CUW",
  "cote d'ivoire": "CIV",
  "côte d'ivoire": "CIV",
  "ivory coast": "CIV",
  "ecuador": "ECU",
  "netherlands": "NED",
  "holland": "NED",
  "japan": "JPN",
  "sweden": "SWE",
  "tunisia": "TUN",
  "belgium": "BEL",
  "egypt": "EGY",
  "iran": "IRN",
  "ir iran": "IRN",
  "islamic republic of iran": "IRN",
  "new zealand": "NZL",
  "spain": "ESP",
  "cabo verde": "CPV",
  "cape verde": "CPV",
  "saudi arabia": "KSA",
  "uruguay": "URU",
  "france": "FRA",
  "senegal": "SEN",
  "iraq": "IRQ",
  "republic of iraq": "IRQ",
  "norway": "NOR",
  "argentina": "ARG",
  "algeria": "ALG",
  "austria": "AUT",
  "jordan": "JOR",
  "portugal": "POR",
  "dr congo": "COD",
  "democratic republic of the congo": "COD",
  "congo dr": "COD",
  "uzbekistan": "UZB",
  "colombia": "COL",
  "england": "ENG",
  "croatia": "CRO",
  "ghana": "GHA",
  "panama": "PAN",
};

export function wcCodeForExternalName(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (WC_EXTERNAL_NAME_TO_CODE[normalized]) return WC_EXTERNAL_NAME_TO_CODE[normalized];
  // Also support direct code lookups (e.g. "GER", "USA") in case the feed
  // returns ISO/FIFA codes rather than full names.
  const upper = normalized.toUpperCase();
  if (WC_TEAM_BY_CODE[upper]) return upper;
  return null;
}
