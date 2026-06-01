import { useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { clearPendingOAuthProfile, ensureProfileForUser, isUsernameTaken, persistPendingOAuthProfile, requireActiveSession, sanitizeUsername } from "@/src/shell/authProfile";
import {
  AVATAR_THEMES,
  EDGE_RING,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  TEAM_AVATAR_OPTIONS,
  teamSupportKey,
} from "@/src/constants/design";
import { pageToHref } from "@/src/shell/routing";
import BrandLockup from "@/src/ui/BrandLockup";
import useViewport from "@/src/lib/useViewport";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#EA4335" d="M9 7.36v3.48h4.84c-.21 1.12-.85 2.07-1.81 2.7l2.92 2.27C16.65 14.23 17.5 11.9 17.5 9c0-.55-.05-1.08-.15-1.59H9z" />
      <path fill="#34A853" d="M9 17.5c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.85.86-3.04.86-2.34 0-4.31-1.58-5.02-3.69H.96v2.32A8.99 8.99 0 0 0 9 17.5z" />
      <path fill="#4A90E2" d="M3.98 10.22A5.4 5.4 0 0 1 3.7 9c0-.42.1-.83.28-1.22V5.46H.96A9.02 9.02 0 0 0 .5 9c0 1.45.35 2.82.96 4.04l2.52-1.96z" />
      <path fill="#FBBC05" d="M9 4.09c1.32 0 2.5.45 3.43 1.32l2.58-2.58C13.46 1.39 11.42.5 9 .5A8.99 8.99 0 0 0 .96 5.46l3.02 2.32C4.69 5.67 6.66 4.09 9 4.09z" />
    </svg>
  );
}

function ProviderButton({ icon, label, sublabel, onClick, disabled, dark = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "100%",
        borderRadius: 14,
        border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.72)",
        background: dark ? "linear-gradient(180deg,#121826,#0a0f1a)" : "#ffffff",
        color: dark ? "#f8fafc" : "#111827",
        padding: "13px 14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: dark ? EDGE_RING : "0 18px 38px rgba(255,255,255,0.08)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          display: "grid",
          placeItems: "center",
          background: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)",
          color: dark ? "#fff" : "#111827",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>

      <span style={{ display: "grid", gap: sublabel ? 2 : 0, textAlign: "left", minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.15 }}>{label}</span>
        {sublabel && (
          <span style={{ fontSize: 11, lineHeight: 1.25, color: dark ? "rgba(226,232,240,0.56)" : "rgba(15,23,42,0.56)" }}>
            {sublabel}
          </span>
        )}
      </span>
    </button>
  );
}

function SupportTeamCard({ option, active, onSelect }) {
  const theme = AVATAR_THEMES[teamSupportKey(option.team)];

  if (!theme) return null;

  return (
    <button
      type="button"
      onClick={() => onSelect(option.team)}
      aria-pressed={active}
      style={{
        borderRadius: 14,
        border: active ? "1px solid rgba(248,250,252,0.28)" : "1px solid rgba(148,163,184,0.14)",
        background: active ? `linear-gradient(180deg,${theme.bg},rgba(14,25,41,0.98))` : PANEL_BG_ALT,
        padding: "12px",
        textAlign: "left",
        cursor: "pointer",
        display: "grid",
        gap: 12,
        boxShadow: active ? `0 18px 34px ${theme.bg}` : "none",
        transition: "border-color 140ms ease, background 140ms ease, box-shadow 140ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            display: "grid",
            placeItems: "center",
            background: theme.fill,
            color: theme.text,
            fontSize: 11,
            fontWeight: 900,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}
        >
          {option.label.slice(0, 2).toUpperCase()}
        </div>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: active ? theme.accent : "rgba(148,163,184,0.28)",
            boxShadow: active ? `0 0 0 4px ${theme.bg}` : "none",
            flexShrink: 0,
          }}
        />
      </div>

      <div style={{ color: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1.3 }}>{option.label}</div>
    </button>
  );
}

function PasswordInput({ id, value, onChange, onKeyDown, inputStyle, visible, onToggle, marginBottom = 10 }) {
  return (
    <div style={{ position: "relative", marginBottom }}>
      <input
        id={id}
        style={{ ...inputStyle, paddingRight: 74 }}
        type={visible ? "text" : "password"}
        placeholder="••••••••"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={onToggle}
        style={{
          position: "absolute",
          right: 7,
          top: "50%",
          transform: "translateY(-50%)",
          border: "1px solid rgba(148,163,184,0.14)",
          background: "rgba(6,16,27,0.72)",
          color: "rgba(248,250,252,0.82)",
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 800,
          padding: "6px 9px",
        }}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export default function AuthModal({ mode, setMode, onClose, onAuth, redirectTarget, demoMode = false }) {
  const { isMobile, isTablet, height: viewportHeight } = useViewport();
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
  const [visiblePasswords, setVisiblePasswords] = useState({
    pass: false,
    confirm: false,
  });
  const [isLightTheme] = useState(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "light"
  );

  const selectedSupportTheme = AVATAR_THEMES[teamSupportKey(f.favoriteTeam)] || AVATAR_THEMES.ember;
  const isLoginMode = mode === "login";
  const isRegisterMode = mode === "register";
  const sheetPadding = isMobile ? 12 : 24;
  const resolvedViewportHeight = viewportHeight || 900;
  const modalMaxHeight = Math.max(isMobile ? 420 : 520, resolvedViewportHeight - sheetPadding * 2);
  const modalMaxWidth = isRegisterMode ? (isTablet ? 560 : 640) : 460;

  const upd = (k, v) => {
    setIsDirty(true);
    setF((current) => ({ ...current, [k]: v }));
  };

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 350);
  };

  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  };

  const closeModal = () => {
    clearPendingOAuthProfile();
    onClose();
  };

  const handleBackdropClick = () => {
    if (isDirty) {
      triggerShake();
    } else {
      closeModal();
    }
  };

  const switchMode = (newMode) => {
    clearPendingOAuthProfile();
    setMode(newMode);
    setErr("");
    setNote("");
    setIsDirty(false);
  };

  const inputStyle = {
    background: PANEL_BG_ALT,
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: 14,
    color: "#fff",
    padding: "12px 14px",
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

  const buttonBaseStyle = {
    border: "none",
    borderRadius: 14,
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    width: "100%",
    padding: 15,
    fontSize: 14,
    transition: "transform 140ms ease, opacity 140ms ease",
  };

  const buildOAuthRedirectUrl = () => {
    const currentUrl = new URL(window.location.href);

    if (!redirectTarget?.page) {
      return currentUrl.toString();
    }

    const nextHref = pageToHref(redirectTarget.page, {
      demoMode,
      raceRound: redirectTarget.raceRound || null,
    });

    return new URL(nextHref, window.location.origin).toString();
  };

  const signInWithProvider = async (provider) => {
    setLoading(true);
    setErr("");
    setNote("");

    try {
      if (isRegisterMode) {
        persistPendingOAuthProfile({
          username: f.username,
          favoriteTeam: f.favoriteTeam,
          avatarColor: teamSupportKey(f.favoriteTeam),
        });
      } else {
        clearPendingOAuthProfile();
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: buildOAuthRedirectUrl(),
        },
      });

      if (!error) return;

      setErr(error.message);
      triggerShake();
      setLoading(false);
    } catch (error) {
      if (isRegisterMode) clearPendingOAuthProfile();
      setErr(error?.message || "Unable to start social sign-in.");
      triggerShake();
      setLoading(false);
    }
  };

  const establishBrowserSession = async (session) => {
    if (session?.access_token && session?.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (error) {
        throw error;
      }
    }

    const activeSession = await requireActiveSession();
    if (!activeSession?.access_token) {
      throw new Error("We could not establish a valid session. Please sign in again.");
    }

    return activeSession;
  };

  const submit = async () => {
    setLoading(true);
    setErr("");
    setNote("");

    try {
      if (mode === "forgot") {
        clearPendingOAuthProfile();
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
        clearPendingOAuthProfile();
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
        setTimeout(() => closeModal(), 700);
        return;
      }

      if (!f.email || !f.pass) {
        setErr("Fill all fields.");
        triggerShake();
        setLoading(false);
        return;
      }

      if (mode === "register") {
        clearPendingOAuthProfile();
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
          await establishBrowserSession(data.session);
          const profile = await ensureProfileForUser(data.user, {
            username,
            avatarColor: teamSupportKey(f.favoriteTeam),
            favoriteTeam: f.favoriteTeam,
          });
          // Fire-and-forget welcome — errors are logged server-side and the
          // signup flow never blocks on the email.
          fetch("/api/auth/welcome", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: data.user.id }),
          }).catch(() => {});
          onAuth(profile || { id: data.user.id, username, points: 0 });
          closeModal();
          setLoading(false);
          return;
        }

        if (data.user && !data.session) {
          fetch("/api/auth/welcome", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: data.user.id }),
          }).catch(() => {});
          switchMode("login");
          setNote("Account created. Check your email to confirm it, then sign in.");
          setLoading(false);
          return;
        }
      } else {
        clearPendingOAuthProfile();
        const { data, error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.pass });
        if (error) {
          setErr(error.message);
          triggerShake();
          setLoading(false);
          return;
        }

        if (data.user) {
          await establishBrowserSession(data.session);
          const profile = await ensureProfileForUser(data.user);
          onAuth(profile || { id: data.user.id, username: f.email, points: 0 });
          closeModal();
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
    ? "Pick a username and team accent. Everything else stays simple."
    : mode === "forgot"
      ? "We will email you a reset link."
      : mode === "reset"
        ? "Choose a new password for your account."
        : "Sign in to keep your picks, leagues and profile in sync.";

  const headerLabel = mode === "register"
    ? "Sign up"
    : mode === "forgot" || mode === "reset"
      ? "Recovery"
      : "Sign in";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        padding: sheetPadding,
        background: "rgba(1,5,14,0.84)",
        display: "grid",
        placeItems: "center",
        overflowY: "auto",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
      }}
      onClick={handleBackdropClick}
    >
      <div
        className={shaking ? "stint-shake" : undefined}
        style={{
          background: PANEL_BG,
          border: PANEL_BORDER,
          borderRadius: isMobile ? 24 : 28,
          width: "100%",
          maxWidth: modalMaxWidth,
          maxHeight: modalMaxHeight,
          minHeight: 0,
          boxShadow: "0 40px 110px rgba(0,0,0,0.5)",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignSelf: "center",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            padding: isMobile ? "18px 18px 16px" : "22px 24px 18px",
            borderBottom: "1px solid rgba(148,163,184,0.12)",
            background: `radial-gradient(circle at 12% 0%, ${isRegisterMode ? selectedSupportTheme.bg : "var(--btn-secondary-bg)"}, transparent 36%), linear-gradient(180deg,rgba(255,255,255,0.03),rgba(10,18,32,0.98))`,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
              <BrandLockup mobile={isMobile} compact descriptor={false} />
              <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                  {headerLabel}
                </div>
                <h2 className="stint-page-title" style={{ margin: 0, fontSize: isMobile ? 30 : 38, lineHeight: 0.96, letterSpacing: isMobile ? -1.1 : -1.6 }}>
                  {title}
                </h2>
                <p style={{ margin: 0, color: MUTED_TEXT, fontSize: 14, lineHeight: 1.7 }}>
                  {subtitle}
                </p>
              </div>
            </div>

            <button
              onClick={closeModal}
              aria-label="Close"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: "var(--btn-secondary-bg)",
                border: "1px solid rgba(148,163,184,0.14)",
                color: SUBTLE_TEXT,
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {isRegisterMode && (
            <div
              style={{
                marginTop: 18,
                borderRadius: 18,
                border: `1px solid ${selectedSupportTheme.border}`,
                background: `linear-gradient(180deg,${selectedSupportTheme.bg},rgba(6,16,27,0.92))`,
                padding: "14px 15px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: SOFT_SHADOW,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: selectedSupportTheme.fill,
                  display: "grid",
                  placeItems: "center",
                  color: selectedSupportTheme.text,
                  fontSize: 12,
                  fontWeight: 900,
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
                  flexShrink: 0,
                }}
              >
                {f.favoriteTeam.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 3 }}>
                  Selected team
                </div>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{f.favoriteTeam}</div>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: isMobile ? "18px" : "22px 24px",
            overflowY: "auto",
            minHeight: 0,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {(isLoginMode || isRegisterMode) && (
            <div style={{ display: "grid", gap: 12, marginBottom: isRegisterMode ? 18 : 20 }}>
              <ProviderButton
                icon={<GoogleIcon />}
                label={isRegisterMode ? "Continue with Google" : "Sign in with Google"}
                sublabel={isRegisterMode ? "Fastest way to start" : undefined}
                disabled={loading}
                onClick={() => signInWithProvider("google")}
                dark={isLightTheme}
              />

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ height: 1, flex: 1, background: "rgba(148,163,184,0.14)" }} />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                  Or use email
                </span>
                <div style={{ height: 1, flex: 1, background: "rgba(148,163,184,0.14)" }} />
              </div>
            </div>
          )}

          {isRegisterMode && (
            <div style={{ display: "grid", gap: 16, marginBottom: 18 }}>
              <div>
                <label htmlFor="auth-username" style={labelStyle}>Username</label>
                <input
                  id="auth-username"
                  style={inputStyle}
                  placeholder="PaddockAlias"
                  value={f.username}
                  onChange={(event) => upd("username", event.target.value)}
                />
              </div>

              <div>
                <div style={{ ...labelStyle, marginBottom: 8 }}>Team accent</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: MUTED_TEXT, marginBottom: 10 }}>
                  Used for your profile, badges and key accents.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(3,minmax(0,1fr))", gap: 10 }}>
                  {TEAM_AVATAR_OPTIONS.map((option) => (
                    <SupportTeamCard
                      key={option.key}
                      option={option}
                      active={f.favoriteTeam === option.team}
                      onSelect={(team) => upd("favoriteTeam", team)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {(mode === "login" || mode === "register" || mode === "forgot") && (
            <>
              <label htmlFor="auth-email" style={labelStyle}>Email</label>
              <input
                id="auth-email"
                style={{ ...inputStyle, marginBottom: 12 }}
                type="email"
                placeholder="you@email.com"
                value={f.email}
                onChange={(event) => upd("email", event.target.value)}
              />
            </>
          )}

          {(mode === "login" || mode === "register") && (
            <>
              <label htmlFor="auth-pass" style={labelStyle}>Password</label>
              <PasswordInput
                id="auth-pass"
                inputStyle={inputStyle}
                value={f.pass}
                visible={visiblePasswords.pass}
                onToggle={() => togglePasswordVisibility("pass")}
                onChange={(event) => upd("pass", event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submit()}
                marginBottom={isLoginMode ? 8 : 0}
              />
            </>
          )}

          {mode === "reset" && (
            <>
              <label htmlFor="auth-newpass" style={labelStyle}>New password</label>
              <PasswordInput
                id="auth-newpass"
                inputStyle={inputStyle}
                value={f.pass}
                visible={visiblePasswords.pass}
                onToggle={() => togglePasswordVisibility("pass")}
                marginBottom={14}
                onChange={(event) => upd("pass", event.target.value)}
              />
              <label htmlFor="auth-confirm" style={labelStyle}>Confirm password</label>
              <PasswordInput
                id="auth-confirm"
                inputStyle={inputStyle}
                value={f.confirm}
                visible={visiblePasswords.confirm}
                onToggle={() => togglePasswordVisibility("confirm")}
                onChange={(event) => upd("confirm", event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submit()}
              />
            </>
          )}

          {mode === "login" && (
            <div style={{ textAlign: "right", marginTop: 4 }}>
              <button
                onClick={() => switchMode("forgot")}
                style={{ background: "none", border: "none", color: "var(--team-accent)", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}
              >
                Forgot password?
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            padding: isMobile ? "14px 18px 18px" : "16px 24px 22px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          {err && <p style={{ color: "var(--text-error)", fontSize: 12, margin: "0 0 12px" }}>{err}</p>}
          {note && <p style={{ color: "var(--text-note)", fontSize: 12, margin: "0 0 12px" }}>{note}</p>}

          <button
            disabled={loading}
            onClick={submit}
            style={{
              ...buttonBaseStyle,
              background: isRegisterMode
                ? `linear-gradient(135deg,${selectedSupportTheme.accent},#ffc247)`
                : "linear-gradient(135deg,var(--team-accent),#ffc247)",
              color: isRegisterMode ? selectedSupportTheme.text : "#fff",
              opacity: loading ? 0.6 : 1,
              boxShadow: SOFT_SHADOW,
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "register"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : mode === "reset"
                    ? "Update password"
                    : "Sign in"}
          </button>

          {mode === "login" && (
            <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "rgba(226,232,240,0.54)" }}>
              No account?{" "}
              <span style={{ color: "var(--team-accent)", cursor: "pointer", fontWeight: 700 }} onClick={() => switchMode("register")}>
                Create one
              </span>
            </p>
          )}

          {mode === "register" && (
            <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "rgba(226,232,240,0.54)" }}>
              Already have an account?{" "}
              <span style={{ color: "var(--team-accent)", cursor: "pointer", fontWeight: 700 }} onClick={() => switchMode("login")}>
                Sign in
              </span>
            </p>
          )}

          {mode === "forgot" && (
            <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "rgba(226,232,240,0.54)" }}>
              Back to{" "}
              <span style={{ color: "var(--team-accent)", cursor: "pointer", fontWeight: 700 }} onClick={() => switchMode("login")}>
                Sign in
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
