import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { CONSTRUCTORS, DRV, TEAMS } from "../constants/teams";
import { CAL, fmt, fmtFull, nextRace, rc } from "../constants/calendar";
import { PTS } from "../constants/scoring";
import { fetchMeetingSessions, fetchRaceSessions } from "../openf1";
import {
  ACCENT,
  BG_BASE,
  CARD_RADIUS,
  CONTENT_MAX,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  RADIUS_MD,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  SUCCESS,
  TEXT_PRIMARY,
} from "../constants/design";
import { requireActiveSession } from "../authProfile";
import { formatDnfDrivers, matchesDnfPick } from "../resultHelpers";
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

function previewText(value, max = 110) {
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
      prompts: [
        { key: "pole", label: "Pole Position", type: "driver", pts: PTS.pole, hint: "Who is quickest over one lap." },
        { key: "winner", label: "Race Winner", type: "driver", pts: PTS.winner, hint: "Pick the Sunday winner." },
        { key: "p2", label: "2nd Place", type: "driver", pts: PTS.p2, hint: "Who crosses the line in second." },
        { key: "p3", label: "3rd Place", type: "driver", pts: PTS.p3, hint: "Who completes the podium." },
      ],
    },
    {
      title: "Volatility",
      prompts: [
        { key: "dnf", label: "DNF Driver", type: "driver", pts: PTS.dnf, hint: "Driver most likely not to finish." },
        { key: "fl", label: "Fastest Lap", type: "driver", pts: PTS.fl, hint: "Late-race pace or outright control." },
        { key: "dotd", label: "Driver of the Day", type: "driver", pts: PTS.dotd, hint: "Fan-voted race standout." },
      ],
    },
    {
      title: "Team and race state",
      prompts: [
        { key: "ctor", label: "Constructor with Most Points", type: "constructor", pts: PTS.ctor, hint: "Team likely to own the weekend." },
        { key: "sc", label: "Safety Car?", type: "binary", pts: PTS.sc, hint: "Will there be a safety car period?" },
        { key: "rf", label: "Red Flag?", type: "binary", pts: PTS.rf, hint: "Will the session be stopped?" },
      ],
    },
  ];
}

function flattenPromptGroups(groups) {
  return groups.flatMap((group) => group.prompts.map((prompt) => ({
    ...prompt,
    section: group.title,
  })));
}

function selectionMeta(prompt, value) {
  if (!value) return null;

  if (prompt.type === "driver") {
    const driver = driverByName(value);
    const team = driver ? TEAMS[driver.t] : null;
    return {
      label: value,
      accent: team?.c || ACCENT,
      secondary: driver?.t || null,
    };
  }

  if (prompt.type === "constructor") {
    const team = TEAMS[value];
    return {
      label: value,
      accent: team?.c || SUCCESS,
      secondary: value,
    };
  }

  return {
    label: value,
    accent: value === "Yes" ? SUCCESS : "#EF4444",
    secondary: value === "Yes" ? "Interruption expected" : "Clean running expected",
  };
}

function emptySelectionLabel(prompt) {
  if (!prompt) return "";
  if (prompt.type === "binary") return "Not answered";
  if (prompt.type === "constructor") return "No constructor selected";
  return "No driver selected";
}

function hasSavedPickContent(picks) {
  return !!picks && Object.values(picks).some(Boolean);
}

function hasScoredPrediction(prediction) {
  return !!prediction && prediction.score_breakdown !== null && prediction.score_breakdown !== undefined;
}

function getRaceEndTimestamp(race, liveRace) {
  const liveDate = liveRace?.date_end || liveRace?.date_start;
  if (liveDate) {
    const timestamp = new Date(liveDate).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return new Date(`${race.date}T23:59:59`).getTime();
}

function resultValueForKey(results, key) {
  if (!results) return null;

  switch (key) {
    case "pole":
      return results.pole || null;
    case "winner":
      return results.winner || null;
    case "p2":
      return results.p2 || null;
    case "p3":
      return results.p3 || null;
    case "dnf":
      return formatDnfDrivers(results);
    case "fl":
      return results.fastest_lap || null;
    case "dotd":
      return results.dotd || null;
    case "ctor":
      return results.best_constructor || null;
    case "sc":
      return typeof results.safety_car === "boolean" ? (results.safety_car ? "Yes" : "No") : null;
    case "rf":
      return typeof results.red_flag === "boolean" ? (results.red_flag ? "Yes" : "No") : null;
    case "sp_pole":
      return results.sp_pole || null;
    case "sp_winner":
      return results.sp_winner || null;
    case "sp_p2":
      return results.sp_p2 || null;
    case "sp_p3":
      return results.sp_p3 || null;
    default:
      return null;
  }
}

function reviewRowsForPrompts(prompts, picks, results, breakdown) {
  return prompts.map((prompt) => {
    const pick = picks?.[prompt.key] || null;
    const actual = resultValueForKey(results, prompt.key);
    const hit = prompt.key === "dnf"
      ? matchesDnfPick(pick, results)
      : (!!pick && actual !== null && pick === actual);
    const breakdownItem = Array.isArray(breakdown)
      ? breakdown.find((item) => item.label === prompt.label)
      : null;

    return {
      key: prompt.key,
      label: prompt.label,
      pick,
      actual,
      hit,
      points: hit ? Number(breakdownItem?.pts || prompt.pts || 0) : 0,
    };
  });
}

function predictionMatches(prompt, item, value) {
  if (!prompt || !item) return false;
  return item.pick === value;
}

function roundSidebarStatus(item, liveRace, resultRow, now, isSaved) {
  const raceEnded = getRaceEndTimestamp(item, liveRace) <= now;

  if (resultRow?.results_entered) {
    return {
      kind: "scored",
      accent: SUCCESS,
      surface: "rgba(34,197,94,0.08)",
      outline: "rgba(34,197,94,0.18)",
      text: "#dcfce7",
    };
  }

  if (raceEnded) {
    return {
      kind: "past",
      accent: "#60A5FA",
      surface: "rgba(59,130,246,0.10)",
      outline: "rgba(96,165,250,0.18)",
      text: "#bfdbfe",
    };
  }

  if (isSaved) {
    return {
      kind: "saved",
      accent: SUCCESS,
      surface: "rgba(34,197,94,0.06)",
      outline: "rgba(34,197,94,0.14)",
      text: "#dcfce7",
    };
  }

  return {
    kind: "upcoming",
    accent: "#64748B",
    surface: PANEL_BG,
    outline: "rgba(255,255,255,0.06)",
    text: SUBTLE_TEXT,
  };
}

function SidebarFilterButton({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: 34,
        padding: "0 12px",
        borderRadius: 999,
        border: active ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.06)",
        background: active ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
        color: active ? ACCENT : MUTED_TEXT,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function RoundSidebarItem({ item, active, isSaved, onClick, status }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "44px minmax(0,1fr)",
        gap: 12,
        alignItems: "center",
        border: "none",
        borderRadius: CARD_RADIUS,
        background: active ? hexToRgba(status.accent, 0.18) : status.surface,
        padding: "12px 14px",
        textAlign: "left",
        cursor: "pointer",
        boxShadow: active
          ? `inset 3px 0 0 ${status.accent}, 0 0 0 1px ${status.outline}`
          : `inset 0 0 0 1px ${status.outline}`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: active ? hexToRgba(status.accent, 0.14) : BG_BASE,
          border: `2px solid ${active ? status.accent : status.outline}`,
          boxShadow: active ? `0 0 16px ${hexToRgba(status.accent, 0.22)}` : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 800,
          color: active ? TEXT_PRIMARY : status.kind === "past" ? "#dbeafe" : TEXT_PRIMARY,
        }}
      >
        {item.r}
        {item.sprint && (
          <span
            title="Sprint weekend"
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#A855F7",
              boxShadow: "0 0 10px rgba(168,85,247,0.55)",
            }}
          />
        )}
        {isSaved && (
          <span
            title="Board saved"
            style={{
              position: "absolute",
              bottom: 1,
              right: 1,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: SUCCESS,
              boxShadow: "0 0 10px rgba(34,197,94,0.45)",
              border: `2px solid ${BG_BASE}`,
            }}
          />
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: active ? 700 : 600,
            color: TEXT_PRIMARY,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 4,
          }}
        >
          {item.n}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: active ? status.accent : status.outline,
            }}
          />
          <span style={{ fontSize: 12, color: status.text }}>{fmt(item.date)}</span>
        </div>
      </div>
    </button>
  );
}

function PredictionCard({ prompt, value, active, onClick, aiItem }) {
  const meta = selectionMeta(prompt, value);
  const leftAccent = value ? SUCCESS : active ? ACCENT : "transparent";
  const statusColor = value ? SUCCESS : ACCENT;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        border: "none",
        borderRadius: CARD_RADIUS,
        background: active ? PANEL_BG_ALT : PANEL_BG,
        boxShadow: `inset 3px 0 0 ${leftAccent}`,
        padding: 20,
        textAlign: "left",
        cursor: "pointer",
        minHeight: 148,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 18 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusColor,
              animation: value ? "none" : "pulseDot 2s infinite",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
            {prompt.section}
          </span>
        </div>
        <span style={{ borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600, background: BG_BASE, color: SUBTLE_TEXT }}>
          {prompt.pts} pts
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: TEXT_PRIMARY, marginBottom: 8 }}>
        {prompt.label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: meta ? TEXT_PRIMARY : MUTED_TEXT, marginBottom: 10 }}>
        {meta ? meta.label : emptySelectionLabel(prompt)}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: MUTED_TEXT, marginBottom: aiItem ? 12 : 0 }}>
        {prompt.hint}
      </div>
      {aiItem && (
        <div style={{ fontSize: 12, color: "#93c5fd", lineHeight: 1.5 }}>
          AI Insight: {aiItem.pick}
        </div>
      )}
    </button>
  );
}

function DriverOption({ driver, selected, onClick, aiMatch = false, disabled = false }) {
  const team = TEAMS[driver.t];

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 84,
        border: "none",
        borderRadius: RADIUS_MD,
        background: selected ? PANEL_BG_ALT : BG_BASE,
        boxShadow: `inset 3px 0 0 ${team.c}${selected ? ", 0 0 0 1px rgba(255,255,255,0.04)" : ""}`,
        padding: "14px 16px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.72 : 1,
      }}
      disabled={disabled}
    >
      <div style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: hexToRgba(team.c, 0.15),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: team.c,
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {driver.nb ? `#${driver.nb}` : "NEW"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>
            {driver.n}
          </div>
          <div style={{ fontSize: 11, color: SUBTLE_TEXT }}>{driver.t}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {aiMatch && (
            <span
              title="AI match"
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#60A5FA",
                boxShadow: "0 0 10px rgba(96,165,250,0.45)",
              }}
            />
          )}
          {selected && (
            <span
              title="Selected"
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: hexToRgba(SUCCESS, 0.18),
                border: `2px solid ${SUCCESS}`,
                boxShadow: "0 0 12px rgba(34,197,94,0.32)",
              }}
            />
          )}
        </div>
      </div>
    </button>
  );
}

function ConstructorOption({ teamName, selected, onClick, aiMatch = false, disabled = false }) {
  const team = TEAMS[teamName];
  const teammates = DRV.filter((driver) => driver.t === teamName).map((driver) => driver.s).join(" · ");

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 84,
        border: "none",
        borderRadius: RADIUS_MD,
        background: selected ? PANEL_BG_ALT : BG_BASE,
        boxShadow: `inset 3px 0 0 ${team.c}`,
        padding: "14px 16px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.72 : 1,
      }}
      disabled={disabled}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 4 }}>{teamName}</div>
          <div style={{ fontSize: 11, color: SUBTLE_TEXT }}>{teammates || "Team pair pending"}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {aiMatch && (
            <span
              title="AI match"
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#60A5FA",
                boxShadow: "0 0 10px rgba(96,165,250,0.45)",
              }}
            />
          )}
          {selected && (
            <span
              title="Selected"
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: hexToRgba(SUCCESS, 0.18),
                border: `2px solid ${SUCCESS}`,
                boxShadow: "0 0 12px rgba(34,197,94,0.32)",
              }}
            />
          )}
        </div>
      </div>
    </button>
  );
}

function BinaryOption({ label, detail, color, selected, onClick, aiMatch = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 104,
        border: "none",
        borderRadius: RADIUS_MD,
        background: selected ? PANEL_BG_ALT : BG_BASE,
        boxShadow: `inset 3px 0 0 ${color}`,
        padding: "16px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.72 : 1,
      }}
      disabled={disabled}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}>{label}</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {aiMatch && (
            <span
              title="AI match"
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#60A5FA",
                boxShadow: "0 0 10px rgba(96,165,250,0.45)",
              }}
            />
          )}
          {selected && (
            <span
              title="Selected"
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: hexToRgba(SUCCESS, 0.18),
                border: `2px solid ${SUCCESS}`,
                boxShadow: "0 0 12px rgba(34,197,94,0.32)",
              }}
            />
          )}
        </div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: MUTED_TEXT }}>{detail}</div>
    </button>
  );
}

function ReviewMetric({ label, value, detail, accent = "#f8fafc" }) {
  return (
    <div
      style={{
        borderRadius: CARD_RADIUS,
        border: "1px solid rgba(148,163,184,0.14)",
        background: PANEL_BG_ALT,
        padding: "16px 16px 15px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8, color: accent, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: MUTED_TEXT }}>{detail}</div>
    </div>
  );
}

export default function PredictionsPage({ user, openAuth }) {
  const { isMobile, isTablet } = useViewport();
  const [race, setRace] = useState(nextRace() || CAL[0]);
  const [sidebarFilter, setSidebarFilter] = useState("all");
  const [picks, setPicks] = useState({});
  const [predictionsByRound, setPredictionsByRound] = useState({});
  const [resultsByRound, setResultsByRound] = useState({});
  const [tab, setTab] = useState("race");
  const [saved, setSaved] = useState(false);
  const [liveRaces, setLiveRaces] = useState({});
  const [liveMeetings, setLiveMeetings] = useState({});
  const [aiInsight, setAiInsight] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [activePromptKey, setActivePromptKey] = useState("");
  const boardRef = useRef(null);

  useEffect(() => {
    loadPicks();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let ignore = false;

    async function loadRoundResults() {
      const { data } = await supabase.from("race_results").select("*");
      if (ignore || !data) return;

      const mapped = {};
      data.forEach((row) => {
        mapped[row.race_round] = row;
      });
      setResultsByRound(mapped);
    }

    loadRoundResults();
    return () => {
      ignore = true;
    };
  }, []);

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
    return () => {
      ignore = true;
    };
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
    return () => {
      ignore = true;
    };
  }, [race, liveRaces, liveMeetings]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const loadPicks = async () => {
    if (!user) {
      setPredictionsByRound({});
      setPicks({});
      return;
    }
    const { data } = await supabase.from("predictions").select("*").eq("user_id", user.id);
    if (data) {
      const mapped = {};
      data.forEach((row) => {
        mapped[row.race_round] = row;
      });
      setPredictionsByRound(mapped);
      setPicks(mapped[race.r]?.picks || {});
    }
  };

  const selectRace = (selectedRace) => {
    setRace(selectedRace);
    setSaved(false);
    setPicks(predictionsByRound[selectedRace.r]?.picks || {});
    setTab("race");
  };

  const setPick = (key, value) => {
    if (editingLocked) return;
    setPicks((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const focusPrompt = (promptKey) => {
    setActivePromptKey(promptKey);
    if (isTablet) {
      window.requestAnimationFrame(() => {
        boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const save = async () => {
    if (!user) return openAuth("login");
    if (editingLocked) return;

    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("predictions").upsert(
      { user_id: user.id, race_round: race.r, picks, updated_at: updatedAt },
      { onConflict: "user_id,race_round" }
    );
    if (error) {
      alert(error.message);
      return;
    }
    setPredictionsByRound((current) => ({
      ...current,
      [race.r]: {
        ...(current[race.r] || {}),
        user_id: user.id,
        race_round: race.r,
        picks,
        updated_at: updatedAt,
      },
    }));
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
  const selectedPrediction = predictionsByRound[race.r] || null;
  const selectedResult = resultsByRound[race.r] || null;
  const liveRace = liveRaces[race.r] || null;
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

  const raceHasPassed = useMemo(
    () => getRaceEndTimestamp(race, liveRace) <= now,
    [race, liveRace, now]
  );

  const resultsEntered = !!selectedResult?.results_entered;
  const predictionScored = hasScoredPrediction(selectedPrediction);
  const reviewReady = !!selectedPrediction && resultsEntered && raceHasPassed && predictionScored;
  const editingLocked = !!lockCountdown?.locked || raceHasPassed || resultsEntered;
  const showReviewOnly = raceHasPassed || resultsEntered;
  const reviewRows = useMemo(
    () => reviewRowsForPrompts(prompts, selectedPrediction?.picks || {}, selectedResult, selectedPrediction?.score_breakdown || []),
    [prompts, selectedPrediction, selectedResult]
  );
  const summaryRows = reviewRows.filter((row) => row.pick || row.actual);
  const hits = reviewRows.filter((row) => row.hit).length;
  const attemptedReviewRows = reviewRows.filter((row) => row.pick);
  const misses = attemptedReviewRows.length - hits;
  const savedPickCount = Object.values(selectedPrediction?.picks || {}).filter(Boolean).length;
  const perfectPodiumHit = ["winner", "p2", "p3"].every((key) => reviewRows.some((row) => row.key === key && row.hit));
  const podiumBonus = Array.isArray(selectedPrediction?.score_breakdown)
    ? (selectedPrediction.score_breakdown.find((item) => item.label === "Perfect Podium Bonus") || (perfectPodiumHit ? { label: "Perfect Podium Bonus", pts: PTS.perfectPodium } : null))
    : (perfectPodiumHit ? { label: "Perfect Podium Bonus", pts: PTS.perfectPodium } : null);
  const displayReviewScore = reviewRows.reduce((sum, row) => sum + Number(row.points || 0), 0) + Number(podiumBonus?.pts || 0);
  const lockLabel = lockSession?.date_start ? formatLocalDateTime(lockSession.date_start) : null;
  const roundHasSavedBoard = hasSavedPickContent(predictionsByRound[race.r]?.picks);
  const statusMessage = reviewReady
    ? "Scored round. Review every hit below."
    : resultsEntered
      ? "Results are in. This board is closed while scoring settles."
      : editingLocked
        ? (lockLabel ? `Closed at ${lockLabel}. This board is now read-only.` : "This round is locked.")
        : (lockLabel ? `Build your board before ${lockLabel}.` : "Build and save before qualifying starts.");
  const saveLabel = reviewReady
    ? "Round Scored"
    : resultsEntered
      ? "Round Closed"
      : editingLocked
        ? "Predictions Locked"
        : saved
          ? "Predictions Saved"
          : "Save Predictions";

  const driverOptions = useMemo(() => (
    [...DRV].sort((left, right) => {
      const leftRank = driverRank.get(left.n);
      const rightRank = driverRank.get(right.n);
      if ((leftRank?.teamRank ?? 999) !== (rightRank?.teamRank ?? 999)) {
        return (leftRank?.teamRank ?? 999) - (rightRank?.teamRank ?? 999);
      }
      return (leftRank?.index ?? 999) - (rightRank?.index ?? 999);
    })
  ), []);

  const constructorOptions = useMemo(
    () => [...CONSTRUCTORS].sort((left, right) => (constructorRank.get(left) ?? 999) - (constructorRank.get(right) ?? 999)),
    []
  );

  const currentValue = activePrompt ? picks[activePrompt.key] : null;
  const currentMeta = activePrompt ? selectionMeta(activePrompt, currentValue) : null;
  const activeAi = activePrompt ? aiByKey[activePrompt.key] : null;
  const optionGrid = activePrompt?.type === "constructor"
    ? (isMobile ? "1fr" : "repeat(2,minmax(0,1fr))")
    : activePrompt?.type === "binary"
      ? (isMobile ? "1fr" : "repeat(2,minmax(0,1fr))")
      : (isMobile ? "1fr" : isTablet ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))");
  const sidebarRaces = useMemo(() => (
    CAL.filter((item) => {
      if (sidebarFilter === "all") return true;
      const resultRow = resultsByRound[item.r] || null;
      const liveRaceRow = liveRaces[item.r] || null;
      const past = !!resultRow?.results_entered || getRaceEndTimestamp(item, liveRaceRow) <= now;
      return sidebarFilter === "past" ? past : !past;
    })
  ), [sidebarFilter, resultsByRound, liveRaces, now]);

  useEffect(() => {
    if (!sidebarRaces.length) return;
    if (!sidebarRaces.some((item) => item.r === race.r)) {
      selectRace(sidebarRaces[0]);
    }
  }, [sidebarRaces, race.r]); // eslint-disable-line react-hooks/exhaustive-deps

  const stateTone = reviewReady
    ? {
      label: "Scored",
      accent: SUCCESS,
      surface: "rgba(34,197,94,0.08)",
      outline: "rgba(34,197,94,0.16)",
      detail: "Points awarded",
    }
    : resultsEntered || raceHasPassed || lockCountdown?.locked
      ? {
        label: "Locked",
        accent: "#60A5FA",
        surface: "rgba(59,130,246,0.10)",
        outline: "rgba(96,165,250,0.16)",
        detail: lockLabel ? `Closed ${lockLabel}` : "Editing closed",
      }
      : roundHasSavedBoard
        ? {
          label: "Ready",
          accent: SUCCESS,
          surface: "rgba(34,197,94,0.06)",
          outline: "rgba(34,197,94,0.14)",
          detail: lockLabel ? `Closes ${lockLabel}` : "Board saved",
        }
        : {
          label: "Open",
          accent: ACCENT,
          surface: "rgba(249,115,22,0.08)",
          outline: "rgba(249,115,22,0.16)",
          detail: lockLabel ? `Closes ${lockLabel}` : "Open for picks",
        };

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
      <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "260px minmax(0,1fr)", gap: 24, alignItems: "start" }}>
        {isTablet ? (
          <section>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {[["all", "All"], ["upcoming", "Upcoming"], ["past", "Past"]].map(([value, label]) => (
                <SidebarFilterButton key={value} active={sidebarFilter === value} label={label} onClick={() => setSidebarFilter(value)} />
              ))}
            </div>
            <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(220px,1fr)", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
              {sidebarRaces.map((item) => (
                <RoundSidebarItem
                  key={item.r}
                  item={item}
                  active={race.r === item.r}
                  isSaved={hasSavedPickContent(predictionsByRound[item.r]?.picks)}
                  status={roundSidebarStatus(
                    item,
                    liveRaces[item.r] || null,
                    resultsByRound[item.r] || null,
                    now,
                    hasSavedPickContent(predictionsByRound[item.r]?.picks)
                  )}
                  onClick={() => selectRace(item)}
                />
              ))}
            </div>
          </section>
        ) : (
          <aside style={{ position: "sticky", top: 96, display: "grid", gap: 12, maxHeight: "calc(100vh - 120px)", overflowY: "auto", paddingRight: 4 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
              {[["all", "All"], ["upcoming", "Upcoming"], ["past", "Past"]].map(([value, label]) => (
                <SidebarFilterButton key={value} active={sidebarFilter === value} label={label} onClick={() => setSidebarFilter(value)} />
              ))}
            </div>
            {sidebarRaces.map((item) => (
              <RoundSidebarItem
                key={item.r}
                item={item}
                active={race.r === item.r}
                isSaved={hasSavedPickContent(predictionsByRound[item.r]?.picks)}
                status={roundSidebarStatus(
                  item,
                  liveRaces[item.r] || null,
                  resultsByRound[item.r] || null,
                  now,
                  hasSavedPickContent(predictionsByRound[item.r]?.picks)
                )}
                onClick={() => selectRace(item)}
              />
            ))}
          </aside>
        )}

        <main style={{ display: "grid", gap: 24 }}>
          <section style={{ borderRadius: SECTION_RADIUS, background: PANEL_BG, boxShadow: LIFTED_SHADOW, overflow: "hidden" }}>
            <div style={{ height: 3, background: `linear-gradient(90deg,${ACCENT},${color}, transparent)` }} />
            <div style={{ padding: isMobile ? "22px 20px" : "24px 28px", background: PANEL_BG_ALT, borderBottom: `1px solid ${HAIRLINE}` }}>
              <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) auto", gap: 20, alignItems: "start" }}>
                <div>
                  <h1 style={{ fontSize: isMobile ? 36 : 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 10 }}>
                    {race.n}
                  </h1>
                  <div style={{ fontSize: 15, lineHeight: 1.6, color: MUTED_TEXT, maxWidth: 640, marginBottom: 14 }}>
                    {statusMessage}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(255,255,255,0.06)", color: TEXT_PRIMARY }}>
                      {race.circuit}
                    </span>
                    <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(255,255,255,0.06)", color: TEXT_PRIMARY }}>
                      {fmtFull(race.date)}
                    </span>
                    {race.sprint && <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#A855F7", boxShadow: "0 0 12px rgba(168,85,247,0.45)" }} />}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12, minWidth: isTablet ? "auto" : 240 }}>
                  <div
                    style={{
                      borderRadius: CARD_RADIUS,
                      background: stateTone.surface,
                      boxShadow: `inset 0 0 0 1px ${stateTone.outline}`,
                      padding: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: stateTone.accent,
                          boxShadow: `0 0 12px ${hexToRgba(stateTone.accent, 0.35)}`,
                        }}
                      />
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: stateTone.accent }}>
                        {stateTone.label}
                      </div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>
                      {reviewReady
                        ? "Review ready"
                        : lockCountdown && !lockCountdown.locked && !resultsEntered && !raceHasPassed
                          ? `${lockCountdown.d ? `${lockCountdown.d}d ` : ""}${String(lockCountdown.h || 0).padStart(2, "0")}h ${String(lockCountdown.m || 0).padStart(2, "0")}m`
                          : stateTone.detail}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: MUTED_TEXT }}>
                      {roundHasSavedBoard && !showReviewOnly
                        ? "Your board is already stored."
                        : reviewReady
                          ? "Points awarded and locked."
                          : lockCountdown && !lockCountdown.locked && !resultsEntered && !raceHasPassed
                            ? "Save before qualifying starts."
                            : "Editing closed."}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {race.sprint && (
              <div style={{ padding: "14px 24px", borderBottom: `1px solid ${HAIRLINE}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["race", "Race picks"], ["sprint", "Sprint picks"]].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTab(value)}
                    style={{
                      minHeight: 38,
                      padding: "0 18px",
                      borderRadius: 999,
                      border: tab === value ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.06)",
                      background: tab === value ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                      color: tab === value ? ACCENT : MUTED_TEXT,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {!showReviewOnly && (
              <div style={{ padding: isMobile ? 20 : 24 }}>
                {groups.map((group) => (
                  <div key={group.title} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
                      {group.title}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 16 }}>
                      {group.prompts.map((prompt) => (
                        <PredictionCard
                          key={prompt.key}
                          prompt={prompt}
                          value={picks[prompt.key]}
                          active={activePrompt?.key === prompt.key}
                          aiItem={aiByKey[prompt.key]}
                          onClick={() => focusPrompt(prompt.key)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(reviewReady || editingLocked) && (
            <section style={{ borderRadius: SECTION_RADIUS, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
              <div style={{ padding: isMobile ? "20px" : "24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                  {reviewReady ? "Round review" : "Round status"}
                </div>
                <div style={{ fontSize: isMobile ? 28 : 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 8 }}>
                  {reviewReady ? "Where your points came from" : "This board is now locked"}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.6, color: MUTED_TEXT, maxWidth: 760 }}>
                  {reviewReady
                    ? "Once a Grand Prix has finished and scoring is complete, your board switches into review mode so you can see every hit, miss, and bonus."
                    : hasSavedPickContent(selectedPrediction?.picks)
                      ? `You saved ${savedPickCount} picks for this round. Editing is closed now, and scoring will appear here once the Grand Prix is processed.`
                      : "This round is closed, and you cannot submit or edit picks anymore."}
                </div>
              </div>

              <div style={{ padding: isMobile ? 20 : 24, display: "grid", gap: 18 }}>
                {reviewReady ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 12 }}>
                      <ReviewMetric
                        label="Round score"
                        value={`${displayReviewScore} pts`}
                        detail={`${race.n} total across the full round`}
                        accent="#facc15"
                      />
                      <ReviewMetric
                        label="Correct calls"
                        value={String(hits)}
                        detail={`Matched categories on the ${tab === "sprint" ? "sprint" : "race"} board`}
                        accent={SUCCESS}
                      />
                      <ReviewMetric
                        label="Misses"
                        value={String(Math.max(misses, 0))}
                        detail="Categories that did not land this time"
                        accent="#f87171"
                      />
                      <ReviewMetric
                        label="Podium bonus"
                        value={podiumBonus ? `+${podiumBonus.pts}` : "No"}
                        detail={podiumBonus ? "Perfect podium bonus awarded" : "No perfect podium this round"}
                        accent={podiumBonus ? "#93c5fd" : "#cbd5e1"}
                      />
                    </div>

                    <div style={{ borderRadius: CARD_RADIUS, border: "1px solid rgba(148,163,184,0.14)", overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr) 92px" : "minmax(180px,1fr) minmax(180px,1fr) minmax(180px,1fr) 92px", background: PANEL_BG_ALT, borderBottom: `1px solid ${HAIRLINE}` }}>
                        {(isMobile ? ["Category", "Points"] : ["Category", "Your pick", "Result", "Points"]).map((heading, index) => (
                          <div key={heading} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, textAlign: index === (isMobile ? 1 : 3) ? "right" : "left" }}>
                            {heading}
                          </div>
                        ))}
                      </div>

                      {reviewRows.map((row, index) => (
                        <div
                          key={row.key}
                          style={{
                            display: "grid",
                            gridTemplateColumns: isMobile ? "minmax(0,1fr) 92px" : "minmax(180px,1fr) minmax(180px,1fr) minmax(180px,1fr) 92px",
                            alignItems: "center",
                            borderBottom: index < reviewRows.length - 1 ? `1px solid ${HAIRLINE}` : "none",
                            background: index % 2 === 0 ? PANEL_BG : PANEL_BG_ALT,
                          }}
                        >
                          <div style={{ padding: "13px 14px" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{row.label}</div>
                            <div style={{ fontSize: 11, color: row.hit ? SUCCESS : SUBTLE_TEXT }}>
                              {row.hit ? "Correct call" : "Missed"}
                            </div>
                            {isMobile ? (
                              <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12, color: MUTED_TEXT }}>
                                <div>Your pick: <span style={{ color: TEXT_PRIMARY }}>{row.pick || "—"}</span></div>
                                <div>Result: <span style={{ color: TEXT_PRIMARY }}>{row.actual || "Pending"}</span></div>
                              </div>
                            ) : null}
                          </div>

                          {!isMobile ? (
                            <div style={{ padding: "13px 14px", fontSize: 13, color: row.pick ? TEXT_PRIMARY : MUTED_TEXT }}>
                              {row.pick || "No pick"}
                            </div>
                          ) : null}

                          {!isMobile ? (
                            <div style={{ padding: "13px 14px", fontSize: 13, color: row.actual ? TEXT_PRIMARY : MUTED_TEXT }}>
                              {row.actual || "Pending"}
                            </div>
                          ) : null}

                          <div style={{ padding: "13px 14px", textAlign: "right", fontSize: 18, fontWeight: 900, color: row.hit ? "#facc15" : SUBTLE_TEXT }}>
                            {row.hit ? row.points : "0"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ borderRadius: CARD_RADIUS, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: "16px 18px", fontSize: 14, lineHeight: 1.7, color: MUTED_TEXT }}>
                      {hasSavedPickContent(selectedPrediction?.picks)
                        ? (raceHasPassed
                          ? "This Grand Prix is already in the books, so your board stays in summary mode until scoring is complete."
                          : "Predictions are locked for this round. Your saved board is preserved below until scoring is ready.")
                        : "There is no saved board to review for this round."}
                    </div>

                    {hasSavedPickContent(selectedPrediction?.picks) && (
                      <div style={{ borderRadius: CARD_RADIUS, border: "1px solid rgba(148,163,184,0.14)", overflow: "hidden" }}>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr) 128px" : "minmax(180px,1fr) minmax(180px,1fr) 140px", background: PANEL_BG_ALT, borderBottom: `1px solid ${HAIRLINE}` }}>
                          {(isMobile ? ["Category", "Status"] : ["Category", "Your pick", "Status"]).map((heading, index) => (
                            <div key={heading} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, textAlign: index === (isMobile ? 1 : 2) ? "right" : "left" }}>
                              {heading}
                            </div>
                          ))}
                        </div>

                        {summaryRows.map((row, index) => (
                          <div
                            key={row.key}
                            style={{
                              display: "grid",
                              gridTemplateColumns: isMobile ? "minmax(0,1fr) 128px" : "minmax(180px,1fr) minmax(180px,1fr) 140px",
                              alignItems: "center",
                              borderBottom: index < summaryRows.length - 1 ? `1px solid ${HAIRLINE}` : "none",
                              background: index % 2 === 0 ? PANEL_BG : PANEL_BG_ALT,
                            }}
                          >
                            <div style={{ padding: "13px 14px" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{row.label}</div>
                              {isMobile ? (
                                <div style={{ fontSize: 12, color: row.pick ? TEXT_PRIMARY : MUTED_TEXT }}>
                                  {row.pick || "No pick saved"}
                                </div>
                              ) : null}
                            </div>

                            {!isMobile ? (
                              <div style={{ padding: "13px 14px", fontSize: 13, color: row.pick ? TEXT_PRIMARY : MUTED_TEXT }}>
                                {row.pick || "No pick"}
                              </div>
                            ) : null}

                            <div style={{ padding: "13px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: row.actual ? "#93c5fd" : SUBTLE_TEXT }}>
                              {row.actual || (raceHasPassed ? "Awaiting scoring" : "Locked")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {!showReviewOnly && (
            <section ref={boardRef} style={{ borderRadius: SECTION_RADIUS, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
              <div style={{ padding: isMobile ? "20px" : "24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) auto", gap: 20, alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                      Active category
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 8 }}>
                      {activePrompt?.label}
                    </div>
                    <div style={{ fontSize: 15, lineHeight: 1.6, color: MUTED_TEXT, maxWidth: 640 }}>
                      {activePrompt?.hint}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10, minWidth: isTablet ? "auto" : 240 }}>
                    <span style={{ borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600, background: BG_BASE, color: SUBTLE_TEXT, width: "fit-content" }}>
                      {activePrompt?.pts || 0} pts
                    </span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: currentMeta ? TEXT_PRIMARY : MUTED_TEXT }}>
                      {currentMeta ? currentMeta.label : emptySelectionLabel(activePrompt)}
                    </div>
                    {activeAi && (
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: "#93c5fd" }}>
                        AI Insight: {activeAi.pick}. {previewText(activeAi.reason, 88)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: isMobile ? 20 : 24 }}>
                {activePrompt?.type === "driver" && (
                  <div style={{ display: "grid", gridTemplateColumns: optionGrid, gap: 10 }}>
                    {driverOptions.map((driver) => (
                      <DriverOption
                        key={`${activePrompt.key}-${driver.n}`}
                        driver={driver}
                        selected={picks[activePrompt.key] === driver.n}
                        aiMatch={predictionMatches(activePrompt, activeAi, driver.n)}
                        disabled={editingLocked}
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
                        disabled={editingLocked}
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
                      color={SUCCESS}
                      selected={picks[activePrompt.key] === "Yes"}
                      aiMatch={predictionMatches(activePrompt, activeAi, "Yes")}
                      disabled={editingLocked}
                      onClick={() => setPick(activePrompt.key, picks[activePrompt.key] === "Yes" ? null : "Yes")}
                    />
                    <BinaryOption
                      label="No"
                      detail={activePrompt.key === "sc" ? "Clean race without a safety car period." : "No stoppage expected during the session."}
                      color="#EF4444"
                      selected={picks[activePrompt.key] === "No"}
                      aiMatch={predictionMatches(activePrompt, activeAi, "No")}
                      disabled={editingLocked}
                      onClick={() => setPick(activePrompt.key, picks[activePrompt.key] === "No" ? null : "No")}
                    />
                  </div>
                )}
              </div>

              <div style={{ padding: "0 24px 24px", display: "grid", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingTop: 8 }}>
                  <button
                    onClick={() => previousPrompt && setActivePromptKey(previousPrompt.key)}
                    disabled={!previousPrompt}
                    style={{
                      minHeight: 44,
                      padding: "0 16px",
                      borderRadius: RADIUS_MD,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "transparent",
                      color: previousPrompt ? TEXT_PRIMARY : SUBTLE_TEXT,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: previousPrompt ? "pointer" : "default",
                    }}
                  >
                    Previous category
                  </button>
                  <button
                    onClick={() => nextPromptItem && setActivePromptKey(nextPromptItem.key)}
                    disabled={!nextPromptItem}
                    style={{
                      minHeight: 44,
                      padding: "0 16px",
                      borderRadius: RADIUS_MD,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "transparent",
                      color: nextPromptItem ? TEXT_PRIMARY : SUBTLE_TEXT,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: nextPromptItem ? "pointer" : "default",
                    }}
                  >
                    Next category
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto", gap: 16, alignItems: "center", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                      Board progress
                    </div>
                    <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
                      <div style={{ width: "100%", height: 8, borderRadius: 999, background: BG_BASE, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${completion}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: `linear-gradient(90deg, ${ACCENT}, ${roundHasSavedBoard ? SUCCESS : "#FBBF24"})`,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.5, color: MUTED_TEXT }}>
                        {done}/{totalPrompts} picked
                        {roundHasSavedBoard ? " and saved." : "."}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={save}
                    disabled={editingLocked}
                    style={{
                      minHeight: 52,
                      minWidth: isMobile ? "100%" : 184,
                      padding: "0 22px",
                      borderRadius: RADIUS_MD,
                      border: "none",
                      background: reviewReady
                        ? "linear-gradient(135deg,#0f766e,#14b8a6)"
                        : resultsEntered || editingLocked
                          ? "linear-gradient(135deg,#334155,#475569)"
                          : saved
                            ? "linear-gradient(135deg,#22C55E,#16A34A)"
                            : "linear-gradient(135deg,#F97316,#EA580C)",
                      color: TEXT_PRIMARY,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: editingLocked ? "default" : "pointer",
                      opacity: editingLocked ? 0.8 : 1,
                      boxShadow: saved ? "0 10px 24px rgba(34,197,94,0.18)" : "0 10px 24px rgba(249,115,22,0.2)",
                    }}
                  >
                    {saveLabel}
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
