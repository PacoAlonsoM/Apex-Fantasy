import { NextResponse } from "next/server";
import { getWcReadClient } from "../../_lib/wcServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = getWcReadClient();
    const { data: picks, error } = await admin
      .from("wc_survivor_picks")
      .select("user_id, status, points");
    if (error) throw error;

    if (!picks?.length) {
      return NextResponse.json({ status: "ok", leaderboard: [], totals: { entrants: 0, alive: 0 } });
    }

    const byUser = new Map();
    for (const pick of picks) {
      if (!byUser.has(pick.user_id)) {
        byUser.set(pick.user_id, { user_id: pick.user_id, rounds: 0, points: 0, eliminated: false });
      }
      const bucket = byUser.get(pick.user_id);
      if (pick.status === "correct") {
        bucket.rounds += 1;
        bucket.points += Number(pick.points || 0);
      } else if (pick.status === "eliminated") {
        bucket.eliminated = true;
      }
    }

    const userIds = [...byUser.keys()];
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    const usernames = new Map((profiles || []).map((row) => [row.id, row.username]));

    const leaderboard = [...byUser.values()]
      .map((row) => ({
        user_id: row.user_id,
        username: usernames.get(row.user_id) || `player_${String(row.user_id).slice(0, 6)}`,
        rounds: row.rounds,
        points: row.points,
        alive: !row.eliminated,
      }))
      .sort((left, right) =>
        Number(right.alive) - Number(left.alive)
        || right.rounds - left.rounds
        || right.points - left.points
        || left.username.localeCompare(right.username)
      )
      .slice(0, 50);

    const totals = {
      entrants: byUser.size,
      alive: [...byUser.values()].filter((row) => !row.eliminated).length,
    };

    return NextResponse.json({ status: "ok", leaderboard, totals });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not load WC survivor leaderboard.",
    }, { status: 500 });
  }
}
