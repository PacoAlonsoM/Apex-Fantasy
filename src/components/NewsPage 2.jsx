import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { PANEL_BG, PANEL_BG_ALT, PANEL_BORDER, MUTED_TEXT, SUBTLE_TEXT, HAIRLINE } from "../constants/design";

const SOURCE_CARDS = [
  {
    name: "Formula1.com",
    role: "Official source",
    detail: "Best for official announcements, team moves and calendar changes. Use as curated editorial input, not a client-side scrape.",
    url: "https://www.formula1.com/",
  },
  {
    name: "Autosport RSS",
    role: "Reliable news feed",
    detail: "Strong for timely Formula 1 reporting and feature coverage. Good candidate for scheduled ingestion into Supabase.",
    url: "https://www.autosport.com/rss/f1/news/",
  },
  {
    name: "Motorsport RSS",
    role: "Broad F1 coverage",
    detail: "Useful for race-week reporting, paddock stories and faster news refresh. Also suitable for scheduled ingestion.",
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
        .limit(24);

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

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 28px 80px", position: "relative", zIndex: 1 }}>
      <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(300px,0.95fr)", gap: 18, marginBottom: 20 }}>
        <div style={{ borderRadius: 24, border: PANEL_BORDER, background: PANEL_BG, padding: "26px 26px 24px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: "#101a2d", border: "1px solid rgba(148,163,184,0.14)", marginBottom: 16 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2dd4bf" }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#cbd5e1" }}>F1 news desk</span>
          </div>

          <h1 style={{ fontSize: 54, lineHeight: 0.98, margin: "0 0 12px", letterSpacing: -2.6 }}>
            Reliable Formula 1
            <br />
            news, inside the app.
          </h1>

          <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.72, color: MUTED_TEXT, maxWidth: 700 }}>
            The right approach is to ingest news server-side, normalize it in Supabase, deduplicate it and then render it here as a clean product surface.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
            {[
              ["Official", "announcements"],
              ["Timely", "race-week reporting"],
              ["Curated", "interesting stories only"],
            ].map(([value, label]) => (
              <div key={label} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "14px 14px 12px" }}>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.6 }}>{value}</div>
                <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {SOURCE_CARDS.map((source) => (
            <a
              key={source.name}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none" }}
            >
              <div style={{ borderRadius: 20, border: PANEL_BORDER, background: PANEL_BG, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>{source.name}</div>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2dd4bf" }}>{source.role}</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: MUTED_TEXT }}>{source.detail}</div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section style={{ borderRadius: 24, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Latest stories</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, marginTop: 4 }}>Normalized article feed</div>
          </div>
          <div style={{ fontSize: 12, color: MUTED_TEXT }}>
            {loading ? "Loading..." : hasTable ? `${articles.length} stories loaded` : "Waiting for backend ingest"}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, color: MUTED_TEXT, textAlign: "center" }}>Loading news feed...</div>
        ) : articles.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 1, background: HAIRLINE }}>
            {articles.map((article) => (
              <a key={article.id} href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                <article style={{ background: PANEL_BG, padding: 18, minHeight: 220 }}>
                  {article.image_url && (
                    <div style={{ width: "100%", height: 132, borderRadius: 14, backgroundImage: `url(${article.image_url})`, backgroundSize: "cover", backgroundPosition: "center", marginBottom: 14 }} />
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2dd4bf" }}>{article.source || "Source"}</span>
                    {article.published_at && <span style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatPublished(article.published_at)}</span>}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.28, marginBottom: 8 }}>{article.title}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.66, color: MUTED_TEXT }}>{article.summary || "Open the article to read more."}</div>
                </article>
              </a>
            ))}
          </div>
        ) : (
          <div style={{ padding: 28 }}>
            <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4, marginBottom: 8 }}>No ingested stories yet</div>
              <div style={{ fontSize: 13, lineHeight: 1.72, color: MUTED_TEXT, marginBottom: 12 }}>
                The page is ready. The next backend step is to ingest `Autosport` and `Motorsport` RSS feeds into a `news_articles` table, then optionally flag official `Formula1.com` stories as higher-trust items.
              </div>
              <div style={{ fontSize: 12, color: SUBTLE_TEXT }}>
                Recommended pipeline: scheduled fetch -> normalize -> dedupe by URL/title -> store in Supabase -> render here.
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
