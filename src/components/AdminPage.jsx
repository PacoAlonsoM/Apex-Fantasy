import { useState } from "react";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "../supabase";
import { fetchRaceData } from "../openf1";
import { scoreRace } from "../scoring";
import { CAL } from "../constants/calendar";
import { CONSTRUCTORS, DRV } from "../constants/teams";
import { ADMIN_ID, BRAND_GRADIENT, PANEL_BG, PANEL_BORDER } from "../constants/design";
import { requireActiveSession } from "../authProfile";
import { formatDnfDrivers, getDnfDrivers, serializeDnfDrivers } from "../resultHelpers";

export default function AdminPage({ user }) {
  const [round, setRound] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dotd, setDotd] = useState("");
  const [pole, setPole] = useState("");
  const [ctor, setCtor] = useState("");
  const [dnfDrivers, setDnfDrivers] = useState([]);
  const [showDnfEditor, setShowDnfEditor] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
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

  const resetManualFields = () => {
    setPole("");
    setDotd("");
    setCtor("");
    setDnfDrivers([]);
    setShowDnfEditor(false);
  };

  const fetchFromAPI = async () => {
    setLoading(true); setResult(null); setSaved(false); setSaveResult(null); setScoreResult(null); resetManualFields();
    try {
      const data = await fetchRaceData(2026, round);
      if (!data) {
        setResult({ error: "No data found. Race may not have happened yet or API doesn't have results." });
      } else {
        setResult(data);
        setDnfDrivers(getDnfDrivers(data));
        setShowDnfEditor(false);
      }
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  const toggleDnfDriver = (driverName) => {
    setDnfDrivers((current) => (
      current.includes(driverName)
        ? current.filter((item) => item !== driverName)
        : [...current, driverName]
    ));
  };

  const resetFetchedDnfDrivers = () => {
    setDnfDrivers(getDnfDrivers(result));
  };

  const getAccessToken = async () => {
    const session = await requireActiveSession();
    if (!session) return null;

    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session?.access_token) {
      return data.session.access_token;
    }

    return session.access_token || null;
  };

  const invokeAuthedFunction = async (name, options = {}) => {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        data: null,
        error: new Error("No active auth session found. Log out and log back in, then try again."),
      };
    }

    const invokeViaFetch = async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: options.body ? JSON.stringify(options.body) : "{}",
        });

        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
          ? await response.json()
          : await response.text();

        if (!response.ok) {
          return {
            data: null,
            error: new Error(
              typeof payload === "string"
                ? payload
                : payload?.error || payload?.message || `Function ${name} failed with ${response.status}`
            ),
          };
        }

        return { data: payload, error: null };
      } catch (error) {
        return {
          data: null,
          error: error instanceof Error ? error : new Error("Failed to reach the edge function."),
        };
      }
    };

    try {
      const functionsClient = supabase.functions;
      if (typeof functionsClient.setAuth === "function") {
        functionsClient.setAuth(accessToken);
      }

      const result = await functionsClient.invoke(name, options);
      if (!result.error || !String(result.error.message || "").includes("Failed to send a request to the Edge Function")) {
        return result;
      }

      return await invokeViaFetch();
    } catch {
      return await invokeViaFetch();
    }
  };

  const saveResults = async () => {
    if (!result || result.error) return;
    setSaveLoading(true);
    setSaveResult(null);
    setSaved(false);

    try {
      const payload = {
        race_round: round,
        pole: pole || null,
        winner: result.winner,
        p2: result.p2,
        p3: result.p3,
        dnf: serializeDnfDrivers(dnfDrivers.length ? dnfDrivers : (result.dnf_list || result.dnf)),
        fastest_lap: result.fastest_lap,
        dotd: dotd || null,
        best_constructor: ctor || null,
        safety_car: result.safety_car,
        red_flag: result.red_flag,
        results_entered: true,
        locked_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("race_results")
        .upsert(payload, { onConflict: "race_round" });

      if (error) {
        setSaveResult({ error: error.message || "Could not save results." });
      } else {
        setSaved(true);
        setSaveResult({ ok: true, message: "Results saved to database." });
      }
    } catch (error) {
      setSaveResult({ error: error instanceof Error ? error.message : "Unexpected save error." });
    }

    setSaveLoading(false);
  };

  const generateAiBrief = async () => {
    setInsightLoading(true);
    setInsightResult(null);

    try {
      const { data, error } = await invokeAuthedFunction("ai-race-brief", {
        body: { scope: "upcoming_race" },
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

        const friendlyDetail = /Failed to send a request to the Edge Function/i.test(detail)
          ? "Could not reach the deployed ai-race-brief function. Refresh your session and confirm the remote function is reachable from localhost."
          : detail;

        setInsightResult({ error: friendlyDetail });
      } else {
        setInsightResult(data);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unexpected function error.";
      setInsightResult({
        error: /Failed to send a request to the Edge Function/i.test(detail)
          ? "Could not reach the deployed ai-race-brief function. Refresh your session and confirm the remote function is reachable from localhost."
          : detail,
      });
    }

    setInsightLoading(false);
  };

  const syncNews = async () => {
    setNewsLoading(true);
    setNewsResult(null);

    try {
      const { data, error } = await invokeAuthedFunction("news-ingest");

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
          onChange={e => { setRound(Number(e.target.value)); setResult(null); setSaved(false); setSaveResult(null); setScoreResult(null); resetManualFields(); }}
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
              ["❌ DNF Drivers", formatDnfDrivers({ ...result, dnf_list: dnfDrivers })],
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
            <select style={inp} value={pole} onChange={e => setPole(e.target.value)}>
              <option value="" style={{ background: "#08081A" }}>Select pole position</option>
              {DRV.map((driver) => (
                <option key={`pole-${driver.n}`} value={driver.n} style={{ background: "#08081A" }}>
                  {driver.n} · {driver.t}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 11 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Driver of the Day</div>
            <select style={inp} value={dotd} onChange={e => setDotd(e.target.value)}>
              <option value="" style={{ background: "#08081A" }}>Select driver of the day</option>
              {DRV.map((driver) => (
                <option key={`dotd-${driver.n}`} value={driver.n} style={{ background: "#08081A" }}>
                  {driver.n} · {driver.t}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Best Constructor</div>
            <select style={inp} value={ctor} onChange={e => setCtor(e.target.value)}>
              <option value="" style={{ background: "#08081A" }}>Select best constructor</option>
              {CONSTRUCTORS.map((team) => (
                <option key={`ctor-${team}`} value={team} style={{ background: "#08081A" }}>
                  {team}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>DNF Drivers</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.34)", marginBottom: 10 }}>
              Select every driver who retired. Any matching user pick will score.
            </div>
            <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "1 1 280px" }}>
                  {dnfDrivers.length ? (
                    dnfDrivers.map((driverName) => (
                      <span
                        key={`dnf-chip-${driverName}`}
                        style={{
                          borderRadius: 999,
                          padding: "6px 10px",
                          fontSize: 11,
                          fontWeight: 800,
                          background: "rgba(34,197,94,0.12)",
                          border: "1px solid rgba(34,197,94,0.24)",
                          color: "#bbf7d0",
                        }}
                      >
                        {driverName}
                      </span>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.34)" }}>No DNF drivers selected yet.</div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setShowDnfEditor((current) => !current)}
                    style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "7px 11px" }}
                  >
                    {showDnfEditor ? "Hide list" : "Edit list"}
                  </button>
                  <button
                    type="button"
                    onClick={resetFetchedDnfDrivers}
                    style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "7px 11px" }}
                  >
                    Use fetched
                  </button>
                  <button
                    type="button"
                    onClick={() => setDnfDrivers([])}
                    style={{ border: "1px solid rgba(239,68,68,0.2)", borderRadius: 999, background: "rgba(239,68,68,0.1)", color: "#fca5a5", cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "7px 11px" }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {showDnfEditor && (
                <div style={{ maxHeight: 260, overflowY: "auto", paddingRight: 4 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
                    {DRV.map((driver) => {
                      const selected = dnfDrivers.includes(driver.n);
                      return (
                        <button
                          key={`dnf-${driver.n}`}
                          type="button"
                          onClick={() => toggleDnfDriver(driver.n)}
                          style={{
                            border: selected ? "1px solid rgba(34,197,94,0.32)" : "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 10,
                            background: selected ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "10px 12px",
                            textAlign: "left",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{driver.n}</span>
                            <span style={{ fontSize: 10, color: selected ? "#86efac" : "rgba(255,255,255,0.28)" }}>
                              {selected ? "Included" : "Tap"}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{driver.t}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button onClick={saveResults} disabled={saveLoading} style={{ background: saved ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#0ea5e9,#2dd4bf)", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 13, fontSize: 14, opacity: saveLoading ? 0.6 : 1 }}>
            {saveLoading ? "Saving..." : saved ? "✅ Results Saved!" : "💾 Save to Database"}
          </button>
          {saveResult && (
            <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 9, background: saveResult.error ? "rgba(239,68,68,0.1)" : "rgba(52,211,153,0.1)", border: `1px solid ${saveResult.error ? "rgba(239,68,68,0.28)" : "rgba(52,211,153,0.28)"}`, fontSize: 13, color: saveResult.error ? "#F87171" : "#34D399" }}>
              {saveResult.error ? `❌ ${saveResult.error}` : `✅ ${saveResult.message}`}
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
          Run this after saving results. It recalculates the selected round against the current results and updates every user's totals safely.
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
            {scoreResult.error ? `❌ ${scoreResult.error}` : `✅ ${scoreResult.message || `Scored ${scoreResult.scored} users successfully!`}`}
          </div>
        )}
      </div>

      <div style={{ borderRadius: 16, border: PANEL_BORDER, background: PANEL_BG, padding: 24, marginTop: 20, backdropFilter: "blur(16px)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Step 3 — Sync News</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginBottom: 16 }}>
          Pull the latest stories into `news_articles` before generating a new AI brief.
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
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Step 4 — Generate AI Race Brief</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginBottom: 16 }}>
          Builds one AI insight using the latest ingested news plus upcoming race context from OpenF1. This is the first layer for AI analytics on the product.
        </p>
        <button
          onClick={generateAiBrief}
          disabled={insightLoading}
          style={{ background: "linear-gradient(135deg,#22c55e,#14b8a6)", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontWeight: 700, width: "100%", padding: 13, fontSize: 14, opacity: insightLoading ? 0.6 : 1 }}
        >
          {insightLoading ? "Generating AI Brief..." : "Generate AI Race Brief"}
        </button>

        {insightResult && (
          <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 9, background: insightResult.error ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)", border: `1px solid ${insightResult.error ? "rgba(239,68,68,0.28)" : "rgba(34,197,94,0.28)"}`, fontSize: 13, color: insightResult.error ? "#F87171" : "#34D399" }}>
            {insightResult.error ? `❌ ${insightResult.error}` : `✅ ${insightResult.headline || "AI brief generated successfully."}`}
          </div>
        )}
      </div>
    </div>
  );
}
