import { TEAMS } from "./teams";

export const ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";

export const BRAND_NAME = "Stint";
export const BRAND_WORDMARK = "STINT";
export const BRAND_DESCRIPTOR = "F1 Predictions";
export const BRAND_TAGLINE = "Compete with sharper picks, cleaner reads, and race-week timing that stays in sync.";
export const SUPPORT_EMAIL = "support@stint-web.com";
export const LEGAL_DISCLAIMER = "Stint is an independent prediction platform and is not affiliated with, endorsed by, or officially connected to Formula 1, Formula One group companies, FIA, or any F1 team.";

export const BG_BASE = "#06101B";
export const BG_SURFACE = "#0E1929";
export const BG_ELEVATED = "#152338";
export const BG_HOVER = "#1E304A";

export const TEXT_PRIMARY = "#F6F7FB";
export const TEXT_SECONDARY = "rgba(214,223,239,0.74)";
export const TEXT_TERTIARY = "rgba(214,223,239,0.62)";

export const ACCENT = "#FF6A1A";
export const ACCENT_DARK = "#E65310";
export const ACCENT_GLOW = "rgba(255,106,26,0.18)";
export const SUCCESS = "#22C55E";
export const SPRINT = "#A855F7";
export const DANGER = "#EF4444";
export const INFO = "#3B82F6";
export const WARM = "#FFC247";

export const BRAND_GRADIENT = "linear-gradient(135deg,#FF6A1A 0%,#FFC247 100%)";
export const HERO_GRADIENT = "linear-gradient(90deg,#FF6A1A 0%,#FFC247 100%)";
export const BRAND_GRADIENT_SOFT = "linear-gradient(180deg,rgba(255,106,26,0.14),rgba(255,194,71,0.03))";
export const BRAND_BADGE_BG = "linear-gradient(180deg,rgba(245,239,230,0.98),rgba(233,224,210,0.96))";
export const BRAND_BADGE_BORDER = "1px solid rgba(255,237,213,0.72)";
export const BRAND_BADGE_SHADOW = "0 16px 40px rgba(255,106,26,0.16), inset 0 1px 0 rgba(255,255,255,0.5)";

export const PANEL_BG = BG_SURFACE;
export const PANEL_BG_ALT = BG_ELEVATED;
export const PANEL_BG_STRONG = BG_SURFACE;
export const PANEL_BORDER = "1px solid rgba(214,223,239,0.08)";
export const HAIRLINE = "rgba(214,223,239,0.08)";
export const EDGE_RING = "inset 0 1px 0 rgba(255,255,255,0.04)";
export const MUTED_TEXT = TEXT_SECONDARY;
export const SUBTLE_TEXT = TEXT_TERTIARY;

export const CONTENT_MAX = 1280;
export const SHELL_MAX = 1280;
export const HERO_TEXT_MAX = 760;

export const RADIUS_SM = 8;
export const RADIUS_MD = 12;
export const RADIUS_LG = 16;
export const RADIUS_XL = 20;
export const RADIUS_PILL = 999;

export const SECTION_RADIUS = 24;
export const CARD_RADIUS = RADIUS_LG;
export const SOFT_SHADOW = "0 22px 46px rgba(2,6,23,0.24)";
export const LIFTED_SHADOW = "0 28px 72px rgba(2,6,23,0.3)";
export const CARD_SHADOW = "0 4px 16px rgba(2,6,23,0.18)";

// --- Type Scale (#47) ---
export const TYPE_SCALE = {
  XS:  { size: 11, lineHeight: 1.5, weight: 400 },
  SM:  { size: 12, lineHeight: 1.6, weight: 400 },
  MD:  { size: 14, lineHeight: 1.7, weight: 400 },
  LG:  { size: 16, lineHeight: 1.6, weight: 500 },
  XL:  { size: 20, lineHeight: 1.4, weight: 600 },
  XXL: { size: 28, lineHeight: 1.2, weight: 700 },
};

// --- Letter-spacing (#48) ---
export const TRACKING = {
  TIGHT:  "-0.03em",
  NORMAL: "-0.01em",
  WIDE:   "0.08em",
  WIDER:  "0.12em",
};

// --- Line heights (#49) ---
export const LEADING = {
  TIGHT:   0.95,
  SNUG:    1.3,
  NORMAL:  1.6,
  RELAXED: 1.75,
  LOOSE:   1.9,
};

// --- Spacing scale — 8px base grid (#50) ---
export const SPACE = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20,
  6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
};

// --- Status tokens (#53) ---
export const ERROR_TEXT   = "#fca5a5";
export const ERROR_BG     = "rgba(239,68,68,0.08)";
export const ERROR_BORDER = "rgba(239,68,68,0.24)";
export const SUCCESS_TEXT   = "#86efac";
export const SUCCESS_BG     = "rgba(34,197,94,0.08)";
export const SUCCESS_BORDER = "rgba(34,197,94,0.24)";
export const WARN_TEXT   = "#fcd34d";
export const WARN_BG     = "rgba(252,211,77,0.08)";
export const WARN_BORDER = "rgba(252,211,77,0.24)";

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
  ember: { fill: "linear-gradient(135deg,#f97316,#fb923c)", bg: "rgba(249,115,22,0.18)", border: "rgba(249,115,22,0.28)", text: "#fff7ed", accent: "#f97316" },
  ocean: { fill: "linear-gradient(135deg,#2563eb,#38bdf8)", bg: "rgba(37,99,235,0.18)", border: "rgba(59,130,246,0.28)", text: "#eff6ff", accent: "#2563eb" },
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
    const start = mix(team.c, "#ffffff", option.team === "Audi" ? 0.22 : 0.08);
    const end = mix(team.c, "#0B1120", 0.34);

    return [option.key, {
      fill: `linear-gradient(135deg,${start},${end})`,
      bg: rgba(team.c, 0.18),
      border: rgba(team.c, 0.28),
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
  const accent = team?.c || theme.accent || ACCENT;

  return {
    accent,
    accentSoft: rgba(accent, 0.12),
    accentGhost: rgba(accent, 0.08),
    accentBorder: rgba(accent, 0.24),
    text: team?.t || theme.text || TEXT_PRIMARY,
    teamName,
    theme,
  };
}

export function isAdminUser(user) {
  return !!user && user.id === ADMIN_ID;
}
