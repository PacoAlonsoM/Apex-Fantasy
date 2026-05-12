import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { chooseInsightForRace } from "@/src/lib/aiInsight";
import { nextRace } from "@/src/constants/calendar";
import {
  ACCENT,
  CARD_RADIUS,
  CONTENT_MAX,
  DANGER,
  ERROR_TEXT,
  HAIRLINE,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PRO_AMBER_DOT,
  PRO_AMBER_TEXT,
  RADIUS_MD,
  RADIUS_PILL,
  SUBTLE_TEXT,
  SUCCESS,
  SUCCESS_TEXT,
  TEXT_PRIMARY,
  rgbaFromHex,
} from "@/src/constants/design";

// Soft info-blue — used wherever a roadmap / advisory / AI-insight tone
// reads better than the ember ACCENT. Routes through the `--text-ai` token
// so it darkens to a legible blue in light mode.
const INFO_SOFT = "var(--text-ai)";
// Live cyan — "fresh read / just published" signal. Paired with INFO_SOFT.
// Kept as a hex literal because `rgbaFromHex(INFO_CYAN, …)` calculations
// elsewhere in this file need the hex digits.
const INFO_CYAN = "#67e8f9";
import { IS_SNAPSHOT } from "@/src/lib/runtimeFlags";
import { DRV, TEAMS } from "@/src/constants/teams";
import useRaceCalendar from "@/src/lib/useRaceCalendar";
import usePageMetadata from "@/src/lib/usePageMetadata";
import { previewText } from "@/src/lib/format";
import SectionLabel from "@/src/ui/SectionLabel";
import PageMasthead from "@/src/ui/PageMasthead";
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

function Thumbnail({ src, size = 72, aspect = "square", source }) {
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

// ─── Masthead ────────────────────────────────────────────────────────────────
// Wraps the canonical `PageMasthead` with NewsPage-specific data: mode-keyed
// image (`header-wire.png` ↔ `header-insight.png`), tone (Wire = ambient,
// AI Insight = editorial), state-dot status line, and the search input on
// Wire. All structural chrome — vignette, image fade, hero-image opacity
// tokens — lives in `PageMasthead` so future global tweaks reach this page
// automatically.

function Masthead({ mode, state, currentRace, insight, meta, search, onSearchChange, isMobile, loading }) {
  const isAi   = mode === "ai";
  const eyebrow = isAi ? "AI Insight" : "Wire";

  const titleLine = isAi
    ? (insight?.race_name || currentRace?.n || "This week's brief")
    : (currentRace?.n || "Race-week wire");

  // Status dot + secondary description.
  const secondary = (() => {
    if (loading) return "Reading race-week context…";
    if (isAi) {
      if (state === "stale" && currentRace) {
        return `Saved brief does not match ${currentRace.n}. Regenerate from Admin.`;
      }
      if (state === "empty") return "No brief generated yet. Check back after admin publishes this round's read.";
      const bits = [];
      if (insight?.generated_at)  bits.push(`Generated ${relativeTime(insight.generated_at)}`);
      if (insight?.source_count)  bits.push(`${insight.source_count} sources read`);
      const conf = confidenceReading(insight?.confidence);
      if (conf)                   bits.push(`${Math.round(conf.value * 100)}% confidence`);
      return bits.join(" · ") || "Awaiting a fresh race brief.";
    }
    return meta.lastUpdated ? `Updated ${relativeTime(meta.lastUpdated)}` : "Waiting for first ingest";
  })();

  const stateTone = state === "stale"
    ? { dot: PRO_AMBER_DOT,       text: PRO_AMBER_TEXT }
    : state === "empty"
      ? { dot: "rgba(148,163,184,0.7)", text: MUTED_TEXT }
      : isAi
        ? { dot: "var(--text-note)", text: INFO_SOFT }
        : { dot: SUCCESS_TEXT,    text: SUCCESS_TEXT };

  const description = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span aria-hidden="true" style={{
        width:        6,
        height:       6,
        borderRadius: "50%",
        background:   stateTone.dot,
        flexShrink:   0,
        boxShadow:    mode === "news" && state === "ready" ? `0 0 8px ${rgbaFromHex(SUCCESS, 0.6)}` : "none",
      }} />
      <span style={{ color: stateTone.text, fontWeight: 600 }}>{secondary}</span>
    </span>
  );

  // Wire: count-of-stories chip on the right rail. AI: Vol/№ marker.
  const metaNode = isAi
    ? (currentRace?.r ? (
        <span
          aria-hidden="true"
          style={{
            display:            "inline-flex",
            alignItems:         "baseline",
            gap:                8,
            fontSize:           10,
            fontWeight:         900,
            letterSpacing:      "0.16em",
            textTransform:      "uppercase",
            color:              SUBTLE_TEXT,
            fontVariantNumeric: "tabular-nums",
            whiteSpace:         "nowrap",
          }}
        >
          <span>Vol&nbsp;2026</span>
          <span style={{ color: "rgba(148,163,184,0.26)", fontWeight: 400 }}>/</span>
          <span style={{ color: INFO_SOFT }}>№&nbsp;{String(currentRace.r).padStart(2, "0")}</span>
        </span>
      ) : null)
    : (loading ? null : (
        <span style={{
          fontSize:           11,
          fontWeight:         700,
          letterSpacing:      "0.06em",
          textTransform:      "uppercase",
          color:              SUBTLE_TEXT,
          fontVariantNumeric: "tabular-nums",
          whiteSpace:         "nowrap",
        }}>
          {meta.articles} {meta.articles === 1 ? "story" : "stories"} · {meta.sources} {meta.sources === 1 ? "source" : "sources"}
        </span>
      ));

  // Wire-only search input — desktop renders inline as an action; mobile
  // renders as a row below the masthead body.
  const searchInput = !isAi ? (
    <input
      type="search"
      placeholder="Search stories…"
      value={search}
      onChange={(e) => onSearchChange(e.target.value)}
      className="nw-search"
      style={{
        background:    "var(--bg-elevated)",
        border:        `1px solid ${HAIRLINE}`,
        borderRadius:  RADIUS_PILL,
        color:         TEXT_PRIMARY,
        padding:       isMobile ? "9px 14px" : "7px 14px",
        fontSize:      isMobile ? 13 : 12,
        outline:       "none",
        width:         isMobile ? "100%" : 220,
        fontFamily:    "inherit",
        letterSpacing: "-0.005em",
      }}
    />
  ) : null;

  return (
    <PageMasthead
      variant="flush"
      viewTransitionName="news-masthead"
      eyebrow={eyebrow}
      title={titleLine}
      description={description}
      meta={metaNode}
      actions={searchInput}
      image={{
        src: isAi ? "/images/header-insight.png" : "/images/header-wire.png",
        position: "right-mask",
      }}
      tone={isAi ? "editorial" : "ambient"}
      marginBottom={isAi ? 28 : 18}
    />
  );
}

// ─── AI Insight ────────────────────────────────────────────────────────────
// Slow, editorial, flagship. The Read → The Calls → Angles + Signals → Watch
// → Provenance. One vertical column; Signals floats to a right rail on desktop.

function TheRead({ insight, isMobile }) {
  if (!insight) return null;
  const conf = confidenceReading(insight.confidence);
  return (
    <section className="nw-read" style={{ marginBottom: isMobile ? 36 : 52 }}>
      <SectionLabel color={INFO_SOFT} rule style={{ marginBottom: 22 }}>The Read</SectionLabel>

      <h1 className="stint-page-title" style={{
        margin:        "0 0 20px",
        fontSize:      isMobile ? 30 : "clamp(36px, 4.2vw, 52px)",
        letterSpacing: "-0.05em",
        lineHeight:    1.02,
        maxWidth:      "20ch",
      }}>
        {insight.headline}
      </h1>

      <p style={{
        margin:         0,
        fontSize:       isMobile ? 15 : 17,
        fontWeight:     500,
        lineHeight:     1.7,
        color:          "rgba(226,232,240,0.88)",
        letterSpacing:  "-0.008em",
        maxWidth:       "62ch",
      }}>
        {insight.summary}
      </p>

      <div style={{
        marginTop:     22,
        display:       "inline-flex",
        alignItems:    "center",
        gap:           10,
        paddingTop:    16,
        borderTop:     `1px solid ${HAIRLINE}`,
        flexWrap:      "wrap",
      }}>
        <span aria-hidden="true" style={{
          display:     "inline-block",
          width:       18,
          height:      1,
          background:  INFO_SOFT,
          opacity:     0.6,
          marginRight: 2,
        }} />
        <span style={{
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color:         INFO_SOFT,
        }}>Stint AI</span>
        {insight.generated_at && (
          <>
            <span style={{ color: "rgba(148,163,184,0.32)", fontSize: 11 }}>·</span>
            <span style={{ fontSize: 11, color: SUBTLE_TEXT, fontWeight: 600 }}>
              {relativeTime(insight.generated_at)}
            </span>
          </>
        )}
        {insight.source_count ? (
          <>
            <span style={{ color: "rgba(148,163,184,0.32)", fontSize: 11 }}>·</span>
            <span style={{ fontSize: 11, color: SUBTLE_TEXT, fontWeight: 600 }}>
              {insight.source_count} sources
            </span>
          </>
        ) : null}
        {conf && (
          <>
            <span style={{ color: "rgba(148,163,184,0.32)", fontSize: 11 }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: conf.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: conf.color }}>{conf.label} confidence</span>
            </span>
          </>
        )}
      </div>
    </section>
  );
}

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

  return (
    <div
      className="nw-primary-pick"
      style={{
        display:       "flex",
        alignItems:    "center",
        gap:           isMobile ? 14 : 18,
        padding:       isMobile ? "14px 14px" : "16px 18px",
        borderRadius:  CARD_RADIUS,
        border:        `1px solid ${HAIRLINE}`,
        background:    PANEL_BG_ALT,
        minWidth:      0,
      }}
    >
      <PickVisual item={item} size={isMobile ? 52 : 60} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display:        "flex",
          alignItems:     "baseline",
          justifyContent: "space-between",
          gap:            10,
          marginBottom:   4,
        }}>
          <span style={{
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color:         SUBTLE_TEXT,
          }}>{categoryLabel}</span>
          <ConfidenceDial conf={conf} />
        </div>
        <div style={{
          fontSize:       isMobile ? 18 : 20,
          fontWeight:     900,
          letterSpacing:  "-0.03em",
          color:          TEXT_PRIMARY,
          lineHeight:     1.12,
          marginBottom:   6,
        }}>{item.pick}</div>
        {item.reason && (
          <div style={{
            fontSize:   12,
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
          <span style={{ fontSize: 10, fontWeight: 800, color: "var(--brand)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Pro</span>
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
    <section className="nw-calls" style={{ marginBottom: isMobile ? 32 : 44 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <SectionLabel color={INFO_SOFT} rule>The Calls</SectionLabel>
        <span style={{ fontSize: 11, color: SUBTLE_TEXT, fontWeight: 600 }}>
          {aiPredictions.length} categories · {primary.length} primary · {secondary.length} supporting
        </span>
      </div>

      {primary.length > 0 && (
        <div style={{
          display:             "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap:                 10,
          marginBottom:        secondary.length ? 18 : 22,
        }}>
          {primary.map((item) => (
            <PrimaryPickCard key={item.key || item.category} item={item} isMobile={isMobile} />
          ))}
        </div>
      )}

      {secondary.length > 0 && (
        <div style={{
          borderRadius: CARD_RADIUS,
          border:       `1px solid ${HAIRLINE}`,
          background:   PANEL_BG,
          padding:      isMobile ? "4px 14px 0" : "4px 18px 0",
          marginBottom: 22,
        }}>
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
          display:        "inline-flex",
          alignItems:     "center",
          gap:            8,
          background: "var(--brand)",
          color:          "#fff",
          fontSize:       13,
          fontWeight:     900,
          letterSpacing:  "-0.005em",
          padding:        "11px 22px",
          borderRadius:   RADIUS_PILL,
          textDecoration: "none",
          boxShadow:      `0 6px 18px ${rgbaFromHex(ACCENT, 0.28)}`,
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
      className="nw-angles-item"
      style={{
        padding:    isMobile ? "20px 0" : "24px 0",
        borderTop:  `1px solid ${HAIRLINE}`,
        willChange: "transform",
      }}
    >
      <div style={{
        display:       "inline-flex",
        alignItems:    "center",
        gap:           10,
        marginBottom:  10,
        fontVariantNumeric: "tabular-nums",
      }}>
        <span style={{
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color:         SUBTLE_TEXT,
        }}>Angle&nbsp;{ordinal}</span>
        <span aria-hidden="true" style={{
          display:    "inline-block",
          width:      14,
          height:     1,
          background: "rgba(148,163,184,0.22)",
        }} />
        <span style={{
          display:       "inline-flex",
          alignItems:    "center",
          gap:           6,
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color:         toneColor,
        }}>
          <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: toneColor }} />
          {toneLabel}
        </span>
      </div>
      <h3 className="stint-card-title" style={{
        margin:        "0 0 8px",
        fontSize:      isMobile ? 17 : 20,
        lineHeight:    1.22,
      }}>
        {item.title}
      </h3>
      {item.detail && (
        <p style={{
          margin:     closingNote ? "0 0 10px" : 0,
          fontSize:   14,
          lineHeight: 1.7,
          color:      "rgba(226,232,240,0.84)",
          maxWidth:   "62ch",
        }}>{item.detail}</p>
      )}
      {closingNote && (
        <div style={{
          fontSize:   12,
          lineHeight: 1.65,
          color:      MUTED_TEXT,
          maxWidth:   "62ch",
        }}>
          <span style={{ color: toneColor, fontWeight: 700, letterSpacing: "-0.005em" }}>For your picks —</span>{" "}
          {closingNote}
        </div>
      )}
    </article>
  );
}

function Signal({ label, value, accent = TEXT_PRIMARY, caption }) {
  return (
    <div className="nw-signal-row" style={{ padding: "14px 0", borderTop: `1px solid ${HAIRLINE}` }}>
      <div style={{
        display:        "flex",
        alignItems:     "baseline",
        justifyContent: "space-between",
        gap:            14,
      }}>
        <span style={{
          fontSize:      10,
          fontWeight:    900,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color:         SUBTLE_TEXT,
          flexShrink:    0,
        }}>{label}</span>
        <span style={{
          fontSize:           15,
          fontWeight:         900,
          letterSpacing:      "-0.02em",
          color:              accent,
          fontVariantNumeric: "tabular-nums",
          textAlign:          "right",
          overflow:           "hidden",
          textOverflow:       "ellipsis",
          whiteSpace:         "nowrap",
          minWidth:           0,
        }}>{value || "—"}</span>
      </div>
      {caption && (
        <div style={{
          fontSize:      11,
          color:         SUBTLE_TEXT,
          marginTop:     4,
          textAlign:     "right",
          letterSpacing: "-0.005em",
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
      marginBottom:        isMobile ? 32 : 44,
    }}>
      {showAngles && (
        <div>
          <SectionLabel color={INFO_SOFT} rule style={{ marginBottom: 6 }}>The Angles</SectionLabel>
          <div>
            {angles.map((angle, idx) => (
              <AngleCard key={angle.title || idx} item={angle} index={idx} isMobile={isMobile} />
            ))}
          </div>
        </div>
      )}

      {showSignals && (
        <aside>
          <SectionLabel color={INFO_SOFT} rule style={{ marginBottom: 6 }}>The Signals</SectionLabel>
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
    <section className="nw-watch" style={{ marginBottom: isMobile ? 32 : 44 }}>
      <SectionLabel color={INFO_SOFT} rule style={{ marginBottom: 18 }}>Watch before lock</SectionLabel>
      <div style={{
        display:             "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap:                 10,
      }}>
        {items.map((item, idx) => (
          <div key={item.label || idx} style={{
            borderRadius: CARD_RADIUS,
            border:       `1px solid ${HAIRLINE}`,
            background:   PANEL_BG_ALT,
            padding:      "14px 16px",
          }}>
            <div style={{
              fontSize:      13,
              fontWeight:    900,
              letterSpacing: "-0.02em",
              color:         TEXT_PRIMARY,
              marginBottom:  6,
            }}>{item.label}</div>
            {(item.trigger || item.reason) && (
              <div style={{
                fontSize:   12,
                lineHeight: 1.6,
                color:      MUTED_TEXT,
                marginBottom: item.how_to_react ? 8 : 0,
              }}>{previewText(item.trigger || item.reason, 160)}</div>
            )}
            {item.how_to_react && (
              <div style={{
                fontSize:      11,
                fontWeight:    700,
                color:         "#9cd1ff",
                lineHeight:    1.55,
                display:       "inline-flex",
                alignItems:    "baseline",
                gap:           6,
              }}>
                <span aria-hidden="true">→</span>
                <span>{previewText(item.how_to_react, 140)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AIInsightEmptyState({ state, currentRace, isMobile }) {
  const isStale = state === "stale";
  const title   = isStale ? "This brief is out of date" : "The next brief is being written";
  const body    = isStale && currentRace
    ? `The saved AI read does not match ${currentRace.n}. An admin needs to regenerate it from the Admin page for this round.`
    : "Stint AI publishes one read per race week. Check back after qualifying — or open the Wire for the latest stories.";
  return (
    <section style={{
      borderRadius: CARD_RADIUS,
      border:       `1px solid ${HAIRLINE}`,
      background:   PANEL_BG_ALT,
      padding:      isMobile ? "22px 20px" : "28px 26px",
      marginBottom: isMobile ? 32 : 44,
    }}>
      <SectionLabel color={isStale ? PRO_AMBER_TEXT : INFO_SOFT} rule style={{ marginBottom: 12 }}>
        {isStale ? "Stale" : "No brief yet"}
      </SectionLabel>
      <h2 className="stint-section-title" style={{
        margin:        "0 0 10px",
        fontSize:      isMobile ? 20 : 24,
        letterSpacing: "-0.035em",
        lineHeight:    1.18,
        maxWidth:      "28ch",
      }}>{title}</h2>
      <p className="stint-body" style={{ margin: 0, maxWidth: "52ch" }}>{body}</p>
    </section>
  );
}

// ─── Wire ────────────────────────────────────────────────────────────────────
// Fast, kinetic, one-column. Featured article is the elevated first row of the
// Today group — not a separate hero section. Everything else flows in
// time-grouped rows with subtle dividers.

function TopStoryRow({ article, isMobile }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="nw-feed-row nw-feed-row--top"
      style={{
        display:         "grid",
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(260px, 320px)",
        gap:             isMobile ? 14 : 28,
        padding:         isMobile ? "18px 0 22px" : "22px 0 26px",
        textDecoration:  "none",
        color:           "inherit",
        borderTop:       `1px solid ${rgbaFromHex(ACCENT, 0.55)}`,
        boxShadow:       `inset 0 1px 0 ${rgbaFromHex(ACCENT, 0.22)}`,
        alignItems:      "start",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{
          marginBottom:   12,
          display:        "inline-flex",
          alignItems:     "center",
          gap:            10,
          flexWrap:       "wrap",
        }}>
          <span style={{
            display:       "inline-flex",
            alignItems:    "center",
            gap:           6,
            fontSize:      10,
            fontWeight:    900,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--brand)",
          }}>
            <span
              className="nw-lead-dot"
              aria-hidden="true"
              style={{
                display:      "inline-block",
                width:        5,
                height:       5,
                borderRadius: "50%",
                background: "var(--brand)",
              }}
            />
            Lead story
          </span>
          <span aria-hidden="true" style={{
            display:    "inline-block",
            width:      12,
            height:     1,
            background: "rgba(148,163,184,0.22)",
          }} />
          <SourceChip source={article.source} publishedAt={article.published_at} tone="cool" />
        </div>
        <h2 className="stint-section-title" style={{
          margin:        "0 0 12px",
          fontSize:      isMobile ? 22 : 28,
          letterSpacing: "-0.04em",
          lineHeight:    1.1,
          maxWidth:      "22ch",
        }}>{article.title}</h2>
        {article.summary && (
          <p style={{
            margin:     0,
            fontSize:   14,
            lineHeight: 1.68,
            color:      "rgba(226,232,240,0.78)",
            display:    "-webkit-box",
            WebkitLineClamp: isMobile ? 3 : 2,
            WebkitBoxOrient: "vertical",
            overflow:   "hidden",
            maxWidth:   "60ch",
          }}>{article.summary}</p>
        )}
      </div>
      <Thumbnail src={article.image_url} aspect="wide" source={article.source} />
    </a>
  );
}

function FeedRow({ article, isMobile }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="nw-feed-row"
      style={{
        display:         "grid",
        gridTemplateColumns: isMobile
          ? "minmax(0, 1fr)"
          : "minmax(0, 1fr) 96px",
        gap:             isMobile ? 10 : 18,
        padding:         isMobile ? "14px 0" : "16px 0",
        textDecoration:  "none",
        color:           "inherit",
        borderTop:       `1px solid ${HAIRLINE}`,
        alignItems:      "start",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 6 }}>
          <SourceChip source={article.source} publishedAt={article.published_at} tone="cool" />
        </div>
        <h3 className="stint-card-title" style={{
          margin:        "0 0 4px",
          fontSize:      isMobile ? 15 : 16,
          letterSpacing: "-0.02em",
          lineHeight:    1.28,
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
      {!isMobile && (
        <Thumbnail src={article.image_url} size={96} aspect="square" source={article.source} />
      )}
    </a>
  );
}

function TimeGroupDivider({ label, date, count, first = false }) {
  return (
    <div style={{
      display:       "flex",
      alignItems:    "baseline",
      gap:           10,
      padding:       first ? "4px 0 12px" : "24px 0 12px",
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
          letterSpacing:      "0.04em",
          color:              SUBTLE_TEXT,
          fontVariantNumeric: "tabular-nums",
        }}>{count}</span>
      )}
    </div>
  );
}

function SourcesDrawer({ isMobile }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{
      borderTop:     `1px solid ${HAIRLINE}`,
      borderBottom:  `1px solid ${HAIRLINE}`,
      marginTop:     isMobile ? 24 : 32,
      marginBottom:  isMobile ? 18 : 24,
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
          padding:         "16px 0",
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
                  color:         "#9cd1ff",
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
}

function WireEmptyState({ isMobile, query }) {
  if (query) {
    return (
      <div style={{
        padding:    "36px 0",
        textAlign:  "center",
        color:      MUTED_TEXT,
        fontSize:   14,
        lineHeight: 1.6,
      }}>
        No stories match <span style={{ color: TEXT_PRIMARY, fontWeight: 800 }}>&ldquo;{query}&rdquo;</span>
      </div>
    );
  }
  return (
    <section style={{
      borderRadius: CARD_RADIUS,
      border:       `1px solid ${HAIRLINE}`,
      background:   PANEL_BG_ALT,
      padding:      isMobile ? "22px 20px" : "28px 26px",
      marginBottom: isMobile ? 32 : 44,
    }}>
      <SectionLabel color={INFO_SOFT} style={{ marginBottom: 10 }}>Wire</SectionLabel>
      <h2 className="stint-section-title" style={{ margin: "0 0 10px", fontSize: isMobile ? 20 : 24, letterSpacing: "-0.035em" }}>
        The wire is quiet right now
      </h2>
      <p className="stint-body" style={{ margin: 0, maxWidth: "52ch" }}>
        Stories land as publishers file them. Check back after qualifying — or read this week&rsquo;s AI brief for the through-line.
      </p>
    </section>
  );
}

// ─── Cross-link footer ──────────────────────────────────────────────────────
// Both modes end by pointing at the other — the editorial system braids
// instead of forcing the reader to find the other surface in the Navbar.

function CrossLinkFooter({ mode, insight, meta, isMobile }) {
  const isAi = mode === "ai";
  const href = isAi ? "/?page=news" : "/?page=ai-brief";
  const linkTone = isAi ? ACCENT : "#9cd1ff";
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
      className="nw-crosslink"
      style={{
        display:            "flex",
        alignItems:         "center",
        justifyContent:     "space-between",
        gap:                12,
        padding:            isMobile ? "18px 0" : "22px 0",
        borderTop:          `1px solid ${HAIRLINE}`,
        borderBottom:       `1px solid ${HAIRLINE}`,
        textDecoration:     "none",
        color:              "inherit",
        marginTop:          isAi ? (isMobile ? 12 : 18) : (isMobile ? 4 : 8),
        viewTransitionName: "news-crosslink",
      }}
    >
      <div>
        <SectionLabel style={{ marginBottom: 6 }}>Related</SectionLabel>
        <div style={{
          fontSize:      isMobile ? 15 : 17,
          fontWeight:    800,
          letterSpacing: "-0.025em",
          color:         TEXT_PRIMARY,
          lineHeight:    1.3,
          maxWidth:      "42ch",
        }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: MUTED_TEXT, marginTop: 4, letterSpacing: "-0.005em" }}>
          {subtitle}
        </div>
      </div>
      <span style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            6,
        fontSize:       12,
        fontWeight:     800,
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
  const currentRace = useMemo(() => nextRace(calendar) || calendar[0] || null, [calendar]);

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
    if (!searchQuery.trim()) return visibleArticles;
    const q = searchQuery.toLowerCase();
    return visibleArticles.filter(
      (a) =>
        a.title?.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.source?.toLowerCase().includes(q),
    );
  }, [visibleArticles, searchQuery]);

  const timeGroupedFeed = useMemo(() => {
    const buckets = { today: [], yesterday: [], week: [], earlier: [] };
    const seenFeatured = !!featured && !searchQuery.trim();
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
  }, [feedFiltered, featured, searchQuery]);

  const sourceCount = useMemo(
    () => new Set(visibleArticles.map((a) => a.source).filter(Boolean)).size,
    [visibleArticles],
  );

  const wireMeta = {
    articles:    visibleArticles.length,
    sources:     sourceCount,
    lastUpdated: visibleArticles[0]?.published_at || null,
  };

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
    <div
      className="stint-page-enter"
      style={{
        maxWidth:  CONTENT_MAX,
        margin:    "0 auto",
        padding:   isMobile ? "22px 18px 72px" : isTablet ? "28px 22px 80px" : "32px 28px 88px",
        position:  "relative",
        zIndex:    1,
      }}
    >
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

      <Masthead
        mode={tab}
        state={tab === "ai" ? aiState : wireState}
        currentRace={currentRace}
        insight={insight}
        meta={wireMeta}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        isMobile={isMobile}
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
            <TheRead insight={insight} isMobile={isMobile} />
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
          <>
            <AIInsightEmptyState state={insightStale ? "stale" : "empty"} currentRace={currentRace} isMobile={isMobile} />
            <CrossLinkFooter mode="ai" insight={null} isMobile={isMobile} />
          </>
        )
      ) : (
        // ─── Wire surface ───────────────────────────────────────────────
        visibleArticles.length > 0 ? (
          (() => {
            const hasTopStory = !searchQuery.trim() && !!featured;
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
                    : <WireEmptyState isMobile={isMobile} query={searchQuery.trim()} />}
                </section>
                <SourcesDrawer isMobile={isMobile} />
                <CrossLinkFooter mode="news" meta={wireMeta} isMobile={isMobile} />
              </>
            );
          })()
        ) : (
          <>
            <WireEmptyState isMobile={isMobile} query={null} />
            <CrossLinkFooter mode="news" meta={wireMeta} isMobile={isMobile} />
          </>
        )
      )}
    </div>
  );
}
