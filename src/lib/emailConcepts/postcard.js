// ─────────────────────────────────────────────────────────────────────────────
// Concept: THE POSTCARD
//
// A landscape 600×~350 email that looks like a physical postcard you'd pull
// out of a mailbox — half F1 photograph, half handwritten note, split by a
// dashed center fold. Cream paper, Sora display for the "place name", Manrope
// for the note copy, italic serif for the signature flourish, and a small
// STINT wordmark stamped into the bottom-right corner like a printer's mark.
//
// The whole hierarchy is *horizontal* — that's the trick. Every other email
// concept stacks header → body → footer top to bottom. This one reads
// left → right. From across the room it's the only postcard in the row.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#FF6A1A";
const PAPER = "#F7F1E6";          // warm cream — the postcard stock
const PAPER_EDGE = "#EDE3CE";     // slightly darker rim for the deckle edge
const INK = "#1B1612";            // not pure black; ink on paper
const INK_SOFT = "#5C5247";       // pencil grey
const INK_FAINT = "#8C8275";      // subtitle ink
const FOLD = "#B8A98F";           // dashed center fold colour
const STAMP_BG = "#FFFDF7";       // postage-stamp background

const LOGO_URL = "https://www.stint-web.com/images/logo-primary.png";

// Hero photos hosted on the live domain. Each variant picks the one that
// best matches the email's emotional beat: aerial track for welcome (a
// "you've arrived" overhead establishing shot), the streaked single car
// for results (motion, a moment that just happened).
const PHOTO_WELCOME = "https://www.stint-web.com/images/Aerial%20view.png";
const PHOTO_RESULTS = "https://www.stint-web.com/images/Single%20car%20streak.png";

// Google Fonts <link>. Inline styles below repeat the system fallback so
// clients that strip <link> still degrade gracefully.
const FONTS_LINK = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=Manrope:wght@400;500;700&family=Caveat:wght@500;700&display=swap" rel="stylesheet">
`;

const DISPLAY_STACK = "'Sora', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const BODY_STACK = "'Manrope', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const HAND_STACK = "'Caveat', 'Snell Roundhand', 'Apple Chancery', cursive";

// ─── Shared shell ────────────────────────────────────────────────────────────

function shell({ title, preview, leftPhoto, leftOverlay, rightContent }) {
  // The whole email lives inside a single 600px outer table. The "postcard"
  // itself is a nested table with a deckle-edge border + paper colour. The
  // 2-column split is a single <tr> with two <td>s at 50% each. The dashed
  // fold is the right border of the left cell.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  ${FONTS_LINK}
</head>
<body style="margin:0;padding:0;background:#E8DFC9;font-family:${BODY_STACK};-webkit-font-smoothing:antialiased;">
  <span style="display:none;font-size:1px;color:#E8DFC9;max-height:0;overflow:hidden;">${preview}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E8DFC9;padding:48px 16px;">
    <tr>
      <td align="center">

        <!-- Postcard -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${PAPER};border:1px solid ${PAPER_EDGE};border-radius:4px;box-shadow:0 18px 38px rgba(50,38,20,0.18), 0 2px 0 rgba(255,255,255,0.6) inset;">
          <tr>
            <!-- LEFT: photo side -->
            <td width="300" valign="top" background="${leftPhoto}" style="width:300px;height:350px;background-image:url('${leftPhoto}');background-size:cover;background-position:center;background-repeat:no-repeat;background-color:#2a2520;border-right:1px dashed ${FOLD};border-radius:4px 0 0 4px;">
              <!--[if gte mso 9]>
              <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:300px;height:350px;">
                <v:fill type="frame" src="${leftPhoto}" color="#2a2520" />
                <v:textbox inset="0,0,0,0">
              <![endif]-->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:300px;height:350px;">
                <tr>
                  <td valign="top" style="padding:18px 18px 0 18px;">
                    ${leftOverlay.topLeft || ""}
                  </td>
                </tr>
                <tr>
                  <td valign="bottom" style="padding:0 18px 18px 18px;height:240px;">
                    ${leftOverlay.bottomLeft || ""}
                  </td>
                </tr>
              </table>
              <!--[if gte mso 9]>
                </v:textbox>
              </v:rect>
              <![endif]-->
            </td>

            <!-- RIGHT: written side -->
            <td width="300" valign="top" style="width:300px;height:350px;background:${PAPER};padding:0;border-radius:0 4px 4px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:300px;height:350px;">
                <tr>
                  <td valign="top" style="padding:22px 24px 0 26px;">
                    ${rightContent.top}
                  </td>
                </tr>
                <tr>
                  <td valign="middle" style="padding:8px 24px 8px 26px;">
                    ${rightContent.middle}
                  </td>
                </tr>
                <tr>
                  <td valign="bottom" style="padding:0 24px 18px 26px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="left" valign="bottom" style="font-family:${HAND_STACK};font-size:22px;color:${INK};line-height:1;letter-spacing:0.01em;">
                          ${rightContent.signature}
                        </td>
                        <td align="right" valign="bottom" style="font-family:${DISPLAY_STACK};font-size:11px;font-weight:800;letter-spacing:0.28em;color:${INK};text-transform:uppercase;">
                          STINT
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Footer under the card — small printed line, no chrome -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;margin-top:18px;">
          <tr>
            <td align="center" style="font-family:${BODY_STACK};font-size:11px;color:#7a6f5a;line-height:1.7;letter-spacing:0.02em;">
              ${rightContent.footer}
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Reusable bits ───────────────────────────────────────────────────────────

// A postage-stamp-style block sitting on the photo. Used for the round
// number on results, and for a "PAR AVION"-style stripe on welcome.
function postageStamp({ topLine, bigLine, subLine }) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:${STAMP_BG};border:1px solid ${PAPER_EDGE};border-radius:2px;box-shadow:0 2px 6px rgba(0,0,0,0.18);">
      <tr>
        <td style="padding:8px 10px 7px 10px;font-family:${DISPLAY_STACK};text-align:center;min-width:60px;">
          ${topLine ? `<div style="font-size:8px;font-weight:800;letter-spacing:0.22em;color:${ACCENT};text-transform:uppercase;line-height:1;margin-bottom:4px;">${topLine}</div>` : ""}
          ${bigLine ? `<div style="font-size:18px;font-weight:800;color:${INK};letter-spacing:-0.02em;line-height:1;">${bigLine}</div>` : ""}
          ${subLine ? `<div style="font-size:8px;font-weight:700;letter-spacing:0.18em;color:${INK_FAINT};text-transform:uppercase;line-height:1;margin-top:4px;">${subLine}</div>` : ""}
        </td>
      </tr>
    </table>
  `;
}

// A small white pill that sits at the bottom of the photo with the location.
function placeBadge(text) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:rgba(247,241,230,0.94);border-radius:999px;">
      <tr>
        <td style="padding:6px 12px 5px 12px;font-family:${DISPLAY_STACK};font-size:10px;font-weight:800;letter-spacing:0.18em;color:${INK};text-transform:uppercase;line-height:1;">
          ${text}
        </td>
      </tr>
    </table>
  `;
}

// Tiny brand mark on the photo side (small Stint logo, kept light over photo).
function photoLogo() {
  return `
    <img src="${LOGO_URL}" alt="Stint" height="26" style="display:block;height:26px;width:auto;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45));" />
  `;
}

// Inline "handwritten" continue link — no button.
function continueLink(href, label) {
  return `
    <a href="${href}" style="font-family:${HAND_STACK};font-size:22px;color:${ACCENT};text-decoration:none;letter-spacing:0.01em;line-height:1;">
      → ${label}
    </a>
  `;
}

// Footer line shown beneath the postcard.
function footerLine({ unsubscribeUrl, siteUrl }) {
  return `
    <span style="color:#7a6f5a;">Postmarked from Stint, ${"" /* date kept generic so the email ages well */}an F1 predictions club.</span><br/>
    <a href="${unsubscribeUrl}" style="color:#7a6f5a;text-decoration:underline;">Unsubscribe</a>
    <span style="color:#b8a98f;"> &nbsp;·&nbsp; </span>
    <a href="${siteUrl}/privacy" style="color:#7a6f5a;text-decoration:underline;">Privacy</a>
  `;
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export const meta = {
  name: "The Postcard",
  description: "A landscape 600×350 card split 50/50 — F1 photograph on the left, cream paper handwritten note on the right, joined by a dashed fold.",
  promotionsRisk: "low",
};

// ─── Welcome ─────────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const name = username || "there";
  const teamBit = favoriteTeam
    ? `We've already painted your picks in ${favoriteTeam} colours.`
    : `Pick a team in your profile and we'll paint your picks in their colours.`;

  const leftOverlay = {
    topLeft: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" valign="top">${photoLogo()}</td>
          <td align="right" valign="top">
            ${postageStamp({ topLine: "Par Avion", bigLine: "01", subLine: "Welcome" })}
          </td>
        </tr>
      </table>
    `,
    bottomLeft: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" valign="bottom">${placeBadge("Greetings from the grid")}</td>
        </tr>
      </table>
    `,
  };

  const rightContent = {
    top: `
      <div style="font-family:${DISPLAY_STACK};font-size:9px;font-weight:800;letter-spacing:0.26em;color:${ACCENT};text-transform:uppercase;line-height:1;margin-bottom:10px;">
        A note for you
      </div>
      <div style="font-family:${DISPLAY_STACK};font-size:28px;font-weight:800;color:${INK};letter-spacing:-0.035em;line-height:1.02;margin:0;">
        Welcome to<br/>Stint, ${name}.
      </div>
    `,
    middle: `
      <p style="margin:14px 0 0 0;font-family:${BODY_STACK};font-size:12.5px;color:${INK_SOFT};line-height:1.55;letter-spacing:0.005em;">
        You're in the Stint Community league with every other manager.
        ${teamBit}
      </p>
      <p style="margin:10px 0 0 0;font-family:${BODY_STACK};font-size:12.5px;color:${INK_SOFT};line-height:1.55;letter-spacing:0.005em;">
        Five quick picks before lights out and you're racing.
      </p>
      <div style="margin:14px 0 0 0;">
        ${continueLink(siteUrl, "make your first picks")}
      </div>
    `,
    signature: `— Stint`,
    footer: footerLine({ unsubscribeUrl, siteUrl }),
  };

  return shell({
    title: `Welcome to Stint, ${name}`,
    preview: `A postcard from the paddock — you're in.`,
    leftPhoto: PHOTO_WELCOME,
    leftOverlay,
    rightContent,
  });
}

// ─── Results ─────────────────────────────────────────────────────────────────

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
  const name = username || "Manager";
  const scored = Number(score) > 0;
  const country = raceCountry || raceName || "Track";

  // bestPick may be null when score is 0 — handle gracefully.
  const hasBestPick = !!(bestPick && typeof bestPick === "object" && bestPick.value);

  const summaryLine = scored
    ? hasBestPick
      ? `Your ${String(bestPick.type).replace(/_/g, " ")} call on ${bestPick.value} carried the round (+${bestPick.points} pts).`
      : `A clean ${score}-point round. Standings just updated.`
    : `A quiet one — no points landed this round. Next race resets everything.`;

  const leftOverlay = {
    topLeft: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" valign="top">${photoLogo()}</td>
          <td align="right" valign="top">
            ${postageStamp({
              topLine: "Round",
              bigLine: `R${String(raceRound ?? 0).padStart(2, "0")}`,
              subLine: country.slice(0, 12),
            })}
          </td>
        </tr>
      </table>
    `,
    bottomLeft: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" valign="bottom">${placeBadge(`Greetings from ${country}`)}</td>
        </tr>
      </table>
    `,
  };

  const scoreBlock = scored
    ? `
      <div style="display:inline-block;">
        <span style="font-family:${DISPLAY_STACK};font-size:64px;font-weight:800;color:${INK};letter-spacing:-0.05em;line-height:0.9;">${score}</span>
        <span style="font-family:${DISPLAY_STACK};font-size:11px;font-weight:800;letter-spacing:0.22em;color:${ACCENT};text-transform:uppercase;margin-left:4px;vertical-align:top;">pts</span>
      </div>
    `
    : `
      <div style="font-family:${DISPLAY_STACK};font-size:26px;font-weight:800;color:${INK};letter-spacing:-0.03em;line-height:1;">
        No points<br/>this round.
      </div>
    `;

  const rightContent = {
    top: `
      <div style="font-family:${DISPLAY_STACK};font-size:9px;font-weight:800;letter-spacing:0.26em;color:${ACCENT};text-transform:uppercase;line-height:1;margin-bottom:8px;">
        Results &nbsp;·&nbsp; R${String(raceRound ?? 0).padStart(2, "0")}
      </div>
      <div style="font-family:${DISPLAY_STACK};font-size:22px;font-weight:800;color:${INK};letter-spacing:-0.03em;line-height:1.05;margin:0 0 10px 0;">
        ${raceName}
      </div>
      ${scoreBlock}
    `,
    middle: `
      <p style="margin:10px 0 0 0;font-family:${BODY_STACK};font-size:12.5px;color:${INK_SOFT};line-height:1.55;letter-spacing:0.005em;">
        ${name}, ${summaryLine}
      </p>
      <div style="margin:12px 0 0 0;">
        ${continueLink(`${siteUrl}/picks`, "see your breakdown")}
      </div>
    `,
    signature: `— Stint`,
    footer: footerLine({ unsubscribeUrl, siteUrl }),
  };

  return shell({
    title: scored ? `${raceName}: ${score} pts` : `${raceName} results are in`,
    preview: scored
      ? `A postcard from ${country}: ${score} points this round.`
      : `A postcard from ${country}: results are in.`,
    leftPhoto: PHOTO_RESULTS,
    leftOverlay,
    rightContent,
  });
}
