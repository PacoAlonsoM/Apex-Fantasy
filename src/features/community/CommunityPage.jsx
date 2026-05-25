import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/src/lib/supabase";
import StandingsPage from "@/src/features/standings/StandingsPage";
import { CAL, countdown, fmt, nextRace, rc } from "@/src/constants/calendar";
import { PTS } from "@/src/constants/scoring";
import {
  ACCENT,
  BRAND_GRADIENT,
  CARD_RADIUS,
  CARD_SHADOW,
  CONTENT_MAX,
  DEFAULT_AVATAR_COLOR,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  RADIUS_MD,
  RADIUS_PILL,
  RADIUS_SM,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SPRINT,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
  WARM,
  teamSupportKey,
} from "@/src/constants/design";
import { MOCK_PRO_USERNAMES, MOCK_PRO_USERS } from "@/src/features/community/mockUsers";
import { requireActiveSession } from "@/src/shell/authProfile";
import { formatDnfDrivers, matchesDnfPick } from "@/src/lib/resultHelpers";
import useViewport from "@/src/lib/useViewport";
import { hexToRgba } from "@/src/lib/colors";
import { formatStamp } from "@/src/lib/format";
import IdentityAvatar from "@/src/ui/IdentityAvatar";
import PageMasthead from "@/src/ui/PageMasthead";


// ─── Shared sub-components ────────────────────────────────────────────────────

// Thin forwarding wrapper — preserves the AvatarChip API while rendering via
// the shared IdentityAvatar medallion. The legacy `radius` prop is ignored:
// user identity is circle-only now.
function AvatarChip({ name, colorKey, size = 32, fontSize, pro = false }) {
  return (
    <IdentityAvatar
      name={name}
      username={name}
      colorKey={colorKey}
      size={size}
      fontSize={fontSize}
      pro={pro}
    />
  );
}

function RaceWeekBanner({ race, isMobile }) {
  if (!race) return null;
  const cd = countdown(race.date);
  const flagColor = rc(race);

  let statePill, stateColor, contextLine;
  if (!cd) {
    statePill = "Results";
    stateColor = WARM;
    contextLine = `Round ${race.displayRound} complete`;
  } else if (cd.d === 0) {
    statePill = "Live";
    stateColor = "#EF4444";
    contextLine = "Race day — good luck";
  } else if (cd.d <= 3) {
    statePill = "Locked In";
    stateColor = ACCENT;
    contextLine = "Picks locked — race weekend underway";
  } else {
    statePill = "Open";
    stateColor = "#22C55E";
    contextLine = `Round ${race.displayRound} · picks open · ${cd.d}d ${cd.h}h to lights out`;
  }

  return (
    <div style={{
      position: "relative",
      borderRadius: SECTION_RADIUS,
      overflow: "hidden",
      border: "1px solid rgba(214,223,239,0.08)",
      background: PANEL_BG_ALT,
      marginBottom: 20,
    }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "url('/images/hero-glow.png')",
        backgroundSize: "cover",
        backgroundPosition: "right center",
        opacity: 0.12,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(135deg, ${hexToRgba(flagColor, 0.10)} 0%, transparent 58%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex",
        alignItems: isMobile ? "flex-start" : "center",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 12 : 0,
        padding: isMobile ? "18px 20px 16px" : "18px 28px 18px 26px",
        justifyContent: "space-between",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
            color: SUBTLE_TEXT, marginBottom: 6, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <span style={{
              display: "inline-block", width: 7, height: 7,
              borderRadius: "50%", background: flagColor, flexShrink: 0,
            }} />
            {race.circuit} · {race.city}
          </div>
          <div style={{
            fontSize: isMobile ? 22 : 26,
            fontWeight: 900,
            letterSpacing: "-0.045em",
            lineHeight: 1.08,
            color: TEXT_PRIMARY,
            marginBottom: 10,
            fontFamily: "Sora, var(--font-sora), sans-serif",
          }}>
            {race.n}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: hexToRgba(stateColor, 0.12),
              border: `1px solid ${hexToRgba(stateColor, 0.28)}`,
              borderRadius: RADIUS_PILL,
              color: stateColor,
              fontSize: 11, fontWeight: 700,
              padding: "4px 10px",
              letterSpacing: "0.04em",
            }}>
              {statePill === "Live" && (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: stateColor, display: "inline-block",
                  animation: "stntPulse 1.4s ease-in-out infinite",
                }} />
              )}
              {statePill}
            </span>
            {race.sprint && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: hexToRgba(SPRINT, 0.10),
                border: `1px solid ${hexToRgba(SPRINT, 0.22)}`,
                borderRadius: RADIUS_PILL,
                color: SPRINT,
                fontSize: 11, fontWeight: 700,
                padding: "4px 10px",
                letterSpacing: "0.04em",
              }}>
                Sprint Weekend
              </span>
            )}
          </div>
        </div>
        <div style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: isMobile ? "flex-start" : "flex-end",
          gap: 3,
          paddingLeft: isMobile ? 0 : 24,
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.02em" }}>
            {fmt(race.date)}
          </div>
          {cd && cd.d > 0 && (
            <div style={{ fontSize: 11, color: MUTED_TEXT, fontVariantNumeric: "tabular-nums" }}>
              {cd.d}d {cd.h}h {cd.m}m
            </div>
          )}
          <div style={{
            fontSize: 11, color: SUBTLE_TEXT,
            marginTop: 3,
            textAlign: isMobile ? "left" : "right",
            maxWidth: 220,
            lineHeight: 1.5,
          }}>
            {contextLine}
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeProfileIdentity(profile, currentUser = null) {
  if (!profile) return profile;

  const favoriteTeam = (currentUser?.id === profile.id ? currentUser.favorite_team : null) || profile.favorite_team || null;
  const avatarColor = (currentUser?.id === profile.id ? currentUser.avatar_color : null)
    || profile.avatar_color
    || (favoriteTeam ? teamSupportKey(favoriteTeam) : DEFAULT_AVATAR_COLOR);

  return {
    ...profile,
    favorite_team: favoriteTeam,
    avatar_color: avatarColor,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAGUE_RACE_REVIEW_PROMPTS = [
  { key: "pole", label: "Pole Position", pts: PTS.pole },
  { key: "winner", label: "Race Winner", pts: PTS.winner },
  { key: "p2", label: "2nd Place", pts: PTS.p2 },
  { key: "p3", label: "3rd Place", pts: PTS.p3 },
  { key: "dnf", label: "DNF Driver", pts: PTS.dnf },
  { key: "fl", label: "Fastest Lap", pts: PTS.fl },
  { key: "dotd", label: "Driver of the Day", pts: PTS.dotd },
  { key: "ctor", label: "Constructor with Most Points", pts: PTS.ctor },
  { key: "sc", label: "Safety Car?", pts: PTS.sc },
  { key: "rf", label: "Red Flag?", pts: PTS.rf },
];

const LEAGUE_SPRINT_REVIEW_PROMPTS = [
  { key: "sp_pole", label: "Sprint Pole", pts: PTS.sp_pole },
  { key: "sp_winner", label: "Sprint Winner", pts: PTS.sp_winner },
  { key: "sp_p2", label: "Sprint 2nd", pts: PTS.sp_p2 },
  { key: "sp_p3", label: "Sprint 3rd", pts: PTS.sp_p3 },
];


const DEFAULT_LEAGUE_SETTINGS = {
  scoring_weights: { pole: 10, winner: 25, p2: 18, p3: 15, fl: 7, dotd: 6, dnf: 12, ctor: 8 },
  sprint_multiplier: 0.5,
  tiebreaker_order: ["most_correct", "best_single_race", "head_to_head", "earliest_joined"],
  double_points_races: [],
  extra_categories: [],
};

const LEAGUE_VIEW_LABELS = {
  standings: "Standings",
  review: "Round Review",
  chat: "Chat",
  setup: "Rules",
};

const LEAGUE_MODE_LABELS = {
  standard: "Standard",
  survival: "Survival",
  draft: "Draft",
  double_down: "Double Down",
  head_to_head: "Head-to-Head",
  budget_picks: "Budget Picks",
};

const LEAGUE_VISIBILITY_LABELS = {
  private: "Private",
  public: "Public",
};

const LEAGUE_TIEBREAKER_LABELS = {
  most_correct: "Most correct picks",
  best_single_race: "Best single race",
  head_to_head: "Head-to-head record",
  earliest_joined: "Earliest to join",
};

const LEAGUE_SCORING_FIELDS = [
  { key: "pole", label: "Pole" },
  { key: "winner", label: "Winner" },
  { key: "p2", label: "P2" },
  { key: "p3", label: "P3" },
  { key: "fl", label: "Fastest Lap" },
  { key: "dotd", label: "DOTD" },
  { key: "dnf", label: "DNF" },
  { key: "ctor", label: "Constructor" },
];

const LEAGUE_EXTRA_CATEGORY_LABELS = {
  p4: "4th Place",
  p10: "10th Place",
  vsc: "Virtual Safety Car",
  lap1_incident: "Lap 1 Incident",
  rain_race: "Rain During Race",
  fastest_ctor: "Fastest Pit Stop",
};

const LEAGUE_MODES = [
  { key: "standard",     label: "Standard",     pro: false, desc: "Classic pick-em every race weekend." },
  { key: "survival",     label: "Survival",     pro: true,  desc: "Lowest scorer is eliminated each round." },
  { key: "draft",        label: "Draft",        pro: true,  desc: "Snake-draft your drivers at season start." },
  { key: "double_down",  label: "Double Down",  pro: true,  desc: "Triple one pick per race — or lose points." },
  { key: "head_to_head", label: "Head-to-Head", pro: true,  desc: "Bracket: beat your opponent each weekend." },
  { key: "budget_picks", label: "Budget Picks", pro: true,  desc: "50 credits per race, bet on your picks." },
];

const LEAGUE_BONUS_CATEGORIES = [
  { key: "p4",            label: "4th Place",          desc: "Driver who finishes P4" },
  { key: "p10",           label: "10th Place",         desc: "Who scores the final point?" },
  { key: "vsc",           label: "Virtual Safety Car", desc: "Will there be a VSC period?" },
  { key: "lap1_incident", label: "Lap 1 Incident",     desc: "Contact or chaos on lap 1?" },
  { key: "rain_race",     label: "Rain During Race",   desc: "Wet conditions at any point?" },
  { key: "fastest_ctor",  label: "Fastest Pit Stop",   desc: "Which team posts the fastest stop?" },
];

// inputStyle is shared across the create modal, join form, and review select.
// Defined at module scope since it has no state dependencies.
const inputStyle = {
  background: PANEL_BG_ALT,
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 12,
  color: "#fff",
  padding: "11px 13px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const FALLBACK_PRO_LEAGUE = {
  id: "mock-pro-community",
  name: "Pro Community League",
  type: "pro_community",
  visibility: "public",
  is_public: true,
  game_mode: "standard",
  owner_id: null,
  code: "PRO",
  settings: {
    scoring_weights: { ...DEFAULT_LEAGUE_SETTINGS.scoring_weights },
    sprint_multiplier: 1,
    tiebreaker_order: [...DEFAULT_LEAGUE_SETTINGS.tiebreaker_order],
    double_points_races: [],
    extra_categories: [],
  },
};

// Mock pro users + their username set live in a shared module so Grid and
// Community render identical Pro signalling without forking the palette.

const MOCK_PRO_POST_BLUEPRINTS = [
  { username: "pitwall_pro", hoursAgo: 3, body: "Locked Norris for pole already. If McLaren keeps this long-run pace, the Pro board is going to move fast this weekend." },
  { username: "paddock_analyst", hoursAgo: 5, body: "Reminder for everyone browsing the room: this board is public to follow, but only Pro members score and chat live here." },
  { username: "grid_racer_hk", hoursAgo: 9, body: "Season prize pool looks serious now. Going aggressive on podium picks early before the midfield gets tidy." },
  { username: "tyre_whisperer", hoursAgo: 12, body: "Race sims say tyre degradation is the real swing factor. I am fading the obvious winner pick for once." },
  { username: "lauda_line", hoursAgo: 19, body: "The best part of this league is the field size. No soft weekends, no hiding, just one big season table." },
  { username: "box_box_bella", hoursAgo: 27, body: "Forum check-in from the back of the top 10: I am one clean sprint weekend away from making this ugly for everyone ahead." },
];

// ─── Data utilities ───────────────────────────────────────────────────────────

function identityKey(profile) {
  return String(profile?.username || profile?.id || "").trim().toLowerCase();
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function isProProfile(profile, fallbackName = "") {
  const username = String(profile?.username || fallbackName || "").trim().toLowerCase();
  return profile?.subscription_status === "pro" || MOCK_PRO_USERNAMES.has(username);
}

function mergeProfilesByIdentity(profiles, currentUser = null) {
  const merged = new Map();

  (profiles || []).forEach((profile) => {
    const normalized = normalizeProfileIdentity(profile, currentUser);
    const key = identityKey(normalized);
    if (!key) return;

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, normalized);
      return;
    }

    const normalizedPoints = Number(normalized.points || 0);
    const existingPoints = Number(existing.points || 0);
    if (normalizedPoints >= existingPoints) {
      merged.set(key, { ...existing, ...normalized });
    }
  });

  return [...merged.values()];
}

function buildMockProStandings(currentUser = null) {
  const currentUserEntry = currentUser?.subscription_status === "pro" && currentUser?.username
    ? [{ ...currentUser, subscription_status: "pro" }]
    : [];

  return mergeProfilesByIdentity([...MOCK_PRO_USERS, ...currentUserEntry], currentUser)
    .sort((left, right) => (
      Number(right.points || 0) - Number(left.points || 0)
      || left.username.localeCompare(right.username)
    ));
}

function buildMockProPosts(leagueId, currentUser = null) {
  const mockProfiles = new Map(buildMockProStandings(currentUser).map((profile) => [profile.username, profile]));

  return MOCK_PRO_POST_BLUEPRINTS.map((entry, index) => {
    const author = mockProfiles.get(entry.username) || MOCK_PRO_USERS.find((profile) => profile.username === entry.username) || {};
    return {
      id: `mock-pro-post-${index + 1}`,
      league_id: leagueId || "mock-pro-community",
      author_id: author.id || `mock-pro-author-${index + 1}`,
      author_name: author.username || entry.username,
      title: entry.body.slice(0, 72),
      body: entry.body,
      created_at: new Date(Date.now() - (entry.hoursAgo * 60 * 60 * 1000)).toISOString(),
    };
  }).sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
}

function mergePostsByIdentity(posts) {
  const merged = new Map();

  (posts || []).forEach((post) => {
    const key = post?.id || `${post?.author_id || "anon"}:${post?.title || post?.body || ""}`;
    if (!merged.has(key)) merged.set(key, post);
  });

  return [...merged.values()].sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
}

function resultValueForKey(results, key) {
  if (!results) return null;

  switch (key) {
    case "pole":
      return results.pole || null;
    case "winner":
      return results.winner || null;
    case "p2":
      return results.p2 || null;
    case "p3":
      return results.p3 || null;
    case "dnf":
      return formatDnfDrivers(results);
    case "fl":
      return results.fastest_lap || null;
    case "dotd":
      return results.dotd || null;
    case "ctor":
      return results.best_constructor || null;
    case "sc":
      return typeof results.safety_car === "boolean" ? (results.safety_car ? "Yes" : "No") : null;
    case "rf":
      return typeof results.red_flag === "boolean" ? (results.red_flag ? "Yes" : "No") : null;
    case "sp_pole":
      return results.sp_pole || null;
    case "sp_winner":
      return results.sp_winner || null;
    case "sp_p2":
      return results.sp_p2 || null;
    case "sp_p3":
      return results.sp_p3 || null;
    default:
      return null;
  }
}

function buildLeagueReviewRows(prompts, picks, results, breakdown) {
  return prompts.map((prompt) => {
    const pick = picks?.[prompt.key] || null;
    const actual = resultValueForKey(results, prompt.key);
    const hit = prompt.key === "dnf"
      ? matchesDnfPick(pick, results)
      : (!!pick && actual !== null && pick === actual);
    const breakdownItem = Array.isArray(breakdown)
      ? breakdown.find((item) => item.label === prompt.label)
      : null;

    return {
      key: prompt.key,
      label: prompt.label,
      pick,
      actual,
      hit,
      points: hit ? Number(breakdownItem?.pts || prompt.pts || 0) : 0,
    };
  }).filter((row) => row.pick || row.actual);
}

function totalRowPoints(rows) {
  return (rows || []).reduce((sum, row) => sum + Number(row.points || 0), 0);
}

function bonusPointsFromBreakdown(breakdown) {
  if (!Array.isArray(breakdown)) return 0;
  return breakdown.reduce(
    (sum, item) => (item.label === "Perfect Podium Bonus" ? sum + Number(item.pts || 0) : sum),
    0
  );
}

function roundMeta(roundNumber) {
  return CAL.find((item) => Number(item.r) === Number(roundNumber)) || null;
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function LeagueStandingsView({ currentLeague, currentStandings, leagueStandings, leagueSummary, isTablet }) {
  return (
    <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
      <div style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr) 80px", background: PANEL_BG_ALT, borderBottom: `1px solid ${HAIRLINE}` }}>
        <div style={{ textAlign: "center", padding: "8px 0", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>#</div>
        <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Player</div>
        <div style={{ textAlign: "right", padding: "8px 14px 8px 0", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Pts</div>
      </div>
      {leagueStandings[currentLeague.id] === undefined ? (
        <div style={{ padding: 28, color: MUTED_TEXT, fontSize: 13 }}>Loading standings…</div>
      ) : currentStandings.length === 0 ? (
        <div style={{ padding: 28, color: MUTED_TEXT, fontSize: 13 }}>No members yet. Share your league code to get started.</div>
      ) : (
        <div className="stnt-stagger" style={{ display: "grid", gap: 1, background: HAIRLINE, maxHeight: isTablet ? 640 : 720, overflowY: "auto" }}>
          {currentStandings.map((member, index) => {
            const podiumBg = index === 0 ? "rgba(245,158,11,0.06)" : index === 1 ? "rgba(203,213,225,0.04)" : index === 2 ? "rgba(180,130,80,0.04)" : PANEL_BG;
            const rankColor = index === 0 ? "#F59E0B" : index === 1 ? "#CBD5E1" : index === 2 ? "#C2956C" : SUBTLE_TEXT;
            const gap = index === 0 ? null : (leagueSummary.leader?.points || 0) - (member.points || 0);
            return (
              <div key={member.id} className="stnt-row" style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr) 80px", gap: 0, background: podiumBg }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: index === 0 ? 16 : 13, fontWeight: 900, color: rankColor, fontVariantNumeric: "tabular-nums" }}>
                  {index + 1}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: index < 3 ? "13px 12px" : "11px 12px" }}>
                  <AvatarChip name={member.username} colorKey={member.avatar_color} size={index < 3 ? 34 : 30} radius={index < 3 ? 11 : 10} pro={isProProfile(member)} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.username}</div>
                    <div style={{ fontSize: 11, color: MUTED_TEXT }}>{index === 0 ? "Leading" : `−${gap} pts`}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 14px 0 0" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: index < 3 ? 17 : 15, fontWeight: 700, color: index === 0 ? "var(--text-pro)" : TEXT_PRIMARY, fontVariantNumeric: "tabular-nums" }}>{member.points || 0}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeagueReviewView({ currentLeague, currentLeagueReview, currentLeagueRoundResult, selectedLeagueRoundMeta, scoredRounds, leagueReviewRound, setLeagueReviewRound, isMobile, isTablet }) {
  const members = currentLeagueReview?.members || [];
  const hasSprintData = members.some((e) => e.sprintRows.length > 0);
  const allPrompts = hasSprintData
    ? [...LEAGUE_RACE_REVIEW_PROMPTS, ...LEAGUE_SPRINT_REVIEW_PROMPTS]
    : LEAGUE_RACE_REVIEW_PROMPTS;

  // Only include categories where at least one member made a pick or a result exists
  const activePrompts = currentLeagueRoundResult
    ? allPrompts.filter((prompt) => {
        const actual = resultValueForKey(currentLeagueRoundResult, prompt.key);
        const anyPick = members.some((e) =>
          [...e.raceRows, ...e.sprintRows].some((r) => r.key === prompt.key && r.pick)
        );
        return actual || anyPick;
      })
    : [];

  function getMemberRow(entry, key) {
    return [...entry.raceRows, ...entry.sprintRows].find((r) => r.key === key) || null;
  }

  const hasPredictions = members.some((e) => e.prediction);
  const colTemplate = `140px 100px ${members.map(() => "minmax(58px,1fr)").join(" ")}`;
  const gridMinWidth = Math.max(380, 240 + members.length * 68);
  const resultSummaryRows = currentLeagueRoundResult
    ? [
        ["P2",          currentLeagueRoundResult.p2,            "#dbe4f0"],
        ["P3",          currentLeagueRoundResult.p3,            "#c2956c"],
        ["FL",          currentLeagueRoundResult.fastest_lap,   "#fde68a"],
        ["DOTD",        currentLeagueRoundResult.dotd,          "#86efac"],
        ["Constructor", currentLeagueRoundResult.best_constructor, "#bfdbfe"],
        ["SC",  typeof currentLeagueRoundResult.safety_car === "boolean" ? (currentLeagueRoundResult.safety_car ? "Yes" : "No") : null, "#f97316"],
        ["RF",  typeof currentLeagueRoundResult.red_flag   === "boolean" ? (currentLeagueRoundResult.red_flag   ? "Yes" : "No") : null, "#ef4444"],
      ].filter(([, value]) => value !== null)
    : [];

  return (
    <div style={{ display: "grid", gap: 16 }}>

      {/* ── Round selector ── */}
      {scoredRounds.length > 0 && (
        <div className="stnt-vtab-strip">
          {scoredRounds.map((round) => {
            const meta = roundMeta(round.race_round);
            const active = Number(leagueReviewRound) === Number(round.race_round);
            return (
              <button
                key={round.race_round}
                onClick={() => setLeagueReviewRound(Number(round.race_round))}
                className="stnt-vtab"
                style={{
                  background: active ? hexToRgba(ACCENT, 0.13) : "transparent",
                  border: active ? `1px solid ${hexToRgba(ACCENT, 0.3)}` : "1px solid rgba(148,163,184,0.14)",
                  borderRadius: RADIUS_PILL,
                  color: active ? ACCENT : MUTED_TEXT,
                  cursor: "pointer",
                  padding: "8px 14px",
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {meta?.n || `R${round.race_round}`}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Race result header ── */}
      {currentLeagueRoundResult && (
        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
          <div style={{ padding: "16px 18px 14px", borderBottom: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                {selectedLeagueRoundMeta?.n || (leagueReviewRound ? `Round ${leagueReviewRound}` : "Race")}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8, color: "#facc15", lineHeight: 1 }}>
                {currentLeagueRoundResult.winner || "Pending"}
              </div>
              <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 3 }}>Race winner</div>
            </div>
            {currentLeagueRoundResult.pole && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>Pole</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#93c5fd" }}>{currentLeagueRoundResult.pole}</div>
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(128px,1fr))", gap: 1, background: HAIRLINE }}>
            {resultSummaryRows.map(([label, value, color]) => (
              <div key={label} style={{ minWidth: 0, padding: "10px 12px", background: PANEL_BG }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── States ── */}
      {scoredRounds.length === 0 ? (
        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: "22px 20px", fontSize: 13, color: MUTED_TEXT, lineHeight: 1.65 }}>
          Round Review appears here once a race has official results and scoring is complete.
        </div>
      ) : currentLeagueReview?.loading ? (
        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: "22px 20px", fontSize: 13, color: MUTED_TEXT }}>
          Loading round data…
        </div>
      ) : currentLeagueReview?.error ? (
        <div style={{ borderRadius: CARD_RADIUS, border: "1px solid rgba(239,68,68,0.18)", background: PANEL_BG, padding: "20px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#fca5a5", marginBottom: 4 }}>Review unavailable</div>
          <div style={{ fontSize: 12, lineHeight: 1.65, color: MUTED_TEXT }}>{currentLeagueReview.error}</div>
        </div>
      ) : members.length > 0 ? (
        <>
          {/* ── Round leaderboard ── */}
          <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
            <div style={{ padding: "11px 16px 9px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
              <div style={{ fontSize: 12, fontWeight: 900 }}>This round</div>
            </div>
            <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
              {members.map((entry, index) => {
                const podiumBg = index === 0 ? "rgba(245,158,11,0.05)" : index === 1 ? "rgba(203,213,225,0.03)" : index === 2 ? "rgba(180,130,80,0.03)" : PANEL_BG;
                const rankColor = index === 0 ? "#F59E0B" : index === 1 ? "#CBD5E1" : index === 2 ? "#C2956C" : SUBTLE_TEXT;
                const bonus = bonusPointsFromBreakdown(entry.breakdown);
                return (
                  <div key={entry.member.id} className="stnt-row" style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) 64px 72px", alignItems: "center", background: podiumBg }}>
                    <div style={{ textAlign: "center", fontSize: index === 0 ? 14 : 12, fontWeight: 900, color: rankColor, fontVariantNumeric: "tabular-nums" }}>{index + 1}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 12px 11px 0" }}>
                      <AvatarChip name={entry.member.username} colorKey={entry.member.avatar_color} size={30} radius={10} fontSize={11} pro={isProProfile(entry.member)} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.member.username}</div>
                        <div style={{ fontSize: 10, color: MUTED_TEXT }}>
                          {entry.correctCalls} hit{entry.correctCalls !== 1 ? "s" : ""}
                          {bonus > 0 ? ` · +${bonus} bonus` : ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "0 8px 0 0", textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: SUBTLE_TEXT, fontVariantNumeric: "tabular-nums" }}>{entry.member.points || 0}</div>
                      <div style={{ fontSize: 10, color: SUBTLE_TEXT, marginTop: 1 }}>season</div>
                    </div>
                    <div style={{ padding: "0 14px 0 0", textAlign: "right" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: entry.prediction ? 20 : 14, fontWeight: 700, letterSpacing: -0.3, color: entry.prediction ? TEXT_PRIMARY : SUBTLE_TEXT, fontVariantNumeric: "tabular-nums" }}>
                        {entry.prediction ? entry.roundScore : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: SUBTLE_TEXT, marginTop: 1 }}>pts</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Pick comparison grid ── */}
          {hasPredictions && activePrompts.length > 0 && (
            <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
              <div style={{ padding: "11px 16px 9px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, fontWeight: 900 }}>Pick comparison</div>
                <div style={{ fontSize: 11, color: MUTED_TEXT }}>who called what, and whether it landed</div>
              </div>
              <div className="stnt-compare-scroll">
                {/* Header row */}
                <div style={{ minWidth: gridMinWidth, display: "grid", gridTemplateColumns: colTemplate, borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                  <div style={{ padding: "8px 14px", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Category</div>
                  <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Answer</div>
                  {members.map((entry) => (
                    <div key={entry.member.id} style={{ padding: "6px 4px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <AvatarChip name={entry.member.username} colorKey={entry.member.avatar_color} size={22} radius={7} fontSize={9} pro={isProProfile(entry.member)} />
                      <div style={{ fontSize: 9, fontWeight: 800, color: SUBTLE_TEXT, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                        {entry.member.username}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Data rows */}
                <div style={{ display: "grid", gap: 1, background: HAIRLINE, minWidth: gridMinWidth }}>
                  {activePrompts.map((prompt) => {
                    const actual = resultValueForKey(currentLeagueRoundResult, prompt.key);
                    const predictors = members.filter((e) => e.prediction);
                    const hitCount = members.filter((e) => getMemberRow(e, prompt.key)?.hit).length;
                    return (
                      <div key={prompt.key} style={{ display: "grid", gridTemplateColumns: colTemplate, alignItems: "center", background: PANEL_BG }}>
                        <div style={{ padding: "10px 14px" }}>
                          <div style={{ fontSize: 12, fontWeight: 800 }}>{prompt.label}</div>
                          {predictors.length > 0 && (
                            <div style={{ fontSize: 10, color: MUTED_TEXT, marginTop: 1 }}>
                              {hitCount}/{predictors.length} hit
                            </div>
                          )}
                        </div>
                        <div style={{ padding: "10px 12px" }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: actual ? "#e2e8f0" : SUBTLE_TEXT }}>{actual || "—"}</div>
                        </div>
                        {members.map((entry) => {
                          const row = getMemberRow(entry, prompt.key);
                          if (!entry.prediction) {
                            return (
                              <div key={entry.member.id} style={{ textAlign: "center", padding: "10px 4px" }}>
                                <span style={{ fontSize: 10, color: SUBTLE_TEXT }}>—</span>
                              </div>
                            );
                          }
                          if (row?.hit) {
                            return (
                              <div key={entry.member.id} style={{ textAlign: "center", padding: "7px 4px", background: "rgba(34,197,94,0.07)" }}>
                                <div style={{ fontSize: 14, color: "#4ade80", lineHeight: 1 }}>✓</div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "#4ade80", fontVariantNumeric: "tabular-nums", marginTop: 1 }}>+{row.points}</div>
                              </div>
                            );
                          }
                          if (row?.pick) {
                            return (
                              <div key={entry.member.id} style={{ textAlign: "center", padding: "10px 4px" }}>
                                <div style={{ fontSize: 10, color: SUBTLE_TEXT, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "0 auto" }}>{row.pick}</div>
                              </div>
                            );
                          }
                          return (
                            <div key={entry.member.id} style={{ textAlign: "center", padding: "10px 4px" }}>
                              <span style={{ fontSize: 10, color: SUBTLE_TEXT }}>—</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── No-prediction notice ── */}
          {members.some((e) => !e.prediction) && (
            <div style={{ borderRadius: 10, border: PANEL_BORDER, padding: "10px 14px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: MUTED_TEXT }}>No board this round:</span>
              {members.filter((e) => !e.prediction).map((entry) => (
                <div key={entry.member.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <AvatarChip name={entry.member.username} colorKey={entry.member.avatar_color} size={20} radius={6} fontSize={9} />
                  <span style={{ fontSize: 11, color: SUBTLE_TEXT }}>{entry.member.username}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function LeagueChatView({ items, user, isMobile, authorProfiles, currentLeague, canPost, leagueMessage, setLeagueMessage, onSubmit, forumReady, setPage, openAuth }) {
  const isProBoard = currentLeague?.type === "pro_community";
  const placeholder = isProBoard ? "Post in the Pro room…" : "Message your league…";

  function renderMessages() {
    if (!items.length) {
      return (
        <div style={{ padding: "32px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 6 }}>No messages yet</div>
          <div style={{ fontSize: 12, lineHeight: 1.65, color: MUTED_TEXT, maxWidth: 320, margin: "0 auto" }}>
            Use the league chat to coordinate picks and share race takes throughout the weekend.
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 8 }}>
        {[...items].reverse().map((post) => {
          const mine = post.author_id === user?.id;
          const authorProfile = authorProfiles[post.author_id];
          const themeKey = authorProfile?.avatar_color;
          const authorIsPro = isProProfile(authorProfile, post.author_name);

          return (
            <div key={post.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", justifyContent: mine ? "flex-end" : "flex-start" }}>
              {!mine && <AvatarChip name={post.author_name} colorKey={themeKey} size={26} radius={8} fontSize={10} pro={authorIsPro} />}
              <div
                style={{
                  maxWidth: isMobile ? "88%" : "72%",
                  borderRadius: mine ? "14px 14px 3px 14px" : "3px 14px 14px 14px",
                  border: mine ? `1px solid ${hexToRgba(ACCENT, 0.24)}` : PANEL_BORDER,
                  background: mine ? `linear-gradient(135deg, ${hexToRgba(ACCENT, 0.16)}, rgba(14,25,41,0.92))` : PANEL_BG_ALT,
                  padding: "9px 12px 8px",
                }}
              >
                {!mine && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 4 }}>
                    {post.author_name}
                  </div>
                )}
                <div style={{ fontSize: 13, lineHeight: 1.55, color: mine ? "rgba(255,247,237,0.88)" : MUTED_TEXT, whiteSpace: "pre-wrap" }}>{post.body}</div>
                <div style={{ fontSize: 10, color: mine ? hexToRgba(WARM, 0.35) : SUBTLE_TEXT, marginTop: 5, textAlign: mine ? "right" : "left" }}>{formatStamp(post.created_at)}</div>
              </div>
              {mine && <AvatarChip name={post.author_name} colorKey={themeKey} size={26} radius={8} fontSize={10} pro={authorIsPro} />}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
      <div style={{ padding: "13px 16px 11px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.2 }}>
            {isProBoard ? "Pro Race Room" : "Chat"}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: SUBTLE_TEXT, background: "var(--btn-secondary-bg)", border: `1px solid ${HAIRLINE}`, borderRadius: RADIUS_PILL, padding: "2px 8px" }}>
            {items.length}
          </span>
        </div>
        {isProBoard && (
          <span style={{ fontSize: 10, fontWeight: 900, color: "#d97706", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.22)", borderRadius: RADIUS_PILL, padding: "3px 8px", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
            Pro
          </span>
        )}
      </div>

      <div style={{ padding: 16 }}>
        {forumReady === false ? (
          <div style={{ borderRadius: RADIUS_MD, border: PANEL_BORDER, background: PANEL_BG_ALT, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 5 }}>Chat backend not connected</div>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: MUTED_TEXT }}>
              The database needs a <code style={{ fontFamily: "monospace", color: hexToRgba(ACCENT, 0.9) }}>league_id</code> column on <code style={{ fontFamily: "monospace", color: hexToRgba(ACCENT, 0.9) }}>posts</code> before per-league chat is live.
            </div>
          </div>
        ) : (
          <>
            {canPost ? (
              <div style={{ borderRadius: RADIUS_MD, border: PANEL_BORDER, background: PANEL_BG_ALT, padding: 12, marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  style={{ ...inputStyle, flex: 1, minHeight: 60, resize: "none", borderRadius: RADIUS_SM }}
                  placeholder={placeholder}
                  value={leagueMessage}
                  onChange={(event) => setLeagueMessage(event.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(); }}
                />
                <button
                  onClick={onSubmit}
                  disabled={!leagueMessage.trim()}
                  className="stnt-send"
                  style={{
                    background: leagueMessage.trim() ? BRAND_GRADIENT : "var(--btn-secondary-bg)",
                    border: "none",
                    borderRadius: RADIUS_SM,
                    color: "#fff",
                    cursor: leagueMessage.trim() ? "pointer" : "default",
                    fontWeight: 900,
                    padding: "12px 16px",
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    opacity: leagueMessage.trim() ? 1 : 0.4,
                    flexShrink: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Send ↑
                </button>
              </div>
            ) : (
              <div style={{ borderRadius: RADIUS_MD, border: `1px solid rgba(245,158,11,0.18)`, background: `rgba(245,158,11,0.06)`, padding: "12px 14px", marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#fde68a", marginBottom: 2 }}>
                    {isProBoard ? "Read-only" : "Log in to reply"}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED_TEXT }}>
                    {isProBoard ? "Pro members can post in the race room." : "Join the conversation with your league."}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                  {isProBoard && (
                    <button onClick={() => setPage?.("pro")} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: RADIUS_SM, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "8px 12px", fontSize: 12 }}>
                      Go Pro
                    </button>
                  )}
                  {!user && (
                    <button onClick={() => openAuth?.("login", { page: "community" })} style={{ background: PANEL_BG_ALT, border: PANEL_BORDER, borderRadius: RADIUS_SM, color: TEXT_PRIMARY, cursor: "pointer", fontWeight: 800, padding: "8px 12px", fontSize: 12 }}>
                      Log in
                    </button>
                  )}
                </div>
              </div>
            )}
            <div style={{ maxHeight: isMobile ? 400 : 560, overflowY: "auto", paddingRight: 4 }}>
              {renderMessages()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LeagueSetupView({ currentLeague, currentLeagueScoring, currentLeagueTiebreakers, currentLeagueSprintMultiplier, currentLeagueDoublePointsRaces, isMobile, isTablet }) {
  const accessLabel = currentLeague.type === "pro_community"
    ? "Public board"
    : LEAGUE_VISIBILITY_LABELS[currentLeague.visibility || (currentLeague.is_public ? "public" : "private")] || "Private";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* League info bar */}
      <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,minmax(0,1fr))", gap: 1, background: HAIRLINE }}>
          {[
            { label: "Format", value: LEAGUE_MODE_LABELS[currentLeague.game_mode] || "Custom" },
            { label: "Access", value: accessLabel },
            { label: "Sprint multiplier", value: `${currentLeagueSprintMultiplier}×` },
          ].map((item) => (
            <div key={item.label} style={{ padding: "14px 16px", background: PANEL_BG }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.3 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.18fr) minmax(280px,0.82fr)", gap: 16 }}>
        {/* Scoring board */}
        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
          <div style={{ padding: "13px 16px 11px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 900 }}>Points by category</div>
            {currentLeagueDoublePointsRaces > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, color: "#fde68a", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.22)", borderRadius: RADIUS_PILL, padding: "4px 9px" }}>
                {currentLeagueDoublePointsRaces} double-pt rounds
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 1, background: HAIRLINE }}>
            {LEAGUE_SCORING_FIELDS.map(({ key, label }) => (
              <div key={key} style={{ padding: "14px 15px 13px", background: PANEL_BG }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>{label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, lineHeight: 1 }}>{Number(currentLeagueScoring[key] || 0)}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: SUBTLE_TEXT, letterSpacing: "0.06em" }}>pts</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tiebreaker ladder */}
        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
          <div style={{ padding: "13px 16px 11px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
            <div style={{ fontSize: 13, fontWeight: 900 }}>Tiebreaker order</div>
            <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 2 }}>Used when scores are level</div>
          </div>
          <div style={{ padding: "10px 12px", display: "grid", gap: 6 }}>
            {currentLeagueTiebreakers.map((key, index) => (
              <div key={key} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr)", gap: 10, alignItems: "center", padding: "9px 10px", borderRadius: 10, background: PANEL_BG_ALT, border: `1px solid ${HAIRLINE}` }}>
                <div style={{ width: 20, height: 20, borderRadius: 999, background: "var(--btn-secondary-bg)", border: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: SUBTLE_TEXT }}>
                  {index + 1}
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: MUTED_TEXT }}>{LEAGUE_TIEBREAKER_LABELS[key] || key}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function CreateLeagueModal({ user, isMobile, viewportHeight, leagueName, setLeagueName, leagueGameMode, setLeagueGameMode, leagueVisibility, setLeagueVisibility, scoringWeights, setScoringWeights, sprintMultiplier, setSprintMultiplier, tiebreakerOrder, setTiebreakerOrder, extraCategories, setExtraCategories, createError, setCreateError, createStep, setCreateStep, onClose, onSubmit, onGoToPro }) {
  const isPro = user?.subscription_status === "pro";
  const modalViewportPadding = isMobile ? 12 : 24;
  const modalMaxHeight = Math.max(isMobile ? 420 : 520, (viewportHeight || 900) - modalViewportPadding * 2);
  const modalMaxWidth = isMobile ? 392 : 440;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.88)", backdropFilter: "blur(12px)", zIndex: 200, display: "grid", placeItems: "center", padding: modalViewportPadding, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ background: "linear-gradient(180deg,rgba(16,26,46,0.99),rgba(10,18,34,0.99))", border: "1px solid rgba(255,106,26,0.18)", borderRadius: isMobile ? 24 : 28, width: "100%", maxWidth: modalMaxWidth, boxShadow: "0 60px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)", overflow: "hidden", maxHeight: modalMaxHeight, minHeight: 0, display: "flex", flexDirection: "column", alignSelf: "center" }}
      >
        {/* Header */}
        <div style={{ padding: isMobile ? "20px 20px 18px" : "24px 24px 20px", background: "linear-gradient(160deg,rgba(255,106,26,0.08) 0%,rgba(10,18,34,0) 60%)", borderBottom: `1px solid ${HAIRLINE}`, position: "relative" }}>
          <div aria-hidden="true" style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 260, height: 140, background: "radial-gradient(ellipse at center,rgba(255,106,26,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,106,26,0.10)", border: "1px solid rgba(255,106,26,0.22)", borderRadius: 999, padding: "4px 12px", marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: "var(--brand)", textTransform: "uppercase" }}>New League</span>
              </div>
              <div style={{ fontSize: isMobile ? 24 : 26, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>Make it yours.</div>
              <div style={{ fontSize: 13, color: MUTED_TEXT, marginTop: 6, lineHeight: 1.5 }}>
                {isPro ? `Step ${createStep + 1} of 2 — ${createStep === 0 ? "Name, mode and access" : "Advanced scoring"}` : "Name it, pick a game mode, set the rules."}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "var(--btn-secondary-bg)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, color: MUTED_TEXT, cursor: "pointer", fontSize: 14, fontWeight: 700, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              ✕
            </button>
          </div>
        </div>

        <div style={{ padding: isMobile ? "18px 20px 20px" : "20px 24px 24px", overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}>
          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>League name</div>
            <input
              style={{ ...inputStyle, fontSize: 15, padding: "13px 14px", fontWeight: 700 }}
              placeholder="e.g. Office Grid, Paddock Club, Sunday Sessions"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              autoFocus
            />
          </div>

          {/* Game mode */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>Game mode</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 7 }}>
              {LEAGUE_MODES.map(({ key, label, pro, desc }) => {
                const isSelected = leagueGameMode === key;
                const locked = pro && !isPro;
                return (
                  <button
                    key={key}
                    onClick={() => { if (!locked) setLeagueGameMode(key); }}
                    title={desc}
                    style={{ background: isSelected ? "rgba(255,106,26,0.14)" : PANEL_BG_ALT, border: isSelected ? "1px solid rgba(255,106,26,0.4)" : PANEL_BORDER, borderRadius: 12, color: locked ? SUBTLE_TEXT : isSelected ? "#fff" : MUTED_TEXT, cursor: locked ? "default" : "pointer", fontSize: 12, fontWeight: 700, padding: "10px 12px", textAlign: "left", display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 900, fontSize: 13, color: locked ? SUBTLE_TEXT : isSelected ? "#fff" : "#cbd5e1" }}>{label}</span>
                      {locked && <span style={{ fontSize: 10, fontWeight: 900, color: "var(--brand)", background: "rgba(255,106,26,0.12)", borderRadius: 999, padding: "1px 5px", letterSpacing: "0.06em" }}>PRO</span>}
                    </span>
                    <span style={{ fontSize: 11, lineHeight: 1.4, color: isSelected ? "rgba(255,255,255,0.6)" : SUBTLE_TEXT }}>{desc}</span>
                  </button>
                );
              })}
            </div>
            {!isPro && (
              <div style={{ marginTop: 8, fontSize: 11, color: MUTED_TEXT }}>
                Pro modes unlock with{" "}
                <span style={{ color: "var(--brand)", fontWeight: 800, cursor: "pointer" }} onClick={() => { onClose(); onGoToPro(); }}>Stint Pro</span>.
              </div>
            )}
          </div>

          {/* Visibility */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>Access</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
              {[["private", "Private", "Invite code only"], ["public", "Public", "Anyone can find and join"]].map(([key, label, hint]) => (
                <button
                  key={key}
                  onClick={() => setLeagueVisibility(key)}
                  style={{ background: leagueVisibility === key ? "rgba(255,106,26,0.14)" : PANEL_BG_ALT, border: leagueVisibility === key ? "1px solid rgba(255,106,26,0.40)" : PANEL_BORDER, borderRadius: 12, color: leagueVisibility === key ? "#fff" : MUTED_TEXT, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "10px 12px", textAlign: "left" }}
                >
                  <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 3, color: leagueVisibility === key ? "#fff" : "#cbd5e1" }}>{label}</div>
                  <div style={{ fontSize: 11, color: leagueVisibility === key ? "rgba(255,255,255,0.55)" : SUBTLE_TEXT }}>{hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 0 action */}
          {createStep === 0 && (
            <>
              {createError && (
                <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>
                  {createError}{" "}
                  {createError.includes("Upgrade") && <a href="/pro" style={{ color: "var(--brand)", fontWeight: 800 }}>Upgrade</a>}
                </div>
              )}
              <button
                onClick={() => {
                  if (!leagueName.trim()) return;
                  if (isPro) { setCreateStep(1); } else { onSubmit(); }
                }}
                disabled={!leagueName.trim()}
                style={{ background: leagueName.trim() ? BRAND_GRADIENT : "var(--btn-secondary-bg)", border: "none", borderRadius: 14, color: "#fff", cursor: leagueName.trim() ? "pointer" : "default", fontWeight: 900, width: "100%", padding: "15px", fontSize: 15, letterSpacing: "-0.01em", opacity: leagueName.trim() ? 1 : 0.45, boxShadow: leagueName.trim() ? "0 8px 24px rgba(255,106,26,0.28)" : "none", transition: "opacity 180ms ease, box-shadow 180ms ease" }}
              >
                {isPro ? (leagueName.trim() ? "Continue →" : "Continue") : (leagueName.trim() ? `Create "${leagueName}"` : "Create League")}
              </button>
              {isPro && (
                <div style={{ marginTop: 10, textAlign: "center", fontSize: 11, color: SUBTLE_TEXT }}>
                  Next: advanced scoring settings
                </div>
              )}
            </>
          )}

          {/* Step 1 (Pro only): Advanced scoring */}
          {createStep === 1 && isPro && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <div style={{ display: "flex", gap: 5, flex: 1 }}>
                  {[0, 1].map((s) => (
                    <div key={s} style={{ flex: 1, height: 3, borderRadius: 99, background: s <= createStep ? ACCENT : "rgba(148,163,184,0.18)" }} />
                  ))}
                </div>
                <span style={{ fontSize: 10, color: SUBTLE_TEXT, fontWeight: 700, whiteSpace: "nowrap" }}>Step 2 of 2</span>
              </div>

              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Advanced scoring</div>
              <div style={{ fontSize: 12, color: MUTED_TEXT, marginBottom: 18, lineHeight: 1.5 }}>
                Customise how points are awarded in <strong style={{ color: "#fff" }}>{leagueName}</strong>.
              </div>

              {/* Scoring weights */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>Points per category</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                  {LEAGUE_SCORING_FIELDS.map(({ key, label }) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12, color: MUTED_TEXT, fontWeight: 600 }}>{label}</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={scoringWeights[key]}
                        onChange={(e) => setScoringWeights((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                        style={{ ...inputStyle, width: 56, padding: "6px 8px", textAlign: "center", fontSize: 13, fontWeight: 800 }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sprint multiplier */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Sprint weekend multiplier</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0.25, 0.5, 0.75, 1].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSprintMultiplier(val)}
                      style={{ flex: 1, background: sprintMultiplier === val ? "rgba(255,106,26,0.14)" : "transparent", border: sprintMultiplier === val ? "1px solid rgba(255,106,26,0.4)" : `1px solid ${HAIRLINE}`, borderRadius: 8, color: sprintMultiplier === val ? "#fff" : MUTED_TEXT, cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "7px 0" }}
                    >
                      {val}×
                    </button>
                  ))}
                </div>
              </div>

              {/* Bonus pick categories */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>Bonus pick categories</div>
                <div style={{ fontSize: 11, color: MUTED_TEXT, marginBottom: 10, lineHeight: 1.5 }}>Enable extra picks for members of this league. Scored separately within your league.</div>
                {LEAGUE_BONUS_CATEGORIES.map(({ key, label, desc }) => {
                  const on = extraCategories.includes(key);
                  return (
                    <div
                      key={key}
                      onClick={() => setExtraCategories((prev) => on ? prev.filter((k) => k !== key) : [...prev, key])}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 10px", borderRadius: 8, background: on ? "rgba(255,106,26,0.08)" : "transparent", border: on ? "1px solid rgba(255,106,26,0.28)" : `1px solid ${HAIRLINE}`, cursor: "pointer", marginBottom: 5 }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: on ? "#fff" : MUTED_TEXT }}>{label}</div>
                        <div style={{ fontSize: 11, color: SUBTLE_TEXT }}>{desc}</div>
                      </div>
                      <div style={{ width: 18, height: 18, borderRadius: 4, background: on ? ACCENT : "transparent", border: on ? `1px solid ${ACCENT}` : `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", flexShrink: 0 }}>
                        {on ? "✓" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tiebreaker order */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Tiebreaker (in order)</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {tiebreakerOrder.map((key, idx) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: SUBTLE_TEXT, fontWeight: 800, width: 16, textAlign: "center" }}>{idx + 1}</span>
                      <div style={{ flex: 1, background: "var(--btn-secondary-bg)", border: `1px solid ${HAIRLINE}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, color: MUTED_TEXT }}>{LEAGUE_TIEBREAKER_LABELS[key]}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button
                          onClick={() => { if (idx === 0) return; const next = [...tiebreakerOrder]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; setTiebreakerOrder(next); }}
                          disabled={idx === 0}
                          style={{ background: "transparent", border: `1px solid ${HAIRLINE}`, borderRadius: 4, color: idx === 0 ? SUBTLE_TEXT : MUTED_TEXT, cursor: idx === 0 ? "default" : "pointer", fontSize: 10, padding: "2px 5px", opacity: idx === 0 ? 0.3 : 1 }}
                        >▲</button>
                        <button
                          onClick={() => { if (idx === tiebreakerOrder.length - 1) return; const next = [...tiebreakerOrder]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; setTiebreakerOrder(next); }}
                          disabled={idx === tiebreakerOrder.length - 1}
                          style={{ background: "transparent", border: `1px solid ${HAIRLINE}`, borderRadius: 4, color: idx === tiebreakerOrder.length - 1 ? SUBTLE_TEXT : MUTED_TEXT, cursor: idx === tiebreakerOrder.length - 1 ? "default" : "pointer", fontSize: 10, padding: "2px 5px", opacity: idx === tiebreakerOrder.length - 1 ? 0.3 : 1 }}
                        >▼</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {createError && (
                <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>
                  {createError}{" "}
                  {createError.includes("Upgrade") && <a href="/pro" style={{ color: "var(--brand)", fontWeight: 800 }}>Upgrade</a>}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => { setCreateStep(0); setCreateError(""); }}
                  style={{ background: "var(--btn-secondary-bg)", border: `1px solid ${HAIRLINE}`, borderRadius: 14, color: MUTED_TEXT, cursor: "pointer", fontWeight: 800, padding: "15px 20px", fontSize: 14 }}
                >
                  ← Back
                </button>
                <button
                  onClick={onSubmit}
                  style={{ flex: 1, background: BRAND_GRADIENT, border: "none", borderRadius: 14, color: "#fff", cursor: "pointer", fontWeight: 900, padding: "15px", fontSize: 15, letterSpacing: "-0.01em", boxShadow: "0 8px 24px rgba(255,106,26,0.28)" }}
                >
                  {leagueName.trim() ? `Create "${leagueName}"` : "Create League"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CommunityPage({ user, openAuth, demoMode = false, setPage }) {
  const { isMobile, isTablet, width: viewportWidth, height: viewportHeight } = useViewport();
  const isProUser = user?.subscription_status === "pro";
  const [tab, setTab] = useState("leagues");
  const [leagueView, setLeagueView] = useState("standings");
  const [authorProfiles, setAuthorProfiles] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [leagueStandings, setLeagueStandings] = useState({});
  const [leaguePosts, setLeaguePosts] = useState({});
  const [leagueForumReady, setLeagueForumReady] = useState({});
  const [scoredRounds, setScoredRounds] = useState([]);
  const [leagueReviewRound, setLeagueReviewRound] = useState(null);
  const [leagueRoundReviews, setLeagueRoundReviews] = useState({});
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [loadingLB, setLoadingLB] = useState(true);
  const [leagueMessage, setLeagueMessage] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [leagueGameMode, setLeagueGameMode] = useState("standard");
  const [leagueVisibility, setLeagueVisibility] = useState("private");
  const [joinCode, setJoinCode] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createStep, setCreateStep] = useState(0);
  const [sprintMultiplier, setSprintMultiplier] = useState(0.5);
  const [scoringWeights, setScoringWeights] = useState({ pole: 10, winner: 25, p2: 18, p3: 15, fl: 7, dotd: 6, dnf: 12, ctor: 8 });
  const [tiebreakerOrder, setTiebreakerOrder] = useState(["most_correct", "best_single_race", "head_to_head", "earliest_joined"]);
  const [extraCategories, setExtraCategories] = useState([]);
  const [proLeague, setProLeague] = useState(null);
  const demoPreview = demoMode && !user;
  const visibleProLeague = proLeague || FALLBACK_PRO_LEAGUE;
  const visibleProLeagueId = visibleProLeague.id;
  const mockProStandings = useMemo(() => buildMockProStandings(user), [user]);
  const mockProPosts = useMemo(() => buildMockProPosts(visibleProLeagueId, user), [visibleProLeagueId, user]);

  const currentLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId) || (visibleProLeagueId === selectedLeagueId ? visibleProLeague : null) || visibleProLeague || leagues[0] || null,
    [leagues, selectedLeagueId, visibleProLeague, visibleProLeagueId]
  );
  const currentStandings = useMemo(
    () => (currentLeague ? (leagueStandings[currentLeague.id] || []) : []),
    [currentLeague, leagueStandings]
  );
  const currentLeaguePosts = useMemo(
    () => (currentLeague ? (leaguePosts[currentLeague.id] || []) : []),
    [currentLeague, leaguePosts]
  );
  const currentLeagueSettings = currentLeague?.settings || {};
  const currentLeagueScoring = {
    ...DEFAULT_LEAGUE_SETTINGS.scoring_weights,
    ...(currentLeagueSettings.scoring_weights || {}),
  };
  const currentLeagueTiebreakers = currentLeagueSettings.tiebreaker_order?.length
    ? currentLeagueSettings.tiebreaker_order
    : DEFAULT_LEAGUE_SETTINGS.tiebreaker_order;
  const currentLeagueSprintMultiplier = Number(
    currentLeagueSettings.sprint_multiplier
      ?? (currentLeague?.type === "pro_community" ? 1 : DEFAULT_LEAGUE_SETTINGS.sprint_multiplier)
  );
  const currentLeagueDoublePointsRaces = currentLeagueSettings.double_points_races?.length || 0;
  const currentLeagueMemberIds = useMemo(
    () => currentStandings.map((member) => member.id).filter(Boolean).join("|"),
    [currentStandings]
  );
  const next = nextRace();

  useEffect(() => {
    fetchPublicCommunity();
    fetchScoredRounds();
    fetchProLeague();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) fetchLeagues();
    else setLeagues([]);
  }, [user]); // eslint-disable-line

  useEffect(() => {
    if (!selectedLeagueId) return;
    fetchLeagueStandings(selectedLeagueId);
    fetchLeaguePosts(selectedLeagueId);
  }, [selectedLeagueId, user, proLeague?.id, visibleProLeagueId]); // eslint-disable-line

  useEffect(() => {
    const validIds = [...leagues.map((l) => l.id), visibleProLeagueId];
    if (!validIds.length) {
      setSelectedLeagueId(null);
      return;
    }
    if (!selectedLeagueId || !validIds.includes(selectedLeagueId)) {
      setSelectedLeagueId(visibleProLeagueId || leagues[0]?.id || null);
    }
  }, [leagues, selectedLeagueId, visibleProLeagueId]);

  useEffect(() => {
    if (!scoredRounds.length) {
      setLeagueReviewRound(null);
      return;
    }

    setLeagueReviewRound((current) => (
      current && scoredRounds.some((row) => Number(row.race_round) === Number(current))
        ? current
        : scoredRounds[0].race_round
    ));
  }, [scoredRounds]);

  useEffect(() => {
    if (!currentLeague?.id || !leagueReviewRound || !currentStandings.length) return;
    fetchLeagueRoundReview(currentLeague.id, leagueReviewRound, currentStandings);
  }, [currentLeague?.id, currentLeagueMemberIds, leagueReviewRound]); // eslint-disable-line

  useEffect(() => {
    if (!user?.id) return;

    setAuthorProfiles((current) => ({
      ...current,
      [user.id]: normalizeProfileIdentity({
        ...(current[user.id] || {}),
        id: user.id,
        username: user.username,
        avatar_color: user.avatar_color,
        favorite_team: user.favorite_team,
      }, user),
    }));
    setLeaderboard((current) => mergeProfilesByIdentity([...current, ...mockProStandings], user)
      .sort((left, right) => (Number(right.points || 0) - Number(left.points || 0)) || left.username.localeCompare(right.username)));
    setLeagueStandings((current) => Object.fromEntries(
      Object.entries(current).map(([leagueId, standings]) => [leagueId, standings.map((profile) => normalizeProfileIdentity(profile, user))])
    ));
  }, [user, mockProStandings]);

  useEffect(() => {
    setAuthorProfiles((current) => ({
      ...Object.fromEntries(mockProStandings.map((profile) => [profile.id, profile])),
      ...current,
    }));
  }, [mockProStandings]);

  useEffect(() => {
    if (!user?.id || user?.subscription_status !== "pro" || !proLeague?.id) return;

    let cancelled = false;

    async function ensureProLeagueMembership() {
      const { error } = await supabase
        .from("league_members")
        .upsert({ league_id: proLeague.id, user_id: user.id }, { onConflict: "league_id,user_id" });

      const message = String(error?.message || "").toLowerCase();
      const recoverable = !error || message.includes("duplicate") || message.includes("row-level security") || message.includes("violates");

      if (!cancelled && recoverable) {
        fetchLeagues();
        fetchLeagueStandings(proLeague.id);
      }
    }

    ensureProLeagueMembership();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.subscription_status, proLeague?.id]); // eslint-disable-line

  const leagueSummary = useMemo(() => {
    if (!currentStandings.length) {
      return { leader: null, average: 0, gap: 0 };
    }

    const total = currentStandings.reduce((sum, member) => sum + (member.points || 0), 0);
    return {
      leader: currentStandings[0],
      average: Math.round(total / currentStandings.length),
      gap: currentStandings.length > 1 ? (currentStandings[0].points || 0) - (currentStandings[1].points || 0) : currentStandings[0].points || 0,
    };
  }, [currentStandings]);
  const selectedLeagueRoundMeta = useMemo(() => roundMeta(leagueReviewRound), [leagueReviewRound]);
  const currentLeagueReviewKey = currentLeague?.id && leagueReviewRound ? `${currentLeague.id}:${leagueReviewRound}` : null;
  const currentLeagueReview = currentLeagueReviewKey ? leagueRoundReviews[currentLeagueReviewKey] : null;
  const currentLeagueRoundResult = currentLeagueReview?.resultRow
    || scoredRounds.find((row) => Number(row.race_round) === Number(leagueReviewRound))
    || null;
  const isViewingProLeague = currentLeague?.type === "pro_community";
  const canPostInCurrentLeague = Boolean(user && (!isViewingProLeague || (isProUser && !!proLeague?.id)));
  const privateLeagueCount = leagues.length;

  async function hydrateAuthorProfiles(items) {
    const ids = [...new Set((items || []).map((item) => item.author_id).filter((id) => id && !String(id).startsWith("mock-")))];
    if (!ids.length) return;

    const missing = ids.filter((id) => !authorProfiles[id]);
    if (!missing.length) return;

    const { data } = await supabase.from("profiles").select("id,avatar_color,username,favorite_team,subscription_status").in("id", missing);
    if (!data?.length) return;

    setAuthorProfiles((current) => ({
      ...current,
      ...Object.fromEntries(data.map((profile) => [profile.id, normalizeProfileIdentity(profile, user)])),
    }));
  }

  async function fetchPublicCommunity() {
    setLoadingLB(true);
    const { data, error } = await supabase.functions.invoke("community-public-feed", {
      body: {},
    });

    if (error) {
      setLeaderboard(mockProStandings);
      setLoadingLB(false);
      return;
    }

    const leaderboardRows = mergeProfilesByIdentity([
      ...((data?.leaderboard || []).map((profile) => normalizeProfileIdentity(profile, user))),
      ...mockProStandings,
    ], user)
      .sort((left, right) => (Number(right.points || 0) - Number(left.points || 0)) || left.username.localeCompare(right.username));

    setLeaderboard(leaderboardRows);
    setLoadingLB(false);
  }

  async function fetchLeagues() {
    const { data } = await supabase.from("league_members").select("league_id,leagues(*)").eq("user_id", user.id);
    if (!data) return;
    const nextLeagues = data
      .map((entry) => entry.leagues)
      .filter((league) => league && league.type !== "pro_community");
    setLeagues(nextLeagues);
    if (!nextLeagues.find((league) => league.id === selectedLeagueId) && selectedLeagueId !== visibleProLeagueId) {
      setSelectedLeagueId(visibleProLeagueId || nextLeagues[0]?.id || null);
    }
  }

  async function fetchProLeague() {
    const { data } = await supabase.from("leagues").select("*").eq("type", "pro_community").single();
    if (data) setProLeague(data);
  }

  async function fetchLeagueStandings(leagueId) {
    const isProBoard = leagueId === visibleProLeagueId;
    const fallbackStandings = mockProStandings;

    if (isProBoard && !proLeague?.id) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: fallbackStandings }));
      return;
    }

    const { data: members, error: membersError } = await supabase.from("league_members").select("user_id").eq("league_id", leagueId);

    if (membersError && isProBoard) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: fallbackStandings }));
      return;
    }

    const ids = (members || []).map((member) => member.user_id).filter(Boolean);

    if (!ids.length) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: isProBoard ? fallbackStandings : [] }));
      return;
    }

    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*").in("id", ids);

    if (profilesError && isProBoard) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: fallbackStandings }));
      return;
    }

    const sorted = mergeProfilesByIdentity([
      ...((profiles || []).map((profile) => normalizeProfileIdentity(profile, user))),
      ...(isProBoard ? fallbackStandings : []),
    ], user)
      .sort((a, b) => (Number(b.points || 0) - Number(a.points || 0)) || a.username.localeCompare(b.username));

    setLeagueStandings((current) => ({ ...current, [leagueId]: sorted }));
  }

  async function fetchScoredRounds() {
    const { data } = await supabase
      .from("race_results")
      .select("*")
      .eq("results_entered", true)
      .order("race_round", { ascending: false });

    setScoredRounds(data || []);
  }

  async function fetchLeagueRoundReview(leagueId, raceRound, standings = []) {
    const key = `${leagueId}:${raceRound}`;
    const members = standings.length ? standings : (leagueStandings[leagueId] || []);
    const memberIds = members.map((member) => member.id).filter(isUuidLike);
    const resultRow = scoredRounds.find((row) => Number(row.race_round) === Number(raceRound)) || null;

    if (!memberIds.length) {
      setLeagueRoundReviews((current) => ({
        ...current,
        [key]: { loading: false, error: null, resultRow, members: [] },
      }));
      return;
    }

    setLeagueRoundReviews((current) => ({
      ...current,
      [key]: {
        loading: true,
        error: null,
        resultRow,
        members: current[key]?.members || [],
      },
    }));

    const { data, error } = await supabase
      .from("predictions")
      .select("user_id,race_round,picks,score,score_breakdown,updated_at")
      .eq("race_round", raceRound)
      .in("user_id", memberIds);

    if (error) {
      setLeagueRoundReviews((current) => ({
        ...current,
        [key]: { loading: false, error: error.message, resultRow, members: [] },
      }));
      return;
    }

    const predictionMap = new Map((data || []).map((item) => [item.user_id, item]));
    const meta = roundMeta(raceRound);
    const ranked = members
      .map((member) => {
        const prediction = predictionMap.get(member.id) || null;
        const breakdown = Array.isArray(prediction?.score_breakdown) ? prediction.score_breakdown : [];
        const raceRows = buildLeagueReviewRows(LEAGUE_RACE_REVIEW_PROMPTS, prediction?.picks || {}, resultRow, breakdown);
        const sprintRows = meta?.sprint
          ? buildLeagueReviewRows(LEAGUE_SPRINT_REVIEW_PROMPTS, prediction?.picks || {}, resultRow, breakdown)
          : [];
        const correctCalls = [...raceRows, ...sprintRows].filter((row) => row.hit).length;
        const roundScore = prediction
          ? totalRowPoints(raceRows) + totalRowPoints(sprintRows) + bonusPointsFromBreakdown(breakdown)
          : 0;

        return {
          member,
          prediction,
          roundScore,
          correctCalls,
          breakdown,
          raceRows,
          sprintRows,
        };
      })
      .sort((left, right) => (
        (right.roundScore - left.roundScore)
        || ((right.member.points || 0) - (left.member.points || 0))
        || left.member.username.localeCompare(right.member.username)
      ));

    setLeagueRoundReviews((current) => ({
      ...current,
      [key]: { loading: false, error: null, resultRow, members: ranked },
    }));
  }

  async function fetchLeaguePosts(leagueId) {
    const isProBoard = leagueId === visibleProLeagueId;
    const fallbackPosts = isProBoard ? mockProPosts : [];

    if (isProBoard && !proLeague?.id) {
      setLeagueForumReady((current) => ({ ...current, [leagueId]: true }));
      setLeaguePosts((current) => ({ ...current, [leagueId]: fallbackPosts }));
      setAuthorProfiles((current) => ({
        ...Object.fromEntries(mockProStandings.map((profile) => [profile.id, profile])),
        ...current,
      }));
      return;
    }

    const { data, error } = await supabase.from("posts").select("*").eq("league_id", leagueId).order("created_at", { ascending: false });
    if (error) {
      if (isProBoard) {
        setLeagueForumReady((current) => ({ ...current, [leagueId]: true }));
        setLeaguePosts((current) => ({ ...current, [leagueId]: fallbackPosts }));
        setAuthorProfiles((current) => ({
          ...Object.fromEntries(mockProStandings.map((profile) => [profile.id, profile])),
          ...current,
        }));
        return;
      }

      setLeagueForumReady((current) => ({ ...current, [leagueId]: false }));
      setLeaguePosts((current) => ({ ...current, [leagueId]: [] }));
      return;
    }

    const mergedPosts = mergePostsByIdentity([...(data || []), ...fallbackPosts]);
    setLeagueForumReady((current) => ({ ...current, [leagueId]: true }));
    setLeaguePosts((current) => ({ ...current, [leagueId]: mergedPosts }));
    if (isProBoard) {
      setAuthorProfiles((current) => ({
        ...Object.fromEntries(mockProStandings.map((profile) => [profile.id, profile])),
        ...current,
      }));
    }
    hydrateAuthorProfiles(mergedPosts || []);
  }

  async function createLeague() {
    if (demoPreview) return;
    if (!leagueName.trim() || !user) return;
    setCreateError("");

    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    // Free users limited to 1 created league
    const isPro = user?.subscription_status === "pro";
    if (!isPro) {
      const ownedCount = leagues.filter((l) => l.owner_id === user.id).length;
      if (ownedCount >= 1) {
        setCreateError("Free accounts can create 1 league. Upgrade to Pro for unlimited leagues.");
        return;
      }
    }

    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const settings = {
      scoring_weights:    scoringWeights,
      sprint_multiplier:  sprintMultiplier,
      tiebreaker_order:   tiebreakerOrder,
      double_points_races: [],
      extra_categories:   extraCategories,
    };
    const { data, error } = await supabase.from("leagues").insert({
      name:       leagueName,
      code,
      owner_id:   user.id,
      is_public:  leagueVisibility === "public",
      game_mode:  leagueGameMode,
      visibility: leagueVisibility,
      settings,
    }).select().single();
    if (error) {
      alert(error.message);
      return;
    }

    const { error: memberError } = await supabase.from("league_members").insert({ league_id: data.id, user_id: user.id });
    if (memberError) {
      alert(memberError.message);
      return;
    }
    setLeagueName("");
    setLeagueGameMode("standard");
    setLeagueVisibility("private");
    setShowCreateModal(false);
    setCreateStep(0);
    setScoringWeights({ pole: 10, winner: 25, p2: 18, p3: 15, fl: 7, dotd: 6, dnf: 12, ctor: 8 });
    setSprintMultiplier(0.5);
    setTiebreakerOrder(["most_correct", "best_single_race", "head_to_head", "earliest_joined"]);
    setExtraCategories([]);
    setCreateError("");
    await fetchLeagues();
    setSelectedLeagueId(data.id);
  }

  async function joinLeague() {
    if (demoPreview) return;
    if (!joinCode.trim() || !user) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { data, error } = await supabase.from("leagues").select("*").eq("code", joinCode.toUpperCase()).single();
    if (error || !data) {
      alert("League not found.");
      return;
    }

    const { error: joinError } = await supabase.from("league_members").insert({ league_id: data.id, user_id: user.id });
    if (joinError) {
      alert("Already in this league or there was an error joining.");
      return;
    }

    setJoinCode("");
    await fetchLeagues();
    setSelectedLeagueId(data.id);
  }

  async function leaveLeague(leagueId) {
    if (demoPreview) return;
    if (!window.confirm("Leave this league?")) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { error } = await supabase.from("league_members").delete().eq("league_id", leagueId).eq("user_id", user.id);
    if (error) {
      alert(error.message);
      return;
    }
    await fetchLeagues();
    setLeagueMessage("");
  }

  async function deleteLeague(leagueId) {
    if (demoPreview) return;
    if (!window.confirm("Delete this league permanently?")) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { error } = await supabase.from("leagues").delete().eq("id", leagueId);
    if (error) {
      alert(error.message);
      return;
    }
    await fetchLeagues();
    setLeagueMessage("");
  }

  async function submitLeaguePost() {
    if (demoPreview) return;
    if (!leagueMessage.trim() || !user || !currentLeague) return;
    if (currentLeague.type === "pro_community" && user?.subscription_status !== "pro") {
      setPage?.("pro");
      return;
    }
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const message = leagueMessage.trim();
    const { error } = await supabase.from("posts").insert({
      author_id: user.id,
      author_name: user.username,
      title: message.slice(0, 72),
      body: message,
      league_id: currentLeague.id,
    });

    if (error) {
      setLeagueForumReady((current) => ({ ...current, [currentLeague.id]: false }));
      alert("League forum needs the `league_id` column on posts before it can be used.");
      return;
    }

    setLeagueMessage("");
    fetchLeaguePosts(currentLeague.id);
  }

  const communityTabs = [["leagues", "Leagues"], ["leaderboard", "Global Leaderboard"], ["standings", "F1 Standings"]];

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <style>{`
        .stnt-tab,.stnt-vtab{white-space:nowrap;transition:background 110ms ease,border-color 110ms ease,color 100ms ease,transform 90ms cubic-bezier(0.23,1,0.32,1)!important}
        .stnt-tab:active,.stnt-vtab:active{transform:scale(0.97)!important}
        .stnt-pro-card{transition:border-color 140ms ease,box-shadow 140ms ease,transform 110ms cubic-bezier(0.23,1,0.32,1)!important}
        .stnt-pro-card:active{transform:scale(0.982)!important}
        .stnt-league-item{transition:background 90ms ease,transform 70ms cubic-bezier(0.23,1,0.32,1)!important}
        .stnt-league-item:active{transform:scale(0.99)!important}
        .stnt-create{transition:opacity 110ms ease,transform 90ms cubic-bezier(0.23,1,0.32,1)!important}
        .stnt-create:active{transform:scale(0.97);opacity:0.82}
        .stnt-join{transition:background 110ms ease,transform 90ms cubic-bezier(0.23,1,0.32,1)!important}
        .stnt-join:active{transform:scale(0.96)!important}
        .stnt-action{transition:background 110ms ease,border-color 110ms ease,transform 90ms cubic-bezier(0.23,1,0.32,1)!important}
        .stnt-action:active{transform:scale(0.97)!important}
        .stnt-row{transition:background 70ms ease,transform 70ms cubic-bezier(0.23,1,0.32,1)!important}
        .stnt-row:active{transform:scale(0.99)!important}
        .stnt-send{transition:opacity 110ms ease,background 110ms ease,transform 90ms cubic-bezier(0.23,1,0.32,1)!important}
        .stnt-send:active{transform:scale(0.94);opacity:0.82}
        .stnt-tab:focus-visible,.stnt-vtab:focus-visible{outline:2px solid rgba(255,106,26,0.5);outline-offset:2px}
        .stnt-pro-card:focus-visible{outline:2px solid rgba(255,106,26,0.35);outline-offset:3px}
        .stnt-league-item:focus-visible{outline:2px solid rgba(255,106,26,0.5);outline-offset:-2px}
        .stnt-create:focus-visible,.stnt-join:focus-visible,.stnt-action:focus-visible,.stnt-send:focus-visible{outline:2px solid rgba(255,106,26,0.5);outline-offset:2px}
        @media(hover:hover)and(pointer:fine){
          .stnt-pro-card:hover{transform:translateY(-1px)!important;box-shadow:0 6px 22px rgba(2,6,23,0.28)!important}
          .stnt-league-item:hover{background:rgba(255,255,255,0.035)!important}
          .stnt-action:hover{background:rgba(255,255,255,0.06)!important}
          .stnt-row:hover{background:rgba(255,255,255,0.028)!important}
        }
        /* sidebar: restore two-column layout from isMobile breakpoint up to desktop threshold */
        @media(min-width:820px) and (max-width:1119px){
          .stnt-leagues-section{grid-template-columns:260px minmax(0,1fr)!important;gap:16px!important}
        }
        /* league view tabs: horizontal scroll strip, no wrapping */
        .stnt-vtab-strip{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:1px}
        .stnt-vtab-strip::-webkit-scrollbar{display:none}
        /* pick comparison grid: hide horizontal scrollbar cross-browser */
        .stnt-compare-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
        .stnt-compare-scroll::-webkit-scrollbar{display:none}
        @keyframes stntUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes stntPulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .stnt-in{animation:stntUp 180ms cubic-bezier(0.23,1,0.32,1) both}
        .stnt-in-fast{animation:stntUp 140ms cubic-bezier(0.23,1,0.32,1) both}
        .stnt-stagger>*{animation:stntUp 200ms cubic-bezier(0.23,1,0.32,1) both}
        .stnt-stagger>*:nth-child(1){animation-delay:0ms}
        .stnt-stagger>*:nth-child(2){animation-delay:22ms}
        .stnt-stagger>*:nth-child(3){animation-delay:44ms}
        .stnt-stagger>*:nth-child(4){animation-delay:66ms}
        .stnt-stagger>*:nth-child(5){animation-delay:88ms}
        .stnt-stagger>*:nth-child(6){animation-delay:110ms}
        .stnt-stagger>*:nth-child(7){animation-delay:132ms}
        .stnt-stagger>*:nth-child(8){animation-delay:150ms}
        .stnt-stagger>*:nth-child(n+9){animation-delay:150ms}
        @media(prefers-reduced-motion:reduce){
          .stnt-tab,.stnt-vtab,.stnt-pro-card,.stnt-league-item,.stnt-create,.stnt-join,.stnt-action,.stnt-row,.stnt-send{transition:none!important}
          .stnt-in,.stnt-in-fast,.stnt-stagger>*{animation:none!important}
          .stnt-race-banner-pulse{animation:none!important}
        }
      `}</style>
      <RaceWeekBanner race={next} isMobile={isMobile} />
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {communityTabs.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className="stnt-tab"
              style={{
                background: tab === value ? hexToRgba(ACCENT, 0.13) : "var(--btn-secondary-bg)",
                border: tab === value ? `1px solid ${hexToRgba(ACCENT, 0.30)}` : "1px solid rgba(148,163,184,0.12)",
                borderRadius: RADIUS_PILL,
                color: tab === value ? ACCENT : MUTED_TEXT,
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 12,
                padding: "9px 14px",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {tab === "leagues" && (
        user ? (
          <section className="stnt-in stnt-leagues-section" style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "300px minmax(0,1fr)", gap: 18 }}>
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              {/* ── Pro featured card ── */}
              {visibleProLeague && (() => {
                const active = selectedLeagueId === visibleProLeague.id;
                return (
                  <button
                    onClick={() => setSelectedLeagueId(visibleProLeague.id)}
                    className="stnt-pro-card"
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      border: active ? "1px solid rgba(245,158,11,0.38)" : "1px solid rgba(245,158,11,0.18)",
                      borderRadius: CARD_RADIUS,
                      overflow: "hidden",
                      cursor: "pointer",
                      padding: 0,
                      position: "relative",
                      boxShadow: active ? "0 0 0 3px rgba(245,158,11,0.12), 0 4px 20px rgba(0,0,0,0.5)" : LIFTED_SHADOW,
                      minHeight: 128,
                    }}
                  >
                    <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/images/Hero-Main.png')", backgroundSize: "cover", backgroundPosition: "center 30%", opacity: active ? 0.28 : 0.18, transition: "opacity 150ms ease", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", inset: 0, background: active ? "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(6,16,27,0.92) 100%)" : "linear-gradient(135deg, rgba(6,16,27,0.55) 0%, rgba(6,16,27,0.97) 100%)", pointerEvents: "none" }} />
                    <div style={{ position: "relative", padding: "14px 16px 16px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", minHeight: 128 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: RADIUS_PILL, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)" }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b" }} />
                          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fbbf24" }}>Pro League</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: active ? "#fef3c7" : "#e2e8f0", letterSpacing: -0.3, marginBottom: 4 }}>
                        {visibleProLeague.name || "Pro Community"}
                      </div>
                      <div style={{ marginTop: "auto" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, color: active ? "#fde68a" : "rgba(253,230,138,0.6)", lineHeight: 1 }}>$500</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: active ? "rgba(252,211,77,0.65)" : "rgba(148,163,184,0.45)", marginTop: 2 }}>
                          {isProUser ? "you're competing" : "season prize pool"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })()}

              {/* ── League list ── */}
              <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: CARD_SHADOW }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Your Leagues</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: TEXT_PRIMARY, fontVariantNumeric: "tabular-nums" }}>{privateLeagueCount}</span>
                </div>

                {/* Private leagues */}
                {leagues.length === 0 ? (
                  <div style={{ padding: "14px 16px", fontSize: 12, color: MUTED_TEXT, lineHeight: 1.65 }}>
                    Create or join a private league to track standings with your group.
                  </div>
                ) : (
                  leagues.map((league) => {
                    const active = league.id === selectedLeagueId;
                    return (
                      <button
                        key={league.id}
                        onClick={() => setSelectedLeagueId(league.id)}
                        className="stnt-league-item"
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          borderBottom: `1px solid ${HAIRLINE}`,
                          background: active ? hexToRgba(ACCENT, 0.07) : "transparent",
                          ...(active ? { outline: `1px solid ${hexToRgba(ACCENT, 0.18)}`, outlineOffset: -1 } : {}),
                          padding: "13px 16px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.01em", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{league.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: SUBTLE_TEXT, letterSpacing: "0.14em", fontFamily: "monospace", flexShrink: 0 }}>{league.code}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                          <span style={{ color: active ? hexToRgba(ACCENT, 0.8) : SUBTLE_TEXT }}>
                            {league.owner_id === user.id ? "Owner" : "Member"}
                          </span>
                          {(leagueStandings[league.id] || []).length > 0 && (
                            <>
                              <span style={{ color: HAIRLINE }}>·</span>
                              <span style={{ color: SUBTLE_TEXT }}>{(leagueStandings[league.id] || []).length} members</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}

                {/* ── Create / Join ── */}
                <div style={{ padding: "10px 12px", borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 8 }}>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="stnt-create"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: BRAND_GRADIENT, border: "none", borderRadius: RADIUS_SM, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "10px 14px", fontSize: 12, letterSpacing: "-0.01em" }}
                  >
                    <span>Create a league</span>
                    <span style={{ fontSize: 16, lineHeight: 1, opacity: 0.8 }}>+</span>
                  </button>
                  <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    <input
                      style={{ ...inputStyle, flex: 1, textTransform: "uppercase", letterSpacing: "0.16em", fontSize: 11, fontFamily: "monospace", textAlign: "center", borderRadius: RADIUS_SM, padding: "8px 10px" }}
                      placeholder="ENTER CODE"
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                      onKeyDown={(event) => event.key === "Enter" && joinLeague()}
                      maxLength={6}
                    />
                    <button
                      onClick={joinLeague}
                      className="stnt-join"
                      style={{ background: PANEL_BG_ALT, border: PANEL_BORDER, borderRadius: RADIUS_SM, color: MUTED_TEXT, cursor: "pointer", fontWeight: 800, padding: "8px 12px", fontSize: 11, whiteSpace: "nowrap" }}
                    >
                      Join
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              {currentLeague && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {isMobile ? (
                    <button
                      onClick={() => setSelectedLeagueId(null)}
                      style={{ background: "none", border: "none", color: SUBTLE_TEXT, cursor: "pointer", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", padding: 0, display: "flex", alignItems: "center", gap: 5 }}
                    >
                      ← Back
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelectedLeagueId(null)}
                        style={{ background: "none", border: "none", color: SUBTLE_TEXT, cursor: "pointer", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", padding: 0 }}
                      >
                        Leagues
                      </button>
                      <span style={{ color: "var(--brand)" }}>›</span>
                      <button
                        onClick={() => setLeagueView("standings")}
                        style={{ background: "none", border: "none", color: leagueView === "standings" ? "rgba(214,223,239,0.62)" : SUBTLE_TEXT, cursor: leagueView === "standings" ? "default" : "pointer", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", padding: 0 }}
                        disabled={leagueView === "standings"}
                      >
                        {currentLeague.name}
                      </button>
                      <span style={{ color: "var(--brand)" }}>›</span>
                      <span style={{ color: "rgba(214,223,239,0.62)" }}>
                        {LEAGUE_VIEW_LABELS[leagueView] || leagueView}
                      </span>
                    </>
                  )}
                </div>
              )}
              {currentLeague ? (
                <>
                  <div style={{ borderRadius: SECTION_RADIUS, border: currentLeague.type === "pro_community" ? "1px solid rgba(245,158,11,0.22)" : PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 16, boxShadow: currentLeague.type === "pro_community" ? LIFTED_SHADOW : CARD_SHADOW, position: "relative" }}>
                    {currentLeague.type === "pro_community" && (
                      <>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/images/Hero-Main.png')", backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.38 }} />
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,16,27,0.35) 0%, rgba(6,16,27,0.88) 65%, rgba(6,16,27,1) 100%)" }} />
                      </>
                    )}
                    <div style={{ position: "relative", padding: isMobile ? "16px 16px 14px" : "20px 22px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                        <div>
                          {currentLeague.type === "pro_community" && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: RADIUS_PILL, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.22)", marginBottom: 10 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
                              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fbbf24" }}>Pro League</span>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, letterSpacing: -0.8 }}>{currentLeague.name}</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {currentLeague.type !== "pro_community" && (
                            <>
                            <button onClick={() => navigator.clipboard?.writeText(currentLeague.code)} className="stnt-action" style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.14)", borderRadius: 12, color: "#dbe4f0", cursor: "pointer", fontWeight: 700, padding: "10px 12px", fontSize: 12 }}>
                              Code {currentLeague.code}
                            </button>
                            {currentLeague.owner_id === user.id ? (
                              <button onClick={() => deleteLeague(currentLeague.id)} className="stnt-action" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.26)", borderRadius: 12, color: "#fca5a5", cursor: "pointer", fontWeight: 700, padding: "10px 12px", fontSize: 12 }}>
                                Delete league
                              </button>
                            ) : (
                              <button onClick={() => leaveLeague(currentLeague.id)} className="stnt-action" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.26)", borderRadius: 12, color: "#fca5a5", cursor: "pointer", fontWeight: 700, padding: "10px 12px", fontSize: 12 }}>
                                Leave league
                              </button>
                            )}
                            </>
                          )}
                        </div>
                      </div>

                      {currentLeague.type === "pro_community" ? (
                        <>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: RADIUS_PILL, background: "rgba(245,158,11,0.09)", border: "1px solid rgba(245,158,11,0.18)" }}>
                              <span style={{ fontSize: 12, fontWeight: 900, color: "#fde68a", fontVariantNumeric: "tabular-nums" }}>{currentStandings.length || 0}</span>
                              <span style={{ fontSize: 10, color: "rgba(252,211,77,0.55)", fontWeight: 700 }}>competing</span>
                            </div>
                            {leagueSummary.leader && (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: RADIUS_PILL, background: "rgba(245,158,11,0.09)", border: "1px solid rgba(245,158,11,0.18)" }}>
                                <span style={{ fontSize: 12, fontWeight: 900, color: "#fde68a" }}>{leagueSummary.leader.username}</span>
                                <span style={{ fontSize: 10, color: "rgba(252,211,77,0.55)", fontWeight: 700 }}>leading</span>
                              </div>
                            )}
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: RADIUS_PILL, background: isProUser ? "rgba(34,197,94,0.1)" : "rgba(96,165,250,0.1)", border: isProUser ? "1px solid rgba(34,197,94,0.22)" : "1px solid rgba(96,165,250,0.22)" }}>
                              <span style={{ fontSize: 12, fontWeight: 900, color: isProUser ? "#86efac" : "#93c5fd" }}>{isProUser ? "Competing" : "Viewing"}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(252,211,77,0.55)", fontWeight: 700 }}>
                            Champion $250 · Podium pool $500 · Season perks for top 3
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.6 }}>
                          <span style={{ color: TEXT_PRIMARY, fontWeight: 800 }}>{currentStandings.length || 0}</span> members
                          {leagueSummary.leader && <> · Leader: <span style={{ color: TEXT_PRIMARY, fontWeight: 800 }}>{leagueSummary.leader.username}</span></>}
                          {leagueSummary.average > 0 && <> · Avg {leagueSummary.average} pts</>}
                          {next?.n && <> · Next: {next.n}</>}
                        </div>
                      )}

                      <div className="stnt-vtab-strip" style={{ marginTop: 16 }}>
                        {[["standings", "Standings"], ["review", "Round Review"], ["chat", "Chat"], ["setup", "Rules"]].map(([value, label]) => (
                          <button
                            key={value}
                            onClick={() => setLeagueView(value)}
                            className="stnt-vtab"
                            style={{
                              background: leagueView === value ? hexToRgba(ACCENT, 0.13) : "transparent",
                              border: leagueView === value ? `1px solid ${hexToRgba(ACCENT, 0.3)}` : "1px solid rgba(148,163,184,0.14)",
                              borderRadius: RADIUS_PILL,
                              color: leagueView === value ? ACCENT : MUTED_TEXT,
                              cursor: "pointer",
                              padding: "8px 14px",
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: "0.01em",
                              flexShrink: 0,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {leagueView === "standings" && (
                    <div className="stnt-in-fast">
                      <LeagueStandingsView
                        currentLeague={currentLeague}
                        currentStandings={currentStandings}
                        leagueStandings={leagueStandings}
                        leagueSummary={leagueSummary}
                        isTablet={isTablet}
                      />
                    </div>
                  )}

                  {leagueView === "review" && (
                    <div className="stnt-in-fast">
                      <LeagueReviewView
                        currentLeague={currentLeague}
                        currentLeagueReview={currentLeagueReview}
                        currentLeagueRoundResult={currentLeagueRoundResult}
                        selectedLeagueRoundMeta={selectedLeagueRoundMeta}
                        scoredRounds={scoredRounds}
                        leagueReviewRound={leagueReviewRound}
                        setLeagueReviewRound={setLeagueReviewRound}
                        isMobile={isMobile}
                        isTablet={isTablet}
                      />
                    </div>
                  )}

                  {leagueView === "chat" && (
                    <div className="stnt-in-fast">
                      <LeagueChatView
                        items={currentLeaguePosts}
                        user={user}
                        isMobile={isMobile}
                        authorProfiles={authorProfiles}
                        currentLeague={currentLeague}
                        canPost={canPostInCurrentLeague}
                        leagueMessage={leagueMessage}
                        setLeagueMessage={setLeagueMessage}
                        onSubmit={submitLeaguePost}
                        forumReady={leagueForumReady[currentLeague.id]}
                        setPage={setPage}
                        openAuth={openAuth}
                      />
                    </div>
                  )}

                  {leagueView === "setup" && (
                    <div className="stnt-in-fast">
                      <LeagueSetupView
                        currentLeague={currentLeague}
                        currentLeagueScoring={currentLeagueScoring}
                        currentLeagueTiebreakers={currentLeagueTiebreakers}
                        currentLeagueSprintMultiplier={currentLeagueSprintMultiplier}
                        currentLeagueDoublePointsRaces={currentLeagueDoublePointsRaces}
                        isMobile={isMobile}
                        isTablet={isTablet}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: 28, boxShadow: SOFT_SHADOW }}>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8, marginBottom: 8 }}>No league selected</div>
                  <div style={{ fontSize: 13, lineHeight: 1.65, color: MUTED_TEXT }}>
                    Create a new league or join with a code to open a dedicated standings and discussion space.
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div style={{ borderRadius: SECTION_RADIUS, border: "1px solid rgba(245,158,11,0.22)", background: PANEL_BG, overflow: "hidden", boxShadow: LIFTED_SHADOW, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/images/Hero-Main.png')", backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.22 }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(6,16,27,0.4) 0%, rgba(6,16,27,0.96) 60%, rgba(6,16,27,1) 100%)" }} />
            <div style={{ position: "relative", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
              <div style={{ maxWidth: 640 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b" }} />
                  <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fbbf24" }}>Pro League Preview</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8, marginBottom: 8 }}>{visibleProLeague?.name || "Stint Pro Community"}</div>
                <div style={{ fontSize: 13, lineHeight: 1.72, color: MUTED_TEXT, marginBottom: 12 }}>
                  Everyone can browse the flagship season board from the Leagues tab. Pro members are entered automatically, compete for prizes, and unlock the live forum.
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      if (demoPreview) {
                        const url = new URL(window.location.href);
                        url.searchParams.delete("demo");
                        url.searchParams.set("page", "community");
                        window.location.href = url.toString();
                        return;
                      }
                      openAuth("login", { page: "community" });
                    }}
                    style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "12px 14px", fontSize: 13 }}
                  >
                    {demoPreview ? "Login to explore" : "Login"}
                  </button>
                  <button onClick={() => setPage?.("pro")} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.18)", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "12px 14px", fontSize: 13 }}>
                    Join Pro
                  </button>
                  <button onClick={() => setTab("leaderboard")} style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 12, color: MUTED_TEXT, cursor: "pointer", fontWeight: 800, padding: "12px 14px", fontSize: 13 }}>
                    Open Global Leaderboard
                  </button>
                </div>
              </div>

              <div style={{ minWidth: isMobile ? "100%" : 320, flex: "1 1 320px", borderRadius: 18, border: "1px solid rgba(245,158,11,0.16)", background: "rgba(10,16,30,0.56)", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${HAIRLINE}`, background: "var(--btn-secondary-bg)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Top drivers</div>
                  <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Live season preview</div>
                </div>
                <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
                  {mockProStandings.slice(0, 5).map((member, index) => (
                    <div key={member.id} style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) 86px", background: index === 0 ? "rgba(245,158,11,0.06)" : index === 1 ? "rgba(203,213,225,0.04)" : PANEL_BG }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: index < 3 ? 14 : 12, fontWeight: 900, color: index === 0 ? "#F59E0B" : index === 1 ? "#CBD5E1" : index === 2 ? "#C2956C" : SUBTLE_TEXT }}>{index + 1}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                        <AvatarChip name={member.username} colorKey={member.avatar_color} pro={isProProfile(member)} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800 }}>{member.username}</div>
                          <div style={{ fontSize: 11, color: MUTED_TEXT }}>{index === 0 ? "Championship pace" : "Pro league driver"}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, fontVariantNumeric: "tabular-nums" }}>{member.points || 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
          </div>
        )
      )}

      {tab === "leaderboard" && (
        <section className="stnt-in" style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: LIFTED_SHADOW }}>
          <PageMasthead
            variant="flush"
            marginBottom={0}
            eyebrow={loadingLB ? "Loading" : "Live standings"}
            eyebrowTone="live"
            title="Global standings"
            description="Every player ranked by season score"
            image={{ src: "/images/hero-glow.png" }}
            tone="ambient"
            minHeight={isMobile ? 110 : isTablet ? 132 : 156}
            style={{ padding: isMobile ? "16px 16px 14px" : "20px 22px 16px" }}
            meta={!loadingLB && leaderboard.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
                <div style={{ borderRadius: 16, border: `1px solid ${hexToRgba(ACCENT, 0.2)}`, background: hexToRgba(ACCENT, 0.06), padding: "8px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)" }}>{leaderboard.length}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 2 }}>Players</div>
                </div>
                <div style={{ borderRadius: 16, border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.06)", padding: "8px 12px 8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                  <AvatarChip name={leaderboard[0]?.username || "?"} colorKey={leaderboard[0]?.avatar_color} size={28} radius={9} fontSize={10} pro={isProProfile(leaderboard[0])} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: -0.2, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{leaderboard[0]?.username || "—"}</div>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Season leader</div>
                  </div>
                </div>
              </div>
            ) : null}
          />
          {loadingLB ? (
            <div style={{ padding: 30, color: MUTED_TEXT, fontSize: 13 }}>Loading leaderboard...</div>
          ) : leaderboard.length === 0 ? (
            <div style={{ padding: "28px 22px", color: MUTED_TEXT, textAlign: "center", fontSize: 13 }}>No players yet.</div>
          ) : (
            <>
              {/* Podium — P1/P2/P3 */}
              {leaderboard.length >= 3 && (
                <div style={{ padding: isMobile ? "16px 14px" : "20px 18px", borderBottom: `1px solid ${HAIRLINE}`, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 10 }}>
                  {[
                    { index: 0, color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.22)", label: "Champion" },
                    { index: 1, color: "#CBD5E1", bg: "rgba(203,213,225,0.06)", border: "rgba(203,213,225,0.16)", label: "P2" },
                    { index: 2, color: "#C2956C", bg: "rgba(180,130,80,0.06)", border: "rgba(180,130,80,0.18)", label: "P3" },
                  ].map(({ index, color, bg, border, label }) => {
                    const player = leaderboard[index];
                    const isMe = player?.id === user?.id;
                    return (
                      <div key={index} style={{ borderRadius: 14, border: `1px solid ${border}`, background: bg, padding: "14px 15px 13px", display: "flex", alignItems: "center", gap: 12 }}>
                        <AvatarChip name={player?.username} colorKey={player?.avatar_color} size={index === 0 ? 42 : 36} radius={index === 0 ? 14 : 12} fontSize={index === 0 ? 14 : 12} pro={isProProfile(player)} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color, marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isMe ? hexToRgba(ACCENT, 0.9) : TEXT_PRIMARY }}>{player?.username || "—"}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: index === 0 ? 20 : 17, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>{player?.points || 0}</div>
                          <div style={{ fontSize: 10, color: SUBTLE_TEXT, marginTop: 1 }}>pts</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) 100px", background: PANEL_BG_ALT, borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ textAlign: "center", padding: "8px 0", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>#</div>
                <div style={{ padding: "8px 14px", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Player</div>
                <div style={{ textAlign: "right", padding: "8px 16px 8px 0", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Pts</div>
              </div>
              <div className="stnt-stagger" style={{ display: "grid", gap: 1, background: HAIRLINE, maxHeight: 600, overflowY: "auto" }}>
                {leaderboard.map((player, index) => {
                  const isMe = player.id === user?.id;
                  return (
                    <div key={player.id || player.username} className="stnt-row" style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) 100px", background: isMe ? hexToRgba(ACCENT, 0.07) : index === 0 ? "rgba(245,158,11,0.07)" : index === 1 ? "rgba(203,213,225,0.04)" : index === 2 ? "rgba(180,130,80,0.04)" : PANEL_BG, outline: isMe ? `1px solid ${hexToRgba(ACCENT, 0.18)}` : "none", outlineOffset: -1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: index === 0 ? 18 : index < 3 ? 15 : 13, fontWeight: 900, color: index === 0 ? "#F59E0B" : index === 1 ? "#CBD5E1" : index === 2 ? "#C2956C" : SUBTLE_TEXT, fontVariantNumeric: "tabular-nums" }}>
                        {index + 1}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: index < 3 ? "14px 14px" : "11px 14px" }}>
                        <AvatarChip name={player.username} colorKey={player.avatar_color} size={index < 3 ? 36 : 32} radius={index < 3 ? 11 : 10} pro={isProProfile(player)} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: index < 3 ? 14 : 13, fontWeight: 800, color: isMe ? hexToRgba(ACCENT, 0.9) : TEXT_PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.username}</div>
                          <div style={{ fontSize: 11, color: MUTED_TEXT }}>{isMe ? "You" : index === 0 ? "Season leader" : index === 1 ? "Podium pace" : index === 2 ? "Prize bracket" : "Active player"}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", padding: "0 16px 0 0" }}>
                        <div style={{ fontSize: index < 3 ? 18 : 15, fontWeight: 900, color: isMe ? hexToRgba(ACCENT, 0.9) : index < 3 ? "#f8fafc" : TEXT_PRIMARY, fontVariantNumeric: "tabular-nums" }}>{player.points || 0}</div>
                        {index < 3 && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: SUBTLE_TEXT }}>pts</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "standings" && (
        <div className="stnt-in"><StandingsPage compact /></div>
      )}

      {/* ── Create League Modal ── */}
      {showCreateModal && (
        <CreateLeagueModal
          user={user}
          isMobile={isMobile}
          viewportHeight={viewportHeight}
          leagueName={leagueName}
          setLeagueName={setLeagueName}
          leagueGameMode={leagueGameMode}
          setLeagueGameMode={setLeagueGameMode}
          leagueVisibility={leagueVisibility}
          setLeagueVisibility={setLeagueVisibility}
          scoringWeights={scoringWeights}
          setScoringWeights={setScoringWeights}
          sprintMultiplier={sprintMultiplier}
          setSprintMultiplier={setSprintMultiplier}
          tiebreakerOrder={tiebreakerOrder}
          setTiebreakerOrder={setTiebreakerOrder}
          extraCategories={extraCategories}
          setExtraCategories={setExtraCategories}
          createError={createError}
          setCreateError={setCreateError}
          createStep={createStep}
          setCreateStep={setCreateStep}
          onClose={() => { setShowCreateModal(false); setCreateError(""); setCreateStep(0); }}
          onSubmit={createLeague}
          onGoToPro={() => setPage?.("pro")}
        />
      )}
    </div>
  );
}
