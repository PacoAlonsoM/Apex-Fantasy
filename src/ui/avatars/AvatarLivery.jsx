// Avatar concept A — LIVERY PANEL
// Two-tone diagonal split inspired by F1 sidepod livery decals. The team
// colour fills the upper-left half; a darker team tone fills the lower-right.
// Initials straddle the seam.
// Free → matte seam (tone-on-tone, no embellishment).
// Pro  → amber pinstripe sliced through the seam + a tiny amber pip at the
//        top-right of the perimeter (the sponsor decal moment).
import {
  ACCENT,
  DEFAULT_AVATAR_COLOR,
  PRO_AMBER,
  avatarTheme,
  rgbaFromHex,
} from "@/src/constants/design";

function darkenHex(hex, ratio = 0.36) {
  // Quick mix toward #06101B (Stint base) so the darker half stays in palette.
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const blend = (start, end) => Math.round(start + (end - start) * ratio);
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(blend(r, 6))}${toHex(blend(g, 16))}${toHex(blend(b, 27))}`;
}

export default function AvatarLivery({
  username,
  name,
  colorKey,
  size = 40,
  pro = false,
  style,
}) {
  const theme    = avatarTheme(colorKey || DEFAULT_AVATAR_COLOR);
  const tone     = theme.accent || ACCENT;
  const dark     = darkenHex(tone, 0.5);
  const display  = (username || name || "").trim();
  const initials = (display || "?").slice(0, 2).toUpperCase();

  const fontSize    = Math.round(size * 0.40);
  const seamWidth   = Math.max(1, Math.round(size * 0.025));
  const pipSize     = Math.max(2, Math.round(size * 0.07));
  const groundBlur  = Math.max(8, Math.round(size * 0.24));
  const groundY     = Math.max(2, Math.round(size * 0.08));

  // SVG-driven so the seam line follows the disc curvature precisely at every
  // size. The pinstripe + pip become visible-but-not-loud accents.
  return (
    <div
      role="img"
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        boxShadow: `0 ${groundY}px ${groundBlur}px ${rgbaFromHex(tone, 0.30)}`,
        isolation: "isolate",
        overflow: "hidden",
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
        {/* Light half (top-left) */}
        <path d="M 50,0 A 50,50 0 0 0 0,50 L 100,50 Z M 100,50 L 50,0" fill={tone} />
        {/* The actual two-tone split is a clip with a diagonal divider. */}
        <defs>
          <clipPath id={`livery-${size}-${pro ? "pro" : "free"}`}>
            <circle cx="50" cy="50" r="50" />
          </clipPath>
        </defs>
        <g clipPath={`url(#livery-${size}-${pro ? "pro" : "free"})`}>
          <rect x="0" y="0" width="100" height="100" fill={tone} />
          {/* Lower-right triangle, darker tone */}
          <polygon points="100,0 100,100 0,100" fill={dark} />
          {/* Seam line — Pro amber, Free dark tone */}
          <line
            x1="100" y1="0" x2="0" y2="100"
            stroke={pro ? PRO_AMBER : "rgba(6,16,27,0.55)"}
            strokeWidth={seamWidth}
            strokeLinecap="round"
          />
          {pro && (
            <>
              {/* Sponsor pip at top-right perimeter */}
              <circle cx="78" cy="22" r={pipSize / 2} fill={PRO_AMBER} />
              {/* Inner shadow on the seam — adds depth */}
              <line
                x1="100" y1="0" x2="0" y2="100"
                stroke="rgba(0,0,0,0.18)"
                strokeWidth={Math.max(0.5, seamWidth * 0.4)}
                strokeLinecap="round"
                transform="translate(0.8, 0.8)"
              />
            </>
          )}
        </g>
        {/* Outer hairline edge */}
        <circle
          cx="50" cy="50" r="49.5"
          fill="none"
          stroke="rgba(8,12,20,0.32)"
          strokeWidth="1"
        />
      </svg>

      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          textShadow: "0 1px 3px rgba(6,16,27,0.55)",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
