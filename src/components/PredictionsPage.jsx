import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { TEAMS, DRV, CONSTRUCTORS } from "../constants/teams";
import { CAL, rc, fmt, fmtFull, nextRace } from "../constants/calendar";
import { PTS } from "../constants/scoring";

export default function PredictionsPage({ user, openAuth }) {
  const [race, setRace] = useState(nextRace() || CAL[0]);
  const [picks, setPicks] = useState({});
  const [allPicks, setAllPicks] = useState({});
  const [tab, setTab] = useState("race");
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadPicks(); }, [user]); // eslint-disable-line

  const loadPicks = async () => {
    if (!user) return;
    const { data } = await supabase.from("predictions").select("*").eq("user_id", user.id);
    if (data) {
      const mapped = {};
      data.forEach(r => { mapped[r.race_round] = r.picks; });
      setAllPicks(mapped);
      if (mapped[race.r]) setPicks(mapped[race.r]);
    }
  };

  const selRace = r => { setRace(r); setSaved(false); setPicks(allPicks[r.r] || {}); setTab("race"); };
  const set = (k, v) => { setPicks(p => ({ ...p, [k]: v })); setSaved(false); };

  const save = async () => {
    if (!user) return openAuth("login");
    await supabase.from("predictions").upsert(
      { user_id: user.id, race_round: race.r, picks, updated_at: new Date().toISOString() },
      { onConflict: "user_id,race_round" }
    );
    setAllPicks(p => ({ ...p, [race.r]: picks }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const SH = (label, pts, c = "#E8002D") => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>{label}</div>
      <span style={{ fontSize: 10, fontWeight: 800, color: c, background: `${c}14`, border: `1px solid ${c}28`, borderRadius: 10, padding: "2px 7px" }}>{pts} pts</span>
    </div>
  );

  const DriverPicker = ({ label, field, pts }) => (
    <div style={{ marginBottom: 20 }}>
      {SH(label, pts)}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {DRV.map(d => {
          const tm = TEAMS[d.t];
          const sel = picks[field] === d.n;
          return (
            <button key={d.n} onClick={() => set(field, sel ? null : d.n)} style={{ background: sel ? tm.c : `${tm.c}18`, color: sel ? tm.t : tm.c, border: `1px solid ${sel ? tm.c : tm.c + "38"}`, borderRadius: 7, padding: "5px 9px", cursor: "pointer", fontWeight: sel ? 800 : 500, fontSize: 11 }}>
              <span style={{ opacity: 0.55, fontSize: 9 }}>#{d.nb} </span>{d.s}
            </button>
          );
        })}
      </div>
      {picks[field] && <div style={{ marginTop: 5, fontSize: 11, color: "rgba(255,255,255,0.38)" }}>→ <span style={{ color: "#fff", fontWeight: 700 }}>{picks[field]}</span></div>}
    </div>
  );

  const CtorPicker = () => (
    <div style={{ marginBottom: 20 }}>
      {SH("Constructor with Most Points", PTS.ctor, "#34D399")}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {CONSTRUCTORS.map(c => {
          const tm = TEAMS[c];
          const sel = picks.ctor === c;
          return (
            <button key={c} onClick={() => set("ctor", sel ? null : c)} style={{ background: sel ? tm.c : `${tm.c}18`, color: sel ? tm.t : tm.c, border: `1px solid ${sel ? tm.c : tm.c + "38"}`, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontWeight: sel ? 800 : 500, fontSize: 12 }}>{c}</button>
          );
        })}
      </div>
    </div>
  );

  const YNPicker = ({ field, label, pts }) => (
    <div style={{ marginBottom: 20 }}>
      {SH(label, pts, "#FBBF24")}
      <div style={{ display: "flex", gap: 8 }}>
        {["Yes", "No"].map(v => {
          const sel = picks[field] === v;
          const c = v === "Yes" ? "#34D399" : "#F87171";
          return (
            <button key={v} onClick={() => set(field, sel ? null : v)} style={{ background: sel ? `${c}16` : "rgba(255,255,255,0.04)", color: sel ? c : "rgba(255,255,255,0.5)", border: `1px solid ${sel ? c : "rgba(255,255,255,0.09)"}`, borderRadius: 7, padding: "8px 28px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{v}</button>
          );
        })}
      </div>
    </div>
  );

  const done = Object.values(picks).filter(Boolean).length;
  const color = rc(race);

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "52px 28px", display: "grid", gridTemplateColumns: "215px 1fr", gap: 16, position: "relative", zIndex: 1 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 9 }}>Select Race</div>
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", maxHeight: "calc(100vh - 150px)", overflowY: "auto" }}>
          {CAL.map((r, i) => {
            const isSaved = !!allPicks[r.r];
            return (
              <div key={r.r} onClick={() => selRace(r)} style={{ padding: "9px 11px", borderBottom: i < CAL.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", cursor: "pointer", background: race.r === r.r ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, alignSelf: "stretch", minHeight: 16, borderRadius: 1, background: rc(r), flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: race.r === r.r ? "#fff" : "rgba(255,255,255,0.55)" }}>{r.n}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.27)" }}>R{r.r} · {fmt(r.date)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0 }}>
                  {isSaved && <span style={{ fontSize: 8, fontWeight: 800, color: "#34D399", background: "rgba(52,211,153,0.14)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 4, padding: "1px 5px" }}>SAVED</span>}
                  {r.sprint && <span style={{ fontSize: 8, fontWeight: 800, color: "#FF8700", background: "rgba(255,135,0,0.14)", border: "1px solid rgba(255,135,0,0.3)", borderRadius: 4, padding: "1px 5px" }}>SPRINT</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}>
          <div style={{ height: 3, background: `linear-gradient(90deg,${color},${color}55)` }} />
          <div style={{ padding: "17px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                <div style={{ width: 4, height: 20, borderRadius: 2, background: color, flexShrink: 0 }} />
                <h2 style={{ margin: 0, fontWeight: 900, fontSize: 20, letterSpacing: -0.5 }}>{race.n}</h2>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", paddingLeft: 14 }}>{race.circuit} · {fmtFull(race.date)}</div>
              {done > 0 && <div style={{ paddingLeft: 14, marginTop: 6 }}><span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#A78BFA", padding: "2px 8px", borderRadius: 10, background: "rgba(167,139,250,0.09)", border: "1px solid rgba(167,139,250,0.22)" }}>{done} picks</span></div>}
            </div>
            {!user && (
              <div style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginBottom: 7 }}>Login to save picks</div>
                <button style={{ background: "linear-gradient(135deg,#E8002D,#FF6B35)", border: "none", borderRadius: 7, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 14px" }} onClick={() => openAuth("login")}>Login</button>
              </div>
            )}
          </div>
          {race.sprint && (
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.18)" }}>
              {[["race", "Race"], ["sprint", "Sprint"]].map(([t, l]) => (
                <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === t ? color : "transparent"}`, cursor: "pointer", padding: "11px 18px", fontSize: 13, fontWeight: tab === t ? 700 : 400, color: tab === t ? "#fff" : "rgba(255,255,255,0.38)" }}>{l}</button>
              ))}
            </div>
          )}
          <div style={{ padding: "22px" }}>
            {(!race.sprint || tab === "race") ? (
              <>
                <DriverPicker label="Pole Position" field="pole" pts={PTS.pole} />
                <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 20px" }} />
                <DriverPicker label="Race Winner" field="winner" pts={PTS.winner} />
                <DriverPicker label="2nd Place" field="p2" pts={PTS.p2} />
                <DriverPicker label="3rd Place" field="p3" pts={PTS.p3} />
                {picks.winner && picks.p2 && picks.p3 && (
                  <div style={{ padding: "10px 13px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.22)", background: "rgba(167,139,250,0.05)", marginBottom: 20, fontSize: 12 }}>
                    <span style={{ fontWeight: 800, color: "#A78BFA" }}>Perfect Podium Bonus +15 pts — </span>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>{picks.winner} · {picks.p2} · {picks.p3} in exact order</span>
                  </div>
                )}
                <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 20px" }} />
                <DriverPicker label="DNF Driver" field="dnf" pts={PTS.dnf} />
                <DriverPicker label="Fastest Lap" field="fl" pts={PTS.fl} />
                <DriverPicker label="Driver of the Day" field="dotd" pts={PTS.dotd} />
                <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 20px" }} />
                <CtorPicker />
                <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 20px" }} />
                <YNPicker field="sc" label="Safety Car?" pts={PTS.sc} />
                <YNPicker field="rf" label="Red Flag?" pts={PTS.rf} />
              </>
            ) : (
              <>
                <div style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid rgba(255,135,0,0.2)", background: "rgba(255,135,0,0.05)", marginBottom: 20, fontSize: 11, fontWeight: 700, color: "#FF8700", letterSpacing: "0.06em", textTransform: "uppercase" }}>Sprint Race — Reduced Points</div>
                <DriverPicker label="Sprint Pole" field="sp_pole" pts={PTS.sp_pole} />
                <DriverPicker label="Sprint Winner" field="sp_winner" pts={PTS.sp_winner} />
                <DriverPicker label="Sprint 2nd" field="sp_p2" pts={PTS.sp_p2} />
                <DriverPicker label="Sprint 3rd" field="sp_p3" pts={PTS.sp_p3} />
              </>
            )}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 17px" }} />
            <button onClick={save} style={{ background: saved ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#E8002D,#FF6B35)", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontWeight: 700, width: "100%", padding: 13, fontSize: 14 }}>
              {saved ? "Predictions Saved!" : "Save Predictions"}
            </button>
            <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 9 }}>Locks when qualifying begins</div>
          </div>
        </div>
      </div>
    </div>
  );
}
