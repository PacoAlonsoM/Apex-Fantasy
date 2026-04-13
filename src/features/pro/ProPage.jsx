"use client";

import { useState } from "react";
import {
  ACCENT,
  ACCENT_GLOW,
  BG_ELEVATED,
  BG_SURFACE,
  BRAND_GRADIENT,
  CARD_RADIUS,
  CONTENT_MAX,
  MUTED_TEXT,
  PANEL_BORDER,
  SECTION_RADIUS,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
  WARM,
} from "@/src/constants/design";
import useViewport from "@/src/lib/useViewport";
import usePageMetadata from "@/src/lib/usePageMetadata";
import { requireActiveSession } from "@/src/shell/authProfile";
import { pageToHref } from "@/src/shell/routing";

// ─── Feature list ──────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  {
    title: "Game modes",
    items: [
      { label: "Survival", detail: "Lowest scorer is eliminated each round." },
      { label: "Draft", detail: "Drivers are claimed once in a season draft." },
      { label: "Double Down", detail: "One pick scores 3x points." },
      { label: "Head-to-Head", detail: "Beat one opponent each weekend." },
      { label: "Budget", detail: "Build your board under a credit cap." },
    ],
  },
  {
    title: "AI insights",
    items: [
      { label: "Pre-race", detail: "Brief before lock with category picks." },
      { label: "Post-race", detail: "Review of hits, misses, and lost points." },
      { label: "Category view", detail: "Winner, pole, podium, DNF, safety car, and more." },
    ],
  },
  {
    title: "Performance breakdown",
    items: [
      { label: "Accuracy", detail: "Track every category separately." },
      { label: "Strengths", detail: "See where you score best." },
      { label: "Weak spots", detail: "See where you keep dropping points." },
    ],
  },
  {
    title: "Unlimited leagues",
    items: [
      { label: "Create", detail: "Run more than one league." },
      { label: "Join", detail: "Go beyond the free account cap." },
      { label: "Manage", detail: "Run friends, work, and open leagues at once." },
    ],
  },
  {
    title: "League settings",
    items: [
      { label: "Scoring", detail: "Set points by category." },
      { label: "Race rules", detail: "Add sprint multipliers and double-point rounds." },
      { label: "Tie-breaks", detail: "Set the order yourself." },
    ],
  },
  {
    title: "Pro league entry",
    items: [
      { label: "Automatic", detail: "You are added right away." },
      { label: "Shared board", detail: "One season-long table for all Pro members." },
      { label: "No code", detail: "No manual join step." },
    ],
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function FeatureCard({ title, items = [], isMobile }) {
  return (
    <div
      style={{
        background:   BG_ELEVATED,
        border:       PANEL_BORDER,
        borderRadius: CARD_RADIUS,
        padding:      isMobile ? "16px 14px" : "20px 18px",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT_PRIMARY, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "grid", gridTemplateColumns: "10px minmax(0,1fr)", gap: 8, alignItems: "start" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: ACCENT, marginTop: 6 }} />
            <div style={{ fontSize: 13, lineHeight: 1.45, color: MUTED_TEXT }}>
              <span style={{ color: TEXT_PRIMARY, fontWeight: 700 }}>{item.label}</span>
              {": "}
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceToggle({ plan, onChange }) {
  return (
    <div
      style={{
        display:        "inline-flex",
        background:     BG_ELEVATED,
        borderRadius:   999,
        border:         PANEL_BORDER,
        padding:        4,
        gap:            0,
        marginBottom:   28,
      }}
    >
      {[["monthly", "Monthly"], ["season", "Full Season"]].map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            background:    plan === key ? ACCENT : "transparent",
            color:         plan === key ? "#fff" : MUTED_TEXT,
            border:        "none",
            borderRadius:  999,
            padding:       "9px 20px",
            fontSize:      13,
            fontWeight:    700,
            cursor:        "pointer",
            transition:    "background 0.15s, color 0.15s",
          }}
        >
          {label}
          {key === "season" && (
            <span
              style={{
                display:      "inline-block",
                marginLeft:   7,
                fontSize:     10,
                fontWeight:   800,
                letterSpacing: "0.05em",
                color:        plan === "season" ? "#fff" : WARM,
                background:   plan === "season" ? "rgba(255,255,255,0.15)" : "rgba(255,194,71,0.12)",
                borderRadius: 999,
                padding:      "2px 6px",
                verticalAlign: "middle",
              }}
            >
              SAVE 40%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ProPage({ user, setPage }) {
  const { isMobile } = useViewport();
  const isPro = user?.subscription_status === "pro";

  usePageMetadata({
    title: "Stint Pro — Unlock the Full Game",
    description: "Pro game modes, AI race insights, unlimited leagues, full stats, and an exclusive global league. Upgrade to Stint Pro.",
    path: "/pro",
  });

  const [plan, setPlan]           = useState("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading]     = useState(false);
  const [error, setError]         = useState(null);

  function openLeagues() {
    if (typeof setPage === "function") {
      setPage("community");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const href = pageToHref("community", { demoMode: params.get("demo") === "1" });
    window.location.href = href;
  }

  async function handleCheckout() {
    if (!user) {
      setError("Sign in first to subscribe.");
      return;
    }
    setCheckoutLoading(true);
    setError(null);
    try {
      const session = await requireActiveSession();
      if (!session?.access_token) {
        setError("Your session expired. Sign in again to continue.");
        return;
      }

      const res  = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body:    JSON.stringify({
          plan,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Could not start checkout. Try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handlePortal() {
    if (!user) return;
    setPortalLoading(true);
    try {
      const session = await requireActiveSession();
      if (!session?.access_token) {
        setError("Your session expired. Sign in again to continue.");
        return;
      }

      const res  = await fetch("/api/stripe/portal", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body:    JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else if (data?.error) setError(data.error);
    } catch {
      setError("Could not open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "0 0 40px" : "0 0 60px" }}>

      {/* ── Hero ── */}
      <section
        style={{
          borderRadius:  SECTION_RADIUS,
          border:        "1px solid rgba(255,106,26,0.22)",
          background:    `linear-gradient(180deg,rgba(10,16,30,0.99),${BG_SURFACE})`,
          boxShadow:     `0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.04)`,
          padding:       isMobile ? "44px 22px 40px" : "72px 52px 60px",
          marginBottom:  20,
          textAlign:     "center",
          position:      "relative",
          overflow:      "hidden",
        }}
      >
        {/* Background hero image */}
        <img
          src="/images/hero-glow.png"
          alt=""
          aria-hidden="true"
          style={{
            position:      "absolute",
            inset:         0,
            width:         "100%",
            height:        "100%",
            objectFit:     "cover",
            objectPosition: "center 60%",
            opacity:       isMobile ? 0.12 : 0.2,
            filter:        "brightness(1.2) saturate(1.3) hue-rotate(10deg)",
            transform:     "scale(1.06)",
            pointerEvents: "none",
          }}
          onError={(e) => { e.target.style.display = "none"; }}
        />

        {/* Glow orbs */}
        <div
          aria-hidden="true"
          style={{
            position:     "absolute",
            top:          -80,
            left:         "50%",
            transform:    "translateX(-50%)",
            width:        600,
            height:       380,
            background:   `radial-gradient(ellipse at center, ${ACCENT_GLOW} 0%, transparent 68%)`,
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position:     "absolute",
            bottom:       -60,
            left:         "20%",
            width:        300,
            height:       220,
            background:   "radial-gradient(ellipse at center,rgba(255,194,71,0.06) 0%,transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Subtle grid lines */}
        <div
          aria-hidden="true"
          style={{
            position:     "absolute",
            inset:        0,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          8,
              background:   "rgba(255,106,26,0.12)",
              border:       "1px solid rgba(255,106,26,0.30)",
              borderRadius: 999,
              padding:      "6px 16px",
              marginBottom: 24,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase" }}>
              Stint Pro
            </span>
          </div>

          <h1
            style={{
              margin:        "0 auto 18px",
              fontSize:      isMobile ? 42 : 68,
              fontWeight:    900,
              letterSpacing: isMobile ? "-0.04em" : "-0.07em",
              lineHeight:    0.92,
              maxWidth:      760,
              background:    BRAND_GRADIENT,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor:  "transparent",
            }}
          >
            Your season.
            <br />
            Sharper.
          </h1>

          <p
            style={{
              margin:    "0 auto 40px",
              maxWidth:  520,
              fontSize:  isMobile ? 15 : 17,
              lineHeight: 1.75,
              color:     MUTED_TEXT,
            }}
          >
            Pro game modes, AI-powered insights, unlimited leagues and full stats — everything you need to compete seriously.
          </p>

          {/* CTA / status */}
          {isPro ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  display:      "inline-flex",
                  alignItems:   "center",
                  gap:          8,
                  background:   "rgba(34,197,94,0.08)",
                  border:       "1px solid rgba(34,197,94,0.24)",
                  borderRadius: 999,
                  padding:      "10px 20px",
                  fontSize:     14,
                  fontWeight:   700,
                  color:        "#86efac",
                }}
              >
                ✓ You're a Stint Pro member
              </div>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                style={{
                  background:    "transparent",
                  border:        PANEL_BORDER,
                  borderRadius:  999,
                  padding:       "9px 20px",
                  fontSize:      13,
                  fontWeight:    700,
                  color:         MUTED_TEXT,
                  cursor:        portalLoading ? "wait" : "pointer",
                }}
              >
                {portalLoading ? "Opening…" : "Manage Subscription"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <PriceToggle plan={plan} onChange={setPlan} />

              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: isMobile ? 42 : 52, fontWeight: 900, letterSpacing: "-0.04em", color: TEXT_PRIMARY }}>
                  {plan === "monthly" ? "$4" : "$29"}
                </span>
                <span style={{ fontSize: 14, color: MUTED_TEXT, marginLeft: 6 }}>
                  {plan === "monthly" ? "/ month" : "/ full season"}
                </span>
              </div>

              {error && (
                <div style={{ fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 14px" }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                style={{
                  display:       "inline-flex",
                  alignItems:    "center",
                  justifyContent: "center",
                  height:        50,
                  padding:       "0 36px",
                  borderRadius:  999,
                  background:    BRAND_GRADIENT,
                  color:         "#fff",
                  fontSize:      15,
                  fontWeight:    900,
                  letterSpacing: "-0.01em",
                  border:        "none",
                  cursor:        checkoutLoading ? "wait" : "pointer",
                  boxShadow:     "0 4px 20px rgba(255,106,26,0.28)",
                }}
              >
                {checkoutLoading ? "Redirecting…" : "Unlock Stint Pro"}
              </button>

              <p style={{ margin: 0, fontSize: 12, color: SUBTLE_TEXT }}>
                Cancel anytime. Secure checkout via Stripe.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── League wayfinding ── */}
      <section
        style={{
          background:   `linear-gradient(160deg,rgba(255,106,26,0.07) 0%,${BG_SURFACE} 55%)`,
          border:       "1px solid rgba(255,106,26,0.20)",
          borderRadius: SECTION_RADIUS,
          overflow:     "hidden",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            padding:      isMobile ? "20px 18px 16px" : "28px 28px 20px",
            display:      "flex",
            justifyContent: "space-between",
            alignItems:   isMobile ? "flex-start" : "center",
            gap:          16,
            flexWrap:     "wrap",
          }}
        >
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,106,26,0.10)", border: "1px solid rgba(255,106,26,0.22)", borderRadius: 999, padding: "4px 12px", marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: ACCENT, textTransform: "uppercase" }}>Leagues tab</span>
              </div>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: 6 }}>
                The Pro league now lives in Leagues.
              </div>
              <div style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.6, maxWidth: 560 }}>
                Browse the public Pro board, read the room, and track the prize race from the Leagues tab. Once you upgrade, you are added automatically and start competing there right away.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button
                  onClick={openLeagues}
                  style={{
                    background: BRAND_GRADIENT,
                    border: "none",
                    borderRadius: 999,
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 13,
                    padding: "10px 18px",
                    boxShadow: "0 4px 16px rgba(255,106,26,0.24)",
                  }}
                >
                  View Pro League
                </button>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: "1px solid rgba(96,165,250,0.22)", background: "rgba(96,165,250,0.08)", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#bfdbfe" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#60a5fa" }} />
                  Everyone can view it
                </div>
              </div>
          </div>

          {!isPro && (
            <div
              style={{
                background:   "linear-gradient(160deg,rgba(255,106,26,0.12),rgba(14,22,38,0.8))",
                border:       "1px solid rgba(255,106,26,0.25)",
                borderRadius: 18,
                padding:      isMobile ? "16px" : "20px 22px",
                minWidth:     isMobile ? "100%" : 220,
                textAlign:    "center",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED_TEXT, marginBottom: 10 }}>Join from</div>
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.04em", color: TEXT_PRIMARY }}>$4</span>
                <span style={{ fontSize: 13, color: MUTED_TEXT, marginLeft: 5 }}>/ month</span>
              </div>
              <div style={{ fontSize: 11, color: MUTED_TEXT, marginBottom: 14 }}>or $29 for the full season</div>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || !user}
                style={{
                  background:    BRAND_GRADIENT,
                  border:        "none",
                  borderRadius:  999,
                  color:         "#fff",
                  cursor:        (checkoutLoading || !user) ? "wait" : "pointer",
                  fontWeight:    900,
                  fontSize:      13,
                  padding:       "10px 22px",
                  width:         "100%",
                  boxShadow:     "0 4px 16px rgba(255,106,26,0.30)",
                  letterSpacing: "-0.01em",
                }}
              >
                {!user ? "Sign in to join" : checkoutLoading ? "Redirecting…" : "Join Pro"}
              </button>
              <div style={{ fontSize: 11, color: SUBTLE_TEXT, marginTop: 8 }}>Cancel anytime · Secure via Stripe</div>
            </div>
          )}

          {isPro && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.20)", borderRadius: 999, padding: "10px 18px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px rgba(74,222,128,0.6)" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#86efac" }}>You are already auto-entered</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, letterSpacing: "-0.03em", color: TEXT_PRIMARY, marginBottom: 14 }}>
          Included in Pro
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
          {PRO_FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} isMobile={isMobile} />
          ))}
        </div>
      </section>
    </div>
  );
}
