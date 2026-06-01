// Avatar concept E — NOTCH (silhouette break)
// The shape itself becomes the signal. A circle with a sharp wedge notched
// out of the bottom-right edge — reads as a pit board hung from a stake
// or a race-control marker.
// Free → notch is empty (background passes through), team-colour disc.
// Pro  → the notch is filled solid amber, becoming a chamfer tab. Silhouette
//        differentiation works at 20px because the OUTLINE changes shape.
import {
  ACCENT,
  DEFAULT_AVATAR_COLOR,
  PRO_AMBER,
  avatarTheme,
  rgbaFromHex,
} from "@/src/constants/design";

export default function AvatarNotch({
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

  const fontSize   = Math.round(size * 0.38);
  const groundBlur = Math.max(8, Math.round(size * 0.24));
  const groundY    = Math.max(2, Math.round(size * 0.08));

  // The notch is a wedge from the bottom-right. SVG path in viewBox 100.
  // Both Free and Pro use the SAME outer outline so the silhouette matches;
  // Pro fills the notch with amber while Free leaves it transparent.
  // Outer ring goes: top center → arc clockwise to (right-edge above notch)
  // → straight line into the notch corner → straight line back out →
  // continue arc clockwise back to top.
  const notchPath = "M 50,0 A 50,50 0 1 1 78,93 L 93,78 A 50,50 0 0 1 50,0 Z";

  // The wedge fill (used by Pro only) — same outline as the notch.
  const wedgePath = "M 78,93 L 100,100 L 100,78 L 93,78 Z";

  return (
    <div
      role="img"
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        filter: `drop-shadow(0 ${groundY}px ${groundBlur}px ${rgbaFromHex(tone, 0.30)})`,
        ...style,
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }} aria-hidden="true">
        {/* Main disc with notch carved out */}
        <path d={notchPath} fill={tone} />
        {/* Inner edge ring */}
        <path d={notchPath} fill="none" stroke="rgba(8,12,20,0.32)" strokeWidth="1" />
        {/* Pro: fill the wedge corner with amber */}
        {pro && <path d={wedgePath} fill={PRO_AMBER} />}
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
          textShadow: "0 1px 2px rgba(6,16,27,0.55)",
          // Pull initials slightly toward top-left so they sit on the
          // remaining disc area, not the notched corner.
          transform: `translate(${-size * 0.04}px, ${-size * 0.04}px)`,
        }}
      >
        {initials}
      </span>
    </div>
  );
}
