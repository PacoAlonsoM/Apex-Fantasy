"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCENT,
  AI_BLUE,
  AI_BLUE_BORDER,
  AI_BLUE_SOFT,
  AI_BLUE_TEXT,
  BG_ELEVATED,
  BG_SURFACE,
  BRAND_GRADIENT,
  CARD_RADIUS,
  CARD_SHADOW,
  CONTENT_MAX,
  ERROR_BG,
  ERROR_BORDER,
  ERROR_TEXT,
  HAIRLINE,
  LIFTED_SHADOW,
  LIVE_GREEN,
  LIVE_GREEN_GLOW,
  MUTED_TEXT,
  NOTE_BG,
  NOTE_BORDER,
  NOTE_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  PRO_AMBER_BG,
  PRO_AMBER_BORDER,
  PRO_AMBER_DOT,
  PRO_AMBER_TEXT,
  RADIUS_MD,
  RADIUS_PILL,
  SECTION_RADIUS,
  SUBTLE_TEXT,
  SUCCESS_BG,
  SUCCESS_BORDER,
  SUCCESS_TEXT,
  TEXT_PRIMARY,
  WARM,
  rgbaFromHex,
} from "@/src/constants/design";
import useViewport from "@/src/lib/useViewport";
import usePageMetadata from "@/src/lib/usePageMetadata";
import useReveal from "@/src/lib/useReveal";
import { animateNumber, withViewTransition } from "@/src/lib/viewTransition";
import { requireActiveSession } from "@/src/shell/authProfile";
import { pageToHref } from "@/src/shell/routing";
import RankBadge from "@/src/ui/RankBadge";
import Kicker from "@/src/ui/Kicker";
import PageMasthead from "@/src/ui/PageMasthead";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatEndDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}


// ─── Feature data ─────────────────────────────────────────────────────────────
const HEADLINE_FEATURES = [
  {
    title: "Pro game modes",
    pitch: "Five formats that change how you compete. Set the rules. Own the room.",
    items: [
      { label: "Survival",      detail: "Lowest scorer eliminated each round." },
      { label: "Draft",         detail: "Drivers claimed once in a season draft." },
      { label: "Double Down",   detail: "One pick scores 3× points." },
      { label: "Head-to-Head",  detail: "Beat one opponent each weekend." },
      { label: "Budget",        detail: "Build your board under a credit cap." },
    ],
  },
  {
    title: "AI insights + Coach",
    pitch: "Post-race analysis written around your actual picks — not someone else's.",
    items: [
      { label: "Pre-race tip",     detail: "Category picks before lock." },
      { label: "Post-race debrief", detail: "Hits, misses, and lost points reviewed." },
      { label: "Season Coach",      detail: "Archetype read and next-move guidance." },
    ],
  },
];

const UTILITY_FEATURES = [
  { title: "Full stats",           items: [
    { label: "Category accuracy", detail: "Every prediction type tracked." },
    { label: "Strengths & leaks", detail: "Where you score, where you don't." },
    { label: "AI vs You",         detail: "Compare against stored AI picks." },
  ] },
  { title: "Unlimited leagues",    items: [
    { label: "Create more",       detail: "Run more than one league at once." },
    { label: "Join more",         detail: "Go beyond the free cap." },
    { label: "Mix freely",        detail: "Private and public at once." },
  ] },
  { title: "League settings",      items: [
    { label: "Scoring",           detail: "Set points per category." },
    { label: "Race rules",        detail: "Sprint multipliers and doubles." },
    { label: "Tie-breaks",        detail: "Order the rules yourself." },
  ] },
  { title: "Pro Community League", items: [
    { label: "Automatic entry",   detail: "Added the moment you upgrade." },
    { label: "Season-long table", detail: "Every Pro subscriber, one board." },
    { label: "Open to view",      detail: "Anyone in the room can watch it." },
  ] },
];

const FAQ_ITEMS = [
  {
    q: "When does my Pro access start?",
    a: "Immediately. The moment checkout completes, every Pro surface — game modes, AI Coach, unlimited leagues, the Pro Community League — unlocks in the same session.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep full Pro access until the end of the period you already paid for, then revert to Free. Your picks, scores, and league history stay intact — you just stop seeing Pro-only surfaces.",
  },
  {
    q: "Do I keep my stats if I downgrade?",
    a: "Yes. Everything you've scored is on your profile permanently. The Coach still reads your archetype; the written debriefs and AI vs You comparison pause until you re-subscribe.",
  },
  {
    q: "How does the Pro Community League work?",
    a: "One season-long board for every Pro member. You're auto-entered on upgrade and scored automatically each weekend — no picks to manage separately. Anyone in Stint can view the standings.",
  },
  {
    q: "Can I pay for the full season at once?",
    a: "Yes. Full-season pricing is roughly 40% off the monthly equivalent and is billed once. You can switch plans via the Manage Subscription portal at any time.",
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function HeadlineCard({ title, pitch, items = [], isMobile }) {
  return (
    <div
      className="pro-headline-card"
      style={{
        background:    BG_ELEVATED,
        border:        `1px solid ${rgbaFromHex(ACCENT, 0.16)}`,
        borderRadius:  CARD_RADIUS,
        overflow:      "hidden",
        display:       "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding:      isMobile ? "18px 18px 14px" : "22px 24px 16px",
          borderBottom: `1px solid ${HAIRLINE}`,
          background:   rgbaFromHex(ACCENT, 0.04),
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em", color: TEXT_PRIMARY, marginBottom: 10 }}>
          {title}
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: MUTED_TEXT, maxWidth: "38ch" }}>
          {pitch}
        </p>
      </div>

      <div style={{ padding: isMobile ? "14px 18px 18px" : "16px 24px 20px", display: "grid", gap: 10, flex: 1 }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
            <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: rgbaFromHex(ACCENT, 0.35), marginTop: 7 }} />
            <div style={{ fontSize: 13, lineHeight: 1.5, color: MUTED_TEXT }}>
              <span style={{ color: TEXT_PRIMARY, fontWeight: 700 }}>{item.label}</span>
              {" — "}
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UtilityCard({ title, items = [], isMobile }) {
  return (
    <div
      className="pro-utility-card"
      style={{
        background:   BG_ELEVATED,
        border:       PANEL_BORDER,
        borderRadius: CARD_RADIUS,
        overflow:     "hidden",
      }}
    >
      <div
        style={{
          padding:      isMobile ? "12px 14px 10px" : "14px 16px 11px",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT_PRIMARY }}>{title}</span>
      </div>
      <div style={{ padding: isMobile ? "10px 14px 12px" : "12px 16px 14px", display: "grid", gap: 7 }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
            <span style={{ flexShrink: 0, width: 4, height: 4, borderRadius: "50%", background: "rgba(148,163,184,0.25)", marginTop: 7 }} />
            <div style={{ fontSize: 12, lineHeight: 1.45, color: MUTED_TEXT }}>
              <span style={{ color: TEXT_PRIMARY, fontWeight: 700 }}>{item.label}</span>
              {" — "}
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceToggle({ plan, onChange, isMobile }) {
  return (
    <div
      style={{
        display:      "inline-flex",
        background:   "var(--btn-secondary-bg)",
        borderRadius: 999,
        border:       PANEL_BORDER,
        padding:      4,
        marginBottom: 20,
      }}
    >
      {[["monthly", "Monthly"], ["season", "Full Season"]].map(([key, label]) => {
        const active = plan === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              display:       "inline-flex",
              alignItems:    "center",
              gap:           7,
              background:    active ? ACCENT : "transparent",
              color:         active ? "#fff" : MUTED_TEXT,
              border:        "none",
              borderRadius:  999,
              padding:       isMobile ? "10px 20px" : "8px 18px",
              minHeight:     isMobile ? 44 : 36,
              fontSize:      13,
              fontWeight:    700,
              letterSpacing: "-0.005em",
              cursor:        "pointer",
              transition:    "background 200ms cubic-bezier(0.16,1,0.3,1), color 200ms cubic-bezier(0.16,1,0.3,1)",
              WebkitTapHighlightColor: "transparent",
              fontFamily:    "inherit",
            }}
          >
            <span>{label}</span>
            {key === "season" && (
              <span
                aria-hidden="true"
                style={{
                  fontSize:      10,
                  fontWeight:    800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color:         active ? "rgba(255,255,255,0.82)" : WARM,
                  opacity:       active ? 1 : 0.85,
                }}
              >
                −40%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Proof modules ────────────────────────────────────────────────────────────

// Medal treatment for top 3 — gold / silver / bronze. Rank 4+ stays neutral.
function ProofColumn({ kicker, kickerColor = ACCENT, title, children, footer, isMobile, minHeight }) {
  return (
    <div
      className="pro-proof-card"
      style={{
        background:    PANEL_BG,
        border:        PANEL_BORDER,
        borderRadius:  CARD_RADIUS,
        padding:       isMobile ? "16px 16px 14px" : "18px 18px 16px",
        display:       "flex",
        flexDirection: "column",
        gap:           10,
        minHeight:     minHeight ?? (isMobile ? 0 : 180),
      }}
    >
      <Kicker color={kickerColor}>{kicker}</Kicker>
      <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.3, color: TEXT_PRIMARY }}>{title}</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
      {footer && <div style={{ fontSize: 11, color: SUBTLE_TEXT, lineHeight: 1.55, marginTop: "auto" }}>{footer}</div>}
    </div>
  );
}

// Featured Pro League card — the hero of the proof strip. Lead with a huge count.
function ProLeagueFeatureCard({ proLeague, isMobile }) {
  const loading = proLeague.state === "loading";
  const empty   = !loading && proLeague.totalMembers === 0;
  const small   = !loading && proLeague.totalMembers > 0 && proLeague.totalMembers < 10;

  const kicker       = empty ? "Founding season" : small ? "Founding season · live" : "Pro Community League · live";
  const headlineSub  = loading ? "Reading the Pro board…"
    : empty ? "Stint Pro Community League opens with you. Every future member chases your name."
    : small ? "Stint Pro Community League · the founding weeks define the season arc."
    : "One season-long table for every Stint Pro member. Entry is automatic.";

  return (
    <div
      className="pro-proof-card"
      style={{
        background:    PANEL_BG,
        border:        `1px solid ${rgbaFromHex(ACCENT, 0.22)}`,
        borderRadius:  CARD_RADIUS,
        padding:       isMobile ? "18px 18px 16px" : "22px 24px 20px",
        display:       "flex",
        flexDirection: "column",
        gap:           14,
        position:      "relative",
        overflow:      "hidden",
        minHeight:     isMobile ? 0 : 372,
      }}
    >
      {/* ambient orange glow from top */}
      <div aria-hidden="true" style={{
        position:  "absolute",
        top:       -120,
        left:      -40,
        right:     -40,
        height:    220,
        background: "radial-gradient(ellipse 70% 60% at 30% 100%, rgba(255,106,26,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <Kicker color={ACCENT} style={{ letterSpacing: "0.14em" }}>{kicker}</Kicker>
          {!loading && !empty && (
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUCCESS_TEXT, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: LIVE_GREEN, boxShadow: LIVE_GREEN_GLOW }} />
              Live
            </span>
          )}
        </div>

        {/* Display count */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          {loading ? (
            <div style={{ fontSize: isMobile ? 40 : 52, fontWeight: 900, letterSpacing: "-0.055em", color: SUBTLE_TEXT, lineHeight: 0.9, fontVariantNumeric: "tabular-nums" }}>—</div>
          ) : empty ? (
            <div style={{
              fontSize:           isMobile ? 40 : 52,
              fontWeight:         900,
              letterSpacing:      "-0.055em",
              lineHeight:         0.9,
              color: "var(--brand)",
              fontVariantNumeric: "tabular-nums",
            }}>01</div>
          ) : (
            <>
              <div style={{
                fontSize:           isMobile ? 40 : 52,
                fontWeight:         900,
                letterSpacing:      "-0.055em",
                lineHeight:         0.9,
                color:              TEXT_PRIMARY,
                fontVariantNumeric: "tabular-nums",
              }}>{proLeague.totalMembers}</div>
              <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: MUTED_TEXT, letterSpacing: "-0.01em" }}>
                Pro {proLeague.totalMembers === 1 ? "manager" : "managers"}
              </div>
            </>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: MUTED_TEXT, maxWidth: "44ch" }}>{headlineSub}</p>

        {/* divider */}
        {!loading && !empty && proLeague.leaderboard.length > 0 && (
          <div style={{ height: 1, background: HAIRLINE, margin: "4px 0 2px" }} />
        )}

        {/* top-3 rows with medal treatment */}
        {!loading && !empty && proLeague.leaderboard.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            {proLeague.leaderboard.slice(0, 3).map((row, index) => {
              const rank = index + 1;
              const isGold = rank === 1;
              return (
                <div key={row.user_id} style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          10,
                  padding:      "9px 12px",
                  borderRadius: RADIUS_MD,
                  background:   isGold ? "rgba(251,191,36,0.05)" : "var(--btn-secondary-bg)",
                  border:       `1px solid ${isGold ? "rgba(251,191,36,0.22)" : HAIRLINE}`,
                }}>
                  <RankBadge rank={rank} />
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.username}</span>
                  <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 900, color: isGold ? PRO_AMBER_DOT : TEXT_PRIMARY, fontVariantNumeric: "tabular-nums" }}>{row.points} pts</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AiSampleProofCard({ isMobile }) {
  return (
    <ProofColumn
      kicker="This is what Pro sees"
      kickerColor={AI_BLUE_TEXT}
      title="A Race Debrief, written around your picks."
      footer="Generated within minutes of results being scored."
      isMobile={isMobile}
    >
      <div style={{
        position:     "relative",
        borderRadius: RADIUS_MD,
        border:       `1px solid ${AI_BLUE_BORDER}`,
        background:   "linear-gradient(135deg, rgba(96,165,250,0.06) 0%, rgba(14,25,41,0.98) 70%)",
        padding:      "14px 14px 12px",
        overflow:     "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: AI_BLUE }} />
          <Kicker color={AI_BLUE_TEXT}>Race Debrief · Suzuka</Kicker>
        </div>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "rgba(214,223,239,0.88)" }}>
          Strong race this weekend — you nailed pole and the winner, top 20% of the room. Your DNF call didn't land, but the fastest-lap pick was a smart read given tyre degradation. Next time, lean harder on P2/P3 where you've been leaving points.
        </p>
      </div>
    </ProofColumn>
  );
}

function CoachArchetypeProofCard({ isMobile }) {
  return (
    <ProofColumn
      kicker="Your manager archetype"
      kickerColor={PRO_AMBER_DOT}
      title="The Coach tells you what type of manager you really are."
      footer="Reads your picks, names the archetype, and gives you a move."
      isMobile={isMobile}
    >
      <div style={{
        borderRadius: RADIUS_MD,
        border:       "1px solid rgba(251,191,36,0.18)",
        background:   "linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(14,25,41,0.98) 70%)",
        padding:      "14px 14px 12px",
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 4 }}>Chaos Hunter</div>
        <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.6, marginBottom: 10 }}>
          Your upside comes from the swing categories when weekends get messy.
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {[
            { label: "Protect",   value: "Safety Car · 72%" },
            { label: "Challenge", value: "Pole · 38%"       },
            { label: "Next move", value: "Anchor with one dependable front-runner call" },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <Kicker style={{ minWidth: 72 }}>{row.label}</Kicker>
              <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontWeight: 700 }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ProofColumn>
  );
}

function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div style={{
      position:     "relative",
      overflow:     "hidden",
      borderRadius: CARD_RADIUS,
      border:       isOpen ? `1px solid ${rgbaFromHex(ACCENT, 0.24)}` : PANEL_BORDER,
      background:   isOpen
        ? `linear-gradient(135deg, ${rgbaFromHex(ACCENT, 0.06)} 0%, ${rgbaFromHex(ACCENT, 0.01)} 60%, ${PANEL_BG_ALT} 100%)`
        : PANEL_BG,
      transition:   "border-color 220ms cubic-bezier(0.16,1,0.3,1), background 220ms cubic-bezier(0.16,1,0.3,1)",
    }}>
      {isOpen && (
        <span aria-hidden="true" style={{
          position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
          background: ACCENT, opacity: 0.7,
        }} />
      )}
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width:          "100%",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            12,
          padding:        "16px 20px",
          background:     "transparent",
          border:         "none",
          color:          TEXT_PRIMARY,
          cursor:         "pointer",
          fontFamily:     "inherit",
          textAlign:      "left",
          minHeight:      52,
        }}
      >
        <span style={{
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: "-0.018em",
          color: isOpen ? ACCENT : TEXT_PRIMARY,
          transition: "color 200ms ease",
        }}>{item.q}</span>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 26, height: 26,
            borderRadius: "50%",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: isOpen ? rgbaFromHex(ACCENT, 0.16) : "rgba(148,163,184,0.10)",
            border: isOpen ? `1px solid ${rgbaFromHex(ACCENT, 0.30)}` : `1px solid ${HAIRLINE}`,
            transition: "background 220ms ease, border-color 220ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            color: isOpen ? ACCENT : MUTED_TEXT,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <div
        aria-hidden={!isOpen}
        style={{
          display:          "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition:       "grid-template-rows 320ms cubic-bezier(0.23,1,0.32,1), opacity 240ms ease",
          opacity:          isOpen ? 1 : 0,
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div style={{
            padding: "0 20px 18px",
            fontSize: 13.5,
            lineHeight: 1.68,
            color: "rgba(226,232,240,0.82)",
            letterSpacing: "-0.005em",
            maxWidth: "60ch",
          }}>
            {item.a}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New cinematic hero (Free view) ──────────────────────────────────────────
// Side-by-side racing backdrop, ACCENT-tinted gradient, letter-typing title
// reveal, live counters strip, inline pricing + unlock CTA. Replaces the old
// PageMasthead-centered composition.

function ProHero({
  user, isMobile, isTablet,
  isPro, statusTone, subscriptionEndsLabel, scheduledToCancel,
  plan, onPlanChange,
  priceValue, priceUnit,
  onUnlock, checkoutLoading,
  onManage, portalLoading,
  error, note,
  proLeagueCount,
}) {
  // Count-up for the live Pro manager count
  const [displayCount, setDisplayCount] = useState(0);
  useEffect(() => {
    if (proLeagueCount == null) return undefined;
    const stop = animateNumber({
      from: 0,
      to: Number(proLeagueCount) || 0,
      duration: 1200,
      onUpdate: (v) => setDisplayCount(v),
    });
    return stop;
  }, [proLeagueCount]);

  const titleText = "Your season, sharper.";
  // Split title letter-by-letter, but keep the trailing word ("sharper.") in
  // ACCENT so the reveal lands on the brand word.
  const titleChars = titleText.split("");

  return (
    <section
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       PANEL_BORDER,
        background:   `
          linear-gradient(140deg, ${rgbaFromHex(ACCENT, 0.34)} 0%, ${rgbaFromHex(ACCENT, 0.10)} 38%, rgba(6,16,27,0.96) 100%),
          url("/images/Track.png") center / cover no-repeat,
          ${PANEL_BG}
        `,
        boxShadow:    LIFTED_SHADOW,
        marginBottom: isMobile ? 22 : 28,
        padding:      isMobile ? "32px 22px 30px" : isTablet ? "44px 36px 38px" : "56px 56px 48px",
      }}
    >
      {/* Top accent rail */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${ACCENT} 70%, transparent)`,
        opacity: 0.92,
      }} />

      {/* Row 1: kicker + (Pro only) subscription status pill */}
      <div className="pro-hero-kicker" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap",
        marginBottom: isMobile ? 18 : 24,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 12px", borderRadius: RADIUS_PILL,
          background: rgbaFromHex(ACCENT, 0.14),
          border: `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
        }}>
          <span aria-hidden="true" style={{
            width: 5, height: 5, borderRadius: "50%", background: ACCENT,
            boxShadow: `0 0 0 4px ${rgbaFromHex(ACCENT, 0.22)}`,
          }} />
          <span style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: ACCENT,
          }}>
            {isPro ? "Stint Pro · Member" : "Stint Pro · From $4/month"}
          </span>
        </div>
        {isPro && statusTone && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "5px 12px", borderRadius: RADIUS_PILL,
            background: "rgba(6,16,27,0.42)",
            border: `1px solid ${rgbaFromHex(statusTone.dot, 0.32)}`,
            flexShrink: 0,
          }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: "50%",
              background: statusTone.dot,
              boxShadow: statusTone.glow,
            }} />
            <span style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: statusTone.text,
            }}>Subscription {statusTone.label.toLowerCase()}</span>
          </span>
        )}
      </div>

      {/* BIG title — letter-by-letter reveal */}
      <h1 className="stint-page-title" style={{
        margin: 0,
        fontSize: isMobile ? "clamp(34px, 9vw, 48px)" : "clamp(56px, 7.4vw, 88px)",
        letterSpacing: "-0.05em",
        lineHeight: 0.94,
        color: "rgba(255,255,255,0.98)",
        textShadow: "0 2px 18px rgba(0,0,0,0.32)",
        textTransform: "uppercase",
        maxWidth: "18ch",
      }}>
        {titleChars.map((ch, i) => {
          // Last word "sharper." gets ACCENT color
          const charIndex = titleText.indexOf("sharper");
          const isAccent = charIndex >= 0 && i >= charIndex;
          return (
            <span
              key={`${ch}-${i}`}
              className="pro-hero-char"
              style={{
                animationDelay: `${120 + i * 38}ms`,
                color: isAccent ? ACCENT : "inherit",
              }}
            >{ch === " " ? " " : ch}</span>
          );
        })}
      </h1>

      {/* Lede */}
      <p className="pro-hero-deck" style={{
        margin: isMobile ? "16px 0 0" : "22px 0 0",
        fontSize: isMobile ? 14.5 : 17,
        fontWeight: 500,
        color: "rgba(226,232,240,0.86)",
        lineHeight: 1.55,
        maxWidth: "52ch",
        letterSpacing: "-0.005em",
      }}>
        {isPro
          ? "Every Pro surface is unlocked. Pro game modes, AI Coach + Debriefs, unlimited leagues — your Pro Community League rank moves on its own each scored weekend."
          : "Pro game modes, AI-powered insights, unlimited leagues, and the full Coach read. Everything you need to compete seriously."}
      </p>

      {(error || note) && (
        <div className="pro-hero-deck" style={{ display: "grid", gap: 8, marginTop: 16 }}>
          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: ERROR_BG, border: `1px solid ${ERROR_BORDER}`, color: ERROR_TEXT, fontSize: 13 }}>{error}</div>}
          {note && <div style={{ padding: "10px 14px", borderRadius: 10, background: NOTE_BG, border: `1px solid ${NOTE_BORDER}`, color: NOTE_TEXT, fontSize: 13 }}>{note}</div>}
        </div>
      )}

      {/* Live counters strip */}
      <div className="pro-hero-counters" style={{
        marginTop: isMobile ? 22 : 30,
        display: "inline-flex",
        alignItems: "center",
        gap: isMobile ? 14 : 22,
        padding: isMobile ? "10px 16px" : "12px 20px",
        borderRadius: RADIUS_PILL,
        background: "rgba(6,16,27,0.50)",
        border: "1px solid rgba(255,255,255,0.12)",
        flexWrap: "wrap",
      }}>
        <span className="pro-counter-num" style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: isMobile ? 22 : 26,
            fontWeight: 700, color: "#fff",
            letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 0.94,
          }}>{Math.round(displayCount) || (proLeagueCount === 0 ? 1 : "—")}</span>
          <span style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.62)",
          }}>{proLeagueCount === 0 ? "founding seat" : "Pro managers"}</span>
        </span>
        <span aria-hidden="true" style={{ width: 1, height: 22, background: "rgba(255,255,255,0.16)" }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span aria-hidden="true" style={{
            width: 7, height: 7, borderRadius: "50%",
            background: LIVE_GREEN,
            boxShadow: LIVE_GREEN_GLOW,
          }} />
          <span style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.78)",
          }}>Pro League · Live</span>
        </span>
      </div>

      {/* Pricing + CTA inline — Free vs Pro variants */}
      {isPro ? (
        <div className="pro-hero-price" style={{
          marginTop: isMobile ? 26 : 32,
          display: "flex",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 14 : 20,
          flexDirection: isMobile ? "column" : "row",
          flexWrap: "wrap",
        }}>
          {/* Renews / Access ends pill */}
          <div style={{
            display: "inline-flex",
            flexDirection: "column",
            gap: 4,
            padding: "10px 16px",
            borderRadius: RADIUS_PILL,
            background: "rgba(6,16,27,0.50)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <span style={{
              fontSize: 9, fontWeight: 900,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.58)",
            }}>{scheduledToCancel ? "Access ends" : "Renews"}</span>
            <span style={{
              fontSize: 13, fontWeight: 800,
              color: "rgba(255,255,255,0.96)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.005em",
            }}>{subscriptionEndsLabel || "On subscription anniversary"}</span>
          </div>

          <div className="pro-hero-cta" style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            flex: isMobile ? "1 1 100%" : "0 0 auto",
          }}>
            <button
              onClick={onManage}
              disabled={portalLoading}
              className="pro-cta-btn"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                gap: 10,
                height: isMobile ? 48 : 52,
                padding: isMobile ? "0 24px" : "0 30px",
                borderRadius: 999,
                background: BRAND_GRADIENT,
                color: "#fff",
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: "-0.005em",
                border: "none",
                cursor: portalLoading ? "wait" : "pointer",
                boxShadow: `0 12px 32px ${rgbaFromHex(ACCENT, 0.40)}`,
                fontFamily: "inherit",
              }}
            >
              {portalLoading ? "Opening…" : "Manage subscription"}
              <span aria-hidden="true" style={{ fontSize: 13 }}>↗</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="pro-hero-price" style={{
          marginTop: isMobile ? 26 : 36,
          display: "flex",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 18 : 24,
          flexDirection: isMobile ? "column" : "row",
          flexWrap: "wrap",
        }}>
          <div>
            <PriceToggle
              plan={plan}
              isMobile={isMobile}
              onChange={onPlanChange}
            />
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span
                key={plan}
                className="pro-price-num"
                style={{
                  display: "inline-block",
                  fontFamily: "var(--font-mono)",
                  fontSize: isMobile ? 44 : 56,
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  color: "rgba(255,255,255,0.98)",
                  fontVariantNumeric: "tabular-nums",
                  viewTransitionName: "pro-price-value",
                  textShadow: "0 2px 14px rgba(0,0,0,0.42)",
                }}
              >{priceValue}</span>
              <span style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.66)",
                marginLeft: 4,
                viewTransitionName: "pro-price-unit",
                fontWeight: 600,
              }}>{priceUnit}</span>
            </div>
          </div>

          <div className="pro-hero-cta" style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flex: isMobile ? "1 1 100%" : "0 0 auto",
          }}>
            <button
              onClick={onUnlock}
              disabled={checkoutLoading}
              className="pro-cta-btn"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                gap: 10,
                height: isMobile ? 52 : 56,
                padding: isMobile ? "0 28px" : "0 36px",
                borderRadius: 999,
                background: BRAND_GRADIENT,
                color: "#fff",
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: "-0.005em",
                border: "none",
                cursor: checkoutLoading ? "wait" : "pointer",
                boxShadow: `0 12px 32px ${rgbaFromHex(ACCENT, 0.40)}`,
                fontFamily: "inherit",
                minWidth: isMobile ? 0 : 220,
              }}
            >
              {checkoutLoading ? "Redirecting…" : user ? "Unlock Stint Pro" : "Sign in to unlock"}
              <span aria-hidden="true" style={{ fontSize: 14 }}>→</span>
            </button>
            <p className="pro-hero-trust" style={{
              margin: 0,
              fontSize: 11.5,
              color: "rgba(255,255,255,0.62)",
              letterSpacing: "-0.005em",
              fontWeight: 600,
            }}>
              Cancel anytime · Secure checkout via Stripe
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Pro Community League highlight — single prominent feature card ──────────
// Replaces the old "Three things you actually use" proof strip. The Pro
// Community League is the one most-paid-for, most-engaged-with Pro perk —
// it stands alone here as a hero-level card with its top-5 board, growth
// counter, and a contextual CTA (View / Join).

function ProLeagueHighlight({ proLeague, isPro, user, onView, isMobile, isTablet }) {
  const loading = proLeague.state === "loading";
  const empty   = !loading && proLeague.totalMembers === 0;
  const memberCount = proLeague.totalMembers || 0;
  const myRank = proLeague.myRank;

  // Hero kicker + headline depend on the state
  const kicker = empty ? "Founding season · Live" : "Pro Community League · Live";
  const headlineCount = empty ? "01" : String(memberCount);
  const headlineSub   = empty
    ? "Pro managers"
    : memberCount === 1
      ? "Pro manager"
      : "Pro managers";
  const pitch = empty
    ? "The Pro Community League opens with you. Every future member chases your name."
    : isPro && myRank
      ? "Your rank moves on its own each scored weekend. No picks to manage separately."
      : "One season-long table for every Stint Pro member. Entry is automatic on upgrade.";

  return (
    <section style={{ marginBottom: 28 }}>
      <header style={{ marginBottom: isMobile ? 14 : 18 }}>
        <div style={{
          fontSize: 10, fontWeight: 900,
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: ACCENT, marginBottom: 6,
        }}>The Pro perk you came for</div>
        <h2 className="stint-section-title" style={{
          margin: 0,
          fontSize: isMobile ? 22 : 28,
          letterSpacing: "-0.035em",
          lineHeight: 1.12,
        }}>The Stint Pro Community League</h2>
      </header>

      <div style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       `1px solid ${rgbaFromHex(ACCENT, 0.28)}`,
        background:   `linear-gradient(135deg, ${rgbaFromHex(ACCENT, 0.14)} 0%, ${rgbaFromHex(ACCENT, 0.03)} 50%, ${PANEL_BG} 100%)`,
        boxShadow:    LIFTED_SHADOW,
      }}>
        {/* Top accent rail */}
        <span aria-hidden="true" style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${ACCENT} 70%, transparent)`,
          opacity: 0.92,
        }} />

        {/* Ambient orange glow at the top-left */}
        <div aria-hidden="true" style={{
          position:  "absolute",
          top:       -140,
          left:      -60,
          right:     -60,
          height:    260,
          background: `radial-gradient(ellipse 70% 60% at 30% 100%, ${rgbaFromHex(ACCENT, 0.22)} 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <div style={{
          position: "relative",
          padding: isMobile ? "26px 22px 24px" : isTablet ? "32px 32px 30px" : "36px 40px 34px",
          display: "grid",
          gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0, 1.3fr) minmax(280px, 0.9fr)",
          gap: isMobile ? 24 : 36,
          alignItems: "start",
        }}>
          {/* Left: kicker + headline count + pitch + CTA */}
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 12px", borderRadius: RADIUS_PILL,
              background: rgbaFromHex(ACCENT, 0.14),
              border: `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
              marginBottom: isMobile ? 16 : 22,
            }}>
              <span aria-hidden="true" style={{
                width: 6, height: 6, borderRadius: "50%", background: LIVE_GREEN,
                boxShadow: LIVE_GREEN_GLOW,
              }} />
              <span style={{
                fontSize: 10, fontWeight: 900,
                letterSpacing: "0.16em", textTransform: "uppercase",
                color: ACCENT,
              }}>{kicker}</span>
            </div>

            {/* Massive count + label */}
            <div style={{
              display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
              marginBottom: isMobile ? 14 : 18,
            }}>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: isMobile ? 64 : 88,
                fontWeight: 700,
                letterSpacing: "-0.055em",
                color: TEXT_PRIMARY,
                lineHeight: 0.88,
                fontVariantNumeric: "tabular-nums",
                textShadow: `0 0 30px ${rgbaFromHex(ACCENT, 0.32)}`,
              }}>{loading ? "—" : headlineCount}</span>
              <span style={{
                fontSize: isMobile ? 13 : 15,
                fontWeight: 800,
                color: MUTED_TEXT,
                letterSpacing: "-0.01em",
              }}>{headlineSub}</span>
            </div>

            <p style={{
              margin: 0,
              fontSize: isMobile ? 14 : 15,
              color: "rgba(226,232,240,0.84)",
              lineHeight: 1.65,
              maxWidth: "48ch",
              fontWeight: 500,
              letterSpacing: "-0.005em",
              marginBottom: isMobile ? 18 : 22,
            }}>{pitch}</p>

            {/* Pro user gets their rank prominently + View button */}
            {isPro && (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
              }}>
                {myRank && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 10,
                    padding: "10px 18px",
                    borderRadius: RADIUS_PILL,
                    background: rgbaFromHex(ACCENT, 0.16),
                    border: `1px solid ${rgbaFromHex(ACCENT, 0.36)}`,
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 900,
                      letterSpacing: "0.16em", textTransform: "uppercase",
                      color: ACCENT,
                    }}>Your rank</span>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: isMobile ? 22 : 24,
                      fontWeight: 700,
                      letterSpacing: "-0.04em",
                      color: TEXT_PRIMARY,
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1,
                    }}>#{myRank}</span>
                  </div>
                )}
                <button
                  onClick={onView}
                  className="pro-gradient-btn"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: BRAND_GRADIENT, border: "none",
                    borderRadius: RADIUS_PILL,
                    color: "#fff",
                    fontSize: 13, fontWeight: 900,
                    padding: "12px 22px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: `0 6px 20px ${rgbaFromHex(ACCENT, 0.36)}`,
                    letterSpacing: "-0.005em",
                  }}
                >
                  View Pro League <span aria-hidden="true">→</span>
                </button>
              </div>
            )}

            {/* Free user gets a soft callout */}
            {!isPro && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "10px 16px",
                borderRadius: RADIUS_PILL,
                background: rgbaFromHex(ACCENT, 0.10),
                border: `1px solid ${rgbaFromHex(ACCENT, 0.26)}`,
              }}>
                <span aria-hidden="true" style={{ fontSize: 14 }}>🏆</span>
                <span style={{
                  fontSize: 12, fontWeight: 800,
                  color: ACCENT,
                  letterSpacing: "-0.005em",
                }}>Pro unlock includes automatic entry</span>
              </div>
            )}
          </div>

          {/* Right: top-5 leaderboard preview */}
          <div style={{
            position: "relative",
            padding: isMobile ? "18px 18px 16px" : "20px 22px 18px",
            borderRadius: CARD_RADIUS,
            border: `1px solid ${HAIRLINE}`,
            background: "rgba(6,16,27,0.50)",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: SUBTLE_TEXT, marginBottom: 4,
            }}>Top of the board</div>
            {loading ? (
              <div style={{ fontSize: 13, color: SUBTLE_TEXT, padding: "8px 4px" }}>Loading standings…</div>
            ) : proLeague.leaderboard.length === 0 ? (
              <div style={{ fontSize: 12.5, color: MUTED_TEXT, padding: "8px 4px", lineHeight: 1.6 }}>
                No scored picks on the Pro board yet. Your rank appears here automatically after your first scored weekend.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {proLeague.leaderboard.slice(0, 5).map((row, index) => {
                  const rank  = index + 1;
                  const isYou = isPro && row.user_id === user?.id;
                  const isGold = rank === 1;
                  const bg = isYou
                    ? rgbaFromHex(ACCENT, 0.10)
                    : isGold
                      ? "rgba(251,191,36,0.06)"
                      : "rgba(148,163,184,0.04)";
                  const border = isYou
                    ? `1px solid ${rgbaFromHex(ACCENT, 0.34)}`
                    : isGold
                      ? "1px solid rgba(251,191,36,0.22)"
                      : `1px solid ${HAIRLINE}`;
                  return (
                    <div key={row.user_id || rank} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 12px",
                      borderRadius: RADIUS_MD,
                      background: bg,
                      border,
                    }}>
                      <RankBadge rank={rank} size={24} />
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        minWidth: 0, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                        color: TEXT_PRIMARY,
                      }}>
                        {row.username}
                        {isYou && (
                          <span style={{
                            color: ACCENT, marginLeft: 7,
                            fontSize: 9, fontWeight: 900,
                            letterSpacing: "0.10em", textTransform: "uppercase",
                          }}>You</span>
                        )}
                      </span>
                      <span style={{
                        marginLeft: "auto",
                        fontSize: 13, fontWeight: 900,
                        color: isGold ? PRO_AMBER_DOT : TEXT_PRIMARY,
                        fontVariantNumeric: "tabular-nums",
                      }}>{row.points} pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pro vs Free comparison table ────────────────────────────────────────────

const COMPARISON_ROWS = [
  // Lead with the most-aspirational perk — highlighted with `featured: true`.
  { feature: "Pro Community League auto-entry",   free: "—",             pro: "Yes · auto",      featured: true },
  { feature: "Make picks every weekend",          free: "Yes",           pro: "Yes" },
  { feature: "Leagues you can join + create",     free: "Up to 2",       pro: "Unlimited" },
  { feature: "Pro game modes (Survival, Draft…)", free: "Preview only",  pro: "All five" },
  { feature: "AI Race Debrief after each round",  free: "—",             pro: "Every weekend" },
  { feature: "AI Pre-Race Tip before lock",       free: "—",             pro: "Every weekend" },
  { feature: "Season Coach archetype + moves",    free: "Preview",       pro: "Full read" },
  { feature: "AI vs You head-to-head spread",     free: "—",             pro: "Yes" },
  { feature: "Full Category Lab breakdown",       free: "Top 3 only",    pro: "Every category" },
  { feature: "League scoring + rule customisation", free: "—",           pro: "Yes" },
];

function ProVsFreeTable({ isMobile }) {
  const ref = useRef(null);
  const isVisible = useReveal(ref, { threshold: 0.18 });

  return (
    <section
      ref={ref}
      className={`pro-vs ${isVisible ? "is-visible" : ""}`}
      style={{ marginBottom: 28 }}
    >
      <header style={{ marginBottom: isMobile ? 16 : 22 }}>
        <div style={{
          fontSize: 10, fontWeight: 900,
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: ACCENT, marginBottom: 6,
        }}>The unlock</div>
        <h2 className="stint-section-title" style={{
          margin: 0,
          fontSize: isMobile ? 22 : 30,
          letterSpacing: "-0.035em",
          lineHeight: 1.12,
        }}>What changes when you upgrade</h2>
      </header>

      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: SECTION_RADIUS,
        border: `1px solid ${rgbaFromHex(ACCENT, 0.20)}`,
        background: `linear-gradient(180deg, ${rgbaFromHex(ACCENT, 0.06)} 0%, ${PANEL_BG} 100%)`,
        boxShadow: CARD_SHADOW,
      }}>
        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1.4fr 0.8fr 0.8fr" : "1.6fr 1fr 1fr",
          padding: isMobile ? "14px 16px" : "18px 24px",
          borderBottom: `1px solid ${HAIRLINE}`,
          alignItems: "baseline",
        }}>
          <span style={{
            fontSize: 11, fontWeight: 900,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: SUBTLE_TEXT,
          }}>Feature</span>
          <span style={{
            fontSize: 11, fontWeight: 900,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: SUBTLE_TEXT,
            textAlign: "center",
          }}>Free</span>
          <span style={{
            fontSize: 11, fontWeight: 900,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: ACCENT,
            textAlign: "center",
          }}>Pro ★</span>
        </div>

        {/* Rows */}
        {COMPARISON_ROWS.map((row) => (
          <div
            key={row.feature}
            className="pro-vs-row"
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1.4fr 0.8fr 0.8fr" : "1.6fr 1fr 1fr",
              padding: isMobile ? "13px 16px" : "16px 24px",
              borderBottom: `1px solid ${HAIRLINE}`,
              alignItems: "center",
              // Featured row (Pro Community League) gets a row-level glow
              background: row.featured ? rgbaFromHex(ACCENT, 0.08) : "transparent",
              transition: "background 200ms ease",
            }}
          >
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: isMobile ? 12.5 : 14,
              fontWeight: row.featured ? 900 : 700,
              color: row.featured ? ACCENT : TEXT_PRIMARY,
              letterSpacing: "-0.005em",
              paddingRight: 8,
            }}>
              {row.featured && (
                <span aria-hidden="true" style={{
                  fontSize: 10,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: rgbaFromHex(ACCENT, 0.18),
                  border: `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
                  fontWeight: 900,
                  color: ACCENT,
                  flexShrink: 0,
                }}>★ Featured</span>
              )}
              <span>{row.feature}</span>
            </span>
            <span style={{
              fontSize: isMobile ? 11.5 : 13,
              fontWeight: 600,
              color: row.free === "—" ? "rgba(148,163,184,0.45)" : MUTED_TEXT,
              textAlign: "center",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.005em",
            }}>{row.free}</span>
            <span
              className="pro-vs-pro-cell"
              style={{
                fontSize: isMobile ? 12 : 13.5,
                fontWeight: 900,
                color: "rgba(255,255,255,0.98)",
                textAlign: "center",
                // Brighter base; featured row goes even brighter
                background: row.featured ? rgbaFromHex(ACCENT, 0.26) : rgbaFromHex(ACCENT, 0.16),
                border: row.featured ? `1px solid ${rgbaFromHex(ACCENT, 0.42)}` : `1px solid ${rgbaFromHex(ACCENT, 0.20)}`,
                borderRadius: 999,
                padding: "6px 12px",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.005em",
                transition: "color 200ms ease, background 200ms ease",
              }}
            >{row.pro}</span>
          </div>
        ))}

        {/* Footer CTA */}
        <div style={{
          padding: isMobile ? "16px 16px" : "20px 24px",
          background: rgbaFromHex(ACCENT, 0.08),
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 900,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: ACCENT, marginBottom: 4,
            }}>One unlock, everything above</div>
            <div className="stint-card-title" style={{
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: "-0.022em",
              lineHeight: 1.16,
              color: TEXT_PRIMARY,
            }}>Pro pays for itself in one race-week brief.</div>
          </div>
          <a
            href="#pro-final-pricing"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: isMobile ? "11px 20px" : "12px 22px",
              borderRadius: RADIUS_PILL,
              background: BRAND_GRADIENT,
              color: "#fff",
              fontSize: 13, fontWeight: 900,
              textDecoration: "none",
              boxShadow: `0 6px 18px ${rgbaFromHex(ACCENT, 0.32)}`,
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
            }}
          >
            Unlock Pro <span aria-hidden="true" style={{ fontSize: 12 }}>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Final pricing CTA card ──────────────────────────────────────────────────

function FinalPricingCard({
  plan, onPlanChange,
  priceValue, priceUnit,
  onUnlock, checkoutLoading,
  user, isMobile, isTablet,
}) {
  // Calculate per-race cost framing
  const isMonthly = plan === "monthly";
  const perRace = isMonthly ? "$0.50/race" : "$1.25/race";
  const savings = isMonthly ? null : "Save $19 vs monthly";

  return (
    <section
      id="pro-final-pricing"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: SECTION_RADIUS,
        border: `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
        background: `
          linear-gradient(180deg, ${rgbaFromHex(ACCENT, 0.22)} 0%, ${rgbaFromHex(ACCENT, 0.04)} 50%, ${PANEL_BG} 100%)
        `,
        padding: isMobile ? "32px 22px" : "44px 40px",
        marginBottom: 28,
        textAlign: "center",
        boxShadow: LIFTED_SHADOW,
        scrollMarginTop: 80,
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${ACCENT} 70%, transparent)`,
        opacity: 0.92,
      }} />

      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "5px 12px", borderRadius: RADIUS_PILL,
        background: rgbaFromHex(ACCENT, 0.14),
        border: `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
        marginBottom: isMobile ? 14 : 18,
      }}>
        <span aria-hidden="true" style={{
          width: 5, height: 5, borderRadius: "50%", background: ACCENT,
        }} />
        <span style={{
          fontSize: 10, fontWeight: 900,
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: ACCENT,
        }}>Ready when you are</span>
      </div>

      <h2 className="stint-page-title" style={{
        margin: "0 auto 14px",
        fontSize: isMobile ? 28 : 40,
        letterSpacing: "-0.045em",
        lineHeight: 1.04,
        textTransform: "uppercase",
        maxWidth: "20ch",
      }}>Unlock the whole season</h2>

      <p style={{
        margin: "0 auto 26px",
        fontSize: isMobile ? 14 : 15.5,
        color: MUTED_TEXT,
        lineHeight: 1.6,
        maxWidth: 480,
        fontWeight: 500,
      }}>
        One subscription. Every Pro surface unlocks immediately. Cancel anytime — your picks and history stay yours.
      </p>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      }}>
        <PriceToggle
          plan={plan}
          isMobile={isMobile}
          onChange={onPlanChange}
        />

        <div>
          <span
            key={`final-${plan}`}
            className="pro-price-num"
            style={{
              display: "inline-block",
              fontFamily: "var(--font-mono)",
              fontSize: isMobile ? 56 : 76,
              fontWeight: 700,
              letterSpacing: "-0.05em",
              color: TEXT_PRIMARY,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 0.92,
            }}
          >{priceValue}</span>
          <span style={{
            fontSize: isMobile ? 14 : 16,
            color: MUTED_TEXT,
            marginLeft: 8,
            fontWeight: 600,
          }}>{priceUnit}</span>
        </div>

        <div style={{
          fontSize: 11, fontWeight: 700, color: SUBTLE_TEXT,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.005em",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          justifyContent: "center",
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 11px", borderRadius: RADIUS_PILL,
            background: "rgba(148,163,184,0.10)",
            border: `1px solid ${HAIRLINE}`,
          }}>
            <span aria-hidden="true">⚡</span>
            {perRace}
          </span>
          {savings && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 11px", borderRadius: RADIUS_PILL,
              color: WARM,
              background: rgbaFromHex(WARM, 0.10),
              border: `1px solid ${rgbaFromHex(WARM, 0.28)}`,
              fontWeight: 900,
              letterSpacing: "0.06em", textTransform: "uppercase",
              fontSize: 10,
            }}>{savings}</span>
          )}
        </div>

        <button
          onClick={onUnlock}
          disabled={checkoutLoading}
          className="pro-cta-btn"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            gap: 10,
            height: isMobile ? 52 : 56,
            padding: isMobile ? "0 32px" : "0 40px",
            borderRadius: 999,
            background: BRAND_GRADIENT,
            color: "#fff",
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: "-0.005em",
            border: "none",
            cursor: checkoutLoading ? "wait" : "pointer",
            boxShadow: `0 12px 32px ${rgbaFromHex(ACCENT, 0.40)}`,
            fontFamily: "inherit",
            marginTop: 6,
          }}
        >
          {checkoutLoading ? "Redirecting…" : user ? "Unlock Stint Pro" : "Sign in to unlock"}
          <span aria-hidden="true" style={{ fontSize: 14 }}>→</span>
        </button>

        <p style={{
          margin: 0,
          fontSize: 11.5,
          color: SUBTLE_TEXT,
          letterSpacing: "-0.005em",
          fontWeight: 600,
        }}>
          Cancel anytime · Secure checkout via Stripe
        </p>
      </div>
    </section>
  );
}

// ─── Sticky mobile CTA ───────────────────────────────────────────────────────

function StickyMobileCta({ onUnlock, plan, isMobile }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobile) return undefined;
    if (typeof window === "undefined") return undefined;
    const onScroll = () => {
      // Show after user scrolls past 480px (past the hero)
      setVisible(window.scrollY > 480);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  if (!isMobile) return null;
  const price = plan === "monthly" ? "from $4/mo" : "$29/season";

  return (
    <div
      className={`pro-sticky-cta ${visible ? "is-visible" : ""}`}
      role="region"
      aria-label="Quick unlock"
    >
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 900,
          letterSpacing: "0.14em", textTransform: "uppercase",
          color: ACCENT,
        }}>Stint Pro</div>
        <div style={{
          fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY,
          letterSpacing: "-0.005em",
          marginTop: 2,
        }}>Unlock {price}</div>
      </div>
      <button
        onClick={onUnlock}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: BRAND_GRADIENT, border: "none",
          borderRadius: RADIUS_PILL,
          color: "#fff",
          fontSize: 12.5, fontWeight: 900,
          letterSpacing: "-0.005em",
          padding: "10px 16px",
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow: `0 4px 14px ${rgbaFromHex(ACCENT, 0.36)}`,
          whiteSpace: "nowrap",
        }}
      >
        Unlock Pro <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

// ─── Member view components ──────────────────────────────────────────────────

function MemberHero({ user, statusTone, error, note, isMobile, isTablet, joinedAt }) {
  const titleText = `Welcome back, ${user?.username || "manager"}.`;

  return (
    <section
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       PANEL_BORDER,
        background:   `
          linear-gradient(140deg, ${rgbaFromHex(ACCENT, 0.30)} 0%, ${rgbaFromHex(ACCENT, 0.08)} 38%, rgba(6,16,27,0.96) 100%),
          url("/images/Track.png") center / cover no-repeat,
          ${PANEL_BG}
        `,
        boxShadow:    LIFTED_SHADOW,
        marginBottom: isMobile ? 18 : 24,
        padding:      isMobile ? "28px 22px 26px" : isTablet ? "36px 36px 32px" : "44px 48px 38px",
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${ACCENT} 70%, transparent)`,
        opacity: 0.92,
      }} />

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: isMobile ? 18 : 24,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 12px", borderRadius: RADIUS_PILL,
          background: rgbaFromHex(ACCENT, 0.14),
          border: `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
        }}>
          <span aria-hidden="true" style={{
            width: 5, height: 5, borderRadius: "50%", background: ACCENT,
            boxShadow: `0 0 0 4px ${rgbaFromHex(ACCENT, 0.22)}`,
          }} />
          <span style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: ACCENT,
          }}>Stint Pro · Member</span>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(6,16,27,0.42)",
          border: `1px solid ${rgbaFromHex(statusTone.dot, 0.32)}`,
          borderRadius: RADIUS_PILL, padding: "6px 12px",
          flexShrink: 0,
        }}>
          <span aria-hidden="true" style={{
            width: 6, height: 6, borderRadius: "50%",
            background: statusTone.dot, boxShadow: statusTone.glow,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: statusTone.text,
          }}>Subscription {statusTone.label.toLowerCase()}</span>
        </div>
      </div>

      <h1 className="stint-page-title" style={{
        margin: 0,
        fontSize: isMobile ? "clamp(30px, 8vw, 42px)" : "clamp(46px, 5.8vw, 68px)",
        letterSpacing: "-0.045em",
        lineHeight: 0.96,
        color: "rgba(255,255,255,0.98)",
        textShadow: "0 2px 18px rgba(0,0,0,0.32)",
        textTransform: "uppercase",
        maxWidth: "18ch",
      }}>{titleText}</h1>

      <p style={{
        margin: isMobile ? "16px 0 0" : "20px 0 0",
        fontSize: isMobile ? 14 : 15.5,
        fontWeight: 500,
        color: "rgba(226,232,240,0.84)",
        lineHeight: 1.6,
        maxWidth: "52ch",
        letterSpacing: "-0.005em",
      }}>
        Every Pro surface is unlocked. Your Pro Community League rank moves on its own each scored weekend — pick, race, repeat.
      </p>

      {(error || note) && (
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: ERROR_BG, border: `1px solid ${ERROR_BORDER}`, color: ERROR_TEXT, fontSize: 13 }}>{error}</div>}
          {note && <div style={{ padding: "10px 14px", borderRadius: 10, background: NOTE_BG, border: `1px solid ${NOTE_BORDER}`, color: NOTE_TEXT, fontSize: 13 }}>{note}</div>}
        </div>
      )}
    </section>
  );
}

const MEMBER_PERKS = [
  { icon: "🏆", label: "Pro Community League",   detail: "Auto-entered + ranked each weekend",       color: ACCENT },
  { icon: "🧠", label: "AI Coach (full read)",   detail: "Archetype + Protect/Challenge/Next move",  color: AI_BLUE_TEXT },
  { icon: "📰", label: "Race Debriefs",          detail: "Written around your picks, every round",   color: AI_BLUE_TEXT },
  { icon: "🎮", label: "All Pro game modes",     detail: "Survival, Draft, Double Down, H2H, Budget", color: PRO_AMBER_DOT },
  { icon: "♾️", label: "Unlimited leagues",       detail: "Create + join as many as you want",        color: ACCENT },
  { icon: "🎯", label: "AI vs You spread",       detail: "Head-to-head category comparison",          color: AI_BLUE_TEXT },
];

function MemberPerksGrid({ isMobile }) {
  const ref = useRef(null);
  const isVisible = useReveal(ref, { threshold: 0.18 });

  return (
    <section
      ref={ref}
      className={`pro-perks ${isVisible ? "is-visible" : ""}`}
      style={{ marginBottom: 16 }}
    >
      <header style={{ marginBottom: isMobile ? 12 : 16 }}>
        <div style={{
          fontSize: 10, fontWeight: 900,
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: ACCENT, marginBottom: 6,
        }}>Unlocked for you</div>
        <h2 className="stint-section-title" style={{
          margin: 0,
          fontSize: isMobile ? 20 : 24,
          letterSpacing: "-0.032em",
          lineHeight: 1.14,
        }}>Everything you have access to</h2>
      </header>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, minmax(0, 1fr))",
        gap: isMobile ? 8 : 10,
      }}>
        {MEMBER_PERKS.map((perk) => (
          <div
            key={perk.label}
            className="pro-perk pro-lift"
            style={{
              position: "relative", overflow: "hidden",
              borderRadius: CARD_RADIUS,
              border: `1px solid ${rgbaFromHex(perk.color, 0.20)}`,
              background: `linear-gradient(135deg, ${rgbaFromHex(perk.color, 0.08)} 0%, ${rgbaFromHex(perk.color, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
              padding: isMobile ? "12px 14px 11px" : "14px 16px 13px",
              boxShadow: CARD_SHADOW,
            }}
          >
            <span aria-hidden="true" style={{
              position: "absolute", top: 0, bottom: 0, left: 0, width: 2,
              background: perk.color, opacity: 0.78,
            }} />
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 6,
            }}>
              <span aria-hidden="true" style={{
                fontSize: 14, lineHeight: 1,
              }}>{perk.icon}</span>
              <span style={{
                fontSize: 12.5, fontWeight: 900,
                letterSpacing: "-0.018em",
                color: TEXT_PRIMARY,
                lineHeight: 1.16,
              }}>{perk.label}</span>
            </div>
            <div style={{
              fontSize: 11.5,
              color: MUTED_TEXT,
              lineHeight: 1.5,
              letterSpacing: "-0.005em",
            }}>{perk.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProPage({ user, setUser, setPage }) {
  const { isMobile, isTablet } = useViewport();
  const isPro               = user?.subscription_status === "pro";
  const scheduledToCancel   = Boolean(user?.subscription_cancel_at_period_end);
  const subscriptionEndsLabel = formatEndDate(user?.subscription_end);

  usePageMetadata({
    title:       "Stint Pro — Unlock the Full Game",
    description: "Pro game modes, AI race insights, unlimited leagues, full stats, and an exclusive global league. Upgrade to Stint Pro.",
    path:        "/pro",
  });

  const [plan, setPlan]                         = useState("monthly");
  const [checkoutLoading, setCheckoutLoading]   = useState(false);
  const [portalLoading, setPortalLoading]       = useState(false);
  const [statusRefreshing, setStatusRefreshing] = useState(false);
  const [error, setError]                       = useState(null);
  const [note, setNote]                         = useState("");
  const [faqOpenIndex, setFaqOpenIndex]         = useState(0);
  const [proLeague, setProLeague]               = useState({
    state:        "loading",
    totalMembers: 0,
    myRank:       null,
    leaderboard:  [],
    updatedNote:  "",
  });

  // Billing status refresh (unchanged behaviour from prior version)
  useEffect(() => {
    let active = true;

    async function refreshBillingState() {
      if (!user?.id || typeof setUser !== "function") return;

      const params = new URLSearchParams(window.location.search);
      const billingReturn = params.get("billing");

      if (!billingReturn && !user?.stripe_customer_id) return;

      setStatusRefreshing(true);

      try {
        const session = await requireActiveSession();
        if (!session?.access_token) return;

        const res = await fetch("/api/stripe/status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();

        if (!res.ok || !data?.billing) {
          throw new Error(data?.error || "Could not refresh billing state.");
        }

        if (active) {
          // The free-view and Pro-member dashboard are two entirely different page compositions.
          // When the billing status flips we wrap the state update in a view transition so the
          // hero + dashboard swap cross-fades instead of jump-cutting.
          const prevStatus   = user?.subscription_status || "free";
          const nextStatus   = data.billing.subscriptionStatus;
          const statusFlips  = prevStatus !== nextStatus;
          const applyUpdate  = () => {
            setUser((currentUser) => ({
              ...(currentUser || user || {}),
              subscription_status:               nextStatus,
              subscription_end:                  data.billing.subscriptionEnd,
              subscription_cancel_at_period_end: data.billing.cancelAtPeriodEnd,
              subscription_canceled_at:          data.billing.canceledAt,
            }));
          };
          if (statusFlips) {
            withViewTransition(applyUpdate, { name: "pro-billing-state", direction: nextStatus === "pro" ? "forward" : "back" });
          } else {
            applyUpdate();
          }

          if (billingReturn === "cancelled") {
            setNote("");
          } else if (billingReturn === "1") {
            setNote(data.billing.cancelAtPeriodEnd ? "" : "Returned from Stripe billing.");
          }
        }
      } catch (refreshError) {
        if (active) setError(refreshError?.message || "Could not refresh billing state.");
      } finally {
        if (active) setStatusRefreshing(false);
      }
    }

    refreshBillingState();
    return () => { active = false; };
  }, [setUser, user?.id, user?.stripe_customer_id]);

  // Pro League snapshot — used by the proof strip and the member dashboard
  useEffect(() => {
    let active = true;

    async function loadLeague() {
      try {
        const query = user?.id ? `?userId=${encodeURIComponent(user.id)}` : "";
        const res   = await fetch(`/api/pro/leaderboard${query}`);
        if (!res.ok) throw new Error("no-board");
        const data = await res.json();
        if (!active) return;
        setProLeague({
          state:        "ready",
          totalMembers: Number(data?.totalMembers ?? 0),
          myRank:       data?.myRank ?? null,
          leaderboard:  Array.isArray(data?.leaderboard) ? data.leaderboard : [],
          updatedNote:  "",
        });
      } catch {
        if (!active) return;
        setProLeague({ state: "ready", totalMembers: 0, myRank: null, leaderboard: [], updatedNote: "" });
      }
    }

    loadLeague();
    return () => { active = false; };
  }, [user?.id]);

  function openLeagues() {
    if (typeof setPage === "function") {
      setPage("community");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const href   = pageToHref("community", { demoMode: params.get("demo") === "1" });
    if (typeof window !== "undefined") window.location.href = href;
  }

  function openInsights() {
    if (typeof setPage === "function") {
      setPage("profile");
      return;
    }
    if (typeof window !== "undefined") window.location.href = "/profile?tab=insights";
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ plan }),
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
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "manage" }),
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

  // ─── Subscription status tone (used in hero when Pro) ────────────────────
  const statusTone = isPro
    ? (scheduledToCancel
        ? { label: "Ending",  bg: PRO_AMBER_BG, border: PRO_AMBER_BORDER, text: PRO_AMBER_TEXT, dot: PRO_AMBER_DOT, glow: "none" }
        : { label: "Active",  bg: SUCCESS_BG,   border: SUCCESS_BORDER,   text: SUCCESS_TEXT,   dot: LIVE_GREEN,    glow: LIVE_GREEN_GLOW })
    : null;

  // ─── Single merged view (Free + Pro share the same page) ───────────────────

  const priceValue = plan === "monthly" ? "$4" : "$29";
  const priceUnit  = plan === "monthly" ? "/ month" : "/ full season";

  const handlePlanChange = (next) => {
    if (next === plan) return;
    withViewTransition(() => setPlan(next), { name: "pro-price", direction: next === "season" ? "forward" : "back" });
  };

  // Hero unlock and final unlock both share the same checkout flow.
  // The sticky mobile CTA + final card both scroll-bypass / re-trigger.
  return (
    <>
    <style>{sharedStyles}</style>
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "0 0 80px" : "0 0 60px" }}>

      {/* ── 1. Cinematic hero — Free shows unlock/price, Pro shows manage button ── */}
      <ProHero
        user={user}
        isMobile={isMobile}
        isTablet={isTablet}
        isPro={isPro}
        statusTone={statusTone}
        subscriptionEndsLabel={subscriptionEndsLabel}
        scheduledToCancel={scheduledToCancel}
        plan={plan}
        onPlanChange={handlePlanChange}
        priceValue={priceValue}
        priceUnit={priceUnit}
        onUnlock={handleCheckout}
        checkoutLoading={checkoutLoading}
        onManage={handlePortal}
        portalLoading={portalLoading || statusRefreshing}
        error={error}
        note={note}
        proLeagueCount={proLeague.totalMembers}
      />

      {/* ── 2. Pro Community League highlight — single, prominent perk card ── */}
      <ProLeagueHighlight
        proLeague={proLeague}
        isPro={isPro}
        user={user}
        onView={openLeagues}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      {/* ── 3. Pro vs Free comparison table ── */}
      <ProVsFreeTable isMobile={isMobile} />

      {/* ── 4. Features grid ── */}
      <section style={{ marginBottom: 28 }}>
        <header style={{ marginBottom: isMobile ? 14 : 18 }}>
          <div style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: ACCENT, marginBottom: 6,
          }}>The full menu</div>
          <h2 className="stint-section-title" style={{
            margin: 0,
            fontSize: isMobile ? 22 : 28,
            letterSpacing: "-0.035em",
            lineHeight: 1.12,
          }}>What&apos;s in Pro</h2>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {HEADLINE_FEATURES.map((f) => (
            <HeadlineCard key={f.title} {...f} isMobile={isMobile} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
          {UTILITY_FEATURES.map((f) => (
            <UtilityCard key={f.title} {...f} isMobile={isMobile} />
          ))}
        </div>
      </section>

      {/* ── 5. FAQ — polished accordion ── */}
      <section style={{ marginBottom: 28 }}>
        <header style={{ marginBottom: isMobile ? 14 : 18 }}>
          <div style={{
            fontSize: 10, fontWeight: 900,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: ACCENT, marginBottom: 6,
          }}>{isPro ? "Anything to know" : "Before you upgrade"}</div>
          <h2 className="stint-section-title" style={{
            margin: 0,
            fontSize: isMobile ? 22 : 28,
            letterSpacing: "-0.035em",
            lineHeight: 1.12,
          }}>Common questions</h2>
        </header>
        <div style={{ display: "grid", gap: 10 }}>
          {FAQ_ITEMS.map((item, index) => (
            <FaqItem
              key={item.q}
              item={item}
              isOpen={faqOpenIndex === index}
              onToggle={() => setFaqOpenIndex((current) => current === index ? -1 : index)}
            />
          ))}
        </div>
      </section>

      {/* Footer line */}
      <div style={{ textAlign: "center", fontSize: 11, color: SUBTLE_TEXT, padding: "4px 0 8px" }}>
        Stint Pro · F1 2026 season · Cancel anytime via Stripe
      </div>
    </div>

    {/* Sticky mobile CTA — Free users only; fades in after the hero leaves */}
    {!isPro && (
      <StickyMobileCta onUnlock={handleCheckout} plan={plan} isMobile={isMobile} />
    )}
    </>
  );
}

// ─── Shared styles (used by both views) ───────────────────────────────────────
const sharedStyles = `
  @keyframes pro-section-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .pro-hero-section    { animation: pro-section-in 420ms cubic-bezier(0.16,1,0.3,1) both; }
  .pro-league-section  { animation: pro-section-in 420ms 80ms  cubic-bezier(0.16,1,0.3,1) both; }
  .pro-features-section{ animation: pro-section-in 420ms 160ms cubic-bezier(0.16,1,0.3,1) both; }

  /* ─── Hero motion — letter typing + cascade fade-ups ────────────────── */

  @keyframes pro-char-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .pro-hero-char {
    display: inline-block;
    opacity: 0;
    transform: translateY(10px);
    animation: pro-char-in 380ms cubic-bezier(0.16,1,0.3,1) forwards;
  }
  @keyframes pro-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .pro-hero-kicker, .pro-hero-deck, .pro-hero-counters, .pro-hero-price, .pro-hero-cta, .pro-hero-trust {
    opacity: 0;
    animation: pro-fade-up 480ms cubic-bezier(0.16,1,0.3,1) forwards;
  }
  .pro-hero-kicker   { animation-delay: 100ms; }
  .pro-hero-deck     { animation-delay: 520ms; }
  .pro-hero-counters { animation-delay: 680ms; }
  .pro-hero-price    { animation-delay: 780ms; }
  .pro-hero-cta      { animation-delay: 880ms; }
  .pro-hero-trust    { animation-delay: 980ms; }

  /* Hero counter bloom (after count-up settles) */
  @keyframes pro-num-bloom {
    from { transform: scale(0.95); }
    to   { transform: scale(1); }
  }
  .pro-counter-num { animation: pro-num-bloom 520ms cubic-bezier(0.16,1,0.3,1) 100ms both; }

  /* ─── Showcase + table — intersection reveal stagger ────────────────── */

  .pro-show-card, .pro-vs-row {
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 460ms cubic-bezier(0.16,1,0.3,1),
                transform 460ms cubic-bezier(0.16,1,0.3,1);
  }
  .pro-show.is-visible .pro-show-card { opacity: 1; transform: translateY(0); }
  .pro-show.is-visible .pro-show-card:nth-child(1) { transition-delay: 60ms; }
  .pro-show.is-visible .pro-show-card:nth-child(2) { transition-delay: 140ms; }
  .pro-show.is-visible .pro-show-card:nth-child(3) { transition-delay: 220ms; }
  .pro-show.is-visible .pro-show-card:nth-child(4) { transition-delay: 300ms; }
  .pro-show.is-visible .pro-show-card:nth-child(5) { transition-delay: 380ms; }
  .pro-show.is-visible .pro-show-card:nth-child(6) { transition-delay: 460ms; }

  .pro-vs.is-visible .pro-vs-row { opacity: 1; transform: translateY(0); }
  .pro-vs.is-visible .pro-vs-row:nth-child(1)  { transition-delay: 40ms; }
  .pro-vs.is-visible .pro-vs-row:nth-child(2)  { transition-delay: 100ms; }
  .pro-vs.is-visible .pro-vs-row:nth-child(3)  { transition-delay: 160ms; }
  .pro-vs.is-visible .pro-vs-row:nth-child(4)  { transition-delay: 220ms; }
  .pro-vs.is-visible .pro-vs-row:nth-child(5)  { transition-delay: 280ms; }
  .pro-vs.is-visible .pro-vs-row:nth-child(6)  { transition-delay: 340ms; }
  .pro-vs.is-visible .pro-vs-row:nth-child(7)  { transition-delay: 400ms; }
  .pro-vs.is-visible .pro-vs-row:nth-child(8)  { transition-delay: 460ms; }
  .pro-vs.is-visible .pro-vs-row:nth-child(n+9) { transition-delay: 520ms; }

  /* Pro vs Free table: subtle row hover */
  .pro-vs-row:hover .pro-vs-pro-cell { color: #fff; }

  /* ─── Sticky mobile CTA ─────────────────────────────────────────────── */

  .pro-sticky-cta {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px 12px 18px;
    border-radius: ${RADIUS_PILL}px;
    background: rgba(6,16,27,0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid ${rgbaFromHex(ACCENT, 0.34)};
    box-shadow: 0 12px 36px rgba(0,0,0,0.46), 0 0 0 1px rgba(255,255,255,0.04) inset;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 320ms cubic-bezier(0.16,1,0.3,1), transform 320ms cubic-bezier(0.16,1,0.3,1);
    pointer-events: none;
  }
  .pro-sticky-cta.is-visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  /* ─── Member perks grid ─────────────────────────────────────────────── */

  .pro-perk {
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 380ms cubic-bezier(0.16,1,0.3,1), transform 380ms cubic-bezier(0.16,1,0.3,1);
  }
  .pro-perks.is-visible .pro-perk { opacity: 1; transform: translateY(0); }
  .pro-perks.is-visible .pro-perk:nth-child(1) { transition-delay: 40ms; }
  .pro-perks.is-visible .pro-perk:nth-child(2) { transition-delay: 100ms; }
  .pro-perks.is-visible .pro-perk:nth-child(3) { transition-delay: 160ms; }
  .pro-perks.is-visible .pro-perk:nth-child(4) { transition-delay: 220ms; }
  .pro-perks.is-visible .pro-perk:nth-child(5) { transition-delay: 280ms; }
  .pro-perks.is-visible .pro-perk:nth-child(6) { transition-delay: 340ms; }

  /* Generic hoverable lift — for new Pro showcase cards */
  .pro-lift {
    transition: transform 240ms cubic-bezier(0.16,1,0.3,1), box-shadow 240ms ease, border-color 240ms ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .pro-lift:hover { transform: translateY(-2px); }
  }

  .pro-cta-btn {
    transition: box-shadow 240ms cubic-bezier(0.16,1,0.3,1),
                transform  160ms cubic-bezier(0.16,1,0.3,1),
                opacity    160ms ease,
                filter     240ms ease;
    will-change: transform;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .pro-secondary-btn, .pro-gradient-btn, .pro-utility-card, .pro-headline-card, .pro-proof-card {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  @media (hover: hover) and (pointer: fine) {
    .pro-cta-btn:not(:disabled):hover {
      box-shadow: 0 6px 24px rgba(255,106,26,0.32) !important;
      transform: translateY(-1px);
      filter: brightness(1.04);
    }
  }
  .pro-cta-btn:not(:disabled):active { transform: translateY(0) scale(0.975); transition-duration: 80ms; }

  .pro-secondary-btn {
    transition: color 150ms ease, border-color 150ms ease, background 150ms ease, transform 140ms cubic-bezier(0.23,1,0.32,1);
  }
  @media (hover: hover) and (pointer: fine) {
    .pro-secondary-btn:not(:disabled):hover {
      color: rgba(214,223,239,0.92) !important;
      border-color: rgba(148,163,184,0.30) !important;
      background: rgba(255,255,255,0.015) !important;
    }
  }
  .pro-secondary-btn:not(:disabled):active { transform: scale(0.975); transition-duration: 80ms; }

  .pro-gradient-btn {
    transition: box-shadow 240ms cubic-bezier(0.16,1,0.3,1), transform 160ms cubic-bezier(0.16,1,0.3,1), filter 200ms ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .pro-gradient-btn:not(:disabled):hover { box-shadow: 0 6px 22px rgba(255,106,26,0.28) !important; filter: brightness(1.04); }
  }
  .pro-gradient-btn:not(:disabled):active { transform: scale(0.975); transition-duration: 80ms; }

  .pro-headline-card {
    transition: border-color 240ms cubic-bezier(0.16,1,0.3,1),
                transform   260ms cubic-bezier(0.16,1,0.3,1),
                box-shadow  260ms cubic-bezier(0.16,1,0.3,1);
    will-change: transform;
  }
  @media (hover: hover) and (pointer: fine) {
    .pro-headline-card:hover {
      border-color: rgba(255,106,26,0.30) !important;
      transform: translateY(-2px);
      box-shadow: 0 10px 28px rgba(0,0,0,0.26), 0 0 0 1px rgba(255,106,26,0.06);
    }
  }

  .pro-utility-card {
    transition: border-color 200ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1), background 220ms ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .pro-utility-card:hover { border-color: rgba(148,163,184,0.24) !important; transform: translateY(-1px); background: rgba(255,255,255,0.015); }
  }
  .pro-utility-card:active { transform: scale(0.985); transition-duration: 80ms; }

  .pro-proof-card {
    transition: border-color 240ms cubic-bezier(0.16,1,0.3,1), transform 240ms cubic-bezier(0.16,1,0.3,1), box-shadow 240ms cubic-bezier(0.16,1,0.3,1);
  }
  @media (hover: hover) and (pointer: fine) {
    .pro-proof-card:hover {
      border-color: rgba(148,163,184,0.22) !important;
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.22);
    }
  }

  @keyframes pro-price-in {
    from { opacity: 0; transform: translateY(5px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)  scale(1); }
  }
  .pro-price-num { animation: pro-price-in 160ms cubic-bezier(0.23,1,0.32,1) both; }

  /* Plan morph — same view-transition-name on the price value across plans.
     The browser cross-fades + scales between the two tabular numbers. */
  ::view-transition-old(pro-price-value),
  ::view-transition-new(pro-price-value),
  ::view-transition-old(pro-price-unit),
  ::view-transition-new(pro-price-unit) {
    animation-duration: 260ms;
    animation-timing-function: cubic-bezier(0.23,1,0.32,1);
  }

  /* Free ↔ Pro state flip — the entire hero region swaps composition. Cross-fade only. */
  [data-vt-name="pro-billing-state"]::view-transition-old(root),
  [data-vt-name="pro-billing-state"]::view-transition-new(root) {
    animation-duration: 320ms;
    animation-timing-function: cubic-bezier(0.23,1,0.32,1);
  }

  @media (prefers-reduced-motion: reduce) {
    .pro-hero-section, .pro-league-section, .pro-features-section, .pro-price-num,
    .pro-hero-char, .pro-hero-kicker, .pro-hero-deck, .pro-hero-counters, .pro-hero-price, .pro-hero-cta, .pro-hero-trust,
    .pro-counter-num, .pro-show-card, .pro-vs-row, .pro-perk, .pro-sticky-cta, .pro-lift {
      animation: none !important; opacity: 1 !important; transform: none !important; transition: none !important;
    }
    .pro-cta-btn, .pro-secondary-btn, .pro-gradient-btn,
    .pro-headline-card, .pro-utility-card, .pro-proof-card { transition: none !important; }
    ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
    .pro-sticky-cta { opacity: 1 !important; transform: none !important; pointer-events: auto !important; }
  }
`;
