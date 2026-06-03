// Stint email concept: THE BIG NUMBER.
// A single enormous numeral dominates the canvas. Everything else is tiny
// supporting text below it. No header band. No card. No button. The number
// IS the email — like a timing tower frozen mid-broadcast.

const LOGO_SRC = "https://www.stint-web.com/images/logo-primary.png";
const ACCENT = "#FF6A1A";
const INK = "#0B0F16"; // near-black, matches naval-blue-black feel on light bg
const PAPER = "#F6F1E7"; // warm cream
const PAPER_SOFT = "#EFE8DA"; // slightly deeper cream for the tick row
const MUTED = "#6B6358"; // warm muted ink
const HAIR = "#1F2530"; // hairline ink for rules

// --- shared utilities -------------------------------------------------------

const FONT_DISPLAY =
  "'Sora', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const FONT_BODY =
  "'Manrope', 'Helvetica Neue', Helvetica, Arial, sans-serif";

function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(n) {
  const safe = Number.isFinite(Number(n)) ? Number(n) : 0;
  return safe.toLocaleString("en-US");
}

// Tiny tracked uppercase label — used everywhere as the "supporting" voice.
function microLabel(text, { color = MUTED, size = 10 } = {}) {
  return `<span style="font-family:${FONT_BODY};font-size:${size}px;line-height:1.4;letter-spacing:0.22em;text-transform:uppercase;color:${color};font-weight:600;">${esc(
    text
  )}</span>`;
}

// The "tick row" — a thin horizontal sequence that looks like a timing strip.
// Reads like: 01 . 02 . 03 ... 24 . 25 with one cell highlighted in orange.
function tickRow(highlightIndex = 6, total = 24) {
  const cells = [];
  for (let i = 1; i <= total; i++) {
    const isHit = i === highlightIndex;
    const w = isHit ? 14 : 2;
    const bg = isHit ? ACCENT : INK;
    const op = isHit ? 1 : 0.18;
    cells.push(
      `<td style="padding:0 3px;"><div style="width:${w}px;height:10px;background:${bg};opacity:${op};border-radius:1px;"></div></td>`
    );
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;"><tr>${cells.join(
    ""
  )}</tr></table>`;
}

// Frame: the entire email is one giant number floated on cream paper.
// Header is just a 24px logo, top-right. Footer is hairline rule + micro text.
function shell({ title, preheader, bodyInner, footerInner }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;800;900&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  @media (max-width: 480px) {
    .bn-number { font-size: 180px !important; line-height: 0.82 !important; letter-spacing: -0.08em !important; }
    .bn-pad    { padding: 36px 24px 28px 24px !important; }
    .bn-foot   { padding: 18px 24px 28px 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT_BODY};color:${INK};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAPER};">${esc(
    preheader
  )}</div>
<center role="article" aria-roledescription="email" style="width:100%;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
  <tr>
    <td align="center" style="padding:0;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${PAPER};">
        <!-- top bar: tiny logo right, tiny meta left -->
        <tr>
          <td class="bn-pad" style="padding:28px 40px 8px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="vertical-align:middle;">
                  ${microLabel("Stint · F1 Predictions", { color: INK, size: 10 })}
                </td>
                <td align="right" style="vertical-align:middle;">
                  <img src="${LOGO_SRC}" alt="Stint" width="28" height="28" style="display:inline-block;height:28px;width:auto;border:0;outline:none;text-decoration:none;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${bodyInner}

        <!-- footer: hairline + micro text -->
        <tr>
          <td class="bn-foot" style="padding:18px 40px 36px 40px;">
            <div style="height:1px;background:${INK};opacity:0.12;line-height:1px;font-size:0;">&nbsp;</div>
            <div style="height:14px;line-height:14px;">&nbsp;</div>
            ${footerInner}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</center>
</body>
</html>`;
}

function footerBlock({ unsubscribeUrl, siteUrl, line }) {
  const privacy = `${siteUrl || "https://www.stint-web.com"}/privacy`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="vertical-align:top;">
          ${microLabel(line || "Stint — race-week timing.", { color: MUTED, size: 10 })}
          <div style="height:6px;line-height:6px;">&nbsp;</div>
          <span style="font-family:${FONT_BODY};font-size:11px;line-height:1.6;color:${MUTED};">
            <a href="${esc(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>
            <span style="opacity:0.4;padding:0 6px;">·</span>
            <a href="${esc(privacy)}" style="color:${MUTED};text-decoration:underline;">Privacy</a>
          </span>
        </td>
        <td align="right" style="vertical-align:top;">
          <span style="font-family:${FONT_DISPLAY};font-size:10px;line-height:1.4;letter-spacing:0.24em;text-transform:uppercase;color:${INK};font-weight:800;">— END —</span>
        </td>
      </tr>
    </table>
  `;
}

// The big-number block. `numberText` is rendered HUGE in Sora 900.
// `topLabel` sits above, `subLabel` below it, both tiny + tracked.
function bigNumberBlock({
  topLabel,
  numberText,
  subLabel,
  highlightIndex = 6,
  numberColor = INK,
}) {
  return `
    <tr>
      <td class="bn-pad" style="padding:24px 40px 16px 40px;">
        ${microLabel(topLabel, { color: INK, size: 10 })}
      </td>
    </tr>
    <tr>
      <td align="left" style="padding:8px 40px 0 40px;">
        <div class="bn-number" style="
          font-family:${FONT_DISPLAY};
          font-weight:900;
          font-size:248px;
          line-height:0.82;
          letter-spacing:-0.09em;
          color:${numberColor};
          margin:0;
          padding:0;
        ">${esc(numberText)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              ${microLabel(subLabel, { color: INK, size: 11 })}
            </td>
            <td align="right" style="vertical-align:middle;">
              <span style="font-family:${FONT_DISPLAY};font-size:11px;line-height:1.4;letter-spacing:0.22em;text-transform:uppercase;color:${ACCENT};font-weight:800;">●&nbsp;LIVE</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px 4px 40px;background:${PAPER};">
        <div style="background:${PAPER_SOFT};padding:14px 16px;border-radius:2px;">
          ${tickRow(highlightIndex, 24)}
        </div>
      </td>
    </tr>
  `;
}

// Body paragraph + small underlined link (no buttons).
function bodyAndLink({ paragraphs, linkText, linkHref }) {
  const paras = paragraphs
    .map(
      (p) =>
        `<p style="font-family:${FONT_BODY};font-size:14px;line-height:1.65;color:${INK};margin:0 0 12px 0;letter-spacing:-0.005em;">${p}</p>`
    )
    .join("");
  return `
    <tr>
      <td style="padding:28px 40px 6px 40px;">
        ${paras}
      </td>
    </tr>
    <tr>
      <td style="padding:8px 40px 22px 40px;">
        <a href="${esc(linkHref)}" style="font-family:${FONT_DISPLAY};font-size:13px;line-height:1.4;letter-spacing:0.16em;text-transform:uppercase;color:${INK};font-weight:800;text-decoration:none;border-bottom:2px solid ${ACCENT};padding-bottom:3px;">${esc(
    linkText
  )}&nbsp;&rarr;</a>
      </td>
    </tr>
  `;
}

// --- meta -------------------------------------------------------------------

export const meta = {
  name: "Big Number",
  description:
    "A single enormous Sora 900 numeral consumes 60–70% of the canvas; everything else is demoted to tracked micro-labels. No header band, no card, no button — the number is the email.",
  promotionsRisk: "low",
};

// --- welcome ----------------------------------------------------------------

export function welcomeHtml({
  username,
  favoriteTeam,
  unsubscribeUrl,
  siteUrl,
}) {
  const safeName = esc(username || "driver");
  const team = favoriteTeam ? esc(favoriteTeam) : null;

  // Deterministic-feeling "starting rank" — pure visual prop, not real data.
  const startingRank = 1247;
  const totalMembers = 14392;

  const topLabel = "YOUR STARTING RANK · STINT COMMUNITY";
  const subLabel = `${formatNumber(totalMembers)} MEMBERS WORLDWIDE · ROUND 06`;

  const teamLine = team
    ? `Your garage is set to <strong style="font-weight:700;color:${INK};">${team}</strong>. We'll surface their grid slot, pace deltas, and risk flags every race week.`
    : `Pick a garage when you're ready — we'll surface grid slots, pace deltas, and risk flags every race week.`;

  const paragraphs = [
    `Welcome, ${safeName}. That number above is where you start in the global Stint Community league. It only moves in one direction from here, and it moves on Sundays.`,
    teamLine,
    `Lock opens Friday. Lock closes when the lights do. Sharper picks, cleaner reads, race-week timing that stays in sync.`,
  ];

  const body = `
    ${bigNumberBlock({
      topLabel,
      numberText: formatNumber(startingRank),
      subLabel,
      highlightIndex: 6,
      numberColor: INK,
    })}
    ${bodyAndLink({
      paragraphs,
      linkText: "Start picking",
      linkHref: siteUrl || "https://www.stint-web.com",
    })}
  `;

  return shell({
    title: "Welcome to Stint",
    preheader: `You start at #${formatNumber(startingRank)} of ${formatNumber(
      totalMembers
    )}. Only one way from here.`,
    bodyInner: body,
    footerInner: footerBlock({
      unsubscribeUrl,
      siteUrl,
      line: "Stint — sharper picks, cleaner reads.",
    }),
  });
}

// --- results ----------------------------------------------------------------

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
  const safeName = esc(username || "driver");
  const safeRace = esc(raceName || "Race");
  const safeCountry = raceCountry ? esc(raceCountry) : null;
  const roundNum = Number.isFinite(Number(raceRound)) ? Number(raceRound) : 0;
  const roundStr = roundNum > 0 ? `R${String(roundNum).padStart(2, "0")}` : "R--";
  const scoreSafe = Number.isFinite(Number(score)) ? Number(score) : 0;

  // Number color: orange when score > 0, near-black when zeroed (somber).
  const numberColor = scoreSafe > 0 ? ACCENT : INK;

  const topLabel = `${safeRace.toUpperCase()} · ${roundStr}${
    safeCountry ? ` · ${safeCountry.toUpperCase()}` : ""
  }`;
  const subLabel =
    scoreSafe > 0 ? "POINTS THIS RACE · SCORED" : "POINTS THIS RACE · BLANK";

  // bestPick may be null when score is 0. Handle gracefully — no card, just
  // a single inline line that vanishes cleanly when absent.
  let pickLine = "";
  if (bestPick && bestPick.value) {
    const pickType = esc(String(bestPick.type || "pick").toUpperCase());
    const pickValue = esc(bestPick.value);
    const pickPts = Number.isFinite(Number(bestPick.points))
      ? Number(bestPick.points)
      : null;
    const ptsTail =
      pickPts !== null
        ? ` <strong style="font-weight:700;color:${INK};">+${formatNumber(
            pickPts
          )} pts</strong>`
        : "";
    pickLine = `Top line of the day: <strong style="font-weight:700;color:${INK};">${pickValue}</strong> on your <em style="font-style:normal;color:${MUTED};text-transform:uppercase;letter-spacing:0.12em;font-size:11px;">${pickType}</em> slot.${ptsTail}`;
  } else if (scoreSafe === 0) {
    pickLine = `No pick paid out this round. The board resets Friday — and the gap is smaller than it looks.`;
  } else {
    pickLine = `Points are in. Full pick-by-pick breakdown waits on your board.`;
  }

  const paragraphs = [
    `${safeName} — that's your ${safeRace} result. ${roundStr} is on the board.`,
    pickLine,
    `Standings, deltas, and next-round pace notes are live on your dashboard now.`,
  ];

  const body = `
    ${bigNumberBlock({
      topLabel,
      numberText: formatNumber(scoreSafe),
      subLabel,
      highlightIndex: Math.max(1, Math.min(24, roundNum || 6)),
      numberColor,
    })}
    ${bodyAndLink({
      paragraphs,
      linkText: "Open the board",
      linkHref: siteUrl || "https://www.stint-web.com",
    })}
  `;

  return shell({
    title: `${safeRace} — ${scoreSafe} pts`,
    preheader: `${safeRace} · ${roundStr} · ${formatNumber(
      scoreSafe
    )} pts on the board.`,
    bodyInner: body,
    footerInner: footerBlock({
      unsubscribeUrl,
      siteUrl,
      line: `Stint · ${safeRace} · ${roundStr}`,
    }),
  });
}

export default { meta, welcomeHtml, resultsHtml };
