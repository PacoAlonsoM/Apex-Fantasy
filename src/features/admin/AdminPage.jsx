import { useEffect, useMemo, useRef, useState } from "react";
import {
  awardRoundPoints,
  backfillHistory,
  backfillAiReplayHistory,
  fetchAdminDashboard,
  fetchRoundResults,
  generateAiBrief,
  importRoundResults,
  publishRoundResults,
  repairAiLiveData,
  saveRoundDraft,
  saveScheduleOverride,
  seedProLeague,
  sendTestEmail,
  setAdminProStatus,
  syncNewsFeed,
  syncSchedule,
} from "@/src/features/admin/adminApi";
import CurrentRoundHealth from "@/src/features/admin/components/CurrentRoundHealth";
import CoverageHealthPanel from "@/src/features/admin/components/CoverageHealthPanel";
import NewsAiPanel from "@/src/features/admin/components/NewsAiPanel";
import ResultsDeskPanel from "@/src/features/admin/components/ResultsDeskPanel";
import RoundStatusTable from "@/src/features/admin/components/RoundStatusTable";
import ScheduleControlPanel from "@/src/features/admin/components/ScheduleControlPanel";
import ScoringPanel from "@/src/features/admin/components/ScoringPanel";
import {
  BRAND_GRADIENT,
  CONTENT_MAX,
  PANEL_BG,
  PANEL_BORDER,
  RADIUS_MD,
  SUBTLE_TEXT,
  isAdminUser,
} from "@/src/constants/design";

const SEASON = 2026;
const WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Choose the round",
    description: "Pick the weekend you want to work on from the round selector.",
  },
  {
    step: "2",
    title: "Check schedule",
    description: "If FIA timing changed, sync schedule or add a local lock override.",
  },
  {
    step: "3",
    title: "Build results",
    description: "Import OpenF1, then confirm or correct the official result fields.",
  },
  {
    step: "4",
    title: "Publish and score",
    description: "Publish the official result row, then award points once you trust it.",
  },
  {
    step: "5",
    title: "Refresh news and AI",
    description: "Update the wire, generate the brief, and backfill AI history when needed.",
  },
];

function emptyDraft(round) {
  return {
    season: SEASON,
    round,
    status: "draft",
    payload: {
      race_round: round,
      pole: "",
      winner: "",
      p2: "",
      p3: "",
      dnf_list: [],
      fastest_lap: "",
      dotd: "",
      best_constructor: "",
      safety_car: false,
      red_flag: false,
      sp_pole: "",
      sp_winner: "",
      sp_p2: "",
      sp_p3: "",
    },
  };
}

function emptyOverride() {
  return {
    event_status_override: null,
    race_lock_override_at: null,
    sprint_lock_override_at: null,
    admin_note: "",
  };
}

export default function AdminPage({ user }) {
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState(0);
  const [roundWorkspace, setRoundWorkspace] = useState(null);
  const [roundLoading, setRoundLoading] = useState(false);
  const [roundError, setRoundError] = useState("");
  const [draftForm, setDraftForm] = useState(emptyDraft(0));
  const [overrideForm, setOverrideForm] = useState(emptyOverride());
  const [actionResults, setActionResults] = useState({});
  const [loadingFlags, setLoadingFlags] = useState({});
  const [proStatus, setProStatus] = useState(user?.subscription_status ?? "free");
  const [proToggleLoading, setProToggleLoading] = useState(false);
  const [proToggleNote, setProToggleNote] = useState("");
  const [seedLeagueLoading, setSeedLeagueLoading] = useState(false);
  const [seedLeagueNote, setSeedLeagueNote] = useState("");
  const workspaceRef = useRef(null);

  const setBusy = (key, value) => {
    setLoadingFlags((current) => ({ ...current, [key]: value }));
  };

  const setActionResult = (key, value) => {
    setActionResults((current) => ({ ...current, [key]: value }));
  };

  const handleSelectRound = (round, { revealEditor = false } = {}) => {
    const nextRound = Number(round || 0);
    if (!nextRound) return;

    setSelectedRound(nextRound);

    if (revealEditor && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        workspaceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  };

  const loadDashboard = async (preferredRound = null) => {
    setDashboardLoading(true);
    setDashboardError("");

    try {
      const response = await fetchAdminDashboard(SEASON);
      const nextDashboard = response.dashboard || null;
      setDashboard(nextDashboard);

      const targetRound = preferredRound
        || selectedRound
        || nextDashboard?.currentRound?.round
        || nextDashboard?.rounds?.[0]?.round
        || 0;

      if (targetRound) {
        setSelectedRound(targetRound);
      }
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not load the admin dashboard.");
    } finally {
      setDashboardLoading(false);
    }
  };

  const loadRoundWorkspace = async (round) => {
    if (!round) return;

    setRoundLoading(true);
    setRoundError("");

    try {
      const response = await fetchRoundResults(SEASON, round);
      setRoundWorkspace(response);
      setDraftForm(response.draft || emptyDraft(round));
      setOverrideForm({
        ...emptyOverride(),
        ...(response.controls || {}),
      });
    } catch (error) {
      setRoundError(error instanceof Error ? error.message : "Could not load this round.");
      setRoundWorkspace(null);
      setDraftForm(emptyDraft(round));
      setOverrideForm(emptyOverride());
    } finally {
      setRoundLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedRound) {
      loadRoundWorkspace(selectedRound);
    }
  }, [selectedRound]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRace = useMemo(
    () => dashboard?.calendar?.find((race) => Number(race.r || 0) === Number(selectedRound || 0)) || null,
    [dashboard, selectedRound],
  );

  const selectedRoundStatus = useMemo(
    () => dashboard?.rounds?.find((row) => Number(row.round || 0) === Number(selectedRound || 0)) || null,
    [dashboard, selectedRound],
  );
  const capabilities = dashboard?.capabilities || {};
  const dashboardWarnings = Array.isArray(dashboard?.warnings) ? dashboard.warnings.filter(Boolean) : [];
  const liveRound = dashboard?.currentRound || null;
  const editingLiveRound = liveRound && Number(liveRound.round || 0) === Number(selectedRound || 0);

  if (!isAdminUser(user)) {
    return (
      <div style={{ maxWidth: 640, margin: "100px auto", textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 18 }}>LOCKED</div>
        <h2 className="stint-section-title" style={{ marginBottom: 12 }}>Admin only</h2>
        <p style={{ color: "rgba(255,255,255,0.46)", fontSize: 14 }}>This control center is only available to the local admin profile.</p>
      </div>
    );
  }

  const runAction = async (key, task, { refreshDashboard = false, refreshRound = false } = {}) => {
    setBusy(key, true);

    try {
      const response = await task();
      setActionResult(key, response);

      if (key === "import" || key === "importSprint") {
        setDraftForm(response.draft || emptyDraft(selectedRound));
      }

      if (refreshDashboard) {
        await loadDashboard(selectedRound);
      }

      if (refreshRound) {
        await loadRoundWorkspace(selectedRound);
      }
    } catch (error) {
      setActionResult(key, {
        status: "error",
        message: error instanceof Error ? error.message : "Admin action failed.",
        warnings: [],
      });
    } finally {
      setBusy(key, false);
    }
  };

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: "38px 24px 84px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ display: "grid", gap: 24 }}>
        <div
          style={{
            borderRadius: 24,
            border: PANEL_BORDER,
            background: PANEL_BG,
            padding: "24px 26px",
            display: "grid",
            gap: 18,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(255,106,26,0.12)", border: "1px solid rgba(255,194,71,0.2)", width: "fit-content" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff8a3d" }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffd166" }}>Admin Control Center</span>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <h1 style={{ fontSize: 38, lineHeight: 1.02, letterSpacing: -1.2, fontWeight: 900, margin: 0 }}>
              Run the weekend in order.
            </h1>
            <p style={{ margin: 0, maxWidth: 900, fontSize: 14, lineHeight: 1.8, color: "rgba(214,223,239,0.68)" }}>
              Pick the round you want, check the schedule, build the local result draft, publish it to the live database, then award points. News and AI are separate from scoring and should never overwrite race results.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {WORKFLOW_STEPS.map((item) => (
              <div
                key={item.step}
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "var(--btn-secondary-bg)",
                  padding: "14px 15px",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: "rgba(255,138,61,0.16)", color: "#ffd166", fontSize: 12, fontWeight: 900 }}>
                  {item.step}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{item.title}</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(214,223,239,0.62)" }}>{item.description}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                Round you are editing
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={selectedRound || ""}
                  onChange={(event) => handleSelectRound(Number(event.target.value))}
                  style={{
                    minWidth: 260,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: RADIUS_MD,
                    color: "var(--text)",
                    padding: "12px 14px",
                    fontSize: 13,
                    fontFamily: "inherit",
                  }}
                >
                  {(dashboard?.rounds || []).map((round) => (
                    <option key={round.round} value={round.round} style={{ background: "var(--bg-surface)", color: "var(--text)" }}>
                      {round.round}. {round.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => loadDashboard(selectedRound)}
                  disabled={dashboardLoading}
                  style={{
                    background: BRAND_GRADIENT,
                    border: "none",
                    borderRadius: RADIUS_MD,
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 13,
                    padding: "12px 16px",
                    cursor: "pointer",
                  }}
                >
                  {dashboardLoading ? "Refreshing..." : "Refresh dashboard"}
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
              <div style={{ fontSize: 12, color: "rgba(214,223,239,0.58)" }}>
                {dashboardLoading ? "Loading control center..." : liveRound ? `Live weekend: ${liveRound.name}` : "No live weekend"}
              </div>
              {selectedRace && liveRound && !editingLiveRound && (
                <div style={{ fontSize: 12, color: "rgba(252,211,77,0.9)" }}>
                  You are editing {selectedRace.n}, not the live weekend.
                </div>
              )}
            </div>
          </div>

          {dashboardError && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.24)", color: "#fca5a5", fontSize: 13 }}>
              {dashboardError}
            </div>
          )}
          {roundError && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.24)", color: "#fcd34d", fontSize: 13 }}>
              {roundError}
            </div>
          )}
          {dashboardWarnings.map((warning) => (
            <div
              key={warning}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.24)",
                color: "#fca5a5",
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              {warning}
            </div>
          ))}
        </div>

        {/* ── Pro subscription toggle ── */}
        {(() => {
          const isPro = proStatus === "pro";
          const canToggleProStatus = Boolean(capabilities?.hasServiceRole);
          const toggleDisabledReason = capabilities?.publishReason || "Server-side admin writes are unavailable.";

          async function handleProToggle() {
            if (!canToggleProStatus) {
              setProToggleNote(`Error: ${toggleDisabledReason}`);
              return;
            }
            const next = isPro ? "free" : "pro";
            setProToggleLoading(true);
            setProToggleNote("");
            try {
              await setAdminProStatus(next);
              setProStatus(next);
              setProToggleNote(`Switched to ${next.toUpperCase()}.`);
            } catch (err) {
              setProToggleNote(`Error: ${err.message}`);
            } finally {
              setProToggleLoading(false);
              setTimeout(() => setProToggleNote(""), 4000);
            }
          }

          return (
            <div
              style={{
                borderRadius: 16,
                border:       isPro ? "1px solid rgba(255,106,26,0.28)" : PANEL_BORDER,
                background:   isPro ? "rgba(255,106,26,0.06)" : PANEL_BG,
                padding:      "14px 18px",
                display:      "flex",
                alignItems:   "center",
                justifyContent: "space-between",
                gap:          16,
                flexWrap:     "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width:        8,
                    height:       8,
                    borderRadius: "50%",
                    background:   isPro ? "#FF6A1A" : "rgba(214,223,239,0.28)",
                    flexShrink:   0,
                  }}
                />
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: isPro ? "#FF6A1A" : SUBTLE_TEXT }}>
                    My account: {isPro ? "Stint Pro" : "Free tier"}
                  </span>
                  {proToggleNote && (
                    <span style={{ marginLeft: 10, fontSize: 11, color: "rgba(214,223,239,0.55)" }}>{proToggleNote}</span>
                  )}
                </div>
              </div>
              <button
                onClick={handleProToggle}
                disabled={proToggleLoading || !canToggleProStatus}
                title={!canToggleProStatus ? toggleDisabledReason : undefined}
                style={{
                  background:    isPro ? "rgba(239,68,68,0.12)" : BRAND_GRADIENT,
                  border:        isPro ? "1px solid rgba(239,68,68,0.28)" : "none",
                  borderRadius:  999,
                  color:         isPro ? "#fca5a5" : "#fff",
                  cursor:        (proToggleLoading || !canToggleProStatus) ? "not-allowed" : "pointer",
                  fontSize:      12,
                  fontWeight:    800,
                  padding:       "7px 16px",
                  letterSpacing: "-0.01em",
                  opacity:       canToggleProStatus ? 1 : 0.6,
                }}
              >
                {proToggleLoading ? "Saving…" : isPro ? "Switch to Free" : "Switch to Pro"}
              </button>
            </div>
          );
        })()}

        {/* ── Seed Pro Community League ── */}
        {(() => {
          async function handleSeedLeague() {
            setSeedLeagueLoading(true);
            setSeedLeagueNote("");
            try {
              const result = await seedProLeague();
              setSeedLeagueNote(result?.message || "Done.");
            } catch (err) {
              setSeedLeagueNote(`Error: ${err.message}`);
            } finally {
              setSeedLeagueLoading(false);
              setTimeout(() => setSeedLeagueNote(""), 8000);
            }
          }

          return (
            <div
              style={{
                borderRadius: 16,
                border:       PANEL_BORDER,
                background:   PANEL_BG,
                padding:      "14px 18px",
                display:      "flex",
                alignItems:   "center",
                justifyContent: "space-between",
                gap:          16,
                flexWrap:     "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(245,158,11,0.7)", flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: SUBTLE_TEXT }}>Pro Community League</span>
                  {seedLeagueNote && (
                    <span style={{ marginLeft: 10, fontSize: 11, color: "rgba(214,223,239,0.55)" }}>{seedLeagueNote}</span>
                  )}
                </div>
              </div>
              <button
                onClick={handleSeedLeague}
                disabled={seedLeagueLoading}
                style={{
                  background:    BRAND_GRADIENT,
                  border:        "none",
                  borderRadius:  999,
                  color:         "#fff",
                  cursor:        seedLeagueLoading ? "wait" : "pointer",
                  fontSize:      12,
                  fontWeight:    800,
                  padding:       "7px 16px",
                  letterSpacing: "-0.01em",
                }}
              >
                {seedLeagueLoading ? "Seeding…" : "Seed / Sync Pro League"}
              </button>
            </div>
          );
        })()}

        {/* ── Test Emails ── */}
        <TestEmailsCard defaultTo={user?.email || ""} />

        {dashboard && <CurrentRoundHealth dashboard={dashboard} />}

        <div ref={workspaceRef} style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: 18, alignItems: "start" }}>
            <ScheduleControlPanel
              race={selectedRace}
              controls={roundWorkspace?.controls}
              sessions={roundWorkspace?.sessions || []}
              syncResult={actionResults.schedule}
              overrideResult={actionResults.override}
              syncBusy={!!loadingFlags.schedule}
              overrideBusy={!!loadingFlags.override}
              onSync={() => runAction("schedule", () => syncSchedule(SEASON), { refreshDashboard: true, refreshRound: true })}
              onSaveOverride={() => runAction("override", () => saveScheduleOverride(SEASON, selectedRound, overrideForm), { refreshDashboard: true, refreshRound: true })}
              overrideForm={overrideForm}
              setOverrideForm={setOverrideForm}
            />

            <ResultsDeskPanel
              round={selectedRound}
              race={selectedRace}
              draft={roundWorkspace?.draft}
              official={roundWorkspace?.official}
              capabilities={roundWorkspace?.capabilities || capabilities}
              fetchResult={actionResults.import}
              importSprintResult={actionResults.importSprint}
              saveResult={actionResults.saveDraft}
              publishResult={actionResults.publish}
              publishSprintResult={actionResults.publishSprint}
              importBusy={!!loadingFlags.import}
              importSprintBusy={!!loadingFlags.importSprint}
              saveBusy={!!loadingFlags.saveDraft}
              publishBusy={!!loadingFlags.publish}
              publishSprintBusy={!!loadingFlags.publishSprint}
              onImport={() => runAction("import", () => importRoundResults(SEASON, selectedRound))}
              onImportSprint={() => runAction("importSprint", () => importRoundResults(SEASON, selectedRound, "sprint"))}
              onSaveDraft={() => runAction("saveDraft", () => saveRoundDraft(SEASON, selectedRound, draftForm), { refreshDashboard: true, refreshRound: true })}
              onPublish={() => runAction("publish", () => publishRoundResults(SEASON, selectedRound), { refreshDashboard: true, refreshRound: true })}
              onPublishSprint={() => runAction("publishSprint", () => publishRoundResults(SEASON, selectedRound, "sprint"), { refreshDashboard: true, refreshRound: true })}
              draftForm={draftForm}
              setDraftForm={setDraftForm}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: 18, alignItems: "start" }}>
            <ScoringPanel
              round={selectedRound}
              race={selectedRace}
              official={roundWorkspace?.official}
              latestAwardRun={roundWorkspace?.latestAwardRun || selectedRoundStatus?.latestAwardRun}
              latestPublishRun={roundWorkspace?.latestPublishRun || selectedRoundStatus?.latestPublishRun}
              capabilities={roundWorkspace?.capabilities || capabilities}
              actionResult={actionResults.award}
              sprintActionResult={actionResults.awardSprint}
              loading={!!loadingFlags.award}
              sprintLoading={!!loadingFlags.awardSprint}
              onAward={() => runAction("award", () => awardRoundPoints(SEASON, selectedRound), { refreshDashboard: true, refreshRound: true })}
              onAwardSprint={() => runAction("awardSprint", () => awardRoundPoints(SEASON, selectedRound, "sprint"), { refreshDashboard: true, refreshRound: true })}
            />

            <NewsAiPanel
              currentRound={dashboard?.currentRound}
              latestRuns={dashboard?.latestRuns}
              latestInsight={dashboard?.latestInsight}
              capabilities={capabilities}
              newsResult={actionResults.news}
              aiResult={actionResults.ai}
              replayResult={actionResults.aiReplay}
              repairResult={actionResults.aiRepair}
              newsBusy={!!loadingFlags.news}
              aiBusy={!!loadingFlags.ai}
              replayBusy={!!loadingFlags.aiReplay}
              repairBusy={!!loadingFlags.aiRepair}
              onSyncNews={() => runAction("news", () => syncNewsFeed(SEASON), { refreshDashboard: true })}
              onBackfillReplay={() => runAction("aiReplay", () => backfillAiReplayHistory(SEASON), { refreshDashboard: true })}
              onRepairAi={() => runAction("aiRepair", () => repairAiLiveData(SEASON), { refreshDashboard: true })}
              onGenerateAi={() => runAction("ai", () => generateAiBrief(SEASON), { refreshDashboard: true })}
            />
          </div>

          <CoverageHealthPanel
            coverage={dashboard?.coverage}
            latestRuns={dashboard?.latestRuns}
            capabilities={capabilities}
            actionResult={actionResults.history}
            loading={!!loadingFlags.history}
            onBackfill={() => runAction("history", () => backfillHistory(SEASON), { refreshDashboard: true })}
          />
        </div>

        {dashboard && (
          <RoundStatusTable
            rounds={dashboard.rounds || []}
            selectedRound={selectedRound}
            onSelectRound={(round) => handleSelectRound(round, { revealEditor: true })}
          />
        )}

        {(dashboardLoading || roundLoading) && (
          <div style={{ fontSize: 13, color: "rgba(214,223,239,0.58)" }}>
            {dashboardLoading ? "Refreshing dashboard..." : "Loading round workspace..."}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TestEmailsCard ────────────────────────────────────────────────
// Inline admin card for firing any email template at any address. Used
// to QA template copy, dark-mode rendering, DKIM/SPF alignment, and the
// List-Unsubscribe one-click flow without waiting for a real signup or
// scoring run.

const TEMPLATE_OPTIONS = [
  { value: "welcome",       label: "Welcome (new signup)",        variants: [] },
  { value: "pick_reminder", label: "Pick reminder",                variants: ["24h_zero", "24h_incomplete", "3h_zero", "3h_incomplete"] },
  { value: "results",       label: "Results published",            variants: ["scored", "zero"] },
  { value: "pro_welcome",   label: "Pro welcome (post-checkout)",  variants: [] },
  { value: "insight_ready", label: "AI insight ready (Pro)",       variants: ["post_race", "pre_race", "monthly"] },
  { value: "receipt",       label: "Pro receipt (after renewal)",  variants: [] },
  { value: "cancellation",  label: "Pro cancellation",             variants: [] },
];

function TestEmailsCard({ defaultTo = "" }) {
  const [to, setTo]             = useState(defaultTo);
  const [template, setTemplate] = useState("welcome");
  const [variant, setVariant]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [note, setNote]         = useState(null);

  const currentTemplate = TEMPLATE_OPTIONS.find((t) => t.value === template) || TEMPLATE_OPTIONS[0];
  const variantOptions  = currentTemplate.variants;

  // Reset variant whenever template changes (variants don't carry over)
  useEffect(() => {
    setVariant(variantOptions[0] || "");
  }, [template]); // eslint-disable-line

  async function handleSend() {
    if (!to.trim()) {
      setNote({ kind: "error", text: "Enter an email address first." });
      return;
    }
    setLoading(true);
    setNote(null);
    try {
      const result = await sendTestEmail({ to: to.trim(), template, variant: variant || null });
      if (result?.ok) {
        setNote({ kind: "success", text: `Sent — Resend id ${result.resend_id?.slice(0, 8) || "?"}…` });
      } else {
        setNote({ kind: "error", text: result?.error || "Unknown send failure." });
      }
    } catch (err) {
      setNote({ kind: "error", text: err?.message || "Request failed." });
    } finally {
      setLoading(false);
      setTimeout(() => setNote(null), 10000);
    }
  }

  return (
    <div
      style={{
        borderRadius: 16,
        border:       PANEL_BORDER,
        background:   PANEL_BG,
        padding:      "16px 18px",
        display:      "grid",
        gap:          12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(96,165,250,0.7)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: SUBTLE_TEXT, letterSpacing: "0.06em", textTransform: "uppercase" }}>Test emails</span>
        {note && (
          <span style={{
            marginLeft: "auto",
            fontSize:   11,
            color:      note.kind === "success" ? "rgba(74,222,128,0.85)" : "rgba(248,113,113,0.85)",
          }}>
            {note.text}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr 1fr auto", gap: 10, alignItems: "center" }}>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          style={{
            padding:      "9px 12px",
            borderRadius: 8,
            border:       PANEL_BORDER,
            background:   "rgba(8,12,20,0.4)",
            color:        "#fff",
            fontSize:     13,
            fontWeight:   600,
            fontFamily:   "inherit",
            outline:      "none",
          }}
        />

        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          style={{
            padding:      "9px 12px",
            borderRadius: 8,
            border:       PANEL_BORDER,
            background:   "rgba(8,12,20,0.4)",
            color:        "#fff",
            fontSize:     13,
            fontWeight:   600,
            fontFamily:   "inherit",
            outline:      "none",
            cursor:       "pointer",
          }}
        >
          {TEMPLATE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value} style={{ background: "#0d1929" }}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          disabled={variantOptions.length === 0}
          style={{
            padding:      "9px 12px",
            borderRadius: 8,
            border:       PANEL_BORDER,
            background:   "rgba(8,12,20,0.4)",
            color:        variantOptions.length === 0 ? "rgba(214,223,239,0.32)" : "#fff",
            fontSize:     13,
            fontWeight:   600,
            fontFamily:   "inherit",
            outline:      "none",
            cursor:       variantOptions.length === 0 ? "default" : "pointer",
          }}
        >
          {variantOptions.length === 0 ? (
            <option value="">— no variants —</option>
          ) : (
            variantOptions.map((v) => (
              <option key={v} value={v} style={{ background: "#0d1929" }}>{v}</option>
            ))
          )}
        </select>

        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            background:    BRAND_GRADIENT,
            border:        "none",
            borderRadius:  999,
            color:         "#fff",
            cursor:        loading ? "wait" : "pointer",
            fontSize:      12,
            fontWeight:    800,
            padding:       "9px 20px",
            letterSpacing: "-0.01em",
            whiteSpace:    "nowrap",
          }}
        >
          {loading ? "Sending…" : "Send test"}
        </button>
      </div>
    </div>
  );
}
