import { useMemo, useState } from "react";
import { TEAMS } from "../constants/teams";
import { CAL } from "../constants/calendar";
import { PANEL_BG, PANEL_BG_ALT, PANEL_BG_STRONG, PANEL_BORDER, MUTED_TEXT, SUBTLE_TEXT, HAIRLINE } from "../constants/design";

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

function SummaryCard({ label, value, detail, accent = "#e2e8f0" }) {
  return (
    <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.16)", background: PANEL_BG_ALT, padding: "16px 16px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8, color: accent, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: MUTED_TEXT }}>{detail}</div>
    </div>
  );
}

export default function StandingsPage() {
  const [tab, setTab] = useState("drivers");

  const leader = MOCK_DRIVERS[0];
  const strongestTeam = MOCK_CONSTRUCTORS[0];
  const lastContextRace = PREVIEW_MODE ? CAL[PREVIEW_COMPLETED_ROUNDS - 1] : null;
  const leaderAccent = TEAMS[leader.team]?.c || "#f97316";
  const teamAccent = TEAMS[strongestTeam.team]?.c || "#99f6e4";
  const activeRows = tab === "drivers" ? MOCK_DRIVERS : MOCK_CONSTRUCTORS;

  const headline = useMemo(() => {
    if (tab === "drivers") {
      return {
        title: "Driver championship board",
        detail: `Who is controlling the season after ${lastContextRace?.n || "the latest round"}.`,
      };
    }
    return {
      title: "Constructor race",
      detail: `Which team left ${lastContextRace?.n || "the latest round"} with the strongest position.`,
    };
  }, [lastContextRace, tab]);

  return (
    <div style={{ maxWidth: 1220, margin: "0 auto", padding: "44px 28px 80px", position: "relative", zIndex: 1 }}>
      <section style={{ borderRadius: 26, border: PANEL_BORDER, background: PANEL_BG_STRONG, padding: "24px 26px 22px", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: "#101a2d", border: "1px solid rgba(148,163,184,0.14)", marginBottom: 14 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: PREVIEW_MODE ? "#facc15" : "#2dd4bf" }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#cbd5e1" }}>
                {PREVIEW_MODE ? "Mock preview" : "Live standings"}
              </span>
            </div>
            <h1 style={{ fontSize: 46, lineHeight: 0.98, margin: "0 0 10px", letterSpacing: -2 }}>
              Championship standings
              <br />
              as a proper product dashboard.
            </h1>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: MUTED_TEXT }}>
              This page is intentionally mock data for now so you can judge the structure and hierarchy before we wire the real championship feed.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[["drivers", "Drivers"], ["constructors", "Constructors"]].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                style={{
                  background: tab === value ? "#17263f" : PANEL_BG_ALT,
                  border: tab === value ? "1px solid rgba(248,250,252,0.24)" : "1px solid rgba(148,163,184,0.14)",
                  borderRadius: 14,
                  color: tab === value ? "#fff" : MUTED_TEXT,
                  cursor: "pointer",
                  padding: "11px 15px",
                  fontSize: 13,
                  fontWeight: 800,
                  boxShadow: tab === value ? "0 12px 26px rgba(0,0,0,0.2)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 18 }}>
        <SummaryCard label="Leader" value={leader.name} detail={`${leader.points} pts after ${lastContextRace?.n || "four rounds"}`} accent={leaderAccent} />
        <SummaryCard label="Title gap" value="9 pts" detail="Leader to P2" accent="#bfdbfe" />
        <SummaryCard label="Top team" value={strongestTeam.team} detail={`${strongestTeam.points} constructor points`} accent={teamAccent} />
        <SummaryCard label="Status" value="Preview" detail="Mock standings layout before live data import" accent="#fde68a" />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.08fr) 320px", gap: 16 }}>
        <div style={{ borderRadius: 24, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "18px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                {tab === "drivers" ? "Drivers view" : "Constructors view"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6 }}>{headline.title}</div>
            </div>
            <div style={{ fontSize: 12, color: MUTED_TEXT }}>{headline.detail}</div>
          </div>

          <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
            {activeRows.map((row) => {
              const teamName = tab === "drivers" ? row.team : row.team;
              const team = TEAMS[teamName] || { c: "#94a3b8" };
              const leaderRow = row.pos === 1;

              return (
                <div key={`${tab}-${row.pos}-${teamName}`} style={{ display: "grid", gridTemplateColumns: "60px 5px minmax(0,1fr) 120px 120px", background: leaderRow ? "#111c30" : PANEL_BG, alignItems: "stretch" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: leaderRow ? "#fff" : SUBTLE_TEXT }}>
                    {row.pos}
                  </div>
                  <div style={{ background: team.c }} />
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.3 }}>{tab === "drivers" ? row.name : row.team}</div>
                      {tab === "drivers" && <span style={{ fontSize: 11, color: MUTED_TEXT }}>{row.team}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED_TEXT }}>Recent form: {row.form}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", borderLeft: `1px solid ${HAIRLINE}` }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>Gap</div>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{row.gap}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", borderLeft: `1px solid ${HAIRLINE}` }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>Points</div>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8 }}>{row.points}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ borderRadius: 22, border: PANEL_BORDER, background: PANEL_BG, padding: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Movement</div>
            <div style={{ display: "grid", gap: 10 }}>
              {MOCK_DRIVERS.slice(0, 4).map((driver) => (
                <div key={driver.name} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: "12px 13px 11px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{driver.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: driver.change.startsWith("+") ? "#99f6e4" : driver.change.startsWith("-") ? "#fca5a5" : "#cbd5e1" }}>{driver.change}</div>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED_TEXT }}>{driver.team} · {driver.points} pts</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderRadius: 22, border: PANEL_BORDER, background: PANEL_BG, padding: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Page note</div>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>This is intentionally mock data.</div>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: MUTED_TEXT }}>
              The layout is the point here: summary cards, a dense championship table, clear gaps, and a side panel for movement. When you tell me to switch it back, I can keep this structure and wire real data in.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
