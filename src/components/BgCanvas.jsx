export default function BgCanvas() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#040814 0%,#07101b 42%,#091220 100%)" }} />
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "58%", height: "62%", background: "radial-gradient(ellipse,rgba(249,115,22,0.18) 0%,rgba(249,115,22,0.05) 28%,transparent 70%)", borderRadius: "50%", filter: "blur(14px)" }} />
      <div style={{ position: "absolute", top: "4%", right: "-10%", width: "44%", height: "46%", background: "radial-gradient(ellipse,rgba(45,212,191,0.08) 0%,rgba(45,212,191,0.03) 36%,transparent 70%)", borderRadius: "50%", filter: "blur(14px)" }} />
      <div style={{ position: "absolute", bottom: "-16%", left: "24%", width: "42%", height: "42%", background: "radial-gradient(ellipse,rgba(59,130,246,0.08) 0%,rgba(59,130,246,0.03) 36%,transparent 72%)", borderRadius: "50%", filter: "blur(18px)" }} />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.025 }} xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="g" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M 64 0 L 0 0 0 64" fill="none" stroke="white" strokeWidth="1" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="d" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#d)" />
      </svg>
    </div>
  );
}
