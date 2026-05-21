import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAdminUser } from "@/src/constants/design";
import { WC_GROUPS, WC_TEAM_BY_CODE, WC_TEAMS, WC_TOURNAMENT_START } from "@/src/constants/wc/teams";
import { wcStageLabel, wcMatchTeams } from "@/src/constants/wc/fixtures";
import { WC_THEME } from "@/src/constants/wc/theme";
import { formatWcDate, formatWcShortDate, wcSlugLabel } from "@/src/lib/wc/format";
import { buildWcGroupTables, buildWcThirdPlaceTable } from "@/src/lib/wc/scoring";
import usePageMetadata from "@/src/lib/usePageMetadata";
import useViewport from "@/src/lib/useViewport";
import {
  createWcLeague,
  fetchWcBootstrap,
  fetchWcLeagueStandings,
  fetchWcMatchConsensus,
  fetchWcSurvivor,
  joinWcLeague,
  kickWcLeagueMember,
  leaveWcLeague,
  publishWcResult,
  rescoreWc,
  resetWcPlatform,
  saveWcBracket,
  saveWcMatchPick,
  saveWcSurvivorPick,
  syncWcFixtures,
  updateWcMatch,
} from "@/src/features/wc/wcApi";
import { WC_SURVIVOR_ROUNDS, WC_SURVIVOR_ROUND_KEYS, matchInSurvivorRound } from "@/src/lib/wc/survivor";

const FLAG_OFFSET = 0x1f1e6 - "A".charCodeAt(0);

// Unicode "subdivision flag" sequences for UK constituent countries:
//   🏴 (U+1F3F4) + lowercase tag letters for region + cancel tag (U+E007F).
// Tag letter for 'a' = U+E0061, etc. This is the proper way to render
// Scotland / England / Wales flags as a single emoji glyph.
const TAG_BASE = 0xe0000;
function subdivisionFlag(...lowerLetters) {
  const codepoints = [0x1f3f4, ...lowerLetters.map((ch) => TAG_BASE + ch.charCodeAt(0)), 0xe007f];
  return String.fromCodePoint(...codepoints);
}

const WC_SUBDIVISION_FLAGS = {
  "GB-SCT": subdivisionFlag("g", "b", "s", "c", "t"),
  "GB-ENG": subdivisionFlag("g", "b", "e", "n", "g"),
  "GB-WLS": subdivisionFlag("g", "b", "w", "l", "s"),
};

function wcFlagEmoji(code) {
  if (!code) return "";
  const raw = String(code);
  const upper = raw.toUpperCase();
  if (WC_SUBDIVISION_FLAGS[upper]) return WC_SUBDIVISION_FLAGS[upper];
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  return String.fromCodePoint(upper.charCodeAt(0) + FLAG_OFFSET, upper.charCodeAt(1) + FLAG_OFFSET);
}

function wcTeamFlag(teamCode) {
  if (!teamCode) return "";
  const team = WC_TEAM_BY_CODE[teamCode];
  return wcFlagEmoji(team?.flag);
}

function wcCountdown(value) {
  if (!value) return "TBD";
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return "TBD";
  const delta = target - Date.now();
  if (delta <= 0) return "Now";
  const minutes = Math.floor(delta / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

const WC_BRACKET_BUCKETS = [
  ["groupWinners", 12, "group winners"],
  ["groupRunnersUp", 12, "runners-up"],
];

const WC_PAGE_TITLES = {
  "wc-fixtures": "WC Home",
  "wc-picks": "WC Predict",
  "wc-bracket": "WC Bracket",
  "wc-survivor": "WC Survivor",
  "wc-leagues": "WC Leagues",
  "wc-profile": "WC Profile",
  "wc-admin": "WC Admin",
};

const viewByPage = {
  "wc-fixtures": "home",
  "wc-picks": "picks",
  "wc-bracket": "bracket",
  "wc-survivor": "survivor",
  "wc-leagues": "leagues",
  "wc-profile": "profile",
  "wc-admin": "admin",
};

function isLocked(value) {
  return value ? new Date(value).getTime() <= Date.now() : false;
}

function byMatchNumber(left, right) {
  return Number(left.match_number || 0) - Number(right.match_number || 0);
}

function Field({ label, value, onChange, type = "text", min, max, disabled = false, placeholder = "" }) {
  return (
    <label style={{ display: "grid", gap: 7, minWidth: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.subtle }}>{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        value={value ?? ""}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          minHeight: 42,
          borderRadius: 10,
          border: `1px solid ${WC_THEME.line}`,
          background: "rgba(2,18,11,0.72)",
          color: WC_THEME.text,
          padding: "0 12px",
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
        }}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return (
    <label style={{ display: "grid", gap: 7, minWidth: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.subtle }}>{label}</span>
      <select
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          minHeight: 42,
          borderRadius: 10,
          border: `1px solid ${WC_THEME.line}`,
          background: "rgba(2,18,11,0.72)",
          color: WC_THEME.text,
          padding: "0 12px",
          fontWeight: 800,
        }}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function WCPill({ children, tone = "neutral" }) {
  const color = tone === "gold" ? WC_THEME.accent : tone === "green" ? "#74D99F" : WC_THEME.muted;
  const bg = tone === "gold" ? "rgba(214,165,69,0.14)" : tone === "green" ? "rgba(116,217,159,0.12)" : "rgba(247,241,221,0.06)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        borderRadius: 999,
        border: `1px solid ${tone === "gold" ? "rgba(214,165,69,0.30)" : WC_THEME.line}`,
        background: bg,
        color,
        padding: "0 9px",
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

const WCCard = forwardRef(function WCCard({ children, style = {} }, ref) {
  return (
    <section
      ref={ref}
      style={{
        borderRadius: 16,
        border: `1px solid ${WC_THEME.line}`,
        background: "linear-gradient(180deg,rgba(247,241,221,0.045),rgba(7,28,17,0.94))",
        boxShadow: "0 24px 70px rgba(0,0,0,0.30), inset 0 1px 0 rgba(247,241,221,0.05)",
        ...style,
      }}
    >
      {children}
    </section>
  );
});

function MatchRow({ match, prediction, onPick, compact = false }) {
  const teams = wcMatchTeams(match);
  const locked = isLocked(match.lock_at);
  const isCompleted = match.status === "completed" && match.home_score !== null && match.away_score !== null;
  const score = isCompleted ? `${match.home_score}–${match.away_score}` : formatWcDate(match.kickoff_at);

  return (
    <div className="wc-match-row">
      <div style={{ display: "grid", gap: 5, alignContent: "center" }}>
        <span className="wc-mnum">M{String(match.match_number).padStart(3, "0")}</span>
        <span style={{ fontSize: 10, color: WC_THEME.subtle, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", textAlign: "center" }}>
          {wcStageLabel(match.stage)}
        </span>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          {match.group_code && <WCPill tone="green">Group {match.group_code}</WCPill>}
          {isCompleted ? <WCPill tone="green">Result</WCPill> : locked ? <WCPill>Locked</WCPill> : <WCPill tone="gold">Open</WCPill>}
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ fontSize: compact ? 15 : 16, letterSpacing: "-0.02em", color: WC_THEME.text, display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            {wcTeamFlag(teams.home.code) && <span aria-hidden="true">{wcTeamFlag(teams.home.code)}</span>}
            <span>{teams.home.name}</span>
            <span style={{ color: WC_THEME.subtle, fontWeight: 700 }}>vs</span>
            {wcTeamFlag(teams.away.code) && <span aria-hidden="true">{wcTeamFlag(teams.away.code)}</span>}
            <span>{teams.away.name}</span>
          </strong>
          {!compact && (
            <span style={{ color: WC_THEME.muted, fontSize: 12, lineHeight: 1.5 }}>
              {match.venue || "Venue TBD"}{match.city ? ` · ${match.city}` : ""}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <div style={{ textAlign: "right" }}>
          <div data-num style={{ fontFamily: "var(--font-mono)", fontSize: compact ? 15 : 17, fontWeight: 900, color: isCompleted ? WC_THEME.text : WC_THEME.muted, whiteSpace: "nowrap" }}>
            {score}
          </div>
          {prediction ? (
            <div data-num style={{ marginTop: 3, fontSize: 11, color: prediction.points != null ? "#A7F3C7" : WC_THEME.muted, fontWeight: 700 }}>
              Pick {prediction.predicted_home_score}–{prediction.predicted_away_score}
              {prediction.points != null ? ` · ${prediction.points} pts` : ""}
            </div>
          ) : (
            <div style={{ marginTop: 3, fontSize: 11, color: WC_THEME.subtle, fontWeight: 700 }}>No pick yet</div>
          )}
        </div>
        {onPick && (
          <button type="button" className="stint-button-secondary" onClick={() => onPick(match)} style={{ minHeight: 38, padding: "0 14px", fontSize: 12, borderColor: "rgba(214,165,69,0.26)" }}>
            Pick
          </button>
        )}
      </div>
    </div>
  );
}

// Mini group table card — shows just the four teams with P, GD, Pts.
// Top two get the accent rank (qualifying). Third place is marked but
// not advancing here; the dedicated ThirdPlaceTable handles that race.
function MiniGroupCard({ group, rows }) {
  const padded = rows.length === 4 ? rows : WC_GROUPS[group].map((team, index) => {
    const existing = rows.find((row) => row.code === team.code);
    return existing || { code: team.code, name: team.name, played: 0, points: 0, gd: 0, seed: index + 1 };
  });
  return (
    <div className="wc-mini-group">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 900, color: WC_THEME.text, letterSpacing: "-0.01em" }}>Group {group}</div>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: WC_THEME.subtle }}>
          {padded.reduce((sum, row) => sum + row.played, 0)}/6 played
        </div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "14px 1fr 22px 28px 28px", gap: 6, color: WC_THEME.subtle, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <span />
          <span>Team</span>
          <span style={{ textAlign: "right" }}>P</span>
          <span style={{ textAlign: "right" }}>GD</span>
          <span style={{ textAlign: "right" }}>Pts</span>
        </div>
        {padded.slice(0, 4).map((row, index) => (
          <div key={row.code} style={{ display: "grid", gridTemplateColumns: "14px 1fr 22px 28px 28px", gap: 6, alignItems: "center", color: WC_THEME.muted, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ color: index < 2 ? WC_THEME.accent : WC_THEME.subtle, fontWeight: 900 }}>{index + 1}</span>
            <span style={{ color: WC_THEME.text, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}>
              {wcTeamFlag(row.code) && <span aria-hidden="true">{wcTeamFlag(row.code)}</span>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</span>
            </span>
            <span style={{ textAlign: "right" }}>{row.played}</span>
            <span style={{ textAlign: "right", color: row.gd > 0 ? "#A7F3C7" : row.gd < 0 ? "#FCA5A5" : WC_THEME.muted }}>
              {row.gd > 0 ? `+${row.gd}` : row.gd}
            </span>
            <span style={{ textAlign: "right", color: WC_THEME.text, fontWeight: 900 }}>{row.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Best 3rd-place race. WC 2026 advances the top 8 third-placed teams
// into the Round of 32, so the cut-line is highlighted with a divider.
function ThirdPlaceTable({ rows }) {
  if (!rows?.length) return null;
  return (
    <WCCard style={{ padding: 18, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.accent }}>Best third-place race</div>
          <div style={{ marginTop: 4, color: WC_THEME.muted, fontSize: 12 }}>Top 8 advance to the Round of 32.</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: WC_THEME.subtle }}>
          live · 12 teams
        </div>
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        <div className="wc-3rd-header">
          <span>Rk</span>
          <span>Team</span>
          <span style={{ textAlign: "right" }} className="wc-3rd-col-p">P</span>
          <span style={{ textAlign: "right" }}>GD</span>
          <span style={{ textAlign: "right" }}>Pts</span>
          <span style={{ textAlign: "right" }} />
        </div>
        {rows.map((row, index) => {
          const isCutLine = index === 7;
          return (
            <div
              key={row.code}
              className={`wc-3rd-row${row.advancing ? " is-advancing" : ""}${isCutLine ? " is-cut" : ""}`}
            >
              <span style={{ fontFamily: "var(--font-mono)", color: row.advancing ? "#A7F3C7" : WC_THEME.subtle, fontWeight: 900 }}>
                {row.rank}
              </span>
              <span style={{ color: WC_THEME.text, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {wcTeamFlag(row.code) && <span aria-hidden="true">{wcTeamFlag(row.code)}</span>}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</span>
                <span style={{ color: WC_THEME.subtle, fontSize: 11, fontWeight: 700 }}>· {row.group}</span>
              </span>
              <span className="wc-3rd-col-p" style={{ textAlign: "right", color: WC_THEME.muted, fontVariantNumeric: "tabular-nums" }}>{row.played}</span>
              <span style={{ textAlign: "right", color: row.gd > 0 ? "#A7F3C7" : row.gd < 0 ? "#FCA5A5" : WC_THEME.muted, fontVariantNumeric: "tabular-nums" }}>
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </span>
              <span style={{ textAlign: "right", color: WC_THEME.text, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{row.points}</span>
              <span style={{ textAlign: "right" }}>
                {row.advancing ? <WCPill tone="green">Through</WCPill> : <WCPill>Out</WCPill>}
              </span>
            </div>
          );
        })}
      </div>
    </WCCard>
  );
}

// Big mode card used on Home. Two of these — Predict and Survivor — are
// the only ways into the game from the landing. Styling lives in the
// .wc-mode-card class in index.css so hover/active/focus behave correctly
// on touch and don't fight React renders.
function ModeCard({ title, kicker, copy, ctaLabel, onSelect, accent = false }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="wc-mode-card"
      data-accent={accent ? "true" : "false"}
    >
      <div className="wc-mode-kicker">{kicker}</div>
      <h3 className="wc-mode-title">{title}</h3>
      <p className="wc-mode-copy">{copy}</p>
      <span className="wc-mode-cta">
        {ctaLabel}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

function HomeView({ matches, setPage, isMobile }) {
  const groups = useMemo(() => buildWcGroupTables(matches), [matches]);
  const thirdPlace = useMemo(() => buildWcThirdPlaceTable(groups), [groups]);
  const orderedGroups = Object.keys(WC_GROUPS);

  return (
    <div className="wc-stagger wc-home" style={{ display: "grid", gap: 22 }}>
      <div className="wc-mode-grid" style={{ "--wc-i": 0 }}>
        <ModeCard
          accent
          kicker="Game mode · 01"
          title="Predict every match"
          copy="Call the scoreline, the winner if it goes to pens, and the first scorer. Points scale up round by round."
          ctaLabel="Make picks"
          onSelect={() => setPage?.("wc-picks")}
        />
        <ModeCard
          kicker="Game mode · 02"
          title="Survive to the final"
          copy="One team per matchday and round. Win and you live another day — draw or lose and you're out for good."
          ctaLabel="Open survivor"
          onSelect={() => setPage?.("wc-survivor")}
        />
      </div>

      <div style={{ "--wc-i": 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.accent }}>
            Group tables
          </div>
          <div style={{ color: WC_THEME.subtle, fontSize: 11, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" }}>
            12 groups · 48 teams
          </div>
        </div>
        <div className="wc-group-board">
          {orderedGroups.map((group) => (
            <MiniGroupCard
              key={group}
              group={group}
              rows={groups[group] || []}
            />
          ))}
        </div>
      </div>

      <div style={{ "--wc-i": 2 }}>
        <ThirdPlaceTable rows={thirdPlace} />
      </div>
    </div>
  );
}

function UpcomingStripe({ matches, predictionByMatch, setPage, isMobile }) {
  const upcoming = useMemo(() => {
    const horizon = Date.now() + 30 * 60 * 60 * 1000; // next 30 hours
    return matches
      .filter((match) => match.kickoff_at && new Date(match.kickoff_at).getTime() > Date.now() && new Date(match.kickoff_at).getTime() < horizon)
      .slice(0, 8);
  }, [matches]);

  if (!upcoming.length) return null;

  return (
    <section style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.accent }}>
          <span className="wc-pulse" aria-hidden="true" />
          Locking soon
        </div>
        <span style={{ color: WC_THEME.subtle, fontSize: 11, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" }}>
          {upcoming.length} match{upcoming.length === 1 ? "" : "es"}
        </span>
      </div>
      <div className="wc-strip" style={{ paddingBottom: 6 }}>
        {upcoming.map((match) => {
          const teams = wcMatchTeams(match);
          const prediction = predictionByMatch.get(match.id);
          return (
            <button
              type="button"
              key={match.id}
              onClick={() => setPage?.("wc-picks")}
              className="wc-mini-group"
              style={{
                width: isMobile ? 260 : 280,
                cursor: "pointer",
                textAlign: "left",
                gap: 6,
                borderColor: prediction ? "rgba(116,217,159,0.32)" : undefined,
                background: prediction ? "linear-gradient(180deg, rgba(116,217,159,0.10), rgba(7,28,17,0.94))" : undefined,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", color: WC_THEME.accent, fontFamily: "var(--font-mono)", fontWeight: 900, fontSize: 11, letterSpacing: "0.06em" }}>
                <span data-num>{wcCountdown(match.kickoff_at)}</span>
                <span style={{ color: WC_THEME.subtle }}>·</span>
                <span style={{ color: WC_THEME.muted, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>{wcStageLabel(match.stage)}{match.group_code ? ` ${match.group_code}` : ""}</span>
              </div>
              <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {wcTeamFlag(teams.home.code) && <span aria-hidden="true">{wcTeamFlag(teams.home.code)}</span>}
                <span>{teams.home.name}</span>
                <span style={{ color: WC_THEME.subtle, fontWeight: 700 }}>vs</span>
                {wcTeamFlag(teams.away.code) && <span aria-hidden="true">{wcTeamFlag(teams.away.code)}</span>}
                <span>{teams.away.name}</span>
              </div>
              <div style={{ fontSize: 11, color: prediction ? "#A7F3C7" : WC_THEME.muted, fontWeight: 700 }}>
                {prediction
                  ? `Pick ${prediction.predicted_home_score}–${prediction.predicted_away_score}${prediction.points != null ? ` · ${prediction.points} pts` : " · saved"}`
                  : "Tap to pick"}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Per-tab scoring card. Collapsible (<details>) so users can hide it.
// Lives at the top of Predict / Survivor / Bracket views and shows
// ONLY the rules relevant to that mode — same broadcast-strip styling
// in each so the WC area feels cohesive.
const WC_SCORING_CONTENT = {
  predict: {
    kicker: "How scoring works · Predict",
    title: "Outcome, exact score, goalscorer",
    items: [
      { label: "Group", title: "3 · +2 · +2", body: "3 for the correct result, +2 for exact score, +2 for a correct scorer. +1 if you nail goal difference." },
      { label: "Round of 32", title: "5 · +3 · +3", body: "Pick the advancer, exact 90-minute scoreline, and one correct scorer." },
      { label: "Round of 16", title: "7 · +3 · +3", body: "Same shape, more points — the field is half its size." },
      { label: "Quarterfinal", title: "10 · +4 · +4", body: "Eight teams left. Every read counts." },
      { label: "Semifinal", title: "15 · +5 · +5", body: "Two matches that define the tournament." },
      { label: "Third place", title: "8 · +3 · +3", body: "The consolation game still pays out." },
      { label: "Final", title: "25 · +10 · +10", body: "The biggest single-match payout of the bracket." },
    ],
    foot: "Picks lock at kickoff. Your winner pick covers extra time and penalties on knockouts.",
  },
  survivor: {
    kicker: "How scoring works · Survivor",
    title: "One team per round. Survive deep, score big.",
    items: [
      { label: "Matchday 1", title: "3 pts", body: "Pick one team to win in the opening matchday. Each team usable once across the whole tournament." },
      { label: "Matchday 2", title: "3 pts", body: "Second group fixture for every team. Pick someone new." },
      { label: "Matchday 3", title: "3 pts", body: "Final group games. Group winners often rotate — choose carefully." },
      { label: "Round of 32", title: "5 pts", body: "Knockouts start. Win = stay alive, draw or loss = out." },
      { label: "Round of 16", title: "8 pts", body: "Sixteen teams. Each pick narrows the field." },
      { label: "Quarterfinal", title: "12 pts", body: "Eight teams. Survivors thin out fast." },
      { label: "Semifinal", title: "18 pts", body: "Two semis — if you're still alive, this is the run." },
      { label: "Final", title: "30 pts", body: "Last pick of the tournament. Last survivor wins." },
    ],
    foot: "A draw or a loss eliminates you for the rest of the tournament. Each team can be used at most once.",
  },
  bracket: {
    kicker: "How scoring works · Bracket",
    title: "Tournament-wide calls, paid out once",
    items: [
      { label: "Group qualifier", title: "+2 each", body: "Every team you pick to advance from a group earns 2 points (winner or runner-up — both count)." },
      { label: "Exact group winner", title: "+2 each", body: "Bonus when you nail the actual group winner, not just a qualifier." },
      { label: "Champion", title: "+20", body: "Predict the World Cup champion before the tournament locks." },
      { label: "Golden Boot", title: "+12", body: "Tournament top scorer. One name, exact match." },
      { label: "Golden Ball", title: "+12", body: "Tournament MVP. One name, exact match." },
    ],
    foot: "Bracket locks at the opening kickoff. After that, all scoring is settled when the final whistle blows on the final.",
  },
};

function ScoringRulesCard({ mode = "predict", defaultOpen = false }) {
  const content = WC_SCORING_CONTENT[mode] || WC_SCORING_CONTENT.predict;
  return (
    <details className="wc-scoring-panel" open={defaultOpen}>
      <summary className="wc-scoring-summary">
        <div className="wc-scoring-summary-text">
          <div className="wc-scoring-kicker">{content.kicker}</div>
          <div className="wc-scoring-title-line">{content.title}</div>
        </div>
        <div className="wc-scoring-summary-trail">
          <span className="wc-scoring-lock">Picks lock at kickoff</span>
          <svg className="wc-scoring-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3.5 5L7 8.5L10.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </summary>
      <div className="wc-scoring-body">
        <div className="wc-scoring-grid">
          {content.items.map((item) => (
            <div className="wc-scoring-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
        <div className="wc-scoring-foot">{content.foot}</div>
      </div>
    </details>
  );
}

function ConsensusPanel({ matchId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchWcMatchConsensus(matchId)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load consensus.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (loading) {
    return <div style={{ fontSize: 12, color: WC_THEME.subtle }}>Loading consensus...</div>;
  }
  if (error) {
    return <div style={{ fontSize: 12, color: "#FCA5A5" }}>{error}</div>;
  }
  if (!data || !data.total) {
    return <div style={{ fontSize: 12, color: WC_THEME.muted }}>Be the first to predict this match.</div>;
  }

  const outcomes = data.outcomes || { home: 0, draw: 0, away: 0 };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", color: WC_THEME.muted, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <span>Crowd consensus</span>
        <span>{data.total} pick{data.total === 1 ? "" : "s"}{data.match?.locked ? "" : " · live counts"}</span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", border: `1px solid ${WC_THEME.line}`, background: "rgba(2,18,11,0.55)" }}>
        <div style={{ width: `${outcomes.home}%`, background: WC_THEME.accent }} title={`Home ${outcomes.home}%`} />
        <div style={{ width: `${outcomes.draw}%`, background: "rgba(247,241,221,0.32)" }} title={`Draw ${outcomes.draw}%`} />
        <div style={{ width: `${outcomes.away}%`, background: "#5BB781" }} title={`Away ${outcomes.away}%`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontSize: 11, color: WC_THEME.muted }}>
        <div><span style={{ color: WC_THEME.accent, fontWeight: 900 }}>{outcomes.home}%</span> Home</div>
        <div style={{ textAlign: "center" }}><span style={{ color: WC_THEME.text, fontWeight: 900 }}>{outcomes.draw}%</span> Draw</div>
        <div style={{ textAlign: "right" }}><span style={{ color: "#A7F3C7", fontWeight: 900 }}>{outcomes.away}%</span> Away</div>
      </div>
      {data.averageHome != null && (
        <div style={{ fontSize: 11, color: WC_THEME.subtle }}>
          Average scoreline: <span style={{ color: WC_THEME.text, fontWeight: 800, fontFamily: "var(--font-mono)" }}>{data.averageHome}–{data.averageAway}</span>
        </div>
      )}
      {data.scorelines?.length > 0 && (
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: WC_THEME.subtle }}>Popular picks</div>
          {data.scorelines.map((row) => (
            <div key={row.scoreline} style={{ display: "grid", gridTemplateColumns: "44px 1fr 36px", gap: 8, alignItems: "center", fontSize: 12, color: WC_THEME.muted }}>
              <span style={{ fontFamily: "var(--font-mono)", color: WC_THEME.text, fontWeight: 900 }}>{row.scoreline}</span>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(247,241,221,0.06)", overflow: "hidden" }}>
                <div style={{ width: `${row.pct}%`, height: "100%", background: WC_THEME.accent }} />
              </div>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PicksView({ user, openAuth, matches, predictions, onSaved, setPage, isMobile }) {
  const [activeMatch, setActiveMatch] = useState(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [winner, setWinner] = useState("");
  const [scorer, setScorer] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const slipRef = useRef(null);
  const predictionByMatch = useMemo(() => new Map((predictions || []).map((prediction) => [prediction.match_id, prediction])), [predictions]);
  const openMatches = useMemo(
    () => matches
      .filter((match) => !isLocked(match.lock_at))
      .sort((left, right) => new Date(left.kickoff_at || 0) - new Date(right.kickoff_at || 0)),
    [matches]
  );
  const totalOpen = openMatches.length;

  const selectMatch = useCallback((match) => {
    const prediction = predictionByMatch.get(match.id);
    setActiveMatch(match);
    setHomeScore(prediction?.predicted_home_score ?? "");
    setAwayScore(prediction?.predicted_away_score ?? "");
    setWinner(prediction?.predicted_winner_team_code || "");
    setScorer(prediction?.predicted_scorer_name || "");
    setNote("");
    if (isMobile && slipRef.current) {
      requestAnimationFrame(() => {
        slipRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [predictionByMatch, isMobile]);

  const savePick = async () => {
    if (!user) {
      openAuth?.("register", { page: "wc-picks" });
      return;
    }
    if (!activeMatch) return;
    setSaving(true);
    setNote("");
    try {
      const payload = await saveWcMatchPick({
        matchId: activeMatch.id,
        predictedHomeScore: homeScore,
        predictedAwayScore: awayScore,
        predictedWinnerTeamCode: winner,
        predictedScorerName: scorer.trim() || null,
      });
      onSaved(payload.prediction);
      setNote("WC pick saved.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not save WC pick.");
    } finally {
      setSaving(false);
    }
  };

  const teams = activeMatch ? wcMatchTeams(activeMatch) : null;
  const knockout = activeMatch?.stage && activeMatch.stage !== "group";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <ScoringRulesCard mode="predict" />
      <UpcomingStripe matches={matches} predictionByMatch={predictionByMatch} setPage={setPage} isMobile={isMobile} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 360px", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 12 }}>
          <WCCard style={{ overflow: "hidden" }}>
            {openMatches.length ? openMatches.map((match) => (
              <MatchRow key={match.id} match={match} prediction={predictionByMatch.get(match.id)} onPick={selectMatch} compact={isMobile} />
            )) : (
              <div style={{ padding: 22, color: WC_THEME.muted, fontSize: 13 }}>
                {totalOpen === 0 ? "No open WC matches right now — picks will reopen on the next lock." : "No open matches."}
              </div>
            )}
            {openMatches.length > 0 && (
              <div style={{ padding: "12px 18px", color: WC_THEME.subtle, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", borderTop: `1px solid ${WC_THEME.line}` }}>
                {openMatches.length} open · {predictions?.length || 0} pick{predictions?.length === 1 ? "" : "s"} saved
              </div>
            )}
          </WCCard>
        </div>

        <WCCard ref={slipRef} style={{ padding: 18, display: "grid", gap: 16, position: isMobile ? "relative" : "sticky", top: 110, scrollMarginTop: 96 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.accent }}>Your pick</div>
            <h2 style={{ fontSize: 24, margin: "8px 0 0", letterSpacing: "-0.04em" }}>
              {activeMatch ? `${teams.home.name} vs ${teams.away.name}` : "Tap a match to start"}
            </h2>
            <div style={{ marginTop: 8, color: WC_THEME.muted, fontSize: 13, lineHeight: 1.6 }}>
              {activeMatch ? `${formatWcDate(activeMatch.kickoff_at)} · ${wcStageLabel(activeMatch.stage)}` : "Pick the scoreline. Knockouts also need an advancing team — your winner pick covers extra time and penalties."}
            </div>
          </div>

          {activeMatch && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label={teams.home.name} type="number" min="0" max="99" value={homeScore} onChange={setHomeScore} disabled={isLocked(activeMatch.lock_at)} />
                <Field label={teams.away.name} type="number" min="0" max="99" value={awayScore} onChange={setAwayScore} disabled={isLocked(activeMatch.lock_at)} />
              </div>
              {knockout && (
                <SelectField
                  label="Advancing team (covers pens)"
                  value={winner}
                  onChange={setWinner}
                  disabled={isLocked(activeMatch.lock_at)}
                  options={[
                    ...(activeMatch.home_team_code ? [{ value: activeMatch.home_team_code, label: teams.home.name }] : []),
                    ...(activeMatch.away_team_code ? [{ value: activeMatch.away_team_code, label: teams.away.name }] : []),
                  ]}
                />
              )}
              <Field
                label="Goalscorer (optional)"
                value={scorer}
                onChange={setScorer}
                disabled={isLocked(activeMatch.lock_at)}
                placeholder="Last name is fine — e.g. Mbappé"
              />
              <button type="button" className="stint-button" disabled={saving || isLocked(activeMatch.lock_at)} onClick={savePick} style={{ minHeight: 48, background: `linear-gradient(135deg, ${WC_THEME.accent}, ${WC_THEME.accentWarm})`, color: "#171006" }}>
                {saving ? "Saving..." : isLocked(activeMatch.lock_at) ? "Locked" : user ? "Save pick" : "Create account"}
              </button>
              {note && <div style={{ color: note.includes("saved") ? "#A7F3C7" : "#FCA5A5", fontSize: 13, lineHeight: 1.5 }}>{note}</div>}
              <div style={{ borderTop: `1px solid ${WC_THEME.line}`, paddingTop: 14 }}>
                <ConsensusPanel matchId={activeMatch.id} />
              </div>
            </>
          )}
        </WCCard>
      </div>

    </div>
  );
}

function BracketView({ user, openAuth, bracketPrediction, onSaved, isMobile }) {
  const [picks, setPicks] = useState(() => bracketPrediction?.picks || { groupWinners: {}, groupRunnersUp: {}, champion: "", goldenBoot: "", goldenBall: "" });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const locked = isLocked(WC_TOURNAMENT_START);

  useEffect(() => {
    setPicks(bracketPrediction?.picks || { groupWinners: {}, groupRunnersUp: {}, champion: "", goldenBoot: "", goldenBall: "" });
  }, [bracketPrediction]);

  const updateGroup = (bucket, group, value) => {
    setPicks((current) => ({
      ...current,
      [bucket]: {
        ...(current[bucket] || {}),
        [group]: value,
      },
    }));
  };

  const save = async () => {
    if (!user) {
      openAuth?.("register", { page: "wc-bracket" });
      return;
    }
    setSaving(true);
    setNote("");
    try {
      const payload = await saveWcBracket(picks);
      onSaved(payload.prediction);
      setNote("WC bracket saved.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not save WC bracket.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <ScoringRulesCard mode="bracket" />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 320px", gap: 18, alignItems: "start" }}>
      <WCCard style={{ padding: isMobile ? 16 : 20, display: "grid", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.04em" }}>Group qualifiers</h2>
          <p style={{ color: WC_THEME.muted, margin: "8px 0 0", fontSize: 14, lineHeight: 1.65 }}>
            Pick each group winner and runner-up before the tournament opens.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 12 }}>
          {Object.entries(WC_GROUPS).map(([group, teams]) => {
            const options = teams.map((team) => ({ value: team.code, label: team.name }));
            return (
              <div key={group} style={{ borderRadius: 14, border: `1px solid ${WC_THEME.line}`, padding: 14, background: "rgba(2,18,11,0.45)" }}>
                <div style={{ color: WC_THEME.accent, fontWeight: 900, marginBottom: 12 }}>Group {group}</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <SelectField label="Winner" value={picks.groupWinners?.[group] || ""} onChange={(value) => updateGroup("groupWinners", group, value)} options={options} disabled={locked} />
                  <SelectField label="Runner-up" value={picks.groupRunnersUp?.[group] || ""} onChange={(value) => updateGroup("groupRunnersUp", group, value)} options={options} disabled={locked} />
                </div>
              </div>
            );
          })}
        </div>
      </WCCard>

      <WCCard style={{ padding: 18, display: "grid", gap: 14, position: isMobile ? "relative" : "sticky", top: 110 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.accent }}>Futures</div>
          <div style={{ marginTop: 8, color: WC_THEME.muted, fontSize: 13, lineHeight: 1.6 }}>
            {locked ? "WC bracket is locked." : `Locks ${formatWcDate(WC_TOURNAMENT_START)}.`}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 12, background: "rgba(2,18,11,0.55)", border: `1px solid ${WC_THEME.line}` }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.subtle }}>Progress</div>
          {WC_BRACKET_BUCKETS.map(([bucket, total, label]) => {
            const filled = Object.values(picks[bucket] || {}).filter(Boolean).length;
            return (
              <div key={bucket} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, color: WC_THEME.muted, fontSize: 12 }}>
                <span>{filled} / {total} {label}</span>
                <span style={{ color: filled === total ? "#A7F3C7" : WC_THEME.subtle, fontWeight: 800 }}>{filled === total ? "Done" : "..."}</span>
              </div>
            );
          })}
          {[["champion", "champion"], ["goldenBoot", "golden boot"], ["goldenBall", "golden ball"]].map(([key, label]) => (
            <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, color: WC_THEME.muted, fontSize: 12 }}>
              <span>{picks[key] ? `${label} · ${picks[key]}` : `${label} (pending)`}</span>
              <span style={{ color: picks[key] ? "#A7F3C7" : WC_THEME.subtle, fontWeight: 800 }}>{picks[key] ? "Done" : "..."}</span>
            </div>
          ))}
        </div>
        <SelectField label="Champion" value={picks.champion || ""} onChange={(value) => setPicks((current) => ({ ...current, champion: value }))} options={WC_TEAMS.map((team) => ({ value: team.code, label: team.name }))} disabled={locked} />
        <Field label="Golden Boot" value={picks.goldenBoot || ""} onChange={(value) => setPicks((current) => ({ ...current, goldenBoot: value }))} disabled={locked} placeholder="Player name" />
        <Field label="Golden Ball" value={picks.goldenBall || ""} onChange={(value) => setPicks((current) => ({ ...current, goldenBall: value }))} disabled={locked} placeholder="Player name" />
        <button type="button" className="stint-button" disabled={saving || locked} onClick={save} style={{ minHeight: 48, background: `linear-gradient(135deg, ${WC_THEME.accent}, ${WC_THEME.accentWarm})`, color: "#171006" }}>
          {saving ? "Saving..." : locked ? "Bracket locked" : user ? "Save WC bracket" : "Create account"}
        </button>
        {note && <div style={{ color: note.includes("saved") ? "#A7F3C7" : "#FCA5A5", fontSize: 13 }}>{note}</div>}
        {bracketPrediction?.points != null && (
          <div style={{ borderTop: `1px solid ${WC_THEME.line}`, paddingTop: 12, color: WC_THEME.text, fontWeight: 900 }}>
            {bracketPrediction.points} bracket pts
          </div>
        )}
      </WCCard>
      </div>
    </div>
  );
}

function SurvivorView({ user, openAuth, matches, isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyRound, setBusyRound] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const payload = await fetchWcSurvivor();
      setData(payload);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not load WC survivor.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const usedTeamCodes = useMemo(() => new Set((data?.picks || []).map((pick) => pick.picked_team_code)), [data]);
  const pickByRound = useMemo(() => new Map((data?.picks || []).map((pick) => [pick.round_key, pick])), [data]);

  const optionsForRound = (roundKey) => {
    const teamCodes = new Set();
    for (const match of matches) {
      if (!matchInSurvivorRound(match, roundKey)) continue;
      if (match.home_team_code) teamCodes.add(match.home_team_code);
      if (match.away_team_code) teamCodes.add(match.away_team_code);
    }
    return WC_TEAMS
      .filter((team) => teamCodes.has(team.code))
      .filter((team) => !usedTeamCodes.has(team.code) || pickByRound.get(roundKey)?.picked_team_code === team.code)
      .map((team) => ({ value: team.code, label: `${team.name} (${team.code})` }));
  };

  const savePick = async (roundKey, teamCode) => {
    if (!user) {
      openAuth?.("register", { page: "wc-survivor" });
      return;
    }
    setBusyRound(roundKey);
    setNote("");
    try {
      const payload = await saveWcSurvivorPick(roundKey, teamCode);
      setNote(payload.message || "Survivor pick saved.");
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not save survivor pick.");
    } finally {
      setBusyRound("");
    }
  };

  if (!user) {
    return (
      <WCCard style={{ padding: 22, display: "grid", gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.04em" }}>Survivor pool</h2>
          <p style={{ color: WC_THEME.muted, margin: "10px 0 0", lineHeight: 1.65, fontSize: 14 }}>
            One team per round. Pick a winner — if they win, you advance. A draw or a loss eliminates you for the rest of the tournament.
            Each team can be used at most once across all your picks. Last survivor wins the crown.
          </p>
        </div>
        <button
          type="button"
          className="stint-button"
          onClick={() => openAuth?.("register", { page: "wc-survivor" })}
          style={{ minHeight: 46, background: `linear-gradient(135deg, ${WC_THEME.accent}, ${WC_THEME.accentWarm})`, color: "#171006", justifySelf: "start", padding: "0 18px" }}
        >
          Create account to enter
        </button>
      </WCCard>
    );
  }

  if (loading) {
    return <WCCard style={{ padding: 24, color: WC_THEME.muted }}>Loading WC survivor...</WCCard>;
  }

  const eliminated = !!data?.eliminated;

  return (
    <div style={{ display: "grid", gap: 14, width: "100%" }}>
      <ScoringRulesCard mode="survivor" />
      <WCCard style={{ padding: 18, display: "grid", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.04em" }}>Survivor</h2>
          <p style={{ color: WC_THEME.muted, margin: "8px 0 0", fontSize: 14, lineHeight: 1.6 }}>
            One pick per matchday and round. Each team usable once. A draw or a loss takes you out — last survivor wins.
          </p>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span style={{ color: WC_THEME.subtle, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Status</span>
          <span style={{ color: eliminated ? "#FCA5A5" : "#A7F3C7", fontWeight: 900 }}>{eliminated ? "Eliminated" : "Alive"}</span>
          <span style={{ color: WC_THEME.subtle, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Rounds survived</span>
          <span style={{ color: WC_THEME.text, fontWeight: 900 }}>{data?.survivedRounds || 0}</span>
          <span style={{ color: WC_THEME.subtle, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Points</span>
          <span style={{ color: WC_THEME.text, fontWeight: 900 }}>{data?.totalPoints || 0}</span>
        </div>
        {note && <div style={{ color: note.startsWith("Could") || note.startsWith("You") || note.includes("not playing") ? "#FCA5A5" : "#A7F3C7", fontSize: 13 }}>{note}</div>}
      </WCCard>

      {WC_SURVIVOR_ROUND_KEYS.map((roundKey) => {
        const round = data?.rounds?.find((row) => row.key === roundKey);
        const pick = pickByRound.get(roundKey);
        const options = optionsForRound(roundKey);
        const pickedTeam = pick ? WC_TEAM_BY_CODE[pick.picked_team_code] : null;
        const isLockedRound = !round?.open;
        const tone = pick?.status === "correct" ? "green" : pick?.status === "eliminated" ? "neutral" : "gold";
        return (
          <WCCard key={roundKey} style={{ padding: 16, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17, color: WC_THEME.text }}>{WC_SURVIVOR_ROUNDS[roundKey].label}</div>
                <div style={{ color: WC_THEME.muted, fontSize: 12, marginTop: 4 }}>
                  {pick
                    ? `${pickedTeam ? wcTeamFlag(pickedTeam.code) + " " : ""}${pickedTeam?.name || pick.picked_team_code} · ${pick.status}${pick.points != null ? ` · ${pick.points} pts` : ""}`
                    : isLockedRound
                      ? "Round locked"
                      : "No pick yet"}
                </div>
              </div>
              <WCPill tone={tone}>{pick ? pick.status : isLockedRound ? "locked" : "open"}</WCPill>
            </div>
            {!isLockedRound && !eliminated && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8 }}>
                <SelectField
                  label="Team to back this round"
                  value={pick?.picked_team_code || ""}
                  onChange={(value) => savePick(roundKey, value)}
                  options={options}
                  disabled={busyRound === roundKey}
                />
                {busyRound === roundKey && <div style={{ alignSelf: "end", color: WC_THEME.muted, fontSize: 12, fontWeight: 800 }}>Saving...</div>}
              </div>
            )}
          </WCCard>
        );
      })}
    </div>
  );
}

function LeagueStandingsList({ standings, viewerIsOwner, onKick, busy }) {
  if (!standings.length) {
    return <div style={{ color: WC_THEME.muted, fontSize: 13 }}>No members yet.</div>;
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {standings.map((row, index) => {
        const canKick = viewerIsOwner && !row.isOwner && !row.isYou;
        return (
          <div
            key={row.user_id}
            style={{
              display: "grid",
              gridTemplateColumns: "28px minmax(0,1fr) auto",
              gap: 10,
              alignItems: "center",
              padding: "8px 10px",
              borderRadius: 10,
              background: row.isYou ? "rgba(214,165,69,0.10)" : "rgba(2,18,11,0.45)",
              border: `1px solid ${row.isYou ? "rgba(214,165,69,0.28)" : WC_THEME.line}`,
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", color: index === 0 ? WC_THEME.accent : WC_THEME.subtle, fontWeight: 900, fontSize: 13 }}>
              {index + 1}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: WC_THEME.text, fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.username}{row.isYou ? " (you)" : ""}{row.isOwner ? " · owner" : ""}
              </div>
              <div style={{ color: WC_THEME.muted, fontSize: 11, marginTop: 2 }}>
                {row.picksSaved} pick{row.picksSaved === 1 ? "" : "s"} · {row.survivorPicksSaved || 0} survivor · {row.bracketSubmitted ? "bracket in" : "no bracket"}
              </div>
            </div>
            <div style={{ textAlign: "right", display: "grid", gap: 4, justifyItems: "end" }}>
              <div style={{ color: WC_THEME.text, fontFamily: "var(--font-mono)", fontWeight: 900, fontSize: 17 }}>{row.totalPoints}</div>
              <div style={{ color: WC_THEME.subtle, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}>
                {row.matchPoints} match · {row.bracketPoints} bracket · {row.survivorPoints || 0} survivor
              </div>
              {canKick && (
                <button
                  type="button"
                  className="stint-button-secondary"
                  disabled={busy}
                  onClick={() => onKick(row)}
                  style={{ minHeight: 24, padding: "0 8px", fontSize: 10, borderColor: "rgba(226,91,74,0.26)", color: "#FCA5A5" }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeagueRow({ league, onCopy, onLeave, copiedCode, busy }) {
  const isOwner = league.role === "owner";
  const [expanded, setExpanded] = useState(false);
  const [standings, setStandings] = useState(null);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [standingsError, setStandingsError] = useState("");

  const loadStandings = useCallback(async () => {
    setLoadingStandings(true);
    setStandingsError("");
    try {
      const payload = await fetchWcLeagueStandings(league.id);
      setStandings(payload.standings || []);
    } catch (error) {
      setStandingsError(error instanceof Error ? error.message : "Could not load WC league standings.");
    } finally {
      setLoadingStandings(false);
    }
  }, [league.id]);

  const toggleExpanded = () => {
    if (!expanded && standings === null) loadStandings();
    setExpanded((value) => !value);
  };

  return (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${WC_THEME.line}`, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: WC_THEME.text, fontWeight: 900, fontSize: 17, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{league.name}</div>
          <div style={{ color: WC_THEME.muted, fontSize: 12, marginTop: 4 }}>{isOwner ? "You own this room" : "Member"}</div>
        </div>
        <WCPill tone={isOwner ? "gold" : league.visibility === "public" ? "green" : "neutral"}>{isOwner ? "Owner" : league.visibility || "private"}</WCPill>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <code style={{ fontFamily: "var(--font-mono)", color: WC_THEME.accent, background: "rgba(214,165,69,0.10)", padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(214,165,69,0.26)", fontWeight: 900, letterSpacing: "0.06em" }}>{league.code}</code>
        <button
          type="button"
          className="stint-button-secondary"
          onClick={() => onCopy(league.code)}
          style={{ minHeight: 30, padding: "0 10px", fontSize: 11, borderColor: "rgba(214,165,69,0.26)" }}
        >
          {copiedCode === league.code ? "Copied" : "Copy code"}
        </button>
        <button
          type="button"
          className="stint-button-secondary"
          onClick={toggleExpanded}
          style={{ minHeight: 30, padding: "0 10px", fontSize: 11, borderColor: "rgba(214,165,69,0.26)" }}
        >
          {expanded ? "Hide standings" : "Standings"}
        </button>
        {!isOwner && (
          <button
            type="button"
            className="stint-button-secondary"
            disabled={busy}
            onClick={() => onLeave(league)}
            style={{ minHeight: 30, padding: "0 10px", fontSize: 11, borderColor: "rgba(226,91,74,0.26)", color: "#FCA5A5" }}
          >
            Leave
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${WC_THEME.line}`, background: "rgba(2,18,11,0.40)", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.accent }}>
              Room standings
            </div>
            <button
              type="button"
              className="stint-button-secondary"
              onClick={loadStandings}
              disabled={loadingStandings}
              style={{ minHeight: 26, padding: "0 9px", fontSize: 10, borderColor: "rgba(214,165,69,0.26)" }}
            >
              {loadingStandings ? "Loading..." : "Refresh"}
            </button>
          </div>
          {standingsError && <div style={{ color: "#FCA5A5", fontSize: 12 }}>{standingsError}</div>}
          {loadingStandings && standings === null ? (
            <div style={{ color: WC_THEME.muted, fontSize: 13 }}>Loading WC standings...</div>
          ) : (
            <LeagueStandingsList
              standings={standings || []}
              viewerIsOwner={isOwner}
              busy={busy}
              onKick={async (row) => {
                if (typeof window !== "undefined" && !window.confirm(`Remove ${row.username} from "${league.name}"?`)) return;
                try {
                  await kickWcLeagueMember(league.id, row.user_id);
                  await loadStandings();
                } catch (kickError) {
                  setStandingsError(kickError instanceof Error ? kickError.message : "Could not remove member.");
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LeaguesView({ user, openAuth, leagues, refresh, isMobile }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");

  const copyCode = async (value) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      }
      setCopiedCode(value);
      setTimeout(() => setCopiedCode((current) => (current === value ? "" : current)), 1800);
    } catch (_error) {
      setCopiedCode("");
    }
  };

  const createLeague = async () => {
    if (!user) return openAuth?.("register", { page: "wc-leagues" });
    if (!name.trim()) {
      setNote("Name your WC league first.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const payload = await createWcLeague({ name: name.trim() });
      setName("");
      setNote(payload?.league?.code ? `WC league created. Share code ${payload.league.code}.` : "WC league created.");
      refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not create WC league.");
    } finally {
      setBusy(false);
    }
  };

  const joinLeague = async () => {
    if (!user) return openAuth?.("register", { page: "wc-leagues" });
    if (!code.trim()) {
      setNote("Enter a WC league code first.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      await joinWcLeague(code.trim());
      setCode("");
      setNote("Joined WC league.");
      refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not join WC league.");
    } finally {
      setBusy(false);
    }
  };

  const leaveLeague = async (league) => {
    if (!user) return;
    if (typeof window !== "undefined" && !window.confirm(`Leave WC league "${league.name}"?`)) return;
    setBusy(true);
    setNote("");
    try {
      await leaveWcLeague(league.id);
      setNote(`Left WC league "${league.name}".`);
      refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not leave WC league.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "360px minmax(0,1fr)", gap: 18 }}>
      <WCCard style={{ padding: 18, display: "grid", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 25, letterSpacing: "-0.04em" }}>WC rooms</h2>
          <p style={{ color: WC_THEME.muted, margin: "8px 0 0", fontSize: 14, lineHeight: 1.6 }}>Private World Cup leaderboards, separate scoring, same STINT account.</p>
        </div>
        <Field label="New league name" value={name} onChange={setName} placeholder="Office sweep" />
        <button type="button" className="stint-button" disabled={busy} onClick={createLeague} style={{ minHeight: 46, background: `linear-gradient(135deg, ${WC_THEME.accent}, ${WC_THEME.accentWarm})`, color: "#171006" }}>Create WC league</button>
        <div style={{ height: 1, background: WC_THEME.line, margin: "4px 0" }} />
        <Field label="Join with code" value={code} onChange={(value) => setCode(value.toUpperCase())} placeholder="OFFICE12" />
        <button type="button" className="stint-button-secondary" disabled={busy} onClick={joinLeague} style={{ minHeight: 46, borderColor: "rgba(214,165,69,0.26)" }}>Join WC league</button>
        {note && <div style={{ color: note.includes("Could") || note.includes("first") ? "#FCA5A5" : "#A7F3C7", fontSize: 13, lineHeight: 1.5 }}>{note}</div>}
      </WCCard>
      <WCCard style={{ overflow: "hidden" }}>
        {(leagues || []).length ? leagues.map((league) => (
          <LeagueRow key={league.id} league={league} onCopy={copyCode} onLeave={leaveLeague} copiedCode={copiedCode} busy={busy} />
        )) : (
          <div style={{ padding: 22, color: WC_THEME.muted, fontSize: 13, lineHeight: 1.6 }}>
            No WC leagues yet. Create one and share the code, or join a friend's room with their code.
          </div>
        )}
      </WCCard>
    </div>
  );
}

function ProfileView({ user, predictions, bracketPrediction, survivorPicks, setPage, openAuth, leagues }) {
  const pickPoints = (predictions || []).reduce((sum, prediction) => sum + Number(prediction.points || 0), 0);
  const survivorPoints = (survivorPicks || []).reduce((sum, pick) => sum + Number(pick.points || 0), 0);
  const total = pickPoints + Number(bracketPrediction?.points || 0) + survivorPoints;
  const scoredPicks = (predictions || []).filter((prediction) => prediction.points != null).length;
  const scoredSurvivor = (survivorPicks || []).filter((pick) => pick.points != null).length;
  const totalPicks = predictions?.length || 0;
  return (
    <div className="wc-stagger" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, "--wc-i": 0 }}>
        {[
          ["WC points", total, `${scoredPicks} of ${totalPicks} picks scored`],
          ["Match picks", totalPicks, "Group + knockout"],
          ["Bracket points", bracketPrediction?.points || 0, bracketPrediction ? "Submitted" : "Not submitted"],
          ["Survivor points", survivorPoints, `${scoredSurvivor} round${scoredSurvivor === 1 ? "" : "s"} scored`],
          ["Private rooms", leagues?.length || 0, leagues?.length ? "Your WC leagues" : "Create or join one"],
        ].map(([label, value, hint]) => (
          <div key={label} className="wc-stat-card">
            <div className="wc-stat-label">{label}</div>
            <div className="wc-stat-value" data-num>{value}</div>
            <div className="wc-stat-hint">{hint}</div>
          </div>
        ))}
      </div>
      <WCCard style={{ padding: 18, display: "grid", gap: 14, "--wc-i": 1 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.04em" }}>{user ? user.username || "WC profile" : "WC profile"}</h2>
          <p style={{ color: WC_THEME.muted, margin: "8px 0 0", lineHeight: 1.65, fontSize: 14 }}>
            {user
              ? "Match picks, survivor calls, bracket calls, and league rooms are tracked separately from F1 — they don't touch your race points."
              : "Sign in to keep your WC picks, survivor run, bracket and leagues in sync across devices."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {user ? (
            <>
              <button type="button" className="stint-button" onClick={() => setPage?.("wc-picks")} style={{ minHeight: 42, padding: "0 16px", background: `linear-gradient(135deg, ${WC_THEME.accent}, ${WC_THEME.accentWarm})`, color: "#171006" }}>Make picks</button>
              <button type="button" className="stint-button-secondary" onClick={() => setPage?.("wc-bracket")} style={{ minHeight: 42, padding: "0 16px", borderColor: "rgba(214,165,69,0.26)" }}>Open bracket</button>
              <button type="button" className="stint-button-secondary" onClick={() => setPage?.("wc-leagues")} style={{ minHeight: 42, padding: "0 16px", borderColor: "rgba(214,165,69,0.26)" }}>Manage leagues</button>
            </>
          ) : (
            <button type="button" className="stint-button" onClick={() => openAuth?.("register", { page: "wc-profile" })} style={{ minHeight: 42, padding: "0 16px", background: `linear-gradient(135deg, ${WC_THEME.accent}, ${WC_THEME.accentWarm})`, color: "#171006" }}>Create account</button>
          )}
        </div>
      </WCCard>
    </div>
  );
}

function AdminView({ matches, refresh, isMobile }) {
  const [matchId, setMatchId] = useState(matches[0]?.id || "");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [winner, setWinner] = useState("");
  const [homeScorers, setHomeScorers] = useState("");
  const [awayScorers, setAwayScorers] = useState("");
  const [homeTeamCode, setHomeTeamCode] = useState("");
  const [awayTeamCode, setAwayTeamCode] = useState("");
  const [kickoffAt, setKickoffAt] = useState("");
  const [lockAt, setLockAt] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [goldenBoot, setGoldenBoot] = useState("");
  const [goldenBall, setGoldenBall] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedMatch = matches.find((match) => match.id === matchId) || null;
  const teams = selectedMatch ? wcMatchTeams(selectedMatch) : null;

  // When matches reload (e.g. after publishing), the currently selected matchId
  // can vanish from the list. Snap back to the first available match.
  useEffect(() => {
    if (!matches.length) return;
    if (!matches.find((match) => match.id === matchId)) {
      setMatchId(matches[0].id);
    }
  }, [matches, matchId]);

  useEffect(() => {
    if (!selectedMatch) return;
    setHomeScore(selectedMatch.home_score ?? "");
    setAwayScore(selectedMatch.away_score ?? "");
    setWinner(selectedMatch.winner_team_code || "");
    setHomeScorers(Array.isArray(selectedMatch.scorers?.home) ? selectedMatch.scorers.home.join(", ") : "");
    setAwayScorers(Array.isArray(selectedMatch.scorers?.away) ? selectedMatch.scorers.away.join(", ") : "");
    setHomeTeamCode(selectedMatch.home_team_code || "");
    setAwayTeamCode(selectedMatch.away_team_code || "");
    setKickoffAt(selectedMatch.kickoff_at || "");
    setLockAt(selectedMatch.lock_at || "");
    setStatus(selectedMatch.status || "scheduled");
  }, [selectedMatch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const publish = async () => {
    setBusy(true);
    setNote("");
    try {
      const payload = await publishWcResult({ matchId, homeScore, awayScore, winnerTeamCode: winner, homeScorers, awayScorers });
      setNote(payload.message || "WC result published.");
      refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not publish WC result.");
    } finally {
      setBusy(false);
    }
  };

  const rescore = async () => {
    setBusy(true);
    setNote("");
    try {
      const payload = await rescoreWc({ awards: { goldenBoot, goldenBall } });
      setNote(payload.message || "WC scoring recalculated.");
      refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not rescore WC.");
    } finally {
      setBusy(false);
    }
  };

  const updateMatch = async () => {
    if (!selectedMatch) return;
    setBusy(true);
    setNote("");
    try {
      const homeTeam = WC_TEAM_BY_CODE[homeTeamCode];
      const awayTeam = WC_TEAM_BY_CODE[awayTeamCode];
      const payload = await updateWcMatch({
        matchId,
        homeTeamCode,
        awayTeamCode,
        homeLabel: homeTeam?.name || selectedMatch.home_label,
        awayLabel: awayTeam?.name || selectedMatch.away_label,
        kickoffAt,
        lockAt,
        status,
      });
      setNote(payload.message || "WC match updated.");
      refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not update WC match.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 340px", gap: 18, alignItems: "start" }}>
      <WCCard style={{ padding: 18, display: "grid", gap: 14 }}>
        <SelectField
          label="WC match"
          value={matchId}
          onChange={setMatchId}
          options={matches.map((match) => ({
            value: match.id,
            label: `M${match.match_number} · ${match.home_label} vs ${match.away_label}`,
          }))}
        />
        {selectedMatch && (
          <>
            <div style={{ color: WC_THEME.muted, fontSize: 13 }}>{formatWcShortDate(selectedMatch.kickoff_at)} · {selectedMatch.venue}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label={teams.home.name} type="number" min="0" max="99" value={homeScore} onChange={setHomeScore} />
              <Field label={teams.away.name} type="number" min="0" max="99" value={awayScore} onChange={setAwayScore} />
            </div>
            <SelectField
              label="Winner if needed"
              value={winner}
              onChange={setWinner}
              options={[
                ...(selectedMatch.home_team_code ? [{ value: selectedMatch.home_team_code, label: teams.home.name }] : []),
                ...(selectedMatch.away_team_code ? [{ value: selectedMatch.away_team_code, label: teams.away.name }] : []),
              ]}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Home scorers" value={homeScorers} onChange={setHomeScorers} />
              <Field label="Away scorers" value={awayScorers} onChange={setAwayScorers} />
            </div>
            <button type="button" className="stint-button" disabled={busy} onClick={publish} style={{ minHeight: 48, background: `linear-gradient(135deg, ${WC_THEME.accent}, ${WC_THEME.accentWarm})`, color: "#171006" }}>Publish WC result</button>
          </>
        )}
      </WCCard>

      <WCCard style={{ padding: 18, display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 23 }}>Match controls</h2>
        <SelectField label="Home team" value={homeTeamCode} onChange={setHomeTeamCode} options={WC_TEAMS.map((team) => ({ value: team.code, label: team.name }))} />
        <SelectField label="Away team" value={awayTeamCode} onChange={setAwayTeamCode} options={WC_TEAMS.map((team) => ({ value: team.code, label: team.name }))} />
        <Field label="Kickoff ISO" value={kickoffAt} onChange={setKickoffAt} />
        <Field label="Lock ISO" value={lockAt} onChange={setLockAt} />
        <SelectField
          label="Status"
          value={status}
          onChange={setStatus}
          options={["scheduled", "locked", "live", "completed", "cancelled"].map((value) => ({ value, label: wcSlugLabel(value) }))}
        />
        <button type="button" className="stint-button-secondary" disabled={busy} onClick={updateMatch} style={{ minHeight: 46, borderColor: "rgba(214,165,69,0.26)" }}>Update WC match</button>
      </WCCard>

      <WCCard style={{ padding: 18, display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 23 }}>Full WC rescore</h2>
        <Field label="Golden Boot winner" value={goldenBoot} onChange={setGoldenBoot} />
        <Field label="Golden Ball winner" value={goldenBall} onChange={setGoldenBall} />
        <button type="button" className="stint-button-secondary" disabled={busy} onClick={rescore} style={{ minHeight: 46, borderColor: "rgba(214,165,69,0.26)" }}>Rescore WC</button>
        {note && <div style={{ color: note.includes("Could") ? "#FCA5A5" : "#A7F3C7", fontSize: 13, lineHeight: 1.5 }}>{note}</div>}
      </WCCard>

      <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
        <SyncPanel refresh={refresh} />
      </div>

      <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
        <KnockoutSlotPanel matches={matches} refresh={refresh} />
      </div>

      <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
        <ResetPanel refresh={refresh} />
      </div>
    </div>
  );
}

function ResetPanel({ refresh }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [result, setResult] = useState(null);

  const reset = async () => {
    if (typeof window !== "undefined" && !window.confirm("Wipe ALL WC user data and reset every match back to scheduled? This cannot be undone.")) return;
    setBusy(true);
    setNote("");
    setResult(null);
    try {
      const payload = await resetWcPlatform();
      setResult(payload);
      setNote(payload.message || "WC platform reset.");
      refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not reset WC platform.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <WCCard style={{ padding: 18, display: "grid", gap: 14, border: "1px solid rgba(226,91,74,0.32)" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 23, color: "#FCA5A5" }}>Launch reset (destructive)</h2>
        <p style={{ color: WC_THEME.muted, margin: "6px 0 0", fontSize: 13, lineHeight: 1.6 }}>
          Wipes every match prediction, bracket, league, league member, survivor pick, and scoring run, then resets every match
          back to <code style={{ color: WC_THEME.accent }}>scheduled</code> with null scores. Use this once before the tournament
          opener to clear staging data. Cannot be undone — confirm dialog required.
        </p>
      </div>
      <button
        type="button"
        className="stint-button"
        disabled={busy}
        onClick={reset}
        style={{ minHeight: 46, background: "linear-gradient(135deg,#E25B4A,#B5392C)", color: "#FFF1ED" }}
      >
        {busy ? "Resetting..." : "Reset WC platform to zero"}
      </button>
      {note && <div style={{ color: note.startsWith("Could") ? "#FCA5A5" : "#A7F3C7", fontSize: 13 }}>{note}</div>}
      {result?.counts && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
          {Object.entries(result.counts).map(([label, value]) => (
            <div key={label} style={{ padding: 12, borderRadius: 12, border: `1px solid ${WC_THEME.line}`, background: "rgba(2,18,11,0.45)" }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.subtle }}>{label}</div>
              <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontWeight: 900, fontSize: 22, color: WC_THEME.text }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </WCCard>
  );
}

function SyncPanel({ refresh }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [note, setNote] = useState("");

  const sync = async () => {
    setBusy(true);
    setNote("");
    try {
      const payload = await syncWcFixtures();
      setResult(payload);
      setNote(payload.message || "WC fixtures synced.");
      refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not sync WC fixtures.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <WCCard style={{ padding: 18, display: "grid", gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 23 }}>Real fixture sync</h2>
        <p style={{ color: WC_THEME.muted, margin: "6px 0 0", fontSize: 13, lineHeight: 1.6 }}>
          Pulls the official WC 2026 fixtures and results from TheSportsDB. Idempotent — runs as often as you like.
          Newly completed matches automatically rescore every saved prediction.
        </p>
      </div>
      <button
        type="button"
        className="stint-button"
        disabled={busy}
        onClick={sync}
        style={{ minHeight: 46, background: `linear-gradient(135deg, ${WC_THEME.accent}, ${WC_THEME.accentWarm})`, color: "#171006" }}
      >
        {busy ? "Syncing..." : "Sync fixtures from TheSportsDB"}
      </button>
      {note && <div style={{ color: note.startsWith("Could") ? "#FCA5A5" : "#A7F3C7", fontSize: 13, lineHeight: 1.5 }}>{note}</div>}
      {result?.counts && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
          {[
            ["Received", result.counts.eventsReceived],
            ["Updated", result.counts.updated],
            ["Skipped", result.counts.skipped],
            ["Rescored picks", result.counts.predictionsRescored],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 12, borderRadius: 12, border: `1px solid ${WC_THEME.line}`, background: "rgba(2,18,11,0.45)" }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: WC_THEME.subtle }}>{label}</div>
              <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontWeight: 900, fontSize: 22, color: WC_THEME.text }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      {result?.updated?.length > 0 && (
        <details>
          <summary style={{ color: WC_THEME.subtle, fontSize: 12, cursor: "pointer", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Updated matches ({result.updated.length})
          </summary>
          <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12, color: WC_THEME.muted }}>
            {result.updated.map((row) => (
              <div key={row.matchNumber}>M{String(row.matchNumber).padStart(3, "0")} · {row.label}</div>
            ))}
          </div>
        </details>
      )}
      {result?.skipped?.length > 0 && (
        <details>
          <summary style={{ color: WC_THEME.subtle, fontSize: 12, cursor: "pointer", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Skipped events ({result.skipped.length})
          </summary>
          <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12, color: WC_THEME.muted }}>
            {result.skipped.map((row, index) => (
              <div key={`${row.event}-${index}`}>{row.event} — {row.reason}</div>
            ))}
          </div>
        </details>
      )}
    </WCCard>
  );
}

function KnockoutSlotPanel({ matches, refresh }) {
  const knockoutMatches = useMemo(
    () => matches.filter((match) => match.stage && match.stage !== "group"),
    [matches]
  );
  const completedById = useMemo(
    () => new Map(matches.filter((match) => match.status === "completed").map((match) => [match.id, match])),
    [matches]
  );
  const [matchId, setMatchId] = useState(knockoutMatches[0]?.id || "");
  const selectedMatch = knockoutMatches.find((match) => match.id === matchId) || null;
  const [homeTeamCode, setHomeTeamCode] = useState("");
  const [awayTeamCode, setAwayTeamCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!knockoutMatches.length) return;
    if (!knockoutMatches.find((match) => match.id === matchId)) {
      setMatchId(knockoutMatches[0].id);
    }
  }, [knockoutMatches, matchId]);

  useEffect(() => {
    setHomeTeamCode(selectedMatch?.home_team_code || "");
    setAwayTeamCode(selectedMatch?.away_team_code || "");
  }, [selectedMatch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const teamOptions = useMemo(
    () => WC_TEAMS.map((team) => ({ value: team.code, label: `${team.name} (${team.code})` })),
    []
  );
  const completedOptions = useMemo(
    () => Array.from(completedById.values())
      .filter((match) => match.winner_team_code)
      .sort((left, right) => Number(left.match_number) - Number(right.match_number))
      .map((match) => {
        const winnerName = WC_TEAM_BY_CODE[match.winner_team_code]?.name || match.winner_team_code;
        return {
          value: match.winner_team_code,
          label: `M${String(match.match_number).padStart(3, "0")} winner → ${winnerName}`,
        };
      }),
    [completedById]
  );

  const apply = async () => {
    if (!selectedMatch) return;
    setBusy(true);
    setNote("");
    try {
      const homeTeam = WC_TEAM_BY_CODE[homeTeamCode];
      const awayTeam = WC_TEAM_BY_CODE[awayTeamCode];
      await updateWcMatch({
        matchId: selectedMatch.id,
        homeTeamCode,
        awayTeamCode,
        homeLabel: homeTeam?.name || selectedMatch.home_label,
        awayLabel: awayTeam?.name || selectedMatch.away_label,
        status: "scheduled",
      });
      setNote(`Slotted ${homeTeam?.name || homeTeamCode || "TBD"} vs ${awayTeam?.name || awayTeamCode || "TBD"}.`);
      refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not update knockout slot.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <WCCard style={{ padding: 18, display: "grid", gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 23 }}>Knockout slotting</h2>
        <p style={{ color: WC_THEME.muted, margin: "6px 0 0", fontSize: 13, lineHeight: 1.6 }}>
          Drop advancing teams into the knockout slots. The "from winner" shortcut lists results that have already been published.
        </p>
      </div>
      <SelectField
        label="Knockout match"
        value={matchId}
        onChange={setMatchId}
        options={knockoutMatches.map((match) => ({
          value: match.id,
          label: `M${String(match.match_number).padStart(3, "0")} · ${wcStageLabel(match.stage)} · ${match.home_label} vs ${match.away_label}`,
        }))}
      />
      {selectedMatch && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <SelectField label="Home slot team" value={homeTeamCode} onChange={setHomeTeamCode} options={teamOptions} />
            <SelectField label="Away slot team" value={awayTeamCode} onChange={setAwayTeamCode} options={teamOptions} />
          </div>
          {completedOptions.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <SelectField label="...or copy winner into home" value="" onChange={setHomeTeamCode} options={completedOptions} />
              <SelectField label="...or copy winner into away" value="" onChange={setAwayTeamCode} options={completedOptions} />
            </div>
          )}
          <button
            type="button"
            className="stint-button"
            disabled={busy}
            onClick={apply}
            style={{ minHeight: 46, background: `linear-gradient(135deg, ${WC_THEME.accent}, ${WC_THEME.accentWarm})`, color: "#171006" }}
          >
            Apply slot teams
          </button>
          {note && <div style={{ color: note.startsWith("Could") ? "#FCA5A5" : "#A7F3C7", fontSize: 13, lineHeight: 1.5 }}>{note}</div>}
        </>
      )}
    </WCCard>
  );
}

export default function WCPage({ page, user, openAuth, setPage }) {
  const { isMobile, isTablet } = useViewport();
  const view = viewByPage[page] || "home";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    teams: WC_TEAMS,
    matches: [],
    matchPredictions: [],
    bracketPrediction: null,
    survivorPicks: [],
    leagues: [],
    fallback: false,
  });

  usePageMetadata({
    title: WC_PAGE_TITLES[page] || "WC 2026",
    description: "Two ways to play the WC 2026 — Predict every match or Survivor to the final whistle.",
    path: page === "wc-fixtures" ? "/world-cup" : `/world-cup/${view}`,
  });

  const load = async () => {
    setError("");
    try {
      const payload = await fetchWcBootstrap();
      setData((current) => ({
        ...current,
        ...payload,
        matches: (payload.matches || []).sort(byMatchNumber),
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load WC data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextMatch = data.matches.find((match) => !isLocked(match.lock_at)) || data.matches[0];
  const totalPoints = (data.matchPredictions || []).reduce((sum, prediction) => sum + Number(prediction.points || 0), 0)
    + Number(data.bracketPrediction?.points || 0)
    + (data.survivorPicks || []).reduce((sum, pick) => sum + Number(pick.points || 0), 0);
  const canAdmin = isAdminUser(user);

  // Live countdown so the "next lock" tile feels alive — re-ticks every 30s.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!nextMatch?.lock_at) return undefined;
    const interval = setInterval(() => setTick((value) => value + 1), 30000);
    return () => clearInterval(interval);
  }, [nextMatch?.lock_at]);
  const nextLockCountdown = nextMatch?.lock_at ? wcCountdown(nextMatch.lock_at) : "TBD";
  // Reference `tick` so React re-renders even though the countdown reads `Date.now()` directly.
  void tick;

  const handlePredictionSaved = (prediction) => {
    setData((current) => ({
      ...current,
      matchPredictions: [
        ...(current.matchPredictions || []).filter((item) => item.id !== prediction.id && item.match_id !== prediction.match_id),
        prediction,
      ],
    }));
  };

  const handleBracketSaved = (prediction) => {
    setData((current) => ({ ...current, bracketPrediction: prediction }));
  };

  const renderView = () => {
    if (view === "home") return <HomeView matches={data.matches} setPage={setPage} isMobile={isMobile} />;
    if (view === "picks") return <PicksView user={user} openAuth={openAuth} matches={data.matches} predictions={data.matchPredictions} onSaved={handlePredictionSaved} setPage={setPage} isMobile={isMobile} />;
    if (view === "bracket") return <BracketView user={user} openAuth={openAuth} bracketPrediction={data.bracketPrediction} onSaved={handleBracketSaved} isMobile={isMobile} />;
    if (view === "survivor") return <SurvivorView user={user} openAuth={openAuth} matches={data.matches} isMobile={isMobile} />;
    if (view === "leagues") return <LeaguesView user={user} openAuth={openAuth} leagues={data.leagues} refresh={load} isMobile={isMobile} />;
    if (view === "profile") return <ProfileView user={user} predictions={data.matchPredictions} bracketPrediction={data.bracketPrediction} survivorPicks={data.survivorPicks} leagues={data.leagues} setPage={setPage} openAuth={openAuth} />;
    if (view === "admin" && canAdmin) return <AdminView matches={data.matches} refresh={load} isMobile={isMobile} />;
    return <HomeView matches={data.matches} setPage={setPage} isMobile={isMobile} />;
  };

  return (
    <main
      className="wc-scope"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: isMobile ? "24px 16px 88px" : isTablet ? "32px 22px 96px" : "38px 28px 96px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 20,
          border: `1px solid ${WC_THEME.line}`,
          background: `linear-gradient(135deg, rgba(6,20,13,0.94), rgba(13,51,33,0.90)), radial-gradient(circle at 82% 14%, ${WC_THEME.accentGlow}, transparent 38%)`,
          boxShadow: "0 30px 90px rgba(0,0,0,0.34)",
          padding: isMobile ? 20 : 28,
          marginBottom: 18,
        }}
      >
        <div className="wc-noise" aria-hidden="true" />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "14px",
            border: "1px solid rgba(247,241,221,0.07)",
            borderRadius: 16,
            pointerEvents: "none",
          }}
        />
        <div className="wc-hero-grid">
          <div className="wc-hero-copy">
            <div className="stint-kicker" style={{ color: WC_THEME.accent }}>WC 2026</div>
            <h1 className="wc-hero-title">World Cup</h1>
            <p className="wc-hero-sub">Two ways to play — Predict every match, or Survivor to the final whistle.</p>
            <div className="wc-hosts" aria-label="Host nations: USA, Canada, Mexico">
              <span className="wc-host-chip"><span aria-hidden="true">{wcFlagEmoji("US")}</span>USA</span>
              <span className="wc-host-chip"><span aria-hidden="true">{wcFlagEmoji("CA")}</span>Canada</span>
              <span className="wc-host-chip"><span aria-hidden="true">{wcFlagEmoji("MX")}</span>Mexico</span>
              <span className="wc-host-chip" style={{ borderColor: "rgba(214,165,69,0.28)", color: "var(--wc-accent)" }}>48 teams · 104 matches</span>
            </div>
          </div>
          <div className="wc-hero-tiles">
            <div className="wc-tile">
              <div className="wc-tile-label">
                <span className="wc-pulse" aria-hidden="true" />
                Next lock
              </div>
              <div className="wc-tile-value is-accent" data-num>{nextLockCountdown}</div>
              <div className="wc-tile-meta">{nextMatch ? formatWcDate(nextMatch.lock_at) : "Schedule loading"}</div>
            </div>
            <div className="wc-tile">
              <div className="wc-tile-label">Your WC pts</div>
              <div className="wc-tile-value" data-num>{totalPoints}</div>
              <div className="wc-tile-meta">{user ? "Across picks + bracket + survivor" : "Sign in to start"}</div>
            </div>
          </div>
        </div>
        <div className="wc-hero-pitch" aria-hidden="true" />
      </section>

      {data.fallback && (
        <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(214,165,69,0.28)", background: "rgba(214,165,69,0.10)", color: WC_THEME.accent, fontSize: 13, fontWeight: 800 }}>
          Live tables not available — showing the local WC fallback schedule.
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.10)", color: "#FCA5A5", fontSize: 13, fontWeight: 800 }}>
          {error}
        </div>
      )}

      {loading ? (
        <WCCard style={{ padding: 24, color: WC_THEME.muted }}>Loading WC board...</WCCard>
      ) : (
        <div key={view} className="wc-view">
          {renderView()}
        </div>
      )}
    </main>
  );
}
