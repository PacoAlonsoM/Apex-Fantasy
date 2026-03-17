import { useState } from "react";
import { supabase } from "../supabase";
import { requireActiveSession } from "../authProfile";
import { CAL } from "../constants/calendar";
import { ADMIN_ID, BRAND_GRADIENT, PANEL_BG, PANEL_BORDER } from "../constants/design";

function SourceBadge({ tone = "auto", children }) {
  const themes = {
    auto: {
      background: "rgba(34,197,94,0.12)",
      border: "1px solid rgba(34,197,94,0.24)",
      color: "#86efac",
    },
    manual: {
      background: "rgba(249,115,22,0.12)",
      border: "1px solid rgba(249,115,22,0.24)",
      color: "#fdba74",
    },
  };

  const theme = themes[tone] || themes.auto;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        ...theme,
      }}
    >
      {children}
    </span>
  );
}

export default function AdminPage({ user }) {
  const [round, setRound] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dotd, setDotd] = useState("");
  const [pole, setPole] = useState("");
  const [ctor, setCtor] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightResult, setInsightResult] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsResult, setNewsResult] = useState(null);
  const [syncWarnings, setSyncWarnings] = useState([]);

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
    setLoading(true); setResult(null); setSaved(false); setSaveResult(null); setScoreResult(null); setSyncWarnings([]);
    try {
      const data = await invokeAdminRaceControl("sync_openf1_results", {
        year: Number(String(race?.date || "").slice(0, 4)) || 2026,
      });

      if (!data?.results) {
        setResult({ error: "No OpenF1 data found for this round." });
      } else {
        setResult(data.results);
        setPole(data.results.pole || "");
        setDotd(data.results.dotd || "");
        setCtor(data.results.best_constructor || "");
        setSaved(true);
        setSyncWarnings(data.warnings || []);
        setSaveResult({
          ok: true,
          message: "OpenF1 results were synced and saved automatically.",
        });
      }
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  const getAccessToken = async () => {
    const session = await requireActiveSession();
    return session?.access_token || null;
  };

  const extractFunctionError = async (error) => {
    let detail = error?.message || "Unexpected function error.";
    const context = error?.context;

    if (!context) return detail;

    try {
      const payload = await context.json();
      detail = payload?.error || payload?.message || JSON.stringify(payload);
    } catch {
      try {
        detail = await context.text();
      } catch {
        detail = error?.message || detail;
      }
    }

    return detail;
  };

  const invokeAdminRaceControl = async (action, payload = null) => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("No active auth session found. Log out and log back in, then try again.");
    }

    const { data, error } = await supabase.functions.invoke("admin-race-control", {
      body: {
        action,
        raceRound: round,
        payload,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      throw new Error(await extractFunctionError(error));
    }

    return data;
  };

  const invokeProtectedFunction = async (name, options = {}) => {
    const attempt = async (forceRefresh = false) => {
      if (forceRefresh) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        if (!refreshed?.session?.access_token) {
          throw new Error("Session refresh failed. Log out and log back in, then try again.");
        }
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("No active auth session found. Log out and log back in, then try again.");
      }

      const { data, error } = await supabase.functions.invoke(name, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!error) return data;

      const detail = await extractFunctionError(error);
      if (!forceRefresh && detail === "Invalid JWT") {
        return attempt(true);
      }

      throw new Error(detail);
    };

    return attempt(false);
  };

  const saveResults = async () => {
    if (!result || result.error) return;
    setSaveLoading(true);
    setSaveResult(null);

    try {
      await invokeAdminRaceControl("save_results", {
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
      });

      setSaved(true);
      setSaveResult({ ok: true, message: "Results saved to database." });
    } catch (error) {
      setSaved(false);
      setSaveResult({
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected save error.",
      });
    }

    setSaveLoading(false);
  };

  const generateAiBrief = async () => {
    setInsightLoading(true);
    setInsightResult(null);

    try {
      const data = await invokeProtectedFunction("ai-race-brief", {
        body: { scope: "upcoming_race" },
      });
      setInsightResult(data);
    } catch (error) {
      setInsightResult({ error: error instanceof Error ? error.message : "Unexpected function error." });
    }

    setInsightLoading(false);
  };

  const syncNews = async () => {
    setNewsLoading(true);
    setNewsResult(null);

    try {
      const data = await invokeProtectedFunction("news-ingest");
      setNewsResult(data);
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
        <p style={{ color: "rgba(255,255,255,0.38)", margin: 0, fontSize: 13 }}>Sync OpenF1 automatically, then only override the categories that still require human input.</p>
      </div>

      {/* STEP 1 — Fetch & Save */}
      <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: 24, marginBottom: 20, backdropFilter: "blur(16px)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 11 }}>Step 1 — Select Race & Fetch</div>
        <select
          value={round}
          onChange={e => { setRound(Number(e.target.value)); setResult(null); setSaved(false); setSaveResult(null); setScoreResult(null); }}
          style={{ ...inp, marginBottom: 16 }}
        >
          {CAL.map(r => (
            <option key={r.r} value={r.r} style={{ background: "#08081A" }}>Round {r.r} — {r.n}</option>
          ))}
        </select>
        {race && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>{race.circuit} · {race.date}</div>}
        <button onClick={fetchFromAPI} disabled={loading} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 13, fontSize: 14, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Syncing from OpenF1..." : "🔄 Auto-Sync Results from OpenF1"}
        </button>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.34)", marginTop: 10 }}>
          This step now auto-saves the OpenF1 result payload into `race_results`. Only missing fields like Driver of the Day may still need an override.
        </div>
      </div>

      {/* Results from API */}
      {result && !result.error && (
        <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: 24, marginBottom: 20, backdropFilter: "blur(16px)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>Results from OpenF1</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              ["🥇 Pole", pole || result.pole, pole ? "manual" : "auto"],
              ["🏆 Winner", result.winner, "auto"],
              ["2️⃣ P2", result.p2, "auto"],
              ["3️⃣ P3", result.p3, "auto"],
              ["💨 Fastest Lap", result.fastest_lap, "auto"],
              ["❌ DNF", result.dnf, "auto"],
              ["🏗️ Constructor", ctor || result.best_constructor, ctor ? "manual" : "auto"],
              ["🚗 Safety Car", result.safety_car ? "Yes" : "No", "auto"],
              ["🚩 Red Flag", result.red_flag ? "Yes" : "No", "auto"],
            ].map(([label, value, source]) => (
              <div key={label} style={{ padding: "12px 14px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>{label}</div>
                  <SourceBadge tone={source}>{source === "manual" ? "Manual override" : "OpenF1 auto"}</SourceBadge>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: value ? "#fff" : "rgba(255,255,255,0.2)" }}>{value || "—"}</div>
              </div>
            ))}
          </div>

          {!!syncWarnings.length && (
            <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.24)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fcd34d", marginBottom: 8 }}>
                OpenF1 warnings
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {syncWarnings.map((warning) => (
                  <div key={warning} style={{ fontSize: 12, lineHeight: 1.6, color: "#fde68a" }}>
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}>
              <div style={{ marginBottom: 7 }}>
                <SourceBadge tone="auto">Auto-filled from OpenF1</SourceBadge>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.65, color: "rgba(255,255,255,0.72)" }}>
                Pole, podium, DNF, fastest lap, safety car, red flag, sprint categories, and constructor points can now be derived automatically.
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.18)" }}>
              <div style={{ marginBottom: 7 }}>
                <SourceBadge tone="manual">Still manual</SourceBadge>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.65, color: "rgba(255,255,255,0.72)" }}>
                Driver of the Day still depends on your manual input. You can also override pole or constructor if OpenF1 data needs correction.
              </div>
            </div>
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 11 }}>Manual Fields</div>
          <div style={{ marginBottom: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Pole Position Driver</div>
              <SourceBadge tone="manual">Optional override</SourceBadge>
            </div>
            <input style={inp} placeholder="e.g. Max Verstappen" value={pole} onChange={e => setPole(e.target.value)} />
          </div>
          <div style={{ marginBottom: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Driver of the Day</div>
              <SourceBadge tone="manual">Required manual</SourceBadge>
            </div>
            <input style={inp} placeholder="e.g. Lando Norris" value={dotd} onChange={e => setDotd(e.target.value)} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Best Constructor</div>
              <SourceBadge tone="manual">Optional override</SourceBadge>
            </div>
            <input style={inp} placeholder="e.g. McLaren" value={ctor} onChange={e => setCtor(e.target.value)} />
          </div>
          <button onClick={saveResults} disabled={saveLoading} style={{ background: saved ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#0ea5e9,#2dd4bf)", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 13, fontSize: 14, opacity: saveLoading ? 0.6 : 1 }}>
            {saveLoading ? "Saving overrides..." : saved ? "💾 Save Manual Overrides" : "💾 Save to Database"}
          </button>
          {saveResult && (
            <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 9, background: saveResult.ok ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${saveResult.ok ? "rgba(52,211,153,0.28)" : "rgba(239,68,68,0.28)"}`, fontSize: 13, color: saveResult.ok ? "#34D399" : "#F87171" }}>
              {saveResult.ok ? `✅ ${saveResult.message}` : `❌ ${saveResult.message}`}
            </div>
          )}
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
            setScoring(true);
            setScoreResult(null);
            try {
              const res = await invokeAdminRaceControl("score_race");
              setScoreResult({ success: true, scored: res?.scored || 0, message: res?.message || null, status: res?.status || "ok" });
            } catch (error) {
              setScoreResult({
                error: error instanceof Error ? error.message : "Unexpected scoring error.",
              });
            }
            setScoring(false);
          }}
          disabled={scoring}
          style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontWeight: 700, width: "100%", padding: 13, fontSize: 14, opacity: scoring ? 0.6 : 1 }}
        >
          {scoring ? "Calculating..." : "⚡ Calculate & Award Points"}
        </button>
        {scoreResult && (
          <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 9, background: scoreResult.error ? "rgba(239,68,68,0.1)" : "rgba(52,211,153,0.1)", border: `1px solid ${scoreResult.error ? "rgba(239,68,68,0.28)" : "rgba(52,211,153,0.28)"}`, fontSize: 13, color: scoreResult.error ? "#F87171" : "#34D399" }}>
            {scoreResult.error ? `❌ ${scoreResult.error}` : `✅ ${scoreResult.message || `Scored ${scoreResult.scored} users successfully!`}`}
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
