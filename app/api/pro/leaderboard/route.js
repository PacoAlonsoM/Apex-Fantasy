import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

let cachedAdminClient = null;

function getAdminClient() {
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    throw new Error("Missing Supabase admin env vars for Pro leaderboard.");
  }

  cachedAdminClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cachedAdminClient;
}

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

    const supabase = getAdminClient();

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
      .select("user_id, profiles(username, avatar_url, points)")
      .eq("league_id", league.id)
      .eq("status", "active");

    if (!members?.length) {
      return NextResponse.json({ leaderboard: [], totalMembers: 0, myRank: null });
    }

    const userIds = members.map((member) => member.user_id);

    const { data: leagueScores, error: scoresError } = await supabase
      .from("league_round_scores")
      .select("user_id, score")
      .eq("league_id", league.id)
      .in("user_id", userIds);

    const scoreMap = new Map();
    if (!scoresError) {
      for (const row of leagueScores ?? []) {
        const prev = scoreMap.get(row.user_id) ?? 0;
        scoreMap.set(row.user_id, prev + (row.score ?? 0));
      }
    }

    const ranked = members
      .map((member) => ({
        user_id:  member.user_id,
        username: member.profiles?.username ?? "Anonymous",
        points:   scoreMap.has(member.user_id)
          ? scoreMap.get(member.user_id)
          : (member.profiles?.points ?? 0),
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
