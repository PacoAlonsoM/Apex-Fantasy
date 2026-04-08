import AdminActionResult from "./AdminActionResult";
import AdminCard from "./AdminCard";
import AdminPill from "./AdminPill";
import { buttonStyle, formatStamp } from "../formatters";

export default function ScoringPanel({ round, official, latestAwardRun, latestPublishRun, capabilities, actionResult, loading, onAward }) {
  const stale = latestPublishRun && latestAwardRun
    ? new Date(latestAwardRun.updatedAt).getTime() < new Date(latestPublishRun.updatedAt).getTime()
    : !!latestPublishRun && !latestAwardRun;
  const awardBlockedReason = capabilities?.canAwardPoints ? "" : capabilities?.awardPointsReason || "";

  return (
    <AdminCard
      eyebrow="3. Scoring"
      title="Award points"
      description="Only do this after the official result looks right. If you republish corrected results later, this panel will tell you to score the round again."
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
              Round {round || "—"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <AdminPill label={official?.results_entered ? "Official result published" : "Waiting for publish"} tone={official?.results_entered ? "ok" : "partial"} />
              {stale && <AdminPill label="Needs re-award" tone="partial" />}
            </div>
          </div>
          <button type="button" onClick={onAward} disabled={loading || !official?.results_entered || !!awardBlockedReason} style={buttonStyle()}>
            {loading ? "Awarding..." : "Award points"}
          </button>
        </div>

        {awardBlockedReason && (
          <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.6 }}>
            {awardBlockedReason}
          </div>
        )}

        <div style={{ display: "grid", gap: 8, fontSize: 12, color: "rgba(214,223,239,0.72)" }}>
          <div>Latest publish: {latestPublishRun?.updatedAt ? formatStamp(latestPublishRun.updatedAt) : "Not yet"}</div>
          <div>Latest award: {latestAwardRun?.updatedAt ? formatStamp(latestAwardRun.updatedAt) : "Not yet"}</div>
        </div>

        <div style={{ fontSize: 12, color: "rgba(214,223,239,0.62)" }}>
          This recalculates scores from the current published database row only.
        </div>

        <AdminActionResult result={actionResult} />
      </div>
    </AdminCard>
  );
}
