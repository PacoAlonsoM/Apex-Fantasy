import { NextResponse } from "next/server";
import { getWcReadClient } from "../../../_lib/wcServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const resolvedParams = typeof params?.then === "function" ? await params : params;
  const matchId = String(resolvedParams?.id || "").trim();
  if (!matchId) {
    return NextResponse.json({ status: "error", message: "Missing WC match id." }, { status: 400 });
  }

  try {
    const supabase = getWcReadClient();

    const { data: match, error: matchError } = await supabase
      .from("wc_matches")
      .select("id, lock_at, status, home_label, away_label")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) {
      return NextResponse.json({ status: "error", message: "WC match not found." }, { status: 404 });
    }

    // Only reveal consensus once the lock window has closed so live picks are
    // not influenced by other users' submissions. Before lock, return totals
    // without breakdowns so the UI can still show participation.
    const locked = match.lock_at ? new Date(match.lock_at).getTime() <= Date.now() : false;

    const { data: predictions, error: pickError } = await supabase
      .from("wc_match_predictions")
      .select("predicted_home_score, predicted_away_score, predicted_winner_team_code")
      .eq("match_id", matchId);
    if (pickError) throw pickError;

    const total = predictions?.length || 0;
    if (!total) {
      return NextResponse.json({
        status: "ok",
        match: { id: match.id, locked, status: match.status },
        total: 0,
        scorelines: [],
        outcomes: { home: 0, draw: 0, away: 0 },
        averageHome: null,
        averageAway: null,
      });
    }

    let homeSum = 0;
    let awaySum = 0;
    const outcomes = { home: 0, draw: 0, away: 0 };
    const scorelineCounts = new Map();

    for (const prediction of predictions) {
      const home = Number(prediction.predicted_home_score);
      const away = Number(prediction.predicted_away_score);
      if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
      homeSum += home;
      awaySum += away;
      if (home > away) outcomes.home += 1;
      else if (away > home) outcomes.away += 1;
      else outcomes.draw += 1;
      const key = `${home}-${away}`;
      scorelineCounts.set(key, (scorelineCounts.get(key) || 0) + 1);
    }

    const scorelines = locked
      ? [...scorelineCounts.entries()]
        .map(([scoreline, count]) => ({ scoreline, count, pct: Math.round((count / total) * 100) }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 6)
      : [];

    return NextResponse.json({
      status: "ok",
      match: { id: match.id, locked, status: match.status },
      total,
      scorelines,
      outcomes: {
        home: Math.round((outcomes.home / total) * 100),
        draw: Math.round((outcomes.draw / total) * 100),
        away: Math.round((outcomes.away / total) * 100),
      },
      averageHome: Math.round((homeSum / total) * 10) / 10,
      averageAway: Math.round((awaySum / total) * 10) / 10,
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not load WC consensus.",
    }, { status: error.status || 500 });
  }
}
