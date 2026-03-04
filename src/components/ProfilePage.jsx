import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { CAL } from "../constants/calendar";
import {
  AVATAR_THEMES,
  CARD_RADIUS,
  CONTENT_MAX,
  DEFAULT_AVATAR_COLOR,
  EDGE_RING,
  HAIRLINE,
  LIFTED_SHADOW,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  MUTED_TEXT,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  TEAM_AVATAR_OPTIONS,
  avatarTheme,
  getUserAccentTheme,
  teamSupportKey,
} from "../constants/design";
import { isUsernameTaken, sanitizeUsername } from "../authProfile";
import useViewport from "../useViewport";

export default function ProfilePage({ user, setUser }) {
  const { isMobile, isTablet } = useViewport();
  const [predictions, setPredictions] = useState([]);
  const [rank, setRank] = useState(null);
  const [editing, setEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [pendingColor, setPendingColor] = useState(user?.avatar_color || DEFAULT_AVATAR_COLOR);
  const [pendingTeam, setPendingTeam] = useState(user?.favorite_team || TEAM_AVATAR_OPTIONS[0]?.team || "");
  const [saving, setSaving] = useState(false);
  const [supportSaving, setSupportSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const supportOptions = TEAM_AVATAR_OPTIONS;

  useEffect(() => {
    if (user) {
      setNewUsername(user.username || "");
      setPendingColor(user.avatar_color || DEFAULT_AVATAR_COLOR);
      setPendingTeam(user.favorite_team || TEAM_AVATAR_OPTIONS[0]?.team || "");
      fetchData();
    }
  }, [user]); // eslint-disable-line

  const fetchData = async () => {
    setLoading(true);
    const { data: preds } = await supabase.from("predictions").select("*").eq("user_id", user.id).order("race_round", { ascending: true });
    if (preds) setPredictions(preds);
    const { data: profiles } = await supabase.from("profiles").select("id,points").order("points", { ascending: false });
    if (profiles) setRank(profiles.findIndex((profile) => profile.id === user.id) + 1);
    setLoading(false);
  };

  const saveProfile = async () => {
    const username = sanitizeUsername(newUsername);
    setSaving(true);
    setError("");
    setNote("");

    if (!username) {
      setError("Enter a valid username.");
      setSaving(false);
      return;
    }

    try {
      const taken = await isUsernameTaken(username, user.id);
      if (taken) {
        setError("That username is already taken.");
        setSaving(false);
        return;
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          username,
          avatar_color: pendingColor,
          favorite_team: pendingTeam,
        })
        .eq("id", user.id)
        .select("*")
        .single();

      if (updateError) {
        if (
          String(updateError.message || "").includes("avatar_color") ||
          String(updateError.message || "").includes("favorite_team")
        ) {
          await persistSupportMetadata({
            avatar_color: pendingColor,
            favorite_team: pendingTeam,
          });
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("profiles")
            .update({ username })
            .eq("id", user.id)
            .select("*")
            .single();

          if (fallbackError) {
            setError(fallbackError.message);
          } else if (fallbackData) {
            setUser({
              ...fallbackData,
              avatar_color: pendingColor || user.avatar_color || DEFAULT_AVATAR_COLOR,
              favorite_team: pendingTeam || user.favorite_team || null,
            });
            setEditing(false);
            setNote("Username updated. Support preferences were kept locally, but you still need the latest profile migration for full database sync.");
          }
        } else {
          setError(updateError.message);
        }
      } else if (data) {
        setUser(data);
        setEditing(false);
        setNote("Profile updated.");
      }
    } catch (updateFailure) {
      setError(updateFailure?.message || "Could not update profile.");
    }

    setSaving(false);
  };

  const totalRaces = predictions.filter((prediction) => prediction.score > 0).length;
  const bestRace = predictions.reduce((best, prediction) => ((prediction.score || 0) > (best?.score || 0) ? prediction : best), null);
  const theme = avatarTheme(pendingColor);
  const accentTheme = getUserAccentTheme({ avatar_color: pendingColor, favorite_team: pendingTeam });

  const inputStyle = {
    background: PANEL_BG_ALT,
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: 12,
    color: "#fff",
    padding: "10px 13px",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const persistSupportMetadata = async (payload) => {
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        avatar_color: payload.avatar_color,
        favorite_team: payload.favorite_team,
      },
    });

    return metadataError || null;
  };

  const saveSupportPreferences = async (nextTeam) => {
    if (!user) return;
    setSupportSaving(true);
    setError("");
    setNote("");

    const nextColor = teamSupportKey(nextTeam);
    setPendingTeam(nextTeam);
    setPendingColor(nextColor);

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_color: nextColor,
        favorite_team: nextTeam,
      })
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) {
      if (
        String(updateError.message || "").includes("avatar_color") ||
        String(updateError.message || "").includes("favorite_team")
      ) {
        await persistSupportMetadata({
          avatar_color: nextColor,
          favorite_team: nextTeam,
        });
        setUser({
          ...user,
          avatar_color: nextColor,
          favorite_team: nextTeam,
        });
        setNote("Support updated locally. Run the latest profile migration to sync it to the profiles table.");
      } else {
        setError(updateError.message);
      }
    } else if (data) {
      setUser(data);
      setNote("Support preferences updated.");
    }

    setSupportSaving(false);
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <div style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 22, boxShadow: LIFTED_SHADOW }}>
        <div style={{ padding: "28px 30px 24px", borderBottom: `1px solid ${HAIRLINE}`, background: "linear-gradient(180deg,rgba(255,255,255,0.02),rgba(15,24,44,0.96))" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", boxShadow: EDGE_RING, marginBottom: 18 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: accentTheme.accent }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#dbe4f0" }}>
              Player profile
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "auto minmax(0,1fr)", gap: 22, alignItems: "start" }}>
            <div style={{ width: 92, height: 92, borderRadius: 24, background: theme.fill, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, color: theme.text, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 20px 48px rgba(2,6,23,0.2)" }}>
              {user.username?.slice(0, 2).toUpperCase()}
            </div>

            <div style={{ minWidth: 0 }}>
              {editing ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                  <input style={{ ...inputStyle, width: 260, fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }} value={newUsername} onChange={(event) => setNewUsername(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveProfile()} autoFocus />
                  <button onClick={saveProfile} disabled={saving} style={{ background: "linear-gradient(135deg,#10B981,#059669)", border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "11px 16px", fontSize: 13 }}>{saving ? "Saving..." : "Save"}</button>
                  <button onClick={() => { setEditing(false); setNewUsername(user.username || ""); setPendingColor(user.avatar_color || DEFAULT_AVATAR_COLOR); setError(""); setNote(""); }} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.16)", borderRadius: 12, color: "#cbd5e1", cursor: "pointer", padding: "11px 14px", fontSize: 13 }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: isMobile ? 40 : 56, lineHeight: 0.96, fontWeight: 900, margin: 0, letterSpacing: isMobile ? -1.6 : -2.6 }}>{user.username}</h1>
                  <button onClick={() => setEditing(true)} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.16)", borderRadius: 12, color: "#dbe4f0", cursor: "pointer", padding: "9px 13px", fontSize: 12, fontWeight: 800 }}>Edit profile</button>
                </div>
              )}

              <div style={{ maxWidth: 620, fontSize: 14, lineHeight: 1.82, color: MUTED_TEXT, marginBottom: 14 }}>
                Your profile should feel like a clean season dashboard: identity, support team, results, and the prediction history that explains how your score was built.
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: accentTheme.text, background: accentTheme.accentSoft, border: `1px solid ${accentTheme.accentBorder}`, borderRadius: 999, padding: "6px 10px" }}>
                  Supporting {pendingTeam}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#dbe4f0", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "6px 10px" }}>
                  {(user.points || 0)} pts this season
                </span>
              </div>

              {error && <div style={{ marginTop: 12, fontSize: 12, color: "#fca5a5" }}>{error}</div>}
              {note && <div style={{ marginTop: 12, fontSize: 12, color: "#67e8f9" }}>{note}</div>}
            </div>
          </div>
        </div>

        <div style={{ padding: "22px 24px 24px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>Support team</div>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: MUTED_TEXT, marginBottom: 14, maxWidth: 620 }}>
            This identity follows you across avatar, league tables and community spaces. Keep it simple: one team, one clean visual signal.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
            {supportOptions.map(({ key, label, team }) => {
              const option = AVATAR_THEMES[key];
              if (!option) return null;

              return (
                <button
                  key={key}
                  onClick={() => saveSupportPreferences(team)}
                  style={{
                    borderRadius: CARD_RADIUS,
                    border: pendingTeam === team ? "1px solid rgba(248,250,252,0.22)" : `1px solid ${option.border}`,
                    background: pendingTeam === team ? "linear-gradient(180deg,rgba(255,255,255,0.04),#111c30)" : PANEL_BG_ALT,
                    cursor: "pointer",
                    boxShadow: pendingTeam === team ? SOFT_SHADOW : EDGE_RING,
                    padding: "12px 13px",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                  title={label}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 12, background: option.fill, display: "flex", alignItems: "center", justifyContent: "center", color: option.text, fontSize: 10, fontWeight: 900, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
                    {(label || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
                    <div style={{ fontSize: 10, color: pendingTeam === team ? "#dbe4f0" : SUBTLE_TEXT }}>
                      {pendingTeam === team ? "Selected" : "Choose team"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, fontSize: 12, color: MUTED_TEXT, minHeight: 48 }}>
            {supportSaving ? "Saving support..." : "Support identity updates live"}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          ["Total Points", user.points || 0, "#f97316"],
          ["Global Rank", rank ? `#${rank}` : "—", "#bfdbfe"],
          ["Races Scored", `${totalRaces} / 24`, "#99f6e4"],
        ].map(([label, value, color]) => (
          <div key={label} style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: "18px 20px 16px", boxShadow: SOFT_SHADOW }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 900, color, letterSpacing: -1 }}>{value}</div>
          </div>
        ))}
      </div>

      {bestRace && (() => {
        const race = CAL.find((item) => item.r === bestRace.race_round);
        return (
          <div style={{ borderRadius: CARD_RADIUS, border: "1px solid rgba(250,204,21,0.24)", background: PANEL_BG, padding: "16px 20px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", boxShadow: SOFT_SHADOW }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#fde68a", marginBottom: 4 }}>Best Race</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{race?.n || `Round ${bestRace.race_round}`}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fde68a" }}>{bestRace.score} <span style={{ fontSize: 13, fontWeight: 500, color: MUTED_TEXT }}>pts</span></div>
          </div>
        );
      })()}

      <div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 14 }}>Prediction History</div>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: MUTED_TEXT, fontSize: 13 }}>Loading...</div>
        ) : predictions.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, boxShadow: SOFT_SHADOW }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>No predictions yet</div>
            <div style={{ fontSize: 13, color: MUTED_TEXT }}>Make your first picks in the Predictions tab.</div>
          </div>
        ) : (
          <div style={{ borderRadius: SECTION_RADIUS, overflow: "hidden", border: PANEL_BORDER, boxShadow: SOFT_SHADOW, overflowX: isMobile ? "auto" : "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 100px 100px", background: PANEL_BG_ALT, borderBottom: "1px solid rgba(148,163,184,0.14)" }}>
              {["Rnd", "Race", "Picks", "Score"].map((heading, index) => (
                <div key={heading} style={{ padding: "10px 14px", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, textAlign: index > 1 ? "center" : "left" }}>{heading}</div>
              ))}
            </div>
            {predictions.map((prediction, index) => {
              const race = CAL.find((item) => item.r === prediction.race_round);
              const pickCount = prediction.picks ? Object.values(prediction.picks).filter(Boolean).length : 0;
              const isScored = prediction.score > 0;
              return (
                <div key={prediction.race_round} style={{ display: "grid", gridTemplateColumns: "50px 1fr 100px 100px", borderBottom: index < predictions.length - 1 ? "1px solid rgba(148,163,184,0.12)" : "none", background: index % 2 === 0 ? PANEL_BG : PANEL_BG_ALT, alignItems: "center" }}>
                  <div style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: SUBTLE_TEXT }}>R{prediction.race_round}</div>
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{race?.n || `Round ${prediction.race_round}`}</div>
                    {prediction.score_breakdown && prediction.score_breakdown.length > 0 && (
                      <div style={{ fontSize: 11, color: MUTED_TEXT, marginTop: 3 }}>
                        {prediction.score_breakdown.map((item) => item.label).join(" · ")}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#bfdbfe", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(96,165,250,0.22)", borderRadius: 10, padding: "3px 8px" }}>{pickCount} picks</span>
                  </div>
                  <div style={{ padding: "12px 14px", textAlign: "center", fontSize: 16, fontWeight: 900, color: isScored ? "#99f6e4" : SUBTLE_TEXT }}>
                    {isScored ? prediction.score : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
