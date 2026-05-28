import {
  ACCENT,
  DEFAULT_AVATAR_COLOR,
  avatarTheme,
  rgbaFromHex,
} from "@/src/constants/design";

/**
 * Stint identity avatar — flat team-color disc + clean initials, no ring.
 *
 * Visual language:
 *   • Flat-ish team-color fill with a subtle top sheen for dimension.
 *   • Clean Sora 900 initials in white with a soft drop shadow.
 *   • Tone-tinted ground shadow grounds the disc against the page.
 *   • Pro adds an outer ambient halo glow only — no ring border.
 *
 * Scales fluidly from 20px (tight community row) to 104px (profile hero).
 *
 * @param {object} props
 * @param {string} [props.name]       — display name (fallback).
 * @param {string} [props.username]   — preferred label + initials source.
 * @param {string} [props.colorKey]   — avatar theme key.
 * @param {number} [props.size=40]    — outer diameter in px.
 * @param {number} [props.fontSize]   — optional initials size override.
 * @param {boolean} [props.pro=false] — adds an outer halo glow.
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

  // Fluid dimensions — all keyed to `size`.
  const fontSize    = fontSizeOverride ?? Math.round(size * 0.40);
  const groundY     = Math.max(2, Math.round(size * 0.08));
  const groundBlur  = Math.max(8, Math.round(size * 0.24));
  const haloGlow    = Math.max(10, Math.round(size * 0.32));

  // Shadow stack — base ground shadow + (Pro only) outer ambient halo.
  const baseShadow = `0 ${groundY}px ${groundBlur}px ${rgbaFromHex(tone, 0.32)}`;
  const shadow = pro
    ? `${baseShadow}, 0 0 ${haloGlow}px ${rgbaFromHex(ACCENT, 0.32)}`
    : baseShadow;

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
        // Mostly flat team color — a very subtle linear gradient gives it
        // just enough dimension to feel like a struck disc.
        background:     `linear-gradient(165deg, ${rgbaFromHex(tone, 0.98)} 0%, ${rgbaFromHex(tone, 0.78)} 100%)`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        boxShadow:      shadow,
        overflow:       "hidden",
        isolation:      "isolate",
        ...style,
      }}
    >
      {/* Subtle top sheen — gives the disc dimension without the orb effect.
          Very low-opacity, top-quarter only, so the disc still reads as
          mostly flat team color. */}
      <span
        aria-hidden="true"
        style={{
          position:      "absolute",
          inset:         0,
          background:    "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 32%, rgba(255,255,255,0) 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Initials — clean Sora 900, soft drop shadow only. No engraved bevel. */}
      <span
        aria-hidden="true"
        style={{
          position:           "relative",
          zIndex:             1,
          color:              "#fff",
          fontSize,
          fontWeight:         900,
          letterSpacing:      "-0.03em",
          lineHeight:         1,
          fontVariantNumeric: "tabular-nums",
          textShadow:         "0 2px 6px rgba(6,16,27,0.45)",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
