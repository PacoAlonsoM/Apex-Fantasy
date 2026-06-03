// Race Poster — each email arrives as a collectable Bauhaus-style race print.
// The top ~60% is a constructed graphic: diagonal orange band, geometric
// negative-space shapes, and a giant rotated Sora 900 wordmark. Below the
// poster sits a thin beige "exhibition placard" of dense Manrope copy — like
// the museum caption under an art print. The Stint wordmark hides modestly
// at the bottom-center as the print's signature.

const STINT_LOGO = "https://www.stint-web.com/images/logo-primary.png";
const ORANGE = "#FF6A1A";
const ORANGE_DEEP = "#E04F00";
const INK = "#1B1A17";          // poster ink — almost-black with warmth
const CREAM = "#F2EADB";        // poster background
const PAPER = "#FAF5EA";        // placard / page background
const PAPER_EDGE = "#E6DDC8";   // hairline borders on cream paper
const SUBDUED = "#6B5F4E";      // secondary text on cream

const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@400;600;800;900&display=swap" rel="stylesheet">`;

const SORA_STACK = `'Sora', 'Helvetica Neue', Arial, sans-serif`;
const MANROPE_STACK = `'Manrope', 'Helvetica Neue', Arial, sans-serif`;

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fitsPosterTitle(text) {
  // Long titles need a smaller display size so they don't blow past the band.
  const length = String(text || "").length;
  if (length <= 7) return 112;
  if (length <= 10) return 92;
  if (length <= 14) return 72;
  return 58;
}

// ─── Poster artwork ────────────────────────────────────────────────────────
// A 600 x 420 staged composition. Everything is positioned with absolute
// offsets so the layout reads identically in every major email client that
// supports basic positioning (Apple Mail, Gmail web, Outlook 365 web).
function posterArt({ title, kickerLeft, kickerRight, subtitle, edition }) {
  const titleSize = fitsPosterTitle(title);
  const safeTitle = escapeHtml(title);
  const safeKickerLeft = escapeHtml(kickerLeft);
  const safeKickerRight = escapeHtml(kickerRight);
  const safeSubtitle = escapeHtml(subtitle);
  const safeEdition = escapeHtml(edition);

  return `
  <div style="position:relative;width:100%;max-width:600px;height:420px;background:${CREAM};overflow:hidden;font-family:${SORA_STACK};">
    <!-- diagonal orange band -->
    <div style="position:absolute;top:-80px;left:-120px;width:880px;height:140px;background:${ORANGE};transform:rotate(-18deg);transform-origin:top left;"></div>
    <!-- thin echo band -->
    <div style="position:absolute;top:30px;left:-120px;width:880px;height:6px;background:${INK};transform:rotate(-18deg);transform-origin:top left;"></div>

    <!-- big negative-space circle (right) -->
    <div style="position:absolute;top:120px;right:-110px;width:340px;height:340px;border-radius:50%;background:${PAPER};border:3px solid ${INK};"></div>
    <!-- inner orange ring slice -->
    <div style="position:absolute;top:160px;right:-70px;width:260px;height:260px;border-radius:50%;border:14px solid ${ORANGE};border-right-color:transparent;border-bottom-color:transparent;transform:rotate(35deg);"></div>

    <!-- ink square (lower left) -->
    <div style="position:absolute;bottom:-40px;left:-30px;width:180px;height:180px;background:${INK};transform:rotate(8deg);"></div>
    <!-- small orange square accent on top of ink -->
    <div style="position:absolute;bottom:60px;left:60px;width:48px;height:48px;background:${ORANGE};transform:rotate(8deg);"></div>

    <!-- tilted display word -->
    <div style="position:absolute;top:155px;left:-10px;right:-10px;text-align:center;transform:rotate(-15deg);">
      <div style="display:inline-block;font-family:${SORA_STACK};font-weight:900;font-size:${titleSize}px;line-height:0.85;letter-spacing:-0.05em;color:${INK};text-transform:uppercase;">${safeTitle}</div>
    </div>

    <!-- top-left kicker -->
    <div style="position:absolute;top:18px;left:24px;font-family:${SORA_STACK};color:${INK};">
      <div style="font-weight:800;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#FFF6EE;">STINT · 2026 SEASON</div>
      <div style="margin-top:4px;font-family:${MANROPE_STACK};font-weight:600;font-size:10px;letter-spacing:0.16em;color:#FFE3CC;text-transform:uppercase;">A weekly broadcast</div>
    </div>

    <!-- top-right kicker -->
    <div style="position:absolute;top:18px;right:24px;text-align:right;font-family:${SORA_STACK};color:#FFF6EE;">
      <div style="font-weight:800;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">${safeKickerRight}</div>
      <div style="margin-top:4px;font-family:${MANROPE_STACK};font-weight:600;font-size:10px;letter-spacing:0.16em;color:#FFE3CC;text-transform:uppercase;">${safeKickerLeft}</div>
    </div>

    <!-- bottom-left stamp block -->
    <div style="position:absolute;left:28px;bottom:24px;font-family:${SORA_STACK};">
      <div style="display:inline-block;border:2px solid ${INK};padding:6px 10px;font-weight:900;font-size:12px;letter-spacing:0.18em;color:${INK};background:${CREAM};text-transform:uppercase;">EDITION · ${safeEdition}</div>
      <div style="margin-top:8px;font-family:${MANROPE_STACK};font-weight:600;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${SUBDUED};">${safeSubtitle}</div>
    </div>

    <!-- bottom-right registration marks -->
    <div style="position:absolute;right:24px;bottom:26px;font-family:${SORA_STACK};text-align:right;">
      <div style="font-weight:900;font-size:32px;line-height:1;color:${INK};letter-spacing:-0.04em;">N°<span style="color:${ORANGE};">${safeEdition}</span></div>
      <div style="margin-top:6px;font-family:${MANROPE_STACK};font-weight:600;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:${SUBDUED};">PRINTED · STINT WORKS</div>
    </div>

    <!-- corner crosshair (top right of circle area) -->
    <div style="position:absolute;top:96px;right:28px;width:14px;height:14px;border-top:2px solid ${INK};border-right:2px solid ${INK};"></div>
    <!-- corner crosshair (bottom left) -->
    <div style="position:absolute;bottom:96px;left:22px;width:14px;height:14px;border-bottom:2px solid ${INK};border-left:2px solid ${INK};"></div>
  </div>`;
}

// ─── Placard (museum-caption strip) ────────────────────────────────────────
function placard({ heading, bodyLines }) {
  const lines = bodyLines
    .map(
      (line) =>
        `<div style="font-family:${MANROPE_STACK};font-size:12px;line-height:1.65;color:${INK};margin:0 0 4px;letter-spacing:0.01em;">${line}</div>`
    )
    .join("");

  return `
  <div style="background:${PAPER};padding:18px 28px 16px;border-top:1px solid ${PAPER_EDGE};border-bottom:1px solid ${PAPER_EDGE};">
    <div style="font-family:${SORA_STACK};font-weight:800;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:${ORANGE};margin-bottom:6px;">${escapeHtml(heading)}</div>
    ${lines}
  </div>`;
}

// ─── Specimen strip (data block, results variant) ──────────────────────────
function specimenStrip(rows) {
  const cells = rows
    .map(
      (row) => `
      <td style="padding:14px 16px;vertical-align:top;border-right:1px solid ${PAPER_EDGE};">
        <div style="font-family:${SORA_STACK};font-weight:800;font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:${SUBDUED};">${escapeHtml(row.label)}</div>
        <div style="margin-top:6px;font-family:${SORA_STACK};font-weight:800;font-size:22px;line-height:1.05;letter-spacing:-0.02em;color:${INK};">${escapeHtml(row.value)}</div>
        ${row.sub ? `<div style="margin-top:4px;font-family:${MANROPE_STACK};font-size:10px;color:${SUBDUED};letter-spacing:0.04em;">${escapeHtml(row.sub)}</div>` : ""}
      </td>`
    )
    .join("");

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CREAM};border-collapse:collapse;border-top:1px solid ${PAPER_EDGE};border-bottom:1px solid ${PAPER_EDGE};">
    <tr>${cells}</tr>
  </table>`;
}

// ─── Footer ────────────────────────────────────────────────────────────────
function footer({ unsubscribeUrl, siteUrl }) {
  const safeUnsub = escapeHtml(unsubscribeUrl || "#");
  const safeSite = escapeHtml(siteUrl || "https://www.stint-web.com");

  return `
  <div style="background:${PAPER};padding:28px 28px 36px;text-align:center;">
    <div style="display:inline-block;border-top:1px solid ${PAPER_EDGE};padding-top:18px;min-width:220px;">
      <img src="${STINT_LOGO}" alt="Stint" height="26" style="height:26px;display:inline-block;opacity:0.9;" />
      <div style="margin-top:10px;font-family:${SORA_STACK};font-weight:800;font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:${SUBDUED};">SIGNED · STINT WORKS · 2026</div>
      <div style="margin-top:14px;font-family:${MANROPE_STACK};font-size:11px;line-height:1.7;color:${SUBDUED};">
        <a href="${safeUnsub}" style="color:${SUBDUED};text-decoration:underline;">Unsubscribe</a>
        &nbsp;·&nbsp;
        <a href="${safeSite}/privacy" style="color:${SUBDUED};text-decoration:underline;">Privacy</a>
        &nbsp;·&nbsp;
        <a href="${safeSite}" style="color:${SUBDUED};text-decoration:underline;">stint-web.com</a>
      </div>
      <div style="margin-top:10px;font-family:${MANROPE_STACK};font-size:10px;line-height:1.6;color:${SUBDUED};max-width:380px;">An independent prediction platform. Not affiliated with Formula 1, the FIA, or any F1 team.</div>
    </div>
  </div>`;
}

// ─── Document shell ────────────────────────────────────────────────────────
function shell({ title, preview, posterHtml, placardHtml, extraHtml, unsubscribeUrl, siteUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(title)}</title>
${FONT_LINK}
</head>
<body style="margin:0;padding:0;background:#EFE7D6;font-family:${MANROPE_STACK};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#EFE7D6;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:${PAPER};box-shadow:0 30px 60px rgba(27,26,23,0.12),0 4px 14px rgba(27,26,23,0.06);">
          <tr><td style="padding:0;">${posterHtml}</td></tr>
          <tr><td style="padding:0;">${placardHtml}</td></tr>
          ${extraHtml ? `<tr><td style="padding:0;">${extraHtml}</td></tr>` : ""}
          <tr><td style="padding:0;">${footer({ unsubscribeUrl, siteUrl })}</td></tr>
        </table>
        <div style="margin-top:14px;font-family:${SORA_STACK};font-weight:800;font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:#8A7C66;">RACE POSTER · LIMITED RUN</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Public API ────────────────────────────────────────────────────────────
export const meta = {
  name: "Race Poster",
  description:
    "Top 60% is a constructed Bauhaus-style race print — diagonal orange band, geometric forms, a rotated Sora 900 wordmark — with a museum-caption placard of dense Manrope copy below.",
  promotionsRisk: "low",
};

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const name = (username && String(username).trim()) || "Driver";
  const team = (favoriteTeam && String(favoriteTeam).trim()) || null;

  const posterHtml = posterArt({
    title: "WELCOME",
    kickerLeft: "Issue No. 01",
    kickerRight: "INAUGURAL EDITION",
    subtitle: "Series opener · 2026",
    edition: "01",
  });

  const teamLine = team
    ? `Filed under <strong style="font-weight:700;color:${INK};">${escapeHtml(team)}</strong> — your default lens until you switch it. Picks, leagues, and the weekly stint open from your dashboard.`
    : `Pick a team in your profile and the board adapts to your lens. Picks, leagues, and the weekly stint open from your dashboard.`;

  const placardHtml = placard({
    heading: "PLACARD · ISSUE 01",
    bodyLines: [
      `<strong style="font-weight:700;color:${INK};">${escapeHtml(name)}</strong> — welcome to Stint. This is the first print of your season.`,
      teamLine,
      `Every race weekend a new poster lands here: the round, your score, the pick that earned the most. Keep them, ignore them, frame them — they are yours.`,
    ],
  });

  const ctaHtml = `
  <div style="background:${PAPER};padding:8px 28px 28px;text-align:center;">
    <a href="${escapeHtml(siteUrl || "https://www.stint-web.com")}/picks" style="display:inline-block;font-family:${SORA_STACK};font-weight:800;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:${PAPER};background:${INK};padding:14px 26px;text-decoration:none;border:2px solid ${INK};">Open the board →</a>
    <div style="margin-top:14px;font-family:${MANROPE_STACK};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${SUBDUED};">Lock-in window opens Thursday · ${escapeHtml(new Date().getFullYear())} season</div>
  </div>`;

  return shell({
    title: "Welcome to Stint",
    preview: `Issue 01 · Welcome, ${name}. Your first print is filed.`,
    posterHtml,
    placardHtml,
    extraHtml: ctaHtml,
    unsubscribeUrl,
    siteUrl,
  });
}

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
  const name = (username && String(username).trim()) || "Driver";
  const safeRaceName = (raceName && String(raceName).trim()) || "Race";
  const country = (raceCountry && String(raceCountry).trim()) || "";
  const round = raceRound ?? 0;
  const numericScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  const editionStr = String(round).padStart(2, "0");

  // Pull the headline word from the race name (e.g. "Monaco GP" → "MONACO")
  // so the poster slug is short and punchy. Fall back to the full name if
  // splitting yields nothing useful.
  const firstWord = safeRaceName.split(/\s+/).filter(Boolean)[0] || safeRaceName;
  const posterTitle = firstWord.toUpperCase();

  const posterHtml = posterArt({
    title: posterTitle,
    kickerLeft: country ? country : "RACE WEEKEND",
    kickerRight: `ROUND ${String(round).padStart(2, "0")} · 2026`,
    subtitle: country ? `${country} · Round ${round}` : `Round ${round}`,
    edition: editionStr,
  });

  // bestPick can be null (e.g. when score is 0 and nothing scored). Gracefully
  // collapse to a single-row strip in that case.
  const hasBestPick = !!(bestPick && (bestPick.value || bestPick.type));
  const bestPickType = hasBestPick ? String(bestPick.type || "Pick").replace(/_/g, " ") : "";
  const bestPickValue = hasBestPick ? String(bestPick.value || "—") : "—";
  const bestPickPoints = hasBestPick && Number.isFinite(Number(bestPick.points))
    ? `${Number(bestPick.points)} pts`
    : null;

  const specimenRows = hasBestPick
    ? [
        { label: "Round", value: String(round).padStart(2, "0"), sub: country || "—" },
        { label: "Your score", value: `${numericScore}`, sub: "points this round" },
        { label: `Best · ${bestPickType}`, value: bestPickValue, sub: bestPickPoints || "—" },
      ]
    : [
        { label: "Round", value: String(round).padStart(2, "0"), sub: country || "—" },
        { label: "Your score", value: `${numericScore}`, sub: "no scoring picks · reset next round" },
      ];

  const specimenHtml = specimenStrip(specimenRows);

  const headline = numericScore > 0
    ? `${name} — ${numericScore} points filed for ${safeRaceName}.`
    : `${name} — a blank specimen for ${safeRaceName}. The next print is already loading.`;

  const bestLine = hasBestPick
    ? `Top pick of the weekend: <strong style="font-weight:700;color:${INK};">${escapeHtml(bestPickValue)}</strong> on <em style="font-style:normal;font-weight:600;color:${ORANGE_DEEP};">${escapeHtml(bestPickType)}</em>${bestPickPoints ? ` (${escapeHtml(bestPickPoints)})` : ""}.`
    : `No pick scored this round — the board resets clean for the next weekend.`;

  const placardHtml = placard({
    heading: `PLACARD · ROUND ${String(round).padStart(2, "0")}`,
    bodyLines: [
      headline,
      bestLine,
      `Full leaderboard, league standings, and the breakdown for each pick are on the round review page.`,
    ],
  });

  const extraHtml = `
  ${specimenHtml}
  <div style="background:${PAPER};padding:20px 28px 28px;text-align:center;">
    <a href="${escapeHtml(siteUrl || "https://www.stint-web.com")}/picks" style="display:inline-block;font-family:${SORA_STACK};font-weight:800;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:${PAPER};background:${INK};padding:14px 26px;text-decoration:none;border:2px solid ${INK};">See the full breakdown →</a>
    <div style="margin-top:14px;font-family:${MANROPE_STACK};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${SUBDUED};">Next print: Round ${String((Number(round) || 0) + 1).padStart(2, "0")} · Lock window opens Thursday</div>
  </div>`;

  return shell({
    title: `${safeRaceName} · Round ${round} results`,
    preview: `Round ${round} · ${numericScore} pts filed for ${safeRaceName}.`,
    posterHtml,
    placardHtml,
    extraHtml,
    unsubscribeUrl,
    siteUrl,
  });
}

export default { meta, welcomeHtml, resultsHtml };
