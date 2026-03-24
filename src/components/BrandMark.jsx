import { useId } from "react";
import { BG_ELEVATED, PANEL_BORDER } from "../constants/design";

export default function BrandMark({ size = 40, ghost = false, tone = "light" }) {
  const gradientId = useId().replace(/:/g, "");
  const trackPrimary = tone === "dark" ? "#111827" : "#F8FAFC";
  const trackSecondary = tone === "dark" ? "#1F2937" : "#E2E8F0";

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        background: ghost ? BG_ELEVATED : "transparent",
        border: ghost ? PANEL_BORDER : "none",
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        aria-hidden="true"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="18" y1="82" x2="80" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F97316" />
            <stop offset="1" stopColor="#EF4444" />
          </linearGradient>
        </defs>

        <path
          d="M20 78C34 69 47 61 47 48C47 34 31 27 44 17C54 10 68 9 83 5"
          stroke={trackPrimary}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M38 86C53 76 68 64 68 48C68 36 58 28 66 20C73 13 83 10 91 7"
          stroke={trackSecondary}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 75C25 70 32 65 39 59"
          stroke={`url(#${gradientId})`}
          strokeWidth="6"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeDasharray="7 7"
        />
        <path
          d="M58 70C63 63 67 56 68 47C69 39 67 31 72 23"
          stroke={`url(#${gradientId})`}
          strokeWidth="6"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeDasharray="7 7"
        />
      </svg>
    </div>
  );
}
