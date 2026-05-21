import { NextResponse } from "next/server";
import { getWcReadClient, requireWcUser } from "../../_lib/wcServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  try {
    const { user, supabase } = await requireWcUser(request, body);
    const code = String(body?.code || "").trim().toUpperCase();
    if (!code) return NextResponse.json({ status: "error", message: "Enter a WC league code." }, { status: 400 });

    const { data: league, error: leagueError } = await getWcReadClient()
      .from("wc_leagues")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (leagueError) throw leagueError;
    if (!league) return NextResponse.json({ status: "error", message: "No WC league found for that code." }, { status: 404 });

    const { error } = await supabase
      .from("wc_league_members")
      .upsert({
        league_id: league.id,
        user_id: user.id,
        role: "member",
      }, { onConflict: "league_id,user_id", ignoreDuplicates: true });

    if (error) throw error;
    return NextResponse.json({ status: "ok", message: "Joined WC league.", league });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not join WC league.",
    }, { status: error.status || 500 });
  }
}
