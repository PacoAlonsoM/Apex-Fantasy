import AdminActionResult from "./AdminActionResult";
import AdminCard from "./AdminCard";
import AdminPill from "./AdminPill";
import { buttonStyle, formatStamp } from "../formatters";
import { CAL } from "@/src/constants/calendar";

function hasSprintResult(official) {
  return Boolean(official?.sp_pole && official?.sp_winner && official?.sp_p2 && official?.sp_p3);
}

function isCanonicalSprintRound(round, race) {
  const raceRound = Number(round || race?.r || race?.round || 0);
  return Boolean(race?.sprint || CAL.find((item) => Number(item.r || 0) === raceRound)?.sprint);
}

export default function ScoringPanel({
  round,
  race,
  official,
  latestAwardRun,
  latestPublishRun,
  capabilities,
  actionResult,
  sprintActionResult,
  loading,
  sprintLoading,
  onAward,
  onAwardSprint,
}) {
  const stale = latestPublishRun && latestAwardRun
    ? new Date(latestAwardRun.updatedAt).getTime() < new Date(latestPublishRun.updatedAt).getTime()
    : !!latestPublishRun && !latestAwardRun;
  const awardBlockedReason = capabilities?.canAwardPoints ? "" : capabilities?.awardPointsReason || "";
  const sprintRound = isCanonicalSprintRound(round, race) || hasSprintResult(official);
  const sprintReady = hasSprintResult(official);
  const sprintDisabledReason = !sprintRound
    ? "This round does not have a sprint."
    : !sprintReady
      ? "Publish the sprint result first."
      : awardBlockedReason;

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
              {sprintRound && sprintReady && !official?.results_entered && <AdminPill label="Sprint result ready" tone="partial" />}
              {stale && <AdminPill label="Needs re-award" tone="partial" />}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {sprintRound && (
              <button
                type="button"
                onClick={onAwardSprint}
                disabled={sprintLoading || loading || !!sprintDisabledReason}
                title={sprintDisabledReason || undefined}
                style={buttonStyle({ emphasis: "secondary" })}
              >
                {sprintLoading ? "Awarding sprint..." : "Award sprint only"}
              </button>
            )}
            <button type="button" onClick={onAward} disabled={loading || sprintLoading || !official?.results_entered || !!awardBlockedReason} style={buttonStyle()}>
              {loading ? "Awarding..." : "Award full round"}
            </button>
          </div>
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
          Sprint-only scoring uses only sprint fields before the GP is published. If the GP is already published, it repairs the full-round score with the sprint fields included, so points are added as a delta instead of double counted.
        </div>

        <AdminActionResult result={sprintActionResult} />
        <AdminActionResult result={actionResult} />
      </div>
    </AdminCard>
  );
}
