// Race Card / Heritage — Stint email concept.
//
// Visual language borrowed from old-school grand prix programs and
// paddock notice boards: cream parchment background, sturdy Georgia
// serif for display, Helvetica for body, hairline rules everywhere,
// and a single amber accent (PRO_AMBER #f59e0b) used like an ink
// stamp rather than a UI highlight. The logo sits inside a thin
// bordered badge so it reads as embossed rather than placed.
//
// Promotions-tab risk: LOW. There are no gradients, no CTA pills,
// no large brand colour fills, and very little image use. The
// layout is text-forward with hairline tables, which Gmail tends
// to read as transactional/newsletter rather than promotional.

export const meta = {
  name: "Race Card / Heritage",
  description:
    "Parchment-coloured grand prix program: serif display type, hairline rules, amber ink-stamp accents, logo set like an embossed badge.",
  promotionsRisk: "low",
};

// ─── Tokens (inlined — no project imports allowed) ───────────────────────────

const PARCHMENT = "#F4EBD7";
const PARCHMENT_DEEP = "#ECE0C4";
const INK = "#161208";
const INK_SOFT = "#3D3424";
const INK_MUTED = "#6B5F45";
const HAIRLINE = "#2A2418";
const HAIRLINE_SOFT = "#B8A883";
const AMBER = "#A8721A"; // a deeper, ink-stamp version of PRO_AMBER for legibility on cream
const AMBER_INK = "#7A5210";

const SERIF_STACK =
  "Georgia, 'Times New Roman', 'Hoefler Text', 'Cambria', serif";
const SANS_STACK =
  "'Helvetica Neue', Helvetica, Arial, sans-serif";

const LOGO_SRC = "https://www.stint-web.com/images/logo-primary.png";

// ─── Shared helpers ──────────────────────────────────────────────────────────

function formatStamp(date) {
  // Returns e.g. "02 · VI · MMXXVI" — date stamp, paddock-noticeboard style.
  const d = date instanceof Date ? date : new Date();
  const day = String(d.getUTCDate()).padStart(2, "0");
  const romanMonths = [
    "I", "II", "III", "IV", "V", "VI",
    "VII", "VIII", "IX", "X", "XI", "XII",
  ];
  const month = romanMonths[d.getUTCMonth()];
  const year = toRoman(d.getUTCFullYear());
  return `${day} · ${month} · ${year}`;
}

function toRoman(num) {
  const map = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let n = num;
  for (const [v, sym] of map) {
    while (n >= v) {
      out += sym;
      n -= v;
    }
  }
  return out;
}

function header() {
  // Logo set inside a thin bordered badge so it reads embossed.
  return `
    <tr>
      <td align="center" style="padding:36px 36px 24px;background:${PARCHMENT};">
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            <td align="center" style="
              padding:14px 22px;
              background:${PARCHMENT_DEEP};
              border:1px solid ${HAIRLINE};
              border-radius:2px;
              box-shadow:inset 0 0 0 3px ${PARCHMENT};
            ">
              <img src="${LOGO_SRC}" height="28" alt="Stint" style="display:block;height:28px;width:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
        </table>
        <div style="margin:12px 0 0;font-family:${SANS_STACK};font-size:9px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:${INK_MUTED};">
          F1 · Predictions · Established MMXXIV
        </div>
      </td>
    </tr>
  `;
}

function divider({ heavy = false } = {}) {
  return `
    <tr>
      <td style="padding:0 36px;background:${PARCHMENT};">
        <div style="height:${heavy ? 2 : 1}px;background:${heavy ? HAIRLINE : HAIRLINE_SOFT};line-height:1px;font-size:0;">&nbsp;</div>
      </td>
    </tr>
  `;
}

function doubleRule() {
  return `
    <tr>
      <td style="padding:0 36px;background:${PARCHMENT};">
        <div style="height:1px;background:${HAIRLINE};line-height:1px;font-size:0;">&nbsp;</div>
        <div style="height:3px;line-height:3px;font-size:0;">&nbsp;</div>
        <div style="height:1px;background:${HAIRLINE};line-height:1px;font-size:0;">&nbsp;</div>
      </td>
    </tr>
  `;
}

function footer({ unsubscribeUrl, siteUrl, category }) {
  const unsub = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:${INK_MUTED};text-decoration:underline;">${category ? `Unsubscribe from ${category}` : "Unsubscribe"}</a> &nbsp;·&nbsp; `
    : "";

  return `
    <tr>
      <td style="padding:28px 36px 36px;background:${PARCHMENT_DEEP};border-top:1px solid ${HAIRLINE};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${SERIF_STACK};font-size:13px;font-style:italic;color:${INK_SOFT};letter-spacing:0.02em;">
              Stint — F1 Predictions
            </td>
            <td align="right" style="font-family:${SANS_STACK};font-size:9px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:${INK_MUTED};">
              ${formatStamp(new Date())}
            </td>
          </tr>
        </table>

        <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
        <div style="height:1px;background:${HAIRLINE_SOFT};line-height:1px;font-size:0;">&nbsp;</div>
        <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>

        <p style="margin:0 0 8px;font-family:${SANS_STACK};font-size:11px;line-height:1.7;color:${INK_MUTED};">
          You are receiving this notice because you hold a Stint account.
          ${unsub}<a href="${siteUrl}/privacy" style="color:${INK_MUTED};text-decoration:underline;">Privacy</a>
        </p>
        <p style="margin:8px 0 0;font-family:${SERIF_STACK};font-size:10px;font-style:italic;line-height:1.6;color:${INK_MUTED};">
          Stint is an independent prediction platform and is not affiliated with,
          endorsed by, or officially connected to Formula 1, Formula One group
          companies, the FIA, or any F1 team.
        </p>
      </td>
    </tr>
  `;
}

function shell({ title, previewText, contentRows }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#1a140a;font-family:${SERIF_STACK};">
  <span style="display:none;font-size:1px;color:${PARCHMENT};max-height:0;overflow:hidden;mso-hide:all;">${previewText}</span>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a140a;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${PARCHMENT};border:1px solid ${HAIRLINE};">
          ${contentRows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const name = username || "Driver";
  const site = siteUrl || "https://www.stint-web.com";

  const teamLine = favoriteTeam
    ? `Your colours are noted: <span style="font-family:${SANS_STACK};font-weight:700;letter-spacing:0.04em;color:${INK};">${favoriteTeam.toUpperCase()}</span>. Your picks will carry that livery throughout the season.`
    : `Visit your profile to nominate a constructor — your picks will then carry their livery throughout the season.`;

  const previewText = `An invitation to compete — your Stint paddock pass for the MMXXVI season.`;

  const items = [
    {
      no: "I.",
      title: "Lodge your race picks",
      body: "Nominate pole, winner, podium, fastest lap and a DNF before qualifying begins.",
    },
    {
      no: "II.",
      title: "Convene a private league",
      body: "Issue a six-character invitation. Settings, scoring and bragging rights remain yours.",
    },
    {
      no: "III.",
      title: "Consult the race-week brief",
      body: "AI-assembled storylines and form notes. Refreshed each round, complimentary to all members.",
    },
  ];

  const itemRows = items
    .map(
      (it, idx) => `
        <tr>
          <td style="padding:18px 0;border-top:${idx === 0 ? "1px solid " + HAIRLINE : "1px dashed " + HAIRLINE_SOFT};">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="top" width="44" style="
                  font-family:${SERIF_STACK};
                  font-size:22px;
                  font-style:italic;
                  color:${AMBER};
                  letter-spacing:0.02em;
                  padding-right:8px;
                ">${it.no}</td>
                <td valign="top">
                  <div style="font-family:${SERIF_STACK};font-size:17px;font-weight:700;color:${INK};letter-spacing:0.005em;line-height:1.25;">
                    ${it.title}
                  </div>
                  <div style="margin-top:4px;font-family:${SANS_STACK};font-size:13px;line-height:1.6;color:${INK_SOFT};">
                    ${it.body}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `,
    )
    .join("");

  const contentRows = `
    ${header()}

    <tr>
      <td style="padding:8px 36px 0;background:${PARCHMENT};" align="center">
        <div style="font-family:${SANS_STACK};font-size:10px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:${AMBER};">
          — Invitation —
        </div>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:14px 36px 6px;background:${PARCHMENT};">
        <h1 style="
          margin:0;
          font-family:${SERIF_STACK};
          font-size:38px;
          font-weight:400;
          font-style:italic;
          color:${INK};
          letter-spacing:0.005em;
          line-height:1.1;
        ">
          Welcome, ${name}.
        </h1>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:6px 36px 22px;background:${PARCHMENT};">
        <div style="font-family:${SANS_STACK};font-size:11px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${INK_MUTED};">
          You are entered for the ${new Date().getUTCFullYear()} season
        </div>
      </td>
    </tr>

    ${doubleRule()}

    <tr>
      <td style="padding:24px 36px 8px;background:${PARCHMENT};">
        <p style="margin:0 0 14px;font-family:${SERIF_STACK};font-size:16px;line-height:1.65;color:${INK_SOFT};">
          Your registration is confirmed. You have been seated in the
          <span style="font-style:italic;color:${INK};">Stint Community</span> —
          a single global league in which every member competes against every other.
          The pit lane is open; your place on the grid is reserved.
        </p>
        <p style="margin:0;font-family:${SERIF_STACK};font-size:16px;line-height:1.65;color:${INK_SOFT};">
          ${teamLine}
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:20px 36px 4px;background:${PARCHMENT};">
        <div style="font-family:${SANS_STACK};font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${INK_MUTED};border-bottom:1px solid ${HAIRLINE};padding-bottom:8px;">
          Order of Business
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
          ${itemRows}
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:20px 36px 28px;background:${PARCHMENT};">
        <a href="${site}" style="
          font-family:${SERIF_STACK};
          font-size:15px;
          font-style:italic;
          color:${INK};
          text-decoration:none;
          border-bottom:1px solid ${AMBER};
          padding:2px 4px 4px;
          letter-spacing:0.01em;
        ">
          Take to the grid &nbsp;→
        </a>
      </td>
    </tr>

    ${divider()}

    <tr>
      <td style="padding:20px 36px 28px;background:${PARCHMENT};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${SERIF_STACK};font-size:13px;font-style:italic;color:${INK_MUTED};">
              For the discerning competitor —
              <a href="${site}/pro" style="color:${AMBER_INK};text-decoration:none;border-bottom:1px solid ${HAIRLINE_SOFT};">
                Stint Pro
              </a>
              offers additional game modes, an AI race coach, and unlimited leagues.
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${footer({ unsubscribeUrl, siteUrl: site, category: "all Stint correspondence" })}
  `;

  return shell({
    title: `Welcome to Stint, ${name}`,
    previewText,
    contentRows,
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
  const name = username || "Driver";
  const site = siteUrl || "https://www.stint-web.com";

  const roundLabel = `Round ${toRoman(Number(raceRound) || 0)}`;
  const roundDigits = `No. ${String(raceRound).padStart(2, "0")}`;
  const country = raceCountry ? raceCountry.toUpperCase() : "";

  const previewText = score > 0
    ? `Round ${raceRound} — ${raceName}. Your tally: ${score} points.`
    : `Round ${raceRound} — ${raceName}. Final classification posted.`;

  // Score panel — printed like a steward's notice.
  const scorePanel = score > 0
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PARCHMENT_DEEP};border:1px solid ${HAIRLINE};">
        <tr>
          <td style="padding:22px 26px;">
            <div style="font-family:${SANS_STACK};font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${INK_MUTED};">
              Awarded to ${name}
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
              <tr>
                <td valign="bottom" style="
                  font-family:${SERIF_STACK};
                  font-size:64px;
                  font-weight:400;
                  color:${INK};
                  line-height:1;
                  letter-spacing:-0.01em;
                ">${score}</td>
                <td valign="bottom" align="right" style="
                  font-family:${SANS_STACK};
                  font-size:11px;
                  font-weight:700;
                  letter-spacing:0.28em;
                  text-transform:uppercase;
                  color:${INK_MUTED};
                  padding-bottom:8px;
                ">
                  Championship<br/>Points
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `
    : `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PARCHMENT_DEEP};border:1px solid ${HAIRLINE};">
        <tr>
          <td style="padding:22px 26px;">
            <div style="font-family:${SANS_STACK};font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${INK_MUTED};">
              Classification for ${name}
            </div>
            <div style="
              margin-top:8px;
              font-family:${SERIF_STACK};
              font-size:28px;
              font-style:italic;
              color:${INK};
              line-height:1.15;
              letter-spacing:0.005em;
            ">
              No points scored this round.
            </div>
            <div style="margin-top:8px;font-family:${SERIF_STACK};font-size:14px;font-style:italic;color:${INK_SOFT};line-height:1.55;">
              The chequered flag falls on every paddock eventually. On to the next round.
            </div>
          </td>
        </tr>
      </table>
    `;

  const bestPickRow = bestPick && bestPick.points > 0
    ? `
      <tr>
        <td style="padding:22px 36px 4px;background:${PARCHMENT};">
          <div style="font-family:${SANS_STACK};font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${INK_MUTED};border-bottom:1px solid ${HAIRLINE};padding-bottom:8px;">
            Pick of the day
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
            <tr>
              <td valign="top">
                <div style="font-family:${SANS_STACK};font-size:9px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:${AMBER};">
                  ${String(bestPick.type).replace(/_/g, " ")}
                </div>
                <div style="margin-top:4px;font-family:${SERIF_STACK};font-size:22px;font-weight:400;color:${INK};letter-spacing:0.005em;line-height:1.2;">
                  ${bestPick.value}
                </div>
              </td>
              <td valign="top" align="right" style="width:96px;padding-left:12px;">
                <div style="
                  display:inline-block;
                  padding:6px 12px;
                  background:${PARCHMENT};
                  border:1px solid ${AMBER};
                  border-radius:2px;
                  font-family:${SANS_STACK};
                  font-size:11px;
                  font-weight:700;
                  letter-spacing:0.16em;
                  text-transform:uppercase;
                  color:${AMBER_INK};
                ">
                  +${bestPick.points} pts
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : "";

  const contentRows = `
    ${header()}

    <tr>
      <td align="center" style="padding:8px 36px 0;background:${PARCHMENT};">
        <div style="font-family:${SANS_STACK};font-size:10px;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:${AMBER};">
          — Official Classification —
        </div>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:14px 36px 4px;background:${PARCHMENT};">
        <h1 style="
          margin:0;
          font-family:${SERIF_STACK};
          font-size:34px;
          font-weight:400;
          color:${INK};
          letter-spacing:0.005em;
          line-height:1.1;
        ">
          ${raceName}
        </h1>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:8px 36px 22px;background:${PARCHMENT};">
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            <td style="padding:0 10px;font-family:${SANS_STACK};font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${INK_MUTED};">
              ${roundLabel}
            </td>
            <td style="padding:0 10px;color:${HAIRLINE_SOFT};">|</td>
            <td style="padding:0 10px;font-family:${SANS_STACK};font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${INK_MUTED};">
              ${roundDigits}
            </td>
            ${country ? `
              <td style="padding:0 10px;color:${HAIRLINE_SOFT};">|</td>
              <td style="padding:0 10px;font-family:${SANS_STACK};font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${INK_MUTED};">
                ${country}
              </td>
            ` : ""}
          </tr>
        </table>
      </td>
    </tr>

    ${doubleRule()}

    <tr>
      <td style="padding:24px 36px 0;background:${PARCHMENT};">
        ${scorePanel}
      </td>
    </tr>

    ${bestPickRow}

    <tr>
      <td style="padding:22px 36px 4px;background:${PARCHMENT};">
        <p style="margin:0;font-family:${SERIF_STACK};font-size:15px;line-height:1.65;color:${INK_SOFT};">
          The stewards have published the official results for
          <span style="font-style:italic;color:${INK};">${raceName}</span>.
          Your standing, your league position, and your full pick-by-pick
          breakdown have been posted to the notice board.
        </p>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:18px 36px 28px;background:${PARCHMENT};">
        <a href="${site}/picks" style="
          font-family:${SERIF_STACK};
          font-size:15px;
          font-style:italic;
          color:${INK};
          text-decoration:none;
          border-bottom:1px solid ${AMBER};
          padding:2px 4px 4px;
          letter-spacing:0.01em;
        ">
          Read the full classification &nbsp;→
        </a>
      </td>
    </tr>

    ${divider()}

    <tr>
      <td style="padding:18px 36px 24px;background:${PARCHMENT};">
        <p style="margin:0;font-family:${SERIF_STACK};font-size:12px;font-style:italic;line-height:1.6;color:${INK_MUTED};">
          Posted to the paddock notice board on ${formatStamp(new Date())}.
        </p>
      </td>
    </tr>

    ${footer({ unsubscribeUrl, siteUrl: site, category: "race result notices" })}
  `;

  return shell({
    title: score > 0
      ? `${raceName} — ${score} pts`
      : `${raceName} — final classification`,
    previewText,
    contentRows,
  });
}
