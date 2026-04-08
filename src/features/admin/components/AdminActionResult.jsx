import { ERROR_BG, ERROR_BORDER, ERROR_TEXT, SUCCESS_BG, SUCCESS_BORDER, SUCCESS_TEXT, WARN_BG, WARN_BORDER, WARN_TEXT } from "@/src/constants/design";

function paletteForStatus(status) {
  if (status === "error") {
    return {
      background: ERROR_BG,
      border: `1px solid ${ERROR_BORDER}`,
      color: ERROR_TEXT,
    };
  }

  if (status === "partial") {
    return {
      background: WARN_BG,
      border: `1px solid ${WARN_BORDER}`,
      color: WARN_TEXT,
    };
  }

  return {
    background: SUCCESS_BG,
    border: `1px solid ${SUCCESS_BORDER}`,
    color: SUCCESS_TEXT,
  };
}

export default function AdminActionResult({ result }) {
  if (!result) return null;
  const palette = paletteForStatus(result.status || (result.error ? "error" : "ok"));
  const warnings = Array.isArray(result.warnings) ? result.warnings.filter(Boolean) : [];
  const mode = String(result.mode || result.provider || "").trim().toLowerCase();
  const modeLabel = mode === "openai"
    ? `OpenAI${result.model ? ` · ${result.model}` : ""}`
    : mode === "fallback"
      ? "Fallback brief"
      : "";
  const researchSourceCount = Number(result.researchSourceCount || 0) || 0;

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: palette.background,
        border: palette.border,
        color: palette.color,
        display: "grid",
        gap: warnings.length ? 8 : 4,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        {result.message || result.error}
      </div>
      {modeLabel && (
        <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
          {modeLabel}
        </div>
      )}
      {researchSourceCount > 0 && (
        <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
          Live web sources checked: {researchSourceCount}
        </div>
      )}
      {warnings.length > 0 && (
        <div style={{ display: "grid", gap: 4, fontSize: 12, lineHeight: 1.5 }}>
          {warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}
