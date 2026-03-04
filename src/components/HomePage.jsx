import { useEffect, useMemo, useState } from "react";
import { countdown, fmtFull, nextRace, raceSessions, rc } from "../constants/calendar";
import {
  BRAND_GRADIENT,
  CARD_RADIUS,
  CONTENT_MAX,
  EDGE_RING,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
} from "../constants/design";
import { fetchMeetingSessions, fetchRaceSessions } from "../openf1";
import BrandMark from "./BrandMark";
import useViewport from "../useViewport";

const homeSessionMeta = {
  "Practice 1": { label: "FP1" },
  "Practice 2": { label: "FP2" },
  "Practice 3": { label: "FP3" },
  "Sprint Qualifying": { label: "Sprint Qualy" },
  "Sprint": { label: "Sprint" },
  "Qualifying": { label: "Qualifying" },
  "Race": { label: "Race" },
};

function normalizeLiveSession(session) {
  const meta = homeSessionMeta[session.session_name];
  if (!meta) return null;
  return {
    key: `${session.session_key}-${session.session_name}`,
    label: meta.label,
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

function fallbackSessionSlot(value) {
  return `${fmtFull(value)} · Time pending`;
}

function SessionMini({ label, date, accent, live = false }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "70px minmax(0,1fr)", gap: 10, padding: "10px 0", borderBottom: `1px solid ${HAIRLINE}` }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: accent }}>{label}</div>
      <div style={{ fontSize: 12.5, color: "#dbe4f0", fontWeight: 700 }}>{live ? formatSessionSlot(date) : fallbackSessionSlot(date)}</div>
    </div>
  );
}

export default function HomePage({ setPage }) {
  const { isMobile, isTablet } = useViewport();
  const next = nextRace();
  const cd = next ? countdown(next.date) : null;
  const accent = next ? rc(next) : "#f97316";
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
      if (ignore) return;
      setLiveSchedule(sessions.map(normalizeLiveSession).filter(Boolean));
    }

    loadLiveSchedule();
    return () => {
      ignore = true;
    };
  }, [next]);

  const schedule = useMemo(() => {
    if (!next) return [];
    if (liveSchedule.length) return liveSchedule;
    return raceSessions(next).map((session) => ({ ...session, hasLiveTime: false }));
  }, [liveSchedule, next]);

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 82px" : "42px 28px 92px", position: "relative", zIndex: 1 }}>
      <section style={{ minHeight: "calc(100vh - 150px)", display: "grid", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.14fr) 360px", gap: 18, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", boxShadow: EDGE_RING, marginBottom: 24 }}>
              <BrandMark size={20} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#dbe4f0" }}>
                Apex Fantasy
              </span>
            </div>

            <h1 style={{ fontSize: isMobile ? 56 : isTablet ? 74 : 96, lineHeight: 0.87, margin: "0 0 18px", letterSpacing: isMobile ? -2.6 : isTablet ? -3.8 : -5.2, maxWidth: 860 }}>
              Compete hard.
              <br />
              Predict sharp.
              <br />
              Win your league.
            </h1>

            <div style={{ maxWidth: 620, fontSize: isMobile ? 14 : 17, lineHeight: 1.9, color: MUTED_TEXT, marginBottom: 30 }}>
              Build your board with live schedule context, race-week news and AI Insight. Every category matters, and better reads should translate into league wins.
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button
                onClick={() => setPage("predictions")}
                style={{
                  minWidth: 220,
                  background: BRAND_GRADIENT,
                  border: "none",
                  borderRadius: 20,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 800,
                  padding: "17px 22px",
                  boxShadow: "0 18px 42px rgba(249,115,22,0.18)",
                }}
              >
                Open Predictions
              </button>
              <button
                onClick={() => setPage("calendar")}
                style={{
                  minWidth: 194,
                  background: PANEL_BG,
                  border: "1px solid rgba(148,163,184,0.18)",
                  borderRadius: 20,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 700,
                  padding: "17px 22px",
                  boxShadow: SOFT_SHADOW,
                }}
              >
                View Calendar
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {next && cd && (
              <section style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: `linear-gradient(180deg,${accent}10,#08111d 24%,#07101b)`, overflow: "hidden", boxShadow: LIFTED_SHADOW }}>
                <div style={{ height: 3, background: `linear-gradient(90deg,${accent},rgba(248,250,252,0.92))` }} />
                <div style={{ padding: "20px 22px 18px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>
                    Next race
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 0.95, letterSpacing: -1.2, marginBottom: 6 }}>{next.n}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.72, color: MUTED_TEXT, marginBottom: 16 }}>
                    {next.circuit} · {fmtFull(next.date)}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginBottom: 16 }}>
                    {[["Days", cd.d], ["Hours", cd.h], ["Minutes", cd.m]].map(([label, value]) => (
                      <div key={label} style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG, padding: "15px 10px 13px", textAlign: "center", boxShadow: EDGE_RING }}>
                        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>{String(value).padStart(2, "0")}</div>
                        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 7 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.75, color: MUTED_TEXT }}>
                    Picks close right before qualifying begins.
                  </div>
                </div>
              </section>
            )}

            {next && (
              <section style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                    Weekend schedule
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>Every session, race-week timing</div>
                </div>
                <div style={{ padding: "0 18px 4px" }}>
                  {schedule.map((session) => (
                    <SessionMini key={`${session.label}-${session.date}`} label={session.label} date={session.date} accent={accent} live={session.hasLiveTime} />
                  ))}
                </div>
                <div style={{ padding: "0 18px 14px", fontSize: 11, color: SUBTLE_TEXT }}>
                  Times follow the same timezone-adjusted schedule shown in Calendar.
                </div>
              </section>
            )}
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2,minmax(0,1fr))" : "repeat(3,minmax(0,1fr))", gap: 14 }}>
        {[
          ["Read", "Use News and AI Insight to turn race-week information into cleaner decisions before lock."],
          ["Predict", "The board is category-based, so a strong weekend comes from structure, not one lucky call."],
          ["Compete", "Private leagues and the global table make every round feel like pressure, not passive play."],
        ].map(([title, copy]) => (
          <div key={title} style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: "20px 20px 18px", boxShadow: SOFT_SHADOW }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.6, marginBottom: 8 }}>{title} the weekend.</div>
            <div style={{ fontSize: 13, lineHeight: 1.82, color: MUTED_TEXT }}>{copy}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
