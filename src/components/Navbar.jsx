import { useState, useRef } from "react";
import { BRAND_GRADIENT, PANEL_BG_ALT, PANEL_BG_STRONG, PANEL_BORDER, SUBTLE_TEXT, avatarTheme, isAdminUser } from "../constants/design";
import BrandMark from "./BrandMark";

export default function Navbar({ page, setPage, user, openAuth, onLogout }) {
  const [dropOpen, setDropOpen] = useState(false);
  const timeout = useRef(null);
  const userTheme = avatarTheme(user?.avatar_color);

  const tabs = [
    ["home", "Home"], ["calendar", "Calendar"], ["predictions", "Predictions"], ["news", "News"],
    ["standings", "Standings"], ["community", "Community"]
  ];

  const handleMouseEnter = () => { clearTimeout(timeout.current); setDropOpen(true); };
  const handleMouseLeave = () => { timeout.current = setTimeout(() => setDropOpen(false), 200); };
  const admin = isAdminUser(user);
  const menuItems = admin
    ? [["My Profile", "profile"], ["My Leagues", "community"], ["Admin", "admin"]]
    : [["My Profile", "profile"], ["My Leagues", "community"]];

  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 200, background: PANEL_BG_STRONG, borderBottom: "1px solid rgba(148,163,184,0.12)", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setPage("home")}>
        <BrandMark size={36} />
        <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5 }}>APEX<span style={{ color: SUBTLE_TEXT, fontWeight: 600, marginLeft: 3 }}>FANTASY</span></span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 5, background: PANEL_BG_ALT, borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)" }}>
        {tabs.map(([id, lb]) => (
          <button key={id} onClick={() => setPage(id)} style={{ background: page === id ? "#111c30" : "transparent", border: page === id ? "1px solid rgba(148,163,184,0.14)" : "1px solid transparent", cursor: "pointer", padding: "10px 16px", fontSize: 13, fontWeight: page === id ? 800 : 650, color: page === id ? "#fff" : "rgba(226,232,240,0.58)", position: "relative", borderRadius: 13 }}>
            {lb}
            {page === id && <div style={{ position: "absolute", bottom: 2, left: 12, right: 12, height: 2, background: `linear-gradient(90deg,var(--team-accent),#facc15)`, borderRadius: 1 }} />}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {user ? (
          <div style={{ position: "relative" }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 15, background: PANEL_BG_ALT, border: "1px solid var(--team-accent-border)", cursor: "pointer", boxShadow: "0 10px 26px var(--team-accent-ghost)" }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: userTheme.fill, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: userTheme.text, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
                {user.username?.slice(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{user.username}</span>
              <span style={{ color: "var(--team-accent)", fontWeight: 900, fontSize: 13 }}>{user.points || 0}pt</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: "transform 0.2s", transform: dropOpen ? "rotate(180deg)" : "none" }}>
                <path d="M1 1l4 4 4-4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            {dropOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 220, background: PANEL_BG_STRONG, border: PANEL_BORDER, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.45)" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{user.username}</div>
                  <div style={{ fontSize: 11, color: "rgba(226,232,240,0.46)", marginTop: 2 }}>{user.points || 0} points total</div>
                </div>
                {menuItems.map(([label, pg]) => (
                  <button key={pg} onClick={() => { setPage(pg); setDropOpen(false); }}
                    style={{ width: "100%", background: "none", border: "none", padding: "12px 16px", display: "flex", cursor: "pointer", color: "rgba(248,250,252,0.78)", fontSize: 13, fontWeight: 600, textAlign: "left" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >{label}</button>
                ))}
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
                <button onClick={() => { onLogout(); setDropOpen(false); }}
                  style={{ width: "100%", background: "none", border: "none", padding: "12px 16px", display: "flex", cursor: "pointer", color: "#F87171", fontSize: 13, fontWeight: 600, textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >Log Out</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button onClick={() => openAuth("login")} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.14)", borderRadius: 14, color: "rgba(248,250,252,0.72)", cursor: "pointer", fontSize: 13, fontWeight: 650, padding: "9px 16px" }}>Login</button>
            <button onClick={() => openAuth("register")} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 14, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 16px", boxShadow: "0 14px 28px rgba(249,115,22,0.18)" }}>Sign Up</button>
          </>
        )}
      </div>
    </nav>
  );
}
