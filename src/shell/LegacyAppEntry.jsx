"use client";

import dynamic from "next/dynamic";
import { BG_BASE, TEXT_PRIMARY, ACCENT } from "@/src/constants/design";
import { getPublicRuntimeConfigStatus } from "@/src/lib/runtimeConfig";
import AppConfigError from "@/src/ui/AppConfigError";

const LegacyApp = dynamic(() => import("./StintApp"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: BG_BASE,
        color: TEXT_PRIMARY,
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        {/* Brand mark */}
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-label="Stint logo">
          <rect width="40" height="40" rx="10" fill={ACCENT} opacity="0.12" />
          <path d="M12 26c0-2.2 1.8-4 4-4h8c2.2 0 4-1.8 4-4s-1.8-4-4-4H12" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        {/* Wordmark */}
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: TEXT_PRIMARY }}>
          STINT
        </div>
        {/* Loading bar */}
        <div
          className="stint-loading-track"
          aria-hidden="true"
          style={{ width: 200 }}
        >
          <div className="stint-loading-bar" />
        </div>
        {/* Label */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(214,223,239,0.62)", marginTop: -8 }}>
          Loading
        </div>
      </div>
    </div>
  ),
});

export default function LegacyAppEntry() {
  const configStatus = getPublicRuntimeConfigStatus();

  if (!configStatus.ok) {
    return <AppConfigError status={configStatus} />;
  }

  return <LegacyApp />;
}
