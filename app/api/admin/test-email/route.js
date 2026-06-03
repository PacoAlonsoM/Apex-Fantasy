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

const SAMPLE_TOKEN = "test-token-not-real-do-not-rely-on-it";

const SAMPLE_PAYLOADS = {
  welcome: (to) => ({
    email: to,
    username: "TestUser",
    favoriteTeam: "McLaren",
    unsubscribeToken: SAMPLE_TOKEN,
  }),

  pick_reminder: (to, variant) => {
    // variant: "24h_zero" | "24h_incomplete" | "3h_zero" | "3h_incomplete"
    const [windowKey, kind] = (variant || "24h_zero").split("_");
    return {
      email: to,
      username: "TestUser",
      raceName: "Monaco GP",
      raceCountry: "Monaco",
      reminderWindow: windowKey === "3h" ? "3h" : "24h",
      variant: kind === "incomplete" ? "incomplete" : "zero",
      pickCount: kind === "incomplete" ? 3 : 0,
      unsubscribeToken: SAMPLE_TOKEN,
    };
  },

  results: (to, variant) => ({
    // variant: "scored" (default) | "zero"
    email: to,
    username: "TestUser",
    raceName: "Monaco GP",
    raceCountry: "Monaco",
    raceRound: 6,
    score: variant === "zero" ? 0 : 38,
    bestPick: variant === "zero" ? null : { type: "winner", value: "Lando Norris", points: 25 },
    unsubscribeToken: SAMPLE_TOKEN,
  }),

  pro_welcome: (to) => ({
    email: to,
    username: "TestUser",
  }),

  insight_ready: (to, variant) => ({
    // variant: "post_race" (default) | "pre_race" | "monthly"
    email: to,
    username: "TestUser",
    insightType: variant === "pre_race" ? "pre_race" : variant === "monthly" ? "monthly" : "post_race",
    raceName: variant === "monthly" ? undefined : "Monaco GP",
  }),

  renewal: (to) => ({
    email: to,
    username: "TestUser",
    renewalDate: "July 1, 2026",
  }),

  cancellation: (to) => ({
    email: to,
    username: "TestUser",
    endsAt: "June 30, 2026",
  }),
};

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
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const to       = String(body?.to || "").trim();
  const template = String(body?.template || "").trim();
  const variant  = body?.variant ? String(body.variant) : null;

  if (!to)       return NextResponse.json({ error: "`to` is required" }, { status: 400 });
  if (!template) return NextResponse.json({ error: "`template` is required" }, { status: 400 });

  const sender  = SENDERS[template];
  const payload = SAMPLE_PAYLOADS[template]?.(to, variant);

  if (!sender || !payload) {
    return NextResponse.json({
      error: "Unknown template",
      valid: Object.keys(SENDERS),
    }, { status: 400 });
  }

  try {
    const result = await sender(payload);
    return NextResponse.json({
      ok: true,
      template,
      variant,
      to,
      resend_id: result?.data?.id ?? null,
      resend_error: result?.error ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err?.message || String(err),
    }, { status: 502 });
  }
}
