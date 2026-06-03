// Pressed Linen — editorial-luxury email concept for Stint.
//
// Lane brief: linen/bone background with a faint textured radial overlay
// (under 8% opacity, no image), a continuous 5px orange leading edge running
// the full vertical height down the left margin, Sora 800 headlines shifted
// right to give the edge room to breathe, Manrope body at 1.75 line-height,
// quiet underlined text-link CTAs (no buttons), and a logo that sits flush
// against the orange edge at the top-left.
//
// Tonal intent: "Stint takes its time." A long, considered read — the visual
// statement of an editorial that respects the reader.

const PALETTE = {
  bg:         "#EDE8DD",          // Linen
  page:       "#F3EEE5",          // Pearl (inner sheet)
  ink:        "#0E1620",          // Body ink — dark navy, never pure black
  inkSoft:    "#2A3340",
  muted:      "#5A6470",          // Slate-warm
  hairline:   "#D9D1C0",          // Warm hairline rule
  accent:     "#FF6A1A",          // Brand orange — used sparingly
  amber:      "#B97A2A",          // Editorial amber for the score figure
};

const FONT_LINK = `<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />`;

const SORA    = "'Sora', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MANROPE = "'Manrope', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const LOGO_SRC = "https://www.stint-web.com/images/logo-primary.png";

export const meta = {
  name:           "Pressed Linen",
  description:    "Editorial-luxury on a warm linen sheet — a single orange leading edge, Sora 800 headlines pushed right, generous Manrope body, and quiet underlined links instead of buttons.",
  promotionsRisk: "low",
};

// ─── Shared building blocks ────────────────────────────────────────────────

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeName(name) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Manager";
  return escapeHtml(trimmed);
}

function safe(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return escapeHtml(String(value));
}

// One reusable shell — both emails sit inside the same linen sheet.
function shell({ title, preview, inner, unsubscribeUrl, siteUrl }) {
  const safeSite  = siteUrl || "https://www.stint-web.com";
  const safeUnsub = unsubscribeUrl || `${safeSite}/account`;
  const safeTitle   = escapeHtml(title);
  const safePreview = escapeHtml(preview);

  // The leading-edge effect is built with a two-column table inside the
  // 600px sheet: a 5px orange column on the left and a content column on
  // the right. Both rows of every section share the same parent table so
  // the orange runs uninterrupted, top to bottom.
  //
  // The faint linen "texture" is a pair of sub-8% radial-gradient washes
  // applied via background-image on the sheet — zero external assets.

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${safeTitle}</title>
  ${FONT_LINK}
</head>
<body style="margin:0;padding:0;background:${PALETTE.bg};font-family:${MANROPE};color:${PALETTE.ink};-webkit-font-smoothing:antialiased;">
  <span style="display:none !important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PALETTE.bg};">${safePreview}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PALETTE.bg};">
    <tr>
      <td align="center" style="padding:40px 16px 56px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${PALETTE.page};background-image:radial-gradient(circle at 14% 0%, rgba(255,106,26,0.06), rgba(255,106,26,0) 55%), radial-gradient(circle at 88% 100%, rgba(14,22,32,0.05), rgba(14,22,32,0) 60%);background-repeat:no-repeat;">
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Orange leading edge: 5px, runs the full vertical height -->
                  <td width="5" style="width:5px;background:${PALETTE.accent};line-height:0;font-size:0;">&nbsp;</td>
                  <!-- Content column -->
                  <td style="padding:0;">
                    ${inner({ safeSite, safeUnsub })}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Sub-footer wordmark sitting outside the sheet, in the linen margin -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
          <tr>
            <td style="padding:18px 0 0;text-align:center;font-family:${SORA};font-size:10px;font-weight:700;letter-spacing:0.32em;color:${PALETTE.muted};text-transform:uppercase;">
              Stint &middot; F1 Predictions
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Header used inside both emails. Logo flush against the orange edge,
// dateline-style label on the right, hairline rule below.
function header({ eyebrow }) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:32px 40px 22px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" valign="middle" style="vertical-align:middle;">
                <img src="${LOGO_SRC}" alt="Stint" height="28" style="display:block;height:28px;width:auto;border:0;outline:none;text-decoration:none;" />
              </td>
              <td align="right" valign="middle" style="vertical-align:middle;font-family:${SORA};font-size:10px;font-weight:700;letter-spacing:0.28em;color:${PALETTE.muted};text-transform:uppercase;">
                ${escapeHtml(eyebrow)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 0 32px;">
          <div style="height:1px;background:${PALETTE.hairline};line-height:0;font-size:0;">&nbsp;</div>
        </td>
      </tr>
    </table>
  `;
}

function footer({ safeUnsub, safeSite, reason, unsubLabel }) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:0 40px 0 32px;">
          <div style="height:1px;background:${PALETTE.hairline};line-height:0;font-size:0;">&nbsp;</div>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 40px 36px 32px;font-family:${MANROPE};font-size:12px;line-height:1.75;color:${PALETTE.muted};">
          <p style="margin:0 0 10px;font-size:12px;line-height:1.75;color:${PALETTE.muted};">${escapeHtml(reason)}</p>
          <p style="margin:0;font-size:12px;line-height:1.75;color:${PALETTE.muted};">
            <a href="${safeUnsub}" style="color:${PALETTE.muted};text-decoration:underline;text-underline-offset:2px;">${escapeHtml(unsubLabel)}</a>
            &nbsp;&middot;&nbsp;
            <a href="${safeSite}/privacy" style="color:${PALETTE.muted};text-decoration:underline;text-underline-offset:2px;">Privacy</a>
          </p>
        </td>
      </tr>
    </table>
  `;
}

// Headline pushed right of the leading edge (extra left padding inside the
// content column gives the orange rule the breathing room the brief asks for).
function headline(text) {
  return `<h1 style="margin:0;font-family:${SORA};font-size:40px;line-height:1.04;letter-spacing:-0.035em;font-weight:800;color:${PALETTE.ink};">${text}</h1>`;
}

function eyebrowLine(text) {
  return `<div style="font-family:${SORA};font-size:10px;font-weight:700;letter-spacing:0.28em;color:${PALETTE.muted};text-transform:uppercase;margin:0 0 14px;">${escapeHtml(text)}</div>`;
}

function bodyP(text, extra = "") {
  return `<p style="margin:0 0 18px;font-family:${MANROPE};font-size:16px;line-height:1.78;color:${PALETTE.inkSoft};font-weight:400;${extra}">${text}</p>`;
}

// Quiet underlined text-link — no button.
function textLink(label, href) {
  return `<a href="${href}" style="display:inline-block;font-family:${SORA};font-size:14px;font-weight:700;letter-spacing:0.02em;color:${PALETTE.accent};text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1.5px;">${escapeHtml(label)} &rsaquo;</a>`;
}

function sectionRule() {
  return `<div style="height:1px;background:${PALETTE.hairline};line-height:0;font-size:0;margin:30px 0;">&nbsp;</div>`;
}

// ─── Welcome ───────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const name = safeName(username);
  const team = favoriteTeam ? escapeHtml(favoriteTeam) : null;

  const teamSentence = team
    ? `You picked ${team}, so the app will paint your picks in their colours — a quiet way to keep your weekend on the dash.`
    : `Choose a team in your profile and the app will paint your picks in their colours — a quiet way to keep your weekend on the dash.`;

  const inner = ({ safeSite, safeUnsub }) => `
    ${header({ eyebrow: "Issue No. 01 — Welcome" })}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:40px 40px 8px 32px;">
          ${eyebrowLine("A measured welcome")}
          ${headline(`Hello, ${name}.<br/>Make your first move.`)}
        </td>
      </tr>
      <tr>
        <td style="padding:28px 40px 0 32px;">
          ${bodyP(`Your account is live. You have already been added to the <strong style="color:${PALETTE.ink};font-weight:700;">Stint Community</strong> — the global league every Stint user shares — so the season is already in progress around you.`)}
          ${bodyP(teamSentence)}
          ${bodyP(`Stint is built for race-week timing. Six picks per round, hard locks at qualifying, scores published once the chequered flag falls. No noise between rounds — just the next move, when it matters.`)}
        </td>
      </tr>

      <tr>
        <td style="padding:0 40px 0 32px;">
          ${sectionRule()}
        </td>
      </tr>

      <tr>
        <td style="padding:0 40px 0 32px;">
          <div style="font-family:${SORA};font-size:10px;font-weight:700;letter-spacing:0.28em;color:${PALETTE.muted};text-transform:uppercase;margin:0 0 20px;">Three quiet steps</div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:0 0 22px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="44" valign="top" style="width:44px;vertical-align:top;font-family:${SORA};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${PALETTE.ink};line-height:1.1;">01</td>
                    <td valign="top" style="vertical-align:top;">
                      <div style="font-family:${SORA};font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${PALETTE.ink};line-height:1.3;margin:0 0 6px;">Lock in your picks</div>
                      <p style="margin:0 0 10px;font-family:${MANROPE};font-size:15px;line-height:1.75;color:${PALETTE.inkSoft};">Pole, winner, podium, fastest lap and a DNF for the next Grand Prix. Six choices, one round, one clean read.</p>
                      <a href="${safeSite}/picks" style="font-family:${SORA};font-size:13px;font-weight:700;letter-spacing:0.02em;color:${PALETTE.accent};text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1.5px;">Make picks &rsaquo;</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 22px;">
                <div style="height:1px;background:${PALETTE.hairline};line-height:0;font-size:0;margin:0 0 22px;">&nbsp;</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="44" valign="top" style="width:44px;vertical-align:top;font-family:${SORA};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${PALETTE.ink};line-height:1.1;">02</td>
                    <td valign="top" style="vertical-align:top;">
                      <div style="font-family:${SORA};font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${PALETTE.ink};line-height:1.3;margin:0 0 6px;">Start a private league</div>
                      <p style="margin:0 0 10px;font-family:${MANROPE};font-size:15px;line-height:1.75;color:${PALETTE.inkSoft};">Invite friends with a six-character code. You set the scoring, the season, and the rules of the row.</p>
                      <a href="${safeSite}/leagues" style="font-family:${SORA};font-size:13px;font-weight:700;letter-spacing:0.02em;color:${PALETTE.muted};text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px;">Create a league &rsaquo;</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 4px;">
                <div style="height:1px;background:${PALETTE.hairline};line-height:0;font-size:0;margin:0 0 22px;">&nbsp;</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="44" valign="top" style="width:44px;vertical-align:top;font-family:${SORA};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${PALETTE.ink};line-height:1.1;">03</td>
                    <td valign="top" style="vertical-align:top;">
                      <div style="font-family:${SORA};font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${PALETTE.ink};line-height:1.3;margin:0 0 6px;">Read the race-week brief</div>
                      <p style="margin:0 0 10px;font-family:${MANROPE};font-size:15px;line-height:1.75;color:${PALETTE.inkSoft};">A short editorial on what the paddock is watching — free, refreshed each round, written for the people who actually pick.</p>
                      <a href="${safeSite}/insight" style="font-family:${SORA};font-size:13px;font-weight:700;letter-spacing:0.02em;color:${PALETTE.muted};text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px;">Read the brief &rsaquo;</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 40px 0 32px;">
          ${sectionRule()}
        </td>
      </tr>

      <tr>
        <td style="padding:0 40px 36px 32px;">
          <p style="margin:0 0 8px;font-family:${MANROPE};font-size:13px;line-height:1.75;color:${PALETTE.muted};font-style:italic;">A note from the desk —</p>
          <p style="margin:0 0 18px;font-family:${MANROPE};font-size:15px;line-height:1.78;color:${PALETTE.inkSoft};">If you want sharper modes (Survival, Draft, Double Down, Head-to-Head, Budget), AI race coaching and unlimited leagues, Stint Pro is waiting. No rush — the free game holds its own.</p>
          <a href="${safeSite}/pro" style="font-family:${SORA};font-size:13px;font-weight:700;letter-spacing:0.02em;color:${PALETTE.muted};text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px;">Have a look at Pro &rsaquo;</a>
        </td>
      </tr>

      ${footer({
        safeUnsub,
        safeSite,
        reason: "You're receiving this because you just created a Stint account. We send a measured number of emails — race weeks, results, and the occasional considered note.",
        unsubLabel: "Unsubscribe",
      })}
    </table>
  `;

  return shell({
    title:   "Welcome to Stint",
    preview: `A measured welcome, ${name}. Three quiet steps to start your season.`,
    inner,
    unsubscribeUrl,
    siteUrl,
  });
}

// ─── Results ───────────────────────────────────────────────────────────────

export function resultsHtml({
  username, raceName, raceCountry, raceRound,
  score, bestPick, unsubscribeUrl, siteUrl,
}) {
  const name        = safeName(username);
  const safeRace    = safe(raceName, "the Grand Prix");
  const safeCountry = raceCountry ? escapeHtml(raceCountry) : "";
  const safeRound   = raceRound ?? "—";
  const numericScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  const scored = numericScore > 0;

  // Score block — large editorial figure for a real score; a quieter,
  // considered line when zero. Sora 900 with very tight tracking.
  const scoreBlock = scored
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="bottom" style="vertical-align:bottom;font-family:${SORA};font-size:96px;line-height:0.92;letter-spacing:-0.055em;font-weight:900;color:${PALETTE.amber};">${numericScore}</td>
          <td valign="bottom" style="vertical-align:bottom;padding:0 0 14px 14px;">
            <div style="font-family:${SORA};font-size:11px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${PALETTE.muted};">Points<br/>this round</div>
          </td>
        </tr>
      </table>
    `
    : `
      <div style="font-family:${SORA};font-size:30px;line-height:1.15;letter-spacing:-0.03em;font-weight:800;color:${PALETTE.ink};">No points this round.</div>
      <p style="margin:14px 0 0;font-family:${MANROPE};font-size:15px;line-height:1.75;color:${PALETTE.muted};">It happens. The grid resets next weekend — and so do you.</p>
    `;

  // Best pick — graceful absence when score is zero or no pick supplied.
  const showBestPick = scored && bestPick && Number(bestPick.points) > 0;
  const bestPickBlock = showBestPick
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
        <tr>
          <td style="padding:0 0 8px;">
            <div style="font-family:${SORA};font-size:10px;font-weight:700;letter-spacing:0.28em;color:${PALETTE.muted};text-transform:uppercase;">Pick of the round</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 6px;">
            <div style="font-family:${SORA};font-size:24px;line-height:1.2;letter-spacing:-0.025em;font-weight:800;color:${PALETTE.ink};">${escapeHtml(bestPick.value)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0;">
            <div style="font-family:${MANROPE};font-size:14px;line-height:1.7;color:${PALETTE.muted};font-weight:500;">${escapeHtml(String(bestPick.type).replace(/_/g, " "))} &middot; <span style="color:${PALETTE.ink};font-weight:700;">${escapeHtml(String(bestPick.points))} pts</span></div>
          </td>
        </tr>
      </table>
    `
    : "";

  const dateline = safeCountry
    ? `Round ${escapeHtml(String(safeRound))} &nbsp;&middot;&nbsp; ${safeCountry}`
    : `Round ${escapeHtml(String(safeRound))}`;

  const bodyLine = scored
    ? `The chequered flag has fallen, ${name}. Your ${safeRace} card scored <strong style="color:${PALETTE.ink};font-weight:700;">${numericScore} ${numericScore === 1 ? "point" : "points"}</strong>, and your league standings have moved with it.`
    : `The chequered flag has fallen, ${name}. Your ${safeRace} card came up short this time — no points landed, but your league rank, history and streaks have all updated quietly in the background.`;

  const inner = ({ safeSite, safeUnsub }) => `
    ${header({ eyebrow: "Race Debrief" })}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:40px 40px 8px 32px;">
          ${eyebrowLine(dateline)}
          ${headline(safeRace)}
        </td>
      </tr>

      <tr>
        <td style="padding:36px 40px 0 32px;">
          ${scoreBlock}
        </td>
      </tr>

      <tr>
        <td style="padding:30px 40px 0 32px;">
          ${bodyP(bodyLine)}
        </td>
      </tr>

      ${showBestPick ? `
      <tr>
        <td style="padding:0 40px 0 32px;">
          ${sectionRule()}
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 0 32px;">
          ${bestPickBlock}
        </td>
      </tr>
      ` : ""}

      <tr>
        <td style="padding:0 40px 0 32px;">
          ${sectionRule()}
        </td>
      </tr>

      <tr>
        <td style="padding:0 40px 36px 32px;">
          <p style="margin:0 0 18px;font-family:${MANROPE};font-size:15px;line-height:1.78;color:${PALETTE.inkSoft};">The full breakdown — every pick, every point, every league delta — is on your card.</p>
          ${textLink("View your breakdown", `${safeSite}/picks`)}
          <p style="margin:22px 0 0;font-family:${MANROPE};font-size:13px;line-height:1.75;color:${PALETTE.muted};font-style:italic;">Next round resets the grid. We'll be quiet until then.</p>
        </td>
      </tr>

      ${footer({
        safeUnsub,
        safeSite,
        reason: "You're receiving this because results were published for a Grand Prix you made picks in. One email per round, never more.",
        unsubLabel: "Unsubscribe from results emails",
      })}
    </table>
  `;

  const subjectPreview = scored
    ? `${numericScore} ${numericScore === 1 ? "point" : "points"} at ${safeRace}. Your debrief is below.`
    : `Your ${safeRace} debrief — a quieter round, but the standings have moved.`;

  return shell({
    title:   `${safeRace} — Race Debrief`,
    preview: subjectPreview,
    inner,
    unsubscribeUrl,
    siteUrl,
  });
}
