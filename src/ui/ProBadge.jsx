/**
 * Premium "PRO" badge shown next to usernames for Pro subscribers.
 * Source of truth is profiles.subscription_status — do not store separately.
 *
 * @param {{ subscriptionStatus?: string, style?: object }} props
 */
export default function ProBadge({ subscriptionStatus, style }) {
  if (subscriptionStatus !== "pro") return null;

  return (
    <span
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            7,
        background:     "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))",
        border:         "1px solid rgba(251,191,36,0.34)",
        color:          "#fef3c7",
        fontSize:       10,
        fontWeight:     900,
        letterSpacing:  "0.14em",
        padding:        "4px 10px 4px 5px",
        borderRadius:   999,
        lineHeight:     1,
        userSelect:     "none",
        flexShrink:     0,
        boxShadow:      "0 10px 24px rgba(249,115,22,0.16), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.03)",
        textTransform:  "uppercase",
        ...style,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
          boxShadow: "0 4px 10px rgba(249,115,22,0.32)",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M5 1L6.18 3.82L9 4.27L7 6.24L7.45 9L5 7.56L2.55 9L3 6.24L1 4.27L3.82 3.82L5 1Z" fill="rgba(255,255,255,0.94)" />
        </svg>
      </span>
      Stint Pro
    </span>
  );
}
