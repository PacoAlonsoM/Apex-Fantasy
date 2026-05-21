import { jsonError, jsonOk } from "../../../_lib/response";
import { adminAccessErrorResponse, requireAdminRequest } from "../../../_lib/localAdminAccess";
import { getSupabaseAdmin, requireServiceRole } from "../../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WC_MATCH_STATUSES = new Set(["scheduled", "locked", "live", "completed", "cancelled"]);

function cleanText(value) {
  return String(value || "").trim();
}

function cleanDate(value) {
  const text = cleanText(value);
  if (!text) return null;
  const timestamp = new Date(text).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    requireServiceRole("WC match administration");
    const matchId = cleanText(body?.matchId);
    if (!matchId) return jsonError("Missing WC match id.", 400);

    const status = cleanText(body?.status);
    const payload = {
      updated_at: new Date().toISOString(),
    };

    if (WC_MATCH_STATUSES.has(status)) payload.status = status;
    if (cleanText(body?.homeTeamCode)) payload.home_team_code = cleanText(body.homeTeamCode);
    if (cleanText(body?.awayTeamCode)) payload.away_team_code = cleanText(body.awayTeamCode);
    if (cleanText(body?.homeLabel)) payload.home_label = cleanText(body.homeLabel);
    if (cleanText(body?.awayLabel)) payload.away_label = cleanText(body.awayLabel);
    if (cleanDate(body?.kickoffAt)) payload.kickoff_at = cleanDate(body.kickoffAt);
    if (cleanDate(body?.lockAt)) payload.lock_at = cleanDate(body.lockAt);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wc_matches")
      .update(payload)
      .eq("id", matchId)
      .select("*")
      .single();

    if (error) throw error;

    await supabase.from("wc_score_runs").insert({
      operation_type: "match-admin-update",
      match_id: matchId,
      status: "ok",
      message: `Updated WC match ${data.match_number}.`,
      metadata: payload,
    });

    return jsonOk(`Updated WC match ${data.match_number}.`, { match: data });
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not update WC match.");
  }
}
