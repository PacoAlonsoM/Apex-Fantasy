export default function BrandMark({ size = 38, ghost = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        background: ghost ? "linear-gradient(180deg,rgba(20,32,54,0.8),rgba(8,17,29,0.48))" : "linear-gradient(135deg,#f97316 0%,#f59e0b 100%)",
        border: ghost ? "1px solid rgba(148,163,184,0.12)" : "1px solid rgba(148,163,184,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: ghost ? "0 22px 44px rgba(0,0,0,0.14)" : "0 4px 28px rgba(249,115,22,0.25)",
        backdropFilter: ghost ? "blur(12px)" : "none",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: Math.round(size * 0.52),
          lineHeight: 1,
          color: "#fff7ed",
          letterSpacing: "-0.04em",
          transform: "translateY(-0.5px)",
          textShadow: "0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        S
      </span>
    </div>
  );
}
