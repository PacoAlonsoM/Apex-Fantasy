import {
  ACCENT,
  AI_BLUE_BORDER,
  AI_BLUE_SOFT,
  AI_BLUE_TEXT,
  ERROR_BG,
  ERROR_BORDER,
  ERROR_TEXT,
  RADIUS_PILL,
  SUCCESS_BG,
  SUCCESS_BORDER,
  SUCCESS_TEXT,
  SUBTLE_TEXT,
  WARN_BG,
  WARN_BORDER,
  WARN_TEXT,
  rgbaFromHex,
} from "@/src/constants/design";

/**
 * Stint canonical state pill. Replaces inline status chips inside
 * Home (`lockState` helper), Calendar (Next pill), Wire (freshness),
 * Picks (lock state — left alone but the design language is shared).
 *
 * Status tokens — one row per state. Each uses the canonical status
 * triad from design-system §11 so the F1 product reads one status
 * language across pages.
 *
 *   open       — green   (race is open for picks)
 *   live       — green   (happening right now; pairs with a dot)
 *   complete   — green   (scored / final)
 *   lock-soon  — amber   (under 6h until lock)
 *   lock-now   — red     (under 1h or live lock)
 *   locked     — blue    (picks closed, awaiting result)
 *   cancelled  — red
 *   ai         — blue    (AI / coach signal — §12)
 *   neutral    — muted   (informational, no state)
 *
 * The component renders a label string passed via `children`. The status
 * controls the color triad; the label controls what users actually read.
 */

const PALETTES = {
  open:      { text: SUCCESS_TEXT, bg: SUCCESS_BG, border: SUCCESS_BORDER, dotVar: "var(--text-live)" },
  live:      { text: SUCCESS_TEXT, bg: SUCCESS_BG, border: SUCCESS_BORDER, dotVar: "var(--text-live)", pulse: true },
  complete:  { text: SUCCESS_TEXT, bg: SUCCESS_BG, border: SUCCESS_BORDER },
  "lock-soon": { text: WARN_TEXT, bg: WARN_BG, border: WARN_BORDER },
  "lock-now":  { text: ERROR_TEXT, bg: ERROR_BG, border: ERROR_BORDER },
  locked:    { text: AI_BLUE_TEXT, bg: AI_BLUE_SOFT, border: AI_BLUE_BORDER },
  cancelled: { text: ERROR_TEXT, bg: ERROR_BG, border: ERROR_BORDER },
  ai:        { text: AI_BLUE_TEXT, bg: AI_BLUE_SOFT, border: AI_BLUE_BORDER },
  neutral:   { text: SUBTLE_TEXT, bg: "var(--btn-secondary-bg)", border: "var(--border-soft)" },
  pro:       { text: ACCENT, bg: rgbaFromHex(ACCENT, 0.10), border: rgbaFromHex(ACCENT, 0.24) },
};

export default function StatusBadge({
  status = "neutral",
  children,
  dot = false,
  size = "md",
  className,
  style,
  title,
}) {
  const palette = PALETTES[status] || PALETTES.neutral;
  const isSm = size === "sm";

  return (
    <span
      className={`${className || ""} stint-tabular`.trim()}
      title={title}
      style={{
        display:       "inline-flex",
        alignItems:    "center",
        gap:           dot ? 6 : 4,
        padding:       isSm ? "2px 8px" : "3px 10px",
        borderRadius:  RADIUS_PILL,
        background:    palette.bg,
        border:        `1px solid ${palette.border}`,
        color:         palette.text,
        fontSize:      isSm ? 10 : 11,
        fontWeight:    800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace:    "nowrap",
        lineHeight:    1.2,
        ...style,
      }}
    >
      {(dot || palette.pulse) && (
        <span
          aria-hidden="true"
          className={palette.pulse ? "f1-live-dot" : undefined}
          style={
            palette.pulse
              ? null
              : { width: 5, height: 5, borderRadius: "50%", background: palette.dotVar || palette.text }
          }
        />
      )}
      {children}
    </span>
  );
}
