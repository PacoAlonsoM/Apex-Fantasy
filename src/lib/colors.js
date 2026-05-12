/**
 * Convert a hex color (`#RGB`, `#RRGGBB`, or with no leading hash) to an
 * `rgba(r,g,b,a)` string. Used wherever a saturated brand/team/status hex
 * needs to render at a translucent alpha — e.g. accent-tinted backgrounds,
 * tone-keyed shadows, hover overlays.
 *
 * Pure function — does not read theme tokens. For theme-aware translucent
 * surfaces, prefer the CSS variables in `index.css` (e.g. `--accent-glow`).
 */
export function hexToRgba(hex, alpha) {
  const clean = String(hex || "").replace("#", "");
  const value = clean.length === 3
    ? clean.split("").map((char) => char + char).join("")
    : clean;
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
