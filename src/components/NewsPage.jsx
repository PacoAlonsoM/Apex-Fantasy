import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { ACCENT, CONTENT_MAX, EDGE_RING, LIFTED_SHADOW, PANEL_BG, PANEL_BG_ALT, PANEL_BORDER, MUTED_TEXT, SUBTLE_TEXT, HAIRLINE } from "../constants/design";
import { IS_SNAPSHOT } from "../runtimeFlags";
import usePageMetadata from "../usePageMetadata";
import useViewport from "../useViewport";

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

  if (article.image_url && !IS_SNAPSHOT) {
    return (
      <div
        style={{
          width: "100%",
          height,
          borderRadius: compact ? 16 : 18,
          backgroundImage: `linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.34)),url(${article.image_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: `0 20px 42px ${visual.glow}`,
        }}
      />
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

export default function NewsPage({ initialTab = "news", lockedTab = null }) {
  const { isMobile, isTablet } = useViewport();
  const [articles, setArticles] = useState([]);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasTable, setHasTable] = useState(true);
  const [tab, setTab] = useState(lockedTab || initialTab);
  const [expandedInsight, setExpandedInsight] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredFeedId, setHoveredFeedId] = useState(null);

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
          .limit(1)
          .maybeSingle(),
      ]);

      if (ignore) return;

      if (error) {
        setHasTable(false);
        setArticles([]);
      } else {
        setHasTable(true);
        setArticles(data || []);
      }

      setInsight(insightResponse.error ? null : (insightResponse.data || null));

      setLoading(false);
    }

    loadNews();
    return () => { ignore = true; };
  }, []);

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
  const featuredCompact = (featured?.summary?.length || 0) < 260;

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
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                {tab === "news" ? "Wire" : "AI Insight"}
              </div>
              <h1 style={{ fontSize: isMobile ? 40 : 58, lineHeight: 0.95, margin: "0 0 10px", letterSpacing: isMobile ? -1.6 : -2.9 }}>
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
              <div style={{ fontSize: 14, lineHeight: 1.8, color: MUTED_TEXT, maxWidth: 620 }}>
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
                    <div style={{ fontSize: featuredCompact ? 28 : 34, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.04, marginBottom: 12 }}>{featured.title}</div>
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
          <div style={{ display: "grid", gap: 18, padding: 18 }}>
            <section style={{ borderRadius: 22, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, overflow: "hidden" }}>
              <div style={{ padding: "20px 22px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.25fr) 280px", gap: 18, alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#67e8f9", marginBottom: 6 }}>
                      AI Insight
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1, marginBottom: 10 }}>
                      {insight.headline}
                    </div>
                    <div style={{ fontSize: 15, lineHeight: 1.84, color: MUTED_TEXT }}>
                      {insight.summary}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                        Target race
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>{insight.race_name || "Upcoming GP"}</div>
                    </div>
                    <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                        Confidence
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>
                        {typeof insight.confidence === "number" ? `${Math.round(insight.confidence * 100)}%` : "N/A"}
                      </div>
                    </div>
                    <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                        Inputs used
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>
                        {insight.source_count || sourceCount || 0} sources
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: "16px 22px 18px", background: PANEL_BG }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>
                  How to use this read
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.82, color: MUTED_TEXT, maxWidth: 920 }}>
                  Start with the long race summary for the full weekend picture, then open the factor, edge and watchlist cards below for the deeper read behind the brief category picks. The goal is to give you enough usable context here that you only open individual articles if you want the full source detail.
                </div>
              </div>

              <div style={{ padding: "12px 18px", borderTop: `1px solid ${HAIRLINE}`, fontSize: 11, color: SUBTLE_TEXT }}>
                Generated {insight.generated_at ? formatPublished(insight.generated_at) : "recently"} from recent news + OpenF1 race context.
              </div>
            </section>

            {raceSummary && (
              <section style={{ borderRadius: 22, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#67e8f9", marginBottom: 4 }}>
                    Race Summary
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>
                    The full weekend read
                  </div>
                </div>
                <div style={{ padding: "18px 20px", fontSize: 14, lineHeight: 1.9, color: MUTED_TEXT, whiteSpace: "pre-wrap" }}>
                  {raceSummary}
                </div>
              </section>
            )}

            {newsDigest.length > 0 && (
              <section style={{ borderRadius: 22, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#67e8f9", marginBottom: 4 }}>
                    News Digest
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>
                    The storylines behind the brief
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2,minmax(0,1fr))" : "repeat(3,minmax(0,1fr))", gap: 12, padding: 16 }}>
                  {newsDigest.map((item, index) => (
                    <button
                      key={`${item.headline}-${index}`}
                      onClick={() => setExpandedInsight(detailOverlayPayload("digest", item))}
                      style={{ width: "100%", textAlign: "left", borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "14px 14px 13px", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{item.headline}</div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT }}>{previewText(item.detail || item.why_it_matters, 210)}</div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {(previousRace || previousRaceWeather || previousRaceStrategy) && (
              <section style={{ borderRadius: 22, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#67e8f9", marginBottom: 4 }}>
                    OpenF1 Context
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>
                    What the last race is telling us
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 1, background: HAIRLINE }}>
                  <div style={{ background: PANEL_BG, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>Last winner</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{previousRace?.winner || "N/A"}</div>
                  </div>
                  <div style={{ background: PANEL_BG, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>DNFs</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{previousRace?.dnfCount ?? "N/A"}</div>
                  </div>
                  <div style={{ background: PANEL_BG, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>Safety cars</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{previousRace?.safetyCarCount ?? "N/A"}</div>
                  </div>
                  <div style={{ background: PANEL_BG, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>Avg stints / driver</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{previousRaceStrategy?.average_stints_per_driver ?? "N/A"}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1.2fr 1fr", gap: 1, background: HAIRLINE }}>
                  <div style={{ background: PANEL_BG, padding: "16px 18px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Previous race podium</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(previousRace?.podium || []).map((driver) => (
                        <span key={driver} style={{ fontSize: 12, fontWeight: 800, color: "#dbeafe", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.24)", borderRadius: 999, padding: "6px 10px" }}>
                          {driver}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: PANEL_BG, padding: "16px 18px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Weather snapshot</div>
                    <div style={{ display: "grid", gap: 6, fontSize: 12, color: MUTED_TEXT }}>
                      <div>Air temp avg: <span style={{ color: "#fff", fontWeight: 700 }}>{previousRaceWeather?.air_temperature_avg ?? "N/A"}</span></div>
                      <div>Track temp avg: <span style={{ color: "#fff", fontWeight: 700 }}>{previousRaceWeather?.track_temperature_avg ?? "N/A"}</span></div>
                      <div>Humidity avg: <span style={{ color: "#fff", fontWeight: 700 }}>{previousRaceWeather?.humidity_avg ?? "N/A"}</span></div>
                      <div>Rain seen: <span style={{ color: "#fff", fontWeight: 700 }}>{typeof previousRaceWeather?.rainfall === "boolean" ? (previousRaceWeather.rainfall ? "Yes" : "No") : "N/A"}</span></div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section style={{ borderRadius: 22, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, overflow: "hidden" }}>
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#67e8f9", marginBottom: 4 }}>
                  AI Insight Picks
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>
                  Suggested picks for the current categories
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 1, background: HAIRLINE }}>
                {aiPredictions.map((item, index) => (
                  <div key={`${item.category}-${index}`} style={{ background: PANEL_BG, padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                        {item.category}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#dbeafe", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.24)", borderRadius: 999, padding: "4px 8px" }}>
                        {typeof item.confidence === "number" ? `${Math.round(item.confidence * 100)}% confidence` : "AI pick"}
                      </div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, marginBottom: 8 }}>{item.pick}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.76, color: MUTED_TEXT }}>{previewText(item.reason, 220)}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2,minmax(0,1fr))" : "repeat(3,minmax(0,1fr))", gap: 14 }}>
              <div style={{ borderRadius: 22, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                    Key factors
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>Structural reads</div>
                </div>
                <div style={{ display: "grid", gap: 10, padding: 14 }}>
                  {(insight.key_factors || []).map((item, index) => (
                    <button key={`${item.title}-${index}`} onClick={() => setExpandedInsight(detailOverlayPayload("factor", item))} style={{ width: "100%", textAlign: "left", borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "13px 13px 12px", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.impact === "positive" ? "#34d399" : item.impact === "negative" ? "#f87171" : "#67e8f9" }} />
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{item.title}</div>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT, marginBottom: 8 }}>{previewText(item.detail, 170)}</div>
                      <div style={{ fontSize: 11, lineHeight: 1.65, color: SUBTLE_TEXT }}>Fantasy take: {previewText(item.fantasy_take, 96)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 22, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                    Prediction edges
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>Actionable angles</div>
                </div>
                <div style={{ display: "grid", gap: 10, padding: 14 }}>
                  {(insight.prediction_edges || []).map((item, index) => (
                    <button key={`${item.label}-${index}`} onClick={() => setExpandedInsight(detailOverlayPayload("edge", item))} style={{ width: "100%", textAlign: "left", borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "13px 13px 12px", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 7, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{item.label}</div>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: item.risk_level === "high" ? "#fda4af" : item.risk_level === "low" ? "#86efac" : "#93c5fd" }}>
                          {item.risk_level || "medium"} risk
                        </span>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT, marginBottom: 8 }}>{previewText(item.detail || item.take, 170)}</div>
                      <div style={{ fontSize: 11, lineHeight: 1.65, color: SUBTLE_TEXT }}>Action: {previewText(item.action, 96)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 22, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                    Watchlist
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>What can still move the board</div>
                </div>
                <div style={{ display: "grid", gap: 10, padding: 14 }}>
                  {(insight.watchlist || []).map((item, index) => (
                    <button key={`${item.label}-${index}`} onClick={() => setExpandedInsight(detailOverlayPayload("watch", item))} style={{ width: "100%", textAlign: "left", borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "13px 13px 12px", cursor: "pointer" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 7 }}>{item.label}</div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT, marginBottom: 8 }}>{previewText(item.trigger || item.reason, 170)}</div>
                      <div style={{ fontSize: 11, lineHeight: 1.65, color: SUBTLE_TEXT }}>React: {previewText(item.how_to_react, 96)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div style={{ padding: 24 }}>
            <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4, marginBottom: 8 }}>No AI Insight generated yet</div>
              <div style={{ fontSize: 13, lineHeight: 1.72, color: MUTED_TEXT }}>
                Generate an AI Insight read from the Admin page and this tab will show the race summary plus picks for the main categories.
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
