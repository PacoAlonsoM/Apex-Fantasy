/**
 * Pro identity pin — a compact chequered chip with an orange binding.
 *
 * Matches the Calendar's session-type chequer motif so the Pro marker reads as
 * part of the same visual language as the rest of the product, not a generic
 * "premium shiny badge" imported from elsewhere.
 */
export default function ProPip({ size = 12, style = {}, title = "Pro member" }) {
  const cellSize = Math.max(3, Math.round(size * 0.32));
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 3,
        background: "repeating-conic-gradient(rgba(255,255,255,0.92) 0deg 90deg, #06101B 90deg 180deg)",
        backgroundSize: `${cellSize}px ${cellSize}px`,
        border: "1.5px solid #FF6A1A",
        boxShadow: "0 0 0 1.5px var(--pip-halo)",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
