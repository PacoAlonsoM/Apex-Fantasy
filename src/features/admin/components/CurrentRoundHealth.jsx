import AdminCard from "./AdminCard";
import AdminPill from "./AdminPill";
import { formatStamp, statusTone } from "../formatters";

function HealthMetric({ label, value, tone }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        padding: "14px 15px",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(214,223,239,0.46)" }}>
        {label}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#fff" }}>{value || "Missing"}</div>
        <AdminPill label={tone === "ok" ? "Ready" : tone === "partial" ? "Watch" : "Missing"} tone={tone} />
      </div>
    </div>
  );
}

export default function CurrentRoundHealth({ dashboard }) {
  const round = dashboard?.currentRound;
  const health = dashboard?.health || {};

  return (
    <AdminCard
      eyebrow="Current Round Health"
      title={round ? `${round.name}` : "Current round unavailable"}
      description="This is the live weekend checklist: timing, lock state, published results, scoring, news freshness, and the latest brief."
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <HealthMetric label="Schedule" value={round?.schedule?.sessionCount ? `${round.schedule.sessionCount} sessions synced` : "No synced sessions yet"} tone={round?.schedule?.ready ? "ok" : "error"} />
        <HealthMetric label="Next Race Lock" value={health?.nextLockAt ? formatStamp(health.nextLockAt) : "No race lock set"} tone={health?.nextLockAt ? "ok" : "partial"} />
        <HealthMetric label="News Feed" value={health?.newsFreshness ? `Updated ${formatStamp(health.newsFreshness)}` : "No recent ingest"} tone={health?.newsFreshness ? "ok" : "partial"} />
        <HealthMetric label="Results" value={health?.resultsStatus ? String(health.resultsStatus).replace(/_/g, " ") : "No draft"} tone={statusTone(health?.resultsStatus)} />
        <HealthMetric label="Scoring" value={health?.scoringStatus ? String(health.scoringStatus).replace(/_/g, " ") : "Pending"} tone={statusTone(health?.scoringStatus)} />
        <HealthMetric label="AI Brief" value={health?.aiBriefStatus ? `Generated ${formatStamp(health.aiBriefStatus)}` : "No brief yet"} tone={health?.aiBriefStatus ? "ok" : "partial"} />
        <HealthMetric label="Admin Writes" value={health?.adminWriteReason || "Server-side admin writes are enabled."} tone={health?.adminWriteStatus === "ready" ? "ok" : "error"} />
      </div>
    </AdminCard>
  );
}
