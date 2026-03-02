export const TEAMS = {
  "Red Bull": { c: "#3671C6", t: "#fff" },
  "Ferrari": { c: "#E8002D", t: "#fff" },
  "Mercedes": { c: "#00D2BE", t: "#000" },
  "McLaren": { c: "#FF8000", t: "#000" },
  "Aston Martin": { c: "#229971", t: "#fff" },
  "Alpine": { c: "#0090FF", t: "#fff" },
  "Williams": { c: "#005AFF", t: "#fff" },
  "Haas": { c: "#B6BABD", t: "#000" },
  "Audi": { c: "#888", t: "#fff" },
  "RB": { c: "#6692FF", t: "#fff" },
};

export const DRV = [
  { n: "Max Verstappen", s: "VER", nb: 1, t: "Red Bull" },
  { n: "Liam Lawson", s: "LAW", nb: 30, t: "Red Bull" },
  { n: "Charles Leclerc", s: "LEC", nb: 16, t: "Ferrari" },
  { n: "Lewis Hamilton", s: "HAM", nb: 44, t: "Ferrari" },
  { n: "George Russell", s: "RUS", nb: 63, t: "Mercedes" },
  { n: "Kimi Antonelli", s: "ANT", nb: 12, t: "Mercedes" },
  { n: "Lando Norris", s: "NOR", nb: 4, t: "McLaren" },
  { n: "Oscar Piastri", s: "PIA", nb: 81, t: "McLaren" },
  { n: "Fernando Alonso", s: "ALO", nb: 14, t: "Aston Martin" },
  { n: "Lance Stroll", s: "STR", nb: 18, t: "Aston Martin" },
  { n: "Pierre Gasly", s: "GAS", nb: 10, t: "Alpine" },
  { n: "Jack Doohan", s: "DOO", nb: 7, t: "Alpine" },
  { n: "Alexander Albon", s: "ALB", nb: 23, t: "Williams" },
  { n: "Carlos Sainz", s: "SAI", nb: 55, t: "Williams" },
  { n: "Esteban Ocon", s: "OCO", nb: 31, t: "Haas" },
  { n: "Oliver Bearman", s: "BEA", nb: 87, t: "Haas" },
  { n: "Nico Hulkenberg", s: "HUL", nb: 27, t: "Audi" },
  { n: "Gabriel Bortoleto", s: "BOR", nb: 5, t: "Audi" },
  { n: "Yuki Tsunoda", s: "TSU", nb: 22, t: "RB" },
  { n: "Isack Hadjar", s: "HAD", nb: 6, t: "RB" },
];

export const CONSTRUCTORS = [...new Set(DRV.map(d => d.t))];