import { useEffect, useMemo, useState } from "react";
import { CAL, fmtFull, monthLabel, nextRace, raceSessions, rc } from "../constants/calendar";
import { fetchMeetingSessions, fetchRaceSessions } from "../openf1";
import { PANEL_BG, PANEL_BG_ALT, PANEL_BORDER, MUTED_TEXT, SUBTLE_TEXT, HAIRLINE } from "../constants/design";

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

export default function CalendarPage() {
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
    <div style={{ maxWidth: 1220, margin: "0 auto", padding: "40px 28px 80px", position: "relative", zIndex: 1 }}>
      <section style={{ borderRadius: 24, border: PANEL_BORDER, background: PANEL_BG, padding: "22px 24px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: "#101a2d", border: "1px solid rgba(148,163,184,0.14)", marginBottom: 14 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--team-accent)" }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#cbd5e1" }}>2026 calendar</span>
            </div>
            <h1 style={{ fontSize: 42, lineHeight: 1, margin: "0 0 10px", letterSpacing: -2 }}>
              Every Grand Prix weekend.
              <br />
              Every session, in your local time.
            </h1>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.68, color: MUTED_TEXT }}>
              Choose a round to see the full session schedule.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,112px))", gap: 10 }}>
            {[
              ["24", "rounds"],
              [String(CAL.filter((race) => race.sprint).length), "sprints"],
              [timezone.split("/").pop()?.replaceAll("_", " ") || "local", "timezone"],
            ].map(([value, label]) => (
              <div key={label} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "13px 14px 12px" }}>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.8 }}>{value}</div>
                <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["all", "All races"], ["sprint", "Sprint weekends"], ["Street", "Street"], ["Permanent", "Permanent"]].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilt(value)}
                style={{
                  background: filt === value ? "#111c30" : "#101a2d",
                  border: filt === value ? "1px solid rgba(148,163,184,0.2)" : "1px solid rgba(148,163,184,0.12)",
                  borderRadius: 12,
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

      <section style={{ display: "grid", gridTemplateColumns: sel ? "minmax(0,1fr) 292px" : "1fr", gap: 14, alignItems: "start" }}>
        <div>
          {Object.entries(months).map(([month, races]) => (
            <div key={month} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
                {month}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {races.map((race) => {
                  const active = sel?.r === race.r;
                  return (
                    <button
                      key={race.r}
                      onClick={() => setSel(race)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        borderRadius: 18,
                        border: active ? `1px solid ${rc(race)}55` : "1px solid rgba(148,163,184,0.12)",
                        background: active ? "#111c30" : PANEL_BG,
                        padding: 0,
                        cursor: "pointer",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "4px 72px minmax(0,1fr) 178px 96px", alignItems: "stretch" }}>
                        <div style={{ background: rc(race) }} />
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "14px 12px", borderRight: `1px solid ${HAIRLINE}` }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Round</div>
                          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -1, marginTop: 3 }}>R{race.r}</div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 15, fontWeight: 800 }}>{race.n}</span>
                            {race.sprint && (
                              <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#fde68a", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.22)", borderRadius: 999, padding: "3px 8px" }}>
                                Sprint
                              </span>
                            )}
                            {race.r === 16 && (
                              <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#7dd3fc", background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.22)", borderRadius: 999, padding: "3px 8px" }}>
                                New
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ padding: "14px 12px", borderLeft: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: MUTED_TEXT, textAlign: "center" }}>
                          {formatEventWindowLabel(race, liveMeetings[race.r])}
                        </div>

                        <div style={{ padding: "14px 12px", borderLeft: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: race.type === "Street" ? "#fde68a" : "#99f6e4", background: race.type === "Street" ? "rgba(250,204,21,0.12)" : "rgba(45,212,191,0.12)", border: `1px solid ${race.type === "Street" ? "rgba(250,204,21,0.22)" : "rgba(45,212,191,0.22)"}`, borderRadius: 999, padding: "6px 10px" }}>
                            {race.type}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {sel && (
          <aside style={{ position: "sticky", top: 84 }}>
            <div style={{ borderRadius: 22, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden" }}>
              <div style={{ height: 4, background: `linear-gradient(90deg,${rc(sel)},var(--team-accent))` }} />

              <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                      Round {sel.r} of 24
                    </div>
                    <h2 style={{ margin: "0 0 3px", fontWeight: 900, fontSize: 19, letterSpacing: -0.7 }}>{sel.n}</h2>
                    <div style={{ fontSize: 12, color: MUTED_TEXT }}>{sel.city}, {sel.cc}</div>
                  </div>
                  <button onClick={() => setSel(null)} style={{ width: 30, height: 30, borderRadius: 10, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, color: MUTED_TEXT, cursor: "pointer" }}>
                    ✕
                  </button>
                </div>

                <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: SUBTLE_TEXT }}>{selectedEventWindow}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: SUBTLE_TEXT, background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 999, padding: "4px 8px" }}>
                      {timezone}
                    </span>
                    {sel.sprint && (
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#fde68a", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.22)", borderRadius: 999, padding: "4px 8px" }}>
                        Sprint weekend
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                  Weekend sessions
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {sessions.map((session) => {
                    const tone = sessionTone[session.tone];
                    return (
                      <div key={session.key} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", alignItems: "center", gap: 8, borderRadius: 12, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "8px 10px" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 999, padding: "4px 7px" }}>
                          {session.label}
                        </span>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textAlign: "right", whiteSpace: "nowrap" }}>
                          {formatLocalDateTime(session.date)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: HAIRLINE }}>
                {[
                  ["Track", `${sel.len} km · ${sel.laps} laps`],
                  ["Race dist.", `${(sel.len * sel.laps).toFixed(1)} km`],
                  ["Circuit", `${sel.turns} turns · ${sel.drs} DRS`],
                  ["Lap record", sel.rec],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: "10px 11px", background: PANEL_BG_ALT }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.35 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
