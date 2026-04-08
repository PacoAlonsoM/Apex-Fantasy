import AdminActionResult from "./AdminActionResult";
import AdminCard from "./AdminCard";
import { buttonStyle, formatStamp } from "../formatters";

function Metric({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        padding: "14px 15px",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(214,223,239,0.46)" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{value}</div>
    </div>
  );
}

function formatRaceDate(value) {
  if (!value) return "Date unavailable";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

function historyMeta(entry) {
  const parts = [];
  if (entry.finishersCount) parts.push(`${entry.finishersCount} finishers`);
  if (entry.dnfCount) parts.push(`${entry.dnfCount} DNF${entry.dnfCount === 1 ? "" : "s"}`);
  if (entry.safetyCar) parts.push("Safety Car");
  if (entry.redFlag) parts.push("Red Flag");
  return parts.join(" • ") || "Core history fields synced";
}

export default function CoverageHealthPanel({ coverage, latestRuns, capabilities, actionResult, loading, onBackfill }) {
  const backfillBlockedReason = capabilities?.canBackfillHistory ? "" : capabilities?.backfillHistoryReason || "";

  return (
    <AdminCard
      eyebrow="5. AI History"
      title="Keep 2026 coverage complete"
      description="This only feeds the AI side. It should never change official race results or awarded points."
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
          <Metric label="History Rounds" value={coverage?.completedHistoryRounds || 0} />
          <Metric label="Published Results" value={coverage?.publishedResults || 0} />
          <Metric label="Saved Drafts" value={coverage?.savedDrafts || 0} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Backfill AI history</div>
            <div style={{ fontSize: 12, color: "rgba(214,223,239,0.62)" }}>
              Last history refresh: {latestRuns?.history?.updatedAt ? formatStamp(latestRuns.history.updatedAt) : "Not yet"}
            </div>
          </div>
          <button type="button" onClick={onBackfill} disabled={loading || !!backfillBlockedReason} style={buttonStyle()}>
            {loading ? "Backfilling..." : "Backfill 2026 history"}
          </button>
        </div>

        {backfillBlockedReason && (
          <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.6 }}>
            {backfillBlockedReason}
          </div>
        )}

        <AdminActionResult result={actionResult} />

        {coverage?.historyEntries?.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(214,223,239,0.46)" }}>
              Synced history entries
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              {coverage.historyEntries.slice(0, 8).map((entry) => (
                <div
                  key={`history-${entry.round}`}
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    padding: "14px 15px",
                    display: "grid",
                    gap: 7,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                      {entry.round}. {entry.name || `Round ${entry.round}`}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(214,223,239,0.54)" }}>
                      {formatRaceDate(entry.date)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(214,223,239,0.62)" }}>
                    Synced {entry.updatedAt ? formatStamp(entry.updatedAt) : "recently"}
                  </div>
                  <div style={{ fontSize: 12, color: "#fff" }}>
                    Winner: {entry.winner || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(214,223,239,0.78)" }}>
                    Pole: {entry.pole || "—"}
                  </div>
                  {entry.podium?.length ? (
                    <div style={{ fontSize: 12, color: "rgba(214,223,239,0.78)" }}>
                      Podium: {entry.podium.join(" • ")}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 12, color: "rgba(214,223,239,0.62)" }}>
                    {historyMeta(entry)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {coverage?.missingHistoryRounds?.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(214,223,239,0.46)" }}>
              Missing history rounds
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {coverage.missingHistoryRounds.map((item) => (
                <span
                  key={`${item.round}-${item.name}`}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(245,158,11,0.22)",
                    background: "rgba(245,158,11,0.12)",
                    color: "#fcd34d",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {item.round}. {item.name}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(214,223,239,0.62)" }}>
            Every round currently has AI history coverage.
          </div>
        )}
      </div>
    </AdminCard>
  );
}
