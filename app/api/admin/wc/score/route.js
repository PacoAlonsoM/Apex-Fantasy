import { jsonOk } from "../../_lib/response";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { getSupabaseAdmin, requireServiceRole } from "../../_lib/supabaseAdmin";
import { scoreWcBracketPrediction, scoreWcMatchPrediction } from "@/src/lib/wc/scoring";
import { rescoreSurvivorPicksForMatch } from "@/src/lib/wc/survivor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    requireServiceRole("WC scoring");
    const awards = body?.awards && typeof body.awards === "object" ? body.awards : {};
    const supabase = getSupabaseAdmin();

    const [matchesResponse, picksResponse, bracketsResponse] = await Promise.all([
      supabase.from("wc_matches").select("*"),
      supabase.from("wc_match_predictions").select("*"),
      supabase.from("wc_bracket_predictions").select("*"),
    ]);

    if (matchesResponse.error) throw matchesResponse.error;
    if (picksResponse.error) throw picksResponse.error;
    if (bracketsResponse.error) throw bracketsResponse.error;

    const matches = matchesResponse.data || [];
    const matchById = new Map(matches.map((match) => [match.id, match]));
    let matchPicksScored = 0;
    let bracketsScored = 0;

    for (const prediction of picksResponse.data || []) {
      const match = matchById.get(prediction.match_id);
      if (!match || match.status !== "completed") continue;
      const result = scoreWcMatchPrediction(prediction, match);
      const { error } = await supabase
        .from("wc_match_predictions")
        .update({
          points: result.points,
          score_breakdown: result.breakdown,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prediction.id);
      if (error) throw error;
      matchPicksScored += 1;
    }

    for (const prediction of bracketsResponse.data || []) {
      const result = scoreWcBracketPrediction(prediction, matches, awards);
      const { error } = await supabase
        .from("wc_bracket_predictions")
        .update({
          points: result.points,
          score_breakdown: result.breakdown,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prediction.id);
      if (error) throw error;
      bracketsScored += 1;
    }

    let survivorRescored = 0;
    for (const match of matches) {
      if (match.status === "completed") {
        survivorRescored += await rescoreSurvivorPicksForMatch(supabase, match);
      }
    }

    await supabase.from("wc_score_runs").insert({
      operation_type: "full-rescore",
      status: "ok",
      message: "Recalculated WC match, bracket, and survivor predictions.",
      counts: { matchPicksScored, bracketsScored, survivorRescored },
      metadata: { awards },
    });

    return jsonOk("Recalculated WC scoring.", {
      counts: { matchPicksScored, bracketsScored, survivorRescored },
    });
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not score WC predictions.");
  }
}
