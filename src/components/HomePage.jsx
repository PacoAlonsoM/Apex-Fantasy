import { useEffect, useMemo, useState } from "react";
import { countdown, fmtFull, nextRace, raceSessions, rc } from "../constants/calendar";
import {
  ACCENT,
  BG_BASE,
  BRAND_GRADIENT,
  BRAND_NAME,
  BRAND_TAGLINE,
  CONTENT_MAX,
  HAIRLINE,
  HERO_GRADIENT,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  RADIUS_MD,
  SECTION_RADIUS,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
} from "../constants/design";
import { fetchMeetingSessions, fetchRaceSessions } from "../openf1";
import { pageToHref } from "../routing";
import { IS_SNAPSHOT } from "../runtimeFlags";
import usePageMetadata from "../usePageMetadata";
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

function TimelineItem({ session, active, last, compact = false }) {
  const labelColor = session.type === "race"
    ? "#EF4444"
    : session.type === "qualifying"
      ? ACCENT
      : SUBTLE_TEXT;

  return (
    <div style={{ position: "relative", paddingLeft: compact ? 18 : 20, paddingBottom: last ? 0 : compact ? 14 : 18 }}>
      {!last && (
        <span
          style={{
            position: "absolute",
            left: 3,
            top: compact ? 10 : 12,
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
          top: compact ? 6 : 7,
          width: compact ? 6 : 7,
          height: compact ? 6 : 7,
          borderRadius: "50%",
          background: active ? ACCENT : PANEL_BG_ALT,
          border: `1.5px solid ${active ? ACCENT : "rgba(255,255,255,0.2)"}`,
          boxShadow: active ? "0 0 0 6px rgba(249,115,22,0.08)" : "none",
        }}
      />
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: compact ? 11 : 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: labelColor }}>
          {session.label}
        </div>
        <div style={{ fontSize: compact ? 12 : 13, lineHeight: 1.4, color: TEXT_PRIMARY }}>{formatSessionSlot(session.date)}</div>
      </div>
    </div>
  );
}

function CountdownCard({ race, cd, accent, schedule }) {
  return (
    <section
      style={{
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
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.03, marginBottom: 8 }}>{race.n}</div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: MUTED_TEXT, marginBottom: 20 }}>
          {race.circuit} · {fmtFull(race.date)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
          {[["Days", cd.d], ["Hours", cd.h], ["Minutes", cd.m]].map(([label, value]) => (
            <div
              key={label}
              style={{
                borderRadius: RADIUS_MD,
                background: BG_BASE,
                padding: "12px 8px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{String(value).padStart(2, "0")}</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 6 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, lineHeight: 1.5, color: MUTED_TEXT, marginBottom: 14 }}>
          Picks close right before qualifying begins.
        </div>

        <div style={{ paddingTop: 12, borderTop: `1px solid ${HAIRLINE}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
            Weekend timeline
          </div>
          <div>
            {schedule.map((session, index) => (
              <TimelineItem
                key={session.key}
                session={session}
                active={session.type === "qualifying"}
                last={index === schedule.length - 1}
                compact
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

export default function HomePage({ user, setPage, openAuth, demoMode = false, openPredictionsForRace }) {
  const { isMobile, isTablet } = useViewport();
  const next = nextRace();
  const cd = next ? countdown(next.date) : null;
  const accent = next ? rc(next) : ACCENT;
  const [liveSchedule, setLiveSchedule] = useState([]);

  usePageMetadata({
    title: "Compete hard. Predict sharp. Win your league.",
    description: "STINT brings race-week schedules, F1 news, leaderboard context and sharper picks into one product you can actually use before lock.",
    path: "/",
  });

  useEffect(() => {
    let ignore = false;

    async function loadLiveSchedule() {
      if (!next || IS_SNAPSHOT) return;
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

  const openNextRacePicks = () => {
    if (user || demoMode) {
      openPredictionsForRace?.(next?.r);
      return;
    }
    setPage("public-picks");
  };

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: isMobile ? "28px 20px 72px" : isTablet ? "36px 32px 88px" : "34px 48px 88px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) 472px",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <BrandMark size={28} />
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                {BRAND_NAME}
              </span>
            </div>

            <h1
              style={{
                maxWidth: 760,
                fontSize: isMobile ? 48 : isTablet ? 58 : 64,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 0.98,
                marginBottom: 16,
              }}
            >
              Compete hard,
              <br />
              Predict sharp,
              <br />
              <span style={{ background: HERO_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                Win your league.
              </span>
            </h1>

            <div style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.62, color: MUTED_TEXT, marginBottom: 22 }}>
              {BRAND_TAGLINE} Use live schedules, race-week news, and AI Insight without leaving the product.
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a
                href={pageToHref(user || demoMode ? "predictions" : "public-picks", { demoMode, raceRound: next?.r })}
                onClick={(event) => {
                  event.preventDefault();
                  openNextRacePicks();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 50,
                  padding: "0 24px",
                  borderRadius: RADIUS_MD,
                  border: "none",
                  background: BRAND_GRADIENT,
                  color: TEXT_PRIMARY,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(249,115,22,0.25)",
                  textDecoration: "none",
                }}
              >
                Make picks
              </a>
              <a
                href={pageToHref("calendar", { demoMode })}
                onClick={(event) => {
                  event.preventDefault();
                  setPage("calendar");
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 50,
                  padding: "0 24px",
                  borderRadius: RADIUS_MD,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                  color: TEXT_PRIMARY,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                View Calendar
              </a>
            </div>
          </div>
        </div>

        {next && cd && (
          <CountdownCard
            race={next}
            cd={cd}
            accent={accent}
            schedule={schedule}
          />
        )}
      </section>
    </div>
  );
}
