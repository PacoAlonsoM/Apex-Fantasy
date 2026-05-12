import {
  ACCENT,
  DEFAULT_AVATAR_COLOR,
  avatarTheme,
  rgbaFromHex,
} from "@/src/constants/design";

/**
 * Stint identity avatar — a single-circle tone-keyed medallion.
 *
 * Single outer ring. No inner bezel. Pro is signalled by upgrading the ring
 * to ACCENT and adding an external halo glow — no extra concentric circles,
 * no chequer pin, no duplicate badges.
 *
 * Structural language derived from the AI Insight DriverPortrait bubble
 * (circular, team-tinted radial gradient, engraved initials, tone-keyed
 * drop shadow). Translated into an identity context so the avatar feels
 * like a minted token of the user's chosen team without becoming visually
 * busy.
 *
 *   • Tone-keyed radial gradient.  Light at the top-left, darkening into
 *     the team colour at the bottom-right. Reads as a struck metallic
 *     surface catching light from above.
 *   • Single ring.  1px outer border at the team accent tone. That's the
 *     only circle on the surface.
 *   • Soft specular.  A top-left radial sheen paired with a 1px top-rim
 *     highlight. Gives the surface dimension without adding a ring.
 *   • Engraved initials.  Deep ink shadow + 0.5px top-rim bright gives
 *     the monogram a struck feel rather than painted-on.
 *   • Pro.  The ring upgrades to ACCENT + a short external halo. No inner
 *     concentric ring.
 *
 * Scales fluidly from 20px (tight community row) to 96px (profile hero).
 * Every dimension derives from `size`.
 *
 * @param {object} props
 * @param {string} [props.name]       — display name (fallback).
 * @param {string} [props.username]   — preferred label + initials source.
 * @param {string} [props.colorKey]   — avatar theme key.
 * @param {number} [props.size=40]    — outer diameter in px.
 * @param {number} [props.fontSize]   — optional initials size override.
 * @param {boolean} [props.pro=false] — promotes the ring to ACCENT + halo.
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
  const fontSize    = fontSizeOverride ?? Math.round(size * 0.38);
  const groundY     = Math.max(3,  Math.round(size * 0.11));
  const groundBlur  = Math.max(10, Math.round(size * 0.30));
  const haloRing    = Math.max(1.4, size * 0.05);
  const haloGlow    = Math.max(12, Math.round(size * 0.42));

  // Shadow stack — non-Pro: a single tone-tinted ground shadow.
  // Pro: same ground + a short accent rim spread + an ambient halo.
  const baseShadow = `0 ${groundY}px ${groundBlur}px ${rgbaFromHex(tone, 0.28)}`;
  const shadow = pro
    ? `${baseShadow}, 0 0 0 ${haloRing}px ${rgbaFromHex(ACCENT, 0.58)}, 0 0 ${haloGlow}px ${rgbaFromHex(ACCENT, 0.26)}`
    : baseShadow;

  // The single circle: tone border on non-Pro, ACCENT on Pro. Alpha stepped
  // so the border reads as a rim rather than a stamp.
  const ringColor = pro ? rgbaFromHex(ACCENT, 0.78) : rgbaFromHex(tone, 0.64);

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
        background:     `radial-gradient(circle at 30% 22%, ${rgbaFromHex(tone, 0.92)} 0%, ${rgbaFromHex(tone, 0.48)} 58%, rgba(6,16,27,0.96) 100%)`,
        border:         `1px solid ${ringColor}`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        boxShadow:      shadow,
        overflow:       "hidden",
        isolation:      "isolate",
        ...style,
      }}
    >
      {/* Soft specular — top-left radial sheen. Gives the surface material
          depth without adding a ring. */}
      <span
        aria-hidden="true"
        style={{
          position:      "absolute",
          inset:         0,
          background:    "radial-gradient(circle at 28% 22%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.05) 34%, rgba(255,255,255,0) 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Top-rim specular — a 1px inset highlight at the crown only.
          Not a full ring; just a sliver of caught light at the top. */}
      <span
        aria-hidden="true"
        style={{
          position:      "absolute",
          inset:         0,
          borderRadius:  "50%",
          boxShadow:     "inset 0 1px 0 rgba(255,255,255,0.26)",
          pointerEvents: "none",
        }}
      />

      {/* Initials — layered text-shadow (deep ink + top-rim highlight)
           gives the monogram an engraved feel. */}
      <span
        aria-hidden="true"
        style={{
          position:           "relative",
          zIndex:             1,
          color:              "rgba(255,255,255,0.97)",
          fontSize,
          fontWeight:         900,
          letterSpacing:      "-0.04em",
          fontVariantNumeric: "tabular-nums",
          textShadow:         "0 1px 2px rgba(6,16,27,0.58), 0 -0.5px 0 rgba(255,255,255,0.22)",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
