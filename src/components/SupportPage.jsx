import {
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

const supportTopics = [
  {
    title: "Account and login",
    subject: "Account help",
    detail: "Password reset issues, confirmation emails, duplicate usernames, or profile setup problems.",
  },
  {
    title: "Predictions and scoring",
    subject: "Prediction or scoring issue",
    detail: "Missing picks, lock timing questions, incorrect score calculations, or race-result disputes.",
  },
  {
    title: "Leagues and community",
    subject: "League or forum issue",
    detail: "League creation issues, standings mismatches, forum posts, replies, or access problems.",
  },
  {
    title: "Bug report",
    subject: "Bug report",
    detail: "UI problems, broken layouts, loading errors, or anything that looks clearly off in the product.",
  },
];

const supportChecklist = [
  "your username",
  "the race weekend or page involved",
  "what you expected to happen",
  "what actually happened",
  "a screenshot if the issue is visual",
];

export default function SupportPage() {
  const { isMobile, isTablet } = useViewport();
  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <section style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: `linear-gradient(180deg,rgba(10,18,32,0.98),${PANEL_BG} 24%)`, overflow: "hidden", marginBottom: 18, boxShadow: LIFTED_SHADOW }}>
        <div style={{ padding: "28px 30px 24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", boxShadow: EDGE_RING, marginBottom: 18 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316" }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#dbe4f0" }}>
              Contact Support
            </span>
          </div>
          <h1 style={{ fontSize: isMobile ? 40 : 58, lineHeight: 0.96, letterSpacing: isMobile ? -1.6 : -2.8, margin: "0 0 12px" }}>
            Get help fast.
            <br />
            Send the right context.
          </h1>
          <div style={{ maxWidth: 760, fontSize: 14, lineHeight: 1.8, color: MUTED_TEXT }}>
            Use support for account issues, scoring disputes, league problems or bugs. The faster path is to include the exact weekend, your username and what broke.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "0.9fr 1.1fr", gap: 1, background: HAIRLINE }}>
          <div style={{ background: PANEL_BG, padding: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
              Main contact
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8, marginBottom: 10 }}>
              {SUPPORT_EMAIL}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.78, color: MUTED_TEXT, marginBottom: 14 }}>
              Best for support tickets, scoring questions, league issues and bug reports. Include enough context so support can reproduce the problem quickly.
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Apex%20Fantasy%20Support`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 180,
                background: "linear-gradient(135deg,#2563eb,#06b6d4)",
                border: "none",
                borderRadius: 14,
                color: "#fff",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 800,
                padding: "12px 16px",
              }}
            >
              Email support
            </a>
          </div>

          <div style={{ background: PANEL_BG, padding: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
              Include this in your message
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {supportChecklist.map((item, index) => (
                <div key={item} style={{ borderRadius: CARD_RADIUS, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: EDGE_RING }}>
                  <div style={{ width: 24, height: 24, borderRadius: 999, background: "rgba(249,115,22,0.14)", border: "1px solid rgba(249,115,22,0.26)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>
                    {index + 1}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: MUTED_TEXT }}>{item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 18 }}>
        {supportTopics.map((topic) => (
          <div key={topic.title} style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>{topic.title}</div>
            </div>
            <div style={{ padding: "18px 18px 16px" }}>
              <div style={{ fontSize: 13, lineHeight: 1.78, color: MUTED_TEXT, marginBottom: 14 }}>
                {topic.detail}
              </div>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Apex Fantasy - ${topic.subject}`)}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: PANEL_BG_ALT,
                  border: "1px solid rgba(148,163,184,0.16)",
                  borderRadius: 12,
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "11px 14px",
                }}
              >
                Start this support email
              </a>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
