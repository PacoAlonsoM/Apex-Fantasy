import { NextResponse } from "next/server";
import { getWcReadClient, requireWcUser } from "../_lib/wcServer";
import {
  WC_SURVIVOR_ROUND_KEYS,
  WC_SURVIVOR_ROUNDS,
  findSurvivorMatchForTeam,
  matchInSurvivorRound,
} from "@/src/lib/wc/survivor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function roundIsOpen(matches, roundKey) {
  // A round is open if any match in it has not yet locked.
  return matches.some((match) => matchInSurvivorRound(match, roundKey) && match.lock_at && new Date(match.lock_at).getTime() > Date.now());
}

export async function GET(request) {
  try {
    const { user, supabase } = await requireWcUser(request);

    const [picksResponse, matchesResponse] = await Promise.all([
      supabase
        .from("wc_survivor_picks")
        .select("*")
        .eq("user_id", user.id),
      supabase
        .from("wc_matches")
        .select("*")
        .order("match_number", { ascending: true }),
    ]);

    if (picksResponse.error) throw picksResponse.error;
    if (matchesResponse.error) throw matchesResponse.error;

    const matches = matchesResponse.data || [];
    const picks = picksResponse.data || [];
    const eliminated = picks.some((pick) => pick.status === "eliminated");
    const totalPoints = picks.reduce((sum, pick) => sum + Number(pick.points || 0), 0);
    const survivedRounds = picks.filter((pick) => pick.status === "correct").length;

    return NextResponse.json({
      status: "ok",
      rounds: WC_SURVIVOR_ROUND_KEYS.map((key) => ({
        key,
        label: WC_SURVIVOR_ROUNDS[key].label,
        stage: WC_SURVIVOR_ROUNDS[key].stage,
        open: !eliminated && roundIsOpen(matches, key),
      })),
      picks,
      eliminated,
      totalPoints,
      survivedRounds,
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not load WC survivor data.",
    }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  try {
    const { user, supabase } = await requireWcUser(request, body);
    const roundKey = String(body?.roundKey || "").trim();
    const teamCode = String(body?.teamCode || "").trim().toUpperCase();

    if (!WC_SURVIVOR_ROUNDS[roundKey]) {
      return NextResponse.json({ status: "error", message: "Unknown survivor round." }, { status: 400 });
    }
    if (!teamCode) {
      return NextResponse.json({ status: "error", message: "Pick a team for this round." }, { status: 400 });
    }

    const admin = getWcReadClient();

    // Use the service-role client to find the match without RLS interference;
    // the match data is public anyway.
    const { data: matches, error: matchError } = await admin
      .from("wc_matches")
      .select("*")
      .order("match_number", { ascending: true });
    if (matchError) throw matchError;

    const targetMatch = findSurvivorMatchForTeam(matches || [], roundKey, teamCode);
    if (!targetMatch) {
      return NextResponse.json({ status: "error", message: `${teamCode} is not playing in this round.` }, { status: 400 });
    }
    if (targetMatch.lock_at && new Date(targetMatch.lock_at).getTime() <= Date.now()) {
      return NextResponse.json({ status: "error", message: "That match has already locked." }, { status: 400 });
    }

    // Check the user is not already eliminated and hasn't used this team yet.
    const { data: existingPicks, error: pickError } = await supabase
      .from("wc_survivor_picks")
      .select("*")
      .eq("user_id", user.id);
    if (pickError) throw pickError;

    if ((existingPicks || []).some((pick) => pick.status === "eliminated")) {
      return NextResponse.json({ status: "error", message: "You have been eliminated and cannot pick again." }, { status: 400 });
    }
    if ((existingPicks || []).some((pick) => pick.round_key !== roundKey && pick.picked_team_code === teamCode)) {
      return NextResponse.json({ status: "error", message: `You already used ${teamCode} in another round.` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("wc_survivor_picks")
      .upsert({
        user_id: user.id,
        round_key: roundKey,
        picked_team_code: teamCode,
        match_id: targetMatch.id,
        status: "pending",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,round_key" })
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ status: "ok", message: `Locked in ${teamCode} for ${WC_SURVIVOR_ROUNDS[roundKey].label}.`, pick: data });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not save WC survivor pick.",
    }, { status: error.status || 500 });
  }
}
