import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requiresPro } from "@/src/lib/subscription";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function getLeagueAndVerifyComisionado(supabase, leagueId, userId) {
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id, owner_id, game_mode, settings, season, visibility, is_active, type")
    .eq("id", leagueId)
    .single();

  if (error || !league) return { league: null, error: "League not found" };

  // Must be league owner (comisionado)
  if (league.owner_id !== userId) {
    // Also accept comisionado role in league_members
    const { data: membership } = await supabase
      .from("league_members")
      .select("role")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .single();
    if (membership?.role !== "comisionado") {
      return { league: null, error: "Only the league commissioner can change settings" };
    }
  }

  return { league, error: null };
}

/**
 * GET /api/leagues/[id]/settings
 * Returns current league settings. Comisionado only.
 */
export async function GET(request, { params }) {
  const { id: leagueId } = params;
  const requesterId = request.headers.get("x-user-id");

  if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  const { league, error } = await getLeagueAndVerifyComisionado(supabase, leagueId, requesterId);

  if (error) return NextResponse.json({ error }, { status: league === null ? 403 : 404 });

  return NextResponse.json({ settings: league.settings, league });
}

/**
 * PATCH /api/leagues/[id]/settings
 *
 * Update league settings. Comisionado only.
 * Advanced settings (pick_weights, sprint_multiplier, double_points_races,
 * tiebreaker_order, elimination_starts_round) require Pro.
 *
 * Body: Partial league settings object. Merged into existing settings.
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

  const supabase = getAdminClient();
  const { league, error } = await getLeagueAndVerifyComisionado(supabase, leagueId, requesterId);

  if (error) return NextResponse.json({ error }, { status: league === null ? 403 : 404 });

  // Separate top-level fields from settings JSONB fields
  const {
    name,
    visibility,
    is_active,
    allow_new_members,
    announcement,
    // Pro-only settings
    pick_weights,
    sprint_multiplier,
    double_points_races,
    tiebreaker_order,
    elimination_starts_round,
    late_joiner_cutoff_round,
    late_joiner_handicap_points,
  } = body;

  // Check Pro for advanced settings
  const proSettingsRequested = [
    pick_weights,
    sprint_multiplier,
    double_points_races,
    tiebreaker_order,
    elimination_starts_round,
    late_joiner_cutoff_round,
    late_joiner_handicap_points,
  ].some((v) => v !== undefined);

  if (proSettingsRequested) {
    const isPro = await requiresPro(requesterId);
    if (!isPro) {
      return NextResponse.json(
        { error: "Advanced league settings require a Pro subscription" },
        { status: 403 }
      );
    }
  }

  // Build JSONB settings patch
  const settingsPatch = { ...(league.settings ?? {}) };
  if (allow_new_members !== undefined) settingsPatch.allow_new_members = allow_new_members;
  if (announcement !== undefined)      settingsPatch.announcement = announcement;
  if (pick_weights !== undefined)          settingsPatch.pick_weights = pick_weights;
  if (sprint_multiplier !== undefined)     settingsPatch.sprint_multiplier = sprint_multiplier;
  if (double_points_races !== undefined)   settingsPatch.double_points_races = double_points_races;
  if (tiebreaker_order !== undefined)      settingsPatch.tiebreaker_order = tiebreaker_order;
  if (elimination_starts_round !== undefined) settingsPatch.elimination_starts_round = elimination_starts_round;
  if (late_joiner_cutoff_round !== undefined) settingsPatch.late_joiner_cutoff_round = late_joiner_cutoff_round;
  if (late_joiner_handicap_points !== undefined) settingsPatch.late_joiner_handicap_points = late_joiner_handicap_points;

  // Build top-level league patch
  const leaguePatch = { settings: settingsPatch };
  if (name?.trim())          leaguePatch.name       = name.trim();
  if (visibility)            leaguePatch.visibility  = visibility;
  if (is_active !== undefined) leaguePatch.is_active = is_active;

  const { data: updated, error: updateErr } = await supabase
    .from("leagues")
    .update(leaguePatch)
    .eq("id", leagueId)
    .select("id, name, game_mode, settings, visibility, is_active")
    .single();

  if (updateErr) {
    console.error("[leagues/settings]", updateErr.message);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }

  return NextResponse.json({ league: updated });
}
