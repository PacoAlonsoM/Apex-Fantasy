"use client";

import dynamic from "next/dynamic";
import { BG_BASE, TEXT_PRIMARY } from "@/src/constants/design";
import { getPublicRuntimeConfigStatus } from "@/src/lib/runtimeConfig";
import AppConfigError from "@/src/ui/AppConfigError";
import BrandLockup from "@/src/ui/BrandLockup";

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
        <BrandLockup compact markSize={48} descriptor={false} />
        <div
          className="stint-loading-track"
          aria-hidden="true"
          style={{ width: 200 }}
        >
          <div className="stint-loading-bar" />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-subtle)", marginTop: -8 }}>
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
