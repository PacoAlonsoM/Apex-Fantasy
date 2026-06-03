import "server-only";

import { NextResponse } from "next/server";
import { requiresPro } from "@/src/lib/subscription";
import {
  getLeagueAndVerifyComisionado,
  leagueAccessErrorResponse,
  requireLeagueUser,
} from "../../_lib/leagueServer";

/**
 * GET /api/leagues/[id]/settings
 * Returns current league settings. Comisionado only.
 */
export async function GET(request, { params }) {
  const { id: leagueId } = await params;

  let auth;
  try {
    auth = await requireLeagueUser(request);
  } catch (error) {
    return leagueAccessErrorResponse(error);
  }

  const { league, error, status } = await getLeagueAndVerifyComisionado(auth.supabase, leagueId, auth.user.id);
  if (error) return NextResponse.json({ error }, { status });

  return NextResponse.json({ settings: league.settings, league });
}

/**
 * PATCH /api/leagues/[id]/settings
 *
 * Update league settings. Comisionado only.
 * Advanced settings require Pro.
 *
 * Body: Partial league settings object. Merged into existing settings.
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

  const { league, error, status } = await getLeagueAndVerifyComisionado(auth.supabase, leagueId, auth.user.id);
  if (error) return NextResponse.json({ error }, { status });

  const {
    name,
    visibility,
    is_active,
    allow_new_members,
    announcement,
    pick_weights,
    scoring_weights,
    sprint_multiplier,
    double_points_races,
    tiebreaker_order,
    elimination_starts_round,
    late_joiner_cutoff_round,
    late_joiner_handicap_points,
  } = body;

  const normalizedScoringWeights = scoring_weights ?? pick_weights;
  const proSettingsRequested = [
    normalizedScoringWeights,
    sprint_multiplier,
    double_points_races,
    tiebreaker_order,
    elimination_starts_round,
    late_joiner_cutoff_round,
    late_joiner_handicap_points,
  ].some((value) => value !== undefined);

  if (proSettingsRequested) {
    const isPro = await requiresPro(auth.user.id);
    if (!isPro) {
      return NextResponse.json(
        { error: "Advanced league settings require a Pro subscription" },
        { status: 403 }
      );
    }
  }

  const settingsPatch = { ...(league.settings ?? {}) };
  if (allow_new_members !== undefined) settingsPatch.allow_new_members = allow_new_members;
  if (announcement !== undefined) settingsPatch.announcement = announcement;
  if (normalizedScoringWeights !== undefined) {
    settingsPatch.scoring_weights = normalizedScoringWeights;
    settingsPatch.pick_weights = normalizedScoringWeights;
  }
  if (sprint_multiplier !== undefined) settingsPatch.sprint_multiplier = sprint_multiplier;
  if (double_points_races !== undefined) settingsPatch.double_points_races = double_points_races;
  if (tiebreaker_order !== undefined) settingsPatch.tiebreaker_order = tiebreaker_order;
  if (elimination_starts_round !== undefined) settingsPatch.elimination_starts_round = elimination_starts_round;
  if (late_joiner_cutoff_round !== undefined) settingsPatch.late_joiner_cutoff_round = late_joiner_cutoff_round;
  if (late_joiner_handicap_points !== undefined) settingsPatch.late_joiner_handicap_points = late_joiner_handicap_points;

  const leaguePatch = { settings: settingsPatch };
  if (name?.trim()) leaguePatch.name = name.trim();
  if (visibility) leaguePatch.visibility = visibility;
  if (visibility) leaguePatch.is_public = visibility === "public";
  if (is_active !== undefined) leaguePatch.is_active = is_active;

  const { data: updated, error: updateErr } = await auth.supabase
    .from("leagues")
    .update(leaguePatch)
    .eq("id", leagueId)
    .select("id, name, owner_id, type, game_mode, settings, visibility, is_public, is_active, season")
    .single();

  if (updateErr) {
    console.error("[leagues/settings]", updateErr.message);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }

  return NextResponse.json({ league: updated });
}
