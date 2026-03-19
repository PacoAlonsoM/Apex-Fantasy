import { useRef, useState } from "react";
import {
  ACCENT,
  ACCENT_GLOW,
  BG_SURFACE,
  BRAND_DESCRIPTOR,
  BRAND_GRADIENT,
  BRAND_WORDMARK,
  EDGE_RING,
  PANEL_BORDER,
  SHELL_MAX,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  avatarTheme,
  isAdminUser,
} from "../constants/design";
import BrandMark from "./BrandMark";
import useViewport from "../useViewport";

export default function Navbar({ page, setPage, user, openAuth, onLogout, demoMode = false, exitDemo }) {
  const [dropOpen, setDropOpen] = useState(false);
  const timeout = useRef(null);
  const { isMobile, isTablet } = useViewport();
  const userTheme = avatarTheme(user?.avatar_color);

  const tabs = [
    ["calendar", "Calendar"],
    ["predictions", "Picks"],
    ["ai-brief", "AI Insight"],
    ["news", "Wire"],
    ["standings", "Leaderboard"],
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
    timeout.current = setTimeout(() => setDropOpen(false), 140);
  };

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(11,17,32,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          maxWidth: SHELL_MAX,
          margin: "0 auto",
          padding: isMobile ? "12px 18px" : "12px 32px",
          display: "grid",
          gridTemplateColumns: isTablet ? "1fr auto" : "auto 1fr auto",
          gap: isMobile ? 12 : 24,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => setPage("home")}
          data-hover="minimal"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: TEXT_PRIMARY,
            justifySelf: "start",
          }}
        >
          <BrandMark size={40} />
          <div style={{ display: "grid", gap: 3, textAlign: "left" }}>
            <span style={{ fontSize: isMobile ? 28 : 30, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9 }}>
              {BRAND_WORDMARK}
            </span>
            {!isMobile && (
              <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                {BRAND_DESCRIPTOR}
              </span>
            )}
          </div>
        </button>

        <div style={{ justifySelf: isTablet ? "start" : "center", gridColumn: isTablet ? "1 / -1" : "auto", order: isTablet ? 3 : undefined }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexWrap: isMobile ? "wrap" : "nowrap",
              minHeight: 64,
              padding: 6,
              borderRadius: 999,
              background: BG_SURFACE,
              boxShadow: EDGE_RING,
            }}
          >
            {tabs.map(([id, label]) => {
              const active = page === id;
              return (
                <button
                  key={id}
                  onClick={() => setPage(id)}
                  data-hover="minimal"
                  onMouseEnter={(event) => {
                    if (!active) event.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(event) => {
                    if (!active) event.currentTarget.style.background = "transparent";
                  }}
                  style={{
                    position: "relative",
                    minHeight: 52,
                    padding: isMobile ? "0 12px" : "0 18px",
                    borderRadius: 999,
                    border: "none",
                    background: "transparent",
                    color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                  }}
                >
                  {label}
                  {active && (
                    <span
                      style={{
                        position: "absolute",
                        left: 16,
                        right: 16,
                        bottom: 6,
                        height: 2,
                        borderRadius: 999,
                        background: ACCENT,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ justifySelf: "end" }}>
          {user ? (
            <div style={{ position: "relative" }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <button
                data-hover="minimal"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 56,
                  padding: "10px 14px",
                  borderRadius: 18,
                  border: PANEL_BORDER,
                  background: BG_SURFACE,
                  color: TEXT_PRIMARY,
                  cursor: "pointer",
                  boxShadow: EDGE_RING,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: userTheme.fill,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: userTheme.text,
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {user.username?.slice(0, 2).toUpperCase()}
                </div>
                {!isMobile && (
                  <div style={{ display: "grid", gap: 2, textAlign: "left" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1 }}>{user.username}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1, color: ACCENT }}>{user.points || 0} pts</span>
                  </div>
                )}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: dropOpen ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }}>
                  <path d="M1 1l4 4 4-4" stroke={TEXT_SECONDARY} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {dropOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    right: 0,
                    width: 240,
                    borderRadius: 16,
                    background: BG_SURFACE,
                    boxShadow: SOFT_SHADOW,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>{user.username}</div>
                    <div style={{ fontSize: 12, color: ACCENT, fontWeight: 600, marginTop: 4 }}>{user.points || 0} pts</div>
                  </div>
                  {menuItems.map(([label, target]) => (
                    <button
                      key={target}
                      data-hover="minimal"
                      onClick={() => {
                        setPage(target);
                        setDropOpen(false);
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = "transparent";
                      }}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        color: TEXT_PRIMARY,
                        cursor: "pointer",
                        textAlign: "left",
                        padding: "13px 16px",
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
                  <button
                    data-hover="minimal"
                    onClick={() => {
                      onLogout();
                      setDropOpen(false);
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "rgba(239,68,68,0.08)";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "transparent";
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      color: "#fca5a5",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: "13px 16px",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : demoMode ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div
                style={{
                  minHeight: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: BG_SURFACE,
                  color: SUBTLE_TEXT,
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Demo Preview
              </div>
              <button
                onClick={exitDemo}
                style={{
                  minHeight: 48,
                  padding: "0 18px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                  color: TEXT_PRIMARY,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                Exit Demo
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={() => openAuth("login")}
                style={{
                  minHeight: 48,
                  padding: "0 18px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                  color: TEXT_PRIMARY,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                Login
              </button>
              <button
                onClick={() => openAuth("register")}
                style={{
                  minHeight: 48,
                  padding: "0 18px",
                  borderRadius: 12,
                  border: "none",
                  background: BRAND_GRADIENT,
                  color: TEXT_PRIMARY,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  boxShadow: `0 4px 16px ${ACCENT_GLOW}`,
                }}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
