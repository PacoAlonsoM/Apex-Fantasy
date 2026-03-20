// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

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

const ROUND_NAMES = {
  1: "Australian GP",
  2: "Chinese GP",
  3: "Japanese GP",
  4: "Bahrain GP",
  5: "Saudi Arabian GP",
  6: "Miami GP",
  7: "Canadian GP",
  8: "Monaco GP",
  9: "Spanish GP",
  10: "Austrian GP",
  11: "British GP",
  12: "Belgian GP",
  13: "Hungarian GP",
  14: "Dutch GP",
  15: "Italian GP",
  16: "Madrid GP",
  17: "Azerbaijan GP",
  18: "Singapore GP",
  19: "US GP",
  20: "Mexico City GP",
  21: "Sao Paulo GP",
  22: "Las Vegas GP",
  23: "Qatar GP",
  24: "Abu Dhabi GP",
};

const TEAM_DRIVERS = {
  "McLaren": ["Lando Norris", "Oscar Piastri"],
  "Ferrari": ["Charles Leclerc", "Lewis Hamilton"],
  "Mercedes": ["George Russell", "Kimi Antonelli"],
  "Red Bull Racing": ["Max Verstappen", "Isack Hadjar"],
  "Aston Martin": ["Fernando Alonso", "Lance Stroll"],
  "Alpine": ["Pierre Gasly", "Franco Colapinto"],
  "Haas": ["Oliver Bearman", "Esteban Ocon"],
  "Racing Bulls": ["Liam Lawson", "Arvid Lindblad"],
  "Williams": ["Alexander Albon", "Carlos Sainz"],
  "Audi": ["Nico Hulkenberg", "Gabriel Bortoleto"],
  "Cadillac": ["Sergio Perez", "Valtteri Bottas"],
};

const DRIVER_POOL = Object.values(TEAM_DRIVERS).flat();
const CONSTRUCTOR_POOL = Object.keys(TEAM_DRIVERS);
const TEAM_AVATAR_KEYS = {
  "McLaren": "support-mclaren",
  "Ferrari": "support-ferrari",
  "Mercedes": "support-mercedes",
  "Red Bull Racing": "support-red-bull",
  "Aston Martin": "support-aston",
  "Alpine": "support-alpine",
  "Haas": "support-haas",
  "Racing Bulls": "support-rb",
  "Williams": "support-williams",
  "Audi": "support-audi",
  "Cadillac": "support-cadillac",
};

const CORE_USER_SEEDS = [
  {
    email: "mia.chicane@stint.community",
    username: "MiaChicane",
    favoriteTeam: "Ferrari",
    favoriteDriver: "Charles Leclerc",
    avatarColor: "support-ferrari",
    style: "podium_reader",
    joinLeague1: true,
  },
  {
    email: "santi.sector1@stint.community",
    username: "SantiSector1",
    favoriteTeam: "Mercedes",
    favoriteDriver: "George Russell",
    avatarColor: "support-mercedes",
    style: "sharp_strategist",
    joinLeague1: true,
  },
  {
    email: "ava.undercut@stint.community",
    username: "AvaUndercut",
    favoriteTeam: "McLaren",
    favoriteDriver: "Lando Norris",
    avatarColor: "support-mclaren",
    style: "constructor_hunter",
    joinLeague1: true,
  },
  {
    email: "theo.safetycar@stint.community",
    username: "TheoSafetyCar",
    favoriteTeam: "Aston Martin",
    favoriteDriver: "Fernando Alonso",
    avatarColor: "support-aston",
    style: "chaos_reader",
    joinLeague1: true,
  },
  {
    email: "lena.slipstream@stint.community",
    username: "LenaSlipstream",
    favoriteTeam: "Red Bull Racing",
    favoriteDriver: "Max Verstappen",
    avatarColor: "support-red-bull",
    style: "front_runner",
    joinLeague1: true,
  },
];

const GENERATED_FIRST_NAMES = [
  "Noa", "Leo", "Sofia", "Mateo", "Nina", "Lucas", "Jules", "Iris", "Dante", "Mila",
  "Bruno", "Alma", "Tomas", "Cora", "Enzo", "Lia", "Gael", "Emma", "Rafa", "Ines",
  "Teo", "Clara", "Nico", "Sara", "Elio", "Olivia", "Marco", "Aitana", "Hugo", "Luna",
  "Dario", "Elsa", "Tiago", "Vera", "Pablo", "Maya", "Axel", "Julia", "Roman", "Ari",
  "Julian", "Valeria", "Adrian", "Zoe", "Martin", "Camila", "Samuel", "Lola", "Bruna", "Diego",
];

const GENERATED_SUFFIXES = [
  "LateBrake", "SectorTwo", "Undercut", "Slipstream", "BoxBox", "DirtyAir", "ParcFerme", "TrackLimit", "WarmTyre", "FastStint",
  "Overcut", "TyreDelta", "ApexClub", "RaceCraft", "GridWalk", "FormationLap", "BrakeBias", "PurpleSector", "DeltaTime", "RaceTape",
  "Chicane", "Backmarker", "PitWindow", "LongRun", "QualiTrim", "TyreWhisper", "FlatSpot", "PaceNote", "FrontWing", "RainRadar",
  "SprintMode", "FuelSave", "GhostLap", "SectorOne", "LaunchMap", "DirtySide", "WindTunnel", "PitRadio", "FastHands", "TrackTemp",
  "Downforce", "RedMist", "SoftTyre", "HardTyre", "GridSlot", "BrakeMarker", "Oversteer", "CoastMode", "RacePulse", "LastLap",
];

const STYLE_POOL = [
  "podium_reader",
  "sharp_strategist",
  "constructor_hunter",
  "chaos_reader",
  "front_runner",
];

function buildGeneratedUserSeeds(count = 50) {
  return Array.from({ length: count }, (_, index) => {
    const firstName = GENERATED_FIRST_NAMES[index % GENERATED_FIRST_NAMES.length];
    const suffix = GENERATED_SUFFIXES[index % GENERATED_SUFFIXES.length];
    const username = `${firstName}${suffix}`.slice(0, 24);
    const favoriteTeam = CONSTRUCTOR_POOL[index % CONSTRUCTOR_POOL.length];
    const teamDrivers = TEAM_DRIVERS[favoriteTeam] || DRIVER_POOL;

    return {
      email: `${username.toLowerCase()}@stint.community`,
      username,
      favoriteTeam,
      favoriteDriver: teamDrivers[index % teamDrivers.length],
      avatarColor: TEAM_AVATAR_KEYS[favoriteTeam] || "ember",
      style: STYLE_POOL[index % STYLE_POOL.length],
      joinLeague1: index < 18,
    };
  });
}

const USER_SEEDS = [...CORE_USER_SEEDS, ...buildGeneratedUserSeeds(50)];

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function toNumber(value: unknown) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function uniq(values: unknown[]) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeListValue(value: unknown) {
  if (Array.isArray(value)) return uniq(value);
  if (typeof value === "string") {
    return uniq(value.split(/\s*\|\s*|\s*,\s*/));
  }
  if (value) return uniq([value]);
  return [];
}

function getDnfDrivers(results: Record<string, unknown>) {
  const fromList = normalizeListValue(results?.dnf_list);
  if (fromList.length) return fromList;
  return normalizeListValue(results?.dnf);
}

function hashSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function chance(seed: string) {
  return (hashSeed(seed) % 1000) / 1000;
}

function pickFrom(list: string[], seed: string, exclude: string[] = []) {
  const filtered = list.filter((item) => item && !exclude.includes(item));
  if (!filtered.length) return null;
  return filtered[hashSeed(seed) % filtered.length];
}

function maybeActual(actual: string | null, seed: string, probability: number, fallback: () => string | null) {
  if (actual && chance(seed) <= probability) return actual;
  return fallback();
}

function fallbackDriver(seed, results, userSeed, exclude = []) {
  const teamDrivers = TEAM_DRIVERS[userSeed.favoriteTeam] || [];
  const contextual = uniq([
    userSeed.favoriteDriver,
    ...(teamDrivers || []),
    results.winner,
    results.p2,
    results.p3,
    results.fastest_lap,
    results.dotd,
    ...getDnfDrivers(results),
    ...DRIVER_POOL,
  ]);
  return pickFrom(contextual, seed, exclude);
}

function fallbackConstructor(seed, results, userSeed, exclude = []) {
  const contextual = uniq([
    userSeed.favoriteTeam,
    results.best_constructor,
    ...CONSTRUCTOR_POOL,
  ]);
  return pickFrom(contextual, seed, exclude);
}

function styleWeights(style: string) {
  switch (style) {
    case "sharp_strategist":
      return { pole: 0.72, winner: 0.76, p2: 0.64, p3: 0.58, dnf: 0.35, fl: 0.52, dotd: 0.36, ctor: 0.68, sc: 0.55, rf: 0.35, sprint: 0.58 };
    case "constructor_hunter":
      return { pole: 0.44, winner: 0.52, p2: 0.48, p3: 0.42, dnf: 0.28, fl: 0.54, dotd: 0.30, ctor: 0.82, sc: 0.44, rf: 0.28, sprint: 0.60 };
    case "chaos_reader":
      return { pole: 0.30, winner: 0.40, p2: 0.34, p3: 0.36, dnf: 0.78, fl: 0.26, dotd: 0.26, ctor: 0.38, sc: 0.80, rf: 0.55, sprint: 0.32 };
    case "front_runner":
      return { pole: 0.68, winner: 0.70, p2: 0.52, p3: 0.40, dnf: 0.20, fl: 0.60, dotd: 0.24, ctor: 0.64, sc: 0.30, rf: 0.18, sprint: 0.52 };
    case "podium_reader":
    default:
      return { pole: 0.46, winner: 0.48, p2: 0.56, p3: 0.66, dnf: 0.24, fl: 0.34, dotd: 0.30, ctor: 0.48, sc: 0.40, rf: 0.22, sprint: 0.38 };
  }
}

function buildPicksForRound(userSeed, results) {
  const weights = styleWeights(userSeed.style);
  const roundKey = `r${results.race_round}-${userSeed.username}`;
  const dnfDrivers = getDnfDrivers(results);
  const picks: Record<string, string> = {};

  picks.pole = maybeActual(
    results.pole || null,
    `${roundKey}-pole`,
    weights.pole,
    () => fallbackDriver(`${roundKey}-pole-fallback`, results, userSeed, [results.pole])
  );
  picks.winner = maybeActual(
    results.winner || null,
    `${roundKey}-winner`,
    weights.winner,
    () => fallbackDriver(`${roundKey}-winner-fallback`, results, userSeed, [results.winner])
  );
  picks.p2 = maybeActual(
    results.p2 || null,
    `${roundKey}-p2`,
    weights.p2,
    () => fallbackDriver(`${roundKey}-p2-fallback`, results, userSeed, [results.winner, results.p2])
  );
  picks.p3 = maybeActual(
    results.p3 || null,
    `${roundKey}-p3`,
    weights.p3,
    () => fallbackDriver(`${roundKey}-p3-fallback`, results, userSeed, [results.winner, results.p2, results.p3])
  );
  picks.dnf = maybeActual(
    dnfDrivers[0] || null,
    `${roundKey}-dnf`,
    weights.dnf,
    () => fallbackDriver(`${roundKey}-dnf-fallback`, results, userSeed, dnfDrivers)
  );
  picks.fl = maybeActual(
    results.fastest_lap || null,
    `${roundKey}-fl`,
    weights.fl,
    () => fallbackDriver(`${roundKey}-fl-fallback`, results, userSeed, [results.fastest_lap])
  );
  picks.dotd = maybeActual(
    results.dotd || null,
    `${roundKey}-dotd`,
    weights.dotd,
    () => fallbackDriver(`${roundKey}-dotd-fallback`, results, userSeed, [results.dotd])
  );
  picks.ctor = maybeActual(
    results.best_constructor || null,
    `${roundKey}-ctor`,
    weights.ctor,
    () => fallbackConstructor(`${roundKey}-ctor-fallback`, results, userSeed, [results.best_constructor])
  );
  picks.sc = results.safety_car
    ? (chance(`${roundKey}-sc`) <= weights.sc ? "Yes" : "No")
    : (chance(`${roundKey}-sc`) <= 1 - weights.sc ? "No" : "Yes");
  picks.rf = results.red_flag
    ? (chance(`${roundKey}-rf`) <= weights.rf ? "Yes" : "No")
    : (chance(`${roundKey}-rf`) <= 1 - weights.rf ? "No" : "Yes");

  if (results.sp_pole || results.sp_winner || results.sp_p2 || results.sp_p3) {
    picks.sp_pole = maybeActual(
      results.sp_pole || null,
      `${roundKey}-sp-pole`,
      weights.sprint,
      () => fallbackDriver(`${roundKey}-sp-pole-fallback`, results, userSeed, [results.sp_pole])
    );
    picks.sp_winner = maybeActual(
      results.sp_winner || null,
      `${roundKey}-sp-winner`,
      weights.sprint + 0.05,
      () => fallbackDriver(`${roundKey}-sp-winner-fallback`, results, userSeed, [results.sp_winner])
    );
    picks.sp_p2 = maybeActual(
      results.sp_p2 || null,
      `${roundKey}-sp-p2`,
      weights.sprint - 0.03,
      () => fallbackDriver(`${roundKey}-sp-p2-fallback`, results, userSeed, [results.sp_winner, results.sp_p2])
    );
    picks.sp_p3 = maybeActual(
      results.sp_p3 || null,
      `${roundKey}-sp-p3`,
      weights.sprint - 0.06,
      () => fallbackDriver(`${roundKey}-sp-p3-fallback`, results, userSeed, [results.sp_winner, results.sp_p2, results.sp_p3])
    );
  }

  return picks;
}

function calculatePoints(picks: Record<string, string>, results: Record<string, unknown>) {
  let points = 0;
  const breakdown: Array<{ label: string; pts: number }> = [];

  if (!picks || !results) return { points, breakdown };

  if (picks.pole && picks.pole === results.pole) { points += PTS.pole; breakdown.push({ label: "Pole Position", pts: PTS.pole }); }
  if (picks.winner && picks.winner === results.winner) { points += PTS.winner; breakdown.push({ label: "Race Winner", pts: PTS.winner }); }
  if (picks.p2 && picks.p2 === results.p2) { points += PTS.p2; breakdown.push({ label: "2nd Place", pts: PTS.p2 }); }
  if (picks.p3 && picks.p3 === results.p3) { points += PTS.p3; breakdown.push({ label: "3rd Place", pts: PTS.p3 }); }
  if (picks.winner && picks.p2 && picks.p3 && picks.winner === results.winner && picks.p2 === results.p2 && picks.p3 === results.p3) {
    points += PTS.perfectPodium;
    breakdown.push({ label: "Perfect Podium Bonus", pts: PTS.perfectPodium });
  }
  if (picks.dnf && getDnfDrivers(results).includes(picks.dnf)) { points += PTS.dnf; breakdown.push({ label: "DNF Driver", pts: PTS.dnf }); }
  if (picks.fl && picks.fl === results.fastest_lap) { points += PTS.fl; breakdown.push({ label: "Fastest Lap", pts: PTS.fl }); }
  if (picks.dotd && picks.dotd === results.dotd) { points += PTS.dotd; breakdown.push({ label: "Driver of the Day", pts: PTS.dotd }); }
  if (picks.ctor && picks.ctor === results.best_constructor) { points += PTS.ctor; breakdown.push({ label: "Best Constructor", pts: PTS.ctor }); }
  if (picks.sc && picks.sc === "Yes" && results.safety_car) { points += PTS.sc; breakdown.push({ label: "Safety Car", pts: PTS.sc }); }
  if (picks.rf && picks.rf === "Yes" && results.red_flag) { points += PTS.rf; breakdown.push({ label: "Red Flag", pts: PTS.rf }); }
  if (picks.sp_pole && picks.sp_pole === results.sp_pole) { points += PTS.sp_pole; breakdown.push({ label: "Sprint Pole", pts: PTS.sp_pole }); }
  if (picks.sp_winner && picks.sp_winner === results.sp_winner) { points += PTS.sp_winner; breakdown.push({ label: "Sprint Winner", pts: PTS.sp_winner }); }
  if (picks.sp_p2 && picks.sp_p2 === results.sp_p2) { points += PTS.sp_p2; breakdown.push({ label: "Sprint 2nd", pts: PTS.sp_p2 }); }
  if (picks.sp_p3 && picks.sp_p3 === results.sp_p3) { points += PTS.sp_p3; breakdown.push({ label: "Sprint 3rd", pts: PTS.sp_p3 }); }

  return { points, breakdown };
}

function isoDaysAgo(days: number, hour = 18, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

function buildConversationSeeds(scoredRounds, fakeUsers, leagueId) {
  const [latestRound, previousRound] = scoredRounds;
  const latestName = ROUND_NAMES[latestRound?.race_round] || `Round ${latestRound?.race_round || ""}`;
  const previousName = ROUND_NAMES[previousRound?.race_round] || `Round ${previousRound?.race_round || ""}`;
  const nextRaceName = ROUND_NAMES[(latestRound?.race_round || 0) + 1] || "next round";
  const user = (index) => fakeUsers[index % fakeUsers.length];

  const publicThreads = [
    {
      authorIndex: 1,
      title: "Mercedes aren't bluffing on race pace anymore.",
      body: "I'm done calling it an opening-round fluke. George looked planted on the long run, no overheating, no panic. That's real pace.",
      day: 10,
      hour: 20,
      minute: 10,
      comments: [
        { authorIndex: 0, body: "Ferrari can still put a car on the front row, but over a full stint Mercedes looked way calmer.", minuteOffset: 26 },
        { authorIndex: 4, body: "Same. I backed Max all over the board and still came away thinking Mercedes looked easier on the tyres.", minuteOffset: 51 },
        { authorIndex: 22, body: "The thing that stood out to me was how little correction George needed mid-corner. Car looked settled.", minuteOffset: 69 },
      ],
    },
    {
      authorIndex: 3,
      title: "Safety Car reads are already deciding fantasy weeks.",
      body: "People always laugh at the chaos categories until they lose by 5 because they ignored SC and DNF. Those points count the same.",
      day: 8,
      hour: 18,
      minute: 14,
      comments: [
        { authorIndex: 2, body: "True, but I still trust front row + constructor over chaos over a whole season. You can't chase every weird race.", minuteOffset: 23 },
        { authorIndex: 24, body: "You don't chase chaos every week. You just stop pretending safety car is random when certain tracks keep producing it.", minuteOffset: 37 },
      ],
    },
    {
      authorIndex: 2,
      title: `${latestName} was a constructor trap.`,
      body: "One bad read at the front and suddenly your team slot is doing all the work. Sprint weekends always make me feel smart and stupid at the same time.",
      day: 4,
      hour: 19,
      minute: 35,
      comments: [
        { authorIndex: 1, body: `${nextRaceName} feels like the week to get boring again. pole, winner, constructor and move on.`, minuteOffset: 18 },
        { authorIndex: 3, body: "I hit safety car and still hated my board. fantasy is a beautiful, stupid game.", minuteOffset: 39 },
        { authorIndex: 25, body: "The worst feeling is having the 'right idea' and still losing because you missed one team slot.", minuteOffset: 53 },
      ],
    },
    {
      authorIndex: 0,
      title: `Leclerc bounce-back week at ${nextRaceName}?`,
      body: "I know Mercedes are the adult answer right now, but this has all the signs of a Charles quali masterclass and suddenly we're all pretending we saw it coming.",
      day: 2,
      hour: 17,
      minute: 12,
      comments: [
        { authorIndex: 4, body: "If Ferrari look tidy on Friday I'm in. I'm just not sure I want to fade George over a whole board yet.", minuteOffset: 27 },
        { authorIndex: 7, body: "Podium yes. winner maybe. pole absolutely feels live.", minuteOffset: 44 },
        { authorIndex: 26, body: "I swear every Ferrari weekend starts with 'this might be the one' and somehow I still fall for it.", minuteOffset: 63 },
      ],
    },
    {
      authorIndex: 4,
      title: "Antonelli is already fantasy relevant.",
      body: "Not saying he has to be a lock, but he's already hanging around the exact spots that matter in this game. That's enough to get my attention.",
      day: 1,
      hour: 14,
      minute: 28,
      comments: [
        { authorIndex: 1, body: "Exactly. He doesn't need to beat George every week, he just needs to keep showing up in the right zones.", minuteOffset: 21 },
        { authorIndex: 27, body: "Rookie price with top-team upside is usually where fantasy value lives in any sport.", minuteOffset: 36 },
      ],
    },
    {
      authorIndex: 8,
      title: "Fastest lap is still the fakest category in the app.",
      body: "Every single week I convince myself I have fastest lap solved and then someone boxes late, gets clean air, and ruins my life.",
      day: 1,
      hour: 15,
      minute: 11,
      comments: [
        { authorIndex: 11, body: "It's the most tilting 7 points in the whole game and it isn't close.", minuteOffset: 14 },
        { authorIndex: 28, body: "Fastest lap is just strategy roulette with a stopwatch attached.", minuteOffset: 29 },
      ],
    },
    {
      authorIndex: 9,
      title: `Still not over ${previousName}.`,
      body: "Had the podium shape mostly right and still bled points everywhere else. That's the part of fantasy that hurts the most.",
      day: 1,
      hour: 16,
      minute: 8,
      comments: [
        { authorIndex: 6, body: "The worst boards are the ones where you were 'basically right' in all the wrong places.", minuteOffset: 18 },
        { authorIndex: 29, body: "Close is fake comfort. Either the points landed or they didn't.", minuteOffset: 32 },
      ],
    },
    {
      authorIndex: 10,
      title: "My boring take: constructor matters more than the hero pick.",
      body: "Everyone wants to talk about the spicy winner call. Most weeks the real separation is team slot, then whether you got seduced by chaos.",
      day: 1,
      hour: 18,
      minute: 2,
      comments: [
        { authorIndex: 12, body: "100%. Podium + constructor usually tell the story before anything else does.", minuteOffset: 22 },
        { authorIndex: 14, body: "Until a safety car and random fastest lap blow the whole thing up, yes lol.", minuteOffset: 36 },
        { authorIndex: 30, body: "This is why I keep telling myself to stop chasing 'statement picks' and just score the obvious stuff.", minuteOffset: 54 },
      ],
    },
    {
      authorIndex: 13,
      title: "Is anyone actually fading Russell this week?",
      body: "Real question. Not as fan propaganda, as actual game theory. Is anyone fading Russell for a full board?",
      day: 0,
      hour: 13,
      minute: 11,
      comments: [
        { authorIndex: 15, body: "In quali maybe. Over a whole board? Feels reckless right now.", minuteOffset: 16 },
        { authorIndex: 2, body: "I'm fading him in exactly one spot if I do it at all. That's my limit.", minuteOffset: 31 },
        { authorIndex: 31, body: "The funny part is everyone says he's too obvious and then nobody actually clicks away.", minuteOffset: 45 },
      ],
    },
    {
      authorIndex: 16,
      title: `Suzuka feels like a 'don't get cute' week`,
      body: "This is not the week for galaxy-brain stuff. Give me clean front-row reads, one sensible volatility call, and let me sleep.",
      day: 0,
      hour: 14,
      minute: 3,
      comments: [
        { authorIndex: 17, body: "Yeah, this feels like a discipline week more than a vibes week.", minuteOffset: 19 },
        { authorIndex: 32, body: "Watch me say that now and then talk myself into a bizarre DNF pick by Friday night.", minuteOffset: 34 },
      ],
    },
    {
      authorIndex: 18,
      title: "Need more users talking through misses tbh",
      body: "Best fantasy process usually comes from people admitting where they missed, not posting victory laps after they spike one weekend.",
      day: 0,
      hour: 14,
      minute: 45,
      comments: [
        { authorIndex: 19, body: "Correct. Every good process post starts with 'I overreacted to Friday pace.'", minuteOffset: 15 },
        { authorIndex: 33, body: "And usually ends with 'I ignored tyre deg because I liked one qualifying lap too much.'", minuteOffset: 27 },
      ],
    },
    {
      authorIndex: 20,
      title: "Driver of the day is still the weirdest click on the board.",
      body: "Half performance, half broadcast narrative, half vibes. Yes, I know that's three halves.",
      day: 0,
      hour: 15,
      minute: 10,
      comments: [
        { authorIndex: 3, body: "The math checks out honestly.", minuteOffset: 8 },
        { authorIndex: 21, body: "DotD is the only category where I can talk myself into six names in 30 seconds.", minuteOffset: 25 },
        { authorIndex: 34, body: "If the TV director likes your onboards, you're suddenly in the running.", minuteOffset: 39 },
      ],
    },
    {
      authorIndex: 35,
      title: "Ferrari strategy trauma is affecting my picks.",
      body: "At some point this stopped being analysis and became emotional damage. I can feel myself docking Ferrari points before the race even starts.",
      day: 0,
      hour: 16,
      minute: 2,
      comments: [
        { authorIndex: 0, body: "Every Ferrari fan has a little race engineer in their head screaming 'why are we boxing now?'", minuteOffset: 18 },
        { authorIndex: 36, body: "The worst part is when the car is actually fast and you still don't trust the Sunday execution.", minuteOffset: 34 },
      ],
    },
    {
      authorIndex: 37,
      title: "Track limits discourse is going to ruin another weekend.",
      body: "I can already feel the penalties, deleted laps, angry radios and fifty camera cuts to the same white line.",
      day: 0,
      hour: 16,
      minute: 40,
      comments: [
        { authorIndex: 38, body: "Nothing says modern F1 like needing a spreadsheet to know who actually qualified where.", minuteOffset: 14 },
        { authorIndex: 39, body: "And somehow fantasy still expects me to act like quali was straightforward after that.", minuteOffset: 31 },
      ],
    },
    {
      authorIndex: 40,
      title: "Rookies are making the board harder, not easier.",
      body: "Used to be simple: lock the established names and move on. Now the rookies are good enough that leaving them out can cost you.",
      day: 0,
      hour: 17,
      minute: 9,
      comments: [
        { authorIndex: 4, body: "Exactly. They're not just cute upside picks anymore, they actually belong in the real conversation.", minuteOffset: 19 },
        { authorIndex: 41, body: "The problem is figuring out when 'interesting' becomes 'start every week.'", minuteOffset: 33 },
      ],
    },
    {
      authorIndex: 42,
      title: "My favorite type of miss is the one caused by overthinking.",
      body: "Spend all week building a clean board, then one practice session sends me into a spiral and I talk myself out of the obvious answer.",
      day: 0,
      hour: 17,
      minute: 38,
      comments: [
        { authorIndex: 43, body: "The Thursday board is always wiser than the Saturday panic board.", minuteOffset: 11 },
        { authorIndex: 44, body: "I have absolutely sabotaged good process with one too many tyre-deg tweets.", minuteOffset: 26 },
      ],
    },
  ];

  const leagueMessages = [
    "Need one normal weekend. My DNF reads are doing way too much work lately.",
    "Constructor first, drama second. Trying to be a grown-up this week.",
    "I'm talking myself into Charles again and I'm not even pretending this is objective.",
    "Every time I think I solved fastest lap, strategy laughs in my face.",
    `${nextRaceName} feels like one of those weekends where the whole room flips after quali.`,
    `${previousName} still hurts. Hit the chaos pieces and still hated my board.`,
    "If Friday is close, I'm probably just backing McLaren and logging off.",
    "Serious question: who is the name you're refusing to auto-lock this week?",
    "I don't need a genius week. I need a clean week with no self-sabotage.",
    "Hardest part of this game is acting like I won't overreact to Friday sector times.",
    "Suzuka screams front row + constructor to me. Famous last words maybe.",
    "If I miss pole again after giving pole the biggest weight I'm taking a walk.",
    "No galaxy-brain picks. Saying it here so at least one of you can shame me later.",
    "My best fantasy trait is knowing when to get boring.",
    "My worst fantasy trait is getting bored with the boring board.",
    "George feels too safe and somehow that makes me suspicious.",
    "Ferrari rebound week is either obvious or complete bait. no middle ground.",
    "Need one clean Saturday from Ferrari before I buy back in emotionally.",
    "Kimi keeps showing up in exactly the part of the board that matters.",
    "Anyone else think safety car might quietly be the separator again?",
    "Trying not to post my board early because every time I do, I edit it for worse reasons.",
    "There is no worse feeling than loving your board on Thursday.",
    "Fastest lap is a category designed by someone who hates peace.",
    "If this turns into another weird strategy race I'm cooked.",
    "Would love one weekend where the obvious picks are just correct and we all go home happy.",
    "Not me opening the app just to stare at Russell vs Charles for 15 straight minutes.",
    "Best contrarian winner pick that still feels sane? asking for emotionally fragile reasons.",
    "My board right now is 80% discipline and 20% nonsense.",
    "If Driver of the Day burns me again I'm starting a support group.",
    "Constructor slot feels heavier than winner this week. that's my whole theory.",
    "I'm old enough to remember when I trusted Ferrari strategy for a full Sunday.",
    "If there are track limits penalties in quali I am simply going to pretend they never happened.",
    "One practice session and I already want to rip up my first draft.",
    "Rookie hype is fun until you actually have to decide whether to click the name.",
    "The amount of points hidden in just not being dramatic is annoying.",
    "Floor damage, dirty air, random VSC... this game really is pain management.",
    "I swear every week I say 'don't chase last race' and then immediately chase last race.",
    "If McLaren look tidy in FP2 I'm becoming the most boring player alive.",
    "I don't even need to win the week. I just need to stop donating points.",
    "There should be an achievement for not changing your board after one journalist tweet.",
    "Who else is pretending not to care about DotD while absolutely caring about DotD?",
    "The most dangerous version of me is me with a decent Thursday process and too much Friday confidence.",
    "A clean 60-point week would heal me more than any risky 95-point dream board.",
  ];

  const leagueThreads = leagueMessages.map((body, index) => ({
    post: {
      authorId: user(22 + index).id,
      authorName: user(22 + index).username,
      title: body.slice(0, 72),
      body,
      leagueId,
      createdAt: isoDaysAgo(Math.max(0, 1 - Math.floor(index / 18)), 15 + Math.floor(index / 6), (index * 7) % 60),
    },
    comments: [],
  }));

  const publicSeeds = publicThreads.map((thread) => ({
    post: {
      authorId: user(thread.authorIndex).id,
      authorName: user(thread.authorIndex).username,
      title: thread.title,
      body: thread.body,
      leagueId: null,
      createdAt: isoDaysAgo(thread.day, thread.hour, thread.minute),
    },
    comments: (thread.comments || []).map((comment) => ({
      authorId: user(comment.authorIndex).id,
      authorName: user(comment.authorIndex).username,
      body: comment.body,
      createdAt: isoDaysAgo(thread.day, thread.hour, thread.minute + comment.minuteOffset),
    })),
  }));

  return [...publicSeeds, ...leagueThreads];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return respond({ error: "Missing required environment variables." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: results, error: resultsError } = await supabase
      .from("race_results")
      .select("*")
      .eq("results_entered", true)
      .order("race_round", { ascending: false })
      .limit(2);

    if (resultsError) throw resultsError;
    if (!results?.length) {
      return respond({ error: "No scored race results found to seed against." }, 400);
    }

    const scoredRounds = [...results].sort((left, right) => left.race_round - right.race_round);

    const { data: userPage, error: userPageError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (userPageError) throw userPageError;

    const userByEmail = new Map(
      (userPage?.users || [])
        .filter((user) => user.email)
        .map((user) => [String(user.email).toLowerCase(), user])
    );

    const fakeUsers = [];

    for (const seed of USER_SEEDS) {
      const emailKey = seed.email.toLowerCase();
      let authUser = userByEmail.get(emailKey) || null;

      if (!authUser) {
        const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
          email: seed.email,
          password: `${crypto.randomUUID()}!Aa9`,
          email_confirm: true,
          user_metadata: {
            username: seed.username,
            favorite_team: seed.favoriteTeam,
            favorite_driver: seed.favoriteDriver,
            avatar_color: seed.avatarColor,
          },
        });

        if (createUserError) throw createUserError;
        authUser = createdUser.user;
      } else {
        const { error: updateUserError } = await supabase.auth.admin.updateUserById(authUser.id, {
          user_metadata: {
            ...(authUser.user_metadata || {}),
            username: seed.username,
            favorite_team: seed.favoriteTeam,
            favorite_driver: seed.favoriteDriver,
            avatar_color: seed.avatarColor,
          },
        });

        if (updateUserError) throw updateUserError;
      }

      const profilePayload = {
        id: authUser.id,
        username: seed.username,
        points: 0,
        avatar_color: seed.avatarColor,
        favorite_team: seed.favoriteTeam,
        favorite_driver: seed.favoriteDriver,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" });

      if (profileError) throw profileError;

      fakeUsers.push({ ...seed, id: authUser.id });
    }

    const fakeUserIds = fakeUsers.map((user) => user.id);

    const { data: existingLeague, error: leagueError } = await supabase
      .from("leagues")
      .select("id,name,code,owner_id")
      .eq("code", "LEAG01")
      .maybeSingle();

    if (leagueError) throw leagueError;

    let league = existingLeague;
    if (!league) {
      const ownerId = fakeUserIds[0];
      const { data: createdLeague, error: createLeagueError } = await supabase
        .from("leagues")
        .insert({
          name: "League 1",
          code: "LEAG01",
          owner_id: ownerId,
          is_public: false,
        })
        .select("id,name,code,owner_id")
        .single();

      if (createLeagueError) throw createLeagueError;
      league = createdLeague;
    }

    const { data: authoredPosts, error: authoredPostsError } = await supabase
      .from("posts")
      .select("id")
      .in("author_id", fakeUserIds);

    if (authoredPostsError) throw authoredPostsError;

    const authoredPostIds = (authoredPosts || []).map((post) => post.id);
    if (authoredPostIds.length) {
      const { error: deleteCommentsError } = await supabase
        .from("comments")
        .delete()
        .in("post_id", authoredPostIds);

      if (deleteCommentsError) throw deleteCommentsError;
    }

    const { error: deleteOwnCommentsError } = await supabase
      .from("comments")
      .delete()
      .in("author_id", fakeUserIds);

    if (deleteOwnCommentsError) throw deleteOwnCommentsError;

    const { error: deletePostsError } = await supabase
      .from("posts")
      .delete()
      .in("author_id", fakeUserIds);

    if (deletePostsError) throw deletePostsError;

    const { error: deletePredictionsError } = await supabase
      .from("predictions")
      .delete()
      .in("user_id", fakeUserIds);

    if (deletePredictionsError) throw deletePredictionsError;

    const { error: resetPointsError } = await supabase
      .from("profiles")
      .update({ points: 0 })
      .in("id", fakeUserIds);

    if (resetPointsError) throw resetPointsError;

    const { error: clearMembershipsError } = await supabase
      .from("league_members")
      .delete()
      .in("user_id", fakeUserIds);

    if (clearMembershipsError) throw clearMembershipsError;

    const leagueMembersPayload = fakeUsers
      .filter((user) => user.joinLeague1)
      .map((user) => ({
      league_id: league.id,
      user_id: user.id,
    }));

    const { error: leagueMembersError } = leagueMembersPayload.length
      ? await supabase
        .from("league_members")
        .upsert(leagueMembersPayload, { onConflict: "league_id,user_id", ignoreDuplicates: true })
      : { error: null };

    if (leagueMembersError) throw leagueMembersError;

    const insertedPredictions = [];

    for (const userSeed of fakeUsers) {
      let totalPoints = 0;

      for (const resultRow of scoredRounds) {
        const picks = buildPicksForRound(userSeed, resultRow);
        const { points, breakdown } = calculatePoints(picks, resultRow);
        totalPoints += points;

        const { error: predictionError } = await supabase
          .from("predictions")
          .upsert({
            user_id: userSeed.id,
            race_round: resultRow.race_round,
            picks,
            score: points,
            score_breakdown: breakdown,
            updated_at: isoDaysAgo(Math.max(1, 16 - (resultRow.race_round * 2)), 16, 30),
          }, { onConflict: "user_id,race_round" });

        if (predictionError) throw predictionError;

        insertedPredictions.push({
          user_id: userSeed.id,
          username: userSeed.username,
          race_round: resultRow.race_round,
          score: points,
        });
      }

      const { error: updatePointsError } = await supabase
        .from("profiles")
        .update({ points: totalPoints })
        .eq("id", userSeed.id);

      if (updatePointsError) throw updatePointsError;
    }

    const conversationSeeds = buildConversationSeeds(scoredRounds, fakeUsers, league.id);
    const insertedPosts = [];
    let insertedComments = 0;

    for (const thread of conversationSeeds) {
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          author_id: thread.post.authorId,
          author_name: thread.post.authorName,
          title: thread.post.title,
          body: thread.post.body,
          league_id: thread.post.leagueId,
          created_at: thread.post.createdAt,
        })
        .select("id,title")
        .single();

      if (postError) throw postError;
      insertedPosts.push(post);

      if (thread.comments?.length) {
        const commentPayload = thread.comments.map((comment) => ({
          post_id: post.id,
          author_id: comment.authorId,
          author_name: comment.authorName,
          body: comment.body,
          created_at: comment.createdAt,
        }));

        const { error: commentError } = await supabase
          .from("comments")
          .insert(commentPayload);

        if (commentError) throw commentError;
        insertedComments += commentPayload.length;
      }
    }

    return respond({
      status: "ok",
      fakeProfiles: fakeUsers.map((user) => ({
        id: user.id,
        username: user.username,
      })),
      seededRounds: scoredRounds.map((round) => ({
        race_round: round.race_round,
        name: ROUND_NAMES[round.race_round] || `Round ${round.race_round}`,
      })),
      league: {
        id: league.id,
        name: league.name,
        code: league.code,
      },
      fakeProfileCount: fakeUsers.length,
      leagueMemberCount: leagueMembersPayload.length,
      predictionsInserted: insertedPredictions.length,
      postsInserted: insertedPosts.length,
      commentsInserted: insertedComments,
    });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Unexpected community seed error." }, 500);
  }
});
