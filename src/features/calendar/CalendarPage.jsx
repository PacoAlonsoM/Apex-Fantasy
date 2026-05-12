"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIVE_RACE_COUNT,
  isRaceCancelled,
  monthLabel,
  nextRace,
  parseDate,
  raceSessions,
  rc,
} from "@/src/constants/calendar";
import { fetchMeetingSessions, fetchRaceSessions } from "@/src/lib/openf1";
import { getRaceDisplayRound, mapRaceSessionsByCalendar } from "@/src/lib/raceCalendar";
import { normalizeSessionType, sortWeekendSessions } from "@/src/lib/raceWeekend";
import { withViewTransition } from "@/src/lib/viewTransition";
import {
  ACCENT,
  CONTENT_MAX,
  HAIRLINE,
  MUTED_TEXT,
  PANEL_BORDER,
  SECTION_RADIUS,
  SPRINT,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
  rgbaFromHex,
} from "@/src/constants/design";
import { IS_SNAPSHOT } from "@/src/lib/runtimeFlags";
import { getViewerTimeZoneLabel } from "@/src/lib/timezone";
import useRaceCalendar from "@/src/lib/useRaceCalendar";
import usePageMetadata from "@/src/lib/usePageMetadata";
import useViewport from "@/src/lib/useViewport";
import PageMasthead from "@/src/ui/PageMasthead";

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTRY_CODE_MAP = {
  Australia: "AUS",
  China: "CHN",
  Japan: "JPN",
  Bahrain: "BHR",
  "Saudi Arabia": "KSA",
  Canada: "CAN",
  Monaco: "MON",
  Spain: "ESP",
  Austria: "AUT",
  "United Kingdom": "GBR",
  Belgium: "BEL",
  Hungary: "HUN",
  Netherlands: "NED",
  Italy: "ITA",
  Azerbaijan: "AZE",
  Singapore: "SGP",
  USA: "USA",
  Mexico: "MEX",
  Brazil: "BRA",
  Qatar: "QAT",
  UAE: "ARE",
};

const SESSION_SHORT_LABEL = {
  practice_1:        "FP1",
  practice_2:        "FP2",
  practice_3:        "FP3",
  practice:          "Practice",
  sprint_qualifying: "Sprint Qual.",
  sprint:            "Sprint",
  qualifying:        "Qualifying",
  race:              "Race",
};

const SESSION_ORDER = {
  practice_1:        10,
  practice_2:        20,
  practice_3:        30,
  sprint_qualifying: 40,
  sprint:            50,
  qualifying:        60,
  race:              70,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sessionShortLabel(type) {
  return SESSION_SHORT_LABEL[type] || String(type || "").replace(/_/g, " ");
}

function formatLocalTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

function formatShortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(d);
}

function formatDayBadge(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // "FRI · 5 JUN"
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d).toUpperCase();
  const rest = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(d).toUpperCase();
  return `${weekday} · ${rest}`;
}

function dayKeyFromDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatCountdownShort(diffMs) {
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "Live";
  const totalMin = Math.floor(diffMs / 60000);
  const days     = Math.floor(totalMin / (60 * 24));
  const hours    = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes  = totalMin % 60;
  if (days >= 2)  return `${days}d ${hours}h`;
  if (days === 1) return `1d ${hours}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function contrastingInkFor(hex) {
  const h = String(hex || "#000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full || "0", 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "rgba(7,15,27,0.88)" : "rgba(255,255,255,0.96)";
}

function countryCodeFor(race) {
  if (!race) return "";
  const cc = String(race.cc || "").trim();
  return COUNTRY_CODE_MAP[cc] || cc.slice(0, 3).toUpperCase();
}

function padRound(value) {
  return String(value).padStart(2, "0");
}

// Session-aware sort: within a single day, fall back to canonical F1 order
// (FP1 → FP2 → FP3 → SQ → Sprint → Q → Race) so the static fallback reads correctly
// when OpenF1 gives us only date granularity.
function sortSessionsForDay(sessions) {
  return [...sessions].sort((a, b) => {
    const ta = new Date(a._start || 0).getTime();
    const tb = new Date(b._start || 0).getTime();
    if (ta !== tb) return ta - tb;
    return (SESSION_ORDER[a.type] || 99) - (SESSION_ORDER[b.type] || 99);
  });
}

// ─── Presentational primitives ────────────────────────────────────────────────

function Kicker({ color = SUBTLE_TEXT, children, style }) {
  return (
    <span style={{
      fontSize:      10,
      fontWeight:    800,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color,
      fontVariantNumeric: "tabular-nums",
      ...style,
    }}>{children}</span>
  );
}

function FlagTile({ race, size = "md" }) {
  const color = rc(race);
  const code  = countryCodeFor(race);
  const ink   = contrastingInkFor(color);
  const w = size === "sm" ? 40 : 52;
  const h = size === "sm" ? 28 : 36;
  const fontSize = size === "sm" ? 10 : 11;
  return (
    <div
      aria-label={race?.cc || "Country"}
      style={{
        position:       "relative",
        width:          w,
        height:         h,
        borderRadius:   4,
        background:     color,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        border:         "1px solid rgba(6,16,27,0.55)",
        flexShrink:     0,
      }}
    >
      <span style={{
        fontSize,
        fontWeight:         900,
        letterSpacing:      "0.04em",
        color:              ink,
        fontVariantNumeric: "tabular-nums",
      }}>{code}</span>
    </div>
  );
}

function BadgePair({ round, sprint }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <span style={{
        display: "inline-flex", alignItems: "center",
        padding: "3px 9px", borderRadius: 4,
        background: "rgba(6,16,27,0.52)",
        border: "1px solid rgba(255,255,255,0.16)",
        fontSize: 10, fontWeight: 900, letterSpacing: "0.1em",
        color: "rgba(255,255,255,0.92)",
        fontVariantNumeric: "tabular-nums",
      }}>R{round}</span>
      {sprint && (
        <span style={{
          display: "inline-flex", alignItems: "center",
          padding: "3px 9px", borderRadius: 4,
          background: "rgba(168,85,247,0.18)",
          border: "1px solid rgba(168,85,247,0.38)",
          fontSize: 10, fontWeight: 900, letterSpacing: "0.1em",
          color: "#ead5ff",
        }}>SPRINT</span>
      )}
    </div>
  );
}

// ─── Weekend strip (inside the Cover) ─────────────────────────────────────────

function WeekendStrip({ sessions, isMobile, inkOnDark }) {
  // Group by calendar day
  const groups = [];
  const seen = new Set();
  for (const session of sessions) {
    const start = session.date_start || session.start || session.date;
    if (!start) continue;
    const dayKey = dayKeyFromDate(start);
    if (!dayKey) continue;
    if (!seen.has(dayKey)) {
      seen.add(dayKey);
      groups.push({ dayKey, date: start, sessions: [] });
    }
    groups.find((g) => g.dayKey === dayKey).sessions.push({
      ...session,
      _start: start,
      type:   normalizeSessionType(session.type || session.label || session.session_name),
    });
  }
  for (const g of groups) g.sessions = sortSessionsForDay(g.sessions);

  if (!groups.length) {
    return (
      <div style={{
        padding:      isMobile ? "14px 18px" : "16px 24px",
        color:        inkOnDark ? "rgba(255,255,255,0.56)" : SUBTLE_TEXT,
        fontSize:     12,
        letterSpacing: "0.02em",
      }}>
        Schedule confirms closer to the race.
      </div>
    );
  }

  const baseTextColor = inkOnDark ? "rgba(255,255,255,0.92)" : TEXT_PRIMARY;
  const mutedColor    = inkOnDark ? "rgba(255,255,255,0.58)" : MUTED_TEXT;
  const kickerColor   = inkOnDark ? "rgba(255,255,255,0.64)" : SUBTLE_TEXT;
  const dividerColor  = inkOnDark ? "rgba(255,255,255,0.10)" : HAIRLINE;

  if (isMobile) {
    return (
      <div style={{ display: "grid", gap: 14, padding: "14px 18px 18px" }}>
        {groups.map((group, idx) => (
          <div key={group.dayKey} style={{ display: "grid", gap: 6, ...(idx > 0 ? { borderTop: `1px solid ${dividerColor}`, paddingTop: 12 } : {}) }}>
            <Kicker color={kickerColor}>{formatDayBadge(group.date)}</Kicker>
            <div style={{ display: "grid", gap: 4 }}>
              {group.sessions.map((s) => {
                const isFeature = s.type === "race" || s.type === "sprint";
                return (
                  <div key={s.key || `${group.dayKey}-${s.type}`} style={{
                    display:        "flex",
                    justifyContent: "space-between",
                    alignItems:     "center",
                    gap:            10,
                    fontSize:       isFeature ? 14 : 13,
                    fontWeight:     isFeature ? 800 : 600,
                    color:          baseTextColor,
                    letterSpacing:  "-0.01em",
                  }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {isFeature ? <ChequerSwatch /> : <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: mutedColor, opacity: 0.6 }} />}
                      {sessionShortLabel(s.type)}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums", color: isFeature ? baseTextColor : mutedColor }}>
                      {formatLocalTime(s._start)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Desktop: up to 3 day-columns side by side.
  return (
    <div style={{
      display:             "grid",
      gridTemplateColumns: `repeat(${groups.length}, minmax(0,1fr))`,
      borderTop:           `1px solid ${dividerColor}`,
    }}>
      {groups.map((group, idx) => (
        <div key={group.dayKey} style={{
          padding:   "16px 22px 18px",
          borderLeft: idx > 0 ? `1px solid ${dividerColor}` : "none",
        }}>
          <Kicker color={kickerColor} style={{ display: "block", marginBottom: 10 }}>
            {formatDayBadge(group.date)}
          </Kicker>
          <div style={{ display: "grid", gap: 5 }}>
            {group.sessions.map((s) => {
              const isFeature = s.type === "race" || s.type === "sprint";
              return (
                <div key={s.key || `${group.dayKey}-${s.type}`} style={{
                  display:        "flex",
                  justifyContent: "space-between",
                  alignItems:     "center",
                  gap:            10,
                  fontSize:       isFeature ? 14 : 13,
                  fontWeight:     isFeature ? 800 : 600,
                  color:          baseTextColor,
                  letterSpacing:  "-0.01em",
                }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isFeature ? <ChequerSwatch /> : <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: mutedColor, opacity: 0.6, flexShrink: 0 }} />}
                    {sessionShortLabel(s.type)}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: isFeature ? baseTextColor : mutedColor, flexShrink: 0 }}>
                    {formatLocalTime(s._start)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChequerSwatch() {
  return (
    <span aria-hidden="true" style={{
      width:          11,
      height:         11,
      borderRadius:   2,
      background:     "repeating-conic-gradient(rgba(255,255,255,0.94) 0deg 90deg, #06101B 90deg 180deg)",
      backgroundSize: "5px 5px",
      border:         "1px solid var(--border-soft)",
      flexShrink:     0,
    }} />
  );
}

// ─── Countdown ────────────────────────────────────────────────────────────────
// Typographic, tabular-nums. Two units of precision — whichever two matter now
// (d+h, h+m, or m+s). Truthful: returns "Lights out" only when diff <= 0.

function TypographicCountdown({ diffMs, size = "lg" }) {
  if (!Number.isFinite(diffMs)) {
    return (
      <span style={{
        fontFamily:    "var(--font-mono)",
        fontSize:      size === "lg" ? 28 : 18,
        fontWeight:    700,
        letterSpacing: "-0.04em",
        color:         "rgba(255,255,255,0.74)",
      }}>—</span>
    );
  }
  if (diffMs <= 0) {
    return (
      <span style={{
        fontFamily:    "var(--font-mono)",
        fontSize:      size === "lg" ? 28 : 18,
        fontWeight:    700,
        letterSpacing: "-0.04em",
        color:         "rgba(255,255,255,0.96)",
      }}>Lights out</span>
    );
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days     = Math.floor(totalSec / 86400);
  const hours    = Math.floor((totalSec % 86400) / 3600);
  const minutes  = Math.floor((totalSec % 3600) / 60);
  const seconds  = totalSec % 60;

  let primary, secondary;
  if (days > 0) {
    primary   = { value: days,    unit: "d" };
    secondary = { value: hours,   unit: "h" };
  } else if (hours > 0) {
    primary   = { value: hours,   unit: "h" };
    secondary = { value: minutes, unit: "m" };
  } else {
    primary   = { value: minutes, unit: "m" };
    secondary = { value: seconds, unit: "s" };
  }

  // Audit Rec #01: "Numbers as the protagonist — Hero countdown should hit
  // 96-120px, not 28-36." Lg now hits the audit's lower bound; md tracks
  // proportionally. Tablet uses the lg size; mobile uses md.
  const numSize  = size === "lg" ? 96 : 48;
  const unitSize = size === "lg" ? 22 : 14;

  // Mono font for live timing data (audit Rec #01) — the lap-timing aesthetic
  // reads sharper on numerals than Manrope's tabular-nums variant.
  const numStyle = {
    display:            "inline-block",
    fontFamily:         "var(--font-mono)",
    fontSize:           numSize,
    fontWeight:         700,
    letterSpacing:      "-0.04em",
    lineHeight:         1,
    color:              "rgba(255,255,255,0.98)",
    fontVariantNumeric: "tabular-nums",
  };
  const unitStyle = {
    fontFamily:    "var(--font-mono)",
    fontSize:      unitSize,
    fontWeight:    700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color:         "rgba(255,255,255,0.52)",
    alignSelf:     "flex-end",
    paddingBottom: size === "lg" ? 3 : 1,
  };

  const primaryValue   = String(primary.value).padStart(2, "0");
  const secondaryValue = String(secondary.value).padStart(2, "0");

  return (
    <div
      role="timer"
      aria-label={`${primary.value}${primary.unit} ${secondary.value}${secondary.unit} to lights out`}
      style={{
        display:    "inline-flex",
        alignItems: "flex-end",
        gap:        size === "lg" ? 10 : 7,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 3 }}>
        {/* Keyed so each value change remounts the digit cluster, replaying
             the tick-in animation defined in the global <style> block. */}
        <span key={primaryValue} className="cal-count-digit" style={numStyle}>{primaryValue}</span>
        <span style={unitStyle}>{primary.unit}</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 3 }}>
        <span key={secondaryValue} className="cal-count-digit" style={numStyle}>{secondaryValue}</span>
        <span style={unitStyle}>{secondary.unit}</span>
      </span>
    </div>
  );
}

// ─── Track identity ───────────────────────────────────────────────────────────
// One layer only. Circuit SVG when available; country-code text fallback when
// not. No giant watermark layered behind the SVG, no scale transition.

function TrackIdentity({ race, isMobile }) {
  const [mapState, setMapState] = useState("loading");
  const raceSlug = race?.slug;

  useEffect(() => { setMapState("loading"); }, [raceSlug]);

  const code = countryCodeFor(race);
  const size = isMobile ? 120 : 156;

  return (
    <div
      className="cal-track-identity"
      style={{
        position:   "relative",
        width:      size,
        height:     size,
        flexShrink: 0,
      }}
    >
      {mapState !== "ok" && (
        <div style={{
          position:           "absolute",
          inset:              0,
          display:            "flex",
          alignItems:         "center",
          justifyContent:     "center",
          color:              "rgba(255,255,255,0.82)",
          fontWeight:         900,
          letterSpacing:      "-0.05em",
          fontSize:           isMobile ? 46 : 58,
          lineHeight:         1,
          userSelect:         "none",
          fontVariantNumeric: "tabular-nums",
          opacity:            mapState === "failed" ? 1 : 0.42,
          transition:         "opacity 240ms ease",
        }}>{code}</div>
      )}
      {mapState !== "failed" && (
        <img
          src={`/images/circuits/${raceSlug}.svg`}
          alt=""
          aria-hidden="true"
          onLoad={() => setMapState("ok")}
          onError={() => setMapState("failed")}
          style={{
            position:       "absolute",
            inset:          0,
            width:          "100%",
            height:         "100%",
            objectFit:      "contain",
            objectPosition: "center",
            filter:         "drop-shadow(0 4px 14px rgba(0,0,0,0.38))",
            opacity:        mapState === "ok" ? 0.95 : 0,
            transition:     "opacity 420ms cubic-bezier(0.23,1,0.32,1)",
            pointerEvents:  "none",
          }}
        />
      )}
    </div>
  );
}

// ─── The Cover ────────────────────────────────────────────────────────────────

function Cover({
  race,
  sessions,
  isNextDefault,
  countdownDiff,
  onBackToNext,
  isMobile,
}) {
  if (!race) return null;
  const color     = rc(race);
  const round     = padRound(getRaceDisplayRound(race) || race.r);
  const cancelled = isRaceCancelled(race);

  const INK_WHITE = "rgba(255,255,255,0.96)";

  const kicker = (() => {
    if (cancelled)     return { label: `Round ${round} · Cancelled`, tone: "#fca5a5" };
    if (isNextDefault) return { label: "Next race",                  tone: "#fff" };
    return                       { label: `Round ${round}`,          tone: "rgba(255,255,255,0.92)" };
  })();

  return (
    <section
      className="cal-cover"
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       PANEL_BORDER,
        background:   `linear-gradient(135deg, ${rgbaFromHex(color, 0.48)} 0%, ${rgbaFromHex(color, 0.18)} 38%, rgba(6,16,27,0.98) 100%)`,
        marginBottom: 20,
        boxShadow:    "0 10px 26px rgba(0,0,0,0.20)",
        filter:       cancelled ? "saturate(0.5)" : "none",
        viewTransitionName: "cover",
      }}
    >
      {/* Top band — kicker + badges */}
      <div style={{
        position:       "relative",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            12,
        padding:        isMobile ? "12px 18px" : "14px 24px",
        borderBottom:   "1px solid rgba(255,255,255,0.08)",
        flexWrap:       "wrap",
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, minWidth: 0, flexWrap: "wrap" }}>
          <Kicker color={kicker.tone} style={{ letterSpacing: "0.16em" }}>
            {kicker.label}
          </Kicker>
          {!isNextDefault && !cancelled && onBackToNext && (
            <button
              onClick={onBackToNext}
              className="cal-back-link"
              style={{
                background:    "transparent",
                border:        "none",
                color:         "rgba(255,255,255,0.62)",
                fontSize:      11,
                fontWeight:    700,
                letterSpacing: "0.02em",
                cursor:        "pointer",
                padding:       "2px 4px",
                fontFamily:    "inherit",
              }}
            >← Back to next race</button>
          )}
        </div>
        <BadgePair round={round} sprint={race.sprint} />
      </div>

      {/* Hero zone — asymmetric but compact. Track identity left, title block right. */}
      <div style={{
        position:            "relative",
        display:             "grid",
        gridTemplateColumns: isMobile ? "1fr" : "auto minmax(0, 1fr)",
        alignItems:          isMobile ? "start" : "center",
        padding:             isMobile ? "20px 20px 16px" : "22px 26px 20px",
        minHeight:           isMobile ? 160 : 196,
        gap:                 isMobile ? 16 : 24,
      }}>
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "flex-start",
        }}>
          <TrackIdentity race={race} isMobile={isMobile} />
        </div>

        {/* Title block */}
        <div style={{ minWidth: 0, position: "relative" }}>
          {isNextDefault && !cancelled && (
            <div style={{ marginBottom: isMobile ? 14 : 16 }}>
              <div style={{
                fontSize:      10,
                fontWeight:    900,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color:         "rgba(255,255,255,0.56)",
                marginBottom:  6,
              }}>Lights out in</div>
              <TypographicCountdown diffMs={countdownDiff} size={isMobile ? "md" : "lg"} />
            </div>
          )}

          <h1
            key={race.r}
            className="cal-cover-name"
            style={{
              margin:         0,
              fontSize:       isMobile ? 24 : "clamp(28px, 2.8vw, 34px)",
              fontWeight:     900,
              letterSpacing:  "-0.045em",
              lineHeight:     1.02,
              color:          INK_WHITE,
              textShadow:     "0 1px 10px rgba(0,0,0,0.28)",
              textDecoration: cancelled ? "line-through" : "none",
            }}
          >
            {race.n}
          </h1>

          <div style={{
            marginTop:     isMobile ? 6 : 8,
            fontSize:      isMobile ? 13 : 15,
            fontWeight:    600,
            letterSpacing: "-0.015em",
            color:         "rgba(255,255,255,0.78)",
            lineHeight:    1.3,
          }}>{race.circuit}</div>

          <div style={{
            marginTop:     3,
            fontSize:      12,
            fontWeight:    500,
            color:         "rgba(255,255,255,0.52)",
          }}>
            {race.city}, {race.cc}
          </div>

          {/* Micro-stats — inline caption */}
          <div style={{
            marginTop:          isMobile ? 12 : 14,
            fontSize:           11,
            color:              "rgba(255,255,255,0.60)",
            fontVariantNumeric: "tabular-nums",
            lineHeight:         1.5,
          }}>
            {race.len} km · {race.laps} laps · {race.turns} turns
            {race.rec && race.rec !== "—" && (
              <>
                <span style={{ color: "rgba(255,255,255,0.30)" }}> · </span>
                <span>Lap rec. <span style={{ color: "rgba(255,255,255,0.88)", fontWeight: 700 }}>{race.rec}</span> ({race.recBy}{race.recY ? `, ${race.recY}` : ""})</span>
              </>
            )}
          </div>

          {cancelled && (
            <div style={{
              marginTop:  12,
              fontSize:   12,
              color:      "#fecaca",
              lineHeight: 1.6,
            }}>
              This round was removed from the 2026 calendar.
            </div>
          )}
        </div>
      </div>

      {/* Weekend strip at the bottom */}
      {!cancelled && (
        <div style={{ position: "relative" }}>
          <WeekendStrip sessions={sessions} isMobile={isMobile} inkOnDark={true} />
        </div>
      )}
    </section>
  );
}

// ─── Index row ────────────────────────────────────────────────────────────────

function IndexRow({ race, active, isNext, isPast, countdownDiff, onSelect, isMobile }) {
  const cancelled   = isRaceCancelled(race);
  const round       = padRound(getRaceDisplayRound(race) || race.r);
  const circuitType = String(race.type || "").toLowerCase() === "street" ? "Street" : "Permanent";

  const roundTint = cancelled
    ? SUBTLE_TEXT
    : isNext
      ? ACCENT
      : isPast
        ? SUBTLE_TEXT
        : MUTED_TEXT;

  return (
    <button
      onClick={onSelect}
      className={`cal-row${active ? " is-active" : ""}`}
      aria-pressed={active}
      aria-current={active ? "true" : undefined}
      style={{
        width:         "100%",
        display:       "grid",
        gridTemplateColumns: isMobile ? "auto minmax(0,1fr)" : "auto 44px minmax(0,1fr) auto",
        gap:           isMobile ? 14 : 18,
        alignItems:    "center",
        borderRadius:  14,
        background:    active ? rgbaFromHex(ACCENT, 0.06) : "transparent",
        outline:       active ? `1px solid ${rgbaFromHex(ACCENT, 0.28)}` : "1px solid transparent",
        outlineOffset: -1,
        padding:       isMobile ? "12px 12px" : "14px 16px",
        cursor:        "pointer",
        textAlign:     "left",
        color:         TEXT_PRIMARY,
        fontFamily:    "inherit",
        border:        "none",
        opacity:       isPast && !active && !cancelled ? 0.48 : 1,
        filter:        cancelled ? "saturate(0.55)" : "none",
      }}
    >
      <span className="cal-row-flag-slot" style={{ display: "inline-flex" }}>
        <FlagTile race={race} size={isMobile ? "sm" : "md"} />
      </span>

      {!isMobile && (
        <div style={{
          fontSize:           13,
          fontWeight:         900,
          letterSpacing:      "0.04em",
          color:              roundTint,
          fontVariantNumeric: "tabular-nums",
          textAlign:          "center",
        }}>
          R{round}
        </div>
      )}

      <div style={{ minWidth: 0 }}>
        {isMobile && (
          <div style={{
            fontSize:           10,
            fontWeight:         900,
            letterSpacing:      "0.12em",
            color:              roundTint,
            textTransform:      "uppercase",
            fontVariantNumeric: "tabular-nums",
            marginBottom:       3,
          }}>
            R{round}
            {isNext && !cancelled && (
              <span style={{ color: "var(--brand)", marginLeft: 8 }}>
                · Next{countdownDiff != null && countdownDiff > 0 ? ` · ${formatCountdownShort(countdownDiff)}` : ""}
              </span>
            )}
          </div>
        )}
        <div style={{
          fontSize:       isMobile ? 16 : 18,
          fontWeight:     800,
          letterSpacing:  "-0.025em",
          color:          TEXT_PRIMARY,
          marginBottom:   3,
          lineHeight:     1.18,
          textDecoration: cancelled ? "line-through" : "none",
        }}>{race.n}</div>
        <div style={{
          display:       "flex",
          alignItems:    "center",
          gap:           8,
          flexWrap:      "wrap",
          fontSize:      12,
          color:         MUTED_TEXT,
          letterSpacing: "-0.005em",
        }}>
          <span>{race.city}, {race.cc}</span>
          <span style={{ color: SUBTLE_TEXT }}>·</span>
          <span>{circuitType}</span>
          {race.sprint && !cancelled && (
            <>
              <span style={{ color: SUBTLE_TEXT }}>·</span>
              <span style={{
                color:         SPRINT,
                fontWeight:    700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontSize:      10,
              }}>Sprint</span>
            </>
          )}
          {cancelled && (
            <>
              <span style={{ color: SUBTLE_TEXT }}>·</span>
              <span style={{
                color:         "#fca5a5",
                fontWeight:    700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontSize:      10,
              }}>Cancelled</span>
            </>
          )}
        </div>

        {isMobile && (
          <div style={{
            marginTop:          8,
            fontSize:           12,
            fontWeight:         700,
            color:              isPast ? SUBTLE_TEXT : TEXT_PRIMARY,
            fontVariantNumeric: "tabular-nums",
          }}>
            {formatShortDate(race.date)}
          </div>
        )}
      </div>

      {!isMobile && (
        <div style={{
          display:            "flex",
          flexDirection:      "column",
          alignItems:         "flex-end",
          gap:                4,
          fontVariantNumeric: "tabular-nums",
          whiteSpace:         "nowrap",
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: isPast ? SUBTLE_TEXT : TEXT_PRIMARY, letterSpacing: "-0.01em" }}>
            {formatShortDate(race.date)}
          </span>
          {isNext && !cancelled && countdownDiff != null && countdownDiff > 0 && (
            <span style={{
              fontSize:       10,
              fontWeight:     900,
              letterSpacing:  "0.14em",
              color: "var(--brand)",
              textTransform:  "uppercase",
            }}>Next · {formatCountdownShort(countdownDiff)}</span>
          )}
          {/* Lap-record hover reveal — desktop only, zero layout shift (max-height morph). */}
          {race.rec && race.rec !== "—" && !cancelled && (
            <span
              className="cal-row-record"
              style={{
                fontSize:       10,
                fontWeight:     700,
                letterSpacing:  "0.02em",
                color:          SUBTLE_TEXT,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Rec <span style={{ color: MUTED_TEXT, fontWeight: 800 }}>{race.rec}</span> · {race.recBy}{race.recY ? ` · ${race.recY}` : ""}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Month section ────────────────────────────────────────────────────────────

function MonthSection({ label, races, sel, nextRound, nowTick, onSelect, isMobile }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <header style={{
        display:        "flex",
        alignItems:     "baseline",
        justifyContent: "space-between",
        marginBottom:   14,
        paddingBottom:  10,
        borderBottom:   `1px solid ${HAIRLINE}`,
      }}>
        <h2 className="stint-section-title" style={{
          margin:        0,
          fontSize:      isMobile ? 19 : 22,
          letterSpacing: "-0.035em",
        }}>{label}</h2>
        <Kicker style={{ fontVariantNumeric: "tabular-nums" }}>
          {races.length} round{races.length === 1 ? "" : "s"}
        </Kicker>
      </header>
      <div style={{ display: "grid", gap: 2 }}>
        {races.map((race) => {
          const isPast = parseDate(race.date).getTime() + 6 * 3600 * 1000 < nowTick;
          const isNext = race.r === nextRound;
          const cd     = isNext ? parseDate(race.date).getTime() - nowTick : null;
          return (
            <IndexRow
              key={race.r}
              race={race}
              active={sel?.r === race.r}
              isNext={isNext}
              isPast={isPast}
              countdownDiff={cd}
              onSelect={() => onSelect(race)}
              isMobile={isMobile}
            />
          );
        })}
      </div>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { isMobile, isTablet } = useViewport();
  const { calendar } = useRaceCalendar(2026);
  const [sel, setSel]                   = useState(null);
  const [liveRaces, setLiveRaces]       = useState({});
  const [liveMeetings, setLiveMeetings] = useState({});
  const [nowTick, setNowTick]           = useState(() => Date.now());
  const coverRef                        = useRef(null);
  const userInitiatedRef                = useRef(false);

  usePageMetadata({
    title:       "2026 F1 Calendar",
    description: "The 2026 Formula 1 season, round by round — circuits, session timing, and local times for every round.",
    path:        "/calendar",
  });

  // Countdown tick — 30s, paused when the tab is hidden. Minute precision is
  // sufficient for the d/h + h/m readout in the Cover; the TypographicCountdown
  // handles per-value remounts for its own tick animation.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    const onVisible = () => { if (!document.hidden) setNowTick(Date.now()); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Season-level OpenF1 — meeting_key lookup
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (IS_SNAPSHOT) return;
      const sessions = await fetchRaceSessions(2026);
      if (ignore || !sessions.length) return;
      setLiveRaces(mapRaceSessionsByCalendar(calendar, sessions));
    })();
    return () => { ignore = true; };
  }, [calendar]);

  // Meeting-level OpenF1 for the selected race
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (IS_SNAPSHOT || !sel) return;
      const info = liveRaces[sel.r];
      if (!info?.meeting_key || liveMeetings[sel.r]) return;
      const sessions = await fetchMeetingSessions(info.meeting_key);
      if (ignore || !sessions.length) return;
      setLiveMeetings((current) => ({
        ...current,
        [sel.r]: sessions.map((s) => ({
          key:        `${s.session_key}-${s.session_name}`,
          label:      s.session_name,
          type:       normalizeSessionType(s.session_name),
          date_start: s.date_start,
          date_end:   s.date_end,
        })),
      }));
    })();
    return () => { ignore = true; };
  }, [sel, liveRaces, liveMeetings]);

  // Default selection: next race, with ?round=N deep-link support
  useEffect(() => {
    if (!calendar.length) { setSel(null); return; }
    setSel((current) => {
      if (current) {
        const updated = calendar.find((r) => r.r === current.r);
        if (updated) return updated;
      }
      if (typeof window !== "undefined") {
        const req = Number(new URLSearchParams(window.location.search).get("round"));
        if (req) {
          const found = calendar.find((r) => r.r === req);
          if (found) return found;
        }
      }
      return nextRace(calendar) || calendar[0] || null;
    });
  }, [calendar]);

  // Persist ?round=N
  useEffect(() => {
    if (typeof window === "undefined" || !sel) return;
    const url = new URL(window.location.href);
    if (Number(url.searchParams.get("round")) !== Number(sel.r)) {
      url.searchParams.set("round", String(sel.r));
      window.history.replaceState({}, "", url);
    }
  }, [sel]);

  // Auto-scroll to page top on user-initiated selection — every breakpoint.
  // The Cover dominates the first paint, so the user always arrives at the race's
  // editorial statement first regardless of where they were in the Index.
  useEffect(() => {
    if (sel && userInitiatedRef.current) {
      const prefersReduced = typeof window !== "undefined"
        && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
      }
    }
    userInitiatedRef.current = false;
  }, [sel]);

  // Month grouping
  const byMonth = useMemo(() => {
    const groups = [];
    for (const r of calendar) {
      const label = monthLabel(r.date);
      const g = groups.find((g) => g.label === label);
      if (g) g.races.push(r);
      else groups.push({ label, races: [r] });
    }
    return groups;
  }, [calendar]);

  // Next race + metrics
  const nextActive    = useMemo(() => nextRace(calendar), [calendar]);
  const nextRaceRound = nextActive?.r || null;

  const currentRoundNumber = useMemo(() => {
    const active = calendar.filter((r) => !isRaceCancelled(r));
    const idx = active.findIndex((r) => parseDate(r.date).getTime() + 6 * 3600 * 1000 >= nowTick);
    return idx >= 0 ? idx + 1 : active.length;
  }, [calendar, nowTick]);

  const roundsRemaining = useMemo(() => {
    return calendar.filter((r) => !isRaceCancelled(r) && parseDate(r.date).getTime() + 6 * 3600 * 1000 >= nowTick).length;
  }, [calendar, nowTick]);

  // Cover schedule for selected race
  const selSchedule = useMemo(() => {
    if (!sel) return [];
    const live = liveMeetings[sel.r];
    const source = live?.length
      ? live
      : raceSessions(sel).map((s) => ({
          key:        `${s.label}-static`,
          label:      s.label,
          type:       normalizeSessionType(s.label),
          date_start: s.date ? new Date(s.date).toISOString() : null,
          date_end:   null,
        }));
    return sortWeekendSessions(source);
  }, [sel, liveMeetings]);

  // Real race-session start time — pulled from the weekend schedule if present.
  // This is the truthful "lights out" moment. Falls back to the static race date
  // (midnight of race day) only when no session timing is available yet.
  const raceSessionStart = useMemo(() => {
    if (!selSchedule?.length) return null;
    const raceSession = selSchedule.find((s) => s.type === "race");
    if (!raceSession?.date_start) return null;
    const t = new Date(raceSession.date_start).getTime();
    return Number.isFinite(t) ? t : null;
  }, [selSchedule]);

  // Cover countdown — only if selected is the next active race
  const selectedIsNextDefault = sel && nextActive && sel.r === nextActive.r;
  const selCountdownDiff = selectedIsNextDefault && sel
    ? (raceSessionStart ?? parseDate(sel.date).getTime()) - nowTick
    : null;

  const timezone = getViewerTimeZoneLabel();

  const handleSelect = (race) => {
    if (!race) return;
    userInitiatedRef.current = true;
    withViewTransition(() => setSel(race), { name: "cover" });
  };

  const handleBackToNext = () => {
    if (!nextActive) return;
    userInitiatedRef.current = true;
    withViewTransition(() => setSel(nextActive), { name: "cover" });
  };

  return (
    <>
    <style>{`
      .cal-row {
        transition: outline-color 180ms cubic-bezier(0.23,1,0.32,1),
                    background   180ms cubic-bezier(0.23,1,0.32,1),
                    transform    180ms cubic-bezier(0.23,1,0.32,1);
        will-change: transform;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .cal-back-link {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      @media (hover: hover) and (pointer: fine) {
        .cal-row:not(.is-active):hover {
          background: rgba(255,255,255,0.02) !important;
          outline-color: rgba(214,223,239,0.14) !important;
        }
      }
      .cal-row:active { transform: scale(0.996); transition-duration: 80ms; }

      /* Lap-record caption: hidden by default, revealed on desktop row hover. */
      .cal-row-record {
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        transition: max-height 260ms cubic-bezier(0.23,1,0.32,1),
                    opacity    200ms ease,
                    transform  260ms cubic-bezier(0.23,1,0.32,1);
        transform: translateY(-2px);
      }
      @media (hover: hover) and (pointer: fine) {
        .cal-row:hover .cal-row-record,
        .cal-row:focus-visible .cal-row-record {
          max-height: 24px;
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Index parallax — tiny horizontal drift on the flag tile as the row passes
         through the viewport. Native scroll-driven animation where supported;
         silently no-op where it is not. */
      .cal-row .cal-row-flag-slot {
        animation: cal-row-parallax linear both;
        animation-timeline: view();
        animation-range: cover 0% cover 100%;
      }
      @keyframes cal-row-parallax {
        from { transform: translateX(-6px); }
        to   { transform: translateX(6px); }
      }

      .cal-back-link { transition: color 160ms ease; }
      @media (hover: hover) and (pointer: fine) {
        .cal-back-link:hover { color: rgba(255,255,255,0.92) !important; }
      }

      ::view-transition-old(cover),
      ::view-transition-new(cover) {
        animation-duration: 360ms;
        animation-timing-function: cubic-bezier(0.16,1,0.3,1);
      }

      /* Keep the month index + intro band snap-stable while the Cover morphs —
         only the named Cover element animates when the user selects a race. */
      [data-vt-name="cover"]::view-transition-old(root),
      [data-vt-name="cover"]::view-transition-new(root) {
        animation: none;
      }

      /* Countdown digit — a short upward tick-in on each value change. Keyed
         remount in React triggers the animation on mount. Transform-only so it
         never reflows the surrounding layout. */
      @keyframes cal-digit-tick {
        0%   { transform: translateY(-4px); opacity: 0; }
        55%  { opacity: 1; }
        100% { transform: translateY(0);    opacity: 1; }
      }
      .cal-count-digit {
        animation: cal-digit-tick 280ms cubic-bezier(0.16,1,0.3,1) both;
        will-change: transform;
        backface-visibility: hidden;
      }

      /* Cover entrance — fade + micro-lift on first paint only. Sits behind the
         view-transition when the user swaps races. */
      @keyframes cal-cover-in {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .cal-cover { animation: cal-cover-in 380ms cubic-bezier(0.16,1,0.3,1) both; }

      @media (prefers-reduced-motion: reduce) {
        .cal-row, .cal-back-link, .cal-row-record { transition: none !important; }
        .cal-row .cal-row-flag-slot,
        .cal-count-digit,
        .cal-cover { animation: none !important; }
        ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
      }
    `}</style>

    <div data-page-density="dense" style={{
      maxWidth: CONTENT_MAX,
      margin:   "0 auto",
      padding:  isMobile ? "22px 18px 72px" : isTablet ? "28px 22px 80px" : "34px 28px 84px",
      position: "relative",
      zIndex:   1,
    }}>

      {/* ── Editorial hero band — canonical PageMasthead.
           `header-calendar.png` anchors the Calendar identity on the right
           with the right-mask fade. Matches the image contract used by every
           other primary tab so the app reads as one product. */}
      <PageMasthead
        eyebrow="Calendar · 2026"
        title="The 2026 season."
        image={{ src: "/images/header-calendar.png", position: "right-mask" }}
        tone="ambient"
        marginBottom={isMobile ? 22 : 28}
        meta={
          <div style={{
            fontSize:           12,
            color:              MUTED_TEXT,
            fontVariantNumeric: "tabular-nums",
            letterSpacing:      "-0.005em",
            textAlign:          isMobile ? "left" : "right",
            lineHeight:         1.5,
            maxWidth:           "100%",
          }}>
            <span style={{ color: TEXT_PRIMARY, fontWeight: 800, whiteSpace: "nowrap" }}>
              Round {padRound(currentRoundNumber)} of {ACTIVE_RACE_COUNT}
            </span>
            <span style={{ color: SUBTLE_TEXT }}> · </span>
            <span style={{ whiteSpace: "nowrap" }}>{roundsRemaining > 0 ? `${roundsRemaining} to run` : "Season complete"}</span>
            <span style={{ color: SUBTLE_TEXT }}> · </span>
            <span style={{ whiteSpace: "nowrap" }}>{timezone}</span>
          </div>
        }
      />

      {/* ── The Cover ───────────────────────────────────────────────────────── */}
      <div ref={coverRef}>
        <Cover
          race={sel}
          sessions={selSchedule}
          isNextDefault={!!selectedIsNextDefault}
          countdownDiff={selCountdownDiff}
          onBackToNext={selectedIsNextDefault ? null : handleBackToNext}
          isMobile={isMobile}
        />
      </div>

      {/* ── The Index ───────────────────────────────────────────────────────── */}
      {byMonth.map((group) => (
        <MonthSection
          key={group.label}
          label={group.label}
          races={group.races}
          sel={sel}
          nextRound={nextRaceRound}
          nowTick={nowTick}
          onSelect={handleSelect}
          isMobile={isMobile}
        />
      ))}
    </div>
    </>
  );
}
