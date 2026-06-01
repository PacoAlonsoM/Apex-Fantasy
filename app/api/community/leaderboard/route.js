import "server-only";
import { NextResponse } from "next/server";
import {
  fetchCommunityLeaderboard,
  COMMUNITY_LEADERBOARD_CACHE_HEADERS,
} from "../../_lib/communityLeaderboard";

export const runtime = "nodejs";

/**
 * GET /api/community/leaderboard?userId=optional
 *
 * Returns the Stint Community League roster — the open league every
 * signup is auto-enrolled in:
 *   - leaderboard: top 10 members by points
 *   - totalMembers: full active roster size
 *   - myRank: 1-based rank of the provided userId, or null if absent
 *
 * Public endpoint. Used on /leagues and the community landing card.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || null;

    const payload = await fetchCommunityLeaderboard({
      leagueType: "community",
      userId,
    });

    const headers = { "Content-Type": "application/json" };
    if (!userId) Object.assign(headers, COMMUNITY_LEADERBOARD_CACHE_HEADERS);

    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch (err) {
    console.error("[community/leaderboard]", err.message);
    return NextResponse.json({ leaderboard: [], totalMembers: 0, myRank: null });
  }
}
