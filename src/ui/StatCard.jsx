import {
  CARD_RADIUS,
  CARD_SHADOW,
  HAIRLINE,
  MUTED_TEXT,
  PANEL_BG_ALT,
  PANEL_BORDER,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
} from "@/src/constants/design";

/**
 * Stint canonical stat tile. Replaces inline `StatBox` / `StatTile` /
 * summary-grid cells in Standings, Calendar header counters, Community
 * Pro League grid, and Profile stat tiles.
 *
 * Anatomy:
 *   ┌────────────────────┐
 *   │ LABEL              │  ← stint-kicker, 10/0.12em uppercase
 *   │ 12.4               │  ← Sora 28–32px, tabular nums
 *   │ +1.2 vs last       │  ← stint-body, MUTED_TEXT
 *   └────────────────────┘
 *
 * Props:
 *   label    — uppercase kicker (top)
 *   value    — primary numeric/text value
 *   hint     — small caption below value
 *   accent   — optional hex; if set, paints the bottom-rail gradient
 *   icon     — optional ReactNode (16–20px) prefixed before the value
 *   align    — "left" (default) | "center"
 *   tone     — "default" | "muted" — muted lowers the value weight for
 *              non-primary cells (e.g. delta deltas)
 *   onClick  — interactive variant (clickable card)
 *   style    — overrides
 */
export default function StatCard({
  label,
  value,
  hint,
  accent,
  icon,
  align = "left",
  tone = "default",
  onClick,
  className,
  style,
  children,
}) {
  const valueWeight = tone === "muted" ? 700 : 800;
  const valueSize = tone === "muted" ? 22 : 28;

  const baseStyle = {
    position: "relative",
    borderRadius: CARD_RADIUS,
    border: PANEL_BORDER,
    background: PANEL_BG_ALT,
    boxShadow: CARD_SHADOW,
    padding: "16px 16px 14px",
    display: "grid",
    gap: 8,
    textAlign: align,
    overflow: "hidden",
    ...(onClick ? { cursor: "pointer", appearance: "none", border: PANEL_BORDER, fontFamily: "inherit", color: "inherit", textAlign: align } : null),
    ...style,
  };

  const body = (
    <>
      {label && (
        <span
          style={{
            fontSize:      10,
            fontWeight:    800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color:         SUBTLE_TEXT,
            lineHeight:    1.4,
          }}
        >
          {label}
        </span>
      )}
      <span
        className="stint-tabular"
        style={{
          display:        "inline-flex",
          alignItems:     "baseline",
          gap:            8,
          fontFamily:     "var(--font-display)",
          fontSize:       valueSize,
          fontWeight:     valueWeight,
          letterSpacing:  "-0.035em",
          lineHeight:     1.05,
          color:          TEXT_PRIMARY,
          justifyContent: align === "center" ? "center" : "flex-start",
        }}
      >
        {icon ? <span style={{ display: "inline-flex", color: accent || TEXT_PRIMARY, alignSelf: "center" }}>{icon}</span> : null}
        {value}
      </span>
      {hint && (
        <span style={{ fontSize: 12, lineHeight: 1.45, color: MUTED_TEXT }}>
          {hint}
        </span>
      )}
      {children}
      {accent && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left:     0,
            right:    0,
            bottom:   0,
            height:   2,
            background: `linear-gradient(90deg, ${accent} 0%, rgba(0,0,0,0) 100%)`,
            opacity:  0.62,
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} style={baseStyle}>
        {body}
      </button>
    );
  }

  return (
    <div className={className} style={baseStyle}>
      {body}
    </div>
  );
}
