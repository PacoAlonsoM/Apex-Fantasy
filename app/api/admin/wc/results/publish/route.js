import { jsonError, jsonOk } from "../../../_lib/response";
import { adminAccessErrorResponse, requireAdminRequest } from "../../../_lib/localAdminAccess";
import { getSupabaseAdmin, requireServiceRole } from "../../../_lib/supabaseAdmin";
import { scoreWcMatchPrediction } from "@/src/lib/wc/scoring";
import { rescoreSurvivorPicksForMatch } from "@/src/lib/wc/survivor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanScore(value) {
  const next = Number(value);
  return Number.isInteger(next) && next >= 0 && next <= 99 ? next : null;
}

function cleanScorerList(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  return raw
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((item) => item.slice(0, 80));
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    requireServiceRole("WC result publishing");
    const matchId = String(body?.matchId || "").trim();
    const homeScore = cleanScore(body?.homeScore);
    const awayScore = cleanScore(body?.awayScore);
    const winnerTeamCode = String(body?.winnerTeamCode || "").trim() || null;
    const homeScorers = cleanScorerList(body?.homeScorers ?? body?.scorers?.home);
    const awayScorers = cleanScorerList(body?.awayScorers ?? body?.scorers?.away);

    if (!matchId || homeScore === null || awayScore === null) {
      return jsonError("Missing WC match or valid score.", 400);
    }

    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase
      .from("wc_matches")
      .update({
        home_score: homeScore,
        away_score: awayScore,
        winner_team_code: winnerTeamCode,
        scorers: { home: homeScorers, away: awayScorers },
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId)
      .select("*")
      .single();

    if (matchError) throw matchError;

    const { data: predictions, error: picksError } = await supabase
      .from("wc_match_predictions")
      .select("*")
      .eq("match_id", matchId);

    if (picksError) throw picksError;

    let scored = 0;
    for (const prediction of predictions || []) {
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
      scored += 1;
    }

    const survivorRescored = await rescoreSurvivorPicksForMatch(supabase, match);

    await supabase.from("wc_score_runs").insert({
      operation_type: "match-result-publish",
      match_id: matchId,
      status: "ok",
      message: `Published WC result for match ${match.match_number}.`,
      counts: { scored, survivorRescored },
      metadata: { homeScore, awayScore, winnerTeamCode, homeScorers, awayScorers },
    });

    return jsonOk(`Published WC result for match ${match.match_number}.`, {
      match,
      counts: { scored, survivorRescored },
    });
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not publish WC result.");
  }
}
