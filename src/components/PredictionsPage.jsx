import { useEffect, useMemo, useRef, useState } from "react";
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

function driverByName(name) {
  return DRV.find((driver) => driver.n === name) || null;
}

const CONSTRUCTOR_PICK_ORDER = [
  "McLaren",
  "Mercedes",
  "Red Bull Racing",
  "Ferrari",
  "Williams",
  "Racing Bulls",
  "Aston Martin",
  "Haas",
  "Audi",
  "Alpine",
  "Cadillac",
];

const constructorRank = new Map(CONSTRUCTOR_PICK_ORDER.map((teamName, index) => [teamName, index]));
const driverRank = new Map(
  DRV.map((driver, index) => [driver.n, {
    teamRank: constructorRank.get(driver.t) ?? 999,
    index,
  }])
);

function promptGroups(isSprintTab) {
  if (isSprintTab) {
    return [
      {
        title: "Sprint picks",
        description: "Short-format calls for sprint weekends.",
        prompts: [
          { key: "sp_pole", label: "Sprint Pole", type: "driver", pts: PTS.sp_pole, hint: "Fastest driver in sprint qualifying." },
          { key: "sp_winner", label: "Sprint Winner", type: "driver", pts: PTS.sp_winner, hint: "Who takes the sprint win." },
          { key: "sp_p2", label: "Sprint 2nd", type: "driver", pts: PTS.sp_p2, hint: "Second place in the sprint." },
          { key: "sp_p3", label: "Sprint 3rd", type: "driver", pts: PTS.sp_p3, hint: "Third place in the sprint." },
        ],
      },
    ];
  }

  return [
    {
      title: "Grid calls",
      description: "Front-running picks that shape the leaderboard.",
      prompts: [
        { key: "pole", label: "Pole Position", type: "driver", pts: PTS.pole, hint: "Who is quickest over one lap." },
        { key: "winner", label: "Race Winner", type: "driver", pts: PTS.winner, hint: "Pick the Sunday winner." },
        { key: "p2", label: "2nd Place", type: "driver", pts: PTS.p2, hint: "Who crosses the line in second." },
        { key: "p3", label: "3rd Place", type: "driver", pts: PTS.p3, hint: "Who completes the podium." },
      ],
    },
    {
      title: "Race extras",
      description: "The calls that separate close weekends.",
      prompts: [
        { key: "dnf", label: "DNF Driver", type: "driver", pts: PTS.dnf, hint: "Driver most likely not to finish." },
        { key: "fl", label: "Fastest Lap", type: "driver", pts: PTS.fl, hint: "Late-race pace or outright control." },
        { key: "dotd", label: "Driver of the Day", type: "driver", pts: PTS.dotd, hint: "Fan-voted race standout." },
      ],
    },
    {
      title: "Team and conditions",
      description: "Finish the card with team form and race interruptions.",
      prompts: [
        { key: "ctor", label: "Constructor with Most Points", type: "constructor", pts: PTS.ctor, hint: "Team likely to own the weekend." },
        { key: "sc", label: "Safety Car?", type: "binary", pts: PTS.sc, hint: "Will there be a safety car period." },
        { key: "rf", label: "Red Flag?", type: "binary", pts: PTS.rf, hint: "Will the session be stopped." },
      ],
    },
  ];
}

function flattenPromptGroups(groups) {
  return groups.flatMap((group) => group.prompts.map((prompt) => ({
    ...prompt,
    section: group.title,
    sectionDescription: group.description,
  })));
}

function selectionMeta(prompt, value) {
  if (!value) return null;

  if (prompt.type === "driver") {
    const driver = driverByName(value);
    const team = driver ? TEAMS[driver.t] : null;
    return {
      label: value,
      accent: team?.c || "#f97316",
      text: team?.t || "#fff",
      teamName: driver?.t || null,
    };
  }

  if (prompt.type === "constructor") {
    const team = TEAMS[value];
    return {
      label: value,
      accent: team?.c || "#34d399",
      text: team?.t || "#fff",
      teamName: value,
    };
  }

  const accent = value === "Yes" ? "#34d399" : "#f87171";
  return {
    label: value,
    accent,
    text: "#fff",
    teamName: null,
  };
}

function emptySelectionLabel(prompt) {
  if (prompt.type === "binary") return "No choice selected";
  if (prompt.type === "constructor") return "No team selected";
  return "No driver selected";
}

function PromptPill({ prompt, value, active, onClick, accent }) {
  const meta = selectionMeta(prompt, value);
  const tone = accent || "#f97316";

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 16,
        border: active ? `1px solid ${hexToRgba(tone, 0.38)}` : meta ? `1px solid ${hexToRgba(tone, 0.22)}` : "1px solid rgba(148,163,184,0.14)",
        background: active
          ? `linear-gradient(180deg,${hexToRgba(tone, 0.18)},#101a2d)`
          : meta
            ? `linear-gradient(180deg,${hexToRgba(tone, 0.1)},${PANEL_BG_ALT})`
            : PANEL_BG_ALT,
        padding: "11px 12px 12px",
        cursor: "pointer",
        boxShadow: active ? `0 14px 28px ${hexToRgba(tone, 0.12)}` : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 7 }}>
        <div style={{ fontSize: 13.5, fontWeight: 900, color: "#f8fafc", letterSpacing: -0.24, lineHeight: 1.1 }}>{prompt.label}</div>
        <div style={{ fontSize: 9.5, fontWeight: 900, color: active ? "#fff" : "#dbe4f0", background: active ? hexToRgba(tone, 0.2) : "rgba(148,163,184,0.08)", border: active ? `1px solid ${hexToRgba(tone, 0.3)}` : "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "4px 8px", whiteSpace: "nowrap" }}>
          {prompt.pts} pts
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta ? meta.accent : hexToRgba(tone, 0.8), flex: "0 0 auto" }} />
        <div style={{ fontSize: 10.5, fontWeight: 700, color: meta ? "#fff" : MUTED_TEXT, lineHeight: 1.45, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {meta ? meta.label : prompt.hint}
        </div>
      </div>
    </button>
  );
}

function DriverOption({ driver, selected, onClick }) {
  const team = TEAMS[driver.t];
  const background = selected
    ? `linear-gradient(135deg,${hexToRgba(team.c, 0.28)},rgba(16,26,45,0.96))`
    : PANEL_BG_ALT;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 56,
        borderRadius: 16,
        border: selected ? `1px solid ${hexToRgba(team.c, 0.48)}` : "1px solid rgba(148,163,184,0.14)",
        background,
        cursor: "pointer",
        padding: "8px 10px",
        textAlign: "left",
        display: "grid",
        gridTemplateColumns: "28px minmax(0,1fr) auto",
        gap: 10,
        alignItems: "center",
        boxShadow: selected ? `0 18px 36px ${hexToRgba(team.c, 0.14)}` : "none",
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 9, background: hexToRgba(team.c, selected ? 0.2 : 0.12), border: `1px solid ${hexToRgba(team.c, 0.22)}`, display: "flex", alignItems: "center", justifyContent: "center", color: selected ? "#fff" : team.c, fontSize: 8.5, fontWeight: 900, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)" }}>
        {driver.nb ? `#${driver.nb}` : "NEW"}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#fff", letterSpacing: -0.2, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {driver.n}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9.5, fontWeight: 700, color: selected ? "#e2e8f0" : MUTED_TEXT }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: team.c }} />
            {driver.t}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: selected ? team.c : "#cbd5e1", letterSpacing: "0.08em" }}>{driver.s}</div>
        <div style={{ minWidth: 52, textAlign: "center", fontSize: 8.5, fontWeight: 800, color: selected ? "#fff" : MUTED_TEXT, background: selected ? hexToRgba(team.c, 0.22) : "rgba(148,163,184,0.08)", border: selected ? `1px solid ${hexToRgba(team.c, 0.3)}` : "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "3px 6px" }}>
          {selected ? "Selected" : "Choose"}
        </div>
      </div>
    </button>
  );
}

function ConstructorOption({ teamName, selected, onClick }) {
  const team = TEAMS[teamName];
  const teammates = DRV.filter((driver) => driver.t === teamName).map((driver) => driver.s).join(" · ");

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 58,
        borderRadius: 16,
        border: selected ? `1px solid ${hexToRgba(team.c, 0.48)}` : "1px solid rgba(148,163,184,0.14)",
        background: selected
          ? `linear-gradient(135deg,${hexToRgba(team.c, 0.28)},rgba(16,26,45,0.96))`
          : PANEL_BG_ALT,
        cursor: "pointer",
        padding: "10px 11px",
        textAlign: "left",
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: team.c }} />
          <span style={{ fontSize: 12.5, fontWeight: 900, color: "#fff", letterSpacing: -0.2 }}>{teamName}</span>
        </div>
        <div style={{ fontSize: 9.5, color: selected ? "#e2e8f0" : MUTED_TEXT }}>
          {teammates || "Team pair pending"}
        </div>
      </div>

      <div style={{ minWidth: 60, textAlign: "center", fontSize: 8.5, fontWeight: 800, color: selected ? "#fff" : MUTED_TEXT, background: selected ? hexToRgba(team.c, 0.22) : "rgba(148,163,184,0.08)", border: selected ? `1px solid ${hexToRgba(team.c, 0.3)}` : "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "4px 6px" }}>
        {selected ? "Selected" : "Choose"}
      </div>
    </button>
  );
}

function BinaryOption({ label, detail, color, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 88,
        borderRadius: 16,
        border: selected ? `1px solid ${color}66` : "1px solid rgba(148,163,184,0.14)",
        background: selected ? `linear-gradient(135deg,${color}2e,rgba(16,26,45,0.96))` : PANEL_BG_ALT,
        cursor: "pointer",
        padding: "12px 13px 11px",
        textAlign: "left",
        display: "grid",
        alignContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 0 5px ${color}18` }} />
      <div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: -0.35, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 10.5, lineHeight: 1.5, color: selected ? "#e2e8f0" : MUTED_TEXT }}>{detail}</div>
      </div>
    </button>
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
  const [activePromptKey, setActivePromptKey] = useState("");
  const boardRef = useRef(null);

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
      data.forEach((row) => {
        mapped[row.race_round] = row.picks;
      });
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

  const focusPromptBoard = (promptKey) => {
    setActivePromptKey(promptKey);
    if (window.innerWidth < 960) {
      window.requestAnimationFrame(() => {
        boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
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

  const isSprintTab = race.sprint && tab === "sprint";
  const groups = useMemo(() => promptGroups(isSprintTab), [isSprintTab]);
  const prompts = useMemo(() => flattenPromptGroups(groups), [groups]);

  useEffect(() => {
    if (!prompts.length) return;
    if (!prompts.find((prompt) => prompt.key === activePromptKey)) {
      setActivePromptKey(prompts[0].key);
    }
  }, [prompts, activePromptKey]);

  const activePrompt = prompts.find((prompt) => prompt.key === activePromptKey) || prompts[0];
  const color = rc(race);
  const meetingSessions = liveMeetings[race.r] || [];
  const totalPrompts = prompts.length;
  const done = prompts.filter((prompt) => !!picks[prompt.key]).length;

  const lockSession = useMemo(() => {
    if (!meetingSessions.length) return null;
    const target = isSprintTab ? "Sprint Qualifying" : "Qualifying";
    return meetingSessions.find((session) => session.session_name === target) || null;
  }, [meetingSessions, isSprintTab]);

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
  const currentValue = activePrompt ? picks[activePrompt.key] : null;
  const currentMeta = activePrompt ? selectionMeta(activePrompt, currentValue) : null;

  const driverOptions = useMemo(() => (
    [...DRV].sort((a, b) => {
      const aRank = driverRank.get(a.n);
      const bRank = driverRank.get(b.n);
      if ((aRank?.teamRank ?? 999) !== (bRank?.teamRank ?? 999)) {
        return (aRank?.teamRank ?? 999) - (bRank?.teamRank ?? 999);
      }
      return (aRank?.index ?? 999) - (bRank?.index ?? 999);
    })
  ), []);

  const constructorOptions = useMemo(() => (
    [...CONSTRUCTORS].sort((a, b) => (constructorRank.get(a) ?? 999) - (constructorRank.get(b) ?? 999))
  ), []);

  const boardAccent = currentMeta?.accent || color;

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 22px 68px", display: "grid", gridTemplateColumns: "188px minmax(0,1fr)", gap: 12, position: "relative", zIndex: 1 }}>
      <aside style={{ position: "sticky", top: 86, alignSelf: "start", maxHeight: "calc(100vh - 106px)", overflowY: "auto", paddingRight: 4 }}>
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
                  border: active ? `1px solid ${hexToRgba(color, 0.24)}` : "1px solid rgba(148,163,184,0.12)",
                  background: active ? "linear-gradient(180deg,rgba(255,255,255,0.04),#111c30)" : PANEL_BG,
                  cursor: "pointer",
                  padding: 0,
                  overflow: "hidden",
                }}
              >
                  <div style={{ display: "grid", gridTemplateColumns: "60px minmax(0,1fr)", alignItems: "stretch", gap: 0 }}>
                    <div style={{ padding: "8px 7px 8px 8px", borderRight: `1px solid ${HAIRLINE}` }}>
                      <div style={{ height: "100%", borderRadius: 12, border: active ? "1px solid rgba(248,250,252,0.14)" : "1px solid rgba(148,163,184,0.12)", background: active ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? rc(item) : "rgba(148,163,184,0.5)", boxShadow: active ? `0 0 0 5px ${hexToRgba(rc(item), 0.12)}` : "none" }} />
                      <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.6, color: "#fff" }}>R{item.r}</div>
                    </div>
                  </div>
                  <div style={{ padding: "10px 10px 9px" }}>
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
        <div style={{ borderRadius: 22, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: "0 22px 56px rgba(0,0,0,0.2)" }}>
          <div style={{ height: 4, background: `linear-gradient(90deg,${color},rgba(248,250,252,0.92))` }} />

          <div style={{ padding: "16px 18px 14px", borderBottom: `1px solid ${HAIRLINE}`, background: `linear-gradient(180deg,${hexToRgba(color, 0.1)},#101a2d)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, boxShadow: `0 0 0 6px ${hexToRgba(color, 0.14)}` }} />
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: -0.7 }}>{race.n}</h2>
                </div>
                <div style={{ fontSize: 11, color: MUTED_TEXT, paddingLeft: 22 }}>{race.circuit} · {fmtFull(race.date)}</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", paddingLeft: 22, marginTop: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#dbe4f0", background: hexToRgba(color, 0.14), border: `1px solid ${hexToRgba(color, 0.24)}`, borderRadius: 999, padding: "4px 8px" }}>
                    {done} of {totalPrompts} picks ready
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

          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f8fafc", marginBottom: 4 }}>
                  {isSprintTab ? "Sprint picks lock" : "Predictions lock"}
                </div>
                <div style={{ fontSize: 12, color: "#dbe4f0" }}>
                  {lockLabel ? `Closes at ${lockLabel}` : "Fetching qualifying schedule..."}
                </div>
              </div>

              <div style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${hexToRgba(color, 0.24)}`, background: `linear-gradient(180deg,${hexToRgba(color, 0.1)},#101a2d)`, minWidth: 170 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                  Time left
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.2 }}>
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
            <div style={{ display: "flex", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG }}>
              {[["race", "Race picks"], ["sprint", "Sprint picks"]].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  style={{
                    background: tab === value ? `linear-gradient(180deg,${hexToRgba(color, 0.16)},#111c30)` : PANEL_BG_ALT,
                    border: tab === value ? `1px solid ${hexToRgba(color, 0.24)}` : "1px solid rgba(148,163,184,0.12)",
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
            <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 14, alignItems: "start" }}>
              <div style={{ display: "grid", gap: 12, maxHeight: "calc(100vh - 286px)", overflowY: "auto", paddingRight: 4 }}>
                {groups.map((group) => (
                  <section key={group.title} style={{ borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG, padding: "12px" }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.26 }}>{group.title}</div>
                      <div style={{ fontSize: 10.5, color: MUTED_TEXT, marginTop: 4, lineHeight: 1.45 }}>{group.description}</div>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {group.prompts.map((prompt) => (
                        <PromptPill
                          key={prompt.key}
                          prompt={prompt}
                          value={picks[prompt.key]}
                          active={activePrompt?.key === prompt.key}
                          onClick={() => focusPromptBoard(prompt.key)}
                          accent={color}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <div ref={boardRef} style={{ borderRadius: 20, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden" }}>
                <div style={{ padding: "16px 18px 14px", borderBottom: `1px solid ${HAIRLINE}`, background: `linear-gradient(180deg,${hexToRgba(boardAccent, 0.14)},#101a2d)` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>
                        {activePrompt?.section || "Selection"}
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.98, lineHeight: 1 }}>{activePrompt?.label}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", background: hexToRgba(boardAccent, 0.18), border: `1px solid ${hexToRgba(boardAccent, 0.28)}`, borderRadius: 999, padding: "7px 11px" }}>
                      {activePrompt?.pts || 0} pts
                    </div>
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.65, color: MUTED_TEXT }}>
                    {activePrompt?.hint}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: currentMeta ? currentMeta.text : "#dbe4f0", background: currentMeta ? hexToRgba(currentMeta.accent, 0.22) : "rgba(148,163,184,0.08)", border: currentMeta ? `1px solid ${hexToRgba(currentMeta.accent, 0.3)}` : "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "6px 10px" }}>
                      {currentMeta ? `Selected: ${currentMeta.label}` : emptySelectionLabel(activePrompt)}
                    </span>
                    {!isSprintTab && picks.winner && picks.p2 && picks.p3 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#dbeafe", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.22)", borderRadius: 999, padding: "6px 10px" }}>
                        Perfect podium bonus armed
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ padding: 14 }}>
                  {activePrompt?.type === "driver" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
                      {driverOptions.map((driver) => (
                        <DriverOption
                          key={`${activePrompt.key}-${driver.n}`}
                          driver={driver}
                          selected={picks[activePrompt.key] === driver.n}
                          onClick={() => setPick(activePrompt.key, picks[activePrompt.key] === driver.n ? null : driver.n)}
                        />
                      ))}
                    </div>
                  )}

                  {activePrompt?.type === "constructor" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
                      {constructorOptions.map((teamName) => (
                        <ConstructorOption
                          key={`${activePrompt.key}-${teamName}`}
                          teamName={teamName}
                          selected={picks[activePrompt.key] === teamName}
                          onClick={() => setPick(activePrompt.key, picks[activePrompt.key] === teamName ? null : teamName)}
                        />
                      ))}
                    </div>
                  )}

                  {activePrompt?.type === "binary" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <BinaryOption
                        label="Yes"
                        detail={activePrompt.key === "sc" ? "Race likely interrupted by at least one safety car." : "A stoppage feels likely this weekend."}
                        color="#34d399"
                        selected={picks[activePrompt.key] === "Yes"}
                        onClick={() => setPick(activePrompt.key, picks[activePrompt.key] === "Yes" ? null : "Yes")}
                      />
                      <BinaryOption
                        label="No"
                        detail={activePrompt.key === "sc" ? "Clean race without a safety car period." : "No stoppage expected during the session."}
                        color="#f87171"
                        selected={picks[activePrompt.key] === "No"}
                        onClick={() => setPick(activePrompt.key, picks[activePrompt.key] === "No" ? null : "No")}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

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
