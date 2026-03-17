import { useMemo, useState } from "react";
import { TEAMS } from "../constants/teams";
import { CAL } from "../constants/calendar";
import {
  CARD_RADIUS,
  CONTENT_MAX,
  EDGE_RING,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BG_STRONG,
  PANEL_BORDER,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
} from "../constants/design";
import useViewport from "../useViewport";

const PREVIEW_MODE = true;
const PREVIEW_COMPLETED_ROUNDS = 4;

const MOCK_DRIVERS = [
  { pos: 1, name: "Lando Norris", team: "McLaren", points: 88, gap: "Leader", change: "+1", form: "2 · 1 · 1 · 3" },
  { pos: 2, name: "Charles Leclerc", team: "Ferrari", points: 79, gap: "-9", change: "-1", form: "1 · 4 · 2 · 2" },
  { pos: 3, name: "Max Verstappen", team: "Red Bull Racing", points: 73, gap: "-15", change: "0", form: "3 · 2 · 6 · 1" },
  { pos: 4, name: "Oscar Piastri", team: "McLaren", points: 66, gap: "-22", change: "+1", form: "6 · 3 · 3 · 4" },
  { pos: 5, name: "Lewis Hamilton", team: "Ferrari", points: 58, gap: "-30", change: "-1", form: "4 · 5 · 4 · 6" },
  { pos: 6, name: "George Russell", team: "Mercedes", points: 47, gap: "-41", change: "0", form: "5 · 6 · 5 · 5" },
  { pos: 7, name: "Fernando Alonso", team: "Aston Martin", points: 26, gap: "-62", change: "+2", form: "8 · 8 · 9 · 7" },
  { pos: 8, name: "Carlos Sainz", team: "Williams", points: 22, gap: "-66", change: "-1", form: "7 · 10 · 8 · 8" },
];

const MOCK_CONSTRUCTORS = [
  { pos: 1, team: "McLaren", points: 154, gap: "Leader", form: "25 · 43 · 40 · 46" },
  { pos: 2, team: "Ferrari", points: 137, gap: "-17", form: "37 · 30 · 34 · 36" },
  { pos: 3, team: "Red Bull Racing", points: 91, gap: "-63", form: "27 · 18 · 14 · 32" },
  { pos: 4, team: "Mercedes", points: 66, gap: "-88", form: "18 · 17 · 15 · 16" },
  { pos: 5, team: "Aston Martin", points: 31, gap: "-123", form: "8 · 5 · 7 · 11" },
  { pos: 6, team: "Williams", points: 24, gap: "-130", form: "10 · 4 · 4 · 6" },
];

function SummaryMetric({ label, value, detail, accent = "#f8fafc" }) {
  return (
    <div
      style={{
        borderRadius: CARD_RADIUS,
        border: "1px solid rgba(148,163,184,0.14)",
        background: PANEL_BG_ALT,
        boxShadow: EDGE_RING,
        padding: "16px 16px 15px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1.1, color: accent, marginBottom: 5 }}>{value}</div>
      <div style={{ fontSize: 12, lineHeight: 1.65, color: MUTED_TEXT }}>{detail}</div>
    </div>
  );
}

function teamAccent(teamName) {
  return TEAMS[teamName]?.c || "#94a3b8";
}

export default function StandingsPage() {
  const { isMobile, isTablet } = useViewport();
  const [tab, setTab] = useState("drivers");

  const leader = MOCK_DRIVERS[0];
  const strongestTeam = MOCK_CONSTRUCTORS[0];
  const lastContextRace = PREVIEW_MODE ? CAL[PREVIEW_COMPLETED_ROUNDS - 1] : null;
  const activeRows = tab === "drivers" ? MOCK_DRIVERS : MOCK_CONSTRUCTORS;

  const headline = useMemo(() => {
    if (tab === "drivers") {
      return {
        title: "Driver board",
        detail: `Who is controlling the season after ${lastContextRace?.n || "the latest round"}.`,
      };
    }
    return {
      title: "Constructor board",
      detail: `Which team left ${lastContextRace?.n || "the latest round"} with the strongest position.`,
    };
  }, [lastContextRace, tab]);

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <section
        style={{
          borderRadius: SECTION_RADIUS,
          border: PANEL_BORDER,
          background: `linear-gradient(180deg,rgba(10,18,32,0.98),${PANEL_BG_STRONG})`,
          boxShadow: LIFTED_SHADOW,
          overflow: "hidden",
          marginBottom: 18,
        }}
      >
        <div style={{ padding: "28px 30px 24px", borderBottom: `1px solid ${HAIRLINE}`, background: "linear-gradient(180deg,rgba(255,255,255,0.02),rgba(7,16,27,0.96))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 760 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", boxShadow: EDGE_RING, marginBottom: 18 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: PREVIEW_MODE ? "#facc15" : "#34d399" }} />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#dbe4f0" }}>
                  {PREVIEW_MODE ? "Mock preview" : "Live standings"}
                </span>
              </div>

              <h1 style={{ fontSize: isMobile ? 40 : 58, lineHeight: 0.96, margin: "0 0 12px", letterSpacing: isMobile ? -1.6 : -2.8 }}>
                Leaderboard hierarchy
                <br />
                after the latest rounds.
              </h1>
              <div style={{ maxWidth: 640, fontSize: 14, lineHeight: 1.82, color: MUTED_TEXT }}>
                This is still mock data by design, but the layout is now built like a product dashboard instead of a placeholder: big signals up top, dense ranking table in the center, and a side rail for momentum and race context.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["drivers", "Drivers"], ["constructors", "Constructors"]].map(([value, label]) => {
                const active = tab === value;
                return (
                  <button
                    key={value}
                    onClick={() => setTab(value)}
                    style={{
                      background: active ? "linear-gradient(180deg,rgba(255,255,255,0.05),rgba(15,24,44,0.96))" : PANEL_BG_ALT,
                      border: active ? "1px solid rgba(248,250,252,0.14)" : "1px solid rgba(148,163,184,0.14)",
                      borderRadius: 14,
                      color: active ? "#fff" : MUTED_TEXT,
                      cursor: "pointer",
                      padding: "11px 15px",
                      fontSize: 13,
                      fontWeight: 800,
                      boxShadow: active ? SOFT_SHADOW : "none",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 12, padding: 18 }}>
          <SummaryMetric label="Leader" value={leader.name} detail={`${leader.points} pts after ${lastContextRace?.n || "four rounds"}`} accent={teamAccent(leader.team)} />
          <SummaryMetric label="Title gap" value="9 pts" detail="Leader to P2" accent="#dbeafe" />
          <SummaryMetric label="Top team" value={strongestTeam.team} detail={`${strongestTeam.points} points on the constructor side`} accent={teamAccent(strongestTeam.team)} />
          <SummaryMetric label="Status" value="Preview" detail="Layout approved first, live feed later" accent="#fde68a" />
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.1fr) 320px", gap: 16 }}>
        <div
          style={{
            borderRadius: SECTION_RADIUS,
            border: PANEL_BORDER,
            background: PANEL_BG,
            overflow: "hidden",
            boxShadow: SOFT_SHADOW,
          }}
        >
          <div style={{ padding: "18px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                {tab === "drivers" ? "Driver table" : "Constructor table"}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1.1, marginBottom: 6 }}>{headline.title}</div>
              <div style={{ fontSize: 13, color: MUTED_TEXT }}>{headline.detail}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
              Dense view · race-by-race form
            </div>
          </div>

          <div style={{ display: "grid", gap: 1, background: HAIRLINE, overflowX: isMobile ? "auto" : "visible" }}>
            {activeRows.map((row) => {
              const teamName = row.team;
              const accent = teamAccent(teamName);
              const isLeader = row.pos === 1;

              return (
                <div
                  key={`${tab}-${row.pos}-${teamName}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "66px minmax(260px,1fr) 128px 118px",
                    gap: 0,
                    background: isLeader ? "linear-gradient(180deg,rgba(255,255,255,0.02),#0c1525)" : PANEL_BG,
                    alignItems: "stretch",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRight: `1px solid ${HAIRLINE}` }}>
                    <div style={{ width: 38, height: 38, borderRadius: 14, background: isLeader ? `${accent}26` : PANEL_BG_ALT, border: `1px solid ${isLeader ? `${accent}44` : "rgba(148,163,184,0.14)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900 }}>
                      {row.pos}
                    </div>
                  </div>

                  <div style={{ padding: "16px 18px 15px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.4 }}>{tab === "drivers" ? row.name : row.team}</div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED_TEXT }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
                        {tab === "drivers" ? row.team : "Constructor points flow"}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT }}>
                      Recent form: <span style={{ color: "#dbe4f0" }}>{row.form}</span>
                    </div>
                  </div>

                  <div style={{ borderLeft: `1px solid ${HAIRLINE}`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "12px 10px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                      Gap
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{row.gap}</div>
                    {tab === "drivers" && (
                      <div style={{ marginTop: 6, fontSize: 11, color: row.change.startsWith("+") ? "#86efac" : row.change.startsWith("-") ? "#fca5a5" : SUBTLE_TEXT }}>
                        {row.change}
                      </div>
                    )}
                  </div>

                  <div style={{ borderLeft: `1px solid ${HAIRLINE}`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "12px 10px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                      Points
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8 }}>{row.points}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                Momentum
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.6 }}>Who is moving</div>
            </div>
            <div style={{ display: "grid", gap: 10, padding: 14 }}>
              {MOCK_DRIVERS.slice(0, 4).map((driver) => (
                <div key={driver.name} style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: "14px 14px 13px", boxShadow: EDGE_RING }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 5 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{driver.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: driver.change.startsWith("+") ? "#86efac" : driver.change.startsWith("-") ? "#fca5a5" : "#cbd5e1" }}>
                      {driver.change}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED_TEXT }}>{driver.team} · {driver.points} pts</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                Snapshot
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.6 }}>Why this layout works</div>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 13, lineHeight: 1.82, color: MUTED_TEXT, marginBottom: 14 }}>
                The page now separates three jobs clearly: large summary metrics, a dense ranking table, and a side rail for movement. When you decide to switch from mock to live data, this exact structure can stay.
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  ["Big signals first", "Leader, gap and top team are visible before the user touches the table."],
                  ["Table feels product-grade", "The ranking block behaves like a real dashboard, not a placeholder list."],
                  ["Easy live-data upgrade", "Only the rows need to change once the standings feed is connected."],
                ].map(([title, copy]) => (
                  <div key={title} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: "13px 14px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>{title}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT }}>{copy}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
