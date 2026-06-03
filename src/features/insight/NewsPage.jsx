import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { chooseInsightForRace } from "@/src/lib/aiInsight";
import { nextRace } from "@/src/constants/calendar";
import {
  ACCENT,
  AI_BLUE_TEXT,
  CARD_RADIUS,
  CARD_SHADOW,
  DANGER,
  ERROR_TEXT,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  PRO_AMBER_DOT,
  PRO_AMBER_TEXT,
  RADIUS_MD,
  RADIUS_PILL,
  SECTION_RADIUS,
  SUBTLE_TEXT,
  SUCCESS,
  SUCCESS_TEXT,
  TEXT_PRIMARY,
  rgbaFromHex,
} from "@/src/constants/design";

// Soft info-blue alias — Insight surfaces use this name historically; it
// resolves to the AI_BLUE_TEXT token (which is the `--text-ai` CSS var) so
// the page reads through the design system in both color modes.
const INFO_SOFT = AI_BLUE_TEXT;
import { IS_SNAPSHOT } from "@/src/lib/runtimeFlags";
import { DRV, TEAMS } from "@/src/constants/teams";
import useRaceCalendar from "@/src/lib/useRaceCalendar";
import usePageMetadata from "@/src/lib/usePageMetadata";
import { previewText } from "@/src/lib/format";
import { ProBadge } from "@/src/ui/ProBadge";
import SectionLabel from "@/src/ui/SectionLabel";
import PageShell from "@/src/ui/PageShell";
import useViewport from "@/src/lib/useViewport";

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCKED_NEWS_SOURCES = new Set(["Formula1.com"]);

const SOURCE_DIRECTORY = [
  { name: "BBC Sport F1",      role: "General",    detail: "Broad race-week coverage and clean headline summaries.",      url: "https://www.bbc.com/sport/formula1" },
  { name: "ESPN F1",           role: "Wire",       detail: "Fast race-week updates and broad international coverage.",    url: "https://www.espn.com/f1/" },
  { name: "Autosport RSS",     role: "Fast wire",  detail: "Quick race-week reporting and headline developments.",         url: "https://www.autosport.com/rss/f1/news/" },
  { name: "Motorsport RSS",    role: "Depth",      detail: "Deeper features, context and weekend follow-up stories.",      url: "https://www.motorsport.com/rss/f1/news/" },
  { name: "RACER",             role: "Paddock",    detail: "Team, grid and weekend storylines with a U.S. racing lens.",   url: "https://racer.com/category/f1/" },
  { name: "Crash F1",          role: "Coverage",   detail: "Supplemental race-week headlines and team developments.",      url: "https://www.crash.net/f1" },
  { name: "PlanetF1",          role: "Digest",     detail: "Opinion and week-to-week narrative context for fantasy angles.", url: "https://www.planetf1.com/" },
  { name: "Motorsport Week",   role: "Editorial",  detail: "Long-form analysis coverage around race weekends.",            url: "https://www.motorsportweek.com/" },
];

const AI_CATEGORY_ORDER = [
  "pole", "winner", "p2", "p3",
  "dnf", "fl", "dotd", "ctor", "sc", "rf",
  "sp_pole", "sp_winner", "sp_p2", "sp_p3",
];

const PRIMARY_CATEGORY = new Set(["pole", "winner", "p2", "p3", "sp_pole", "sp_winner"]);

const CATEGORY_LABELS = {
  pole:       "Pole Position",
  winner:     "Race Winner",
  p2:         "P2",
  p3:         "P3",
  dnf:        "DNF Pick",
  fl:         "Fastest Lap",
  dotd:       "Driver of the Day",
  ctor:       "Constructor",
  sc:         "Safety Car",
  rf:         "Red Flag",
  sp_pole:    "Sprint Pole",
  sp_winner:  "Sprint Winner",
  sp_p2:      "Sprint P2",
  sp_p3:      "Sprint P3",
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function relativeTime(value) {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60)     return "just now";
  if (diffSec < 3600)   return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400)  return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 7)         return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 6)        return `${weeks}w ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function absoluteTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day:     "numeric",
    month:   "short",
    hour:    "numeric",
    minute:  "2-digit",
  }).format(d);
}

function timeGroupKey(value) {
  if (!value) return "earlier";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "earlier";
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day   = 86400000;
  if (then >= today)            return "today";
  if (then >= today - day)      return "yesterday";
  if (then >= today - 6 * day)  return "week";
  return "earlier";
}

const TIME_GROUP_LABELS = {
  today:     "Today",
  yesterday: "Yesterday",
  week:      "Earlier this week",
  earlier:   "Earlier",
};

function pickFeaturedArticle(items) {
  if (!items.length) return null;
  const pool = items.slice(0, 10);
  return [...pool].sort((left, right) => {
    const leftSummary   = left.summary?.length || 0;
    const rightSummary  = right.summary?.length || 0;
    const leftRecency   = left.published_at  ? new Date(left.published_at).getTime()  / 1e11 : 0;
    const rightRecency  = right.published_at ? new Date(right.published_at).getTime() / 1e11 : 0;
    const leftScore     = leftSummary  + (left.image_url  ? 420 : 0) + leftRecency;
    const rightScore    = rightSummary + (right.image_url ? 420 : 0) + rightRecency;
    return rightScore - leftScore;
  })[0] || items[0];
}

function driverContext(pickName) {
  if (!pickName) return null;
  const dr = DRV.find((d) => d.n === pickName);
  if (!dr) return null;
  const tm = TEAMS[dr.t];
  const parts = dr.n.split(" ").filter(Boolean);
  const initials = (parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "");
  return {
    name:     dr.n,
    team:     dr.t,
    color:    tm?.c || ACCENT,
    abbr:     (dr.abbr || initials).toUpperCase(),
    initials: initials.toUpperCase(),
  };
}

function constructorContext(teamName) {
  if (!teamName) return null;
  const tm = TEAMS[teamName];
  if (!tm) return null;
  return {
    name:  teamName,
    color: tm.c || ACCENT,
    short: (tm.s || teamName).toUpperCase(),
  };
}

function confidenceReading(raw) {
  const num = typeof raw === "number"
    ? raw
    : raw === "high" || raw === "confident"
      ? 0.85
      : raw === "medium"
        ? 0.6
        : raw === "low"
          ? 0.35
          : null;
  if (num == null) return null;
  const tier = num >= 0.75 ? "high" : num >= 0.55 ? "medium" : "low";
  const color = tier === "high" ? SUCCESS_TEXT : tier === "medium" ? PRO_AMBER_TEXT : ERROR_TEXT;
  const label = tier === "high" ? "High" : tier === "medium" ? "Medium" : "Low";
  return { value: num, tier, color, label };
}

// ─── Shared primitives ────────────────────────────────────────────────────────


function SourceChip({ source, publishedAt, tone = "cool" }) {
  const color = tone === "accent" ? ACCENT : INFO_SOFT;
  return (
    <span
      title={publishedAt ? absoluteTime(publishedAt) : undefined}
      style={{
        display:       "inline-flex",
        alignItems:    "center",
        gap:           7,
        fontSize:      10,
        fontWeight:    800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color,
      }}
    >
      <span>{source || "Source"}</span>
      {publishedAt && (
        <>
          <span style={{ color: SUBTLE_TEXT, fontWeight: 600 }}>·</span>
          <span style={{ color: SUBTLE_TEXT, fontWeight: 700, letterSpacing: "0.04em", textTransform: "none" }}>
            {relativeTime(publishedAt)}
          </span>
        </>
      )}
    </span>
  );
}

// Some aggregator feeds (Google News especially) return a generic publisher
// favicon as `image_url` when the underlying article has no real imagery.
// Those thumbnails look cheap and off-brand. Reject them so we can fall back
// to a proper editorial surface.
function isUsableArticleImage(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase();
  if (lower.endsWith(".svg")) return false;
  if (/\bfavicon\b/.test(lower)) return false;
  if (/\blogo[._-]/.test(lower)) return false;
  if (lower.includes("news.google.com"))        return false;
  if (lower.includes("gstatic.com"))            return false;
  if (lower.includes("googleusercontent.com")
      && (/newsstand|news.*icon|favicon/.test(lower))) return false;
  if (lower.includes("ssl-images-amazon")
      && /\b[0-9]{2,3}x[0-9]{2,3}\b/.test(lower) === false
      && /icon|logo/.test(lower)) return false;
  return true;
}

// Deterministic tone for the fallback card so the same source always reads
// the same colour across the feed — reinforces the source identity.
function sourceTone(source) {
  const str = String(source || "wire");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  const palette = [
    "#FF6A1A", // ember
    "#9cd1ff", // soft blue
    "#fbbf24", // amber
    "#a3e635", // lime
    "#f472b6", // pink
    "#67e8f9", // cyan
    "#c4b5fd", // violet
  ];
  return palette[Math.abs(hash) % palette.length];
}

// Fallback tile — used when the article has no real image. Instead of a
// placeholder logo, it reads as an editorial source card: the source name
// set large on a tone-keyed gradient, with a subtle Wire wordmark. Keeps
// the media column feeling intentional rather than empty.
function SourceFallback({ source, aspect = "square", size = 72 }) {
  const tone = sourceTone(source);
  const label = (source || "Wire").toUpperCase();
  const initials = label.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("");
  const wide = aspect === "wide";
  const style = wide
    ? { width: "100%", aspectRatio: "16 / 9", borderRadius: RADIUS_MD }
    : { width: size, height: size, borderRadius: RADIUS_MD };
  return (
    <div style={{
      ...style,
      position:   "relative",
      overflow:   "hidden",
      flexShrink: 0,
      // Radial light pool at the top-left, darkening to panel-bg.
      // Slightly tone-keyed so each source has its own colour signature.
      background: `radial-gradient(circle at 28% 22%, ${rgbaFromHex(tone, 0.30)} 0%, ${rgbaFromHex(tone, 0.10)} 38%, rgba(10,18,32,0.96) 100%)`,
      border:     `1px solid ${rgbaFromHex(tone, 0.22)}`,
      display:    "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* Top-rim specular — mirrors the IdentityAvatar language so the
          media column and identity surface read as one system. */}
      <span aria-hidden="true" style={{
        position:      "absolute",
        inset:         0,
        borderRadius:  "inherit",
        boxShadow:     "inset 0 1px 0 rgba(255,255,255,0.12)",
        pointerEvents: "none",
      }} />
      {wide ? (
        <>
          {/* Wide layout keeps a vertical tone rail for editorial identity —
              the rail doesn't conflict with type because the type is left-
              aligned, not centred. */}
          <span aria-hidden="true" style={{
            position: "absolute",
            top:      0,
            left:     0,
            width:    3,
            height:   "100%",
            background: tone,
            opacity:    0.85,
          }} />
          <div style={{
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "flex-start",
            justifyContent: "space-between",
            width:          "100%",
            height:         "100%",
            padding:        "16px 18px",
          }}>
            <span style={{
              fontSize:      9,
              fontWeight:    900,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color:         rgbaFromHex(tone, 0.92),
            }}>
              Wire
            </span>
            <div style={{
              fontSize:      "clamp(22px, 3vw, 32px)",
              fontWeight:    900,
              letterSpacing: "-0.04em",
              lineHeight:    1,
              color:         TEXT_PRIMARY,
              maxWidth:      "14ch",
              textShadow:    "0 1px 2px rgba(6,16,27,0.5)",
            }}>
              {source || "Stint Wire"}
            </div>
          </div>
        </>
      ) : (
        // Square: initials only, engraved on the radial gradient — same
        // typographic finish as the IdentityAvatar so Wire media tiles and
        // user avatars share one material language.
        <span style={{
          fontSize:           Math.round(size * 0.34),
          fontWeight:         900,
          letterSpacing:      "-0.04em",
          color:              "rgba(255,255,255,0.97)",
          fontVariantNumeric: "tabular-nums",
          textShadow:         "0 1px 2px rgba(6,16,27,0.58), 0 -0.5px 0 rgba(255,255,255,0.22)",
        }}>
          {initials || "W"}
        </span>
      )}
    </div>
  );
}

function Thumbnail({ src, size = 72, aspect = "square", source, loading = "lazy", fetchPriority = "auto" }) {
  const [failed, setFailed] = useState(false);
  const usable = isUsableArticleImage(src) && !IS_SNAPSHOT && !failed;
  if (!usable) {
    return <SourceFallback source={source} aspect={aspect} size={size} />;
  }
  const style = aspect === "wide"
    ? { width: "100%", aspectRatio: "16 / 9", borderRadius: RADIUS_MD }
    : { width: size, height: size, borderRadius: RADIUS_MD };
  return (
    <div style={{
      ...style,
      overflow:    "hidden",
      flexShrink:  0,
      background:  PANEL_BG_ALT,
      border:      `1px solid ${HAIRLINE}`,
    }}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        onError={() => setFailed(true)}
        style={{
          width:      "100%",
          height:     "100%",
          objectFit:  "cover",
          objectPosition: "center",
          display:    "block",
        }}
      />
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────
// Home-level hero card. For AI mode the protagonist is the AI's *read* of the
// race (headline + summary + provenance stat strip on a header-insight.png
// editorial backdrop). For Wire mode the protagonist is the race week itself
// (current race + stat strip + search rail on a header-wire.png backdrop).

function HeroStatCell({ label, value, accent, caption, mono }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize:      10,
        fontWeight:    900,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color:         "rgba(255,255,255,0.62)",
        marginBottom:  6,
      }}>{label}</div>
      <div style={{
        fontSize:           mono ? 22 : 19,
        fontWeight:         900,
        letterSpacing:      mono ? "-0.04em" : "-0.025em",
        lineHeight:         1.05,
        color:              accent || "rgba(255,255,255,0.96)",
        fontVariantNumeric: "tabular-nums",
        fontFamily:         mono ? "var(--font-mono)" : "var(--font-display)",
        overflow:           "hidden",
        textOverflow:       "ellipsis",
        whiteSpace:         "nowrap",
      }}>{value || "—"}</div>
      {caption && (
        <div style={{
          fontSize:      11,
          fontWeight:    600,
          color:         "rgba(255,255,255,0.52)",
          marginTop:     4,
          letterSpacing: "-0.005em",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
        }}>{caption}</div>
      )}
    </div>
  );
}

function Hero({ mode, state, currentRace, insight, meta, search, onSearchChange, isMobile, isTablet, loading }) {
  const isAi    = mode === "ai";
  const accent  = isAi ? AI_BLUE_TEXT : ACCENT;
  const image   = isAi ? "/images/header-insight.png" : "/images/header-wire.png";

  // Status dot color
  const stateDot = state === "stale"
    ? PRO_AMBER_DOT
    : state === "empty"
      ? "rgba(148,163,184,0.7)"
      : isAi
        ? accent
        : SUCCESS_TEXT;
  const stateLabel = (() => {
    if (loading) return "Reading race-week context…";
    if (isAi) {
      if (state === "stale" && currentRace) return `Saved brief is out of date for ${currentRace.n}`;
      if (state === "empty")                 return "Awaiting this round's read";
      return "Live brief";
    }
    return meta?.lastUpdated ? `Updated ${relativeTime(meta.lastUpdated)}` : "Awaiting first ingest";
  })();

  // Hero title + lede are mode-dependent
  let kicker, title, lede;
  if (isAi) {
    const raceName = insight?.race_name || currentRace?.n;
    kicker = raceName
      ? `AI Brief · Vol 2026 / № ${String(currentRace?.r || insight?.metadata?.round || 0).padStart(2, "0")} · ${raceName}`
      : "AI Brief · This week's read";
    title = insight?.headline || (currentRace?.n ? `${currentRace.n} — the read` : "This week's brief");
    lede  = insight?.summary
      || (state === "stale"
        ? "The saved AI read does not match the upcoming round. An admin can regenerate it from the Admin page."
        : "Stint AI publishes one read per race week. Check back after qualifying — or open the Wire for the latest stories.");
  } else {
    kicker = currentRace?.n
      ? `F1 Wire · Race week · ${currentRace.n}`
      : "F1 Wire · Live feed";
    title = loading
      ? "Reading the wire…"
      : meta?.articles
        ? `${meta.articles} ${meta.articles === 1 ? "story" : "stories"} on the table.`
        : "The wire is quiet right now.";
    lede = "A single live race-week feed — every publisher we trust, time-grouped, with the sources that actually move picks.";
  }

  // Stat strip cells
  const aiConf = confidenceReading(insight?.confidence);
  const stats = isAi
    ? [
        { label: "Generated", value: insight?.generated_at ? relativeTime(insight.generated_at) : "—", caption: insight?.generated_at ? absoluteTime(insight.generated_at) : null, mono: true },
        { label: "Confidence", value: aiConf?.label || "—", accent: aiConf?.color, caption: aiConf ? `${Math.round(aiConf.value * 100)}%` : null },
      ]
    : [
        { label: "Stories", value: meta?.articles ? String(meta.articles) : "—", caption: "On the wire", mono: true },
        { label: "Sources", value: meta?.sources ? String(meta.sources) : "—", caption: "Publishers feeding", mono: true },
        { label: "Updated", value: meta?.lastUpdated ? relativeTime(meta.lastUpdated) : "—", caption: meta?.lastUpdated ? absoluteTime(meta.lastUpdated) : null, mono: true },
        { label: "Round", value: currentRace?.r ? `№ ${String(currentRace.r).padStart(2, "0")}` : "—", caption: currentRace?.n || null, mono: true },
      ];

  return (
    <section
      className="f1-stagger-strong"
      style={{
        position:     "relative",
        overflow:     "hidden",
        borderRadius: SECTION_RADIUS,
        border:       PANEL_BORDER,
        background:   `
          linear-gradient(140deg, ${rgbaFromHex(accent, isAi ? 0.30 : 0.34)} 0%, ${rgbaFromHex(accent, 0.10)} 40%, rgba(6,16,27,0.94) 100%),
          url("${image}") center / cover no-repeat,
          ${PANEL_BG}
        `,
        boxShadow:    LIFTED_SHADOW,
        marginBottom: isMobile ? 22 : 32,
        minHeight:    isMobile ? 0 : isTablet ? 360 : 420,
        padding:      isMobile ? "20px 18px 22px" : isTablet ? "28px 28px 28px" : "34px 36px 36px",
        viewTransitionName: "news-masthead",
      }}
    >
      {/* Top accent rail */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${accent} 30%, ${accent} 70%, transparent)`,
          opacity: 0.92,
        }}
      />

      {/* Row 1: kicker + status pill */}
      <div style={{
        "--f1-i": 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.78)", flexWrap: "wrap" }}>
          <span aria-hidden="true" style={{
            width: 6, height: 6, borderRadius: "50%", background: accent,
            boxShadow: `0 0 0 4px ${rgbaFromHex(accent, 0.20)}`,
          }} />
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.82)",
          }}>{kicker}</span>
        </div>
        <span style={{
          display:       "inline-flex",
          alignItems:    "center",
          gap:           7,
          padding:       "5px 10px 5px 8px",
          borderRadius:  RADIUS_PILL,
          background:    "rgba(6,16,27,0.42)",
          border:        `1px solid ${rgbaFromHex(accent, 0.22)}`,
          fontSize:      10,
          fontWeight:    800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color:         "rgba(255,255,255,0.84)",
          flexShrink:    0,
        }}>
          <span
            aria-hidden="true"
            className={!isAi && state === "ready" ? "nw-lead-dot" : undefined}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: stateDot,
              flexShrink: 0,
            }}
          />
          {stateLabel}
        </span>
      </div>

      {/* Row 2: BIG title */}
      <div style={{ "--f1-i": 1, marginTop: isMobile ? 18 : 26 }}>
        <h1
          className="stint-page-title"
          style={{
            margin: 0,
            fontSize:      isMobile ? 30 : isTablet ? 44 : 56,
            letterSpacing: "-0.045em",
            lineHeight:    isAi ? 1.02 : 1,
            color:         "rgba(255,255,255,0.98)",
            textShadow:    "0 2px 18px rgba(0,0,0,0.32)",
            maxWidth:      isAi ? "22ch" : "20ch",
          }}
        >
          {title}
        </h1>
      </div>

      {/* Row 3: lede */}
      <p style={{
        "--f1-i": 2,
        margin:     isMobile ? "12px 0 0" : "16px 0 0",
        fontSize:   isMobile ? 14 : 16,
        fontWeight: 500,
        lineHeight: 1.65,
        color:      "rgba(255,255,255,0.78)",
        letterSpacing: "-0.005em",
        maxWidth:   "62ch",
      }}>
        {lede}
      </p>

      {/* Row 4: stat strip */}
      <div style={{
        "--f1-i": 3,
        marginTop:     isMobile ? 18 : 26,
        paddingTop:    isMobile ? 16 : 22,
        borderTop:     "1px solid rgba(255,255,255,0.10)",
        display:       "grid",
        gridTemplateColumns: isMobile
          ? (stats.length <= 2 ? "1fr 1fr" : "1fr 1fr")
          : `repeat(${stats.length}, minmax(0, 1fr))`,
        gap:           isMobile ? "16px 18px" : "0 22px",
      }}>
        {stats.map((s) => (
          <HeroStatCell
            key={s.label}
            label={s.label}
            value={s.value}
            caption={s.caption}
            accent={s.accent}
            mono={s.mono}
          />
        ))}
      </div>

      {/* Row 5: search (Wire only) */}
      {!isAi && (
        <div style={{
          "--f1-i": 4,
          marginTop:     isMobile ? 18 : 22,
          display:       "flex",
          alignItems:    "center",
          gap:           12,
          flexWrap:      "wrap",
        }}>
          <input
            type="search"
            placeholder="Search the wire…"
            value={search || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="nw-search"
            style={{
              background:    "rgba(6,16,27,0.50)",
              border:        `1px solid ${rgbaFromHex(ACCENT, 0.28)}`,
              borderRadius:  RADIUS_PILL,
              color:         "rgba(255,255,255,0.96)",
              padding:       isMobile ? "10px 16px" : "10px 18px",
              fontSize:      isMobile ? 13 : 13,
              outline:       "none",
              width:         isMobile ? "100%" : 300,
              fontFamily:    "inherit",
              letterSpacing: "-0.005em",
            }}
          />
        </div>
      )}
    </section>
  );
}

// ─── AI Insight ────────────────────────────────────────────────────────────
// The Hero absorbs "The Read" — headline + summary + provenance render as the
// hero card itself. The rest of the page is: The Calls → Angles + Signals
// → Watch → Cross-link.

function DriverPortrait({ ctx, size = 56 }) {
  if (!ctx) return null;
  return (
    <div
      style={{
        width:          size,
        height:         size,
        borderRadius:   size / 2,
        background:     `linear-gradient(160deg, ${rgbaFromHex(ctx.color, 0.96)} 0%, ${rgbaFromHex(ctx.color, 0.62)} 72%, rgba(6,16,27,0.92) 100%)`,
        border:         `1px solid ${rgbaFromHex(ctx.color, 0.52)}`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        color:          "rgba(255,255,255,0.96)",
        fontSize:       Math.round(size * 0.32),
        fontWeight:     900,
        letterSpacing:  "-0.03em",
        fontVariantNumeric: "tabular-nums",
        flexShrink:     0,
        boxShadow:      `0 6px 18px ${rgbaFromHex(ctx.color, 0.22)}`,
      }}
      aria-label={ctx.name}
    >
      {ctx.abbr || ctx.initials}
    </div>
  );
}

function ConstructorBlock({ ctx, size = 56 }) {
  if (!ctx) return null;
  return (
    <div
      style={{
        width:          size,
        height:         size,
        borderRadius:   12,
        background:     `linear-gradient(160deg, ${rgbaFromHex(ctx.color, 0.96)} 0%, ${rgbaFromHex(ctx.color, 0.5)} 80%, rgba(6,16,27,0.92) 100%)`,
        border:         `1px solid ${rgbaFromHex(ctx.color, 0.52)}`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        color:          "rgba(255,255,255,0.96)",
        fontSize:       Math.round(size * 0.26),
        fontWeight:     900,
        letterSpacing:  "-0.02em",
        flexShrink:     0,
        boxShadow:      `0 6px 18px ${rgbaFromHex(ctx.color, 0.22)}`,
      }}
      aria-label={ctx.name}
    >
      {ctx.short}
    </div>
  );
}

function BinaryGlyph({ value, size = 56 }) {
  const isYes = value === "Yes";
  const tone  = isYes ? SUCCESS : DANGER;
  return (
    <div
      style={{
        width:          size,
        height:         size,
        borderRadius:   12,
        background:     `linear-gradient(160deg, ${rgbaFromHex(tone, 0.7)} 0%, rgba(6,16,27,0.92) 90%)`,
        border:         `1px solid ${rgbaFromHex(tone, 0.5)}`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        color:          "#fff",
        fontSize:       Math.round(size * 0.34),
        fontWeight:     900,
        letterSpacing:  "-0.02em",
        flexShrink:     0,
      }}
      aria-label={value}
    >
      {value}
    </div>
  );
}

function PickVisual({ item, size = 56 }) {
  if (item.type === "driver") {
    const ctx = driverContext(item.pick);
    if (ctx) return <DriverPortrait ctx={ctx} size={size} />;
  }
  if (item.type === "constructor") {
    const ctx = constructorContext(item.pick);
    if (ctx) return <ConstructorBlock ctx={ctx} size={size} />;
  }
  if (item.type === "binary") {
    return <BinaryGlyph value={item.pick} size={size} />;
  }
  // Fallback: unknown pick — render the pick text initial
  const initial = String(item.pick || "?").slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        width:          size,
        height:         size,
        borderRadius:   12,
        background:     PANEL_BG_ALT,
        border:         `1px solid ${HAIRLINE}`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        color:          MUTED_TEXT,
        fontSize:       Math.round(size * 0.28),
        fontWeight:     900,
        flexShrink:     0,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

function ConfidenceDial({ conf }) {
  if (!conf) return null;
  const filled = conf.tier === "high" ? 3 : conf.tier === "medium" ? 2 : 1;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
      <span style={{ display: "inline-flex", gap: 2 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="nw-dial-seg"
            aria-hidden="true"
            style={{
              width:        10,
              height:       3,
              borderRadius: 1,
              background:   i < filled ? conf.color : "rgba(148,163,184,0.20)",
            }}
          />
        ))}
      </span>
      <span style={{
        fontSize:      10,
        fontWeight:    700,
        color:         conf.color,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}>{conf.label}</span>
    </span>
  );
}

function PrimaryPickCard({ item, isMobile }) {
  const conf = confidenceReading(item.confidence);
  const categoryLabel = CATEGORY_LABELS[item.key] || item.category || item.key;

  // Team / driver color leaks into the card backdrop so each pick reads with
  // its own identity. Falls back to AI_BLUE_TEXT when no driver/constructor
  // context resolves (binary / unknown picks).
  let pickColor = AI_BLUE_TEXT;
  if (item.type === "driver") {
    const ctx = driverContext(item.pick);
    if (ctx) pickColor = ctx.color;
  } else if (item.type === "constructor") {
    const ctx = constructorContext(item.pick);
    if (ctx) pickColor = ctx.color;
  } else if (item.type === "binary") {
    pickColor = item.pick === "Yes" ? SUCCESS_TEXT : ERROR_TEXT;
  }

  return (
    <div
      className="nw-primary-pick f1-hoverable"
      style={{
        position:      "relative",
        overflow:      "hidden",
        display:       "grid",
        gridTemplateColumns: isMobile ? "auto 1fr" : "auto 1fr",
        alignItems:    "center",
        gap:           isMobile ? 14 : 18,
        padding:       isMobile ? "18px 16px" : "22px 22px",
        borderRadius:  CARD_RADIUS,
        border:        `1px solid ${rgbaFromHex(pickColor, 0.22)}`,
        background:    `linear-gradient(135deg, ${rgbaFromHex(pickColor, 0.16)} 0%, ${rgbaFromHex(pickColor, 0.04)} 55%, ${PANEL_BG_ALT} 100%)`,
        boxShadow:     CARD_SHADOW,
        minWidth:      0,
      }}
    >
      {/* Left tone rail */}
      <span aria-hidden="true" style={{
        position:   "absolute",
        top:        0,
        bottom:     0,
        left:       0,
        width:      3,
        background: pickColor,
        opacity:    0.78,
      }} />

      <PickVisual item={item} size={isMobile ? 56 : 68} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            10,
          marginBottom:   6,
        }}>
          <span style={{
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color:         rgbaFromHex(pickColor, 0.92),
          }}>{categoryLabel}</span>
          <ConfidenceDial conf={conf} />
        </div>
        <div className="stint-card-title" style={{
          fontSize:       isMobile ? 22 : 26,
          fontWeight:     900,
          letterSpacing:  "-0.035em",
          color:          TEXT_PRIMARY,
          lineHeight:     1.05,
          marginBottom:   item.reason ? 8 : 0,
          overflow:       "hidden",
          textOverflow:   "ellipsis",
          whiteSpace:     "nowrap",
        }}>{item.pick}</div>
        {item.reason && (
          <div style={{
            fontSize:   12.5,
            lineHeight: 1.6,
            color:      MUTED_TEXT,
            display:    "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow:   "hidden",
          }}>{item.reason}</div>
        )}
      </div>
    </div>
  );
}

function SecondaryPickRow({ item, isMobile }) {
  const conf = confidenceReading(item.confidence);
  const categoryLabel = CATEGORY_LABELS[item.key] || item.category || item.key;
  return (
    <div
      className="nw-secondary-pick"
      style={{
        display:        "grid",
        gridTemplateColumns: isMobile ? "minmax(0,1fr) auto" : "120px minmax(0,1fr) auto",
        alignItems:     "center",
        gap:            isMobile ? 10 : 16,
        padding:        isMobile ? "10px 2px" : "11px 4px",
        borderBottom:   `1px solid ${HAIRLINE}`,
      }}
    >
      {!isMobile && (
        <span style={{
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color:         SUBTLE_TEXT,
        }}>{categoryLabel}</span>
      )}
      <div style={{ minWidth: 0 }}>
        {isMobile && (
          <div style={{
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color:         SUBTLE_TEXT,
            marginBottom:  3,
          }}>{categoryLabel}</div>
        )}
        <div style={{
          fontSize:       isMobile ? 14 : 15,
          fontWeight:     800,
          color:          TEXT_PRIMARY,
          letterSpacing:  "-0.015em",
          overflow:       "hidden",
          textOverflow:   "ellipsis",
          whiteSpace:     "nowrap",
        }}>{item.pick}</div>
      </div>
      {conf && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: conf.color }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: conf.color, letterSpacing: "-0.005em" }}>{conf.label}</span>
        </span>
      )}
    </div>
  );
}

function TheCalls({ aiPredictions, isPro, isMobile, currentRace }) {
  if (!aiPredictions.length) return null;

  const primary   = aiPredictions.filter((p) => PRIMARY_CATEGORY.has(p.key));
  const secondary = aiPredictions.filter((p) => !PRIMARY_CATEGORY.has(p.key));

  const picksHref = "/?page=predictions";
  const ctaLabel  = currentRace?.n ? `Take these to ${currentRace.n} picks` : "Take these to your picks";

  if (!isPro) {
    // Free view — blur the card grid, overlay one honest upgrade moment.
    return (
      <section className="nw-calls" style={{ marginBottom: isMobile ? 32 : 44 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
          <SectionLabel color={INFO_SOFT} rule>The Calls</SectionLabel>
          <ProBadge size="sm" title="Pro insight" />
        </div>
        <div style={{ position: "relative", borderRadius: CARD_RADIUS, overflow: "hidden", border: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
          <div style={{
            display:             "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap:                 1,
            background:          HAIRLINE,
            filter:              "blur(6px)",
            pointerEvents:       "none",
            userSelect:          "none",
          }}>
            {aiPredictions.slice(0, 4).map((item, idx) => (
              <div key={idx} style={{ background: PANEL_BG_ALT, padding: 18 }}>
                <PrimaryPickCard item={{ ...item, pick: "·········", reason: "Pro insight available." }} isMobile={isMobile} />
              </div>
            ))}
          </div>
          <div style={{
            position:        "absolute",
            inset:           0,
            display:         "flex",
            flexDirection:   "column",
            alignItems:      "center",
            justifyContent:  "center",
            gap:             14,
            padding:         "36px 20px",
            background:      "linear-gradient(180deg, rgba(10,16,27,0.50) 0%, rgba(10,16,27,0.92) 62%, rgba(10,16,27,0.98) 100%)",
            textAlign:       "center",
          }}>
            <div style={{
              fontSize:      isMobile ? 17 : 19,
              fontWeight:    900,
              letterSpacing: "-0.03em",
              color:         TEXT_PRIMARY,
              maxWidth:      "28ch",
            }}>
              {aiPredictions.length} category calls + weekend angles
            </div>
            <div style={{ fontSize: 13, color: MUTED_TEXT, maxWidth: "32ch", lineHeight: 1.6 }}>
              Stint Pro unlocks every category pick, the reasoning behind it, and the race-week angles the AI is watching.
            </div>
            <a
              href="/?page=pro"
              className="nw-calls-cta"
              style={{
                display:        "inline-flex",
                alignItems:     "center",
                gap:            8,
                background: "var(--brand)",
                color:          "#fff",
                fontSize:       13,
                fontWeight:     900,
                letterSpacing:  "-0.005em",
                padding:        "10px 22px",
                borderRadius:   RADIUS_PILL,
                textDecoration: "none",
                boxShadow:      `0 6px 18px ${rgbaFromHex(ACCENT, 0.30)}`,
              }}
            >
              <span>Unlock Stint Pro</span>
              <span className="nw-cta-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="nw-calls f1-stagger-strong" style={{ marginBottom: isMobile ? 36 : 52 }}>
      <header style={{
        "--f1-i": 0,
        display:        "flex",
        alignItems:     "baseline",
        justifyContent: "space-between",
        gap:            12,
        marginBottom:   isMobile ? 18 : 24,
        flexWrap:       "wrap",
      }}>
        <div>
          <SectionLabel color={INFO_SOFT} rule style={{ marginBottom: 8 }}>The Calls</SectionLabel>
          <h2 className="stint-section-title" style={{
            margin: 0,
            fontSize:      isMobile ? 22 : 28,
            letterSpacing: "-0.035em",
            lineHeight:    1.12,
          }}>
            {currentRace?.n ? `${currentRace.n} category picks` : "Race-week category picks"}
          </h2>
        </div>
        <span style={{
          fontSize:      11,
          fontWeight:    700,
          color:         SUBTLE_TEXT,
          letterSpacing: "-0.005em",
          fontVariantNumeric: "tabular-nums",
        }}>
          {primary.length} primary · {secondary.length} supporting
        </span>
      </header>

      {primary.length > 0 && (
        <div style={{
          "--f1-i": 1,
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap:                 isMobile ? 12 : 14,
          marginBottom:        secondary.length ? 22 : 26,
        }}>
          {primary.map((item) => (
            <PrimaryPickCard key={item.key || item.category} item={item} isMobile={isMobile} />
          ))}
        </div>
      )}

      {secondary.length > 0 && (
        <div style={{
          "--f1-i": 2,
          borderRadius: CARD_RADIUS,
          border:       `1px solid ${HAIRLINE}`,
          background:   PANEL_BG,
          padding:      isMobile ? "6px 16px 4px" : "8px 22px 6px",
          marginBottom: 24,
        }}>
          <div style={{
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color:         AI_BLUE_TEXT,
            padding:       "10px 0 4px",
            borderBottom:  `1px solid ${HAIRLINE}`,
            marginBottom:  2,
          }}>
            Supporting calls
          </div>
          {secondary.map((item, idx) => (
            <SecondaryPickRow
              key={item.key || item.category || idx}
              item={item}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      <a
        href={picksHref}
        className="nw-calls-cta"
        style={{
          "--f1-i": 3,
          display:        "inline-flex",
          alignItems:     "center",
          gap:            10,
          background: "var(--brand)",
          color:          "#fff",
          fontSize:       14,
          fontWeight:     900,
          letterSpacing:  "-0.005em",
          padding:        isMobile ? "13px 22px" : "14px 26px",
          borderRadius:   RADIUS_PILL,
          textDecoration: "none",
          boxShadow:      `0 8px 24px ${rgbaFromHex(ACCENT, 0.32)}`,
        }}
      >
        <span>{ctaLabel}</span>
        <span className="nw-cta-arrow" aria-hidden="true">→</span>
      </a>
    </section>
  );
}

function AngleCard({ item, index, isMobile }) {
  const toneColor = item.impact === "positive"
    ? SUCCESS_TEXT
    : item.impact === "negative"
      ? ERROR_TEXT
      : INFO_SOFT;
  const toneLabel = item.impact === "positive"
    ? "Opportunity"
    : item.impact === "negative"
      ? "Risk"
      : "Context";

  const ordinal = String(index + 1).padStart(2, "0");
  const fantasyNote = item.fantasy_take && item.fantasy_take !== item.detail ? item.fantasy_take : null;
  const whyNote     = !fantasyNote && item.why_it_matters && item.why_it_matters !== item.detail ? item.why_it_matters : null;
  const closingNote = fantasyNote || whyNote;

  return (
    <article
      className="nw-angles-item f1-hoverable"
      style={{
        position:     "relative",
        overflow:     "hidden",
        padding:      isMobile ? "20px 18px" : "24px 26px",
        marginBottom: 12,
        borderRadius: CARD_RADIUS,
        border:       `1px solid ${rgbaFromHex(toneColor, 0.22)}`,
        background:   `linear-gradient(135deg, ${rgbaFromHex(toneColor, 0.10)} 0%, ${rgbaFromHex(toneColor, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
        boxShadow:    CARD_SHADOW,
      }}
    >
      {/* Tone rail */}
      <span aria-hidden="true" style={{
        position:   "absolute",
        top:        0,
        bottom:     0,
        left:       0,
        width:      3,
        background: toneColor,
        opacity:    0.85,
      }} />

      <div style={{
        display:       "flex",
        alignItems:    "center",
        justifyContent: "space-between",
        gap:           10,
        marginBottom:  12,
        fontVariantNumeric: "tabular-nums",
        flexWrap:      "wrap",
      }}>
        <span style={{
          display:       "inline-flex",
          alignItems:    "baseline",
          gap:           6,
        }}>
          <span style={{
            fontSize:      11,
            fontWeight:    900,
            letterSpacing: "-0.02em",
            color:         "rgba(148,163,184,0.46)",
            fontFamily:    "var(--font-mono)",
          }}>{ordinal}</span>
          <span style={{
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color:         SUBTLE_TEXT,
          }}>Angle</span>
        </span>
        <span style={{
          display:       "inline-flex",
          alignItems:    "center",
          gap:           6,
          padding:       "4px 9px",
          borderRadius:  RADIUS_PILL,
          background:    rgbaFromHex(toneColor, 0.12),
          border:        `1px solid ${rgbaFromHex(toneColor, 0.28)}`,
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color:         toneColor,
        }}>
          <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: toneColor }} />
          {toneLabel}
        </span>
      </div>
      <h3 className="stint-card-title" style={{
        margin:        "0 0 10px",
        fontSize:      isMobile ? 19 : 22,
        letterSpacing: "-0.028em",
        lineHeight:    1.18,
      }}>
        {item.title}
      </h3>
      {item.detail && (
        <p style={{
          margin:     closingNote ? "0 0 12px" : 0,
          fontSize:   14.5,
          lineHeight: 1.68,
          color:      "rgba(226,232,240,0.86)",
          maxWidth:   "62ch",
        }}>{item.detail}</p>
      )}
      {closingNote && (
        <div style={{
          fontSize:     12.5,
          lineHeight:   1.65,
          color:        MUTED_TEXT,
          maxWidth:     "62ch",
          paddingTop:   10,
          borderTop:    `1px solid ${rgbaFromHex(toneColor, 0.14)}`,
        }}>
          <span style={{
            color:         toneColor,
            fontWeight:    900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize:      10,
            marginRight:   6,
          }}>For your picks</span>
          {closingNote}
        </div>
      )}
    </article>
  );
}

function Signal({ label, value, accent = TEXT_PRIMARY, caption }) {
  return (
    <div
      className="nw-signal-row f1-hoverable"
      style={{
        padding:      "14px 16px",
        borderRadius: RADIUS_MD,
        border:       `1px solid ${HAIRLINE}`,
        background:   PANEL_BG_ALT,
        minWidth:     0,
      }}
    >
      <div style={{
        fontSize:      10,
        fontWeight:    900,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color:         SUBTLE_TEXT,
        marginBottom:  6,
      }}>{label}</div>
      <div style={{
        fontSize:           18,
        fontWeight:         900,
        letterSpacing:      "-0.025em",
        color:              accent,
        fontVariantNumeric: "tabular-nums",
        fontFamily:         "var(--font-display)",
        lineHeight:         1.08,
        overflow:           "hidden",
        textOverflow:       "ellipsis",
        whiteSpace:         "nowrap",
      }}>{value || "—"}</div>
      {caption && (
        <div style={{
          fontSize:      11,
          fontWeight:    600,
          color:         SUBTLE_TEXT,
          marginTop:     4,
          letterSpacing: "-0.005em",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
        }}>{caption}</div>
      )}
    </div>
  );
}

function TheAnglesAndSignals({ keyFactors, previousRace, historicalForm, seasonVolatility, crowdFavorite, isMobile, isTablet }) {
  const angles = (keyFactors || []).slice(0, 3);
  const recentDriver = historicalForm?.last_5_driver_form?.[0] || null;
  const recentConstructor = historicalForm?.last_5_constructor_form?.[0] || null;

  const showAngles  = angles.length > 0;
  const showSignals = previousRace?.winner || recentDriver || recentConstructor || seasonVolatility?.safety_car_rate != null || crowdFavorite;

  if (!showAngles && !showSignals) return null;

  return (
    <section className="nw-angles" style={{
      display:             "grid",
      gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0, 1.55fr) minmax(220px, 0.9fr)",
      gap:                 isMobile || isTablet ? 32 : 48,
      marginBottom:        isMobile ? 36 : 52,
    }}>
      {showAngles && (
        <div>
          <header style={{ marginBottom: isMobile ? 16 : 22 }}>
            <SectionLabel color={INFO_SOFT} rule style={{ marginBottom: 8 }}>The Angles</SectionLabel>
            <h2 className="stint-section-title" style={{
              margin: 0,
              fontSize:      isMobile ? 22 : 28,
              letterSpacing: "-0.035em",
              lineHeight:    1.12,
            }}>
              Storylines worth a long look
            </h2>
          </header>
          <div>
            {angles.map((angle, idx) => (
              <AngleCard key={angle.title || idx} item={angle} index={idx} isMobile={isMobile} />
            ))}
          </div>
        </div>
      )}

      {showSignals && (
        <aside style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <header style={{ marginBottom: 6 }}>
            <SectionLabel color={INFO_SOFT} rule style={{ marginBottom: 8 }}>The Signals</SectionLabel>
            <h3 className="stint-section-title" style={{
              margin: 0,
              fontSize:      isMobile ? 18 : 22,
              letterSpacing: "-0.03em",
              lineHeight:    1.16,
            }}>
              Data the model is leaning on
            </h3>
          </header>
          {previousRace?.winner && (
            <Signal
              label="Last winner"
              value={previousRace.winner}
              accent={TEXT_PRIMARY}
              caption={previousRace.race_name || previousRace.name}
            />
          )}
          {recentDriver && (
            <Signal
              label="Hot form"
              value={recentDriver.driver}
              accent={ACCENT}
              caption={recentDriver.summary || `Last 5 races`}
            />
          )}
          {recentConstructor && (
            <Signal
              label="Hot constructor"
              value={recentConstructor.team}
              accent="#2dd4bf"
              caption={recentConstructor.summary || "Last 5 races"}
            />
          )}
          {seasonVolatility?.safety_car_rate != null && (
            <Signal
              label="Safety car rate"
              value={`${Math.round(seasonVolatility.safety_car_rate * 100)}%`}
              accent={PRO_AMBER_TEXT}
              caption="Season to date"
            />
          )}
          {crowdFavorite?.name && (
            <Signal
              label="Crowd favourite"
              value={crowdFavorite.name}
              accent="#d8b4fe"
              caption={crowdFavorite.category || "Fantasy market"}
            />
          )}
        </aside>
      )}
    </section>
  );
}

function WatchBeforeLock({ watchlist, isMobile }) {
  const items = (watchlist || []).slice(0, 4);
  if (!items.length) return null;
  return (
    <section className="nw-watch" style={{ marginBottom: isMobile ? 36 : 52 }}>
      <header style={{ marginBottom: isMobile ? 16 : 22 }}>
        <SectionLabel color={INFO_SOFT} rule style={{ marginBottom: 8 }}>Watch before lock</SectionLabel>
        <h2 className="stint-section-title" style={{
          margin: 0,
          fontSize:      isMobile ? 22 : 28,
          letterSpacing: "-0.035em",
          lineHeight:    1.12,
        }}>
          The triggers that change the call
        </h2>
      </header>
      <div style={{
        display:             "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap:                 isMobile ? 12 : 14,
      }}>
        {items.map((item, idx) => (
          <article
            key={item.label || idx}
            className="f1-hoverable"
            style={{
              position:     "relative",
              overflow:     "hidden",
              borderRadius: CARD_RADIUS,
              border:       `1px solid ${rgbaFromHex(AI_BLUE_TEXT, 0.18)}`,
              background:   `linear-gradient(135deg, ${rgbaFromHex(AI_BLUE_TEXT, 0.08)} 0%, ${rgbaFromHex(AI_BLUE_TEXT, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
              padding:      isMobile ? "18px 18px" : "22px 22px",
              boxShadow:    CARD_SHADOW,
            }}
          >
            <span aria-hidden="true" style={{
              position:   "absolute",
              top:        0,
              bottom:     0,
              left:       0,
              width:      3,
              background: AI_BLUE_TEXT,
              opacity:    0.7,
            }} />
            <div style={{
              fontSize:      10,
              fontWeight:    900,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color:         AI_BLUE_TEXT,
              marginBottom:  6,
              fontFamily:    "var(--font-mono)",
            }}>Trigger {String(idx + 1).padStart(2, "0")}</div>
            <h3 className="stint-card-title" style={{
              margin:        "0 0 10px",
              fontSize:      isMobile ? 17 : 19,
              letterSpacing: "-0.028em",
              lineHeight:    1.18,
            }}>{item.label}</h3>
            {(item.trigger || item.reason) && (
              <div style={{
                fontSize:   13.5,
                lineHeight: 1.62,
                color:      "rgba(226,232,240,0.84)",
                marginBottom: item.how_to_react ? 12 : 0,
              }}>{previewText(item.trigger || item.reason, 180)}</div>
            )}
            {item.how_to_react && (
              <div style={{
                paddingTop:    10,
                borderTop:     `1px solid ${rgbaFromHex(AI_BLUE_TEXT, 0.16)}`,
                fontSize:      12.5,
                fontWeight:    600,
                color:         MUTED_TEXT,
                lineHeight:    1.6,
              }}>
                <span style={{
                  color:         AI_BLUE_TEXT,
                  fontWeight:    900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontSize:      10,
                  marginRight:   6,
                }}>How to react</span>
                {previewText(item.how_to_react, 150)}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

// ─── Wire ────────────────────────────────────────────────────────────────────
// Fast, kinetic, one-column. Lead story is a real hero card above the
// time-grouped feed; everything else flows as image-thumbnail rows with
// stronger dividers between time groups.

const TopStoryRow = memo(function TopStoryRow({ article, isMobile }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="nw-feed-row nw-feed-row--top f1-hoverable"
      style={{
        position:        "relative",
        overflow:        "hidden",
        display:         "grid",
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(280px, 340px)",
        gap:             isMobile ? 16 : 32,
        padding:         isMobile ? "22px 18px" : "26px 28px",
        marginBottom:    isMobile ? 18 : 24,
        textDecoration:  "none",
        color:           "inherit",
        borderRadius:    CARD_RADIUS,
        border:          `1px solid ${rgbaFromHex(ACCENT, 0.28)}`,
        background:      `linear-gradient(135deg, ${rgbaFromHex(ACCENT, 0.14)} 0%, ${rgbaFromHex(ACCENT, 0.03)} 50%, ${PANEL_BG_ALT} 100%)`,
        boxShadow:       CARD_SHADOW,
        alignItems:      "center",
      }}
    >
      {/* Tone rail */}
      <span aria-hidden="true" style={{
        position:   "absolute",
        top:        0,
        bottom:     0,
        left:       0,
        width:      3,
        background: ACCENT,
        opacity:    0.85,
      }} />

      <div style={{ minWidth: 0 }}>
        <div style={{
          marginBottom:   14,
          display:        "inline-flex",
          alignItems:     "center",
          gap:            10,
          flexWrap:       "wrap",
        }}>
          <span style={{
            display:       "inline-flex",
            alignItems:    "center",
            gap:           7,
            padding:       "5px 10px",
            borderRadius:  RADIUS_PILL,
            background:    rgbaFromHex(ACCENT, 0.14),
            border:        `1px solid ${rgbaFromHex(ACCENT, 0.30)}`,
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color:         ACCENT,
          }}>
            <span
              className="nw-lead-dot"
              aria-hidden="true"
              style={{
                display:      "inline-block",
                width:        6,
                height:       6,
                borderRadius: "50%",
                background:   ACCENT,
              }}
            />
            Lead story
          </span>
          <SourceChip source={article.source} publishedAt={article.published_at} tone="accent" />
        </div>
        <h2 className="stint-section-title" style={{
          margin:        "0 0 14px",
          fontSize:      isMobile ? 24 : 32,
          letterSpacing: "-0.04em",
          lineHeight:    1.06,
          maxWidth:      "22ch",
        }}>{article.title}</h2>
        {article.summary && (
          <p style={{
            margin:     0,
            fontSize:   14.5,
            lineHeight: 1.68,
            color:      "rgba(226,232,240,0.82)",
            display:    "-webkit-box",
            WebkitLineClamp: isMobile ? 3 : 3,
            WebkitBoxOrient: "vertical",
            overflow:   "hidden",
            maxWidth:   "60ch",
          }}>{article.summary}</p>
        )}
      </div>
      <Thumbnail src={article.image_url} aspect="wide" source={article.source} loading="eager" fetchPriority="high" />
    </a>
  );
});

const FeedRow = memo(function FeedRow({ article, isMobile }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="nw-feed-row"
      style={{
        display:         "grid",
        gridTemplateColumns: isMobile
          ? "minmax(0, 1fr) 72px"
          : "minmax(0, 1fr) 104px",
        gap:             isMobile ? 14 : 22,
        padding:         isMobile ? "16px 6px" : "18px 6px",
        textDecoration:  "none",
        color:           "inherit",
        borderTop:       `1px solid ${HAIRLINE}`,
        alignItems:      "center",
        borderRadius:    8,
        contentVisibility: "auto",
        containIntrinsicSize: isMobile ? "130px" : "142px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 7 }}>
          <SourceChip source={article.source} publishedAt={article.published_at} tone="cool" />
        </div>
        <h3 className="stint-card-title" style={{
          margin:        "0 0 5px",
          fontSize:      isMobile ? 15.5 : 17,
          letterSpacing: "-0.022em",
          lineHeight:    1.24,
        }}>{article.title}</h3>
        {article.summary && (
          <p style={{
            margin:     0,
            fontSize:   12.5,
            lineHeight: 1.6,
            color:      MUTED_TEXT,
            display:    "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow:   "hidden",
            maxWidth:   "70ch",
          }}>{article.summary}</p>
        )}
      </div>
      <Thumbnail src={article.image_url} size={isMobile ? 72 : 104} aspect="square" source={article.source} />
    </a>
  );
});

const TimeGroupDivider = memo(function TimeGroupDivider({ label, date, count, first = false }) {
  return (
    <div style={{
      display:       "flex",
      alignItems:    "center",
      gap:           12,
      padding:       first ? "8px 6px 14px" : "30px 6px 14px",
    }}>
      <span aria-hidden="true" style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: ACCENT,
        boxShadow: `0 0 0 4px ${rgbaFromHex(ACCENT, 0.16)}`,
        flexShrink: 0,
      }} />
      <span style={{
        fontSize:      13,
        fontWeight:    900,
        letterSpacing: "-0.025em",
        color:         TEXT_PRIMARY,
        fontFamily:    "var(--font-display)",
      }}>{label}</span>
      {date && (
        <span style={{
          fontSize:           10,
          fontWeight:         800,
          letterSpacing:      "0.12em",
          textTransform:      "uppercase",
          color:              SUBTLE_TEXT,
          fontVariantNumeric: "tabular-nums",
        }}>{date}</span>
      )}
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: HAIRLINE }} />
      {typeof count === "number" && (
        <span style={{
          fontSize:           10,
          fontWeight:         900,
          letterSpacing:      "0.06em",
          color:              SUBTLE_TEXT,
          fontVariantNumeric: "tabular-nums",
          padding:            "3px 8px",
          borderRadius:       RADIUS_PILL,
          background:         "rgba(148,163,184,0.10)",
          border:             `1px solid ${HAIRLINE}`,
        }}>{count} {count === 1 ? "story" : "stories"}</span>
      )}
    </div>
  );
});

const SourcesDrawer = memo(function SourcesDrawer({ isMobile }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{
      marginTop:     isMobile ? 32 : 44,
      marginBottom:  isMobile ? 24 : 32,
      borderRadius:  CARD_RADIUS,
      border:        `1px solid ${HAIRLINE}`,
      background:    PANEL_BG_ALT,
      overflow:      "hidden",
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "space-between",
          gap:             12,
          width:           "100%",
          padding:         isMobile ? "18px 18px" : "22px 24px",
          background:      "transparent",
          border:          "none",
          color:           TEXT_PRIMARY,
          cursor:          "pointer",
          fontFamily:      "inherit",
          textAlign:       "left",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color:         SUBTLE_TEXT,
          }}>Sources</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>
            Following {SOURCE_DIRECTORY.length}
          </span>
          <span style={{ fontSize: 12, color: SUBTLE_TEXT, fontWeight: 500 }}>
            — BBC, ESPN, Autosport, Motorsport + {SOURCE_DIRECTORY.length - 4} more
          </span>
        </span>
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            color:      MUTED_TEXT,
            flexShrink: 0,
            transform:  open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 220ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className="nw-sources-grid"
        data-open={open}
        aria-hidden={!open}
      >
        <div className="nw-sources-inner">
          <div style={{
            display:             "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap:                 "0 22px",
            paddingBottom:       18,
          }}>
            {SOURCE_DIRECTORY.map((source) => (
              <a
                key={source.name}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="nw-source-row"
                tabIndex={open ? 0 : -1}
                style={{
                  display:         "flex",
                  alignItems:      "baseline",
                  gap:             10,
                  padding:         "10px 0",
                  borderTop:       `1px solid ${HAIRLINE}`,
                  textDecoration:  "none",
                  color:           "inherit",
                }}
              >
                <span style={{
                  fontSize:      13,
                  fontWeight:    800,
                  letterSpacing: "-0.015em",
                  color:         TEXT_PRIMARY,
                  minWidth:      124,
                }}>{source.name}</span>
                <span style={{
                  fontSize:      10,
                  fontWeight:    800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color:         AI_BLUE_TEXT,
                  flexShrink:    0,
                }}>{source.role}</span>
                <span style={{
                  fontSize:   12,
                  lineHeight: 1.5,
                  color:      MUTED_TEXT,
                  flex:       1,
                }}>{source.detail}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});

const WireEmptyState = memo(function WireEmptyState({ isMobile, query }) {
  if (query) {
    return (
      <section style={{
        padding:      isMobile ? "32px 22px" : "44px 28px",
        borderRadius: CARD_RADIUS,
        border:       `1px solid ${HAIRLINE}`,
        background:   PANEL_BG_ALT,
        marginBottom: isMobile ? 20 : 28,
        textAlign:    "center",
      }}>
        <div style={{
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color:         SUBTLE_TEXT,
          marginBottom:  10,
        }}>No matches</div>
        <h2 className="stint-section-title" style={{
          margin: 0,
          fontSize:      isMobile ? 20 : 24,
          letterSpacing: "-0.035em",
          lineHeight:    1.18,
        }}>
          Nothing on the wire matches&nbsp;<span style={{ color: ACCENT }}>&ldquo;{query}&rdquo;</span>
        </h2>
      </section>
    );
  }
  return (
    <section style={{
      position:     "relative",
      overflow:     "hidden",
      borderRadius: SECTION_RADIUS,
      border:       PANEL_BORDER,
      background:   `linear-gradient(135deg, ${rgbaFromHex(ACCENT, 0.10)} 0%, ${rgbaFromHex(ACCENT, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
      padding:      isMobile ? "26px 22px" : "34px 30px",
      marginBottom: isMobile ? 32 : 44,
      boxShadow:    CARD_SHADOW,
    }}>
      <span aria-hidden="true" style={{
        position:   "absolute",
        top:        0,
        bottom:     0,
        left:       0,
        width:      3,
        background: ACCENT,
        opacity:    0.6,
      }} />
      <SectionLabel color={ACCENT} rule style={{ marginBottom: 10 }}>The wire is quiet</SectionLabel>
      <h2 className="stint-section-title" style={{
        margin: "0 0 12px",
        fontSize:      isMobile ? 22 : 28,
        letterSpacing: "-0.035em",
        lineHeight:    1.15,
        maxWidth:      "26ch",
      }}>
        No stories on the wire right now
      </h2>
      <p className="stint-body" style={{ margin: 0, maxWidth: "52ch", lineHeight: 1.65 }}>
        Stories land as publishers file them. Check back after qualifying — or read this week&rsquo;s AI brief for the through-line.
      </p>
    </section>
  );
});

// ─── Cross-link footer ──────────────────────────────────────────────────────
// Both modes end by pointing at the other — the editorial system braids
// instead of forcing the reader to find the other surface in the Navbar.

function CrossLinkFooter({ mode, insight, meta, isMobile }) {
  const isAi = mode === "ai";
  const href = isAi ? "/?page=news" : "/?page=ai-brief";
  const linkTone = isAi ? ACCENT : AI_BLUE_TEXT;
  const linkLabel = isAi ? "Open the Wire" : "Open AI Insight";

  const title = isAi
    ? (insight?.source_count
      ? `This brief drew on ${insight.source_count} wire sources.`
      : "Read the stories this brief was built from.")
    : "Same stories, read as a brief.";

  const subtitle = isAi
    ? "Open the Wire for the same race week, faster."
    : "AI Insight pulls this week's wire into one race-week read with category picks.";

  return (
    <a
      href={href}
      className="nw-crosslink f1-hoverable"
      style={{
        position:           "relative",
        overflow:           "hidden",
        display:            "flex",
        alignItems:         "center",
        justifyContent:     "space-between",
        gap:                16,
        padding:            isMobile ? "20px 22px" : "26px 28px",
        borderRadius:       CARD_RADIUS,
        border:             `1px solid ${rgbaFromHex(linkTone, 0.22)}`,
        background:         `linear-gradient(135deg, ${rgbaFromHex(linkTone, 0.10)} 0%, ${rgbaFromHex(linkTone, 0.02)} 60%, ${PANEL_BG_ALT} 100%)`,
        boxShadow:          CARD_SHADOW,
        textDecoration:     "none",
        color:              "inherit",
        marginTop:          isAi ? (isMobile ? 16 : 24) : (isMobile ? 8 : 16),
        viewTransitionName: "news-crosslink",
      }}
    >
      <span aria-hidden="true" style={{
        position:   "absolute",
        top:        0,
        bottom:     0,
        left:       0,
        width:      3,
        background: linkTone,
        opacity:    0.7,
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color:         linkTone,
          marginBottom:  8,
        }}>Cross-link · {isAi ? "Wire" : "AI Brief"}</div>
        <div className="stint-card-title" style={{
          fontSize:      isMobile ? 16 : 19,
          fontWeight:    900,
          letterSpacing: "-0.028em",
          color:         TEXT_PRIMARY,
          lineHeight:    1.22,
          maxWidth:      "42ch",
          marginBottom:  5,
        }}>
          {title}
        </div>
        <div style={{
          fontSize:      12.5,
          color:         MUTED_TEXT,
          letterSpacing: "-0.005em",
          lineHeight:    1.5,
        }}>
          {subtitle}
        </div>
      </div>
      <span style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            8,
        padding:        isMobile ? "9px 14px" : "10px 18px",
        borderRadius:   RADIUS_PILL,
        background:     rgbaFromHex(linkTone, 0.14),
        border:         `1px solid ${rgbaFromHex(linkTone, 0.30)}`,
        fontSize:       12,
        fontWeight:     900,
        letterSpacing:  "-0.005em",
        color:          linkTone,
        flexShrink:     0,
        whiteSpace:     "nowrap",
      }}>
        <span>{linkLabel}</span>
        <span className="nw-crosslink-arrow" aria-hidden="true">→</span>
      </span>
    </a>
  );
}

const WireFeedSurface = memo(function WireFeedSurface({
  visibleArticles,
  featured,
  timeGroupedFeed,
  searchQuery,
  wireMeta,
  isMobile,
}) {
  if (!visibleArticles.length) {
    return (
      <>
        <WireEmptyState isMobile={isMobile} query={null} />
        <CrossLinkFooter mode="news" meta={wireMeta} isMobile={isMobile} />
      </>
    );
  }

  const hasTopStory = !searchQuery && !!featured;
  const hasResults  = timeGroupedFeed.length > 0;

  return (
    <>
      <section className="nw-feed" style={{ marginBottom: 8 }}>
        {hasTopStory && (
          <TopStoryRow article={featured} isMobile={isMobile} />
        )}
        {hasResults
          ? timeGroupedFeed.map((group, groupIdx) => (
            <div key={group.key}>
              <TimeGroupDivider
                label={group.label}
                date={group.date}
                count={group.items.length}
                first={groupIdx === 0 && !hasTopStory}
              />
              {group.items.map((article) => (
                <FeedRow key={article.id} article={article} isMobile={isMobile} />
              ))}
            </div>
          ))
          : <WireEmptyState isMobile={isMobile} query={searchQuery} />}
      </section>
      <SourcesDrawer isMobile={isMobile} />
      <CrossLinkFooter mode="news" meta={wireMeta} isMobile={isMobile} />
    </>
  );
});

// ─── Main page ──────────────────────────────────────────────────────────────

export default function NewsPage({ initialTab = "news", lockedTab = null, user = null }) {
  const { isMobile, isTablet } = useViewport();
  const { calendar } = useRaceCalendar(2026);
  const [articles, setArticles]           = useState([]);
  const [insight, setInsight]             = useState(null);
  const [insightStale, setInsightStale]   = useState(false);
  const [loading, setLoading]             = useState(true);
  const [hasTable, setHasTable]           = useState(true);
  const [tab, setTab]                     = useState(lockedTab || initialTab);
  const [searchQuery, setSearchQuery]     = useState("");
  const deferredSearchQuery               = useDeferredValue(searchQuery);
  const normalizedSearchQuery             = deferredSearchQuery.trim();
  const currentRace = useMemo(() => nextRace(calendar) || calendar[0] || null, [calendar]);
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
  }, []);

  usePageMetadata({
    title: tab === "news" ? "F1 Wire" : "AI Race Brief",
    description: tab === "news"
      ? "A single live F1 wire for the race week — stories, time-grouped, with the sources that actually move picks."
      : "The weekly AI race brief — a single read on the weekend with category-level picks you can take straight to your board.",
    path: tab === "news" ? "/wire" : "/?page=ai-brief",
  });

  useEffect(() => {
    if (lockedTab) setTab(lockedTab);
  }, [lockedTab]);

  useEffect(() => {
    let ignore = false;

    async function loadNews() {
      setLoading(true);
      const [{ data, error }, insightResponse] = await Promise.all([
        supabase
          .from("news_articles")
          .select("id,title,summary,url,source,published_at,image_url")
          .order("published_at", { ascending: false })
          .limit(IS_SNAPSHOT ? 16 : 80),
        supabase
          .from("ai_insights")
          .select("headline,summary,confidence,key_factors,prediction_edges,watchlist,race_name,generated_at,source_count,metadata")
          .eq("scope", "upcoming_race")
          .order("generated_at", { ascending: false })
          .limit(6),
      ]);

      if (ignore) return;

      if (error) {
        setHasTable(false);
        setArticles([]);
      } else {
        setHasTable(true);
        setArticles(data || []);
      }

      if (insightResponse.error) {
        setInsight(null);
        setInsightStale(false);
      } else {
        const rows    = insightResponse.data || [];
        const matched = chooseInsightForRace(rows, currentRace);
        setInsight(matched);
        setInsightStale(rows.length > 0 && !matched);
      }

      setLoading(false);
    }

    loadNews();
    return () => { ignore = true; };
  }, [currentRace]);

  // Wire data ----------------------------------------------------------------
  const visibleArticles = useMemo(
    () => articles.filter((article) => !BLOCKED_NEWS_SOURCES.has(article.source)),
    [articles],
  );
  const featured = useMemo(() => pickFeaturedArticle(visibleArticles), [visibleArticles]);
  const feedFiltered = useMemo(() => {
    if (!normalizedSearchQuery) return visibleArticles;
    const q = normalizedSearchQuery.toLowerCase();
    return visibleArticles.filter(
      (a) =>
        a.title?.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.source?.toLowerCase().includes(q),
    );
  }, [visibleArticles, normalizedSearchQuery]);

  const timeGroupedFeed = useMemo(() => {
    const buckets = { today: [], yesterday: [], week: [], earlier: [] };
    const seenFeatured = !!featured && !normalizedSearchQuery;
    for (const a of feedFiltered) {
      if (seenFeatured && a.id === featured.id) continue;
      buckets[timeGroupKey(a.published_at)].push(a);
    }
    const fmt = (d) => new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(d).toUpperCase();
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const dateFor = (k) => {
      if (k === "today")     return fmt(now);
      if (k === "yesterday") return fmt(yesterday);
      return null;
    };
    const order = ["today", "yesterday", "week", "earlier"];
    return order
      .map((k) => ({ key: k, label: TIME_GROUP_LABELS[k], date: dateFor(k), items: buckets[k] }))
      .filter((g) => g.items.length > 0);
  }, [feedFiltered, featured, normalizedSearchQuery]);

  const sourceCount = useMemo(
    () => new Set(visibleArticles.map((a) => a.source).filter(Boolean)).size,
    [visibleArticles],
  );

  const wireMeta = useMemo(() => ({
    articles:    visibleArticles.length,
    sources:     sourceCount,
    lastUpdated: visibleArticles[0]?.published_at || null,
  }), [sourceCount, visibleArticles]);

  // AI Insight data ---------------------------------------------------------
  const aiPredictions = useMemo(
    () => [...(insight?.metadata?.category_predictions || [])].sort(
      (left, right) => AI_CATEGORY_ORDER.indexOf(left.key) - AI_CATEGORY_ORDER.indexOf(right.key),
    ),
    [insight],
  );
  const keyFactors       = insight?.key_factors || [];
  const previousRace     = insight?.metadata?.previous_race || null;
  const historicalForm   = insight?.metadata?.historical_form || null;
  const seasonVolatility = insight?.metadata?.season_volatility || null;
  const fantasyMarket    = insight?.metadata?.fantasy_market || null;
  const crowdFavorite    = fantasyMarket?.crowd_favorites?.[0] || null;
  const watchlist        = insight?.watchlist || [];

  const aiState = loading
    ? "loading"
    : insight
      ? "ready"
      : insightStale
        ? "stale"
        : "empty";

  const wireState = loading
    ? "loading"
    : visibleArticles.length > 0
      ? "ready"
      : hasTable
        ? "empty"
        : "setup";

  const isPro = user?.subscription_status === "pro";

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <PageShell tone="editorial" ambient="subtle">
      <style>{`
        /* ── Page entry (per mode) ─────────────────────────────────────────
           AI Insight unfolds editorially — chapters fade in with paced stagger.
           Wire arrives as a single block — stories "file" in together. */

        @keyframes nw-section-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nw-read   { animation: nw-section-in 460ms cubic-bezier(0.16,1,0.3,1) both; }
        .nw-calls  { animation: nw-section-in 460ms 80ms  cubic-bezier(0.16,1,0.3,1) both; }
        .nw-angles { animation: nw-section-in 460ms 160ms cubic-bezier(0.16,1,0.3,1) both; }
        .nw-watch  { animation: nw-section-in 460ms 240ms cubic-bezier(0.16,1,0.3,1) both; }

        @keyframes nw-feed-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nw-feed { animation: nw-feed-in 320ms cubic-bezier(0.22,1,0.36,1) both; }

        /* Sub-entry: angle chapters (one-at-a-time reveal inside The Angles) */
        .nw-angles-item {
          animation: nw-section-in 420ms cubic-bezier(0.16,1,0.3,1) both;
        }
        .nw-angles-item:nth-child(1) { animation-delay: 200ms; }
        .nw-angles-item:nth-child(2) { animation-delay: 280ms; }
        .nw-angles-item:nth-child(3) { animation-delay: 360ms; }

        /* Sub-entry: signal rail rows (data-column cascades in after angles) */
        .nw-signal-row {
          animation: nw-section-in 320ms cubic-bezier(0.16,1,0.3,1) both;
        }
        .nw-signal-row:nth-child(1) { animation-delay: 240ms; }
        .nw-signal-row:nth-child(2) { animation-delay: 300ms; }
        .nw-signal-row:nth-child(3) { animation-delay: 360ms; }
        .nw-signal-row:nth-child(4) { animation-delay: 420ms; }
        .nw-signal-row:nth-child(5) { animation-delay: 480ms; }

        /* ── Mode morph (View Transitions API) ────────────────────────────
           Shared viewTransitionName on the Masthead and the cross-link footer
           so those two elements interpolate their old → new state when the
           user switches Wire ⇄ AI Insight via the Navbar. */

        ::view-transition-old(news-masthead),
        ::view-transition-new(news-masthead),
        ::view-transition-old(news-crosslink),
        ::view-transition-new(news-crosslink) {
          animation-duration: 320ms;
          animation-timing-function: cubic-bezier(0.16,1,0.3,1);
        }

        /* ── Lead story dot — the one live beat on Wire ───────────────── */

        @keyframes nw-lead-pulse {
          0%   { box-shadow: 0 0 0 0 ${rgbaFromHex(ACCENT, 0.52)}; }
          70%  { box-shadow: 0 0 0 6px rgba(255,106,26,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,106,26,0); }
        }
        .nw-lead-dot { animation: nw-lead-pulse 2400ms ease-out infinite; }

        /* ── Confidence dial — segments fill in sequence on mount ────── */

        @keyframes nw-dial-fill {
          from { transform: scaleX(0); opacity: 0.4; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        .nw-dial-seg {
          transform-origin: left center;
          animation: nw-dial-fill 300ms cubic-bezier(0.22,1,0.36,1) both;
        }
        .nw-dial-seg:nth-child(1) { animation-delay: 160ms; }
        .nw-dial-seg:nth-child(2) { animation-delay: 240ms; }
        .nw-dial-seg:nth-child(3) { animation-delay: 320ms; }

        /* ── Feed row ─────────────────────────────────────────────────── */

        .nw-feed-row {
          transition: opacity 160ms cubic-bezier(0.16,1,0.3,1),
                      transform 220ms cubic-bezier(0.16,1,0.3,1);
          -webkit-tap-highlight-color: transparent;
        }
        .nw-feed-row h2, .nw-feed-row h3 {
          transition: color 180ms cubic-bezier(0.16,1,0.3,1);
        }
        .nw-feed-row img {
          transition: transform 420ms cubic-bezier(0.16,1,0.3,1);
        }
        @media (hover: hover) and (pointer: fine) {
          .nw-feed-row:hover h2,
          .nw-feed-row:hover h3 { color: ${ACCENT}; }
          .nw-feed-row:hover img { transform: scale(1.035); }
        }
        .nw-feed-row:active { transform: scale(0.998); transition-duration: 80ms; }

        /* ── Primary pick card ────────────────────────────────────────── */

        .nw-primary-pick {
          transition: border-color 220ms cubic-bezier(0.16,1,0.3,1),
                      transform 240ms cubic-bezier(0.16,1,0.3,1),
                      box-shadow 240ms cubic-bezier(0.16,1,0.3,1);
          will-change: transform;
        }
        @media (hover: hover) and (pointer: fine) {
          .nw-primary-pick:hover {
            border-color: rgba(148,163,184,0.28);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.22);
          }
        }

        /* ── CTA — nudges its arrow on hover ──────────────────────────── */

        .nw-calls-cta {
          transition: box-shadow 220ms cubic-bezier(0.16,1,0.3,1),
                      transform 160ms cubic-bezier(0.16,1,0.3,1),
                      filter 200ms ease;
          -webkit-tap-highlight-color: transparent;
        }
        .nw-cta-arrow {
          display: inline-block;
          transition: transform 220ms cubic-bezier(0.16,1,0.3,1);
        }
        @media (hover: hover) and (pointer: fine) {
          .nw-calls-cta:hover {
            box-shadow: 0 8px 22px ${rgbaFromHex(ACCENT, 0.32)};
            transform: translateY(-1px);
            filter: brightness(1.04);
          }
          .nw-calls-cta:hover .nw-cta-arrow { transform: translateX(3px); }
        }
        .nw-calls-cta:active { transform: translateY(0) scale(0.98); transition-duration: 80ms; }

        /* ── Cross-link footer — arrow glides right ──────────────────── */

        .nw-crosslink {
          transition: background 200ms cubic-bezier(0.16,1,0.3,1),
                      border-color 200ms cubic-bezier(0.16,1,0.3,1);
          -webkit-tap-highlight-color: transparent;
        }
        .nw-crosslink-arrow {
          display: inline-block;
          transition: transform 260ms cubic-bezier(0.16,1,0.3,1);
        }
        @media (hover: hover) and (pointer: fine) {
          .nw-crosslink:hover { background: rgba(255,255,255,0.018); }
          .nw-crosslink:hover .nw-crosslink-arrow { transform: translateX(4px); }
        }

        /* ── Sources drawer — smooth grid-row expand ─────────────────── */

        .nw-sources-grid {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 360ms cubic-bezier(0.16,1,0.3,1);
        }
        .nw-sources-grid[data-open="true"] { grid-template-rows: 1fr; }
        .nw-sources-grid > .nw-sources-inner {
          overflow: hidden;
          transition: opacity 260ms cubic-bezier(0.16,1,0.3,1);
          opacity: 0;
        }
        .nw-sources-grid[data-open="true"] > .nw-sources-inner { opacity: 1; }

        .nw-source-row {
          transition: background 180ms cubic-bezier(0.16,1,0.3,1);
        }
        @media (hover: hover) and (pointer: fine) {
          .nw-source-row:hover { background: rgba(255,255,255,0.02); }
        }

        /* ── Search focus ─────────────────────────────────────────────── */

        .nw-search {
          transition: border-color 200ms cubic-bezier(0.16,1,0.3,1),
                      background 200ms cubic-bezier(0.16,1,0.3,1);
        }
        .nw-search:focus {
          border-color: ${rgbaFromHex(ACCENT, 0.42)} !important;
          background: rgba(6,16,27,0.65) !important;
          outline: none;
        }
        .nw-search::placeholder { color: ${SUBTLE_TEXT}; }

        /* ── Reduced motion ──────────────────────────────────────────── */

        @media (prefers-reduced-motion: reduce) {
          .nw-read, .nw-calls, .nw-angles, .nw-watch, .nw-feed,
          .nw-angles-item, .nw-signal-row, .nw-dial-seg, .nw-lead-dot {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .nw-feed-row, .nw-feed-row img, .nw-primary-pick, .nw-calls-cta,
          .nw-crosslink, .nw-source-row, .nw-search,
          .nw-cta-arrow, .nw-crosslink-arrow, .nw-sources-grid,
          .nw-sources-grid > .nw-sources-inner {
            transition: none !important;
          }
          .nw-feed-row:hover img, .nw-primary-pick:hover,
          .nw-calls-cta:hover, .nw-crosslink:hover .nw-crosslink-arrow {
            transform: none !important;
          }
          ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
        }
      `}</style>

      <Hero
        mode={tab}
        state={tab === "ai" ? aiState : wireState}
        currentRace={currentRace}
        insight={insight}
        meta={wireMeta}
        search={searchQuery}
        onSearchChange={handleSearchChange}
        isMobile={isMobile}
        isTablet={isTablet}
        loading={loading}
      />

      {loading ? (
        <section style={{ padding: "48px 0", color: MUTED_TEXT, fontSize: 14, letterSpacing: "-0.005em" }}>
          Loading race-week feed…
        </section>
      ) : tab === "ai" ? (
        // ─── AI Insight surface ─────────────────────────────────────────
        insight ? (
          <>
            <TheCalls
              aiPredictions={aiPredictions}
              isPro={isPro}
              isMobile={isMobile}
              currentRace={currentRace}
            />
            {isPro && (
              <>
                <TheAnglesAndSignals
                  keyFactors={keyFactors}
                  previousRace={previousRace}
                  historicalForm={historicalForm}
                  seasonVolatility={seasonVolatility}
                  crowdFavorite={crowdFavorite}
                  isMobile={isMobile}
                  isTablet={isTablet}
                />
                <WatchBeforeLock watchlist={watchlist} isMobile={isMobile} />
              </>
            )}
            <CrossLinkFooter mode="ai" insight={insight} isMobile={isMobile} />
          </>
        ) : (
          <CrossLinkFooter mode="ai" insight={null} isMobile={isMobile} />
        )
      ) : (
        // ─── Wire surface ───────────────────────────────────────────────
        <WireFeedSurface
          visibleArticles={visibleArticles}
          featured={featured}
          timeGroupedFeed={timeGroupedFeed}
          searchQuery={normalizedSearchQuery}
          wireMeta={wireMeta}
          isMobile={isMobile}
        />
      )}
    </PageShell>
  );
}
