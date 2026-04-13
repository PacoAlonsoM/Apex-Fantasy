import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/pro/leaderboard
 *
 * Returns the top 10 players in the Pro Community League by total points_earned.
 * Public endpoint — used on the /pro marketing page.
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find the Pro Community League
    const { data: league } = await supabase
      .from("leagues")
      .select("id")
      .eq("type", "pro_community")
      .single();

    if (!league) {
      return NextResponse.json({ leaderboard: [] });
    }

    // Get active members
    const { data: members } = await supabase
      .from("league_members")
      .select("user_id, profiles(username, avatar_url)")
      .eq("league_id", league.id)
      .eq("status", "active");

    if (!members?.length) {
      return NextResponse.json({ leaderboard: [] });
    }

    const userIds = members.map((m) => m.user_id);

    // Sum points_earned from picks in this league's season
    const { data: pickTotals } = await supabase
      .from("picks")
      .select("user_id, points_earned")
      .in("user_id", userIds)
      .not("points_earned", "is", null);

    // Aggregate
    const scoreMap = new Map();
    for (const p of pickTotals ?? []) {
      const prev = scoreMap.get(p.user_id) ?? 0;
      scoreMap.set(p.user_id, prev + (p.points_earned ?? 0));
    }

    const leaderboard = members
      .map((m) => ({
        user_id:  m.user_id,
        username: m.profiles?.username ?? "Anonymous",
        points:   scoreMap.get(m.user_id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error("[pro/leaderboard]", err.message);
    return NextResponse.json({ leaderboard: [] });
  }
}
