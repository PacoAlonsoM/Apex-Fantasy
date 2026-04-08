import AdminCard from "./AdminCard";
import AdminPill from "./AdminPill";
import { formatStamp, statusTone } from "../formatters";

function cellStyle() {
  return {
    padding: "12px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontSize: 12,
    color: "rgba(214,223,239,0.72)",
    verticalAlign: "top",
  };
}

export default function RoundStatusTable({ rounds = [], selectedRound = null, onSelectRound }) {
  return (
    <AdminCard
      eyebrow="Round By Round Status"
      title="All rounds at a glance"
      description="Use this table when you want to jump to another round and see what is still missing."
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
          <thead>
            <tr>
              {["Round", "Schedule", "Race Lock", "Draft", "Official", "Scoring", "History", "Action"].map((label) => (
                <th
                  key={label}
                  style={{
                    ...cellStyle(),
                    textAlign: "left",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(214,223,239,0.44)",
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((row) => {
              const isSelected = Number(selectedRound || 0) === Number(row.round || 0);
              const selectedBackground = isSelected ? "rgba(255,138,61,0.05)" : "transparent";

              return (
                <tr key={row.round}>
                  <td style={{ ...cellStyle(), background: selectedBackground }}>
                    <div style={{ fontWeight: 800, color: "#fff", marginBottom: 4 }}>
                      {row.round}. {row.name}
                    </div>
                    <div>{row.date}</div>
                  </td>
                  <td style={{ ...cellStyle(), background: selectedBackground }}>
                    <AdminPill label={row.schedule?.ready ? "Synced" : "Missing"} tone={row.schedule?.ready ? "ok" : "error"} />
                  </td>
                  <td style={{ ...cellStyle(), background: selectedBackground }}>
                    {row.schedule?.raceLockAt ? formatStamp(row.schedule.raceLockAt) : "No lock"}
                  </td>
                  <td style={{ ...cellStyle(), background: selectedBackground }}>
                    <AdminPill label={row.draftStatus || "missing"} tone={statusTone(row.draftStatus)} />
                  </td>
                  <td style={{ ...cellStyle(), background: selectedBackground }}>
                    <AdminPill label={row.officialPublished ? "Published" : "Pending"} tone={row.officialPublished ? "ok" : "partial"} />
                  </td>
                  <td style={{ ...cellStyle(), background: selectedBackground }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <AdminPill label={row.scoreStatus} tone={statusTone(row.scoreStatus)} />
                      <div>{row.scoredCount || 0}/{row.predictionCount || 0} scored</div>
                    </div>
                  </td>
                  <td style={{ ...cellStyle(), background: selectedBackground }}>
                    <AdminPill label={row.historyReady ? "Ready" : "Missing"} tone={row.historyReady ? "ok" : "partial"} />
                  </td>
                  <td style={{ ...cellStyle(), background: selectedBackground }}>
                    <button
                      type="button"
                      onClick={() => onSelectRound?.(row.round)}
                      aria-pressed={isSelected}
                      style={{
                        background: isSelected ? "linear-gradient(135deg, #ff8a3d 0%, #ffb347 100%)" : "rgba(255,255,255,0.06)",
                        border: isSelected ? "1px solid rgba(255,194,71,0.4)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 999,
                        color: isSelected ? "#0f172a" : "#fff",
                        cursor: "pointer",
                        fontWeight: 800,
                        fontSize: 11,
                        padding: "8px 12px",
                      }}
                    >
                      {isSelected ? "Jump to editor" : "Open round"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}
