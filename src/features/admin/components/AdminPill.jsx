import { RADIUS_PILL } from "@/src/constants/design";

const TONES = {
  ok: {
    color: "#86efac",
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.24)",
  },
  partial: {
    color: "#fcd34d",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.24)",
  },
  error: {
    color: "#fca5a5",
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.24)",
  },
  idle: {
    color: "rgba(255,255,255,0.7)",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  info: {
    color: "#93c5fd",
    background: "rgba(59,130,246,0.12)",
    border: "1px solid rgba(59,130,246,0.24)",
  },
};

export default function AdminPill({ label, tone = "idle" }) {
  const palette = TONES[tone] || TONES.idle;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: RADIUS_PILL,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        color: palette.color,
        background: palette.background,
        border: palette.border,
      }}
    >
      {label}
    </span>
  );
}

