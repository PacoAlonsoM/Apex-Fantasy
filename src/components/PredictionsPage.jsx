import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { CONSTRUCTORS, DRV, TEAMS } from "../constants/teams";
import { CAL, fmt, fmtFull, nextRace, rc } from "../constants/calendar";
import { PTS } from "../constants/scoring";
import { fetchMeetingSessions, fetchRaceSessions } from "../openf1";
import { BRAND_GRADIENT, PANEL_BG, PANEL_BG_ALT, PANEL_BORDER, MUTED_TEXT, SUBTLE_TEXT, HAIRLINE } from "../constants/design";
import { requireActiveSession } from "../authProfile";

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3
    ? clean.split("").map((char) => char + char).join("")
    : clean;
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
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

function splitDriverName(name) {
  const parts = name.split(" ");
  if (parts.length === 1) return { first: "", last: parts[0] };
  return {
    first: parts.slice(0, -1).join(" "),
    last: parts[parts.length - 1],
  };
}

function SectionHeader({ title, description }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>{title}</div>
      <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 3 }}>{description}</div>
    </div>
  );
}

function PromptHeader({ label, pts, color = "#f97316" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.01em", color: "#f8fafc" }}>{label}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color, background: `${color}16`, border: `1px solid ${color}26`, borderRadius: 999, padding: "3px 7px" }}>
        {pts} pts
      </div>
    </div>
  );
}

function DriverCard({ driver, selected, onClick }) {
  const team = TEAMS[driver.t];
  const { first, last } = splitDriverName(driver.n);
  const selectedBg = `linear-gradient(180deg,${hexToRgba(team.c, 0.28)},${hexToRgba(team.c, 0.18)})`;
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? selectedBg : "#132038",
        border: selected ? `1px solid ${hexToRgba(team.c, 0.4)}` : "1px solid rgba(148,163,184,0.18)",
        borderRadius: 12,
        padding: "8px 9px",
        cursor: "pointer",
        textAlign: "left",
        minHeight: 76,
        boxShadow: selected ? `0 10px 22px ${hexToRgba(team.c, 0.1)}` : "none",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: selected ? team.c : SUBTLE_TEXT }}>
            {driver.s}
          </div>
        </div>
        <div style={{ fontSize: 9, fontWeight: 900, color: selected ? team.c : MUTED_TEXT }}>{driver.nb ? `#${driver.nb}` : "NEW"}</div>
      </div>
      <div style={{ minHeight: 30 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: selected ? "#dbeafe" : MUTED_TEXT, lineHeight: 1.05 }}>{first || driver.n}</div>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginTop: 3, lineHeight: 1.04, letterSpacing: -0.2 }}>{first ? last : ""}</div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: team.c }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: selected ? "#fff" : MUTED_TEXT, lineHeight: 1.1 }}>{driver.t}</span>
      </div>
    </button>
  );
}

function ConstructorCard({ teamName, selected, onClick }) {
  const team = TEAMS[teamName];
  const selectedBg = `linear-gradient(180deg,${hexToRgba(team.c, 0.28)},${hexToRgba(team.c, 0.18)})`;
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? selectedBg : "#132038",
        border: selected ? `1px solid ${hexToRgba(team.c, 0.4)}` : "1px solid rgba(148,163,184,0.18)",
        borderRadius: 12,
        padding: "9px 10px",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: selected ? `0 10px 22px ${hexToRgba(team.c, 0.1)}` : "none",
        minHeight: 68,
        display: "grid",
        gridTemplateRows: "auto 1fr",
      }}
    >
      <div style={{ width: 18, height: 3, borderRadius: 999, background: team.c, marginBottom: 8 }} />
      <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", lineHeight: 1.18, display: "flex", alignItems: "flex-end" }}>{teamName}</div>
    </button>
  );
}

function BinaryCard({ label, selected, activeColor, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? `linear-gradient(180deg,${activeColor}28,${activeColor}18)` : "#132038",
        border: selected ? `1px solid ${activeColor}4a` : "1px solid rgba(148,163,184,0.18)",
        borderRadius: 12,
        padding: "10px 12px",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: selected ? `0 10px 20px ${activeColor}12` : "none",
        minHeight: 52,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: selected ? activeColor : "#fff" }}>{label}</div>
    </button>
  );
}

function DriverPicker({ label, field, pts, picks, setPick }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <PromptHeader label={label} pts={pts} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(126px,1fr))", gap: 8, gridAutoRows: "1fr" }}>
        {DRV.map((driver) => (
          <DriverCard
            key={`${field}-${driver.n}`}
            driver={driver}
            selected={picks[field] === driver.n}
            onClick={() => setPick(field, picks[field] === driver.n ? null : driver.n)}
          />
        ))}
      </div>
    </div>
  );
}

function ConstructorPicker({ picks, setPick }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <PromptHeader label="Constructor with Most Points" pts={PTS.ctor} color="#34d399" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(136px,1fr))", gap: 8, gridAutoRows: "1fr" }}>
        {CONSTRUCTORS.map((teamName) => (
          <ConstructorCard
            key={teamName}
            teamName={teamName}
            selected={picks.ctor === teamName}
            onClick={() => setPick("ctor", picks.ctor === teamName ? null : teamName)}
          />
        ))}
      </div>
    </div>
  );
}

function BinaryPicker({ field, label, pts, picks, setPick }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <PromptHeader label={label} pts={pts} color="#facc15" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, gridAutoRows: "1fr" }}>
        <BinaryCard label="Yes" selected={picks[field] === "Yes"} activeColor="#34d399" onClick={() => setPick(field, picks[field] === "Yes" ? null : "Yes")} />
        <BinaryCard label="No" selected={picks[field] === "No"} activeColor="#f87171" onClick={() => setPick(field, picks[field] === "No" ? null : "No")} />
      </div>
    </div>
  );
}

export default function PredictionsPage({ user, openAuth }) {
  const [race, setRace] = useState(nextRace() || CAL[0]);
  const [picks, setPicks] = useState({});
  const [allPicks, setAllPicks] = useState({});
  const [tab, setTab] = useState("race");
  const [saved, setSaved] = useState(false);
  const [liveRaces, setLiveRaces] = useState({});
  const [liveMeetings, setLiveMeetings] = useState({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => { loadPicks(); }, [user]); // eslint-disable-line

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
    const raceInfo = liveRaces[race.r];

    async function loadMeetingSchedule() {
      if (!raceInfo?.meeting_key || liveMeetings[race.r]) return;
      const sessions = await fetchMeetingSessions(raceInfo.meeting_key);
      if (ignore || !sessions.length) return;
      setLiveMeetings((current) => ({ ...current, [race.r]: sessions }));
    }

    loadMeetingSchedule();
    return () => { ignore = true; };
  }, [race, liveRaces, liveMeetings]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const loadPicks = async () => {
    if (!user) return;
    const { data } = await supabase.from("predictions").select("*").eq("user_id", user.id);
    if (data) {
      const mapped = {};
      data.forEach((row) => { mapped[row.race_round] = row.picks; });
      setAllPicks(mapped);
      if (mapped[race.r]) setPicks(mapped[race.r]);
    }
  };

  const selectRace = (selectedRace) => {
    setRace(selectedRace);
    setSaved(false);
    setPicks(allPicks[selectedRace.r] || {});
    setTab("race");
  };

  const setPick = (key, value) => {
    setPicks((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    if (!user) return openAuth("login");

    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { error } = await supabase.from("predictions").upsert(
      { user_id: user.id, race_round: race.r, picks, updated_at: new Date().toISOString() },
      { onConflict: "user_id,race_round" }
    );
    if (error) {
      alert(error.message);
      return;
    }
    setAllPicks((current) => ({ ...current, [race.r]: picks }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const color = rc(race);
  const done = Object.values(picks).filter(Boolean).length;
  const meetingSessions = liveMeetings[race.r] || [];

  const lockSession = useMemo(() => {
    if (!meetingSessions.length) return null;
    const target = race.sprint && tab === "sprint" ? "Sprint Qualifying" : "Qualifying";
    return meetingSessions.find((session) => session.session_name === target) || null;
  }, [meetingSessions, race, tab]);

  const lockCountdown = useMemo(() => {
    if (!lockSession?.date_start) return null;
    const diff = new Date(lockSession.date_start).getTime() - now;
    if (diff <= 0) return { locked: true };
    return {
      locked: false,
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
    };
  }, [lockSession, now]);

  const lockLabel = lockSession?.date_start ? formatLocalDateTime(lockSession.date_start) : null;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "44px 28px 80px", display: "grid", gridTemplateColumns: "224px minmax(0,1fr)", gap: 16, position: "relative", zIndex: 1 }}>
      <aside>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
          Select race
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {CAL.map((item) => {
            const active = race.r === item.r;
            const isSaved = !!allPicks[item.r];
            return (
              <button
                key={item.r}
                onClick={() => selectRace(item)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  borderRadius: 14,
                  border: active ? `1px solid ${rc(item)}55` : "1px solid rgba(148,163,184,0.12)",
                  background: active ? "#111c30" : PANEL_BG,
                  cursor: "pointer",
                  padding: 0,
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "4px 56px minmax(0,1fr)", alignItems: "stretch" }}>
                  <div style={{ background: rc(item) }} />
                  <div style={{ padding: "11px 8px", borderRight: `1px solid ${HAIRLINE}` }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Round</div>
                    <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.8, marginTop: 3 }}>R{item.r}</div>
                  </div>
                  <div style={{ padding: "11px 11px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{item.n}</span>
                      {item.sprint && (
                        <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", color: "#fde68a", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.22)", borderRadius: 999, padding: "3px 6px" }}>
                          Sprint
                        </span>
                      )}
                      {isSaved && (
                        <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", color: "#99f6e4", background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.22)", borderRadius: 999, padding: "3px 6px" }}>
                          Saved
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: MUTED_TEXT }}>{fmt(item.date)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <main>
        <div style={{ borderRadius: 22, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden" }}>
          <div style={{ height: 4, background: `linear-gradient(90deg,${color},var(--team-accent))` }} />
          <div style={{ padding: "18px 20px 16px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 4, height: 18, borderRadius: 999, background: color }} />
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: -0.8 }}>{race.n}</h2>
                </div>
                <div style={{ fontSize: 11, color: MUTED_TEXT, paddingLeft: 14 }}>{race.circuit} · {fmtFull(race.date)}</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", paddingLeft: 14, marginTop: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: SUBTLE_TEXT, background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 999, padding: "4px 8px" }}>
                    {done} picks made
                  </span>
                  {race.sprint && (
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#fde68a", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.22)", borderRadius: 999, padding: "4px 8px" }}>
                      Sprint weekend
                    </span>
                  )}
                </div>
              </div>

              {!user && (
                <div style={{ minWidth: 194, padding: "10px 11px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG }}>
                  <div style={{ fontSize: 10, color: MUTED_TEXT, marginBottom: 8 }}>Login to save picks for this round.</div>
                  <button style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "8px 11px" }} onClick={() => openAuth("login")}>
                    Login
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: "11px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#dbe4f0", marginBottom: 3 }}>
                  {race.sprint && tab === "sprint" ? "Sprint picks lock" : "Predictions lock"}
                </div>
                <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                  {lockLabel ? `Closes at ${lockLabel}` : "Fetching qualifying schedule..."}
                </div>
              </div>
              <div style={{ padding: "9px 11px", borderRadius: 12, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, minWidth: 164 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 3 }}>
                  Time left
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.2 }}>
                  {!lockSession
                    ? "Loading..."
                    : lockCountdown?.locked
                      ? "Locked"
                      : `${lockCountdown?.d ? `${lockCountdown.d}d ` : ""}${String(lockCountdown?.h || 0).padStart(2, "0")}h ${String(lockCountdown?.m || 0).padStart(2, "0")}m`}
                </div>
              </div>
            </div>
          </div>

          {race.sprint && (
            <div style={{ display: "flex", gap: 8, padding: "9px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG }}>
              {[["race", "Race picks"], ["sprint", "Sprint picks"]].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  style={{
                    background: tab === value ? "#111c30" : PANEL_BG_ALT,
                    border: tab === value ? "1px solid rgba(148,163,184,0.18)" : "1px solid rgba(148,163,184,0.12)",
                    borderRadius: 12,
                    color: tab === value ? "#fff" : MUTED_TEXT,
                    cursor: "pointer",
                    padding: "8px 11px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: 18 }}>
            {!race.sprint || tab === "race" ? (
              <>
                <section style={{ marginBottom: 18 }}>
                  <SectionHeader title="Grid calls" description="Start with the picks that matter most." />
                  <DriverPicker label="Pole Position" field="pole" pts={PTS.pole} picks={picks} setPick={setPick} />
                  <div style={{ height: 1, background: HAIRLINE, margin: "8px 0 14px" }} />
                  <DriverPicker label="Race Winner" field="winner" pts={PTS.winner} picks={picks} setPick={setPick} />
                  <DriverPicker label="2nd Place" field="p2" pts={PTS.p2} picks={picks} setPick={setPick} />
                  <DriverPicker label="3rd Place" field="p3" pts={PTS.p3} picks={picks} setPick={setPick} />
                  {picks.winner && picks.p2 && picks.p3 && (
                    <div style={{ padding: "10px 11px", borderRadius: 12, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.22)", fontSize: 11, color: "#dbeafe" }}>
                      <strong style={{ color: "#7dd3fc" }}>Perfect podium bonus active.</strong> Exact order: {picks.winner} · {picks.p2} · {picks.p3}
                    </div>
                  )}
                </section>

                <section style={{ marginBottom: 18 }}>
                  <SectionHeader title="Race extras" description="These calls separate close leaderboards." />
                  <DriverPicker label="DNF Driver" field="dnf" pts={PTS.dnf} picks={picks} setPick={setPick} />
                  <DriverPicker label="Fastest Lap" field="fl" pts={PTS.fl} picks={picks} setPick={setPick} />
                  <DriverPicker label="Driver of the Day" field="dotd" pts={PTS.dotd} picks={picks} setPick={setPick} />
                </section>

                <section>
                  <SectionHeader title="Team and race conditions" description="Complete the card with constructor and event picks." />
                  <ConstructorPicker picks={picks} setPick={setPick} />
                  <BinaryPicker field="sc" label="Safety Car?" pts={PTS.sc} picks={picks} setPick={setPick} />
                  <BinaryPicker field="rf" label="Red Flag?" pts={PTS.rf} picks={picks} setPick={setPick} />
                </section>
              </>
            ) : (
              <section>
                <SectionHeader title="Sprint picks" description="Sprint weekends use a separate shorter set of calls." />
                <DriverPicker label="Sprint Pole" field="sp_pole" pts={PTS.sp_pole} picks={picks} setPick={setPick} />
                <DriverPicker label="Sprint Winner" field="sp_winner" pts={PTS.sp_winner} picks={picks} setPick={setPick} />
                <DriverPicker label="Sprint 2nd" field="sp_p2" pts={PTS.sp_p2} picks={picks} setPick={setPick} />
                <DriverPicker label="Sprint 3rd" field="sp_p3" pts={PTS.sp_p3} picks={picks} setPick={setPick} />
              </section>
            )}

            <div style={{ height: 1, background: HAIRLINE, margin: "18px 0 12px" }} />

            <button onClick={save} style={{ background: saved ? "linear-gradient(135deg,#10b981,#059669)" : BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 13, fontSize: 13 }}>
              {saved ? "Predictions Saved" : "Save Predictions"}
            </button>
            <div style={{ textAlign: "center", fontSize: 10, color: SUBTLE_TEXT, marginTop: 10 }}>Predictions close right before qualifying starts.</div>
          </div>
        </div>
      </main>
    </div>
  );
}
