import { useState } from "react";
import { supabase } from "../supabase";

export default function AuthModal({ mode, setMode, onClose, onAuth }) {
  const [f, setF] = useState({ username: "", email: "", pass: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 8, color: "#fff", padding: "11px 14px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" };
  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 6 };

  const submit = async () => {
    if (!f.email || !f.pass) { setErr("Fill all fields."); return; }
    if (mode === "register" && !f.username) { setErr("Enter a username."); return; }
    setLoading(true); setErr("");
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: f.email, password: f.pass,
          options: { data: { username: f.username } }
        });
        if (error) { setErr(error.message); setLoading(false); return; }
        if (data.user) {
          await supabase.from("profiles").upsert({ id: data.user.id, username: f.username, points: 0 });
          onAuth({ id: data.user.id, username: f.username, points: 0 });
          onClose();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.pass });
        if (error) { setErr(error.message); setLoading(false); return; }
        if (data.user) {
          const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
          onAuth(profile || { id: data.user.id, username: f.email, points: 0 });
          onClose();
        }
      }
    } catch (e) { setErr("Something went wrong."); }
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "rgba(10,10,28,0.98)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 16, padding: 32, width: 380, backdropFilter: "blur(20px)" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 44, height: 4, background: "linear-gradient(90deg,#E8002D,#FF6B35)", borderRadius: 2, marginBottom: 20 }} />
        <h2 style={{ margin: "0 0 4px", fontWeight: 900, fontSize: 22 }}>{mode === "login" ? "Welcome back" : "Join Apex Fantasy"}</h2>
        <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.38)", fontSize: 13 }}>{mode === "login" ? "Sign in to your account" : "Free forever."}</p>
        {mode === "register" && (
          <>
            <label style={lbl}>Username</label>
            <input style={{ ...inp, marginBottom: 14 }} placeholder="YourUsername" value={f.username} onChange={e => upd("username", e.target.value)} />
          </>
        )}
        <label style={lbl}>Email</label>
        <input style={{ ...inp, marginBottom: 14 }} type="email" placeholder="you@email.com" value={f.email} onChange={e => upd("email", e.target.value)} />
        <label style={lbl}>Password</label>
        <input style={{ ...inp, marginBottom: 20 }} type="password" placeholder="••••••••" value={f.pass} onChange={e => upd("pass", e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
        {err && <p style={{ color: "#F87171", fontSize: 12, margin: "0 0 14px" }}>{err}</p>}
        <button disabled={loading} onClick={submit} style={{ background: "linear-gradient(135deg,#E8002D,#FF6B35)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 700, width: "100%", padding: 13, fontSize: 14, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Please wait..." : (mode === "login" ? "Sign In" : "Create Account")}
        </button>
        <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          {mode === "login" ? "No account? " : "Have one? "}
          <span style={{ color: "#FF6B35", cursor: "pointer", fontWeight: 700 }} onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </span>
        </p>
      </div>
    </div>
  );
}
