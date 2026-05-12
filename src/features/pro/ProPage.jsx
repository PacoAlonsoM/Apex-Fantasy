"use client";

import { useEffect, useState } from "react";
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
  CONTENT_MAX,
  ERROR_BG,
  ERROR_BORDER,
  ERROR_TEXT,
  HAIRLINE,
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
import { withViewTransition } from "@/src/lib/viewTransition";
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
      borderRadius: RADIUS_MD,
      border:       PANEL_BORDER,
      background:   isOpen ? PANEL_BG_ALT : PANEL_BG,
      overflow:     "hidden",
    }}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width:          "100%",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            12,
          padding:        "14px 16px",
          background:     "transparent",
          border:         "none",
          color:          TEXT_PRIMARY,
          cursor:         "pointer",
          fontFamily:     "inherit",
          textAlign:      "left",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.01em" }}>{item.q}</span>
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            flexShrink: 0,
            color:      MUTED_TEXT,
            transform:  isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 220ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        aria-hidden={!isOpen}
        style={{
          display:          "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition:       "grid-template-rows 260ms cubic-bezier(0.23,1,0.32,1), opacity 200ms ease",
          opacity:          isOpen ? 1 : 0,
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div style={{ padding: "0 16px 14px", fontSize: 13, lineHeight: 1.7, color: MUTED_TEXT }}>
            {item.a}
          </div>
        </div>
      </div>
    </div>
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

  // ─── Member dashboard view (Pro) ────────────────────────────────────────────

  if (isPro) {
    const statusTone = scheduledToCancel
      ? { label: "Ending",  bg: PRO_AMBER_BG, border: PRO_AMBER_BORDER, text: PRO_AMBER_TEXT, dot: PRO_AMBER_DOT, glow: "none" }
      : { label: "Active",  bg: SUCCESS_BG,   border: SUCCESS_BORDER,   text: SUCCESS_TEXT,   dot: LIVE_GREEN,    glow: LIVE_GREEN_GLOW };

    return (
      <>
      <style>{sharedStyles}</style>
      <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "0 0 40px" : "0 0 60px" }}>

        {/* ── Member hero — canonical PageMasthead ── */}
        <PageMasthead
          variant="full"
          marginBottom={16}
          eyebrow="Stint Pro member"
          eyebrowTone="accent"
          title={`Welcome back, ${user?.username || "manager"}.`}
          description="Every Pro feature is unlocked. Your Pro Community League rank moves on its own each scored weekend."
          image={{ src: "/images/Hero-Main.png", position: "right-mask" }}
          tone="live"
          style={{ padding: isMobile ? "32px 22px 28px" : isTablet ? "40px 36px 34px" : "48px 48px 40px" }}
          meta={(
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: statusTone.bg, border: `1px solid ${statusTone.border}`, borderRadius: 999, padding: "10px 18px", flexShrink: 0 }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: statusTone.dot, boxShadow: statusTone.glow, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: statusTone.text, letterSpacing: "-0.01em" }}>Subscription {statusTone.label.toLowerCase()}</span>
            </div>
          )}
        >
          {error && (
            <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: ERROR_BG, border: `1px solid ${ERROR_BORDER}`, color: ERROR_TEXT, fontSize: 13 }}>{error}</div>
          )}
          {note && (
            <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: NOTE_BG, border: `1px solid ${NOTE_BORDER}`, color: NOTE_TEXT, fontSize: 13 }}>{note}</div>
          )}
        </PageMasthead>

        {/* ── Dashboard grid ── */}
        <section className="pro-league-section" style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0,1.35fr) minmax(280px, 1fr)", gap: 14, marginBottom: 16 }}>

          {/* Pro League standings */}
          <div style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden" }}>
            <div style={{ padding: isMobile ? "16px 18px 14px" : "20px 24px 16px", borderBottom: `1px solid ${HAIRLINE}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <Kicker color={ACCENT}>Your Pro League</Kicker>
                <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 900, letterSpacing: "-0.03em", marginTop: 4 }}>
                  {proLeague.myRank
                    ? `Rank #${proLeague.myRank}${proLeague.totalMembers ? ` of ${proLeague.totalMembers}` : ""}`
                    : proLeague.totalMembers
                      ? "Awaiting first scored pick"
                      : "You're one of the founding members"}
                </div>
              </div>
              <button onClick={openLeagues} className="pro-gradient-btn" style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 999, color: "#fff", cursor: "pointer", fontWeight: 900, fontSize: 13, padding: "10px 18px", boxShadow: "0 4px 16px rgba(255,106,26,0.24)" }}>
                View Pro League
              </button>
            </div>
            <div style={{ padding: isMobile ? "14px 18px 18px" : "16px 22px 20px" }}>
              {proLeague.state === "loading" ? (
                <div style={{ fontSize: 13, color: SUBTLE_TEXT, padding: "18px 4px" }}>Loading standings…</div>
              ) : proLeague.leaderboard.length === 0 ? (
                <div style={{ fontSize: 13, color: MUTED_TEXT, padding: "18px 4px", lineHeight: 1.65 }}>
                  No scored picks on the Pro board yet. As soon as your weekend scores, your rank updates here automatically.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {proLeague.leaderboard.slice(0, 5).map((row, index) => {
                    const rank  = index + 1;
                    const isYou = row.user_id === user?.id;
                    const isGold = rank === 1;
                    const bg = isYou ? rgbaFromHex(ACCENT, 0.07)
                      : isGold ? "rgba(251,191,36,0.05)"
                      : "var(--btn-secondary-bg)";
                    const border = isYou ? `1px solid ${rgbaFromHex(ACCENT, 0.28)}`
                      : isGold ? "1px solid rgba(251,191,36,0.22)"
                      : `1px solid ${HAIRLINE}`;
                    return (
                      <div key={row.user_id} style={{
                        display:      "flex",
                        alignItems:   "center",
                        gap:          10,
                        padding:      "10px 12px",
                        borderRadius: RADIUS_MD,
                        background:   bg,
                        border,
                      }}>
                        <RankBadge rank={rank} size={26} />
                        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.username}{isYou && <span style={{ color: "var(--brand)", marginLeft: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>You</span>}</span>
                        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 900, color: isGold ? PRO_AMBER_DOT : TEXT_PRIMARY, fontVariantNumeric: "tabular-nums" }}>{row.points} pts</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Subscription management */}
          <div style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden" }}>
            <div style={{ padding: isMobile ? "16px 18px 14px" : "20px 22px 16px", borderBottom: `1px solid ${HAIRLINE}` }}>
              <Kicker>Manage</Kicker>
              <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 900, letterSpacing: "-0.03em", marginTop: 4 }}>Your subscription</div>
            </div>
            <div style={{ padding: isMobile ? "14px 18px 18px" : "16px 22px 20px", display: "grid", gap: 12 }}>
              {/* Status is already signalled by the hero pill — only show
                  renewal + billing-managed-by here so the panel gives the
                  user information they can act on. */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: RADIUS_MD, background: PANEL_BG_ALT, border: PANEL_BORDER }}>
                  <span style={{ fontSize: 12, color: MUTED_TEXT }}>{scheduledToCancel ? "Access ends" : "Renews"}</span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{subscriptionEndsLabel || "On subscription anniversary"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: RADIUS_MD, background: PANEL_BG_ALT, border: PANEL_BORDER }}>
                  <span style={{ fontSize: 12, color: MUTED_TEXT }}>Billing</span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>Managed via Stripe</span>
                </div>
              </div>

              <button
                onClick={handlePortal}
                disabled={portalLoading || statusRefreshing}
                className="pro-secondary-btn"
                style={{
                  background:   "transparent",
                  border:       PANEL_BORDER,
                  borderRadius: 999,
                  padding:      isMobile ? "12px 20px" : "10px 18px",
                  minHeight:    isMobile ? 44 : 38,
                  fontSize:     13,
                  fontWeight:   700,
                  color:        MUTED_TEXT,
                  cursor:       portalLoading || statusRefreshing ? "wait" : "pointer",
                  fontFamily:   "inherit",
                }}
              >
                {portalLoading || statusRefreshing ? "Opening…" : "Manage subscription"}
              </button>

              {scheduledToCancel && (
                <div style={{ padding: "10px 12px", borderRadius: RADIUS_MD, background: PRO_AMBER_BG, border: `1px solid ${PRO_AMBER_BORDER}`, color: PRO_AMBER_TEXT, fontSize: 12, lineHeight: 1.6 }}>
                  Subscription scheduled to cancel. You keep full Pro access until {subscriptionEndsLabel || "the end of the current billing period"}.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quick links */}
        <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0,1fr))", gap: 10 }}>
          {[
            { title: "Open your Coach",    desc: "Archetype, Protect, Challenge, and the next move written around your picks.", onClick: openInsights, color: AI_BLUE_TEXT, bg: AI_BLUE_SOFT,               border: AI_BLUE_BORDER                 },
            { title: "Explore game modes", desc: "Survival, Draft, Double Down, Head-to-Head, and Budget — run any in your leagues.", onClick: openLeagues, color: "var(--brand)",      bg: "rgba(255,106,26,0.07)",  border: "rgba(255,106,26,0.20)"       },
            { title: "View Pro standings", desc: "Watch the full season-long Pro Community leaderboard.",                          onClick: openLeagues, color: PRO_AMBER_DOT, bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.22)"       },
          ].map((link) => (
            <button
              key={link.title}
              onClick={link.onClick}
              className="pro-utility-card"
              style={{ textAlign: "left", background: link.bg, border: `1px solid ${link.border}`, borderRadius: CARD_RADIUS, padding: isMobile ? "14px 16px" : "16px 18px", cursor: "pointer", fontFamily: "inherit", color: TEXT_PRIMARY, display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.02em", color: link.color }}>{link.title}</span>
              <span style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.55 }}>{link.desc}</span>
            </button>
          ))}
        </section>
      </div>
      </>
    );
  }

  // ─── Free user view ─────────────────────────────────────────────────────────

  const priceValue = plan === "monthly" ? "$4" : "$29";
  const priceUnit  = plan === "monthly" ? "/ month" : "/ full season";

  return (
    <>
    <style>{sharedStyles}</style>
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "0 0 40px" : "0 0 60px" }}>

      {/* ── Checkout block — canonical PageMasthead with center-aligned identityRow ── */}
      <PageMasthead
        variant="full"
        marginBottom={16}
        image={{ src: "/images/Hero-Main.png", position: "right-mask" }}
        tone="ambient"
        style={{ padding: isMobile ? "36px 22px 32px" : isTablet ? "44px 36px 38px" : "52px 52px 44px", textAlign: "center" }}
        identityRow={(
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,106,26,0.10)", border: `1px solid ${rgbaFromHex(ACCENT, 0.28)}`, borderRadius: 999, padding: "5px 14px", marginBottom: 20 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand)" }} />
              <Kicker color={ACCENT} style={{ letterSpacing: "0.14em" }}>Stint Pro</Kicker>
            </div>

            <h1 className="stint-page-title" style={{ margin: "0 auto 14px", fontSize: isMobile ? 30 : isTablet ? 38 : 44, letterSpacing: isMobile ? "-0.045em" : "-0.05em", lineHeight: 1.05, maxWidth: 620 }}>
              Your season, <span style={{ color: "var(--brand)" }}>sharper</span>.
            </h1>

            <p className="stint-body" style={{ margin: "0 auto 28px", maxWidth: 460, fontSize: isMobile ? 14 : 15, lineHeight: 1.65 }}>
              Pro game modes, AI-powered insights, unlimited leagues and full stats — everything you need to compete seriously.
            </p>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <PriceToggle
                plan={plan}
                isMobile={isMobile}
                onChange={(next) => withViewTransition(() => setPlan(next), { name: "pro-price", direction: next === "season" ? "forward" : "back" })}
              />

              <div style={{ marginBottom: 2 }}>
                <span
                  key={plan}
                  className="pro-price-num"
                  style={{
                    display:            "inline-block",
                    fontFamily:         "var(--font-mono)",
                    fontSize:           isMobile ? 38 : isTablet ? 44 : 50,
                    fontWeight:         700,
                    letterSpacing:      "-0.03em",
                    color:              TEXT_PRIMARY,
                    fontVariantNumeric: "tabular-nums",
                    viewTransitionName: "pro-price-value",
                  }}
                >
                  {priceValue}
                </span>
                <span style={{ fontSize: 14, color: MUTED_TEXT, marginLeft: 6, viewTransitionName: "pro-price-unit" }}>{priceUnit}</span>
              </div>

              {error && (
                <div style={{ fontSize: 13, color: ERROR_TEXT, background: ERROR_BG, border: `1px solid ${ERROR_BORDER}`, borderRadius: 8, padding: "8px 14px", maxWidth: 460 }}>{error}</div>
              )}

              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="pro-cta-btn"
                style={{
                  display:        "inline-flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  height:         46,
                  padding:        "0 30px",
                  borderRadius:   999,
                  background:     BRAND_GRADIENT,
                  color:          "#fff",
                  fontSize:       14,
                  fontWeight:     900,
                  letterSpacing:  "-0.01em",
                  border:         "none",
                  cursor:         checkoutLoading ? "wait" : "pointer",
                  boxShadow:      "0 4px 16px rgba(255,106,26,0.24)",
                  fontFamily:     "inherit",
                }}
              >
                {checkoutLoading ? "Redirecting…" : user ? "Unlock Stint Pro" : "Sign in to unlock"}
              </button>

              <p style={{ margin: 0, fontSize: 12, color: SUBTLE_TEXT }}>
                Cancel anytime · Secure checkout via Stripe
              </p>
            </div>
          </div>
        )}
      />

      {/* ── Proof strip ── */}
      <section className="pro-features-section" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, letterSpacing: "-0.03em", color: TEXT_PRIMARY }}>
            Why people go Pro
          </div>
        </div>
        {/* Desktop: asymmetric 1.35fr × 1fr with Pro League featured on the left, AI + Coach stacked on the right.
             Tablet/mobile: single column stack so each module keeps its weight. */}
        <div style={{
          display:              "grid",
          gridTemplateColumns:  isMobile || isTablet ? "1fr" : "minmax(0,1.35fr) minmax(0,1fr)",
          gap:                  10,
          alignItems:           "stretch",
        }}>
          <ProLeagueFeatureCard proLeague={proLeague} isMobile={isMobile} />
          <div style={{ display: "grid", gap: 10 }}>
            <AiSampleProofCard isMobile={isMobile} />
            <CoachArchetypeProofCard isMobile={isMobile} />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="pro-features-section" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, letterSpacing: "-0.03em", color: TEXT_PRIMARY, marginBottom: 14 }}>
          What's in Pro
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {HEADLINE_FEATURES.map((f) => (
            <HeadlineCard key={f.title} {...f} isMobile={isMobile} />
          ))}
        </div>

        {/* Utility grid: 2 cols on mobile, 2 cols on tablet (avoids cramped 4-column
             density at 820-1120), 4 cols only on true desktop. */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
          {UTILITY_FEATURES.map((f) => (
            <UtilityCard key={f.title} {...f} isMobile={isMobile} />
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="pro-features-section" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, letterSpacing: "-0.03em", color: TEXT_PRIMARY }}>Questions</div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
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
    .pro-hero-section, .pro-league-section, .pro-features-section, .pro-price-num {
      animation: none !important; opacity: 1 !important; transform: none !important;
    }
    .pro-cta-btn, .pro-secondary-btn, .pro-gradient-btn,
    .pro-headline-card, .pro-utility-card, .pro-proof-card { transition: none !important; }
    ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
  }
`;
