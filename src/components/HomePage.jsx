import { useEffect, useMemo, useState } from "react";
import { countdown, fmtFull, nextRace, raceSessions, rc } from "../constants/calendar";
import {
  ACCENT,
  BG_BASE,
  BRAND_GRADIENT,
  BRAND_NAME,
  CARD_RADIUS,
  CONTENT_MAX,
  HAIRLINE,
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
  Sprint: { label: "Sprint", type: "sprint" },
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
    <div style={{ position: "relative", paddingLeft: 22, paddingBottom: last ? 0 : 18 }}>
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
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: active ? ACCENT : PANEL_BG_ALT,
          border: `1.5px solid ${active ? ACCENT : "rgba(255,255,255,0.22)"}`,
          boxShadow: active ? "0 0 0 6px rgba(249,115,22,0.08)" : "none",
        }}
      />
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: labelColor }}>
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
        borderRadius: SECTION_RADIUS,
        background: PANEL_BG,
        boxShadow: LIFTED_SHADOW,
        overflow: "hidden",
      }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg,${ACCENT},${accent}, rgba(255,255,255,0.72))` }} />
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
          Next race
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 8 }}>{race.n}</div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: MUTED_TEXT, marginBottom: 20 }}>
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
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 8 }}>
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

function ScheduleCard({ schedule }) {
  return (
    <section style={{ borderRadius: SECTION_RADIUS, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
          Weekend schedule
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Every session, race-week timing
        </div>
      </div>

      <div style={{ padding: "22px 22px 8px" }}>
        {schedule.map((session, index) => (
          <TimelineItem
            key={session.key}
            session={session}
            active={session.type === "qualifying"}
            last={index === schedule.length - 1}
          />
        ))}
      </div>

      <div style={{ padding: "0 22px 20px", fontSize: 13, lineHeight: 1.6, color: MUTED_TEXT }}>
        Times follow the same timezone-adjusted schedule shown in Calendar.
      </div>
    </section>
  );
}

export default function HomePage({ user, setPage, openAuth }) {
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
      if (!ignore) setLiveSchedule(sessions.map(normalizeLiveSession).filter(Boolean));
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
    setPage("predictions");
    if (!user) {
      openAuth("register");
    }
  };

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: isMobile ? "36px 20px 72px" : isTablet ? "52px 32px 88px" : "72px 48px 96px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) 430px",
          gap: 28,
          alignItems: "start",
        }}
      >
        <div style={{ paddingTop: isTablet ? 0 : 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(148,163,184,0.12)",
              marginBottom: 28,
            }}
          >
            <BrandMark size={20} />
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
              {BRAND_NAME}
            </span>
          </div>

          <h1
            style={{
              maxWidth: 900,
              fontSize: isMobile ? 58 : isTablet ? 78 : 108,
              fontWeight: 800,
              letterSpacing: "-0.05em",
              lineHeight: 0.94,
              margin: "0 0 28px",
            }}
          >
            Make your picks.
            <br />
            Track the weekend.
            <br />
            Win your league.
          </h1>

          <div style={{ maxWidth: 620, fontSize: 17, lineHeight: 1.68, color: MUTED_TEXT, marginBottom: 34 }}>
            Build your board with live schedules, Wire updates, and AI Insight before qualifying locks the round.
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button
              onClick={primaryAction}
              style={{
                minHeight: 56,
                padding: "0 30px",
                borderRadius: RADIUS_MD,
                border: "none",
                background: BRAND_GRADIENT,
                color: TEXT_PRIMARY,
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(249,115,22,0.24)",
              }}
            >
              Make your picks
            </button>
            <button
              onClick={() => setPage("calendar")}
              style={{
                minHeight: 56,
                padding: "0 30px",
                borderRadius: RADIUS_MD,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
                color: TEXT_PRIMARY,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View Calendar
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {next && cd && <CountdownCard race={next} cd={cd} accent={accent} />}
          {schedule.length > 0 && <ScheduleCard schedule={schedule} />}
        </div>
      </section>
    </div>
  );
}
