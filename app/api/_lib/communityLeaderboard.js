import "server-only";
import { createClient } from "@supabase/supabase-js";

let cachedAdminClient = null;

export function getCommunityLeaderboardClient() {
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    throw new Error("Missing Supabase admin env vars for community leaderboard.");
  }

  cachedAdminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdminClient;
}

/**
 * Shared leaderboard fetcher for the global community-style leagues
 * (`pro_community` and `community`). Used by /api/pro/leaderboard and
 * /api/community/leaderboard so both endpoints stay identical in shape
 * and behaviour.
 *
 * Empty / missing-league results are returned as a defaulted shape rather
 * than thrown — the consumers render a zero-state UI for these cases.
 */
export async function fetchCommunityLeaderboard({ leagueType, userId = null, topN = 10 }) {
  const supabase = getCommunityLeaderboardClient();

  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("type", leagueType)
    .single();

  if (!league) {
    return { leaderboard: [], totalMembers: 0, myRank: null };
  }

  // Members + their per-league round scores run in parallel — neither depends
  // on the other once the league id is known.
  const [{ data: members, error: membersError }, { data: leagueScores, error: scoresError }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("user_id, profiles(username, avatar_url, points)")
        .eq("league_id", league.id)
        .eq("status", "active"),
      supabase
        .from("league_round_scores")
        .select("user_id, score")
        .eq("league_id", league.id),
    ]);

  if (membersError || !members?.length) {
    return { leaderboard: [], totalMembers: 0, myRank: null };
  }

  const scoreMap = new Map();
  if (!scoresError) {
    for (const row of leagueScores ?? []) {
      const prev = scoreMap.get(row.user_id) ?? 0;
      scoreMap.set(row.user_id, prev + (row.score ?? 0));
    }
  }
  const hasLeagueScores = !scoresError && (leagueScores ?? []).length > 0;

  const ranked = members
    .map((member) => ({
      user_id: member.user_id,
      username: member.profiles?.username ?? "Anonymous",
      avatar_url: member.profiles?.avatar_url ?? null,
      points: hasLeagueScores
        ? (scoreMap.get(member.user_id) ?? 0)
        : (member.profiles?.points ?? 0),
    }))
    .sort((a, b) => b.points - a.points);

  const leaderboard = ranked.slice(0, topN);
  const totalMembers = ranked.length;

  let myRank = null;
  if (userId) {
    const idx = ranked.findIndex((row) => row.user_id === userId);
    myRank = idx >= 0 ? idx + 1 : null;
  }

  return { leaderboard, totalMembers, myRank };
}

// 60s edge cache + SWR — payload is the same for every viewer once you strip
// userId, but myRank is small enough to compute even on a cache hit (route
// can choose to skip caching when userId is set).
export const COMMUNITY_LEADERBOARD_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};
