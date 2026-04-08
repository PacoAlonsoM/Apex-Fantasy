import { supabase } from "@/src/lib/supabase";
import { syncLocalAdminSession } from "@/src/lib/adminSession";
import { requireActiveSession } from "@/src/shell/authProfile";

function isLikelyJwt(value) {
  const token = String(value || "").trim();
  return token.length > 20 && token.split(".").length === 3;
}

function extractAccessToken(payload, seen = new Set()) {
  if (!payload) return "";

  if (typeof payload === "string") {
    return isLikelyJwt(payload) ? payload.trim() : "";
  }

  if (typeof payload !== "object") return "";
  if (seen.has(payload)) return "";
  seen.add(payload);

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const nestedToken = extractAccessToken(item, seen);
      if (nestedToken) return nestedToken;
    }
    return "";
  }

  const directToken = extractAccessToken(payload.access_token || payload.accessToken, seen);
  if (directToken) return directToken;

  for (const key of ["currentSession", "session", "data", "state", "value", "result"]) {
    const nestedToken = extractAccessToken(payload[key], seen);
    if (nestedToken) return nestedToken;
  }

  return "";
}

function readTokenFromStorage(storage) {
  if (!storage) return "";

  const keys = Object.keys(storage).filter((key) => key.startsWith("sb-") || key.includes("auth-token"));

  for (const key of keys) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const directToken = extractAccessToken(parsed);
      if (directToken) return directToken;
    } catch (_error) {
      continue;
    }
  }

  return "";
}

function readStoredAccessToken() {
  if (typeof window === "undefined") return "";

  return readTokenFromStorage(window.localStorage) || readTokenFromStorage(window.sessionStorage);
}

async function validateAccessToken(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) return "";

  try {
    const { data, error } = await supabase.auth.getUser(token);
    return !error && data?.user ? token : "";
  } catch (_error) {
    return "";
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.message || payload?.error || "Admin request failed.";
    const error = new Error(message);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function getAccessToken() {
  try {
    const session = await requireActiveSession();
    const accessToken = extractAccessToken(session);
    if (accessToken) return accessToken;
  } catch (_error) {
    // Fall through to other session readers.
  }

  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = await validateAccessToken(extractAccessToken(data?.session || data));
    if (accessToken) return accessToken;
  } catch (_error) {
    // Fall through to storage.
  }

  return await validateAccessToken(readStoredAccessToken());
}

async function getAuthContext({ syncCookie = false } = {}) {
  const accessToken = await getAccessToken();
  if (syncCookie) {
    await syncLocalAdminSession(accessToken || "");
  } else if (accessToken) {
    syncLocalAdminSession(accessToken);
  }

  return {
    accessToken,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  };
}

async function getJson(path) {
  const { headers } = await getAuthContext();
  const response = await fetch(path, {
    cache: "no-store",
    headers,
  });
  return await parseResponse(response);
}

async function postJson(path, body = {}) {
  const { accessToken, headers } = await getAuthContext({ syncCookie: true });
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      ...body,
      __authToken: accessToken || null,
    }),
  });

  return await parseResponse(response);
}

export function fetchAdminDashboard(season = 2026) {
  return getJson(`/api/admin/dashboard?season=${season}`);
}

export function fetchRoundResults(season, round) {
  return getJson(`/api/admin/results?season=${season}&round=${round}`);
}

export function importRoundResults(season, round) {
  return postJson("/api/admin/results/import", { season, round });
}

export function saveRoundDraft(season, round, draft) {
  return postJson("/api/admin/results/save-draft", { season, round, draft });
}

export function publishRoundResults(season, round) {
  return postJson("/api/admin/results/publish", { season, round });
}

export function awardRoundPoints(season, round) {
  return postJson("/api/admin/results/award-points", { season, round });
}

export function syncNewsFeed(season = 2026) {
  return postJson("/api/admin/news/sync", { season });
}

export function syncSchedule(season = 2026) {
  return postJson("/api/admin/schedule/sync", { season });
}

export function saveScheduleOverride(season, round, payload) {
  return postJson("/api/admin/schedule/override", {
    season,
    round,
    ...payload,
  });
}

export function backfillHistory(season = 2026) {
  return postJson("/api/admin/history-backfill", { season, year: season });
}

export function generateAiBrief(season = 2026) {
  return postJson("/api/admin/ai/generate-brief", { season });
}

export function repairAiLiveData(season = 2026) {
  return postJson("/api/admin/ai/repair-live-data", { season });
}
