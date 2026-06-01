import {
  ACCENT,
  DEFAULT_AVATAR_COLOR,
  PRO_AMBER,
  avatarTheme,
  rgbaFromHex,
} from "@/src/constants/design";

/**
 * IdentityAvatar — brake disc.
 *
 * A rotor seen face-on. Three concentric zones:
 *   • Outer rim   — graphite metallic (Free) or red-hot amber (Pro)
 *   • Slot ring   — dark surface punctuated by 8 drilled rotor holes
 *   • Hub         — team-colour centre carrying the initials
 *
 * Free → cold disc, dark slots, graphite rim. Reads as machined hardware.
 * Pro  → heat-cycle treatment: amber rim glow, amber-lit slots, outer
 *        heat halo. The disc has been through a braking zone.
 *
 * Same component covers 20px (community rows) through 104px (profile
 * hero). At ≤24px the slot detail is suppressed so the surface stays
 * scan-fast; the hub + rim colour still carry the team + tier signal.
 *
 * @param {object} props
 * @param {string} [props.name]
 * @param {string} [props.username]
 * @param {string} [props.colorKey]
 * @param {number} [props.size=40]
 * @param {number} [props.fontSize]   — optional initials size override
 * @param {boolean} [props.pro=false]
 * @param {object} [props.style]
 * @param {string} [props.className]
 * @param {string} [props.title]
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

  // Initials sit in the hub (~60% of size). 0.32 lands the cap height
  // comfortably inside the hub at every realistic size; small fonts get
  // a 9px floor so the disc never renders an unreadable glyph.
  const fontSize = fontSizeOverride
    ?? Math.max(9, Math.round(size * 0.32));

  const groundBlur = Math.max(8, Math.round(size * 0.24));
  const groundY    = Math.max(2, Math.round(size * 0.08));

  // Skip the drilled-slot detail below 24px — at small sizes the dots
  // smudge into the slot ring and read as visual noise rather than
  // hardware detail. Hub + rim alone carry the tier signal.
  const showSlots = size >= 24;
  const slotCount = 8;
  const slots = Array.from({ length: slotCount }, (_, i) => i);

  // Pro adds a soft outer heat halo on top of the standard ground shadow.
  const shadow = pro
    ? `0 ${groundY}px ${groundBlur}px ${rgbaFromHex("#fbbf24", 0.32)}, 0 0 ${Math.round(size * 0.5)}px ${rgbaFromHex("#fbbf24", 0.18)}`
    : `0 ${groundY}px ${groundBlur}px ${rgbaFromHex(tone, 0.28)}`;

  // Stable, unique gradient id per render to avoid collisions when many
  // avatars share a page (`size`+tier is unique enough for the surfaces
  // we have today; if it ever clashes, switch to useId).
  const gradId = `rotor-rim-${size}-${pro ? "p" : "f"}`;

  return (
    <div
      role="img"
      aria-label={label}
      title={title}
      className={className}
      style={{
        position:   "relative",
        width:      size,
        height:     size,
        flexShrink: 0,
        borderRadius: "50%",
        boxShadow:  shadow,
        isolation:  "isolate",
        ...style,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ position: "absolute", inset: 0, display: "block" }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            {pro ? (
              <>
                <stop offset="0%"   stopColor="#1a1208" />
                <stop offset="76%"  stopColor="#3a2a10" />
                <stop offset="92%"  stopColor={PRO_AMBER} />
                <stop offset="100%" stopColor="#7a4a08" />
              </>
            ) : (
              <>
                <stop offset="0%"   stopColor="#0d1521" />
                <stop offset="80%"  stopColor="#1c2a3d" />
                <stop offset="100%" stopColor="#2a3a52" />
              </>
            )}
          </radialGradient>
        </defs>

        {/* Outer rim */}
        <circle cx="50" cy="50" r="50" fill={`url(#${gradId})`} />

        {/* Slot ring — slightly lighter dark surface */}
        <circle cx="50" cy="50" r="42" fill="#161e2e" />

        {/* Drilled rotor slots — 8 radial holes */}
        {showSlots && slots.map((i) => {
          const angle = (i * (360 / slotCount) - 90) * (Math.PI / 180);
          const r = 36;
          const cx = 50 + Math.cos(angle) * r;
          const cy = 50 + Math.sin(angle) * r;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="2.6"
              fill={pro ? rgbaFromHex(PRO_AMBER, 0.85) : "rgba(0,0,0,0.55)"}
            />
          );
        })}

        {/* Hub — team-colour centre */}
        <circle cx="50" cy="50" r="30" fill={tone} />
        {/* Hub edge highlight — tiny white rim catches the light */}
        <circle cx="50" cy="50" r="29.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {/* Hub bolt at centre */}
        <circle cx="50" cy="50" r="1.5" fill="rgba(0,0,0,0.35)" />
      </svg>

      {/* Initials sit in the hub. Centred via absolute positioning so the
          SVG renders cleanly underneath without inheriting flex layout. */}
      <span
        aria-hidden="true"
        style={{
          position:           "absolute",
          inset:              0,
          display:            "flex",
          alignItems:         "center",
          justifyContent:     "center",
          color:              "#fff",
          fontSize,
          fontWeight:         900,
          letterSpacing:      "-0.03em",
          lineHeight:         1,
          fontVariantNumeric: "tabular-nums",
          textShadow:         "0 1px 2px rgba(6,16,27,0.6)",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
