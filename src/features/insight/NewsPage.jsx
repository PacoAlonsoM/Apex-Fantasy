import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { chooseInsightForRace } from "@/src/lib/aiInsight";
import { nextRace } from "@/src/constants/calendar";
import { ACCENT, CONTENT_MAX, EDGE_RING, LIFTED_SHADOW, PANEL_BG, PANEL_BG_ALT, PANEL_BORDER, MUTED_TEXT, SUBTLE_TEXT, HAIRLINE, SUCCESS, WARM } from "@/src/constants/design";
import { IS_SNAPSHOT } from "@/src/lib/runtimeFlags";
import { DRV, TEAMS } from "@/src/constants/teams";
import useRaceCalendar from "@/src/lib/useRaceCalendar";
import usePageMetadata from "@/src/lib/usePageMetadata";
import useViewport from "@/src/lib/useViewport";
import PageHeader from "@/src/ui/PageHeader";

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

const CATEGORY_LABELS = {
  pole: "Pole Position",
  winner: "Race Winner",
  p2: "P2",
  p3: "P3",
  dnf: "DNF Pick",
  fl: "Fastest Lap",
  dotd: "Driver of the Day",
  ctor: "Constructor",
  sc: "Safety Car",
  rf: "Red Flag",
  sp_pole: "Sprint Pole",
  sp_winner: "Sprint Winner",
  sp_p2: "Sprint P2",
  sp_p3: "Sprint P3",
};

const CATEGORY_TYPE_COLOR = {
  driver: { bg: "rgba(255,106,26,0.12)", border: "rgba(255,106,26,0.28)", text: "#fed7aa" },
  constructor: { bg: "rgba(45,212,191,0.1)", border: "rgba(45,212,191,0.26)", text: "#99f6e4" },
  binary: { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.22)", text: "#94a3b8" },
};

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
    const leftScore = leftSummary + (left.image_url ? 420 : 0) + leftRecency;
    const rightScore = rightSummary + (right.image_url ? 420 : 0) + rightRecency;
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

function NewsVisual({ article, height = 128, compact = false }) {
  const visual = articleVisualStyle(article.source);
  const [imgFailed, setImgFailed] = useState(false);

  if (article.image_url && !IS_SNAPSHOT && !imgFailed) {
    return (
      <div
        style={{
          width: "100%",
          height,
          borderRadius: compact ? 16 : 18,
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
          boxShadow: `0 20px 42px ${visual.glow}`,
        }}
      >
        <img
          src={article.image_url}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.34))",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: compact ? 16 : 18,
        border: "1px solid rgba(148,163,184,0.12)",
        background: visual.gradient,
        boxShadow: `0 20px 42px ${visual.glow}`,
        padding: compact ? "12px 12px 11px" : "16px 16px 14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: visual.label }}>
        {article.source || "F1 feed"}
      </div>
      <div style={{ fontSize: compact ? 13 : 16, fontWeight: 800, lineHeight: 1.24, color: "#f8fafc", letterSpacing: -0.3 }}>
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

export default function NewsPage({ initialTab = "news", lockedTab = null, user = null }) {
  const { isMobile, isTablet } = useViewport();
  const { calendar } = useRaceCalendar(2026);
  const [articles, setArticles] = useState([]);
  const [insight, setInsight] = useState(null);
  const [insightStale, setInsightStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasTable, setHasTable] = useState(true);
  const [tab, setTab] = useState(lockedTab || initialTab);
  const [expandedInsight, setExpandedInsight] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredFeedId, setHoveredFeedId] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [raceSummaryExpanded, setRaceSummaryExpanded] = useState(false);
  const currentRace = useMemo(() => nextRace(calendar) || calendar[0] || null, [calendar]);

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
        const rows = insightResponse.data || [];
        const matched = chooseInsightForRace(rows, currentRace);
        setInsight(matched);
        setInsightStale(rows.length > 0 && !matched);
      }

      setLoading(false);
    }

    loadNews();
    return () => { ignore = true; };
  }, [currentRace]);

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
  const headerTitle = tab === "news" ? (
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
  );
  const headerDescription = loading
    ? "Loading race-week feed..."
    : tab === "news"
      ? hasTable ? `${visibleArticles.length} stories cleaned into one F1 feed` : "Waiting for ingest setup"
      : insight ? "AI Insight summary and category picks generated from Wire + OpenF1 context" : "Generate one AI Insight read from Admin to unlock this tab";
  const headerAside = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
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
  );

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <PageHeader
        eyebrow={tab === "news" ? "Wire" : "AI Insight"}
        title={headerTitle}
        description={headerDescription}
        aside={headerAside}
        asideWidth={360}
        marginBottom={18}
        bgImage={tab === "news" ? "/images/header-wire.png" : "/images/header-insight.png"}
      />

      <section style={{ borderRadius: 28, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 18, boxShadow: LIFTED_SHADOW }}>

        {!lockedTab && (
          <div style={{ padding: "12px 24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["news", "Wire"], ["ai", "AI Insight"]].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                style={{
                  background: tab === value ? "linear-gradient(180deg,rgba(255,255,255,0.1),#111c30)" : PANEL_BG_ALT,
                  border: tab === value ? `1px solid ${ACCENT}44` : "1px solid rgba(148,163,184,0.12)",
                  borderRadius: 999,
                  color: tab === value ? "#fff" : MUTED_TEXT,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 12,
                  padding: "9px 18px",
                  transition: "border-color 180ms ease, color 180ms ease",
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
              <article style={{ padding: featuredCompact ? 18 : 22, borderRight: `1px solid ${HAIRLINE}`, borderLeft: `3px solid ${ACCENT}`, height: "fit-content" }}>
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
          <div>
            {/* ── 1. Hero Brief ── */}
            <div style={{ padding: isMobile ? "22px 20px 20px" : "28px 28px 24px", background: "linear-gradient(135deg,rgba(103,232,249,0.05) 0%,rgba(14,22,38,0.97) 60%)", borderBottom: `1px solid ${HAIRLINE}` }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "#67e8f9", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span>AI Race Brief</span>
                {(insight.race_name || currentRace?.n) && (
                  <>
                    <span style={{ color: SUBTLE_TEXT }}>·</span>
                    <span style={{ fontWeight: 700 }}>{insight.race_name || currentRace?.n}</span>
                  </>
                )}
              </div>
              <h2 style={{ margin: "0 0 14px", fontSize: isMobile ? 26 : 40, fontWeight: 900, letterSpacing: -1.4, lineHeight: 1.03, maxWidth: 740 }}>
                {insight.headline}
              </h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.82, color: MUTED_TEXT, maxWidth: 680 }}>
                {insight.summary}
              </p>
              {user?.subscription_status === "pro" && typeof insight.confidence === "number" && (
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: insight.confidence >= 0.75 ? "#22c55e" : insight.confidence >= 0.55 ? "#fbbf24" : "#f87171" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: SUBTLE_TEXT }}>
                    {Math.round(insight.confidence * 100)}% model confidence · {insight.source_count || 0} sources read
                  </span>
                </div>
              )}
            </div>

            {/* ── 2. Category Picks ── */}
            {aiPredictions.length > 0 && (() => {
              const isPro = user?.subscription_status === "pro";

              if (isPro) {
                return (
                  <div style={{ padding: isMobile ? "18px 18px 14px" : "22px 24px 18px", borderBottom: `1px solid ${HAIRLINE}` }}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 16 }}>
                      {aiPredictions.length} Category Calls
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "repeat(3,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 10 }}>
                      {aiPredictions.map((item, idx) => {
                        let accentColor = ACCENT;
                        if (item.type === "driver") {
                          const dr = DRV.find((d) => d.n === item.pick);
                          const tm = dr ? TEAMS[dr.t] : null;
                          if (tm?.c) accentColor = tm.c;
                        } else if (item.type === "constructor") {
                          const tm = TEAMS[item.pick];
                          if (tm?.c) accentColor = tm.c;
                        } else if (item.type === "binary") {
                          accentColor = item.pick === "Yes" ? "#22c55e" : "#ef4444";
                        }
                        const confRaw = item.confidence;
                        const confNum = typeof confRaw === "number" ? confRaw : (confRaw === "high" || confRaw === "confident") ? 0.85 : confRaw === "medium" ? 0.6 : 0.35;
                        const confColor = confNum >= 0.75 ? "#86efac" : confNum >= 0.55 ? "#fde68a" : "#fca5a5";
                        const confLabel = confNum >= 0.75 ? "High" : confNum >= 0.55 ? "Medium" : "Low";
                        return (
                          <div key={item.key || idx} style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.10)", borderLeft: `3px solid ${accentColor}`, background: PANEL_BG_ALT, padding: "14px 14px 12px" }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>
                              {CATEGORY_LABELS[item.key] || item.category || item.key}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, marginBottom: 8, lineHeight: 1.1 }}>
                              {item.pick}
                            </div>
                            <div style={{ fontSize: 11, lineHeight: 1.62, color: MUTED_TEXT, marginBottom: 8 }}>
                              {previewText(item.reason, 96)}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: confColor, flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 700, color: confColor }}>{confLabel}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Free user teaser
              return (
                <div style={{ padding: isMobile ? "18px 18px 14px" : "22px 24px 18px", borderBottom: `1px solid ${HAIRLINE}`, position: "relative", overflow: "hidden" }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 16 }}>
                    Category Calls
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,minmax(0,1fr))", gap: 10, filter: "blur(6px)", pointerEvents: "none", userSelect: "none" }}>
                    {aiPredictions.slice(0, 4).map((item, idx) => (
                      <div key={idx} style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,0.10)", borderLeft: "3px solid rgba(255,106,26,0.5)", background: PANEL_BG_ALT, padding: "14px 14px 12px" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>
                          {CATEGORY_LABELS[item.key] || item.key}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, marginBottom: 8 }}>??? ???</div>
                        <div style={{ fontSize: 11, lineHeight: 1.62, color: MUTED_TEXT, marginBottom: 8 }}>Pro insight available</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fde68a" }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#fde68a" }}>Medium</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "linear-gradient(180deg,transparent 0%,rgba(10,16,27,0.92) 35%,rgba(10,16,27,0.97) 100%)", paddingBottom: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", textAlign: "center", letterSpacing: -0.2 }}>
                      {aiPredictions.length} category calls + race brief
                    </div>
                    <div style={{ fontSize: 12, color: MUTED_TEXT, textAlign: "center" }}>Full AI race analysis for Pro members</div>
                    <a href="/?page=pro" style={{ background: "linear-gradient(135deg,#FF6A1A,#e05a12)", borderRadius: 999, color: "#fff", fontSize: 13, fontWeight: 800, padding: "10px 24px", textDecoration: "none", whiteSpace: "nowrap" }}>
                      Upgrade to Pro
                    </a>
                  </div>
                </div>
              );
            })()}

            {/* ── 3. Race Context (Pro) ── */}
            {user?.subscription_status === "pro" && raceSummary && (
              <div style={{ padding: isMobile ? "16px 18px" : "20px 24px", borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
                  Race Context
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.82, color: "rgba(226,232,240,0.82)" }}>
                  {raceSummaryExpanded ? raceSummary : previewText(raceSummary, 480)}
                </p>
                {raceSummary.length > 480 && (
                  <button
                    onClick={(e) => { e.preventDefault(); setRaceSummaryExpanded((v) => !v); }}
                    style={{ marginTop: 8, background: "none", border: "none", color: "#67e8f9", fontSize: 11, fontWeight: 800, cursor: "pointer", padding: 0, letterSpacing: "0.04em" }}
                  >
                    {raceSummaryExpanded ? "Less ↑" : "More ↓"}
                  </button>
                )}
              </div>
            )}

            {/* ── 4. Weekend Angles (Pro) ── */}
            {user?.subscription_status === "pro" && briefHighlights.length > 0 && (
              <div style={{ padding: isMobile ? "16px 18px" : "20px 24px", borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 14 }}>
                  Weekend Angles
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {briefHighlights.map((item, idx) => (
                    <div key={`brief-${idx}`} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "11px 13px", borderRadius: 12, background: PANEL_BG_ALT, borderLeft: `3px solid ${item.tone}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{item.title}</div>
                        <div style={{ fontSize: 11, lineHeight: 1.65, color: MUTED_TEXT }}>{previewText(item.detail, 130)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 5. Recent Signals (Pro) ── */}
            {user?.subscription_status === "pro" && (recentDriverLeader || previousRace?.winner || seasonVolatility) && (
              <div style={{ padding: isMobile ? "16px 18px" : "20px 24px", borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 14 }}>
                  Recent Signals
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10 }}>
                  {[
                    ["Last Winner", previousRace?.winner || "N/A", "#e2e8f0"],
                    ["Hot Driver", recentDriverLeader?.driver || "N/A", ACCENT],
                    ["Hot Constructor", recentConstructorLeader?.team || "N/A", "#2dd4bf"],
                    ["SC Rate", seasonVolatility?.safety_car_rate != null ? `${Math.round(seasonVolatility.safety_car_rate * 100)}%` : "N/A", "#fde68a"],
                  ].map(([label, value, accent]) => (
                    <div key={label} style={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.10)", background: PANEL_BG_ALT, padding: "12px 13px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: accent, letterSpacing: -0.3 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 6. Watch Before Lock (Pro) ── */}
            {user?.subscription_status === "pro" && (insight.watchlist || []).length > 0 && (
              <div style={{ padding: isMobile ? "16px 18px 22px" : "20px 24px 26px" }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 14 }}>
                  Watch Before Lock
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 8 }}>
                  {(insight.watchlist || []).map((item, idx) => (
                    <div key={`watch-${idx}`} style={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "13px 15px" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>{item.label}</div>
                      <div style={{ fontSize: 11, lineHeight: 1.65, color: MUTED_TEXT, marginBottom: item.how_to_react ? 7 : 0 }}>{previewText(item.trigger || item.reason, 110)}</div>
                      {item.how_to_react && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#67e8f9", lineHeight: 1.5 }}>→ {previewText(item.how_to_react, 80)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                background: PANEL_BG,
                border: searchFocused ? `1px solid ${ACCENT}88` : "1px solid rgba(214,223,239,0.14)",
                borderRadius: 999,
                color: "#fff",
                padding: "8px 16px",
                fontSize: 13,
                outline: "none",
                width: isMobile ? "100%" : 200,
                fontFamily: "inherit",
                transition: "border-color 180ms ease",
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
                    {!isMobile && (
                      <div style={{ borderRadius: 18, overflow: "hidden", flexShrink: 0, transition: "transform 220ms ease", transform: hoveredFeedId === article.id ? "scale(1.04)" : "scale(1)" }}>
                        <NewsVisual article={article} height={108} />
                      </div>
                    )}
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
            <div style={{ borderRadius: 24, border: PANEL_BORDER, background: PANEL_BG, padding: 18, transition: "border-color 180ms ease" }}>
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
