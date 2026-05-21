import { NextResponse } from "next/server";
import { requireWcUser } from "../../_lib/wcServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request) {
  const body = await request.json().catch(() => ({}));

  try {
    const { user, supabase } = await requireWcUser(request, body);
    const leagueId = String(body?.leagueId || "").trim();
    const targetUserId = String(body?.userId || "").trim();
    if (!leagueId) {
      return NextResponse.json({ status: "error", message: "Missing WC league id." }, { status: 400 });
    }

    const { data: league, error: lookupError } = await supabase
      .from("wc_leagues")
      .select("id, owner_id")
      .eq("id", leagueId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!league) return NextResponse.json({ status: "error", message: "WC league not found." }, { status: 404 });

    // Two flows share this endpoint:
    //  - Self-leave: caller is the user being removed.
    //  - Owner kick: caller is the league owner removing someone else.
    if (targetUserId && targetUserId !== user.id) {
      if (league.owner_id !== user.id) {
        return NextResponse.json({ status: "error", message: "Only the WC league owner can remove members." }, { status: 403 });
      }
      if (targetUserId === league.owner_id) {
        return NextResponse.json({ status: "error", message: "The owner cannot remove themselves." }, { status: 400 });
      }
      const { error: kickError } = await supabase
        .from("wc_league_members")
        .delete()
        .eq("league_id", leagueId)
        .eq("user_id", targetUserId);
      if (kickError) throw kickError;
      return NextResponse.json({ status: "ok", message: "Removed WC league member." });
    }

    if (league.owner_id === user.id) {
      return NextResponse.json({ status: "error", message: "Owners cannot leave their own WC league." }, { status: 400 });
    }

    const { error } = await supabase
      .from("wc_league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ status: "ok", message: "Left WC league." });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not leave WC league.",
    }, { status: error.status || 500 });
  }
}

export { handle as DELETE, handle as POST };
