import AdminActionResult from "./AdminActionResult";
import AdminCard from "./AdminCard";
import AdminPill from "./AdminPill";
import { buttonStyle, fieldLabelStyle, inputStyle, formatStamp } from "../formatters";
import { CONSTRUCTORS, DRV } from "@/src/constants/teams";

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

const DRIVER_LOOKUP = new Map();
DRV.forEach((driver) => {
  DRIVER_LOOKUP.set(normalizeKey(driver.n), driver.n);
  DRIVER_LOOKUP.set(normalizeKey(driver.s), driver.n);
});

function canonicalDriverName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return DRIVER_LOOKUP.get(normalizeKey(trimmed)) || trimmed;
}

function canonicalDriverList(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => canonicalDriverName(value))
    .filter((value) => {
      const key = normalizeKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function valueRow(label, value) {
  return { label, value: value || "—" };
}

function payloadRows(payload = {}) {
  return [
    valueRow("Winner", payload.winner),
    valueRow("P2", payload.p2),
    valueRow("P3", payload.p3),
    valueRow("Pole", payload.pole),
    valueRow("Fastest Lap", payload.fastest_lap),
    valueRow("Driver of the Day", payload.dotd),
    valueRow("Best Constructor", payload.best_constructor),
    valueRow("DNF", Array.isArray(payload.dnf_list) && payload.dnf_list.length ? payload.dnf_list.join(", ") : payload.dnf),
    valueRow("Safety Car", typeof payload.safety_car === "boolean" ? (payload.safety_car ? "Yes" : "No") : null),
    valueRow("Red Flag", typeof payload.red_flag === "boolean" ? (payload.red_flag ? "Yes" : "No") : null),
  ];
}

function buildDriverOptions(payload = {}, official = null) {
  const names = [];
  const seen = new Set();
  const add = (value) => {
    const canonical = canonicalDriverName(value);
    const key = normalizeKey(canonical);
    if (!canonical || !key || seen.has(key)) return;
    seen.add(key);
    names.push(canonical);
  };

  DRV.forEach((driver) => add(driver.n));
  (payload.raw_results || []).forEach((row) => add(row?.driver));
  [
    payload.winner,
    payload.p2,
    payload.p3,
    payload.pole,
    payload.fastest_lap,
    payload.dotd,
    ...(payload.dnf_list || []),
    official?.winner,
    official?.p2,
    official?.p3,
    official?.pole,
    official?.fastest_lap,
    official?.dotd,
    ...(official?.dnf_list || []),
  ].forEach(add);

  return names.map((name) => {
    const driver = DRV.find((item) => item.n === name);
    return {
      value: name,
      label: driver ? `${driver.n} · ${driver.t}` : name,
    };
  });
}

function rowsDiffer(left = {}, right = {}) {
  const normalize = (payload) => ({
    winner: canonicalDriverName(payload?.winner),
    p2: canonicalDriverName(payload?.p2),
    p3: canonicalDriverName(payload?.p3),
    pole: canonicalDriverName(payload?.pole),
    fastest_lap: canonicalDriverName(payload?.fastest_lap),
    dotd: canonicalDriverName(payload?.dotd),
    best_constructor: String(payload?.best_constructor || "").trim(),
    safety_car: !!payload?.safety_car,
    red_flag: !!payload?.red_flag,
    dnf_list: canonicalDriverList(payload?.dnf_list || []),
  });

  return JSON.stringify(normalize(left)) !== JSON.stringify(normalize(right));
}

function SelectField({ label, value, options, placeholder, onChange }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={fieldLabelStyle}>{label}</div>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} style={inputStyle}>
        <option value="">{placeholder || "Select an option"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} style={{ background: "#08111d" }}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function BooleanToggleField({ label, value, onChange }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[{ key: true, label: "Yes" }, { key: false, label: "No" }].map((option) => {
          const active = value === option.key;
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange(option.key)}
              style={{
                ...buttonStyle({ emphasis: active ? "primary" : "secondary" }),
                minWidth: 76,
                opacity: active ? 1 : 0.82,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryGrid({ payload, tone = "default" }) {
  const isPublished = tone === "published";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
      {payloadRows(payload).map((item) => (
        <div
          key={`${tone}-${item.label}`}
          style={{
            borderRadius: 12,
            border: isPublished ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.08)",
            background: isPublished ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
            padding: "12px 14px",
            display: "grid",
            gap: 5,
            alignContent: "start",
          }}
        >
          <div style={fieldLabelStyle}>{item.label}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.5, wordBreak: "break-word" }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function ResultsDeskPanel({
  race,
  draft,
  official,
  capabilities,
  fetchResult,
  saveResult,
  publishResult,
  importBusy,
  saveBusy,
  publishBusy,
  onImport,
  onSaveDraft,
  onPublish,
  draftForm,
  setDraftForm,
}) {
  const payload = draftForm?.payload || draft?.payload || {};
  const manualFields = draft?.publishedSnapshot?.manualFields || official?.manualFields || [];
  const driverOptions = buildDriverOptions(payload, official);
  const constructorOptions = CONSTRUCTORS.map((team) => ({ value: team, label: team }));
  const selectedDnfDrivers = canonicalDriverList(payload.dnf_list || []);
  const publishStateIsStale = official?.results_entered && rowsDiffer(payload, official);
  const publishBlockedReason = capabilities?.canPublishResults ? "" : capabilities?.publishReason || "";

  const updatePayload = (key, value) => {
    setDraftForm((current) => ({
      ...current,
      payload: {
        ...current.payload,
        [key]: value,
      },
    }));
  };

  const toggleDnfDriver = (driverName) => {
    const canonical = canonicalDriverName(driverName);
    const next = selectedDnfDrivers.includes(canonical)
      ? selectedDnfDrivers.filter((item) => item !== canonical)
      : [...selectedDnfDrivers, canonical];

    updatePayload("dnf_list", next);
  };

  return (
    <AdminCard
      eyebrow="2. Results"
      title="Draft the official result"
      description="Work in this order: import OpenF1, check the local draft, correct anything manual, save the draft, then publish that draft to the live results database."
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{race?.n || "Select a round"}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <AdminPill label={draft?.status || "no draft"} tone={draft?.status === "published" ? "ok" : draft ? "partial" : "error"} />
            {official?.results_entered && <AdminPill label="Database row exists" tone="ok" />}
            {publishStateIsStale && <AdminPill label="Draft differs from published row" tone="partial" />}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={onImport} disabled={importBusy} style={buttonStyle({ emphasis: "secondary" })}>
            {importBusy ? "Importing..." : "Import OpenF1"}
          </button>
          <button type="button" onClick={onSaveDraft} disabled={saveBusy} style={buttonStyle()}>
            {saveBusy ? "Saving..." : "Save draft"}
          </button>
          <button type="button" onClick={onPublish} disabled={publishBusy || !!publishBlockedReason} style={buttonStyle({ emphasis: "danger" })}>
            {publishBusy ? "Publishing..." : "Publish to database"}
          </button>
        </div>
      </div>

      {publishBlockedReason && (
        <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.6 }}>
          {publishBlockedReason}
        </div>
      )}

      <AdminActionResult result={fetchResult} />
      <AdminActionResult result={saveResult} />
      <AdminActionResult result={publishResult} />

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(214,223,239,0.46)" }}>
          Current local draft
        </div>
        <div style={{ fontSize: 13, color: "rgba(214,223,239,0.62)" }}>
          This is your editable version. If it looks right here, this is what you want to publish.
        </div>
        <SummaryGrid payload={{ ...payload, dnf_list: selectedDnfDrivers }} />
      </div>

      {publishStateIsStale && (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.24)", color: "#fcd34d", fontSize: 13, lineHeight: 1.7 }}>
          The published database row does not match this local draft yet. If these edits are the correct result, publish again before you award points.
        </div>
      )}

      <div style={{ display: "grid", gap: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(214,223,239,0.46)" }}>
          Edit the draft
        </div>
        <div style={{ fontSize: 13, color: "rgba(214,223,239,0.62)" }}>
          Use the dropdowns for single-result fields. Tick every DNF driver that retired so the database row matches the real race.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <SelectField label="Winner" value={payload.winner || ""} options={driverOptions} placeholder="Select winner" onChange={(value) => updatePayload("winner", value)} />
        <SelectField label="2nd Place" value={payload.p2 || ""} options={driverOptions} placeholder="Select P2" onChange={(value) => updatePayload("p2", value)} />
        <SelectField label="3rd Place" value={payload.p3 || ""} options={driverOptions} placeholder="Select P3" onChange={(value) => updatePayload("p3", value)} />
        <SelectField label="Pole Position" value={payload.pole || ""} options={driverOptions} placeholder="Select pole" onChange={(value) => updatePayload("pole", value)} />
        <SelectField label="Fastest Lap" value={payload.fastest_lap || ""} options={driverOptions} placeholder="Select fastest lap" onChange={(value) => updatePayload("fastest_lap", value)} />
        <SelectField label="Driver of the Day" value={payload.dotd || ""} options={driverOptions} placeholder="Select driver of the day" onChange={(value) => updatePayload("dotd", value)} />
        <SelectField label="Best Constructor" value={payload.best_constructor || ""} options={constructorOptions} placeholder="Select constructor" onChange={(value) => updatePayload("best_constructor", value)} />
        <BooleanToggleField label="Safety Car" value={!!payload.safety_car} onChange={(value) => updatePayload("safety_car", value)} />
        <BooleanToggleField label="Red Flag" value={!!payload.red_flag} onChange={(value) => updatePayload("red_flag", value)} />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={fieldLabelStyle}>DNF Drivers</div>
        <div style={{ fontSize: 12, color: "rgba(214,223,239,0.62)" }}>
          Select all of them if more than one car retired.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            gap: 8,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {driverOptions.map((driver) => {
            const selected = selectedDnfDrivers.includes(driver.value);
            return (
              <label
                key={`dnf-${driver.value}`}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: selected ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.02)",
                  border: selected ? "1px solid rgba(239,68,68,0.26)" : "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer",
                  fontSize: 12,
                  color: selected ? "#fecaca" : "rgba(214,223,239,0.86)",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleDnfDriver(driver.value)}
                  style={{ accentColor: "#ef4444" }}
                />
                <span>{driver.value}</span>
              </label>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: "rgba(214,223,239,0.72)" }}>
          Selected DNFs: {selectedDnfDrivers.length ? selectedDnfDrivers.join(", ") : "None"}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Current published database row</div>
            <div style={{ fontSize: 12, color: "rgba(214,223,239,0.62)" }}>
              This is the live `race_results` row that scoring will use right now.
            </div>
          </div>
          {official?.results_entered && <AdminPill label="Published" tone="ok" />}
        </div>

        {official ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, color: "rgba(214,223,239,0.7)" }}>
              Published {formatStamp(draft?.publishedAt || official.locked_at)}{manualFields.length ? ` · Manual fields: ${manualFields.join(", ")}` : ""}
            </div>
            <SummaryGrid payload={official} tone="published" />
          </div>
        ) : (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(214,223,239,0.62)" }}>
            No official result has been published for this round yet.
          </div>
        )}
      </div>
    </AdminCard>
  );
}
