import {
  BRAND_DESCRIPTOR,
  BRAND_LOGO_SRC,
  BRAND_NAME,
  SUBTLE_TEXT,
} from "@/src/constants/design";

export default function BrandLockup({ mobile = false, compact = false, markSize, descriptor = !mobile, descriptorText = BRAND_DESCRIPTOR, ghost = false }) {
  const logoHeight = markSize || (mobile ? 40 : compact ? 44 : 48);
  const logoWidth = Math.round(logoHeight * 4.1);

  return (
    <div style={{ display: "inline-grid", gap: descriptor ? 6 : 0, justifyItems: "start", textAlign: "left" }}>
      <img
        src={BRAND_LOGO_SRC}
        alt={`${BRAND_NAME} logo`}
        style={{
          width: logoWidth,
          height: logoHeight,
          objectFit: "contain",
          objectPosition: "left center",
          display: "block",
          flexShrink: 0,
          filter: ghost ? "none" : "var(--logo-shadow)",
        }}
      />
      {descriptor && (
        <span
          style={{
            fontSize: mobile ? 10 : 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: SUBTLE_TEXT,
          }}
        >
          {descriptorText}
        </span>
      )}
    </div>
  );
}
