// Shared text-input style object for STINT forms. Replaces the inline
// `inputStyle` literals that were duplicated across CommunityPage (Leagues
// composer + create-league form) and the admin formatters file. Keep this
// the single source of truth — adopt `INPUT_STYLE` everywhere a plain text
// input renders so focus/placeholder/spacing read identically.
//
// Visual contract:
//   - Sits on `var(--btn-secondary-bg)` so it lifts subtly from PANEL_BG.
//   - Uses `var(--border-soft)` for the default border + `var(--accent)` on
//     focus so the F1 ACCENT signals "I'm typing here."
//   - 44px minimum height on mobile so touch targets meet §4.
//   - Manrope (the body font) — never Sora; inputs shouldn't shout.

export const INPUT_STYLE = {
  width: "100%",
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid var(--border-soft)",
  background: "var(--btn-secondary-bg)",
  color: "var(--text)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  lineHeight: 1.4,
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
  transition: "border-color 160ms cubic-bezier(0.23,1,0.32,1), box-shadow 160ms cubic-bezier(0.23,1,0.32,1)",
};

// Variants: `{ size: "sm" | "md" | "lg", error?: boolean }`. The `error`
// variant tints the border red and matches the global form-error pattern
// already used elsewhere.
export function inputStyleFor({ size = "md", error = false } = {}) {
  const sizing =
    size === "sm" ? { minHeight: 36, padding: "8px 12px", fontSize: 13 }
    : size === "lg" ? { minHeight: 52, padding: "14px 16px", fontSize: 15 }
    : null;

  const errorOverrides = error
    ? { borderColor: "var(--text-error)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 2px rgba(239,68,68,0.16)" }
    : null;

  return { ...INPUT_STYLE, ...sizing, ...errorOverrides };
}
