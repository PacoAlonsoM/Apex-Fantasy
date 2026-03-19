export default function BgCanvas() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#060913 0%,#09101d 100%)" }} />
      <div style={{ position: "absolute", top: "-18%", left: "-12%", width: "62%", height: "72%", background: "radial-gradient(ellipse,rgba(255,90,54,0.16) 0%,transparent 66%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", top: "14%", right: "-10%", width: "46%", height: "58%", background: "radial-gradient(ellipse,rgba(255,209,102,0.12) 0%,transparent 68%)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", bottom: "-12%", left: "16%", width: "52%", height: "56%", background: "radial-gradient(ellipse,rgba(45,212,191,0.1) 0%,transparent 68%)", borderRadius: "50%" }} />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.03 }} xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>
    </div>
  );
}
