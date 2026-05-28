import { CONTENT_MAX } from "@/src/constants/design";
import useViewport from "@/src/lib/useViewport";

/**
 * Stint canonical F1 page wrapper. Every F1 tab (Home, Calendar, AI Insight,
 * Wire, Leagues, Grid, Profile, Standings) mounts inside it so the product
 * reads as one system.
 *
 * Responsibilities:
 *   1. Container width — pins to CONTENT_MAX (1280) centered.
 *   2. Page-level padding — responsive (34/22/18 px desktop/tablet/mobile).
 *   3. Page-enter motion — applies the `.f1-page-enter` cascade so every F1
 *      page lands the same way (opacity + 6px translateY, 520ms EASE_OUT_EXPO).
 *   4. Optional atmospheric layer — a slow drifting radial wash anchored
 *      behind content via `[data-ambient]` so each page can carry its own
 *      mood without inventing a new background each time.
 *
 * Props:
 *   tone          — "live" | "ambient" | "editorial" | "flat" — drives the
 *                   ambient color hue (greenish / warm amber / blue / none).
 *   ambient       — "none" | "subtle" | "glow" — intensity of the radial.
 *   maxWidth      — override the default container width (e.g. for
 *                   tablet-scoped pages). Defaults to CONTENT_MAX.
 *   density       — pass-through `data-page-density` so child components
 *                   that read density (Calendar) keep their behaviour.
 *   className     — extra class on the root.
 *   style         — extra inline styles on the root.
 *   contentStyle  — extra inline styles on the inner content wrapper. Use
 *                   sparingly; most styling belongs in the page itself.
 *
 * Picks page is intentionally NOT migrated to PageShell yet — it has its
 * own scoring chrome. WC pages are also untouched.
 */
export default function PageShell({
  tone = "flat",
  ambient = "none",
  maxWidth = CONTENT_MAX,
  density,
  className,
  style,
  contentStyle,
  children,
}) {
  const { isMobile, isTablet } = useViewport();

  const padding = isMobile
    ? "18px 16px 96px"
    : isTablet
      ? "22px 22px 96px"
      : "34px 28px 96px";

  return (
    <div
      className={`f1-page-shell f1-page-enter ${className || ""}`.trim()}
      data-tone={tone}
      data-ambient={ambient}
      data-page-density={density}
      style={{
        position: "relative",
        zIndex: 1,
        ...style,
      }}
    >
      <div
        style={{
          maxWidth,
          margin: "0 auto",
          padding,
          position: "relative",
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
