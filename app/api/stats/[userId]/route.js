import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requiresPro } from "@/src/lib/subscription";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * GET /api/stats/[userId]
 *
 * Returns Pro-only pick analytics for a user.
 * Requires: requesting user must be Pro AND userId must match the authenticated caller
 * (or the caller is requesting their own stats via the x-user-id header).
 *
 * Response shape:
 * {
 *   overall:  { total, correct, accuracy, totalPoints }
 *   byType:   { [pick_type]: { total, correct, accuracy, totalPoints } }
 *   streaks:  { current: number, longest: number }
 *   byRace:   { race_id, race_name, round, date, picks: [...], totalPoints, correct, total }[]
 *   drivers:  { [driver]: { picked, correct, accuracy } }   ← top 10 most picked
 * }
 */
export async function GET(request, { params }) {
  const { userId } = params;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Authorization: only the user themselves can fetch their stats (no admin bypass needed)
  const requesterId = request.headers.get("x-user-id");
  if (!requesterId || requesterId !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Pro gate — stats are a Pro-only feature
  const isPro = await requiresPro(userId);
  if (!isPro) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  try {
    const supabase = getAdminClient();

    // Fetch all scored picks for this user, joined with race info
    const { data: picks, error: picksErr } = await supabase
      .from("picks")
      .select(`
        id,
        race_id,
        pick_type,
        picked_value,
        is_correct,
        points_earned,
        is_double_down,
        bet_amount,
        created_at,
        races ( id, name, round, date, season, is_sprint )
      `)
      .eq("user_id", userId)
      .not("is_correct", "is", null)  // only scored picks
      .order("created_at", { ascending: true });

    if (picksErr) {
      return NextResponse.json({ error: picksErr.message }, { status: 500 });
    }

    if (!picks?.length) {
      return NextResponse.json({
        overall:  { total: 0, correct: 0, accuracy: 0, totalPoints: 0 },
        byType:   {},
        streaks:  { current: 0, longest: 0 },
        byRace:   [],
        drivers:  {},
      });
    }

    // ─── Overall stats ───────────────────────────────────────────────────────
    const overall = picks.reduce(
      (acc, p) => {
        acc.total++;
        if (p.is_correct) acc.correct++;
        acc.totalPoints += p.points_earned ?? 0;
        return acc;
      },
      { total: 0, correct: 0, totalPoints: 0 }
    );
    overall.accuracy = overall.total > 0
      ? Math.round((overall.correct / overall.total) * 100)
      : 0;

    // ─── By pick type ────────────────────────────────────────────────────────
    const byType = {};
    for (const p of picks) {
      if (!byType[p.pick_type]) {
        byType[p.pick_type] = { total: 0, correct: 0, totalPoints: 0 };
      }
      byType[p.pick_type].total++;
      if (p.is_correct) byType[p.pick_type].correct++;
      byType[p.pick_type].totalPoints += p.points_earned ?? 0;
    }
    for (const type of Object.keys(byType)) {
      const t = byType[type];
      t.accuracy = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
    }

    // ─── Driver tendencies (top 10 most picked) ───────────────────────────────
    const driverMap = {};
    for (const p of picks) {
      if (!p.picked_value) continue;
      if (!driverMap[p.picked_value]) {
        driverMap[p.picked_value] = { picked: 0, correct: 0 };
      }
      driverMap[p.picked_value].picked++;
      if (p.is_correct) driverMap[p.picked_value].correct++;
    }
    for (const d of Object.keys(driverMap)) {
      const entry = driverMap[d];
      entry.accuracy = entry.picked > 0
        ? Math.round((entry.correct / entry.picked) * 100)
        : 0;
    }
    // Return top 10 by times picked
    const drivers = Object.entries(driverMap)
      .sort(([, a], [, b]) => b.picked - a.picked)
      .slice(0, 10)
      .reduce((acc, [driver, data]) => { acc[driver] = data; return acc; }, {});

    // ─── By race breakdown ────────────────────────────────────────────────────
    const raceMap = new Map();
    for (const p of picks) {
      const raceId = p.race_id;
      if (!raceMap.has(raceId)) {
        raceMap.set(raceId, {
          race_id:     raceId,
          race_name:   p.races?.name ?? null,
          round:       p.races?.round ?? null,
          date:        p.races?.date ?? null,
          is_sprint:   p.races?.is_sprint ?? false,
          picks:       [],
          totalPoints: 0,
          correct:     0,
          total:       0,
        });
      }
      const race = raceMap.get(raceId);
      race.picks.push({
        pick_type:    p.pick_type,
        picked_value: p.picked_value,
        is_correct:   p.is_correct,
        points_earned: p.points_earned,
        is_double_down: p.is_double_down,
      });
      race.total++;
      if (p.is_correct) race.correct++;
      race.totalPoints += p.points_earned ?? 0;
    }
    const byRace = [...raceMap.values()].sort((a, b) => (a.round ?? 0) - (b.round ?? 0));

    // ─── Streaks (consecutive correct picks across all races) ─────────────────
    // Sort all individual picks by created_at (already ascending)
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    for (const p of picks) {
      if (p.is_correct) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }
    currentStreak = tempStreak; // tempStreak ends at last pick

    return NextResponse.json({
      overall,
      byType,
      streaks: { current: currentStreak, longest: longestStreak },
      byRace,
      drivers,
    });
  } catch (err) {
    console.error("[stats/userId]", err.message);
    return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
  }
}
