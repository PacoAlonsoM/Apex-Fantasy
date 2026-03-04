
import { CAL, rc, nextRace, fmtFull, countdown } from "../constants/calendar";

export default function HomePage({ user, setPage, openAuth }) {
  const next = nextRace();
  const cd = next ? countdown(next.date) : null;

  const scoring = [
    ["Race Winner", "25", "#E8002D"], ["2nd Place", "18", "#9CA3AF"], ["3rd Place", "15", "#B87333"],
    ["Pole Position", "10", "#A78BFA"], ["DNF Driver", "12", "#F97316"], ["Red Flag Y/N", "8", "#EF4444"],
    ["Best Constructor", "8", "#34D399"], ["Fastest Lap", "7", "#06B6D4"], ["Driver of the Day", "6", "#F472B6"],
    ["Safety Car Y/N", "5", "#FBBF24"], ["Perfect Podium Bonus", "+15", "#FF6B35"],
  ];

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "52px 28px", position: "relative", zIndex: 1 }}>
      <div style={{ marginBottom: 56 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: "rgba(232,0,45,0.14)", border: "1px solid rgba(232,0,45,0.28)", marginBottom: 22 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#E8002D" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FF6B6B" }}>2026 Season — Open for Predictions</span>
        </div>
        <h1 style={{ fontSize: 66, fontWeight: 900, lineHeight: 0.95, margin: "0 0 22px", letterSpacing: -3, maxWidth: 600 }}>
          The F1<br />
          <span style={{ background: "linear-gradient(135deg,#E8002D 0%,#FF6B35 50%,#FBBF24 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Fantasy</span><br />
          Platform.
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.48)", lineHeight: 1.7, margin: "0 0 28px", maxWidth: 420 }}>
          Make race predictions, earn points for every correct call, and battle your friends across all 24 rounds of 2026.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {user
            ? <button style={{ background: "linear-gradient(135deg,#E8002D,#FF6B35)", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "13px 30px" }} onClick={() => setPage("predictions")}>Make Your Picks</button>
            : <button style={{ background: "linear-gradient(135deg,#E8002D,#FF6B35)", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "13px 30px" }} onClick={() => openAuth("register")}>Get Started</button>
          }
          <button style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 14, padding: "13px 30px" }} onClick={() => setPage("calendar")}>View Calendar</button>
        </div>
      </div>

      {next && cd && (
        <div style={{ borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", padding: "22px 26px", marginBottom: 26, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", backdropFilter: "blur(10px)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Next Race — Round {next.r} / 24</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 4, height: 22, borderRadius: 2, background: rc(next) }} />
              <div style={{ fontSize: 23, fontWeight: 900, letterSpacing: -0.5 }}>{next.n}</div>
              {next.sprint && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#FF8700", padding: "2px 8px", borderRadius: 10, background: "rgba(255,135,0,0.12)", border: "1px solid rgba(255,135,0,0.28)" }}>Sprint</span>}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>{next.circuit} · {fmtFull(next.date)}</div>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {[["Days", cd.d], ["Hrs", cd.h], ["Min", cd.m]].map(([l, v]) => (
              <div key={l} style={{ textAlign: "center", padding: "12px 18px", borderRadius: 11, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, background: "linear-gradient(180deg,#fff,rgba(255,255,255,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{String(v).padStart(2, "0")}</div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", background: "rgba(255,255,255,0.03)" }}>
        <div style={{ background: "linear-gradient(135deg,rgba(232,0,45,0.18),rgba(255,107,53,0.08))", padding: "15px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FF8080" }}>Points System</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {scoring.map(([l, p, c], i) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 2, height: 12, background: c, borderRadius: 1 }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.62)" }}>{l}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 900, color: c }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
