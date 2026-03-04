import { useState } from "react";
import { CAL, rc, fmt, fmtFull } from "../constants/calendar";

export default function CalendarPage() {
  const [sel, setSel] = useState(null);
  const [filt, setFilt] = useState("all");

  const filtered = filt === "all" ? CAL : filt === "sprint" ? CAL.filter(r => r.sprint) : CAL.filter(r => r.type.toLowerCase() === filt.toLowerCase());
  const months = filtered.reduce((acc, r) => {
    const m = new Date(r.date).toLocaleString("en-GB", { month: "long", year: "numeric" });
    if (!acc[m]) acc[m] = [];
    acc[m].push(r);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "52px 28px", position: "relative", zIndex: 1 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 6px", letterSpacing: -1 }}>2026 F1 Calendar</h1>
        <p style={{ color: "rgba(255,255,255,0.38)", margin: 0, fontSize: 13 }}>24 Grands Prix · 6 Sprint Weekends · NEW: Madrid GP debuts</p>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 26, flexWrap: "wrap" }}>
        {[["all", "All Races"], ["sprint", "Sprint Weekends"], ["Street", "Street Circuits"], ["Permanent", "Permanent Circuits"]].map(([f, l]) => (
          <button key={f} onClick={() => setFilt(f)} style={{ background: filt === f ? "linear-gradient(135deg,#E8002D,#FF6B35)" : "rgba(255,255,255,0.05)", border: filt === f ? "none" : "1px solid rgba(255,255,255,0.09)", borderRadius: 20, color: filt === f ? "#fff" : "rgba(255,255,255,0.48)", cursor: "pointer", fontWeight: 600, padding: "6px 15px", fontSize: 12 }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 360px" : "1fr", gap: 20, alignItems: "start" }}>
        <div>
          {Object.entries(months).map(([month, races]) => (
            <div key={month} style={{ marginBottom: 26 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginBottom: 8 }}>{month}</div>
              <div style={{ borderRadius: 11, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                {races.map((race, i) => (
                  <div key={race.r} onClick={() => setSel(sel?.r === race.r ? null : race)} style={{ display: "flex", alignItems: "center", borderBottom: i < races.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", cursor: "pointer", background: sel?.r === race.r ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)" }}>
                    <div style={{ width: 4, alignSelf: "stretch", background: rc(race), flexShrink: 0 }} />
                    <div style={{ width: 44, textAlign: "center", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.18)", flexShrink: 0 }}>R{race.r}</div>
                    <div style={{ flex: 1, padding: "13px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{race.n}</span>
                        {race.sprint && <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#FF8700", padding: "1px 6px", borderRadius: 8, background: "rgba(255,135,0,0.11)", border: "1px solid rgba(255,135,0,0.22)" }}>Sprint</span>}
                        {race.r === 16 && <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#FBBF24", padding: "1px 6px", borderRadius: 8, background: "rgba(251,191,36,0.11)", border: "1px solid rgba(251,191,36,0.22)" }}>New</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>{race.circuit}</div>
                    </div>
                    <div style={{ width: 80, textAlign: "right", padding: "0 14px", fontSize: 12, color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>{fmt(race.date)}</div>
                    <div style={{ width: 90, padding: "0 10px", flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: race.type === "Street" ? "#FBBF24" : "#34D399", background: race.type === "Street" ? "rgba(251,191,36,0.1)" : "rgba(52,211,153,0.1)", border: `1px solid ${race.type === "Street" ? "rgba(251,191,36,0.22)" : "rgba(52,211,153,0.22)"}`, borderRadius: 10, padding: "2px 8px" }}>{race.type}</span>
                    </div>
                    <div style={{ width: 32, textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 12, transform: sel?.r === race.r ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>›</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {sel && (
          <div style={{ position: "sticky", top: 70 }}>
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(16px)", background: "rgba(10,10,28,0.92)" }}>
              <div style={{ height: 4, background: `linear-gradient(90deg,${rc(sel)},${rc(sel)}66)` }} />
              <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 7 }}>Round {sel.r} of 24</div>
                    <h2 style={{ margin: "0 0 3px", fontWeight: 900, fontSize: 19, letterSpacing: -0.5 }}>{sel.n}</h2>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>{sel.city}, {sel.cc}</div>
                  </div>
                  <button onClick={() => setSel(null)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 7, color: "rgba(255,255,255,0.38)", cursor: "pointer", width: 27, height: 27, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12 }}>✕</button>
                </div>
              </div>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: `linear-gradient(135deg,${rc(sel)}10,transparent)` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: rc(sel), marginBottom: 5 }}>Lap Record</div>
                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>{sel.rec}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{sel.recBy} · {sel.recY}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,0.04)" }}>
                {[["Race Date", fmtFull(sel.date)], ["Length", `${sel.len} km`], ["Laps", sel.laps], ["Race Dist.", `${(sel.len * sel.laps).toFixed(1)} km`], ["Turns", sel.turns], ["DRS Zones", sel.drs], ["Elevation", `${sel.elev} m`], ["Type", sel.type]].map(([l, v], i) => (
                  <div key={l} style={{ padding: "12px 15px", background: "rgba(8,8,26,0.72)", margin: "1px 0 0 " + (i % 2 === 1 ? "1px" : "0") }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
