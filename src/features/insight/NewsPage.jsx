import { useEffect, useMemo, useState } from "react";
import { nextRace } from "@/src/constants/calendar";
import { ACCENT, CONTENT_MAX, EDGE_RING, LIFTED_SHADOW, PANEL_BG, PANEL_BG_ALT, PANEL_BORDER, MUTED_TEXT, SUBTLE_TEXT, HAIRLINE, SOFT_SHADOW } from "@/src/constants/design";
import { IS_SNAPSHOT } from "@/src/lib/runtimeFlags";
import useRaceCalendar from "@/src/lib/useRaceCalendar";
import usePageMetadata from "@/src/lib/usePageMetadata";
import useViewport from "@/src/lib/useViewport";

const BLOCKED_NEWS_SOURCES = new Set(["Formula1.com"]);

const SOURCE_CARDS = [
  {
    name: "BBC Sport F1",
    role: "General",
    detail: "Useful for broad race-week coverage and clean headline summaries.",
    url: "https://www.bbc.com/sport/formula1",
  },
  {
    name: "ESPN F1",
    role: "Wire",
    detail: "Fast race-week updates and broad international coverage.",
    url: "https://www.espn.com/f1/",
  },
  {
    name: "Autosport RSS",
    role: "Fast wire",
    detail: "Useful for quick race-week reporting and headline developments.",
    url: "https://www.autosport.com/rss/f1/news/",
  },
  {
    name: "Motorsport RSS",
    role: "Depth",
    detail: "Strong for deeper features, context and weekend follow-up stories.",
    url: "https://www.motorsport.com/rss/f1/news/",
  },
  {
    name: "RACER",
    role: "Paddock",
    detail: "Helpful for team, grid and weekend storylines with a U.S. racing lens.",
    url: "https://racer.com/category/f1/",
  },
  {
    name: "Crash F1",
    role: "Coverage",
    detail: "Supplemental race-week headlines and team developments.",
    url: "https://www.crash.net/f1",
  },
  {
    name: "PlanetF1",
    role: "Digest",
    detail: "Extra opinion and week-to-week narrative context for fantasy angles.",
    url: "https://www.planetf1.com/",
  },
  {
    name: "Motorsport Week",
    role: "Editorial",
    detail: "Additional long-form and analysis coverage around race weekends.",
    url: "https://www.motorsportweek.com/",
  },
];

const SOURCE_VISUALS = {
  "BBC Sport F1": {
    glow: "rgba(249,115,22,0.18)",
    gradient: "linear-gradient(135deg,rgba(249,115,22,0.24),rgba(15,23,42,0.94) 58%)",
    label: "#fdba74",
  },
  Autosport: {
    glow: "rgba(34,197,94,0.16)",
    gradient: "linear-gradient(135deg,rgba(34,197,94,0.22),rgba(15,23,42,0.94) 58%)",
    label: "#86efac",
  },
  Motorsport: {
    glow: "rgba(59,130,246,0.18)",
    gradient: "linear-gradient(135deg,rgba(59,130,246,0.22),rgba(15,23,42,0.94) 58%)",
    label: "#93c5fd",
  },
  RACER: {
    glow: "rgba(168,85,247,0.18)",
    gradient: "linear-gradient(135deg,rgba(168,85,247,0.22),rgba(15,23,42,0.94) 58%)",
    label: "#d8b4fe",
  },
};

const CARD_BORDER = "1px solid rgba(148,163,184,0.14)";
const CARD_BORDER_SOFT = "1px solid rgba(148,163,184,0.12)";
const SECTION_HEADER_BG = "linear-gradient(180deg,rgba(21,35,56,0.98),rgba(13,25,42,0.98))";
const PANEL_GRADIENT = `linear-gradient(180deg,rgba(10,18,32,0.98),${PANEL_BG} 34%)`;
const ACCENT_LABEL_STYLE = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#67e8f9",
};
const MUTED_LABEL_STYLE = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: SUBTLE_TEXT,
};

const BLOCKED_IMAGE_HOST_PARTS = [
  "news.google.",
  "googleusercontent.",
  "gstatic.",
  "encrypted-tbn",
  "ggpht.",
];

const BLOCKED_IMAGE_PATH_RE = /(?:favicon|apple-touch|sprite|logo|icon|placeholder|default-image|blank|pixel|spacer|avatar|profile)(?:[._/-]|$)/i;

const AI_CATEGORY_ORDER = [
  "pole",
  "winner",
  "p2",
  "p3",
  "dnf",
  "fl",
  "dotd",
  "ctor",
  "sc",
  "rf",
  "sp_pole",
  "sp_winner",
  "sp_p2",
  "sp_p3",
];

function formatPublished(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function previewText(value, max = 140) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function pickFeaturedArticle(items) {
  if (!items.length) return null;

  const pool = items.slice(0, 10);
  return [...pool].sort((left, right) => {
    const leftSummary = left.summary?.length || 0;
    const rightSummary = right.summary?.length || 0;
    const leftRecency = left.published_at ? new Date(left.published_at).getTime() / 1e11 : 0;
    const rightRecency = right.published_at ? new Date(right.published_at).getTime() / 1e11 : 0;
    const leftScore = leftSummary + leftRecency;
    const rightScore = rightSummary + rightRecency;
    return rightScore - leftScore;
  })[0] || items[0];
}

function articleVisualStyle(source) {
  return SOURCE_VISUALS[source] || {
    glow: "rgba(45,212,191,0.16)",
    gradient: "linear-gradient(135deg,rgba(45,212,191,0.2),rgba(15,23,42,0.94) 58%)",
    label: "#99f6e4",
  };
}

function safeArticleImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;

    const host = url.hostname.toLowerCase();
    if (BLOCKED_IMAGE_HOST_PARTS.some((part) => host.includes(part))) return null;

    const path = decodeURIComponent(url.pathname || "").toLowerCase();
    if (BLOCKED_IMAGE_PATH_RE.test(path) || /(?:^|[-_/])(?:1x1|pixel)(?:[-_.]|$)/i.test(path)) return null;

    const width = Number(url.searchParams.get("w") || url.searchParams.get("width") || 0);
    const height = Number(url.searchParams.get("h") || url.searchParams.get("height") || 0);
    if (width > 0 && height > 0 && (width < 180 || height < 90)) return null;

    return url.toString();
  } catch {
    return null;
  }
}

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: SECTION_HEADER_BG, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <div style={{ ...ACCENT_LABEL_STYLE, marginBottom: 4 }}>{eyebrow}</div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <div style={{ borderRadius: 16, border: CARD_BORDER, background: "rgba(8,17,29,0.74)", padding: "13px 14px", boxShadow: EDGE_RING }}>
      <div style={{ ...MUTED_LABEL_STYLE, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4, lineHeight: 1.12 }}>{value}</div>
      {detail && <div style={{ fontSize: 12, lineHeight: 1.58, color: MUTED_TEXT, marginTop: 6 }}>{detail}</div>}
    </div>
  );
}

function NewsVisual({ article, height = 128, compact = false }) {
  const visual = articleVisualStyle(article.source);
  const imageUrl = safeArticleImageUrl(article.image_url);
  const [blockedImageUrl, setBlockedImageUrl] = useState(null);

  if (imageUrl && blockedImageUrl !== imageUrl && !IS_SNAPSHOT) {
    return (
      <div
        style={{
          width: "100%",
          height,
          borderRadius: compact ? 16 : 18,
          border: CARD_BORDER_SOFT,
          background: visual.gradient,
          boxShadow: `0 20px 42px ${visual.glow}`,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={() => setBlockedImageUrl(imageUrl)}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth < 180 || image.naturalHeight < 90) setBlockedImageUrl(imageUrl);
          }}
        />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(2,6,23,0),rgba(2,6,23,0.52))" }} />
        <div style={{ position: "absolute", left: compact ? 10 : 14, bottom: compact ? 10 : 14, right: compact ? 10 : 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
          <span style={{ ...ACCENT_LABEL_STYLE, color: "#ecfeff", textShadow: "0 2px 14px rgba(0,0,0,0.55)" }}>
            {article.source || "F1 feed"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: compact ? 16 : 18,
        border: CARD_BORDER_SOFT,
        background: visual.gradient,
        boxShadow: `0 20px 42px ${visual.glow}`,
        padding: compact ? "12px 12px 11px" : "16px 16px 14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "auto -18% -34% auto",
          width: compact ? 84 : 136,
          height: compact ? 84 : 136,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          filter: "blur(2px)",
        }}
      />
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: visual.label }}>
        {article.source || "F1 feed"}
      </div>
      <div style={{ position: "relative", zIndex: 1, fontSize: compact ? 13 : 16, fontWeight: 800, lineHeight: 1.24, color: "#f8fafc", letterSpacing: -0.3 }}>
        {previewText(article.title, compact ? 72 : 108)}
      </div>
    </div>
  );
}

function detailOverlayPayload(section, item) {
  if (section === "digest") {
    return {
      eyebrow: "Insight Digest",
      title: item.headline,
      fields: [
        ["What this means", item.detail],
        ["Why it matters", item.why_it_matters],
      ],
    };
  }

  if (section === "factor") {
    return {
      eyebrow: "Key Factor",
      title: item.title,
      fields: [
        ["Context", item.detail],
        ["Why it matters", item.why_it_matters],
        ["Fantasy take", item.fantasy_take],
      ],
    };
  }

  if (section === "edge") {
    return {
      eyebrow: "Prediction Edge",
      title: item.label,
      fields: [
        ["Angle", item.detail || item.take],
        ["How to use it", item.action || "Use this as a directional edge, not an automatic lock."],
        ["Risk level", item.risk_level || "medium"],
      ],
    };
  }

  return {
    eyebrow: "Watchlist",
    title: item.label,
    fields: [
      ["Trigger", item.trigger || item.reason],
      ["What changes", item.what_changes || item.reason],
      ["How to react", item.how_to_react || "Re-evaluate picks if this storyline strengthens during the weekend."],
    ],
  };
}

function buildBriefHighlights({ newsDigest, keyFactors, predictionEdges }) {
  return [
    ...(newsDigest || []).map((item) => ({
      title: item.headline,
      detail: item.why_it_matters || item.detail,
      tone: "#67e8f9",
      label: "News signal",
    })),
    ...(keyFactors || []).map((item) => ({
      title: item.title,
      detail: item.fantasy_take || item.why_it_matters || item.detail,
      tone: item.impact === "positive" ? "#86efac" : item.impact === "negative" ? "#fca5a5" : "#93c5fd",
      label: "Key factor",
    })),
    ...(predictionEdges || []).map((item) => ({
      title: item.label,
      detail: item.action || item.detail,
      tone: item.risk_level === "high" ? "#fca5a5" : item.risk_level === "low" ? "#86efac" : "#93c5fd",
      label: "Edge",
    })),
  ].slice(0, 6);
}

export default function NewsPage({ initialTab = "news", lockedTab = null }) {
  const { isMobile, isTablet } = useViewport();
  const { calendar } = useRaceCalendar(2026);
  const [articles, setArticles] = useState([]);
  const [insight, setInsight] = useState(null);
  const [insightStale, setInsightStale] = useState(false);
  const [serverCurrentRace, setServerCurrentRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasTable, setHasTable] = useState(true);
  const [tab, setTab] = useState(lockedTab || initialTab);
  const [expandedInsight, setExpandedInsight] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredFeedId, setHoveredFeedId] = useState(null);
  const fallbackCurrentRace = useMemo(() => nextRace(calendar) || calendar[0] || null, [calendar]);
  const currentRace = serverCurrentRace || fallbackCurrentRace;

  usePageMetadata({
    title: tab === "news" ? "F1 Wire" : "AI Race Brief",
    description: tab === "news"
      ? "Read the stories that can actually change your picks with one public F1 wire that keeps more context on-page."
      : "Get one AI race brief built from recent F1 news and race context, with category-level angles for the upcoming weekend.",
    path: tab === "news" ? "/wire" : "/?page=ai-brief",
  });

  useEffect(() => {
    if (lockedTab) setTab(lockedTab);
  }, [lockedTab]);

  useEffect(() => {
    let ignore = false;

    async function loadNews() {
      setLoading(true);
      try {
        const response = await fetch(`/api/insight?season=2026`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || "Could not load the AI Insight page.");
        }

        if (ignore) return;

        setHasTable(Boolean(payload?.newsConfigured));
        setArticles(Array.isArray(payload?.articles) ? payload.articles : []);
        setInsight(payload?.insight || null);
        setInsightStale(Boolean(payload?.insightStale));
        setServerCurrentRace(payload?.currentRace || null);
      } catch (_error) {
        if (ignore) return;
        setHasTable(false);
        setArticles([]);
        setInsight(null);
        setInsightStale(false);
        setServerCurrentRace(null);
      }

      setLoading(false);
    }

    loadNews();
    return () => { ignore = true; };
  }, [fallbackCurrentRace?.date, fallbackCurrentRace?.n]);

  const visibleArticles = useMemo(
    () => articles.filter((article) => !BLOCKED_NEWS_SOURCES.has(article.source)),
    [articles]
  );
  const featured = useMemo(() => pickFeaturedArticle(visibleArticles), [visibleArticles]);
  const remainingArticles = useMemo(
    () => visibleArticles.filter((article) => article.id !== featured?.id),
    [visibleArticles, featured]
  );
  const ticker = useMemo(() => remainingArticles.slice(0, 5), [remainingArticles]);
  const feed = useMemo(() => {
    if (!searchQuery.trim()) return remainingArticles;
    const q = searchQuery.toLowerCase();
    return remainingArticles.filter(
      (a) =>
        a.title?.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.source?.toLowerCase().includes(q)
    );
  }, [remainingArticles, searchQuery]);
  const sourceCount = useMemo(() => new Set(visibleArticles.map((article) => article.source).filter(Boolean)).size, [visibleArticles]);
  const aiPredictions = useMemo(
    () => [...(insight?.metadata?.category_predictions || [])].sort((left, right) => AI_CATEGORY_ORDER.indexOf(left.key) - AI_CATEGORY_ORDER.indexOf(right.key)),
    [insight]
  );
  const raceSummary = insight?.metadata?.race_summary || "";
  const newsDigest = insight?.metadata?.news_digest || [];
  const previousRace = insight?.metadata?.previous_race || null;
  const previousRaceWeather = insight?.metadata?.previous_race_weather || null;
  const previousRaceStrategy = insight?.metadata?.previous_race_strategy || null;
  const historicalForm = insight?.metadata?.historical_form || null;
  const seasonVolatility = insight?.metadata?.season_volatility || null;
  const fantasyMarket = insight?.metadata?.fantasy_market || null;
  const historicalResults = insight?.metadata?.recent_results || [];
  const recentDriverLeader = historicalForm?.last_5_driver_form?.[0] || null;
  const recentConstructorLeader = historicalForm?.last_5_constructor_form?.[0] || null;
  const crowdFavorite = fantasyMarket?.crowd_favorites?.[0] || null;
  const featuredCompact = (featured?.summary?.length || 0) < 260;
  const briefHighlights = useMemo(
    () => buildBriefHighlights({ newsDigest, keyFactors: insight?.key_factors || [], predictionEdges: insight?.prediction_edges || [] }),
    [newsDigest, insight]
  );

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <section style={{ borderRadius: 28, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 18, boxShadow: LIFTED_SHADOW }}>
        <div
          style={{
            padding: "28px 30px 24px",
            height: isMobile ? "auto" : 312,
            borderBottom: `1px solid ${HAIRLINE}`,
            background: "linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,24,44,0.96))",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <img
            src={tab === "news" ? "/images/header-wire.png" : "/images/header-insight.png"}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              opacity: isMobile ? 0.23 : 0.34,
              pointerEvents: "none",
            }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, rgba(10,15,26,0.2) 0%, rgba(10,15,26,0.88) 100%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              alignContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
              height: isMobile ? "auto" : "100%",
            }}
          >
            <div style={{ maxWidth: 760 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
                {tab === "news" ? "Wire" : "AI Insight"}
              </div>
              <h1 style={{ fontSize: isMobile ? 28 : 54, fontWeight: 800, lineHeight: 0.94, margin: "0 0 12px", letterSpacing: isMobile ? "-0.04em" : "-0.07em" }}>
                {tab === "news" ? (
                  <>
                    The stories that can
                    <br />
                    actually change your picks.
                  </>
                ) : (
                  <>
                    One brief read on the weekend.
                    <br />
                    Plus category-level picks.
                  </>
                )}
              </h1>
              <div style={{ fontSize: isMobile ? 14 : 15, lineHeight: 1.82, color: MUTED_TEXT, maxWidth: 620 }}>
                {loading
                  ? "Loading race-week feed..."
                  : tab === "news"
                    ? hasTable ? `${visibleArticles.length} stories cleaned into one F1 feed` : "Waiting for ingest setup"
                    : insight ? "AI Insight summary and category picks generated from Wire + OpenF1 context" : "Generate one AI Insight read from Admin to unlock this tab"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3,minmax(0,1fr))" : "repeat(3,minmax(0,116px))", gap: 10, width: isMobile ? "100%" : "auto" }}>
              {[
                [tab === "news" ? String(visibleArticles.length || 0) : String(aiPredictions.length || 0), tab === "news" ? "stories" : "picks"],
                [tab === "news" ? String(sourceCount || 0) : (typeof insight?.confidence === "number" ? `${Math.round(insight.confidence * 100)}%` : "n/a"), tab === "news" ? "sources" : "confidence"],
                [loading ? "..." : tab === "news" ? (hasTable ? "live" : "setup") : (insight ? "ready" : "empty"), "status"],
              ].map(([value, label]) => (
                <div key={label} style={{ borderRadius: 18, border: label === "status" ? `1px solid ${ACCENT}33` : "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.02)", boxShadow: EDGE_RING, padding: "14px 15px 13px" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8 }}>{value}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {!lockedTab && (
          <div style={{ padding: "12px 24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["news", "Wire"], ["ai", "AI Insight"]].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                style={{
                  background: tab === value ? "linear-gradient(180deg,rgba(255,255,255,0.1),#111c30)" : PANEL_BG_ALT,
                  border: tab === value ? "1px solid rgba(248,250,252,0.16)" : "1px solid rgba(148,163,184,0.12)",
                  borderRadius: 12,
                  color: tab === value ? "#fff" : MUTED_TEXT,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 12,
                  padding: "9px 12px",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, color: MUTED_TEXT, textAlign: "center" }}>Loading news feed...</div>
        ) : tab === "news" && visibleArticles.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.18fr) 350px", gap: 0, alignItems: "start" }}>
            <a href={featured.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit", display: "block", alignSelf: "start", height: "fit-content" }}>
              <article style={{ padding: featuredCompact ? 18 : 22, borderRight: `1px solid ${HAIRLINE}`, height: "fit-content" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#67e8f9" }}>{featured.source || "Source"}</span>
                  {featured.published_at && <span style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatPublished(featured.published_at)}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : featuredCompact ? "minmax(0,1fr) 236px" : "minmax(0,1.06fr) 304px", gap: featuredCompact ? 14 : 20, alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: isMobile ? (featuredCompact ? 22 : 26) : (featuredCompact ? 28 : 34), fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.04, marginBottom: 12 }}>{featured.title}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.76, color: MUTED_TEXT }}>
                      {previewText(featured.summary || "Open the article for the full report.", featuredCompact ? 620 : 1080)}
                    </div>
                    <div style={{ marginTop: 14, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e2e8f0" }}>
                      Open full story
                    </div>
                  </div>
                  <NewsVisual article={featured} height={featuredCompact ? 198 : 254} />
                </div>
              </article>
            </a>

            <div style={{ background: PANEL_BG, alignSelf: "start" }}>
              <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                  Fast feed
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>Need-to-know headlines</div>
              </div>
              <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
                {ticker.map((article) => (
                  <a key={article.id} href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}
                    onMouseEnter={() => setHoveredFeedId(`ticker-${article.id}`)}
                    onMouseLeave={() => setHoveredFeedId(null)}
                  >
                    <article style={{ padding: "14px 16px 13px", background: hoveredFeedId === `ticker-${article.id}` ? "rgba(255,255,255,0.05)" : PANEL_BG, transition: "background 180ms ease", display: "grid", gridTemplateColumns: "96px minmax(0,1fr)", gap: 12, alignItems: "center" }}>
                      <NewsVisual article={article} height={78} compact />
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 7, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#67e8f9" }}>{article.source || "Source"}</span>
                          {article.published_at && <span style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatPublished(article.published_at)}</span>}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>{article.title}</div>
                        <div style={{ fontSize: 12, lineHeight: 1.6, color: MUTED_TEXT, marginTop: 6 }}>
                          {previewText(article.summary || "Open the article for the full report.", 140)}
                        </div>
                      </div>
                    </article>
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : tab === "news" ? (
          <div style={{ padding: 24 }}>
            <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4, marginBottom: 8 }}>No ingested stories yet</div>
              <div style={{ fontSize: 13, lineHeight: 1.72, color: MUTED_TEXT }}>
                The feed is ready. Once `news_articles` starts receiving content, this page will switch from setup state to a live race-week news surface automatically.
              </div>
            </div>
          </div>
        ) : insight ? (
          <div style={{ display: "grid", gap: 16, padding: 18 }}>
            <section style={{ borderRadius: 24, border: CARD_BORDER, background: PANEL_GRADIENT, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
              <div
                style={{
                  padding: isMobile ? "22px 18px" : "26px 28px 24px",
                  borderBottom: `1px solid ${HAIRLINE}`,
                  background: "radial-gradient(circle at 12% 8%,rgba(255,106,26,0.18),transparent 28%), radial-gradient(circle at 86% 14%,rgba(45,212,191,0.14),transparent 30%), linear-gradient(180deg,rgba(21,35,56,0.96),rgba(10,18,32,0.98))",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.35fr) minmax(280px,0.65fr)", gap: 20, alignItems: "stretch" }}>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 18 }}>
                    <div>
                      <div style={{ ...ACCENT_LABEL_STYLE, marginBottom: 8 }}>Race briefing</div>
                      <div style={{ fontSize: isMobile ? 32 : 48, fontWeight: 950, letterSpacing: isMobile ? -1.5 : -2.2, lineHeight: 0.98, maxWidth: 820, marginBottom: 14 }}>
                        {insight.headline}
                      </div>
                      <div style={{ fontSize: isMobile ? 15 : 17, lineHeight: 1.78, color: "rgba(226,232,240,0.82)", maxWidth: 820 }}>
                        {insight.summary}
                      </div>
                    </div>

                    {insight?.metadata?.freshness_status === "stale" && insight?.metadata?.stale_reason && (
                      <div style={{ borderRadius: 16, border: "1px solid rgba(245,158,11,0.26)", background: "rgba(245,158,11,0.1)", padding: "12px 14px", fontSize: 12, lineHeight: 1.7, color: "#fcd34d", maxWidth: 820 }}>
                        {insight.metadata.stale_reason}
                      </div>
                    )}
                  </div>

                  <div style={{ borderRadius: 22, border: CARD_BORDER, background: "rgba(3,8,18,0.44)", padding: 14, display: "grid", gap: 10, boxShadow: EDGE_RING }}>
                    <MetricCard label="Target race" value={insight.race_name || currentRace?.n || "Upcoming GP"} detail={currentRace?.date ? formatPublished(currentRace.date) : "Live calendar target"} />
                    <MetricCard label="Confidence" value={typeof insight.confidence === "number" ? `${Math.round(insight.confidence * 100)}%` : "N/A"} detail="Model confidence for the saved brief." />
                    <MetricCard label="Inputs" value={String(insight.source_count || sourceCount || 0)} detail={`Generated ${insight.generated_at ? formatPublished(insight.generated_at) : "recently"}`} />
                  </div>
                </div>
              </div>

              <div style={{ padding: 16, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 12 }}>
                {[
                  ["Race memory", previousRace?.winner ? `${previousRace.winner} won ${previousRace.race_name || "last time"}` : "Waiting for completed history", previousRace?.pole ? `Pole: ${previousRace.pole}` : "Official results drive this card"],
                  ["Primary angle", briefHighlights[0]?.title || "No headline angle yet", briefHighlights[0]?.detail || "Regenerate the brief from Admin once more race-week data exists."],
                  ["Board pressure", aiPredictions[0]?.pick ? `${aiPredictions[0].pick} leads ${aiPredictions[0].category}` : "No category call yet", aiPredictions[0]?.reason || "Category picks appear after AI generation."],
                ].map(([label, value, detail]) => <MetricCard key={label} label={label} value={value} detail={previewText(detail, 126)} />)}
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.05fr) minmax(320px,0.95fr)", gap: 16 }}>
              <div style={{ borderRadius: 24, border: CARD_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                <SectionHeader eyebrow="The read" title="What matters before lock" />
                <div style={{ padding: 16, display: "grid", gap: 14 }}>
                  <div style={{ borderRadius: 18, border: CARD_BORDER_SOFT, background: PANEL_BG_ALT, padding: "16px 17px", fontSize: 14, lineHeight: 1.86, color: "rgba(226,232,240,0.82)", boxShadow: EDGE_RING }}>
                    {raceSummary ? previewText(raceSummary.replace(/\s+/g, " "), 620) : insight.summary}
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {(briefHighlights.length ? briefHighlights : [{
                      title: "No brief highlights yet",
                      detail: "Regenerate the AI brief from Admin once more race-week data exists.",
                      tone: "#93c5fd",
                      label: "Setup",
                    }]).map((item, index) => (
                      <button
                        key={`${item.title}-${index}`}
                        onClick={() => setExpandedInsight({
                          eyebrow: item.label,
                          title: item.title,
                          fields: [["Takeaway", item.detail]],
                        })}
                        style={{ width: "100%", textAlign: "left", borderRadius: 18, border: CARD_BORDER_SOFT, background: "rgba(21,35,56,0.82)", padding: "14px 15px", cursor: "pointer", boxShadow: EDGE_RING }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.tone, boxShadow: `0 0 0 5px ${item.tone}14` }} />
                          <div style={MUTED_LABEL_STYLE}>{item.label}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.25, letterSpacing: -0.35, marginBottom: 7 }}>{item.title}</div>
                        <div style={{ fontSize: 12, lineHeight: 1.72, color: MUTED_TEXT }}>{previewText(item.detail, 180)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ borderRadius: 24, border: CARD_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                <SectionHeader eyebrow="Evidence" title="History and wire signals" />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 1, background: HAIRLINE }}>
                  {[
                    ["Last winner", previousRace?.winner || "N/A", previousRace?.race_name ? `From ${previousRace.race_name}` : "No completed race stored yet"],
                    ["Hot driver", recentDriverLeader?.driver || "N/A", recentDriverLeader ? `${recentDriverLeader.points} pts in recent rounds` : "Waiting for more completed rounds"],
                    ["Hot constructor", recentConstructorLeader?.team || "N/A", recentConstructorLeader ? `${recentConstructorLeader.points} pts recently` : "No recent constructor trend yet"],
                    ["Volatility", seasonVolatility?.average_dnfs_per_race != null ? `${seasonVolatility.average_dnfs_per_race} DNFs/race` : "N/A", seasonVolatility?.safety_car_rate != null ? `Safety car rate ${Math.round(seasonVolatility.safety_car_rate * 100)}%` : "No volatility sample yet"],
                  ].map(([label, value, detail]) => (
                    <div key={label} style={{ background: PANEL_BG, padding: "14px 16px" }}>
                      <div style={{ ...MUTED_LABEL_STYLE, marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{value}</div>
                      <div style={{ fontSize: 12, lineHeight: 1.66, color: MUTED_TEXT }}>{detail}</div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: 14, display: "grid", gap: 10, borderTop: `1px solid ${HAIRLINE}` }}>
                  {historicalResults.length > 0 && (
                    <div style={{ borderRadius: 16, border: CARD_BORDER_SOFT, background: PANEL_BG_ALT, padding: "12px 13px" }}>
                      <div style={{ ...MUTED_LABEL_STYLE, marginBottom: 6 }}>Recent completed rounds</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {historicalResults.slice(0, 3).map((item) => (
                          <div key={`${item.race_round}-${item.race_name}`} style={{ fontSize: 12, lineHeight: 1.66, color: MUTED_TEXT }}>
                            <span style={{ color: "#fff", fontWeight: 800 }}>{item.race_name || `Round ${item.race_round}`}</span>
                            {" · Winner "}
                            <span style={{ color: "#fff" }}>{item.winner || "N/A"}</span>
                            {" · Pole "}
                            <span style={{ color: "#fff" }}>{item.pole || "N/A"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {newsDigest.slice(0, 3).map((item, index) => (
                    <button
                      key={`${item.headline}-${index}`}
                      onClick={() => setExpandedInsight(detailOverlayPayload("digest", item))}
                      style={{ width: "100%", textAlign: "left", borderRadius: 16, border: CARD_BORDER_SOFT, background: PANEL_BG_ALT, padding: "12px 13px", cursor: "pointer" }}
                    >
                      <div style={{ ...MUTED_LABEL_STYLE, color: "#67e8f9", marginBottom: 6 }}>Wire signal</div>
                      <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 5 }}>{item.headline}</div>
                      <div style={{ fontSize: 12, lineHeight: 1.66, color: MUTED_TEXT }}>{previewText(item.why_it_matters || item.detail, 130)}</div>
                    </button>
                  ))}

                  {crowdFavorite && (
                    <div style={{ borderRadius: 16, border: CARD_BORDER_SOFT, background: PANEL_BG_ALT, padding: "12px 13px", fontSize: 12, lineHeight: 1.66, color: MUTED_TEXT }}>
                      <span style={{ color: "#fff", fontWeight: 800 }}>Fantasy market:</span> players most often backed {crowdFavorite.pick} in {crowdFavorite.category}, with {Math.round((crowdFavorite.share || 0) * 100)}% share and {Math.round((crowdFavorite.accuracy || 0) * 100)}% hit rate.
                    </div>
                  )}

                  {(previousRaceWeather || previousRaceStrategy) && (
                    <div style={{ borderRadius: 16, border: CARD_BORDER_SOFT, background: PANEL_BG_ALT, padding: "12px 13px", fontSize: 12, lineHeight: 1.66, color: MUTED_TEXT }}>
                      <span style={{ color: "#fff", fontWeight: 800 }}>Last-race conditions:</span>{" "}
                      {previousRaceWeather?.rainfall === true ? "wet running" : "mainly dry running"}
                      {previousRaceStrategy?.most_common_opening_compound ? ` · most common opening tyre ${previousRaceStrategy.most_common_opening_compound}` : ""}
                      {previousRaceStrategy?.average_pit_stops_per_driver != null ? ` · avg ${previousRaceStrategy.average_pit_stops_per_driver} pit stops/driver` : ""}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section style={{ borderRadius: 24, border: CARD_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
              <SectionHeader
                eyebrow="Suggested board"
                title="Category calls at a glance"
                action={<span style={{ borderRadius: 999, border: "1px solid rgba(59,130,246,0.24)", background: "rgba(59,130,246,0.12)", color: "#dbeafe", padding: "7px 10px", fontSize: 11, fontWeight: 800 }}>{aiPredictions.length || 0} AI picks</span>}
              />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 1, background: HAIRLINE }}>
                {(aiPredictions.length ? aiPredictions : [{ category: "Waiting", pick: "No AI picks yet", reason: "Generate the AI brief from Admin to fill the category board.", confidence: null }]).map((item, index) => (
                  <div key={`${item.category}-${index}`} style={{ background: PANEL_BG, padding: "16px 17px", position: "relative", overflow: "hidden" }}>
                    <div aria-hidden="true" style={{ position: "absolute", inset: "0 auto 0 0", width: 3, background: "linear-gradient(180deg,#67e8f9,#3b82f6)" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                      <div style={MUTED_LABEL_STYLE}>{item.category}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#dbeafe", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.24)", borderRadius: 999, padding: "4px 8px" }}>
                        {typeof item.confidence === "number" ? `${Math.round(item.confidence * 100)}%` : "AI"}
                      </div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: -0.5, marginBottom: 7, lineHeight: 1.12 }}>{item.pick}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.72, color: MUTED_TEXT }}>{previewText(item.reason, 150)}</div>
                  </div>
                ))}
              </div>
            </section>

            {(insight.watchlist || []).length > 0 && (
              <section style={{ borderRadius: 24, border: CARD_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                <SectionHeader eyebrow="Watch before lock" title="Late movers" />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 1, background: HAIRLINE }}>
                  {(insight.watchlist || []).map((item, index) => (
                    <button key={`${item.label}-${index}`} onClick={() => setExpandedInsight(detailOverlayPayload("watch", item))} style={{ width: "100%", textAlign: "left", border: "none", background: PANEL_BG, padding: "16px 18px", cursor: "pointer" }}>
                      <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 6 }}>{item.label}</div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT, marginBottom: 8 }}>{previewText(item.trigger || item.reason, 140)}</div>
                      <div style={{ fontSize: 11, lineHeight: 1.65, color: SUBTLE_TEXT }}>React: {previewText(item.how_to_react, 96)}</div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div style={{ padding: 24 }}>
            <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4, marginBottom: 8 }}>
                {insightStale ? "AI Insight is out of date" : "No AI Insight generated yet"}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.72, color: MUTED_TEXT }}>
                {insightStale && currentRace
                  ? `The latest saved brief does not match ${currentRace.n}. Regenerate the AI brief from Admin so this page uses the current calendar.`
                  : "Generate an AI Insight read from the Admin page and this tab will show the race summary plus picks for the main categories."}
              </div>
            </div>
          </div>
        )}
      </section>

      {tab === "news" && (remainingArticles.length > 0) && (
        <section style={{ borderRadius: 24, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 18 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                Full feed
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>Latest from the wire</div>
            </div>
            {/* Search input (#42) */}
            <input
              type="search"
              placeholder="Search stories…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: PANEL_BG,
                border: "1px solid rgba(214,223,239,0.14)",
                borderRadius: 999,
                color: "#fff",
                padding: "8px 16px",
                fontSize: 13,
                outline: "none",
                width: isMobile ? "100%" : 200,
                fontFamily: "inherit",
              }}
            />
          </div>

          {feed.length > 0 ? (
            <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
              {feed.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                  onMouseEnter={() => setHoveredFeedId(article.id)}
                  onMouseLeave={() => setHoveredFeedId(null)}
                >
                  <article style={{
                    background: hoveredFeedId === article.id ? "rgba(255,255,255,0.05)" : PANEL_BG,
                    transition: "background 180ms ease",
                    padding: "16px 18px",
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "148px minmax(0,1fr)",
                    gap: 16,
                    alignItems: "center",
                  }}>
                    {!isMobile && <NewsVisual article={article} height={108} />}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#67e8f9" }}>{article.source || "Source"}</span>
                          {article.published_at && <span style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatPublished(article.published_at)}</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2, letterSpacing: -0.4, marginBottom: 7 }}>{article.title}</div>
                      <div style={{ fontSize: 13, lineHeight: 1.76, color: MUTED_TEXT }}>{previewText(article.summary || "Open the article to read more.", isMobile ? 340 : 560)}</div>
                    </div>
                    {isMobile && <NewsVisual article={article} height={146} />}
                  </article>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ padding: "28px 20px", textAlign: "center", color: MUTED_TEXT, fontSize: 14 }}>
              No stories match <strong style={{ color: "#fff" }}>"{searchQuery}"</strong>
            </div>
          )}
        </section>
      )}

      {tab === "news" && <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        {SOURCE_CARDS.map((source) => (
          <a key={source.name} href={source.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ borderRadius: 20, border: PANEL_BORDER, background: PANEL_BG, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.4 }}>{source.name}</div>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2dd4bf" }}>{source.role}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.65, color: MUTED_TEXT }}>{source.detail}</div>
            </div>
          </a>
        ))}
      </section>}

      {expandedInsight && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(3,8,18,0.72)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "min(760px,100%)", maxHeight: "calc(100vh - 48px)", overflowY: "auto", borderRadius: 24, border: PANEL_BORDER, background: PANEL_BG, boxShadow: "0 30px 90px rgba(0,0,0,0.45)" }}>
            <div style={{ padding: "18px 20px 16px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#67e8f9", marginBottom: 6 }}>
                  {expandedInsight.eyebrow}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.9, lineHeight: 1.05 }}>{expandedInsight.title}</div>
              </div>
              <button onClick={() => setExpandedInsight(null)} style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, color: "#fff", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>
                ×
              </button>
            </div>

            <div style={{ padding: 20, display: "grid", gap: 14 }}>
              {expandedInsight.fields.map(([label, value]) => (
                <div key={label} style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "14px 15px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.85, color: MUTED_TEXT, whiteSpace: "pre-wrap" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
