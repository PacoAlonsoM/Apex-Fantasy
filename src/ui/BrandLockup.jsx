import {
  BRAND_DESCRIPTOR,
  BRAND_WORDMARK,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
} from "@/src/constants/design";
import BrandMark from "@/src/ui/BrandMark";

export default function BrandLockup({ mobile = false, compact = false, markSize, descriptor = !mobile, ghost = false }) {
  const size = markSize || (mobile ? 40 : compact ? 42 : 46);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: mobile ? 12 : 14 }}>
      <BrandMark size={size} ghost={ghost} />
      <div style={{ display: "grid", gap: descriptor ? 4 : 0, textAlign: "left" }}>
        <span
          style={{
            fontSize: mobile ? 24 : compact ? 26 : 30,
            fontWeight: 800,
            letterSpacing: "-0.06em",
            lineHeight: 0.9,
            color: TEXT_PRIMARY,
            fontFamily: "var(--font-display)",
          }}
        >
          {BRAND_WORDMARK}
        </span>
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
            {BRAND_DESCRIPTOR}
          </span>
        )}
      </div>
    </div>
  );
}
