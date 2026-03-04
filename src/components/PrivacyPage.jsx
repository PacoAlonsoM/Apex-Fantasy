import {
  BRAND_NAME,
  CARD_RADIUS,
  CONTENT_MAX,
  HAIRLINE,
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

function SectionBlock({ title, children }) {
  return (
    <section style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
        <h2 style={{ margin: 0, fontSize: 20, letterSpacing: -0.5 }}>{title}</h2>
      </div>
      <div style={{ padding: "16px 18px 18px", display: "grid", gap: 10, fontSize: 13, lineHeight: 1.8, color: MUTED_TEXT }}>
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  const { isMobile, isTablet } = useViewport();
  const effectiveDate = "March 4, 2026";

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <section style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "24px 28px 22px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Legal</div>
          <h1 style={{ margin: "0 0 10px", fontSize: isMobile ? 38 : 54, lineHeight: 0.95, letterSpacing: isMobile ? -1.4 : -2.4 }}>Privacy Policy</h1>
          <div style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.8 }}>
            Effective date: <strong style={{ color: "#fafafa" }}>{effectiveDate}</strong> · This policy explains how {BRAND_NAME} handles user data.
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gap: 14 }}>
        <SectionBlock title="1. Data We Collect">
          <p style={{ margin: 0 }}>Account data: email, username, authentication identifiers, and profile preferences (such as avatar color and supported team).</p>
          <p style={{ margin: 0 }}>Gameplay data: predictions, league memberships, points, standings interactions, and forum or chat posts.</p>
          <p style={{ margin: 0 }}>Operational data: timestamps, basic logs, and service diagnostics needed for reliability and abuse prevention.</p>
        </SectionBlock>

        <SectionBlock title="2. How We Use Data">
          <p style={{ margin: 0 }}>We use data to authenticate users, save picks, calculate standings, run leagues, moderate community spaces, and improve product quality.</p>
          <p style={{ margin: 0 }}>We may use aggregated, non-identifying usage patterns to improve features and race-week performance.</p>
        </SectionBlock>

        <SectionBlock title="3. Third-Party Services">
          <p style={{ margin: 0 }}>The platform uses third-party infrastructure and APIs (for example authentication, database, and race/news data providers). Those services process data according to their own policies.</p>
          <p style={{ margin: 0 }}>We do not sell personal data to data brokers.</p>
        </SectionBlock>

        <SectionBlock title="4. Community Content">
          <p style={{ margin: 0 }}>Posts, replies, and league chat messages are visible according to their forum scope (global or league-specific). Do not post private information you do not want other users to see.</p>
          <p style={{ margin: 0 }}>We reserve the right to remove content that violates platform rules or legal requirements.</p>
        </SectionBlock>

        <SectionBlock title="5. Security and Retention">
          <p style={{ margin: 0 }}>We use reasonable security controls through our hosting and database providers, but no internet service can guarantee absolute security.</p>
          <p style={{ margin: 0 }}>We keep data for as long as needed to operate the platform, resolve disputes, comply with legal obligations, and maintain ranking integrity.</p>
        </SectionBlock>

        <SectionBlock title="6. Your Rights and Requests">
          <p style={{ margin: 0 }}>You can request account updates or deletion by contacting support. Some records may be retained when required for legal, security, anti-fraud, or score-audit purposes.</p>
          <p style={{ margin: 0 }}>Contact: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--team-accent)", textDecoration: "none", fontWeight: 700 }}>{SUPPORT_EMAIL}</a>.</p>
        </SectionBlock>
      </div>
    </div>
  );
}
