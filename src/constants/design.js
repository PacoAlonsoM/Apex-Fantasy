import { TEAMS } from "./teams";

export const ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";

export const BRAND_GRADIENT = "linear-gradient(135deg,#f97316 0%,#fb923c 52%,#facc15 100%)";
export const BRAND_GRADIENT_SOFT = "linear-gradient(180deg,rgba(249,115,22,0.12),rgba(250,204,21,0.03))";
export const PANEL_BG = "#0c1424";
export const PANEL_BG_ALT = "#101a2d";
export const PANEL_BG_STRONG = "#08111d";
export const PANEL_BORDER = "1px solid rgba(148,163,184,0.22)";
export const MUTED_TEXT = "rgba(226,232,240,0.74)";
export const SUBTLE_TEXT = "rgba(148,163,184,0.78)";
export const HAIRLINE = "rgba(148,163,184,0.14)";

export const DEFAULT_AVATAR_COLOR = "ember";

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3
    ? clean.split("").map((char) => char + char).join("")
    : clean;

  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(hexA, hexB, ratio) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const blend = (start, end) => Math.round(start + (end - start) * ratio);
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(blend(a.r, b.r))}${toHex(blend(a.g, b.g))}${toHex(blend(a.b, b.b))}`;
}

const BASE_AVATAR_THEMES = {
  ember: { fill: "linear-gradient(135deg,#f97316,#fb923c)", bg: "rgba(249,115,22,0.18)", border: "rgba(249,115,22,0.3)", text: "#fff", accent: "#f97316" },
  ocean: { fill: "linear-gradient(135deg,#2563eb,#38bdf8)", bg: "rgba(37,99,235,0.18)", border: "rgba(59,130,246,0.3)", text: "#eff6ff", accent: "#2563eb" },
  teal: { fill: "linear-gradient(135deg,#0f766e,#2dd4bf)", bg: "rgba(15,118,110,0.18)", border: "rgba(45,212,191,0.28)", text: "#ecfeff", accent: "#0f766e" },
  steel: { fill: "linear-gradient(135deg,#334155,#64748b)", bg: "rgba(100,116,139,0.18)", border: "rgba(148,163,184,0.28)", text: "#f8fafc", accent: "#64748b" },
  gold: { fill: "linear-gradient(135deg,#d97706,#facc15)", bg: "rgba(217,119,6,0.18)", border: "rgba(250,204,21,0.28)", text: "#fff7ed", accent: "#facc15" },
  violet: { fill: "linear-gradient(135deg,#7c3aed,#a78bfa)", bg: "rgba(124,58,237,0.18)", border: "rgba(167,139,250,0.3)", text: "#f5f3ff", accent: "#7c3aed" },
};

export const TEAM_AVATAR_OPTIONS = [
  { key: "support-mclaren", label: "McLaren", team: "McLaren" },
  { key: "support-ferrari", label: "Ferrari", team: "Ferrari" },
  { key: "support-mercedes", label: "Mercedes", team: "Mercedes" },
  { key: "support-red-bull", label: "Red Bull", team: "Red Bull Racing" },
  { key: "support-aston", label: "Aston Martin", team: "Aston Martin" },
  { key: "support-alpine", label: "Alpine", team: "Alpine" },
  { key: "support-haas", label: "Haas", team: "Haas" },
  { key: "support-rb", label: "Racing Bulls", team: "Racing Bulls" },
  { key: "support-williams", label: "Williams", team: "Williams" },
  { key: "support-audi", label: "Audi", team: "Audi" },
  { key: "support-cadillac", label: "Cadillac", team: "Cadillac" },
];

export const TEAM_TO_AVATAR_KEY = Object.fromEntries(
  TEAM_AVATAR_OPTIONS.map((option) => [option.team, option.key])
);

const TEAM_AVATAR_THEMES = Object.fromEntries(
  TEAM_AVATAR_OPTIONS.map((option) => {
    const team = TEAMS[option.team];
    const start = mix(team.c, "#ffffff", option.team === "Audi" ? 0.22 : 0.1);
    const end = mix(team.c, "#0f172a", 0.32);

    return [option.key, {
      fill: `linear-gradient(135deg,${start},${end})`,
      bg: rgba(team.c, 0.18),
      border: rgba(team.c, 0.34),
      text: team.t,
      label: option.label,
      teamName: option.team,
      accent: team.c,
    }];
  })
);

export const AVATAR_THEMES = {
  ...BASE_AVATAR_THEMES,
  ...TEAM_AVATAR_THEMES,
};

export function rgbaFromHex(hex, alpha) {
  return rgba(hex, alpha);
}

export function avatarTheme(colorKey) {
  return AVATAR_THEMES[colorKey] || AVATAR_THEMES[DEFAULT_AVATAR_COLOR];
}

export function teamSupportKey(teamName) {
  return TEAM_TO_AVATAR_KEY[teamName] || DEFAULT_AVATAR_COLOR;
}

export function getUserSupportTeam(user) {
  if (user?.favorite_team && TEAMS[user.favorite_team]) return user.favorite_team;
  const theme = avatarTheme(user?.avatar_color);
  return theme.teamName && TEAMS[theme.teamName] ? theme.teamName : null;
}

export function getUserAccentTheme(user) {
  const theme = avatarTheme(user?.avatar_color);
  const teamName = getUserSupportTeam(user);
  const team = teamName ? TEAMS[teamName] : null;
  const accent = team?.c || theme.accent || "#f97316";

  return {
    accent,
    accentSoft: rgba(accent, 0.16),
    accentGhost: rgba(accent, 0.1),
    accentBorder: rgba(accent, 0.32),
    text: team?.t || theme.text || "#fff",
    teamName,
    theme,
  };
}

export function isAdminUser(user) {
  return !!user && user.id === ADMIN_ID;
}
