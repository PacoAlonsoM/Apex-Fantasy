export default function BgCanvas() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "var(--body-gradient)" }} />
      <div style={{ position: "absolute", top: "-14%", left: "-12%", width: "54%", height: "42%", background: "radial-gradient(ellipse,var(--bg-glow-orange) 0%,var(--bg-glow-orange-soft) 34%,transparent 72%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", top: "-10%", right: "10%", width: "34%", height: "24%", background: "radial-gradient(ellipse,var(--bg-glow-amber) 0%,transparent 74%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", bottom: "-22%", left: "22%", width: "46%", height: "36%", background: "radial-gradient(ellipse,var(--bg-glow-teal) 0%,transparent 76%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,var(--bg-overlay-tl),transparent 24%,transparent 74%,var(--bg-overlay-br) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 18%, var(--bg-spotlight), transparent 24%)" }} />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", color: "var(--bg-grid-stroke)", opacity: "var(--bg-grid-opacity)" }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="96" height="96" patternUnits="userSpaceOnUse">
            <path d="M 96 0 L 0 0 0 96" fill="none" stroke="currentColor" strokeWidth="0.9" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}
