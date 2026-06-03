// Tally Sheet — engineer's notebook / paddock clipboard email concept.
//
// Visual lane: manila/bone paper, hairline rules, monospaced-feeling tabular
// numerals (Manrope w/ font-variant-numeric: tabular-nums), and a single
// orange pip near the wordmark as the only chromatic event. The numbers are
// the hero. Everything else is deliberately quiet — a result sheet, not a
// marketing surface.

const SITE_FALLBACK = "https://www.stint-web.com";
const LOGO_SRC = "https://www.stint-web.com/images/logo-primary.png";

// Palette
const PAPER = "#EFE9DB";         // Bone — the sheet itself
const PAPER_EDGE = "#E6DFCD";    // Slightly darker bone for the outer canvas
const INK = "#0E1620";           // Dark navy ink
const INK_MUTED = "#5A6470";     // Slate-warm
const INK_FAINT = "#8A8675";     // Pencil grey, for hairline labels
const RULE = "rgba(14,22,32,0.12)";   // Hairline — pencil ruled
const RULE_SOFT = "rgba(14,22,32,0.06)";
const ACCENT = "#FF6A1A";        // Pit-lane orange (used twice, max)

const SORA = "'Sora', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MANROPE = "'Manrope', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const NUM = "font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1,'lnum' 1;";

export const meta = {
  name: "Tally Sheet",
  description:
    "Manila/bone paddock clipboard. Hairline rules, tabular numerals, a single orange pip — data over decoration.",
  promotionsRisk: "low",
};

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pad2(n) {
  return String(Math.max(0, Number(n) || 0)).padStart(2, "0");
}

function prettyPickType(type) {
  if (!type) return "Pick";
  return String(type)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Shared shell ────────────────────────────────────────────────────────────

function shell({ title, preview, bodyHtml, siteUrl, unsubscribeUrl, category }) {
  const site = siteUrl || SITE_FALLBACK;
  const unsubLink = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:${INK_MUTED};text-decoration:underline;">${category ? `Unsubscribe from ${escapeHtml(category)}` : "Unsubscribe"}</a> &nbsp;·&nbsp; `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:${PAPER_EDGE};font-family:${MANROPE};color:${INK};-webkit-font-smoothing:antialiased;">
  <span style="display:none;font-size:1px;color:${PAPER_EDGE};max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preview)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER_EDGE};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${PAPER};border:1px solid ${RULE};">
          <!-- Header strip: logo left, sheet meta right, orange pip -->
          <tr>
            <td style="padding:22px 28px 18px;border-bottom:1px solid ${RULE};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle" style="width:60%;">
                    <img src="${LOGO_SRC}" alt="Stint" height="28" style="display:block;height:28px;width:auto;border:0;outline:none;text-decoration:none;" />
                  </td>
                  <td align="right" valign="middle" style="width:40%;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
                      <tr>
                        <td valign="middle" style="padding-right:10px;font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${INK_FAINT};${NUM}">
                          Sheet · ${new Date().getUTCFullYear()}
                        </td>
                        <td valign="middle" style="width:8px;">
                          <div style="width:8px;height:8px;border-radius:8px;background:${ACCENT};line-height:8px;font-size:0;">&nbsp;</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sub-strip: column headings, like a result sheet caption -->
          <tr>
            <td style="padding:10px 28px;border-bottom:1px solid ${RULE_SOFT};background:${PAPER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:${MANROPE};font-size:10px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:${INK_FAINT};">
                    Stint &nbsp;/&nbsp; Race Engineer's Sheet
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 28px 32px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer hairline + meta -->
          <tr>
            <td style="padding:18px 28px 26px;border-top:1px solid ${RULE};">
              <p style="margin:0 0 8px;font-family:${MANROPE};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${INK_FAINT};">
                Signed &mdash; Stint Race Control
              </p>
              <p style="margin:0;font-family:${MANROPE};font-size:12px;font-weight:400;line-height:1.7;color:${INK_MUTED};">
                You're receiving this because you have a Stint account.<br />
                ${unsubLink}<a href="${site}/privacy" style="color:${INK_MUTED};text-decoration:underline;">Privacy</a>
              </p>
              <p style="margin:12px 0 0;font-family:${MANROPE};font-size:10px;font-weight:400;line-height:1.6;color:${INK_FAINT};">
                Stint is an independent prediction platform and is not affiliated with Formula 1, the FIA or any F1 team.
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

// ─── Reusable pieces ─────────────────────────────────────────────────────────

function fieldLabel(text) {
  return `<div style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.20em;text-transform:uppercase;color:${INK_FAINT};margin:0 0 6px;">${escapeHtml(text)}</div>`;
}

function ruledRow({ label, value, valueBold = true }) {
  return `
    <tr>
      <td style="padding:11px 0;border-bottom:1px dashed ${RULE};font-family:${MANROPE};font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${INK_FAINT};width:42%;vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td align="right" style="padding:11px 0;border-bottom:1px dashed ${RULE};font-family:${MANROPE};font-size:14px;font-weight:${valueBold ? 700 : 500};color:${INK};${NUM}vertical-align:top;">
        ${value}
      </td>
    </tr>
  `;
}

function ctaLink(text, href) {
  // Engineer's-notebook CTA: dark navy ink button with a subtle paper shadow.
  // No fill. Sora 800, tight.
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;">
      <tr>
        <td style="background:${INK};border-radius:2px;">
          <a href="${href}" style="display:inline-block;padding:14px 22px;font-family:${SORA};font-size:13px;font-weight:800;letter-spacing:0.02em;text-transform:uppercase;color:${PAPER};text-decoration:none;">
            ${escapeHtml(text)} &rarr;
          </a>
        </td>
      </tr>
    </table>
  `;
}

// ─── Welcome ────────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const site = siteUrl || SITE_FALLBACK;
  const name = username || "Manager";
  const teamLine = favoriteTeam
    ? `Filed under <strong style="font-weight:700;color:${INK};">${escapeHtml(favoriteTeam)}</strong> — your picks will carry the team's livery.`
    : `No team filed yet. Pick one in your profile and we'll colour your picks accordingly.`;

  const today = new Date();
  const datestamp = `${today.getUTCFullYear()}-${pad2(today.getUTCMonth() + 1)}-${pad2(today.getUTCDate())}`;

  const bodyHtml = `
    <!-- Sheet caption -->
    ${fieldLabel("New entry · Driver registration")}
    <h1 style="margin:0 0 4px;font-family:${SORA};font-size:36px;font-weight:800;letter-spacing:-0.035em;line-height:1.02;color:${INK};">
      Welcome, ${escapeHtml(name)}.
    </h1>
    <p style="margin:0 0 22px;font-family:${MANROPE};font-size:14px;font-weight:500;line-height:1.6;color:${INK_MUTED};">
      Your account is on the timing screen. You've been auto-entered into the Stint Community league — every other manager is in there, so you're already racing.
    </p>

    <!-- Driver card: hairline ruled facts -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;border-top:1px solid ${RULE};">
      ${ruledRow({ label: "Manager", value: escapeHtml(name) })}
      ${ruledRow({ label: "Team filed", value: favoriteTeam ? escapeHtml(favoriteTeam) : `<span style="color:${INK_FAINT};font-weight:500;">— unfiled —</span>` })}
      ${ruledRow({ label: "Entry date", value: datestamp })}
      ${ruledRow({ label: "Status", value: `<span style="color:${INK};font-weight:700;">Cleared to grid</span>` })}
    </table>

    <p style="margin:0 0 22px;font-family:${MANROPE};font-size:13px;font-weight:400;line-height:1.7;color:${INK_MUTED};">
      ${teamLine}
    </p>

    <!-- Checklist — engineer's pre-flight -->
    ${fieldLabel("Pre-race checklist")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border-top:1px solid ${RULE};">
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid ${RULE_SOFT};vertical-align:top;width:36px;">
          <div style="font-family:${MANROPE};font-size:11px;font-weight:700;letter-spacing:0.1em;color:${INK_FAINT};${NUM}">01</div>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid ${RULE_SOFT};vertical-align:top;">
          <div style="font-family:${SORA};font-size:15px;font-weight:800;letter-spacing:-0.02em;color:${INK};margin:0 0 2px;">File your race picks</div>
          <div style="font-family:${MANROPE};font-size:13px;font-weight:400;line-height:1.55;color:${INK_MUTED};">Lock in pole, winner, podium, fastest lap and a DNF before qualifying.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid ${RULE_SOFT};vertical-align:top;width:36px;">
          <div style="font-family:${MANROPE};font-size:11px;font-weight:700;letter-spacing:0.1em;color:${INK_FAINT};${NUM}">02</div>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid ${RULE_SOFT};vertical-align:top;">
          <div style="font-family:${SORA};font-size:15px;font-weight:800;letter-spacing:-0.02em;color:${INK};margin:0 0 2px;">Open a private league</div>
          <div style="font-family:${MANROPE};font-size:13px;font-weight:400;line-height:1.55;color:${INK_MUTED};">Invite friends with a 6-character code. Settings, scoring, bragging rights — yours.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid ${RULE_SOFT};vertical-align:top;width:36px;">
          <div style="font-family:${MANROPE};font-size:11px;font-weight:700;letter-spacing:0.1em;color:${INK_FAINT};${NUM}">03</div>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid ${RULE_SOFT};vertical-align:top;">
          <div style="font-family:${SORA};font-size:15px;font-weight:800;letter-spacing:-0.02em;color:${INK};margin:0 0 2px;">Read the round brief</div>
          <div style="font-family:${MANROPE};font-size:13px;font-weight:400;line-height:1.55;color:${INK_MUTED};">AI-written race-week storylines, free for everyone, refreshed each round.</div>
        </td>
      </tr>
    </table>

    ${ctaLink("Open Stint", site)}

    <p style="margin:26px 0 0;font-family:${MANROPE};font-size:12px;font-weight:400;line-height:1.65;color:${INK_FAINT};">
      Stint Pro adds extra game modes, an AI race coach and unlimited leagues — <a href="${site}/pro" style="color:${ACCENT};text-decoration:none;font-weight:700;">see the spec sheet</a>.
    </p>
  `;

  return shell({
    title: `Welcome to Stint, ${escapeHtml(name)}`,
    preview: "Driver registered. You're on the timing screen — here's your pre-flight.",
    bodyHtml,
    siteUrl: site,
    unsubscribeUrl,
    category: "all Stint emails",
  });
}

// ─── Results ────────────────────────────────────────────────────────────────

export function resultsHtml({
  username,
  raceName,
  raceCountry,
  raceRound,
  score,
  bestPick,
  unsubscribeUrl,
  siteUrl,
}) {
  const site = siteUrl || SITE_FALLBACK;
  const name = username || "Manager";
  const safeScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  const isZero = safeScore <= 0;

  // The score is the hero. Sora 900, gigantic, tabular nums, dark ink.
  // When zero, we still render a numeric hero (00) and re-label below — the
  // tally sheet doesn't flinch at a zero, it records it.
  const heroNumber = isZero ? "00" : pad2(safeScore);
  const heroLabel = isZero ? "Points recorded" : "Points awarded";

  const bestPickBlock = !isZero && bestPick && bestPick.points > 0
    ? `
      <!-- Notable pick — single hairline row, engineer's annotation -->
      ${fieldLabel("Notable result")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border-top:1px solid ${RULE};border-bottom:1px solid ${RULE};">
        <tr>
          <td style="padding:16px 0;vertical-align:top;">
            <div style="font-family:${SORA};font-size:18px;font-weight:800;letter-spacing:-0.025em;color:${INK};line-height:1.15;margin:0 0 4px;">
              ${escapeHtml(bestPick.value)}
            </div>
            <div style="font-family:${MANROPE};font-size:12px;font-weight:500;letter-spacing:0.04em;color:${INK_MUTED};">
              ${escapeHtml(prettyPickType(bestPick.type))}
            </div>
          </td>
          <td align="right" valign="top" style="padding:16px 0;width:90px;">
            <div style="font-family:${SORA};font-size:24px;font-weight:800;letter-spacing:-0.03em;color:${INK};${NUM}line-height:1;">
              +${Number(bestPick.points) || 0}
            </div>
            <div style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${INK_FAINT};margin-top:4px;">
              pts
            </div>
          </td>
        </tr>
      </table>
    `
    : isZero
      ? `
      <!-- Zero-points note: engineer is matter-of-fact, not cheerful -->
      ${fieldLabel("Engineer's note")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border-top:1px solid ${RULE};border-bottom:1px solid ${RULE};">
        <tr>
          <td style="padding:16px 0;">
            <p style="margin:0;font-family:${MANROPE};font-size:13px;font-weight:400;line-height:1.7;color:${INK_MUTED};">
              No points logged this round. The breakdown sheet shows exactly where each pick landed — useful prep for the next entry.
            </p>
          </td>
        </tr>
      </table>
    `
      : "";

  const roundLine = `Round ${pad2(raceRound)}${raceCountry ? ` · ${escapeHtml(raceCountry)}` : ""}`;

  const bodyHtml = `
    <!-- Round caption -->
    <div style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_FAINT};margin:0 0 8px;${NUM}">
      ${roundLine} &nbsp;·&nbsp; Results posted
    </div>

    <!-- Round headline -->
    <h1 style="margin:0 0 22px;font-family:${SORA};font-size:34px;font-weight:800;letter-spacing:-0.035em;line-height:1.02;color:${INK};">
      ${escapeHtml(raceName)}
    </h1>

    <!-- Score table: label left, monstrous number right. The whole point. -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border-top:1px solid ${INK};border-bottom:1px solid ${INK};">
      <tr>
        <td style="padding:18px 0;vertical-align:middle;width:50%;">
          <div style="font-family:${MANROPE};font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_FAINT};margin:0 0 4px;">
            ${heroLabel}
          </div>
          <div style="font-family:${MANROPE};font-size:13px;font-weight:500;color:${INK_MUTED};">
            Manager &mdash; ${escapeHtml(name)}
          </div>
        </td>
        <td align="right" valign="middle" style="padding:14px 0 12px;">
          <div style="font-family:${SORA};font-size:88px;font-weight:900;letter-spacing:-0.05em;color:${INK};${NUM}line-height:0.9;">${heroNumber}</div>
          <div style="font-family:${MANROPE};font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_FAINT};margin-top:6px;">
            ${isZero ? "zero" : "points"}
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:22px 0 22px;font-family:${MANROPE};font-size:13px;font-weight:400;line-height:1.7;color:${INK_MUTED};">
      Official results for ${escapeHtml(raceName)} have been signed off. Your standings, league rank and full pick-by-pick breakdown are updated and waiting on your sheet.
    </p>

    ${bestPickBlock}

    <!-- Reading the sheet: micro-aside about where to look next -->
    ${fieldLabel("Filed in your dashboard")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 8px;border-top:1px solid ${RULE};">
      ${ruledRow({ label: "League standings", value: `<span style="color:${INK};">Updated</span>` })}
      ${ruledRow({ label: "Pick breakdown", value: `<span style="color:${INK};">Per-pick scoring</span>` })}
      ${ruledRow({ label: "Season trend", value: `<span style="color:${INK};">Recalculated</span>` })}
    </table>

    ${ctaLink("Open the breakdown", `${site}/picks`)}

    <p style="margin:26px 0 0;font-family:${MANROPE};font-size:12px;font-weight:400;line-height:1.65;color:${INK_FAINT};">
      Prefer not to receive a sheet each round? ${unsubscribeUrl
        ? `<a href="${unsubscribeUrl}" style="color:${INK_MUTED};text-decoration:underline;">Turn off results emails</a>.`
        : `Adjust your preferences in your profile.`}
    </p>
  `;

  const subject = isZero
    ? `${raceName}: results filed`
    : `${raceName}: ${safeScore} pts on the sheet`;

  const preview = isZero
    ? `Round ${pad2(raceRound)} results signed off. Read the breakdown.`
    : `Round ${pad2(raceRound)} · ${safeScore} pts recorded. Full breakdown inside.`;

  return shell({
    title: subject,
    preview,
    bodyHtml,
    siteUrl: site,
    unsubscribeUrl,
    category: "results emails",
  });
}
