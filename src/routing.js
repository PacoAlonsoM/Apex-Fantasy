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
  "admin",
  "profile",
  "game-guide",
  "support",
  "terms",
  "privacy",
]);

function normalizePathname(value) {
  if (!value || value === "/") return "/";
  return value.replace(/\/+$/, "") || "/";
}

function parseRaceRound(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isPublicPage(page) {
  return false;
}

export function readLocationState() {
  const params = new URLSearchParams(window.location.search);
  const pathname = normalizePathname(window.location.pathname);
  const requestedPage = params.get("page");
  const withinPrivateApp = pathname === APP_BASE_PATH || pathname.startsWith(`${APP_BASE_PATH}/`);

  return {
    demoMode: params.get("demo") === "1",
    page: withinPrivateApp && requestedPage && APP_PAGE_KEYS.has(requestedPage) ? requestedPage : "home",
    raceRound: parseRaceRound(params.get("race")),
  };
}

export function pageToHref(page, options = {}) {
  const { demoMode = false, raceRound = null } = options;
  const params = new URLSearchParams();

  if (page !== "home") {
    params.set("page", page);
  }

  if (page === "predictions" && raceRound) {
    params.set("race", String(raceRound));
  }

  if (demoMode) {
    params.set("demo", "1");
  }

  const query = params.toString();
  return query ? `${APP_BASE_PATH}?${query}` : APP_BASE_PATH;
}
