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
        title: "Sprint picks",
        prompts: [
          { key: "sp_pole", label: "Sprint Pole", type: "driver", pts: PTS.sp_pole, hint: "Pick who starts first in the sprint." },
          { key: "sp_winner", label: "Sprint Winner", type: "driver", pts: PTS.sp_winner, hint: "Pick who wins the sprint." },
          { key: "sp_p2", label: "Sprint 2nd", type: "driver", pts: PTS.sp_p2, hint: "Pick the driver who finishes second." },
          { key: "sp_p3", label: "Sprint 3rd", type: "driver", pts: PTS.sp_p3, hint: "Pick the driver who finishes third." },
        ],
      },
    ];
  }

  return [
    {
      title: "Front-runners",
      prompts: [
        { key: "pole", label: "Pole Position", type: "driver", pts: PTS.pole, hint: "Pick who starts first." },
        { key: "winner", label: "Race Winner", type: "driver", pts: PTS.winner, hint: "Pick who wins on Sunday." },
        { key: "p2", label: "2nd Place", type: "driver", pts: PTS.p2, hint: "Pick the driver who finishes second." },
        { key: "p3", label: "3rd Place", type: "driver", pts: PTS.p3, hint: "Pick the driver who finishes third." },
      ],
    },
    {
      title: "Risk and upside",
      prompts: [
        { key: "dnf", label: "DNF Driver", type: "driver", pts: PTS.dnf, hint: "Pick one driver most likely not to finish." },
        { key: "fl", label: "Fastest Lap", type: "driver", pts: PTS.fl, hint: "Pick the driver most likely to set fastest lap." },
        { key: "dotd", label: "Driver of the Day", type: "driver", pts: PTS.dotd, hint: "Pick the driver fans are most likely to vote for." },
      ],
    },
    {
      title: "Weekend extras",
      prompts: [
        { key: "ctor", label: "Constructor with Most Points", type: "constructor", pts: PTS.ctor, hint: "Pick the team most likely to score the most points." },
        { key: "sc", label: "Safety Car?", type: "binary", pts: PTS.sc, hint: "Will there be a safety car period?" },
        { key: "rf", label: "Red Flag?", type: "binary", pts: PTS.rf, hint: "Will there be a red flag?" },
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
  return "Tap to choose";
}

function predictionMatches(prompt, item, value) {
  if (!prompt || !item) return false;
  return item.pick === value;
}

function RoundSidebarItem({ item, active, isSaved, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "40px minmax(0,1fr)",
        gap: 10,
        alignItems: "center",
        border: "none",
        borderRadius: CARD_RADIUS,
        background: active ? PANEL_BG_ALT : PANEL_BG,
        padding: "10px 12px",
        textAlign: "left",
        cursor: "pointer",
        boxShadow: active ? `0 0 0 1px ${hexToRgba(ACCENT, 0.2)}` : "none",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: PANEL_BG,
          border: `2px solid ${active ? ACCENT : "rgba(255,255,255,0.12)"}`,
          boxShadow: active ? "0 0 12px rgba(249,115,22,0.3)" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          fontWeight: 800,
          color: TEXT_PRIMARY,
        }}
      >
        {item.r}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>
          {item.n}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: SUBTLE_TEXT }}>{fmt(item.date)}</span>
          {item.sprint && (
            <span style={{ borderRadius: 999, padding: "3px 8px", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(168,85,247,0.12)", color: "#A855F7" }}>
              Sprint
            </span>
          )}
          {isSaved && (
            <span style={{ borderRadius: 999, padding: "3px 8px", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(34,197,94,0.12)", color: SUCCESS }}>
              Saved
            </span>
          )}
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
        padding: 14,
        textAlign: "left",
        cursor: "pointer",
        minHeight: 108,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: statusColor,
              animation: value ? "none" : "pulseDot 2s infinite",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
            {prompt.section}
          </span>
        </div>
        <span style={{ borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, background: BG_BASE, color: SUBTLE_TEXT }}>
          {prompt.pts} pts
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT_PRIMARY, marginBottom: 6, lineHeight: 1.08 }}>
        {prompt.label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: meta ? TEXT_PRIMARY : MUTED_TEXT, marginBottom: 8 }}>
        {meta ? meta.label : emptySelectionLabel(prompt)}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55, color: MUTED_TEXT, marginBottom: aiItem ? 8 : 0 }}>
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

function DriverOption({ driver, selected, onClick, aiMatch = false }) {
  const team = TEAMS[driver.t];

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 76,
        border: "none",
        borderRadius: RADIUS_MD,
        background: selected ? PANEL_BG_ALT : BG_BASE,
        boxShadow: `inset 3px 0 0 ${team.c}${selected ? ", 0 0 0 1px rgba(255,255,255,0.04)" : ""}`,
        padding: "12px 14px",
        textAlign: "left",
        cursor: "pointer",
      }}
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
        <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
          {aiMatch && (
            <span style={{ borderRadius: 999, padding: "3px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(59,130,246,0.12)", color: "#93c5fd" }}>
              AI
            </span>
          )}
          {selected && (
            <span style={{ borderRadius: 999, padding: "3px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(34,197,94,0.12)", color: SUCCESS }}>
              Selected
            </span>
          )}
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
        minHeight: 76,
        border: "none",
        borderRadius: RADIUS_MD,
        background: selected ? PANEL_BG_ALT : BG_BASE,
        boxShadow: `inset 3px 0 0 ${team.c}`,
        padding: "12px 14px",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 4 }}>{teamName}</div>
          <div style={{ fontSize: 11, color: SUBTLE_TEXT }}>{teammates || "Team pair pending"}</div>
        </div>
        <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
          {aiMatch && (
            <span style={{ borderRadius: 999, padding: "3px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(59,130,246,0.12)", color: "#93c5fd" }}>
              AI
            </span>
          )}
          {selected && (
            <span style={{ borderRadius: 999, padding: "3px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(34,197,94,0.12)", color: SUCCESS }}>
              Selected
            </span>
          )}
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
        minHeight: 88,
        border: "none",
        borderRadius: RADIUS_MD,
        background: selected ? PANEL_BG_ALT : BG_BASE,
        boxShadow: `inset 3px 0 0 ${color}`,
        padding: "14px",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}>{label}</span>
        </div>
        <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
          {aiMatch && (
            <span style={{ borderRadius: 999, padding: "3px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(59,130,246,0.12)", color: "#93c5fd" }}>
              AI
            </span>
          )}
          {selected && (
            <span style={{ borderRadius: 999, padding: "3px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(34,197,94,0.12)", color: SUCCESS }}>
              Selected
            </span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: MUTED_TEXT }}>{detail}</div>
    </button>
  );
}

export default function PredictionsPage({ user, openAuth }) {
  const { isMobile, isTablet } = useViewport();
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

  useEffect(() => {
    loadPicks();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const commitPick = (key, value) => {
    const currentValue = picks[key];
    const nextValue = currentValue === value ? null : value;
    setPicks((current) => ({ ...current, [key]: nextValue }));
    setSaved(false);

    if (!nextValue) return;

    const currentIndex = prompts.findIndex((prompt) => prompt.key === key);
    const nextUnanswered = prompts.find((prompt, index) => index > currentIndex && !picks[prompt.key] && prompt.key !== key);
    const fallbackNext = currentIndex >= 0 ? prompts[currentIndex + 1] : null;
    const targetPrompt = nextUnanswered || fallbackNext || null;

    if (targetPrompt?.key && targetPrompt.key !== key) {
      window.setTimeout(() => {
        setActivePromptKey(targetPrompt.key);
        if (isTablet) {
          boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 120);
    }
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
    if (!user) return openAuth("register");

    const session = await requireActiveSession();
    if (!session) return openAuth("register");

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
  const activeStep = activePrompt ? prompts.findIndex((prompt) => prompt.key === activePrompt.key) + 1 : 1;
  const nextUnansweredPrompt = prompts.find((prompt) => !picks[prompt.key]) || null;
  const upcomingPromptAfterActive = activePrompt
    ? prompts.find((prompt, index) => index > activeIndex && !picks[prompt.key])
    : null;

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
  const lockLabel = lockSession?.date_start ? formatLocalDateTime(lockSession.date_start) : null;
  const optionGrid = activePrompt?.type === "constructor"
    ? (isMobile ? "1fr" : "repeat(2,minmax(0,1fr))")
    : activePrompt?.type === "binary"
      ? (isMobile ? "1fr" : "repeat(2,minmax(0,1fr))")
      : (isMobile ? "1fr" : isTablet ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))");

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
            <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(220px,1fr)", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
              {CAL.map((item) => (
                <RoundSidebarItem
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
          <aside style={{ position: "sticky", top: 96, display: "grid", gap: 12, maxHeight: "calc(100vh - 120px)", overflowY: "auto", paddingRight: 4 }}>
            {CAL.map((item) => (
              <RoundSidebarItem
                key={item.r}
                item={item}
                active={race.r === item.r}
                isSaved={!!allPicks[item.r]}
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
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
                    Race board
                  </div>
                  <h1 style={{ fontSize: isMobile ? 36 : 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 10 }}>
                    {race.n}
                  </h1>
                  <div style={{ fontSize: 15, lineHeight: 1.6, color: MUTED_TEXT, maxWidth: 640, marginBottom: 14 }}>
                    Start at the top, answer one category at a time, and save the round before qualifying. The page moves you forward automatically so new players can fill the board without guessing the flow.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(255,255,255,0.06)", color: TEXT_PRIMARY }}>
                      {race.circuit}
                    </span>
                    <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(255,255,255,0.06)", color: TEXT_PRIMARY }}>
                      {fmtFull(race.date)}
                    </span>
                    {race.sprint && (
                      <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(168,85,247,0.12)", color: "#A855F7" }}>
                        Sprint weekend
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12, minWidth: isTablet ? "auto" : 240 }}>
                  <div style={{ borderRadius: CARD_RADIUS, background: PANEL_BG, padding: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                      Predictions lock
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>
                      {lockCountdown?.locked
                        ? "Locked"
                        : lockCountdown
                          ? `${lockCountdown.d ? `${lockCountdown.d}d ` : ""}${String(lockCountdown.h || 0).padStart(2, "0")}h ${String(lockCountdown.m || 0).padStart(2, "0")}m left`
                          : "Loading"}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: MUTED_TEXT }}>
                      {lockLabel ? `Closes at ${lockLabel}` : "Fetching qualifying schedule."}
                    </div>
                  </div>
                  <div style={{ borderRadius: CARD_RADIUS, background: PANEL_BG, padding: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                      Next action
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>
                      {done}/{totalPrompts} complete
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: MUTED_TEXT }}>
                      {nextUnansweredPrompt
                        ? `Next up: ${nextUnansweredPrompt.label}.`
                        : "Everything is filled. Save the board to lock it in."}
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

            <div style={{ padding: isMobile ? 20 : 24 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))",
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                {[
                  ["1", "Choose race", "Use the left rail to open the round you want to fill."],
                  ["2", "Pick answers", "Tap a card, make a choice, and the page moves you forward."],
                  ["3", "Save board", "Lock the round once every category is filled."],
                ].map(([step, title, detail], index) => {
                  const complete = index === 0 || (index === 1 ? done > 0 : done === totalPrompts);
                  return (
                    <div
                      key={step}
                      style={{
                        borderRadius: CARD_RADIUS,
                        background: complete ? PANEL_BG_ALT : PANEL_BG,
                        padding: "12px 14px",
                        boxShadow: `inset 3px 0 0 ${complete ? SUCCESS : ACCENT}`,
                      }}
                    >
                      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 999, background: complete ? "rgba(34,197,94,0.14)" : "rgba(249,115,22,0.14)", color: complete ? SUCCESS : ACCENT, fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
                        {step}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 11, lineHeight: 1.55, color: MUTED_TEXT }}>{detail}</div>
                    </div>
                  );
                })}
              </div>

              {!user && (
                <div style={{ marginBottom: 18, borderRadius: CARD_RADIUS, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.16)", padding: "12px 14px", fontSize: 13, lineHeight: 1.6, color: TEXT_PRIMARY }}>
                  You can build the full board first. Create your account only when you are ready to save the round.
                </div>
              )}

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
          </section>

          <section ref={boardRef} style={{ borderRadius: SECTION_RADIUS, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
            <div style={{ padding: isMobile ? "20px" : "24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
              <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) auto", gap: 20, alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                    Step {activeStep} of {totalPrompts}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 8 }}>
                    Choose {activePrompt?.label}
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.6, color: MUTED_TEXT, maxWidth: 640 }}>
                    {done === 0
                      ? `Start here. Pick one option and the page will move you to the next category automatically. ${activePrompt?.hint || ""}`
                      : activePrompt?.hint}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 10, minWidth: isTablet ? "auto" : 240 }}>
                  <span style={{ borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600, background: BG_BASE, color: SUBTLE_TEXT, width: "fit-content" }}>
                    {activePrompt?.pts || 0} pts
                  </span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: currentMeta ? TEXT_PRIMARY : MUTED_TEXT }}>
                      {currentMeta ? currentMeta.label : emptySelectionLabel(activePrompt)}
                    </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: SUBTLE_TEXT }}>
                    {upcomingPromptAfterActive ? `After this, keep going to ${upcomingPromptAfterActive.label}.` : "This is the last missing step before save."}
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
                      onClick={() => commitPick(activePrompt.key, driver.n)}
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
                      onClick={() => commitPick(activePrompt.key, teamName)}
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
                    onClick={() => commitPick(activePrompt.key, "Yes")}
                  />
                  <BinaryOption
                    label="No"
                    detail={activePrompt.key === "sc" ? "Clean race without a safety car period." : "No stoppage expected during the session."}
                    color="#EF4444"
                    selected={picks[activePrompt.key] === "No"}
                    aiMatch={predictionMatches(activePrompt, activeAi, "No")}
                    onClick={() => commitPick(activePrompt.key, "No")}
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
                    Picks status
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.6, color: MUTED_TEXT }}>
                    {done}/{totalPrompts} filled. {user ? "Save once the board looks right." : "Create an account at the end to save this board."}
                  </div>
                </div>

                <button
                  onClick={save}
                  style={{
                    minHeight: 52,
                    minWidth: isMobile ? "100%" : 184,
                    padding: "0 22px",
                    borderRadius: RADIUS_MD,
                    border: "none",
                    background: saved ? "linear-gradient(135deg,#22C55E,#16A34A)" : "linear-gradient(135deg,#F97316,#EA580C)",
                    color: TEXT_PRIMARY,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: saved ? "0 10px 24px rgba(34,197,94,0.18)" : "0 10px 24px rgba(249,115,22,0.2)",
                  }}
                >
                  {saved ? "Predictions Saved" : user ? "Save Predictions" : "Create Account to Save"}
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
