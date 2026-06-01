import { jsonOk } from "../../admin/_lib/response";
import { getSupabaseAdmin } from "../../admin/_lib/supabaseAdmin";
import { sendPickReminderEmail } from "@/src/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Cron auth ────────────────────────────────────────────────
// Accepts three signals (any one is sufficient):
//   1. Vercel cron — `x-vercel-cron` header or signed `x-vercel-cron-signature`
//   2. External cron (cron-job.org, etc.) — `Authorization: Bearer ${CRON_SECRET}`
//      or `x-cron-secret: ${CRON_SECRET}` header
//   3. `?cron=1` query param — only honoured outside production for manual tests

function isCronRequest(request) {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  if (request.headers.get("x-vercel-cron-signature")) return true;
  return false;
}

function hasValidCronSecret(request) {
  const expected = String(process.env.CRON_SECRET || "").trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${expected}`) return true;
  const headerSecret = request.headers.get("x-cron-secret") || "";
  return headerSecret === expected;
}

function authorize(request) {
  if (isCronRequest(request)) return true;
  if (hasValidCronSecret(request)) return true;
  if (process.env.VERCEL_ENV !== "production") {
    const url = new URL(request.url);
    if (url.searchParams.get("cron") === "1") return true;
  }
  return false;
}

// ─── Reminder window math ─────────────────────────────────────
// Returns races whose lock_time falls in either the 24h or 3h window,
// labelled with which window they matched.

const WINDOWS = {
  "24h": { centerHours: 24, halfWidthMinutes: 30 },
  "3h":  { centerHours: 3,  halfWidthMinutes: 30 },
};

async function findRacesInReminderWindow(supabase, windowKey) {
  const { centerHours, halfWidthMinutes } = WINDOWS[windowKey];
  const now = new Date();
  const lo = new Date(now.getTime() + centerHours * 3600_000 - halfWidthMinutes * 60_000);
  const hi = new Date(now.getTime() + centerHours * 3600_000 + halfWidthMinutes * 60_000);
  const { data, error } = await supabase
    .from("races")
    .select("id, name, country, lock_time")
    .gte("lock_time", lo.toISOString())
    .lte("lock_time", hi.toISOString());
  if (error) throw new Error(`races lookup: ${error.message}`);
  return data || [];
}

// ─── Eligibility ──────────────────────────────────────────────
// A user is eligible if either:
//   (a) they have at least 1 pick in the 3 most-recently-locked races, OR
//   (b) they have fewer than 3 completed races since their signup (still new)
// Otherwise the user is treated as dormant and skipped.

async function buildEligibleUserSet(supabase) {
  // Most recent 3 completed races (lock_time in the past).
  const nowIso = new Date().toISOString();
  const { data: pastRaces } = await supabase
    .from("races")
    .select("id, lock_time")
    .lt("lock_time", nowIso)
    .order("lock_time", { ascending: false })
    .limit(3);

  const pastRaceIds = (pastRaces || []).map(r => r.id);
  const oldestPastLock = pastRaces?.[pastRaces.length - 1]?.lock_time || null;

  // Users who made at least one pick in those 3 races → active.
  const activeUserIds = new Set();
  if (pastRaceIds.length > 0) {
    const { data: recentPicks } = await supabase
      .from("picks")
      .select("user_id")
      .in("race_id", pastRaceIds);
    (recentPicks || []).forEach(p => activeUserIds.add(p.user_id));
  }

  // Users who joined after the oldest of those 3 races locked → still new.
  // If we have fewer than 3 completed races at all, every user counts as new.
  return { activeUserIds, oldestPastLock, hasEnoughHistory: pastRaceIds.length >= 3 };
}

function isEligible({ userId, profileCreatedAt }, eligibility) {
  if (eligibility.activeUserIds.has(userId)) return true;
  if (!eligibility.hasEnoughHistory) return true;
  if (!eligibility.oldestPastLock || !profileCreatedAt) return true;
  return new Date(profileCreatedAt).getTime() > new Date(eligibility.oldestPastLock).getTime();
}

// ─── Main run ─────────────────────────────────────────────────

async function runReminders(supabase) {
  const summary = {
    started_at: new Date().toISOString(),
    windows: {},
    sent: 0,
    skipped_already_sent: 0,
    skipped_dormant: 0,
    skipped_opted_out: 0,
    skipped_complete: 0,
    errors: [],
  };

  const eligibility = await buildEligibleUserSet(supabase);

  // Get every profile with created_at — single query, joined with prefs.
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, username, created_at, email_preferences(pick_reminders, unsubscribe_token)");
  if (profErr) throw new Error(`profiles: ${profErr.message}`);

  // Fetch all auth user emails in one paginated call.
  // Supabase admin listUsers returns the auth.users records.
  const emailByUserId = new Map();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth.listUsers: ${error.message}`);
    (data?.users || []).forEach(u => { if (u.email) emailByUserId.set(u.id, u.email); });
    if (!data?.users || data.users.length < 1000) break;
    page += 1;
    if (page > 10) break; // hard cap — 10k users
  }

  for (const windowKey of Object.keys(WINDOWS)) {
    const races = await findRacesInReminderWindow(supabase, windowKey);
    summary.windows[windowKey] = { matched_races: races.length, race_names: races.map(r => r.name) };
    if (races.length === 0) continue;

    for (const race of races) {
      // Existing sends for this race+window so we can skip dupes in this run.
      const { data: alreadySent } = await supabase
        .from("pick_reminders_sent")
        .select("user_id")
        .eq("race_id", race.id)
        .eq("reminder_window", windowKey);
      const alreadySentIds = new Set((alreadySent || []).map(r => r.user_id));

      // Pick counts for this race, keyed by user.
      const { data: racePicks } = await supabase
        .from("picks")
        .select("user_id")
        .eq("race_id", race.id);
      const picksByUser = new Map();
      (racePicks || []).forEach(p => picksByUser.set(p.user_id, (picksByUser.get(p.user_id) || 0) + 1));

      for (const profile of profiles || []) {
        if (alreadySentIds.has(profile.id)) { summary.skipped_already_sent += 1; continue; }

        const prefs = profile.email_preferences;
        // Defensive: should never happen because of the backfill, but skip if missing.
        if (!prefs || prefs.pick_reminders === false) { summary.skipped_opted_out += 1; continue; }

        if (!isEligible({ userId: profile.id, profileCreatedAt: profile.created_at }, eligibility)) {
          summary.skipped_dormant += 1; continue;
        }

        const pickCount = picksByUser.get(profile.id) || 0;
        if (pickCount >= 6) { summary.skipped_complete += 1; continue; }

        const email = emailByUserId.get(profile.id);
        if (!email) continue; // user has no email on file — nothing we can do

        const variant = pickCount === 0 ? "zero" : "incomplete";

        try {
          await sendPickReminderEmail({
            email,
            username: profile.username,
            raceName: race.name,
            raceCountry: race.country,
            reminderWindow: windowKey,
            variant,
            pickCount,
            unsubscribeToken: prefs.unsubscribe_token,
          });

          const { error: insertErr } = await supabase
            .from("pick_reminders_sent")
            .insert({
              user_id: profile.id,
              race_id: race.id,
              reminder_window: windowKey,
              email_variant: variant,
              pick_count_at_send: pickCount,
            });
          if (insertErr) throw insertErr;

          summary.sent += 1;
        } catch (err) {
          summary.errors.push({ user_id: profile.id, race_id: race.id, window: windowKey, error: err.message });
        }
      }
    }
  }

  summary.finished_at = new Date().toISOString();
  return summary;
}

// ─── HTTP handlers ────────────────────────────────────────────

export async function GET(request) {
  if (!authorize(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const supabase = getSupabaseAdmin();
    const summary = await runReminders(supabase);
    return jsonOk("pick-reminders ran", { summary });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const POST = GET;
