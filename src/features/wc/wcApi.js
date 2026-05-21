import { supabase } from "@/src/lib/supabase";

async function getAccessToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  } catch (_error) {
    return "";
  }
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "WC request failed.");
  }
  return payload;
}

async function wcGet(path) {
  const token = await getAccessToken();
  const response = await fetch(path, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return parseResponse(response);
}

async function wcPost(path, body = {}) {
  const token = await getAccessToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...body,
      __authToken: token || null,
    }),
  });
  return parseResponse(response);
}

async function wcDelete(path, body = {}) {
  const token = await getAccessToken();
  const response = await fetch(path, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...body,
      __authToken: token || null,
    }),
  });
  return parseResponse(response);
}

export function fetchWcBootstrap() {
  return wcGet("/api/wc/bootstrap");
}

export function saveWcMatchPick(payload) {
  return wcPost("/api/wc/picks", payload);
}

export function saveWcBracket(picks) {
  return wcPost("/api/wc/bracket", { picks });
}

export function createWcLeague(payload) {
  return wcPost("/api/wc/leagues", payload);
}

export function joinWcLeague(code) {
  return wcPost("/api/wc/leagues/join", { code });
}

export function leaveWcLeague(leagueId) {
  return wcDelete("/api/wc/leagues/leave", { leagueId });
}

export function fetchWcLeagueStandings(leagueId) {
  return wcGet(`/api/wc/leagues/${encodeURIComponent(leagueId)}/standings`);
}

export function publishWcResult(payload) {
  return wcPost("/api/admin/wc/results/publish", payload);
}

export function updateWcMatch(payload) {
  return wcPost("/api/admin/wc/matches/update", payload);
}

export function rescoreWc(payload = {}) {
  return wcPost("/api/admin/wc/score", payload);
}

export function syncWcFixtures() {
  return wcPost("/api/admin/wc/sync", {});
}

export function resetWcPlatform() {
  return wcPost("/api/admin/wc/reset", { confirm: "RESET" });
}

export function fetchWcMatchConsensus(matchId) {
  return wcGet(`/api/wc/matches/${encodeURIComponent(matchId)}/consensus`);
}

export function fetchWcSurvivor() {
  return wcGet("/api/wc/survivor");
}

export function saveWcSurvivorPick(roundKey, teamCode) {
  return wcPost("/api/wc/survivor", { roundKey, teamCode });
}

export function fetchWcSurvivorLeaderboard() {
  return wcGet("/api/wc/survivor/leaderboard");
}

export function kickWcLeagueMember(leagueId, userId) {
  return wcDelete("/api/wc/leagues/leave", { leagueId, userId });
}
