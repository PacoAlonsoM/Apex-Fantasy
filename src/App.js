import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import BgCanvas from "./components/BgCanvas";
import Navbar from "./components/Navbar";
import AuthModal from "./components/AuthModal";
import HomePage from "./components/HomePage";
import CalendarPage from "./components/CalendarPage";
import PredictionsPage from "./components/PredictionsPage";
import StandingsPage from "./components/StandingsPage";
import CommunityPage from "./components/CommunityPage";

export default function ApexFantasy() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) loadProfile(session.user.id);
      else setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (id) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (data) setUser(data);
  };

  const openAuth = m => { setAuthMode(m || "login"); setAuthOpen(true); };
  const logout = async () => { await supabase.auth.signOut(); setUser(null); };

  return (
    <div style={{ background: "#08081A", minHeight: "100vh", color: "#fff", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:rgba(232,0,45,0.28);border-radius:2px;}input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.16);}button:hover{opacity:0.84;}textarea{font-family:inherit;}`}</style>
      <BgCanvas />
      <div style={{ position: "relative", zIndex: 1 }}>
        <Navbar page={page} setPage={setPage} user={user} openAuth={openAuth} onLogout={logout} />
        {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => setAuthOpen(false)} onAuth={(profile) => { setUser(profile); setAuthOpen(false); }} />}
        {page === "home" && <HomePage user={user} setPage={setPage} openAuth={openAuth} />}
        {page === "calendar" && <CalendarPage />}
        {page === "predictions" && <PredictionsPage user={user} openAuth={openAuth} />}
        {page === "standings" && <StandingsPage />}
        {page === "community" && <CommunityPage user={user} openAuth={openAuth} />}
      </div>
    </div>
  );
}