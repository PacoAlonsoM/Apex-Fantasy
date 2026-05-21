import "server-only";

import { createClient } from "@supabase/supabase-js";
import { WC_FALLBACK_MATCHES } from "@/src/constants/wc/fixtures";
import { WC_TEAMS } from "@/src/constants/wc/teams";

let wcReadClient = null;

export function getWcReadClient() {
  if (wcReadClient) return wcReadClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) {
    throw new Error("Missing Supabase env vars for WC API.");
  }

  wcReadClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return wcReadClient;
}

export function getWcUserClient(accessToken) {
  const token = String(accessToken || "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    throw new Error("Missing Supabase public env vars for WC API.");
  }

  return createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: token ? {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    } : undefined,
  });
}

export function getWcAccessToken(request, body = null) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return typeof body?.__authToken === "string" ? body.__authToken.trim() : "";
}

export async function requireWcUser(request, body = null) {
  const accessToken = getWcAccessToken(request, body);
  if (!accessToken) {
    const error = new Error("Sign in to use WC predictions.");
    error.status = 401;
    throw error;
  }

  const supabase = getWcUserClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) {
    const authError = new Error("Your WC session expired. Sign in again.");
    authError.status = 401;
    throw authError;
  }

  return { user: data.user, supabase, accessToken };
}

export function isMissingWcTable(error) {
  const message = String(error?.message || error || "");
  return /wc_|does not exist|schema cache|relation/i.test(message);
}

export function fallbackWcBootstrap() {
  return {
    teams: WC_TEAMS,
    matches: WC_FALLBACK_MATCHES,
    leaderboard: [],
    matchPredictions: [],
    bracketPrediction: null,
    survivorPicks: [],
    leagues: [],
    fallback: true,
  };
}

export async function loadWcBootstrap(accessToken = "") {
  const client = accessToken ? getWcUserClient(accessToken) : getWcReadClient();

  const [teamsResponse, matchesResponse] = await Promise.all([
    client.from("wc_teams").select("*").order("group_code", { ascending: true }).order("seed_order", { ascending: true }),
    client.from("wc_matches").select("*").order("match_number", { ascending: true }),
  ]);

  if (teamsResponse.error || matchesResponse.error) {
    if (isMissingWcTable(teamsResponse.error) || isMissingWcTable(matchesResponse.error)) {
      return fallbackWcBootstrap();
    }
    throw teamsResponse.error || matchesResponse.error;
  }

  let user = null;
  if (accessToken) {
    const authResponse = await client.auth.getUser(accessToken);
    user = authResponse.data?.user || null;
  }

  let matchPredictions = [];
  let bracketPrediction = null;
  let survivorPicks = [];
  let leagues = [];

  if (user) {
    const [picksResponse, bracketResponse, survivorResponse, leaguesResponse] = await Promise.all([
      client.from("wc_match_predictions").select("*").eq("user_id", user.id),
      client.from("wc_bracket_predictions").select("*").eq("user_id", user.id).maybeSingle(),
      client.from("wc_survivor_picks").select("*").eq("user_id", user.id),
      client.from("wc_league_members").select("league_id, role, wc_leagues(id,name,code,visibility,owner_id)").eq("user_id", user.id),
    ]);

    if (!picksResponse.error) matchPredictions = picksResponse.data || [];
    if (!bracketResponse.error) bracketPrediction = bracketResponse.data || null;
    if (!survivorResponse.error) survivorPicks = survivorResponse.data || [];
    if (!leaguesResponse.error) {
      leagues = (leaguesResponse.data || []).map((row) => ({
        ...(row.wc_leagues || {}),
        role: row.role,
      })).filter((league) => league.id);
    }
  }

  const [leaderboardResponse, bracketLeaderboardResponse, survivorLeaderboardResponse] = await Promise.all([
    getWcReadClient()
      .from("wc_match_predictions")
      .select("user_id, points")
      .not("points", "is", null),
    getWcReadClient()
      .from("wc_bracket_predictions")
      .select("user_id, points")
      .not("points", "is", null),
    getWcReadClient()
      .from("wc_survivor_picks")
      .select("user_id, points")
      .not("points", "is", null),
  ]);

  const totals = new Map();
  const addTotals = (rows = []) => {
    rows.forEach((row) => {
      totals.set(row.user_id, (totals.get(row.user_id) || 0) + Number(row.points || 0));
    });
  };
  if (!leaderboardResponse.error) {
    addTotals(leaderboardResponse.data || []);
  }
  if (!bracketLeaderboardResponse.error) {
    addTotals(bracketLeaderboardResponse.data || []);
  }
  if (!survivorLeaderboardResponse.error) {
    addTotals(survivorLeaderboardResponse.data || []);
  }

  const leaderboardUserIds = [...totals.keys()];
  let profileNames = new Map();

  if (leaderboardUserIds.length) {
    const { data: profiles } = await getWcReadClient()
      .from("profiles")
      .select("id, username")
      .in("id", leaderboardUserIds);
    profileNames = new Map((profiles || []).map((profile) => [profile.id, profile.username]));
  }

  const leaderboard = [...totals.entries()]
    .map(([user_id, points]) => ({
      user_id,
      username: profileNames.get(user_id) || `player_${String(user_id).slice(0, 6)}`,
      points,
    }))
    .sort((left, right) => right.points - left.points)
    .slice(0, 20);

  return {
    teams: (teamsResponse.data || []).map((team) => ({
      code: team.code,
      name: team.name,
      group: team.group_code,
      seed: team.seed_order,
      flag: team.flag,
    })),
    matches: matchesResponse.data || [],
    leaderboard,
    matchPredictions,
    bracketPrediction,
    survivorPicks,
    leagues,
    fallback: false,
  };
}
