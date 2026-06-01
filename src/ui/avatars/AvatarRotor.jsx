// Avatar concept G — ROTOR (brake disc)
// Circular with visible concentric structure — outer metallic rim,
// drilled-rotor middle ring (radial slots), and an inner hub carrying the
// initials. Reads as a brake disc seen face-on; layered depth.
// Free → graphite rim, team-colour hub, dark rotor slots.
// Pro  → amber-glowing rim (heat) and amber rotor slots — the disc is
//        red-hot, like the cars at the end of a heavy braking zone.
import {
  ACCENT,
  DEFAULT_AVATAR_COLOR,
  PRO_AMBER,
  avatarTheme,
  rgbaFromHex,
} from "@/src/constants/design";

export default function AvatarRotor({
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

  const fontSize   = Math.round(size * 0.30);
  const groundBlur = Math.max(8, Math.round(size * 0.24));
  const groundY    = Math.max(2, Math.round(size * 0.08));

  // 8 radial drilled slots in the rotor ring
  const slotCount = 8;
  const slots = Array.from({ length: slotCount }, (_, i) => i);

  return (
    <div
      role="img"
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        boxShadow: pro
          ? `0 ${groundY}px ${groundBlur}px ${rgbaFromHex("#fbbf24", 0.32)}, 0 0 ${Math.round(size * 0.5)}px ${rgbaFromHex("#fbbf24", 0.18)}`
          : `0 ${groundY}px ${groundBlur}px ${rgbaFromHex(tone, 0.28)}`,
        isolation: "isolate",
        ...style,
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: "absolute", inset: 0, display: "block" }} aria-hidden="true">
        <defs>
          <radialGradient id={`rotor-rim-${size}-${pro ? "p" : "f"}`} cx="50%" cy="50%" r="50%">
            {pro ? (
              <>
                <stop offset="0%"  stopColor="#1a1208" />
                <stop offset="76%" stopColor="#3a2a10" />
                <stop offset="92%" stopColor={PRO_AMBER} />
                <stop offset="100%" stopColor="#7a4a08" />
              </>
            ) : (
              <>
                <stop offset="0%"  stopColor="#0d1521" />
                <stop offset="80%" stopColor="#1c2a3d" />
                <stop offset="100%" stopColor="#2a3a52" />
              </>
            )}
          </radialGradient>
        </defs>

        {/* Outer rim — metallic gradient (or amber heat for Pro) */}
        <circle cx="50" cy="50" r="50" fill={`url(#rotor-rim-${size}-${pro ? "p" : "f"})`} />

        {/* Rotor ring (mid-band) — slightly lighter dark surface */}
        <circle cx="50" cy="50" r="42" fill="#161e2e" />

        {/* Drilled rotor slots — 8 radial holes */}
        {slots.map((i) => {
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

        {/* Hub — team-colour center */}
        <circle cx="50" cy="50" r="30" fill={tone} />
        {/* Hub inner highlight ring */}
        <circle cx="50" cy="50" r="29.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {/* Hub bolt — tiny center dot */}
        <circle cx="50" cy="50" r="1.5" fill="rgba(0,0,0,0.35)" />
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
