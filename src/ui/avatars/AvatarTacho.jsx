// Avatar concept B — TACHOMETER
// A perimeter ring of 12 radial tick marks like a rev counter. Inside the
// ring sits the team-colour disc + initials.
// Free → all 12 ticks in a dark tone-on-tone (a rev counter at idle).
// Pro  → the top 3 ticks (10/11/12 o'clock, mirrored as 11/12/1) burn
//        amber, slightly longer, with a fine amber arc joining them.
//        Reads as "you're in the redline."
import {
  ACCENT,
  DEFAULT_AVATAR_COLOR,
  PRO_AMBER,
  avatarTheme,
  rgbaFromHex,
} from "@/src/constants/design";

export default function AvatarTacho({
  username,
  name,
  colorKey,
  size = 40,
  pro = false,
  style,
}) {
  const theme    = avatarTheme(colorKey || DEFAULT_AVATAR_COLOR);
  const tone     = theme.accent || ACCENT;
  const display  = (username || name || "").trim();
  const initials = (display || "?").slice(0, 2).toUpperCase();

  const fontSize   = Math.round(size * 0.34);
  const groundBlur = Math.max(8, Math.round(size * 0.24));
  const groundY    = Math.max(2, Math.round(size * 0.08));

  // In viewBox units (0-100). Disc sits inside the tick ring.
  const center = 50;
  const tickOuter = 49;
  const tickInner = 43;
  const tickInnerRedline = 41;
  const diskRadius = 39;

  // 12 ticks, 0 at top, clockwise.
  const ticks = Array.from({ length: 12 }, (_, i) => i);
  const redlineIndices = new Set([11, 0, 1]); // top 3

  return (
    <div
      role="img"
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        boxShadow: `0 ${groundY}px ${groundBlur}px ${rgbaFromHex(tone, 0.28)}`,
        isolation: "isolate",
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
        {/* Outer face — slightly darker than the inner disc so ticks read. */}
        <circle cx={center} cy={center} r="50" fill="#0d1929" />

        {/* Tick marks */}
        {ticks.map((i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const isRedline = pro && redlineIndices.has(i);
          const inner = isRedline ? tickInnerRedline : tickInner;
          const x1 = center + Math.cos(angle) * tickOuter;
          const y1 = center + Math.sin(angle) * tickOuter;
          const x2 = center + Math.cos(angle) * inner;
          const y2 = center + Math.sin(angle) * inner;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isRedline ? PRO_AMBER : "rgba(255,255,255,0.22)"}
              strokeWidth={isRedline ? 2.4 : 1.4}
              strokeLinecap="round"
            />
          );
        })}

        {/* Pro redline arc — connects the top 3 ticks with a thin amber sweep */}
        {pro && (
          <path
            d="M 35.5,16.5 A 36,36 0 0 1 64.5,16.5"
            fill="none"
            stroke={PRO_AMBER}
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.9"
          />
        )}

        {/* Inner team-colour disc */}
        <circle cx={center} cy={center} r={diskRadius} fill={tone} />
        {/* Subtle inner shadow on the disc edge */}
        <circle
          cx={center} cy={center} r={diskRadius - 0.5}
          fill="none"
          stroke="rgba(0,0,0,0.28)"
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
          letterSpacing: "-0.03em",
          lineHeight: 1,
          textShadow: "0 1px 2px rgba(6,16,27,0.5)",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
