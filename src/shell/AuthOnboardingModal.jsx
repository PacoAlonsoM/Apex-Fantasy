import { useEffect, useMemo, useState } from "react";
import { isUsernameTaken, persistProfileSetup, sanitizeUsername } from "@/src/shell/authProfile";
import {
  AVATAR_THEMES,
  EDGE_RING,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  PANEL_BG_STRONG,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  TEAM_AVATAR_OPTIONS,
  teamSupportKey,
} from "@/src/constants/design";
import BrandLockup from "@/src/ui/BrandLockup";
import useViewport from "@/src/lib/useViewport";

function TeamCard({ team, active, onSelect }) {
  const themeKey = teamSupportKey(team.team);
  const theme = AVATAR_THEMES[themeKey];

  if (!theme) return null;

  return (
    <button
      type="button"
      onClick={() => onSelect(team.team)}
      aria-pressed={active}
      style={{
        borderRadius: 16,
        border: active ? "1px solid rgba(248,250,252,0.72)" : `1px solid ${theme.border}`,
        background: active ? theme.fill : PANEL_BG_ALT,
        padding: "12px 12px 13px",
        cursor: "pointer",
        textAlign: "left",
        display: "grid",
        gap: 10,
        boxShadow: active ? `0 22px 40px ${theme.bg}` : EDGE_RING,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: theme.fill,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.text,
          fontSize: 11,
          fontWeight: 900,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        {team.label.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{team.label}</div>
        <div style={{ color: active ? "rgba(248,250,252,0.82)" : MUTED_TEXT, fontSize: 11, lineHeight: 1.55 }}>
          {active ? "Selected for your STINT theme." : "Use this team to color your profile and app accents."}
        </div>
      </div>
    </button>
  );
}

export default function AuthOnboardingModal({ user, onComplete }) {
  const { isMobile, isTablet } = useViewport();
  const [username, setUsername] = useState(user?.username || "");
  const [favoriteTeam, setFavoriteTeam] = useState(user?.favorite_team || TEAM_AVATAR_OPTIONS[0]?.team || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setUsername(user?.username || "");
    setFavoriteTeam(user?.favorite_team || TEAM_AVATAR_OPTIONS[0]?.team || "");
    setError("");
    setNote("");
  }, [user]);

  const selectedTheme = useMemo(
    () => AVATAR_THEMES[teamSupportKey(favoriteTeam)] || AVATAR_THEMES.ember,
    [favoriteTeam]
  );

  const submit = async () => {
    const normalizedUsername = sanitizeUsername(username);

    if (!normalizedUsername) {
      setError("Pick a valid username before continuing.");
      return;
    }

    setLoading(true);
    setError("");
    setNote("");

    try {
      const taken = await isUsernameTaken(normalizedUsername, user?.id);
      if (taken) {
        setError("That username is already taken.");
        setLoading(false);
        return;
      }

      const { profile, partial } = await persistProfileSetup({
        userId: user?.id,
        username: normalizedUsername,
        favoriteTeam,
        avatarColor: teamSupportKey(favoriteTeam),
      });

      if (partial) {
        setNote("Your support colors were saved. One profile migration is still needed for full sync in the database.");
      }

      onComplete(profile);
    } catch (saveError) {
      setError(saveError?.message || "Could not save your team setup.");
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(1,5,14,0.9)",
      }}
    >
      <div
        style={{
          width: 980,
          maxWidth: "100%",
          borderRadius: 28,
          border: PANEL_BORDER,
          background: PANEL_BG_STRONG,
          overflow: "hidden",
          boxShadow: "0 46px 120px rgba(0,0,0,0.56)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "0.92fr 1.08fr" }}>
          <div
            style={{
              padding: isMobile ? "26px 22px" : "34px 30px",
              borderRight: isTablet ? "none" : "1px solid rgba(148,163,184,0.12)",
              borderBottom: isTablet ? "1px solid rgba(148,163,184,0.12)" : "none",
              background: `radial-gradient(circle at 12% 14%, ${selectedTheme.bg}, transparent 34%), linear-gradient(180deg,rgba(255,255,255,0.03),rgba(10,18,32,0.98))`,
            }}
          >
            <div style={{ marginBottom: 24 }}>
              <BrandLockup mobile={isMobile} compact descriptor={!isMobile} />
            </div>

            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
              Welcome to your paddock
            </div>
            <h2 style={{ margin: "0 0 12px", fontWeight: 900, fontSize: isMobile ? 34 : 42, lineHeight: 0.96, letterSpacing: isMobile ? -1.3 : -1.7 }}>
              Pick the team that should shape your STINT.
            </h2>
            <p style={{ margin: 0, color: MUTED_TEXT, fontSize: 14, lineHeight: 1.82, maxWidth: 360 }}>
              We keep login quick, then tune the experience around the constructor you back. Your profile, accents, picks prompts and community presence all start here.
            </p>

            <div
              style={{
                marginTop: 26,
                borderRadius: 22,
                border: `1px solid ${selectedTheme.border}`,
                background: `linear-gradient(180deg,${selectedTheme.bg},rgba(6,16,27,0.88))`,
                padding: "18px 18px 16px",
                boxShadow: SOFT_SHADOW,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: selectedTheme.fill,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: selectedTheme.text,
                    fontSize: 16,
                    fontWeight: 900,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
                  }}
                >
                  {(username || favoriteTeam || "ST").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                    Theme preview
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{favoriteTeam}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.7 }}>
                This support identity drives the accent glow, profile badge and the strongest action elements around the app.
              </div>
            </div>
          </div>

          <div style={{ padding: isMobile ? "24px 22px 22px" : "32px 30px 28px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 16 }}>
              Finish your setup
            </div>

            <label htmlFor="onboarding-username" style={{ display: "block", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>
              Username
            </label>
            <input
              id="onboarding-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="PaddockAlias"
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.16)",
                background: PANEL_BG_ALT,
                color: "#fff",
                padding: "12px 14px",
                fontSize: 14,
                outline: "none",
                marginBottom: 10,
              }}
            />
            <div style={{ fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT, marginBottom: 18 }}>
              This is how you show up on the leaderboard and in leagues.
            </div>

            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
              Favorite team
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
              {TEAM_AVATAR_OPTIONS.map((team) => (
                <TeamCard
                  key={team.key}
                  team={team}
                  active={favoriteTeam === team.team}
                  onSelect={setFavoriteTeam}
                />
              ))}
            </div>

            {error && <p style={{ color: "#fca5a5", fontSize: 12, margin: "16px 0 0" }}>{error}</p>}
            {note && <p style={{ color: "#67e8f9", fontSize: 12, margin: "16px 0 0" }}>{note}</p>}

            <button
              type="button"
              disabled={loading}
              onClick={submit}
              style={{
                marginTop: 20,
                width: "100%",
                border: "none",
                borderRadius: 16,
                background: `linear-gradient(135deg,${selectedTheme.accent},#ffc247)`,
                color: selectedTheme.text,
                fontSize: 14,
                fontWeight: 900,
                padding: "15px 18px",
                cursor: "pointer",
                boxShadow: SOFT_SHADOW,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Saving your setup..." : "Enter STINT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
