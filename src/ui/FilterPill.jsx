import { ACCENT, MUTED_TEXT, RADIUS_PILL, rgbaFromHex, TEXT_PRIMARY } from "@/src/constants/design";

/**
 * Stint canonical pill — used everywhere a tab, filter, or sub-tab needs
 * a selected state. Replaces the inline pill styles inside
 * StandingsPage / GridPage / CommunityPage / Calendar IndexRow (rails).
 *
 * Two variants, both anchored to design-system §9:
 *
 *   "tab"  — top-level tab / filter / sub-tab.
 *            Active bg ACCENT × 0.13, border ACCENT × 0.30, text ACCENT.
 *            Used inside a flex row with gap. Pill radius.
 *
 *   "rail" — list-row rail item (calendar row, league row).
 *            Active bg ACCENT × 0.07, outline ACCENT × 0.22, no border.
 *            Used inside a vertical stack. Square-ish radius (16px).
 *
 * Both honor the canonical transition curve (`cubic-bezier(0.23,1,0.32,1)`).
 * Both expose `viewTransitionName` if the consumer wants to morph the
 * active pill between switches.
 */

const ACTIVE_TAB_BG     = rgbaFromHex(ACCENT, 0.13);
const ACTIVE_TAB_BORDER = rgbaFromHex(ACCENT, 0.30);
const ACTIVE_RAIL_BG    = rgbaFromHex(ACCENT, 0.07);
const ACTIVE_RAIL_BORDER = rgbaFromHex(ACCENT, 0.22);

export default function FilterPill({
  variant = "tab",
  active = false,
  count,
  icon,
  children,
  onClick,
  href,
  viewTransitionName,
  ariaLabel,
  className,
  style,
  size = "md",
  disabled = false,
}) {
  const isRail = variant === "rail";
  const isLg = size === "lg";

  const tabStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: isLg ? "12px 18px" : "10px 14px",
    borderRadius: RADIUS_PILL,
    border: active
      ? `1px solid ${ACTIVE_TAB_BORDER}`
      : "1px solid var(--border-soft)",
    background: active ? ACTIVE_TAB_BG : "var(--btn-secondary-bg)",
    color: active ? ACCENT : MUTED_TEXT,
    fontFamily: "var(--font-body)",
    fontSize: isLg ? 14 : 13,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition:
      "background 120ms cubic-bezier(0.23,1,0.32,1), border-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1), transform 100ms cubic-bezier(0.23,1,0.32,1)",
    whiteSpace: "nowrap",
    minHeight: isLg ? 44 : 36,
    ...(viewTransitionName && active ? { viewTransitionName } : null),
    ...style,
  };

  const railStyle = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 16,
    border: "none",
    outline: active ? `1px solid ${ACTIVE_RAIL_BORDER}` : "1px solid transparent",
    outlineOffset: -1,
    background: active ? ACTIVE_RAIL_BG : "transparent",
    color: TEXT_PRIMARY,
    textAlign: "left",
    fontFamily: "var(--font-body)",
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition:
      "background 180ms cubic-bezier(0.23,1,0.32,1), outline-color 180ms cubic-bezier(0.23,1,0.32,1)",
    minHeight: 44,
    ...(viewTransitionName && active ? { viewTransitionName } : null),
    ...style,
  };

  const finalStyle = isRail ? railStyle : tabStyle;

  const body = (
    <>
      {icon ? <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span> : null}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {children}
      </span>
      {count != null && (
        <span
          className="stint-tabular"
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: active ? ACCENT : "var(--text-subtle)",
            padding: "1px 7px",
            borderRadius: RADIUS_PILL,
            background: active ? rgbaFromHex(ACCENT, 0.10) : "var(--btn-secondary-bg)",
            border: `1px solid ${active ? rgbaFromHex(ACCENT, 0.22) : "var(--border-soft)"}`,
          }}
        >
          {count}
        </span>
      )}
    </>
  );

  const commonProps = {
    "aria-pressed": active,
    "aria-current": active ? "true" : undefined,
    "aria-label": ariaLabel,
    className,
    disabled,
  };

  if (href) {
    return (
      <a href={href} onClick={onClick} style={finalStyle} {...commonProps}>
        {body}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} style={finalStyle} {...commonProps}>
      {body}
    </button>
  );
}
