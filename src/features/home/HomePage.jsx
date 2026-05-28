import { useEffect, useMemo, useState } from "react";
import { countdown, fmtFull, isRaceCancelled, nextRace, parseDate, raceSessions, rc } from "@/src/constants/calendar";
import {
  ACCENT,
  CARD_RADIUS,
  CARD_SHADOW,
  DANGER,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  RADIUS_MD,
  RADIUS_PILL,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SPRINT,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
  rgbaFromHex,
} from "@/src/constants/design";
import { fetchMeetingSessions, fetchRaceSessions } from "@/src/lib/openf1";
import { mapRaceSessionsByCalendar } from "@/src/lib/raceCalendar";
import { previewText } from "@/src/lib/format";
import { supabase } from "@/src/lib/supabase";
import { pageToHref } from "@/src/shell/routing";
import { IS_SNAPSHOT } from "@/src/lib/runtimeFlags";
import useRaceCalendar from "@/src/lib/useRaceCalendar";
import usePageMetadata from "@/src/lib/usePageMetadata";
import useViewport from "@/src/lib/useViewport";
import PageShell from "@/src/ui/PageShell";
import StatusBadge from "@/src/ui/StatusBadge";

// ─── Session metadata ─────────────────────────────────────────────────────────

const homeSessionMeta = {
  "Practice 1": { label: "FP1",              type: "practice" },
  "Practice 2": { label: "FP2",              type: "practice" },
  "Practice 3": { label: "FP3",              type: "practice" },
  "Sprint Qualifying": { label: "Sprint Q",  type: "qualifying" },
  Sprint:        { label: "Sprint",          type: "sprint" },
  Qualifying:    { label: "Qualifying",      type: "qualifying" },
  Race:          { label: "Race",            type: "race" },
};

function normalizeLiveSession(session) {
  const meta = homeSessionMeta[session.session_name];
  if (!meta) return null;
  return {
    key:        `${session.session_key}-${session.session_name}`,
    label:      meta.label,
    type:       meta.type,
    date_start: session.date_start,
    date_end:   session.date_end,
  };
}

function formatDayBadge(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d).toUpperCase();
  const dm      = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(d).toUpperCase();
  return `${weekday} · ${dm}`;
}

function formatLocalTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

function formatRelativeTime(value) {
  if (!value) return "";
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return "";
  const diff = Math.max(0, Date.now() - target);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)   return "just now";
  if (minutes < 60)  return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)    return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)      return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(value));
}

// ─── Lock state ───────────────────────────────────────────────────────────────

function lockState(cd) {
  if (!cd) return null;
  if (cd.d >= 1) return { status: "open",      label: "Open" };
  if (cd.h >= 6) return { status: "lock-soon", label: "Lock soon" };
  if (cd.h >= 1) return { status: "lock-soon", label: `Lock < ${cd.h}h` };
  return            { status: "lock-now",  label: `Lock < ${cd.m}m` };
}

function formatLockStamp(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(value));
}

// ─── The race-week LEDE ───────────────────────────────────────────────────────
// A full-width race-week briefing block. When viewing the NEXT race, the
// countdown is the protagonist and the Open-picks CTA is rendered. For past
// or cancelled rounds the countdown is replaced by the race date readout and
// the CTA disappears (picks aren't open). Upcoming-but-not-next races still
// show their countdown but no CTA — picks open in chronological order.
// Race-color tint comes from `rc(race)` so each round inherits its identity.

function RaceLede({ race, cd, lock, openNextRacePicks, onBackToNext, user, demoMode, isMobile, isTablet, isNextDefault, raceState }) {
  const raceColor = race ? rc(race) : ACCENT;
  const cancelled = race ? isRaceCancelled(race) : false;
  const isPast    = raceState === "past";
  const isUpcomingNotNext = raceState === "upcoming";
  const showCountdown = !!cd && !isPast && !cancelled;
  const showCta       = isNextDefault && !cancelled && !isPast;
  const lockStamp = race && isNextDefault && !cancelled ? formatLockStamp(race.date) : null;
  const ctaLabel  = user || demoMode ? "Open picks" : "Create account to make picks";

  // The countdown — two-unit precision per scale.
  // d+h when more than a day out, h+m otherwise, m+s in the final hour.
  let primaryValue, primaryUnit, secondaryValue, secondaryUnit;
  if (!showCountdown) {
    primaryValue = ""; primaryUnit = ""; secondaryValue = ""; secondaryUnit = "";
  } else if (cd.d >= 1) {
    primaryValue = String(cd.d).padStart(2, "0"); primaryUnit = "DAYS";
    secondaryValue = String(cd.h).padStart(2, "0"); secondaryUnit = "HRS";
  } else if (cd.h >= 1) {
    primaryValue = String(cd.h).padStart(2, "0"); primaryUnit = "HRS";
    secondaryValue = String(cd.m).padStart(2, "0"); secondaryUnit = "MIN";
  } else {
    primaryValue = String(cd.m).padStart(2, "0"); primaryUnit = "MIN";
    secondaryValue = "00"; secondaryUnit = "GO";
  }

  const numSize  = isMobile ? 64  : isTablet ? 84  : 104;
  const unitSize = isMobile ? 12  : 14;

  return (
    <section
      className="h-lede f1-stagger-strong"
      style={{
        // Race-color custom property so children inherit the round's identity.
        "--race-c": raceColor,
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       PANEL_BORDER,
        background: `
          linear-gradient(140deg, ${rgbaFromHex(raceColor, 0.42)} 0%, ${rgbaFromHex(raceColor, 0.14)} 38%, rgba(6,16,27,0.96) 100%),
          url("/images/Hero-Main.png") center / cover no-repeat,
          ${PANEL_BG}
        `,
        boxShadow:    LIFTED_SHADOW,
        marginBottom: isMobile ? 18 : 24,
        minHeight:    isMobile ? 0 : isTablet ? 380 : 440,
        padding:      isMobile ? "18px 18px 20px" : isTablet ? "26px 28px 26px" : "32px 36px 32px",
      }}
    >
      {/* Top accent rail — race-color across the head of the panel. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${raceColor} 30%, ${raceColor} 70%, transparent)`,
          opacity: 0.92,
        }}
      />

      {/* Header row: kicker + (lock status | past | upcoming | cancelled). */}
      <div
        style={{ "--f1-i": 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.78)", flexWrap: "wrap" }}>
          <span
            aria-hidden="true"
            style={{
              width: 6, height: 6, borderRadius: "50%", background: raceColor,
              boxShadow: `0 0 0 4px ${rgbaFromHex(raceColor, 0.20)}`,
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.78)" }}>
            {race
              ? (isNextDefault ? `Race Week · Round ${race.r}` : `Round ${race.r}`)
              : "Off-season"}
          </span>
          {!isNextDefault && onBackToNext && (
            <button
              type="button"
              onClick={onBackToNext}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.58)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.02em",
                padding: "2px 4px",
                fontFamily: "inherit",
              }}
              aria-label="Back to the next race"
            >
              ← Back to next
            </button>
          )}
        </div>
        {cancelled
          ? <StatusBadge status="cancelled">Cancelled</StatusBadge>
          : isPast
            ? <StatusBadge status="complete">Past race</StatusBadge>
            : isUpcomingNotNext
              ? <StatusBadge status="neutral">Upcoming</StatusBadge>
              : (lock && <StatusBadge status={lock.status} dot={lock.status === "open"}>{lock.label}</StatusBadge>)}
      </div>

      {/* Race title + circuit. */}
      <div style={{ "--f1-i": 1, marginTop: isMobile ? 16 : 22 }}>
        <h1
          className="stint-page-title"
          style={{
            margin: 0,
            fontSize:      isMobile ? 40 : isTablet ? 58 : 72,
            letterSpacing: "-0.05em",
            lineHeight:    0.92,
            color:         "rgba(255,255,255,0.98)",
            textShadow:    "0 2px 18px rgba(0,0,0,0.32)",
            maxWidth:      820,
            textTransform: "uppercase",
          }}
        >
          {race ? race.n.replace(/grand prix/i, "").trim() : "STINT"}
        </h1>
        {race && (
          <div
            style={{
              marginTop: 6,
              display: "inline-flex",
              alignItems: "baseline",
              gap: 10,
              fontSize: isMobile ? 13 : 15,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "rgba(255,255,255,0.82)",
            }}
          >
            <span>{race.circuit}</span>
            <span style={{ color: "rgba(255,255,255,0.42)" }}>·</span>
            <span className="stint-tabular">{fmtFull(race.date)}</span>
          </div>
        )}
      </div>

      {/* Countdown — the protagonist when viewing the next race. Hidden for
          past / cancelled rounds (we show the race date instead, below). */}
      {showCountdown && (
        <div
          style={{
            "--f1-i": 2,
            display: "inline-flex",
            alignItems: "baseline",
            gap: isMobile ? 18 : 28,
            marginTop: isMobile ? 18 : 28,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span
              className="stint-tabular h-lede-num"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize:   numSize,
                fontWeight: 700,
                letterSpacing: "-0.05em",
                lineHeight: 0.88,
                color:      "rgba(255,255,255,0.98)",
              }}
            >
              {primaryValue}
            </span>
            <span style={{ fontSize: unitSize, fontWeight: 800, letterSpacing: "0.18em", color: "rgba(255,255,255,0.58)" }}>
              {primaryUnit}
            </span>
          </div>
          {secondaryUnit && (
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              <span
                className="stint-tabular h-lede-num"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize:   numSize * 0.62,
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  lineHeight: 0.88,
                  color:      rgbaFromHex(raceColor, 0.95),
                }}
              >
                {secondaryValue}
              </span>
              <span style={{ fontSize: unitSize - 1, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,0.52)" }}>
                {secondaryUnit}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Race-stats line — circuit dimensions + lap record. Always shown when
          a race is loaded, so users get the editorial context even when the
          countdown is off (past/cancelled). */}
      {race && (
        <div
          className="stint-tabular"
          style={{
            "--f1-i": showCountdown ? 3 : 2,
            marginTop: isMobile ? 14 : 18,
            fontSize: 12,
            color: "rgba(255,255,255,0.62)",
            lineHeight: 1.5,
            maxWidth: 760,
          }}
        >
          {race.len} km · {race.laps} laps · {race.turns} turns
          {race.rec && race.rec !== "—" && (
            <>
              <span style={{ color: "rgba(255,255,255,0.28)" }}> · </span>
              <span>
                Lap rec.{" "}
                <span style={{ color: "rgba(255,255,255,0.92)", fontWeight: 700 }}>{race.rec}</span>{" "}
                ({race.recBy}{race.recY ? `, ${race.recY}` : ""})
              </span>
            </>
          )}
        </div>
      )}

      {/* Foot: lock timestamp + primary CTA. CTA only on the next race;
          past/upcoming-non-next render a small race-date readout instead. */}
      <div
        style={{
          "--f1-i": race ? 4 : 2,
          marginTop: isMobile ? 18 : 28,
          display: "flex",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 12 : 16,
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: 600, lineHeight: 1.45 }}>
          {lockStamp ? (
            <span className="stint-tabular">Locks {lockStamp}</span>
          ) : race && isPast ? (
            <span className="stint-tabular">Race {fmtFull(race.date)}</span>
          ) : race && isUpcomingNotNext ? (
            <span className="stint-tabular">Race {fmtFull(race.date)}</span>
          ) : null}
        </div>

        {showCta && (
          <a
            href={pageToHref(user || demoMode ? "predictions" : "public-picks", { demoMode, raceRound: race.r })}
            onClick={(event) => { event.preventDefault(); openNextRacePicks(); }}
            className="stint-button f1-hoverable"
            style={{
              minHeight: isMobile ? 50 : 48,
              padding: "0 22px",
              fontSize: 14,
              fontWeight: 900,
              letterSpacing: "-0.005em",
              width: isMobile ? "100%" : "auto",
              justifyContent: "center",
            }}
          >
            {ctaLabel} <span aria-hidden="true" style={{ marginLeft: 8 }}>↗</span>
          </a>
        )}
      </div>
    </section>
  );
}

// ─── Round selector ───────────────────────────────────────────────────────────
// Compact horizontal strip of all 24 rounds. Each pill = round number + race
// short code (the country's 3-letter ID). Active = ACCENT outline. Cancelled
// rounds dim. Past rounds dim less. The next race carries a small ACCENT dot.

const SHORT_CODE = {
  Australia: "AUS", China: "CHN", Japan: "JPN", Bahrain: "BHR",
  "Saudi Arabia": "KSA", Canada: "CAN", Monaco: "MON", Spain: "ESP",
  Austria: "AUT", "United Kingdom": "GBR", Belgium: "BEL", Hungary: "HUN",
  Netherlands: "NED", Italy: "ITA", Azerbaijan: "AZE", Singapore: "SGP",
  USA: "USA", Mexico: "MEX", Brazil: "BRA", Qatar: "QAT", UAE: "ARE",
};

function shortCodeFor(race) {
  if (!race) return "";
  return SHORT_CODE[race.cc] || String(race.cc || "").slice(0, 3).toUpperCase();
}

function RoundSelector({ calendar, selectedRound, nextRound, onSelect, isMobile }) {
  if (!calendar?.length) return null;
  return (
    <section
      style={{
        marginBottom: isMobile ? 14 : 18,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
          Browse rounds
        </span>
        <span className="stint-tabular" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
          {calendar.length} rounds · 2026
        </span>
      </header>

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
        {calendar.map((race) => {
          const isActive    = race.r === selectedRound;
          const cancelled   = isRaceCancelled(race);
          const isNext      = race.r === nextRound;
          const isPast      = parseDate(race.date).getTime() + 6 * 3600_000 < Date.now() && !isActive;
          const raceColor   = rc(race);
          const shortCode   = shortCodeFor(race);

          return (
            <button
              key={race.r}
              type="button"
              data-active={isActive}
              onClick={() => onSelect(race)}
              aria-pressed={isActive}
              aria-label={`Round ${race.r} · ${race.n}${cancelled ? " (cancelled)" : ""}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                scrollSnapAlign: "center",
                padding: "8px 11px",
                borderRadius: RADIUS_PILL,
                border: isActive
                  ? `1px solid ${rgbaFromHex(ACCENT, 0.42)}`
                  : `1px solid ${isPast ? "var(--border)" : "var(--border-soft)"}`,
                background: isActive
                  ? rgbaFromHex(ACCENT, 0.13)
                  : (isNext ? rgbaFromHex(raceColor, 0.08) : "var(--btn-secondary-bg)"),
                color: isActive ? ACCENT : (isPast ? SUBTLE_TEXT : TEXT_PRIMARY),
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.02em",
                cursor: "pointer",
                whiteSpace: "nowrap",
                opacity: cancelled ? 0.45 : 1,
                textDecoration: cancelled ? "line-through" : "none",
                transition:
                  "background 140ms cubic-bezier(0.23,1,0.32,1), border-color 140ms cubic-bezier(0.23,1,0.32,1), color 140ms cubic-bezier(0.23,1,0.32,1), transform 100ms cubic-bezier(0.23,1,0.32,1)",
                minHeight: 36,
              }}
            >
              <span className="stint-tabular" style={{ color: isActive ? ACCENT : SUBTLE_TEXT, fontSize: 10, fontWeight: 900, letterSpacing: "0.06em" }}>
                R{String(race.r).padStart(2, "0")}
              </span>
              <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: "50%", background: raceColor, flexShrink: 0 }} />
              <span style={{ letterSpacing: "0.04em" }}>{shortCode}</span>
              {isNext && !cancelled && !isActive && (
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.10em", color: ACCENT }}>NEXT</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Weekend session strip ────────────────────────────────────────────────────
// Horizontal session tiles — was a vertical sidebar timeline, now a top-level
// strip that mirrors how a paddock board shows the weekend at a glance. Each
// tile is a self-contained card. Past sessions dim; the active one pulses.

function SessionStrip({ sessions, isMobile, raceColor }) {
  if (!sessions.length) return null;
  const now = Date.now();

  // Find the active session — one that has started but not ended (or, if no
  // end, the most recent one that started inside the last 4h). If none active,
  // mark the next upcoming session as "next."
  let activeIdx = -1, nextIdx = -1;
  for (let i = 0; i < sessions.length; i += 1) {
    const start = new Date(sessions[i].date_start || sessions[i].date || 0).getTime();
    const end   = new Date(sessions[i].date_end   || start + 4 * 3600_000).getTime();
    if (now >= start && now <= end) { activeIdx = i; break; }
  }
  if (activeIdx === -1) {
    for (let i = 0; i < sessions.length; i += 1) {
      const start = new Date(sessions[i].date_start || sessions[i].date || 0).getTime();
      if (start > now) { nextIdx = i; break; }
    }
  }

  return (
    <section style={{ marginBottom: isMobile ? 18 : 24 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
          Weekend timeline
        </span>
        <span className="stint-tabular" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
          {sessions.length} session{sessions.length === 1 ? "" : "s"}
        </span>
      </header>

      <div
        className="f1-stagger-strong"
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: isMobile ? "minmax(160px, 70%)" : "minmax(0, 1fr)",
          gap: 10,
          overflowX: isMobile ? "auto" : "visible",
          scrollSnapType: isMobile ? "x mandatory" : "none",
          paddingBottom: isMobile ? 8 : 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {sessions.map((session, i) => {
          const start    = new Date(session.date_start || session.date || 0).getTime();
          const isPast   = start && start < now && i !== activeIdx;
          const isActive = i === activeIdx;
          const isNext   = i === nextIdx;
          const isFeature = session.type === "race";
          const typeColor =
            session.type === "race"        ? DANGER :
            session.type === "qualifying"  ? raceColor || ACCENT :
            session.type === "sprint"      ? SPRINT :
                                             SUBTLE_TEXT;

          return (
            <div
              key={session.key || `${session.label}-${i}`}
              className="f1-hoverable"
              style={{
                "--f1-i":      i,
                scrollSnapAlign: "start",
                borderRadius: CARD_RADIUS,
                border:       isActive
                  ? `1px solid ${rgbaFromHex(typeColor, 0.45)}`
                  : `1px solid ${HAIRLINE}`,
                background:   isActive
                  ? `linear-gradient(160deg, ${rgbaFromHex(typeColor, 0.16)} 0%, ${PANEL_BG_ALT} 80%)`
                  : isFeature
                    ? `linear-gradient(160deg, ${rgbaFromHex(typeColor, 0.10)} 0%, ${PANEL_BG_ALT} 60%)`
                    : PANEL_BG,
                padding: "14px 16px",
                position: "relative",
                opacity: isPast ? 0.5 : 1,
                boxShadow: isActive ? CARD_SHADOW : "none",
                display: "grid",
                gap: 6,
                minWidth: 0,
              }}
            >
              {/* Top row: day badge + active dot */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT, lineHeight: 1.2 }}>
                  {formatDayBadge(session.date_start || session.date)}
                </span>
                {isActive && <span className="f1-live-dot" aria-hidden="true" />}
                {!isActive && isNext && (
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT }}>Next</span>
                )}
              </div>

              {/* Session label */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width:  isFeature ? 9 : 6,
                    height: isFeature ? 9 : 6,
                    borderRadius: 2,
                    background: typeColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: isFeature ? 16 : 14, fontWeight: isFeature ? 900 : 700, letterSpacing: "-0.02em", color: TEXT_PRIMARY, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {session.label}
                </span>
              </div>

              {/* Local time */}
              <div className="stint-tabular" style={{ fontSize: 13, fontWeight: 700, color: isPast ? SUBTLE_TEXT : MUTED_TEXT, letterSpacing: "-0.005em" }}>
                {formatLocalTime(session.date_start || session.date)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Pick state callout ───────────────────────────────────────────────────────
// Replaces the mobile sticky CTA. Shows the user what action they should take
// for THIS race — not generic marketing brand copy.

function PickStateCallout({ user, demoMode, race, openNextRacePicks, isMobile }) {
  if (!race) return null;
  const isAnon = !user && !demoMode;
  const accent = isAnon ? ACCENT : rc(race) || ACCENT;

  return (
    <section
      className="f1-reveal is-visible f1-hoverable"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: CARD_RADIUS,
        border: `1px solid ${rgbaFromHex(accent, 0.22)}`,
        background: `linear-gradient(135deg, ${rgbaFromHex(accent, 0.12)} 0%, ${PANEL_BG_ALT} 70%)`,
        boxShadow: SOFT_SHADOW,
        padding: isMobile ? "18px 18px" : "22px 24px",
        marginBottom: isMobile ? 18 : 24,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        justifyContent: "space-between",
        gap: isMobile ? 14 : 16,
      }}
    >
      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: accent }}>
          {isAnon ? "Sign in" : "Your picks"}
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: isMobile ? 18 : 21,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: TEXT_PRIMARY,
            lineHeight: 1.2,
          }}
        >
          {isAnon
            ? `Lock in before ${race.n.replace(/grand prix/i, "GP").trim()}`
            : `Open the board for ${race.n.replace(/grand prix/i, "GP").trim()}`}
        </span>
        <span style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.5 }}>
          {isAnon
            ? "Create a free account to make your picks and join leagues."
            : "Tap below to set or refine your picks before the session locks."}
        </span>
      </div>
      <a
        href={pageToHref(user || demoMode ? "predictions" : "public-picks", { demoMode, raceRound: race.r })}
        onClick={(event) => { event.preventDefault(); openNextRacePicks(); }}
        className="stint-button f1-hoverable"
        style={{
          minHeight: isMobile ? 50 : 46,
          padding: "0 22px",
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: "-0.005em",
          width: isMobile ? "100%" : "auto",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isAnon ? "Create account" : "Open picks"} <span aria-hidden="true" style={{ marginLeft: 8 }}>↗</span>
      </a>
    </section>
  );
}

// ─── Wire micro-strip ─────────────────────────────────────────────────────────
// Three latest stories. Same `news_articles` table NewsPage reads. Click → Wire.
// Gracefully degrades when the table is missing or empty.

function WireStrip({ articles, setPage, isMobile }) {
  if (!articles.length) return null;
  return (
    <section style={{ marginBottom: isMobile ? 8 : 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
          From the wire
        </span>
        <button
          type="button"
          onClick={() => setPage?.("news")}
          style={{
            background: "transparent",
            border: "none",
            color: ACCENT,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          See all →
        </button>
      </header>

      <div
        className="f1-stagger-strong"
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {articles.map((article, i) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="f1-hoverable"
            style={{
              "--f1-i": i,
              display: "grid",
              gap: 8,
              padding: "14px 16px 16px",
              borderRadius: CARD_RADIUS,
              border: PANEL_BORDER,
              background: PANEL_BG,
              boxShadow: CARD_SHADOW,
              textDecoration: "none",
              color: TEXT_PRIMARY,
              minHeight: 132,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: ACCENT,
                  padding: "3px 8px",
                  borderRadius: RADIUS_PILL,
                  background: rgbaFromHex(ACCENT, 0.10),
                  border: `1px solid ${rgbaFromHex(ACCENT, 0.22)}`,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "70%",
                }}
              >
                {article.source}
              </span>
              <span className="stint-tabular" style={{ fontSize: 10, fontWeight: 700, color: SUBTLE_TEXT, whiteSpace: "nowrap" }}>
                {formatRelativeTime(article.published_at)}
              </span>
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.32,
                color: TEXT_PRIMARY,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {article.title}
            </span>
            {article.summary && (
              <span
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: MUTED_TEXT,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {previewText(article.summary, 120)}
              </span>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}

// ─── Main HomePage ────────────────────────────────────────────────────────────

export default function HomePage({ user, setPage, demoMode = false, openPredictionsForRace, openAuth }) {
  const { isMobile, isTablet } = useViewport();
  const { calendar }            = useRaceCalendar(2026);
  const nextActive              = useMemo(() => nextRace(calendar), [calendar]);

  // The selected round drives the lede / session strip / pick callout. Defaults
  // to the next race, but the user can scroll through every round via the
  // selector. State is mirrored to `?round=N` so the selection survives reloads
  // and works for deep links (the same URL pattern the legacy /calendar route
  // used — we now answer it on the Home tab).
  const [selectedRound, setSelectedRound] = useState(null);
  const [liveSchedule,  setLiveSchedule]  = useState([]);
  const [articles,      setArticles]      = useState([]);

  // Resolve the selected race object from the calendar — falls back to the
  // next active race when no selection has been made.
  const selected = useMemo(() => {
    if (!calendar.length) return null;
    if (selectedRound) {
      const found = calendar.find((race) => race.r === selectedRound);
      if (found) return found;
    }
    return nextActive || calendar[0] || null;
  }, [calendar, selectedRound, nextActive]);

  const isNextDefault = !!(selected && nextActive && selected.r === nextActive.r);

  // ?round=N → seed initial selection on first load.
  useEffect(() => {
    if (typeof window === "undefined" || !calendar.length || selectedRound) return;
    const req = Number(new URLSearchParams(window.location.search).get("round"));
    if (Number.isFinite(req) && req > 0 && calendar.some((race) => race.r === req)) {
      setSelectedRound(req);
    }
  }, [calendar, selectedRound]);

  // selectedRound → ?round=N persistence so the URL stays in sync.
  useEffect(() => {
    if (typeof window === "undefined" || !selected) return;
    const url = new URL(window.location.href);
    const desired = isNextDefault ? null : String(selected.r);
    const current = url.searchParams.get("round");
    if (desired === current) return;
    if (desired) url.searchParams.set("round", desired);
    else         url.searchParams.delete("round");
    window.history.replaceState({}, "", url);
  }, [selected, isNextDefault]);

  usePageMetadata({
    title:       selected ? `${selected.n} · Round ${selected.r}` : "STINT · F1 race week",
    description: "Race-week timing, weekend schedule, lap data, and the wire — every round, one tab.",
    path:        "/",
  });

  // Race state — drives the lede's status pill + CTA visibility.
  const raceState = useMemo(() => {
    if (!selected) return "none";
    if (isRaceCancelled(selected)) return "cancelled";
    const ts = parseDate(selected.date).getTime();
    if (ts + 6 * 3600_000 < Date.now()) return "past";
    if (isNextDefault) return "next";
    return "upcoming";
  }, [selected, isNextDefault]);

  // Live session schedule (OpenF1) — keyed on the selected round so the strip
  // updates whenever the user switches races.
  useEffect(() => {
    let ignore = false;

    async function loadLiveSchedule() {
      if (!selected || IS_SNAPSHOT) { setLiveSchedule([]); return; }
      const year = new Date(selected.date).getFullYear();
      const races = await fetchRaceSessions(year);
      const raceInfo = mapRaceSessionsByCalendar(calendar, races)[selected.r];
      if (!raceInfo?.meeting_key) {
        if (!ignore) setLiveSchedule([]);
        return;
      }
      const sessions = await fetchMeetingSessions(raceInfo.meeting_key);
      if (!ignore) setLiveSchedule(sessions.map(normalizeLiveSession).filter(Boolean));
    }

    loadLiveSchedule();
    return () => { ignore = true; };
  }, [calendar, selected]);

  // Latest 3 wire articles (supabase, same table NewsPage reads) ----------
  useEffect(() => {
    let ignore = false;

    async function loadArticles() {
      if (IS_SNAPSHOT) return;
      const { data, error } = await supabase
        .from("news_articles")
        .select("id,title,summary,url,source,published_at")
        .order("published_at", { ascending: false })
        .limit(3);
      if (ignore) return;
      if (error || !data) { setArticles([]); return; }
      setArticles(data);
    }

    loadArticles();
    return () => { ignore = true; };
  }, []);

  const schedule = useMemo(() => {
    if (!selected) return [];
    if (liveSchedule.length) return liveSchedule;
    return raceSessions(selected).map((session, i) => ({
      key:        `${session.label}-${i}`,
      label:      session.label,
      type:       session.label === "Race" ? "race"
                : session.label === "Qualifying" ? "qualifying"
                : session.label === "Sprint" ? "sprint"
                : "practice",
      date_start: session.date ? new Date(session.date).toISOString() : null,
      date_end:   null,
    }));
  }, [liveSchedule, selected]);

  const cd = isNextDefault ? (selected ? countdown(selected.date) : null)
           : raceState === "upcoming" ? (selected ? countdown(selected.date) : null)
           : null;

  const openNextRacePicks = () => {
    const target = isNextDefault ? selected : nextActive;
    if (user || demoMode)       { openPredictionsForRace?.(target?.r); return; }
    if (openAuth)               { openAuth("register", { page: "predictions", raceRound: target?.r }); return; }
    setPage("public-picks");
  };

  const handleSelectRace = (race) => {
    if (!race) return;
    setSelectedRound(race.r);
  };

  const handleBackToNext = () => {
    if (nextActive) setSelectedRound(nextActive.r);
  };

  const lock = lockState(cd);
  const raceColor = selected ? rc(selected) : ACCENT;

  return (
    <PageShell tone="live" ambient="glow">
      <RoundSelector
        calendar={calendar}
        selectedRound={selected?.r}
        nextRound={nextActive?.r}
        onSelect={handleSelectRace}
        isMobile={isMobile}
      />

      <RaceLede
        race={selected}
        cd={cd}
        lock={lock}
        openNextRacePicks={openNextRacePicks}
        onBackToNext={isNextDefault ? null : handleBackToNext}
        user={user}
        demoMode={demoMode}
        isMobile={isMobile}
        isTablet={isTablet}
        isNextDefault={isNextDefault}
        raceState={raceState}
      />

      <SessionStrip sessions={schedule} isMobile={isMobile} raceColor={raceColor} />

      {isNextDefault && (
        <PickStateCallout
          user={user}
          demoMode={demoMode}
          race={selected}
          openNextRacePicks={openNextRacePicks}
          isMobile={isMobile}
        />
      )}

      <WireStrip articles={articles} setPage={setPage} isMobile={isMobile} />
    </PageShell>
  );
}
