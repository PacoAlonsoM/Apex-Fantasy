// Avatar concept C — VISOR
// A helmet seen front-on. Upper hemisphere is a darker team-tone shell;
// across the middle, a curved visor band carries the initials.
// Free → matte visor band (team-colour, no frame).
// Pro  → amber visor frame (1.5–3px), and a small amber tearaway tab on the
//        right edge of the visor. Reads as the gold-trim race weekend
//        helmet you wear once.
import {
  ACCENT,
  DEFAULT_AVATAR_COLOR,
  PRO_AMBER,
  avatarTheme,
  rgbaFromHex,
} from "@/src/constants/design";

function darkenHex(hex, ratio = 0.5) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const blend = (start, end) => Math.round(start + (end - start) * ratio);
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(blend(r, 6))}${toHex(blend(g, 16))}${toHex(blend(b, 27))}`;
}

export default function AvatarVisor({
  username,
  name,
  colorKey,
  size = 40,
  pro = false,
  style,
}) {
  const theme    = avatarTheme(colorKey || DEFAULT_AVATAR_COLOR);
  const tone     = theme.accent || ACCENT;
  const shell    = darkenHex(tone, 0.42);
  const display  = (username || name || "").trim();
  const initials = (display || "?").slice(0, 2).toUpperCase();

  const fontSize   = Math.round(size * 0.34);
  const groundBlur = Math.max(8, Math.round(size * 0.24));
  const groundY    = Math.max(2, Math.round(size * 0.08));

  const visorFrameWidth = pro
    ? Math.max(1.5, Math.min(2.6, size * 0.030))
    : 0;

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
        <defs>
          <clipPath id={`visor-helmet-${size}-${pro ? "p" : "f"}`}>
            <circle cx="50" cy="50" r="50" />
          </clipPath>
        </defs>
        <g clipPath={`url(#visor-helmet-${size}-${pro ? "p" : "f"})`}>
          {/* Upper shell — darker team tone */}
          <rect x="0" y="0" width="100" height="100" fill={shell} />
          {/* Chin guard — lower portion in lighter team tone */}
          <rect x="0" y="65" width="100" height="35" fill={tone} />
          {/* Visor band — a wide horizontal band carrying the initials */}
          <rect
            x="0"
            y="35"
            width="100"
            height="30"
            fill={tone}
          />
          {/* Pro: amber visor frame (top + bottom edge lines) */}
          {pro && (
            <>
              <rect x="0" y={35 - visorFrameWidth} width="100" height={visorFrameWidth} fill={PRO_AMBER} />
              <rect x="0" y="65" width="100" height={visorFrameWidth} fill={PRO_AMBER} />
              {/* Tearaway tab on the right edge */}
              <rect
                x={87}
                y={36}
                width={11}
                height="4"
                fill={PRO_AMBER}
                rx="1"
              />
            </>
          )}
        </g>
        {/* Outer hairline edge */}
        <circle cx="50" cy="50" r="49.5" fill="none" stroke="rgba(8,12,20,0.32)" strokeWidth="1" />
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
          letterSpacing: "-0.03em",
          lineHeight: 1,
          textShadow: "0 1px 2px rgba(6,16,27,0.6)",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
