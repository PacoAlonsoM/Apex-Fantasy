import AdminActionResult from "./AdminActionResult";
import AdminCard from "./AdminCard";
import AdminPill from "./AdminPill";
import { buttonStyle, formatStamp } from "../formatters";

export default function NewsAiPanel({
  currentRound,
  latestRuns,
  latestInsight,
  capabilities,
  newsResult,
  aiResult,
  repairResult,
  newsBusy,
  aiBusy,
  repairBusy,
  onSyncNews,
  onRepairAi,
  onGenerateAi,
}) {
  const aiReady = !!latestRuns?.news || !!latestInsight;
  const aiBlockedReason = capabilities?.canGenerateBrief ? "" : capabilities?.generateBriefReason || "";
  const latestBriefMode = String(latestInsight?.provider || latestInsight?.metadata?.generation_mode || "").trim().toLowerCase();
  const latestBriefTone = latestBriefMode === "openai" ? "ok" : latestBriefMode === "fallback" ? "partial" : "info";
  const latestBriefLabel = latestBriefMode === "openai"
    ? `OpenAI${latestInsight?.model ? ` · ${latestInsight.model}` : ""}`
    : latestBriefMode === "fallback"
      ? "Fallback brief"
      : "Mode unknown";
  const fallbackNote = latestInsight?.metadata?.fallback_note || null;
  const aiExecutionMode = String(capabilities?.aiExecutionMode || "").trim().toLowerCase();
  const aiExecutionWarning = capabilities?.aiExecutionWarning || "";
  const aiExecutionLabel = aiExecutionMode === "local-openai"
    ? "Local OpenAI"
    : aiExecutionMode === "remote-openai-proxy"
      ? "Remote AI proxy"
      : "";
  const aiExecutionTone = aiExecutionMode === "local-openai" ? "ok" : aiExecutionMode === "remote-openai-proxy" ? "partial" : "info";
  const researchSourceCount = Array.isArray(latestInsight?.metadata?.research_sources)
    ? latestInsight.metadata.research_sources.length
    : 0;
  const freshnessStatus = String(latestInsight?.metadata?.freshness_status || "").trim().toLowerCase();
  const freshnessReason = latestInsight?.metadata?.stale_reason || "";
  const freshnessTone = freshnessStatus === "stale" ? "partial" : freshnessStatus === "fresh" ? "ok" : "idle";
  const freshnessLabel = freshnessStatus === "stale"
    ? "Brief needs refresh"
    : freshnessStatus === "fresh"
      ? "Brief synced to results"
      : "";

  return (
    <AdminCard
      eyebrow="4. News & AI"
      title="Refresh the wire and the brief"
      description="Use this when you want fresh user-facing news or a new AI brief for the next race."
    >
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>News ingest</div>
              <div style={{ fontSize: 12, color: "rgba(214,223,239,0.62)" }}>
                Latest run: {latestRuns?.news?.finished_at ? formatStamp(latestRuns.news.finished_at) : "Not yet"}
              </div>
            </div>
            <button type="button" onClick={onSyncNews} disabled={newsBusy} style={buttonStyle()}>
              {newsBusy ? "Syncing feed..." : "Sync news feed"}
            </button>
          </div>
          <AdminActionResult result={newsResult} />
        </div>

        <div style={{ paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
                AI brief for {currentRound?.name || "upcoming round"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <AdminPill label={latestInsight?.headline ? "Existing brief found" : "No current brief"} tone={latestInsight?.headline ? "ok" : "partial"} />
                <AdminPill label={aiReady ? "Sources ready" : "Can still generate"} tone={aiReady ? "ok" : "partial"} />
                {latestInsight?.headline && <AdminPill label={latestBriefLabel} tone={latestBriefTone} />}
                {freshnessLabel && <AdminPill label={freshnessLabel} tone={freshnessTone} />}
                {aiExecutionLabel && <AdminPill label={aiExecutionLabel} tone={aiExecutionTone} />}
                {researchSourceCount > 0 && <AdminPill label={`Live web x${researchSourceCount}`} tone="ok" />}
              </div>
              <div style={{ fontSize: 12, color: "rgba(214,223,239,0.62)" }}>
                Latest brief: {latestInsight?.generated_at ? formatStamp(latestInsight.generated_at) : "Not yet"}
              </div>
              {aiExecutionWarning && (
                <div style={{ fontSize: 12, color: "#fcd34d", lineHeight: 1.6 }}>
                  {aiExecutionWarning}
                </div>
              )}
              {fallbackNote && (
                <div style={{ fontSize: 12, color: "#fcd34d", lineHeight: 1.6 }}>
                  {fallbackNote}
                </div>
              )}
              {freshnessStatus === "stale" && freshnessReason && (
                <div style={{ fontSize: 12, color: "#fcd34d", lineHeight: 1.6 }}>
                  {freshnessReason}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {onRepairAi && (
                <button type="button" onClick={onRepairAi} disabled={repairBusy || aiBusy || !!aiBlockedReason} style={buttonStyle({ emphasis: "secondary" })}>
                  {repairBusy ? "Repairing..." : "Repair AI truth data"}
                </button>
              )}
              <button type="button" onClick={onGenerateAi} disabled={aiBusy || repairBusy || !!aiBlockedReason} style={buttonStyle()}>
                {aiBusy ? "Generating..." : "Generate AI brief"}
              </button>
            </div>
          </div>
          {aiBlockedReason && (
            <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.6 }}>
              {aiBlockedReason}
            </div>
          )}
          <div style={{ fontSize: 12, color: "rgba(214,223,239,0.62)" }}>
            This generates the saved brief for the next race from the latest news plus the AI history dataset.
          </div>
          <AdminActionResult result={repairResult} />
          <AdminActionResult result={aiResult} />
        </div>
      </div>
    </AdminCard>
  );
}
