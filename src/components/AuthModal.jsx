import { useState } from "react";
import { supabase } from "../supabase";
import { ensureProfileForUser, isUsernameTaken, sanitizeUsername } from "../authProfile";
import { EDGE_RING, MUTED_TEXT, PANEL_BG, PANEL_BG_ALT, PANEL_BG_STRONG, PANEL_BORDER, SOFT_SHADOW, SUBTLE_TEXT, TEAM_AVATAR_OPTIONS, teamSupportKey } from "../constants/design";
import BrandLockup from "./BrandLockup";
import useViewport from "../useViewport";

export default function AuthModal({ mode, setMode, onClose, onAuth }) {
  const { isMobile, isTablet } = useViewport();
  const [f, setF] = useState({
    username: "",
    email: "",
    pass: "",
    confirm: "",
    favoriteTeam: TEAM_AVATAR_OPTIONS[0]?.team || "",
  });
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [shaking, setShaking] = useState(false);

  const upd = (k, v) => {
    setIsDirty(true);
    setF((current) => ({ ...current, [k]: v }));
  };

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 350);
  };

  const handleBackdropClick = () => {
    if (isDirty) {
      triggerShake();
    } else {
      onClose();
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setErr("");
    setNote("");
    setIsDirty(false);
  };

  const inputStyle = {
    background: PANEL_BG_ALT,
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: 12,
    color: "#fff",
    padding: "11px 14px",
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const labelStyle = {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: SUBTLE_TEXT,
    display: "block",
    marginBottom: 6,
  };

  const submit = async () => {
    setLoading(true);
    setErr("");
    setNote("");

    try {
      if (mode === "forgot") {
        if (!f.email) {
          setErr("Enter your email.");
          triggerShake();
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(f.email, {
          redirectTo: window.location.origin,
        });
        if (error) {
          setErr(error.message);
          triggerShake();
          setLoading(false);
          return;
        }

        setNote("Password reset email sent. Open the link in your inbox to choose a new password.");
        setLoading(false);
        return;
      }

      if (mode === "reset") {
        if (!f.pass || !f.confirm) {
          setErr("Enter and confirm your new password.");
          triggerShake();
          setLoading(false);
          return;
        }
        if (f.pass.length < 6) {
          setErr("Password must be at least 6 characters.");
          triggerShake();
          setLoading(false);
          return;
        }
        if (f.pass !== f.confirm) {
          setErr("Passwords do not match.");
          triggerShake();
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.updateUser({ password: f.pass });
        if (error) {
          setErr(error.message);
          triggerShake();
          setLoading(false);
          return;
        }

        if (data.user) {
          const profile = await ensureProfileForUser(data.user);
          if (profile) onAuth(profile);
        }

        setNote("Password updated.");
        setLoading(false);
        setTimeout(() => onClose(), 700);
        return;
      }

      if (!f.email || !f.pass) {
        setErr("Fill all fields.");
        triggerShake();
        setLoading(false);
        return;
      }

      if (mode === "register") {
        const username = sanitizeUsername(f.username);
        if (!username) {
          setErr("Enter a valid username.");
          triggerShake();
          setLoading(false);
          return;
        }

        const taken = await isUsernameTaken(username);
        if (taken) {
          setErr("That username is already taken.");
          triggerShake();
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: f.email,
          password: f.pass,
          options: {
            data: {
              username,
              avatar_color: teamSupportKey(f.favoriteTeam),
              favorite_team: f.favoriteTeam,
            },
          },
        });

        if (error) {
          setErr(error.message);
          triggerShake();
          setLoading(false);
          return;
        }

        if (data.user && data.session) {
          const profile = await ensureProfileForUser(data.user, {
            username,
            avatarColor: teamSupportKey(f.favoriteTeam),
            favoriteTeam: f.favoriteTeam,
          });
          onAuth(profile || { id: data.user.id, username, points: 0 });
          onClose();
          setLoading(false);
          return;
        }

        if (data.user && !data.session) {
          switchMode("login");
          setNote("Account created. Check your email to confirm it, then sign in.");
          setLoading(false);
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.pass });
        if (error) {
          setErr(error.message);
          triggerShake();
          setLoading(false);
          return;
        }

        if (data.user) {
          const profile = await ensureProfileForUser(data.user);
          onAuth(profile || { id: data.user.id, username: f.email, points: 0 });
          onClose();
        }
      }
    } catch (error) {
      setErr(error?.message || "Something went wrong.");
      triggerShake();
    }

    setLoading(false);
  };

  const title = mode === "register"
    ? "Create your account"
    : mode === "forgot"
      ? "Reset your password"
      : mode === "reset"
        ? "Set a new password"
        : "Welcome back";

  const subtitle = mode === "register"
    ? "Join Stint and start locking picks."
    : mode === "forgot"
      ? "We will send you a recovery link by email."
      : mode === "reset"
        ? "Choose a new password for your account."
        : "Sign in to save picks, join leagues and comment.";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(1,5,14,0.84)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={handleBackdropClick}>
      <div
        className={shaking ? "stint-shake" : undefined}
        style={{ background: PANEL_BG_STRONG, border: PANEL_BORDER, borderRadius: 26, width: 860, maxWidth: "100%", boxShadow: "0 40px 110px rgba(0,0,0,0.5)", overflow: "hidden", position: "relative" }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Explicit close button — always works regardless of dirty state */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: SUBTLE_TEXT, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4, zIndex: 10 }}
        >
          ×
        </button>

        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "0.88fr 1.12fr" }}>
          <div style={{ padding: "30px 28px", borderRight: isTablet ? "none" : "1px solid rgba(148,163,184,0.12)", borderBottom: isTablet ? "1px solid rgba(148,163,184,0.12)" : "none", background: "linear-gradient(180deg,rgba(255,255,255,0.02),rgba(10,18,32,0.96))" }}>
            <div style={{ marginBottom: 22 }}>
              <BrandLockup mobile={isMobile} compact descriptor={!isMobile} />
            </div>

            <h2 style={{ margin: "0 0 10px", fontWeight: 900, fontSize: isMobile ? 32 : 40, lineHeight: 0.96, letterSpacing: isMobile ? -1.2 : -1.6 }}>{title}</h2>
            <p style={{ margin: 0, color: MUTED_TEXT, fontSize: 14, lineHeight: 1.82, maxWidth: 300 }}>{subtitle}</p>

            <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
              {[
                ["Predictions", "Lock the full board before qualifying starts."],
                ["Leagues", "Compete privately without losing the global race."],
                ["AI Insight", "Use one long-form weekend read before you submit picks."],
              ].map(([label, copy]) => (
                <div key={label} style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG, padding: "14px 15px 13px", boxShadow: EDGE_RING }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>{label}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.72, color: MUTED_TEXT }}>{copy}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "30px 30px 26px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 16 }}>
              Account
            </div>

            {mode === "register" && (
              <>
                <label htmlFor="auth-username" style={labelStyle}>Username</label>
                <input id="auth-username" style={{ ...inputStyle, marginBottom: 14 }} placeholder="YourUsername" value={f.username} onChange={(event) => upd("username", event.target.value)} />
                <label htmlFor="auth-team" style={labelStyle}>Supported team</label>
                <select id="auth-team" style={{ ...inputStyle, marginBottom: 14, appearance: "none" }} value={f.favoriteTeam} onChange={(event) => upd("favoriteTeam", event.target.value)}>
                  {TEAM_AVATAR_OPTIONS.map((option) => (
                    <option key={option.key} value={option.team}>{option.label}</option>
                  ))}
                </select>
              </>
            )}

            {(mode === "login" || mode === "register" || mode === "forgot") && (
              <>
                <label htmlFor="auth-email" style={labelStyle}>Email</label>
                <input id="auth-email" style={{ ...inputStyle, marginBottom: 14 }} type="email" placeholder="you@email.com" value={f.email} onChange={(event) => upd("email", event.target.value)} />
              </>
            )}

            {(mode === "login" || mode === "register") && (
              <>
                <label htmlFor="auth-pass" style={labelStyle}>Password</label>
                <input id="auth-pass" style={{ ...inputStyle, marginBottom: 10 }} type="password" placeholder="••••••••" value={f.pass} onChange={(event) => upd("pass", event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} />
              </>
            )}

            {mode === "reset" && (
              <>
                <label htmlFor="auth-newpass" style={labelStyle}>New password</label>
                <input id="auth-newpass" style={{ ...inputStyle, marginBottom: 14 }} type="password" placeholder="••••••••" value={f.pass} onChange={(event) => upd("pass", event.target.value)} />
                <label htmlFor="auth-confirm" style={labelStyle}>Confirm password</label>
                <input id="auth-confirm" style={{ ...inputStyle, marginBottom: 10 }} type="password" placeholder="••••••••" value={f.confirm} onChange={(event) => upd("confirm", event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} />
              </>
            )}

            {mode === "login" && (
              <div style={{ textAlign: "right", marginBottom: 16 }}>
                <button onClick={() => switchMode("forgot")} style={{ background: "none", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}>
                  Forgot password?
                </button>
              </div>
            )}

            {mode === "forgot" && <div style={{ marginBottom: 16 }} />}

            {err && <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 14px" }}>{err}</p>}
            {note && <p style={{ color: "#67e8f9", fontSize: 12, margin: "0 0 14px" }}>{note}</p>}

            {isDirty && !err && (
              <p style={{ color: "rgba(214,223,239,0.48)", fontSize: 11, margin: "0 0 10px", letterSpacing: "0.04em" }}>
                Click × to dismiss without saving.
              </p>
            )}

            <button disabled={loading} onClick={submit} style={{ background: "linear-gradient(135deg,#f97316,#fb923c)", border: "none", borderRadius: 14, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 14, fontSize: 14, opacity: loading ? 0.6 : 1, boxShadow: SOFT_SHADOW }}>
              {loading
                ? "Please wait..."
                : mode === "register"
                  ? "Create Account"
                  : mode === "forgot"
                    ? "Send reset email"
                    : mode === "reset"
                      ? "Update password"
                      : "Sign In"}
            </button>

            {mode === "login" && (
              <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "rgba(226,232,240,0.46)" }}>
                No account?{" "}
                <span style={{ color: "#fb923c", cursor: "pointer", fontWeight: 700 }} onClick={() => switchMode("register")}>
                  Sign up
                </span>
              </p>
            )}

            {mode === "register" && (
              <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "rgba(226,232,240,0.46)" }}>
                Have one?{" "}
                <span style={{ color: "#fb923c", cursor: "pointer", fontWeight: 700 }} onClick={() => switchMode("login")}>
                  Sign in
                </span>
              </p>
            )}

            {mode === "forgot" && (
              <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "rgba(226,232,240,0.46)" }}>
                Back to{" "}
                <span style={{ color: "#fb923c", cursor: "pointer", fontWeight: 700 }} onClick={() => switchMode("login")}>
                  Sign in
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
