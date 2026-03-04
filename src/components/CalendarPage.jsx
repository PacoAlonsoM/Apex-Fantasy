import { useEffect, useMemo, useState } from "react";
import { CAL, fmtFull, monthLabel, nextRace, raceSessions, rc } from "../constants/calendar";
import { fetchMeetingSessions, fetchRaceSessions } from "../openf1";
import {
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
import useViewport from "../useViewport";

const sessionTone = {
  practice: { bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.22)", color: "#7dd3fc" },
  qualifying: { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.24)", color: "#fdba74" },
  sprint: { bg: "rgba(250,204,21,0.12)", border: "rgba(250,204,21,0.22)", color: "#fde68a" },
  race: { bg: "rgba(45,212,191,0.12)", border: "rgba(45,212,191,0.22)", color: "#99f6e4" },
};

const sessionMeta = {
  "Practice 1": { label: "FP1", tone: "practice" },
  "Practice 2": { label: "FP2", tone: "practice" },
  "Practice 3": { label: "FP3", tone: "practice" },
  "Sprint Qualifying": { label: "Sprint Qualy", tone: "qualifying" },
  "Qualifying": { label: "Qualifying", tone: "qualifying" },
  "Sprint": { label: "Sprint", tone: "sprint" },
  "Race": { label: "Race", tone: "race" },
};

function normalizeLiveSession(session) {
  const meta = sessionMeta[session.session_name];
  if (!meta) return null;
  return {
    ...meta,
    key: `${session.session_name}-${session.session_key}`,
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
    .sort((a, b) => a - b);

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
  if (!range) return "Weekend schedule pending";
  return formatEventRange(range);
}

function SessionTimelineCard({ session, index, total }) {
  const tone = sessionTone[session.tone];
  const showConnector = index < total - 1;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "20px minmax(0,1fr)", gap: 12, alignItems: "start" }}>
      <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: tone.color, boxShadow: `0 0 0 6px ${tone.bg}`, marginTop: 7, zIndex: 1 }} />
        {showConnector && <span style={{ position: "absolute", top: 18, width: 1, bottom: -14, background: "rgba(148,163,184,0.16)" }} />}
      </div>
      <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "11px 12px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 999, padding: "4px 7px" }}>
            {session.label}
          </span>
          <span style={{ fontSize: 11, color: SUBTLE_TEXT }}>{index + 1} / {total}</span>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{formatLocalDateTime(session.date)}</div>
      </div>
    </div>
  );
}

function RaceRow({ race, active, liveSessions, onSelect, compact = false }) {
  const accent = rc(race);

  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 18,
        border: active ? `1px solid ${accent}28` : "1px solid rgba(148,163,184,0.12)",
        background: active ? `linear-gradient(180deg,${accent}10,#0e1727)` : PANEL_BG,
        cursor: "pointer",
        padding: 0,
        overflow: "hidden",
        boxShadow: active ? `0 18px 36px ${accent}10` : "none",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: compact ? "76px minmax(0,1fr)" : "76px minmax(0,1fr) 132px 84px", alignItems: "center" }}>
        <div style={{ padding: "8px 8px 8px 9px", borderRight: `1px solid ${HAIRLINE}` }}>
          <div style={{ borderRadius: 14, border: active ? "1px solid rgba(248,250,252,0.08)" : "1px solid rgba(148,163,184,0.1)", background: active ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? accent : "rgba(148,163,184,0.5)", boxShadow: active ? `0 0 0 5px ${accent}14` : "none" }} />
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Round</div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.8 }}>R{race.r}</div>
          </div>
        </div>

        <div style={{ padding: "13px 15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{race.n}</span>
            {race.sprint && (
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#fde68a", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.22)", borderRadius: 999, padding: "3px 7px" }}>
                Sprint
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: MUTED_TEXT }}>{race.city}, {race.cc}</div>
        </div>

        {compact ? (
          <div style={{ padding: "0 15px 12px", gridColumn: "2 / 3" }}>
            <div style={{ fontSize: 10.5, color: MUTED_TEXT, marginBottom: 7 }}>{formatEventWindowLabel(race, liveSessions)}</div>
            <span style={{ fontSize: 10, fontWeight: 800, color: race.type === "Street" ? "#fde68a" : "#99f6e4", background: race.type === "Street" ? "rgba(250,204,21,0.12)" : "rgba(45,212,191,0.12)", border: `1px solid ${race.type === "Street" ? "rgba(250,204,21,0.22)" : "rgba(45,212,191,0.22)"}`, borderRadius: 999, padding: "5px 9px" }}>
              {race.type}
            </span>
          </div>
        ) : (
          <>
            <div style={{ padding: "13px 12px", borderLeft: `1px solid ${HAIRLINE}`, textAlign: "center", fontSize: 11, fontWeight: 700, color: MUTED_TEXT, lineHeight: 1.4 }}>
              {formatEventWindowLabel(race, liveSessions)}
            </div>

            <div style={{ padding: "13px 10px", borderLeft: `1px solid ${HAIRLINE}`, display: "flex", justifyContent: "center" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: race.type === "Street" ? "#fde68a" : "#99f6e4", background: race.type === "Street" ? "rgba(250,204,21,0.12)" : "rgba(45,212,191,0.12)", border: `1px solid ${race.type === "Street" ? "rgba(250,204,21,0.22)" : "rgba(45,212,191,0.22)"}`, borderRadius: 999, padding: "5px 9px" }}>
                {race.type}
              </span>
            </div>
          </>
        )}
      </div>
    </button>
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
    if (sel && !filtered.find((race) => race.r === sel.r)) setSel(filtered[0] || null);
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
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    const raceInfo = sel ? liveRaces[sel.r] : null;

    async function loadMeetingSchedule() {
      if (!sel || !raceInfo?.meeting_key || liveMeetings[sel.r]) return;
      const sessions = await fetchMeetingSessions(raceInfo.meeting_key);
      if (ignore || !sessions.length) return;

      const normalized = sessions.map(normalizeLiveSession).filter(Boolean);
      setLiveMeetings((prev) => ({ ...prev, [sel.r]: normalized }));
    }

    loadMeetingSchedule();
    return () => { ignore = true; };
  }, [sel, liveRaces, liveMeetings]);

  const months = filtered.reduce((acc, race) => {
    const label = monthLabel(race.date);
    if (!acc[label]) acc[label] = [];
    acc[label].push(race);
    return acc;
  }, {});

  const sessions = sel
    ? (liveMeetings[sel.r]?.length ? liveMeetings[sel.r] : raceSessions(sel).map((session) => ({ ...session })))
    : [];

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const selectedEventWindow = sel ? formatEventWindowLabel(sel, liveMeetings[sel.r]) : null;

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 78px" : "36px 28px 82px", position: "relative", zIndex: 1 }}>
      <section style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: "linear-gradient(180deg,rgba(10,18,32,0.94),rgba(7,16,27,0.98) 28%)", padding: isMobile ? "22px 18px 18px" : "28px 30px 24px", marginBottom: 16, boxShadow: LIFTED_SHADOW, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: -80, right: -40, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(45,212,191,0.08), transparent 70%)" }} />
          <div style={{ position: "absolute", left: 120, bottom: -120, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.08), transparent 70%)" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.2fr) 330px", gap: 18, alignItems: "start", position: "relative", zIndex: 1 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 11px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", boxShadow: EDGE_RING, marginBottom: 18 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#7dd3fc" }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#cbd5e1" }}>2026 calendar</span>
            </div>

            <h1 style={{ fontSize: isMobile ? 40 : 58, lineHeight: 0.95, margin: "0 0 12px", letterSpacing: isMobile ? -1.6 : -2.8 }}>
              See the season as
              <br />
              one operating timeline.
            </h1>
            <p style={{ margin: 0, fontSize: isMobile ? 13 : 15, lineHeight: 1.8, color: MUTED_TEXT, maxWidth: 620 }}>
              Pick any Grand Prix to open the weekend sequence, local session timing and circuit profile. The list on the left keeps the season readable; the detail rail on the right gives you the actual race-week structure.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
            {[
              ["24", "rounds"],
              [String(CAL.filter((race) => race.sprint).length), "sprints"],
              [timezone.split("/").pop()?.replaceAll("_", " ") || "local", "timezone"],
            ].map(([value, label]) => (
              <div key={label} style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: "rgba(255,255,255,0.02)", boxShadow: EDGE_RING, padding: "14px 15px 13px" }}>
                <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.8 }}>{value}</div>
                <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 16, position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["all", "All races"], ["sprint", "Sprint weekends"], ["Street", "Street"], ["Permanent", "Permanent"]].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilt(value)}
                style={{
                  background: filt === value ? "linear-gradient(180deg,rgba(255,255,255,0.08),#111c30)" : "#101a2d",
                  border: filt === value ? "1px solid rgba(248,250,252,0.16)" : "1px solid rgba(148,163,184,0.12)",
                  borderRadius: 999,
                  color: filt === value ? "#fff" : MUTED_TEXT,
                  cursor: "pointer",
                  fontWeight: 700,
                  padding: "9px 13px",
                  fontSize: 12,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: SUBTLE_TEXT }}>
            Session times shown in <span style={{ color: "#fff", fontWeight: 700 }}>{timezone}</span>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) 430px", gap: 16, alignItems: "start" }}>
        <div>
          {Object.entries(months).map(([month, races]) => (
            <div key={month} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
                {month}
              </div>
              <div style={{ display: "grid", gap: 9 }}>
                {races.map((race) => (
                  <RaceRow
                    key={race.r}
                    race={race}
                    active={sel?.r === race.r}
                    liveSessions={liveMeetings[race.r]}
                    compact={isMobile}
                    onSelect={() => setSel(race)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {sel && (
          <aside style={{ position: isTablet ? "relative" : "sticky", top: isTablet ? "auto" : 84 }}>
            <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
              <div style={{ height: 4, background: `linear-gradient(90deg,${rc(sel)},rgba(248,250,252,0.92))` }} />

              <div style={{ padding: "18px 20px 16px", borderBottom: `1px solid ${HAIRLINE}`, background: "linear-gradient(180deg,rgba(255,255,255,0.02),rgba(15,24,44,0.98))" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                      Round {sel.r} of 24
                    </div>
                    <h2 style={{ margin: "0 0 4px", fontWeight: 900, fontSize: 24, letterSpacing: -0.9 }}>{sel.n}</h2>
                    <div style={{ fontSize: 12, color: MUTED_TEXT }}>{sel.city}, {sel.cc}</div>
                  </div>
                  <button onClick={() => setSel(null)} style={{ width: 30, height: 30, borderRadius: 10, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, color: MUTED_TEXT, cursor: "pointer" }}>
                    ✕
                  </button>
                </div>

                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#dbe4f0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "5px 9px" }}>
                    {selectedEventWindow}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: MUTED_TEXT, background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 999, padding: "5px 9px" }}>
                    {timezone}
                  </span>
                  {sel.sprint && (
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#fde68a", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.22)", borderRadius: 999, padding: "5px 9px" }}>
                      Sprint weekend
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
                  Weekend rhythm
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {sessions.map((session, index) => (
                    <SessionTimelineCard key={session.key} session={session} index={index} total={sessions.length} />
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: HAIRLINE }}>
                {[
                  ["Track", `${sel.len} km · ${sel.laps} laps`],
                  ["Race dist.", `${(sel.len * sel.laps).toFixed(1)} km`],
                  ["Circuit", `${sel.turns} turns · ${sel.drs} DRS`],
                  ["Lap record", sel.rec],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: "13px 13px 12px", background: PANEL_BG_ALT }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.45 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "14px 18px 16px", background: PANEL_BG }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>
                  Use this panel for
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.72, color: MUTED_TEXT }}>
                  Race-week planning, prediction timing, and session order checks before you move into the predictions board.
                </div>
              </div>
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
