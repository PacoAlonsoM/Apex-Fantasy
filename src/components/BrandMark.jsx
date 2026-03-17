import { ACCENT, ACCENT_DARK, BG_ELEVATED, PANEL_BORDER, TEXT_PRIMARY } from "../constants/design";

export default function BrandMark({ size = 40, ghost = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: ghost ? BG_ELEVATED : `linear-gradient(135deg,${ACCENT},${ACCENT_DARK})`,
        border: ghost ? PANEL_BORDER : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: ghost ? "none" : "0 8px 24px rgba(249,115,22,0.24)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: Math.round(size * 0.52),
          fontWeight: 800,
          lineHeight: 1,
          color: TEXT_PRIMARY,
          letterSpacing: "-0.04em",
          transform: "translateY(-1px)",
        }}
      >
        S
      </span>
    </div>
  );
}
