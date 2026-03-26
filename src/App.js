import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import BgCanvas from "./components/BgCanvas";
import Navbar from "./components/Navbar";
import AuthModal from "./components/AuthModal";
import HomePage from "./components/HomePage";
import CalendarPage from "./components/CalendarPage";
import PublicPicksPage from "./components/PublicPicksPage";
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
import { ensureProfileForUser, profileFallbackFromAuthUser } from "./authProfile";
import { getUserAccentTheme } from "./constants/design";
import { pageToHref, readLocationState } from "./routing";

export default function StintApp() {
  const initialState = readLocationState();
  const [page, setPageState] = useState(initialState.page);
  const [pendingPredictionRace, setPendingPredictionRace] = useState(initialState.raceRound);
  const [authRedirect, setAuthRedirect] = useState(null);
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
    const handlePopState = () => {
      const nextState = readLocationState();
      setPageState(nextState.page);
      setPendingPredictionRace(nextState.raceRound);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const loadProfile = async (authUser) => {
    try {
      const profile = await ensureProfileForUser(authUser);
      setUser(profile || null);
    } catch {
      setUser(profileFallbackFromAuthUser(authUser));
    }
  };

  const openAuth = (mode, redirect = null) => {
    if (demoMode && !user) return;
    setAuthRedirect(redirect);
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

  const navigateToPage = (nextPage, options = {}) => {
    const { raceRound = null, replace = false } = options;
    const nextHref = pageToHref(nextPage, { demoMode, raceRound });
    const currentHref = `${window.location.pathname}${window.location.search}`;

    setPageState(nextPage);
    setPendingPredictionRace(nextPage === "predictions" ? raceRound : null);

    if (nextHref !== currentHref) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", nextHref);
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const openPredictionsForRace = (raceRound) => {
    navigateToPage("predictions", { raceRound: raceRound || null });
  };

  const accentTheme = getUserAccentTheme(user);

  return (
    <div
      style={{
        minHeight: "100vh",
        color: "var(--text)",
        fontFamily: "var(--font-body)",
        background: "transparent",
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
        <Navbar page={page} setPage={navigateToPage} user={user} openAuth={openAuth} onLogout={logout} demoMode={demoMode} exitDemo={exitDemo} />
        {authOpen && (
          <AuthModal
            mode={authMode}
            setMode={setAuthMode}
            onClose={() => {
              setAuthOpen(false);
              setAuthRedirect(null);
            }}
            onAuth={(profile) => {
              setUser(profile);
              setAuthOpen(false);
              const target = authRedirect;
              setAuthRedirect(null);
              if (target?.page) {
                navigateToPage(target.page, { raceRound: target.raceRound || null });
              }
            }}
          />
        )}
        <div key={page} className="stint-page-enter">
          {page === "home" && <HomePage user={user} setPage={navigateToPage} openAuth={openAuth} demoMode={demoMode} openPredictionsForRace={openPredictionsForRace} />}
          {page === "calendar" && <CalendarPage user={user} openAuth={openAuth} openPredictionsForRace={openPredictionsForRace} />}
          {page === "public-picks" && (
            <PublicPicksPage
              user={user}
              demoMode={demoMode}
              openAuth={openAuth}
              openPredictionsForRace={openPredictionsForRace}
              setPage={navigateToPage}
            />
          )}
          {page === "predictions" && <PredictionsPage user={user} openAuth={openAuth} demoMode={demoMode} initialRaceRound={pendingPredictionRace} onInitialRaceConsumed={() => setPendingPredictionRace(null)} />}
          {page === "ai-brief" && <NewsPage initialTab="ai" lockedTab="ai" />}
          {page === "news" && <NewsPage initialTab="news" lockedTab="news" />}
          {page === "standings" && <StandingsPage user={user} />}
          {page === "community" && <CommunityPage user={user} openAuth={openAuth} demoMode={demoMode} />}
          {page === "admin" && <AdminPage user={user} />}
          {page === "profile" && <ProfilePage user={user} setUser={setUser} />}
          {page === "game-guide" && <GameGuidePage setPage={navigateToPage} />}
          {page === "support" && <SupportPage />}
          {page === "terms" && <TermsPage />}
          {page === "privacy" && <PrivacyPage />}
        </div>
        <LegalFooter setPage={navigateToPage} />
      </div>
    </div>
  );
}
