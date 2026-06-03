import "server-only";

import { NextResponse } from "next/server";
import {
  getLeagueAndVerifyComisionado,
  leagueAccessErrorResponse,
  requireLeagueUser,
} from "../../_lib/leagueServer";

async function verifyComisionado(supabase, leagueId, userId) {
  const { league } = await getLeagueAndVerifyComisionado(supabase, leagueId, userId);
  return Boolean(league);
}

/**
 * GET /api/leagues/[id]/members
 * Returns all members. Comisionado gets full detail; members get public view.
 */
export async function GET(request, { params }) {
  const { id: leagueId } = await params;

  let auth;
  try {
    auth = await requireLeagueUser(request);
  } catch (error) {
    return leagueAccessErrorResponse(error);
  }

  const { supabase, user } = auth;

  const { data: myMembership } = await supabase
    .from("league_members")
    .select("role, status")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!myMembership || !["active", "comisionado"].includes(myMembership.status)) {
    return NextResponse.json({ error: "Not a member of this league" }, { status: 403 });
  }

  const isComisionado = myMembership.role === "comisionado";

  const { data: members, error } = await supabase
    .from("league_members")
    .select(`
      user_id,
      role,
      status,
      joined_at,
      handicap_points,
      eliminated_at_race_id,
      profiles ( username, avatar_url, subscription_status )
    `)
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (members ?? []).map((member) => ({
    user_id: member.user_id,
    role: member.role,
    status: member.status,
    joined_at: member.joined_at,
    username: member.profiles?.username ?? null,
    avatar_url: member.profiles?.avatar_url ?? null,
    subscription_status: member.profiles?.subscription_status ?? "free",
    ...(isComisionado
      ? {
          handicap_points: member.handicap_points,
          eliminated_at_race_id: member.eliminated_at_race_id,
        }
      : {}),
  }));

  return NextResponse.json({ members: result });
}

/**
 * PATCH /api/leagues/[id]/members
 * Update a member's status. Comisionado only.
 */
export async function PATCH(request, { params }) {
  const { id: leagueId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let auth;
  try {
    auth = await requireLeagueUser(request, body);
  } catch (error) {
    return leagueAccessErrorResponse(error);
  }

  const { targetUserId, action, handicapPoints } = body;

  if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  const isComisionado = await verifyComisionado(auth.supabase, leagueId, auth.user.id);
  if (!isComisionado) {
    return NextResponse.json({ error: "Only the league commissioner can manage members" }, { status: 403 });
  }

  if (targetUserId === auth.user.id) {
    return NextResponse.json({ error: "Cannot modify your own membership" }, { status: 400 });
  }

  const validActions = ["ban", "remove", "reinstate", "set_handicap"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action. Must be: ${validActions.join(", ")}` }, { status: 400 });
  }

  let patch;
  switch (action) {
    case "ban":
      patch = { status: "banned" };
      break;
    case "remove":
      patch = { status: "removed" };
      break;
    case "reinstate":
      patch = { status: "active" };
      break;
    case "set_handicap": {
      const points = Number(handicapPoints);
      if (!Number.isInteger(points)) {
        return NextResponse.json({ error: "handicapPoints must be an integer" }, { status: 400 });
      }
      patch = { handicap_points: points };
      break;
    }
  }

  const { error } = await auth.supabase
    .from("league_members")
    .update(patch)
    .eq("league_id", leagueId)
    .eq("user_id", targetUserId);

  if (error) {
    console.error("[leagues/members PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/leagues/[id]/members
 * Self-leave for members. Commissioners can remove another member with
 * { targetUserId }. League owners should delete the league instead of leaving.
 */
export async function DELETE(request, { params }) {
  const { id: leagueId } = await params;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let auth;
  try {
    auth = await requireLeagueUser(request, body);
  } catch (error) {
    return leagueAccessErrorResponse(error);
  }

  const targetUserId = body?.targetUserId || auth.user.id;
  const removingSelf = targetUserId === auth.user.id;

  if (!removingSelf) {
    const isComisionado = await verifyComisionado(auth.supabase, leagueId, auth.user.id);
    if (!isComisionado) {
      return NextResponse.json({ error: "Only the league commissioner can remove members" }, { status: 403 });
    }
  }

  if (removingSelf) {
    const { data: league } = await auth.supabase
      .from("leagues")
      .select("owner_id")
      .eq("id", leagueId)
      .maybeSingle();

    if (league?.owner_id === auth.user.id) {
      return NextResponse.json(
        { error: "Commissioners must delete the league or transfer ownership before leaving." },
        { status: 400 }
      );
    }
  }

  const { error } = await auth.supabase
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", targetUserId);

  if (error) {
    console.error("[leagues/members DELETE]", error.message);
    return NextResponse.json({ error: "Failed to remove league member" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
