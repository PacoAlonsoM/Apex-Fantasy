import { useState } from "react";
import { supabase } from "../supabase";
import { fetchRaceData } from "../openf1";
import { scoreRace } from "../scoring";
import { CAL } from "../constants/calendar";
import { ADMIN_ID, BRAND_GRADIENT, PANEL_BG, PANEL_BORDER } from "../constants/design";

export default function AdminPage({ user }) {
  const [round, setRound] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dotd, setDotd] = useState("");
  const [pole, setPole] = useState("");
  const [ctor, setCtor] = useState("");
  const [saved, setSaved] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightResult, setInsightResult] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsResult, setNewsResult] = useState(null);

  if (!user || user.id !== ADMIN_ID) {
    return (
      <div style={{ maxWidth: 600, margin: "100px auto", textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🔒</div>
        <h2 style={{ fontWeight: 900, fontSize: 24, marginBottom: 12 }}>Admin Only</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>You don't have access to this page.</p>
      </div>
    );
  }

  const race = CAL.find(r => r.r === round);

  const fetchFromAPI = async () => {
    setLoading(true); setResult(null); setSaved(false); setScoreResult(null);
    try {
      const data = await fetchRaceData(2026, round);
      if (!data) {
        setResult({ error: "No data found. Race may not have happened yet or API doesn't have results." });
      } else {
        setResult(data);
      }
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  const saveResults = async () => {
    if (!result || result.error) return;
    const row = {
      race_round: round,
      pole: pole || null,
      winner: result.winner,
      p2: result.p2,
      p3: result.p3,
      dnf: result.dnf,
      fastest_lap: result.fastest_lap,
      dotd: dotd || null,
      best_constructor: ctor || null,
      safety_car: result.safety_car,
      red_flag: result.red_flag,
      results_entered: true,
      locked_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("race_results").upsert(row, { onConflict: "race_round" });
    if (error) alert("Error saving: " + error.message);
    else setSaved(true);
  };

  const generateAiBrief = async () => {
    setInsightLoading(true);
    setInsightResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setInsightResult({ error: "No active auth session found. Log out and log back in, then try again." });
        setInsightLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("ai-race-brief", {
        body: { scope: "upcoming_race" },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        let detail = error.message;
        const context = error.context;

        if (context) {
          try {
            const payload = await context.json();
            detail = payload?.error || payload?.message || JSON.stringify(payload);
          } catch {
            try {
              detail = await context.text();
            } catch {
              detail = error.message;
            }
          }
        }

        setInsightResult({ error: detail });
      } else {
        setInsightResult(data);
      }
    } catch (error) {
      setInsightResult({ error: error instanceof Error ? error.message : "Unexpected function error." });
    }

    setInsightLoading(false);
  };

  const syncNews = async () => {
    setNewsLoading(true);
    setNewsResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setNewsResult({ error: "No active auth session found. Log out and log back in, then try again." });
        setNewsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("news-ingest", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        let detail = error.message;
        const context = error.context;

        if (context) {
          try {
            const payload = await context.json();
            detail = payload?.error || payload?.message || JSON.stringify(payload);
          } catch {
            try {
              detail = await context.text();
            } catch {
              detail = error.message;
            }
          }
        }

        setNewsResult({ error: detail });
      } else {
        setNewsResult(data);
      }
    } catch (error) {
      setNewsResult({ error: error instanceof Error ? error.message : "Unexpected function error." });
    }

    setNewsLoading(false);
  };

  const inp = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 8, color: "#fff", padding: "10px 13px",
    fontSize: 13, outline: "none", width: "100%",
    boxSizing: "border-box", fontFamily: "inherit"
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "52px 28px", position: "relative", zIndex: 1 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, background: "rgba(255,90,54,0.14)", border: "1px solid rgba(255,138,61,0.24)", marginBottom: 16 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff8a3d" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ffd166" }}>Admin Panel</span>
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 6px", letterSpacing: -1 }}>Import Race Results</h1>
        <p style={{ color: "rgba(255,255,255,0.38)", margin: 0, fontSize: 13 }}>Fetch live results from OpenF1 and save to database</p>
      </div>

      {/* STEP 1 — Fetch & Save */}
      <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: 24, marginBottom: 20, backdropFilter: "blur(16px)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 11 }}>Step 1 — Select Race & Fetch</div>
        <select
          value={round}
          onChange={e => { setRound(Number(e.target.value)); setResult(null); setSaved(false); setScoreResult(null); }}
          style={{ ...inp, marginBottom: 16 }}
        >
          {CAL.map(r => (
            <option key={r.r} value={r.r} style={{ background: "#08081A" }}>Round {r.r} — {r.n}</option>
          ))}
        </select>
        {race && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>{race.circuit} · {race.date}</div>}
        <button onClick={fetchFromAPI} disabled={loading} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 13, fontSize: 14, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Fetching from OpenF1..." : "🔄 Fetch Results from OpenF1"}
        </button>
      </div>

      {/* Results from API */}
      {result && !result.error && (
        <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: 24, marginBottom: 20, backdropFilter: "blur(16px)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>Results from OpenF1</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              ["🏆 Winner", result.winner],
              ["2️⃣ P2", result.p2],
              ["3️⃣ P3", result.p3],
              ["💨 Fastest Lap", result.fastest_lap],
              ["❌ DNF", result.dnf],
              ["🚗 Safety Car", result.safety_car ? "Yes" : "No"],
              ["🚩 Red Flag", result.red_flag ? "Yes" : "No"],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "12px 14px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: value ? "#fff" : "rgba(255,255,255,0.2)" }}>{value || "—"}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 11 }}>Manual Fields</div>
          <div style={{ marginBottom: 11 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Pole Position Driver</div>
            <input style={inp} placeholder="e.g. Max Verstappen" value={pole} onChange={e => setPole(e.target.value)} />
          </div>
          <div style={{ marginBottom: 11 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Driver of the Day</div>
            <input style={inp} placeholder="e.g. Lando Norris" value={dotd} onChange={e => setDotd(e.target.value)} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Best Constructor</div>
            <input style={inp} placeholder="e.g. McLaren" value={ctor} onChange={e => setCtor(e.target.value)} />
          </div>
          <button onClick={saveResults} style={{ background: saved ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#0ea5e9,#2dd4bf)", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 13, fontSize: 14 }}>
            {saved ? "✅ Results Saved!" : "💾 Save to Database"}
          </button>
        </div>
      )}

      {/* Error */}
      {result?.error && (
        <div style={{ padding: 20, borderRadius: 11, border: "1px solid rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.08)", color: "#F87171", fontSize: 13, marginBottom: 20 }}>
          ⚠️ {result.error}
        </div>
      )}

      {/* STEP 2 — Score */}
      <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: 24, backdropFilter: "blur(16px)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Step 2 — Award Points</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginBottom: 16 }}>
          Run this after saving results. Calculates and awards points to all users who made predictions for the selected round.
        </p>
        <button
          onClick={async () => {
            setScoring(true); setScoreResult(null);
            const res = await scoreRace(round);
            setScoreResult(res);
            setScoring(false);
          }}
          disabled={scoring}
          style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontWeight: 700, width: "100%", padding: 13, fontSize: 14, opacity: scoring ? 0.6 : 1 }}
        >
          {scoring ? "Calculating..." : "⚡ Calculate & Award Points"}
        </button>
        {scoreResult && (
          <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 9, background: scoreResult.error ? "rgba(239,68,68,0.1)" : "rgba(52,211,153,0.1)", border: `1px solid ${scoreResult.error ? "rgba(239,68,68,0.28)" : "rgba(52,211,153,0.28)"}`, fontSize: 13, color: scoreResult.error ? "#F87171" : "#34D399" }}>
            {scoreResult.error ? `❌ ${scoreResult.error}` : `✅ Scored ${scoreResult.scored} users successfully!`}
          </div>
        )}
      </div>

      <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: 24, marginTop: 20, backdropFilter: "blur(16px)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Step 3 — Sync News</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginBottom: 16 }}>
          Pull the latest stories into `news_articles` before generating a new AI Insight read.
        </p>
        <button
          onClick={syncNews}
          disabled={newsLoading}
          style={{ background: "linear-gradient(135deg,#2563eb,#06b6d4)", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontWeight: 700, width: "100%", padding: 13, fontSize: 14, opacity: newsLoading ? 0.6 : 1 }}
        >
          {newsLoading ? "Syncing News..." : "Sync News Feed"}
        </button>

        {newsResult && (
          <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 9, background: newsResult.error ? "rgba(239,68,68,0.1)" : "rgba(37,99,235,0.1)", border: `1px solid ${newsResult.error ? "rgba(239,68,68,0.28)" : "rgba(37,99,235,0.28)"}`, fontSize: 13, color: newsResult.error ? "#F87171" : "#7dd3fc" }}>
            {newsResult.error
              ? `❌ ${newsResult.error}`
              : `✅ Synced ${newsResult.upsertedCount || 0} stories${newsResult.errors?.length ? ` with ${newsResult.errors.length} source warnings` : ""}.`}
          </div>
        )}
      </div>

      <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: 24, marginTop: 20, backdropFilter: "blur(16px)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Step 4 — Generate AI Insight</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginBottom: 16 }}>
          Builds one AI Insight read using the latest ingested news plus upcoming race context from OpenF1. This is the first layer for AI analytics on the product.
        </p>
        <button
          onClick={generateAiBrief}
          disabled={insightLoading}
          style={{ background: "linear-gradient(135deg,#22c55e,#14b8a6)", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontWeight: 700, width: "100%", padding: 13, fontSize: 14, opacity: insightLoading ? 0.6 : 1 }}
        >
          {insightLoading ? "Generating AI Insight..." : "Generate AI Insight"}
        </button>

        {insightResult && (
          <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 9, background: insightResult.error ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)", border: `1px solid ${insightResult.error ? "rgba(239,68,68,0.28)" : "rgba(34,197,94,0.28)"}`, fontSize: 13, color: insightResult.error ? "#F87171" : "#34D399" }}>
            {insightResult.error ? `❌ ${insightResult.error}` : `✅ ${insightResult.headline || "AI Insight generated successfully."}`}
          </div>
        )}
      </div>
    </div>
  );
}
