import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import BgCanvas from "./components/BgCanvas";
import Navbar from "./components/Navbar";
import AuthModal from "./components/AuthModal";
import HomePage from "./components/HomePage";
import CalendarPage from "./components/CalendarPage";
import PredictionsPage from "./components/PredictionsPage";
import NewsPage from "./components/NewsPage";
import StandingsPage from "./components/StandingsPage";
import CommunityPage from "./components/CommunityPage";
import AdminPage from "./components/AdminPage";
import ProfilePage from "./components/ProfilePage";
import GameGuidePage from "./components/GameGuidePage";
import SupportPage from "./components/SupportPage";
import TermsPage from "./components/TermsPage";
import PrivacyPage from "./components/PrivacyPage";
import LegalFooter from "./components/LegalFooter";
import { ensureProfileForUser } from "./authProfile";
import { BG_BASE, BG_SURFACE, getUserAccentTheme } from "./constants/design";

const PAGE_KEYS = new Set([
  "home",
  "calendar",
  "predictions",
  "ai-brief",
  "news",
  "standings",
  "community",
  "admin",
  "profile",
  "game-guide",
  "support",
  "terms",
  "privacy",
]);

function readDemoState() {
  const params = new URLSearchParams(window.location.search);
  const demoMode = params.get("demo") === "1";
  const requestedPage = params.get("page");

  return {
    demoMode,
    page: requestedPage && PAGE_KEYS.has(requestedPage) ? requestedPage : "home",
  };
}

export default function StintApp() {
  const initialState = readDemoState();
  const [page, setPage] = useState(initialState.page);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [demoMode] = useState(initialState.demoMode);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset");
        setAuthOpen(true);
      }
      if (session?.user) loadProfile(session.user);
      else if (event !== "PASSWORD_RECOVERY") setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!demoMode) return;
    const url = new URL(window.location.href);
    url.searchParams.set("demo", "1");
    url.searchParams.set("page", page);
    window.history.replaceState({}, "", url.toString());
  }, [demoMode, page]);

  const loadProfile = async (authUser) => {
    try {
      const profile = await ensureProfileForUser(authUser);
      if (profile) setUser(profile);
    } catch (error) {
      console.error("loadProfile error:", error);
      setUser(null);
    }
  };

  const openAuth = (mode) => {
    if (demoMode && !user) return;
    setAuthMode(mode || "login");
    setAuthOpen(true);
  };

  const exitDemo = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("demo");
    url.searchParams.delete("page");
    window.location.href = url.toString();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const accentTheme = getUserAccentTheme(user);

  return (
    <div
      style={{
        minHeight: "100vh",
        color: "var(--text)",
        fontFamily: "var(--font-body)",
        background: `radial-gradient(circle at 12% 5%, rgba(249,115,22,0.07), transparent 18%), radial-gradient(circle at 86% 12%, rgba(255,255,255,0.03), transparent 18%), linear-gradient(180deg, ${BG_BASE} 0%, ${BG_BASE} 40%, ${BG_SURFACE} 100%)`,
        "--team-accent": accentTheme.accent,
        "--team-accent-soft": accentTheme.accentSoft,
        "--team-accent-ghost": accentTheme.accentGhost,
        "--team-accent-border": accentTheme.accentBorder,
        "--team-accent-text": accentTheme.text,
        "--interactive-edge": accentTheme.accentBorder,
      }}
    >
      <style>{`textarea{font-family:inherit;} h1,h2,h3,h4{font-family:var(--font-display);} section,aside,main{animation:apex-rise-in 420ms cubic-bezier(0.22,1,0.36,1);} `}</style>
      <BgCanvas />
      <div style={{ position: "relative", zIndex: 1 }}>
        <Navbar page={page} setPage={setPage} user={user} openAuth={openAuth} onLogout={logout} demoMode={demoMode} exitDemo={exitDemo} />
        {authOpen && (
          <AuthModal
            mode={authMode}
            setMode={setAuthMode}
            onClose={() => setAuthOpen(false)}
            onAuth={(profile) => {
              setUser(profile);
              setAuthOpen(false);
            }}
          />
        )}
        {page === "home" && <HomePage user={user} setPage={setPage} openAuth={openAuth} demoMode={demoMode} />}
        {page === "calendar" && <CalendarPage user={user} />}
        {page === "predictions" && <PredictionsPage user={user} openAuth={openAuth} demoMode={demoMode} />}
        {page === "ai-brief" && <NewsPage initialTab="ai" lockedTab="ai" />}
        {page === "news" && <NewsPage initialTab="news" lockedTab="news" />}
        {page === "standings" && <StandingsPage user={user} />}
        {page === "community" && <CommunityPage user={user} openAuth={openAuth} demoMode={demoMode} />}
        {page === "admin" && <AdminPage user={user} />}
        {page === "profile" && <ProfilePage user={user} setUser={setUser} />}
        {page === "game-guide" && <GameGuidePage setPage={setPage} />}
        {page === "support" && <SupportPage />}
        {page === "terms" && <TermsPage />}
        {page === "privacy" && <PrivacyPage />}
        <LegalFooter setPage={setPage} />
      </div>
    </div>
  );
}
