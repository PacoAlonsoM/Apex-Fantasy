import "server-only";

import { NextResponse } from "next/server";
import { checkLeagueLimits, requiresPro } from "@/src/lib/subscription";
import {
  PRO_LEAGUE_MODES,
  leagueAccessErrorResponse,
  requireLeagueUser,
} from "../_lib/leagueServer";

export async function POST(request) {
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

  const code = String(body?.code || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "League code required" }, { status: 400 });

  const { data: league, error: leagueError } = await auth.supabase
    .from("leagues")
    .select("id, name, code, owner_id, type, game_mode, visibility, is_public, season, is_active, settings")
    .eq("code", code)
    .maybeSingle();

  if (leagueError) {
    console.error("[leagues/join] league lookup:", leagueError.message);
    return NextResponse.json({ error: "Could not look up league" }, { status: 500 });
  }

  if (!league || league.is_active === false) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  if (league.settings?.allow_new_members === false) {
    return NextResponse.json({ error: "This league is closed to new members." }, { status: 403 });
  }

  const { data: existing } = await auth.supabase
    .from("league_members")
    .select("role, status")
    .eq("league_id", league.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json({ league, membership: existing, alreadyJoined: true });
  }

  if (existing && ["banned", "removed", "eliminated"].includes(existing.status)) {
    return NextResponse.json(
      { error: "You cannot join this league from your current membership state." },
      { status: 403 }
    );
  }

  const limits = await checkLeagueLimits(auth.user.id);
  if (!limits.canJoin) {
    return NextResponse.json(
      {
        error: "League join limit reached",
        detail: "Free users can join up to 2 leagues. Upgrade to Stint Pro for unlimited leagues.",
      },
      { status: 403 }
    );
  }

  if ((league.type === "pro_community" || PRO_LEAGUE_MODES.has(league.game_mode)) && !(await requiresPro(auth.user.id))) {
    return NextResponse.json(
      { error: "Pro subscription required for this league." },
      { status: 403 }
    );
  }

  const { data: membership, error: joinError } = await auth.supabase
    .from("league_members")
    .insert({
      league_id: league.id,
      user_id: auth.user.id,
      role: "member",
      status: "active",
    })
    .select("role, status")
    .single();

  if (joinError) {
    console.error("[leagues/join]", joinError.message);
    return NextResponse.json({ error: "Could not join league." }, { status: 500 });
  }

  return NextResponse.json({ league, membership });
}
