import { NextResponse } from "next/server";
import { requireWcUser } from "../_lib/wcServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanScore(value) {
  const next = Number(value);
  return Number.isInteger(next) && next >= 0 && next <= 99 ? next : null;
}

function cleanScorerName(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, 60);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  try {
    const { user, supabase } = await requireWcUser(request, body);
    const matchId = String(body?.matchId || "").trim();
    const predictedHomeScore = cleanScore(body?.predictedHomeScore);
    const predictedAwayScore = cleanScore(body?.predictedAwayScore);
    const predictedWinnerTeamCode = String(body?.predictedWinnerTeamCode || "").trim() || null;
    const predictedScorerName = cleanScorerName(body?.predictedScorerName);

    if (!matchId || predictedHomeScore === null || predictedAwayScore === null) {
      return NextResponse.json({ status: "error", message: "Choose a WC match and a valid score." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("wc_match_predictions")
      .upsert({
        user_id: user.id,
        match_id: matchId,
        predicted_home_score: predictedHomeScore,
        predicted_away_score: predictedAwayScore,
        predicted_winner_team_code: predictedWinnerTeamCode,
        predicted_scorer_name: predictedScorerName,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,match_id" })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ status: "ok", message: "WC pick saved.", prediction: data });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not save WC pick.",
    }, { status: error.status || 500 });
  }
}
