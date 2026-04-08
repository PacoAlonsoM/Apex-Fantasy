export const FLAG = {
  Australia: "#FFCD00",
  China: "#DE2910",
  Japan: "#BC002D",
  Bahrain: "#CE1126",
  "Saudi Arabia": "#006C35",
  "USA-Miami": "#3C3B6E",
  Canada: "#FF0000",
  Monaco: "#A8062E",
  "Spain-BCN": "#F1BF00",
  Austria: "#ED2939",
  UK: "#012169",
  Belgium: "#FDDA24",
  Hungary: "#47704F",
  Netherlands: "#FF6600",
  Italy: "#009246",
  "Spain-MAD": "#AA151B",
  Azerbaijan: "#0092BC",
  Singapore: "#EF3340",
  "USA-TX": "#B22234",
  Mexico: "#006847",
  Brazil: "#FFDF00",
  "USA-LV": "#5E17EB",
  Qatar: "#8D1B3D",
  UAE: "#00732F",
};

export const CAL = [
  { r: 1, displayRound: 1, slug: "australian-gp", n: "Australian GP", circuit: "Albert Park Circuit", city: "Melbourne", cc: "Australia", date: "2026-03-08", type: "Permanent", len: 5.278, laps: 58, rec: "1:20.235", recBy: "C. Leclerc", recY: 2022, drs: 4, sprint: false, turns: 16, elev: 0, flagKey: "Australia", aliases: ["Grand Prix of Australia"] },
  { r: 2, displayRound: 2, slug: "chinese-gp", n: "Chinese GP", circuit: "Shanghai International Circuit", city: "Shanghai", cc: "China", date: "2026-03-15", type: "Permanent", len: 5.451, laps: 56, rec: "1:32.238", recBy: "M. Schumacher", recY: 2004, drs: 2, sprint: true, turns: 16, elev: 7, flagKey: "China", aliases: ["Grand Prix of China"] },
  { r: 3, displayRound: 3, slug: "japanese-gp", n: "Japanese GP", circuit: "Suzuka International Course", city: "Suzuka", cc: "Japan", date: "2026-03-29", type: "Permanent", len: 5.807, laps: 53, rec: "1:30.983", recBy: "V. Bottas", recY: 2019, drs: 2, sprint: false, turns: 18, elev: 42, flagKey: "Japan", aliases: ["Grand Prix of Japan"] },
  { r: 4, displayRound: null, slug: "bahrain-gp", n: "Bahrain GP", circuit: "Bahrain International Circuit", city: "Sakhir", cc: "Bahrain", date: "2026-04-12", type: "Permanent", len: 5.412, laps: 57, rec: "1:31.447", recBy: "P. de la Rosa", recY: 2005, drs: 3, sprint: false, turns: 15, elev: 10, flagKey: "Bahrain", status: "cancelled", aliases: ["Grand Prix of Bahrain"] },
  { r: 5, displayRound: null, slug: "saudi-arabian-gp", n: "Saudi Arabian GP", circuit: "Jeddah Corniche Circuit", city: "Jeddah", cc: "Saudi Arabia", date: "2026-04-19", type: "Street", len: 6.174, laps: 50, rec: "1:30.734", recBy: "L. Hamilton", recY: 2021, drs: 3, sprint: false, turns: 27, elev: 5, flagKey: "Saudi Arabia", status: "cancelled", aliases: ["Grand Prix of Saudi Arabia", "Saudi Arabian Grand Prix"] },
  { r: 6, displayRound: 4, slug: "miami-gp", n: "Miami GP", circuit: "Miami International Autodrome", city: "Miami", cc: "USA", date: "2026-05-03", type: "Street", len: 5.412, laps: 57, rec: "1:29.708", recBy: "M. Verstappen", recY: 2023, drs: 3, sprint: true, turns: 19, elev: 0, flagKey: "USA-Miami", aliases: ["Grand Prix of Miami", "Miami Grand Prix"] },
  { r: 7, displayRound: 5, slug: "canadian-gp", n: "Canadian GP", circuit: "Circuit Gilles Villeneuve", city: "Montreal", cc: "Canada", date: "2026-05-24", type: "Street", len: 4.361, laps: 70, rec: "1:13.078", recBy: "V. Bottas", recY: 2019, drs: 3, sprint: true, turns: 14, elev: 3, flagKey: "Canada", aliases: ["Grand Prix of Canada", "Canadian Grand Prix"] },
  { r: 8, displayRound: 6, slug: "monaco-gp", n: "Monaco GP", circuit: "Circuit de Monaco", city: "Monte Carlo", cc: "Monaco", date: "2026-06-07", type: "Street", len: 3.337, laps: 78, rec: "1:12.909", recBy: "L. Norris", recY: 2024, drs: 1, sprint: false, turns: 19, elev: 42, flagKey: "Monaco", aliases: ["Grand Prix of Monaco"] },
  { r: 9, displayRound: 7, slug: "spanish-gp", n: "Spanish GP", circuit: "Circuit de Barcelona-Catalunya", city: "Barcelona", cc: "Spain", date: "2026-06-14", type: "Permanent", len: 4.657, laps: 66, rec: "1:16.330", recBy: "M. Verstappen", recY: 2023, drs: 2, sprint: false, turns: 14, elev: 29, flagKey: "Spain-BCN", aliases: ["Grand Prix of Spain", "Barcelona Grand Prix"] },
  { r: 10, displayRound: 8, slug: "austrian-gp", n: "Austrian GP", circuit: "Red Bull Ring", city: "Spielberg", cc: "Austria", date: "2026-06-28", type: "Permanent", len: 4.318, laps: 71, rec: "1:05.619", recBy: "C. Sainz", recY: 2020, drs: 3, sprint: false, turns: 10, elev: 65, flagKey: "Austria", aliases: ["Grand Prix of Austria"] },
  { r: 11, displayRound: 9, slug: "british-gp", n: "British GP", circuit: "Silverstone Circuit", city: "Silverstone", cc: "United Kingdom", date: "2026-07-05", type: "Permanent", len: 5.891, laps: 52, rec: "1:27.097", recBy: "M. Verstappen", recY: 2020, drs: 2, sprint: true, turns: 18, elev: 14, flagKey: "UK", aliases: ["Grand Prix of Great Britain", "British Grand Prix", "Great Britain Grand Prix"] },
  { r: 12, displayRound: 10, slug: "belgian-gp", n: "Belgian GP", circuit: "Circuit de Spa-Francorchamps", city: "Spa", cc: "Belgium", date: "2026-07-19", type: "Permanent", len: 7.004, laps: 44, rec: "1:46.286", recBy: "V. Bottas", recY: 2018, drs: 2, sprint: false, turns: 19, elev: 104, flagKey: "Belgium", aliases: ["Grand Prix of Belgium", "Belgian Grand Prix"] },
  { r: 13, displayRound: 11, slug: "hungarian-gp", n: "Hungarian GP", circuit: "Hungaroring", city: "Budapest", cc: "Hungary", date: "2026-07-26", type: "Permanent", len: 4.381, laps: 70, rec: "1:16.627", recBy: "L. Hamilton", recY: 2020, drs: 2, sprint: false, turns: 14, elev: 38, flagKey: "Hungary", aliases: ["Grand Prix of Hungary", "Hungarian Grand Prix"] },
  { r: 14, displayRound: 12, slug: "dutch-gp", n: "Dutch GP", circuit: "Circuit Zandvoort", city: "Zandvoort", cc: "Netherlands", date: "2026-08-23", type: "Permanent", len: 4.259, laps: 72, rec: "1:11.097", recBy: "M. Verstappen", recY: 2023, drs: 2, sprint: true, turns: 14, elev: 17, flagKey: "Netherlands", aliases: ["Grand Prix of the Netherlands", "Dutch Grand Prix"] },
  { r: 15, displayRound: 13, slug: "italian-gp", n: "Italian GP", circuit: "Autodromo Nazionale Monza", city: "Monza", cc: "Italy", date: "2026-09-06", type: "Permanent", len: 5.793, laps: 53, rec: "1:21.046", recBy: "R. Barrichello", recY: 2004, drs: 2, sprint: false, turns: 11, elev: 14, flagKey: "Italy", aliases: ["Grand Prix of Italy", "Italian Grand Prix"] },
  { r: 16, displayRound: 14, slug: "madrid-gp", n: "Madrid GP", circuit: "Ifema Madrid Circuit", city: "Madrid", cc: "Spain", date: "2026-09-13", type: "Street", len: 5.474, laps: 55, rec: "—", recBy: "New Circuit", recY: 2026, drs: 3, sprint: false, turns: 20, elev: 8, flagKey: "Spain-MAD", aliases: ["Grand Prix of Madrid", "Madrid Grand Prix"] },
  { r: 17, displayRound: 15, slug: "azerbaijan-gp", n: "Azerbaijan GP", circuit: "Baku City Circuit", city: "Baku", cc: "Azerbaijan", date: "2026-09-26", type: "Street", len: 6.003, laps: 51, rec: "1:43.009", recBy: "C. Leclerc", recY: 2019, drs: 2, sprint: false, turns: 20, elev: 26, flagKey: "Azerbaijan", aliases: ["Grand Prix of Azerbaijan", "Azerbaijan Grand Prix"] },
  { r: 18, displayRound: 16, slug: "singapore-gp", n: "Singapore GP", circuit: "Marina Bay Street Circuit", city: "Singapore", cc: "Singapore", date: "2026-10-11", type: "Street", len: 4.940, laps: 62, rec: "1:35.867", recBy: "L. Hamilton", recY: 2023, drs: 3, sprint: true, turns: 19, elev: 5, flagKey: "Singapore", aliases: ["Grand Prix of Singapore", "Singapore Grand Prix"] },
  { r: 19, displayRound: 17, slug: "us-gp", n: "US GP", circuit: "Circuit of the Americas", city: "Austin", cc: "USA", date: "2026-10-25", type: "Permanent", len: 5.513, laps: 56, rec: "1:36.169", recBy: "C. Leclerc", recY: 2019, drs: 2, sprint: false, turns: 20, elev: 41, flagKey: "USA-TX", aliases: ["United States Grand Prix", "Grand Prix of the United States", "Austin Grand Prix"] },
  { r: 20, displayRound: 18, slug: "mexico-city-gp", n: "Mexico City GP", circuit: "Autodromo Hermanos Rodriguez", city: "Mexico City", cc: "Mexico", date: "2026-11-01", type: "Permanent", len: 4.304, laps: 71, rec: "1:17.774", recBy: "V. Bottas", recY: 2021, drs: 3, sprint: false, turns: 17, elev: 2240, flagKey: "Mexico", aliases: ["Mexican Grand Prix", "Grand Prix of Mexico", "Mexico Grand Prix"] },
  { r: 21, displayRound: 19, slug: "sao-paulo-gp", n: "Sao Paulo GP", circuit: "Autodromo Jose Carlos Pace", city: "Sao Paulo", cc: "Brazil", date: "2026-11-08", type: "Permanent", len: 4.309, laps: 71, rec: "1:10.540", recBy: "V. Bottas", recY: 2018, drs: 2, sprint: false, turns: 15, elev: 16, flagKey: "Brazil", aliases: ["Brazilian Grand Prix", "Grand Prix of Sao Paulo", "Sao Paulo Grand Prix", "Grand Prix of Brazil"] },
  { r: 22, displayRound: 20, slug: "las-vegas-gp", n: "Las Vegas GP", circuit: "Las Vegas Strip Circuit", city: "Las Vegas", cc: "USA", date: "2026-11-21", type: "Street", len: 6.201, laps: 50, rec: "1:35.490", recBy: "O. Piastri", recY: 2024, drs: 3, sprint: false, turns: 17, elev: 0, flagKey: "USA-LV", aliases: ["Grand Prix of Las Vegas", "Las Vegas Grand Prix"] },
  { r: 23, displayRound: 21, slug: "qatar-gp", n: "Qatar GP", circuit: "Lusail International Circuit", city: "Lusail", cc: "Qatar", date: "2026-11-29", type: "Permanent", len: 5.419, laps: 57, rec: "1:24.319", recBy: "M. Verstappen", recY: 2023, drs: 2, sprint: false, turns: 16, elev: 8, flagKey: "Qatar", aliases: ["Grand Prix of Qatar", "Qatar Grand Prix"] },
  { r: 24, displayRound: 22, slug: "abu-dhabi-gp", n: "Abu Dhabi GP", circuit: "Yas Marina Circuit", city: "Abu Dhabi", cc: "UAE", date: "2026-12-06", type: "Permanent", len: 5.281, laps: 58, rec: "1:26.103", recBy: "M. Verstappen", recY: 2021, drs: 2, sprint: false, turns: 16, elev: 3, flagKey: "UAE", aliases: ["Grand Prix of Abu Dhabi", "Abu Dhabi Grand Prix"] },
];

const INACTIVE_RACE_STATUSES = new Set(["cancelled", "postponed"]);

export function isRaceCancelled(race) {
  return INACTIVE_RACE_STATUSES.has(String(race?.status || "").toLowerCase());
}

export const ACTIVE_CAL = CAL.filter((race) => !isRaceCancelled(race));
export const ACTIVE_RACE_COUNT = ACTIVE_CAL.length;

export const rc = (race) => FLAG[race.flagKey] || "#fb923c";

export function parseDate(value) {
  if (value instanceof Date) return value;
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function shiftDate(value, days) {
  const date = parseDate(value);
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function fmt(value) {
  return parseDate(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function fmtFull(value) {
  return parseDate(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function monthLabel(value) {
  return parseDate(value).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function nextRace(calendar = ACTIVE_CAL) {
  const races = (Array.isArray(calendar) ? calendar : ACTIVE_CAL).filter((race) => !isRaceCancelled(race));
  const now = new Date();
  return races.find((race) => parseDate(race.date) >= now) || races[races.length - 1] || null;
}

export function countdown(value) {
  const diff = parseDate(value) - new Date();
  if (diff < 0) return null;
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
  };
}

export function raceSessions(race) {
  if (!race) return [];

  if (race.sprint) {
    return [
      { key: "fp1", label: "FP1", detail: "Practice", date: shiftDate(race.date, -2), tone: "practice" },
      { key: "sprint-quali", label: "Sprint Qualifying", detail: "SQ1 · SQ2 · SQ3", date: shiftDate(race.date, -2), tone: "qualifying" },
      { key: "sprint", label: "Sprint", detail: "Points session", date: shiftDate(race.date, -1), tone: "sprint" },
      { key: "qualifying", label: "Qualifying", detail: "Q1 · Q2 · Q3", date: shiftDate(race.date, -1), tone: "qualifying" },
      { key: "race", label: "Race", detail: "Grand Prix", date: shiftDate(race.date, 0), tone: "race" },
    ];
  }

  return [
    { key: "fp1", label: "FP1", detail: "Practice 1", date: shiftDate(race.date, -2), tone: "practice" },
    { key: "fp2", label: "FP2", detail: "Practice 2", date: shiftDate(race.date, -2), tone: "practice" },
    { key: "fp3", label: "FP3", detail: "Practice 3", date: shiftDate(race.date, -1), tone: "practice" },
    { key: "qualifying", label: "Qualifying", detail: "Q1 · Q2 · Q3", date: shiftDate(race.date, -1), tone: "qualifying" },
    { key: "race", label: "Race", detail: "Grand Prix", date: shiftDate(race.date, 0), tone: "race" },
  ];
}
