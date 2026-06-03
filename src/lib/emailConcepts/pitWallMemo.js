// Pit Wall Memo — a quiet, engineering-notebook email concept.
//
// Visual idea: parchment background, Sora 900 headline pulled tight, Manrope
// body in considered prose, gray hairline rules standing in for the ruled
// lines of a margin notebook. One 2px orange leading rule near the headline
// is the only loud signal — every other element is calm on purpose. The
// "action" is a single underlined text link, not a button: it should feel
// like a hand-written postscript, not a CTA.

const FONT_LINK = `https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Manrope:wght@400;500;600;700&display=swap`;

const SORA   = `'Sora', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;
const MANROPE = `'Manrope', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;

// Palette — parchment paper, dark navy ink, warm slate muted, brand orange.
const BG_PAGE     = "#E8E0CE"; // outer "desk" tone, a shade deeper than the sheet
const BG_SHEET    = "#F0E9DA"; // parchment
const INK         = "#0E1620"; // very dark navy, never pure black
const INK_MUTED   = "#5A6470"; // warm slate
const INK_FAINT   = "#8A8576"; // notebook annotation gray
const RULE        = "#D8D0BD"; // hairline rule, slightly warmer than the sheet
const ACCENT      = "#FF6A1A"; // used twice maximum

const LOGO_URL = "https://www.stint-web.com/images/logo-primary.png";

// ─── Building blocks ───────────────────────────────────────────────────────

function shell({ title, previewText, bodyInner, unsubscribeUrl, siteUrl }) {
  const safeUnsubscribe = unsubscribeUrl || `${siteUrl}/account`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <link href="${FONT_LINK}" rel="stylesheet" />
  <style>
    @import url('${FONT_LINK}');
    a { color: ${INK}; }
    @media (max-width: 620px) {
      .sheet { width: 100% !important; }
      .sheet-pad { padding: 32px 24px 36px !important; }
      .head-pad { padding: 28px 24px 0 !important; }
      .foot-pad { padding: 0 24px 32px !important; }
      .h-display { font-size: 34px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:${MANROPE};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${previewText}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_PAGE};padding:48px 0;">
    <tr>
      <td align="center" style="padding:0 16px;">
        <table role="presentation" class="sheet" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${BG_SHEET};">

          <!-- Header: logo on its own line, top-left, breathing room beneath -->
          <tr>
            <td class="head-pad" style="padding:36px 56px 0 56px;">
              <img src="${LOGO_URL}" alt="Stint" height="28" style="display:block;height:28px;width:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>

          <!-- Document meta line — small caps, like a header on a memo -->
          <tr>
            <td style="padding:28px 56px 0 56px;">
              <div style="font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_FAINT};">
                Pit&nbsp;Wall&nbsp;Memo&nbsp;&nbsp;·&nbsp;&nbsp;Internal&nbsp;Note
              </div>
            </td>
          </tr>

          <!-- Body sheet -->
          <tr>
            <td class="sheet-pad" style="padding:18px 56px 44px 56px;">
              ${bodyInner}
            </td>
          </tr>

          <!-- Footer: hairline rule, then quiet two-line legal -->
          <tr>
            <td class="foot-pad" style="padding:0 56px 40px 56px;">
              <div style="height:1px;line-height:1px;font-size:0;background:${RULE};margin:0 0 18px 0;">&nbsp;</div>
              <p style="margin:0;font-family:${MANROPE};font-size:11px;font-weight:400;line-height:1.7;color:${INK_FAINT};letter-spacing:0.01em;">
                You're receiving this because you have a Stint account. Stint is an independent prediction platform and is not affiliated with Formula 1, the FIA, or any team.
              </p>
              <p style="margin:10px 0 0;font-family:${MANROPE};font-size:11px;font-weight:500;line-height:1.7;color:${INK_MUTED};letter-spacing:0.01em;">
                <a href="${safeUnsubscribe}" style="color:${INK_MUTED};text-decoration:underline;text-underline-offset:2px;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${siteUrl}/privacy" style="color:${INK_MUTED};text-decoration:underline;text-underline-offset:2px;">Privacy</a>
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

// 2px orange leading rule that sits just left of the headline — the only loud
// element on the page. Renders in old clients as a thin colored block.
function orangeLeadingRule() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
    <tr>
      <td style="width:28px;height:2px;background:${ACCENT};line-height:2px;font-size:0;">&nbsp;</td>
    </tr>
  </table>`;
}

function headline(text) {
  return `<h1 class="h-display" style="margin:0;font-family:${SORA};font-weight:900;font-size:42px;line-height:1.02;letter-spacing:-0.04em;color:${INK};">${text}</h1>`;
}

function dateline(text) {
  return `<div style="margin:14px 0 0;font-family:${MANROPE};font-size:12px;font-weight:500;line-height:1.5;color:${INK_MUTED};letter-spacing:0.02em;">${text}</div>`;
}

function bodyParagraph(text) {
  return `<p style="margin:0 0 18px;font-family:${MANROPE};font-size:15px;font-weight:400;line-height:1.72;color:${INK};letter-spacing:0.005em;">${text}</p>`;
}

function sectionRule() {
  return `<div style="height:1px;line-height:1px;font-size:0;background:${RULE};margin:30px 0 26px 0;">&nbsp;</div>`;
}

function sectionLabel(text) {
  return `<div style="margin:0 0 14px;font-family:${MANROPE};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_FAINT};">${text}</div>`;
}

// Quiet underlined text link — the "action" on every Pit Wall Memo.
function quietLink(label, href) {
  return `<a href="${href}" style="font-family:${MANROPE};font-size:15px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px;letter-spacing:0.005em;">${label}</a><span style="font-family:${MANROPE};font-size:15px;font-weight:400;color:${INK_MUTED};"> &nbsp;→</span>`;
}

// Notebook-style entry: a small dateline + body, like a margin note.
function noteEntry({ label, value }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;">
    <tr>
      <td style="font-family:${MANROPE};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${INK_FAINT};padding:0 0 4px 0;width:38%;vertical-align:top;">${label}</td>
      <td style="font-family:${MANROPE};font-size:14px;font-weight:500;color:${INK};letter-spacing:0.005em;padding:0 0 4px 0;vertical-align:top;">${value}</td>
    </tr>
  </table>`;
}

function signoff(text) {
  return `<p style="margin:28px 0 0;font-family:${MANROPE};font-size:13px;font-weight:500;font-style:italic;line-height:1.6;color:${INK_MUTED};letter-spacing:0.01em;">${text}</p>`;
}

// ─── Welcome ───────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const name = (username && String(username).trim()) || "Manager";
  const teamLine = favoriteTeam
    ? `Noted on the sheet: ${favoriteTeam}. Your picks will carry their colour through the app.`
    : `When you set a team in your profile, the app paints your picks in their colour. Worth doing early.`;

  const inner = `
    ${orangeLeadingRule()}
    ${headline(`Welcome, ${name}.`)}
    ${dateline(`A short memo, written once. Keep it if it's useful.`)}

    ${sectionRule()}

    ${bodyParagraph(`Your Stint account is live. You've been entered into the Stint Community league automatically — every other Stint manager sits in the same standings, so you're already on the timing sheet whether you've made a pick yet or not.`)}

    ${bodyParagraph(teamLine)}

    ${sectionRule()}
    ${sectionLabel(`First three things, in order`)}

    ${bodyParagraph(`<strong style="font-family:${MANROPE};font-weight:700;color:${INK};">1. Lock in your picks.</strong> Pole, winner, podium, fastest lap and a DNF. Six lines, one race, takes a minute. The board closes when qualifying starts — earlier than you think.`)}

    ${bodyParagraph(`<strong style="font-family:${MANROPE};font-weight:700;color:${INK};">2. Start a private league.</strong> A six-character code is all your friends need. You set the scoring, you keep the bragging rights.`)}

    ${bodyParagraph(`<strong style="font-family:${MANROPE};font-weight:700;color:${INK};">3. Read this round's brief.</strong> A short AI-written read on the storylines worth tracking. Free for everyone, refreshed each race.`)}

    ${sectionRule()}

    <div style="margin:0 0 6px;">
      ${quietLink(`Open Stint and make your first pick`, siteUrl)}
    </div>

    ${signoff(`— The pit wall. We'll only write when there's something worth saying.`)}
  `;

  return shell({
    title: `Welcome to Stint, ${name}`,
    previewText: `A short note from the pit wall. Your account is live and the Stint Community standings are already running.`,
    bodyInner: inner,
    unsubscribeUrl,
    siteUrl,
  });
}

// ─── Results ───────────────────────────────────────────────────────────────

export function resultsHtml({ username, raceName, raceCountry, raceRound, score, bestPick, unsubscribeUrl, siteUrl }) {
  const name = (username && String(username).trim()) || "Manager";
  const scored = Number(score) > 0;
  const safeScore = Number.isFinite(Number(score)) ? Number(score) : 0;

  const round = Number.isFinite(Number(raceRound)) ? `Round ${raceRound}` : `Round`;
  const country = raceCountry ? ` · ${raceCountry}` : "";

  // Headline reads like a memo title, not a marketing line.
  const head = scored
    ? `${raceName}: <span style="color:${ACCENT};">${safeScore}</span> pts on the board.`
    : `${raceName}: a quiet round.`;

  // Sub-paragraph differs by outcome, in calm prose.
  const subText = scored
    ? `Official results are in for ${raceName}. Your standings, league rank and the full breakdown are updated in the app. A short note on what stood out below.`
    : `Official results are in for ${raceName}. The board didn't fall your way this round — it happens. The full breakdown is in the app, and the next race resets everything.`;

  // Note rows — engineering-notebook style.
  const rows = [];
  rows.push({ label: `Round`, value: `${round}${country}` });
  rows.push({ label: `Final score`, value: scored
    ? `<span style="font-family:${SORA};font-weight:800;letter-spacing:-0.02em;font-size:16px;">${safeScore} pts</span>`
    : `<span style="color:${INK_MUTED};">0 pts</span>` });

  if (scored && bestPick && Number(bestPick.points) > 0) {
    const typeLabel = String(bestPick.type || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    rows.push({
      label: `Top pick`,
      value: `<span style="font-family:${MANROPE};font-weight:700;color:${INK};">${bestPick.value}</span> &nbsp;<span style="color:${INK_MUTED};font-weight:500;">${typeLabel} · ${bestPick.points} pts</span>`,
    });
  } else {
    // Graceful no-best-pick handling — a real margin note from the engineer.
    rows.push({
      label: `Top pick`,
      value: scored
        ? `<span style="color:${INK_MUTED};">Spread across the card — no single line carried the round.</span>`
        : `<span style="color:${INK_MUTED};">None scored. The slate is clean next round.</span>`,
    });
  }

  const notebook = rows.map(noteEntry).join("");

  const closing = scored
    ? `Sharpen the next set of picks while it's still fresh. The board for the next round is already open.`
    : `Worth a quick post-mortem before the next set of picks. The board for the next round is already open.`;

  const inner = `
    ${orangeLeadingRule()}
    ${headline(head)}
    ${dateline(`Filed for ${name} · ${round}${country}`)}

    ${sectionRule()}

    ${bodyParagraph(subText)}

    ${sectionRule()}
    ${sectionLabel(`From the timing sheet`)}
    ${notebook}

    ${sectionRule()}

    ${bodyParagraph(closing)}

    <div style="margin:6px 0 0;">
      ${quietLink(`Open the full breakdown`, `${siteUrl}/picks`)}
    </div>

    ${signoff(`— The pit wall. One memo per round, nothing in between.`)}
  `;

  const subjectPreview = scored
    ? `Round ${raceRound} closed. ${safeScore} pts on the board — a short note inside.`
    : `Round ${raceRound} closed. A quiet round — short note inside, and the next board is open.`;

  return shell({
    title: scored ? `${raceName}: ${safeScore} pts` : `${raceName} results`,
    previewText: subjectPreview,
    bodyInner: inner,
    unsubscribeUrl,
    siteUrl,
  });
}

// ─── Meta ──────────────────────────────────────────────────────────────────

export const meta = {
  name: "Pit Wall Memo",
  description: "A parchment-toned engineer's notebook: tight Sora display headlines, calm Manrope prose, hairline section rules, and a single underlined text link in place of a button.",
  promotionsRisk: "low",
};
