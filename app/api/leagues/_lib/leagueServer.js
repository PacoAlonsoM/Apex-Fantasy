import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let cachedAdminClient = null;

export const PRO_LEAGUE_MODES = new Set([
  "survival",
  "draft",
  "double_down",
  "head_to_head",
  "budget_picks",
]);

export const AVAILABLE_LEAGUE_MODES = new Set([
  "standard",
  "survival",
  "double_down",
  "budget_picks",
]);

class LeagueAccessError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = "LeagueAccessError";
    this.status = status;
  }
}

export function getLeagueAdminClient() {
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin env vars for league API.");
  }

  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cachedAdminClient;
}

function getLeagueAccessToken(request, body = null) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return typeof body?.__authToken === "string" ? body.__authToken.trim() : "";
}

export async function requireLeagueUser(request, body = null) {
  const accessToken = getLeagueAccessToken(request, body);
  if (!accessToken) {
    throw new LeagueAccessError("Sign in to manage leagues.", 401);
  }

  const supabase = getLeagueAdminClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw new LeagueAccessError("Your session expired. Sign in again.", 401);
  }

  const requestedUserId = body?.userId || request.headers.get("x-user-id") || "";
  if (requestedUserId && requestedUserId !== data.user.id) {
    throw new LeagueAccessError("League request user mismatch.", 403);
  }

  return { supabase, user: data.user, accessToken };
}

export function leagueAccessErrorResponse(error, fallback = "League request failed.") {
  if (error instanceof LeagueAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );
}

export async function getLeagueAndVerifyComisionado(supabase, leagueId, userId) {
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id, owner_id, game_mode, settings, season, visibility, is_active, type")
    .eq("id", leagueId)
    .single();

  if (error || !league) return { league: null, error: "League not found", status: 404 };

  if (league.owner_id === userId) return { league, error: null, status: 200 };

  const { data: membership } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .single();

  if (membership?.role !== "comisionado") {
    return {
      league: null,
      error: "Only the league commissioner can change settings",
      status: 403,
    };
  }

  return { league, error: null, status: 200 };
}
