import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { ensureProfileForUser, isUsernameTaken, sanitizeUsername } from "../authProfile";
import { PANEL_BG_ALT, PANEL_BG_STRONG, PANEL_BORDER, SUBTLE_TEXT, TEAM_AVATAR_OPTIONS, teamSupportKey } from "../constants/design";
import { DRV } from "../constants/teams";
import BrandMark from "./BrandMark";

export default function AuthModal({ mode, setMode, onClose, onAuth }) {
  const [f, setF] = useState({
    username: "",
    email: "",
    pass: "",
    confirm: "",
    favoriteTeam: TEAM_AVATAR_OPTIONS[0]?.team || "",
    favoriteDriver: DRV[0]?.n || "",
  });
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const upd = (k, v) => setF((current) => ({ ...current, [k]: v }));
  const supportDrivers = useMemo(
    () => DRV.filter((driver) => driver.t === f.favoriteTeam),
    [f.favoriteTeam]
  );

  useEffect(() => {
    if (mode !== "register") return;
    if (!supportDrivers.find((driver) => driver.n === f.favoriteDriver)) {
      upd("favoriteDriver", supportDrivers[0]?.n || "");
    }
  }, [mode, supportDrivers, f.favoriteDriver]);

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
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(f.email, {
          redirectTo: window.location.origin,
        });
        if (error) {
          setErr(error.message);
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
          setLoading(false);
          return;
        }
        if (f.pass.length < 6) {
          setErr("Password must be at least 6 characters.");
          setLoading(false);
          return;
        }
        if (f.pass !== f.confirm) {
          setErr("Passwords do not match.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.updateUser({ password: f.pass });
        if (error) {
          setErr(error.message);
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
        setLoading(false);
        return;
      }

      if (mode === "register") {
        const username = sanitizeUsername(f.username);
        if (!username) {
          setErr("Enter a valid username.");
          setLoading(false);
          return;
        }

        const taken = await isUsernameTaken(username);
        if (taken) {
          setErr("That username is already taken.");
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
              favorite_driver: f.favoriteDriver,
            },
          },
        });

        if (error) {
          setErr(error.message);
          setLoading(false);
          return;
        }

        if (data.user && data.session) {
          const profile = await ensureProfileForUser(data.user, {
            username,
            avatarColor: teamSupportKey(f.favoriteTeam),
            favoriteTeam: f.favoriteTeam,
            favoriteDriver: f.favoriteDriver,
          });
          onAuth(profile || { id: data.user.id, username, points: 0 });
          onClose();
          setLoading(false);
          return;
        }

        if (data.user && !data.session) {
          setMode("login");
          setNote("Account created. Check your email to confirm it, then sign in.");
          setLoading(false);
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.pass });
        if (error) {
          setErr(error.message);
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
    ? "Join Apex Fantasy and start locking picks."
    : mode === "forgot"
      ? "We will send you a recovery link by email."
      : mode === "reset"
        ? "Choose a new password for your account."
        : "Sign in to save picks, join leagues and comment.";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(1,5,14,0.84)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: PANEL_BG_STRONG, border: PANEL_BORDER, borderRadius: 18, padding: 30, width: 390, boxShadow: "0 32px 80px rgba(0,0,0,0.42)" }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <BrandMark size={40} />
          <div>
            <h2 style={{ margin: "0 0 4px", fontWeight: 900, fontSize: 22 }}>{title}</h2>
            <p style={{ margin: 0, color: "rgba(226,232,240,0.62)", fontSize: 13 }}>{subtitle}</p>
          </div>
        </div>

        {mode === "register" && (
          <>
            <label style={labelStyle}>Username</label>
            <input style={{ ...inputStyle, marginBottom: 14 }} placeholder="YourUsername" value={f.username} onChange={(event) => upd("username", event.target.value)} />
            <label style={labelStyle}>Supported team</label>
            <select style={{ ...inputStyle, marginBottom: 14, appearance: "none" }} value={f.favoriteTeam} onChange={(event) => upd("favoriteTeam", event.target.value)}>
              {TEAM_AVATAR_OPTIONS.map((option) => (
                <option key={option.key} value={option.team}>{option.label}</option>
              ))}
            </select>
            <label style={labelStyle}>Supported driver</label>
            <select style={{ ...inputStyle, marginBottom: 14, appearance: "none" }} value={f.favoriteDriver} onChange={(event) => upd("favoriteDriver", event.target.value)}>
              {supportDrivers.map((driver) => (
                <option key={driver.n} value={driver.n}>{driver.n}</option>
              ))}
            </select>
          </>
        )}

        {(mode === "login" || mode === "register" || mode === "forgot") && (
          <>
            <label style={labelStyle}>Email</label>
            <input style={{ ...inputStyle, marginBottom: 14 }} type="email" placeholder="you@email.com" value={f.email} onChange={(event) => upd("email", event.target.value)} />
          </>
        )}

        {(mode === "login" || mode === "register") && (
          <>
            <label style={labelStyle}>Password</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} type="password" placeholder="••••••••" value={f.pass} onChange={(event) => upd("pass", event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} />
          </>
        )}

        {mode === "reset" && (
          <>
            <label style={labelStyle}>New password</label>
            <input style={{ ...inputStyle, marginBottom: 14 }} type="password" placeholder="••••••••" value={f.pass} onChange={(event) => upd("pass", event.target.value)} />
            <label style={labelStyle}>Confirm password</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} type="password" placeholder="••••••••" value={f.confirm} onChange={(event) => upd("confirm", event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} />
          </>
        )}

        {mode === "login" && (
          <div style={{ textAlign: "right", marginBottom: 16 }}>
            <button onClick={() => { setMode("forgot"); setErr(""); setNote(""); }} style={{ background: "none", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}>
              Forgot password?
            </button>
          </div>
        )}

        {mode === "forgot" && <div style={{ marginBottom: 16 }} />}

        {err && <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 14px" }}>{err}</p>}
        {note && <p style={{ color: "#67e8f9", fontSize: 12, margin: "0 0 14px" }}>{note}</p>}

        <button disabled={loading} onClick={submit} style={{ background: "linear-gradient(135deg,#f97316,#fb923c)", border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 13, fontSize: 14, opacity: loading ? 0.6 : 1 }}>
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
            <span style={{ color: "#fb923c", cursor: "pointer", fontWeight: 700 }} onClick={() => { setMode("register"); setErr(""); setNote(""); }}>
              Sign up
            </span>
          </p>
        )}

        {mode === "register" && (
          <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "rgba(226,232,240,0.46)" }}>
            Have one?{" "}
            <span style={{ color: "#fb923c", cursor: "pointer", fontWeight: 700 }} onClick={() => { setMode("login"); setErr(""); setNote(""); }}>
              Sign in
            </span>
          </p>
        )}

        {mode === "forgot" && (
          <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "rgba(226,232,240,0.46)" }}>
            Back to{" "}
            <span style={{ color: "#fb923c", cursor: "pointer", fontWeight: 700 }} onClick={() => { setMode("login"); setErr(""); setNote(""); }}>
              Sign in
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
