import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import {
  ACCENT,
  BRAND_GRADIENT,
  CARD_RADIUS,
  CARD_SHADOW,
  EASE_OUT_EXPO,
  ERROR_TEXT,
  HAIRLINE,
  LIFTED_SHADOW,
  LIVE_GREEN,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  PRO_AMBER_DOT,
  RADIUS_MD,
  RADIUS_PILL,
  SECTION_RADIUS,
  SUBTLE_TEXT,
  SUCCESS,
  TEXT_PRIMARY,
  rgbaFromHex,
} from "@/src/constants/design";

// Soft info-blue — "roadmap / ideas / community" signal on dark bg.
// Grid-scoped; related to the design-system INFO token but tuned lighter so
// it reads on the dark panel without feeling saturated. Used by the Shaping
// STINT section label, Leading Idea rail, and the Pulse "Ideas in motion"
// chip.
const INFO_SOFT = "#9cd1ff";
import { nextRace } from "@/src/constants/calendar";
import useRaceCalendar from "@/src/lib/useRaceCalendar";
import { requireActiveSession } from "@/src/shell/authProfile";
import useViewport from "@/src/lib/useViewport";
import usePageMetadata from "@/src/lib/usePageMetadata";
import IdentityAvatar from "@/src/ui/IdentityAvatar";
import SectionLabel from "@/src/ui/SectionLabel";
import PageMasthead from "@/src/ui/PageMasthead";
import PageShell from "@/src/ui/PageShell";

// ─── Seed posts — rendered when the database is empty ────────────────────────

const SEED_POSTS = {
  race_discussion: [
    {
      id: "seed-rd-1",
      author_name: "paddockwatch",
      title: "Norris on race pace — is this the real turning point?",
      body: "Qualifying lap was good but the long runs in practice told the real story. MCL39 looked significantly quicker on used mediums than anyone else. I'm going Norris race winner regardless of where he qualifies.",
      category: "race_discussion",
      created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      _seed: true,
      _comments: [
        { id: "sc-1", author_name: "grid_lurker",  body: "Agree. Red Bull on race pace is nowhere near what it was in 2023. The car is a handful on the softs now.", created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() },
        { id: "sc-2", author_name: "tifosi_takes", body: "McLaren 1-2 is genuinely on the table. Piastri looked calm all weekend.", created_at: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString() },
      ],
    },
    {
      id: "seed-rd-2",
      author_name: "apex_anon",
      title: "Who's brave enough to take the DNF pick this weekend?",
      body: "I've been burned twice already this season but Gasly feels overdue. Quiet weekend, no drama, car's been borderline all year. Could also make a case for Stroll — he's been invisible.",
      category: "race_discussion",
      created_at: new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
      _seed: true,
      _comments: [
        { id: "sc-3", author_name: "pitwall_pro",  body: "Stroll for me. That car has looked nervous on the kerbs all season and this circuit punishes that.", created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString() },
        { id: "sc-4", author_name: "paddockwatch", body: "Gasly OR Albon. Both teams have reliability issues queued up behind the scenes.",                  created_at: new Date(Date.now() - 7 * 3600 * 1000).toISOString() },
      ],
    },
    {
      id: "seed-rd-3",
      author_name: "tifosi_takes",
      title: "Hamilton to Ferrari was the right call and the data backs it up",
      body: "Week 1 everyone wrote him off. Midway through the season he's top 5 in the standings and Ferrari are regularly fighting for the podium. The narrative flipped fast.",
      category: "race_discussion",
      created_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
      _seed: true,
      _comments: [
        { id: "sc-5", author_name: "apex_anon", body: "The car suits him more than Leclerc's setup preferences. That's the uncomfortable truth.", created_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString() },
      ],
    },
  ],
  general: [
    {
      id: "seed-gen-1",
      author_name: "pitwall_pro",
      title: "New to Stint — any tips for the first few races?",
      body: "Just signed up before this weekend. Still getting my head around the scoring. Is DNF a trap or is it actually worth going for? And does pole matter as much as race winner for points?",
      category: "general",
      created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      _seed: true,
      _comments: [
        { id: "sc-9",  author_name: "paddockwatch", body: "DNF is high risk — only go for it if you have a strong read. Pole and race winner are the safest entry points to start building your score.", created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
        { id: "sc-10", author_name: "tifosi_takes", body: "Don't neglect fastest lap. It's more predictable than people think — look at who's on fresh tyres late in the race.",                             created_at: new Date(Date.now() - 4.5 * 3600 * 1000).toISOString() },
        { id: "sc-11", author_name: "grid_lurker",  body: "Also: the safety car pick is either 0 or 1. Circuits like Monaco and Singapore it's almost always worth taking.",                                 created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
      ],
    },
    {
      id: "seed-gen-2",
      author_name: "grid_lurker",
      title: "Which constructor is the biggest steal in picks right now?",
      body: "Ferrari have been consistently undervalued by the community average in the constructor pick. They're consistently P2 or better in constructor points but people keep picking Red Bull out of habit.",
      category: "general",
      created_at: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
      _seed: true,
      _comments: [
        { id: "sc-12", author_name: "apex_anon", body: "McLaren is my answer. People sleep on them because Hamilton isn't there but Norris + Piastri is a solid lineup.", created_at: new Date(Date.now() - 29 * 3600 * 1000).toISOString() },
      ],
    },
  ],
  feature_requests: [
    {
      id: "seed-fr-1",
      author_name: "grid_lurker",
      title: "Split comparison: my picks vs top 10 average after each race",
      body: "After scoring I'd love to see a breakdown of how my picks compared to the community average. Did I take more risk on the volatile categories? Was I contrarian on pole? Useful to see where you diverge.",
      category: "feature_requests",
      created_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      vote_score: 14,
      _seed: true,
      _comments: [
        { id: "sc-6", author_name: "pitwall_pro",  body: "Yes. Even just seeing 'you were in the top 20% on DNF accuracy' would be useful context.",            created_at: new Date(Date.now() - 17 * 3600 * 1000).toISOString() },
        { id: "sc-7", author_name: "tifosi_takes", body: "Upvoted. Would also help identify if I'm consistently too conservative on the high-variance categories.", created_at: new Date(Date.now() - 16 * 3600 * 1000).toISOString() },
      ],
    },
    {
      id: "seed-fr-2",
      author_name: "pitwall_pro",
      title: "Push notification 30 minutes before picks lock",
      body: "I missed lock in Singapore because I forgot the time zone change. A 30-minute reminder notification would fix this every time. Especially useful for races that aren't on your home schedule.",
      category: "feature_requests",
      created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      vote_score: 9,
      _seed: true,
      _comments: [
        { id: "sc-8", author_name: "grid_lurker", body: "This needs to exist. Missed two locks this year because of exactly this.", created_at: new Date(Date.now() - 35 * 3600 * 1000).toISOString() },
      ],
    },
    {
      id: "seed-fr-3",
      author_name: "apex_anon",
      title: "Show each pick's historical accuracy next to the input",
      body: "When I'm filling in the pole pick, show me that I've been right 3/7 times on pole historically. Small addition but would stop me from just going on gut every time.",
      category: "feature_requests",
      created_at: new Date(Date.now() - 52 * 3600 * 1000).toISOString(),
      vote_score: 6,
      _seed: true,
      _comments: [],
    },
  ],
};

// Stable avatar colours for seed-post authors. Uses the same `support-*`
// keys that real users pick in onboarding — one avatar palette across every
// identity surface.
const SEED_AUTHOR_COLORS = {
  paddockwatch:    "support-mclaren",
  grid_lurker:     "support-williams",
  tifosi_takes:    "support-ferrari",
  apex_anon:       "support-alpine",
  pitwall_pro:     "support-mercedes",
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function relativeTime(value) {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7)     return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 6)    return `${weeks}w ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function absoluteTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(d);
}

function timeGroupKey(value) {
  if (!value) return "earlier";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "earlier";
  const now    = new Date();
  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day    = 86400000;
  if (then >= today)          return "today";
  if (then >= today - day)    return "yesterday";
  if (then >= today - 6 * day) return "week";
  return "earlier";
}

const TIME_GROUP_LABELS = {
  today:     "Today",
  yesterday: "Yesterday",
  week:      "Earlier this week",
  earlier:   "Earlier",
};

function normalizeProfile(profile) {
  if (!profile) return profile;
  const favoriteTeam = profile.favorite_team || null;
  const avatarColor  = profile.avatar_color || null;
  return { ...profile, favorite_team: favoriteTeam, avatar_color: avatarColor };
}

// Picks an avatar color for an identity: real profile colour first, then the
// seed-author palette by name, then undefined (IdentityAvatar handles that).
function resolveAvatarColor(profile, name) {
  return (
    profile?.avatar_color
    || SEED_AUTHOR_COLORS[String(name || "").toLowerCase()]
    || undefined
  );
}

function isProIdentity(profile, fallbackName = "") {
  return profile?.subscription_status === "pro";
}

function dateStampForGroup(key) {
  const now = new Date();
  const fmt = (d) => new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" })
    .format(d).toUpperCase();
  if (key === "today")     return fmt(now);
  if (key === "yesterday") { const d = new Date(now); d.setDate(now.getDate() - 1); return fmt(d); }
  return null;
}

// Featured-take selection: most recent race_discussion thread (with reply-having
// preferred when we can tell). Simple rule, easy to evolve into curation later.
function pickFeaturedThread(racePosts, commentsByPostId) {
  if (!racePosts.length) return null;
  const withReplies = racePosts.find((p) => {
    const list = p._seed ? p._comments : commentsByPostId[p.id];
    return Array.isArray(list) && list.length > 0;
  });
  return withReplies || racePosts[0];
}

// ─── Shared primitives ──────────────────────────────────────────────────────


function ByLine({ author, authorProfile, pro, createdAt, compact = false }) {
  return (
    <div style={{
      display:       "flex",
      alignItems:    "center",
      gap:           compact ? 8 : 10,
      minWidth:      0,
    }}>
      <IdentityAvatar
        name={author}
        username={author}
        colorKey={resolveAvatarColor(authorProfile, author)}
        size={compact ? 28 : 32}
        pro={pro}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{
          fontSize:      compact ? 12 : 13,
          fontWeight:    800,
          letterSpacing: "-0.01em",
          color:         TEXT_PRIMARY,
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
        }}>{author}</span>
        <span
          title={createdAt ? absoluteTime(createdAt) : undefined}
          style={{
            fontSize:           10,
            color:              SUBTLE_TEXT,
            fontWeight:         700,
            letterSpacing:      "0.02em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {relativeTime(createdAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Vote button column (for Shaping STINT) ─────────────────────────────────

function VoteColumn({ postId, score, userVote, isOwn, disabled, onVote, isMobile }) {
  const upActive   = userVote === 1;
  const downActive = userVote === -1;
  const inert      = isOwn || disabled;
  // Mobile tap target lifted to 40px (from 32) — closer to 44px HIG minimum
  // while keeping the column narrow enough for idea rows.
  const size       = isMobile ? 40 : 28;

  const scoreRef = useRef(null);
  const prevScore = useRef(score);
  useEffect(() => {
    if (prevScore.current === score) return;
    prevScore.current = score;
    const el = scoreRef.current;
    if (!el) return;
    el.classList.remove("gr-score-pop");
    void el.offsetWidth;
    el.classList.add("gr-score-pop");
  }, [score]);
  const makeStyle = (variant, active) => ({
    width:          size,
    height:         size,
    padding:        0,
    borderRadius:   8,
    border:         `1px solid ${active
      ? (variant === "up" ? rgbaFromHex(ACCENT, 0.44) : "rgba(239,68,68,0.44)")
      : "rgba(148,163,184,0.14)"}`,
    background:     active
      ? (variant === "up" ? rgbaFromHex(ACCENT, 0.14) : "rgba(239,68,68,0.14)")
      : "rgba(255,255,255,0.02)",
    color:          active
      ? (variant === "up" ? ACCENT : ERROR_TEXT)
      : MUTED_TEXT,
    cursor:         inert ? "not-allowed" : "pointer",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    opacity:        isOwn ? 0.4 : disabled ? 0.55 : 1,
  });
  const hint = isOwn
    ? "You can't vote on your own idea"
    : disabled
      ? "Log in to vote"
      : undefined;

  return (
    <div
      className="gr-vote-col"
      title={hint}
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            4,
        flexShrink:     0,
        width:          isMobile ? 52 : 52,
      }}
    >
      <span
        ref={scoreRef}
        aria-live="polite"
        style={{
          fontSize:           isMobile ? 17 : 19,
          fontWeight:         900,
          letterSpacing:      "-0.035em",
          color:              score > 0 ? TEXT_PRIMARY : score < 0 ? ERROR_TEXT : MUTED_TEXT,
          fontVariantNumeric: "tabular-nums",
          lineHeight:         1,
          marginBottom:       2,
          display:            "inline-block",
          transformOrigin:    "center bottom",
          willChange:         "transform",
        }}
      >
        {score}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!inert) onVote(postId, upActive ? 0 : 1); }}
        className="gr-vote-btn"
        style={makeStyle("up", upActive)}
        aria-label="Upvote"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 9L7 4L11 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!inert) onVote(postId, downActive ? 0 : -1); }}
        className="gr-vote-btn"
        style={makeStyle("down", downActive)}
        aria-label="Downvote"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 5L7 10L11 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// ─── Masthead — editorial opening ───────────────────────────────────────────

// ─── PaddockBriefing — unified hero (Masthead + Pulse strip + Composer) ─────
//
// One card: race context, the room's mood (winner consensus, DNF, voices,
// ideas), and an inline composer. Replaces three stacked sections so the
// user lands directly on "what's happening + how to join in."

function PaddockBriefingChip({ kicker, value, sub, accent, isMobile, mono }) {
  return (
    <div style={{
      padding: isMobile ? "10px 12px 11px" : "12px 14px 12px",
      borderRadius: 12,
      background: "rgba(6,16,27,0.50)",
      border: `1px solid ${rgbaFromHex(accent || "#94a3b8", 0.20)}`,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 3,
      position: "relative",
      overflow: "hidden",
    }}>
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: 2,
        background: accent || "rgba(148,163,184,0.6)",
        opacity: 0.65,
      }} />
      <span style={{
        fontSize: 9, fontWeight: 900,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: SUBTLE_TEXT,
      }}>{kicker}</span>
      <span style={{
        fontSize: isMobile ? 15 : 16,
        fontWeight: 900,
        letterSpacing: mono ? "-0.035em" : "-0.022em",
        color: accent || TEXT_PRIMARY,
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>{value || "—"}</span>
      {sub && (
        <span style={{
          fontSize: 10.5,
          color: SUBTLE_TEXT,
          fontWeight: 600,
          letterSpacing: "-0.005em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{sub}</span>
      )}
    </div>
  );
}

function PaddockBriefing({
  race, mood, loading, threadCount, voicesCount, isSeedMode, isMobile,
  user, demoPreview, openAuth, onSubmit, posting,
}) {
  const roundLabel = race?.r ? `R${String(race.r).padStart(2, "0")}` : "—";
  const raceName   = race?.n || "this weekend";
  const raceDate   = race?.date
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(race.date)).toUpperCase()
    : null;

  const pulseStatus = (() => {
    if (loading)    return { live: false, copy: "Walking the paddock…" };
    if (isSeedMode) return { live: false, copy: "Paddock opens this week" };
    const threads = threadCount || 0;
    const voices  = voicesCount || 0;
    if (!threads)   return { live: false, copy: "Start the first thread" };
    const vPart = voices ? `${voices} ${voices === 1 ? "voice" : "voices"}` : null;
    const tPart = `${threads} ${threads === 1 ? "thread" : "threads"}`;
    return { live: true, copy: [vPart, tPart].filter(Boolean).join(" · ") };
  })();

  return (
    <section
      className="pd-masthead"
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       PANEL_BORDER,
        background:   `
          linear-gradient(140deg, ${rgbaFromHex(ACCENT, 0.32)} 0%, ${rgbaFromHex(ACCENT, 0.08)} 40%, rgba(6,16,27,0.96) 100%),
          url("/images/Rear%20close%20up.png") center / cover no-repeat,
          ${PANEL_BG}
        `,
        boxShadow:    LIFTED_SHADOW,
        marginBottom: isMobile ? 22 : 28,
        padding:      isMobile ? "22px 20px 22px" : "32px 36px 30px",
      }}
    >
      {/* Top accent rail */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${ACCENT} 30%, ${ACCENT} 70%, transparent)`,
        opacity: 0.92,
      }} />

      {/* Row 1: kicker + live status */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: isMobile ? 14 : 18,
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.78)", flexWrap: "wrap" }}>
          <span aria-hidden="true" style={{
            width: 6, height: 6, borderRadius: "50%", background: ACCENT,
            boxShadow: `0 0 0 4px ${rgbaFromHex(ACCENT, 0.22)}`,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 800,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.84)",
            fontVariantNumeric: "tabular-nums",
          }}>The Paddock · {roundLabel}{raceDate ? ` · ${raceDate}` : ""}</span>
        </div>
        <span
          className={pulseStatus.live ? "pd-pulse-live" : ""}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 12px",
            borderRadius: RADIUS_PILL,
            background: "rgba(6,16,27,0.42)",
            border: `1px solid ${rgbaFromHex(pulseStatus.live ? LIVE_GREEN : "#94a3b8", 0.28)}`,
          }}
        >
          <span
            aria-hidden="true"
            className={pulseStatus.live ? "pd-pulse-dot pd-pulse-dot--live" : "pd-pulse-dot"}
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: pulseStatus.live ? LIVE_GREEN : "rgba(148,163,184,0.5)",
              boxShadow: pulseStatus.live ? `0 0 0 3px ${rgbaFromHex(SUCCESS, 0.16)}` : "none",
              flexShrink: 0,
            }}
          />
          <span style={{
            fontSize: 10, fontWeight: 800,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: pulseStatus.live ? "rgba(255,255,255,0.92)" : SUBTLE_TEXT,
            fontVariantNumeric: "tabular-nums",
          }}>
            {pulseStatus.copy}
          </span>
        </span>
      </div>

      {/* Row 2: wordmark + lede */}
      <div style={{ marginBottom: isMobile ? 18 : 22 }}>
        <h1 className="stint-page-title" style={{
          margin: 0,
          fontSize: isMobile ? "clamp(40px, 11vw, 58px)" : "clamp(56px, 6.8vw, 84px)",
          fontWeight: 900,
          letterSpacing: isMobile ? "-0.05em" : "-0.055em",
          lineHeight: 0.92,
          color: "rgba(255,255,255,0.98)",
          textShadow: "0 2px 18px rgba(0,0,0,0.32)",
          textTransform: "uppercase",
        }}>
          The Paddock
        </h1>
        <div aria-hidden="true" style={{
          display: "flex", alignItems: "center", gap: 0,
          marginTop: isMobile ? 12 : 14,
          marginBottom: isMobile ? 10 : 12,
        }}>
          <span style={{ width: 48, height: 2, background: ACCENT, flexShrink: 0 }} />
          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.10)" }} />
        </div>
        <p style={{
          margin: 0,
          fontSize: isMobile ? 13.5 : 15,
          lineHeight: 1.55,
          color: "rgba(226,232,240,0.78)",
          letterSpacing: "-0.005em",
          maxWidth: "52ch",
          fontWeight: 500,
        }}>
          Where Stint reads the room before{" "}
          <span style={{ color: "rgba(255,255,255,0.96)", fontWeight: 800 }}>{raceName}</span>.
        </p>
      </div>

      {/* Row 4: inline composer */}
      <InlineComposer
        user={user}
        demoPreview={demoPreview}
        openAuth={openAuth}
        onSubmit={onSubmit}
        posting={posting}
        raceName={raceName}
        isMobile={isMobile}
      />
    </section>
  );
}

function PaddockMasthead({ race, loading, threadCount, voicesCount, isSeedMode, isMobile }) {
  const roundLabel = race?.r ? `R${String(race.r).padStart(2, "0")}` : "—";
  const raceName   = race?.n || "this weekend";
  const raceDate   = race?.date
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(race.date)).toUpperCase()
    : null;

  const pulse = (() => {
    if (loading)    return { live: false, copy: "Walking the paddock…" };
    if (isSeedMode) return { live: false, copy: "Paddock opens this week" };
    const threads = threadCount || 0;
    const voices  = voicesCount || 0;
    if (!threads)   return { live: false, copy: "Start the first thread" };
    const vPart = voices ? `${voices} ${voices === 1 ? "voice" : "voices"}` : null;
    const tPart = `${threads} ${threads === 1 ? "thread" : "threads"}`;
    return { live: true, copy: [vPart, tPart].filter(Boolean).join(" · ") };
  })();

  const eyebrow = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "var(--brand)" }}>The Grid</span>
      <span aria-hidden="true" style={{ color: SUBTLE_TEXT, opacity: 0.6 }}>·</span>
      <span style={{ color: SUBTLE_TEXT, fontVariantNumeric: "tabular-nums" }}>{roundLabel}</span>
      {raceDate && (
        <>
          <span aria-hidden="true" style={{ color: SUBTLE_TEXT, opacity: 0.6 }}>·</span>
          <span style={{ color: SUBTLE_TEXT, fontVariantNumeric: "tabular-nums" }}>{raceDate}</span>
        </>
      )}
    </span>
  );

  const metaNode = (
    <div
      className={pulse.live ? "pd-pulse-live" : ""}
      style={{
        display:       "inline-flex",
        alignItems:    "center",
        gap:           8,
        fontSize:      10,
        fontWeight:    800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color:         pulse.live ? TEXT_PRIMARY : SUBTLE_TEXT,
      }}
    >
      <span
        aria-hidden="true"
        className={pulse.live ? "pd-pulse-dot pd-pulse-dot--live" : "pd-pulse-dot"}
        style={{
          width:        6,
          height:       6,
          borderRadius: "50%",
          background:   pulse.live ? LIVE_GREEN : "rgba(148,163,184,0.5)",
          boxShadow:    pulse.live ? `0 0 0 3px ${rgbaFromHex(SUCCESS, 0.16)}` : "none",
          flexShrink:   0,
        }}
      />
      <span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em", textTransform: "none", fontWeight: 700, color: pulse.live ? TEXT_PRIMARY : SUBTLE_TEXT, fontSize: 11 }}>
        {pulse.copy}
      </span>
    </div>
  );

  // Custom title with the larger wordmark sizing — passed via identityRow
  // so the masthead's default `.stint-page-title` doesn't override it.
  const wordmark = (
    <>
      <h1 style={{
        margin:        0,
        fontSize:      isMobile ? "clamp(38px, 11vw, 58px)" : "clamp(58px, 7.2vw, 92px)",
        fontWeight:    900,
        letterSpacing: isMobile ? "-0.05em" : "-0.055em",
        lineHeight:    0.92,
        color:         TEXT_PRIMARY,
        wordBreak:     "keep-all",
      }}>
        The Paddock
      </h1>
      {/* Accent signature — short brand hairline + longer page hairline rule */}
      <div aria-hidden="true" style={{
        display:      "flex",
        alignItems:   "center",
        gap:          0,
        marginTop:    isMobile ? 14 : 18,
        marginBottom: isMobile ? 12 : 14,
      }}>
        <span style={{ width: 48, height: 2, background: "var(--brand)", flexShrink: 0 }} />
        <span style={{ flex: 1, height: 1, background: HAIRLINE }} />
      </div>
      <p style={{
        margin:        0,
        fontSize:      isMobile ? 13.5 : 15,
        lineHeight:    1.55,
        color:         MUTED_TEXT,
        letterSpacing: "-0.005em",
        maxWidth:      "52ch",
      }}>
        Where Stint reads the room before{" "}
        <span style={{ color: TEXT_PRIMARY, fontWeight: 800 }}>{raceName}</span>.
      </p>
    </>
  );

  return (
    <PageMasthead
      variant="flush"
      marginBottom={isMobile ? 24 : 32}
      eyebrow={eyebrow}
      meta={metaNode}
      identityRow={wordmark}
      image={{ src: "/images/Rear%20close%20up.png", position: "right-mask" }}
      tone="editorial"
    />
  );
}

// ─── Paddock Pulse — hero + satellites, not a KPI grid ──────────────────────

function PulseSatellite({ label, value, sub, accent = TEXT_PRIMARY, isMobile }) {
  return (
    <div style={{
      padding:       isMobile ? "12px 14px" : "13px 16px",
      borderRadius:  RADIUS_MD,
      background:    "rgba(255,255,255,0.015)",
      border:        `1px solid ${HAIRLINE}`,
      display:       "flex",
      flexDirection: "column",
      gap:           4,
      minWidth:      0,
    }}>
      <span style={{
        fontSize:      9,
        fontWeight:    900,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color:         SUBTLE_TEXT,
      }}>{label}</span>
      <span style={{
        fontSize:           isMobile ? 16 : 17,
        fontWeight:         900,
        letterSpacing:      "-0.025em",
        color:              accent,
        fontVariantNumeric: "tabular-nums",
        lineHeight:         1.1,
        overflow:           "hidden",
        textOverflow:       "ellipsis",
        whiteSpace:         "nowrap",
      }}>{value || "—"}</span>
      {sub && (
        <span style={{
          fontSize:      11,
          color:         SUBTLE_TEXT,
          fontWeight:    600,
          letterSpacing: "-0.005em",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
        }}>{sub}</span>
      )}
    </div>
  );
}

function PulseHero({ winner, isMobile }) {
  const hasData = !!winner;
  return (
    <div style={{
      position:      "relative",
      gridRow:       isMobile ? "auto" : "span 3",
      padding:       isMobile ? "18px 18px 20px" : "22px 24px 24px",
      borderRadius:  RADIUS_MD,
      background:    `linear-gradient(155deg, ${rgbaFromHex(ACCENT, 0.08)} 0%, rgba(255,255,255,0.015) 55%)`,
      border:        `1px solid ${rgbaFromHex(ACCENT, 0.22)}`,
      display:       "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap:           isMobile ? 14 : 18,
      overflow:      "hidden",
      minHeight:     isMobile ? 152 : 224,
    }}>
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, width: 2, height: "100%", background: "var(--brand)", opacity: 0.85,
      }} />
      <div>
        <div style={{
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--brand)",
          marginBottom:  isMobile ? 12 : 16,
        }}>
          Winner consensus
        </div>
        <div style={{
          fontSize:      isMobile ? 26 : "clamp(30px, 3.2vw, 40px)",
          fontWeight:    900,
          letterSpacing: "-0.045em",
          lineHeight:    1,
          color:         hasData ? TEXT_PRIMARY : SUBTLE_TEXT,
          marginBottom:  10,
        }}>
          {winner?.name || "No data yet"}
        </div>
        {hasData ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize:           isMobile ? 32 : 44,
              fontWeight:         900,
              letterSpacing:      "-0.045em",
              color: "var(--brand)",
              fontVariantNumeric: "tabular-nums",
              lineHeight:         0.95,
            }}>{winner.share}%</span>
            <span style={{
              fontSize:      12,
              fontWeight:    700,
              color:         SUBTLE_TEXT,
              letterSpacing: "-0.005em",
            }}>of the room backs them</span>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: SUBTLE_TEXT, letterSpacing: "-0.005em" }}>
            Picks open this week. Mood reads after locks fill.
          </div>
        )}
      </div>
    </div>
  );
}

function PaddockPulse({ mood, loading, isMobile }) {
  if (loading && !mood) {
    return (
      <section className="gr-pulse" style={{
        marginBottom: isMobile ? 28 : 36,
        padding:      isMobile ? "12px 14px" : "14px 18px",
        borderRadius: RADIUS_MD,
        border:       `1px solid ${HAIRLINE}`,
        background:   "rgba(255,255,255,0.015)",
        fontSize:     12,
        color:        SUBTLE_TEXT,
        textAlign:    "center",
        letterSpacing: "-0.005em",
      }}>Reading the room…</section>
    );
  }
  if (!mood) return null;

  return (
    <section className="gr-pulse" style={{ marginBottom: isMobile ? 28 : 36 }}>
      <SectionLabel rule color={ACCENT} style={{ marginBottom: 14 }}>Paddock pulse</SectionLabel>
      <div style={{
        display:             "grid",
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.55fr) minmax(0, 1fr)",
        gridAutoRows:        isMobile ? "auto" : "1fr",
        gap:                 10,
      }}>
        <PulseHero winner={mood.winner} isMobile={isMobile} />
        <PulseSatellite
          label="Hot DNF call"
          value={mood.dnf?.name || "—"}
          sub={mood.dnf ? `${mood.dnf.share}% taking the risk` : "Room still deciding"}
          accent={PRO_AMBER_DOT}
          isMobile={isMobile}
        />
        <PulseSatellite
          label="Voices this week"
          value={mood.voices || "—"}
          sub={mood.proActive ? `${mood.proActive} Pro active` : "Members posting"}
          accent={TEXT_PRIMARY}
          isMobile={isMobile}
        />
        <PulseSatellite
          label="Ideas in motion"
          value={mood.ideas || "—"}
          sub={mood.topIdea ? mood.topIdea : "Submit an idea"}
          accent={INFO_SOFT}
          isMobile={isMobile}
        />
      </div>
    </section>
  );
}

// ─── Inline composer (collapsed prompt → expanded form) ─────────────────────

function InlineComposer({
  user,
  demoPreview,
  openAuth,
  onSubmit,
  posting,
  raceName,
  isMobile,
}) {
  const [open, setOpen]             = useState(false);
  const [category, setCategory]     = useState("race_discussion");
  const [title, setTitle]           = useState("");
  const [body, setBody]             = useState("");
  const canPublish = title.trim() && body.trim() && !posting;

  function reset() { setTitle(""); setBody(""); setCategory("race_discussion"); setOpen(false); }

  async function handlePublish() {
    if (!canPublish) return;
    const ok = await onSubmit({ category, title: title.trim(), body: body.trim() });
    if (ok) reset();
  }

  if (!user) {
    return (
      <section style={{ marginBottom: isMobile ? 22 : 28 }}>
        <button
          type="button"
          onClick={demoPreview ? undefined : () => openAuth("login")}
          className="gr-text-btn gr-composer-collapsed"
          disabled={demoPreview}
          style={{
            display:         "flex",
            alignItems:      "center",
            gap:             12,
            width:           "100%",
            padding:         isMobile ? "12px 14px" : "14px 18px",
            background:      "transparent",
            border:          `1px dashed ${HAIRLINE}`,
            borderRadius:    RADIUS_MD,
            color:           SUBTLE_TEXT,
            fontSize:        13,
            fontWeight:      700,
            cursor:          demoPreview ? "default" : "pointer",
            textAlign:       "left",
            fontFamily:      "inherit",
            letterSpacing:   "-0.005em",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: MUTED_TEXT }}>
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 6v6M6 9h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{demoPreview ? "Preview mode — posting disabled" : `Log in to start a thread on ${raceName || "this weekend"}`}</span>
        </button>
      </section>
    );
  }

  return (
    <section className="gr-composer" style={{ marginBottom: isMobile ? 22 : 28 }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="gr-composer-collapsed"
          style={{
            display:       "flex",
            alignItems:    "center",
            gap:           12,
            width:         "100%",
            padding:       isMobile ? "12px 14px" : "14px 18px",
            background:    "transparent",
            border:        `1px solid ${HAIRLINE}`,
            borderRadius:  RADIUS_MD,
            color:         SUBTLE_TEXT,
            fontSize:      13,
            fontWeight:    600,
            cursor:        "pointer",
            textAlign:     "left",
            fontFamily:    "inherit",
            letterSpacing: "-0.005em",
          }}
        >
          <IdentityAvatar
            username={user.username}
            colorKey={user.avatar_color}
            size={28}
            pro={user?.subscription_status === "pro"}
          />
          <span>{raceName ? `Have a take on ${raceName}?` : "Say something about this weekend…"}</span>
        </button>
      ) : (
        <div className="gr-composer-form" style={{
          padding:      isMobile ? "14px 14px 16px" : "16px 18px 18px",
          borderRadius: RADIUS_MD,
          border:       `1px solid ${rgbaFromHex(ACCENT, 0.28)}`,
          background:   PANEL_BG,
          boxShadow:    `0 8px 22px ${rgbaFromHex(ACCENT, 0.10)}`,
          transformOrigin: "top left",
        }}>
          <div style={{
            display:       "flex",
            alignItems:    "center",
            gap:           10,
            marginBottom:  12,
            paddingBottom: 12,
            borderBottom:  `1px solid ${HAIRLINE}`,
          }}>
            <IdentityAvatar
              username={user.username}
              colorKey={user.avatar_color}
              size={28}
              pro={user?.subscription_status === "pro"}
            />
            <span style={{ fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.005em" }}>
              {user.username}
            </span>
            <span style={{ fontSize: 11, color: SUBTLE_TEXT, fontWeight: 600 }}>·</span>
            <div style={{ display: "inline-flex", gap: 4 }}>
              {[
                { key: "race_discussion", label: "Race take" },
                { key: "general",         label: "General"   },
              ].map((opt) => {
                const active = category === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setCategory(opt.key)}
                    className="gr-tog"
                    aria-pressed={active}
                    style={{
                      fontSize:      11,
                      fontWeight:    800,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      padding:       "4px 10px",
                      borderRadius:  999,
                      border:        `1px solid ${active ? rgbaFromHex(ACCENT, 0.32) : "rgba(148,163,184,0.16)"}`,
                      background:    active ? rgbaFromHex(ACCENT, 0.14) : "transparent",
                      color:         active ? ACCENT : MUTED_TEXT,
                      cursor:        "pointer",
                      fontFamily:    "inherit",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <input
            className="gr-input"
            autoFocus
            style={{
              background:    PANEL_BG_ALT,
              border:        `1px solid ${HAIRLINE}`,
              borderRadius:  RADIUS_MD,
              color:         TEXT_PRIMARY,
              padding:       "11px 13px",
              fontSize:      14,
              fontWeight:    700,
              letterSpacing: "-0.015em",
              outline:       "none",
              width:         "100%",
              boxSizing:     "border-box",
              fontFamily:    "inherit",
              marginBottom:  10,
            }}
            placeholder="Thread title"
            aria-label="Thread title"
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="gr-input"
            style={{
              background:    PANEL_BG_ALT,
              border:        `1px solid ${HAIRLINE}`,
              borderRadius:  RADIUS_MD,
              color:         TEXT_PRIMARY,
              padding:       "11px 13px",
              fontSize:      13,
              letterSpacing: "-0.005em",
              outline:       "none",
              width:         "100%",
              boxSizing:     "border-box",
              fontFamily:    "inherit",
              minHeight:     isMobile ? 110 : 96,
              resize:        "vertical",
              lineHeight:    1.6,
              marginBottom:  14,
            }}
            placeholder={raceName ? `${raceName} — what are you watching for?` : "Share your take — what are you watching for this weekend?"}
            aria-label="Thread body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              className="gr-btn-ghost"
              style={{
                background:     "transparent",
                border:         "none",
                color:          SUBTLE_TEXT,
                cursor:         "pointer",
                fontWeight:     700,
                fontSize:       12,
                padding:        "8px 4px",
                fontFamily:     "inherit",
                letterSpacing:  "-0.005em",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!canPublish}
              className="gr-cta"
              style={{
                background:    canPublish ? BRAND_GRADIENT : "rgba(255,255,255,0.06)",
                border:        "none",
                borderRadius:  RADIUS_PILL,
                color:         "#fff",
                cursor:        posting ? "wait" : canPublish ? "pointer" : "not-allowed",
                fontWeight:    800,
                padding:       "10px 22px",
                minHeight:     40,
                fontSize:      13,
                letterSpacing: "-0.005em",
                opacity:       canPublish ? 1 : 0.5,
                fontFamily:    "inherit",
                boxShadow:     canPublish ? `0 4px 14px ${rgbaFromHex(ACCENT, 0.24)}` : "none",
              }}
            >
              {posting ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── ExpandedThread (shared body + comments + reply) ────────────────────────

function ExpandedThread({
  post,
  comments,
  authorProfiles,
  user,
  demoPreview,
  openAuth,
  replyText,
  onReplyChange,
  onReply,
  isMobile,
}) {
  return (
    <div style={{ borderTop: `1px solid ${HAIRLINE}`, background: "rgba(0,0,0,0.14)" }}>
      <div style={{
        padding:      isMobile ? "14px 14px" : "16px 18px",
        borderBottom: comments.length ? `1px solid ${HAIRLINE}` : "none",
      }}>
        <div style={{
          fontSize:      isMobile ? 13.5 : 14,
          lineHeight:    1.7,
          color:         "rgba(214,223,239,0.86)",
          letterSpacing: "-0.005em",
          whiteSpace:    "pre-wrap",
          maxWidth:      "70ch",
        }}>
          {post.body}
        </div>
      </div>

      {comments.length > 0 && (
        <div style={{ padding: "10px 16px 0" }}>
          {comments.map((comment, index) => (
            <div
              key={comment.id}
              style={{
                display:      "flex",
                gap:          10,
                padding:      "10px 0",
                borderBottom: index < comments.length - 1 ? `1px solid ${HAIRLINE}` : "none",
              }}
            >
              <IdentityAvatar
                username={comment.author_name}
                colorKey={resolveAvatarColor(authorProfiles[comment.author_id], comment.author_name)}
                size={26}
                pro={isProIdentity(authorProfiles[comment.author_id], comment.author_name)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.005em" }}>
                    {comment.author_name}
                  </div>
                  <div
                    title={absoluteTime(comment.created_at)}
                    style={{
                      fontSize:           10,
                      color:              SUBTLE_TEXT,
                      fontVariantNumeric: "tabular-nums",
                      fontWeight:         700,
                    }}
                  >{relativeTime(comment.created_at)}</div>
                </div>
                <div style={{
                  fontSize:      12.5,
                  lineHeight:    1.6,
                  color:         "rgba(214,223,239,0.78)",
                  letterSpacing: "-0.005em",
                  maxWidth:      "66ch",
                }}>{comment.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!post._seed && (
        <div style={{
          padding:    isMobile ? "12px 14px 14px" : "12px 16px 14px",
          display:    "flex",
          gap:        8,
          alignItems: "center",
          flexWrap:   "wrap",
        }}>
          {user ? (
            <>
              <input
                className="gr-input"
                style={{
                  background:    PANEL_BG_ALT,
                  border:        `1px solid ${HAIRLINE}`,
                  borderRadius:  RADIUS_MD,
                  color:         TEXT_PRIMARY,
                  padding:       "10px 12px",
                  fontSize:      13,
                  letterSpacing: "-0.005em",
                  outline:       "none",
                  boxSizing:     "border-box",
                  fontFamily:    "inherit",
                  minHeight:     isMobile ? 44 : 36,
                  flex:          "1 1 200px",
                  minWidth:      0,
                }}
                placeholder="Reply…"
                aria-label={`Reply to ${post.title}`}
                value={replyText[post.id] || ""}
                onChange={(e) => onReplyChange((prev) => ({ ...prev, [post.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && onReply(post.id)}
              />
              <button
                type="button"
                onClick={() => onReply(post.id)}
                className="gr-cta"
                style={{
                  background:    BRAND_GRADIENT,
                  border:        "none",
                  borderRadius:  RADIUS_PILL,
                  color:         "#fff",
                  cursor:        "pointer",
                  fontWeight:    800,
                  fontSize:      12,
                  padding:       "0 16px",
                  minHeight:     isMobile ? 44 : 36,
                  letterSpacing: "-0.005em",
                  flexShrink:    0,
                  fontFamily:    "inherit",
                  boxShadow:     `0 3px 10px ${rgbaFromHex(ACCENT, 0.22)}`,
                }}
              >
                Reply
              </button>
            </>
          ) : demoPreview ? (
            <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.5 }}>Preview mode — replies disabled.</div>
          ) : (
            <div style={{ fontSize: 12, color: MUTED_TEXT, lineHeight: 1.5 }}>
              <button
                type="button"
                onClick={() => openAuth("login")}
                className="gr-text-btn"
                style={{
                  color:                TEXT_PRIMARY,
                  fontWeight:           800,
                  cursor:               "pointer",
                  textDecoration:       "underline",
                  textDecorationColor:  rgbaFromHex(ACCENT, 0.45),
                  textUnderlineOffset:  3,
                  background:           "transparent",
                  border:               "none",
                  padding:              0,
                  font:                 "inherit",
                }}
              >Log in</button>
              {" "}to join the thread.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Voice of the Grid — pulled quote, editorial lift ──────────────────────

function VoiceOfTheGrid({ quote, author, threadTitle, authorProfile, pro, onOpen, isMobile }) {
  if (!quote) return null;
  return (
    <section className="gr-voice" style={{ marginBottom: isMobile ? 32 : 40 }}>
      <SectionLabel rule color={ACCENT} style={{ marginBottom: 14 }}>Voice of the grid</SectionLabel>
      <button
        type="button"
        onClick={onOpen}
        className="gr-voice-card"
        style={{
          display:       "block",
          width:         "100%",
          textAlign:     "left",
          padding:       isMobile ? "22px 20px 22px" : "28px 30px 26px",
          borderRadius:  CARD_RADIUS,
          border:        `1px solid ${HAIRLINE}`,
          background:    PANEL_BG_ALT,
          color:         "inherit",
          font:          "inherit",
          cursor:        "pointer",
          position:      "relative",
          overflow:      "hidden",
        }}
      >
        {/* Decorative open-quote mark — large, accent-tinted, bled off the top-left */}
        <span aria-hidden="true" style={{
          position:      "absolute",
          top:           isMobile ? -22 : -28,
          left:          isMobile ? 12 : 20,
          fontSize:      isMobile ? 110 : 150,
          lineHeight:    1,
          fontWeight:    900,
          color:         rgbaFromHex(ACCENT, 0.14),
          letterSpacing: "-0.08em",
          pointerEvents: "none",
          userSelect:    "none",
        }}>“</span>
        <blockquote style={{
          position:      "relative",
          margin:        0,
          padding:       0,
          fontSize:      isMobile ? 18 : "clamp(20px, 2vw, 24px)",
          lineHeight:    1.42,
          fontWeight:    700,
          letterSpacing: "-0.025em",
          color:         TEXT_PRIMARY,
          maxWidth:      "44ch",
          fontStyle:     "italic",
        }}>
          {quote}
        </blockquote>
        <div style={{
          marginTop:     isMobile ? 18 : 22,
          paddingTop:    isMobile ? 14 : 16,
          borderTop:     `1px solid ${HAIRLINE}`,
          display:       "flex",
          alignItems:    "center",
          gap:           12,
          flexWrap:      "wrap",
        }}>
          <IdentityAvatar
            username={author}
            colorKey={resolveAvatarColor(authorProfile, author)}
            size={isMobile ? 30 : 34}
            pro={pro}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize:      13,
              fontWeight:    900,
              letterSpacing: "-0.005em",
              color:         TEXT_PRIMARY,
              lineHeight:    1.2,
            }}>{author}</div>
            {threadTitle && (
              <div style={{
                fontSize:      11,
                fontWeight:    700,
                color:         SUBTLE_TEXT,
                letterSpacing: "0.02em",
                marginTop:     2,
                overflow:      "hidden",
                textOverflow:  "ellipsis",
                whiteSpace:    "nowrap",
                maxWidth:      isMobile ? "28ch" : "44ch",
              }}>on "{threadTitle}"</div>
            )}
          </div>
          <span className="gr-voice-cta" style={{
            marginLeft:    "auto",
            fontSize:      11,
            fontWeight:    800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--brand)",
            display:       "inline-flex",
            alignItems:    "center",
            gap:           4,
          }}>
            Read the thread
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M2 5.5h7M6 2.5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </button>
    </section>
  );
}

// ─── Featured Take (editorial hero) ─────────────────────────────────────────

function FeaturedTake({
  post,
  comments,
  authorProfiles,
  open,
  onToggle,
  user,
  demoPreview,
  openAuth,
  replyText,
  onReplyChange,
  onReply,
  isMobile,
}) {
  if (!post) return null;
  const postComments = post._seed ? (post._comments || []) : (comments[post.id] || []);
  const firstReply   = postComments[0] || null;
  const authorPro    = isProIdentity(authorProfiles[post.author_id], post.author_name);

  return (
    <section className="gr-featured" style={{ marginBottom: isMobile ? 28 : 36 }}>
      <SectionLabel rule color={ACCENT} style={{ marginBottom: 14 }}>Top thread</SectionLabel>

      <article
        className={`gr-featured-card${open ? " gr-post-open" : ""}`}
        style={{
          borderRadius: CARD_RADIUS,
          border:       `1px solid ${rgbaFromHex(ACCENT, 0.24)}`,
          background:   PANEL_BG,
          boxShadow:    `0 10px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.03)`,
          overflow:     "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => onToggle(post.id, !!post._seed)}
          className="gr-featured-expander"
          aria-expanded={open}
          aria-controls={open ? `gr-post-body-${post.id}` : undefined}
          style={{
            display:       "block",
            width:         "100%",
            textAlign:     "left",
            padding:       isMobile ? "18px 18px 18px" : "22px 26px 22px",
            background:    "transparent",
            border:        "none",
            color:         "inherit",
            font:          "inherit",
            cursor:        "pointer",
          }}
        >
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            gap:            12,
            marginBottom:   isMobile ? 14 : 16,
            flexWrap:       "wrap",
          }}>
            <ByLine
              author={post.author_name}
              authorProfile={authorProfiles[post.author_id]}
              pro={authorPro}
              createdAt={post.created_at}
            />
            <span style={{
              fontSize:           11,
              fontWeight:         800,
              color:              SUBTLE_TEXT,
              letterSpacing:      "0.02em",
              fontVariantNumeric: "tabular-nums",
            }}>
              {postComments.length > 0
                ? `${postComments.length} ${postComments.length === 1 ? "reply" : "replies"}`
                : "Be the first to reply"}
            </span>
          </div>

          <h2 className="stint-section-title" style={{
            margin:        "0 0 14px",
            fontSize:      isMobile ? 22 : "clamp(24px, 2.6vw, 32px)",
            letterSpacing: "-0.045em",
            lineHeight:    1.08,
            maxWidth:      isMobile ? "22ch" : "28ch",
          }}>
            {post.title}
          </h2>

          {!open && (
            <p style={{
              margin:         0,
              fontSize:       isMobile ? 13.5 : 14.5,
              lineHeight:     1.7,
              color:          "rgba(214,223,239,0.82)",
              letterSpacing:  "-0.005em",
              display:        "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow:       "hidden",
              maxWidth:       "62ch",
            }}>
              {post.body}
            </p>
          )}

          {!open && firstReply && (
            <div style={{
              marginTop:    18,
              paddingTop:   16,
              borderTop:    `1px solid ${HAIRLINE}`,
              display:      "flex",
              gap:          12,
              alignItems:   "flex-start",
            }}>
              <span style={{
                fontSize:      9,
                fontWeight:    900,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color:         SUBTLE_TEXT,
                flexShrink:    0,
                marginTop:     2,
              }}>Top reply</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.005em", marginBottom: 4 }}>
                  {firstReply.author_name}
                  <span style={{
                    color:      SUBTLE_TEXT,
                    fontWeight: 600,
                    marginLeft: 8,
                    fontSize:   11,
                  }}>{relativeTime(firstReply.created_at)}</span>
                </div>
                <div style={{
                  fontSize:      12.5,
                  lineHeight:    1.6,
                  color:         "rgba(214,223,239,0.78)",
                  letterSpacing: "-0.005em",
                  display:       "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow:      "hidden",
                }}>{firstReply.body}</div>
              </div>
            </div>
          )}

          {!open && (
            <div style={{
              marginTop:     16,
              display:       "inline-flex",
              alignItems:    "center",
              gap:           6,
              fontSize:      12,
              fontWeight:    800,
              letterSpacing: "-0.005em",
              color: "var(--brand)",
            }}>
              Join the thread
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <path d="M2 5.5h7M6 2.5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </button>

        {open && (
          <div
            id={`gr-post-body-${post.id}`}
            role="region"
            aria-label={`${post.title} — thread`}
            className="gr-thread-reveal"
          >
            <div className="gr-thread-reveal-inner">
              <div className="gr-thread-content">
                <ExpandedThread
                  post={post}
                  comments={postComments}
                  authorProfiles={authorProfiles}
                  user={user}
                  demoPreview={demoPreview}
                  openAuth={openAuth}
                  replyText={replyText}
                  onReplyChange={onReplyChange}
                  onReply={onReply}
                  isMobile={isMobile}
                />
              </div>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

// ─── The Board — compact feed with time groups ─────────────────────────────

function BoardRow({
  post,
  authorProfiles,
  comments,
  open,
  onToggle,
  user,
  demoPreview,
  openAuth,
  replyText,
  onReplyChange,
  onReply,
  isMobile,
}) {
  const postComments = post._seed ? (post._comments || []) : (comments[post.id] || []);
  const replyCount   = postComments.length;
  const authorPro    = isProIdentity(authorProfiles[post.author_id], post.author_name);

  return (
    <article className={`gr-board-row${open ? " gr-post-open" : ""}`} style={{
      borderTop:  `1px solid ${HAIRLINE}`,
      background: "transparent",
    }}>
      <button
        type="button"
        onClick={() => onToggle(post.id, !!post._seed)}
        className="gr-board-expander"
        aria-expanded={open}
        aria-controls={open ? `gr-post-body-${post.id}` : undefined}
        style={{
          display:       "grid",
          gridTemplateColumns: isMobile ? "auto 1fr" : "auto 1fr auto",
          gap:           isMobile ? 10 : 14,
          alignItems:    "start",
          width:         "100%",
          padding:       isMobile ? "14px 0" : "16px 0",
          background:    "transparent",
          border:        "none",
          color:         "inherit",
          font:          "inherit",
          cursor:        "pointer",
          textAlign:     "left",
        }}
      >
        <IdentityAvatar
          username={post.author_name}
          colorKey={resolveAvatarColor(authorProfiles[post.author_id], post.author_name)}
          size={isMobile ? 32 : 34}
          pro={authorPro}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{
            display:       "flex",
            alignItems:    "center",
            gap:           8,
            marginBottom:  4,
            flexWrap:      "wrap",
          }}>
            <span style={{
              fontSize:      12,
              fontWeight:    800,
              color:         TEXT_PRIMARY,
              letterSpacing: "-0.005em",
            }}>{post.author_name}</span>
            <span aria-hidden="true" style={{
              width:        3,
              height:       3,
              borderRadius: "50%",
              background:   post.category === "race_discussion" ? ACCENT : "rgba(156,209,255,0.7)",
              flexShrink:   0,
              marginLeft:   2,
            }} />
            <span style={{
              fontSize:      10,
              fontWeight:    800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color:         SUBTLE_TEXT,
            }}>{post.category === "race_discussion" ? "Race" : "General"}</span>
            <span
              title={absoluteTime(post.created_at)}
              style={{
                fontSize:           11,
                color:              SUBTLE_TEXT,
                fontVariantNumeric: "tabular-nums",
                fontWeight:         600,
              }}
            >{relativeTime(post.created_at)}</span>
            {isMobile && replyCount > 0 && (
              <>
                <span aria-hidden="true" style={{ color: SUBTLE_TEXT, opacity: 0.6, fontSize: 11 }}>·</span>
                <span style={{
                  fontSize:           11,
                  color:              TEXT_PRIMARY,
                  fontWeight:         700,
                  letterSpacing:      "-0.005em",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {replyCount} {replyCount === 1 ? "reply" : "replies"}
                </span>
              </>
            )}
          </div>
          <div className="gr-board-title" style={{
            fontSize:      isMobile ? 14.5 : 15.5,
            fontWeight:    800,
            letterSpacing: "-0.02em",
            color:         TEXT_PRIMARY,
            lineHeight:    1.3,
            marginBottom:  4,
          }}>{post.title}</div>
          {!open && post.body && (
            <div style={{
              fontSize:   12.5,
              lineHeight: 1.55,
              color:      MUTED_TEXT,
              display:    "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow:   "hidden",
            }}>{post.body}</div>
          )}
        </div>
        {!isMobile && (
          <div style={{
            fontSize:           11,
            fontWeight:         700,
            color:              replyCount > 0 ? TEXT_PRIMARY : SUBTLE_TEXT,
            letterSpacing:      "0.02em",
            whiteSpace:         "nowrap",
            fontVariantNumeric: "tabular-nums",
            display:            "inline-flex",
            alignItems:         "center",
            gap:                5,
            paddingTop:         2,
          }}>
            {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"}` : "—"}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="gr-chev">
              <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </button>
      {open && (
        <div
          id={`gr-post-body-${post.id}`}
          role="region"
          aria-label={`${post.title} — thread`}
          className="gr-thread-reveal"
          style={{ marginTop: -1 }}
        >
          <div className="gr-thread-reveal-inner">
            <div className="gr-thread-content">
              <ExpandedThread
                post={post}
                comments={postComments}
                authorProfiles={authorProfiles}
                user={user}
                demoPreview={demoPreview}
                openAuth={openAuth}
                replyText={replyText}
                onReplyChange={onReplyChange}
                onReply={onReply}
                isMobile={isMobile}
              />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function TimeGroupDivider({ label, date, count, first = false }) {
  return (
    <div style={{
      display:    "flex",
      alignItems: "baseline",
      gap:        10,
      padding:    first ? "0 0 6px" : "18px 0 6px",
    }}>
      <span style={{
        fontSize:      11,
        fontWeight:    900,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color:         TEXT_PRIMARY,
      }}>{label}</span>
      {date && (
        <span style={{
          fontSize:           10,
          fontWeight:         700,
          letterSpacing:      "0.08em",
          textTransform:      "uppercase",
          color:              SUBTLE_TEXT,
          fontVariantNumeric: "tabular-nums",
        }}>{date}</span>
      )}
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: HAIRLINE, alignSelf: "center" }} />
      {typeof count === "number" && (
        <span style={{
          fontSize:           10,
          fontWeight:         800,
          color:              SUBTLE_TEXT,
          fontVariantNumeric: "tabular-nums",
        }}>{count}</span>
      )}
    </div>
  );
}

function Board({
  posts,
  filter,
  onFilterChange,
  authorProfiles,
  comments,
  expandedPostId,
  onToggle,
  user,
  demoPreview,
  openAuth,
  replyText,
  onReplyChange,
  onReply,
  isMobile,
  hasPosts,
}) {
  const filterOptions = [
    { key: "all",     label: "All"     },
    { key: "race",    label: "Race"    },
    { key: "general", label: "General" },
    ...(user ? [{ key: "yours", label: "Yours" }] : []),
  ];

  const grouped = useMemo(() => {
    const buckets = { today: [], yesterday: [], week: [], earlier: [] };
    posts.forEach((p) => buckets[timeGroupKey(p.created_at)].push(p));
    return ["today", "yesterday", "week", "earlier"]
      .map((k) => ({ key: k, label: TIME_GROUP_LABELS[k], date: dateStampForGroup(k), items: buckets[k] }))
      .filter((g) => g.items.length > 0);
  }, [posts]);

  return (
    <section className="gr-board" style={{ marginBottom: isMobile ? 32 : 40 }}>
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            12,
        marginBottom:   14,
        flexWrap:       "wrap",
      }}>
        <SectionLabel rule color={ACCENT}>The board</SectionLabel>
        {hasPosts && (
          <div style={{ display: "inline-flex", gap: 4 }}>
            {filterOptions.map((opt) => {
              const active = filter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onFilterChange(opt.key)}
                  className="gr-tab"
                  aria-pressed={active}
                  style={{
                    padding:       isMobile ? "8px 14px" : "6px 12px",
                    minHeight:     isMobile ? 36 : undefined,
                    borderRadius:  999,
                    border:        `1px solid ${active ? rgbaFromHex(ACCENT, 0.30) : "rgba(148,163,184,0.14)"}`,
                    background:    active ? rgbaFromHex(ACCENT, 0.13) : "transparent",
                    color:         active ? ACCENT : MUTED_TEXT,
                    fontSize:      isMobile ? 12 : 11,
                    fontWeight:    800,
                    letterSpacing: "-0.005em",
                    cursor:        "pointer",
                    fontFamily:    "inherit",
                  }}
                >{opt.label}</button>
              );
            })}
          </div>
        )}
      </div>

      {posts.length === 0 ? (
        <div style={{
          padding:      isMobile ? "26px 20px" : "32px 28px",
          borderRadius: CARD_RADIUS,
          border:       `1px dashed ${HAIRLINE}`,
          background:   "rgba(255,255,255,0.01)",
          textAlign:    "center",
        }}>
          <div style={{
            fontSize:      isMobile ? 15 : 17,
            fontWeight:    900,
            letterSpacing: "-0.03em",
            color:         TEXT_PRIMARY,
            marginBottom:  8,
          }}>
            {filter === "yours" ? "You haven't posted here yet" : "Nothing on the board"}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: MUTED_TEXT, maxWidth: "42ch", margin: "0 auto" }}>
            {filter === "yours"
              ? "Start a thread and it'll show up here."
              : "Post a race take with the composer above to start the conversation."}
          </div>
        </div>
      ) : (
        <div>
          {grouped.map((group, idx) => (
            <div key={group.key}>
              <TimeGroupDivider
                label={group.label}
                date={group.date}
                count={group.items.length}
                first={idx === 0}
              />
              {group.items.map((post) => (
                <BoardRow
                  key={post.id}
                  post={post}
                  authorProfiles={authorProfiles}
                  comments={comments}
                  open={expandedPostId === post.id}
                  onToggle={onToggle}
                  user={user}
                  demoPreview={demoPreview}
                  openAuth={openAuth}
                  replyText={replyText}
                  onReplyChange={onReplyChange}
                  onReply={onReply}
                  isMobile={isMobile}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Shaping STINT ─────────────────────────────────────────────────────────

function IdeaComposer({ user, demoPreview, openAuth, onSubmit, posting, isMobile }) {
  const [open, setOpen]   = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const canPublish = title.trim() && body.trim() && !posting;

  function reset() { setTitle(""); setBody(""); setOpen(false); }

  async function publish() {
    if (!canPublish) return;
    const ok = await onSubmit({ category: "feature_requests", title: title.trim(), body: body.trim() });
    if (ok) reset();
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={demoPreview ? undefined : () => openAuth("login")}
        disabled={demoPreview}
        className="gr-btn-ghost"
        style={{
          background:     "transparent",
          border:         `1px solid ${HAIRLINE}`,
          borderRadius:   RADIUS_PILL,
          color:          MUTED_TEXT,
          cursor:         demoPreview ? "default" : "pointer",
          fontWeight:     700,
          padding:        "8px 16px",
          minHeight:      isMobile ? 40 : 36,
          fontSize:       12,
          letterSpacing:  "-0.005em",
          fontFamily:     "inherit",
        }}
      >
        {demoPreview ? "Preview mode" : "Log in to submit an idea"}
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="gr-cta"
        style={{
          background:     "transparent",
          border:         `1px solid ${rgbaFromHex(ACCENT, 0.32)}`,
          borderRadius:   RADIUS_PILL,
          color: "var(--brand)",
          cursor:         "pointer",
          fontWeight:     800,
          padding:        "8px 16px",
          minHeight:      isMobile ? 40 : 36,
          fontSize:       12,
          letterSpacing:  "-0.005em",
          fontFamily:     "inherit",
        }}
      >
        + Submit an idea
      </button>
    );
  }

  return (
    <div className="gr-composer-form" style={{
      padding:      isMobile ? "14px 14px 16px" : "16px 18px 18px",
      borderRadius: RADIUS_MD,
      border:       `1px solid ${rgbaFromHex(ACCENT, 0.28)}`,
      background:   PANEL_BG,
      marginTop:    12,
      marginBottom: 18,
      boxShadow:    `0 8px 22px ${rgbaFromHex(ACCENT, 0.10)}`,
      transformOrigin: "top left",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${HAIRLINE}` }}>
        <IdentityAvatar
          username={user.username}
          colorKey={user.avatar_color}
          size={26}
          pro={user?.subscription_status === "pro"}
        />
        <span style={{ fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY }}>{user.username}</span>
        <span style={{ fontSize: 11, color: SUBTLE_TEXT }}>·</span>
        <span style={{
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--brand)",
        }}>Product idea</span>
      </div>
      <input
        className="gr-input"
        autoFocus
        style={{
          background:    PANEL_BG_ALT,
          border:        `1px solid ${HAIRLINE}`,
          borderRadius:  RADIUS_MD,
          color:         TEXT_PRIMARY,
          padding:       "11px 13px",
          fontSize:      14,
          fontWeight:    700,
          letterSpacing: "-0.015em",
          outline:       "none",
          width:         "100%",
          boxSizing:     "border-box",
          fontFamily:    "inherit",
          marginBottom:  10,
        }}
        placeholder="What should STINT build?"
        aria-label="Idea title"
        maxLength={140}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="gr-input"
        style={{
          background:    PANEL_BG_ALT,
          border:        `1px solid ${HAIRLINE}`,
          borderRadius:  RADIUS_MD,
          color:         TEXT_PRIMARY,
          padding:       "11px 13px",
          fontSize:      13,
          letterSpacing: "-0.005em",
          outline:       "none",
          width:         "100%",
          boxSizing:     "border-box",
          fontFamily:    "inherit",
          minHeight:     isMobile ? 100 : 84,
          resize:        "vertical",
          lineHeight:    1.6,
          marginBottom:  14,
        }}
        placeholder="Describe the problem and the fix — the community will upvote it."
        aria-label="Idea body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={reset}
          className="gr-btn-ghost"
          style={{
            background:     "transparent",
            border:         "none",
            color:          SUBTLE_TEXT,
            cursor:         "pointer",
            fontWeight:     700,
            fontSize:       12,
            padding:        "8px 4px",
            fontFamily:     "inherit",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish}
          className="gr-cta"
          style={{
            background:    canPublish ? BRAND_GRADIENT : "rgba(255,255,255,0.06)",
            border:        "none",
            borderRadius:  RADIUS_PILL,
            color:         "#fff",
            cursor:        posting ? "wait" : canPublish ? "pointer" : "not-allowed",
            fontWeight:    800,
            padding:       "10px 22px",
            minHeight:     40,
            fontSize:      13,
            letterSpacing: "-0.005em",
            opacity:       canPublish ? 1 : 0.5,
            fontFamily:    "inherit",
            boxShadow:     canPublish ? `0 4px 14px ${rgbaFromHex(ACCENT, 0.24)}` : "none",
          }}
        >
          {posting ? "Publishing…" : "Submit idea"}
        </button>
      </div>
    </div>
  );
}

function IdeaRow({
  post,
  score,
  userVote,
  isOwn,
  disabled,
  onVote,
  authorProfiles,
  comments,
  open,
  onToggle,
  user,
  demoPreview,
  openAuth,
  replyText,
  onReplyChange,
  onReply,
  isMobile,
}) {
  const postComments = post._seed ? (post._comments || []) : (comments[post.id] || []);
  const replyCount   = postComments.length;

  return (
    <article className={`gr-idea${open ? " gr-post-open" : ""}`} style={{
      borderRadius: CARD_RADIUS,
      border:       open ? `1px solid ${rgbaFromHex(ACCENT, 0.30)}` : PANEL_BORDER,
      background:   open ? PANEL_BG_ALT : PANEL_BG,
      overflow:     "hidden",
    }}>
      <div style={{
        display:    "grid",
        gridTemplateColumns: "auto 1fr",
        gap:        isMobile ? 12 : 16,
        padding:    isMobile ? "14px 14px" : "16px 18px",
        alignItems: "flex-start",
      }}>
        <VoteColumn
          postId={post.id}
          score={score}
          userVote={userVote}
          isOwn={isOwn}
          disabled={disabled}
          onVote={onVote}
          isMobile={isMobile}
        />
        <button
          type="button"
          onClick={() => onToggle(post.id, !!post._seed)}
          className="gr-idea-expander"
          aria-expanded={open}
          aria-controls={open ? `gr-post-body-${post.id}` : undefined}
          style={{
            display:       "block",
            width:         "100%",
            textAlign:     "left",
            background:    "transparent",
            border:        "none",
            padding:       0,
            color:         "inherit",
            font:          "inherit",
            cursor:        "pointer",
          }}
        >
          <div className="gr-idea-title" style={{
            fontSize:      isMobile ? 15 : 16,
            fontWeight:    900,
            letterSpacing: "-0.025em",
            color:         TEXT_PRIMARY,
            lineHeight:    1.28,
            marginBottom:  6,
          }}>{post.title}</div>
          {!open && post.body && (
            <div style={{
              fontSize:   12.5,
              lineHeight: 1.55,
              color:      MUTED_TEXT,
              display:    "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow:   "hidden",
              marginBottom: 8,
            }}>{post.body}</div>
          )}
          <div style={{
            display:       "inline-flex",
            alignItems:    "center",
            gap:           10,
            flexWrap:      "wrap",
            fontSize:      11,
            color:         SUBTLE_TEXT,
            fontWeight:    700,
            letterSpacing: "-0.005em",
          }}>
            <span style={{ color: TEXT_PRIMARY, fontWeight: 800 }}>{post.author_name}</span>
            <span
              title={absoluteTime(post.created_at)}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >{relativeTime(post.created_at)}</span>
            <span>·</span>
            <span>{replyCount > 0 ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"}` : "No replies yet"}</span>
          </div>
        </button>
      </div>
      {open && (
        <div
          id={`gr-post-body-${post.id}`}
          role="region"
          aria-label={`${post.title} — thread`}
          className="gr-thread-reveal"
        >
          <div className="gr-thread-reveal-inner">
            <div className="gr-thread-content">
              <ExpandedThread
                post={post}
                comments={postComments}
                authorProfiles={authorProfiles}
                user={user}
                demoPreview={demoPreview}
                openAuth={openAuth}
                replyText={replyText}
                onReplyChange={onReplyChange}
                onReply={onReply}
                isMobile={isMobile}
              />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function LeadingIdea({
  post,
  score,
  userVote,
  isOwn,
  disabled,
  onVote,
  authorProfiles,
  comments,
  open,
  onToggle,
  user,
  demoPreview,
  openAuth,
  replyText,
  onReplyChange,
  onReply,
  isMobile,
}) {
  const postComments = post._seed ? (post._comments || []) : (comments[post.id] || []);
  const replyCount   = postComments.length;
  const authorPro    = isProIdentity(authorProfiles[post.author_id], post.author_name);

  return (
    <article
      className={`gr-idea gr-leading${open ? " gr-post-open" : ""}`}
      style={{
        position:     "relative",
        borderRadius: CARD_RADIUS,
        border:       `1px solid ${open ? rgbaFromHex(INFO_SOFT, 0.30) : rgbaFromHex(INFO_SOFT, 0.18)}`,
        background:   `linear-gradient(160deg, ${rgbaFromHex(INFO_SOFT, 0.07)} 0%, rgba(255,255,255,0.01) 60%)`,
        overflow:     "hidden",
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, width: 2, height: "100%", background: INFO_SOFT, opacity: 0.85,
      }} />
      <div style={{
        display:             "grid",
        gridTemplateColumns: "auto 1fr",
        gap:                 isMobile ? 14 : 20,
        padding:             isMobile ? "16px 16px 16px 18px" : "22px 24px 22px 26px",
        alignItems:          "flex-start",
      }}>
        <VoteColumn
          postId={post.id}
          score={score}
          userVote={userVote}
          isOwn={isOwn}
          disabled={disabled}
          onVote={onVote}
          isMobile={isMobile}
        />
        <button
          type="button"
          onClick={() => onToggle(post.id, !!post._seed)}
          className="gr-idea-expander"
          aria-expanded={open}
          aria-controls={open ? `gr-post-body-${post.id}` : undefined}
          style={{
            display:    "block",
            width:      "100%",
            textAlign:  "left",
            background: "transparent",
            border:     "none",
            padding:    0,
            color:      "inherit",
            font:       "inherit",
            cursor:     "pointer",
          }}
        >
          <div style={{
            display:       "inline-flex",
            alignItems:    "center",
            gap:           8,
            fontSize:      9,
            fontWeight:    900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color:         INFO_SOFT,
            marginBottom:  10,
          }}>
            <span>Leading idea</span>
          </div>
          <div className="gr-idea-title" style={{
            fontSize:      isMobile ? 18 : "clamp(20px, 2vw, 24px)",
            fontWeight:    900,
            letterSpacing: "-0.035em",
            color:         TEXT_PRIMARY,
            lineHeight:    1.15,
            marginBottom:  10,
            maxWidth:      "32ch",
          }}>{post.title}</div>
          {!open && post.body && (
            <div style={{
              fontSize:      isMobile ? 13 : 14,
              lineHeight:    1.65,
              color:         "rgba(214,223,239,0.82)",
              letterSpacing: "-0.005em",
              display:       "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow:      "hidden",
              marginBottom:  12,
              maxWidth:      "60ch",
            }}>{post.body}</div>
          )}
          <div style={{
            display:       "flex",
            alignItems:    "center",
            gap:           10,
            flexWrap:      "wrap",
            paddingTop:    isMobile ? 10 : 12,
            borderTop:     `1px solid ${HAIRLINE}`,
          }}>
            <IdentityAvatar
              username={post.author_name}
              colorKey={resolveAvatarColor(authorProfiles[post.author_id], post.author_name)}
              size={24}
              pro={authorPro}
            />
            <span style={{ fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.005em" }}>
              {post.author_name}
            </span>
            <span aria-hidden="true" style={{ color: SUBTLE_TEXT, fontSize: 11 }}>·</span>
            <span
              title={absoluteTime(post.created_at)}
              style={{
                fontSize:           11,
                color:              SUBTLE_TEXT,
                fontVariantNumeric: "tabular-nums",
                fontWeight:         600,
              }}
            >{relativeTime(post.created_at)}</span>
            <span aria-hidden="true" style={{ color: SUBTLE_TEXT, fontSize: 11 }}>·</span>
            <span style={{ fontSize: 11, color: SUBTLE_TEXT, fontWeight: 700 }}>
              {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"}` : "No replies yet"}
            </span>
          </div>
        </button>
      </div>
      {open && (
        <div
          id={`gr-post-body-${post.id}`}
          role="region"
          aria-label={`${post.title} — thread`}
          className="gr-thread-reveal"
        >
          <div className="gr-thread-reveal-inner">
            <div className="gr-thread-content">
              <ExpandedThread
                post={post}
                comments={postComments}
                authorProfiles={authorProfiles}
                user={user}
                demoPreview={demoPreview}
                openAuth={openAuth}
                replyText={replyText}
                onReplyChange={onReplyChange}
                onReply={onReply}
                isMobile={isMobile}
              />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function ShapingStint({
  ideas,
  authorProfiles,
  comments,
  scores,
  userVotes,
  onVote,
  votingPostId,
  user,
  demoPreview,
  openAuth,
  expandedPostId,
  onToggle,
  replyText,
  onReplyChange,
  onReply,
  onSubmit,
  posting,
  isMobile,
}) {
  const [lead, ...rest] = ideas;
  const leadScore    = lead ? (scores[lead.id] ?? lead.vote_score ?? 0) : 0;
  const leadUserVote = lead ? (userVotes[lead.id] ?? 0) : 0;
  const leadIsOwn    = lead ? (!lead._seed && lead.author_id === user?.id) : false;

  return (
    <section className="gr-shaping" style={{ marginBottom: isMobile ? 32 : 40 }}>
      <div style={{
        display:        "flex",
        alignItems:     "flex-end",
        justifyContent: "space-between",
        gap:            16,
        marginBottom:   16,
        flexWrap:       "wrap",
      }}>
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <SectionLabel rule color={INFO_SOFT} style={{ marginBottom: 10 }}>Shaping STINT</SectionLabel>
          <h2 style={{
            margin:        0,
            fontSize:      isMobile ? 22 : "clamp(24px, 2.4vw, 30px)",
            fontWeight:    900,
            letterSpacing: "-0.045em",
            lineHeight:    1.05,
            color:         TEXT_PRIMARY,
            maxWidth:      "22ch",
          }}>
            What members want built next.
          </h2>
          <div style={{
            fontSize:      12,
            color:         SUBTLE_TEXT,
            marginTop:     8,
            letterSpacing: "-0.005em",
            maxWidth:      "46ch",
          }}>
            Votes shape the roadmap — the top idea ships first.
          </div>
        </div>
        <IdeaComposer
          user={user}
          demoPreview={demoPreview}
          openAuth={openAuth}
          onSubmit={onSubmit}
          posting={posting}
          isMobile={isMobile}
        />
      </div>

      {lead && (
        <div style={{ marginBottom: 14 }}>
          <LeadingIdea
            post={lead}
            score={leadScore}
            userVote={leadUserVote}
            isOwn={leadIsOwn}
            disabled={!user || !!votingPostId}
            onVote={onVote}
            authorProfiles={authorProfiles}
            comments={comments}
            open={expandedPostId === lead.id}
            onToggle={onToggle}
            user={user}
            demoPreview={demoPreview}
            openAuth={openAuth}
            replyText={replyText}
            onReplyChange={onReplyChange}
            onReply={onReply}
            isMobile={isMobile}
          />
        </div>
      )}

      {rest.length > 0 && (
        <>
          <div style={{
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color:         SUBTLE_TEXT,
            marginBottom:  10,
            marginTop:     4,
          }}>
            Also in the queue
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {rest.map((post) => {
              const isOwn    = !post._seed && post.author_id === user?.id;
              const score    = scores[post.id] ?? post.vote_score ?? 0;
              const userVote = userVotes[post.id] ?? 0;
              return (
                <IdeaRow
                  key={post.id}
                  post={post}
                  score={score}
                  userVote={userVote}
                  isOwn={isOwn}
                  disabled={!user || !!votingPostId}
                  onVote={onVote}
                  authorProfiles={authorProfiles}
                  comments={comments}
                  open={expandedPostId === post.id}
                  onToggle={onToggle}
                  user={user}
                  demoPreview={demoPreview}
                  openAuth={openAuth}
                  replyText={replyText}
                  onReplyChange={onReplyChange}
                  onReply={onReply}
                  isMobile={isMobile}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

// ─── Lights Out — editorial tail piece ─────────────────────────────────────

function LightsOut({ race, isMobile }) {
  const roundLabel = race?.r ? `R${String(race.r).padStart(2, "0")}` : null;
  const raceName   = race?.n;
  const raceDate   = race?.date
    ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(race.date)).toUpperCase()
    : null;

  return (
    <a
      href={race?.r ? `/?page=predictions&round=${race.r}` : "/?page=predictions"}
      className="gr-lightsout"
      style={{
        display:        "block",
        position:       "relative",
        textDecoration: "none",
        color:          "inherit",
        marginTop:      isMobile ? 20 : 28,
        padding:        isMobile ? "28px 22px 26px" : "36px 32px 32px",
        borderRadius:   CARD_RADIUS,
        background:     PANEL_BG_ALT,
        border:         `1px solid ${HAIRLINE}`,
        overflow:       "hidden",
      }}
    >
      {/* Five-light sequence — F1 start motif */}
      <div aria-hidden="true" className="gr-lightsout-lights" style={{
        display:       "flex",
        gap:           isMobile ? 8 : 10,
        marginBottom:  isMobile ? 18 : 22,
      }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="gr-lightsout-light"
            style={{
              width:        isMobile ? 10 : 12,
              height:       isMobile ? 10 : 12,
              borderRadius: "50%",
              background:   rgbaFromHex(ACCENT, 0.88),
              boxShadow:    `0 0 12px ${rgbaFromHex(ACCENT, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.3)`,
              animationDelay: `${i * 140}ms`,
            }}
          />
        ))}
      </div>

      <div style={{
        display:        "flex",
        alignItems:     "flex-end",
        justifyContent: "space-between",
        gap:            18,
        flexWrap:       "wrap",
      }}>
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <div style={{
            display:       "inline-flex",
            alignItems:    "center",
            gap:           8,
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--brand)",
            marginBottom:  isMobile ? 10 : 12,
          }}>
            <span>Lights out</span>
            {(roundLabel || raceDate) && (
              <>
                <span aria-hidden="true" style={{ color: SUBTLE_TEXT, opacity: 0.5 }}>·</span>
                <span style={{ color: SUBTLE_TEXT, fontVariantNumeric: "tabular-nums" }}>
                  {[roundLabel, raceDate].filter(Boolean).join(" · ")}
                </span>
              </>
            )}
          </div>
          <h2 style={{
            margin:        0,
            fontSize:      isMobile ? 30 : "clamp(32px, 3.4vw, 44px)",
            fontWeight:    900,
            letterSpacing: "-0.045em",
            lineHeight:    1.02,
            color:         TEXT_PRIMARY,
            maxWidth:      "22ch",
          }}>
            {raceName ? <>Lock your picks for <span style={{ color: "var(--brand)" }}>{raceName}</span>.</> : "Lock your picks for the next race."}
          </h2>
          <div style={{
            fontSize:      isMobile ? 13 : 14,
            color:         MUTED_TEXT,
            marginTop:     10,
            letterSpacing: "-0.005em",
            maxWidth:      "52ch",
            lineHeight:    1.55,
          }}>
            The paddock talks — then the board gets filled.
          </div>
        </div>

        <span className="gr-lightsout-cta" style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            8,
          padding:        isMobile ? "10px 16px" : "12px 20px",
          borderRadius:   RADIUS_PILL,
          background:     BRAND_GRADIENT,
          color:          "#fff",
          fontSize:       13,
          fontWeight:     900,
          letterSpacing:  "-0.005em",
          whiteSpace:     "nowrap",
          flexShrink:     0,
          boxShadow:      `0 6px 18px ${rgbaFromHex(ACCENT, 0.28)}`,
        }}>
          Open your board
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M2 5.5h7M6 2.5l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </a>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function GridPage({ user, openAuth, demoMode = false }) {
  const { width, isMobile, isTablet } = useViewport();
  // Narrow-phone breakpoint — iPhone SE (320) through small Android (<380).
  // Tightens page padding and a few font steps so the page doesn't feel cramped.
  const isNarrowPhone = isMobile && width > 0 && width < 380;
  const { calendar }           = useRaceCalendar(2026);
  const demoPreview            = demoMode && !user;
  const currentRace            = useMemo(() => nextRace(calendar) || calendar[0] || null, [calendar]);

  const [threads, setThreads]           = useState([]);
  const [ideas, setIdeas]               = useState([]);
  const [comments, setComments]         = useState({});
  const [authorProfiles, setAuthorProfiles] = useState({});
  const [userVotes, setUserVotes]       = useState({});
  const [postScores, setPostScores]     = useState({});
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [replyText, setReplyText]       = useState({});
  const [loading, setLoading]           = useState(true);
  const [posting, setPosting]           = useState(false);
  const [votingPostId, setVotingPostId] = useState(null);
  const [totalPostCount, setTotalPostCount] = useState(0);
  const [mood, setMood]                 = useState(null);
  const [boardFilter, setBoardFilter]   = useState("all");
  const [gridSubtab, setGridSubtab]     = useState(() => {
    if (typeof window === "undefined") return "talk";
    const requested = new URLSearchParams(window.location.search).get("view");
    return ["talk", "shape", "highlights"].includes(requested) ? requested : "talk";
  });
  const switchSubtab = (next) => {
    if (next === gridSubtab) return;
    if (typeof document !== "undefined" && document.startViewTransition) {
      document.startViewTransition(() => setGridSubtab(next));
    } else {
      setGridSubtab(next);
    }
  };

  usePageMetadata({
    title:       "The Paddock — Stint Community",
    description: "Where Stint members talk about this weekend's race, read the room, and shape the product's roadmap.",
    path:        "/grid",
  });

  // ─── Data load ──────────────────────────────────────────────────────────

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setExpandedPostId(null);

      const threadsQuery = supabase
        .from("posts")
        .select("*")
        .is("league_id", null)
        .in("category", ["race_discussion", "general"])
        .order("created_at", { ascending: false })
        .limit(80);

      const ideasQuery = supabase
        .from("post_with_scores")
        .select("*")
        .is("league_id", null)
        .eq("category", "feature_requests")
        .order("vote_score", { ascending: false })
        .limit(40);

      const countQuery = supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .is("league_id", null);

      const [threadsRes, ideasRes, countRes] = await Promise.all([threadsQuery, ideasQuery, countQuery]);

      if (ignore) return;

      const threadRows = threadsRes.data || [];
      setThreads(threadRows);

      if (ideasRes.error) {
        // Fallback to plain posts table if the view doesn't exist
        const fb = await supabase
          .from("posts")
          .select("*")
          .is("league_id", null)
          .eq("category", "feature_requests")
          .order("created_at", { ascending: false })
          .limit(40);
        if (!ignore) setIdeas(fb.data || []);
      } else {
        const ideaRows = ideasRes.data || [];
        setIdeas(ideaRows);
        const scores = {};
        ideaRows.forEach((row) => { scores[row.id] = row.vote_score ?? 0; });
        setPostScores(scores);
      }

      setTotalPostCount(countRes.count || 0);

      // Hydrate profiles for all authors we just fetched
      const authorIds = [...new Set(
        [...threadRows, ...(ideasRes.data || [])]
          .map((p) => p.author_id)
          .filter(Boolean)
      )];
      if (authorIds.length) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id,username,avatar_color,favorite_team,subscription_status,points")
          .in("id", authorIds);
        if (profileData && !ignore) {
          setAuthorProfiles((prev) => ({
            ...prev,
            ...Object.fromEntries(profileData.map((p) => [p.id, normalizeProfile(p)])),
          }));
        }
      }

      setLoading(false);
    }

    load();
    return () => { ignore = true; };
  }, []);

  // Mood aggregation — pick consensus + community pulse for the current race.
  useEffect(() => {
    if (!currentRace?.r) return;
    let ignore = false;

    async function loadMood() {
      // Aggregate picks for the current race. Degrades gracefully if the table
      // isn't queryable in this environment.
      let winnerTop = null;
      let dnfTop    = null;
      try {
        const { data, error } = await supabase
          .from("predictions")
          .select("picks")
          .eq("race_round", currentRace.r)
          .limit(500);
        if (!error && Array.isArray(data) && data.length) {
          const winnerCounts = {};
          const dnfCounts    = {};
          let total = 0;
          for (const row of data) {
            const picks = row?.picks && typeof row.picks === "object" && !Array.isArray(row.picks) ? row.picks : null;
            if (!picks) continue;
            total += 1;
            if (typeof picks.winner === "string" && picks.winner.trim()) {
              winnerCounts[picks.winner] = (winnerCounts[picks.winner] || 0) + 1;
            }
            if (typeof picks.dnf === "string" && picks.dnf.trim()) {
              dnfCounts[picks.dnf] = (dnfCounts[picks.dnf] || 0) + 1;
            }
          }
          const topOf = (counts) => {
            const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (!entries.length || !total) return null;
            const [name, count] = entries[0];
            return { name, share: Math.round((count / total) * 100) };
          };
          winnerTop = topOf(winnerCounts);
          dnfTop    = topOf(dnfCounts);
        }
      } catch {
        /* soft-fail — mood still renders other chips */
      }

      if (ignore) return;
      setMood((prev) => ({
        ...(prev || {}),
        winner: winnerTop,
        dnf:    dnfTop,
      }));
    }

    loadMood();
    return () => { ignore = true; };
  }, [currentRace?.r]);

  // Derived mood data from threads/ideas (doesn't require extra queries)
  useEffect(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const recent = threads.filter((p) => new Date(p.created_at).getTime() >= weekAgo);
    const uniqueAuthors = new Set(recent.map((p) => p.author_id).filter(Boolean));
    const proAuthors    = new Set(
      recent
        .filter((p) => isProIdentity(authorProfiles[p.author_id], p.author_name))
        .map((p) => p.author_id || p.author_name)
    );
    const topIdea = (ideas[0] && ideas[0].title) || null;

    setMood((prev) => ({
      ...(prev || {}),
      voices:    uniqueAuthors.size || "—",
      proActive: proAuthors.size || 0,
      ideas:     ideas.length || "—",
      topIdea:   topIdea
        ? (topIdea.length > 36 ? `${topIdea.slice(0, 35).trim()}…` : topIdea)
        : null,
    }));
  }, [threads, ideas, authorProfiles]);

  // User votes
  useEffect(() => {
    if (!user || !ideas.length) return;
    const postIds = ideas.map((p) => p.id).filter(Boolean);
    if (!postIds.length) return;

    supabase
      .from("post_votes")
      .select("post_id,vote")
      .eq("user_id", user.id)
      .in("post_id", postIds)
      .then(({ data }) => {
        if (!data) return;
        const votes = {};
        data.forEach((v) => { votes[v.post_id] = v.vote; });
        setUserVotes((prev) => ({ ...prev, ...votes }));
      });
  }, [user, ideas]);

  // ─── Actions ───────────────────────────────────────────────────────────

  async function loadComments(postId) {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error || !data) return;
    setComments((prev) => ({ ...prev, [postId]: data }));

    const ids = [...new Set(data.map((c) => c.author_id).filter(Boolean))];
    if (ids.length) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,username,avatar_color,favorite_team,subscription_status")
        .in("id", ids);
      if (profileData) {
        setAuthorProfiles((prev) => ({
          ...prev,
          ...Object.fromEntries(profileData.map((p) => [p.id, normalizeProfile(p)])),
        }));
      }
    }
  }

  function toggleThread(postId, isSeedPost = false) {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(postId);
    if (!isSeedPost && !comments[postId]) loadComments(postId);
  }

  async function submitPost({ category, title, body }) {
    if (demoPreview || posting) return false;
    if (!title || !body || !user) return false;
    const session = await requireActiveSession();
    if (!session) { openAuth("login"); return false; }

    setPosting(true);
    const { error } = await supabase.from("posts").insert({
      author_id:   user.id,
      author_name: user.username,
      title,
      body,
      category,
    });
    setPosting(false);

    if (error) { alert(error.message); return false; }

    // Refetch the relevant list
    if (category === "feature_requests") {
      const { data } = await supabase
        .from("post_with_scores")
        .select("*")
        .is("league_id", null)
        .eq("category", "feature_requests")
        .order("vote_score", { ascending: false })
        .limit(40);
      if (data) {
        setIdeas(data);
        const scores = {};
        data.forEach((row) => { scores[row.id] = row.vote_score ?? 0; });
        setPostScores((prev) => ({ ...prev, ...scores }));
      }
    } else {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .is("league_id", null)
        .in("category", ["race_discussion", "general"])
        .order("created_at", { ascending: false })
        .limit(80);
      if (data) setThreads(data);
    }
    return true;
  }

  async function submitReply(postId) {
    if (demoPreview) return;
    if (!replyText[postId]?.trim() || !user) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { error } = await supabase.from("comments").insert({
      post_id:     postId,
      author_id:   user.id,
      author_name: user.username,
      body:        replyText[postId].trim(),
    });
    if (error) { alert(error.message); return; }

    setReplyText((prev) => ({ ...prev, [postId]: "" }));
    loadComments(postId);
  }

  async function handleVote(postId, newVote) {
    if (!user) return openAuth("login");
    if (votingPostId === postId) return;

    const prevVote  = userVotes[postId] ?? 0;
    const prevScore = postScores[postId] ?? 0;
    const delta     = newVote - prevVote;

    setUserVotes((prev) => ({ ...prev, [postId]: newVote }));
    setPostScores((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + delta }));
    setIdeas((prev) =>
      prev.map((p) => p.id === postId ? { ...p, vote_score: (p.vote_score ?? 0) + delta } : p)
    );
    setVotingPostId(postId);

    try {
      if (newVote === 0) {
        const { error } = await supabase
          .from("post_votes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_votes")
          .upsert(
            { post_id: postId, user_id: user.id, vote: newVote, updated_at: new Date().toISOString() },
            { onConflict: "post_id,user_id" }
          );
        if (error) throw error;
      }
    } catch {
      setUserVotes((prev) => ({ ...prev, [postId]: prevVote }));
      setPostScores((prev) => ({ ...prev, [postId]: prevScore }));
      setIdeas((prev) => prev.map((p) => p.id === postId ? { ...p, vote_score: prevScore } : p));
    } finally {
      setVotingPostId(null);
    }
  }

  // ─── Derive data ───────────────────────────────────────────────────────

  // Backend-only mode: empty Grid data should render empty states, not static demo posts.
  const isSeedMode = false;
  const effectiveThreads = isSeedMode
    ? [...SEED_POSTS.race_discussion, ...SEED_POSTS.general]
    : threads;
  const effectiveIdeas = isSeedMode
    ? SEED_POSTS.feature_requests
    : ideas;

  const racePosts = useMemo(
    () => effectiveThreads.filter((p) => p.category === "race_discussion"),
    [effectiveThreads]
  );

  const featuredTake = useMemo(
    () => pickFeaturedThread(racePosts, comments),
    [racePosts, comments]
  );

  const boardPosts = useMemo(() => {
    const featuredId = featuredTake?.id;
    const pool = effectiveThreads.filter((p) => p.id !== featuredId);
    const sorted = [...pool].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (boardFilter === "race")    return sorted.filter((p) => p.category === "race_discussion");
    if (boardFilter === "general") return sorted.filter((p) => p.category === "general");
    if (boardFilter === "yours" && user) return sorted.filter((p) => p.author_id === user.id);
    return sorted;
  }, [effectiveThreads, featuredTake, boardFilter, user]);

  // Voice of the Grid — pick the most substantive reply in the feed as a pulled quote.
  // Rule: scan featured-take + recent board threads, take the longest reply under 220 chars
  // (long enough to have a take, short enough to pull cleanly). Soft-fails to null.
  const voice = useMemo(() => {
    const pool = [featuredTake, ...boardPosts.slice(0, 8)].filter(Boolean);
    let best = null;
    for (const post of pool) {
      const replies = post._seed ? (post._comments || []) : (comments[post.id] || []);
      for (const reply of replies) {
        const body = (reply?.body || "").trim();
        if (!body || body.length < 40 || body.length > 220) continue;
        if (!best || body.length > best.body.length) {
          best = {
            body,
            author:      reply.author_name,
            authorId:    reply.author_id,
            threadId:    post.id,
            threadTitle: post.title,
            threadIsSeed: !!post._seed,
          };
        }
      }
    }
    return best;
  }, [featuredTake, boardPosts, comments]);

  // Voices count — distinct authors across threads + ideas + loaded comments
  const voicesCount = useMemo(() => {
    const names = new Set();
    for (const p of effectiveThreads) if (p.author_name) names.add(p.author_name);
    for (const p of effectiveIdeas)   if (p.author_name) names.add(p.author_name);
    for (const list of Object.values(comments)) {
      for (const c of list || []) if (c.author_name) names.add(c.author_name);
    }
    return names.size;
  }, [effectiveThreads, effectiveIdeas, comments]);

  // Eagerly load featured thread's comments — Voice of the Grid needs them.
  useEffect(() => {
    const fid = featuredTake?.id;
    if (!fid || featuredTake?._seed) return;
    if (comments[fid]) return;
    loadComments(fid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredTake?.id]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <PageShell tone="live" ambient="glow">
      <style>{`
        /* ── Motion tokens
           - Curve: --gr-ease = ${EASE_OUT_EXPO} — ease-out-expo, STINT's signature.
           - Durations: fast 140ms, quick 200ms, medium 280ms, slow 380ms.
           Everything in this block uses transform + opacity where possible.
           Layout-reflow is only used for the thread-reveal (grid-template-rows). */

        .gr-board-row, .gr-featured-card, .gr-idea {
          transition: background 200ms ${EASE_OUT_EXPO},
                      border-color 200ms ${EASE_OUT_EXPO},
                      transform 220ms ${EASE_OUT_EXPO},
                      box-shadow 220ms ${EASE_OUT_EXPO};
          will-change: transform;
        }
        .gr-board-expander, .gr-featured-expander, .gr-idea-expander, .gr-composer-collapsed {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .gr-board-expander:focus-visible,
        .gr-featured-expander:focus-visible,
        .gr-idea-expander:focus-visible {
          outline: 2px solid ${rgbaFromHex(ACCENT, 0.58)};
          outline-offset: 4px;
          border-radius: 6px;
        }
        @media (hover: hover) and (pointer: fine) {
          /* Board row — title accent + subtle bg tint */
          .gr-board-row:not(.gr-post-open):has(.gr-board-expander:hover) {
            background: rgba(255,255,255,0.012);
          }
          .gr-board-row:not(.gr-post-open):has(.gr-board-expander:hover) .gr-board-title {
            color: ${ACCENT};
          }
          .gr-board-row:not(.gr-post-open):has(.gr-board-expander:hover) .gr-chev {
            color: ${ACCENT};
          }

          /* Featured card — lift + accent border */
          .gr-featured-card:not(.gr-post-open):has(.gr-featured-expander:hover) {
            transform: translateY(-1px);
            border-color: ${rgbaFromHex(ACCENT, 0.40)};
            box-shadow: 0 16px 36px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04);
          }

          /* Idea row — lift + title accent */
          .gr-idea:not(.gr-post-open):has(.gr-idea-expander:hover) {
            transform: translateY(-1px);
            border-color: ${rgbaFromHex(ACCENT, 0.26)};
          }
          .gr-idea.gr-leading:not(.gr-post-open):has(.gr-idea-expander:hover) {
            border-color: ${rgbaFromHex(INFO_SOFT, 0.36)};
            box-shadow: 0 10px 28px rgba(12, 24, 40, 0.32);
          }
          .gr-idea:not(.gr-post-open):has(.gr-idea-expander:hover) .gr-idea-title {
            color: ${ACCENT};
          }
          .gr-idea.gr-leading:not(.gr-post-open):has(.gr-idea-expander:hover) .gr-idea-title {
            color: #9cd1ff;
          }

          /* Composer collapsed — subtle accent on hover */
          .gr-composer-collapsed:hover:not(:disabled) {
            border-color: ${rgbaFromHex(ACCENT, 0.28)};
            background: rgba(255,255,255,0.015);
            color: ${TEXT_PRIMARY};
          }
        }

        /* Press states — transform-only, fast return */
        .gr-board-expander:active:not([aria-expanded="true"]),
        .gr-featured-expander:active:not([aria-expanded="true"]),
        .gr-idea-expander:active:not([aria-expanded="true"]) {
          transform: scale(0.996);
          transition: transform 80ms ${EASE_OUT_EXPO};
        }

        .gr-board-title, .gr-idea-title {
          transition: color 180ms ${EASE_OUT_EXPO};
        }
        .gr-chev {
          transition: color 180ms ${EASE_OUT_EXPO},
                      transform 280ms ${EASE_OUT_EXPO};
          transform-origin: center;
        }
        .gr-board-row.gr-post-open .gr-chev {
          transform: rotate(180deg);
          color: ${ACCENT};
        }

        .gr-composer-collapsed {
          transition: background 180ms ${EASE_OUT_EXPO},
                      border-color 180ms ${EASE_OUT_EXPO},
                      color 180ms ${EASE_OUT_EXPO};
        }
        .gr-composer-collapsed:focus-visible {
          outline: 2px solid ${rgbaFromHex(ACCENT, 0.58)};
          outline-offset: 4px;
        }
        .gr-cta:focus-visible,
        .gr-btn-ghost:focus-visible {
          outline: 2px solid ${rgbaFromHex(ACCENT, 0.58)};
          outline-offset: 3px;
        }

        .gr-tab {
          transition: background 200ms ${EASE_OUT_EXPO},
                      border-color 200ms ${EASE_OUT_EXPO},
                      color 200ms ${EASE_OUT_EXPO},
                      transform 140ms ${EASE_OUT_EXPO};
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        @media (hover: hover) and (pointer: fine) {
          .gr-tab:not([aria-pressed="true"]):hover {
            background: rgba(255,255,255,0.03);
            border-color: rgba(148,163,184,0.26);
            color: ${TEXT_PRIMARY};
          }
        }
        .gr-tab:active { transform: scale(0.97); transition-duration: 80ms; }
        .gr-tab:focus-visible {
          outline: 2px solid ${rgbaFromHex(ACCENT, 0.58)};
          outline-offset: 3px;
        }

        .gr-tog {
          transition: background 180ms ${EASE_OUT_EXPO},
                      border-color 180ms ${EASE_OUT_EXPO},
                      color 180ms ${EASE_OUT_EXPO};
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        /* Vote button */
        .gr-vote-btn {
          transition: background 160ms ${EASE_OUT_EXPO},
                      border-color 160ms ${EASE_OUT_EXPO},
                      transform 120ms ${EASE_OUT_EXPO};
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .gr-vote-btn:active:not(:disabled) { transform: scale(0.92); transition-duration: 60ms; }
        .gr-vote-btn:focus-visible {
          outline: 2px solid ${rgbaFromHex(ACCENT, 0.58)};
          outline-offset: 3px;
        }
        @media (hover: hover) and (pointer: fine) {
          .gr-vote-btn:not(:disabled):hover { background: rgba(255,255,255,0.06); }
        }
        /* Score pop — quick confirmation on change (transform only) */
        @keyframes gr-score-pop {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.14); }
          100% { transform: scale(1); }
        }
        .gr-score-pop {
          animation: gr-score-pop 280ms ${EASE_OUT_EXPO};
        }

        .gr-cta {
          transition: box-shadow 220ms ${EASE_OUT_EXPO},
                      transform 160ms ${EASE_OUT_EXPO},
                      filter 200ms ${EASE_OUT_EXPO},
                      background 180ms ${EASE_OUT_EXPO},
                      color 180ms ${EASE_OUT_EXPO},
                      border-color 180ms ${EASE_OUT_EXPO};
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        @media (hover: hover) and (pointer: fine) {
          .gr-cta:not(:disabled):hover {
            transform: translateY(-1px);
            filter: brightness(1.05);
          }
        }
        .gr-cta:not(:disabled):active { transform: translateY(0) scale(0.98); transition-duration: 80ms; }

        .gr-btn-ghost {
          transition: border-color 180ms ${EASE_OUT_EXPO},
                      background 180ms ${EASE_OUT_EXPO},
                      color 180ms ${EASE_OUT_EXPO};
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        @media (hover: hover) and (pointer: fine) {
          .gr-btn-ghost:hover {
            color: ${TEXT_PRIMARY};
          }
        }

        .gr-text-btn {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: text-decoration-color 180ms ${EASE_OUT_EXPO},
                      color 180ms ${EASE_OUT_EXPO};
        }
        @media (hover: hover) and (pointer: fine) {
          .gr-text-btn:hover { text-decoration-color: ${ACCENT}; color: ${ACCENT}; }
        }

        /* Inputs — border + soft accent halo on focus */
        .gr-input {
          transition: border-color 180ms ${EASE_OUT_EXPO},
                      background 180ms ${EASE_OUT_EXPO},
                      box-shadow 180ms ${EASE_OUT_EXPO};
        }
        .gr-input:focus {
          border-color: ${rgbaFromHex(ACCENT, 0.44)} !important;
          outline: none;
          background: rgba(6,16,27,0.6) !important;
          box-shadow: 0 0 0 3px ${rgbaFromHex(ACCENT, 0.14)};
        }
        .gr-input::placeholder { color: ${SUBTLE_TEXT}; }

        /* Composer form — subtle grow from the tapped position */
        @keyframes gr-composer-form-in {
          from { opacity: 0; transform: scale(0.985) translateY(-2px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .gr-composer-form {
          animation: gr-composer-form-in 320ms ${EASE_OUT_EXPO} both;
        }

        /* Thread reveal — grid-template-rows is the one layout animation we allow.
           Content inside fades + translates with a short delay so it feels
           like it's being uncovered, not popped. */
        .gr-thread-reveal {
          display: grid;
          grid-template-rows: 0fr;
          animation: gr-thread-reveal 320ms ${EASE_OUT_EXPO} forwards;
        }
        @keyframes gr-thread-reveal {
          to { grid-template-rows: 1fr; }
        }
        .gr-thread-reveal-inner {
          min-height: 0;
          overflow: hidden;
        }
        .gr-thread-content {
          opacity: 0;
          transform: translateY(-4px);
          animation: gr-thread-content-in 260ms 100ms ${EASE_OUT_EXPO} forwards;
          will-change: transform, opacity;
        }
        @keyframes gr-thread-content-in {
          to { opacity: 1; transform: translateY(0); }
        }

        /* Voice of the Grid — lift + accent border + arrow shift */
        .gr-voice-card {
          transition: border-color 220ms ${EASE_OUT_EXPO},
                      background 220ms ${EASE_OUT_EXPO},
                      transform 220ms ${EASE_OUT_EXPO},
                      box-shadow 220ms ${EASE_OUT_EXPO};
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          will-change: transform;
        }
        .gr-voice-cta {
          transition: transform 220ms ${EASE_OUT_EXPO},
                      color 180ms ${EASE_OUT_EXPO};
        }
        @media (hover: hover) and (pointer: fine) {
          .gr-voice-card:hover {
            border-color: ${rgbaFromHex(ACCENT, 0.34)};
            background: rgba(255,255,255,0.028);
            transform: translateY(-1px);
            box-shadow: 0 14px 32px rgba(0,0,0,0.26);
          }
          .gr-voice-card:hover .gr-voice-cta {
            transform: translateX(3px);
          }
        }
        .gr-voice-card:active { transform: translateY(0) scale(0.998); transition-duration: 100ms; }
        .gr-voice-card:focus-visible {
          outline: 2px solid ${rgbaFromHex(ACCENT, 0.58)};
          outline-offset: 4px;
          border-radius: 10px;
        }

        /* Lights Out — pulse on 5-light start sequence + pill elevation on hover */
        .gr-lightsout {
          transition: background 220ms ${EASE_OUT_EXPO},
                      border-color 220ms ${EASE_OUT_EXPO};
          -webkit-tap-highlight-color: transparent;
        }
        .gr-lightsout-cta {
          transition: transform 220ms ${EASE_OUT_EXPO},
                      box-shadow 220ms ${EASE_OUT_EXPO},
                      filter 200ms ${EASE_OUT_EXPO};
          will-change: transform;
        }
        @keyframes gr-light-pulse {
          0%, 60%, 100% {
            background: ${rgbaFromHex(ACCENT, 0.88)};
            box-shadow: 0 0 12px ${rgbaFromHex(ACCENT, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.3);
          }
          30% {
            background: ${rgbaFromHex(ACCENT, 1)};
            box-shadow: 0 0 20px ${rgbaFromHex(ACCENT, 0.85)}, inset 0 1px 0 rgba(255,255,255,0.45);
          }
        }
        .gr-lightsout-light {
          animation: gr-light-pulse 3600ms ${EASE_OUT_EXPO} infinite;
        }
        @media (hover: hover) and (pointer: fine) {
          .gr-lightsout:hover {
            border-color: ${rgbaFromHex(ACCENT, 0.30)};
            background: var(--bg-hover);
          }
          .gr-lightsout:hover .gr-lightsout-cta {
            transform: translateX(3px);
            filter: brightness(1.06);
            box-shadow: 0 10px 26px ${rgbaFromHex(ACCENT, 0.40)};
          }
        }
        .gr-lightsout:focus-visible {
          outline: 2px solid ${rgbaFromHex(ACCENT, 0.58)};
          outline-offset: 4px;
        }

        /* Masthead pulse dot — soft breathing when live */
        @keyframes gr-pulse-dot {
          0%, 100% { box-shadow: 0 0 0 3px ${rgbaFromHex(SUCCESS, 0.16)}; }
          50%      { box-shadow: 0 0 0 5px ${rgbaFromHex(SUCCESS, 0.26)}; }
        }
        .pd-pulse-dot--live {
          animation: gr-pulse-dot 2600ms ${EASE_OUT_EXPO} infinite;
        }

        /* Entry orchestration — hero → subtab nav → subtab body → footer.
           Tight 80ms cadence. The hero is one card now (Masthead + Pulse +
           Composer merged) so the cascade is fewer steps. */
        @keyframes gr-section-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pd-masthead       { animation: gr-section-in 420ms ${EASE_OUT_EXPO} both; }
        .gr-subtab-nav     { animation: gr-section-in 400ms 80ms ${EASE_OUT_EXPO} both; }
        .gr-featured       { animation: gr-section-in 400ms 140ms ${EASE_OUT_EXPO} both; }
        .gr-voice          { animation: gr-section-in 400ms 200ms ${EASE_OUT_EXPO} both; }
        .gr-board          { animation: gr-section-in 400ms 140ms ${EASE_OUT_EXPO} both; }
        .gr-shaping        { animation: gr-section-in 400ms 140ms ${EASE_OUT_EXPO} both; }
        .gr-composer       { animation: gr-section-in 400ms 280ms ${EASE_OUT_EXPO} both; }

        /* Subtab pills — hover lift + active morph */
        .gr-subtab {
          transition: background 200ms ${EASE_OUT_EXPO}, border-color 200ms ${EASE_OUT_EXPO}, transform 160ms ${EASE_OUT_EXPO};
          -webkit-tap-highlight-color: transparent;
        }
        .gr-subtab:active { transform: scale(0.97); }

        /* View-transition for the subtab body morph */
        ::view-transition-old(grid-subtab-body),
        ::view-transition-new(grid-subtab-body) {
          animation-duration: 320ms;
          animation-timing-function: ${EASE_OUT_EXPO};
        }

        @media (prefers-reduced-motion: reduce) {
          .gr-board-row, .gr-featured-card, .gr-idea, .gr-tab, .gr-vote-btn, .gr-cta,
          .gr-btn-ghost, .gr-input, .gr-board-title, .gr-idea-title, .gr-chev,
          .gr-composer-collapsed, .gr-lightsout, .gr-lightsout-cta, .gr-voice-card, .gr-voice-cta {
            transition: none !important;
          }
          .gr-tab:active, .gr-vote-btn:active, .gr-cta:active,
          .gr-board-expander:active, .gr-featured-expander:active, .gr-idea-expander:active,
          .gr-voice-card:active {
            transform: none !important;
          }
          .pd-masthead, .gr-subtab-nav, .gr-composer, .gr-featured, .gr-voice, .gr-board, .gr-shaping,
          .gr-thread-reveal, .gr-thread-content, .gr-composer-form, .gr-score-pop, .gr-subtab {
            animation: none !important; opacity: 1 !important; transform: none !important; transition: none !important;
          }
          .gr-thread-reveal { grid-template-rows: 1fr !important; }
          .gr-lightsout-light, .pd-pulse-dot--live { animation: none !important; }
          ::view-transition-old(grid-subtab-body), ::view-transition-new(grid-subtab-body) { animation: none !important; }
        }
      `}</style>

      {/* Unified hero — masthead + pulse + composer in one card */}
      <PaddockBriefing
        race={currentRace}
        mood={mood}
        loading={loading}
        threadCount={totalPostCount || effectiveThreads.length + effectiveIdeas.length}
        voicesCount={voicesCount}
        isSeedMode={isSeedMode}
        isMobile={isMobile}
        user={user}
        demoPreview={demoPreview}
        openAuth={openAuth}
        onSubmit={submitPost}
        posting={posting}
      />

      {/* Subtab nav — Talk / Shape Stint / Highlights */}
      <nav
        className="gr-subtab-nav"
        aria-label="Paddock sections"
        style={{
          display: "flex",
          gap: isMobile ? 8 : 10,
          marginBottom: isMobile ? 22 : 28,
          flexWrap: "wrap",
        }}
      >
        {[
          { key: "talk",       label: "Talk",        count: effectiveThreads.length, hideCount: effectiveThreads.length === 0 },
          { key: "shape",      label: "Shape Stint", count: effectiveIdeas.length,   hideCount: effectiveIdeas.length === 0 },
          { key: "highlights", label: "Highlights",  count: 0, hideCount: true },
        ].map(({ key, label, count, hideCount }) => {
          const active = gridSubtab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchSubtab(key)}
              aria-pressed={active}
              className="gr-subtab"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                background: active ? rgbaFromHex(ACCENT, 0.13) : "rgba(148,163,184,0.04)",
                border: active ? `1px solid ${rgbaFromHex(ACCENT, 0.30)}` : `1px solid ${HAIRLINE}`,
                borderRadius: RADIUS_PILL,
                color: active ? ACCENT : TEXT_PRIMARY,
                cursor: "pointer",
                fontWeight: 800,
                fontSize: isMobile ? 13 : 14,
                letterSpacing: "-0.005em",
                padding: isMobile ? "12px 18px" : "11px 22px",
                minHeight: isMobile ? 44 : 42,
                fontFamily: "inherit",
                viewTransitionName: active ? "grid-active-tab" : undefined,
                boxShadow: active ? `0 4px 14px ${rgbaFromHex(ACCENT, 0.18)}` : "none",
              }}
            >
              {label}
              {!hideCount && (
                <span style={{
                  fontSize: 10, fontWeight: 900,
                  letterSpacing: "0.06em",
                  fontVariantNumeric: "tabular-nums",
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: active ? rgbaFromHex(ACCENT, 0.20) : "rgba(148,163,184,0.10)",
                  color: active ? ACCENT : SUBTLE_TEXT,
                  border: active ? `1px solid ${rgbaFromHex(ACCENT, 0.30)}` : `1px solid ${HAIRLINE}`,
                  minWidth: 22, textAlign: "center",
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Subtab body — wrapped so view-transition morphs between modes */}
      <div style={{ viewTransitionName: "grid-subtab-body" }}>
        {gridSubtab === "talk" && (
          <Board
            posts={boardPosts}
            filter={boardFilter}
            onFilterChange={setBoardFilter}
            authorProfiles={authorProfiles}
            comments={comments}
            expandedPostId={expandedPostId}
            onToggle={toggleThread}
            user={user}
            demoPreview={demoPreview}
            openAuth={openAuth}
            replyText={replyText}
            onReplyChange={setReplyText}
            onReply={submitReply}
            isMobile={isMobile}
            hasPosts={effectiveThreads.length > 0}
          />
        )}

        {gridSubtab === "shape" && (
          <ShapingStint
            ideas={effectiveIdeas}
            authorProfiles={authorProfiles}
            comments={comments}
            scores={postScores}
            userVotes={userVotes}
            onVote={handleVote}
            votingPostId={votingPostId}
            user={user}
            demoPreview={demoPreview}
            openAuth={openAuth}
            expandedPostId={expandedPostId}
            onToggle={toggleThread}
            replyText={replyText}
            onReplyChange={setReplyText}
            onReply={submitReply}
            onSubmit={submitPost}
            posting={posting}
            isMobile={isMobile}
          />
        )}

        {gridSubtab === "highlights" && (
          <div style={{ display: "grid", gap: isMobile ? 22 : 32 }}>
            {featuredTake ? (
              <FeaturedTake
                post={featuredTake}
                comments={comments}
                authorProfiles={authorProfiles}
                open={expandedPostId === featuredTake.id}
                onToggle={toggleThread}
                user={user}
                demoPreview={demoPreview}
                openAuth={openAuth}
                replyText={replyText}
                onReplyChange={setReplyText}
                onReply={submitReply}
                isMobile={isMobile}
              />
            ) : (
              <section style={{
                padding: isMobile ? "32px 22px" : "48px 32px",
                textAlign: "center",
                borderRadius: SECTION_RADIUS,
                border: PANEL_BORDER,
                background: PANEL_BG,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 900,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: SUBTLE_TEXT, marginBottom: 10,
                }}>Featured · Empty</div>
                <h3 className="stint-section-title" style={{
                  margin: 0,
                  fontSize: isMobile ? 18 : 22,
                  letterSpacing: "-0.03em",
                }}>Featured take appears once the room engages</h3>
              </section>
            )}

            <VoiceOfTheGrid
              quote={voice?.body}
              author={voice?.author}
              threadTitle={voice?.threadTitle}
              authorProfile={authorProfiles[voice?.authorId]}
              pro={isProIdentity(authorProfiles[voice?.authorId], voice?.author)}
              onOpen={() => voice && toggleThread(voice.threadId, voice.threadIsSeed)}
              isMobile={isMobile}
            />
          </div>
        )}
      </div>

      <LightsOut race={currentRace} isMobile={isMobile} />
    </PageShell>
  );
}
