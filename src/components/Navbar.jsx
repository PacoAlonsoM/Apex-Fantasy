import { useRef, useState } from "react";
import {
  BRAND_GRADIENT,
  EDGE_RING,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BG_STRONG,
  PANEL_BORDER,
  SHELL_MAX,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  avatarTheme,
  isAdminUser,
} from "../constants/design";
import BrandMark from "./BrandMark";
import useViewport from "../useViewport";

export default function Navbar({ page, setPage, user, openAuth, onLogout }) {
  const [dropOpen, setDropOpen] = useState(false);
  const timeout = useRef(null);
  const userTheme = avatarTheme(user?.avatar_color);
  const { isMobile, isTablet } = useViewport();

  const tabs = [
    ["home", "Home"],
    ["calendar", "Calendar"],
    ["predictions", "Predictions"],
    ["ai-brief", "AI Insight"],
    ["news", "News"],
    ["standings", "Standings"],
    ["community", "Leagues"],
  ];

  const admin = isAdminUser(user);
  const menuItems = admin
    ? [["My Profile", "profile"], ["My Leagues", "community"], ["Game Guide", "game-guide"], ["Contact Support", "support"], ["Admin", "admin"]]
    : [["My Profile", "profile"], ["My Leagues", "community"], ["Game Guide", "game-guide"], ["Contact Support", "support"]];

  const handleMouseEnter = () => {
    clearTimeout(timeout.current);
    setDropOpen(true);
  };

  const handleMouseLeave = () => {
    timeout.current = setTimeout(() => setDropOpen(false), 160);
  };

  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 260, borderBottom: "1px solid rgba(148,163,184,0.08)", background: `linear-gradient(180deg,${PANEL_BG_STRONG},#07111d)` }}>
      <div style={{ maxWidth: SHELL_MAX, margin: "0 auto", padding: isMobile ? "12px 18px 10px" : "14px 28px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr auto" : "auto 1fr auto", gap: isMobile ? 14 : 24, alignItems: "center" }}>
          <button
            onClick={() => setPage("home")}
            style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, cursor: "pointer", color: "#fff", justifySelf: "start" }}
          >
            <BrandMark size={40} />
            <div style={{ display: "grid", gap: 2, textAlign: "left" }}>
              <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.7 }}>APEX FANTASY</span>
              {!isMobile && <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Race-week intelligence board</span>}
            </div>
          </button>

          <div style={{ display: "flex", justifyContent: isTablet ? "flex-start" : "center", gridColumn: isTablet ? "1 / -1" : "auto", order: isTablet ? 3 : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: 6, borderRadius: 999, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(148,163,184,0.1)", boxShadow: EDGE_RING, width: isMobile ? "100%" : "auto", justifyContent: isMobile ? "space-between" : "center" }}>
              {tabs.map(([id, label]) => {
                const active = page === id;
                return (
                  <button
                    key={id}
                    onClick={() => setPage(id)}
                    data-hover="minimal"
                    style={{
                      background: active ? "linear-gradient(180deg,rgba(255,255,255,0.05),rgba(15,24,44,0.98))" : "transparent",
                      border: active ? "1px solid rgba(248,250,252,0.08)" : "1px solid transparent",
                      borderRadius: 999,
                      padding: isMobile ? "9px 11px" : "10px 15px",
                      cursor: "pointer",
                      color: active ? "#fff" : "rgba(226,232,240,0.6)",
                      fontSize: isMobile ? 12 : 14,
                      fontWeight: active ? 800 : 650,
                      letterSpacing: -0.2,
                      position: "relative",
                      boxShadow: active ? `0 0 0 1px var(--team-accent-border), 0 14px 30px var(--team-accent-ghost)` : "none",
                      transition: "background 220ms ease, color 220ms ease, transform 220ms cubic-bezier(0.22,1,0.36,1), border-color 220ms ease, box-shadow 220ms ease",
                    }}
                    onMouseEnter={(event) => {
                      if (!active) {
                        event.currentTarget.style.background = "var(--team-accent-ghost)";
                        event.currentTarget.style.borderColor = "var(--team-accent-border)";
                        event.currentTarget.style.boxShadow = "0 0 0 1px var(--team-accent-border), 0 14px 30px var(--team-accent-ghost)";
                        event.currentTarget.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(event) => {
                      if (!active) {
                        event.currentTarget.style.background = "transparent";
                        event.currentTarget.style.borderColor = "transparent";
                        event.currentTarget.style.boxShadow = "none";
                        event.currentTarget.style.transform = "none";
                      }
                    }}
                  >
                    {label}
                    <span
                      style={{
                        position: "absolute",
                        left: 14,
                        right: 14,
                        bottom: 5,
                        height: 2,
                        borderRadius: 999,
                        background: active ? BRAND_GRADIENT : "transparent",
                        opacity: active ? 1 : 0,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifySelf: "end", gap: 10 }}>
            {user ? (
              <div style={{ position: "relative" }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <div
                  data-clickable="true"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 54,
                    padding: "9px 14px",
                    borderRadius: 18,
                    background: PANEL_BG,
                    border: "1px solid rgba(148,163,184,0.16)",
                    boxShadow: `0 14px 34px rgba(2,6,23,0.22), ${EDGE_RING}`,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 11, background: userTheme.fill, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: userTheme.text, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
                    {user.username?.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ display: "grid", gap: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>{user.username}</span>
                    <span style={{ color: "var(--team-accent)", fontWeight: 800, fontSize: 11, lineHeight: 1 }}>{user.points || 0} pts</span>
                  </div>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: "transform 0.2s", transform: dropOpen ? "rotate(180deg)" : "none", marginLeft: 4 }}>
                    <path d="M1 1l4 4 4-4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                {dropOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: 250, background: `linear-gradient(180deg,${PANEL_BG_STRONG},#0a1220)`, border: PANEL_BORDER, borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 64px rgba(2,6,23,0.44)" }}>
                    <div style={{ padding: "15px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{user.username}</div>
                      <div style={{ fontSize: 11, color: "rgba(226,232,240,0.46)", marginTop: 3 }}>{user.points || 0} points total</div>
                    </div>
                    {menuItems.map(([label, pg]) => (
                      <button
                        key={pg}
                        onClick={() => { setPage(pg); setDropOpen(false); }}
                        style={{ width: "100%", background: "none", border: "none", padding: "13px 16px", display: "flex", cursor: "pointer", color: "rgba(248,250,252,0.84)", fontSize: 13, fontWeight: 650, textAlign: "left" }}
                        onMouseEnter={(event) => { event.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                        onMouseLeave={(event) => { event.currentTarget.style.background = "none"; }}
                      >
                        {label}
                      </button>
                    ))}
                    <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
                    <button
                      onClick={() => { onLogout(); setDropOpen(false); }}
                      style={{ width: "100%", background: "none", border: "none", padding: "13px 16px", display: "flex", cursor: "pointer", color: "#fca5a5", fontSize: 13, fontWeight: 650, textAlign: "left" }}
                      onMouseEnter={(event) => { event.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                      onMouseLeave={(event) => { event.currentTarget.style.background = "none"; }}
                    >
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button onClick={() => openAuth("login")} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.16)", borderRadius: 16, color: "rgba(248,250,252,0.78)", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "11px 16px" }}>Login</button>
                <button onClick={() => openAuth("register")} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 16, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "11px 16px", boxShadow: SOFT_SHADOW }}>Sign Up</button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
