import { NextResponse } from "next/server";
import { getWcReadClient, requireWcUser } from "../../../_lib/wcServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const resolvedParams = typeof params?.then === "function" ? await params : params;
  const leagueId = String(resolvedParams?.id || "").trim();
  if (!leagueId) {
    return NextResponse.json({ status: "error", message: "Missing WC league id." }, { status: 400 });
  }

  try {
    const { user, supabase } = await requireWcUser(request);

    // RLS will hide this row from non-members, so a null result means "no access".
    const { data: league, error: leagueError } = await supabase
      .from("wc_leagues")
      .select("id, name, code, owner_id, visibility")
      .eq("id", leagueId)
      .maybeSingle();

    if (leagueError) throw leagueError;
    if (!league) {
      return NextResponse.json({ status: "error", message: "WC league not found or you are not a member." }, { status: 404 });
    }

    const admin = getWcReadClient();

    const { data: members, error: membersError } = await admin
      .from("wc_league_members")
      .select("user_id, role, joined_at")
      .eq("league_id", leagueId);

    if (membersError) throw membersError;

    const memberIds = (members || []).map((row) => row.user_id);
    if (!memberIds.length) {
      return NextResponse.json({ status: "ok", league, standings: [] });
    }

    const [profilesResponse, matchPointsResponse, bracketPointsResponse, survivorPointsResponse, matchCountResponse, bracketResponse, survivorCountResponse] = await Promise.all([
      admin.from("profiles").select("id, username").in("id", memberIds),
      admin.from("wc_match_predictions").select("user_id, points").in("user_id", memberIds).not("points", "is", null),
      admin.from("wc_bracket_predictions").select("user_id, points").in("user_id", memberIds).not("points", "is", null),
      admin.from("wc_survivor_picks").select("user_id, points").in("user_id", memberIds).not("points", "is", null),
      admin.from("wc_match_predictions").select("user_id").in("user_id", memberIds),
      admin.from("wc_bracket_predictions").select("user_id").in("user_id", memberIds),
      admin.from("wc_survivor_picks").select("user_id").in("user_id", memberIds),
    ]);

    if (profilesResponse.error) throw profilesResponse.error;

    const usernames = new Map((profilesResponse.data || []).map((row) => [row.id, row.username]));
    const matchTotals = new Map();
    const bracketTotals = new Map();
    const survivorTotals = new Map();
    const picksCount = new Map();
    const survivorPicksCount = new Map();
    const bracketSubmitted = new Set();

    if (!matchPointsResponse.error) {
      (matchPointsResponse.data || []).forEach((row) => {
        matchTotals.set(row.user_id, (matchTotals.get(row.user_id) || 0) + Number(row.points || 0));
      });
    }
    if (!bracketPointsResponse.error) {
      (bracketPointsResponse.data || []).forEach((row) => {
        bracketTotals.set(row.user_id, (bracketTotals.get(row.user_id) || 0) + Number(row.points || 0));
      });
    }
    if (!survivorPointsResponse.error) {
      (survivorPointsResponse.data || []).forEach((row) => {
        survivorTotals.set(row.user_id, (survivorTotals.get(row.user_id) || 0) + Number(row.points || 0));
      });
    }
    if (!matchCountResponse.error) {
      (matchCountResponse.data || []).forEach((row) => {
        picksCount.set(row.user_id, (picksCount.get(row.user_id) || 0) + 1);
      });
    }
    if (!survivorCountResponse.error) {
      (survivorCountResponse.data || []).forEach((row) => {
        survivorPicksCount.set(row.user_id, (survivorPicksCount.get(row.user_id) || 0) + 1);
      });
    }
    if (!bracketResponse.error) {
      (bracketResponse.data || []).forEach((row) => {
        bracketSubmitted.add(row.user_id);
      });
    }

    const standings = (members || [])
      .map((member) => {
        const matchPoints = matchTotals.get(member.user_id) || 0;
        const bracketPoints = bracketTotals.get(member.user_id) || 0;
        const survivorPoints = survivorTotals.get(member.user_id) || 0;
        return {
          user_id: member.user_id,
          username: usernames.get(member.user_id) || `player_${String(member.user_id).slice(0, 6)}`,
          role: member.role,
          joined_at: member.joined_at,
          isYou: member.user_id === user.id,
          isOwner: league.owner_id === member.user_id,
          picksSaved: picksCount.get(member.user_id) || 0,
          survivorPicksSaved: survivorPicksCount.get(member.user_id) || 0,
          bracketSubmitted: bracketSubmitted.has(member.user_id),
          matchPoints,
          bracketPoints,
          survivorPoints,
          totalPoints: matchPoints + bracketPoints + survivorPoints,
        };
      })
      .sort((left, right) =>
        right.totalPoints - left.totalPoints
        || right.matchPoints - left.matchPoints
        || right.survivorPoints - left.survivorPoints
        || left.username.localeCompare(right.username)
      );

    return NextResponse.json({ status: "ok", league, standings });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not load WC league standings.",
    }, { status: error.status || 500 });
  }
}
