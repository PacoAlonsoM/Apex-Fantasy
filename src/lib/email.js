import "server-only";
import { Resend } from "resend";

let resendClient = null;

const FROM = process.env.RESEND_FROM_EMAIL || "Stint <noreply@stint-web.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.stint-web.com";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

// ─── Template helpers ──────────────────────────────────────────────────────────

function baseHtml(title, previewText, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#06101b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#06101b;max-height:0;overflow:hidden;">${previewText}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#06101b;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" style="background:#0d1f2e;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
              <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#fff;">STINT</span>
              <span style="font-size:10px;font-weight:800;letter-spacing:0.1em;color:#fff;background:#FF6A1A;padding:2px 7px;border-radius:999px;margin-left:8px;vertical-align:middle;">PRO</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.07);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.7;">
                You're receiving this because you have a Stint Pro subscription.<br />
                <a href="${SITE_URL}/pro" style="color:#FF6A1A;text-decoration:none;">Manage subscription</a>
                &nbsp;·&nbsp;
                <a href="${SITE_URL}/privacy" style="color:rgba(255,255,255,0.35);text-decoration:none;">Privacy</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function h1(text) {
  return `<h1 style="margin:0 0 16px;font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#fff;line-height:1.25;">${text}</h1>`;
}

function p(text, style = "") {
  return `<p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.65;${style}">${text}</p>`;
}

function cta(text, href) {
  return `<a href="${href}" style="display:inline-block;margin-top:8px;padding:13px 28px;background:#FF6A1A;color:#fff;font-size:14px;font-weight:800;letter-spacing:-0.01em;border-radius:999px;text-decoration:none;">${text}</a>`;
}

// ─── Email senders ─────────────────────────────────────────────────────────────

/**
 * Sent immediately when a checkout.session.completed event fires.
 *
 * @param {{ email: string, username?: string }} opts
 */
export async function sendProWelcomeEmail({ email, username }) {
  const resend = getResendClient();
  const name    = username ?? "there";
  const title   = "Welcome to Stint Pro 🏁";
  const preview = "Your Pro subscription is active — here's what you've unlocked.";

  const body = `
    ${h1(`Welcome to Stint Pro, ${name}!`)}
    ${p("Your subscription is active and all Pro features are now unlocked.")}
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;">
      ${[
        ["Pro Game Modes", "Survival, Draft, Double Down, Head-to-Head and Budget Picks"],
        ["AI Insights", "Personalised post-race analysis, pre-race tips and monthly wrap-ups"],
        ["Unlimited Leagues", "Create and join as many leagues as you want"],
        ["Stint Pro Community", "You've been added to the global Pro Community League"],
        ["Full Stats", "Pick accuracy, driver tendencies, streaks and more"],
      ].map(([feature, desc]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:13px;font-weight:700;color:#fff;">${feature}</span><br/>
            <span style="font-size:13px;color:rgba(255,255,255,0.5);">${desc}</span>
          </td>
        </tr>
      `).join("")}
    </table>
    ${cta("Go to My Dashboard", SITE_URL)}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: "Welcome to Stint Pro 🏁",
    html:    baseHtml(title, preview, body),
  });
}

/**
 * Sent after a new AI insight has been generated for a user.
 *
 * @param {{ email: string, username?: string, insightType: string, raceName?: string }} opts
 */
export async function sendInsightReadyEmail({ email, username, insightType, raceName }) {
  const resend = getResendClient();
  const name       = username ?? "Manager";
  const isPostRace = insightType === "post_race";
  const isPreRace  = insightType === "pre_race";
  const isMonthly  = insightType === "monthly";

  let subjectLine, preview, heading, subText;

  if (isPostRace && raceName) {
    subjectLine = `Your ${raceName} debrief is ready`;
    preview     = `See how your picks held up at ${raceName}.`;
    heading     = `Your ${raceName} race debrief`;
    subText     = `Your AI-powered post-race analysis for ${raceName} is ready. See how your picks stacked up and what to watch for next time.`;
  } else if (isPreRace && raceName) {
    subjectLine = `${raceName} preview — tips for your picks`;
    preview     = `Get ahead with your ${raceName} pre-race insight.`;
    heading     = `Your ${raceName} preview is ready`;
    subText     = `Your personalised pre-race briefing for ${raceName} is live. Get strategic advice before locks close.`;
  } else {
    subjectLine = "Your monthly performance wrap is ready";
    preview     = "See how your season is shaping up.";
    heading     = "Your monthly wrap-up is ready";
    subText     = "Your AI-powered monthly performance review is live. See your trends, streaks and what to focus on next month.";
  }

  const body = `
    ${h1(`Hey ${name} — ${heading}`)}
    ${p(subText)}
    ${cta("Read My Insight", `${SITE_URL}/profile?tab=insights`)}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: subjectLine,
    html:    baseHtml(subjectLine, preview, body),
  });
}

/**
 * Sent 7 days before subscription_end to remind the user to renew.
 *
 * @param {{ email: string, username?: string, renewalDate: string }} opts
 *   renewalDate: human-readable date string, e.g. "April 16, 2026"
 */
export async function sendProRenewalReminderEmail({ email, username, renewalDate }) {
  const resend = getResendClient();
  const name    = username ?? "Manager";
  const title   = "Your Stint Pro subscription renews soon";
  const preview = `Your Pro subscription renews on ${renewalDate} — no action needed.`;

  const body = `
    ${h1("Your Stint Pro renews soon")}
    ${p(`Hi ${name}, just a heads-up: your Stint Pro subscription renews on <strong style="color:#fff;">${renewalDate}</strong>.`)}
    ${p("No action needed — your subscription will continue automatically. If you'd like to make changes, visit the billing portal.")}
    ${cta("Manage Subscription", `${SITE_URL}/pro`)}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: `Your Stint Pro renews on ${renewalDate}`,
    html:    baseHtml(title, preview, body),
  });
}

/**
 * Sent when a subscription is cancelled (customer.subscription.deleted).
 *
 * @param {{ email: string, username?: string, endsAt?: string }} opts
 *   endsAt: human-readable end date, e.g. "April 30, 2026"
 */
export async function sendProCancellationEmail({ email, username, endsAt }) {
  const resend = getResendClient();
  const name  = username ?? "Manager";
  const title = "Your Stint Pro subscription has been cancelled";
  const endCopy = endsAt
    ? `Your Pro access continues until <strong style="color:#fff;">${endsAt}</strong>, after which your account will return to the free tier.`
    : "Your Pro access will end at the close of your current billing period.";

  const preview = `Sorry to see you go, ${name}. Your access remains active until ${endsAt ?? "your billing period ends"}.`;

  const body = `
    ${h1(`We're sorry to see you go, ${name}`)}
    ${p("Your Stint Pro subscription has been cancelled.")}
    ${p(endCopy)}
    ${p("You'll keep your pick history, league memberships and stats — we'll be here if you ever want to come back.", "color:rgba(255,255,255,0.5);")}
    ${cta("Reactivate Pro", `${SITE_URL}/pro`)}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: "Stint Pro cancelled — we'll miss you",
    html:    baseHtml(title, preview, body),
  });
}

/**
 * Welcome email — sent once when a new account is created.
 *
 * Goal: make the new user feel like they joined something alive. Lead with
 * Stint Community (the global league everyone is auto-enrolled in), then
 * three concrete first actions, then a soft pro mention.
 *
 * @param {{
 *   email: string,
 *   username?: string,
 *   favoriteTeam?: string,
 *   unsubscribeToken: string,
 * }} opts
 */
export async function sendWelcomeEmail({ email, username, favoriteTeam, unsubscribeToken }) {
  const resend = getResendClient();
  const name = username ?? "Manager";

  const teamLine = favoriteTeam
    ? `You're flying the ${favoriteTeam} flag — your picks will get that team colour treatment.`
    : "Pick a team in your profile and the app will paint your picks in their colours.";

  const subjectLine = `Welcome to Stint, ${name}`;
  const preview     = "You're in the Stint Community. Here's where to start.";

  const unsubscribeUrl = `${SITE_URL}/api/email/unsubscribe?token=${unsubscribeToken}&cat=all`;

  const body = `
    ${h1(`Welcome to Stint, ${name}`)}
    ${p("You're in. Your account is live and you've been auto-added to the Stint Community league — every other Stint user is in there, so you're already racing.")}
    ${p(teamLine)}

    <h2 style="margin:24px 0 12px;font-size:14px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.5);">First three things to do</h2>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;">
      ${[
        ["Make your race picks", "Lock in pole, winner, podium, fastest lap and a DNF for the next Grand Prix.", "Make picks"],
        ["Start a private league", "Invite friends with a 6-character code. Settings, scoring, and bragging rights are yours.", "Create league"],
        ["Read the latest brief", "AI-powered race-week storylines, free for everyone, refreshed each round.", "Read brief"],
      ].map(([title, desc, _cta]) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:14px;font-weight:800;color:#fff;letter-spacing:-0.01em;margin-bottom:3px;">${title}</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.55;">${desc}</div>
          </td>
        </tr>
      `).join("")}
    </table>

    ${cta("Open Stint", SITE_URL)}

    <p style="margin:28px 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">
      Want more — Pro game modes, AI race coach, unlimited leagues? <a href="${SITE_URL}/pro" style="color:#FFC247;text-decoration:none;">Have a look at Pro.</a>
    </p>
    <p style="margin:18px 0 0;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.6;">
      Don't want emails from Stint? <a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.5);text-decoration:underline;">Unsubscribe</a>.
    </p>
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: subjectLine,
    html:    baseHtml(subjectLine, preview, body),
    headers: {
      "List-Unsubscribe":      `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

/**
 * Pick reminder.
 *
 * Sent before each race lockout to users who haven't completed their picks.
 * Two windows (24h before, 3h before) × two variants (zero picks, incomplete).
 *
 * @param {{
 *   email: string,
 *   username?: string,
 *   raceName: string,
 *   raceCountry?: string,
 *   reminderWindow: '24h' | '3h',
 *   variant: 'zero' | 'incomplete',
 *   pickCount?: number,
 *   unsubscribeToken: string,
 * }} opts
 */
export async function sendPickReminderEmail({
  email, username, raceName, raceCountry,
  reminderWindow, variant, pickCount = 0, unsubscribeToken,
}) {
  const resend = getResendClient();
  const name = username ?? "Manager";

  const timingPhrase = reminderWindow === "3h"
    ? "in about 3 hours"
    : "in about 24 hours";

  const urgencyPrefix = reminderWindow === "3h" ? "Last chance — " : "";

  let subjectLine, preview, heading, subText;

  if (variant === "zero") {
    subjectLine = `${urgencyPrefix}Make your ${raceName} picks`;
    preview     = `Picks lock ${timingPhrase}. Don't miss it.`;
    heading     = `${raceName} picks lock ${timingPhrase}`;
    subText     = reminderWindow === "3h"
      ? `Heads up ${name} — picks for ${raceName}${raceCountry ? ` (${raceCountry})` : ""} lock in about 3 hours. Lock yours in before qualifying starts.`
      : `Just a reminder ${name} — picks for ${raceName}${raceCountry ? ` (${raceCountry})` : ""} lock ${timingPhrase}. Get your 6 picks in before qualifying.`;
  } else {
    const remaining = Math.max(0, 6 - pickCount);
    subjectLine = `${urgencyPrefix}Finish your ${raceName} picks (${pickCount}/6)`;
    preview     = `You've made ${pickCount} of 6 picks. ${remaining} to go.`;
    heading     = `Finish your ${raceName} picks`;
    subText     = `Hey ${name} — you've made ${pickCount} of 6 picks for ${raceName}${raceCountry ? ` (${raceCountry})` : ""}. Picks lock ${timingPhrase}, so finish the remaining ${remaining} to be in the running.`;
  }

  const unsubscribeUrl = `${SITE_URL}/api/email/unsubscribe?token=${unsubscribeToken}&cat=pick_reminders`;

  const body = `
    ${h1(heading)}
    ${p(subText)}
    ${cta("Make My Picks", `${SITE_URL}/picks`)}
    <p style="margin:28px 0 0;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.6;">
      Don't want these? <a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.5);text-decoration:underline;">Unsubscribe from pick reminders</a>.
    </p>
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: subjectLine,
    html:    baseHtml(subjectLine, preview, body),
    headers: {
      "List-Unsubscribe":      `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
