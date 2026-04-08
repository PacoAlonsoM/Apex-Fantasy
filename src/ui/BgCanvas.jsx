export default function BgCanvas() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#050b14 0%,#07111b 46%,#08131e 100%)" }} />
      <div style={{ position: "absolute", top: "-14%", left: "-12%", width: "54%", height: "42%", background: "radial-gradient(ellipse,rgba(255,106,26,0.16) 0%,rgba(255,106,26,0.08) 34%,transparent 72%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", top: "-10%", right: "10%", width: "34%", height: "24%", background: "radial-gradient(ellipse,rgba(255,194,71,0.08) 0%,transparent 74%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", bottom: "-22%", left: "22%", width: "46%", height: "36%", background: "radial-gradient(ellipse,rgba(45,212,191,0.08) 0%,transparent 76%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(255,255,255,0.018),transparent 24%,transparent 74%,rgba(255,255,255,0.012) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 18%, rgba(255,255,255,0.028), transparent 24%)" }} />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.014 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="96" height="96" patternUnits="userSpaceOnUse">
            <path d="M 96 0 L 0 0 0 96" fill="none" stroke="white" strokeWidth="0.9" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}
