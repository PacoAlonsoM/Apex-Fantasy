import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/src/lib/supabase";
import { CAL, countdown, fmt, nextRace, rc } from "@/src/constants/calendar";
import { PTS } from "@/src/constants/scoring";
import {
  ACCENT,
  BRAND_GRADIENT,
  CARD_RADIUS,
  CARD_SHADOW,
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
  SUCCESS_BG,
  SUCCESS_BORDER,
  SUCCESS_TEXT,
  TEXT_PRIMARY,
  WARM,
  teamSupportKey,
} from "@/src/constants/design";
import { requireActiveSession } from "@/src/shell/authProfile";
import { formatDnfDrivers, matchesDnfPick } from "@/src/lib/resultHelpers";
import useViewport from "@/src/lib/useViewport";
import { hexToRgba } from "@/src/lib/colors";
import { ProBadge } from "@/src/ui/ProBadge";
import { formatStamp } from "@/src/lib/format";
import IdentityAvatar from "@/src/ui/IdentityAvatar";
import PageMasthead from "@/src/ui/PageMasthead";
import PageShell from "@/src/ui/PageShell";
import StatusBadge from "@/src/ui/StatusBadge";


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

// ─── LeaguesLede ──────────────────────────────────────────────────────────────
// The Leagues-tab equivalent of the Home race-week lede: not about a race,
// but about the user's competitive context — how many leagues they're in,
// when the next standings shake-up is, and the two primary actions (create /
// join). For anon visitors it becomes a clean "sign in to play" surface.

function lockStateForCountdown(cd) {
  if (!cd) return null;
  if (cd.d >= 1) return { status: "open",      label: "Open" };
  if (cd.h >= 6) return { status: "lock-soon", label: "Lock soon" };
  if (cd.h >= 1) return { status: "lock-soon", label: `Lock < ${cd.h}h` };
  return            { status: "lock-now",  label: `Lock < ${cd.m}m` };
}

function formatCountdownShort(cd) {
  if (!cd) return "—";
  if (cd.d >= 1) return `${cd.d}d ${cd.h}h`;
  if (cd.h >= 1) return `${cd.h}h ${cd.m}m`;
  return `${cd.m}m`;
}

function LeaguesLede({
  user,
  demoMode,
  race,
  leagueCount,
  proActive,
  joinCode,
  setJoinCode,
  onJoin,
  onCreate,
  onOpenAuth,
  isMobile,
}) {
  const cd       = race ? countdown(race.date) : null;
  const lock     = lockStateForCountdown(cd);
  const isAnon   = !user && !demoMode;
  const cdLabel  = formatCountdownShort(cd);

  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: SECTION_RADIUS,
        border: PANEL_BORDER,
        background: `
          linear-gradient(135deg, ${hexToRgba(ACCENT, 0.34)} 0%, ${hexToRgba(WARM, 0.12)} 36%, rgba(6,16,27,0.96) 100%),
          url("/images/Close%20racing.png") center / cover no-repeat,
          ${PANEL_BG}
        `,
        boxShadow: LIFTED_SHADOW,
        marginBottom: isMobile ? 16 : 22,
        minHeight: isMobile ? 0 : 280,
        padding: isMobile ? "20px 18px 22px" : "30px 30px 26px",
      }}
    >
      {/* Top accent rail */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${WARM} 60%, ${ACCENT} 80%, transparent)`,
          opacity: 0.92,
        }}
      />

      <div
        className="f1-stagger-strong"
        style={{ display: "grid", gap: isMobile ? 14 : 18 }}
      >
        {/* Row 1: kicker + race-week chip */}
        <div style={{ "--f1-i": 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: SUBTLE_TEXT }}>
            <span
              aria-hidden="true"
              style={{
                width: 6, height: 6, borderRadius: "50%", background: ACCENT,
                boxShadow: `0 0 0 4px ${hexToRgba(ACCENT, 0.20)}`,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              {isAnon ? "Leagues" : "Your leagues"}
            </span>
          </div>
          {race && lock && (
            <StatusBadge status={lock.status} dot={lock.status === "open"}>
              {race.n.replace(/grand prix/i, "GP").trim()} · {cdLabel}
            </StatusBadge>
          )}
        </div>

        {/* Row 2: title + stats line */}
        <div style={{ "--f1-i": 1 }}>
          <h1
            className="stint-page-title"
            style={{
              margin: 0,
              fontSize: isMobile ? 38 : 68,
              letterSpacing: "-0.05em",
              lineHeight: 0.92,
              color: "rgba(255,255,255,0.98)",
              textShadow: "0 2px 18px rgba(0,0,0,0.36)",
              maxWidth: 820,
              textTransform: "uppercase",
            }}
          >
            {isAnon
              ? "Play with friends. Race for prizes."
              : leagueCount === 0
                ? "Spin up your first league"
                : leagueCount === 1
                  ? "1 league in play"
                  : `${leagueCount} leagues in play`}
          </h1>
          <div
            style={{
              marginTop: 12,
              fontSize: isMobile ? 13 : 15,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.78)",
              maxWidth: 620,
            }}
          >
            {isAnon
              ? "Create a free account to make picks, set custom scoring, and join private leagues. Pro members compete for the season prize pool."
              : leagueCount === 0
                ? "Create a private league for your group, or join one with a 6-character code."
                : (
                  <>
                    Picks lock at every race.{" "}
                    {proActive
                      ? "You're racing the Pro Community for the season prize. "
                      : "Tap a league below to see standings, post in the room, or open the round review. "}
                    Standings update minutes after the chequered flag.
                  </>
                )}
          </div>
        </div>

        {/* Row 3: actions */}
        <div
          style={{ "--f1-i": 2, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
        >
          {isAnon ? (
            <button
              type="button"
              onClick={() => onOpenAuth?.("register", { page: "community" })}
              className="stint-button f1-hoverable"
              style={{ minHeight: 48, padding: "0 22px", fontSize: 14, fontWeight: 900 }}
            >
              Create account <span aria-hidden="true" style={{ marginLeft: 8 }}>↗</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onCreate}
                className="stint-button f1-hoverable"
                style={{ minHeight: 48, padding: "0 22px", fontSize: 14, fontWeight: 900 }}
              >
                Create league <span aria-hidden="true" style={{ marginLeft: 8 }}>+</span>
              </button>
              <form
                onSubmit={(event) => { event.preventDefault(); onJoin?.(); }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--btn-secondary-bg)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: RADIUS_PILL,
                  padding: "4px 4px 4px 14px",
                  minHeight: 48,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT, whiteSpace: "nowrap" }}>
                  Code
                </span>
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="STINT1"
                  maxLength={6}
                  style={{
                    width: 86,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: TEXT_PRIMARY,
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                    textAlign: "center",
                    textTransform: "uppercase",
                  }}
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="f1-hoverable"
                  style={{
                    minHeight: 40,
                    padding: "0 16px",
                    border: "none",
                    borderRadius: RADIUS_PILL,
                    background: joinCode.trim() ? ACCENT : "var(--btn-secondary-bg)",
                    color: joinCode.trim() ? "#fffaf5" : SUBTLE_TEXT,
                    cursor: joinCode.trim() ? "pointer" : "not-allowed",
                    fontWeight: 900,
                    fontSize: 13,
                    letterSpacing: "-0.005em",
                    transition: "background 160ms cubic-bezier(0.23,1,0.32,1), color 160ms cubic-bezier(0.23,1,0.32,1)",
                  }}
                >
                  Join
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── League card ──────────────────────────────────────────────────────────────
// Single-league tile used in the LeagueGrid. Two variants:
//   • "pro"     — flagship Pro Community card with Hero-Main backdrop, amber
//                 gradient, prize-pool callout, "Pro League" status pill.
//   • "private" — neutral PANEL_BG_ALT surface, member count + code + your-rank
//                 + top-3 avatar row.
// Hover lift comes from `.f1-hoverable`; active state via ACCENT outline.

function LeagueCard({
  league,
  active,
  variant = "private",
  members = [],
  yourRank,
  proActive,
  onSelect,
  isMobile,
}) {
  const isPro = variant === "pro";
  const memberCount = members.length;
  const top3 = members.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="f1-hoverable"
      style={{
        position: "relative",
        overflow: "hidden",
        textAlign: "left",
        cursor: "pointer",
        appearance: "none",
        width: "100%",
        minHeight: isMobile ? 168 : 196,
        padding: isMobile ? "18px 18px 16px" : "22px 22px 20px",
        borderRadius: CARD_RADIUS,
        border: active
          ? `1px solid ${isPro ? "rgba(245,158,11,0.46)" : hexToRgba(ACCENT, 0.42)}`
          : `1px solid ${isPro ? "rgba(245,158,11,0.22)" : PANEL_BORDER.replace("1px solid ", "")}`,
        background: isPro
          ? `linear-gradient(160deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.04) 36%, ${PANEL_BG} 96%), url("/images/Close%20racing.png") center / cover no-repeat, ${PANEL_BG}`
          : active
            ? `linear-gradient(160deg, ${hexToRgba(ACCENT, 0.10)} 0%, ${PANEL_BG_ALT} 80%)`
            : PANEL_BG_ALT,
        boxShadow: active ? LIFTED_SHADOW : CARD_SHADOW,
        color: TEXT_PRIMARY,
        display: "grid",
        gap: 10,
        gridTemplateRows: "auto auto 1fr auto",
        fontFamily: "var(--font-body)",
        transition: "background 200ms cubic-bezier(0.23,1,0.32,1), border-color 200ms cubic-bezier(0.23,1,0.32,1)",
      }}
    >
      {isPro && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: "linear-gradient(90deg, transparent, #f59e0b 30%, #fbbf24 60%, #f59e0b 80%, transparent)",
            opacity: 0.92,
          }}
        />
      )}

      {/* Top row: kicker + member count chip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {isPro ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: RADIUS_PILL, background: "rgba(245,158,11,0.16)", border: "1px solid rgba(245,158,11,0.32)" }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fde68a" }}>Pro League</span>
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
            {league.owner_id ? "Private league" : "League"}
          </span>
        )}
        <span
          className="stint-tabular"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: RADIUS_PILL,
            background: isPro ? "rgba(245,158,11,0.10)" : "var(--btn-secondary-bg)",
            border: `1px solid ${isPro ? "rgba(245,158,11,0.22)" : "var(--border-soft)"}`,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.06em",
            color: isPro ? "#fde68a" : SUBTLE_TEXT,
          }}
        >
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>
      </div>

      {/* League name */}
      <h3
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: isMobile ? 22 : 26,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          color: isPro ? "rgba(255,255,255,0.98)" : TEXT_PRIMARY,
          textShadow: isPro ? "0 1px 8px rgba(0,0,0,0.32)" : "none",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {league.name || (isPro ? "Stint Pro Community" : "League")}
      </h3>

      {/* Middle: prize callout (Pro) or rank+code (private) */}
      <div style={{ alignSelf: "end" }}>
        {isPro ? (
          <>
            <div
              className="stint-tabular"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 36 : 44,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                color: "#fde68a",
                lineHeight: 0.92,
              }}
            >
              $500
            </div>
            <div style={{ fontSize: 11, color: "rgba(252,211,77,0.72)", fontWeight: 700, marginTop: 4 }}>
              {proActive ? "Season prize · you're in" : "Season prize pool"}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            {Number.isFinite(yourRank) && yourRank > 0 ? (
              <div>
                <div className="stint-tabular" style={{ fontFamily: "var(--font-mono)", fontSize: isMobile ? 30 : 36, fontWeight: 700, letterSpacing: "-0.04em", color: TEXT_PRIMARY, lineHeight: 0.92 }}>
                  #{yourRank}
                </div>
                <div style={{ fontSize: 10, color: SUBTLE_TEXT, fontWeight: 700, marginTop: 4, letterSpacing: "0.10em", textTransform: "uppercase" }}>Your rank</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.5 }}>
                Standings populate as picks are scored.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: top-3 micro-roster + code + chevron */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 4 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {top3.length > 0 ? (
            <>
              <div style={{ display: "inline-flex", marginLeft: 4 }}>
                {top3.map((member, i) => (
                  <span
                    key={member.id || i}
                    style={{ marginLeft: i === 0 ? 0 : -6, display: "inline-flex" }}
                  >
                    <IdentityAvatar
                      username={member.username}
                      colorKey={member.avatar_color}
                      size={isMobile ? 24 : 26}
                      pro={isProProfile(member)}
                    />
                  </span>
                ))}
              </div>
              {memberCount > top3.length && (
                <span className="stint-tabular" style={{ fontSize: 11, fontWeight: 700, color: SUBTLE_TEXT }}>
                  +{memberCount - top3.length}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11, color: SUBTLE_TEXT, fontWeight: 700 }}>No members yet</span>
          )}
        </div>

        {!isPro && league.code && (
          <span
            className="stint-tabular"
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.16em",
              color: SUBTLE_TEXT,
              fontFamily: "var(--font-mono)",
              padding: "3px 9px",
              borderRadius: RADIUS_PILL,
              background: "var(--btn-secondary-bg)",
              border: "1px solid var(--border-soft)",
            }}
          >
            {league.code}
          </span>
        )}
        {isPro && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 900, color: "#fde68a", letterSpacing: "-0.005em" }}>
            {proActive ? "Manage" : "Join Pro"} <span aria-hidden="true">↗</span>
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Empty leagues state ──────────────────────────────────────────────────────

function EmptyLeaguesState({ onCreate, isMobile }) {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: SECTION_RADIUS,
        border: PANEL_BORDER,
        background: `
          linear-gradient(160deg, ${hexToRgba(ACCENT, 0.08)} 0%, ${PANEL_BG_ALT} 80%),
          ${PANEL_BG_ALT}
        `,
        padding: isMobile ? "32px 24px 28px" : "52px 40px 44px",
        textAlign: "center",
        marginBottom: 22,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
        No leagues yet
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: isMobile ? 28 : 40,
          fontWeight: 900,
          letterSpacing: "-0.045em",
          lineHeight: 1.05,
          color: TEXT_PRIMARY,
          marginBottom: 12,
        }}
      >
        Spin up your first league
      </h2>
      <div style={{ fontSize: isMobile ? 13 : 14, lineHeight: 1.65, color: MUTED_TEXT, maxWidth: 480, margin: "0 auto 22px" }}>
        Create a private room for your group, or paste a 6-character code above to join one. Standings update after every race.
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="stint-button f1-hoverable"
        style={{ minHeight: 48, padding: "0 22px", fontSize: 14, fontWeight: 900 }}
      >
        Create your first league <span aria-hidden="true" style={{ marginLeft: 8 }}>+</span>
      </button>
    </section>
  );
}

// ─── League switcher (inside deep-dive) ──────────────────────────────────────
// Horizontal pill strip of every league the user is part of (Pro + private).
// Replaces the hidden sidebar — users can hop between leagues without going
// back to the grid. Same pattern as Home's RoundSelector.

function LeagueSwitcher({ proLeague, privateLeagues, selectedId, onSelect, onAllLeagues, isMobile }) {
  const all = [
    ...(proLeague ? [proLeague] : []),
    ...privateLeagues,
  ];
  if (all.length <= 1) {
    // Single league — no point in a switcher; just offer the back link.
    return (
      <div style={{ marginBottom: 14 }}>
        <button
          type="button"
          onClick={onAllLeagues}
          style={{
            background: "none",
            border: "none",
            color: SUBTLE_TEXT,
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← All leagues
        </button>
      </div>
    );
  }
  return (
    <section style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
          Switch league
        </span>
        <button
          type="button"
          onClick={onAllLeagues}
          style={{
            background: "none",
            border: "none",
            color: ACCENT,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            padding: 0,
          }}
        >
          All leagues →
        </button>
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 6,
          WebkitOverflowScrolling: "touch",
          scrollSnapType: "x proximity",
        }}
      >
        {all.map((league) => {
          const active = league.id === selectedId;
          const isPro  = league.type === "pro_community";
          return (
            <button
              key={league.id}
              type="button"
              onClick={() => onSelect(league.id)}
              aria-pressed={active}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
                scrollSnapAlign: "start",
                padding: "8px 14px",
                borderRadius: RADIUS_PILL,
                border: active
                  ? `1px solid ${isPro ? "rgba(245,158,11,0.42)" : hexToRgba(ACCENT, 0.42)}`
                  : `1px solid ${isPro ? "rgba(245,158,11,0.18)" : "var(--border-soft)"}`,
                background: active
                  ? (isPro ? "rgba(245,158,11,0.14)" : hexToRgba(ACCENT, 0.13))
                  : "var(--btn-secondary-bg)",
                color: active ? (isPro ? "#fde68a" : ACCENT) : TEXT_PRIMARY,
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "-0.005em",
                cursor: "pointer",
                whiteSpace: "nowrap",
                minHeight: 38,
                transition:
                  "background 140ms cubic-bezier(0.23,1,0.32,1), border-color 140ms cubic-bezier(0.23,1,0.32,1), color 140ms cubic-bezier(0.23,1,0.32,1)",
              }}
            >
              {isPro && (
                <span
                  aria-hidden="true"
                  style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }}
                />
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: isMobile ? 140 : 220 }}>
                {league.name || (isPro ? "Pro Community" : "League")}
              </span>
              {!isPro && league.code && (
                <span className="stint-tabular" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: active ? hexToRgba(ACCENT, 0.78) : SUBTLE_TEXT, fontFamily: "var(--font-mono)" }}>
                  {league.code}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
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
  { key: "double_down",  label: "Double Down",  pro: true,  desc: "Triple one pick per race — or lose points." },
  { key: "budget_picks", label: "Budget Picks", pro: true,  desc: "50 credits per race, bet on your picks." },
  { key: "draft",        label: "Draft",        pro: true,  desc: "Snake-draft your drivers at season start.", comingSoon: true },
  { key: "head_to_head", label: "Head-to-Head", pro: true,  desc: "Bracket: beat your opponent each weekend.", comingSoon: true },
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

// ─── Fallback data ────────────────────────────────────────────────────────────

const FALLBACK_PRO_LEAGUE = {
  id: "pro-community-fallback",
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

// ─── Data utilities ───────────────────────────────────────────────────────────

function identityKey(profile) {
  return String(profile?.username || profile?.id || "").trim().toLowerCase();
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function isProProfile(profile, fallbackName = "") {
  return profile?.subscription_status === "pro";
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
        || breakdown.find((item) => item.key === prompt.key)
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

async function leagueApiRequest(path, { method = "POST", session, userId, body = {} } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(userId ? { "x-user-id": userId } : {}),
    },
    body: JSON.stringify({ userId, ...body }),
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.detail || payload?.error || "League request failed.";
    throw new Error(message);
  }

  return payload;
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function LeagueStandingsView({ user, currentLeague, currentStandings, leagueStandings, leagueSummary, isMobile, isTablet }) {
  const leaderPts = Number(leagueSummary.leader?.points || 0);
  const leagueLabel = currentLeague?.name || "League";
  return (
    <section style={{ position: "relative", borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 3,
          background: `linear-gradient(180deg, ${ACCENT} 0%, ${hexToRgba(ACCENT, 0.30)} 100%)`,
          zIndex: 2,
        }}
      />
      <div
        style={{
          padding: "18px 22px 16px 24px",
          borderBottom: `1px solid ${HAIRLINE}`,
          background: `radial-gradient(120% 100% at 0% 0%, ${hexToRgba(ACCENT, 0.10)} 0%, transparent 55%), linear-gradient(180deg, ${PANEL_BG_ALT} 0%, ${PANEL_BG} 100%)`,
          display: "grid",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            width: "fit-content",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: RADIUS_PILL,
            background: hexToRgba(ACCENT, 0.12),
            border: `1px solid ${hexToRgba(ACCENT, 0.32)}`,
            color: ACCENT,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 0 3px ${hexToRgba(ACCENT, 0.18)}` }} />
          Standings
        </span>
        <h2 style={{ margin: 0, fontFamily: "Sora, sans-serif", fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: "-0.035em", color: TEXT_PRIMARY, lineHeight: 1.1 }}>
          {leagueLabel}
        </h2>
        <div style={{ fontSize: 12, color: MUTED_TEXT, fontFamily: "Manrope, sans-serif" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: TEXT_PRIMARY, fontWeight: 800 }}>{currentStandings.length}</span>
          <span> {currentStandings.length === 1 ? "player" : "players"}</span>
          {leagueSummary.leader?.username && (
            <>
              <span style={{ color: SUBTLE_TEXT }}> · </span>
              <span style={{ color: TEXT_PRIMARY, fontWeight: 700 }}>{leagueSummary.leader.username}</span> leading
            </>
          )}
        </div>
      </div>
      {leagueStandings[currentLeague.id] === undefined ? (
        <div style={{ padding: 28, color: MUTED_TEXT, fontSize: 13 }}>Loading standings…</div>
      ) : currentStandings.length === 0 ? (
        <div style={{ padding: 28, color: MUTED_TEXT, fontSize: 13 }}>No members yet. Share your league code to get started.</div>
      ) : (
        <div className="f1-stagger-strong" style={{ display: "grid", gap: 1, background: HAIRLINE, maxHeight: isTablet ? 640 : 720, overflowY: "auto" }}>
          {currentStandings.map((member, index) => {
            const isMe        = member.id === user?.id;
            const isPodium    = index < 3;
            const isLeader    = index === 0;
            const medalTone   = index === 0 ? "#FCD34D" : index === 1 ? "#CBD5E1" : "#FBA371";
            const medalBg     = index === 0 ? "rgba(252,211,77,0.10)" : index === 1 ? "rgba(203,213,225,0.06)" : "rgba(251,163,113,0.07)";
            const medalBorder = index === 0 ? "rgba(252,211,77,0.32)" : index === 1 ? "rgba(203,213,225,0.22)" : "rgba(251,163,113,0.22)";
            const rowBg       = isMe
              ? `linear-gradient(90deg, ${hexToRgba(ACCENT, 0.10)} 0%, ${PANEL_BG} 70%)`
              : (isPodium ? medalBg : PANEL_BG);
            const gap = isLeader ? null : leaderPts - Number(member.points || 0);
            return (
              <div
                key={member.id}
                style={{
                  "--f1-i": Math.min(index, 8),
                  display: "grid",
                  gridTemplateColumns: isMobile ? "44px minmax(0,1fr) 90px" : "56px minmax(0,1fr) 110px",
                  alignItems: "center",
                  background: rowBg,
                  outline: isMe ? `1px solid ${hexToRgba(ACCENT, 0.32)}` : "none",
                  outlineOffset: -1,
                  padding: isPodium ? (isMobile ? "12px 0" : "14px 0") : (isMobile ? "10px 0" : "12px 0"),
                }}
              >
                {/* Medal-rank badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span
                    className="stint-tabular"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: isPodium ? (isLeader ? 34 : 28) : 26,
                      height: isPodium ? (isLeader ? 34 : 28) : 26,
                      borderRadius: "50%",
                      fontFamily: "var(--font-mono)",
                      fontSize: isPodium ? 13 : 11,
                      fontWeight: 900,
                      color: isPodium ? medalTone : SUBTLE_TEXT,
                      background: isPodium ? "rgba(0,0,0,0.36)" : "transparent",
                      border: isPodium ? `1px solid ${medalBorder}` : "none",
                    }}
                  >
                    {index + 1}
                  </span>
                </div>

                {/* Avatar + username + gap */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 12, minWidth: 0 }}>
                  <IdentityAvatar
                    username={member.username}
                    colorKey={member.avatar_color}
                    size={isPodium ? (isLeader ? 44 : 38) : 34}
                    pro={isProProfile(member)}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span
                        style={{
                          fontSize: isPodium ? 14 : 13,
                          fontWeight: 800,
                          letterSpacing: "-0.01em",
                          color: isMe ? ACCENT : TEXT_PRIMARY,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {member.username}
                      </span>
                      {isMe && (
                        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: ACCENT }}>You</span>
                      )}
                    </div>
                    <div className="stint-tabular" style={{ fontSize: 11, color: SUBTLE_TEXT, marginTop: 3, fontWeight: 600 }}>
                      {isLeader ? (
                        <span style={{ color: medalTone, fontWeight: 800 }}>Leading</span>
                      ) : gap > 0 ? (
                        <>−{gap} pts from leader</>
                      ) : (
                        <>Tied with leader</>
                      )}
                    </div>
                  </div>
                </div>

                {/* Points */}
                <div style={{ paddingRight: isMobile ? 14 : 18, textAlign: "right" }}>
                  <div
                    className="stint-tabular"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: isPodium ? (isLeader ? 28 : 22) : 18,
                      fontWeight: 700,
                      letterSpacing: "-0.04em",
                      lineHeight: 1,
                      color: isMe ? ACCENT : isPodium ? medalTone : TEXT_PRIMARY,
                    }}
                  >
                    {member.points || 0}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>
                    Pts
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LeagueReviewView({ user, currentLeague, currentLeagueReview, currentLeagueRoundResult, selectedLeagueRoundMeta, scoredRounds, leagueReviewRound, setLeagueReviewRound, isMobile, isTablet }) {
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

      {/* ── Round selector ─────────────────────────────────────────────────
          Same pattern as Home's round selector: a horizontal pill strip,
          each pill carries the round number + GP short code, active pill
          uses the canonical ACCENT outline. Race-color dot per round. */}
      {scoredRounds.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
              Scored rounds
            </span>
            <span className="stint-tabular" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
              {scoredRounds.length} {scoredRounds.length === 1 ? "race" : "races"} reviewed
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 6,
              WebkitOverflowScrolling: "touch",
              scrollSnapType: "x proximity",
            }}
          >
            {scoredRounds.map((round) => {
              const meta = roundMeta(round.race_round);
              const active = Number(leagueReviewRound) === Number(round.race_round);
              const raceColor = meta ? rc(meta) : ACCENT;
              return (
                <button
                  key={round.race_round}
                  type="button"
                  onClick={() => setLeagueReviewRound(Number(round.race_round))}
                  aria-pressed={active}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                    scrollSnapAlign: "start",
                    padding: "9px 14px",
                    borderRadius: RADIUS_PILL,
                    border: active
                      ? `1px solid ${hexToRgba(ACCENT, 0.42)}`
                      : "1px solid var(--border-soft)",
                    background: active
                      ? hexToRgba(ACCENT, 0.13)
                      : "var(--btn-secondary-bg)",
                    color: active ? ACCENT : TEXT_PRIMARY,
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "-0.005em",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    minHeight: 38,
                    transition:
                      "background 140ms cubic-bezier(0.23,1,0.32,1), border-color 140ms cubic-bezier(0.23,1,0.32,1), color 140ms cubic-bezier(0.23,1,0.32,1)",
                  }}
                >
                  <span
                    className="stint-tabular"
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                      color: active ? ACCENT : SUBTLE_TEXT,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    R{String(round.race_round).padStart(2, "0")}
                  </span>
                  <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: "50%", background: raceColor, flexShrink: 0 }} />
                  <span>{meta?.n || `Round ${round.race_round}`}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Race result header ─────────────────────────────────────────────
          Editorial podium card. Three named cards (P2 silver, P1 gold, P3
          bronze) carry the result protagonist instead of a single gradient
          name. Below: pole + supporting calls as a meta strip. */}
      {currentLeagueRoundResult && (() => {
        const winner = currentLeagueRoundResult.winner || null;
        const p2     = currentLeagueRoundResult.p2 || null;
        const p3     = currentLeagueRoundResult.p3 || null;
        const meta = [
          ["Pole",          currentLeagueRoundResult.pole],
          ["Fastest lap",   currentLeagueRoundResult.fastest_lap],
          ["Driver of day", currentLeagueRoundResult.dotd],
          ["Constructor",   currentLeagueRoundResult.best_constructor],
          ["Safety car",    typeof currentLeagueRoundResult.safety_car === "boolean" ? (currentLeagueRoundResult.safety_car ? "Yes" : "No") : null],
          ["Red flag",      typeof currentLeagueRoundResult.red_flag   === "boolean" ? (currentLeagueRoundResult.red_flag   ? "Yes" : "No") : null],
        ].filter(([, value]) => value !== null && value !== undefined && value !== "");
        const PODIUM = [
          { rank: 2, name: p2,     tone: "#CBD5E1", bg: "rgba(203,213,225,0.08)", border: "rgba(203,213,225,0.22)", label: "P2" },
          { rank: 1, name: winner, tone: "#FCD34D", bg: "rgba(252,211,77,0.10)",  border: "rgba(252,211,77,0.32)",  label: "WINNER" },
          { rank: 3, name: p3,     tone: "#FBA371", bg: "rgba(251,163,113,0.08)", border: "rgba(251,163,113,0.22)", label: "P3" },
        ];
        return (
          <section
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: SECTION_RADIUS,
              border: PANEL_BORDER,
              background: `
                linear-gradient(180deg, rgba(252,211,77,0.06) 0%, rgba(252,211,77,0) 32%, ${PANEL_BG} 100%),
                ${PANEL_BG}
              `,
              boxShadow: SOFT_SHADOW,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: "linear-gradient(90deg, transparent, #CBD5E1 20%, #FCD34D 50%, #FBA371 80%, transparent)",
                opacity: 0.6,
              }}
            />
            <div style={{ padding: isMobile ? "16px 16px 14px" : "20px 22px 18px", borderBottom: `1px solid ${HAIRLINE}` }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                  {selectedLeagueRoundMeta?.n || (leagueReviewRound ? `Round ${leagueReviewRound}` : "Race result")}
                </div>
                <span
                  className="stint-tabular"
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    color: SUCCESS_TEXT,
                    background: SUCCESS_BG,
                    border: `1px solid ${SUCCESS_BORDER}`,
                    borderRadius: RADIUS_PILL,
                    padding: "2px 9px",
                  }}
                >
                  Scored
                </span>
              </div>
            </div>

            {/* Podium row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                gap: isMobile ? 8 : 10,
                padding: isMobile ? "14px 16px 8px" : "20px 22px 14px",
                alignItems: "end",
              }}
            >
              {PODIUM.map(({ rank, name, tone, bg, border, label }) => {
                if (!name) return <div key={rank} aria-hidden="true" />;
                const isWin = rank === 1;
                return (
                  <div
                    key={rank}
                    className="f1-hoverable"
                    style={{
                      position: "relative",
                      borderRadius: CARD_RADIUS,
                      border: `1px solid ${border}`,
                      background: bg,
                      padding: isMobile ? "14px 14px 12px" : isWin ? "20px 18px 16px" : "16px 16px 14px",
                      minHeight: isWin ? (isMobile ? 0 : 132) : (isMobile ? 0 : 112),
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: tone }}>
                        {label}
                      </span>
                      <span
                        className="stint-tabular"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          fontWeight: 900,
                          color: tone,
                          background: "rgba(0,0,0,0.34)",
                          border: `1px solid ${border}`,
                        }}
                      >
                        {rank}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: isWin ? (isMobile ? 24 : 30) : (isMobile ? 18 : 20),
                        fontWeight: 900,
                        letterSpacing: "-0.04em",
                        lineHeight: 1.08,
                        color: TEXT_PRIMARY,
                      }}
                    >
                      {name}
                    </div>
                    {isWin && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED_TEXT, marginTop: 2 }}>
                        Race winner
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Meta strip: pole / FL / DOTD / constructor / SC / RF */}
            {meta.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? 132 : 148}px, 1fr))`,
                  gap: 1,
                  background: HAIRLINE,
                  borderTop: `1px solid ${HAIRLINE}`,
                }}
              >
                {meta.map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: "12px 14px",
                      background: PANEL_BG_ALT,
                      minWidth: 0,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: "-0.015em",
                        color: TEXT_PRIMARY,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })()}

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
          {/* ── Round leaderboard ───────────────────────────────────────────
              Each row is composed: medal-rank badge (top-3 get gold/silver/
              bronze rims) + avatar with team-color rim + username/meta +
              two-column points readout (season faded, round bold). */}
          <section style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                This round
              </span>
              <span className="stint-tabular" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                {members.length} {members.length === 1 ? "player" : "players"}
              </span>
            </div>
            <div className="f1-stagger-strong" style={{ display: "grid", gap: 1, background: HAIRLINE }}>
              {members.map((entry, index) => {
                const isMe       = entry.member.id === user.id;
                const isPodium   = index < 3;
                const isLeader   = index === 0;
                const medalTone  = index === 0 ? "#FCD34D" : index === 1 ? "#CBD5E1" : "#FBA371";
                const medalBg    = index === 0 ? "rgba(252,211,77,0.10)" : index === 1 ? "rgba(203,213,225,0.06)" : "rgba(251,163,113,0.07)";
                const medalBorder = index === 0 ? "rgba(252,211,77,0.32)" : index === 1 ? "rgba(203,213,225,0.22)" : "rgba(251,163,113,0.22)";
                const rowBg      = isMe
                  ? `linear-gradient(90deg, ${hexToRgba(ACCENT, 0.10)} 0%, ${PANEL_BG} 70%)`
                  : (isPodium ? medalBg : PANEL_BG);
                const bonus      = bonusPointsFromBreakdown(entry.breakdown);
                return (
                  <div
                    key={entry.member.id}
                    style={{
                      "--f1-i": Math.min(index, 8),
                      display: "grid",
                      gridTemplateColumns: isMobile ? "44px minmax(0,1fr) 78px" : "52px minmax(0,1fr) 96px 96px",
                      alignItems: "center",
                      background: rowBg,
                      outline: isMe ? `1px solid ${hexToRgba(ACCENT, 0.32)}` : "none",
                      outlineOffset: -1,
                      padding: isPodium ? (isMobile ? "12px 0" : "14px 0") : (isMobile ? "10px 0" : "12px 0"),
                    }}
                  >
                    {/* Medal-rank badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span
                        className="stint-tabular"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: isPodium ? (isLeader ? 32 : 28) : 24,
                          height: isPodium ? (isLeader ? 32 : 28) : 24,
                          borderRadius: "50%",
                          fontFamily: "var(--font-mono)",
                          fontSize: isPodium ? 13 : 11,
                          fontWeight: 900,
                          color: isPodium ? medalTone : SUBTLE_TEXT,
                          background: isPodium ? "rgba(0,0,0,0.36)" : "transparent",
                          border: isPodium ? `1px solid ${medalBorder}` : "none",
                        }}
                      >
                        {index + 1}
                      </span>
                    </div>

                    {/* Avatar + username + hits/bonus */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 12, minWidth: 0 }}>
                      <IdentityAvatar
                        username={entry.member.username}
                        colorKey={entry.member.avatar_color}
                        size={isPodium ? (isLeader ? 42 : 38) : 34}
                        pro={isProProfile(entry.member)}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span
                            style={{
                              fontSize: isPodium ? 14 : 13,
                              fontWeight: 800,
                              letterSpacing: "-0.01em",
                              color: isMe ? ACCENT : TEXT_PRIMARY,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {entry.member.username}
                          </span>
                          {isMe && (
                            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: ACCENT }}>You</span>
                          )}
                        </div>
                        <div className="stint-tabular" style={{ fontSize: 11, color: SUBTLE_TEXT, marginTop: 3, fontWeight: 600 }}>
                          {entry.correctCalls} hit{entry.correctCalls !== 1 ? "s" : ""}
                          {bonus > 0 ? <> · <span style={{ color: SUCCESS_TEXT, fontWeight: 800 }}>+{bonus} bonus</span></> : null}
                        </div>
                      </div>
                    </div>

                    {/* Season pts column (hidden on mobile) */}
                    {!isMobile && (
                      <div style={{ paddingRight: 16, textAlign: "right" }}>
                        <div
                          className="stint-tabular"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 14,
                            fontWeight: 700,
                            color: MUTED_TEXT,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {entry.member.points || 0}
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 2 }}>
                          Season
                        </div>
                      </div>
                    )}

                    {/* Round pts column — the protagonist */}
                    <div style={{ paddingRight: isMobile ? 14 : 18, textAlign: "right" }}>
                      <div
                        className="stint-tabular"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: entry.prediction ? (isLeader ? 28 : 24) : 16,
                          fontWeight: 700,
                          letterSpacing: "-0.04em",
                          lineHeight: 1,
                          color: entry.prediction
                            ? (isMe ? ACCENT : isPodium ? medalTone : TEXT_PRIMARY)
                            : SUBTLE_TEXT,
                        }}
                      >
                        {entry.prediction ? entry.roundScore : "—"}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>
                        {entry.prediction ? "Pts" : "No pick"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

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
                  background: mine ? `linear-gradient(135deg, ${hexToRgba(ACCENT, 0.16)}, ${PANEL_BG_ALT})` : PANEL_BG_ALT,
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

  const chatAccent = isProBoard ? "#fbbf24" : ACCENT;
  return (
    <div style={{ position: "relative", borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 3,
          background: `linear-gradient(180deg, ${chatAccent} 0%, ${hexToRgba(chatAccent, 0.30)} 100%)`,
          zIndex: 2,
        }}
      />
      <div
        style={{
          padding: "16px 18px 14px 22px",
          borderBottom: `1px solid ${HAIRLINE}`,
          background: `radial-gradient(120% 100% at 0% 0%, ${hexToRgba(chatAccent, 0.10)} 0%, transparent 55%), ${PANEL_BG_ALT}`,
          display: "grid",
          gap: 6,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            width: "fit-content",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: RADIUS_PILL,
            background: hexToRgba(chatAccent, 0.12),
            border: `1px solid ${hexToRgba(chatAccent, 0.32)}`,
            color: chatAccent,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: chatAccent, boxShadow: `0 0 0 3px ${hexToRgba(chatAccent, 0.18)}` }} />
          {isProBoard ? "Pro Race Room" : "Chat"}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <h2 style={{ margin: 0, fontFamily: "Sora, sans-serif", fontSize: isMobile ? 18 : 22, fontWeight: 800, letterSpacing: "-0.035em", color: TEXT_PRIMARY, lineHeight: 1.1 }}>
            {currentLeague?.name || "League"}
          </h2>
          <span style={{ fontSize: 11, fontWeight: 800, color: TEXT_PRIMARY, background: hexToRgba(chatAccent, 0.10), border: `1px solid ${hexToRgba(chatAccent, 0.22)}`, borderRadius: RADIUS_PILL, padding: "3px 9px", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
            {items.length}
          </span>
        </div>
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
              {LEAGUE_MODES.map(({ key, label, pro, desc, comingSoon }) => {
                const isSelected = leagueGameMode === key;
                const locked = (pro && !isPro) || comingSoon;
                return (
                  <button
                    key={key}
                    onClick={() => { if (!locked) setLeagueGameMode(key); }}
                    title={comingSoon ? `${desc} — coming soon` : desc}
                    disabled={comingSoon}
                    style={{ background: isSelected ? "rgba(255,106,26,0.14)" : PANEL_BG_ALT, border: isSelected ? "1px solid rgba(255,106,26,0.4)" : PANEL_BORDER, borderRadius: 12, color: locked ? SUBTLE_TEXT : isSelected ? "#fff" : MUTED_TEXT, cursor: locked ? "default" : "pointer", fontSize: 12, fontWeight: 700, padding: "10px 12px", textAlign: "left", display: "flex", flexDirection: "column", gap: 4, opacity: comingSoon ? 0.6 : 1 }}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 900, fontSize: 13, color: locked ? SUBTLE_TEXT : isSelected ? "#fff" : "#cbd5e1" }}>{label}</span>
                      {comingSoon ? (
                        <span style={{ fontSize: 9, fontWeight: 900, color: SUBTLE_TEXT, background: "rgba(148,163,184,0.12)", border: "1px solid rgba(148,163,184,0.24)", borderRadius: 999, padding: "2px 7px", letterSpacing: "0.10em", textTransform: "uppercase" }}>Soon</span>
                      ) : locked ? (
                        <ProBadge size="xs" title="Pro game mode" />
                      ) : null}
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
              <div style={{ marginBottom: 22, opacity: 0.65 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>Tiebreaker (in order)</span>
                  <span style={{ fontSize: 9, fontWeight: 900, color: SUBTLE_TEXT, background: "rgba(148,163,184,0.12)", border: "1px solid rgba(148,163,184,0.24)", borderRadius: 999, padding: "2px 7px", letterSpacing: "0.10em" }}>SOON</span>
                </div>
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
  const [leagueView, setLeagueView] = useState("standings");
  const [authorProfiles, setAuthorProfiles] = useState({});
  const [leagues, setLeagues] = useState([]);
  const [leagueStandings, setLeagueStandings] = useState({});
  const [leaguePosts, setLeaguePosts] = useState({});
  const [leagueForumReady, setLeagueForumReady] = useState({});
  const [scoredRounds, setScoredRounds] = useState([]);
  const [leagueReviewRound, setLeagueReviewRound] = useState(null);
  const [leagueRoundReviews, setLeagueRoundReviews] = useState({});
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
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
    // Land on the LeagueGrid by default — users browse their portfolio first,
    // then open a single league. Only clear the selection if the previously
    // chosen league has disappeared from the visible set.
    if (selectedLeagueId && !validIds.includes(selectedLeagueId)) {
      setSelectedLeagueId(null);
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
    setLeagueStandings((current) => Object.fromEntries(
      Object.entries(current).map(([leagueId, standings]) => [leagueId, standings.map((profile) => normalizeProfileIdentity(profile, user))])
    ));
  }, [user]);

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

  async function fetchLeagues() {
    const { data } = await supabase.from("league_members").select("league_id,leagues(*)").eq("user_id", user.id);
    if (!data) return;
    const nextLeagues = data
      .map((entry) => entry.leagues)
      .filter((league) => league && league.type !== "pro_community")
      .sort((a, b) => {
        // Pin Stint Community to the top so new users land somewhere alive.
        if (a.type === "community" && b.type !== "community") return -1;
        if (b.type === "community" && a.type !== "community") return 1;
        return 0;
      });
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

    if (isProBoard && !proLeague?.id) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: [] }));
      return;
    }

    const { data: members, error: membersError } = await supabase.from("league_members").select("user_id, status").eq("league_id", leagueId);

    if (membersError && isProBoard) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: [] }));
      return;
    }

    const ids = (members || []).map((member) => member.user_id).filter(Boolean);

    if (!ids.length) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: [] }));
      return;
    }

    const [{ data: profiles, error: profilesError }, { data: roundScores }] = await Promise.all([
      supabase.from("profiles").select("*").in("id", ids),
      supabase
        .from("league_round_scores")
        .select("user_id, score")
        .eq("league_id", leagueId)
        .in("user_id", ids),
    ]);

    if (profilesError && isProBoard) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: [] }));
      return;
    }

    // Sum per-league mode-aware scores. Falls back to profiles.points (global
    // score) only when no league_round_scores rows exist yet — keeps standings
    // populated for leagues that haven't had a scoring run since the per-league
    // table was added.
    const pointsByUser = new Map();
    for (const row of roundScores || []) {
      pointsByUser.set(row.user_id, (pointsByUser.get(row.user_id) || 0) + (row.score || 0));
    }
    const memberStatusById = new Map((members || []).map((m) => [m.user_id, m.status]));

    const enriched = (profiles || []).map((profile) => {
      const leagueScore = pointsByUser.get(profile.id);
      const points = leagueScore !== undefined ? leagueScore : (profile.points ?? 0);
      return { ...profile, points, member_status: memberStatusById.get(profile.id) || "active" };
    });

    const sorted = mergeProfilesByIdentity(enriched.map((profile) => normalizeProfileIdentity(profile, user)), user)
      .sort((a, b) => {
        // Eliminated members fall to the bottom.
        const aOut = a.member_status === "eliminated";
        const bOut = b.member_status === "eliminated";
        if (aOut !== bOut) return aOut ? 1 : -1;
        const ptsDiff = Number(b.points || 0) - Number(a.points || 0);
        if (ptsDiff !== 0) return ptsDiff;
        return a.username.localeCompare(b.username);
      });

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

    const [predictionResponse, leagueScoreResponse] = await Promise.all([
      supabase
        .from("predictions")
        .select("user_id,race_round,picks,score,score_breakdown,updated_at")
        .eq("race_round", raceRound)
        .in("user_id", memberIds),
      supabase
        .from("league_round_scores")
        .select("user_id,score,breakdown,game_mode,computed_at")
        .eq("league_id", leagueId)
        .eq("race_round", raceRound)
        .in("user_id", memberIds),
    ]);

    if (predictionResponse.error) {
      setLeagueRoundReviews((current) => ({
        ...current,
        [key]: { loading: false, error: predictionResponse.error.message, resultRow, members: [] },
      }));
      return;
    }

    const predictionMap = new Map((predictionResponse.data || []).map((item) => [item.user_id, item]));
    const leagueScoreMap = new Map((leagueScoreResponse.data || []).map((item) => [item.user_id, item]));
    const meta = roundMeta(raceRound);
    const ranked = members
      .map((member) => {
        const prediction = predictionMap.get(member.id) || null;
        const leagueScore = leagueScoreMap.get(member.id) || null;
        const breakdown = Array.isArray(leagueScore?.breakdown)
          ? leagueScore.breakdown
          : Array.isArray(prediction?.score_breakdown)
            ? prediction.score_breakdown
            : [];
        const raceRows = buildLeagueReviewRows(LEAGUE_RACE_REVIEW_PROMPTS, prediction?.picks || {}, resultRow, breakdown);
        const sprintRows = meta?.sprint
          ? buildLeagueReviewRows(LEAGUE_SPRINT_REVIEW_PROMPTS, prediction?.picks || {}, resultRow, breakdown)
          : [];
        const correctCalls = [...raceRows, ...sprintRows].filter((row) => row.hit).length;
        const roundScore = leagueScore
          ? Number(leagueScore.score || 0)
          : prediction
            ? totalRowPoints(raceRows) + totalRowPoints(sprintRows) + bonusPointsFromBreakdown(breakdown)
            : 0;

        return {
          member,
          prediction,
          leagueScore,
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

    if (isProBoard && !proLeague?.id) {
      setLeagueForumReady((current) => ({ ...current, [leagueId]: true }));
      setLeaguePosts((current) => ({ ...current, [leagueId]: [] }));
      return;
    }

    const { data, error } = await supabase.from("posts").select("*").eq("league_id", leagueId).order("created_at", { ascending: false });
    if (error) {
      if (isProBoard) {
        setLeagueForumReady((current) => ({ ...current, [leagueId]: true }));
        setLeaguePosts((current) => ({ ...current, [leagueId]: [] }));
        return;
      }

      setLeagueForumReady((current) => ({ ...current, [leagueId]: false }));
      setLeaguePosts((current) => ({ ...current, [leagueId]: [] }));
      return;
    }

    const mergedPosts = mergePostsByIdentity(data || []);
    setLeagueForumReady((current) => ({ ...current, [leagueId]: true }));
    setLeaguePosts((current) => ({ ...current, [leagueId]: mergedPosts }));
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

    const settings = {
      scoring_weights:    scoringWeights,
      pick_weights:       scoringWeights,
      sprint_multiplier:  sprintMultiplier,
      tiebreaker_order:   tiebreakerOrder,
      double_points_races: [],
      extra_categories:   extraCategories,
    };

    let data;
    try {
      const payload = await leagueApiRequest("/api/leagues/create", {
        session,
        userId: user.id,
        body: {
          name: leagueName,
          game_mode: leagueGameMode,
          visibility: leagueVisibility,
          season: 2026,
          settings,
        },
      });
      data = payload.league;
    } catch (error) {
      setCreateError(error.message || "Could not create league.");
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
    setSelectedLeagueId(data?.id || null);
  }

  async function joinLeague() {
    if (demoPreview) return;
    if (!joinCode.trim() || !user) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    let data;
    try {
      const payload = await leagueApiRequest("/api/leagues/join", {
        session,
        userId: user.id,
        body: { code: joinCode.toUpperCase() },
      });
      data = payload.league;
    } catch (error) {
      alert(error.message || "Could not join league.");
      return;
    }

    setJoinCode("");
    await fetchLeagues();
    setSelectedLeagueId(data?.id || null);
  }

  async function leaveLeague(leagueId) {
    if (demoPreview) return;
    if (!window.confirm("Leave this league?")) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    try {
      await leagueApiRequest(`/api/leagues/${leagueId}/members`, {
        method: "DELETE",
        session,
        userId: user.id,
      });
    } catch (error) {
      alert(error.message || "Could not leave league.");
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

    try {
      await leagueApiRequest(`/api/leagues/${leagueId}`, {
        method: "DELETE",
        session,
        userId: user.id,
      });
    } catch (error) {
      alert(error.message || "Could not delete league.");
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


  return (
    <PageShell tone="ambient" ambient="subtle">
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
          .stnt-action:hover{background:var(--bg-hover)!important}
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
      <LeaguesLede
        user={user}
        demoMode={demoMode}
        race={next}
        leagueCount={privateLeagueCount}
        proActive={isProUser && !!visibleProLeague}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        onJoin={joinLeague}
        onCreate={() => setShowCreateModal(true)}
        onOpenAuth={openAuth}
        isMobile={isMobile}
      />

      {(
        user ? (
          currentLeague ? (
            // ─── Selected league deep-dive ───────────────────────────────
            <section className="stnt-in" style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "none" }}>
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
                    <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/images/Close%20racing.png')", backgroundSize: "cover", backgroundPosition: "center 30%", opacity: active ? 0.28 : 0.18, transition: "opacity 150ms ease", pointerEvents: "none" }} />
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
                          {league.type === "community" ? (
                            <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: hexToRgba(ACCENT, 0.85), padding: "2px 7px", borderRadius: 999, letterSpacing: "0.1em", flexShrink: 0 }}>GLOBAL</span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, color: SUBTLE_TEXT, letterSpacing: "0.14em", fontFamily: "monospace", flexShrink: 0 }}>{league.code}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                          <span style={{ color: active ? hexToRgba(ACCENT, 0.8) : SUBTLE_TEXT }}>
                            {league.type === "community" ? "Everyone competes" : (league.owner_id === user.id ? "Owner" : "Member")}
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
                <LeagueSwitcher
                  proLeague={visibleProLeague}
                  privateLeagues={leagues}
                  selectedId={selectedLeagueId}
                  onSelect={setSelectedLeagueId}
                  onAllLeagues={() => setSelectedLeagueId(null)}
                  isMobile={isMobile}
                />
              )}
              {currentLeague ? (
                <>
                  {(() => {
                    const isPro     = currentLeague.type === "pro_community";
                    const accentHue = isPro ? "#FCD34D" : ACCENT;
                    const accentSoft= isPro ? "rgba(252,211,77,0.10)" : hexToRgba(ACCENT, 0.13);
                    const accentBorder = isPro ? "rgba(252,211,77,0.32)" : hexToRgba(ACCENT, 0.28);
                    const myIndex = currentStandings.findIndex((m) => m.id === user.id);
                    const myRank  = myIndex >= 0 ? myIndex + 1 : null;
                    const isOwner = !isPro && currentLeague.owner_id === user.id;
                    const SUBTABS = [
                      ["standings", "Standings"],
                      ["review",    "Round Review"],
                      ["chat",      "Chat"],
                      ["setup",     "Rules"],
                    ];
                    const stats = [
                      {
                        label: "Members",
                        value: String(currentStandings.length || 0),
                        sub:   currentStandings.length === 1 ? "player" : "players",
                      },
                      leagueSummary.leader && {
                        label: "Leader",
                        value: leagueSummary.leader.username,
                        sub:   leagueSummary.leader.points != null ? `${leagueSummary.leader.points} pts` : "",
                        tone:  accentHue,
                        big:   false,
                      },
                      myRank != null && {
                        label: "Your rank",
                        value: `#${myRank}`,
                        sub:   myRank === 1 ? "Leading" : `−${(leagueSummary.leader?.points || 0) - (currentStandings[myIndex]?.points || 0)} pts`,
                        tone:  ACCENT,
                      },
                      isPro
                        ? { label: "Prize pool", value: "$500", sub: "Champion $250", tone: accentHue }
                        : leagueSummary.average > 0
                          ? { label: "Avg pts", value: String(leagueSummary.average), sub: "this season" }
                          : null,
                    ].filter(Boolean);
                    return (
                      <section
                        className="f1-hoverable"
                        style={{
                          position: "relative",
                          overflow: "hidden",
                          borderRadius: SECTION_RADIUS,
                          border: `1px solid ${isPro ? "rgba(252,211,77,0.28)" : PANEL_BORDER.replace("1px solid ", "")}`,
                          background: isPro
                            ? `linear-gradient(180deg, rgba(252,211,77,0.20) 0%, rgba(252,211,77,0.05) 28%, ${PANEL_BG} 96%), url("/images/Close%20racing.png") center 50% / cover no-repeat, ${PANEL_BG}`
                            : `linear-gradient(180deg, ${hexToRgba(ACCENT, 0.12)} 0%, rgba(255,255,255,0) 28%, ${PANEL_BG} 96%), ${PANEL_BG}`,
                          boxShadow: LIFTED_SHADOW,
                          marginBottom: 16,
                        }}
                      >
                        {/* Top accent rail */}
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute", top: 0, left: 0, right: 0, height: 3,
                            background: `linear-gradient(90deg, transparent, ${accentHue} 30%, ${accentHue} 70%, transparent)`,
                            opacity: 0.92,
                          }}
                        />

                        <div style={{ position: "relative", padding: isMobile ? "20px 18px 4px" : "26px 26px 8px" }}>
                          {/* Row 1: kicker pill + actions */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 11px", borderRadius: RADIUS_PILL, background: accentSoft, border: `1px solid ${accentBorder}` }}>
                              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: accentHue }} />
                              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: accentHue }}>
                                {isPro ? "Pro Community League" : "Private league"}
                              </span>
                              {!isPro && currentLeague.code && (
                                <span className="stint-tabular" style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", color: accentHue, fontFamily: "var(--font-mono)", paddingLeft: 4, borderLeft: `1px solid ${accentBorder}` }}>
                                  · {currentLeague.code}
                                </span>
                              )}
                            </div>
                            {!isPro && (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard?.writeText(currentLeague.code)}
                                  className="f1-hoverable"
                                  style={{ background: "var(--btn-secondary-bg)", border: "1px solid var(--border-soft)", borderRadius: RADIUS_PILL, color: TEXT_PRIMARY, cursor: "pointer", fontWeight: 800, padding: "8px 14px", fontSize: 12, letterSpacing: "-0.005em" }}
                                >
                                  Copy code
                                </button>
                                <button
                                  type="button"
                                  onClick={() => (isOwner ? deleteLeague(currentLeague.id) : leaveLeague(currentLeague.id))}
                                  className="f1-hoverable"
                                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.26)", borderRadius: RADIUS_PILL, color: "#fca5a5", cursor: "pointer", fontWeight: 800, padding: "8px 14px", fontSize: 12, letterSpacing: "-0.005em" }}
                                >
                                  {isOwner ? "Delete league" : "Leave"}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Row 2: BIG title */}
                          <h2
                            style={{
                              margin: 0,
                              fontFamily: "var(--font-display)",
                              fontSize: isMobile ? 32 : 52,
                              fontWeight: 900,
                              letterSpacing: "-0.05em",
                              lineHeight: 0.95,
                              color: isPro ? "rgba(255,255,255,0.98)" : TEXT_PRIMARY,
                              textShadow: isPro ? "0 2px 18px rgba(0,0,0,0.36)" : "none",
                              textTransform: isPro ? "uppercase" : "none",
                              marginBottom: isMobile ? 16 : 20,
                            }}
                          >
                            {currentLeague.name}
                          </h2>

                          {/* Row 3: stat strip */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : `repeat(${stats.length}, minmax(0, 1fr))`,
                              gap: 1,
                              background: HAIRLINE,
                              border: `1px solid ${HAIRLINE}`,
                              borderRadius: CARD_RADIUS,
                              overflow: "hidden",
                              marginBottom: isMobile ? 14 : 18,
                            }}
                          >
                            {stats.map((s, i) => (
                              <div
                                key={`${s.label}-${i}`}
                                style={{
                                  padding: isMobile ? "12px 14px" : "14px 16px",
                                  background: PANEL_BG_ALT,
                                  minWidth: 0,
                                }}
                              >
                                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                                  {s.label}
                                </div>
                                <div
                                  className="stint-tabular"
                                  style={{
                                    fontFamily: s.label === "Members" || s.label === "Your rank" || s.label === "Prize pool" || s.label === "Avg pts" ? "var(--font-mono)" : "var(--font-display)",
                                    fontSize: isMobile ? 22 : 26,
                                    fontWeight: 800,
                                    letterSpacing: "-0.03em",
                                    lineHeight: 1.05,
                                    color: s.tone || TEXT_PRIMARY,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {s.value}
                                </div>
                                {s.sub && (
                                  <div style={{ fontSize: 11, fontWeight: 600, color: SUBTLE_TEXT, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {s.sub}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {isPro && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(252,211,77,0.62)", letterSpacing: "0.02em", marginBottom: 14 }}>
                              Champion $250 · Podium pool $500 · Season perks for top 3
                            </div>
                          )}
                        </div>

                        {/* Row 4: subtab strip */}
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            overflowX: "auto",
                            WebkitOverflowScrolling: "touch",
                            padding: isMobile ? "0 18px 16px" : "0 26px 18px",
                            scrollSnapType: "x proximity",
                            position: "relative",
                          }}
                        >
                          {SUBTABS.map(([value, label]) => {
                            const active = leagueView === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setLeagueView(value)}
                                aria-pressed={active}
                                style={{
                                  scrollSnapAlign: "start",
                                  flexShrink: 0,
                                  padding: "10px 16px",
                                  borderRadius: RADIUS_PILL,
                                  border: active
                                    ? `1px solid ${hexToRgba(ACCENT, 0.42)}`
                                    : "1px solid var(--border-soft)",
                                  background: active
                                    ? hexToRgba(ACCENT, 0.13)
                                    : "var(--btn-secondary-bg)",
                                  color: active ? ACCENT : TEXT_PRIMARY,
                                  fontFamily: "var(--font-body)",
                                  fontSize: 13,
                                  fontWeight: 800,
                                  letterSpacing: "-0.005em",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  minHeight: 40,
                                  transition:
                                    "background 140ms cubic-bezier(0.23,1,0.32,1), border-color 140ms cubic-bezier(0.23,1,0.32,1), color 140ms cubic-bezier(0.23,1,0.32,1)",
                                  viewTransitionName: active ? "league-active-tab" : undefined,
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })()}

                  {leagueView === "standings" && (
                    <div className="stnt-in-fast">
                      <LeagueStandingsView
                        user={user}
                        currentLeague={currentLeague}
                        currentStandings={currentStandings}
                        leagueStandings={leagueStandings}
                        leagueSummary={leagueSummary}
                        isMobile={isMobile}
                        isTablet={isTablet}
                      />
                    </div>
                  )}

                  {leagueView === "review" && (
                    <div className="stnt-in-fast">
                      <LeagueReviewView
                        user={user}
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
              ) : null}
            </div>
          </section>
          ) : (
            // ─── League grid (no league selected) ──────────────────────────
            <section className="stnt-in f1-stagger-strong" style={{ display: "grid", gap: 14 }}>
              {leagues.length === 0 && !visibleProLeague ? (
                <EmptyLeaguesState onCreate={() => setShowCreateModal(true)} isMobile={isMobile} />
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
                    gap: isMobile ? 12 : 16,
                  }}
                >
                  {visibleProLeague && (
                    <div style={{ "--f1-i": 0, gridColumn: isMobile ? "auto" : isTablet ? "1 / -1" : "1 / span 2" }}>
                      <LeagueCard
                        league={visibleProLeague}
                        active={false}
                        variant="pro"
                        members={leagueStandings[visibleProLeague.id] || []}
                        proActive={isProUser}
                        onSelect={() => setSelectedLeagueId(visibleProLeague.id)}
                        isMobile={isMobile}
                      />
                    </div>
                  )}
                  {leagues.map((league, i) => {
                    const standings = leagueStandings[league.id] || [];
                    const myIndex = standings.findIndex((m) => m.id === user.id);
                    return (
                      <div key={league.id} style={{ "--f1-i": i + (visibleProLeague ? 1 : 0) }}>
                        <LeagueCard
                          league={league}
                          active={false}
                          variant="private"
                          members={standings}
                          yourRank={myIndex >= 0 ? myIndex + 1 : null}
                          onSelect={() => setSelectedLeagueId(league.id)}
                          isMobile={isMobile}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )
        ) : (
          <div style={{ borderRadius: SECTION_RADIUS, border: "1px solid rgba(245,158,11,0.22)", background: PANEL_BG, overflow: "hidden", boxShadow: LIFTED_SHADOW, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/images/Close%20racing.png')", backgroundSize: "cover", backgroundPosition: "center 50%", opacity: 0.22 }} />
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
                </div>
              </div>

              <div style={{ minWidth: isMobile ? "100%" : 320, flex: "1 1 320px", borderRadius: 18, border: "1px solid rgba(245,158,11,0.16)", background: "rgba(10,16,30,0.56)", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${HAIRLINE}`, background: "var(--btn-secondary-bg)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Top drivers</div>
                  <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Live season preview</div>
                </div>
                <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
                  {currentStandings.slice(0, 5).map((member, index) => (
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
                  {!currentStandings.length && (
                    <div style={{ padding: "18px 16px", background: PANEL_BG, color: MUTED_TEXT, fontSize: 12, lineHeight: 1.55 }}>
                      No Pro members are listed yet. Real profiles will appear here after members join.
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>
        )
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
    </PageShell>
  );
}
