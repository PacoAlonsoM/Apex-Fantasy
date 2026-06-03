// Stint email concept: The Plain-Text Note.
//
// The visual statement of this concept is REFUSAL — refusal to look like a
// marketing email. No header band. No buttons. No logo lockup at the top.
// No colored chrome. Just a left-aligned column of prose at the natural
// reading width of an email written by a person, in their email client,
// with their hands.
//
// The only "design" choices that betray it as crafted are:
//   • Manrope body + a single Sora display character for the signature dash
//   • One single orange period (Stint brand #FF6A1A) used as punctuation
//   • A microscopic, grayscale Stint mark at the very bottom near the legal line
//
// Welcome and Results share this language exactly. The only thing that
// changes between them is the words. That is the point.

export const meta = {
  name: "Plain-Text Note",
  description:
    "A handwritten-feeling personal email — no header, no buttons, no chrome. Just prose, a signature, and one orange period.",
  promotionsRisk: "low",
};

// ─── Shared building blocks ───────────────────────────────────────────────────

const BODY_FONT =
  "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const DISPLAY_FONT =
  "Sora, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const INK = "#0E1620"; // deep navy — body copy
const INK_SOFT = "#46525E"; // secondary lines
const INK_FAINT = "#8A93A0"; // footer, microscopic logo caption
const PAPER = "#FFFFFF"; // white page
const ACCENT = "#FF6A1A"; // the one orange touch
const RULE = "#E7E4DE"; // a hairline near the footer (cream-tinted, not gray)

const LOGO_URL = "https://www.stint-web.com/images/logo-primary.png";

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell({ title, previewText, inner, unsubscribeUrl, siteUrl }) {
  const safeTitle = escapeHtml(title);
  const safePreview = escapeHtml(previewText || "");
  const safeUnsub = escapeHtml(unsubscribeUrl || "#");
  const safeSite = escapeHtml(siteUrl || "https://www.stint-web.com");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@500;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:${PAPER};">
  <div style="display:none;font-size:1px;color:${PAPER};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
    <tr>
      <td align="left" style="padding:48px 24px 24px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:540px;">
          <tr>
            <td style="font-family:${BODY_FONT};font-size:17px;line-height:1.62;color:${INK};font-weight:400;letter-spacing:-0.005em;">
${inner}
            </td>
          </tr>
          <tr>
            <td style="padding:56px 0 0 0;">
              <div style="height:1px;line-height:1px;background:${RULE};font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 0 0 0;font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:${INK_FAINT};font-weight:400;">
              <img src="${LOGO_URL}" alt="Stint" width="16" height="16" style="display:inline-block;vertical-align:middle;height:16px;width:auto;opacity:0.55;filter:grayscale(100%);margin-right:8px;" />
              <span style="vertical-align:middle;">Stint · sent because you have an account.</span>
              <br />
              <span style="display:inline-block;margin-top:6px;">
                <a href="${safeUnsub}" style="color:${INK_FAINT};text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${safeSite}/privacy" style="color:${INK_FAINT};text-decoration:underline;">Privacy</a>
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// A paragraph in the body voice. Plain prose, no extra styling.
function p(html) {
  return `              <p style="margin:0 0 18px 0;">${html}</p>\n`;
}

// The signature line. Uses Sora for the em-dash + name so it has a
// hand-set quality without ever looking like a marketing wordmark.
function signature(name) {
  return `              <p style="margin:28px 0 0 0;font-family:${DISPLAY_FONT};font-weight:500;color:${INK};font-size:17px;letter-spacing:-0.01em;">— ${escapeHtml(name)}</p>\n`;
}

// The single orange touch: an inline link that reads "View on Stint",
// underlined, in #FF6A1A. Used at most once per email.
function viewOnStint(siteUrl) {
  const safeSite = escapeHtml(siteUrl || "https://www.stint-web.com");
  return `<a href="${safeSite}" style="color:${ACCENT};text-decoration:underline;text-underline-offset:2px;">View on Stint</a>`;
}

// The OTHER permitted orange touch: a single orange period. We use this
// in exactly one place per email — at the end of one carefully chosen
// sentence — to act as the brand's only visual signature in the layout.
function orangeDot() {
  return `<span style="color:${ACCENT};">.</span>`;
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const name = (username && String(username).trim()) || "there";
  const team = (favoriteTeam && String(favoriteTeam).trim()) || null;
  const safeName = escapeHtml(name);
  const safeTeam = team ? escapeHtml(team) : null;

  const teamLine = safeTeam
    ? `I saw you picked <strong style="font-weight:600;">${safeTeam}</strong> as your team. Good. That tells me what colors to render your dashboard in and, more importantly, who you'll be defending on race weekends.`
    : `You haven't picked a favorite team yet — when you do, the rest of the app starts to know who you are.`;

  const inner =
    p(`Hey ${safeName} —`) +
    p(
      `I wanted to send a quick note. You just joined <strong style="font-weight:600;">Stint</strong>${orangeDot()} It's something I've been building over the last few months, mostly at night, mostly after races when I couldn't stop thinking about which picks I should have made.`,
    ) +
    p(
      `The idea is small: a fantasy product that respects the clock. You get a board, you get a lock deadline, and the interface gets out of your way. No leaderboard theatre. No daily push notifications begging you back. Just the picks, the lock, the result.`,
    ) +
    p(teamLine) +
    p(
      `If you want to look around, here's where you start: ${viewOnStint(siteUrl)}. The next race weekend opens picks on Thursday. I'll send you one note when the board unlocks and one when results are in. That's it.`,
    ) +
    p(
      `Thanks for being early. Reply to this email if anything's broken or strange — it comes straight to me.`,
    ) +
    signature("Paco");

  return shell({
    title: "Welcome to Stint",
    previewText: `Hey ${name} — a quick note about Stint.`,
    inner,
    unsubscribeUrl,
    siteUrl,
  });
}

// ─── Results ──────────────────────────────────────────────────────────────────

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
  const name = (username && String(username).trim()) || "there";
  const safeName = escapeHtml(name);
  const safeRace = escapeHtml(raceName || "the race");
  const safeCountry = raceCountry ? escapeHtml(raceCountry) : null;
  const round = Number.isFinite(Number(raceRound)) ? Number(raceRound) : null;
  const numericScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  const safeScore = escapeHtml(String(numericScore));

  // Location phrase — graceful when country missing.
  const locationPhrase = safeCountry
    ? `${safeRace} in ${safeCountry}`
    : `${safeRace}`;

  const roundPhrase = round ? ` (round ${round})` : "";

  // Best pick line — graceful when null OR when score is 0.
  let bestPickLine;
  if (numericScore === 0 || !bestPick || !bestPick.value) {
    bestPickLine = `Nothing landed this weekend — it happens, especially at street circuits where the order gets shuffled before you can react. The next board opens Thursday; that's where the redemption arc lives.`;
  } else {
    const pickType = escapeHtml(bestPick.type || "pick");
    const pickValue = escapeHtml(bestPick.value);
    const pickPoints = Number.isFinite(Number(bestPick.points))
      ? Number(bestPick.points)
      : null;
    const pointsPhrase = pickPoints ? `, worth ${pickPoints} points` : "";
    bestPickLine = `Your best call was the ${pickType}: <strong style="font-weight:600;">${pickValue}</strong>${pointsPhrase}. The kind of pick that's obvious in hindsight and stressful in the moment — which is usually a good sign you read the weekend correctly.`;
  }

  const scoreLine =
    numericScore === 0
      ? `You scored <strong style="font-weight:600;">0</strong> this weekend${orangeDot()}`
      : `You scored <strong style="font-weight:600;">${safeScore}</strong> this weekend${orangeDot()}`;

  const inner =
    p(`Hey ${safeName} —`) +
    p(
      `Results are in for <strong style="font-weight:600;">${locationPhrase}</strong>${roundPhrase}. ${scoreLine} Here's how it shook out.`,
    ) +
    p(bestPickLine) +
    p(
      `The full breakdown — every pick, every point, every league position — is here: ${viewOnStint(siteUrl)}. Worth a look even if it went badly. Especially if it went badly. The patterns in your wrong picks are where the next right pick comes from.`,
    ) +
    p(
      `Next race opens Thursday. I'll be on the board roughly the same time you are.`,
    ) +
    signature("Paco");

  const previewScore =
    numericScore === 0
      ? `Results for ${raceName || "the race"} — a tough one.`
      : `You scored ${numericScore} at ${raceName || "the race"}.`;

  return shell({
    title: `Results — ${raceName || "Race weekend"}`,
    previewText: previewScore,
    inner,
    unsubscribeUrl,
    siteUrl,
  });
}
