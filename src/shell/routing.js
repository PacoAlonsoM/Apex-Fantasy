export const APP_BASE_PATH = "/app";

const APP_PAGE_KEYS = new Set([
  "home",
  "calendar",
  "public-picks",
  "predictions",
  "ai-brief",
  "news",
  "standings",
  "community",
  "grid",
  "admin",
  "profile",
  "game-guide",
  "support",
  "terms",
  "privacy",
  "pro",
  "pro_success",
]);

const ROOT_PATH_BY_PAGE = {
  home: "/",
  calendar: "/calendar",
  "public-picks": "/picks",
  "ai-brief": "/insight",
  news: "/wire",
  standings: "/leaderboard",
  community: "/leagues",
  grid: "/grid",
  pro: "/pro",
  pro_success: "/pro/success",
};

const PAGE_BY_ROOT_PATH = new Map(
  Object.entries(ROOT_PATH_BY_PAGE).map(([page, pathname]) => [pathname, page])
);

const LEGACY_SLUG_TO_PAGE = {
  home: "home",
  calendar: "calendar",
  picks: "public-picks",
  "public-picks": "public-picks",
  predictions: "predictions",
  insight: "ai-brief",
  "ai-brief": "ai-brief",
  news: "news",
  wire: "news",
  leaderboard: "standings",
  standings: "standings",
  leagues: "community",
  community: "grid",
  grid: "grid",
  admin: "admin",
  profile: "profile",
  "game-guide": "game-guide",
  support: "support",
  terms: "terms",
  privacy: "privacy",
  pro: "pro",
  "pro-success": "pro_success",
};

function normalizePathname(value) {
  if (!value || value === "/") return "/";
  return value.replace(/\/+$/, "") || "/";
}

function parseRaceRound(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isKnownPage(page) {
  return APP_PAGE_KEYS.has(page);
}

export function legacySlugToPage(value) {
  return LEGACY_SLUG_TO_PAGE[value] || null;
}

export function pathnameToPage(pathname) {
  return PAGE_BY_ROOT_PATH.get(normalizePathname(pathname)) || null;
}

export function isPublicPage(page) {
  return Object.prototype.hasOwnProperty.call(ROOT_PATH_BY_PAGE, page);
}

function resolvePage(pathname, params) {
  const queryPage = params.get("page");
  const requestedPage = isKnownPage(queryPage) ? queryPage : null;
  const rootPathPage = pathnameToPage(pathname);

  if (normalizePathname(pathname) === "/") {
    return requestedPage || "home";
  }

  return rootPathPage || requestedPage || "home";
}

export function readLocationState() {
  const params = new URLSearchParams(window.location.search);
  const pathname = normalizePathname(window.location.pathname);

  return {
    demoMode: params.get("demo") === "1",
    page: resolvePage(pathname, params),
    raceRound: parseRaceRound(params.get("race")),
  };
}

export function pageToHref(page, options = {}) {
  const { demoMode = false, raceRound = null } = options;
  const resolvedPage = isKnownPage(page) ? page : "home";
  const pathname = ROOT_PATH_BY_PAGE[resolvedPage] || "/";
  const params = new URLSearchParams();

  if (!ROOT_PATH_BY_PAGE[resolvedPage] && resolvedPage !== "home") {
    params.set("page", resolvedPage);
  }

  if (resolvedPage === "predictions" && raceRound) {
    params.set("race", String(raceRound));
  }

  if (demoMode) {
    params.set("demo", "1");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
