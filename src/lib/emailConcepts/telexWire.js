// Stint email concept — "Telex / Wire dispatch"
//
// A printed-newsroom take: warm newsprint cream, a thin chequered kerb stripe
// under the masthead, a Sora 900 banner headline set TIGHT, and Manrope body
// laid out like a wire dispatch with a clear lead and a sub-deck.
//
// Every email reads like a small front page from the Stint Wire desk —
// editorial, dated, datelined, signed off.
//
// Module contract (see brief):
//   export const meta = { name, description, promotionsRisk }
//   export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl })
//   export function resultsHtml({ username, raceName, raceCountry, raceRound, score, bestPick, unsubscribeUrl, siteUrl })

export const meta = {
  name: "Telex / Wire",
  description:
    "A warm-cream newsroom dispatch — chequered kerb stripe, Sora 900 banner, Manrope wire copy.",
  // Editorial framing, no buttons-only layout, no big discount CTAs, hard
  // brand orange used in only two places (kerb stripe + a single lede rule).
  // Reads like a newsletter, not a promo blast — safest end of the axis.
  promotionsRisk: "low",
};

// ─── Palette (locked, do not extend) ────────────────────────────────────────
const PAPER = "#F0E9DA";       // Parchment — page background
const NEWSPRINT = "#F5EFE6";   // Eggshell — masthead + body sheet
const INK = "#0E1620";         // Body ink (dark navy, not pure black)
const INK_MUTED = "#5A6470";   // Slate-warm — captions, datelines
const INK_SOFT = "#8A8576";    // Aged-ink — fine print, footer
const RULE = "#D9CFBC";        // Hairline rule (paper-tinted)
const RULE_SOFT = "#E6DFCD";   // Lighter hairline
const ORANGE = "#FF6A1A";      // Brand accent — used SPARINGLY
const AMBER = "#f59e0b";       // Pro amber (reserved; not used here)

// ─── Font stacks ────────────────────────────────────────────────────────────
const SORA = `'Sora', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;
const MANROPE = `'Manrope', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;
const LOGO_URL = "https://www.stint-web.com/images/logo-primary.png";

// ─── Shared helpers ─────────────────────────────────────────────────────────

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateline(date = new Date()) {
  // "MONDAY · 02 JUNE 2026" — wire-service voice.
  const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = months[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  return `${days[date.getUTCDay()]} &middot; ${d} ${m} ${y}`;
}

// Chequered kerb stripe — 20 cells, alternating orange + ink, 8px tall.
// Built as a single-row table so every email client renders it solid.
function kerbStripe() {
  const cells = [];
  for (let i = 0; i < 20; i++) {
    const fill = i % 2 === 0 ? ORANGE : INK;
    cells.push(
      `<td width="5%" height="8" style="background:${fill};line-height:8px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>`
    );
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;table-layout:fixed;">
    <tr>${cells.join("")}</tr>
  </table>`;
}

function masthead() {
  // Logo on the LEFT, "STINT WIRE" wordmark on the right, eyebrow + date.
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:28px 32px 18px;vertical-align:middle;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
          <tr>
            <td align="left" valign="middle" style="vertical-align:middle;">
              <img src="${LOGO_URL}" alt="Stint" height="34" style="display:inline-block;height:34px;width:auto;vertical-align:middle;border:0;outline:none;text-decoration:none;" />
            </td>
            <td align="right" valign="middle" style="vertical-align:middle;font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_MUTED};">
              The Stint Wire
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 14px;">
        <div style="height:2px;background:${INK};line-height:2px;font-size:0;">&nbsp;</div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 16px;">
        ${kerbStripe()}
      </td>
    </tr>
  </table>`;
}

function dateline(extra = "") {
  const date = formatDateline(new Date());
  const right = extra
    ? `<td align="right" style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${INK_MUTED};">${extra}</td>`
    : `<td align="right" style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${INK_MUTED};">Edition No. 01</td>`;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:0 32px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
          <tr>
            <td align="left" style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${INK_MUTED};">${date}</td>
            ${right}
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 18px;">
        <div style="height:1px;background:${RULE};line-height:1px;font-size:0;">&nbsp;</div>
      </td>
    </tr>
  </table>`;
}

function banner(headline, kicker) {
  // Sora 900 banner — tight tracking, tight leading. The kicker is a small
  // uppercased label that sits ABOVE the headline like a story slug.
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:6px 32px 4px;">
        <div style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:${ORANGE};margin-bottom:10px;">${kicker}</div>
        <h1 style="margin:0;padding:0;font-family:${SORA};font-size:40px;font-weight:900;letter-spacing:-0.04em;line-height:1.02;color:${INK};">
          ${headline}
        </h1>
      </td>
    </tr>
  </table>`;
}

function lede(text) {
  // Drop-cap-flavoured first paragraph — bigger size, Manrope 500.
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:18px 32px 4px;">
        <p style="margin:0;font-family:${MANROPE};font-size:16px;font-weight:500;line-height:1.55;color:${INK};letter-spacing:-0.005em;">
          ${text}
        </p>
      </td>
    </tr>
  </table>`;
}

function paragraph(text) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:12px 32px 0;">
        <p style="margin:0;font-family:${MANROPE};font-size:14px;font-weight:400;line-height:1.65;color:${INK};">
          ${text}
        </p>
      </td>
    </tr>
  </table>`;
}

function sectionRule() {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:22px 32px 14px;">
        <div style="height:1px;background:${RULE_SOFT};line-height:1px;font-size:0;">&nbsp;</div>
      </td>
    </tr>
  </table>`;
}

function sectionHeading(text) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:6px 32px 8px;">
        <div style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_MUTED};">
          ${text}
        </div>
      </td>
    </tr>
  </table>`;
}

function ctaButton(label, href) {
  // Single, restrained CTA. Solid ink on cream — orange is reserved for the
  // kerb stripe and the kicker, so the button is dark to hold its weight.
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:22px 32px 10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="background:${INK};border-radius:2px;">
              <a href="${href}" style="display:inline-block;padding:14px 24px;font-family:${SORA};font-size:13px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:${NEWSPRINT};text-decoration:none;border-radius:2px;">
                ${label} &nbsp;&rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function signOff() {
  // Wire services sign off. This is the editorial flourish that ties the
  // dispatch metaphor together.
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:30px 32px 4px;">
        <div style="font-family:${SORA};font-size:11px;font-weight:800;letter-spacing:0.32em;text-transform:uppercase;color:${INK_MUTED};text-align:center;">
          &mdash;&nbsp;&nbsp; 30 &nbsp;&nbsp;&mdash;
        </div>
      </td>
    </tr>
  </table>`;
}

function footer(unsubscribeUrl, siteUrl, footnote) {
  const privacy = `${siteUrl.replace(/\/$/, "")}/privacy`;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:24px 32px 10px;">
        <div style="height:1px;background:${RULE};line-height:1px;font-size:0;">&nbsp;</div>
      </td>
    </tr>
    <tr>
      <td style="padding:6px 32px 28px;">
        <p style="margin:0 0 8px;font-family:${MANROPE};font-size:11px;font-weight:500;line-height:1.7;color:${INK_SOFT};">
          ${footnote}
        </p>
        <p style="margin:0;font-family:${MANROPE};font-size:11px;font-weight:500;line-height:1.7;color:${INK_SOFT};">
          <a href="${unsubscribeUrl}" style="color:${INK_MUTED};text-decoration:underline;">Unsubscribe</a>
          &nbsp;&middot;&nbsp;
          <a href="${privacy}" style="color:${INK_MUTED};text-decoration:underline;">Privacy</a>
          &nbsp;&middot;&nbsp;
          <span style="color:${INK_SOFT};">The Stint Wire, filed from the paddock.</span>
        </p>
      </td>
    </tr>
  </table>`;
}

function shell({ title, preview, inner }) {
  // Outer page is the slightly darker parchment; the article sheet is the
  // eggshell newsprint. The 1px ink frame is the broadsheet edge.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Manrope:wght@400;500;600;700&display=swap');
    body, table, td, p, a, h1, h2, div { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse !important; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    a { text-decoration:none; }
  </style>
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${MANROPE};">
  <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">${escapeHtml(preview)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${NEWSPRINT};border:1px solid ${INK};border-collapse:collapse;">
          ${inner}
        </table>
        <div style="font-family:${MANROPE};font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:${INK_SOFT};padding:14px 0 0;">
          stint &middot; pit-lane dispatches
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Welcome ────────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const name = escapeHtml(username || "Manager");
  const team = favoriteTeam ? escapeHtml(favoriteTeam) : null;
  const site = siteUrl || "https://www.stint-web.com";
  const safeSite = site.replace(/\/$/, "");
  const safeUnsub = unsubscribeUrl || `${safeSite}/`;

  const teamLine = team
    ? `Profile filed under <strong style="color:${INK};font-weight:700;">${team}</strong>. Picks from this desk will be coloured accordingly.`
    : `Set a team in your profile and every pick you file will carry its livery.`;

  const headline = `Welcome to the<br/>paddock, ${name}.`;
  const preview = `Filed: your account is live and the Stint Community is already racing.`;

  const inner = `
    ${masthead()}
    ${dateline("Subscriber Edition")}
    ${banner(headline, "Dispatch &middot; New Account")}

    ${lede(
      `You're in. Your Stint account is active and you've been wired straight into the <strong style="color:${INK};font-weight:700;">Stint Community league</strong> &mdash; every other manager on the grid is in there too, so you're already on the timing screen.`
    )}

    ${paragraph(teamLine)}

    ${sectionRule()}
    ${sectionHeading("Three stories worth chasing first")}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
      <tr>
        <td style="padding:6px 32px 0;">

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;border-top:1px solid ${RULE_SOFT};">
            <tr>
              <td style="padding:14px 0 14px;width:34px;vertical-align:top;font-family:${SORA};font-size:18px;font-weight:900;letter-spacing:-0.03em;color:${INK};">01</td>
              <td style="padding:14px 0 14px;vertical-align:top;">
                <div style="font-family:${SORA};font-size:15px;font-weight:800;letter-spacing:-0.02em;color:${INK};line-height:1.25;">File your race picks</div>
                <div style="font-family:${MANROPE};font-size:13px;font-weight:400;line-height:1.6;color:${INK_MUTED};margin-top:3px;">Pole, winner, podium, fastest lap and a DNF. Six picks, one deadline.</div>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;border-top:1px solid ${RULE_SOFT};">
            <tr>
              <td style="padding:14px 0 14px;width:34px;vertical-align:top;font-family:${SORA};font-size:18px;font-weight:900;letter-spacing:-0.03em;color:${INK};">02</td>
              <td style="padding:14px 0 14px;vertical-align:top;">
                <div style="font-family:${SORA};font-size:15px;font-weight:800;letter-spacing:-0.02em;color:${INK};line-height:1.25;">Open a private league</div>
                <div style="font-family:${MANROPE};font-size:13px;font-weight:400;line-height:1.6;color:${INK_MUTED};margin-top:3px;">A six-character code, your friends, your rules. Settings and scoring are yours to set.</div>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;border-top:1px solid ${RULE_SOFT};border-bottom:1px solid ${RULE_SOFT};">
            <tr>
              <td style="padding:14px 0 14px;width:34px;vertical-align:top;font-family:${SORA};font-size:18px;font-weight:900;letter-spacing:-0.03em;color:${INK};">03</td>
              <td style="padding:14px 0 14px;vertical-align:top;">
                <div style="font-family:${SORA};font-size:15px;font-weight:800;letter-spacing:-0.02em;color:${INK};line-height:1.25;">Read this week's brief</div>
                <div style="font-family:${MANROPE};font-size:13px;font-weight:400;line-height:1.6;color:${INK_MUTED};margin-top:3px;">Race-week storylines from the AI desk. Free for everyone, refreshed every round.</div>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>

    ${ctaButton("Open Stint", safeSite)}

    ${paragraph(
      `When you're ready for more &mdash; survival, draft, head-to-head, the AI race coach &mdash; the <a href="${safeSite}/pro" style="color:${INK};text-decoration:underline;font-weight:700;">Pro desk</a> keeps a seat open.`
    )}

    ${signOff()}

    ${footer(
      safeUnsub,
      site,
      `Filed to you because you opened a Stint account. Story tips, complaints and corrections to the editor at <a href="mailto:support@stint-web.com" style="color:${INK_MUTED};text-decoration:underline;">support@stint-web.com</a>.`
    )}
  `;

  return shell({
    title: `Welcome to Stint, ${name}`,
    preview,
    inner,
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
  const name = escapeHtml(username || "Manager");
  const race = escapeHtml(raceName || "the Grand Prix");
  const country = raceCountry ? escapeHtml(raceCountry) : null;
  const round = Number.isFinite(raceRound) ? raceRound : null;
  const safeScore = Number.isFinite(score) ? Number(score) : 0;
  const site = siteUrl || "https://www.stint-web.com";
  const safeSite = site.replace(/\/$/, "");
  const safeUnsub = unsubscribeUrl || `${safeSite}/`;

  const hasScore = safeScore > 0;
  const hasBestPick = !!(bestPick && bestPick.points > 0);

  const kicker = `Round ${round ?? "&mdash;"}${country ? ` &middot; ${country}` : ""} &middot; Results filed`;
  const headline = hasScore
    ? `${race}:<br/>the official tally.`
    : `${race}:<br/>the file is closed.`;

  const preview = hasScore
    ? `Filed: ${safeScore} pts at ${race}. Read your breakdown.`
    : `Filed: ${race} results are in. See where you finished.`;

  // Score block — the lede of the story. Sora 900, slab-like proportion.
  const scoreBlock = hasScore
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
      <tr>
        <td style="padding:22px 32px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;border-top:2px solid ${INK};border-bottom:1px solid ${RULE};">
            <tr>
              <td style="padding:18px 0;vertical-align:bottom;">
                <span style="font-family:${SORA};font-size:72px;font-weight:900;letter-spacing:-0.05em;line-height:0.95;color:${INK};">${safeScore}</span>
                <span style="font-family:${MANROPE};font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_MUTED};margin-left:10px;">pts filed</span>
              </td>
              <td align="right" style="padding:18px 0;vertical-align:bottom;">
                <div style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_MUTED};">Standings</div>
                <div style="font-family:${SORA};font-size:13px;font-weight:800;letter-spacing:-0.01em;color:${INK};margin-top:4px;">Updated &middot; leagues live</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`
    : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
      <tr>
        <td style="padding:22px 32px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;border-top:2px solid ${INK};border-bottom:1px solid ${RULE};">
            <tr>
              <td style="padding:18px 0;vertical-align:bottom;">
                <div style="font-family:${SORA};font-size:30px;font-weight:900;letter-spacing:-0.035em;line-height:1.05;color:${INK};">A blank round.</div>
                <div style="font-family:${MANROPE};font-size:13px;font-weight:500;line-height:1.55;color:${INK_MUTED};margin-top:8px;">No points filed this weekend. The grid resets next round.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const bestPickType = hasBestPick
    ? escapeHtml(String(bestPick.type || "").replace(/_/g, " "))
    : "";
  const bestPickValue = hasBestPick ? escapeHtml(bestPick.value || "") : "";
  const bestPickPoints = hasBestPick ? Number(bestPick.points) : 0;

  const bestPickBlock = hasBestPick
    ? `
    ${sectionHeading("Story of the round &middot; Top pick")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
      <tr>
        <td style="padding:0 32px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;border:1px solid ${INK};">
            <tr>
              <td style="padding:18px 20px;vertical-align:middle;">
                <div style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_MUTED};">${bestPickType}</div>
                <div style="font-family:${SORA};font-size:22px;font-weight:900;letter-spacing:-0.03em;color:${INK};margin-top:4px;line-height:1.1;">${bestPickValue}</div>
              </td>
              <td align="right" style="padding:18px 20px;vertical-align:middle;border-left:1px solid ${RULE};width:110px;">
                <div style="font-family:${SORA};font-size:30px;font-weight:900;letter-spacing:-0.04em;color:${INK};line-height:1;">+${bestPickPoints}</div>
                <div style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_MUTED};margin-top:4px;">points</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`
    : (hasScore
        ? ""
        : `
    ${sectionHeading("Editor's note")}
    ${paragraph(
      `The board went the other way this weekend. Nothing landed &mdash; happens to every desk eventually. Next round opens shortly; we'll wire the pick lists as soon as the grid is set.`
    )}`);

  const standfirst = hasScore
    ? `${name}, official results from <strong style="color:${INK};font-weight:700;">${race}</strong> are now on the wire. Standings, league rank and the full pick-by-pick breakdown have all been updated.`
    : `${name}, the official file from <strong style="color:${INK};font-weight:700;">${race}</strong> is closed. Standings and league tables are updated &mdash; the next round is already on the desk.`;

  const inner = `
    ${masthead()}
    ${dateline(round ? `Round ${round} &middot; Results` : "Race Results")}
    ${banner(headline, kicker)}

    ${scoreBlock}

    ${lede(standfirst)}

    ${bestPickBlock}

    ${ctaButton("Read the full breakdown", `${safeSite}/picks`)}

    ${signOff()}

    ${footer(
      safeUnsub,
      site,
      `Filed to you because results were published for ${race}. Prefer to skip race-result dispatches? Use the unsubscribe link below &mdash; we'll keep filing the rest.`
    )}
  `;

  return shell({
    title: hasScore ? `${race}: ${safeScore} pts` : `${race} results filed`,
    preview,
    inner,
  });
}
