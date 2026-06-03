// ─── Carbon Pearl ─────────────────────────────────────────────────────────────
//
// The most refined, "premium product" expression of Stint's email surface.
//
//   • Eggshell paper background with a whisper of warm-gray vertical gradient,
//     produced by stacking a fixed eggshell <body> behind a 600px content
//     table whose first/last rows step the surface tone down a hair. That
//     wins us a usable approximation of a soft top→bottom gradient inside
//     email clients that strip CSS gradients.
//   • Sora 800 headlines, tight tracking. Manrope for body and small caps.
//   • A single, modest, filled-orange button. The accent appears in exactly
//     two places per email — one button and one small mark — never more.
//   • Hairlines (1px #E4DCC9) do all structural work. No shadows, no cards,
//     no decoration. The restraint is the design.
//
// Module contract — see other emailConcepts/* files.

const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com" />' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />' +
  '<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />';

const SORA  = "'Sora', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const BODY  = "'Manrope', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

// Palette — eggshell paper, navy ink, slate-warm muted, sparingly used orange.
const PAGE_BG       = "#F5EFE6"; // Eggshell — outer body
const SURFACE_TOP   = "#F7F2EA"; // Slightly lighter top band (gradient illusion)
const SURFACE       = "#F3ECDF"; // Mid surface
const SURFACE_BTM   = "#EDE5D4"; // Slightly deeper bottom band
const INK           = "#0E1620"; // Body ink — very dark navy, not pure black
const INK_SOFT      = "#1B2532"; // Slightly lifted ink for body copy
const MUTED         = "#5A6470"; // Slate-warm muted
const HAIRLINE      = "#E4DCC9"; // Warm hairline borders
const ACCENT        = "#FF6A1A"; // Brand orange — used twice, max
const ACCENT_INK    = "#FFFFFF"; // Button label

const LOGO_URL = "https://www.stint-web.com/images/logo-primary.png";

// ─── Primitives ───────────────────────────────────────────────────────────────

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell({ title, previewText, contentHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(title)}</title>
  ${FONT_LINK}
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${BODY};color:${INK};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <span style="display:none!important;visibility:hidden;opacity:0;font-size:1px;color:${PAGE_BG};max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(previewText)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG};padding:48px 16px;">
    <tr>
      <td align="center">
        <!--
          Gradient illusion: three stacked surface bands — top lighter,
          middle base, bottom slightly deeper. Reads as a soft vertical
          gradient on clients that won't render CSS gradients.
        -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${SURFACE};border:1px solid ${HAIRLINE};border-collapse:separate;">
          <tr>
            <td style="background:${SURFACE_TOP};padding:0;line-height:0;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background:${SURFACE_TOP};padding:40px 56px 32px;text-align:center;border-bottom:1px solid ${HAIRLINE};">
              <img src="${LOGO_URL}" alt="Stint" height="34" style="display:inline-block;height:34px;width:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td style="background:${SURFACE};padding:56px 56px 48px;">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="background:${SURFACE_BTM};padding:0;line-height:0;font-size:0;">&nbsp;</td>
          </tr>
        </table>

        <!-- Footer sits on the page background, outside the paper — keeps the surface clean. -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
          <tr>
            <td style="padding:24px 8px 8px;text-align:center;font-family:${BODY};font-size:11px;line-height:1.7;color:${MUTED};letter-spacing:0.02em;">
              ${contentFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function contentFooter() {
  // Footer text is injected per-email via a placeholder so we can pass
  // unsubscribeUrl + siteUrl in cleanly.
  return "__FOOTER__";
}

function renderFooter({ unsubscribeUrl, siteUrl }) {
  const unsubHref  = escapeHtml(unsubscribeUrl);
  const privacyHref = `${escapeHtml(siteUrl)}/privacy`;
  return `
    <div style="font-family:${SORA};font-size:10px;font-weight:800;letter-spacing:0.22em;color:${MUTED};text-transform:uppercase;margin-bottom:10px;">STINT &middot; F1 PREDICTIONS</div>
    <div style="font-family:${BODY};font-size:11px;color:${MUTED};line-height:1.75;">
      You're receiving this because you have a Stint account.<br/>
      <a href="${unsubHref}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>
      &nbsp;&middot;&nbsp;
      <a href="${privacyHref}" style="color:${MUTED};text-decoration:underline;">Privacy</a>
    </div>
    <div style="font-family:${BODY};font-size:10px;color:${MUTED};opacity:0.7;margin-top:14px;line-height:1.6;">
      Stint is an independent prediction platform and is not affiliated with Formula 1, the FIA, or any F1 team.
    </div>
  `;
}

// ─── Building blocks ──────────────────────────────────────────────────────────

function eyebrow(text) {
  return `<div style="font-family:${SORA};font-size:11px;font-weight:800;letter-spacing:0.24em;color:${MUTED};text-transform:uppercase;margin:0 0 18px;">${text}</div>`;
}

function headline(text) {
  return `<h1 style="margin:0 0 20px;font-family:${SORA};font-size:42px;line-height:1.04;font-weight:800;letter-spacing:-0.04em;color:${INK};">${text}</h1>`;
}

function lede(text) {
  return `<p style="margin:0 0 24px;font-family:${BODY};font-size:17px;line-height:1.6;font-weight:400;color:${INK_SOFT};letter-spacing:-0.005em;">${text}</p>`;
}

function body(text) {
  return `<p style="margin:0 0 18px;font-family:${BODY};font-size:15px;line-height:1.65;font-weight:400;color:${INK_SOFT};">${text}</p>`;
}

function rule() {
  return `<div style="height:1px;background:${HAIRLINE};margin:32px 0;line-height:0;font-size:0;">&nbsp;</div>`;
}

function button(label, href) {
  // Single, modest, filled orange. Bulletproof-ish: table-wrapped so Outlook
  // gives it the same shape as everywhere else. No pill, no shadow — just a
  // 4px radius rectangle. Restraint is the brief.
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
      <tr>
        <td style="background:${ACCENT};border-radius:4px;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;font-family:${SORA};font-size:13px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:${ACCENT_INK};text-decoration:none;border-radius:4px;">${label}</a>
        </td>
      </tr>
    </table>
  `;
}

function quietLink(label, href) {
  return `<a href="${escapeHtml(href)}" style="font-family:${BODY};font-size:14px;font-weight:600;color:${INK};text-decoration:none;border-bottom:1px solid ${INK};padding-bottom:1px;">${label}</a>`;
}

// A small typographic step row used in the welcome email — numeral on the
// left, label + sub on the right. Numerals are Sora 800 in the orange
// accent (one of the two permitted accent uses for the welcome email).
function stepRow(number, title, description, isLast) {
  const borderStyle = isLast ? "" : `border-bottom:1px solid ${HAIRLINE};`;
  return `
    <tr>
      <td style="padding:18px 0;${borderStyle}" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="56" valign="top" style="font-family:${SORA};font-size:22px;font-weight:800;letter-spacing:-0.04em;color:${ACCENT};line-height:1;padding-top:2px;">
              ${number}
            </td>
            <td valign="top">
              <div style="font-family:${SORA};font-size:16px;font-weight:800;letter-spacing:-0.02em;color:${INK};margin:0 0 4px;line-height:1.25;">${title}</div>
              <div style="font-family:${BODY};font-size:14px;font-weight:400;color:${MUTED};line-height:1.55;">${description}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// ─── Welcome email ────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const safeName  = escapeHtml(username || "Manager");
  const safeTeam  = favoriteTeam ? escapeHtml(favoriteTeam) : null;
  const safeSite  = escapeHtml(siteUrl);

  const teamLine = safeTeam
    ? `You're flying the <strong style="font-weight:700;color:${INK};">${safeTeam}</strong> flag — your picks will carry that team's colour through the app.`
    : `Pick a team in your profile and the app will paint your picks in their colours.`;

  const stepsTable = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 32px;border-top:1px solid ${HAIRLINE};">
      ${stepRow("01", "Make your race picks", "Pole, winner, podium, fastest lap, a DNF — six calls per Grand Prix.", false)}
      ${stepRow("02", "Start a private league", "Invite friends with a six-character code. Settings, scoring, and bragging rights are yours.", false)}
      ${stepRow("03", "Read this round's brief", "AI-written race-week storylines, refreshed every round. Free for everyone.", true)}
    </table>
  `;

  const content = `
    ${eyebrow("Welcome to Stint")}
    ${headline(`Welcome, ${safeName}.`)}
    ${lede("Your account is live, and you've been auto-added to the Stint Community league — every other Stint user is in there, so you're already racing.")}
    ${body(teamLine)}

    ${rule()}

    <div style="font-family:${SORA};font-size:11px;font-weight:800;letter-spacing:0.22em;color:${MUTED};text-transform:uppercase;margin:0 0 6px;">First three things</div>
    ${stepsTable}

    ${button("Open Stint", safeSite)}

    <p style="margin:32px 0 0;font-family:${BODY};font-size:13px;line-height:1.6;color:${MUTED};">
      Want more — Pro game modes, AI race coach, unlimited leagues?
      ${quietLink("Have a look at Pro", `${safeSite}/pro`)}.
    </p>
  `;

  const docTpl = shell({
    title: `Welcome to Stint, ${safeName}`,
    previewText: "You're in the Stint Community. Here's where to start.",
    contentHtml: content,
  });

  return docTpl.replace("__FOOTER__", renderFooter({ unsubscribeUrl, siteUrl }));
}

// ─── Results email ────────────────────────────────────────────────────────────

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
  const safeName    = escapeHtml(username || "Manager");
  const safeRace    = escapeHtml(raceName || "Round");
  const safeCountry = raceCountry ? escapeHtml(raceCountry) : null;
  const safeRound   = raceRound != null ? escapeHtml(String(raceRound)) : null;
  const safeSite    = escapeHtml(siteUrl);

  const eyebrowText = [
    safeRound ? `Round ${safeRound}` : null,
    safeCountry,
    "Results",
  ].filter(Boolean).join(" &middot; ");

  const hasScore = typeof score === "number" && score > 0;
  const safeScore = hasScore ? escapeHtml(String(score)) : "0";

  // Score block. The big number is INK (not orange) — the orange "PTS" label
  // is one of two permitted accent uses in this email. The number does the
  // talking; the colour just whispers brand.
  const scoreBlock = hasScore
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 28px;">
        <tr>
          <td valign="bottom" style="padding:0;">
            <span style="font-family:${SORA};font-size:96px;font-weight:900;letter-spacing:-0.06em;line-height:0.9;color:${INK};">${safeScore}</span>
            <span style="font-family:${SORA};font-size:14px;font-weight:800;letter-spacing:0.2em;color:${ACCENT};text-transform:uppercase;margin-left:10px;vertical-align:baseline;">PTS</span>
          </td>
        </tr>
      </table>
    `
    : `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 28px;">
        <tr>
          <td style="padding:0;">
            <div style="font-family:${SORA};font-size:32px;font-weight:800;letter-spacing:-0.03em;line-height:1.05;color:${INK};">No points this round.</div>
            <div style="font-family:${BODY};font-size:14px;font-weight:400;color:${MUTED};margin-top:8px;line-height:1.55;">It happens. Next round resets the slate.</div>
          </td>
        </tr>
      </table>
    `;

  // Top pick — only renders when there's something genuine to surface.
  // Hairline rule above, label + value + meta below. No card, no fill.
  const showBestPick = bestPick && bestPick.value && (bestPick.points || 0) > 0;
  const bestPickBlock = showBestPick
    ? `
      ${rule()}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td valign="top" style="padding:0;">
            <div style="font-family:${SORA};font-size:11px;font-weight:800;letter-spacing:0.22em;color:${MUTED};text-transform:uppercase;margin:0 0 10px;">Top pick</div>
            <div style="font-family:${SORA};font-size:24px;font-weight:800;letter-spacing:-0.03em;color:${INK};line-height:1.15;">${escapeHtml(bestPick.value)}</div>
            <div style="font-family:${BODY};font-size:13px;font-weight:500;color:${MUTED};margin-top:6px;letter-spacing:0.02em;">
              ${escapeHtml(String(bestPick.type || "").replace(/_/g, " "))} &middot; ${escapeHtml(String(bestPick.points))} pts
            </div>
          </td>
        </tr>
      </table>
    `
    : "";

  // Body copy — adapts to score state.
  const summaryCopy = hasScore
    ? `${safeName}, the official ${safeRace} results are in. Your standings, league rank and full breakdown are all updated.`
    : `${safeName}, results are in for ${safeRace}. Your standings and league rank are updated, and the full breakdown is waiting in your picks log.`;

  const content = `
    ${eyebrow(eyebrowText)}
    ${headline(safeRace)}

    ${scoreBlock}

    ${body(summaryCopy)}

    ${bestPickBlock}

    <div style="margin-top:32px;">
      ${button("View my breakdown", `${safeSite}/picks`)}
    </div>
  `;

  const subjectLine = hasScore
    ? `${raceName}: ${score} pts`
    : `${raceName} results are in`;
  const previewText = hasScore
    ? `You scored ${score} points. See your breakdown.`
    : `See where you finished this round.`;

  const docTpl = shell({
    title: subjectLine,
    previewText,
    contentHtml: content,
  });

  return docTpl.replace("__FOOTER__", renderFooter({ unsubscribeUrl, siteUrl }));
}

// ─── Concept metadata ─────────────────────────────────────────────────────────

export const meta = {
  name: "Carbon Pearl",
  description:
    "Eggshell paper, navy ink, hairline rules, and a single understated orange call-to-action — Stint's voice in its most refined, premium-product register.",
  // Light eggshell surface + transactional structure + minimal accent reads as
  // confirmation/receipt to inbox classifiers, not promotion. Honest read: low.
  promotionsRisk: "low",
};
