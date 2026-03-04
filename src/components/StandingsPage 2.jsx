import { useState, useEffect } from "react";
import { TEAMS } from "../constants/teams";

export default function StandingsPage() {
  const [drivers, setDrivers] = useState([]);
  const [constructors, setConstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("drivers");
  const seasonStarted = new Date() >= new Date("2026-03-08");

  useEffect(() => {
    if (seasonStarted) fetchStandings();
    else setLoading(false);
  }, []); // eslint-disable-line

  const fetchStandings = async () => {
    setLoading(true);
    try {
      const sessRes = await fetch("https://api.openf1.org/v1/sessions?year=2026&session_name=Race");
      const sessions = await sessRes.json();
      if (!sessions.length) { setLoading(false); return; }
      const latest = sessions[sessions.length - 1].session_key;
      const dRes = await fetch(`https://api.openf1.org/v1/championship_drivers?session_key=${latest}`);
      setDrivers((await dRes.json()).sort((a, b) => b.points - a.points));
      const cRes = await fetch(`https://api.openf1.org/v1/championship_teams?session_key=${latest}`);
      setConstructors((await cRes.json()).sort((a, b) => b.points - a.points));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (!seasonStarted) return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "52px 28px", position: "relative", zIndex: 1 }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 6px", letterSpacing: -1 }}>2026 Standings</h1>
      <p style={{ color: "rgba(255,255,255,0.38)", margin: "0 0 50px", fontSize: 13 }}>Live data from OpenF1 · Updated after each race</p>
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🏎️</div>
        <h2 style={{ fontWeight: 900, fontSize: 24, margin: "0 0 12px" }}>Season Starts March 8</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, maxWidth: 340, margin: "0 auto 24px", lineHeight: 1.6 }}>
          Live driver and constructor standings will appear here once the 2026 Australian Grand Prix gets underway.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20, background: "rgba(232,0,45,0.12)", border: "1px solid rgba(232,0,45,0.25)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8002D" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#FF6B6B" }}>Season starting soon</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "52px 28px", position: "relative", zIndex: 1 }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 6px", letterSpacing: -1 }}>2026 Standings</h1>
      <p style={{ color: "rgba(255,255,255,0.38)", margin: "0 0 22px", fontSize: 13 }}>Live data from OpenF1 · Updated after each race</p>
      <div style={{ display: "flex", gap: 1, marginBottom: 22, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {[["drivers", "Drivers"], ["constructors", "Constructors"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "#E8002D" : "transparent"}`, cursor: "pointer", padding: "11px 18px", fontSize: 13, fontWeight: tab === t ? 700 : 400, color: tab === t ? "#fff" : "rgba(255,255,255,0.38)", marginBottom: -1 }}>{l}</button>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading standings...</div>
      ) : tab === "drivers" ? (
        <div style={{ borderRadius: 11, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
          {drivers.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No standings data yet</div>
          ) : drivers.map((d, i) => {
            const tm = TEAMS[d.team_name] || { c: "#666", t: "#fff" };
            return (
              <div key={d.driver_number} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: i < drivers.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i === 0 ? "rgba(232,0,45,0.04)" : "transparent" }}>
                <div style={{ width: 28, textAlign: "center", fontSize: i < 3 ? 15 : 12, fontWeight: 900, color: i === 0 ? "#E8002D" : i === 1 ? "#9CA3AF" : i === 2 ? "#B87333" : "rgba(255,255,255,0.2)", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ width: 4, height: 32, borderRadius: 2, background: tm.c, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{d.full_name || d.driver_number}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{d.team_name}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: i === 0 ? "#E8002D" : "rgba(255,255,255,0.85)" }}>{d.points} <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.3)" }}>pts</span></div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ borderRadius: 11, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
          {constructors.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No standings data yet</div>
          ) : constructors.map((c, i) => {
            const tm = TEAMS[c.team_name] || { c: "#666", t: "#fff" };
            return (
              <div key={c.team_name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: i < constructors.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i === 0 ? "rgba(232,0,45,0.04)" : "transparent" }}>
                <div style={{ width: 28, textAlign: "center", fontSize: i < 3 ? 15 : 12, fontWeight: 900, color: i === 0 ? "#E8002D" : i === 1 ? "#9CA3AF" : i === 2 ? "#B87333" : "rgba(255,255,255,0.2)", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ width: 4, height: 32, borderRadius: 2, background: tm.c, flexShrink: 0 }} />
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800 }}>{c.team_name}</div></div>
                <div style={{ fontSize: 20, fontWeight: 900, color: i === 0 ? "#E8002D" : "rgba(255,255,255,0.85)" }}>{c.points} <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.3)" }}>pts</span></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
