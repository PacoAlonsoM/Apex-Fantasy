// Cron-triggered automation for Pro post-race debriefs.
//
// Runs on a schedule (see vercel.json). For each race whose results have
// been entered, finds every Pro subscriber who doesn't yet have a post_race
// insight row for that race, then calls generatePostRaceInsight() for them.
//
// Authentication: same dual-auth pattern as the WC sync cron — either a
// Vercel cron header or a manual admin call works.

import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePostRaceInsight } from "@/src/lib/proInsights";
import { sendInsightReadyEmail } from "@/src/lib/email";

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

// Pull the first sentence (or first 140 chars) out of an insight body so
// the email has a one-line teaser. Strips markdown bullets / leading "**".
function extractHeadlineLine(content) {
  if (!content || typeof content !== "string") return null;
  const cleaned = content
    .replace(/^\s*[-*]\s+/gm, "")        // bullet markers
    .replace(/\*\*/g, "")                 // bold markers
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  // Take up to the first sentence terminator.
  const match = cleaned.match(/^(.+?[.!?])(\s|$)/);
  let line = match ? match[1] : cleaned;
  if (line.length > 140) line = `${line.slice(0, 137).trimEnd()}...`;
  return line;
}

async function generateBatch() {
  const supabase = getAdminClient();
  const summary = { generated: 0, skipped: 0, errors: [] };
  // Successful generations queued for email dispatch via after().
  const emailQueue = []; // { userId, raceId, raceRound, insightId, content }

  // 1. Find recently-published race results.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const { data: recentResults, error: resErr } = await supabase
    .from("race_results")
    .select("race_round, updated_at, results_entered")
    .eq("results_entered", true)
    .gte("updated_at", cutoff.toISOString());
  if (resErr) throw new Error(`race_results: ${resErr.message}`);
  if (!recentResults?.length) return { summary, emailQueue };

  // 2. Resolve to race rows (so we have the id needed by generatePostRaceInsight).
  const rounds = [...new Set(recentResults.map((r) => r.race_round))];
  const { data: races, error: raceErr } = await supabase
    .from("races")
    .select("id, round, season")
    .in("round", rounds);
  if (raceErr) throw new Error(`races: ${raceErr.message}`);
  if (!races?.length) return { summary, emailQueue };

  // 3. Find Pro users.
  const { data: proUsers, error: proErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("subscription_status", "pro");
  if (proErr) throw new Error(`profiles: ${proErr.message}`);
  if (!proUsers?.length) return { summary, emailQueue };
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
        return { summary, emailQueue };
      }
      try {
        const result = await generatePostRaceInsight({ userId, raceId: race.id, client: supabase });
        if (result) {
          summary.generated += 1;
          // Queue this insight for email dispatch. We only enqueue rows
          // that were actually persisted (have an id) — transient fallback
          // rows return without an id and shouldn't trigger an email.
          if (result.id) {
            emailQueue.push({
              userId,
              raceId: race.id,
              raceRound: race.round,
              insightId: result.id,
              content: result.content || "",
            });
          }
        } else {
          summary.skipped += 1;
        }
      } catch (err) {
        summary.errors.push(`user=${userId} race=${race.id}: ${err.message || "unknown"}`);
      }
    }
  }

  return { summary, emailQueue };
}

/**
 * Send "Insight ready" emails for freshly-generated post_race insights.
 *
 * Idempotent: each user_ai_insights row is marked with email_sent_at on
 * success and skipped on subsequent calls. Respects email_preferences.
 * Runs inside after() so admin/cron responses aren't blocked.
 */
async function dispatchInsightEmails(supabase, queue) {
  if (!queue.length) return { dispatched: 0, skipped: 0, errors: [] };

  const result = {
    dispatched: 0,
    skipped_already_sent: 0,
    skipped_opted_out: 0,
    skipped_no_email: 0,
    errors: [],
  };

  // Re-check email_sent_at — another concurrent run may have already sent.
  const insightIds = queue.map((q) => q.insightId);
  const { data: rows, error: rowsErr } = await supabase
    .from("user_ai_insights")
    .select("id, email_sent_at")
    .in("id", insightIds);
  if (rowsErr) {
    result.errors.push({ phase: "user_ai_insights.read", error: rowsErr.message });
    return result;
  }
  const sentAlready = new Set(
    (rows || []).filter((r) => r.email_sent_at).map((r) => r.id)
  );

  const pending = queue.filter((q) => !sentAlready.has(q.insightId));
  result.skipped_already_sent = queue.length - pending.length;
  if (!pending.length) return result;

  const userIds = [...new Set(pending.map((q) => q.userId))];
  const rounds  = [...new Set(pending.map((q) => q.raceRound))];

  // Email preferences (including ai_insights opt-out + unsubscribe token).
  const { data: prefs } = await supabase
    .from("email_preferences")
    .select("user_id, ai_insights, unsubscribe_token")
    .in("user_id", userIds);
  const prefsByUser = new Map((prefs || []).map((p) => [p.user_id, p]));

  // Usernames.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds);
  const usernameByUser = new Map((profiles || []).map((p) => [p.id, p.username]));

  // Race display names from race_calendar.
  const { data: calendar } = await supabase
    .from("race_calendar")
    .select("race_round, display_name")
    .in("race_round", rounds);
  const raceNameByRound = new Map(
    (calendar || []).map((c) => [c.race_round, c.display_name])
  );

  // Auth emails — paginated listUsers; covers our user base in one page.
  const emailByUser = new Map();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      result.errors.push({ phase: "auth.listUsers", error: error.message });
      break;
    }
    (data?.users || []).forEach((u) => { if (u.email) emailByUser.set(u.id, u.email); });
    if (!data?.users || data.users.length < 1000) break;
    page += 1;
    if (page > 10) break;
  }

  for (const item of pending) {
    const pref = prefsByUser.get(item.userId);
    if (!pref || pref.ai_insights === false) {
      result.skipped_opted_out += 1;
      continue;
    }
    const email = emailByUser.get(item.userId);
    if (!email) { result.skipped_no_email += 1; continue; }

    try {
      await sendInsightReadyEmail({
        email,
        username:         usernameByUser.get(item.userId) || undefined,
        insightType:      "post_race",
        raceName:         raceNameByRound.get(item.raceRound) || `Round ${item.raceRound}`,
        headlineLine:     extractHeadlineLine(item.content),
        unsubscribeToken: pref.unsubscribe_token,
      });

      const { error: markErr } = await supabase
        .from("user_ai_insights")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", item.insightId);
      if (markErr) throw markErr;

      result.dispatched += 1;
    } catch (err) {
      result.errors.push({ insight_id: item.insightId, error: err?.message || String(err) });
    }
  }

  return result;
}

export async function GET(request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }
  try {
    const { summary, emailQueue } = await generateBatch();

    // Dispatch insight-ready emails after the response so the admin/cron
    // call returns immediately. Catch + log so email failures never bubble
    // up and break the generation summary.
    if (emailQueue.length) {
      after(async () => {
        try {
          const supabase = getAdminClient();
          const dispatch = await dispatchInsightEmails(supabase, emailQueue);
          console.log("[insight-emails] dispatched", JSON.stringify(dispatch));
        } catch (err) {
          console.error("[insight-emails] failed", err?.message || err);
        }
      });
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[insights/generate-post-race]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = GET;
