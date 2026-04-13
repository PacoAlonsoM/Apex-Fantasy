import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

function env(name) {
  return String(process.env[name] || "").trim();
}

function getAccessToken(request) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice(7).trim();
}

function createRequestSupabaseClient(accessToken) {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anonKey || !accessToken) return null;

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function authorizeAndCheckPro(request, userId) {
  const requesterId = request.headers.get("x-user-id");
  if (!requesterId || requesterId !== userId) {
    return { ok: false, status: 403, error: "Unauthorized" };
  }

  const accessToken = getAccessToken(request);
  const userClient = createRequestSupabaseClient(accessToken);

  if (userClient && accessToken) {
    const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
    if (authError || String(authData?.user?.id || "") !== userId) {
      return { ok: false, status: 403, error: "Unauthorized" };
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("id,username,subscription_status")
      .eq("id", userId)
      .maybeSingle();

    if (!profileError && profile) {
      if (profile.subscription_status !== "pro") {
        return { ok: false, status: 403, error: "Pro subscription required" };
      }

      return { ok: true, profile, supabase: userClient };
    }
  }

  try {
    const isPro = await requiresPro(userId);
    if (!isPro) {
      return { ok: false, status: 403, error: "Pro subscription required" };
    }
    return { ok: true, profile: null, supabase: null };
  } catch (error) {
    return { ok: false, status: 503, error: "Pro insights are temporarily unavailable on the server." };
  }
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

    const insights = await getUserInsights(userId, auth.supabase || null);
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
      result = await generatePostRaceInsight({ userId, raceId, client: auth.supabase || null });
    } else if (type === "pre_race") {
      if (!raceId) return NextResponse.json({ error: "raceId required for pre_race" }, { status: 400 });
      if (!userStats) return NextResponse.json({ error: "userStats required for pre_race" }, { status: 400 });
      result = await generatePreRaceInsight({ userId, raceId, userStats, client: auth.supabase || null });
    } else if (type === "monthly") {
      if (!month) return NextResponse.json({ error: "month required for monthly" }, { status: 400 });
      if (!userStats) return NextResponse.json({ error: "userStats required for monthly" }, { status: 400 });
      result = await generateMonthlyInsight({
        userId,
        month,
        userStats,
        username: auth.profile?.username || null,
        client: auth.supabase || null,
      });
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
