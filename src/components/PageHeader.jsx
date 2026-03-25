import {
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BORDER,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
} from "../constants/design";
import useViewport from "../useViewport";

export default function PageHeader({ eyebrow, title, description, aside = null, actions = null, marginBottom = 22 }) {
  const { isMobile, isTablet } = useViewport();

  return (
    <section
      style={{
        borderRadius: SECTION_RADIUS,
        border: PANEL_BORDER,
        background: `linear-gradient(180deg,rgba(255,255,255,0.03),${PANEL_BG})`,
        boxShadow: SOFT_SHADOW,
        padding: isMobile ? "22px 18px" : "28px 26px",
        marginBottom,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: aside && !isTablet ? "minmax(0,1fr) 280px" : "1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div>
          {eyebrow ? (
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
              {eyebrow}
            </div>
          ) : null}
          <h1 style={{ fontSize: isMobile ? 38 : 54, fontWeight: 800, letterSpacing: isMobile ? "-0.05em" : "-0.07em", lineHeight: 0.94, marginBottom: 12 }}>
            {title}
          </h1>
          {description ? (
            <div style={{ maxWidth: 720, fontSize: isMobile ? 14 : 15, lineHeight: 1.82, color: MUTED_TEXT }}>
              {description}
            </div>
          ) : null}
          {actions ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>{actions}</div>
          ) : null}
        </div>

        {aside ? (
          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(214,223,239,0.12)",
              background: "rgba(255,255,255,0.03)",
              padding: "16px 16px 14px",
              color: TEXT_PRIMARY,
            }}
          >
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}
