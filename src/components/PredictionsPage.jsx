import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { CONSTRUCTORS, DRV, TEAMS } from "../constants/teams";
import { CAL, fmt, fmtFull, nextRace, rc } from "../constants/calendar";
import { PTS } from "../constants/scoring";
import { fetchMeetingSessions, fetchRaceSessions } from "../openf1";
import {
  BRAND_GRADIENT,
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
import { requireActiveSession } from "../authProfile";
import useViewport from "../useViewport";

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

function previewText(value, max = 120) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
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
        title: "Sprint board",
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
      title: "Front of the order",
      description: "High-leverage calls that shape the weekend.",
      prompts: [
        { key: "pole", label: "Pole Position", type: "driver", pts: PTS.pole, hint: "Who is quickest over one lap." },
        { key: "winner", label: "Race Winner", type: "driver", pts: PTS.winner, hint: "Pick the Sunday winner." },
        { key: "p2", label: "2nd Place", type: "driver", pts: PTS.p2, hint: "Who crosses the line in second." },
        { key: "p3", label: "3rd Place", type: "driver", pts: PTS.p3, hint: "Who completes the podium." },
      ],
    },
    {
      title: "Volatility board",
      description: "The calls that separate close weekends.",
      prompts: [
        { key: "dnf", label: "DNF Driver", type: "driver", pts: PTS.dnf, hint: "Driver most likely not to finish." },
        { key: "fl", label: "Fastest Lap", type: "driver", pts: PTS.fl, hint: "Late-race pace or outright control." },
        { key: "dotd", label: "Driver of the Day", type: "driver", pts: PTS.dotd, hint: "Fan-voted race standout." },
      ],
    },
    {
      title: "Team and race state",
      description: "Team form plus interruption calls.",
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
      secondary: driver?.t || null,
    };
  }

  if (prompt.type === "constructor") {
    const team = TEAMS[value];
    return {
      label: value,
      accent: team?.c || "#34d399",
      text: team?.t || "#fff",
      secondary: value,
    };
  }

  return {
    label: value,
    accent: value === "Yes" ? "#34d399" : "#f87171",
    text: "#fff",
    secondary: value === "Yes" ? "Interruption expected" : "Clean running expected",
  };
}

function emptySelectionLabel(prompt) {
  if (prompt.type === "binary") return "Not answered";
  if (prompt.type === "constructor") return "No constructor selected";
  return "No driver selected";
}

function predictionMatches(prompt, item, value) {
  if (!item) return false;
  return item.pick === value;
}

function PromptPill({ prompt, value, active, onClick, accent, aiItem }) {
  const meta = selectionMeta(prompt, value);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 18,
        border: active ? `1px solid ${hexToRgba(accent, 0.34)}` : meta ? `1px solid ${hexToRgba(meta.accent, 0.2)}` : "1px solid rgba(148,163,184,0.12)",
        background: active
          ? `linear-gradient(180deg,${hexToRgba(accent, 0.16)},#0f182c)`
          : meta
            ? `linear-gradient(180deg,${hexToRgba(meta.accent, 0.08)},${PANEL_BG_ALT})`
            : PANEL_BG_ALT,
        padding: "10px 11px 9px",
        cursor: "pointer",
        boxShadow: active ? `0 18px 36px ${hexToRgba(accent, 0.12)}` : EDGE_RING,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 5 }}>
        <div style={{ fontSize: 12.5, fontWeight: 900, lineHeight: 1.12 }}>{prompt.label}</div>
        <div style={{ fontSize: 9, fontWeight: 900, color: active ? "#fff" : "#dbe4f0", background: active ? hexToRgba(accent, 0.18) : "rgba(148,163,184,0.08)", border: active ? `1px solid ${hexToRgba(accent, 0.24)}` : "1px solid rgba(148,163,184,0.12)", borderRadius: 999, padding: "4px 7px", whiteSpace: "nowrap" }}>
          {prompt.pts} pts
        </div>
      </div>

      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta ? meta.accent : hexToRgba(accent, 0.8), flex: "0 0 auto" }} />
          <div style={{ minWidth: 0, fontSize: 10.5, lineHeight: 1.4, color: meta ? "#e2e8f0" : MUTED_TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {meta ? meta.label : emptySelectionLabel(prompt)}
          </div>
        </div>

        {aiItem && (
          <div style={{ fontSize: 10, color: "#93c5fd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            AI: {aiItem.pick}
          </div>
        )}
      </div>
    </button>
  );
}

function DriverOption({ driver, selected, onClick, aiMatch = false }) {
  const team = TEAMS[driver.t];

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 78,
        borderRadius: 18,
        border: selected ? `1px solid ${hexToRgba(team.c, 0.42)}` : aiMatch ? "1px solid rgba(96,165,250,0.28)" : "1px solid rgba(148,163,184,0.12)",
        background: selected
          ? `linear-gradient(135deg,${hexToRgba(team.c, 0.24)},rgba(12,21,37,0.98))`
          : aiMatch
            ? "linear-gradient(180deg,rgba(59,130,246,0.08),#0f182c)"
            : PANEL_BG_ALT,
        cursor: "pointer",
        padding: "12px 13px",
        textAlign: "left",
        display: "grid",
        gap: 10,
        boxShadow: selected ? `0 18px 34px ${hexToRgba(team.c, 0.12)}` : aiMatch ? "0 12px 26px rgba(59,130,246,0.08)" : "none",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: hexToRgba(team.c, selected ? 0.18 : 0.12), border: `1px solid ${hexToRgba(team.c, 0.22)}`, display: "flex", alignItems: "center", justifyContent: "center", color: selected ? "#fff" : team.c, fontSize: 10, fontWeight: 900 }}>
          {driver.nb ? `#${driver.nb}` : "NEW"}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 900, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>
            {driver.n}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: selected ? "#dbe4f0" : MUTED_TEXT }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: team.c }} />
            {driver.t}
          </div>
        </div>

        <div style={{ display: "grid", justifyItems: "end", gap: 6 }}>
          {aiMatch && (
            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#dbeafe", background: "rgba(59,130,246,0.14)", border: "1px solid rgba(96,165,250,0.28)", borderRadius: 999, padding: "3px 6px" }}>
              AI
            </span>
          )}
          <span style={{ minWidth: 58, textAlign: "center", fontSize: 8.5, fontWeight: 800, color: selected ? "#fff" : MUTED_TEXT, background: selected ? hexToRgba(team.c, 0.22) : "rgba(148,163,184,0.08)", border: selected ? `1px solid ${hexToRgba(team.c, 0.3)}` : "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "4px 6px" }}>
            {selected ? "Selected" : driver.s}
          </span>
        </div>
      </div>
    </button>
  );
}

function ConstructorOption({ teamName, selected, onClick, aiMatch = false }) {
  const team = TEAMS[teamName];
  const teammates = DRV.filter((driver) => driver.t === teamName).map((driver) => driver.s).join(" · ");

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 78,
        borderRadius: 18,
        border: selected ? `1px solid ${hexToRgba(team.c, 0.42)}` : aiMatch ? "1px solid rgba(96,165,250,0.28)" : "1px solid rgba(148,163,184,0.12)",
        background: selected
          ? `linear-gradient(135deg,${hexToRgba(team.c, 0.24)},rgba(12,21,37,0.98))`
          : aiMatch
            ? "linear-gradient(180deg,rgba(59,130,246,0.08),#0f182c)"
            : PANEL_BG_ALT,
        cursor: "pointer",
        padding: "12px 13px",
        textAlign: "left",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: team.c }} />
            <span style={{ fontSize: 13.5, fontWeight: 900 }}>{teamName}</span>
          </div>
          <div style={{ fontSize: 10.5, color: selected ? "#dbe4f0" : MUTED_TEXT }}>{teammates || "Team pair pending"}</div>
        </div>

        <div style={{ display: "grid", justifyItems: "end", gap: 6 }}>
          {aiMatch && (
            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#dbeafe", background: "rgba(59,130,246,0.14)", border: "1px solid rgba(96,165,250,0.28)", borderRadius: 999, padding: "3px 6px" }}>
              AI
            </span>
          )}
          <span style={{ minWidth: 58, textAlign: "center", fontSize: 8.5, fontWeight: 800, color: selected ? "#fff" : MUTED_TEXT, background: selected ? hexToRgba(team.c, 0.22) : "rgba(148,163,184,0.08)", border: selected ? `1px solid ${hexToRgba(team.c, 0.3)}` : "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "4px 6px" }}>
            {selected ? "Selected" : "Choose"}
          </span>
        </div>
      </div>
    </button>
  );
}

function BinaryOption({ label, detail, color, selected, onClick, aiMatch = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 94,
        borderRadius: 18,
        border: selected ? `1px solid ${hexToRgba(color, 0.38)}` : aiMatch ? "1px solid rgba(96,165,250,0.28)" : "1px solid rgba(148,163,184,0.12)",
        background: selected ? `linear-gradient(135deg,${hexToRgba(color, 0.2)},rgba(13,20,35,0.98))` : aiMatch ? "linear-gradient(180deg,rgba(59,130,246,0.08),#0f182c)" : PANEL_BG_ALT,
        cursor: "pointer",
        padding: "14px 15px 13px",
        textAlign: "left",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 0 5px ${hexToRgba(color, 0.14)}` }} />
          <span style={{ fontSize: 16, fontWeight: 900 }}>{label}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {aiMatch && (
            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#dbeafe", background: "rgba(59,130,246,0.14)", border: "1px solid rgba(96,165,250,0.28)", borderRadius: 999, padding: "3px 6px" }}>
              AI
            </span>
          )}
          {selected && (
            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: hexToRgba(color, 0.18), border: `1px solid ${hexToRgba(color, 0.24)}`, borderRadius: 999, padding: "3px 6px" }}>
              Selected
            </span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.55, color: selected ? "#dbe4f0" : MUTED_TEXT }}>{detail}</div>
    </button>
  );
}

function RoundCard({ item, active, isSaved, onClick }) {
  const accent = rc(item);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 18,
        border: active ? `1px solid ${hexToRgba(accent, 0.28)}` : "1px solid rgba(148,163,184,0.12)",
        background: active ? `linear-gradient(180deg,${hexToRgba(accent, 0.14)},#0e1727)` : PANEL_BG,
        cursor: "pointer",
        padding: 0,
        overflow: "hidden",
        boxShadow: active ? `0 18px 36px ${hexToRgba(accent, 0.1)}` : "none",
        height: 112,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr)", alignItems: "stretch" }}>
        <div style={{ padding: "10px 8px 10px 9px", borderRight: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 56, height: 88, borderRadius: 14, border: active ? "1px solid rgba(248,250,252,0.08)" : "1px solid rgba(148,163,184,0.1)", background: active ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.5 }}>R{item.r}</div>
          </div>
        </div>

        <div style={{ padding: "12px 12px 11px", display: "grid", gridTemplateRows: "40px 20px auto", alignContent: "center" }}>
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 4, minHeight: 40 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.2,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {item.n}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minHeight: 20 }}>
            {item.sprint && (
              <span style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", color: "#fde68a", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.22)", borderRadius: 999, padding: "3px 6px" }}>
                Sprint
              </span>
            )}
            {isSaved && (
              <span style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", color: "#99f6e4", background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.22)", borderRadius: 999, padding: "3px 6px" }}>
                Saved
              </span>
            )}
          </div>
          <div style={{ fontSize: 9.5, color: MUTED_TEXT }}>{fmt(item.date)}</div>
        </div>
      </div>
    </button>
  );
}

function BoardLine({ prompt, value, active, onSelect, aiItem }) {
  const meta = selectionMeta(prompt, value);
  const aligned = meta && aiItem && aiItem.pick === meta.label;

  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 16,
        border: active ? "1px solid rgba(248,250,252,0.16)" : aligned ? "1px solid rgba(52,211,153,0.22)" : "1px solid rgba(148,163,184,0.12)",
        background: active ? "linear-gradient(180deg,rgba(255,255,255,0.05),#111c30)" : aligned ? "linear-gradient(180deg,rgba(16,185,129,0.08),#0f182c)" : PANEL_BG_ALT,
        cursor: "pointer",
        padding: "12px 12px 11px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 7 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fff" }}>{prompt.label}</div>
        <div style={{ fontSize: 9, color: SUBTLE_TEXT }}>{prompt.pts} pts</div>
      </div>

      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta ? meta.accent : "rgba(148,163,184,0.5)" }} />
          <div style={{ minWidth: 0, fontSize: 10.5, color: meta ? "#e2e8f0" : MUTED_TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {meta ? meta.label : emptySelectionLabel(prompt)}
          </div>
        </div>

        {aiItem && (
          <div style={{ fontSize: 10, color: aligned ? "#86efac" : "#93c5fd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {aligned ? "Matches AI" : `AI: ${aiItem.pick}`}
          </div>
        )}
      </div>
    </button>
  );
}

export default function PredictionsPage({ user, openAuth }) {
  const { width, isMobile, isTablet } = useViewport();
  const [race, setRace] = useState(nextRace() || CAL[0]);
  const [picks, setPicks] = useState({});
  const [allPicks, setAllPicks] = useState({});
  const [tab, setTab] = useState("race");
  const [saved, setSaved] = useState(false);
  const [liveRaces, setLiveRaces] = useState({});
  const [liveMeetings, setLiveMeetings] = useState({});
  const [aiInsight, setAiInsight] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [activePromptKey, setActivePromptKey] = useState("");
  const boardRef = useRef(null);

  useEffect(() => { loadPicks(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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

    async function loadAiInsight() {
      const { data } = await supabase
        .from("ai_insights")
        .select("headline,summary,confidence,race_name,generated_at,metadata")
        .eq("scope", "upcoming_race")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ignore) setAiInsight(data || null);
    }

    loadSeasonSchedule();
    loadAiInsight();
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
    if (width < 1120) {
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
  const activeIndex = prompts.findIndex((prompt) => prompt.key === activePrompt?.key);
  const previousPrompt = activeIndex > 0 ? prompts[activeIndex - 1] : null;
  const nextPromptItem = activeIndex < prompts.length - 1 ? prompts[activeIndex + 1] : null;
  const color = rc(race);
  const meetingSessions = liveMeetings[race.r] || [];
  const totalPrompts = prompts.length;
  const done = prompts.filter((prompt) => !!picks[prompt.key]).length;
  const completion = totalPrompts ? Math.round((done / totalPrompts) * 100) : 0;

  const aiTargetsRace = aiInsight?.race_name === race.n;
  const aiPredictions = aiTargetsRace ? (aiInsight?.metadata?.category_predictions || []) : [];
  const aiByKey = useMemo(
    () => Object.fromEntries(aiPredictions.map((item) => [item.key, item])),
    [aiPredictions]
  );

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

  const currentValue = activePrompt ? picks[activePrompt.key] : null;
  const currentMeta = activePrompt ? selectionMeta(activePrompt, currentValue) : null;
  const boardAccent = currentMeta?.accent || color;
  const lockLabel = lockSession?.date_start ? formatLocalDateTime(lockSession.date_start) : null;
  const activeAi = activePrompt ? aiByKey[activePrompt.key] : null;
  const stageGrid = isMobile ? "1fr" : isTablet ? "1fr" : "332px minmax(0,1fr)";
  const optionGrid = activePrompt?.type === "constructor"
    ? (isMobile ? "1fr" : "repeat(auto-fit,minmax(260px,1fr))")
    : activePrompt?.type === "binary"
      ? (isMobile ? "1fr" : "repeat(2,minmax(0,1fr))")
      : (isMobile ? "1fr" : "repeat(auto-fit,minmax(220px,1fr))");

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 78px" : "36px 28px 82px", position: "relative", zIndex: 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "200px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        {isTablet ? (
          <section style={{ marginBottom: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
              Race board
            </div>
            <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(180px,1fr)", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {CAL.map((item) => (
                <RoundCard
                  key={item.r}
                  item={item}
                  active={race.r === item.r}
                  isSaved={!!allPicks[item.r]}
                  onClick={() => selectRace(item)}
                />
              ))}
            </div>
          </section>
        ) : (
          <aside style={{ position: "sticky", top: 96, alignSelf: "start", maxHeight: "calc(100vh - 120px)", overflowY: "auto", paddingRight: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
              Race board
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {CAL.map((item) => (
                <RoundCard
                  key={item.r}
                  item={item}
                  active={race.r === item.r}
                  isSaved={!!allPicks[item.r]}
                  onClick={() => selectRace(item)}
                />
              ))}
            </div>
          </aside>
        )}

        <main>
          <div style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: LIFTED_SHADOW }}>
            <div style={{ height: 4, background: `linear-gradient(90deg,${color},rgba(248,250,252,0.92))` }} />

            <div style={{ padding: isMobile ? "20px 18px 18px" : "24px 26px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: `linear-gradient(180deg,${hexToRgba(color, 0.08)},#0e1727)` }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 11px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", boxShadow: EDGE_RING, marginBottom: 16 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#dbe4f0" }}>
                    {race.sprint ? "Sprint-capable weekend" : "Race board"}
                  </span>
                </div>

                <h2 style={{ margin: "0 0 9px", fontSize: isMobile ? 34 : 48, fontWeight: 900, letterSpacing: isMobile ? -1.3 : -2.1, lineHeight: 0.95 }}>
                  {race.n}
                </h2>
                <div style={{ fontSize: isMobile ? 13 : 14, color: MUTED_TEXT, lineHeight: 1.75, maxWidth: 820, marginBottom: 14 }}>
                  Work the board from left to right: clear the front-running calls, then move into volatility and race-state picks before qualifying closes the round.
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#dbe4f0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "5px 9px" }}>
                    {race.circuit}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: MUTED_TEXT, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "5px 9px" }}>
                    {fmtFull(race.date)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#dbeafe", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 999, padding: "5px 9px" }}>
                    {done}/{totalPrompts} locked
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: MUTED_TEXT, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "5px 9px" }}>
                    {completion}% complete
                  </span>
                  {aiTargetsRace && (
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#93c5fd", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 999, padding: "5px 9px" }}>
                      AI live
                    </span>
                  )}
                  {race.sprint && (
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#fde68a", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.22)", borderRadius: 999, padding: "5px 9px" }}>
                      Sprint weekend
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: isMobile ? "14px 18px" : "14px 24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f8fafc", marginBottom: 5 }}>
                    {isSprintTab ? "Sprint picks lock" : "Predictions lock"}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: "#dbe4f0" }}>
                    {lockLabel ? `Closes at ${lockLabel}` : "Fetching qualifying schedule..."}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: MUTED_TEXT, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "5px 9px" }}>
                    Board closes before qualifying
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#dbeafe", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 999, padding: "5px 9px" }}>
                    {lockCountdown?.locked
                      ? "Locked"
                      : lockCountdown
                        ? `${lockCountdown.d ? `${lockCountdown.d}d ` : ""}${String(lockCountdown.h || 0).padStart(2, "0")}h ${String(lockCountdown.m || 0).padStart(2, "0")}m left`
                        : "Loading"}
                  </span>
                </div>
              </div>
            </div>

            {race.sprint && (
              <div style={{ display: "flex", gap: 8, padding: isMobile ? "10px 18px" : "10px 24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG, flexWrap: "wrap" }}>
                {[["race", "Race picks"], ["sprint", "Sprint picks"]].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTab(value)}
                    style={{
                      background: tab === value ? `linear-gradient(180deg,${hexToRgba(color, 0.16)},#111c30)` : PANEL_BG_ALT,
                      border: tab === value ? `1px solid ${hexToRgba(color, 0.24)}` : "1px solid rgba(148,163,184,0.12)",
                      borderRadius: 999,
                      color: tab === value ? "#fff" : MUTED_TEXT,
                      cursor: "pointer",
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ padding: isMobile ? 18 : 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: stageGrid, gap: 14, alignItems: "start" }}>
                <section style={{ order: isTablet ? 2 : 1, display: "grid", gap: 10 }}>
                  {prompts.map((prompt) => (
                    <PromptPill
                      key={prompt.key}
                      prompt={prompt}
                      value={picks[prompt.key]}
                      active={activePrompt?.key === prompt.key}
                      onClick={() => focusPromptBoard(prompt.key)}
                      accent={color}
                      aiItem={aiByKey[prompt.key]}
                    />
                  ))}
                </section>

                <section ref={boardRef} style={{ order: isTablet ? 3 : 2, borderRadius: 24, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: EDGE_RING }}>
                  <div style={{ padding: isMobile ? "18px 18px 16px" : "18px 20px 16px", borderBottom: `1px solid ${HAIRLINE}`, background: `linear-gradient(180deg,${hexToRgba(boardAccent, 0.1)},#0f182c)` }}>
                    <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) 240px", gap: 14, alignItems: "start" }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>
                          {activePrompt?.section || "Selection"}
                        </div>
                        <div style={{ fontSize: isMobile ? 30 : 34, fontWeight: 900, letterSpacing: isMobile ? -1 : -1.2, lineHeight: 0.98, marginBottom: 8 }}>
                          {activePrompt?.label}
                        </div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.72, color: MUTED_TEXT, maxWidth: 620 }}>
                          {activePrompt?.hint}
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#fff", background: hexToRgba(boardAccent, 0.18), border: `1px solid ${hexToRgba(boardAccent, 0.24)}`, borderRadius: 999, padding: "5px 9px" }}>
                            {activePrompt?.pts || 0} pts
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: currentMeta ? currentMeta.text : "#dbe4f0", background: currentMeta ? hexToRgba(currentMeta.accent, 0.22) : "rgba(148,163,184,0.08)", border: currentMeta ? `1px solid ${hexToRgba(currentMeta.accent, 0.3)}` : "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "5px 9px" }}>
                            {currentMeta ? currentMeta.label : emptySelectionLabel(activePrompt)}
                          </span>
                        </div>

                        {activeAi && (
                          <div style={{ borderRadius: 16, border: "1px solid rgba(96,165,250,0.2)", background: "rgba(59,130,246,0.08)", padding: "11px 12px 10px" }}>
                            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#93c5fd", marginBottom: 5 }}>
                              AI lean
                            </div>
                            <div style={{ fontSize: 13.5, fontWeight: 900, marginBottom: 5 }}>{activeAi.pick}</div>
                            <div style={{ fontSize: 10.5, lineHeight: 1.65, color: "#dbeafe" }}>{previewText(activeAi.reason, 120)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: isMobile ? 14 : 16 }}>
                    {activePrompt?.type === "driver" && (
                      <div style={{ display: "grid", gridTemplateColumns: optionGrid, gap: 10 }}>
                        {driverOptions.map((driver) => (
                          <DriverOption
                            key={`${activePrompt.key}-${driver.n}`}
                            driver={driver}
                            selected={picks[activePrompt.key] === driver.n}
                            aiMatch={predictionMatches(activePrompt, activeAi, driver.n)}
                            onClick={() => setPick(activePrompt.key, picks[activePrompt.key] === driver.n ? null : driver.n)}
                          />
                        ))}
                      </div>
                    )}

                    {activePrompt?.type === "constructor" && (
                      <div style={{ display: "grid", gridTemplateColumns: optionGrid, gap: 10 }}>
                        {constructorOptions.map((teamName) => (
                          <ConstructorOption
                            key={`${activePrompt.key}-${teamName}`}
                            teamName={teamName}
                            selected={picks[activePrompt.key] === teamName}
                            aiMatch={predictionMatches(activePrompt, activeAi, teamName)}
                            onClick={() => setPick(activePrompt.key, picks[activePrompt.key] === teamName ? null : teamName)}
                          />
                        ))}
                      </div>
                    )}

                    {activePrompt?.type === "binary" && (
                      <div style={{ display: "grid", gridTemplateColumns: optionGrid, gap: 12 }}>
                        <BinaryOption
                          label="Yes"
                          detail={activePrompt.key === "sc" ? "Race likely interrupted by at least one safety car." : "A stoppage feels likely this weekend."}
                          color="#34d399"
                          selected={picks[activePrompt.key] === "Yes"}
                          aiMatch={predictionMatches(activePrompt, activeAi, "Yes")}
                          onClick={() => setPick(activePrompt.key, picks[activePrompt.key] === "Yes" ? null : "Yes")}
                        />
                        <BinaryOption
                          label="No"
                          detail={activePrompt.key === "sc" ? "Clean race without a safety car period." : "No stoppage expected during the session."}
                          color="#f87171"
                          selected={picks[activePrompt.key] === "No"}
                          aiMatch={predictionMatches(activePrompt, activeAi, "No")}
                          onClick={() => setPick(activePrompt.key, picks[activePrompt.key] === "No" ? null : "No")}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "0 16px 16px", display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={() => previousPrompt && setActivePromptKey(previousPrompt.key)}
                        disabled={!previousPrompt}
                        style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.14)", borderRadius: 14, color: previousPrompt ? "#fff" : SUBTLE_TEXT, cursor: previousPrompt ? "pointer" : "default", fontSize: 12, fontWeight: 700, padding: "10px 13px" }}
                      >
                        Previous category
                      </button>
                      <button
                        onClick={() => nextPromptItem && setActivePromptKey(nextPromptItem.key)}
                        disabled={!nextPromptItem}
                        style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.14)", borderRadius: 14, color: nextPromptItem ? "#fff" : SUBTLE_TEXT, cursor: nextPromptItem ? "pointer" : "default", fontSize: 12, fontWeight: 700, padding: "10px 13px" }}
                      >
                        Next category
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto", gap: 12, alignItems: "center", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 12 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                          Board status
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.7, color: MUTED_TEXT }}>
                          {done}/{totalPrompts} locked. {aiTargetsRace ? `AI lean: ${activeAi ? activeAi.pick : "available in this race brief"}.` : "AI brief is tied to the next race."}
                        </div>
                        <div style={{ fontSize: 10.5, color: SUBTLE_TEXT }}>
                          Predictions close right before qualifying starts.
                        </div>
                      </div>

                      <button
                        onClick={save}
                        style={{ background: saved ? "linear-gradient(135deg,#10b981,#059669)" : BRAND_GRADIENT, border: "none", borderRadius: 16, color: "#fff", cursor: "pointer", fontWeight: 800, minWidth: isMobile ? "100%" : 184, padding: "14px 15px", fontSize: 14, boxShadow: saved ? "0 14px 30px rgba(16,185,129,0.16)" : "0 16px 34px rgba(249,115,22,0.16)" }}
                      >
                        {saved ? "Predictions Saved" : "Save Predictions"}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
