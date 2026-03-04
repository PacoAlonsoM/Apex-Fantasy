import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { CAL } from "../constants/calendar";
import { AVATAR_THEMES, DEFAULT_AVATAR_COLOR, PANEL_BG, PANEL_BG_ALT, PANEL_BORDER, MUTED_TEXT, SUBTLE_TEXT, TEAM_AVATAR_OPTIONS, avatarTheme, getUserAccentTheme, teamSupportKey } from "../constants/design";
import { isUsernameTaken, sanitizeUsername } from "../authProfile";

export default function ProfilePage({ user, setUser }) {
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
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "44px 28px 80px", position: "relative", zIndex: 1 }}>
      <div style={{ borderRadius: 24, border: PANEL_BORDER, background: PANEL_BG, padding: "24px 26px 24px", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 22, flexWrap: "wrap" }}>
          <div style={{ width: 78, height: 78, borderRadius: 18, background: theme.fill, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: theme.text, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 16px 36px var(--team-accent-ghost)" }}>
            {user.username?.slice(0, 2).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Profile</div>
            {editing ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                <input style={{ ...inputStyle, width: 240, fontSize: 20, fontWeight: 900 }} value={newUsername} onChange={(event) => setNewUsername(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveProfile()} autoFocus />
                <button onClick={saveProfile} disabled={saving} style={{ background: "linear-gradient(135deg,#10B981,#059669)", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "10px 16px", fontSize: 13 }}>{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => { setEditing(false); setNewUsername(user.username || ""); setPendingColor(user.avatar_color || DEFAULT_AVATAR_COLOR); setError(""); setNote(""); }} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.16)", borderRadius: 10, color: "#cbd5e1", cursor: "pointer", padding: "10px 14px", fontSize: 13 }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0, letterSpacing: -1 }}>{user.username}</h1>
                <button onClick={() => setEditing(true)} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.16)", borderRadius: 10, color: "#dbe4f0", cursor: "pointer", padding: "7px 12px", fontSize: 12, fontWeight: 700 }}>Edit profile</button>
              </div>
            )}
            <div style={{ fontSize: 13, color: MUTED_TEXT }}>2026 season player profile</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: accentTheme.text, background: accentTheme.accentSoft, border: `1px solid ${accentTheme.accentBorder}`, borderRadius: 999, padding: "6px 10px" }}>
                Supporting {pendingTeam}
              </span>
            </div>
            {error && <div style={{ marginTop: 10, fontSize: 12, color: "#fca5a5" }}>{error}</div>}
            {note && <div style={{ marginTop: 10, fontSize: 12, color: "#67e8f9" }}>{note}</div>}
          </div>
        </div>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(148,163,184,0.14)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Support identity</div>
          <div style={{ fontSize: 13, color: MUTED_TEXT, marginBottom: 12 }}>
            Pick the team attached to your profile, leagues and forum identity.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(136px,1fr))", gap: 10 }}>
            {supportOptions.map(({ key, label, team }) => {
              const option = AVATAR_THEMES[key];
              if (!option) return null;

              return (
              <button
                key={key}
                onClick={() => saveSupportPreferences(team)}
                style={{
                  borderRadius: 14,
                  border: pendingTeam === team ? "1px solid rgba(248,250,252,0.64)" : `1px solid ${option.border}`,
                  background: pendingTeam === team ? option.fill : PANEL_BG_ALT,
                  cursor: "pointer",
                  boxShadow: pendingTeam === team ? "0 0 0 3px rgba(148,163,184,0.14)" : "none",
                  padding: "10px 11px",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
                title={label}
              >
                <div style={{ width: 30, height: 30, borderRadius: 10, background: option.fill, display: "flex", alignItems: "center", justifyContent: "center", color: option.text, fontSize: 10, fontWeight: 900, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
                  {(label || "?").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{label}</div>
                  <div style={{ fontSize: 10, color: pendingTeam === team ? "rgba(248,250,252,0.78)" : SUBTLE_TEXT }}>
                    {pendingTeam === team ? "Selected" : "Team support"}
                  </div>
                </div>
              </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, fontSize: 12, color: MUTED_TEXT, minHeight: 46 }}>
            {supportSaving ? "Saving support..." : "Support updates live"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          ["Total Points", user.points || 0, "#f97316"],
          ["Global Rank", rank ? `#${rank}` : "—", "#bfdbfe"],
          ["Races Scored", `${totalRaces} / 24`, "#99f6e4"],
        ].map(([label, value, color]) => (
          <div key={label} style={{ borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG, padding: "18px 20px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 900, color, letterSpacing: -1 }}>{value}</div>
          </div>
        ))}
      </div>

      {bestRace && (() => {
        const race = CAL.find((item) => item.r === bestRace.race_round);
        return (
          <div style={{ borderRadius: 18, border: "1px solid rgba(250,204,21,0.24)", background: PANEL_BG, padding: "16px 20px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
          <div style={{ padding: 40, textAlign: "center", borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>No predictions yet</div>
            <div style={{ fontSize: 13, color: MUTED_TEXT }}>Make your first picks in the Predictions tab.</div>
          </div>
        ) : (
          <div style={{ borderRadius: 18, overflow: "hidden", border: PANEL_BORDER }}>
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
