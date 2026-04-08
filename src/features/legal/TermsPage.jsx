import {
  BRAND_NAME,
  CARD_RADIUS,
  CONTENT_MAX,
  HAIRLINE,
  LEGAL_DISCLAIMER,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  SUPPORT_EMAIL,
} from "@/src/constants/design";
import useViewport from "@/src/lib/useViewport";

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

export default function TermsPage() {
  const { isMobile, isTablet } = useViewport();
  const effectiveDate = "March 4, 2026";

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <section style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "24px 28px 22px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Legal</div>
          <h1 style={{ margin: "0 0 10px", fontSize: isMobile ? 38 : 54, lineHeight: 0.95, letterSpacing: isMobile ? -1.4 : -2.4 }}>Terms & Conditions</h1>
          <div style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.8 }}>
            Effective date: <strong style={{ color: "#fafafa" }}>{effectiveDate}</strong> · These terms govern use of {BRAND_NAME}.
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gap: 14 }}>
        <SectionBlock title="1. Platform Scope">
          <p style={{ margin: 0 }}>{BRAND_NAME} is a race-week prediction product for Formula 1 fans. Picks, standings and league results are for entertainment use and do not represent betting, financial, or official sporting outcomes.</p>
          <p style={{ margin: 0 }}>{LEGAL_DISCLAIMER}</p>
        </SectionBlock>

        <SectionBlock title="2. Accounts and Access">
          <p style={{ margin: 0 }}>You are responsible for account security, login credentials, and any actions performed under your account. Usernames must be unique and must not impersonate other people, teams, media outlets, or official organizations.</p>
          <p style={{ margin: 0 }}>We may suspend or remove accounts that abuse the service, manipulate standings, harass users, or violate these terms.</p>
        </SectionBlock>

        <SectionBlock title="3. Predictions, Locks and Scoring">
          <p style={{ margin: 0 }}>Predictions lock according to race-week timing shown in the product. Locked picks are final for that race window unless a visible system correction is applied by administrators due to data errors.</p>
          <p style={{ margin: 0 }}>Scoring is based on the category rules published in the app and may be updated for future rounds. Historical scoring corrections may be applied to preserve fairness when data sources are corrected.</p>
        </SectionBlock>

        <SectionBlock title="4. Content and Intellectual Property">
          <p style={{ margin: 0 }}>{BRAND_NAME} branding, UI, and original product content belong to {BRAND_NAME}. Third-party trademarks and team names remain property of their respective owners.</p>
          <p style={{ margin: 0 }}>News links and source references are provided for informational context. You must not copy, republish, or commercially reuse third-party content from this platform unless you have rights from the original publisher.</p>
        </SectionBlock>

        <SectionBlock title="5. Community and Leagues">
          <p style={{ margin: 0 }}>Forum, league chat, and profile content must remain respectful and lawful. Prohibited behavior includes hate speech, threats, spam, impersonation, illegal content, or attempts to disrupt normal gameplay.</p>
          <p style={{ margin: 0 }}>League owners and administrators may moderate private league spaces. Platform administrators may remove content that violates these terms.</p>
        </SectionBlock>

        <SectionBlock title="6. Service Availability and Liability">
          <p style={{ margin: 0 }}>The service is provided “as is.” We do not guarantee uninterrupted uptime, complete data accuracy from external feeds, or continuous feature availability.</p>
          <p style={{ margin: 0 }}>To the maximum extent allowed by law, {BRAND_NAME} is not liable for indirect damages, lost data, missed predictions, or league outcomes resulting from outages, API changes, or feed delays.</p>
        </SectionBlock>

        <SectionBlock title="7. Contact and Updates">
          <p style={{ margin: 0 }}>Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--team-accent)", textDecoration: "none", fontWeight: 700 }}>{SUPPORT_EMAIL}</a>.</p>
          <p style={{ margin: 0 }}>We may update these terms as the product evolves. The effective date above reflects the current version.</p>
        </SectionBlock>
      </div>
    </div>
  );
}
