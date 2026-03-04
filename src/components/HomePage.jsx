import { rc, nextRace, fmtFull, countdown } from "../constants/calendar";
import {
  BRAND_GRADIENT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BG_STRONG,
  PANEL_BORDER,
  SUBTLE_TEXT,
  HAIRLINE,
} from "../constants/design";
import BrandMark from "./BrandMark";

const scoring = [
  ["Race Winner", "25"],
  ["2nd Place", "18"],
  ["3rd Place", "15"],
  ["Pole Position", "10"],
  ["DNF Driver", "12"],
  ["Fastest Lap", "7"],
  ["Driver of the Day", "6"],
  ["Safety Car", "5"],
];

export default function HomePage({ user, setPage }) {
  const next = nextRace();
  const cd = next ? countdown(next.date) : null;

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 28px 72px", position: "relative", zIndex: 1 }}>
      <section style={{ position: "relative", overflow: "hidden", borderRadius: 30, border: PANEL_BORDER, background: "linear-gradient(180deg,var(--team-accent-ghost),rgba(8,17,29,0.98) 32%)", padding: "38px 32px 30px", boxShadow: "0 30px 70px rgba(0,0,0,0.28)", textAlign: "center", marginBottom: 14 }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: -42, left: "50%", transform: "translateX(-50%)", opacity: 0.12 }}>
            <BrandMark size={176} ghost />
          </div>
          <div style={{ position: "absolute", right: 48, top: 42, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, var(--team-accent-soft), rgba(56,189,248,0))" }} />
          <div style={{ position: "absolute", left: 60, bottom: 28, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, var(--team-accent-ghost), rgba(249,115,22,0))" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
            <BrandMark size={58} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: "#e2e8f0" }}>Apex Fantasy</div>
            </div>
          </div>

          <h1 style={{ fontSize: 68, lineHeight: 0.93, margin: 0, letterSpacing: -3.2 }}>
            Make your picks.
            <br />
            Track the weekend.
            <br />
            Win your league.
          </h1>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
            <button style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 14, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "14px 22px", boxShadow: "0 14px 30px rgba(249,115,22,0.18)" }} onClick={() => setPage("predictions")}>
              Open Predictions
            </button>
            <button style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.18)", borderRadius: 14, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "14px 22px" }} onClick={() => setPage("calendar")}>
              View Calendar
            </button>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(320px,0.84fr) minmax(0,1.16fr)", gap: 18 }}>
        {next && cd && (
          <div style={{ borderRadius: 22, border: PANEL_BORDER, background: "linear-gradient(180deg,var(--team-accent-ghost),rgba(12,20,36,0.98) 20%)", overflow: "hidden" }}>
            <div style={{ height: 4, background: `linear-gradient(90deg,var(--team-accent),${rc(next)})` }} />
            <div style={{ padding: "20px 22px 18px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                Next round
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>{next.n}</div>
              <div style={{ color: "rgba(226,232,240,0.74)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                {next.circuit} · {fmtFull(next.date)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
                {[["Days", cd.d], ["Hours", cd.h], ["Min", cd.m]].map(([label, value]) => (
                  <div key={label} style={{ borderRadius: 14, background: "#132038", border: "1px solid rgba(148,163,184,0.18)", padding: "13px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>{String(value).padStart(2, "0")}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 6 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <section style={{ borderRadius: 22, border: PANEL_BORDER, background: "linear-gradient(180deg,var(--team-accent-ghost),rgba(12,20,36,0.98) 18%)", overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${HAIRLINE}`, background: "linear-gradient(180deg,var(--team-accent-ghost),#101a2d)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Scoring</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, marginTop: 4 }}>How points are won</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1, background: HAIRLINE }}>
            {scoring.map(([label, points]) => (
              <div key={label} style={{ background: PANEL_BG, padding: "14px 16px 13px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8 }}>{points}</div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
