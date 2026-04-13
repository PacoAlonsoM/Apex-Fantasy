import { useState, useEffect } from "react";
import { supabase } from "@/src/lib/supabase";
import BgCanvas from "@/src/ui/BgCanvas";
import Navbar from "@/src/shell/Navbar";
import AuthModal from "@/src/shell/AuthModal";
import AuthOnboardingModal from "@/src/shell/AuthOnboardingModal";
import HomePage from "@/src/features/home/HomePage";
import CalendarPage from "@/src/features/calendar/CalendarPage";
import PublicPicksPage from "@/src/features/picks/PublicPicksPage";
import PredictionsPage from "@/src/features/picks/PredictionsPage";
import NewsPage from "@/src/features/insight/NewsPage";
import StandingsPage from "@/src/features/standings/StandingsPage";
import CommunityPage from "@/src/features/community/CommunityPage";
import GridPage from "@/src/features/community/GridPage";
import AdminPage from "@/src/features/admin/AdminPage";
import ProfilePage from "@/src/features/profile/ProfilePage";
import GameGuidePage from "@/src/features/game-guide/GameGuidePage";
import SupportPage from "@/src/features/support/SupportPage";
import TermsPage from "@/src/features/legal/TermsPage";
import PrivacyPage from "@/src/features/legal/PrivacyPage";
import ProPage from "@/src/features/pro/ProPage";
import ProSuccessPage from "@/src/features/pro/ProSuccessPage";
import LegalFooter from "@/src/ui/LegalFooter";
import { consumePendingOAuthProfile, ensureProfileForUser, needsProfileOnboarding, profileFallbackFromAuthUser, requireActiveSession } from "@/src/shell/authProfile";
import { getUserAccentTheme } from "@/src/constants/design";
import { syncLocalAdminSession } from "@/src/lib/adminSession";
import { pageToHref, readLocationState } from "@/src/shell/routing";

export default function StintApp() {
  const initialState = readLocationState();
  const [page, setPageState] = useState(initialState.page);
  const [pendingPredictionRace, setPendingPredictionRace] = useState(initialState.raceRound);
  const [authRedirect, setAuthRedirect] = useState(null);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingUser, setOnboardingUser] = useState(null);
  const [demoMode] = useState(initialState.demoMode);

  useEffect(() => {
    let ignore = false;

    requireActiveSession()
      .then((session) => {
        if (ignore) return;
        if (session?.user) {
          syncLocalAdminSession(session.access_token || "");
          loadProfile(session.user);
          return;
        }
        syncLocalAdminSession("");
        setUser(null);
        setOnboardingOpen(false);
        setOnboardingUser(null);
      })
      .catch(() => {
        if (ignore) return;
        syncLocalAdminSession("");
        setUser(null);
        setOnboardingOpen(false);
        setOnboardingUser(null);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset");
        setAuthOpen(true);
      }
      if (session?.user) {
        syncLocalAdminSession(session.access_token || "");
        loadProfile(session.user);
      } else {
        syncLocalAdminSession("");
        if (event !== "PASSWORD_RECOVERY") setUser(null);
      }
    });
    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
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
    const applyResolvedUser = (resolvedUser) => {
      setUser(resolvedUser || null);

      if (needsProfileOnboarding(resolvedUser)) {
        setOnboardingUser(resolvedUser);
        setOnboardingOpen(true);
        return true;
      }

      setOnboardingUser(null);
      setOnboardingOpen(false);
      return false;
    };

    try {
      const pendingOAuthProfile = consumePendingOAuthProfile();
      const profile = await ensureProfileForUser(authUser, pendingOAuthProfile);
      applyResolvedUser(profile || null);
    } catch {
      applyResolvedUser(profileFallbackFromAuthUser(authUser));
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
    syncLocalAdminSession("");
    setUser(null);
    setOnboardingOpen(false);
    setOnboardingUser(null);
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
            redirectTarget={authRedirect}
            demoMode={demoMode}
            onClose={() => {
              setAuthOpen(false);
              setAuthRedirect(null);
            }}
            onAuth={(profile) => {
              setUser(profile);
              if (needsProfileOnboarding(profile)) {
                setOnboardingUser(profile);
                setOnboardingOpen(true);
              } else {
                setOnboardingUser(null);
                setOnboardingOpen(false);
              }
              setAuthOpen(false);
              const target = authRedirect;
              setAuthRedirect(null);
              if (target?.page) {
                navigateToPage(target.page, { raceRound: target.raceRound || null });
              }
            }}
          />
        )}
        {onboardingOpen && onboardingUser && (
          <AuthOnboardingModal
            user={onboardingUser}
            onComplete={(profile) => {
              setUser(profile);
              setOnboardingUser(null);
              setOnboardingOpen(false);
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
          {page === "ai-brief" && <NewsPage initialTab="ai" lockedTab="ai" user={user} />}
          {page === "news" && <NewsPage initialTab="news" lockedTab="news" user={user} />}
          {page === "standings" && <StandingsPage user={user} />}
          {page === "community" && <CommunityPage user={user} openAuth={openAuth} demoMode={demoMode} setPage={navigateToPage} />}
          {page === "grid" && <GridPage user={user} openAuth={openAuth} demoMode={demoMode} />}
          {page === "admin" && <AdminPage user={user} />}
          {page === "profile" && <ProfilePage user={user} setUser={setUser} />}
          {page === "game-guide" && <GameGuidePage setPage={navigateToPage} />}
          {page === "support" && <SupportPage />}
          {page === "terms" && <TermsPage />}
          {page === "privacy" && <PrivacyPage />}
          {page === "pro" && <ProPage user={user} setPage={navigateToPage} />}
          {page === "pro_success" && <ProSuccessPage user={user} />}
        </div>
        <LegalFooter setPage={navigateToPage} />
      </div>
    </div>
  );
}
