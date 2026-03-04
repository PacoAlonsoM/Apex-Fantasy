import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { CAL } from "../constants/calendar";

export default function ProfilePage({ user, setUser }) {
  const [predictions, setPredictions] = useState([]);
  const [rank, setRank] = useState(null);
  const [editing, setEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchData(); }, [user]); // eslint-disable-line

  const fetchData = async () => {
    setLoading(true);
    const { data: preds } = await supabase.from("predictions").select("*").eq("user_id", user.id).order("race_round", { ascending: true });
    if (preds) setPredictions(preds);
    const { data: profiles } = await supabase.from("profiles").select("id,points").order("points", { ascending: false });
    if (profiles) setRank(profiles.findIndex(p => p.id === user.id) + 1);
    setLoading(false);
  };

  const saveUsername = async () => {
    if (!newUsername.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ username: newUsername }).eq("id", user.id);
    if (!error) { setUser({ ...user, username: newUsername }); setEditing(false); }
    setSaving(false);
  };

  const totalRaces = predictions.filter(p => p.score > 0).length;
  const bestRace = predictions.reduce((best, p) => (p.score || 0) > (best?.score || 0) ? p : best, null);

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 8, color: "#fff", padding: "10px 13px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  if (!user) return null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "52px 28px", position: "relative", zIndex: 1 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40, flexWrap: "wrap" }}>
        <div style={{ width: 72, height: 72, borderRadius: 16, background: "linear-gradient(135deg,#E8002D,#FF6B35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 900, color: "#fff", flexShrink: 0 }}>
          {user.username?.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          {editing ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input style={{ ...inp, width: 220, padding: "7px 12px", fontSize: 20, fontWeight: 900 }} value={newUsername} onChange={e => setNewUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && saveUsername()} autoFocus />
              <button onClick={saveUsername} disabled={saving} style={{ background: "linear-gradient(135deg,#10B981,#059669)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 700, padding: "8px 16px", fontSize: 13 }}>{saving ? "..." : "Save"}</button>
              <button onClick={() => setEditing(false)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: "8px 12px", fontSize: 13 }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: -1 }}>{user.username}</h1>
              <button onClick={() => setEditing(true)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>Edit</button>
            </div>
          )}
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>2026 Season</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 36 }}>
        {[
          ["Total Points", user.points || 0, "#E8002D"],
          ["Global Rank", rank ? `#${rank}` : "—", "#A78BFA"],
          ["Races Scored", `${totalRaces} / 24`, "#34D399"],
        ].map(([label, value, color]) => (
          <div key={label} style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "20px 22px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 900, color, letterSpacing: -1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Best Race */}
      {bestRace && (() => {
        const race = CAL.find(r => r.r === bestRace.race_round);
        return (
          <div style={{ borderRadius: 12, border: "1px solid rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.04)", padding: "14px 20px", marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#FBBF24", marginBottom: 4 }}>Best Race</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{race?.n || `Round ${bestRace.race_round}`}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#FBBF24" }}>{bestRace.score} <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.3)" }}>pts</span></div>
          </div>
        );
      })()}

      {/* Prediction History */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 14 }}>Prediction History</div>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading...</div>
        ) : predictions.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>No predictions yet</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Make your first picks in the Predictions tab</div>
          </div>
        ) : (
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 100px 100px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Rnd", "Race", "Picks", "Score"].map((h, i) => (
                <div key={h} style={{ padding: "10px 14px", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", textAlign: i > 1 ? "center" : "left" }}>{h}</div>
              ))}
            </div>
            {predictions.map((pred, i) => {
              const race = CAL.find(r => r.r === pred.race_round);
              const pickCount = pred.picks ? Object.values(pred.picks).filter(Boolean).length : 0;
              const isScored = pred.score > 0;
              return (
                <div key={pred.race_round} style={{ display: "grid", gridTemplateColumns: "50px 1fr 100px 100px", borderBottom: i < predictions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", alignItems: "center" }}>
                  <div style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.25)" }}>R{pred.race_round}</div>
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{race?.n || `Round ${pred.race_round}`}</div>
                    {pred.score_breakdown && pred.score_breakdown.length > 0 && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
                        {pred.score_breakdown.map(b => b.label).join(" · ")}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, padding: "2px 8px" }}>{pickCount} picks</span>
                  </div>
                  <div style={{ padding: "12px 14px", textAlign: "center", fontSize: 16, fontWeight: 900, color: isScored ? "#34D399" : "rgba(255,255,255,0.2)" }}>
                    {isScored ? pred.score : "—"}
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