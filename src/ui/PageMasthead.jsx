import {
  PANEL_BORDER,
  SECTION_RADIUS,
  SOFT_SHADOW,
  TEXT_PRIMARY,
} from "@/src/constants/design";
import useViewport from "@/src/lib/useViewport";

/**
 * Stint canonical page masthead.
 *
 * One component for every primary tab's top-of-page band. Subsumes the legacy
 * `PageHeader` plus 9 inline reimplementations across the app. All visual
 * primitives — type ladder classes, hero-image tokens, vignette token,
 * tone washes, density attribute — are already defined in src/index.css.
 *
 * Anatomy (single grid):
 *   ┌── image layer (absolute, masked, vignette) ───────────────┐
 *   │ row 1: [eyebrow] ········· [meta]                         │
 *   │ row 2: identityRow ?? <h1 stint-page-title>               │
 *   │ row 3: description                                        │
 *   │ row 4: badges? + actions?                                 │
 *   └────────────────────────────────────────── aside ─────────┘
 *
 * Variants:
 *   • `full`    — bordered panel with background gradient + soft shadow
 *                 (the canonical Calendar/Pro Success/Profile treatment).
 *                 minHeight 220 desktop / 0 mobile.
 *   • `compact` — no minHeight, denser padding. For Picks where the race
 *                 chrome carries the page state and the masthead should
 *                 stay tight.
 *   • `flush`   — no border / background; only a bottom hairline. For
 *                 NewsPage's Wire / AI Insight masthead.
 *
 * Tones (radial wash behind the title):
 *   • `ambient`   — warm amber (audit's "ambient orange" token)
 *   • `live`      — live green (for "happening right now" signals)
 *   • `editorial` — AI blue (for AI-driven surfaces)
 *   • `flat`      — none
 *
 * Image contract — pass either:
 *   • `image={{ src, position, width, fade, mixBlend, opacity }}` (preferred)
 *   • `bgImage={src}` (deprecated alias, kept for backward compat with
 *     PublicPicksPage during the migration)
 *
 * Image positions:
 *   • `cover` (default) — fills the panel, center.
 *   • `right-mask`      — anchored to the right, fades in from the left
 *                         via `--mast-image-fade`. Ideal when a left-aligned
 *                         title needs a clean read zone.
 */
export default function PageMasthead({
  eyebrow,
  eyebrowTone,
  title,
  description,
  meta = null,
  aside = null,
  actions = null,
  badges = null,
  identityRow = null,
  image = null,
  bgImage = null,
  tone = "flat",
  variant = "full",
  viewTransitionName,
  density,
  marginBottom = 22,
  asideWidth = 280,
  minHeight,
  style,
  children,
}) {
  const { isMobile, isTablet } = useViewport();
  const resolvedAsideWidth = typeof asideWidth === "number" ? `${asideWidth}px` : asideWidth;

  // Resolve image — either the new object form or the legacy `bgImage` string.
  const img = image || (bgImage ? { src: bgImage } : null);
  const imgPosition = img?.position || "cover";
  const imgWidth   = img?.width   || (imgPosition === "right-mask" ? (isMobile ? "82%" : "72%") : "100%");
  const imgFade    = img?.fade    || (imgPosition === "right-mask" ? "var(--mast-image-fade)" : null);
  const imgBlend   = img?.mixBlend || "var(--hero-image-blend)";
  const imgOpacity = img?.opacity != null
    ? img.opacity
    : (isMobile ? "var(--hero-image-opacity-mobile)" : "var(--hero-image-opacity)");

  // Resolve tone wash.
  const toneBackground = tone === "flat" ? null : `var(--tone-${tone})`;

  // Variant styles.
  const variantStyles = {
    full: {
      borderRadius: SECTION_RADIUS,
      border: PANEL_BORDER,
      background: "var(--panel-gradient)",
      boxShadow: SOFT_SHADOW,
      padding: isMobile ? "18px 16px 20px" : "24px 28px 22px",
      minHeight: minHeight != null ? minHeight : (isMobile ? 0 : 220),
    },
    compact: {
      borderRadius: SECTION_RADIUS,
      border: PANEL_BORDER,
      background: "var(--panel-gradient)",
      boxShadow: SOFT_SHADOW,
      padding: isMobile ? "14px 16px 14px" : "16px 24px 14px",
      minHeight: minHeight != null ? minHeight : 0,
    },
    flush: {
      borderRadius: 0,
      border: "none",
      borderBottom: "1px solid var(--border)",
      background: "transparent",
      boxShadow: "none",
      padding: isMobile ? "12px 0 14px" : "14px 0 16px",
      minHeight: minHeight != null ? minHeight : 0,
    },
  };

  // Eyebrow color override (default uses the existing `.stint-kicker` token).
  const eyebrowStyle = eyebrowTone
    ? { color: `var(--text-${eyebrowTone === "accent" ? "pro" : eyebrowTone === "info" ? "ai" : eyebrowTone === "live" ? "live" : "subtle"})` }
    : null;

  return (
    <section
      data-density={density}
      style={{
        ...variantStyles[variant],
        marginBottom,
        overflow: "hidden",
        position: "relative",
        viewTransitionName,
        ...style,
      }}
    >
      {/* Image + vignette layer */}
      {img?.src && (
        <>
          <img
            src={img.src}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            style={{
              position: "absolute",
              top: 0,
              right: imgPosition === "right-mask" ? 0 : undefined,
              left: imgPosition === "cover" ? 0 : undefined,
              height: "100%",
              width: imgWidth,
              objectFit: "cover",
              objectPosition: imgPosition === "right-mask" ? "center right" : "center",
              opacity: imgOpacity,
              filter: "var(--hero-image-filter)",
              mixBlendMode: imgBlend,
              maskImage: imgFade || undefined,
              WebkitMaskImage: imgFade || undefined,
              pointerEvents: "none",
            }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
          {/* Vignette only on full / compact variants where the bg is dark/elevated.
              Flush has no panel bg so a vignette would draw a band on the page. */}
          {variant !== "flush" && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background: "var(--header-vignette)",
                pointerEvents: "none",
              }}
            />
          )}
        </>
      )}

      {/* Tone radial wash */}
      {toneBackground && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: toneBackground,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Content grid */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: aside && !isTablet ? `minmax(0,1fr) ${resolvedAsideWidth}` : "1fr",
          gap: 18,
          height: variant === "full" && !isMobile ? "100%" : "auto",
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          {/* Row 1: eyebrow + meta */}
          {(eyebrow || meta) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: identityRow ? 10 : 12,
              }}
            >
              {eyebrow ? (
                <div className="stint-kicker" style={eyebrowStyle}>
                  {eyebrow}
                </div>
              ) : <span />}
              {meta && (
                <div style={{ flexShrink: 0 }}>
                  {meta}
                </div>
              )}
            </div>
          )}

          {/* Row 2: identityRow OR title */}
          {identityRow ? (
            <div style={{ marginBottom: description ? 12 : 0 }}>{identityRow}</div>
          ) : (
            <h1
              className="stint-page-title"
              style={isMobile
                ? { fontSize: 28, letterSpacing: "-0.04em", marginBottom: description ? 12 : 0 }
                : { marginBottom: description ? 12 : 0 }}
            >
              {title}
            </h1>
          )}

          {/* Row 3: description */}
          {description && (
            <div className="stint-body" style={{ maxWidth: 720, fontSize: isMobile ? 14 : 15, lineHeight: 1.82 }}>
              {description}
            </div>
          )}

          {/* Row 4: badges + actions */}
          {(badges || actions) && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18, alignItems: "center" }}>
              {badges}
              {actions}
            </div>
          )}

          {/* Free-form children for unusual call sites */}
          {children}
        </div>

        {aside && (
          <div
            style={{
              borderRadius: 18,
              border: "1px solid var(--border-soft)",
              background: "var(--btn-secondary-bg)",
              padding: "16px 16px 14px",
              color: TEXT_PRIMARY,
            }}
          >
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
