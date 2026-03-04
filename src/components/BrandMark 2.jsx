export default function BrandMark({ size = 38 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: "linear-gradient(180deg,#18263f 0%,#0b1322 100%)",
        border: "1px solid rgba(148,163,184,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 18px 36px rgba(0,0,0,0.28)",
      }}
    >
      <svg width={Math.round(size * 0.68)} height={Math.round(size * 0.68)} viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <path d="M10 34L20.7 10H25.8L36 34H30.9L28.6 28.4H17.2L14.9 34H10Z" fill="url(#brandA)" />
        <path d="M19 23.9H26.7L22.9 14.5L19 23.9Z" fill="#08111d" />
        <path d="M30.4 10.5C33.7 12.3 36.2 15.1 37.7 18.8" stroke="url(#brandLine)" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M13.6 34.1C10.6 32.6 8.2 30.2 6.7 27.2" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
        <defs>
          <linearGradient id="brandA" x1="10" y1="10" x2="36" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f97316" />
            <stop offset="0.58" stopColor="#fb923c" />
            <stop offset="1" stopColor="#facc15" />
          </linearGradient>
          <linearGradient id="brandLine" x1="30.4" y1="10.5" x2="37.7" y2="18.8" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fde68a" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
