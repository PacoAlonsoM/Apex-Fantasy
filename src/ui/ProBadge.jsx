/**
 * Stint Pro badge — restrained, typographic.
 *
 * Canonical active-state vocabulary from the design system:
 * accent-tinted fill + hairline accent border + accent text. No side stripe,
 * no chequered corner, no inset highlight, no external glow. One gesture.
 *
 * Source of truth is profiles.subscription_status — do not store separately.
 *
 * @param {{ subscriptionStatus?: string, style?: object }} props
 */
export default function ProBadge({ subscriptionStatus, style }) {
  if (subscriptionStatus !== "pro") return null;

  return (
    <span
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        background:     "rgba(255,106,26,0.10)",
        border:         "1px solid rgba(255,106,26,0.32)",
        color:          "var(--pro-badge-text)",
        padding:        "3px 8px 4px",
        borderRadius:   4,
        lineHeight:     1,
        userSelect:     "none",
        flexShrink:     0,
        fontFamily:     "inherit",
        fontSize:       10,
        fontWeight:     900,
        letterSpacing:  "0.22em",
        textTransform:  "uppercase",
        ...style,
      }}
    >
      PRO
    </span>
  );
}
