import { useRef, useState } from "react";
import {
  ACCENT,
  ACCENT_GLOW,
  EASE_OUT_EXPO,
  ERROR_TEXT,
  SHELL_MAX,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  isAdminUser,
  rgbaFromHex,
} from "@/src/constants/design";
import { isWcPage, pageToHref } from "@/src/shell/routing";
import BrandLockup from "@/src/ui/BrandLockup";
import IdentityAvatar from "@/src/ui/IdentityAvatar";
import ThemeToggle from "@/src/ui/ThemeToggle";
import useViewport from "@/src/lib/useViewport";
import { withViewTransition } from "@/src/lib/viewTransition";

const TAB_ACTIVE_BG     = rgbaFromHex(ACCENT, 0.12);
const TAB_ACTIVE_BORDER = rgbaFromHex(ACCENT, 0.30);
const TAB_HOVER_BG      = "var(--nav-tab-hover-bg)";
const NAV_BG            = "var(--nav-bg)";
const NAV_HAIRLINE      = "var(--nav-hairline)";
const USER_PILL_BG      = "var(--nav-pill-bg)";
const DROPDOWN_BG       = "var(--nav-dropdown-bg)";

export default function Navbar({ page, setPage, user, openAuth, onLogout, demoMode = false, exitDemo }) {
  const [dropOpen, setDropOpen]       = useState(false);
  const [hoveredTab, setHoveredTab]   = useState(null);
  const timeout                       = useRef(null);
  const { isMobile, isTablet }        = useViewport();
  // WC integration point: nav changes only when the active page id is wc-*.
  const wcMode = isWcPage(page);
  const navAccent = wcMode ? "#D6A545" : ACCENT;
  const navGlow = wcMode ? "rgba(214,165,69,0.22)" : ACCENT_GLOW;
  const tabActiveBg = wcMode ? "rgba(214,165,69,0.16)" : TAB_ACTIVE_BG;
  const tabActiveBorder = wcMode ? "rgba(214,165,69,0.34)" : TAB_ACTIVE_BORDER;
  const tabHoverBg = wcMode ? "rgba(247,241,221,0.07)" : TAB_HOVER_BG;
  const navBackground = wcMode ? "rgba(3,18,10,0.82)" : NAV_BG;
  const navHairline = wcMode ? "rgba(247,241,221,0.12)" : NAV_HAIRLINE;
  const userPillBg = wcMode ? "rgba(7,32,19,0.78)" : USER_PILL_BG;
  const dropdownBg = wcMode ? "rgba(5,24,15,0.96)" : DROPDOWN_BG;

  // Picks first — the product's primary verb. Everything else is supporting.
  const f1Tabs = [
    ["predictions", "Picks"],
    ["calendar",    "Calendar"],
    ["ai-brief",    "AI Insight"],
    ["news",        "Wire"],
    ["community",   "Leagues"],
    ["grid",        "Grid"],
    ...(user ? [["profile", "Profile"]] : []),
  ];
  const wcTabs = [
    ["wc-fixtures", "Home"],
    ["wc-picks", "Predict"],
    ["wc-survivor", "Survivor"],
    ["wc-bracket", "Bracket"],
    ["wc-leagues", "Leagues"],
    ...(user ? [["wc-profile", "Profile"]] : []),
  ];
  const tabs = wcMode ? wcTabs : f1Tabs;

  const admin        = isAdminUser(user);
  const picksTarget  = user || demoMode ? "predictions" : "public-picks";
  const menuItems    = admin
    ? [["Game Guide", "game-guide"], ["Contact Support", "support"], [wcMode ? "WC Admin" : "Admin", wcMode ? "wc-admin" : "admin"]]
    : [["Game Guide", "game-guide"], ["Contact Support", "support"]];

  const handleMouseEnter = () => {
    clearTimeout(timeout.current);
    setDropOpen(true);
  };

  const handleMouseLeave = () => {
    timeout.current = setTimeout(() => setDropOpen(false), 140);
  };

  const ctaLabel  = user ? (wcMode ? "Open WC picks" : "Open picks") : "Create account";
  const ctaAction = () => {
    if (user) {
      setPage(wcMode ? "wc-picks" : "predictions");
      return;
    }
    openAuth("register", { page: wcMode ? "wc-picks" : "predictions" });
  };

  return (
    <nav
      style={{
        position:             "sticky",
        top:                  0,
        zIndex:               100,
        background:           navBackground,
        backdropFilter:       "saturate(1.2) blur(18px)",
        WebkitBackdropFilter: "saturate(1.2) blur(18px)",
        borderBottom:         `1px solid ${navHairline}`,
      }}
    >
      <style>{`
        /* Navbar tab motion — ease-out-expo curve, transform-only press.
           The active pill carries a shared viewTransitionName so it morphs
           between tabs when the browser supports the View Transitions API. */
        .nv-tab {
          transition: background 240ms ${EASE_OUT_EXPO},
                      color      240ms ${EASE_OUT_EXPO},
                      border-color 240ms ${EASE_OUT_EXPO},
                      transform  140ms ${EASE_OUT_EXPO},
                      box-shadow 180ms ${EASE_OUT_EXPO};
          will-change: transform;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .nv-tab:active { transform: scale(0.965); }
        /* Keyboard focus — a soft inset ring that respects the active state
           without overriding the canonical pill. */
        .nv-tab:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(255,106,26,0.35);
        }

        /* Hide the horizontal-scroll track on the tabs row for tablet widths —
           content overflows visually without a chrome scrollbar. */
        .nv-tab-scroller::-webkit-scrollbar { display: none; }
        .nv-tab-scroller { scrollbar-width: none; -ms-overflow-style: none; }

        .nv-user-pill {
          transition: background 200ms ${EASE_OUT_EXPO},
                      border-color 200ms ${EASE_OUT_EXPO},
                      transform  140ms ${EASE_OUT_EXPO};
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .nv-user-pill:active { transform: scale(0.97); }
        .nv-user-pill:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(255,106,26,0.35);
        }
        @media (hover: hover) and (pointer: fine) {
          .nv-user-pill:hover {
            background: var(--nav-pill-hover-bg);
            border-color: var(--nav-pill-hover-border);
          }
        }
        .nv-menu-item:focus-visible {
          outline: none;
          background: var(--nav-menu-hover-bg);
        }

        .nv-menu-item {
          transition: background 160ms ${EASE_OUT_EXPO},
                      color      160ms ${EASE_OUT_EXPO};
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        /* Shared view-transition for the active pill — the browser snapshots the
           old pill and animates it to the new pill's position on tab change. */
        ::view-transition-old(navbar-pill),
        ::view-transition-new(navbar-pill) {
          animation-duration: 280ms;
          animation-timing-function: ${EASE_OUT_EXPO};
        }

        /* Scope the pill morph so it doesn't trigger a whole-page cross-fade —
           the page content swap is handled by React's keyed .stint-page-enter. */
        [data-vt-name="navbar-pill"]::view-transition-old(root),
        [data-vt-name="navbar-pill"]::view-transition-new(root) {
          animation: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .nv-tab, .nv-user-pill, .nv-menu-item { transition: none !important; }
          ::view-transition-old(navbar-pill),
          ::view-transition-new(navbar-pill) { animation: none !important; }
        }
      `}</style>
      <div
        style={{
          maxWidth:            SHELL_MAX,
          margin:              "0 auto",
          padding:             isMobile ? "8px 16px 10px" : "10px 24px 12px",
          display:             "grid",
          // Desktop: three equal side columns with an auto middle.
          // The tabs sit in the auto-width centre column so they align to the
          // viewport's optical centre — not to the midpoint between a narrow
          // logo and a wider user pill, which was shifting the bar right.
          gridTemplateColumns: isTablet ? "1fr auto" : "minmax(0,1fr) auto minmax(0,1fr)",
          gap:                 isMobile ? 12 : 20,
          alignItems:          "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: isMobile ? "wrap" : "nowrap", justifySelf: "start" }}>
          <a
            href={pageToHref(wcMode ? "wc-fixtures" : "home", { demoMode })}
            onClick={(event) => {
              event.preventDefault();
              setPage(wcMode ? "wc-fixtures" : "home");
            }}
            data-hover="minimal"
            style={{
              display:        "inline-flex",
              alignItems:     "center",
              color:          TEXT_PRIMARY,
              textDecoration: "none",
            }}
          >
            <BrandLockup mobile={isMobile} descriptor={false} />
          </a>

          <div
            aria-label="Sport switch"
            role="tablist"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: 3,
              borderRadius: 999,
              background: wcMode ? "rgba(247,241,221,0.06)" : "var(--nav-pill-bg)",
              border: `1px solid ${navHairline}`,
            }}
          >
            {[
              ["home", "F1"],
              ["wc-fixtures", "WC"],
            ].map(([target, label]) => {
              const active = target === "wc-fixtures" ? wcMode : !wcMode;
              return (
                <a
                  key={target}
                  href={pageToHref(target, { demoMode })}
                  role="tab"
                  aria-selected={active}
                  data-hover="minimal"
                  onClick={(event) => {
                    event.preventDefault();
                    if (active) return;
                    withViewTransition(() => setPage(target), { name: "navbar-pill" });
                  }}
                  style={{
                    minHeight: 28,
                    minWidth: 38,
                    padding: "0 9px",
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: active ? (wcMode ? "#1D1405" : ACCENT) : TEXT_SECONDARY,
                    background: active
                      ? wcMode
                        ? "linear-gradient(135deg,#D6A545,#F7D36B)"
                        : TAB_ACTIVE_BG
                      : "transparent",
                    border: active ? `1px solid ${tabActiveBorder}` : "1px solid transparent",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>

        <div
          className="nv-tab-scroller"
          style={{
            // Tablet: the scroller spans the full row below the logo/user row.
            // Desktop: the tabs hug the centre column and the 1fr rails on
            // either side push the logo to the far left and the user to the
            // far right, leaving the tab row centred on the viewport.
            justifySelf:    isTablet ? "stretch" : "center",
            gridColumn:     isTablet ? "1 / -1" : "auto",
            order:          isTablet ? 3 : undefined,
            overflowX:      "auto",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            maxWidth:       "100%",
          }}
        >
          <div
            style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          2,
              minHeight:    44,
              minWidth:     isTablet ? "max-content" : "auto",
              padding:      "2px 4px",
            }}
          >
            {tabs.map(([id, label]) => {
              const actualId = !wcMode && id === "predictions" ? picksTarget : id;
              const active   = !wcMode && id === "predictions"
                ? page === "predictions" || page === "public-picks"
                : page === id;
              const hovered  = hoveredTab === id;
              return (
                <a
                  key={id}
                  href={pageToHref(actualId, { demoMode })}
                  data-navbar-tab="true"
                  className="nv-tab"
                  onClick={(event) => {
                    event.preventDefault();
                    if (event.detail > 0) event.currentTarget.blur();
                    if (active) return;
                    withViewTransition(() => setPage(actualId), { name: "navbar-pill" });
                  }}
                  onMouseEnter={() => !active && setHoveredTab(id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  data-hover="minimal"
                  style={{
                    display:            "inline-flex",
                    alignItems:         "center",
                    justifyContent:     "center",
                    minHeight:          36,
                    padding:            isMobile ? "0 12px" : "0 14px",
                    borderRadius:       999,
                    background:         active ? tabActiveBg : hovered ? tabHoverBg : "transparent",
                    color:              active ? navAccent : hovered ? TEXT_PRIMARY : TEXT_SECONDARY,
                    fontSize:           13,
                    fontWeight:         700,
                    letterSpacing:      "-0.005em",
                    whiteSpace:         "nowrap",
                    textDecoration:     "none",
                    border:             `1px solid ${active ? tabActiveBorder : "transparent"}`,
                    viewTransitionName: active ? "navbar-pill" : undefined,
                  }}
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>

        <div style={{ justifySelf: "end", display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap" }}>
          <ThemeToggle size={isMobile ? 34 : 36} />

          {!user && !demoMode && !isMobile && (
            <button
              onClick={() => openAuth("login", { page: wcMode ? "wc-picks" : "predictions" })}
              className="stint-button-secondary"
              style={{ minHeight: 40, padding: "0 16px", fontSize: 13 }}
            >
              Log in
            </button>
          )}

          {!user && !demoMode && (
            <button
              onClick={ctaAction}
              className="stint-button"
              style={{
                minHeight: 40,
                padding:   isMobile ? "0 14px" : "0 18px",
                fontSize:  13,
                boxShadow: `0 10px 22px ${navGlow}`,
              }}
            >
              {ctaLabel}
            </button>
          )}

          {demoMode && !user && (
            <>
              <div
                style={{
                  minHeight:       40,
                  padding:         "0 12px",
                  borderRadius:    999,
                  border:          "1px solid rgba(214,223,239,0.10)",
                  background:      "transparent",
                  color:           SUBTLE_TEXT,
                  display:         "inline-flex",
                  alignItems:      "center",
                  fontSize:        10,
                  fontWeight:      800,
                  letterSpacing:   "0.14em",
                  textTransform:   "uppercase",
                }}
              >
                Demo
              </div>
              <button
                onClick={exitDemo}
                className="stint-button-secondary"
                style={{ minHeight: 40, padding: "0 14px", fontSize: 13 }}
              >
                Exit
              </button>
            </>
          )}

          {user && (
            <div style={{ position: "relative" }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <button
                data-hover="minimal"
                className="nv-user-pill"
                onClick={() => setDropOpen((v) => !v)}
                style={{
                  display:        "inline-flex",
                  alignItems:     "center",
                  gap:            8,
                  minHeight:      40,
                  padding:        "3px 10px 3px 3px",
                  borderRadius:   999,
                  border:         `1px solid ${navHairline}`,
                  background:     userPillBg,
                  color:          TEXT_PRIMARY,
                  cursor:         "pointer",
                  willChange:     "transform",
                }}
              >
                <IdentityAvatar
                  username={user.username}
                  colorKey={user.avatar_color}
                  size={32}
                  pro={user?.subscription_status === "pro"}
                />
                <svg
                  width="9"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                  style={{
                    transform:  dropOpen ? "rotate(180deg)" : "none",
                    transition: "transform 180ms ease",
                    opacity:    0.7,
                  }}
                >
                  <path d="M1 1l4 4 4-4" stroke={TEXT_SECONDARY} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {dropOpen && (
                <div
                  style={{
                    position:             "absolute",
                    top:                  "calc(100% + 10px)",
                    right:                0,
                    width:                248,
                    borderRadius:         14,
                    background:           dropdownBg,
                    backdropFilter:       "saturate(1.2) blur(16px)",
                    WebkitBackdropFilter: "saturate(1.2) blur(16px)",
                    boxShadow:            "0 14px 34px rgba(0,0,0,0.32)",
                    overflow:             "hidden",
                    border:               `1px solid ${navHairline}`,
                  }}
                >
                  <div style={{ padding: "14px 16px", borderBottom: `1px solid ${navHairline}` }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.01em" }}>
                      {user.username}
                    </div>
                    <div style={{
                      fontSize:      11,
                      fontWeight:    700,
                      color:         SUBTLE_TEXT,
                      marginTop:     3,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {user.points || 0} pts
                    </div>
                  </div>
                  {menuItems.map(([label, target]) => (
                    <button
                      key={target}
                      data-hover="minimal"
                      className="nv-menu-item"
                      onClick={() => {
                        setPage(target);
                        setDropOpen(false);
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = "var(--nav-menu-item-hover-bg)";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = "transparent";
                      }}
                      style={{
                        width:      "100%",
                        border:     "none",
                        background: "transparent",
                        color:      TEXT_PRIMARY,
                        cursor:     "pointer",
                        textAlign:  "left",
                        padding:    "12px 16px",
                        fontSize:   13,
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    data-hover="minimal"
                    onClick={() => { setPage("pro"); setDropOpen(false); }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = rgbaFromHex(navAccent, 0.08);
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "transparent";
                    }}
                    style={{
                      width:        "100%",
                      border:       "none",
                      borderTop:    `1px solid ${navHairline}`,
                      borderBottom: `1px solid ${navHairline}`,
                      background:   "transparent",
                      color: "var(--brand)",
                      cursor:       "pointer",
                      textAlign:    "left",
                      padding:      "12px 16px",
                      fontSize:     13,
                      fontWeight:   800,
                      letterSpacing: "-0.005em",
                      display:      "flex",
                      alignItems:   "center",
                      justifyContent: "space-between",
                      gap:          12,
                    }}
                  >
                    <span>{user?.subscription_status === "pro" ? "Manage Pro" : "Upgrade to Pro"}</span>
                    {user?.subscription_status === "pro" && (
                      <span style={{
                        fontSize:      10,
                        fontWeight:    900,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--brand)",
                        opacity:       0.85,
                      }}>
                        Active
                      </span>
                    )}
                  </button>
                  <button
                    data-hover="minimal"
                    onClick={() => {
                      onLogout();
                      setDropOpen(false);
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "rgba(239,68,68,0.06)";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "transparent";
                    }}
                    style={{
                      width:      "100%",
                      border:     "none",
                      background: "transparent",
                      color:      ERROR_TEXT,
                      cursor:     "pointer",
                      textAlign:  "left",
                      padding:    "12px 16px",
                      fontSize:   13,
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
