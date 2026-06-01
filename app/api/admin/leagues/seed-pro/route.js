import "server-only";

import { adminAccessErrorResponse, getConfiguredAdminUserId, requireAdminRequest } from "../../_lib/localAdminAccess";
import { jsonError, jsonOk } from "../../_lib/response";
import { getSupabaseAdmin, requireServiceRole } from "../../_lib/supabaseAdmin";

function makeCode() {
  return `PRO${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    await requireAdminRequest(request, body);
    requireServiceRole("seeding the Pro Community League");
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not verify admin access.");
  }

  const adminUserId = getConfiguredAdminUserId();
  if (!adminUserId) {
    return jsonError("Missing configured admin user id.", 500);
  }

  const supabase = getSupabaseAdmin();

  let league;
  const { data: existing, error: readError } = await supabase
    .from("leagues")
    .select("id, name, code, type, is_active")
    .eq("type", "pro_community")
    .maybeSingle();

  if (readError) {
    return jsonError(`Could not read Pro Community League: ${readError.message}`, 500);
  }

  if (existing) {
    league = existing;
    if (!existing.is_active) {
      const { data: updated, error: updateError } = await supabase
        .from("leagues")
        .update({ is_active: true })
        .eq("id", existing.id)
        .select("id, name, code, type, is_active")
        .single();
      if (updateError) {
        return jsonError(`Could not reactivate Pro Community League: ${updateError.message}`, 500);
      }
      league = updated;
    }
  } else {
    const { data: created, error: createError } = await supabase
      .from("leagues")
      .insert({
        name: "Stint Pro Community",
        code: makeCode(),
        owner_id: adminUserId,
        type: "pro_community",
        is_public: true,
        is_active: true,
        game_mode: "standard",
        visibility: "public",
        season: 2026,
        settings: {
          double_points_races: [],
          sprint_multiplier: 0.5,
          scoring_weights: { pole: 10, winner: 25, p2: 18, p3: 15, fl: 7, dotd: 6, dnf: 12, ctor: 8 },
          tiebreaker_order: ["most_correct", "best_single_race", "head_to_head", "earliest_joined"],
          late_joiner_cutoff_round: 24,
          late_joiner_handicap_points: 0,
          allow_new_members: true,
          elimination_starts_round: 3,
          announcement: "Welcome to the Stint Pro Community League. Compete against every Pro subscriber across the full season.",
        },
      })
      .select("id, name, code, type, is_active")
      .single();

    if (createError) {
      return jsonError(`Could not create Pro Community League: ${createError.message}`, 500);
    }
    league = created;
  }

  const { data: proUsers, error: proError } = await supabase
    .from("profiles")
    .select("id")
    .eq("subscription_status", "pro");

  if (proError) {
    return jsonError(`Could not read Pro users: ${proError.message}`, 500);
  }

  const membershipRows = [
    { league_id: league.id, user_id: adminUserId, role: "comisionado", status: "active" },
    ...(proUsers || [])
      .filter((user) => user.id && user.id !== adminUserId)
      .map((user) => ({
        league_id: league.id,
        user_id: user.id,
        role: "member",
        status: "active",
      })),
  ];

  const { error: memberError } = await supabase
    .from("league_members")
    .upsert(membershipRows, { onConflict: "league_id,user_id" });

  if (memberError) {
    return jsonError(`Could not backfill Pro league members: ${memberError.message}`, 500);
  }

  return jsonOk("Pro Community League is connected and backfilled.", {
    league,
    counts: {
      proUsers: proUsers?.length || 0,
      memberships: membershipRows.length,
    },
  });
}
