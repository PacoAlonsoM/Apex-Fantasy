export default function BgCanvas() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "#08081A" }} />
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "70%", background: "radial-gradient(ellipse,rgba(232,0,45,0.1) 0%,transparent 65%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", top: "30%", right: "-15%", width: "55%", height: "60%", background: "radial-gradient(ellipse,rgba(99,102,241,0.11) 0%,transparent 65%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", bottom: "-10%", left: "20%", width: "50%", height: "55%", background: "radial-gradient(ellipse,rgba(6,182,212,0.08) 0%,transparent 65%)", borderRadius: "50%" }} />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.025 }} xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>
    </div>
  );
}
