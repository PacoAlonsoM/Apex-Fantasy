import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { PANEL_BG, PANEL_BG_ALT, PANEL_BORDER, MUTED_TEXT, SUBTLE_TEXT, HAIRLINE } from "../constants/design";

const SOURCE_CARDS = [
  {
    name: "Formula1.com",
    role: "Official",
    detail: "Primary source for calendar changes, team announcements and confirmed paddock updates.",
    url: "https://www.formula1.com/",
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

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasTable, setHasTable] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadNews() {
      setLoading(true);
      const { data, error } = await supabase
        .from("news_articles")
        .select("id,title,summary,url,source,published_at,image_url")
        .order("published_at", { ascending: false })
        .limit(30);

      if (ignore) return;

      if (error) {
        setHasTable(false);
        setArticles([]);
      } else {
        setHasTable(true);
        setArticles(data || []);
      }

      setLoading(false);
    }

    loadNews();
    return () => { ignore = true; };
  }, []);

  const featured = articles[0] || null;
  const ticker = useMemo(() => articles.slice(1, 6), [articles]);
  const feed = useMemo(() => articles.slice(1), [articles]);
  const sourceCount = useMemo(() => new Set(articles.map((article) => article.source).filter(Boolean)).size, [articles]);

  return (
    <div style={{ maxWidth: 1220, margin: "0 auto", padding: "44px 28px 80px", position: "relative", zIndex: 1 }}>
      <section style={{ borderRadius: 26, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 18 }}>
        <div style={{ padding: "22px 24px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 760 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                Newswire
              </div>
              <h1 style={{ fontSize: 48, lineHeight: 0.98, margin: "0 0 8px", letterSpacing: -2.2 }}>
                The stories that can
                <br />
                actually change your picks.
              </h1>
              <div style={{ fontSize: 13, color: MUTED_TEXT }}>
                {loading ? "Loading race-week feed..." : hasTable ? `${articles.length} stories cleaned into one F1 feed` : "Waiting for ingest setup"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,116px))", gap: 10 }}>
              {[
                [String(articles.length || 0), "stories"],
                [String(sourceCount || 0), "sources"],
                [loading ? "..." : hasTable ? "live" : "setup", "status"],
              ].map(([value, label]) => (
                <div key={label} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, padding: "13px 14px 12px" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8 }}>{value}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, color: MUTED_TEXT, textAlign: "center" }}>Loading news feed...</div>
        ) : articles.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.12fr) 350px", gap: 0 }}>
            <a href={featured.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit", borderRight: `1px solid ${HAIRLINE}` }}>
              <article style={{ padding: 22, minHeight: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#67e8f9" }}>{featured.source || "Source"}</span>
                  {featured.published_at && <span style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatPublished(featured.published_at)}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: featured.image_url ? "minmax(0,1.02fr) 252px" : "1fr", gap: 18, alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, lineHeight: 1.05, marginBottom: 12 }}>{featured.title}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.75, color: MUTED_TEXT }}>
                      {featured.summary || "Open the article for the full report."}
                    </div>
                  </div>
                  {featured.image_url && (
                    <div style={{ width: "100%", height: 212, borderRadius: 18, backgroundImage: `url(${featured.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  )}
                </div>
              </article>
            </a>

            <div style={{ background: PANEL_BG }}>
              <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                  Fast feed
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>Need-to-know headlines</div>
              </div>
              <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
                {ticker.map((article) => (
                  <a key={article.id} href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                    <article style={{ padding: "14px 16px 13px", background: PANEL_BG }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 7 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#67e8f9" }}>{article.source || "Source"}</span>
                        {article.published_at && <span style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatPublished(article.published_at)}</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>{article.title}</div>
                    </article>
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 24 }}>
            <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4, marginBottom: 8 }}>No ingested stories yet</div>
              <div style={{ fontSize: 13, lineHeight: 1.72, color: MUTED_TEXT }}>
                The feed is ready. Once `news_articles` starts receiving content, this page will switch from setup state to a live race-week news surface automatically.
              </div>
            </div>
          </div>
        )}
      </section>

      {feed.length > 0 && (
        <section style={{ borderRadius: 24, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 18 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
              Full feed
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>Latest from the wire</div>
          </div>

          <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
            {feed.map((article) => (
              <a key={article.id} href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                <article style={{ background: PANEL_BG, padding: "16px 18px", display: "grid", gridTemplateColumns: article.image_url ? "minmax(0,1fr) 128px" : "1fr", gap: 16, alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#67e8f9" }}>{article.source || "Source"}</span>
                        {article.published_at && <span style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatPublished(article.published_at)}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2, letterSpacing: -0.4, marginBottom: 7 }}>{article.title}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.66, color: MUTED_TEXT }}>{article.summary || "Open the article to read more."}</div>
                  </div>
                  {article.image_url && (
                    <div style={{ width: "100%", height: 90, borderRadius: 14, backgroundImage: `url(${article.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  )}
                </article>
              </a>
            ))}
          </div>
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
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
      </section>
    </div>
  );
}
