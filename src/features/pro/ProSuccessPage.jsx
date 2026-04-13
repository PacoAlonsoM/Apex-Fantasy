"use client";

import { useEffect } from "react";
import {
  ACCENT,
  BRAND_GRADIENT,
  BG_ELEVATED,
  BG_SURFACE,
  CARD_RADIUS,
  CONTENT_MAX,
  MUTED_TEXT,
  PANEL_BORDER,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
} from "@/src/constants/design";
import useViewport from "@/src/lib/useViewport";
import usePageMetadata from "@/src/lib/usePageMetadata";

const NEXT_STEPS = [
  { icon: "🏁", title: "Pick a Game Mode", desc: "Create or join a league with Survival, Draft, or Double Down rules.", href: "/leagues" },
  { icon: "📊", title: "Check Your Stats", desc: "Your full pick history and analytics are now live.", href: "/profile?tab=stats" },
  { icon: "🤖", title: "Get an AI Insight", desc: "After the next race, your personalised debrief will appear here.", href: "/profile?tab=insights" },
  { icon: "🌐", title: "Pro Community", desc: "You're in — compete against every Pro subscriber this season.", href: "/leagues" },
];

export default function ProSuccessPage({ user }) {
  const { isMobile } = useViewport();

  usePageMetadata("pro_success");

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div
      style={{
        maxWidth:  CONTENT_MAX,
        margin:    "0 auto",
        padding:   isMobile ? "0 0 48px" : "0 0 72px",
        textAlign: "center",
      }}
    >
      {/* ── Confirmation hero ── */}
      <section
        style={{
          borderRadius:  SECTION_RADIUS,
          border:        PANEL_BORDER,
          background:    `linear-gradient(160deg, rgba(255,106,26,0.10) 0%, ${BG_SURFACE} 60%)`,
          boxShadow:     SOFT_SHADOW,
          padding:       isMobile ? "48px 20px" : "72px 48px",
          marginBottom:  24,
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 20 }}>🏁</div>

        <h1
          style={{
            margin:        "0 auto 14px",
            fontSize:      isMobile ? 32 : 48,
            fontWeight:    900,
            letterSpacing: "-0.05em",
            lineHeight:    1,
            background:    BRAND_GRADIENT,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor:  "transparent",
          }}
        >
          You're in, {user?.username ?? "Manager"}!
        </h1>

        <p
          style={{
            margin:    "0 auto 30px",
            maxWidth:  480,
            fontSize:  isMobile ? 15 : 16,
            lineHeight: 1.7,
            color:     MUTED_TEXT,
          }}
        >
          Your Stint Pro subscription is active. All Pro features are unlocked and you've been added to the Stint Pro Community League.
        </p>

        <a
          href="/"
          style={{
            display:        "inline-flex",
            alignItems:     "center",
            justifyContent: "center",
            height:         48,
            padding:        "0 32px",
            borderRadius:   999,
            background:     BRAND_GRADIENT,
            color:          "#fff",
            fontSize:       14,
            fontWeight:     900,
            letterSpacing:  "-0.01em",
            textDecoration: "none",
            boxShadow:      "0 4px 20px rgba(255,106,26,0.28)",
          }}
        >
          Go to Dashboard
        </a>
      </section>

      {/* ── Next steps ── */}
      <section>
        <h2
          style={{
            fontSize:      isMobile ? 16 : 18,
            fontWeight:    800,
            letterSpacing: "-0.02em",
            color:         TEXT_PRIMARY,
            marginBottom:  14,
            textAlign:     "left",
          }}
        >
          What to do next
        </h2>
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
            gap:                 12,
          }}
        >
          {NEXT_STEPS.map((step) => (
            <a
              key={step.title}
              href={step.href}
              style={{
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "flex-start",
                gap:            8,
                background:     BG_ELEVATED,
                border:         PANEL_BORDER,
                borderRadius:   CARD_RADIUS,
                padding:        isMobile ? "14px 12px" : "18px 16px",
                textDecoration: "none",
                transition:     "border-color 0.15s",
                textAlign:      "left",
              }}
            >
              <span style={{ fontSize: 22 }}>{step.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.01em" }}>
                {step.title}
              </span>
              <span style={{ fontSize: 12, lineHeight: 1.6, color: MUTED_TEXT }}>{step.desc}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
