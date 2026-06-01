// Avatar concept F — PLATE (number plate / not-a-circle)
// Squarcle / rounded-rect shape — a deliberate break from the circular
// avatar default. Reads like a driver number plate or stencilled bib.
// The outline is unmistakable in a sea of circular avatars.
// Free → solid team-colour plate, oversized initials.
// Pro  → amber chequer band along the top edge + an amber inner rule.
import {
  ACCENT,
  DEFAULT_AVATAR_COLOR,
  PRO_AMBER,
  avatarTheme,
  rgbaFromHex,
} from "@/src/constants/design";

function darkenHex(hex, ratio = 0.4) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const blend = (start, end) => Math.round(start + (end - start) * ratio);
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(blend(r, 6))}${toHex(blend(g, 16))}${toHex(blend(b, 27))}`;
}

export default function AvatarPlate({
  username,
  name,
  colorKey,
  size = 40,
  pro = false,
  style,
}) {
  const theme    = avatarTheme(colorKey || DEFAULT_AVATAR_COLOR);
  const tone     = theme.accent || ACCENT;
  const dark     = darkenHex(tone, 0.55);
  const display  = (username || name || "").trim();
  const initials = (display || "?").slice(0, 2).toUpperCase();

  const fontSize   = Math.round(size * 0.46);
  const groundBlur = Math.max(8, Math.round(size * 0.24));
  const groundY    = Math.max(2, Math.round(size * 0.08));
  const radius     = Math.round(size * 0.24);

  // Chequer strip — 6 cells wide along the top edge. Pro only.
  const chequerHeight = pro ? Math.max(2, Math.round(size * 0.10)) : 0;
  const chequerCells  = 6;

  return (
    <div
      role="img"
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius,
        background: `linear-gradient(170deg, ${rgbaFromHex(tone, 1)} 0%, ${rgbaFromHex(dark, 1)} 100%)`,
        boxShadow: `0 ${groundY}px ${groundBlur}px ${rgbaFromHex(tone, 0.32)}, inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(8,12,20,0.45)`,
        overflow: "hidden",
        isolation: "isolate",
        ...style,
      }}
    >
      {/* Pro chequer band */}
      {pro && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: chequerHeight,
            display: "grid",
            gridTemplateColumns: `repeat(${chequerCells}, 1fr)`,
          }}
        >
          {Array.from({ length: chequerCells }, (_, i) => (
            <div
              key={i}
              style={{
                background: i % 2 === 0 ? PRO_AMBER : "#1a1308",
              }}
            />
          ))}
        </div>
      )}

      {/* Pro inner rule — a 1px amber line just under the chequer */}
      {pro && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: chequerHeight,
            left: 0,
            right: 0,
            height: 1,
            background: "rgba(245,158,11,0.4)",
          }}
        />
      )}

      {/* Initials */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          paddingTop: chequerHeight * 0.6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize,
          fontWeight: 900,
          letterSpacing: "-0.06em",
          lineHeight: 1,
          textShadow: "0 1px 3px rgba(6,16,27,0.6)",
        }}
      >
        {initials}
      </div>
    </div>
  );
}
