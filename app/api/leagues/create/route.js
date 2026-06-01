import "server-only";
import { NextResponse } from "next/server";
import { checkLeagueLimits } from "@/src/lib/subscription";
import {
  AVAILABLE_LEAGUE_MODES,
  PRO_LEAGUE_MODES,
  leagueAccessErrorResponse,
  requireLeagueUser,
} from "../_lib/leagueServer";

/**
 * POST /api/leagues/create
 *
 * Creates a new league. Enforces Free/Pro limits.
 * Free users: max 1 league created.
 * Pro users: unlimited.
 *
 * Body:
 * {
 *   userId?:    string         (optional, must match auth user when present)
 *   name:       string         (required)
 *   game_mode?: string         (default: "standard")
 *   visibility?: string        (default: "private")
 *   season?:    number         (default: 2026)
 *   settings?:  object         (Pro only; ignored for Free)
 * }
 */
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

  const { user, supabase } = auth;
  const { name, game_mode = "standard", visibility = "private", season = 2026, settings = {} } = body;
  const userId = user.id;

  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!AVAILABLE_LEAGUE_MODES.has(game_mode)) {
    return NextResponse.json(
      { error: "This game mode is coming soon — not yet available." },
      { status: 422 }
    );
  }

  // Check league limits
  const limits = await checkLeagueLimits(userId);
  if (!limits.canCreate) {
    return NextResponse.json(
      {
        error:  "League creation limit reached",
        detail: limits.isPro
          ? "Unexpected limit for Pro user"
          : "Free users can create 1 league. Upgrade to Stint Pro for unlimited leagues.",
        isPro: limits.isPro,
      },
      { status: 403 }
    );
  }

  // Pro-only game modes
  if (PRO_LEAGUE_MODES.has(game_mode) && !limits.isPro) {
    return NextResponse.json(
      { error: "Pro subscription required for this game mode" },
      { status: 403 }
    );
  }

  // Generate a short invite code
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  // Create the league
  const { data: league, error: leagueErr } = await supabase
    .from("leagues")
    .insert({
      name:       name.trim(),
      owner_id:   userId,
      code,
      is_public:  visibility === "public",
      game_mode,
      visibility,
      season,
      settings:   limits.isPro ? settings : {},
      type:       "standard",
      is_active:  true,
    })
    .select("id, name, code, owner_id, type, game_mode, visibility, is_public, season, is_active, settings")
    .single();

  if (leagueErr) {
    console.error("[leagues/create]", leagueErr.message);
    return NextResponse.json({ error: "Failed to create league" }, { status: 500 });
  }

  // Add owner as comisionado
  const { error: memberErr } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id:   userId,
    role:      "comisionado",
    status:    "active",
  });

  if (memberErr) {
    console.error("[leagues/create] member insert:", memberErr.message);
    // League created but owner membership failed — attempt cleanup
    await supabase.from("leagues").delete().eq("id", league.id);
    return NextResponse.json({ error: "Failed to set up league membership" }, { status: 500 });
  }

  return NextResponse.json({ league });
}
