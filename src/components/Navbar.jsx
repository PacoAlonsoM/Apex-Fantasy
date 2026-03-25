import { useRef, useState } from "react";
import {
  ACCENT,
  ACCENT_GLOW,
  BG_SURFACE,
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
import { pageToHref } from "../routing";
import BrandLockup from "./BrandLockup";
import useViewport from "../useViewport";

export default function Navbar({ page, setPage, user, openAuth, onLogout, demoMode = false, exitDemo }) {
  const [dropOpen, setDropOpen] = useState(false);
  const [hoveredTab, setHoveredTab] = useState(null);
  const timeout = useRef(null);
  const { isMobile, isTablet } = useViewport();
  const userTheme = avatarTheme(user?.avatar_color);

  const tabs = [
    ["calendar", "Calendar"],
    ["predictions", "Picks"],
    ["ai-brief", "AI Insight"],
    ["news", "Wire"],
    ["standings", "Standings"],
    ["community", "Leagues"],
  ];

  const admin = isAdminUser(user);
  const picksTarget = user || demoMode ? "predictions" : "public-picks";
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

  const ctaLabel = user ? "Open picks" : "Create account";
  const ctaAction = () => {
    if (user) {
      setPage("predictions");
      return;
    }
    openAuth("register", { page: "predictions" });
  };

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(6,16,27,0.78)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(214,223,239,0.08)",
      }}
    >
      <div
        style={{
          maxWidth: SHELL_MAX,
          margin: "0 auto",
          padding: isMobile ? "12px 18px 14px" : "14px 28px 16px",
          display: "grid",
          gridTemplateColumns: isTablet ? "1fr auto" : "auto minmax(0,1fr) auto",
          gap: 16,
          alignItems: "center",
        }}
      >
        <a
          href={pageToHref("home", { demoMode })}
          onClick={(event) => {
            event.preventDefault();
            setPage("home");
          }}
          data-hover="minimal"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifySelf: "start",
            color: TEXT_PRIMARY,
            textDecoration: "none",
          }}
        >
          <BrandLockup mobile={isMobile} descriptor={!isMobile} />
        </a>

        <div
          style={{
            justifySelf: isTablet ? "stretch" : "center",
            gridColumn: isTablet ? "1 / -1" : "auto",
            order: isTablet ? 3 : undefined,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 64,
              minWidth: isTablet ? "max-content" : "auto",
              padding: 6,
              borderRadius: 999,
              background: "rgba(14,25,41,0.9)",
              border: "1px solid rgba(214,223,239,0.08)",
              boxShadow: EDGE_RING,
            }}
          >
            {tabs.map(([id, label]) => {
              const actualId = id === "predictions" ? picksTarget : id;
              const active = id === "predictions" ? page === "predictions" || page === "public-picks" : page === id;
              return (
                <a
                  key={id}
                  href={pageToHref(actualId, { demoMode })}
                  onClick={(event) => {
                    event.preventDefault();
                    setPage(actualId);
                  }}
                  onMouseEnter={() => !active && setHoveredTab(id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  data-hover="minimal"
                  style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 50,
                    padding: isMobile ? "0 14px" : "0 18px",
                    borderRadius: 999,
                    background: active ? "rgba(255,255,255,0.05)" : hoveredTab === id ? "rgba(255,255,255,0.06)" : "transparent",
                    color: active ? TEXT_PRIMARY : hoveredTab === id ? TEXT_PRIMARY : TEXT_SECONDARY,
                    fontSize: 13,
                    fontWeight: active ? 800 : 700,
                    letterSpacing: active ? "-0.02em" : "0",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    transition: "background 150ms ease, color 150ms ease",
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
                        background: `linear-gradient(90deg, ${ACCENT}, rgba(255,194,71,0.92))`,
                      }}
                    />
                  )}
                </a>
              );
            })}
          </div>
        </div>

        <div style={{ justifySelf: "end", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!user && !demoMode && !isMobile && (
            <button
              onClick={() => openAuth("login", { page: "predictions" })}
              className="stint-button-secondary"
              style={{ minHeight: 48, padding: "0 18px", fontSize: 13 }}
            >
              Log in
            </button>
          )}

          {!user && !demoMode && (
            <button
              onClick={ctaAction}
              className="stint-button"
              style={{ minHeight: isMobile ? 46 : 48, padding: isMobile ? "0 16px" : "0 20px", fontSize: 13, boxShadow: `0 18px 32px ${ACCENT_GLOW}` }}
            >
              {ctaLabel}
            </button>
          )}

          {demoMode && !user && (
            <>
              <div
                style={{
                  minHeight: 46,
                  padding: "0 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(214,223,239,0.12)",
                  background: BG_SURFACE,
                  color: SUBTLE_TEXT,
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Demo Preview
              </div>
              <button onClick={exitDemo} className="stint-button-secondary" style={{ minHeight: 46, padding: "0 18px", fontSize: 13 }}>
                Exit Demo
              </button>
            </>
          )}

          {user && (
            <div style={{ position: "relative" }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <button
                data-hover="minimal"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 58,
                  padding: isMobile ? "10px 12px" : "10px 14px 10px 12px",
                  borderRadius: 18,
                  border: PANEL_BORDER,
                  background: "linear-gradient(180deg,rgba(255,255,255,0.04),rgba(14,25,41,0.98))",
                  color: TEXT_PRIMARY,
                  cursor: "pointer",
                  boxShadow: EDGE_RING,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
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
                    <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>{user.username}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, lineHeight: 1, color: ACCENT }}>{user.points || 0} pts</span>
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
                    width: 246,
                    borderRadius: 18,
                    background: "linear-gradient(180deg,rgba(22,35,56,0.98),rgba(14,25,41,0.98))",
                    boxShadow: SOFT_SHADOW,
                    overflow: "hidden",
                    border: "1px solid rgba(214,223,239,0.08)",
                  }}
                >
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(214,223,239,0.08)", background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY }}>{user.username}</div>
                    <div style={{ fontSize: 12, color: ACCENT, fontWeight: 800, marginTop: 4 }}>{user.points || 0} pts</div>
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
                        event.currentTarget.style.background = "rgba(255,255,255,0.07)";
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
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <div style={{ height: 1, background: "rgba(214,223,239,0.08)" }} />
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
                      fontWeight: 600,
                    }}
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
