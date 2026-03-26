import { useEffect, useMemo, useState } from "react";
import { monthLabel, nextRace, raceSessions, rc } from "../constants/calendar";
import { fetchMeetingSessions, fetchRaceSessions } from "../openf1";
import { getRaceDisplayRound, mapRaceSessionsByCalendar } from "../raceCalendar";
import {
  ACCENT,
  CONTENT_MAX,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  RADIUS_MD,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SPRINT,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
} from "../constants/design";
import { IS_SNAPSHOT } from "../runtimeFlags";
import { getViewerTimeZoneLabel } from "../timezone";
import useRaceCalendar from "../useRaceCalendar";
import usePageMetadata from "../usePageMetadata";
import useViewport from "../useViewport";
import PageHeader from "./PageHeader";

const sessionMeta = {
  "Practice 1": { label: "FP1", type: "practice" },
  "Practice 2": { label: "FP2", type: "practice" },
  "Practice 3": { label: "FP3", type: "practice" },
  "Sprint Qualifying": { label: "Sprint Qualifying", type: "qualifying" },
  Qualifying: { label: "Qualifying", type: "qualifying" },
  Sprint: { label: "Sprint", type: "sprint" },
  Race: { label: "Race", type: "race" },
};

function normalizeLiveSession(session) {
  const meta = sessionMeta[session.session_name];
  if (!meta) return null;
  return {
    ...meta,
    key: `${session.session_key}-${session.session_name}`,
    date: session.date_start,
  };
}

function formatLocalDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getEventWindow(race, liveSessions) {
  const source = liveSessions?.length ? liveSessions.map((session) => session.date) : raceSessions(race).map((session) => session.date);
  const dates = source
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left - right);

  if (!dates.length) return null;
  return { start: dates[0], end: dates[dates.length - 1] };
}

function formatEventRange(range) {
  if (!range) return "";

  const start = range.start;
  const end = range.end;
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${start.toLocaleDateString(undefined, { month: "long" })} ${start.getDate()}-${end.getDate()}`;
  }

  if (sameYear) {
    return `${start.toLocaleDateString(undefined, { month: "long", day: "numeric" })}-${end.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
  }

  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}-${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatEventWindowLabel(race, liveSessions) {
  const range = getEventWindow(race, liveSessions);
  return range ? formatEventRange(range) : "Weekend schedule pending";
}

function StatBox({ value, label }) {
  return (
    <div style={{ borderRadius: RADIUS_MD, background: "linear-gradient(180deg,rgba(255,255,255,0.03),rgba(14,25,41,0.98))", padding: "16px 18px", boxShadow: SOFT_SHADOW, border: "1px solid rgba(214,223,239,0.08)" }}>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
}

function FilterButton({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: 38,
        padding: "0 18px",
        borderRadius: 999,
        border: active ? "1px solid rgba(255,106,26,0.32)" : "1px solid rgba(214,223,239,0.08)",
        background: active ? "rgba(255,106,26,0.16)" : "rgba(255,255,255,0.03)",
        color: active ? ACCENT : MUTED_TEXT,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function RaceRow({ race, active, liveSessions, onSelect }) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "60px minmax(0,1fr) auto",
        gap: 16,
        alignItems: "center",
        border: "none",
        borderRadius: RADIUS_MD,
        background: active ? "linear-gradient(180deg,rgba(255,255,255,0.03),rgba(21,35,56,0.98))" : PANEL_BG,
        border: active ? "1px solid rgba(255,106,26,0.16)" : "1px solid rgba(214,223,239,0.06)",
        boxShadow: active ? `0 20px 40px rgba(255,106,26,0.08), inset 3px 0 0 ${ACCENT}` : "inset 0 1px 0 rgba(255,255,255,0.03)",
        padding: "16px 20px",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
        <img
          src={`/images/flags/${encodeURIComponent(race.flagKey)}.png`}
          alt={race.cc}
          style={{ width: 48, height: 32, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)" }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.02em", color: active ? TEXT_PRIMARY : SUBTLE_TEXT }}>
          R{getRaceDisplayRound(race) || race.r}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 4 }}>{race.n}</div>
        <div style={{ fontSize: 13, color: SUBTLE_TEXT }}>{race.city}, {race.cc}</div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
        {race.sprint && (
          <span
            style={{
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              background: "rgba(168,85,247,0.12)",
              color: SPRINT,
            }}
          >
            Sprint
          </span>
        )}
        <span style={{ fontSize: 13, color: MUTED_TEXT, whiteSpace: "nowrap" }}>{formatEventWindowLabel(race, liveSessions)}</span>
      </div>
    </button>
  );
}

function SessionTimeline({ sessions }) {
  return (
    <div style={{ position: "relative", paddingLeft: 18 }}>
      <span style={{ position: "absolute", left: 3, top: 7, bottom: 7, width: 1, background: "rgba(255,255,255,0.12)" }} />
      <div style={{ display: "grid", gap: 12 }}>
        {sessions.map((session, index) => {
          const tone = session.type === "race" ? "#EF4444" : session.type === "qualifying" ? ACCENT : session.type === "sprint" ? SPRINT : SUBTLE_TEXT;

          return (
            <div key={session.key || `${session.label}-${index}`} style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: -18,
                  top: 4,
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: tone,
                  border: `1px solid ${tone}`,
                  boxShadow: tone === ACCENT ? "0 0 0 6px rgba(249,115,22,0.08)" : "none",
                }}
              />
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: tone, marginBottom: 2 }}>
                {session.label}
              </div>
              <div style={{ fontSize: 11, lineHeight: 1.4, color: TEXT_PRIMARY }}>{formatLocalDateTime(session.date)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage({ user, openAuth, openPredictionsForRace }) {
  const { isMobile, isTablet } = useViewport();
  const { calendar } = useRaceCalendar(2026);
  const [sel, setSel] = useState(null);
  const [filt, setFilt] = useState("all");
  const [liveRaces, setLiveRaces] = useState({});
  const [liveMeetings, setLiveMeetings] = useState({});

  usePageMetadata({
    title: "2026 F1 Calendar",
    description: "Read the 2026 Formula 1 season as one race-week system with session timing, timezone-adjusted schedules and track context for every round.",
    path: "/calendar",
  });

  const filtered = useMemo(() => {
    if (filt === "all") return calendar;
    if (filt === "sprint") return calendar.filter((race) => race.sprint);
    return calendar.filter((race) => race.type.toLowerCase() === filt.toLowerCase());
  }, [calendar, filt]);

  useEffect(() => {
    if (!calendar.length) {
      setSel(null);
      return;
    }

    setSel((current) => {
      if (current) {
        const updated = calendar.find((race) => race.r === current.r);
        if (updated) return updated;
      }
      return nextRace(calendar) || calendar[0] || null;
    });
  }, [calendar]);

  useEffect(() => {
    if (sel && !filtered.find((race) => race.r === sel.r)) {
      setSel(filtered[0] || null);
    }
  }, [filtered, sel]);

  useEffect(() => {
    let ignore = false;

    async function loadSeasonSchedule() {
      if (IS_SNAPSHOT) return;
      const sessions = await fetchRaceSessions(2026);
      if (ignore || !sessions.length) return;

      setLiveRaces(mapRaceSessionsByCalendar(calendar, sessions));
    }

    loadSeasonSchedule();
    return () => {
      ignore = true;
    };
  }, [calendar]);

  useEffect(() => {
    let ignore = false;
    const raceInfo = sel ? liveRaces[sel.r] : null;

    async function loadMeetingSchedule() {
      if (IS_SNAPSHOT || !sel || !raceInfo?.meeting_key || liveMeetings[sel.r]) return;
      const sessions = await fetchMeetingSessions(raceInfo.meeting_key);
      if (ignore || !sessions.length) return;
      setLiveMeetings((current) => ({
        ...current,
        [sel.r]: sessions.map(normalizeLiveSession).filter(Boolean),
      }));
    }

    loadMeetingSchedule();
    return () => {
      ignore = true;
    };
  }, [sel, liveMeetings, liveRaces]);

  const months = filtered.reduce((accumulator, race) => {
    const label = monthLabel(race.date);
    if (!accumulator[label]) accumulator[label] = [];
    accumulator[label].push(race);
    return accumulator;
  }, {});

  const sessions = sel
    ? (liveMeetings[sel.r]?.length ? liveMeetings[sel.r] : raceSessions(sel).map((session, index) => ({
      ...session,
      key: `${session.label}-${index}`,
      type: session.label === "Race" ? "race" : session.label === "Qualifying" ? "qualifying" : session.label === "Sprint" ? "sprint" : "practice",
    })))
    : [];

  const timezone = getViewerTimeZoneLabel();
  const selectedEventWindow = sel ? formatEventWindowLabel(sel, liveMeetings[sel.r]) : "";
  const handleOpenPicks = () => {
    if (!sel) return;
    if (user) {
      openPredictionsForRace?.(sel.r);
      return;
    }
    openAuth?.("login", { page: "predictions", raceRound: sel.r });
  };

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: isMobile ? "32px 20px 72px" : isTablet ? "40px 32px 88px" : "42px 48px 96px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <PageHeader
        eyebrow="Calendar"
        title="Read the season as one race-week system."
        description="Pick a Grand Prix to see the session order, local timing, and jump straight into that weekend's board."
        aside={<StatBox value={timezone} label="Timezone" />}
        marginBottom={18}
        bgImage="/images/header-calendar.png"
      />

      <section style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["all", "All races"], ["sprint", "Sprint weekends"]].map(([value, label]) => (
            <FilterButton key={value} active={filt === value} label={label} onClick={() => setFilt(value)} />
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) 620px", gap: 20, alignItems: "start" }}>
        <div>
          {Object.entries(months).map(([month, races]) => (
            <div key={month} style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
                {month}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {races.map((race) => (
                  <RaceRow
                    key={race.r}
                    race={race}
                    active={sel?.r === race.r}
                    liveSessions={liveMeetings[race.r]}
                    onSelect={() => setSel(race)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {sel && (
          <aside style={{ position: isTablet ? "relative" : "sticky", top: isTablet ? "auto" : 118 }}>
            <div style={{ borderRadius: SECTION_RADIUS, background: PANEL_BG, boxShadow: LIFTED_SHADOW, overflow: "hidden", border: "1px solid rgba(214,223,239,0.08)" }}>
              <div style={{ height: 3, background: `linear-gradient(90deg,${ACCENT},${rc(sel)}, transparent)` }} />
              {/* Circuit illustration / photo — hidden until image loads */}
              <div style={{ position: "relative", height: 200, overflow: "hidden", background: "rgba(6,16,27,0.6)", display: "none" }}>
                <img
                  src={`/images/circuits/${sel.slug}.svg`}
                  alt=""
                  aria-hidden="true"
                  style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", padding: "20px", boxSizing: "border-box" }}
                  onLoad={(e) => { e.target.parentElement.style.display = ""; }}
                  onError={(e) => {
                    if (!e.target.src.includes(".jpg")) {
                      e.target.src = `/images/circuits/${sel.slug}.jpg`;
                      e.target.style.objectFit = "cover";
                      e.target.style.padding = "0";
                    } else {
                      e.target.parentElement.style.display = "none";
                    }
                  }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(6,16,27,0.75) 100%)", pointerEvents: "none" }} />
              </div>
              <div style={{ padding: 26, borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.02, marginBottom: 8 }}>
                  {sel.n}
                </h2>
                <div style={{ fontSize: 15, lineHeight: 1.55, color: MUTED_TEXT, marginBottom: 16 }}>
                  {sel.city}, {sel.cc}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ borderRadius: 999, padding: "6px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(255,255,255,0.06)", color: TEXT_PRIMARY }}>
                    {selectedEventWindow}
                  </span>
                  {sel.sprint && (
                    <span style={{ borderRadius: 999, padding: "6px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(168,85,247,0.12)", color: SPRINT }}>
                      Sprint weekend
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding: 24, borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 16 }}>
                  Weekend timeline
                </div>
                <SessionTimeline sessions={sessions} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: HAIRLINE }}>
                {[
                  ["Track", `${sel.len} km · ${sel.laps} laps`],
                  ["Race distance", `${(sel.len * sel.laps).toFixed(1)} km`],
                  ["Circuit", `${sel.turns} turns · ${sel.drs} DRS`],
                  ["Lap record", sel.rec],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: PANEL_BG_ALT, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.45, color: TEXT_PRIMARY }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: 16 }}>
                <button onClick={handleOpenPicks} className="stint-button" style={{ width: "100%", minHeight: 50, fontSize: 14 }}>
                  Open picks
                </button>
              </div>
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
