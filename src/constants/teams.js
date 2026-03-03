const TEAM_BASE = {
  "McLaren": { c: "#ff8000", t: "#111827", soft: "rgba(255,128,0,0.14)", border: "rgba(255,128,0,0.28)" },
  "Ferrari": { c: "#dc2626", t: "#ffffff", soft: "rgba(220,38,38,0.14)", border: "rgba(220,38,38,0.28)" },
  "Mercedes": { c: "#00d2be", t: "#031b17", soft: "rgba(0,210,190,0.14)", border: "rgba(0,210,190,0.28)" },
  "Red Bull Racing": { c: "#1d4ed8", t: "#ffffff", soft: "rgba(29,78,216,0.14)", border: "rgba(29,78,216,0.28)" },
  "Aston Martin": { c: "#0f766e", t: "#ffffff", soft: "rgba(15,118,110,0.14)", border: "rgba(15,118,110,0.28)" },
  "Alpine": { c: "#ec4899", t: "#ffffff", soft: "rgba(236,72,153,0.14)", border: "rgba(236,72,153,0.28)" },
  "Haas": { c: "#cbd5e1", t: "#0f172a", soft: "rgba(203,213,225,0.14)", border: "rgba(203,213,225,0.28)" },
  "Racing Bulls": { c: "#5b8cff", t: "#ffffff", soft: "rgba(91,140,255,0.14)", border: "rgba(91,140,255,0.28)" },
  "Williams": { c: "#2563eb", t: "#ffffff", soft: "rgba(37,99,235,0.14)", border: "rgba(37,99,235,0.28)" },
  "Audi": { c: "#a1a1aa", t: "#111827", soft: "rgba(161,161,170,0.14)", border: "rgba(161,161,170,0.28)" },
  "Cadillac": { c: "#22c55e", t: "#052e16", soft: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.28)" },
};

export const TEAMS = {
  ...TEAM_BASE,
  "Red Bull": TEAM_BASE["Red Bull Racing"],
  "RB": TEAM_BASE["Racing Bulls"],
  "Haas F1 Team": TEAM_BASE["Haas"],
};

export const DRV = [
  { n: "Lando Norris", s: "NOR", nb: 1, t: "McLaren" },
  { n: "Oscar Piastri", s: "PIA", nb: 81, t: "McLaren" },
  { n: "Charles Leclerc", s: "LEC", nb: 16, t: "Ferrari" },
  { n: "Lewis Hamilton", s: "HAM", nb: 44, t: "Ferrari" },
  { n: "George Russell", s: "RUS", nb: 63, t: "Mercedes" },
  { n: "Kimi Antonelli", s: "ANT", nb: 12, t: "Mercedes" },
  { n: "Max Verstappen", s: "VER", nb: 33, t: "Red Bull Racing" },
  { n: "Isack Hadjar", s: "HAD", nb: 6, t: "Red Bull Racing" },
  { n: "Fernando Alonso", s: "ALO", nb: 14, t: "Aston Martin" },
  { n: "Lance Stroll", s: "STR", nb: 18, t: "Aston Martin" },
  { n: "Pierre Gasly", s: "GAS", nb: 10, t: "Alpine" },
  { n: "Franco Colapinto", s: "COL", nb: 43, t: "Alpine" },
  { n: "Oliver Bearman", s: "BEA", nb: 87, t: "Haas" },
  { n: "Esteban Ocon", s: "OCO", nb: 31, t: "Haas" },
  { n: "Liam Lawson", s: "LAW", nb: 30, t: "Racing Bulls" },
  { n: "Arvid Lindblad", s: "LIN", nb: 37, t: "Racing Bulls" },
  { n: "Alexander Albon", s: "ALB", nb: 23, t: "Williams" },
  { n: "Carlos Sainz", s: "SAI", nb: 55, t: "Williams" },
  { n: "Nico Hulkenberg", s: "HUL", nb: 27, t: "Audi" },
  { n: "Gabriel Bortoleto", s: "BOR", nb: 5, t: "Audi" },
  { n: "Sergio Perez", s: "PER", nb: 11, t: "Cadillac" },
  { n: "Valtteri Bottas", s: "BOT", nb: 77, t: "Cadillac" },
];

export const CONSTRUCTORS = [...new Set(DRV.map((driver) => driver.t))];
