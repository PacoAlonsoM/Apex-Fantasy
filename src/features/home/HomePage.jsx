import { useEffect, useMemo, useState } from "react";
import { countdown, fmtFull, nextRace, raceSessions, rc } from "@/src/constants/calendar";
import {
  ACCENT,
  BG_BASE,
  CONTENT_MAX,
  HAIRLINE,
  HERO_GRADIENT,
  MUTED_TEXT,
  PANEL_BG_ALT,
  RADIUS_MD,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
  WARM,
} from "@/src/constants/design";
import { fetchMeetingSessions, fetchRaceSessions } from "@/src/lib/openf1";
import { mapRaceSessionsByCalendar } from "@/src/lib/raceCalendar";
import { pageToHref } from "@/src/shell/routing";
import { IS_SNAPSHOT } from "@/src/lib/runtimeFlags";
import useRaceCalendar from "@/src/lib/useRaceCalendar";
import usePageMetadata from "@/src/lib/usePageMetadata";
import useViewport from "@/src/lib/useViewport";

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
      : session.type === "sprint"
        ? "#A855F7"
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
            background: "rgba(214,223,239,0.12)",
          }}
        />
      )}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 8,
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: active ? ACCENT : PANEL_BG_ALT,
          border: `1.5px solid ${active ? ACCENT : "rgba(214,223,239,0.24)"}`,
          boxShadow: active ? "0 0 0 7px rgba(255,106,26,0.08)" : "none",
        }}
      />
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: labelColor }}>
          {session.label}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: TEXT_PRIMARY }}>{formatSessionSlot(session.date)}</div>
      </div>
    </div>
  );
}

function CountdownCard({ race, cd, accent, schedule, openNextRacePicks, user, demoMode }) {
  const { isMobile } = useViewport();
  return (
    <section className="stint-panel" style={{ overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 84% 18%, rgba(255,194,71,0.08), transparent 36%)" }} />
      <div style={{ height: 4, background: `linear-gradient(90deg,${ACCENT},${accent}, ${WARM})` }} />
      <div style={{ padding: isMobile ? 16 : 24, position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, animation: "pulseDot 2s infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
            Next lock
          </span>
        </div>

        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 0.98, marginBottom: 8 }}>{race.n}</div>
        <div style={{ fontSize: 14, lineHeight: 1.65, color: MUTED_TEXT, marginBottom: 20 }}>
          {race.circuit} · {fmtFull(race.date)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginBottom: 18 }}>
          {[["Days", cd.d], ["Hours", cd.h], ["Minutes", cd.m]].map(([label, value]) => (
            <div
              key={label}
              style={{
                borderRadius: RADIUS_MD,
                background: `linear-gradient(180deg,rgba(255,255,255,0.04),${BG_BASE})`,
                padding: "14px 10px",
                textAlign: "center",
                border: "1px solid rgba(214,223,239,0.08)",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>{String(value).padStart(2, "0")}</div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 6 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        <a
          href={pageToHref(user || demoMode ? "predictions" : "public-picks", { demoMode, raceRound: race?.r })}
          onClick={(event) => {
            event.preventDefault();
            openNextRacePicks();
          }}
          className="stint-button"
          style={{ minHeight: 48, padding: "0 18px", fontSize: 13, marginBottom: 18 }}
        >
          Open picks
        </a>

        <div style={{ paddingTop: 14, borderTop: `1px solid ${HAIRLINE}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 14 }}>
            Weekend timeline
          </div>
          <div>
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
    </section>
  );
}

export default function HomePage({ user, setPage, demoMode = false, openPredictionsForRace, openAuth }) {
  const { isMobile, isTablet } = useViewport();
  const { calendar } = useRaceCalendar(2026);
  const next = nextRace(calendar);
  const cd = next ? countdown(next.date) : null;
  const accent = next ? rc(next) : ACCENT;
  const [liveSchedule, setLiveSchedule] = useState([]);
  const [heroBgLoaded, setHeroBgLoaded] = useState(false);

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
      const raceInfo = mapRaceSessionsByCalendar(calendar, races)[next.r];

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
  }, [calendar, next]);

  const schedule = useMemo(() => {
    if (!next) return [];
    if (liveSchedule.length) return liveSchedule;
    return raceSessions(next).map((session, index) => ({
      ...session,
      key: `${session.label}-${index}`,
      type: session.label === "Race" ? "race" : session.label === "Qualifying" ? "qualifying" : session.label === "Sprint" ? "sprint" : "practice",
    }));
  }, [liveSchedule, next]);

  const openNextRacePicks = () => {
    if (user || demoMode) {
      openPredictionsForRace?.(next?.r);
      return;
    }
    if (openAuth) {
      openAuth("register", { page: "predictions", raceRound: next?.r });
      return;
    }
    setPage("public-picks");
  };

  return (
    <div
      className="stint-page"
      style={{
        maxWidth: CONTENT_MAX,
        paddingBottom: isMobile ? 24 : isTablet ? 28 : 34,
      }}
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.06fr) 430px",
          gap: 24,
          alignItems: "start",
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          padding: isMobile ? "28px 20px 20px" : isTablet ? "32px 28px 36px" : "36px 32px 44px",
        }}
      >
        {/* Hero background photo */}
        <img
          src="/images/Hero-Main.png"
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "right center",
            opacity: isMobile ? 0.38 : 0.58,
            pointerEvents: "none",
            zIndex: 0,
          }}
          onLoad={() => setHeroBgLoaded(true)}
          onError={(e) => { e.target.style.display = "none"; }}
        />
        {/* Gradient overlay — only shown when background photo loads */}
        {heroBgLoaded && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: isTablet
                ? "linear-gradient(to bottom, rgba(10,15,26,0.4) 0%, rgba(10,15,26,0.88) 100%)"
                : "linear-gradient(to right, rgba(10,15,26,0.8) 40%, rgba(10,15,26,0.16) 100%)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}

        <div style={{ display: "grid", gap: 22, paddingTop: 6, position: "relative", zIndex: 1 }}>
          <div className="stint-kicker">STINT</div>

          <div>
            <h1 className="stint-title" style={{ maxWidth: 760, marginBottom: 18 }}>
              Compete hard.
              <br />
              <span style={{ color: TEXT_PRIMARY }}>Predict sharp.</span>
              <br />
              <span style={{ background: HERO_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                Win your league.
              </span>
            </h1>

            <div className="stint-subtitle">
              Compete with sharper picks, cleaner reads, and race-week timing that stays in sync.
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href={pageToHref(user || demoMode ? "predictions" : "public-picks", { demoMode, raceRound: next?.r })}
              onClick={(event) => {
                event.preventDefault();
                openNextRacePicks();
              }}
              className="stint-button"
            >
              {user || demoMode ? "Open picks" : "Create account to make picks"}
            </a>
            <a
              href={pageToHref("calendar", { demoMode })}
              onClick={(event) => {
                event.preventDefault();
                setPage("calendar");
              }}
              className="stint-button-secondary"
            >
              Open race planner
            </a>
          </div>
        </div>

        {/* Right column: hero art + CountdownCard */}
        <div style={{ display: "grid", gap: 16, position: "relative", zIndex: 1 }}>
          {!isMobile && (
            <div>
              <img
                src="/images/hero-art.svg"
                alt=""
                aria-hidden="true"
                style={{
                  width: "100%",
                  maxHeight: isTablet ? 180 : 240,
                  objectFit: "contain",
                  objectPosition: isTablet ? "center" : "right center",
                  display: "block",
                  mixBlendMode: "screen",
                }}
                onError={(e) => {
                  if (!e.target.src.includes("hero-art.png")) {
                    e.target.src = "/images/hero-art.png";
                  } else {
                    e.target.parentElement.style.display = "none";
                  }
                }}
              />
            </div>
          )}
          {next && cd && (
            <CountdownCard
              race={next}
              cd={cd}
              accent={accent}
              schedule={schedule}
              openNextRacePicks={openNextRacePicks}
              user={user}
              demoMode={demoMode}
            />
          )}
        </div>
      </section>

      {/* Atmospheric glow — fills the space below the hero */}
      <div
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(62% 100% at 50% 0%, rgba(255,106,26,0.12) 0%, rgba(59,130,246,0.08) 36%, rgba(6,16,27,0) 78%)",
          height: isMobile ? 28 : isTablet ? 40 : 48,
          marginTop: -6,
          pointerEvents: "none",
          position: "relative",
          zIndex: 0,
        }}
      />

      {isMobile && (
        <div
          style={{
            position: "sticky",
            bottom: 14,
            marginTop: 18,
            zIndex: 5,
          }}
        >
          <a
            href={pageToHref(user || demoMode ? "predictions" : "public-picks", { demoMode, raceRound: next?.r })}
            onClick={(event) => {
              event.preventDefault();
              openNextRacePicks();
            }}
            className="stint-button"
            style={{ width: "100%" }}
          >
            {user || demoMode ? "Open picks" : "Create account to make picks"}
          </a>
        </div>
      )}
    </div>
  );
}
