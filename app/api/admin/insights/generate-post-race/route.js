// Cron-triggered automation for Pro post-race debriefs.
//
// Runs on a schedule (see vercel.json). For each race whose results have
// been entered, finds every Pro subscriber who doesn't yet have a post_race
// insight row for that race, then calls generatePostRaceInsight() for them.
//
// Authentication: same dual-auth pattern as the WC sync cron — either a
// Vercel cron header or a manual admin call works.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePostRaceInsight } from "@/src/lib/proInsights";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function isCronRequest(request) {
  const cronHeader = request.headers.get("x-vercel-cron");
  if (cronHeader) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("cron") === "1") return true;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${cronSecret}`) return true;
  }
  return false;
}

// Cap per-run cost so a stuck loop doesn't melt the AI bill.
const MAX_INSIGHTS_PER_RUN = 60;
// Look back this many days for races that just got results.
const LOOKBACK_DAYS = 14;

async function generateBatch() {
  const supabase = getAdminClient();
  const summary = { generated: 0, skipped: 0, errors: [] };

  // 1. Find recently-published race results.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const { data: recentResults, error: resErr } = await supabase
    .from("race_results")
    .select("race_round, updated_at, results_entered")
    .eq("results_entered", true)
    .gte("updated_at", cutoff.toISOString());
  if (resErr) throw new Error(`race_results: ${resErr.message}`);
  if (!recentResults?.length) return summary;

  // 2. Resolve to race rows (so we have the id needed by generatePostRaceInsight).
  const rounds = [...new Set(recentResults.map((r) => r.race_round))];
  const { data: races, error: raceErr } = await supabase
    .from("races")
    .select("id, round, season")
    .in("round", rounds);
  if (raceErr) throw new Error(`races: ${raceErr.message}`);
  if (!races?.length) return summary;

  // 3. Find Pro users.
  const { data: proUsers, error: proErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("subscription_status", "pro");
  if (proErr) throw new Error(`profiles: ${proErr.message}`);
  if (!proUsers?.length) return summary;
  const proUserIds = proUsers.map((u) => u.id);

  // 4. Find which (user × race) pairs already have a post_race insight.
  const raceIds = races.map((r) => r.id);
  const { data: existingInsights } = await supabase
    .from("user_ai_insights")
    .select("user_id, race_id")
    .eq("insight_type", "post_race")
    .in("race_id", raceIds)
    .in("user_id", proUserIds);
  const have = new Set((existingInsights || []).map((r) => `${r.user_id}|${r.race_id}`));

  // 5. Generate for the missing pairs, capped per run.
  for (const race of races) {
    for (const userId of proUserIds) {
      if (have.has(`${userId}|${race.id}`)) {
        summary.skipped += 1;
        continue;
      }
      if (summary.generated >= MAX_INSIGHTS_PER_RUN) {
        return summary;
      }
      try {
        const result = await generatePostRaceInsight({ userId, raceId: race.id, client: supabase });
        if (result) summary.generated += 1;
        else summary.skipped += 1;
      } catch (err) {
        summary.errors.push(`user=${userId} race=${race.id}: ${err.message || "unknown"}`);
      }
    }
  }

  return summary;
}

export async function GET(request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }
  try {
    const summary = await generateBatch();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[insights/generate-post-race]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = GET;
