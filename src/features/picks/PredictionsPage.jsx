import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { chooseInsightForRace, insightMatchesRace } from "@/src/lib/aiInsight";
import { CONSTRUCTORS, DRV, TEAMS } from "@/src/constants/teams";
import { fmt, fmtFull, nextRace, rc } from "@/src/constants/calendar";
import { PTS } from "@/src/constants/scoring";
import { fetchMeetingSessions, fetchRaceSessions } from "@/src/lib/openf1";
import { getRaceDisplayRound, mapRaceSessionsByCalendar } from "@/src/lib/raceCalendar";
import { resolveBoardLock } from "@/src/lib/raceWeekend";
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
  WARN_BG,
  WARN_BORDER,
  WARN_TEXT,
  INFO,
  SUCCESS_BG,
  SUCCESS_BORDER,
  SUCCESS_TEXT,
  ERROR_TEXT,
} from "@/src/constants/design";
import { requireActiveSession } from "@/src/shell/authProfile";
import { formatDnfDrivers, matchesDnfPick } from "@/src/lib/resultHelpers";
import useRaceCalendar from "@/src/lib/useRaceCalendar";
import useViewport from "@/src/lib/useViewport";
import PageHeader from "@/src/ui/PageHeader";

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

function emptySelectionLabel(prompt, aiByKey) {
  if (!prompt) return "";
  const ai = aiByKey?.[prompt.key];
  if (ai?.pick) return `AI suggests: ${ai.pick}`;
  if (prompt.type === "binary") return "Not answered";
  if (prompt.type === "constructor") return "Pick a constructor";
  return "Pick a driver";
}

function hasSavedPickContent(picks) {
  return !!picks && Object.values(picks).some(Boolean);
}

const BASE_PROMPT_KEYS = ["pole", "winner", "p2", "p3", "dnf", "fl", "dotd", "ctor", "sc", "rf"];
const SPRINT_PROMPT_KEYS = ["sp_pole", "sp_winner", "sp_p2", "sp_p3"];

const EXTRA_PROMPT_DEFS = {
  p4:            { key: "p4",            label: "4th Place",           type: "driver",      pts: 10, hint: "Who finishes fourth?" },
  p10:           { key: "p10",           label: "10th Place",          type: "driver",      pts: 12, hint: "Who scores the last championship point?" },
  vsc:           { key: "vsc",           label: "Virtual Safety Car?", type: "binary",      pts: 6,  hint: "Will there be a VSC period?" },
  lap1_incident: { key: "lap1_incident", label: "Lap 1 Incident?",     type: "binary",      pts: 8,  hint: "Contact or incident on the opening lap?" },
  rain_race:     { key: "rain_race",     label: "Rain During Race?",   type: "binary",      pts: 8,  hint: "Wet conditions at any point during the race?" },
  fastest_ctor:  { key: "fastest_ctor",  label: "Fastest Pit Stop",    type: "constructor", pts: 7,  hint: "Which team posts the fastest pit stop time?" },
};

function roundPromptKeys(race, board = "all") {
  if (board === "race") {
    return [...BASE_PROMPT_KEYS];
  }

  if (board === "sprint") {
    return race?.sprint ? [...SPRINT_PROMPT_KEYS] : [];
  }

  if (race?.sprint) {
    return [...BASE_PROMPT_KEYS, ...SPRINT_PROMPT_KEYS];
  }
  return [...BASE_PROMPT_KEYS];
}

function boardProgress(keys, picks) {
  const filled = keys.filter((key) => !!picks[key]).length;

  return {
    total: keys.length,
    filled,
    hasAny: filled > 0,
    isComplete: keys.length > 0 && filled >= keys.length,
  };
}

function roundPredictionProgress(race, prediction) {
  const picks = prediction?.picks || {};
  const raceBoard = boardProgress(roundPromptKeys(race, "race"), picks);
  const sprintBoard = boardProgress(roundPromptKeys(race, "sprint"), picks);
  const allBoard = boardProgress(roundPromptKeys(race, "all"), picks);

  return {
    ...allBoard,
    race: raceBoard,
    sprint: sprintBoard,
  };
}

function formatRoundProgressDetail(race, progress) {
  if (!race?.sprint) {
    return `${progress.filled}/${progress.total} picks saved`;
  }

  if (progress.race.isComplete && !progress.sprint.hasAny) {
    return `Race board saved (${progress.race.filled}/${progress.race.total}) · Sprint board still open`;
  }

  if (progress.isComplete) {
    return `${progress.race.filled}/${progress.race.total} race picks + ${progress.sprint.filled}/${progress.sprint.total} sprint picks saved`;
  }

  return `${progress.race.filled}/${progress.race.total} race picks · ${progress.sprint.filled}/${progress.sprint.total} sprint picks saved`;
}

function formatRoundStatusBadge(race, progress) {
  if (!race?.sprint) {
    return `${progress.filled}/${progress.total}`;
  }

  if (progress.isComplete) {
    return `${progress.filled}/${progress.total}`;
  }

  if (progress.race.hasAny && !progress.sprint.hasAny) {
    return `R ${progress.race.filled}/${progress.race.total}`;
  }

  if (!progress.race.hasAny && progress.sprint.hasAny) {
    return `S ${progress.sprint.filled}/${progress.sprint.total}`;
  }

  return `${progress.race.filled}+${progress.sprint.filled}`;
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

function roundSidebarStatus(item, liveRace, resultRow, now, prediction) {
  const raceEnded = getRaceEndTimestamp(item, liveRace) <= now;
  const progress = roundPredictionProgress(item, prediction);

  if (resultRow?.results_entered) {
    return {
      kind: "scored",
      accent: SUCCESS,
      surface: "rgba(34,197,94,0.10)",
      outline: "rgba(34,197,94,0.20)",
      text: "#dcfce7",
      badge: "Scored",
    };
  }

  if (raceEnded) {
    return {
      kind: "passed",
      accent: "#22C55E",
      surface: "rgba(34,197,94,0.08)",
      outline: "rgba(34,197,94,0.16)",
      text: "#d1fae5",
      badge: "Passed",
    };
  }

  if (progress.isComplete) {
    return {
      kind: "locked",
      accent: "#38BDF8",
      surface: "rgba(56,189,248,0.08)",
      outline: "rgba(56,189,248,0.16)",
      text: "#dbeafe",
      badge: item?.sprint ? formatRoundStatusBadge(item, progress) : "Locked In",
    };
  }

  if (progress.hasAny) {
    return {
      kind: "draft",
      accent: "#F59E0B",
      surface: "rgba(245,158,11,0.08)",
      outline: "rgba(245,158,11,0.16)",
      text: "#fde68a",
      badge: formatRoundStatusBadge(item, progress),
    };
  }

  return {
    kind: "open",
    accent: "#64748B",
    surface: PANEL_BG,
    outline: "rgba(255,255,255,0.06)",
    text: SUBTLE_TEXT,
    badge: "Open",
  };
}

function RoundSidebarItem({ item, active, onClick, status }) {
  const closed = status.kind === "passed" || status.kind === "scored";
  const hasStoredBoard = status.kind === "locked" || status.kind === "draft";
  const inactiveBackground = status.kind === "open"
    ? PANEL_BG
    : `linear-gradient(135deg, ${hexToRgba(status.accent, 0.09)}, rgba(9,14,28,0.96) 62%)`;
  const inactiveRing = status.kind === "open" ? HAIRLINE : status.outline;

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
        background: active ? hexToRgba(status.accent, 0.18) : inactiveBackground,
        padding: "12px 14px",
        textAlign: "left",
        cursor: "pointer",
        transition: "background 140ms ease, box-shadow 140ms ease, transform 140ms ease",
        boxShadow: active
          ? `inset 3px 0 0 ${status.accent}, 0 0 0 1px ${hexToRgba(status.accent, 0.26)}, 0 16px 36px ${hexToRgba(status.accent, 0.1)}`
          : `inset 0 0 0 1px ${inactiveRing}`,
        opacity: closed && !active ? 0.94 : 1,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: active ? hexToRgba(status.accent, 0.14) : BG_BASE,
          border: `2px solid ${active ? status.accent : "rgba(255,255,255,0.08)"}`,
          boxShadow: active ? `0 0 16px ${hexToRgba(status.accent, 0.22)}` : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 800,
          color: TEXT_PRIMARY,
        }}
      >
        {getRaceDisplayRound(item) || item.r}
        {hasStoredBoard && (
          <span
            title={status.kind === "locked" ? "Full board saved" : "Draft board started"}
            style={{
              position: "absolute",
              bottom: 1,
              right: 1,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: status.accent,
              boxShadow: `0 0 10px ${hexToRgba(status.accent, 0.4)}`,
              border: `2px solid ${BG_BASE}`,
            }}
          />
        )}
        {closed && (
          <span
            title={status.kind === "scored" ? "Scored round" : "Passed round"}
            style={{
              position: "absolute",
              bottom: -2,
              left: -2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: status.kind === "scored" ? hexToRgba(SUCCESS, 0.2) : hexToRgba(status.accent, 0.18),
              border: `1px solid ${hexToRgba(status.accent, 0.35)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 12px ${hexToRgba(status.accent, 0.22)}`,
            }}
          >
            <svg width="8" height="9" viewBox="0 0 8 9" fill="none" aria-hidden="true">
              <path
                d="M2.2 3.5V2.6C2.2 1.61 2.97 0.8 4 0.8C5.03 0.8 5.8 1.61 5.8 2.6V3.5M1.7 3.5H6.3C6.69 3.5 7 3.81 7 4.2V7.5C7 7.89 6.69 8.2 6.3 8.2H1.7C1.31 8.2 1 7.89 1 7.5V4.2C1 3.81 1.31 3.5 1.7 3.5Z"
                stroke={status.accent}
                strokeWidth="1.15"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: active ? 700 : 600,
            color: closed && !active ? "#e5e7eb" : TEXT_PRIMARY,
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
              background: status.accent,
              boxShadow: `0 0 10px ${hexToRgba(status.accent, 0.3)}`,
            }}
          />
          <span style={{ fontSize: 12, color: status.text }}>{fmt(item.date)}</span>
          {status.badge && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: status.accent,
              }}
            >
              {status.badge}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function PredictionCard({ prompt, value, active, onClick, aiItem }) {
  const [hovered, setHovered] = useState(false);
  const meta = selectionMeta(prompt, value);
  const leftAccent = value ? SUCCESS : active ? ACCENT : "rgba(148,163,184,0.12)";
  const statusColor = value ? SUCCESS : active ? ACCENT : SUBTLE_TEXT;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => !active && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={prompt.hint}
      style={{
        width: "100%",
        minHeight: 44,
        border: `1px solid ${active ? "rgba(249,115,22,0.18)" : "rgba(148,163,184,0.07)"}`,
        borderRadius: CARD_RADIUS,
        background: active ? PANEL_BG_ALT : hovered ? "rgba(255,255,255,0.05)" : PANEL_BG,
        boxShadow: `inset 3px 0 0 ${leftAccent}`,
        padding: "9px 10px 8px",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        transition: "background 140ms ease, border-color 140ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: statusColor,
            animation: value ? "none" : "pulseDot 2s infinite",
            flexShrink: 0,
          }}
        />
        <span style={{ borderRadius: 999, padding: "1px 7px", fontSize: 9.5, fontWeight: 700, background: BG_BASE, color: SUBTLE_TEXT, letterSpacing: "0.02em" }}>
          {prompt.pts} pts
        </span>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-0.01em", color: TEXT_PRIMARY, marginBottom: 2, lineHeight: 1.2 }}>
          {prompt.label}
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: meta ? (meta.accent && meta.accent !== ACCENT ? meta.accent : TEXT_PRIMARY) : aiItem ? "#93c5fd" : MUTED_TEXT,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}>
          {meta ? meta.label : aiItem ? `→ ${aiItem.pick}` : "—"}
        </div>
      </div>
    </button>
  );
}

function DriverOption({ driver, selected, onClick, aiMatch = false, disabled = false }) {
  const team = TEAMS[driver.t];
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        minHeight: 58,
        border: "none",
        borderRadius: RADIUS_MD,
        background: selected ? PANEL_BG_ALT : hovered ? "rgba(255,255,255,0.04)" : BG_BASE,
        boxShadow: `inset 3px 0 0 ${team.c}${selected ? ", 0 0 0 1px rgba(255,255,255,0.04)" : ""}`,
        padding: "8px 10px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.72 : 1,
        transition: "background 140ms ease",
      }}
      disabled={disabled}
    >
      <div style={{ display: "grid", gridTemplateColumns: "24px minmax(0,1fr) auto", gap: 8, alignItems: "center" }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: hexToRgba(team.c, 0.15),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: team.c,
            fontSize: 9,
            fontWeight: 800,
          }}
        >
          {driver.nb ? `#${driver.nb}` : "NEW"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_PRIMARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 1 }}>
            {driver.n}
          </div>
          <div style={{ fontSize: 10, color: SUBTLE_TEXT }}>{driver.t}</div>
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
                background: SUCCESS,
                border: "1px solid rgba(15,23,42,0.92)",
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
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        minHeight: 58,
        border: "none",
        borderRadius: RADIUS_MD,
        background: selected ? PANEL_BG_ALT : hovered ? "rgba(255,255,255,0.04)" : BG_BASE,
        boxShadow: `inset 3px 0 0 ${team.c}`,
        padding: "8px 10px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.72 : 1,
        transition: "background 140ms ease",
      }}
      disabled={disabled}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 1 }}>{teamName}</div>
          <div style={{ fontSize: 10, color: SUBTLE_TEXT }}>{teammates || "Team pair pending"}</div>
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
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        minHeight: 60,
        border: "none",
        borderRadius: RADIUS_MD,
        background: selected ? PANEL_BG_ALT : hovered ? "rgba(255,255,255,0.04)" : BG_BASE,
        boxShadow: `inset 3px 0 0 ${color}`,
        padding: "10px 11px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.72 : 1,
        transition: "background 140ms ease",
      }}
      disabled={disabled}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 5 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{label}</span>
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
      <div style={{ fontSize: 10, lineHeight: 1.4, color: MUTED_TEXT }}>{detail}</div>
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
      {detail ? <div style={{ fontSize: 12, lineHeight: 1.6, color: MUTED_TEXT }}>{detail}</div> : null}
    </div>
  );
}

export default function PredictionsPage({
  user,
  openAuth,
  demoMode = false,
  initialRaceRound = null,
  onInitialRaceConsumed = () => {},
}) {
  const { isMobile, isTablet } = useViewport();
  const { calendar } = useRaceCalendar(2026);
  const [race, setRace] = useState(() => nextRace(calendar) || calendar[0] || null);
  const demoPreview = demoMode && !user;
  const [picks, setPicks] = useState({});
  const [predictionsByRound, setPredictionsByRound] = useState({});
  const [resultsByRound, setResultsByRound] = useState({});
  const [tab, setTab] = useState("race");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPartialWarning, setShowPartialWarning] = useState(false);
  const [liveRaces, setLiveRaces] = useState({});
  const [liveMeetings, setLiveMeetings] = useState({});
  const [localWeekendState, setLocalWeekendState] = useState({ controlsByRound: {}, sessionsByRound: {} });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiInsightStale, setAiInsightStale] = useState(false);
  const [aiInsightError, setAiInsightError] = useState(false);
  const [leagueExtraCategories, setLeagueExtraCategories] = useState([]);
  const [savePop, setSavePop] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [activePromptKey, setActivePromptKey] = useState("");
  const boardRef = useRef(null);
  const activeRoundRef = useRef(null);

  const currentRace = useMemo(() => nextRace(calendar) || calendar[0] || null, [calendar]);

  const loadAiInsight = useCallback(async () => {
    setAiInsightError(false);
    setAiInsightStale(false);
    try {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("headline,summary,confidence,race_name,generated_at,metadata")
        .eq("scope", "upcoming_race")
        .order("generated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      const rows = data || [];
      const matched = chooseInsightForRace(rows, currentRace);
      setAiInsight(matched);
      setAiInsightStale(rows.length > 0 && !matched);
    } catch {
      setAiInsightError(true);
    }
  }, [currentRace]);

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

      setLiveRaces(mapRaceSessionsByCalendar(calendar, sessions));
    }

    loadSeasonSchedule();
    loadAiInsight();
    return () => {
      ignore = true;
    };
  }, [calendar, loadAiInsight]);

  useEffect(() => {
    let ignore = false;

    async function loadLocalWeekendState() {
      try {
        const response = await fetch("/api/race-weekend-state?season=2026", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (ignore) return;
        setLocalWeekendState({
          controlsByRound: payload?.controlsByRound || {},
          sessionsByRound: payload?.sessionsByRound || {},
        });
      } catch {
        if (!ignore) {
          setLocalWeekendState({ controlsByRound: {}, sessionsByRound: {} });
        }
      }
    }

    loadLocalWeekendState();
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

  // Fetch extra pick categories enabled by any Pro league the user belongs to
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchLeagueExtras() {
      try {
        const { data } = await supabase
          .from("league_members")
          .select("league_id, leagues!inner(settings)")
          .eq("user_id", user.id);
        if (cancelled || !data) return;

        const merged = new Set();
        data.forEach((row) => {
          const extras = row.leagues?.settings?.extra_categories;
          if (Array.isArray(extras)) extras.forEach((k) => merged.add(k));
        });
        setLeagueExtraCategories([...merged]);
      } catch {
        // Non-critical — extras just won't show
      }
    }

    fetchLeagueExtras();
    return () => { cancelled = true; };
  }, [user]);

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
    if (!selectedRace) return;
    setRace(selectedRace);
    setSaved(false);
    setPicks(predictionsByRound[selectedRace.r]?.picks || {});
    setTab("race");
  };

  useEffect(() => {
    if (!calendar.length) return;

    setRace((current) => {
      if (current) {
        const updated = calendar.find((item) => item.r === current.r);
        if (updated) return updated;
      }
      return nextRace(calendar) || calendar[0] || null;
    });
  }, [calendar]);

  useEffect(() => {
    if (!initialRaceRound) return;

    const targetRace = calendar.find((item) => Number(item.r) === Number(initialRaceRound));
    if (!targetRace) {
      onInitialRaceConsumed();
      return;
    }

    setRace(targetRace);
    setSaved(false);
    setPicks(predictionsByRound[targetRace.r]?.picks || {});
    setTab("race");
    onInitialRaceConsumed();
  }, [calendar, initialRaceRound, onInitialRaceConsumed, predictionsByRound]);

  const setPick = (key, value) => {
    if (editingLocked) return;
    setPicks((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const focusPrompt = (promptKey) => {
    setActivePromptKey(promptKey);
    window.requestAnimationFrame(() => {
      boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const save = async () => {
    if (demoPreview) return;
    if (!user) return openAuth("login");
    if (editingLocked) return;

    if (done < totalPrompts && !showPartialWarning) {
      setShowPartialWarning(true);
      return;
    }
    setShowPartialWarning(false);

    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    setIsSaving(true);
    try {
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
      setSavePop(true);
      setTimeout(() => setSaved(false), 3000);
      setTimeout(() => setSavePop(false), 300);
    } finally {
      setIsSaving(false);
    }
  };

  const isSprintTab = race.sprint && tab === "sprint";
  const groups = useMemo(() => promptGroups(isSprintTab), [isSprintTab]);
  const prompts = useMemo(() => flattenPromptGroups(groups), [groups]);

  const allPrompts = useMemo(() => {
    const bonusPrompts = leagueExtraCategories
      .map((key) => EXTRA_PROMPT_DEFS[key])
      .filter(Boolean)
      .map((p) => ({ ...p, section: "League Bonus Picks" }));
    return [...prompts, ...bonusPrompts];
  }, [prompts, leagueExtraCategories]);

  useEffect(() => {
    if (!allPrompts.length) return;
    if (!allPrompts.find((prompt) => prompt.key === activePromptKey)) {
      setActivePromptKey(allPrompts[0]?.key || "");
    }
  }, [allPrompts, activePromptKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    activeRoundRef.current?.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
  }, [race.r]); // eslint-disable-line react-hooks/exhaustive-deps

  const activePrompt = allPrompts.find((prompt) => prompt.key === activePromptKey) || allPrompts[0];
  const activeIndex = allPrompts.findIndex((prompt) => prompt.key === activePrompt?.key);
  const previousPrompt = activeIndex > 0 ? allPrompts[activeIndex - 1] : null;
  const nextPromptItem = activeIndex < allPrompts.length - 1 ? allPrompts[activeIndex + 1] : null;
  const color = rc(race);
  const selectedPrediction = predictionsByRound[race.r] || null;
  const selectedResult = resultsByRound[race.r] || null;
  const liveRace = liveRaces[race.r] || null;
  const selectedRoundProgress = useMemo(
    () => roundPredictionProgress(race, selectedPrediction),
    [race, selectedPrediction]
  );
  const meetingSessions = useMemo(
    () => {
      const localSessions = localWeekendState.sessionsByRound?.[race.r];
      if (Array.isArray(localSessions) && localSessions.length) return localSessions;
      return liveMeetings[race.r] || [];
    },
    [localWeekendState.sessionsByRound, liveMeetings, race.r]
  );
  const totalPrompts = allPrompts.length;
  const done = allPrompts.filter((prompt) => !!picks[prompt.key]).length;
  const completion = totalPrompts ? Math.round((done / totalPrompts) * 100) : 0;

  const aiTargetsRace = insightMatchesRace(aiInsight, race);
  const aiPredictions = useMemo(
    () => (aiTargetsRace ? (aiInsight?.metadata?.category_predictions || []) : []),
    [aiTargetsRace, aiInsight]
  );
  const aiByKey = useMemo(
    () => Object.fromEntries(aiPredictions.map((item) => [item.key, item])),
    [aiPredictions]
  );

  const roundControl = localWeekendState.controlsByRound?.[race.r] || null;
  const resolvedLock = useMemo(
    () => resolveBoardLock({ race, control: roundControl, sessions: meetingSessions, isSprintBoard: isSprintTab, now }),
    [race, roundControl, meetingSessions, isSprintTab, now]
  );

  const lockCountdown = useMemo(() => {
    if (!resolvedLock?.lockAt) return null;
    const diff = new Date(resolvedLock.lockAt).getTime() - now;
    if (diff <= 0) return { locked: true, source: resolvedLock.source };
    const minsRemaining = Math.floor(diff / 60000);
    return {
      locked: false,
      source: resolvedLock.source,
      minsRemaining,
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
    };
  }, [resolvedLock, now]);

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
  const savedPickCount = prompts.filter((prompt) => !!selectedPrediction?.picks?.[prompt.key]).length;
  const perfectPodiumHit = ["winner", "p2", "p3"].every((key) => reviewRows.some((row) => row.key === key && row.hit));
  const podiumBonus = Array.isArray(selectedPrediction?.score_breakdown)
    ? (selectedPrediction.score_breakdown.find((item) => item.label === "Perfect Podium Bonus") || (perfectPodiumHit ? { label: "Perfect Podium Bonus", pts: PTS.perfectPodium } : null))
    : (perfectPodiumHit ? { label: "Perfect Podium Bonus", pts: PTS.perfectPodium } : null);
  const displayReviewScore = reviewRows.reduce((sum, row) => sum + Number(row.points || 0), 0) + Number(podiumBonus?.pts || 0);
  const lockLabel = resolvedLock?.lockAt ? formatLocalDateTime(resolvedLock.lockAt) : null;
  const roundHasSavedBoard = selectedRoundProgress.hasAny;
  const roundFullyLockedIn = selectedRoundProgress.isComplete;
  const saveLabel = isSaving
    ? "Saving…"
    : reviewReady
      ? "Round Scored"
      : demoPreview
        ? "Preview Only"
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
    ? (isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(2,minmax(0,1fr))")
    : activePrompt?.type === "binary"
      ? "repeat(2,minmax(0,1fr))"
      : (isMobile ? "repeat(2,minmax(0,1fr))" : isTablet ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))");
  const sidebarRaces = calendar;

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
      : roundFullyLockedIn
        ? {
          label: "Locked In",
          accent: "#38BDF8",
          surface: "rgba(56,189,248,0.08)",
          outline: "rgba(56,189,248,0.16)",
          detail: race.sprint
            ? `${selectedRoundProgress.race.filled}/${selectedRoundProgress.race.total} race picks + ${selectedRoundProgress.sprint.filled}/${selectedRoundProgress.sprint.total} sprint picks saved`
            : "All picks saved",
        }
        : roundHasSavedBoard
          ? {
            label: "In Progress",
            accent: "#F59E0B",
            surface: "rgba(245,158,11,0.08)",
            outline: "rgba(245,158,11,0.16)",
            detail: formatRoundProgressDetail(race, selectedRoundProgress),
          }
          : {
            label: "Open",
            accent: ACCENT,
            surface: "rgba(249,115,22,0.08)",
            outline: "rgba(249,115,22,0.16)",
            detail: "No picks yet",
          };
  return (
    <div
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <PageHeader
        eyebrow="Picks"
        title="Build the board before lock."
        description={null}
        aside={!isMobile && race ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, color: TEXT_PRIMARY }}>
              {race.n}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: MUTED_TEXT }}>
              {race.circuit} · {fmtFull(race.date)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: stateTone.accent }}>
              {stateTone.label}
            </div>
          </div>
        ) : null}
        asideWidth={360}
        marginBottom={isMobile ? 12 : 18}
        bgImage="/images/Hero-Main.png"
      />

      <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "260px minmax(0,1fr)", gap: 24, alignItems: "start" }}>
        {isTablet ? (
          <section>
            <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: isMobile ? "minmax(200px,1fr)" : "minmax(220px,1fr)", gap: isMobile ? 8 : 12, overflowX: "auto", paddingBottom: 4 }}>
              {sidebarRaces.map((item) => {
                const isActive = race.r === item.r;
                return (
                  <div key={item.r} ref={isActive ? activeRoundRef : null}>
                    <RoundSidebarItem
                      item={item}
                      active={isActive}
                      status={roundSidebarStatus(
                        item,
                        liveRaces[item.r] || null,
                        resultsByRound[item.r] || null,
                        now,
                        predictionsByRound[item.r] || null
                      )}
                      onClick={() => selectRace(item)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <aside style={{ position: "sticky", top: 96, display: "grid", gap: 12, maxHeight: "calc(100vh - 120px)", overflowY: "auto", paddingRight: 4 }}>
            {sidebarRaces.map((item) => (
              <RoundSidebarItem
                key={item.r}
                item={item}
                active={race.r === item.r}
                status={roundSidebarStatus(
                  item,
                  liveRaces[item.r] || null,
                  resultsByRound[item.r] || null,
                  now,
                  predictionsByRound[item.r] || null
                )}
                onClick={() => selectRace(item)}
              />
            ))}
          </aside>
        )}

        <main style={{ display: "grid", gap: 24 }}>

          {/* ── Pro Intelligence Panel ── */}
          {aiPredictions.length > 0 && (() => {
            const isPro = user?.subscription_status === "pro";
            const visiblePicks = isPro ? aiPredictions : aiPredictions.slice(0, 2);
            const hiddenCount = aiPredictions.length - visiblePicks.length;
            const CONF_LABEL = { high: "High", medium: "Medium", low: "Low", confident: "High", uncertain: "Low" };
            const CONF_COLOR = { high: "#86efac", medium: "#fde68a", low: "#fca5a5", confident: "#86efac", uncertain: "#fca5a5" };

            return (
              <section
                style={{
                  borderRadius: SECTION_RADIUS,
                  border: isPro ? "1px solid rgba(255,106,26,0.22)" : "1px solid rgba(148,163,184,0.12)",
                  background: isPro
                    ? "linear-gradient(160deg,rgba(255,106,26,0.06) 0%,rgba(14,22,38,0.98) 55%)"
                    : PANEL_BG,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: isMobile ? "14px 16px 12px" : "16px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${HAIRLINE}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: isPro ? ACCENT : MUTED_TEXT, letterSpacing: "-0.01em" }}>
                        AI Pre-Race Intelligence
                      </span>
                      <span style={{ fontSize: 11, color: SUBTLE_TEXT, marginTop: 2 }}>
                        {isPro ? `${aiPredictions.length} category calls for ${race.n}` : "Category calls — Pro feature"}
                      </span>
                    </div>
                  </div>
                  {!isPro && (
                    <button
                      onClick={() => openAuth ? openAuth("register") : null}
                      style={{
                        background: "linear-gradient(135deg,#FF6A1A,#e05a12)",
                        border: "none",
                        borderRadius: 8,
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "6px 12px",
                        letterSpacing: "-0.01em",
                        flexShrink: 0,
                      }}
                    >
                      Unlock Pro
                    </button>
                  )}
                </div>

                <div style={{ padding: isMobile ? "12px 14px" : "14px 18px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
                      gap: 8,
                      position: "relative",
                    }}
                  >
                    {visiblePicks.map((item) => {
                      const conf = (typeof item.confidence === "string" ? item.confidence.toLowerCase() : String(item.confidence || "medium").toLowerCase()) || "medium";
                      const confColor = CONF_COLOR[conf] || "#fde68a";
                      const confLabel = CONF_LABEL[conf] || "Medium";
                      const isSet = !!picks[item.key];
                      const matchesPick = isSet && (picks[item.key] === item.pick);
                      return (
                        <div
                          key={item.key}
                          style={{
                            borderRadius: 10,
                            border: matchesPick
                              ? "1px solid rgba(134,239,172,0.3)"
                              : "1px solid rgba(148,163,184,0.12)",
                            background: matchesPick
                              ? "rgba(134,239,172,0.06)"
                              : PANEL_BG_ALT,
                            padding: "10px 12px",
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                            {item.key === "p2" ? "P2" : item.key === "p3" ? "P3" : item.key === "fl" ? "Fastest Lap" : item.key === "dotd" ? "DOTD" : item.key === "dnf" ? "DNF" : item.key === "ctor" ? "Constructor" : item.key === "sc" ? "Safety Car" : item.key}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.pick}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: confColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: confColor }}>{confLabel}</span>
                            {matchesPick && <span style={{ fontSize: 10, fontWeight: 700, color: "#86efac", marginLeft: "auto" }}>Matched</span>}
                          </div>
                        </div>
                      );
                    })}

                    {!isPro && hiddenCount > 0 && (
                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,106,26,0.2)",
                          background: "rgba(255,106,26,0.04)",
                          padding: "10px 12px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          gap: 4,
                          gridColumn: isMobile ? "span 2" : "span 2",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>+{hiddenCount} more</div>
                        <div style={{ fontSize: 11, color: SUBTLE_TEXT, lineHeight: 1.4 }}>All category calls with Pro</div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })()}

          <section style={{ borderRadius: SECTION_RADIUS, background: PANEL_BG, boxShadow: LIFTED_SHADOW, overflow: "hidden" }}>
            <div style={{ height: 3, background: `linear-gradient(90deg,${ACCENT},${color}, transparent)` }} />
            {race.sprint && (
              <div style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <div
                  style={{
                    padding: isMobile ? "14px 20px 12px" : "16px 24px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    background: "linear-gradient(90deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04) 55%, transparent)",
                  }}
                >
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: ACCENT,
                      boxShadow: "0 0 14px rgba(249,115,22,0.4)",
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fdba74" }}>
                    Sprint weekend active
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: MUTED_TEXT }}>
                    This round unlocks an extra sprint board and extra sprint points.
                  </span>
                </div>
                <div style={{ padding: "12px 24px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              </div>
            )}

            {/* Lock status banner (#33) */}
            {editingLocked && (
              <div style={{
                padding: "12px 24px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderBottom: `1px solid ${HAIRLINE}`,
                background: resultsEntered
                  ? SUCCESS_BG
                  : raceHasPassed
                    ? "rgba(59,130,246,0.06)"
                    : WARN_BG,
                borderLeft: `3px solid ${resultsEntered ? SUCCESS_BORDER : raceHasPassed ? "rgba(59,130,246,0.4)" : WARN_BORDER}`,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: resultsEntered ? "#22c55e" : raceHasPassed ? "#3b82f6" : "#fcd34d",
                  boxShadow: `0 0 8px ${resultsEntered ? "rgba(34,197,94,0.4)" : raceHasPassed ? "rgba(59,130,246,0.4)" : "rgba(252,211,77,0.4)"}`,
                }} />
                <span style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: resultsEntered ? SUCCESS_TEXT : raceHasPassed ? "#93c5fd" : WARN_TEXT,
                }}>
                  {resultsEntered
                    ? "Scored"
                    : raceHasPassed
                      ? "Results pending"
                      : "Locked"}
                </span>
              </div>
            )}

            {!showReviewOnly && (
              <div style={{ padding: isMobile ? "16px 16px 10px" : "18px 20px 10px" }}>
                {groups.map((group) => (
                  <div key={group.title} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: SUBTLE_TEXT,
                        marginBottom: 7,
                        opacity: 0.8,
                      }}
                    >
                      {group.title}
                    </div>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "1fr"
                        : isTablet
                          ? "repeat(3, minmax(0,1fr))"
                          : `repeat(${group.prompts.length}, minmax(0,1fr))`,
                      gap: 8,
                    }}>
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

                {/* League Bonus Picks — shown when user's Pro league has extra categories */}
                {leagueExtraCategories.length > 0 && (() => {
                  const bonusPrompts = leagueExtraCategories
                    .map((key) => EXTRA_PROMPT_DEFS[key])
                    .filter(Boolean);
                  if (!bonusPrompts.length) return null;
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: ACCENT, opacity: 0.9 }}>
                          League Bonus Picks
                        </div>
                        <span style={{ fontSize: 8, fontWeight: 800, color: ACCENT, background: "rgba(255,106,26,0.12)", borderRadius: 999, padding: "1px 6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>PRO</span>
                      </div>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(3,minmax(0,1fr))" : `repeat(${Math.min(bonusPrompts.length, 4)},minmax(0,1fr))`,
                        gap: 8,
                      }}>
                        {bonusPrompts.map((prompt) => (
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
                  );
                })()}
              </div>
            )}
          </section>

          {(reviewReady || editingLocked) && (
            <section style={{ borderRadius: SECTION_RADIUS, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
              <div style={{ padding: isMobile ? "20px" : "24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                <div style={{ fontSize: isMobile ? 28 : 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 8 }}>
                  {reviewReady ? "Review" : "Locked"}
                </div>
                {!reviewReady && (
                  <div style={{ fontSize: 15, lineHeight: 1.6, color: MUTED_TEXT, maxWidth: 760 }}>
                    {hasSavedPickContent(selectedPrediction?.picks)
                      ? `${savedPickCount} picks saved`
                      : "No saved board"}
                  </div>
                )}
              </div>

              <div style={{ padding: isMobile ? 20 : 24, display: "grid", gap: 18 }}>
                {reviewReady ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 12 }}>
                      <ReviewMetric
                        label="Round score"
                        value={`${displayReviewScore} pts`}
                        detail={race.n}
                        accent="#facc15"
                      />
                      <ReviewMetric
                        label="Correct calls"
                        value={String(hits)}
                        detail={tab === "sprint" ? "Sprint" : "Race"}
                        accent={SUCCESS}
                      />
                      <ReviewMetric
                        label="Misses"
                        value={String(Math.max(misses, 0))}
                        accent="#f87171"
                      />
                      <ReviewMetric
                        label="Podium bonus"
                        value={podiumBonus ? `+${podiumBonus.pts}` : "No"}
                        detail={podiumBonus ? "Perfect podium" : null}
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
                              {row.hit ? "Hit" : "Miss"}
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
                          ? "Results pending."
                          : "Board saved.")
                        : "No saved board."}
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
            <section ref={boardRef} style={{ borderRadius: SECTION_RADIUS, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden", scrollMarginTop: 96 }}>
              <div style={{ padding: isMobile ? "18px" : "18px 22px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) auto", gap: 20, alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                      Active category
                    </div>
                    <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 6 }}>
                      {activePrompt?.label}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.55, color: MUTED_TEXT, maxWidth: 640 }}>
                      {activePrompt?.hint}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10, minWidth: isTablet ? "auto" : 240 }}>
                    <span style={{ borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600, background: BG_BASE, color: SUBTLE_TEXT, width: "fit-content" }}>
                      {activePrompt?.pts || 0} pts
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: currentMeta ? TEXT_PRIMARY : activeAi ? "#93c5fd" : MUTED_TEXT }}>
                        {currentMeta ? currentMeta.label : emptySelectionLabel(activePrompt, aiByKey)}
                      </div>
                      {currentMeta && !editingLocked && (
                        <button
                          onClick={() => setPicks((p) => { const n = { ...p }; delete n[activePromptKey]; return n; })}
                          title="Clear pick"
                          style={{ background: "none", border: "none", color: SUBTLE_TEXT, cursor: "pointer", fontSize: 16, padding: "0 2px", lineHeight: 1, opacity: 0.6 }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#fca5a5"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.color = SUBTLE_TEXT; }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {activeAi && (
                      <div style={{ fontSize: 12, lineHeight: 1.45, color: "#93c5fd" }}>
                        AI Insight: {activeAi.pick}. {previewText(activeAi.reason, 88)}
                      </div>
                    )}
                    {!activeAi && !aiInsightError && aiInsightStale && currentRace && race.r === currentRace.r && (
                      <div style={{ fontSize: 11, lineHeight: 1.55, color: "#fca5a5" }}>
                        The saved AI brief is out of date for {currentRace.n}. Regenerate it from Admin to restore live suggestions here.
                      </div>
                    )}
                    {aiInsightError && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#fca5a5" }}>
                        <span>AI brief unavailable</span>
                        <button
                          onClick={loadAiInsight}
                          style={{ background: "none", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0, textDecoration: "underline" }}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: isMobile ? 18 : 20 }}>
                {activePrompt?.type === "driver" && (
                  <div style={{ display: "grid", gridTemplateColumns: optionGrid, gap: 8 }}>
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
                  <div style={{ display: "grid", gridTemplateColumns: optionGrid, gap: 8 }}>
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
                  <div style={{ display: "grid", gridTemplateColumns: optionGrid, gap: 10 }}>
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

              <div style={{ padding: isMobile ? "0 14px 16px" : "0 20px 20px", display: "grid", gap: 14 }}>
                <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: isMobile ? "1fr 1fr" : undefined, justifyContent: isMobile ? undefined : "space-between", gap: isMobile ? 10 : 12, flexWrap: "wrap", paddingTop: 8 }}>
                  <button
                    onClick={() => previousPrompt && setActivePromptKey(previousPrompt.key)}
                    disabled={!previousPrompt}
                    style={{
                      minHeight: 48,
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
                    {isMobile ? "← Prev" : "Previous category"}
                  </button>
                  <button
                    onClick={() => nextPromptItem && setActivePromptKey(nextPromptItem.key)}
                    disabled={!nextPromptItem}
                    style={{
                      minHeight: 48,
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
                    {isMobile ? "Next →" : "Next category"}
                  </button>
                </div>

                {showPartialWarning && (
                  <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: CARD_RADIUS, background: WARN_BG, border: `1px solid ${WARN_BORDER}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: WARN_TEXT, marginBottom: 8 }}>
                      You have {done}/{totalPrompts} picks — submit anyway?
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => { setShowPartialWarning(false); const firstEmpty = prompts.find((p) => !picks[p.key]); if (firstEmpty) setActivePromptKey(firstEmpty.key); boardRef.current?.scrollIntoView({ behavior: "smooth" }); }}
                        style={{ border: "none", borderRadius: 8, background: "rgba(255,255,255,0.08)", color: WARN_TEXT, cursor: "pointer", fontWeight: 700, fontSize: 12, padding: "7px 12px" }}
                      >
                        Complete board
                      </button>
                      <button
                        onClick={save}
                        style={{ border: "none", borderRadius: 8, background: WARN_BORDER, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12, padding: "7px 12px" }}
                      >
                        Save anyway
                      </button>
                    </div>
                  </div>
                )}

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
                    className={savePop ? "stint-success-pop" : undefined}
                    onClick={save}
                    disabled={isSaving || editingLocked || demoPreview}
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
                      cursor: isSaving || editingLocked || demoPreview ? "default" : "pointer",
                      opacity: isSaving || editingLocked || demoPreview ? 0.8 : 1,
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
