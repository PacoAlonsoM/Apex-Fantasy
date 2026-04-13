export default function ProPip({ size = 15, style = {}, title = "Pro member" }) {
  const innerSize = Math.max(8, Math.round(size * 0.56));

  return (
    <div
      aria-label={title}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(180deg,#fbbf24,#f97316)",
        border: "1px solid rgba(255,255,255,0.88)",
        boxShadow: "0 6px 14px rgba(249,115,22,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        flexShrink: 0,
        ...style,
      }}
    >
      <svg width={innerSize} height={innerSize} viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M5 1L6.18 3.82L9 4.27L7 6.24L7.45 9L5 7.56L2.55 9L3 6.24L1 4.27L3.82 3.82L5 1Z" fill="rgba(255,255,255,0.96)" />
      </svg>
    </div>
  );
}
