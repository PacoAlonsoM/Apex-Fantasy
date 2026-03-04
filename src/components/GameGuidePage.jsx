import {
  BRAND_GRADIENT,
  CARD_RADIUS,
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
  SUPPORT_EMAIL,
} from "../constants/design";
import useViewport from "../useViewport";

const scoringRows = [
  ["Race Winner", "25 pts"],
  ["2nd Place", "18 pts"],
  ["3rd Place", "15 pts"],
  ["Pole Position", "10 pts"],
  ["Constructor with Most Points", "8 pts"],
  ["DNF Driver", "12 pts"],
  ["Fastest Lap", "7 pts"],
  ["Driver of the Day", "6 pts"],
  ["Safety Car", "5 pts"],
  ["Red Flag", "8 pts"],
];

const coreSteps = [
  {
    title: "Pick the full weekend board",
    detail: "Lock in the categories for the selected Grand Prix before qualifying begins. Sprint weekends add sprint-only picks as well.",
  },
  {
    title: "Track the calendar and news flow",
    detail: "Use Calendar, News and AI Brief together. Calendar tells you what is coming, News shows what is changing, and AI Brief turns that into a sharper race read.",
  },
  {
    title: "Compete across leagues and global rank",
    detail: "Your picks feed both private leagues and the global leaderboard. Strong weekends move you in both places at once.",
  },
];

const faqs = [
  {
    question: "When do predictions lock?",
    answer: "Predictions close right before qualifying starts. Sprint categories appear only on sprint weekends and follow the same race-week lock structure.",
  },
  {
    question: "How are points awarded?",
    answer: "Each category has a fixed score. Correct high-impact calls like podium, pole and DNF picks move your score much more than low-volatility categories.",
  },
  {
    question: "Why should I use AI Brief and News together?",
    answer: "News gives you the raw flow of information. AI Brief turns that into a race-week read, category-level picks and what to watch before you lock your board.",
  },
  {
    question: "How do leagues work?",
    answer: "Leagues are your private competitive spaces. They let you compare points, follow standings, and talk race-week strategy with a smaller group.",
  },
];

export default function GameGuidePage({ setPage }) {
  const { isMobile, isTablet } = useViewport();
  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <section style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: `linear-gradient(180deg,rgba(10,18,32,0.98),${PANEL_BG} 24%)`, overflow: "hidden", marginBottom: 18, boxShadow: LIFTED_SHADOW }}>
        <div style={{ padding: "28px 30px 24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", boxShadow: EDGE_RING, marginBottom: 18 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316" }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#dbe4f0" }}>
              Game Guide
            </span>
          </div>
          <h1 style={{ fontSize: isMobile ? 40 : 58, lineHeight: 0.96, letterSpacing: isMobile ? -1.6 : -2.8, margin: "0 0 12px" }}>
            Learn the board.
            <br />
            Win with better reads.
          </h1>
          <div style={{ maxWidth: 760, fontSize: 14, lineHeight: 1.8, color: MUTED_TEXT }}>
            Apex Fantasy is built around race-week decisions. Use the guide below to understand lock timing, scoring, league play and how the product surfaces information before you submit picks.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1.15fr 0.85fr", gap: 1, background: HAIRLINE }}>
          <div style={{ background: PANEL_BG, padding: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
              How it works
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {coreSteps.map((item, index) => (
                <div key={item.title} style={{ borderRadius: CARD_RADIUS, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "16px 17px", boxShadow: EDGE_RING }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 999, background: "rgba(249,115,22,0.14)", border: "1px solid rgba(249,115,22,0.26)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>
                      {index + 1}
                    </span>
                    <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>{item.title}</div>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.78, color: MUTED_TEXT }}>{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: PANEL_BG, padding: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
              Quick actions
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                ["Open Predictions", "predictions", BRAND_GRADIENT],
                ["View Calendar", "calendar", PANEL_BG_ALT],
                ["Read AI Brief", "ai-brief", PANEL_BG_ALT],
                ["Open Community", "community", PANEL_BG_ALT],
              ].map(([label, target, background]) => (
                <button
                  key={target}
                  onClick={() => setPage(target)}
                  style={{
                    background,
                    border: background === BRAND_GRADIENT ? "none" : "1px solid rgba(148,163,184,0.16)",
                    borderRadius: 14,
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 800,
                    padding: "14px 16px",
                    textAlign: "left",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 14, borderRadius: CARD_RADIUS, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "16px 16px 14px", boxShadow: EDGE_RING }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                Need help?
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: MUTED_TEXT, marginBottom: 10 }}>
                If a rule is unclear or something looks off in scoring or league behavior, contact support and include your username plus the race weekend involved.
              </div>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Apex%20Fantasy%20Support`} style={{ color: "var(--team-accent)", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "0.96fr 1.04fr", gap: 18, marginBottom: 18 }}>
        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
              Scoring Map
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6 }}>Where big weekends come from</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 1, background: HAIRLINE }}>
            {scoringRows.map(([label, value]) => (
              <div key={label} style={{ background: PANEL_BG, padding: "14px 16px 13px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
              FAQ
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6 }}>What most players need to know</div>
          </div>
          <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
            {faqs.map((item) => (
              <div key={item.question} style={{ background: PANEL_BG, padding: "16px 18px" }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{item.question}</div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: MUTED_TEXT }}>{item.answer}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
