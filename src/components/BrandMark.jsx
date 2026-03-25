import {
  BG_ELEVATED,
  BRAND_BADGE_BG,
  BRAND_BADGE_BORDER,
  BRAND_BADGE_SHADOW,
  PANEL_BORDER,
} from "../constants/design";

function TrackSvg({ simplified = false }) {
  const outerFill = "#202125";
  const innerFill = "#2A2B31";
  const kerbFill = "#E85B2B";

  if (simplified) {
    return (
      <svg viewBox="0 0 84 84" aria-hidden="true">
        <path
          d="M18 76C28 69 36 60 43 50C49 42 51 33 48 25C45 17 48 11 64 8C51 11 40 16 31 24C21 33 18 44 21 55C24 63 23 70 18 76Z"
          fill={outerFill}
        />
        <path
          d="M34 72C43 64 51 55 57 45C62 37 64 29 61 21C59 15 61 11 73 8C62 11 52 17 45 24C37 32 35 42 38 50C41 58 40 65 34 72Z"
          fill={innerFill}
        />
        <path d="M28 62L33 59L37 61L32 64Z" fill={kerbFill} />
        <path d="M37 50L42 47L46 49L41 52Z" fill={kerbFill} />
        <path d="M45 38L49 35L53 37L49 40Z" fill={kerbFill} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 108 164" aria-hidden="true">
      <path
        d="M8 156C24 146 38 131 50 114C62 96 67 77 65 60C63 46 67 35 83 21C68 25 55 31 44 40C29 52 20 68 18 86C16 103 13 123 8 156Z"
        fill={outerFill}
      />
      <path
        d="M34 162C50 148 64 133 76 115C88 97 94 79 92 61C91 47 94 37 104 24C93 29 83 36 73 47C61 60 54 75 53 91C52 108 48 128 34 162Z"
        fill={innerFill}
      />
      <path d="M26 135L35 129L43 133L34 139Z" fill={kerbFill} />
      <path d="M36 118L44 113L52 117L44 122Z" fill={kerbFill} />
      <path d="M44 101L52 96L60 100L52 105Z" fill={kerbFill} />
      <path d="M52 84L59 79L67 83L60 88Z" fill={kerbFill} />
      <path d="M58 68L65 64L72 68L65 72Z" fill={kerbFill} />
      <path d="M64 53L70 49L77 53L71 57Z" fill={kerbFill} />
      <path d="M69 38L75 34L81 37L75 41Z" fill={kerbFill} />
    </svg>
  );
}

export default function BrandMark({ size = 46, ghost = false, simplified = false, badge = false }) {
  const wrapperWidth = badge ? size : Math.round(size * 0.62);
  const wrapperHeight = size;

  if (!badge) {
    return (
      <div
        style={{
          width: wrapperWidth,
          height: wrapperHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ width: "100%", height: "100%" }}>
          <TrackSvg simplified={simplified} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(12, Math.round(size * 0.28)),
        background: ghost ? BG_ELEVATED : BRAND_BADGE_BG,
        border: ghost ? PANEL_BORDER : BRAND_BADGE_BORDER,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: ghost ? "none" : BRAND_BADGE_SHADOW,
        padding: simplified ? size * 0.15 : size * 0.12,
        flexShrink: 0,
      }}
    >
      <div style={{ width: "100%", height: "100%" }}>
        <TrackSvg simplified={simplified} />
      </div>
    </div>
  );
}
