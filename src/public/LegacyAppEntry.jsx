"use client";

import dynamic from "next/dynamic";

const LegacyApp = dynamic(() => import("../App"), {
  ssr: false,
  loading: () => (
    <div className="public-shell">
      <main className="public-main">
        <div className="public-card">
          <div className="public-card-body">
            <div className="public-eyebrow">Loading app</div>
            <h1 style={{ margin: "8px 0 0", fontSize: 42, lineHeight: 0.96 }}>Launching the private STINT workspace.</h1>
          </div>
        </div>
      </main>
    </div>
  ),
});

export default function LegacyAppEntry() {
  return <LegacyApp />;
}
