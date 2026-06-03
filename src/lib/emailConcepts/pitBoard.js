// Concept: Pit Board
// Full-lean F1 garage / timing screen aesthetic. Dark navy substrate, structured
// data blocks, monospace where the figure IS the message (round code, score,
// lap-time-like figures). Header reads like a control panel: round code, date
// stamp, race name, status pill, big logo + vertical hairline divider.
//
// Inline styles only. No <style> blocks. No @font-face. Tables used where they
// help layout. Max width 600px. Dark.

export const meta = {
  name: "Pit Board",
  description:
    "Garage timing-screen aesthetic — round code header, monospace data blocks, sector-color score readout. Every pixel earns its place.",
  promotionsRisk: "medium",
};

// ─── Tokens (literal hex — email clients don't read CSS vars) ────────────────
const BG_BASE = "#06101B";
const BG_PANEL = "#0B1828";
const BG_DATA = "#0E1F31";
const BG_DATA_ALT = "#0A1726";
const HAIRLINE = "rgba(255,255,255,0.08)";
const HAIRLINE_HARD = "rgba(255,255,255,0.14)";
const ACCENT = "#FF6A1A";
const SECTOR_GREEN = "#22C55E";
const SECTOR_PURPLE = "#A855F7";
const SECTOR_YELLOW = "#FFC247";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_MUTED = "rgba(255,255,255,0.62)";
const TEXT_DIM = "rgba(255,255,255,0.42)";
const TEXT_SUBTLE = "rgba(255,255,255,0.28)";

const FONT_BODY =
  "'Helvetica Neue',Helvetica,Arial,sans-serif";
const FONT_MONO =
  "'SF Mono','Menlo','Consolas','Liberation Mono','Courier New',monospace";

const LOGO_URL = "https://www.stint-web.com/images/logo-primary.png";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n) {
  const s = String(n);
  return s.length < 2 ? "0" + s : s;
}

function roundCode(n) {
  return "R" + pad2(Number.isFinite(n) ? n : 0);
}

// UTC date stamp like "02 JUN 2026 · 14:32 UTC" — feels like a sector readout
function stamp() {
  const d = new Date();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const day = pad2(d.getUTCDate());
  const mon = months[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  const hh = pad2(d.getUTCHours());
  const mm = pad2(d.getUTCMinutes());
  return `${day} ${mon} ${yr} · ${hh}:${mm} UTC`;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Control-panel header. Logo (~40px) + vertical hairline + stack of meta.
// statusPill: { label, color } — e.g. { label: "LOADED", color: SECTOR_GREEN }
function header({ roundLabel, contextLine, statusPill }) {
  const pill = statusPill
    ? `<span style="display:inline-block;padding:3px 8px;border:1px solid ${statusPill.color};color:${statusPill.color};font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;border-radius:2px;">${escapeHtml(statusPill.label)}</span>`
    : "";

  return `
    <tr>
      <td style="padding:0;background:${BG_PANEL};border-bottom:1px solid ${HAIRLINE_HARD};">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
          <tr>
            <td style="padding:18px 22px;vertical-align:middle;width:1%;white-space:nowrap;">
              <img src="${LOGO_URL}" height="40" alt="Stint" style="display:block;height:40px;width:auto;border:0;outline:none;text-decoration:none;" />
            </td>
            <td style="padding:18px 0;vertical-align:middle;width:1%;">
              <div style="width:1px;height:44px;background:${HAIRLINE_HARD};margin:0 18px;line-height:1px;font-size:1px;">&nbsp;</div>
            </td>
            <td style="padding:18px 22px 18px 0;vertical-align:middle;">
              <div style="font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.18em;color:${TEXT_DIM};text-transform:uppercase;margin-bottom:4px;">
                ${escapeHtml(roundLabel)} &nbsp;·&nbsp; ${stamp()}
              </div>
              <div style="font-family:${FONT_BODY};font-size:14px;font-weight:700;letter-spacing:-0.01em;color:${TEXT_PRIMARY};line-height:1.25;">
                ${escapeHtml(contextLine)}
              </div>
            </td>
            <td align="right" style="padding:18px 22px;vertical-align:middle;width:1%;white-space:nowrap;">
              ${pill}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// A two-column data row inside a data block — label (mono, dim) | value (mono or sans, bright)
function dataRow(label, value, opts = {}) {
  const { valueColor = TEXT_PRIMARY, valueMono = false, alt = false, accentDot = null } = opts;
  const bg = alt ? BG_DATA_ALT : BG_DATA;
  const valueFont = valueMono ? FONT_MONO : FONT_BODY;
  const dot = accentDot
    ? `<span style="display:inline-block;width:6px;height:6px;background:${accentDot};margin-right:8px;vertical-align:middle;line-height:1;"></span>`
    : "";
  return `
    <tr>
      <td style="padding:11px 16px;background:${bg};border-bottom:1px solid ${HAIRLINE};font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.16em;color:${TEXT_DIM};text-transform:uppercase;width:38%;vertical-align:middle;">
        ${escapeHtml(label)}
      </td>
      <td align="right" style="padding:11px 16px;background:${bg};border-bottom:1px solid ${HAIRLINE};font-family:${valueFont};font-size:13px;font-weight:700;letter-spacing:${valueMono ? "0" : "-0.01em"};color:${valueColor};vertical-align:middle;">
        ${dot}${value}
      </td>
    </tr>
  `;
}

// Data block title strip — "TELEMETRY · ACCOUNT" style
function blockTitle(text, accent = ACCENT) {
  return `
    <tr>
      <td style="padding:16px 16px 8px;background:${BG_PANEL};">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
          <tr>
            <td style="width:8px;background:${accent};font-size:1px;line-height:1px;">&nbsp;</td>
            <td style="padding:0 0 0 10px;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.2em;color:${TEXT_MUTED};text-transform:uppercase;">
              ${escapeHtml(text)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// CTA — sharp rectangular pit-board button, not a rounded pill
function pitButton(label, href) {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;margin:4px 0 0;">
      <tr>
        <td style="background:${ACCENT};">
          <a href="${href}" style="display:inline-block;padding:14px 22px;font-family:${FONT_BODY};font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#0A0E14;text-decoration:none;">
            ${escapeHtml(label)} &nbsp;→
          </a>
        </td>
      </tr>
    </table>
  `;
}

function secondaryLink(label, href) {
  return `<a href="${href}" style="font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${TEXT_MUTED};text-decoration:none;border-bottom:1px solid ${HAIRLINE_HARD};padding-bottom:2px;">${escapeHtml(label)}</a>`;
}

function footer({ unsubscribeUrl, siteUrl, category }) {
  const unsubLabel = category ? `Unsubscribe from ${category}` : "Unsubscribe";
  const unsubBlock = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:${TEXT_MUTED};text-decoration:none;border-bottom:1px solid ${HAIRLINE_HARD};">${unsubLabel}</a> &nbsp;·&nbsp; `
    : "";
  return `
    <tr>
      <td style="padding:18px 22px 22px;background:${BG_PANEL};border-top:1px solid ${HAIRLINE_HARD};">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
          <tr>
            <td style="font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.18em;color:${TEXT_DIM};text-transform:uppercase;padding-bottom:8px;">
              STINT · F1 PREDICTIONS · ${stamp()}
            </td>
          </tr>
          <tr>
            <td style="font-family:${FONT_BODY};font-size:11px;color:${TEXT_DIM};line-height:1.65;">
              You're receiving this because you have a Stint account.<br />
              ${unsubBlock}<a href="${siteUrl}/privacy" style="color:${TEXT_MUTED};text-decoration:none;border-bottom:1px solid ${HAIRLINE_HARD};">Privacy</a>
            </td>
          </tr>
          <tr>
            <td style="padding-top:10px;font-family:${FONT_BODY};font-size:10px;color:${TEXT_SUBTLE};line-height:1.6;">
              Stint is an independent prediction platform and is not affiliated with, endorsed by, or officially connected to Formula 1, FIA, or any F1 team.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// Document shell — dark page, 600px centered panel, no rounded corners (pit boards don't round)
function shell({ title, previewText, innerRows }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="dark only" />
<meta name="supported-color-schemes" content="dark only" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG_BASE};font-family:${FONT_BODY};color:${TEXT_PRIMARY};-webkit-font-smoothing:antialiased;">
<span style="display:none;font-size:1px;color:${BG_BASE};max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(previewText)}</span>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BG_BASE};border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:24px 12px 32px;">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;max-width:600px;background:${BG_PANEL};border:1px solid ${HAIRLINE_HARD};border-collapse:collapse;">
        ${innerRows}
      </table>
      <div style="font-family:${FONT_MONO};font-size:9px;font-weight:700;letter-spacing:0.22em;color:${TEXT_SUBTLE};text-transform:uppercase;padding-top:14px;">
        // END TRANSMISSION
      </div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ─── Welcome ─────────────────────────────────────────────────────────────────
// Shows the user's "loaded" state — account provisioned, team affiliation,
// auto-enrolled league. Dense, three data blocks, one CTA.

export function welcomeHtml({ username, favoriteTeam, unsubscribeUrl, siteUrl }) {
  const name = username || "Manager";
  const team = favoriteTeam || "Unassigned";
  const site = siteUrl || "https://www.stint-web.com";
  const title = `Stint // ${name} loaded`;
  const previewText = `Account provisioned. Team: ${team}. Stint Community league joined.`;

  const accountBlock = `
    ${blockTitle("Telemetry · Account", SECTOR_GREEN)}
    <tr><td style="padding:8px 16px 16px;background:${BG_PANEL};">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border:1px solid ${HAIRLINE_HARD};">
        ${dataRow("Driver", escapeHtml(name), { valueMono: false })}
        ${dataRow("Status", "PROVISIONED", { valueMono: true, valueColor: SECTOR_GREEN, accentDot: SECTOR_GREEN, alt: true })}
        ${dataRow("Team Affiliation", escapeHtml(team), { valueMono: false })}
        ${dataRow("Auto-Enrolled", "Stint Community", { valueMono: false, valueColor: ACCENT, alt: true })}
        ${dataRow("Account Tier", "FREE", { valueMono: true })}
      </table>
    </td></tr>
  `;

  const briefingBlock = `
    ${blockTitle("Race-Week Briefing", SECTOR_YELLOW)}
    <tr><td style="padding:8px 16px 4px;background:${BG_PANEL};">
      <p style="margin:0 0 14px;font-family:${FONT_BODY};font-size:14px;line-height:1.55;color:${TEXT_MUTED};">
        You're in. Account live, Community league joined — every other Stint user is in there, so you're already racing. ${favoriteTeam ? `Picks will get the ${escapeHtml(favoriteTeam)} colour treatment.` : "Pick a team in your profile to colour your picks."}
      </p>
    </td></tr>
  `;

  const procedureBlock = `
    ${blockTitle("Procedure · First Three Actions", ACCENT)}
    <tr><td style="padding:8px 16px 16px;background:${BG_PANEL};">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border:1px solid ${HAIRLINE_HARD};">
        <tr>
          <td style="padding:12px 14px;background:${BG_DATA};border-bottom:1px solid ${HAIRLINE};vertical-align:top;width:42px;font-family:${FONT_MONO};font-size:11px;font-weight:700;color:${ACCENT};letter-spacing:0.08em;">01</td>
          <td style="padding:12px 14px;background:${BG_DATA};border-bottom:1px solid ${HAIRLINE};vertical-align:top;">
            <div style="font-family:${FONT_BODY};font-size:13px;font-weight:800;color:${TEXT_PRIMARY};letter-spacing:-0.01em;margin-bottom:2px;">Lock in your race picks</div>
            <div style="font-family:${FONT_BODY};font-size:12px;color:${TEXT_MUTED};line-height:1.5;">Pole, winner, podium, fastest lap, DNF — six picks before quali.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 14px;background:${BG_DATA_ALT};border-bottom:1px solid ${HAIRLINE};vertical-align:top;font-family:${FONT_MONO};font-size:11px;font-weight:700;color:${ACCENT};letter-spacing:0.08em;">02</td>
          <td style="padding:12px 14px;background:${BG_DATA_ALT};border-bottom:1px solid ${HAIRLINE};vertical-align:top;">
            <div style="font-family:${FONT_BODY};font-size:13px;font-weight:800;color:${TEXT_PRIMARY};letter-spacing:-0.01em;margin-bottom:2px;">Spin up a private league</div>
            <div style="font-family:${FONT_BODY};font-size:12px;color:${TEXT_MUTED};line-height:1.5;">Six-character code. Your settings, your scoring, your bragging rights.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 14px;background:${BG_DATA};vertical-align:top;font-family:${FONT_MONO};font-size:11px;font-weight:700;color:${ACCENT};letter-spacing:0.08em;">03</td>
          <td style="padding:12px 14px;background:${BG_DATA};vertical-align:top;">
            <div style="font-family:${FONT_BODY};font-size:13px;font-weight:800;color:${TEXT_PRIMARY};letter-spacing:-0.01em;margin-bottom:2px;">Read the race-week brief</div>
            <div style="font-family:${FONT_BODY};font-size:12px;color:${TEXT_MUTED};line-height:1.5;">AI-powered storylines refreshed each round. Free for everyone.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  `;

  const ctaBlock = `
    <tr><td style="padding:8px 16px 22px;background:${BG_PANEL};">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;">
            ${pitButton("Open Stint", site)}
          </td>
          <td align="right" style="vertical-align:middle;">
            ${secondaryLink("View Pro", `${site}/pro`)}
          </td>
        </tr>
      </table>
    </td></tr>
  `;

  const innerRows =
    header({
      roundLabel: "SYS · ONBOARD",
      contextLine: "Account provisioned — Stint Community joined",
      statusPill: { label: "LOADED", color: SECTOR_GREEN },
    }) +
    accountBlock +
    briefingBlock +
    procedureBlock +
    ctaBlock +
    footer({ unsubscribeUrl, siteUrl: site, category: "all Stint emails" });

  return shell({ title, previewText, innerRows });
}

// ─── Results ─────────────────────────────────────────────────────────────────
// Score rendered like a sector time — big monospace figure, dense surrounding
// telemetry, sector color signals (purple for personal-best feel when score>0,
// yellow neutral when zero). Best pick block when present.

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
  const site = siteUrl || "https://www.stint-web.com";
  const safeRace = escapeHtml(raceName || "Race");
  const safeCountry = raceCountry ? escapeHtml(raceCountry) : "";
  const safeScore = Number.isFinite(score) ? score : 0;
  const scored = safeScore > 0;

  const title = `${safeRace} // ${safeScore} PTS`;
  const previewText = scored
    ? `Result posted. ${safeScore} pts ${bestPick && bestPick.points > 0 ? `· top pick ${escapeHtml(bestPick.value)}` : ""}`
    : `Result posted. No points this round. Next out-lap loading.`;

  const statusPill = scored
    ? { label: "POSTED", color: SECTOR_PURPLE }
    : { label: "POSTED", color: SECTOR_YELLOW };

  const accentForScore = scored ? SECTOR_PURPLE : SECTOR_YELLOW;
  const scoreFigure = String(safeScore).padStart(2, "0");

  // Sector-time-style score: massive monospace figure flanked by mono telemetry strip.
  const scoreBlock = `
    ${blockTitle("Result · Round Score", accentForScore)}
    <tr><td style="padding:8px 16px 16px;background:${BG_PANEL};">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border:1px solid ${HAIRLINE_HARD};background:${BG_DATA};">
        <tr>
          <td style="padding:18px 18px 14px;border-bottom:1px solid ${HAIRLINE};">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align:bottom;">
                  <div style="font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.18em;color:${TEXT_DIM};text-transform:uppercase;margin-bottom:6px;">
                    ${roundCode(raceRound)} · ${safeRace}${safeCountry ? " · " + safeCountry : ""} · Final
                  </div>
                  <div style="font-family:${FONT_MONO};font-size:56px;font-weight:700;letter-spacing:-0.04em;color:${accentForScore};line-height:0.95;">
                    ${scoreFigure}<span style="font-size:18px;font-weight:700;letter-spacing:0.14em;color:${TEXT_MUTED};margin-left:10px;vertical-align:middle;">PTS</span>
                  </div>
                </td>
                <td align="right" style="vertical-align:bottom;width:1%;white-space:nowrap;">
                  <div style="display:inline-block;padding:6px 10px;border:1px solid ${accentForScore};font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.16em;color:${accentForScore};text-transform:uppercase;">
                    ${scored ? "Δ +" + safeScore : "Δ 0"}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${dataRow("Driver", escapeHtml(name))}
        ${dataRow("Round", `${roundCode(raceRound)}${safeCountry ? " · " + safeCountry : ""}`, { valueMono: true, alt: true })}
        ${dataRow("Status", scored ? "SCORED" : "ZERO", { valueMono: true, valueColor: accentForScore, accentDot: accentForScore })}
      </table>
    </td></tr>
  `;

  const bestPickBlock = bestPick && bestPick.points > 0
    ? `
      ${blockTitle("Sector · Top Pick", SECTOR_GREEN)}
      <tr><td style="padding:8px 16px 16px;background:${BG_PANEL};">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border:1px solid ${HAIRLINE_HARD};">
          <tr>
            <td style="padding:14px 16px;background:${BG_DATA};border-bottom:1px solid ${HAIRLINE};">
              <div style="font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.18em;color:${TEXT_DIM};text-transform:uppercase;margin-bottom:4px;">
                ${escapeHtml(String(bestPick.type || "pick").replace(/_/g, " "))}
              </div>
              <div style="font-family:${FONT_BODY};font-size:17px;font-weight:800;letter-spacing:-0.01em;color:${TEXT_PRIMARY};line-height:1.2;">
                ${escapeHtml(bestPick.value)}
              </div>
            </td>
            <td align="right" style="padding:14px 16px;background:${BG_DATA};border-bottom:1px solid ${HAIRLINE};width:1%;white-space:nowrap;vertical-align:middle;">
              <div style="font-family:${FONT_MONO};font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${SECTOR_GREEN};line-height:1;">
                +${bestPick.points}
              </div>
              <div style="font-family:${FONT_MONO};font-size:9px;font-weight:700;letter-spacing:0.18em;color:${TEXT_DIM};text-transform:uppercase;margin-top:2px;">PTS</div>
            </td>
          </tr>
        </table>
      </td></tr>
    `
    : `
      ${blockTitle("Sector · Top Pick", SECTOR_YELLOW)}
      <tr><td style="padding:8px 16px 16px;background:${BG_PANEL};">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border:1px solid ${HAIRLINE_HARD};">
          <tr>
            <td style="padding:14px 16px;background:${BG_DATA};">
              <div style="font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.18em;color:${SECTOR_YELLOW};text-transform:uppercase;margin-bottom:4px;">No scoring pick</div>
              <div style="font-family:${FONT_BODY};font-size:13px;color:${TEXT_MUTED};line-height:1.5;">
                Nothing landed this round. Full breakdown in your dashboard — reset for the next out-lap.
              </div>
            </td>
          </tr>
        </table>
      </td></tr>
    `;

  const ctaBlock = `
    <tr><td style="padding:8px 16px 22px;background:${BG_PANEL};">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;">
            ${pitButton("View Breakdown", `${site}/picks`)}
          </td>
          <td align="right" style="vertical-align:middle;">
            ${secondaryLink("Standings", `${site}/leagues`)}
          </td>
        </tr>
      </table>
    </td></tr>
  `;

  const innerRows =
    header({
      roundLabel: `${roundCode(raceRound)} · RESULT`,
      contextLine: `${safeRace}${safeCountry ? " · " + safeCountry : ""}`,
      statusPill,
    }) +
    scoreBlock +
    bestPickBlock +
    ctaBlock +
    footer({ unsubscribeUrl, siteUrl: site, category: "results emails" });

  return shell({ title, previewText, innerRows });
}
