import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/pro/leaderboard?userId=optional
 *
 * Returns the Stint Pro Community League roster:
 *   - leaderboard: top 10 members by points_earned
 *   - totalMembers: full active roster size (for proof strip + rank-of-N copy)
 *   - myRank: 1-based rank of the provided userId, or null if absent
 *
 * Public endpoint. Used on /pro (proof strip), /profile (Account → Pro standing),
 * and /pro/success (activation landing).
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: league } = await supabase
      .from("leagues")
      .select("id")
      .eq("type", "pro_community")
      .single();

    if (!league) {
      return NextResponse.json({ leaderboard: [], totalMembers: 0, myRank: null });
    }

    const { data: members } = await supabase
      .from("league_members")
      .select("user_id, profiles(username, avatar_url)")
      .eq("league_id", league.id)
      .eq("status", "active");

    if (!members?.length) {
      return NextResponse.json({ leaderboard: [], totalMembers: 0, myRank: null });
    }

    const userIds = members.map((m) => m.user_id);

    const { data: pickTotals } = await supabase
      .from("picks")
      .select("user_id, points_earned")
      .in("user_id", userIds)
      .not("points_earned", "is", null);

    const scoreMap = new Map();
    for (const p of pickTotals ?? []) {
      const prev = scoreMap.get(p.user_id) ?? 0;
      scoreMap.set(p.user_id, prev + (p.points_earned ?? 0));
    }

    const ranked = members
      .map((m) => ({
        user_id:  m.user_id,
        username: m.profiles?.username ?? "Anonymous",
        points:   scoreMap.get(m.user_id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points);

    const leaderboard = ranked.slice(0, 10);
    const totalMembers = ranked.length;

    let myRank = null;
    if (userId) {
      const idx = ranked.findIndex((row) => row.user_id === userId);
      myRank = idx >= 0 ? idx + 1 : null;
    }

    return NextResponse.json({ leaderboard, totalMembers, myRank });
  } catch (err) {
    console.error("[pro/leaderboard]", err.message);
    return NextResponse.json({ leaderboard: [], totalMembers: 0, myRank: null });
  }
}
