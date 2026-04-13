"use client";

import { ACCENT, BG_ELEVATED, PANEL_BORDER, MUTED_TEXT, BRAND_GRADIENT } from "@/src/constants/design";

/**
 * ProGate — wraps Pro-only UI sections.
 *
 * If the user has `subscription_status === 'pro'`: renders children normally.
 * Otherwise: renders a blurred overlay with a lock icon and upgrade CTA.
 *
 * Usage:
 *   <ProGate feature="ai_insights" subscriptionStatus={user?.subscription_status}>
 *     <InsightsTab />
 *   </ProGate>
 *
 * @param {{
 *   children: React.ReactNode,
 *   feature?: string,
 *   subscriptionStatus?: string,
 *   label?: string,
 * }} props
 */
export default function ProGate({ children, subscriptionStatus, label, feature }) {
  const isPro = subscriptionStatus === "pro";

  if (isPro) return children;

  const featureLabels = {
    ai_insights:       "AI Insights",
    stats_breakdown:   "Full Stats Breakdown",
    advanced_settings: "Advanced League Settings",
    game_modes:        "Pro Game Modes",
    pro_league:        "Stint Pro Community League",
  };

  const displayLabel = label ?? featureLabels[feature] ?? "This feature";

  return (
    <div style={{ position: "relative" }}>
      {/* Blurred children preview */}
      <div
        aria-hidden="true"
        style={{
          pointerEvents: "none",
          userSelect:    "none",
          filter:        "blur(6px)",
          opacity:       0.4,
        }}
      >
        {children}
      </div>

      {/* Overlay CTA */}
      <div
        style={{
          position:       "absolute",
          inset:          0,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            16,
          padding:        24,
          textAlign:      "center",
          background:     "linear-gradient(180deg, rgba(6,16,27,0.12) 0%, rgba(6,16,27,0.82) 40%, rgba(6,16,27,0.96) 100%)",
          borderRadius:   "inherit",
        }}
      >
        <div style={{ fontSize: 28 }}>🔒</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.3, marginBottom: 6 }}>
            {displayLabel} is a Pro feature
          </div>
          <div style={{ fontSize: 13, color: MUTED_TEXT, maxWidth: 320, lineHeight: 1.65 }}>
            Upgrade to Stint Pro to unlock this and all Pro features.
          </div>
        </div>
        <a
          href="/pro"
          style={{
            display:        "inline-flex",
            alignItems:     "center",
            justifyContent: "center",
            height:         44,
            padding:        "0 22px",
            borderRadius:   999,
            background:     BRAND_GRADIENT,
            color:          "#fff",
            fontSize:       13,
            fontWeight:     800,
            letterSpacing:  "-0.01em",
            textDecoration: "none",
            border:         "none",
            cursor:         "pointer",
          }}
        >
          Unlock with Stint Pro
        </a>
      </div>
    </div>
  );
}
