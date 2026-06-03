import "server-only";
import { Resend } from "resend";

let resendClient = null;

const FROM = process.env.RESEND_FROM_EMAIL || "Stint <noreply@stint-web.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.stint-web.com";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY || process.env.Resend_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

// ─── Template helpers ──────────────────────────────────────────────────────────
//
// Stint emails are a true extension of the website:
//   • Dark navy #06101B page background (matches BG_BASE in dark mode)
//   • Card surface #0d1f2e (matches PANEL_BG)
//   • 1px hairline borders rgba(255,255,255,0.07) (matches HAIRLINE)
//   • 16px radius card, soft shadow, 32px padding
//   • Sora 900 display + Manrope body via Google Fonts with system fallback
//   • Brand orange #FF6A1A used as a single sharp accent (one place per email)
//   • Real Stint logo image in the header (no text wordmark fallback)
//   • 120px tall hero photo strip below the header, above the body
//
// Voice: human. Short sentences. Contractions OK. Specifics over generics.
// One CTA per email. Sign off as Stint.

const SORA   = "'Sora','Helvetica Neue',system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif";
const MANROPE = "'Manrope','Helvetica Neue',system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif";
const FONTS_LINK = `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />`;

// Photo strip used between the header hairline and the body.
function heroPhoto(src, alt = "") {
  return `<tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <img src="${src}" alt="${alt}" width="540" style="display:block;width:100%;height:120px;object-fit:cover;border:0;outline:none;" />
            </td>
          </tr>`;
}

function baseHtml(title, previewText, bodyHtml, options = {}) {
  const {
    pro = false,
    unsubscribeUrl = null,
    category = null,
    heroSrc = null,
    heroAlt = "",
  } = options;

  const proBadge = pro
    ? `<span style="display:inline-block;margin-left:10px;padding:3px 9px;background:#f59e0b;color:#1a0f00;font-family:${MANROPE};font-size:9px;font-weight:900;letter-spacing:0.14em;border-radius:999px;vertical-align:middle;">PRO</span>`
    : "";

  const footerReason = pro
    ? "You're receiving this because you have a Stint Pro subscription."
    : "You're receiving this because you have a Stint account.";

  const unsubLink = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.5);text-decoration:underline;">${category ? `Unsubscribe from ${category}` : "Unsubscribe"}</a> &nbsp;·&nbsp; `
    : "";

  const manageLink = pro
    ? `<a href="${SITE_URL}/pro" style="color:#FF6A1A;text-decoration:none;">Manage subscription</a> &nbsp;·&nbsp; `
    : "";

  const heroRow = heroSrc ? heroPhoto(heroSrc, heroAlt) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  ${FONTS_LINK}
</head>
<body style="margin:0;padding:0;background:#06101B;font-family:${MANROPE};color:rgba(255,255,255,0.92);-webkit-font-smoothing:antialiased;">
  <span style="display:none;font-size:1px;color:#06101B;max-height:0;overflow:hidden;">${previewText}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#06101B;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;background:#0d1f2e;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);box-shadow:0 4px 24px rgba(0,0,0,0.32);">
          <!-- Header -->
          <tr>
            <td style="padding:26px 32px;border-bottom:1px solid rgba(255,255,255,0.07);">
              <img src="${SITE_URL}/images/logo-primary.png" alt="Stint" height="30" style="display:inline-block;height:30px;width:auto;vertical-align:middle;" />${proBadge}
            </td>
          </tr>
          ${heroRow}
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 28px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 26px;border-top:1px solid rgba(255,255,255,0.07);">
              <p style="margin:0;font-family:${MANROPE};font-size:11px;color:rgba(255,255,255,0.4);line-height:1.7;">
                ${footerReason}<br />
                ${manageLink}${unsubLink}<a href="${SITE_URL}/privacy" style="color:rgba(255,255,255,0.4);text-decoration:none;">Privacy</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-family:${MANROPE};font-size:10px;font-weight:700;color:rgba(255,255,255,0.22);letter-spacing:0.16em;text-transform:uppercase;">
          Stint · F1 Predictions · 2026
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function h1(text) {
  return `<h1 style="margin:0 0 14px;font-family:${SORA};font-size:30px;font-weight:900;letter-spacing:-0.04em;color:#fff;line-height:1.1;">${text}</h1>`;
}

function eyebrow(text, color = "#FF6A1A") {
  return `<div style="margin:0 0 14px;font-family:${MANROPE};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${color};">${text}</div>`;
}

function p(text, style = "") {
  return `<p style="margin:0 0 16px;font-family:${MANROPE};font-size:15px;color:rgba(255,255,255,0.72);line-height:1.7;${style}">${text}</p>`;
}

function cta(text, href) {
  return `<a href="${href}" style="display:inline-block;margin-top:6px;padding:13px 26px;background:#FF6A1A;color:#fff;font-family:${MANROPE};font-size:13px;font-weight:800;letter-spacing:-0.005em;border-radius:999px;text-decoration:none;">${text}</a>`;
}

// Hero metric tile — used for the score on the results email and similar.
function metricTile({ label, value, sub = "" }) {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0 24px;background:rgba(255,106,26,0.05);border:1px solid rgba(255,106,26,0.16);border-radius:12px;">
    <tr><td style="padding:22px 22px 18px;">
      <div style="font-family:${MANROPE};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,194,71,0.85);">${label}</div>
      <div style="margin-top:4px;font-family:${SORA};font-size:48px;font-weight:900;letter-spacing:-0.05em;color:#FFC247;line-height:1;">${value}</div>
      ${sub ? `<div style="margin-top:10px;font-family:${MANROPE};font-size:13px;color:rgba(255,255,255,0.55);line-height:1.55;">${sub}</div>` : ""}
    </td></tr>
  </table>`;
}

// Currency formatter — keeps things short and human.
function formatMoney(amount, currency) {
  const num = Number(amount);
  const safe = Number.isFinite(num) ? num.toFixed(2) : "0.00";
  const code = (currency || "usd").toLowerCase();
  const symbols = { usd: "$", eur: "€", gbp: "£", cad: "$", aud: "$" };
  const symbol = symbols[code] || "";
  if (symbol) return `${symbol}${safe}`;
  return `${safe} ${code.toUpperCase()}`;
}

// ─── Email senders ─────────────────────────────────────────────────────────────

/**
 * Welcome email — sent once when a new account is created.
 *
 * Variant: community angle. Leads with the global Stint Community league
 * count so the user knows they're already racing against everyone else.
 *
 * @param {{
 *   email: string,
 *   username?: string,
 *   favoriteTeam?: string,
 *   communityMemberCount?: number,
 *   unsubscribeToken: string,
 * }} opts
 */
export async function sendWelcomeEmail({
  email,
  username,
  favoriteTeam,
  communityMemberCount,
  unsubscribeToken,
}) {
  const resend = getResendClient();
  const name = username ?? "there";
  const count = Number.isFinite(Number(communityMemberCount))
    ? Number(communityMemberCount).toLocaleString("en-US")
    : null;

  const subjectLine = `You're on the grid, ${name}`;
  const preview = count
    ? `You just joined Stint Community — a global league of ${count} F1 fans.`
    : "You just joined Stint Community — a global league of F1 fans.";

  const unsubscribeUrl = `${SITE_URL}/api/email/unsubscribe?token=${unsubscribeToken}&cat=all`;

  const eyebrowText = count
    ? `You're on the grid · ${count} managers`
    : "You're on the grid";

  const heroLine = count
    ? `You just joined <strong style="color:#fff;font-weight:700;">Stint Community</strong> — a global league of <strong style="color:#fff;font-weight:700;">${count} F1 fans</strong>. No invites, no waiting list. You're already racing against every Stint user, every round, all season.`
    : `You just joined <strong style="color:#fff;font-weight:700;">Stint Community</strong> — a global league of F1 fans. No invites, no waiting list. You're already racing against every Stint user, every round, all season.`;

  const teamLine = favoriteTeam
    ? `<p style="margin:0 0 22px;font-family:${MANROPE};font-size:15px;color:rgba(255,255,255,0.72);line-height:1.7;">Flying the <strong style="color:#fff;font-weight:700;">${favoriteTeam}</strong> flag — nice. Your picks will get the team-colour treatment.</p>`
    : `<p style="margin:0 0 22px;font-family:${MANROPE};font-size:15px;color:rgba(255,255,255,0.72);line-height:1.7;">Pick a favourite team in your profile and the app will paint your picks in their colours.</p>`;

  const communityTile = `<table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 26px;background:rgba(255,106,26,0.05);border:1px solid rgba(255,106,26,0.16);border-radius:12px;">
    <tr><td style="padding:18px 20px;">
      <div style="font-family:${MANROPE};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,194,71,0.85);">Stint Community League</div>
      <div style="margin-top:6px;font-family:${SORA};font-size:22px;font-weight:900;letter-spacing:-0.03em;color:#fff;line-height:1.15;">Everyone's in. Every race.</div>
      <div style="margin-top:8px;font-family:${MANROPE};font-size:13px;color:rgba(255,255,255,0.6);line-height:1.55;">Auto-enrolled. Permanent. Climb the table one Sunday at a time.</div>
    </td></tr>
  </table>`;

  const body = `
    ${eyebrow(eyebrowText)}
    ${h1(`Lights out, ${name}.`)}
    ${p(heroLine)}
    ${teamLine}
    ${communityTile}
    ${p("The board resets at every lock. Get your picks in for the next round and you're on the scoreboard by Sunday evening.", "margin-bottom:18px;")}
    ${cta("See the leaderboard", SITE_URL)}
    <p style="margin:28px 0 0;font-family:${MANROPE};font-size:12px;color:rgba(255,255,255,0.42);line-height:1.6;">
      Want a smaller fight? Start a private league with a 6-character invite code. Pro unlocks unlimited leagues, an AI race coach and five extra game modes — <a href="${SITE_URL}/pro" style="color:#FFC247;text-decoration:none;">peek at Pro</a>.
    </p>
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: subjectLine,
    html:    baseHtml(subjectLine, preview, body, {
      unsubscribeUrl,
      category: "all Stint emails",
      heroSrc: `${SITE_URL}/images/Grid%20lights.png`,
      heroAlt: "Grid lights",
    }),
    headers: {
      "List-Unsubscribe":      `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

/**
 * Pick reminder.
 *
 * Variant: urgency-led. Headline is a countdown ("Picks lock in 3 hours").
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
  email,
  username,
  raceName,
  raceCountry,
  reminderWindow,
  variant,
  pickCount = 0,
  unsubscribeToken,
}) {
  const resend = getResendClient();
  const name = username ?? "there";

  const is3h = reminderWindow === "3h";
  const windowLabel = is3h ? "3 hours" : "24 hours";
  const tMinus = is3h ? "T-minus 3:00:00" : "T-minus 24:00:00";

  const heading = `Picks lock in ${windowLabel}.`;
  const where = raceCountry ? `${raceName} (${raceCountry})` : raceName;

  let subjectLine, preview, bodyCopy, picksTile;

  if (variant === "zero") {
    subjectLine = is3h
      ? `${raceName} picks lock in 3 hours`
      : `${raceName} picks lock in 24 hours`;
    preview = `${raceName} qualifying starts soon. Lock your picks before they fall.`;
    bodyCopy = is3h
      ? `Heads up ${name} — ${where} qualifying starts soon. You have zero picks in. Lights, then locks.`
      : `Heads up ${name} — ${where} qualifying is a day away. Get your 6 picks in before lockout.`;
    picksTile = `<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;background:rgba(255,106,26,0.06);border:1px solid rgba(255,106,26,0.22);border-radius:12px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-family:${MANROPE};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,194,71,0.85);">Picks made</div>
        <div style="margin-top:4px;font-family:${SORA};font-size:32px;font-weight:900;letter-spacing:-0.04em;color:#fff;line-height:1;">0<span style="color:rgba(255,255,255,0.35);">/6</span></div>
      </td></tr>
    </table>`;
  } else {
    const remaining = Math.max(0, 6 - pickCount);
    subjectLine = is3h
      ? `Finish your ${raceName} picks — 3 hours left (${pickCount}/6)`
      : `Finish your ${raceName} picks (${pickCount}/6)`;
    preview = `You've made ${pickCount} of 6 picks. ${remaining} to go before lockout.`;
    bodyCopy = `Hey ${name} — you've got ${pickCount} of 6 picks in for ${where}. ${remaining} more before locks close.`;
    picksTile = `<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;background:rgba(255,106,26,0.06);border:1px solid rgba(255,106,26,0.22);border-radius:12px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-family:${MANROPE};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,194,71,0.85);">Picks made</div>
        <div style="margin-top:4px;font-family:${SORA};font-size:32px;font-weight:900;letter-spacing:-0.04em;color:#fff;line-height:1;">${pickCount}<span style="color:rgba(255,255,255,0.35);">/6</span></div>
      </td></tr>
    </table>`;
  }

  const unsubscribeUrl = `${SITE_URL}/api/email/unsubscribe?token=${unsubscribeToken}&cat=pick_reminders`;

  const body = `
    ${eyebrow(`${tMinus} · ${raceName}`)}
    <h1 style="margin:0 0 14px;font-family:${SORA};font-size:38px;font-weight:900;letter-spacing:-0.04em;color:#fff;line-height:1;">${heading}</h1>
    ${p(bodyCopy, "margin-bottom:22px;")}
    ${picksTile}
    ${cta("Make my picks", `${SITE_URL}/picks`)}
    <p style="margin:22px 0 0;font-family:${MANROPE};font-size:12px;color:rgba(255,255,255,0.42);line-height:1.6;">After lights out it's too late. Don't miss this round.</p>
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: subjectLine,
    html:    baseHtml(subjectLine, preview, body, {
      unsubscribeUrl,
      category: "pick reminders",
      heroSrc: `${SITE_URL}/images/Grid%20lights.png`,
      heroAlt: "Grid lights",
    }),
    headers: {
      "List-Unsubscribe":      `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

/**
 * Results published email.
 *
 * Variant: league-standing delta is the hero data point.
 * The score becomes a supporting metric underneath the rank change.
 *
 * @param {{
 *   email: string,
 *   username?: string,
 *   raceName: string,
 *   raceCountry?: string,
 *   raceRound: number,
 *   score: number,
 *   bestPick?: { type: string, value: string, points: number } | null,
 *   leagueRankDelta?: number,
 *   currentLeagueRank?: number,
 *   leagueName?: string,
 *   unsubscribeToken: string,
 * }} opts
 */
export async function sendResultsPublishedEmail({
  email,
  username,
  raceName,
  raceCountry,
  raceRound,
  score,
  bestPick,
  leagueRankDelta,
  currentLeagueRank,
  leagueName,
  unsubscribeToken,
}) {
  const resend = getResendClient();
  const name = username ?? "there";

  const delta = Number.isFinite(Number(leagueRankDelta)) ? Number(leagueRankDelta) : null;
  const rank = Number.isFinite(Number(currentLeagueRank)) ? Number(currentLeagueRank) : null;
  const league = leagueName || "your league";

  // Headline keyed off the rank change.
  let heading, accentColor, deltaPill, subjectLine, preview;
  if (delta === null) {
    heading = `${raceName} — your round is in.`;
    accentColor = null;
    deltaPill = "";
    subjectLine = `${raceName}: ${score} pts`;
    preview = `Results are in. ${score} pts this round.`;
  } else if (delta > 0) {
    heading = `You moved up <span style="color:#FF6A1A;">${delta} place${delta === 1 ? "" : "s"}</span> this weekend.`;
    accentColor = "up";
    deltaPill = `<div style="display:inline-block;padding:6px 12px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:999px;font-family:${MANROPE};font-size:12px;font-weight:800;letter-spacing:-0.005em;color:#86efac;">&uarr; ${delta}</div>`;
    subjectLine = `Up ${delta} place${delta === 1 ? "" : "s"} at ${raceName}`;
    preview = `You moved up ${delta} place${delta === 1 ? "" : "s"} this weekend. Now ranked #${rank ?? "?"} in ${league}.`;
  } else if (delta < 0) {
    const drop = Math.abs(delta);
    heading = `You dropped <span style="color:#FF6A1A;">${drop} place${drop === 1 ? "" : "s"}</span> this weekend.`;
    accentColor = "down";
    deltaPill = `<div style="display:inline-block;padding:6px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:999px;font-family:${MANROPE};font-size:12px;font-weight:800;letter-spacing:-0.005em;color:rgba(255,255,255,0.65);">&darr; ${drop}</div>`;
    subjectLine = `Down ${drop} at ${raceName} — here's the round`;
    preview = `You dropped ${drop} place${drop === 1 ? "" : "s"} this weekend. Now ranked #${rank ?? "?"} in ${league}.`;
  } else {
    heading = `You held steady this weekend.`;
    accentColor = "flat";
    deltaPill = `<div style="display:inline-block;padding:6px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:999px;font-family:${MANROPE};font-size:12px;font-weight:800;letter-spacing:-0.005em;color:rgba(255,255,255,0.65);">&mdash; 0</div>`;
    subjectLine = `${raceName}: rank held steady`;
    preview = `You held steady at ${raceName}. Still ranked #${rank ?? "?"} in ${league}.`;
  }

  const subline = rank !== null
    ? `Now ranked <strong style="color:#fff;font-weight:700;">#${rank}</strong> in <strong style="color:#fff;font-weight:700;">${league}</strong> after ${raceName}.`
    : `Standings, league rank and full breakdown are updated for ${raceName}.`;

  // Rank-change tile (only when we have delta + rank context).
  const rankTile = delta !== null && rank !== null
    ? (() => {
        const wasRank = delta > 0 ? rank + delta : rank - Math.abs(delta);
        return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0 18px;background:rgba(255,106,26,0.06);border:1px solid rgba(255,106,26,0.18);border-radius:14px;">
          <tr><td style="padding:22px 24px;">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="left" style="vertical-align:middle;">
                  <div style="font-family:${MANROPE};font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,194,71,0.85);">Was &rarr; Now</div>
                  <div style="margin-top:4px;font-family:${SORA};font-size:24px;font-weight:900;letter-spacing:-0.04em;color:rgba(255,255,255,0.45);line-height:1.05;">
                    #${wasRank} <span style="color:rgba(255,255,255,0.3);">&rarr;</span> <span style="color:#fff;">#${rank}</span>
                  </div>
                </td>
                <td align="right" style="vertical-align:middle;">${deltaPill}</td>
              </tr>
            </table>
          </td></tr>
        </table>`;
      })()
    : "";

  // Score row + best-pick row (small, supporting evidence under the rank).
  const supportingRow = `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 26px;border-collapse:separate;border-spacing:0;">
    <tr>
      <td width="50%" style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px 0 0 12px;border-right:0;">
        <div style="font-family:${MANROPE};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Round score</div>
        <div style="margin-top:4px;font-family:${SORA};font-size:24px;font-weight:900;letter-spacing:-0.04em;color:#fff;line-height:1.05;">${score}<span style="font-family:${MANROPE};font-size:12px;font-weight:700;letter-spacing:0.04em;color:rgba(255,255,255,0.5);margin-left:4px;">pts</span></div>
      </td>
      <td width="50%" style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:0 12px 12px 0;">
        <div style="font-family:${MANROPE};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Top pick</div>
        <div style="margin-top:4px;font-family:${SORA};font-size:14px;font-weight:900;letter-spacing:-0.02em;color:#fff;line-height:1.15;">${bestPick && bestPick.points > 0
          ? `${bestPick.value} · ${bestPick.type.replace(/_/g, " ")} <span style="color:#FF6A1A;">+${bestPick.points}</span>`
          : `<span style="color:rgba(255,255,255,0.5);">No points this round</span>`}</div>
      </td>
    </tr>
  </table>`;

  const closer = delta !== null && delta > 0
    ? `Nice climb, ${name}. Momentum's on your side heading into Round ${raceRound + 1}.`
    : delta !== null && delta < 0
    ? `Rough one, ${name}. Reset and go again next round.`
    : delta === 0
    ? `Held the line, ${name}. Next round's the chance to push.`
    : `Here's how the weekend shook out, ${name}.`;

  const unsubscribeUrl = `${SITE_URL}/api/email/unsubscribe?token=${unsubscribeToken}&cat=results_published`;

  const body = `
    ${eyebrow(`Round ${raceRound}${raceCountry ? ` · ${raceCountry}` : ""} · ${league}`)}
    <h1 style="margin:0 0 14px;font-family:${SORA};font-size:30px;font-weight:900;letter-spacing:-0.04em;color:#fff;line-height:1.05;">${heading}</h1>
    ${p(subline, "margin-bottom:6px;")}
    ${p(closer, "margin-bottom:6px;")}
    ${rankTile}
    ${supportingRow}
    ${cta("View my breakdown", `${SITE_URL}/picks`)}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: subjectLine,
    html:    baseHtml(subjectLine, preview, body, {
      unsubscribeUrl,
      category: "results emails",
      heroSrc: `${SITE_URL}/images/Rear%20close%20up.png`,
      heroAlt: "Race over",
    }),
    headers: {
      "List-Unsubscribe":      `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

/**
 * Insight ready email.
 *
 * Variant: coach voice. Calm, personal note like a coach left a sticky on
 * your desk. The `headlineLine` is a real line pulled from the generated
 * insight and rendered as a pullquote.
 *
 * @param {{
 *   email: string,
 *   username?: string,
 *   insightType: 'post_race' | 'pre_race' | 'monthly',
 *   raceName?: string,
 *   headlineLine?: string,
 *   unsubscribeToken?: string,
 * }} opts
 */
export async function sendInsightReadyEmail({
  email,
  username,
  insightType,
  raceName,
  headlineLine,
  unsubscribeToken,
}) {
  const resend = getResendClient();
  const name = username ?? "there";
  const isPostRace = insightType === "post_race";
  const isPreRace  = insightType === "pre_race";

  let subjectLine, preview, heading, opener;

  if (isPostRace && raceName) {
    subjectLine = `Your ${raceName} debrief is ready`;
    preview     = `A short read on what changed your ${raceName} weekend.`;
    heading     = `Here's what changed your ${raceName} weekend.`;
    opener      = `${name} — I pulled the three calls that explain your round, and one to think about before the next race.`;
  } else if (isPreRace && raceName) {
    subjectLine = `Before ${raceName} — a quick read on your picks`;
    preview     = `A short pre-race note on your ${raceName} picks.`;
    heading     = `Before ${raceName} — a quick read on your picks.`;
    opener      = `${name} — a few things I'd look at in your card before locks close.`;
  } else {
    subjectLine = `Your monthly read is ready`;
    preview     = `A short read on how your season's shaping up.`;
    heading     = `Your monthly read is ready.`;
    opener      = `${name} — here's what your month tells me. Trends, streaks, and one shift worth making.`;
  }

  const quoteBlock = headlineLine
    ? `<table cellpadding="0" cellspacing="0" style="width:100%;margin:18px 0 24px;background:rgba(96,165,250,0.05);border-left:3px solid #60A5FA;border-radius:8px;">
        <tr><td style="padding:18px 22px;">
          <p style="margin:0;font-family:${MANROPE};font-size:15px;font-style:italic;color:rgba(255,255,255,0.78);line-height:1.65;">&ldquo;${headlineLine}&rdquo;</p>
        </td></tr>
      </table>`
    : "";

  const unsubscribeUrl = unsubscribeToken
    ? `${SITE_URL}/api/email/unsubscribe?token=${unsubscribeToken}&cat=insight_ready`
    : null;

  const body = `
    ${eyebrow("A note from your race coach", "#60A5FA")}
    ${h1(heading)}
    ${p(opener, "color:rgba(255,255,255,0.78);")}
    ${quoteBlock}
    ${cta("Read it", `${SITE_URL}/profile?tab=insights`)}
    <p style="margin:28px 0 0;font-family:${MANROPE};font-size:13px;color:rgba(255,255,255,0.5);line-height:1.7;font-style:italic;">&mdash; Your Stint AI coach</p>
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: subjectLine,
    html:    baseHtml(subjectLine, preview, body, {
      pro: true,
      unsubscribeUrl,
      category: unsubscribeUrl ? "insight emails" : null,
      heroSrc: `${SITE_URL}/images/header-insight.png`,
      heroAlt: "Stint Insight",
    }),
    ...(unsubscribeUrl
      ? {
          headers: {
            "List-Unsubscribe":      `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  });
}

/**
 * Pro welcome email.
 *
 * Variant: unlocked features list. Tight numbered roster with an explicit
 * line confirming the user has been added to the Pro Community League.
 * Sent immediately when a checkout.session.completed event fires.
 *
 * @param {{ email: string, username?: string }} opts
 */
export async function sendProWelcomeEmail({ email, username }) {
  const resend = getResendClient();
  const name = username ?? "there";

  const subjectLine = `Welcome to Stint Pro, ${name}`;
  const preview     = "Your Pro subscription is live. Here's what you just unlocked.";

  const features = [
    ["Pro game modes",        "Survival, Draft, Double Down, Head-to-Head and Budget"],
    ["AI Coach + Debriefs",   "Pre-race tips, post-race debriefs, monthly wraps"],
    ["Unlimited leagues",     "Create and join as many as you want"],
    ["Full stats",            "Pick accuracy, driver tendencies, streaks"],
  ];

  const featureRows = features
    .map(([title, desc], i) => {
      const isLast = i === features.length - 1;
      const border = isLast ? "" : "border-bottom:1px solid rgba(255,255,255,0.07);";
      return `<tr>
        <td width="32" style="padding:14px 12px 14px 0;${border}vertical-align:top;">
          <span style="font-family:${SORA};font-weight:900;font-size:12px;color:rgba(255,255,255,0.32);">0${i + 1}</span>
        </td>
        <td style="padding:14px 0;${border}">
          <div style="font-family:${MANROPE};font-size:14px;font-weight:700;color:#fff;letter-spacing:-0.01em;">${title}</div>
          <div style="font-family:${MANROPE};font-size:13px;color:rgba(255,255,255,0.55);margin-top:2px;line-height:1.55;">${desc}</div>
        </td>
      </tr>`;
    })
    .join("");

  const featureTable = `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;border-top:1px solid rgba(255,255,255,0.07);">
    ${featureRows}
  </table>`;

  const communityCallout = `<table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 26px;background:rgba(255,106,26,0.05);border:1px solid rgba(255,106,26,0.18);border-radius:12px;">
    <tr><td style="padding:18px 20px;">
      <div style="font-family:${MANROPE};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,194,71,0.85);">Pro Community League</div>
      <div style="margin-top:6px;font-family:${SORA};font-size:18px;font-weight:900;letter-spacing:-0.03em;color:#fff;line-height:1.2;">You're in the Stint Pro Community.</div>
      <div style="margin-top:8px;font-family:${MANROPE};font-size:13px;color:rgba(255,255,255,0.6);line-height:1.55;">A smaller, sharper league of paying members. You've been added automatically.</div>
    </td></tr>
  </table>`;

  const body = `
    ${eyebrow("You're in. Pro is live.")}
    ${h1(`Welcome to Stint Pro, ${name}.`)}
    ${p("Your subscription is active. Here's what just unlocked.", "margin-bottom:18px;")}
    ${featureTable}
    ${communityCallout}
    ${cta("Open my dashboard", SITE_URL)}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: subjectLine,
    html:    baseHtml(subjectLine, preview, body, {
      pro: true,
      heroSrc: `${SITE_URL}/images/Hero-Main.png`,
      heroAlt: "Stint Pro",
    }),
  });
}

/**
 * Pro receipt email.
 *
 * Sent AFTER a successful renewal payment (not a before-the-fact reminder).
 * Short, factual receipt with amount, billing period, and next billing date.
 *
 * @param {{
 *   email: string,
 *   username?: string,
 *   amount: number,
 *   currency?: string,
 *   billingPeriodLabel?: string,
 *   nextBillingDate?: string,
 *   invoiceUrl?: string,
 * }} opts
 */
export async function sendProReceiptEmail({
  email,
  username,
  amount,
  currency = "usd",
  billingPeriodLabel,
  nextBillingDate,
  invoiceUrl,
}) {
  const resend = getResendClient();
  const name = username ?? "there";
  const money = formatMoney(amount, currency);

  const subjectLine = `Stint Pro — payment received (${money})`;
  const preview     = `Receipt for your Stint Pro renewal. ${money}${billingPeriodLabel ? ` · ${billingPeriodLabel}` : ""}.`;

  const rows = [
    ["Amount", money],
    billingPeriodLabel ? ["Billing period", billingPeriodLabel] : null,
    nextBillingDate ? ["Next billing date", nextBillingDate] : null,
  ].filter(Boolean);

  const receiptRows = rows
    .map(([label, value], i) => {
      const isLast = i === rows.length - 1;
      const border = isLast ? "" : "border-bottom:1px solid rgba(255,255,255,0.07);";
      return `<tr>
        <td style="padding:14px 0;${border}font-family:${MANROPE};font-size:13px;color:rgba(255,255,255,0.55);">${label}</td>
        <td align="right" style="padding:14px 0;${border}font-family:${MANROPE};font-size:14px;font-weight:700;color:#fff;letter-spacing:-0.01em;">${value}</td>
      </tr>`;
    })
    .join("");

  const receiptTable = `<table cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0 22px;border-top:1px solid rgba(255,255,255,0.07);">
    ${receiptRows}
  </table>`;

  const invoiceLink = invoiceUrl
    ? `<p style="margin:22px 0 0;font-family:${MANROPE};font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;"><a href="${invoiceUrl}" style="color:#FF6A1A;text-decoration:none;border-bottom:1px solid rgba(255,106,26,0.4);padding-bottom:2px;">View invoice &rarr;</a></p>`
    : "";

  const body = `
    ${eyebrow("Subscription · Receipt")}
    ${h1("Stint Pro — payment received.")}
    ${p(`Thanks ${name}. Your Stint Pro renewal went through. Here's the receipt for your records.`)}
    ${receiptTable}
    ${p("Nothing to do. Your Pro access continues without interruption.", "color:rgba(255,255,255,0.55);font-size:13px;margin-bottom:0;")}
    ${invoiceLink}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: subjectLine,
    html:    baseHtml(subjectLine, preview, body, {
      pro: true,
      heroSrc: `${SITE_URL}/images/Track.png`,
      heroAlt: "Track",
    }),
  });
}

/**
 * Pro cancellation email.
 *
 * Variant: feedback ask. Brief, dignified. Single text-link to a feedback
 * form. No reactivate-CTA.
 *
 * @param {{
 *   email: string,
 *   username?: string,
 *   endsAt?: string,
 *   feedbackUrl?: string,
 * }} opts
 */
export async function sendProCancellationEmail({
  email,
  username,
  endsAt,
  feedbackUrl,
}) {
  const resend = getResendClient();
  const name = username ?? "there";
  const endLabel = endsAt || "the end of your current billing period";
  const formUrl = feedbackUrl || `${SITE_URL}/support?reason=pro-cancel`;

  const subjectLine = "Your Stint Pro is cancelled";
  const preview     = `Access stays active until ${endLabel}. We won't charge you again.`;

  const feedbackTile = `<table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 22px;background:rgba(255,106,26,0.04);border:1px solid rgba(255,106,26,0.14);border-radius:12px;">
    <tr><td style="padding:20px 22px;">
      <div style="font-family:${MANROPE};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,194,71,0.85);">One question</div>
      <div style="margin-top:8px;font-family:${SORA};font-size:20px;font-weight:800;letter-spacing:-0.03em;color:#fff;line-height:1.3;">What didn't work?</div>
      <div style="margin-top:14px;">
        <a href="${formUrl}" style="font-family:${MANROPE};font-size:14px;font-weight:800;color:#FF6A1A;text-decoration:none;letter-spacing:-0.005em;border-bottom:1px solid rgba(255,106,26,0.4);padding-bottom:2px;">Tell us why &rarr;</a>
      </div>
    </td></tr>
  </table>`;

  const body = `
    ${eyebrow("Subscription · Cancelled", "rgba(255,255,255,0.5)")}
    ${h1("Your Stint Pro is cancelled.")}
    ${p(`Hi ${name} — your access stays active until <strong style="color:#fff;font-weight:700;">${endLabel}</strong>. We won't charge you again. Nothing else to do.`)}
    ${p("If you've got 30 seconds — we'd like to know what didn't work. One question, no follow-ups.")}
    ${feedbackTile}
    <p style="margin:0;font-family:${MANROPE};font-size:12px;color:rgba(255,255,255,0.4);line-height:1.7;">Thanks for racing with Stint.</p>
  `;

  return resend.emails.send({
    from:    FROM,
    to:      email,
    subject: subjectLine,
    html:    baseHtml(subjectLine, preview, body, {
      pro: true,
      heroSrc: `${SITE_URL}/images/Rear%20close%20up.png`,
      heroAlt: "",
    }),
  });
}
