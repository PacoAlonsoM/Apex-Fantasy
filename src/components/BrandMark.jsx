export default function BrandMark({ size = 38, ghost = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        background: ghost ? "linear-gradient(180deg,rgba(20,32,54,0.8),rgba(8,17,29,0.48))" : "linear-gradient(180deg,#16243a 0%,#0a1220 100%)",
        border: ghost ? "1px solid rgba(148,163,184,0.12)" : "1px solid rgba(148,163,184,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: ghost ? "0 22px 44px rgba(0,0,0,0.14)" : "0 22px 44px rgba(0,0,0,0.28)",
        backdropFilter: ghost ? "blur(12px)" : "none",
      }}
    >
      <svg width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <path d="M8 38L20.6 12H25.6L17.2 30.2H28.8L36.5 12H41.6L29.5 38H8Z" fill="url(#apexMain)" />
        <path d="M26.9 14.2H40.8L33.8 29.7H29.2L34 18.8H28.8L26.9 14.2Z" fill="url(#apexTop)" />
        <path d="M13.6 40.2C19.4 36.7 25.8 34.9 34.4 34.9H42.6" stroke="#38bdf8" strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
        <path d="M11.1 31.1L15.5 21.8" stroke="#fde68a" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        <defs>
          <linearGradient id="apexMain" x1="8" y1="12" x2="41.6" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f97316" />
            <stop offset="0.5" stopColor="#fb923c" />
            <stop offset="1" stopColor="#facc15" />
          </linearGradient>
          <linearGradient id="apexTop" x1="26.9" y1="14.2" x2="40.8" y2="29.7" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fff7ed" />
            <stop offset="1" stopColor="#fed7aa" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
