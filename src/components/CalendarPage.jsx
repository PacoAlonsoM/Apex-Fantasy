import { useEffect, useMemo, useState } from "react";
import { CAL, fmtFull, monthLabel, nextRace, raceSessions, rc } from "../constants/calendar";
import { fetchMeetingSessions, fetchRaceSessions } from "../openf1";
import {
  ACCENT,
  CARD_RADIUS,
  CONTENT_MAX,
  HAIRLINE,
  INFO,
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
import useViewport from "../useViewport";

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
    <div style={{ borderRadius: RADIUS_MD, background: PANEL_BG, padding: "16px 18px", boxShadow: SOFT_SHADOW }}>
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
        border: active ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.06)",
        background: active ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
        color: active ? ACCENT : MUTED_TEXT,
        fontSize: 13,
        fontWeight: 500,
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
        gridTemplateColumns: "60px minmax(0,1fr) auto auto",
        gap: 16,
        alignItems: "center",
        border: "none",
        borderRadius: RADIUS_MD,
        background: active ? PANEL_BG_ALT : PANEL_BG,
        boxShadow: active ? `inset 3px 0 0 ${ACCENT}` : "none",
        padding: "16px 20px",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: active ? TEXT_PRIMARY : SUBTLE_TEXT }}>
        R{race.r}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 4 }}>{race.n}</div>
        <div style={{ fontSize: 13, color: SUBTLE_TEXT }}>{race.city}, {race.cc}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span
          style={{
            borderRadius: 999,
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            background: race.sprint ? "rgba(168,85,247,0.12)" : "rgba(59,130,246,0.12)",
            color: race.sprint ? SPRINT : INFO,
          }}
        >
          {race.sprint ? "Sprint" : race.type}
        </span>
      </div>
      <div style={{ fontSize: 13, color: MUTED_TEXT, whiteSpace: "nowrap" }}>{formatEventWindowLabel(race, liveSessions)}</div>
    </button>
  );
}

function SessionTimeline({ sessions }) {
  return (
    <div style={{ position: "relative", paddingLeft: 20 }}>
      <span style={{ position: "absolute", left: 3, top: 8, bottom: 8, width: 1, background: "rgba(255,255,255,0.12)" }} />
      <div style={{ display: "grid", gap: 18 }}>
        {sessions.map((session, index) => {
          const tone = session.type === "race" ? "#EF4444" : session.type === "qualifying" ? ACCENT : session.type === "sprint" ? SPRINT : SUBTLE_TEXT;

          return (
            <div key={session.key || `${session.label}-${index}`} style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: -20,
                  top: 6,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: tone,
                  border: `1px solid ${tone}`,
                  boxShadow: tone === ACCENT ? "0 0 0 6px rgba(249,115,22,0.08)" : "none",
                }}
              />
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: tone, marginBottom: 4 }}>
                {session.label}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_PRIMARY }}>{formatLocalDateTime(session.date)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { isMobile, isTablet } = useViewport();
  const [sel, setSel] = useState(nextRace() || CAL[0]);
  const [filt, setFilt] = useState("all");
  const [liveRaces, setLiveRaces] = useState({});
  const [liveMeetings, setLiveMeetings] = useState({});

  const filtered = useMemo(() => {
    if (filt === "all") return CAL;
    if (filt === "sprint") return CAL.filter((race) => race.sprint);
    return CAL.filter((race) => race.type.toLowerCase() === filt.toLowerCase());
  }, [filt]);

  useEffect(() => {
    if (sel && !filtered.find((race) => race.r === sel.r)) {
      setSel(filtered[0] || null);
    }
  }, [filtered, sel]);

  useEffect(() => {
    let ignore = false;

    async function loadSeasonSchedule() {
      const sessions = await fetchRaceSessions(2026);
      if (ignore || !sessions.length) return;

      const mapped = {};
      sessions.slice(0, CAL.length).forEach((session, index) => {
        mapped[CAL[index].r] = session;
      });
      setLiveRaces(mapped);
    }

    loadSeasonSchedule();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const raceInfo = sel ? liveRaces[sel.r] : null;

    async function loadMeetingSchedule() {
      if (!sel || !raceInfo?.meeting_key || liveMeetings[sel.r]) return;
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

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const selectedEventWindow = sel ? formatEventWindowLabel(sel, liveMeetings[sel.r]) : "";

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: isMobile ? "40px 20px 72px" : isTablet ? "48px 32px 88px" : "56px 48px 96px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <section style={{ marginBottom: 40 }}>
        <div style={{ maxWidth: 560, marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
            2026 Calendar
          </div>
          <h1 style={{ fontSize: isMobile ? 40 : 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 16 }}>
            Read the season as one race-week system.
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: MUTED_TEXT }}>
            Open any Grand Prix to see the exact session order, timezone-adjusted timing, and the track context you need before moving into Picks.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 16, marginBottom: 32 }}>
          <StatBox value="24" label="Rounds" />
          <StatBox value={String(CAL.filter((race) => race.sprint).length)} label="Sprints" />
          <StatBox value={timezone.split("/").pop()?.replaceAll("_", " ") || "Local"} label="Timezone" />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["all", "All races"], ["sprint", "Sprint weekends"], ["Street", "Street"], ["Permanent", "Permanent"]].map(([value, label]) => (
            <FilterButton key={value} active={filt === value} label={label} onClick={() => setFilt(value)} />
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) 400px", gap: 24, alignItems: "start" }}>
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
          <aside style={{ position: isTablet ? "relative" : "sticky", top: 96 }}>
            <div style={{ borderRadius: SECTION_RADIUS, background: PANEL_BG, boxShadow: LIFTED_SHADOW, overflow: "hidden" }}>
              <div style={{ height: 3, background: `linear-gradient(90deg,${ACCENT},${rc(sel)}, transparent)` }} />
              <div style={{ padding: 24, borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                  Round {sel.r}
                </div>
                <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 8 }}>
                  {sel.n}
                </h2>
                <div style={{ fontSize: 16, lineHeight: 1.6, color: MUTED_TEXT, marginBottom: 16 }}>
                  {sel.city}, {sel.cc}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(255,255,255,0.06)", color: TEXT_PRIMARY }}>
                    {selectedEventWindow}
                  </span>
                  {sel.sprint && (
                    <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(168,85,247,0.12)", color: SPRINT }}>
                      Sprint weekend
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding: 24, borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 20 }}>
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
                  <div key={label} style={{ background: PANEL_BG_ALT, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_PRIMARY }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: MUTED_TEXT }}>
                  Session times here follow the same timezone-adjusted schedule used throughout the product.
                </div>
              </div>
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
