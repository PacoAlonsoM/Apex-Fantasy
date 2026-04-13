import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function verifyComisionado(supabase, leagueId, userId) {
  const { data: league } = await supabase
    .from("leagues")
    .select("owner_id")
    .eq("id", leagueId)
    .single();

  if (!league) return false;
  if (league.owner_id === userId) return true;

  const { data: m } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .single();

  return m?.role === "comisionado";
}

/**
 * GET /api/leagues/[id]/members
 * Returns all members. Comisionado gets full detail; members get public view.
 */
export async function GET(request, { params }) {
  const { id: leagueId } = params;
  const requesterId = request.headers.get("x-user-id");

  if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();

  // Verify requester is a member of this league
  const { data: myMembership } = await supabase
    .from("league_members")
    .select("role, status")
    .eq("league_id", leagueId)
    .eq("user_id", requesterId)
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

  // Strip internal fields for non-comisionados
  const result = (members ?? []).map((m) => ({
    user_id:          m.user_id,
    role:             m.role,
    status:           m.status,
    joined_at:        m.joined_at,
    username:         m.profiles?.username ?? null,
    avatar_url:       m.profiles?.avatar_url ?? null,
    subscription_status: m.profiles?.subscription_status ?? "free",
    // Only comisionado sees these
    ...(isComisionado
      ? {
          handicap_points:        m.handicap_points,
          eliminated_at_race_id:  m.eliminated_at_race_id,
        }
      : {}),
  }));

  return NextResponse.json({ members: result });
}

/**
 * PATCH /api/leagues/[id]/members
 * Update a member's status. Comisionado only.
 *
 * Body:
 * {
 *   targetUserId:    string   (required)
 *   action:          "ban" | "remove" | "reinstate" | "set_handicap"   (required)
 *   handicapPoints?: number   (required for set_handicap)
 * }
 */
export async function PATCH(request, { params }) {
  const { id: leagueId } = params;
  const requesterId = request.headers.get("x-user-id");

  if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { targetUserId, action, handicapPoints } = body;

  if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  if (!action)       return NextResponse.json({ error: "action required" }, { status: 400 });

  const supabase = getAdminClient();

  const isComisionado = await verifyComisionado(supabase, leagueId, requesterId);
  if (!isComisionado) {
    return NextResponse.json({ error: "Only the league commissioner can manage members" }, { status: 403 });
  }

  // Cannot act on yourself
  if (targetUserId === requesterId) {
    return NextResponse.json({ error: "Cannot modify your own membership" }, { status: 400 });
  }

  const validActions = ["ban", "remove", "reinstate", "set_handicap"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action. Must be: ${validActions.join(", ")}` }, { status: 400 });
  }

  let patch;
  switch (action) {
    case "ban":       patch = { status: "banned" };    break;
    case "remove":    patch = { status: "removed" };   break;
    case "reinstate": patch = { status: "active" };    break;
    case "set_handicap": {
      const pts = Number(handicapPoints);
      if (!Number.isInteger(pts)) {
        return NextResponse.json({ error: "handicapPoints must be an integer" }, { status: 400 });
      }
      patch = { handicap_points: pts };
      break;
    }
  }

  const { error } = await supabase
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
