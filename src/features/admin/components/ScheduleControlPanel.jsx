import AdminCard from "./AdminCard";
import AdminActionResult from "./AdminActionResult";
import AdminPill from "./AdminPill";
import { buttonStyle, fieldLabelStyle, formatDateTimeLocalInput, formatStamp, fromLocalDateTimeInput, inputStyle } from "../formatters";

function sessionTitle(session) {
  return session?.session_name || String(session?.session_type || "").replace(/_/g, " ");
}

export default function ScheduleControlPanel({
  race,
  controls,
  sessions = [],
  syncResult,
  overrideResult,
  syncBusy,
  overrideBusy,
  onSync,
  onSaveOverride,
  overrideForm,
  setOverrideForm,
}) {
  return (
    <AdminCard
      eyebrow="1. Schedule"
      title="Keep weekend timing correct"
      description="Use this first if a session time moved, a round was postponed, or picks need a manual lock adjustment."
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{race?.n || "Select a round"}</div>
            <div style={{ fontSize: 12, color: "rgba(214,223,239,0.62)" }}>
              {sessions.length ? `${sessions.length} sessions synced locally` : "No session sync stored yet"}
            </div>
          </div>
          <button type="button" onClick={onSync} disabled={syncBusy} style={buttonStyle()}>
            {syncBusy ? "Syncing schedule..." : "Sync schedule"}
          </button>
        </div>

        <AdminActionResult result={syncResult} />

        <div style={{ display: "grid", gap: 10 }}>
          {sessions.length ? sessions.map((session) => (
            <div
              key={`${session.session_type}-${session.scheduled_start}`}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: "12px 14px",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{sessionTitle(session)}</div>
                <AdminPill label={session.status || "scheduled"} tone={session.status === "completed" ? "ok" : session.status === "live" ? "partial" : "info"} />
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(214,223,239,0.7)" }}>
                {session.scheduled_start ? formatStamp(session.scheduled_start) : "Time unavailable"}
              </div>
            </div>
          )) : (
            <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(214,223,239,0.62)" }}>
              Run schedule sync once so the app has session-level weekend timing for lock calculation.
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={fieldLabelStyle}>Event Status Override</div>
            <select
              value={overrideForm?.event_status_override || ""}
              onChange={(event) => setOverrideForm((current) => ({ ...current, event_status_override: event.target.value || null }))}
              style={inputStyle}
            >
              <option value="">No local override</option>
              <option value="scheduled">Scheduled</option>
              <option value="postponed">Postponed</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={fieldLabelStyle}>Race Lock Override</div>
              <input
                type="datetime-local"
                value={overrideForm?.race_lock_override_at ? formatDateTimeLocalInput(overrideForm.race_lock_override_at) : ""}
                onChange={(event) => setOverrideForm((current) => ({ ...current, race_lock_override_at: fromLocalDateTimeInput(event.target.value) }))}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={fieldLabelStyle}>Sprint Lock Override</div>
              <input
                type="datetime-local"
                value={overrideForm?.sprint_lock_override_at ? formatDateTimeLocalInput(overrideForm.sprint_lock_override_at) : ""}
                onChange={(event) => setOverrideForm((current) => ({ ...current, sprint_lock_override_at: fromLocalDateTimeInput(event.target.value) }))}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={fieldLabelStyle}>Admin Note</div>
            <input
              value={overrideForm?.admin_note || ""}
              onChange={(event) => setOverrideForm((current) => ({ ...current, admin_note: event.target.value }))}
              placeholder="Why this override exists"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={onSaveOverride} disabled={overrideBusy} style={buttonStyle()}>
              {overrideBusy ? "Saving override..." : "Save local controls"}
            </button>
            {controls && (
              <div style={{ fontSize: 12, color: "rgba(214,223,239,0.6)" }}>
                Current override updated {formatStamp(controls.updatedAt || controls.updated_at)}
              </div>
            )}
          </div>

          <AdminActionResult result={overrideResult} />
        </div>
      </div>
    </AdminCard>
  );
}
