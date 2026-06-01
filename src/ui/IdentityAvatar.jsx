import {
  ACCENT,
  DEFAULT_AVATAR_COLOR,
  PRO_AMBER,
  avatarTheme,
  rgbaFromHex,
} from "@/src/constants/design";

/**
 * IdentityAvatar — tool-watch dial.
 *
 * The team color is the dial face. Initials are the brand wordmark at the
 * centre. Two tiers share the same language; the upgrade is felt as
 * precision, not loudness.
 *
 *   Free  — bare dial: tone-true team-color disc, hairline edge, white
 *           initials, ground shadow. Stripped, raw, scan-fast.
 *
 *   Pro   — same dial with an amber bezel (a 1.5–3px inset ring in
 *           PRO_AMBER) and a single amber index mark at 12 o'clock.
 *           No glow, no halo, no second colour. The bezel reads at 20px;
 *           the index rewards inspection at ≥40px.
 *
 * Scales fluidly from 20px (tight community row) to 104px (profile hero).
 * The bezel thickness, the index dimensions and the ground shadow all key
 * off `size` so a single component covers every surface in the app.
 *
 * @param {object} props
 * @param {string} [props.name]       — display name (fallback).
 * @param {string} [props.username]   — preferred label + initials source.
 * @param {string} [props.colorKey]   — avatar theme key.
 * @param {number} [props.size=40]    — outer diameter in px.
 * @param {number} [props.fontSize]   — optional initials size override.
 * @param {boolean} [props.pro=false] — promotes the dial to the Pro bezel.
 * @param {object} [props.style]      — inline style overrides.
 * @param {string} [props.className]  — passed to the outer element.
 * @param {string} [props.title]      — optional tooltip.
 */
export default function IdentityAvatar({
  name,
  username,
  colorKey,
  size = 40,
  fontSize: fontSizeOverride,
  pro = false,
  style,
  className,
  title,
}) {
  const theme    = avatarTheme(colorKey || DEFAULT_AVATAR_COLOR);
  const tone     = theme.accent || ACCENT;
  const display  = (username || name || "").trim();
  const initials = (display || "?").slice(0, 2).toUpperCase();
  const label    = pro
    ? `${display || "Member"} · Pro member`
    : (display || "Member");

  // Initials track the dial size. Pro pulls the cap down a hair so the
  // 12-o'clock index has room to breathe; the eye still reads the dial as
  // centered because the index is small enough to be felt, not seen.
  const fontSize  = fontSizeOverride ?? Math.round(size * (pro ? 0.38 : 0.40));

  // Ground shadow — team-tone tinted so the disc feels seated against the
  // page. Same value across tiers; the bezel does the differentiation.
  const groundY    = Math.max(2, Math.round(size * 0.08));
  const groundBlur = Math.max(8, Math.round(size * 0.24));
  const groundShadow = `0 ${groundY}px ${groundBlur}px ${rgbaFromHex(tone, 0.30)}`;

  // Bezel: precision ring. Hairline 1px on Free (defines the edge against
  // both light and dark backgrounds without committing a colour). Amber
  // 1.5–3px on Pro — visible at 20px, statement at 104px.
  const bezelWidth = pro
    ? Math.max(1.5, Math.min(3, size * 0.035))
    : 1;
  const bezelColor = pro ? PRO_AMBER : "rgba(8,12,20,0.22)";

  // Index at 12 o'clock — a single amber tick. Suppressed below 26px where
  // it would smudge into noise; the bezel alone identifies Pro at that scale.
  const showIndex   = pro && size >= 26;
  const indexWidth  = Math.max(3, Math.round(size * 0.16));
  const indexHeight = Math.max(1, Math.round(size * 0.045));
  const indexTop    = Math.max(2, Math.round(size * 0.10)) + bezelWidth;

  return (
    <div
      role="img"
      aria-label={label}
      title={title}
      className={className}
      style={{
        position:       "relative",
        width:          size,
        height:         size,
        flexShrink:     0,
        borderRadius:   "50%",
        // Flat team colour with a hint of vertical fall — reads as a struck
        // disc, not a 3D orb. 100% at the cap, ~92% at the base.
        background:     `linear-gradient(180deg, ${rgbaFromHex(tone, 1)} 0%, ${rgbaFromHex(tone, 0.92)} 100%)`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        boxShadow:      groundShadow,
        isolation:      "isolate",
        ...style,
      }}
    >
      {/* Bezel — inset ring drawn as box-shadow so it never widens the
          element's footprint. Tracks the disc's curvature exactly. */}
      <span
        aria-hidden="true"
        style={{
          position:      "absolute",
          inset:         0,
          borderRadius:  "50%",
          boxShadow:     `inset 0 0 0 ${bezelWidth}px ${bezelColor}`,
          pointerEvents: "none",
        }}
      />

      {/* 12-o'clock index — Pro only, ≥26px. Solid amber, hairline-thin,
          pill-rounded ends so it reads as an applied marker, not a slot. */}
      {showIndex && (
        <span
          aria-hidden="true"
          style={{
            position:      "absolute",
            top:           indexTop,
            left:          "50%",
            transform:     "translateX(-50%)",
            width:         indexWidth,
            height:        indexHeight,
            background:    PRO_AMBER,
            borderRadius:  indexHeight,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Initials — Sora-weight, optically tight, a single soft drop
          shadow to lift them off the dial. No bevels, no embossing. */}
      <span
        aria-hidden="true"
        style={{
          position:           "relative",
          zIndex:             1,
          color:              "#fff",
          fontSize,
          fontWeight:         900,
          letterSpacing:      "-0.04em",
          lineHeight:         1,
          fontVariantNumeric: "tabular-nums",
          textShadow:         "0 1px 2px rgba(6,16,27,0.5)",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
