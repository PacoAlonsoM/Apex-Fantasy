import { BRAND_GRADIENT, PANEL_BG_ALT, PANEL_BORDER, RADIUS_MD } from "@/src/constants/design";

export function formatStamp(value) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateTimeLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
}

export function fromLocalDateTimeInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const fieldLabelStyle = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(214,223,239,0.54)",
  marginBottom: 6,
};

export const inputStyle = {
  width: "100%",
  background: PANEL_BG_ALT,
  border: PANEL_BORDER,
  borderRadius: RADIUS_MD,
  color: "#fff",
  padding: "11px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export const textareaStyle = {
  ...inputStyle,
  minHeight: 90,
  resize: "vertical",
};

export function buttonStyle({ emphasis = "primary", stretch = false } = {}) {
  const base = {
    border: "none",
    borderRadius: RADIUS_MD,
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    padding: "11px 14px",
    width: stretch ? "100%" : "auto",
  };

  if (emphasis === "secondary") {
    return {
      ...base,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
    };
  }

  if (emphasis === "danger") {
    return {
      ...base,
      background: "rgba(239,68,68,0.14)",
      border: "1px solid rgba(239,68,68,0.22)",
      color: "#fecaca",
    };
  }

  return {
    ...base,
    background: BRAND_GRADIENT,
  };
}

export function statusTone(status) {
  if (status === "published" || status === "scored" || status === "ready") return "ok";
  if (status === "stale" || status === "draft" || status === "partial") return "partial";
  if (status === "missing" || status === "error" || status === "pending") return "error";
  return "idle";
}

