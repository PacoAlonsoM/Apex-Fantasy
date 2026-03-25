"use client";

import dynamic from "next/dynamic";
import { BG_BASE, TEXT_PRIMARY, TEXT_SECONDARY } from "../constants/design";

const LegacyApp = dynamic(() => import("../App"), {
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
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT_SECONDARY, marginBottom: 10 }}>
          Loading
        </div>
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 0.96 }}>Opening STINT.</h1>
      </div>
    </div>
  ),
});

export default function LegacyAppEntry() {
  return <LegacyApp />;
}
