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
        <h2 style={{ fontWeight: 900, fontSize: 24, marginBottom: 12 }}>Admin only</h2>
        <p style={{ color: "rgba(255,255,255,0.46)", fontSize: 14 }}>This control center is only available to the local admin profile.</p>
      </div>
    );
  }

  const runAction = async (key, task, { refreshDashboard = false, refreshRound = false } = {}) => {
    setBusy(key, true);

    try {
      const response = await task();
      setActionResult(key, response);

      if (key === "import") {
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
                  background: "rgba(255,255,255,0.03)",
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
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: RADIUS_MD,
                    color: "#fff",
                    padding: "12px 14px",
                    fontSize: 13,
                    fontFamily: "inherit",
                  }}
                >
                  {(dashboard?.rounds || []).map((round) => (
                    <option key={round.round} value={round.round} style={{ background: "#08111d" }}>
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
              race={selectedRace}
              draft={roundWorkspace?.draft}
              official={roundWorkspace?.official}
              capabilities={roundWorkspace?.capabilities || capabilities}
              fetchResult={actionResults.import}
              saveResult={actionResults.saveDraft}
              publishResult={actionResults.publish}
              importBusy={!!loadingFlags.import}
              saveBusy={!!loadingFlags.saveDraft}
              publishBusy={!!loadingFlags.publish}
              onImport={() => runAction("import", () => importRoundResults(SEASON, selectedRound))}
              onSaveDraft={() => runAction("saveDraft", () => saveRoundDraft(SEASON, selectedRound, draftForm), { refreshDashboard: true, refreshRound: true })}
              onPublish={() => runAction("publish", () => publishRoundResults(SEASON, selectedRound), { refreshDashboard: true, refreshRound: true })}
              draftForm={draftForm}
              setDraftForm={setDraftForm}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: 18, alignItems: "start" }}>
            <ScoringPanel
              round={selectedRound}
              official={roundWorkspace?.official}
              latestAwardRun={roundWorkspace?.latestAwardRun || selectedRoundStatus?.latestAwardRun}
              latestPublishRun={roundWorkspace?.latestPublishRun || selectedRoundStatus?.latestPublishRun}
              capabilities={roundWorkspace?.capabilities || capabilities}
              actionResult={actionResults.award}
              loading={!!loadingFlags.award}
              onAward={() => runAction("award", () => awardRoundPoints(SEASON, selectedRound), { refreshDashboard: true, refreshRound: true })}
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
