
export default function Navbar({ page, setPage, user, openAuth, onLogout }) {
  const tabs = [
  ["home", "Home"], ["calendar", "Calendar"], ["predictions", "Predictions"],
  ["standings", "Standings"], ["community", "Community"], ["admin", "Admin"]
];
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(8,8,26,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setPage("home")}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#E8002D,#FF6B35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
        </div>
        <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5 }}>APEX<span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400, marginLeft: 3 }}>FANTASY</span></span>
      </div>
      <div style={{ display: "flex" }}>
        {tabs.map(([id, lb]) => (
          <button key={id} onClick={() => setPage(id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 14px", fontSize: 13, fontWeight: page === id ? 700 : 400, color: page === id ? "#fff" : "rgba(255,255,255,0.4)", position: "relative" }}>
            {lb}
            {page === id && <div style={{ position: "absolute", bottom: -1, left: "15%", right: "15%", height: 2, background: "linear-gradient(90deg,#E8002D,#FF6B35)", borderRadius: 1 }} />}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {user ? (
          <>
            <div style={{ padding: "5px 14px", borderRadius: 20, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 13, fontWeight: 700 }}>
              {user.username} <span style={{ color: "#E8002D", fontWeight: 900 }}>{user.points || 0}pt</span>
            </div>
            <button onClick={onLogout} style={{ background: "none", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 20, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12, padding: "5px 13px" }}>Out</button>
          </>
        ) : (
          <>
            <button onClick={() => openAuth("login")} style={{ background: "none", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 20, color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 13, padding: "6px 15px" }}>Login</button>
            <button onClick={() => openAuth("register")} style={{ background: "linear-gradient(135deg,#E8002D,#FF6B35)", border: "none", borderRadius: 20, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "6px 16px" }}>Sign Up</button>
          </>
        )}
      </div>
    </nav>
  );
}
