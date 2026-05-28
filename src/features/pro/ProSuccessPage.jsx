"use client";

import { useEffect, useState } from "react";
import {
  ACCENT,
  AI_BLUE_BORDER,
  AI_BLUE_SOFT,
  AI_BLUE_TEXT,
  BG_SURFACE,
  BRAND_GRADIENT,
  CARD_RADIUS,
  CONTENT_MAX,
  HAIRLINE,
  LIVE_GREEN,
  LIVE_GREEN_GLOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  PRO_AMBER_DOT,
  RADIUS_MD,
  RADIUS_PILL,
  SECTION_RADIUS,
  SUBTLE_TEXT,
  SUCCESS_BG,
  SUCCESS_BORDER,
  SUCCESS_TEXT,
  TEXT_PRIMARY,
  rgbaFromHex,
} from "@/src/constants/design";
import { nextRace } from "@/src/constants/calendar";
import useViewport from "@/src/lib/useViewport";
import usePageMetadata from "@/src/lib/usePageMetadata";
import { animateNumber } from "@/src/lib/viewTransition";
import { pageToHref } from "@/src/shell/routing";
import RankBadge from "@/src/ui/RankBadge";
import Kicker from "@/src/ui/Kicker";
import PageMasthead from "@/src/ui/PageMasthead";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateLong(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDateMedium(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function inferPlanLabel(subscriptionEnd) {
  if (!subscriptionEnd) return null;
  const now = new Date();
  const end = new Date(subscriptionEnd);
  if (Number.isNaN(end.getTime())) return null;
  const daysOut = Math.round((end - now) / (1000 * 60 * 60 * 24));
  if (daysOut <= 0) return null;
  if (daysOut <= 45)  return "$4/month";
  if (daysOut <= 400) return "$29/season";
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProSuccessPage({ user, setPage }) {
  const { isMobile, isTablet } = useViewport();

  usePageMetadata({
    title:       "Welcome to Stint Pro",
    description: "Your Stint Pro subscription is active. Pro game modes, AI insights, unlimited leagues, and the Pro community league are all unlocked.",
    path:        "/pro/success",
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const [proLeague, setProLeague] = useState({
    state:        "loading",
    totalMembers: 0,
    myRank:       null,
    leaderboard:  [],
  });

  // Animated rank — counts up from 0 → target once the league snapshot resolves.
  // Reads as a pit-board indicator settling to your final position.
  const [animatedRank, setAnimatedRank] = useState(0);
  useEffect(() => {
    if (proLeague.state !== "ready" || !proLeague.myRank) {
      setAnimatedRank(0);
      return undefined;
    }
    let cancel = null;
    // Delay slightly so the hero + landing module have already entered.
    const id = setTimeout(() => {
      cancel = animateNumber({
        from:     0,
        to:       proLeague.myRank,
        duration: 900,
        onUpdate: (v) => setAnimatedRank(Math.round(v)),
      });
    }, 380);
    return () => {
      clearTimeout(id);
      if (cancel) cancel();
    };
  }, [proLeague.state, proLeague.myRank]);

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
        });
      } catch {
        if (!active) return;
        setProLeague({ state: "ready", totalMembers: 0, myRank: null, leaderboard: [] });
      }
    }

    loadLeague();
    return () => { active = false; };
  }, [user?.id]);

  const username           = user?.username ?? "manager";
  const subscriptionEnd    = user?.subscription_end || null;
  const renewsLabel        = formatDateLong(subscriptionEnd);
  const planLabel          = inferPlanLabel(subscriptionEnd);
  const upcomingRace       = nextRace();
  const upcomingRaceDate   = upcomingRace?.date ? new Date(upcomingRace.date) : null;
  const now                = new Date();
  const upcomingIsFuture   = upcomingRaceDate && !Number.isNaN(upcomingRaceDate.getTime()) && upcomingRaceDate >= now;

  const goToPage = (page, options = {}) => {
    if (typeof setPage === "function") {
      setPage(page);
      return;
    }
    if (typeof window !== "undefined") {
      window.location.href = pageToHref(page, options);
    }
  };

  // First move logic — race-aware
  const firstMove = (() => {
    if (upcomingIsFuture && upcomingRace) {
      return {
        kicker:  "First move",
        title:   `Lock your picks for ${upcomingRace.n}`,
        body:    `Your next race is on ${formatDateMedium(upcomingRace.date)}. Make your picks with the Coach on your side — the first Pro debrief lands after it's scored.`,
        cta:     "Open the picks board",
        accent:  ACCENT,
        onClick: () => goToPage("predictions", { raceRound: upcomingRace.r }),
      };
    }
    return {
      kicker:  "First move",
      title:   "Explore Pro game modes",
      body:    "No race scheduled in the window. Spin up a Survival, Draft, or Double-Down league and put the new rules to work.",
      cta:     "Browse leagues",
      accent:  ACCENT,
      onClick: () => goToPage("community"),
    };
  })();

  // Pro League landing module
  const leagueLanding = (() => {
    if (proLeague.state === "loading") {
      return {
        kicker:   "Pro Community League",
        title:    "Landing you in the league…",
        subtitle: "Pulling the current standings — this only takes a second.",
        isLoading: true,
      };
    }
    if (proLeague.totalMembers === 0) {
      return {
        kicker:   "Pro Community League · Founding",
        title:    "You're a founding member.",
        subtitle: "The Pro Community League opens with you. Every future member will chase your name.",
        isEmpty:  true,
      };
    }
    if (proLeague.totalMembers > 0 && proLeague.totalMembers < 10) {
      return {
        kicker:   "Pro Community League · Founding",
        title:    proLeague.myRank
          ? `You entered at rank #${proLeague.myRank} of ${proLeague.totalMembers}.`
          : `You're in among ${proLeague.totalMembers} founding managers.`,
        subtitle: "The board is early — ranks move fast over the next few rounds. Every point tells.",
      };
    }
    return {
      kicker:   "Pro Community League",
      title:    proLeague.myRank
        ? `You entered at rank #${proLeague.myRank} of ${proLeague.totalMembers}.`
        : `You joined ${proLeague.totalMembers} Pro managers this season.`,
      subtitle: "Your rank updates automatically after each scored weekend. No join step — you're already playing.",
    };
  })();

  const unlockedItems = [
    { label: "Pro game modes",      page: "community", color: "var(--brand)",       bg: "rgba(255,106,26,0.07)", border: "rgba(255,106,26,0.20)" },
    { label: "AI insights + Coach", page: "profile",   color: AI_BLUE_TEXT, bg: AI_BLUE_SOFT,            border: AI_BLUE_BORDER         },
    { label: "Unlimited leagues",   page: "community", color: SUCCESS_TEXT,   bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.20)"  },
    { label: "Pro Community League",page: "community", color: PRO_AMBER_DOT,  bg: "rgba(251,191,36,0.06)", border: "rgba(251,191,36,0.22)" },
  ];

  return (
    <>
    <style>{`
      /* Entry orchestration — one gesture per section, no per-child staggers. */
      @keyframes pss-hero-in {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .pss-hero-section { animation: pss-hero-in 420ms cubic-bezier(0.16,1,0.3,1) both; }

      @keyframes pss-section-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .pss-league-section     { animation: pss-section-in 380ms 70ms  cubic-bezier(0.16,1,0.3,1) both; }
      .pss-unlocked-section   { animation: pss-section-in 380ms 130ms cubic-bezier(0.16,1,0.3,1) both; }
      .pss-first-move-section { animation: pss-section-in 380ms 190ms cubic-bezier(0.16,1,0.3,1) both; }

      /* CTA — premium hover, tight press. Softened glow from the first-pass version. */
      .pss-cta, .pss-chip, .pss-first-move {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .pss-cta {
        transition: box-shadow 240ms cubic-bezier(0.16,1,0.3,1),
                    transform  160ms cubic-bezier(0.16,1,0.3,1),
                    filter     240ms ease,
                    opacity    160ms ease;
      }
      @media (hover: hover) and (pointer: fine) {
        .pss-cta:hover {
          box-shadow: 0 6px 22px rgba(255,106,26,0.30) !important;
          transform: translateY(-1px);
          filter: brightness(1.04);
        }
      }
      .pss-cta:active { transform: translateY(0) scale(0.975); transition-duration: 80ms; }

      .pss-chip {
        transition: border-color 200ms cubic-bezier(0.16,1,0.3,1),
                    transform    220ms cubic-bezier(0.16,1,0.3,1),
                    background   200ms cubic-bezier(0.16,1,0.3,1);
        will-change: transform;
      }
      @media (hover: hover) and (pointer: fine) {
        .pss-chip:hover {
          transform: translateY(-1px);
          border-color: var(--border-soft) !important;
          background: var(--btn-secondary-bg);
        }
      }
      .pss-chip:active { transform: scale(0.985); transition-duration: 80ms; }

      .pss-first-move {
        transition: border-color 240ms cubic-bezier(0.16,1,0.3,1),
                    transform    280ms cubic-bezier(0.16,1,0.3,1),
                    box-shadow   280ms cubic-bezier(0.16,1,0.3,1);
        will-change: transform;
      }
      @media (hover: hover) and (pointer: fine) {
        .pss-first-move:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.26);
          border-color: rgba(255,106,26,0.36) !important;
        }
      }
      .pss-first-move:active { transform: scale(0.994); transition-duration: 100ms; }

      @media (prefers-reduced-motion: reduce) {
        .pss-hero-section, .pss-league-section, .pss-unlocked-section, .pss-first-move-section {
          animation: none !important; opacity: 1 !important; transform: none !important;
        }
        .pss-cta, .pss-chip, .pss-first-move { transition: none !important; }
      }
    `}</style>

    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "0 0 48px" : "0 0 72px" }}>

      {/* ── Confirmation hero — canonical PageMasthead ── */}
      <PageMasthead
        variant="full"
        marginBottom={16}
        eyebrow="Subscription active"
        eyebrowTone="live"
        title={<>You're in, <span style={{ color: "var(--brand)" }}>{username}</span>.</>}
        description="Stint Pro is active. Every Pro surface — game modes, the AI Coach, unlimited leagues, and the Pro Community League — is unlocked starting now."
        image={{ src: "/images/Single%20car%20streak.png", position: "right-mask" }}
        tone="live"
        style={{ padding: isMobile ? "32px 22px 28px" : isTablet ? "40px 36px 34px" : "48px 48px 40px" }}
      >
        {/* Receipt strip — single flowing line so it wraps clean on narrow viewports. */}
        <div style={{
          display:        "inline-block",
          maxWidth:       "100%",
          marginTop:      18,
          padding:        "10px 14px",
          borderRadius:   RADIUS_MD,
          background:     PANEL_BG_ALT,
          border:         PANEL_BORDER,
          fontSize:       12,
          lineHeight:     1.7,
          color:          MUTED_TEXT,
        }}>
          {planLabel && (
            <>
              <span style={{ color: TEXT_PRIMARY, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{planLabel}</span>
              <span style={{ margin: "0 8px", color: SUBTLE_TEXT }}>·</span>
            </>
          )}
          <span>{renewsLabel ? `Next charge ${renewsLabel}` : "Next charge on subscription anniversary"}</span>
          <span style={{ margin: "0 8px", color: SUBTLE_TEXT }}>·</span>
          <span style={{ whiteSpace: "nowrap" }}>Managed via Stripe</span>
        </div>
      </PageMasthead>

      {/* ── Pro League landing (primary activation module) ───────────────── */}
      <section
        className="pss-league-section"
        style={{
          borderRadius: SECTION_RADIUS,
          border:       `1px solid ${rgbaFromHex(ACCENT, 0.24)}`,
          background:   `linear-gradient(160deg, rgba(255,106,26,0.08) 0%, ${BG_SURFACE} 55%)`,
          overflow:     "hidden",
          marginBottom: 16,
          position:     "relative",
        }}
      >
        <img
          src="/images/Single%20car%20streak.png"
          alt=""
          aria-hidden="true"
          style={{
            position:       "absolute",
            top:            0,
            right:          0,
            height:         "100%",
            width:          isMobile ? "90%" : "72%",
            objectFit:      "cover",
            objectPosition: "left center",
            opacity:        isMobile ? "var(--hero-image-opacity-mobile)" : "var(--hero-image-opacity)",
            filter:         "var(--hero-image-filter)",
            pointerEvents:  "none",
            maskImage:        "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 18%, rgba(0,0,0,1) 45%, rgba(0,0,0,1) 100%)",
            WebkitMaskImage:  "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 18%, rgba(0,0,0,1) 45%, rgba(0,0,0,1) 100%)",
          }}
          onError={(e) => { e.target.style.display = "none"; }}
        />

        <div style={{
          position:      "relative",
          zIndex:        1,
          padding:       isMobile ? "22px 20px 20px" : "26px 28px 24px",
          display:       "grid",
          gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0,1.2fr) minmax(260px, 1fr)",
          gap:           isMobile ? 18 : 26,
          alignItems:    "center",
        }}>
          <div style={{ minWidth: 0 }}>
            <Kicker color={ACCENT} style={{ letterSpacing: "0.14em" }}>
              {proLeague.myRank ? "Your starting position" : leagueLanding.kicker}
            </Kicker>

            {proLeague.state === "ready" && proLeague.myRank ? (
              <>
                {/* Pit-board rank. Solid ACCENT on the number, tabular-nums so
                     the count-up doesn't shift width. No gradient text. */}
                <div style={{ display: "flex", alignItems: "baseline", gap: isMobile ? 10 : 14, marginTop: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{
                    fontFamily:         "var(--font-mono)",
                    fontSize:           isMobile ? 56 : 80,
                    fontWeight:         700,
                    letterSpacing:      "-0.05em",
                    color: "var(--brand)",
                    lineHeight:         0.9,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    <span style={{
                      fontSize:           "0.46em",
                      verticalAlign:      "top",
                      marginRight:        6,
                      fontWeight:         800,
                      letterSpacing:      "-0.01em",
                      color:              SUBTLE_TEXT,
                    }}>#</span>
                    <span className="pss-rank-number">{animatedRank || proLeague.myRank}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.01em" }}>of {proLeague.totalMembers}</div>
                    <div style={{ fontSize: 11, color: SUBTLE_TEXT, marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Pro managers</div>
                  </div>
                </div>
                <p style={{ margin: "0 0 18px", fontSize: isMobile ? 13 : 14, lineHeight: 1.7, color: MUTED_TEXT, maxWidth: 540 }}>
                  {leagueLanding.subtitle}
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05, marginTop: 10, marginBottom: 10, color: TEXT_PRIMARY }}>
                  {leagueLanding.title}
                </div>
                <p style={{ margin: "0 0 18px", fontSize: isMobile ? 13 : 14, lineHeight: 1.7, color: MUTED_TEXT, maxWidth: 540 }}>
                  {leagueLanding.subtitle}
                </p>
              </>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => goToPage("community")}
                className="pss-cta"
                style={{
                  display:        "inline-flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  height:         46,
                  padding:        "0 26px",
                  borderRadius:   999,
                  background:     BRAND_GRADIENT,
                  color:          "#fff",
                  fontSize:       14,
                  fontWeight:     900,
                  letterSpacing:  "-0.01em",
                  textDecoration: "none",
                  boxShadow:      "0 4px 20px rgba(255,106,26,0.30)",
                  border:         "none",
                  cursor:         "pointer",
                  fontFamily:     "inherit",
                }}
              >
                View Pro League
              </button>
            </div>
          </div>

          {/* Top-3 preview */}
          <div style={{
            borderRadius: CARD_RADIUS,
            border:       PANEL_BORDER,
            background:   "var(--bg-surface)",
            padding:      isMobile ? "14px 14px 12px" : "16px 16px 14px",
            minHeight:    164,
            display:      "flex",
            flexDirection: "column",
            gap:          8,
          }}>
            <Kicker>Top of the Pro board</Kicker>
            {proLeague.state === "loading" ? (
              <div style={{ fontSize: 12, color: SUBTLE_TEXT, padding: "18px 4px" }}>Loading…</div>
            ) : proLeague.leaderboard.length === 0 ? (
              <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.6 }}>
                The first three names go up as soon as Pro members score.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                {proLeague.leaderboard.slice(0, 3).map((row, index) => {
                  const rank   = index + 1;
                  const isYou  = row.user_id === user?.id;
                  const isGold = rank === 1;
                  return (
                    <div key={row.user_id} className="pss-league-row" style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          10,
                      padding:      "8px 10px",
                      borderRadius: RADIUS_MD,
                      background:   isYou ? rgbaFromHex(ACCENT, 0.08) : isGold ? "rgba(251,191,36,0.04)" : "rgba(255,255,255,0.02)",
                      border:       isYou ? `1px solid ${rgbaFromHex(ACCENT, 0.28)}` : isGold ? "1px solid rgba(251,191,36,0.20)" : `1px solid ${HAIRLINE}`,
                    }}>
                      <RankBadge rank={rank} />
                      <span style={{ fontSize: 12, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.username}
                        {isYou && <span style={{ color: "var(--brand)", marginLeft: 6, fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>You</span>}
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 900, color: isGold ? PRO_AMBER_DOT : TEXT_PRIMARY, fontVariantNumeric: "tabular-nums" }}>{row.points} pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Unlocked chip row ────────────────────────────────────────────── */}
      <section className="pss-unlocked-section" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT_PRIMARY }}>Just unlocked</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr 1fr" : "repeat(4, minmax(0,1fr))", gap: 10 }}>
          {unlockedItems.map((item) => (
            <button
              key={item.label}
              onClick={() => goToPage(item.page)}
              className="pss-chip"
              style={{
                display:        "flex",
                alignItems:     "center",
                gap:            10,
                padding:        isMobile ? "14px 14px" : "12px 14px",
                minHeight:      isMobile ? 56 : 48,
                borderRadius:   CARD_RADIUS,
                background:     item.bg,
                border:         `1px solid ${item.border}`,
                cursor:         "pointer",
                fontFamily:     "inherit",
                textAlign:      "left",
                color:          TEXT_PRIMARY,
                minWidth:       0,
              }}
            >
              <span style={{
                fontSize:      13,
                fontWeight:    800,
                letterSpacing: "-0.01em",
                color:         item.color,
                flex:          1,
                minWidth:      0,
                whiteSpace:    isMobile ? "normal" : "nowrap",
                overflow:      isMobile ? "visible" : "hidden",
                textOverflow:  "ellipsis",
                lineHeight:    1.25,
              }}>{item.label}</span>
              <span aria-hidden="true" style={{ color: item.color, fontSize: 14, flexShrink: 0, opacity: 0.8 }}>→</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── First move tile ──────────────────────────────────────────────── */}
      <section className="pss-first-move-section" style={{ marginBottom: 18 }}>
        <button
          onClick={firstMove.onClick}
          className="pss-first-move"
          style={{
            display:       "block",
            width:         "100%",
            textAlign:     "left",
            background:    PANEL_BG,
            border:        `1px solid ${rgbaFromHex(firstMove.accent, 0.22)}`,
            borderRadius:  SECTION_RADIUS,
            padding:       isMobile ? "18px 20px 16px" : "20px 26px 18px",
            boxShadow:     "0 8px 20px rgba(0,0,0,0.18)",
            cursor:        "pointer",
            fontFamily:    "inherit",
            color:         TEXT_PRIMARY,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <Kicker color={firstMove.accent}>{firstMove.kicker}</Kicker>
          </div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8 }}>
            {firstMove.title}
          </div>
          <div style={{ fontSize: 13, color: MUTED_TEXT, lineHeight: 1.65, maxWidth: 620, marginBottom: 12 }}>
            {firstMove.body}
          </div>
          <span style={{
            display:        "inline-flex",
            alignItems:     "center",
            gap:            6,
            background:     rgbaFromHex(firstMove.accent, 0.14),
            border:         `1px solid ${rgbaFromHex(firstMove.accent, 0.30)}`,
            borderRadius:   RADIUS_PILL,
            color:          firstMove.accent,
            fontSize:       13,
            fontWeight:     800,
            padding:        "8px 14px",
            letterSpacing:  "-0.01em",
          }}>
            {firstMove.cta}
            <span aria-hidden="true" style={{ fontSize: 12 }}>→</span>
          </span>
        </button>
      </section>

      {/* ── Secondary dismiss ─────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <a
          href="/"
          style={{
            display:        "inline-flex",
            alignItems:     "center",
            minHeight:      isMobile ? 44 : 32,
            padding:        "0 12px",
            fontSize:       12,
            color:          SUBTLE_TEXT,
            textDecoration: "none",
            fontWeight:     700,
            letterSpacing:  "0.02em",
          }}
        >
          or head to the dashboard →
        </a>
      </div>
    </div>
    </>
  );
}
