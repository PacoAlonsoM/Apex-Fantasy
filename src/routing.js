const APP_PAGE_KEYS = new Set([
  "home",
  "calendar",
  "public-picks",
  "predictions",
  "ai-brief",
  "news",
  "standings",
  "community",
  "admin",
  "profile",
  "game-guide",
  "support",
  "terms",
  "privacy",
]);

export const PUBLIC_PAGE_PATHS = {
  home: "/",
  calendar: "/calendar",
  "public-picks": "/picks",
  news: "/wire",
  standings: "/leaderboard",
};

const PATH_TO_PAGE = {
  "/": "home",
  "/calendar": "calendar",
  "/picks": "public-picks",
  "/wire": "news",
  "/leaderboard": "standings",
};

function normalizePathname(value) {
  if (!value || value === "/") return "/";
  return value.replace(/\/+$/, "") || "/";
}

function parseRaceRound(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isPublicPage(page) {
  return Boolean(PUBLIC_PAGE_PATHS[page]);
}

export function readLocationState() {
  const params = new URLSearchParams(window.location.search);
  const pathname = normalizePathname(window.location.pathname);
  const requestedPage = params.get("page");
  const publicPage = PATH_TO_PAGE[pathname];

  return {
    demoMode: params.get("demo") === "1",
    page: publicPage || (requestedPage && APP_PAGE_KEYS.has(requestedPage) ? requestedPage : "home"),
    raceRound: parseRaceRound(params.get("race")),
  };
}

export function pageToHref(page, options = {}) {
  const { demoMode = false, raceRound = null } = options;
  const pathname = PUBLIC_PAGE_PATHS[page] || "/";
  const params = new URLSearchParams();

  if (!isPublicPage(page) && page !== "home") {
    params.set("page", page);
  }

  if (page === "predictions" && raceRound) {
    params.set("race", String(raceRound));
  }

  if (demoMode) {
    params.set("demo", "1");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
