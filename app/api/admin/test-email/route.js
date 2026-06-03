import { NextResponse } from "next/server";
import {
  sendWelcomeEmail,
  sendPickReminderEmail,
  sendResultsPublishedEmail,
  sendProWelcomeEmail,
  sendInsightReadyEmail,
  sendProRenewalReminderEmail,
  sendProCancellationEmail,
} from "@/src/lib/email";
import { adminAccessErrorResponse, requireAdminRequest } from "../_lib/localAdminAccess";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Test-only endpoint. Sends any email template to a chosen address with
// realistic mock data so the templates can be inspected end-to-end without
// waiting for a real signup, lockout, or scoring run.
//
// Auth: Bearer ${CRON_SECRET} (same secret used by /api/cron/pick-reminders).
// Production-safe because the secret is opaque; only people with the env
// var can trigger sends.
//
// POST /api/admin/test-email
// {
//   "to":        "you@example.com",
//   "template":  "welcome" | "pick_reminder" | "results" | "pro_welcome"
//              | "insight_ready" | "renewal" | "cancellation",
//   "variant":   (template-specific) — see SAMPLE_PAYLOADS below
// }

function hasValidCronSecret(request) {
  const expected = String(process.env.CRON_SECRET || "").trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

const FALLBACK_TOKEN = "test-token-not-real-do-not-rely-on-it";

// Looks up the real user behind a test recipient so the template renders
// with their actual username, favourite team, and a working unsubscribe
// link. Falls back to safe placeholders when the email isn't in our DB.
async function resolveRecipient(supabase, email) {
  // 1. auth user by email
  let userId = null;
  try {
    const page = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const match = (page?.data?.users || []).find(
      (u) => String(u.email || "").toLowerCase() === String(email).toLowerCase()
    );
    userId = match?.id || null;
  } catch (_) {}

  if (!userId) {
    return {
      username: "Manager",
      favoriteTeam: null,
      unsubscribeToken: FALLBACK_TOKEN,
      foundUser: false,
    };
  }

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("username, favorite_team").eq("id", userId).maybeSingle(),
    supabase.from("email_preferences").select("unsubscribe_token").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    username:         profile?.username || "Manager",
    favoriteTeam:     profile?.favorite_team || null,
    unsubscribeToken: prefs?.unsubscribe_token || FALLBACK_TOKEN,
    foundUser:        true,
  };
}

function buildSamplePayloads({ to, recipient, variant }) {
  const { username, favoriteTeam, unsubscribeToken } = recipient;

  return {
    welcome: {
      email: to,
      username,
      favoriteTeam: favoriteTeam || "McLaren",
      unsubscribeToken,
    },

    pick_reminder: (() => {
      const [windowKey, kind] = (variant || "24h_zero").split("_");
      return {
        email: to,
        username,
        raceName: "Monaco GP",
        raceCountry: "Monaco",
        reminderWindow: windowKey === "3h" ? "3h" : "24h",
        variant: kind === "incomplete" ? "incomplete" : "zero",
        pickCount: kind === "incomplete" ? 3 : 0,
        unsubscribeToken,
      };
    })(),

    results: {
      email: to,
      username,
      raceName: "Monaco GP",
      raceCountry: "Monaco",
      raceRound: 6,
      score: variant === "zero" ? 0 : 38,
      bestPick: variant === "zero" ? null : { type: "winner", value: "Lando Norris", points: 25 },
      unsubscribeToken,
    },

    pro_welcome: {
      email: to,
      username,
    },

    insight_ready: {
      email: to,
      username,
      insightType: variant === "pre_race" ? "pre_race" : variant === "monthly" ? "monthly" : "post_race",
      raceName: variant === "monthly" ? undefined : "Monaco GP",
    },

    renewal: {
      email: to,
      username,
      renewalDate: "July 1, 2026",
    },

    cancellation: {
      email: to,
      username,
      endsAt: "June 30, 2026",
    },
  };
}

const SENDERS = {
  welcome:        sendWelcomeEmail,
  pick_reminder:  sendPickReminderEmail,
  results:        sendResultsPublishedEmail,
  pro_welcome:    sendProWelcomeEmail,
  insight_ready:  sendInsightReadyEmail,
  renewal:        sendProRenewalReminderEmail,
  cancellation:   sendProCancellationEmail,
};

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Accept either: CRON_SECRET bearer (for curl/automation) OR a valid
  // admin Supabase session (for the in-app Test Emails panel).
  if (!hasValidCronSecret(request)) {
    try {
      await requireAdminRequest(request, body);
    } catch (error) {
      return adminAccessErrorResponse(error);
    }
  }

  const to       = String(body?.to || "").trim();
  const template = String(body?.template || "").trim();
  const variant  = body?.variant ? String(body.variant) : null;

  if (!to)       return NextResponse.json({ error: "`to` is required" }, { status: 400 });
  if (!template) return NextResponse.json({ error: "`template` is required" }, { status: 400 });

  const sender = SENDERS[template];
  if (!sender) {
    return NextResponse.json({
      error: "Unknown template",
      valid: Object.keys(SENDERS),
    }, { status: 400 });
  }

  try {
    const supabase  = getSupabaseAdmin();
    const recipient = await resolveRecipient(supabase, to);
    const payloads  = buildSamplePayloads({ to, recipient, variant });
    const payload   = payloads[template];

    const result = await sender(payload);
    return NextResponse.json({
      ok: true,
      template,
      variant,
      to,
      used_real_user: recipient.foundUser,
      username_used:  recipient.username,
      resend_id:      result?.data?.id ?? null,
      resend_error:   result?.error ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err?.message || String(err),
    }, { status: 502 });
  }
}
