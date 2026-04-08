import { PANEL_BG, PANEL_BORDER, RADIUS_LG, SUBTLE_TEXT, TEXT_PRIMARY } from "@/src/constants/design";

export default function AdminCard({ eyebrow, title, description, children, tone = null }) {
  return (
    <section
      style={{
        borderRadius: RADIUS_LG,
        border: PANEL_BORDER,
        background: tone || PANEL_BG,
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        {eyebrow && (
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
            {eyebrow}
          </div>
        )}
        {title && (
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, color: TEXT_PRIMARY }}>
            {title}
          </div>
        )}
        {description && (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(214,223,239,0.68)" }}>
            {description}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

