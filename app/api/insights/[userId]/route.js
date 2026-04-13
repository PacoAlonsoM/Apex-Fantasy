import "server-only";
import { NextResponse } from "next/server";
import { requiresPro } from "@/src/lib/subscription";
import {
  getUserInsights,
  generatePostRaceInsight,
  generatePreRaceInsight,
  generateMonthlyInsight,
} from "@/src/lib/proInsights";

/**
 * GET /api/insights/[userId]
 * Returns saved AI insights for the user.
 *
 * POST /api/insights/[userId]
 * Generates a new insight.
 * Body: { type: "post_race" | "pre_race" | "monthly", raceId?: string, userStats?: object, month?: string }
 */

async function authorizeAndCheckPro(request, userId) {
  const requesterId = request.headers.get("x-user-id");
  if (!requesterId || requesterId !== userId) {
    return { ok: false, status: 403, error: "Unauthorized" };
  }
  const isPro = await requiresPro(userId);
  if (!isPro) {
    return { ok: false, status: 403, error: "Pro subscription required" };
  }
  return { ok: true };
}

async function getRouteUserId(params) {
  const resolvedParams = await params;
  return resolvedParams?.userId ?? null;
}

export async function GET(request, { params }) {
  try {
    const userId = await getRouteUserId(params);

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const auth = await authorizeAndCheckPro(request, userId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const insights = await getUserInsights(userId);
    return NextResponse.json({ insights });
  } catch (err) {
    console.error("[insights/userId][GET]", err?.message || err);
    return NextResponse.json({ error: "Could not load insights." }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const userId = await getRouteUserId(params);

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const auth = await authorizeAndCheckPro(request, userId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { type, raceId, userStats, month } = body;

    if (!type || !["post_race", "pre_race", "monthly"].includes(type)) {
      return NextResponse.json({ error: "type must be post_race, pre_race, or monthly" }, { status: 400 });
    }

    let result;

    if (type === "post_race") {
      if (!raceId) return NextResponse.json({ error: "raceId required for post_race" }, { status: 400 });
      result = await generatePostRaceInsight({ userId, raceId });
    } else if (type === "pre_race") {
      if (!raceId) return NextResponse.json({ error: "raceId required for pre_race" }, { status: 400 });
      if (!userStats) return NextResponse.json({ error: "userStats required for pre_race" }, { status: 400 });
      result = await generatePreRaceInsight({ userId, raceId, userStats });
    } else if (type === "monthly") {
      if (!month) return NextResponse.json({ error: "month required for monthly" }, { status: 400 });
      if (!userStats) return NextResponse.json({ error: "userStats required for monthly" }, { status: 400 });
      result = await generateMonthlyInsight({ userId, month, userStats });
    }

    if (!result) {
      return NextResponse.json({ error: "Could not generate insight — missing data" }, { status: 422 });
    }

    return NextResponse.json({ insight: result });
  } catch (err) {
    console.error("[insights/userId]", err.message);
    return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 });
  }
}
