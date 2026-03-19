import { useEffect, useMemo, useState } from "react";
import { countdown, fmtFull, nextRace, raceSessions, rc } from "../constants/calendar";
import {
  ACCENT,
  BG_BASE,
  BRAND_GRADIENT,
  BRAND_NAME,
  BRAND_TAGLINE,
  CARD_RADIUS,
  CONTENT_MAX,
  HAIRLINE,
  HERO_GRADIENT,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  RADIUS_MD,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
} from "../constants/design";
import { fetchMeetingSessions, fetchRaceSessions } from "../openf1";
import BrandMark from "./BrandMark";
import useViewport from "../useViewport";

const homeSessionMeta = {
  "Practice 1": { label: "FP1", type: "practice" },
  "Practice 2": { label: "FP2", type: "practice" },
  "Practice 3": { label: "FP3", type: "practice" },
  "Sprint Qualifying": { label: "Sprint Qualifying", type: "qualifying" },
  "Sprint": { label: "Sprint", type: "sprint" },
  Qualifying: { label: "Qualifying", type: "qualifying" },
  Race: { label: "Race", type: "race" },
};

function normalizeLiveSession(session) {
  const meta = homeSessionMeta[session.session_name];
  if (!meta) return null;
  return {
    key: `${session.session_key}-${session.session_name}`,
    label: meta.label,
    type: meta.type,
    date: session.date_start,
    hasLiveTime: true,
  };
}

function formatSessionSlot(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function TimelineItem({ session, active, last }) {
  const labelColor = session.type === "race"
    ? "#EF4444"
    : session.type === "qualifying"
      ? ACCENT
      : SUBTLE_TEXT;

  return (
    <div style={{ position: "relative", paddingLeft: 20, paddingBottom: last ? 0 : 18 }}>
      {!last && (
        <span
          style={{
            position: "absolute",
            left: 3,
            top: 12,
            bottom: -8,
            width: 1,
            background: "rgba(255,255,255,0.12)",
          }}
        />
      )}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 7,
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: active ? ACCENT : PANEL_BG_ALT,
          border: `1.5px solid ${active ? ACCENT : "rgba(255,255,255,0.2)"}`,
          boxShadow: active ? "0 0 0 6px rgba(249,115,22,0.08)" : "none",
        }}
      />
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: labelColor }}>
          {session.label}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.4, color: TEXT_PRIMARY }}>{formatSessionSlot(session.date)}</div>
      </div>
    </div>
  );
}

function CountdownCard({ race, cd, accent }) {
  return (
    <section
      style={{
        position: "sticky",
        top: 96,
        borderRadius: SECTION_RADIUS,
        background: PANEL_BG,
        boxShadow: LIFTED_SHADOW,
        overflow: "hidden",
      }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg,${ACCENT},${accent}, transparent)` }} />
      <div style={{ padding: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, animation: "pulseDot 2s infinite" }} />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
            Next race
          </span>
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 8 }}>{race.n}</div>
        <div style={{ fontSize: 16, lineHeight: 1.6, color: MUTED_TEXT, marginBottom: 24 }}>
          {race.circuit} · {fmtFull(race.date)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginBottom: 18 }}>
          {[["Days", cd.d], ["Hours", cd.h], ["Minutes", cd.m]].map(([label, value]) => (
            <div
              key={label}
              style={{
                borderRadius: RADIUS_MD,
                background: BG_BASE,
                padding: "16px 10px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{String(value).padStart(2, "0")}</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 8 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.6, color: MUTED_TEXT }}>
          Picks close right before qualifying begins.
        </div>
      </div>
    </section>
  );
}

export default function HomePage({ user, setPage, openAuth, demoMode = false }) {
  const { isMobile, isTablet } = useViewport();
  const next = nextRace();
  const cd = next ? countdown(next.date) : null;
  const accent = next ? rc(next) : ACCENT;
  const [liveSchedule, setLiveSchedule] = useState([]);

  useEffect(() => {
    let ignore = false;

    async function loadLiveSchedule() {
      if (!next) return;
      const year = new Date(next.date).getFullYear();
      const races = await fetchRaceSessions(year);
      const raceInfo = races[next.r - 1];

      if (!raceInfo?.meeting_key) {
        if (!ignore) setLiveSchedule([]);
        return;
      }

      const sessions = await fetchMeetingSessions(raceInfo.meeting_key);
      if (!ignore) {
        setLiveSchedule(sessions.map(normalizeLiveSession).filter(Boolean));
      }
    }

    loadLiveSchedule();
    return () => {
      ignore = true;
    };
  }, [next]);

  const schedule = useMemo(() => {
    if (!next) return [];
    if (liveSchedule.length) return liveSchedule;
    return raceSessions(next).map((session, index) => ({
      ...session,
      key: `${session.label}-${index}`,
      type: session.label === "Race" ? "race" : session.label === "Qualifying" ? "qualifying" : "practice",
    }));
  }, [liveSchedule, next]);

  const primaryAction = () => {
    if (user || demoMode) {
      setPage("predictions");
      return;
    }
    openAuth("login");
  };

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: isMobile ? "40px 20px 72px" : isTablet ? "56px 32px 88px" : "80px 48px 96px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <section style={{ paddingBottom: 64 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <BrandMark size={28} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
            {BRAND_NAME}
          </span>
        </div>

        <h1
          style={{
            maxWidth: 880,
            fontSize: isMobile ? 56 : isTablet ? 72 : 96,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.02,
            marginBottom: 24,
          }}
        >
          Compete every round.
          <br />
          Read the weekend better.
          <br />
          <span style={{ background: HERO_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            Win your league.
          </span>
        </h1>

        <div style={{ maxWidth: 520, fontSize: 16, lineHeight: 1.6, color: MUTED_TEXT, marginBottom: 40 }}>
          {BRAND_TAGLINE} Use live schedules, race-week news, and AI Insight without leaving the product.
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <button
            onClick={primaryAction}
            style={{
              minHeight: 52,
              padding: "0 28px",
              borderRadius: RADIUS_MD,
              border: "none",
              background: BRAND_GRADIENT,
              color: TEXT_PRIMARY,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(249,115,22,0.25)",
            }}
          >
            Make your picks
          </button>
          <button
            onClick={() => setPage("calendar")}
            style={{
              minHeight: 52,
              padding: "0 28px",
              borderRadius: RADIUS_MD,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
              color: TEXT_PRIMARY,
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            View Calendar
          </button>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) 380px",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 24 }}>
          {next && (
            <div style={{ borderRadius: CARD_RADIUS, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
              <div style={{ height: 3, background: `linear-gradient(90deg,${ACCENT},${accent}, transparent)` }} />
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                  Picks status
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 8 }}>
                  Lock the {next.n} board before qualifying.
                </div>
                <div style={{ fontSize: 16, lineHeight: 1.6, color: MUTED_TEXT, marginBottom: 18 }}>
                  The next board is already open. Use Calendar for session timing, Wire for updates, and AI Insight for category-level angles before lock.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                  <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(249,115,22,0.15)", color: ACCENT }}>
                    10 categories
                  </span>
                  {next.sprint && (
                    <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(168,85,247,0.12)", color: "#A855F7" }}>
                      Sprint weekend
                    </span>
                  )}
                  <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(59,130,246,0.12)", color: "#3B82F6" }}>
                    Times synced
                  </span>
                </div>
                <button
                  onClick={primaryAction}
                  style={{
                    minHeight: 48,
                    padding: "0 20px",
                    borderRadius: RADIUS_MD,
                    border: "none",
                    background: BRAND_GRADIENT,
                    color: TEXT_PRIMARY,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(249,115,22,0.25)",
                  }}
                >
                  Open Picks
                </button>
              </div>
            </div>
          )}

          <div style={{ borderRadius: CARD_RADIUS, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
            <div style={{ padding: "24px 24px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                Weekend schedule
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" }}>
                Every session, one clean timeline.
              </div>
            </div>

            <div style={{ padding: "24px 24px 8px" }}>
              {schedule.map((session, index) => (
                <TimelineItem
                  key={session.key}
                  session={session}
                  active={session.type === "qualifying"}
                  last={index === schedule.length - 1}
                />
              ))}
            </div>
          </div>
        </div>

        {next && cd && <CountdownCard race={next} cd={cd} accent={accent} />}
      </section>
    </div>
  );
}
