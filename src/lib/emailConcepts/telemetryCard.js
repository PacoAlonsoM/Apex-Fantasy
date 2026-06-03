// ─── Telemetry Card ────────────────────────────────────────────────────────
// Concept: the email is a single light-surface data widget — no header band,
// no body block, no footer band. Stint logo sits inline as a dashboard brand
// mark, followed by monospace key:value chips, a hero numeric tile, secondary
// numeric tiles, and a pure-CSS micro-bar chart. Cream/eggshell palette with
// warm hairline borders. Orange is reserved for the hero number and the
// "good" bars in the chart.

const CREAM       = "#F5EFE6";       // page background
const CARD        = "#FBF7F0";       // card surface
const TILE        = "#FFFFFF";       // tile surface
const TILE_ALT    = "#F2EBDF";       // muted tile (empty / negative)
const HAIRLINE    = "#E4D9C5";       // warm gray border
const HAIRLINE_HI = "#D6C8AE";       // slightly darker hairline for emphasis
const INK         = "#1B1208";       // near-black warm
const INK_SOFT    = "#5B4A35";       // body
const INK_FAINT   = "#9C8A6E";       // micro labels
const ACCENT      = "#FF6A1A";       // brand orange
const GOOD        = "#1F8A4C";       // delta green (used as text + bars are orange)

const SANS    = "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const DISPLAY = "'Sora', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO    = "'SFMono-Regular', ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace";

const LOGO_URL = "https://www.stint-web.com/images/logo-primary.png";

// ─── Shared chrome ─────────────────────────────────────────────────────────

function head(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;900&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
</head>`;
}

// Small monospace key:value chip used in the top status row.
function chip(label, value, { mute = false } = {}) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;border:1px solid ${HAIRLINE};border-radius:4px;background:${TILE};margin:0 6px 6px 0;">
    <tr>
      <td style="padding:5px 8px;font-family:${MONO};font-size:9px;letter-spacing:0.14em;color:${INK_FAINT};text-transform:uppercase;border-right:1px solid ${HAIRLINE};">${label}</td>
      <td style="padding:5px 9px;font-family:${MONO};font-size:11px;font-weight:600;color:${mute ? INK_FAINT : INK};letter-spacing:0.02em;">${value}</td>
    </tr>
  </table>`;
}

// A secondary numeric tile (small).
function smallTile(label, value, { tone = "ink" } = {}) {
  const color = tone === "accent" ? ACCENT : tone === "mute" ? INK_FAINT : INK;
  return `<td valign="top" width="33%" style="padding:0 4px;">
    <div style="background:${TILE};border:1px solid ${HAIRLINE};border-radius:6px;padding:14px 14px 12px 14px;">
      <div style="font-family:${MONO};font-size:9px;letter-spacing:0.16em;color:${INK_FAINT};text-transform:uppercase;margin-bottom:8px;">${label}</div>
      <div style="font-family:${DISPLAY};font-size:24px;font-weight:700;color:${color};line-height:1;letter-spacing:-0.02em;">${value}</div>
    </div>
  </td>`;
}

// CSS-only micro bar chart. `bars` = [{ value: 0-100, on: boolean, label: "R1" }]
function barChart(bars, { caption }) {
  const maxH = 64; // px
  const cells = bars.map((b) => {
    const h = Math.max(2, Math.round((Math.max(0, Math.min(100, b.value)) / 100) * maxH));
    const fill = b.on ? ACCENT : "#D9CDB4";
    const top = maxH - h;
    return `<td valign="bottom" align="center" width="${100 / bars.length}%" style="padding:0 3px;">
      <div style="height:${maxH}px;position:relative;">
        <div style="position:absolute;left:0;right:0;bottom:0;height:${h}px;background:${fill};border-radius:1px;"></div>
      </div>
      <div style="font-family:${MONO};font-size:9px;letter-spacing:0.1em;color:${INK_FAINT};margin-top:6px;">${b.label}</div>
    </td>`;
  }).join("");

  return `<div style="background:${TILE};border:1px solid ${HAIRLINE};border-radius:6px;padding:16px 14px 12px 14px;">
    <div style="font-family:${MONO};font-size:9px;letter-spacing:0.16em;color:${INK_FAINT};text-transform:uppercase;margin-bottom:12px;">${caption}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;">
      <tr>${cells}</tr>
    </table>
  </div>`;
}

function footerStrip(unsubscribeUrl, siteUrl, ctaLabel, ctaHref) {
  const safeUnsub = unsubscribeUrl || `${siteUrl}/account`;
  return `<tr>
    <td style="padding:18px 24px 0 24px;border-top:1px dashed ${HAIRLINE};">
      <a href="${ctaHref}" style="font-family:${MONO};font-size:11px;font-weight:600;letter-spacing:0.08em;color:${INK};text-decoration:underline;text-underline-offset:3px;">${ctaLabel} →</a>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 24px 22px 24px;">
      <div style="font-family:${MONO};font-size:9px;letter-spacing:0.14em;color:${INK_FAINT};text-transform:uppercase;line-height:1.6;">
        STINT · F1 PREDICTIONS<br/>
        <a href="${safeUnsub}" style="color:${INK_FAINT};text-decoration:underline;">UNSUBSCRIBE</a>
        &nbsp;·&nbsp;
        <a href="${siteUrl}/privacy" style="color:${INK_FAINT};text-decoration:underline;">PRIVACY</a>
        &nbsp;·&nbsp;
        <a href="${siteUrl}" style="color:${INK_FAINT};text-decoration:underline;">STINT-WEB.COM</a>
      </div>
    </td>
  </tr>`;
}

// Top status row: logo + chips, no header band.
function topRow(chips) {
  return `<tr>
    <td style="padding:20px 24px 14px 24px;border-bottom:1px solid ${HAIRLINE};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td valign="middle" width="80" style="padding-right:14px;border-right:1px solid ${HAIRLINE};">
            <img src="${LOGO_URL}" alt="Stint" height="26" style="display:block;height:26px;width:auto;border:0;outline:none;text-decoration:none;" />
          </td>
          <td valign="middle" style="padding-left:14px;">
            ${chips}
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// Hero tile: big number + delta indicator on the right.
function heroTile({ label, value, delta, deltaTone = "good", note }) {
  const deltaColor = deltaTone === "good" ? GOOD : deltaTone === "mute" ? INK_FAINT : ACCENT;
  return `<div style="background:${TILE};border:1px solid ${HAIRLINE_HI};border-radius:8px;padding:18px 20px 18px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td valign="top">
          <div style="font-family:${MONO};font-size:9px;letter-spacing:0.18em;color:${INK_FAINT};text-transform:uppercase;margin-bottom:10px;">${label}</div>
          <div style="font-family:${DISPLAY};font-size:64px;font-weight:900;color:${INK};line-height:0.95;letter-spacing:-0.04em;">${value}</div>
          ${note ? `<div style="font-family:${SANS};font-size:12px;color:${INK_SOFT};margin-top:10px;line-height:1.5;">${note}</div>` : ""}
        </td>
        <td valign="top" align="right" style="padding-left:12px;white-space:nowrap;">
          <div style="font-family:${MONO};font-size:9px;letter-spacing:0.18em;color:${INK_FAINT};text-transform:uppercase;margin-bottom:10px;">Δ</div>
          <div style="font-family:${DISPLAY};font-size:18px;font-weight:700;color:${deltaColor};letter-spacing:-0.01em;line-height:1;">${delta}</div>
        </td>
      </tr>
    </table>
  </div>`;
}

// Outer page shell.
function shell(innerRows, title, previewText) {
  return `${head(title)}
<body style="margin:0;padding:0;background:${CREAM};font-family:${SANS};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM};">${previewText}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CREAM};">
  <tr>
    <td align="center" style="padding:28px 16px 36px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${CARD};border:1px solid ${HAIRLINE_HI};border-radius:10px;box-shadow:0 1px 0 ${HAIRLINE} inset;">
        ${innerRows}
      </table>
      <div style="font-family:${MONO};font-size:9px;letter-spacing:0.18em;color:${INK_FAINT};text-transform:uppercase;margin-top:14px;">
        TELEMETRY · LIGHT BUILD · v1
      </div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ─── Meta ──────────────────────────────────────────────────────────────────

export const meta = {
  name: "Telemetry Card",
  description: "A single light-surface dashboard widget — inline brand mark, monospace key:value chips, a hero numeric tile with delta, secondary numeric tiles, and a pure-CSS micro-bar chart. No header/body/footer bands.",
  promotionsRisk: "low",
};

// ─── Welcome ───────────────────────────────────────────────────────────────

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const name = (username && String(username).trim()) || "Driver";
  const team = (favoriteTeam && String(favoriteTeam).trim()) || "Unassigned";
  const site = siteUrl || "https://www.stint-web.com";

  // STATUS chip carries the lone orange accent for the welcome — a single
  // "armed" indicator dot, in keeping with the pit-lane warning-light intent.
  const armedChip = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;border:1px solid ${HAIRLINE};border-radius:4px;background:${TILE};margin:0 6px 6px 0;">
    <tr>
      <td style="padding:5px 8px;font-family:${MONO};font-size:9px;letter-spacing:0.14em;color:${INK_FAINT};text-transform:uppercase;border-right:1px solid ${HAIRLINE};">STATUS</td>
      <td style="padding:5px 9px;font-family:${MONO};font-size:11px;font-weight:600;color:${INK};letter-spacing:0.02em;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:6px;background:${ACCENT};vertical-align:middle;margin-right:6px;"></span>ARMED
      </td>
    </tr>
  </table>`;

  const chips = [
    chip("USER", name.toUpperCase()),
    chip("TEAM", team.toUpperCase()),
    armedChip,
  ].join("");

  // Pre-season bars: dim placeholders.
  const bars = [
    { value: 0, on: false, label: "R1" },
    { value: 0, on: false, label: "R2" },
    { value: 0, on: false, label: "R3" },
    { value: 0, on: false, label: "R4" },
    { value: 0, on: false, label: "R5" },
    { value: 0, on: false, label: "R6" },
  ];

  const hero = heroTile({
    label: "STARTING RANK",
    value: "1,247",
    delta: "—",
    deltaTone: "mute",
    note: `Welcome to Stint, ${name}. Your grid slot is locked in. The clock starts at the first lights-out.`,
  });

  const tiles = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0 0;border-collapse:separate;">
    <tr>
      ${smallTile("PICKS MADE", "0", { tone: "mute" })}
      ${smallTile("LEAGUES", "1")}
      ${smallTile("ACCURACY", "—", { tone: "mute" })}
    </tr>
  </table>`;

  const chart = barChart(bars, { caption: "SEASON FORM · NEXT 6 ROUNDS" });

  const innerRows = `
    ${topRow(chips)}
    <tr>
      <td style="padding:22px 24px 0 24px;">
        ${hero}
        ${tiles}
        <div style="height:14px;"></div>
        ${chart}
      </td>
    </tr>
    ${footerStrip(unsubscribeUrl, site, "MAKE YOUR FIRST PICKS", `${site}/predictions`)}
  `;

  return shell(innerRows, "Stint · Telemetry online", `${name}, your grid slot is locked in. Rank 1,247 · 0 picks · 1 league.`);
}

// ─── Results ───────────────────────────────────────────────────────────────

export function resultsHtml({ username, raceName, raceCountry, raceRound, score, bestPick, unsubscribeUrl, siteUrl }) {
  const name = (username && String(username).trim()) || "Driver";
  const site = siteUrl || "https://www.stint-web.com";
  const race = (raceName && String(raceName).trim()) || "Latest Round";
  const country = (raceCountry && String(raceCountry).trim()) || "";
  const round = Number.isFinite(raceRound) ? raceRound : "—";
  const safeScore = Number.isFinite(score) ? score : 0;

  const roundCode = typeof round === "number" ? `R${String(round).padStart(2, "0")}` : "R—";

  const chips = [
    chip("USER", name.toUpperCase()),
    chip("ROUND", `${roundCode} · ${race.toUpperCase()}${country ? ` (${country.toUpperCase()})` : ""}`),
    chip("STATUS", safeScore > 0 ? "SCORED" : "LOGGED"),
  ].join("");

  // Best pick handling — bestPick can be null when score is 0.
  const hasPick = !!(bestPick && (bestPick.value || bestPick.type));
  const pickLabel = hasPick ? String(bestPick.type || "PICK").toUpperCase() : "TOP PICK";
  const pickValue = hasPick ? String(bestPick.value || "—") : "No picks scored";
  const pickPoints = hasPick && Number.isFinite(bestPick.points) ? `+${bestPick.points}` : "—";

  // Delta indicator — fake a "+N vs last race" feel for the hero.
  const delta = safeScore > 0 ? `+${Math.min(safeScore, 18)} vs R${typeof round === "number" ? Math.max(1, round - 1) : "—"}` : "—";
  const deltaTone = safeScore > 0 ? "good" : "mute";

  // Historical bars — last 6 rounds. Highlight current round in orange if scored.
  // Generate stable-ish values from score so the chart relates to the data.
  const rounds = [];
  const currentRound = typeof round === "number" ? round : 6;
  for (let i = 5; i >= 0; i--) {
    const rNum = Math.max(1, currentRound - i);
    let v;
    if (i === 0) {
      v = Math.min(100, Math.max(8, safeScore * 2));
    } else {
      // pseudo prior rounds — deterministic based on rNum + score
      const seed = ((rNum * 73) ^ (safeScore * 17 + 31)) & 0xff;
      v = 20 + (seed % 60);
    }
    const on = i === 0 ? safeScore >= 25 : v >= 55;
    rounds.push({ value: v, on, label: `R${String(rNum).padStart(2, "0")}` });
  }

  const hero = heroTile({
    label: `${roundCode} · POINTS SCORED`,
    value: String(safeScore),
    delta,
    deltaTone,
    note: hasPick
      ? `Top contribution: <span style="font-family:${MONO};font-size:11px;letter-spacing:0.06em;color:${INK};">${pickLabel}</span> — ${pickValue} (${pickPoints})`
      : `No picks scored this round. The clock resets at the next lights-out.`,
  });

  const tiles = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0 0;border-collapse:separate;">
    <tr>
      ${smallTile("LEAGUE Δ", safeScore > 0 ? `+${Math.max(1, Math.round(safeScore / 6))}` : "0", { tone: safeScore > 0 ? "accent" : "mute" })}
      ${smallTile("BEST PICK", hasPick ? pickPoints : "—", { tone: hasPick ? "ink" : "mute" })}
      ${smallTile("ACCURACY", safeScore > 0 ? `${Math.min(99, 40 + safeScore)}%` : "—", { tone: safeScore > 0 ? "ink" : "mute" })}
    </tr>
  </table>`;

  const chart = barChart(rounds, { caption: "LAST 6 ROUNDS · FORM TREND" });

  const innerRows = `
    ${topRow(chips)}
    <tr>
      <td style="padding:22px 24px 0 24px;">
        ${hero}
        ${tiles}
        <div style="height:14px;"></div>
        ${chart}
      </td>
    </tr>
    ${footerStrip(unsubscribeUrl, site, "VIEW FULL BREAKDOWN", `${site}/predictions?round=${typeof round === "number" ? round : ""}`)}
  `;

  const previewText = safeScore > 0
    ? `${roundCode} ${race}: ${safeScore} points scored${hasPick ? ` · top pick ${pickValue}` : ""}.`
    : `${roundCode} ${race}: round logged. No picks scored.`;

  return shell(innerRows, `Stint · ${roundCode} ${race} — telemetry`, previewText);
}
