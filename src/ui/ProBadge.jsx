// ProBadge — single source of truth for the "PRO" pill across the app.
//
// Visual language:
//   • Amber→gold gradient (PRO_AMBER family) — distinguished from the
//     brand orange so Pro signals don't get lost next to standard accents.
//   • Subtle inset highlight + soft amber shadow gives a minted, metallic
//     feel without skeuomorphism.
//   • A small ◆ glyph anchors the wordmark so the badge reads as a status,
//     not a label.
//   • Three sizes — XS for inline meta (member rows), SM for cards, MD for
//     hero / account treatments.
//
// API:
//   <ProBadge subscriptionStatus={user.subscription_status} />
//       Only renders when the user is Pro. Use in profile / user-row contexts
//       where the badge is conditional on the user's plan.
//   <ProBadge size="xs" title="Pro feature" />
//       Always renders. Use in feature gates / locked-mode chips where the
//       badge marks the *thing*, not the user.
//
// Source of truth is profiles.subscription_status — do not store separately.
import { PRO_AMBER } from "@/src/constants/design";

const SIZE_PRESETS = {
  xs: { paddingY: 1, paddingX: 6,  fontSize: 9,  iconSize: 7, gap: 3, tracking: "0.14em" },
  sm: { paddingY: 2, paddingX: 8,  fontSize: 10, iconSize: 8, gap: 4, tracking: "0.14em" },
  md: { paddingY: 3, paddingX: 10, fontSize: 11, iconSize: 9, gap: 5, tracking: "0.16em" },
};

export function ProBadge({
  subscriptionStatus,
  size = "xs",
  title = "Stint Pro member",
  style: extraStyle = null,
}) {
  // When the caller passes subscriptionStatus we treat the badge as
  // conditional on the user being Pro (back-compat with the original API).
  if (subscriptionStatus !== undefined && subscriptionStatus !== "pro") return null;

  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.xs;

  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            preset.gap,
        padding:        `${preset.paddingY}px ${preset.paddingX}px`,
        fontSize:       preset.fontSize,
        fontWeight:     900,
        letterSpacing:  preset.tracking,
        lineHeight:     1,
        color:          "#2a1700",
        background:     `linear-gradient(135deg, ${PRO_AMBER} 0%, #fde68a 100%)`,
        borderRadius:   999,
        boxShadow: [
          "inset 0 1px 0 rgba(255,255,255,0.55)",
          "inset 0 -1px 0 rgba(120,53,15,0.22)",
          "0 1px 4px rgba(245,158,11,0.32)",
        ].join(","),
        textShadow:     "0 1px 0 rgba(255,255,255,0.35)",
        whiteSpace:     "nowrap",
        verticalAlign:  "middle",
        flexShrink:     0,
        userSelect:     "none",
        ...extraStyle,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize:   preset.iconSize,
          lineHeight: 1,
          color:      "#78350f",
          textShadow: "0 1px 0 rgba(255,255,255,0.4)",
        }}
      >
        ◆
      </span>
      PRO
    </span>
  );
}

export default ProBadge;
