// Plain Letter — Stint email concept
//
// The aesthetic statement: "we trust the words to do the work."
//
// This is the lowest-chrome treatment in the set. Near-white background, a
// small wordmark in the top-left like personal letterhead, a single short
// paragraph of human copy, and a quiet inline text link instead of a CTA
// button. No tables for layout (only the body wrapper), no gradients, no
// branded panels, no orange callouts. The goal is a piece of mail that
// reads as if a small team typed it themselves rather than a marketing
// blast — Gmail Primary, not Promotions.
//
// Inline styles only. Web-safe / system font stack. 600px max width. Light
// mode (the dark version of "personal letter" still reads as marketing).

export const meta = {
  name: "Plain Letter",
  description:
    "A near-white personal note. Small wordmark, one short paragraph, a quiet text link. Trusts the copy to carry the email.",
  promotionsRisk: "low",
};

// ─── shared bits ───────────────────────────────────────────────────────────

const SITE = "https://www.stint-web.com";

// System serif stack — Georgia first because every major mail client renders
// it identically and it reads as "letter," not "product." Falls back through
// the rest of the platform serifs and finally Times.
const SERIF =
  "Georgia, 'Iowan Old Style', 'Apple Garamond', 'Times New Roman', Times, serif";

// Quiet near-white — a hair off pure white so the inner card has somewhere
// to sit when clients render a full-page background.
const PAGE_BG = "#FAFAF7";
const CARD_BG = "#FFFFFF";

const INK = "#1B1B1B"; // body text — not pure black, easier on the eye
const INK_SOFT = "#3A3A3A"; // secondary body
const INK_MUTE = "#7A7A7A"; // footer + meta
const HAIRLINE = "#E8E6E0"; // single subtle divider
const LINK = "#9A3A0E"; // a dark, rust-orange — brand-adjacent but readable as a link, not a button

function escapeHtml(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Small typeset wordmark — no logo image, because a logo image in a letter
// reads as "newsletter." Just the brand name in the serif, slightly heavier,
// like a name printed at the top of stationery.
function letterhead() {
  return `
    <div style="font-family:${SERIF};font-size:15px;font-weight:700;color:${INK};letter-spacing:0.01em;">
      Stint
    </div>
  `;
}

// Quiet footer. Plain text, single line where it fits, single muted link
// for unsubscribe + privacy. No "you are receiving this because…" marketing
// boilerplate above the unsubscribe — the unsubscribe link itself is enough
// to comply, and the brief sentence keeps the human voice.
function footer({ unsubscribeUrl, category }) {
  const unsubLabel = category
    ? `unsubscribe from ${escapeHtml(category)}`
    : "unsubscribe";
  const unsub = unsubscribeUrl
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:${INK_MUTE};text-decoration:underline;">${unsubLabel}</a>`
    : `<a href="${SITE}/profile?tab=notifications" style="color:${INK_MUTE};text-decoration:underline;">manage emails</a>`;

  return `
    <div style="margin-top:36px;padding-top:18px;border-top:1px solid ${HAIRLINE};font-family:${SERIF};font-size:12px;line-height:1.7;color:${INK_MUTE};">
      Stint — independent F1 picks. Not affiliated with Formula 1, FIA, or any team.<br />
      ${unsub} &nbsp;·&nbsp; <a href="${SITE}/privacy" style="color:${INK_MUTE};text-decoration:underline;">privacy</a>
    </div>
  `;
}

// The single shared shell. Note the hidden preview-text span — kept because
// every modern client uses it, and a good preview line is half the reason
// this concept lands in Primary.
function shell({ title, previewText, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${SERIF};color:${INK};-webkit-font-smoothing:antialiased;">
  <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">${escapeHtml(previewText)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${CARD_BG};">
          <tr>
            <td style="padding:36px 40px 40px;">
              ${letterhead()}
              <div style="height:28px;"></div>
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Body paragraph — the workhorse. Serif, 16px, comfortable leading. The
// only "design" here is restraint.
function para(html, extraStyle = "") {
  return `<p style="margin:0 0 18px;font-family:${SERIF};font-size:16px;line-height:1.65;color:${INK_SOFT};${extraStyle}">${html}</p>`;
}

// Quiet text link — underlined, brand-adjacent rust color, no button chrome.
function quietLink(label, href) {
  return `<a href="${escapeHtml(href)}" style="color:${LINK};text-decoration:underline;text-underline-offset:2px;font-weight:600;">${escapeHtml(label)}</a>`;
}

// Signature — written as if from a real person. Adds the "personal note"
// signal Gmail's classifier rewards and humans warm to.
function signoff(line = "— Paco, Stint") {
  return `
    <p style="margin:28px 0 0;font-family:${SERIF};font-size:16px;line-height:1.6;color:${INK};font-style:italic;">
      ${escapeHtml(line)}
    </p>
  `;
}

// ─── welcome ───────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const site = siteUrl || SITE;
  const name = username && String(username).trim() ? String(username).trim() : "there";
  const teamLine = favoriteTeam
    ? `I see you're flying the ${escapeHtml(favoriteTeam)} flag — your picks will get painted in their colours.`
    : `When you get a second, pick a favourite team in your profile and the app will paint your picks in their colours.`;

  const body = `
    ${para(`Hi ${escapeHtml(name)},`)}
    ${para(
      `Welcome to Stint. You're in, and I've added you to the Stint Community league automatically — every other Stint user is in there, so you're already racing against the whole site.`
    )}
    ${para(teamLine)}
    ${para(
      `Whenever you're ready, the next race is open for picks: ${quietLink("make your picks", `${site}/picks`)}. If something feels off or you have a question, just hit reply — this address goes to me.`
    )}
    ${signoff("— Paco, Stint")}
    ${footer({ unsubscribeUrl, category: "all Stint emails" })}
  `;

  return shell({
    title: `Welcome to Stint, ${name}`,
    previewText: `You're in — and I added you to the community league.`,
    bodyHtml: body,
  });
}

// ─── results ───────────────────────────────────────────────────────────────

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
  const site = siteUrl || SITE;
  const name = username && String(username).trim() ? String(username).trim() : "there";
  const safeRace = escapeHtml(raceName || "the race");
  const round = Number.isFinite(raceRound) ? `round ${raceRound}` : "this round";
  const where = raceCountry ? ` in ${escapeHtml(raceCountry)}` : "";

  const hasScore = typeof score === "number" && score > 0;
  const hasBestPick =
    bestPick &&
    typeof bestPick === "object" &&
    typeof bestPick.points === "number" &&
    bestPick.points > 0 &&
    bestPick.value;

  // The "headline" is one sentence in the body — no giant number panel, no
  // coloured score block. The score is just bolded inside a normal sentence.
  let scoreSentence;
  if (hasScore) {
    scoreSentence = `Results are in for ${safeRace}${where} — you scored <strong style="color:${INK};font-weight:700;">${score} ${score === 1 ? "point" : "points"}</strong> in ${round}.`;
  } else {
    scoreSentence = `Results are in for ${safeRace}${where} — nothing landed for you in ${round}, but your standings and history are updated.`;
  }

  // Best-pick mention is a single sentence woven into the prose, not a
  // bordered card. If null, we skip it cleanly.
  let pickSentence = "";
  if (hasBestPick) {
    const pickType = String(bestPick.type || "").replace(/_/g, " ").trim() || "pick";
    pickSentence = para(
      `Your ${escapeHtml(pickType)} on <strong style="color:${INK};font-weight:700;">${escapeHtml(bestPick.value)}</strong> was the one that paid (${bestPick.points} ${bestPick.points === 1 ? "pt" : "pts"}).`
    );
  }

  // Closing line varies by outcome so it actually reads like a person wrote
  // it for this race, not a template.
  const closingLine = hasScore
    ? `Full breakdown and league movements are on your ${quietLink("picks page", `${site}/picks`)} whenever you want a look.`
    : `Full breakdown is on your ${quietLink("picks page", `${site}/picks`)} — there's always next round.`;

  const body = `
    ${para(`Hi ${escapeHtml(name)},`)}
    ${para(scoreSentence)}
    ${pickSentence}
    ${para(closingLine)}
    ${signoff("— Paco, Stint")}
    ${footer({ unsubscribeUrl, category: "results emails" })}
  `;

  const subjectish = hasScore
    ? `${score} ${score === 1 ? "pt" : "pts"} at ${raceName || "the race"}`
    : `${raceName || "the race"} — results are in`;

  const preview = hasScore
    ? `You scored ${score} ${score === 1 ? "point" : "points"}. Quick recap inside.`
    : `Nothing landed this round — standings still updated.`;

  return shell({
    title: subjectish,
    previewText: preview,
    bodyHtml: body,
  });
}
