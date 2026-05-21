import { jsonError, jsonOk } from "../../_lib/response";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { getSupabaseAdmin, requireServiceRole } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wipes every user-generated WC artifact and resets every match back to its
// pre-tournament zero state so the production launch begins with a clean
// slate. Caller must include `confirm: "RESET"` in the body to acknowledge
// the destructive action. Leaves wc_teams and wc_matches schema in place;
// admin should rerun the sync afterwards to repopulate real fixture dates.
const CONFIRM_TOKEN = "RESET";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    requireServiceRole("WC launch reset");

    if (String(body?.confirm || "") !== CONFIRM_TOKEN) {
      return jsonError(`Include {"confirm":"${CONFIRM_TOKEN}"} in the body to confirm. This wipes ALL WC user data.`, 400);
    }

    const supabase = getSupabaseAdmin();
    const counts = {};

    for (const table of ["wc_match_predictions", "wc_bracket_predictions", "wc_survivor_picks", "wc_league_members", "wc_leagues", "wc_score_runs"]) {
      const { error, count } = await supabase.from(table).delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      counts[table] = count || 0;
    }

    const { error: matchError, count: matchCount } = await supabase
      .from("wc_matches")
      .update({
        home_score: null,
        away_score: null,
        winner_team_code: null,
        status: "scheduled",
        source_note: "WC seed",
        updated_at: new Date().toISOString(),
      }, { count: "exact" })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (matchError) throw matchError;
    counts.wc_matches_reset = matchCount || 0;

    await supabase.from("wc_score_runs").insert({
      operation_type: "launch-reset",
      status: "ok",
      message: "WC platform reset to launch-ready zero state.",
      counts,
    });

    return jsonOk("WC platform reset.", { counts });
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not reset WC data.");
  }
}
