// Editorial / Magazine concept for Stint email.
//
// Reads like the cover and opening spread of a print motorsport magazine:
// heavy masthead with the Stint wordmark, an issue/dateline strip, a 52-56px
// display headline with tight negative tracking, a thin orange rule used as a
// typographic device (not a button), and body copy set in a refined humanist
// sans. The "CTA" is a magazine-style read-on link with an arrow, not a
// pill button — but the masthead, scale, and dark-on-orange contrast still
// register to Gmail's classifier as heavily designed marketing.

const SITE = "https://www.stint-web.com";
const LOGO = "https://www.stint-web.com/images/logo-primary.png";

// Web-safe font stacks. Georgia handles the "editorial" serif moments
// (kicker, pullquote); Helvetica/Arial carries body so it stays clean
// across every client without webfonts.
const SERIF = "Georgia,'Times New Roman',Times,serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

const INK = "#06101B";
const PAPER = "#F5EFE6"; // warm cream — the "page" of the magazine
const PAPER_DEEP = "#ECE3D2";
const RULE = "#1A2433";
const ORANGE = "#FF6A1A";
const AMBER = "#FFC247";
const MUTED = "#5A6473";
const HAIRLINE = "rgba(6,16,27,0.12)";

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatIssueDate(date = new Date()) {
  // "VOL. 2026 · 02 JUNE" — magazine-style dateline. Stable per send.
  const months = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = months[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  return `VOL. ${y} &middot; ${d} ${m}`;
}

function masthead() {
  // The masthead is the cover. Black ink slab, full-bleed orange hairline
  // underneath, oversized wordmark, dateline opposite. Logo art carries
  // the brand mark; the dateline is the editorial signal.
  return `
    <tr>
      <td style="background:${INK};padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${INK};">
          <tr>
            <td style="padding:28px 36px 22px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <img src="${LOGO}" height="34" alt="Stint" style="display:block;height:34px;width:auto;border:0;outline:none;" />
                  </td>
                  <td align="right" style="vertical-align:middle;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.22em;color:rgba(255,255,255,0.55);">
                    ${formatIssueDate()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="height:3px;background:${ORANGE};line-height:3px;font-size:0;">&nbsp;</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function footer(unsubscribeUrl, category) {
  const unsubLabel = category ? `Unsubscribe from ${escapeHtml(category)}` : "Unsubscribe";
  const unsubBlock = unsubscribeUrl
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">${unsubLabel}</a> &middot; `
    : "";

  return `
    <tr>
      <td style="background:${PAPER_DEEP};padding:0;">
        <div style="height:1px;background:${HAIRLINE};line-height:1px;font-size:0;">&nbsp;</div>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding:24px 36px 14px 36px;font-family:${SANS};">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="left" style="font-family:${SERIF};font-style:italic;font-size:13px;color:${INK};letter-spacing:0;">
                    Fast. Precise. Tense.
                  </td>
                  <td align="right" style="font-size:10px;font-weight:700;letter-spacing:0.22em;color:${MUTED};text-transform:uppercase;">
                    Stint &middot; Independent
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 26px 36px;font-family:${SANS};font-size:11px;line-height:1.7;color:${MUTED};">
              You're receiving this because you have a Stint account.<br />
              ${unsubBlock}<a href="${SITE}/privacy" style="color:${MUTED};text-decoration:underline;">Privacy</a><br />
              <span style="display:inline-block;margin-top:8px;color:${MUTED};">
                Stint is an independent prediction platform and is not affiliated with, endorsed by, or officially connected to Formula 1, Formula One group companies, FIA, or any F1 team.
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function shell({ title, previewText, bodyRows, unsubscribeUrl, category }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${INK};font-family:${SANS};">
  <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px;mso-hide:all;overflow:hidden;">${escapeHtml(previewText)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${PAPER};border-collapse:separate;">
          ${masthead()}
          ${bodyRows}
          ${footer(unsubscribeUrl, category)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Magazine-style "read on" link — arrow + uppercase tracked label, sitting
// under a thin black rule. Reads as editorial, not as a marketing CTA pill.
function readOn(label, href) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 0 0;">
      <tr>
        <td style="padding:0 0 8px 0;">
          <div style="height:1px;width:64px;background:${INK};line-height:1px;font-size:0;">&nbsp;</div>
        </td>
      </tr>
      <tr>
        <td>
          <a href="${escapeHtml(href)}" style="display:inline-block;font-family:${SANS};font-size:12px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:${INK};text-decoration:none;">
            ${escapeHtml(label)} &nbsp;&rarr;
          </a>
        </td>
      </tr>
    </table>
  `;
}

// ─── Meta ────────────────────────────────────────────────────────────────

export const meta = {
  name: "Editorial",
  description: "Magazine cover treatment — heavy masthead, oversized display headline, serif pullquote, paper-cream page. Reads like an issue, not a notification.",
  promotionsRisk: "high",
};

// ─── Welcome ─────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const site = siteUrl || SITE;
  const name = username ? String(username) : "Manager";
  const safeName = escapeHtml(name);
  const safeTeam = favoriteTeam ? escapeHtml(favoriteTeam) : null;

  const teamLine = safeTeam
    ? `You're flying the <strong style="color:${INK};font-weight:700;">${safeTeam}</strong> flag — every pick you make gets painted in their colours from here on.`
    : `Pick a team in your profile and Stint will paint your picks in their colours.`;

  const headline = `Welcome to the&nbsp;paddock, ${safeName}.`;

  const body = `
    <tr>
      <td style="background:${PAPER};padding:40px 44px 8px 44px;font-family:${SANS};">
        <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.28em;text-transform:uppercase;color:${ORANGE};margin-bottom:18px;">
          Issue No.&nbsp;01 &middot; The Welcome
        </div>
        <h1 style="margin:0 0 6px 0;font-family:${SERIF};font-weight:700;font-size:52px;line-height:0.98;letter-spacing:-0.035em;color:${INK};">
          ${headline}
        </h1>
        <div style="margin:18px 0 22px 0;">
          <div style="display:inline-block;height:2px;width:48px;background:${INK};line-height:2px;font-size:0;">&nbsp;</div>
        </div>
        <p style="margin:0 0 18px 0;font-family:${SANS};font-size:16px;line-height:1.55;color:${INK};font-weight:500;">
          You're in. Account live, and you've been folded into the <em style="font-family:${SERIF};font-style:italic;color:${INK};">Stint Community</em> league — every other Stint manager is in there, so the racing started the second you signed up.
        </p>
        <p style="margin:0 0 28px 0;font-family:${SANS};font-size:15px;line-height:1.65;color:${MUTED};">
          ${teamLine}
        </p>
      </td>
    </tr>

    <tr>
      <td style="background:${PAPER};padding:0 44px;font-family:${SANS};">
        <div style="height:1px;background:${HAIRLINE};line-height:1px;font-size:0;">&nbsp;</div>
      </td>
    </tr>

    <tr>
      <td style="background:${PAPER};padding:24px 44px 8px 44px;font-family:${SANS};">
        <div style="font-family:${SANS};font-size:10px;font-weight:800;letter-spacing:0.28em;text-transform:uppercase;color:${MUTED};margin-bottom:14px;">
          The Opening Lap &mdash; three things to do
        </div>
      </td>
    </tr>

    <tr>
      <td style="background:${PAPER};padding:0 44px 8px 44px;font-family:${SANS};">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          ${[
            ["01", "Make your race picks", "Lock in pole, winner, podium, fastest lap and a DNF for the next Grand Prix."],
            ["02", "Start a private league", "Invite friends with a 6-character code. Settings, scoring and bragging rights are yours."],
            ["03", "Read the latest brief", "AI-powered race-week storylines, free for everyone, refreshed each round."],
          ].map(([num, head, desc]) => `
            <tr>
              <td style="padding:16px 0;border-bottom:1px solid ${HAIRLINE};vertical-align:top;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td width="56" style="vertical-align:top;font-family:${SERIF};font-style:italic;font-size:28px;font-weight:400;color:${ORANGE};line-height:1;letter-spacing:-0.02em;padding-top:2px;">
                      ${num}
                    </td>
                    <td style="vertical-align:top;">
                      <div style="font-family:${SANS};font-size:15px;font-weight:800;color:${INK};letter-spacing:-0.005em;margin-bottom:4px;">
                        ${head}
                      </div>
                      <div style="font-family:${SANS};font-size:13.5px;line-height:1.6;color:${MUTED};">
                        ${desc}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `).join("")}
        </table>
      </td>
    </tr>

    <tr>
      <td style="background:${PAPER};padding:24px 44px 8px 44px;">
        ${readOn("Open Stint", site)}
      </td>
    </tr>

    <tr>
      <td style="background:${PAPER};padding:28px 44px 36px 44px;font-family:${SANS};">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${PAPER_DEEP};border:1px solid ${HAIRLINE};">
          <tr>
            <td style="padding:18px 20px;">
              <div style="font-family:${SANS};font-size:10px;font-weight:800;letter-spacing:0.24em;text-transform:uppercase;color:${ORANGE};margin-bottom:6px;">
                Inside this issue
              </div>
              <div style="font-family:${SERIF};font-size:17px;line-height:1.45;color:${INK};font-weight:400;">
                Want Pro game modes, an AI race coach, and unlimited leagues?
                <a href="${site}/pro" style="color:${INK};text-decoration:underline;text-underline-offset:3px;font-weight:700;">Take a look at Stint Pro.</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return shell({
    title: `Welcome to Stint, ${name}`,
    previewText: "Issue 01 — you're in the Stint Community. Here's where to start.",
    bodyRows: body,
    unsubscribeUrl,
    category: "all Stint emails",
  });
}

// ─── Results ─────────────────────────────────────────────────────────────

export function resultsHtml({ username, raceName, raceCountry, raceRound, score, bestPick, unsubscribeUrl, siteUrl }) {
  const site = siteUrl || SITE;
  const name = username ? String(username) : "Manager";
  const safeName = escapeHtml(name);
  const safeRace = escapeHtml(raceName || "Grand Prix");
  const safeCountry = raceCountry ? escapeHtml(raceCountry) : null;
  const round = Number.isFinite(raceRound) ? raceRound : null;
  const numericScore = Number.isFinite(score) ? score : 0;
  const scored = numericScore > 0;

  // The dateline doubles as the round/country masthead caption.
  const captionParts = [];
  if (round !== null) captionParts.push(`Round ${round}`);
  if (safeCountry) captionParts.push(safeCountry);
  captionParts.push("Race Report");
  const caption = captionParts.join(" &middot; ");

  // Hero figure: the score is the cover image. Massive serif numeral if
  // they scored; a tight all-caps "no points" headline otherwise.
  const heroFigure = scored
    ? `
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="vertical-align:bottom;padding-right:14px;">
            <div style="font-family:${SERIF};font-weight:700;font-size:112px;line-height:0.85;letter-spacing:-0.05em;color:${INK};">
              ${numericScore}
            </div>
          </td>
          <td style="vertical-align:bottom;padding-bottom:10px;">
            <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.28em;text-transform:uppercase;color:${ORANGE};">
              Points
            </div>
            <div style="font-family:${SERIF};font-style:italic;font-size:15px;color:${MUTED};margin-top:4px;">
              this round
            </div>
          </td>
        </tr>
      </table>
    `
    : `
      <div style="font-family:${SERIF};font-weight:700;font-size:46px;line-height:0.98;letter-spacing:-0.03em;color:${INK};">
        Blank&nbsp;page.
      </div>
      <div style="font-family:${SERIF};font-style:italic;font-size:16px;color:${MUTED};margin-top:10px;">
        No points scored &mdash; the next round resets the standings.
      </div>
    `;

  // Best-pick pull quote, only when there's a pick worth quoting.
  const hasBestPick = bestPick && Number.isFinite(bestPick.points) && bestPick.points > 0;
  const pickValue = hasBestPick ? escapeHtml(bestPick.value || "") : "";
  const pickType = hasBestPick ? escapeHtml(String(bestPick.type || "").replace(/_/g, " ")) : "";
  const pickPoints = hasBestPick ? bestPick.points : 0;

  const pullQuote = hasBestPick
    ? `
      <tr>
        <td style="background:${PAPER};padding:8px 44px 0 44px;">
          <div style="height:1px;background:${HAIRLINE};line-height:1px;font-size:0;">&nbsp;</div>
        </td>
      </tr>
      <tr>
        <td style="background:${PAPER};padding:28px 44px 12px 44px;font-family:${SANS};">
          <div style="font-family:${SANS};font-size:10px;font-weight:800;letter-spacing:0.28em;text-transform:uppercase;color:${ORANGE};margin-bottom:14px;">
            The Standout
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td width="28" style="vertical-align:top;font-family:${SERIF};font-style:italic;font-size:56px;line-height:0.7;color:${ORANGE};padding-top:4px;">
                &ldquo;
              </td>
              <td style="vertical-align:top;padding-left:6px;">
                <div style="font-family:${SERIF};font-weight:400;font-size:24px;line-height:1.25;letter-spacing:-0.012em;color:${INK};">
                  ${pickValue}
                </div>
                <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};margin-top:14px;">
                  ${pickType} &middot; ${pickPoints} pts
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : "";

  const subText = scored
    ? `Hey ${safeName} &mdash; the official results are in for ${safeRace}. Your standings, league rank and full pick-by-pick breakdown are all updated and waiting.`
    : `Hey ${safeName} &mdash; the official results are in for ${safeRace}. Nothing landed this round, but the season is long and the next lock is already on the clock.`;

  const body = `
    <tr>
      <td style="background:${PAPER};padding:40px 44px 6px 44px;font-family:${SANS};">
        <div style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:0.28em;text-transform:uppercase;color:${ORANGE};margin-bottom:18px;">
          ${caption}
        </div>
        <h1 style="margin:0 0 22px 0;font-family:${SERIF};font-weight:700;font-size:54px;line-height:0.98;letter-spacing:-0.035em;color:${INK};">
          ${safeRace}.
        </h1>
        <div style="margin:0 0 26px 0;">
          <div style="display:inline-block;height:2px;width:48px;background:${INK};line-height:2px;font-size:0;">&nbsp;</div>
        </div>
      </td>
    </tr>

    <tr>
      <td style="background:${PAPER};padding:0 44px 24px 44px;">
        ${heroFigure}
      </td>
    </tr>

    <tr>
      <td style="background:${PAPER};padding:8px 44px 8px 44px;font-family:${SANS};">
        <p style="margin:0;font-family:${SANS};font-size:15.5px;line-height:1.65;color:${INK};font-weight:500;">
          ${subText}
        </p>
      </td>
    </tr>

    ${pullQuote}

    <tr>
      <td style="background:${PAPER};padding:24px 44px 36px 44px;">
        ${readOn("Read the full breakdown", `${site}/picks`)}
      </td>
    </tr>
  `;

  const subjectish = scored ? `${name} scored ${numericScore}` : `${name} drew a blank`;

  return shell({
    title: scored ? `${raceName}: ${numericScore} pts` : `${raceName} results`,
    previewText: scored
      ? `${subjectish} at ${raceName}. The race report is inside.`
      : `${raceName} results &mdash; the race report is inside.`,
    bodyRows: body,
    unsubscribeUrl,
    category: "results emails",
  });
}
