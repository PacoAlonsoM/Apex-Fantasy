import "server-only";

function buildGoogleNewsFeed(source, query, priority) {
  return {
    source,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
    priority,
  };
}

const FEEDS = [
  {
    source: "Formula1.com",
    url: "https://www.formula1.com/en/latest/all.xml",
    priority: 5,
  },
  {
    source: "BBC Sport F1",
    url: "https://feeds.bbci.co.uk/sport/formula1/rss.xml",
    priority: 4,
  },
  {
    source: "Autosport",
    url: "https://www.autosport.com/rss/f1/news/",
    priority: 4,
  },
  {
    source: "Motorsport",
    url: "https://www.motorsport.com/rss/f1/news/",
    priority: 3,
  },
  {
    source: "RACER",
    url: "https://racer.com/category/f1/feed/",
    priority: 3,
  },
  buildGoogleNewsFeed("Google News F1", "\"Formula 1\" OR F1", 2),
  buildGoogleNewsFeed("Google News F1 Tech", "\"Formula 1\" (upgrade OR technical OR FIA OR steward)", 2),
  buildGoogleNewsFeed("Google News F1 Teams", "\"Formula 1\" (Ferrari OR Mercedes OR McLaren OR Red Bull)", 2),
  buildGoogleNewsFeed("Google News F1 Drivers", "\"Formula 1\" (Verstappen OR Norris OR Piastri OR Hamilton OR Leclerc OR Alonso)", 2),
  buildGoogleNewsFeed("Google News F1 Weekend", "\"Miami GP\" OR \"Formula 1 sprint\" OR \"F1 qualifying\"", 2),
];

const BLOCKED_IMAGE_HOST_PARTS = [
  "news.google.",
  "googleusercontent.",
  "gstatic.",
  "encrypted-tbn",
  "ggpht.",
];

const BLOCKED_IMAGE_PATH_RE = /(?:favicon|apple-touch|sprite|logo|icon|placeholder|default-image|blank|pixel|spacer|avatar|profile)(?:[._/-]|$)/i;

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value) {
  return normalizeWhitespace(decodeEntities(value).replace(/<[^>]*>/g, " "));
}

function extractTag(block, tags, strip = true) {
  for (const tag of tags) {
    const match = String(block || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (!match?.[1]) continue;
    const raw = decodeEntities(match[1]);
    return strip ? stripHtml(raw) : normalizeWhitespace(raw);
  }
  return null;
}

function extractLink(block) {
  const direct = extractTag(block, ["link"], false);
  if (direct && /^https?:\/\//i.test(direct)) return direct;

  const atom = String(block || "").match(/<link[^>]+href="([^"]+)"/i);
  if (atom?.[1]) return atom[1].trim();

  return null;
}

function extractImage(block) {
  const patterns = [
    /<enclosure[^>]+url="([^"]+)"/i,
    /<media:content[^>]+url="([^"]+)"/i,
    /<media:thumbnail[^>]+url="([^"]+)"/i,
    /<img[^>]+src="([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = String(block || "").match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

function cleanArticleImageUrl(value, baseUrl = null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw, baseUrl || undefined);
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

function extractMetaContent(html, keys) {
  for (const key of keys) {
    const escaped = escapeRegExp(key);
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    ];

    for (const pattern of patterns) {
      const match = String(html || "").match(pattern);
      if (match?.[1]) return decodeEntities(match[1].trim());
    }
  }

  return null;
}

function extractParagraphSummary(html) {
  const paragraphs = [...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1] || ""))
    .filter((paragraph) => paragraph.length > 90)
    .filter((paragraph) => !/cookie|subscribe|newsletter|advertisement|privacy|sign up/i.test(paragraph))
    .slice(0, 3);

  if (!paragraphs.length) return null;
  return paragraphs.join(" ");
}

function truncateSummary(value, max = 560) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function normalizeTitleKey(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parsePublished(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseFeed(source, priority, xml) {
  const items = [
    ...(String(xml || "").match(/<item\b[\s\S]*?<\/item>/gi) || []),
    ...(String(xml || "").match(/<entry\b[\s\S]*?<\/entry>/gi) || []),
  ];

  return items
    .map((block) => {
      const title = extractTag(block, ["title"]);
      const url = extractLink(block);
      const description = extractTag(block, ["description", "content:encoded", "summary", "content"]);
      const publishedAt = parsePublished(extractTag(block, ["pubDate", "published", "updated"], false));
      const imageUrl = cleanArticleImageUrl(extractImage(block));

      if (!title || !url) return null;

      return {
        title,
        summary: truncateSummary(description),
        url,
        source,
        published_at: publishedAt,
        image_url: imageUrl,
        source_priority: priority,
        metadata: {
          ingested_from: source,
        },
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function dedupeArticles(articles) {
  const seenByUrl = new Map();
  const seenByTitle = new Map();

  for (const article of articles || []) {
    const url = String(article?.url || "");
    const titleKey = normalizeTitleKey(article?.title);
    if (!url && !titleKey) continue;

    const current = seenByUrl.get(url) || seenByTitle.get(titleKey) || null;
    const currentPriority = Number(current?.source_priority || 0);
    const nextPriority = Number(article?.source_priority || 0);
    const currentPublished = current?.published_at ? new Date(String(current.published_at)).getTime() : 0;
    const nextPublished = article?.published_at ? new Date(String(article.published_at)).getTime() : 0;

    const next = !current
      ? article
      : nextPriority > currentPriority
        ? article
        : nextPriority === currentPriority && nextPublished > currentPublished
          ? article
          : current;

    if (url) seenByUrl.set(url, next);
    if (titleKey) seenByTitle.set(titleKey, next);
  }

  return [...new Set([...seenByUrl.values(), ...seenByTitle.values()])].sort((a, b) => {
    const left = a?.published_at ? new Date(String(a.published_at)).getTime() : 0;
    const right = b?.published_at ? new Date(String(b.published_at)).getTime() : 0;
    return right - left;
  });
}

async function enrichArticle(article) {
  const summaryLength = article?.summary?.length || 0;
  const currentImageUrl = cleanArticleImageUrl(article?.image_url, article?.url);
  if (currentImageUrl && summaryLength >= 220) {
    return { ...article, image_url: currentImageUrl };
  }

  try {
    const response = await fetch(article.url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "apex-fantasy-news-ingest/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) return { ...article, image_url: currentImageUrl || null };

    const html = await response.text();
    const metaImageUrl = cleanArticleImageUrl(
      extractMetaContent(html, ["og:image", "twitter:image", "twitter:image:src"]),
      article.url
    );
    const imageUrl = metaImageUrl || currentImageUrl;
    const metaDescription = extractMetaContent(html, ["og:description", "description", "twitter:description"]);
    const paragraphSummary = extractParagraphSummary(html);

    const bestSummaryCandidate = [article.summary, paragraphSummary, metaDescription]
      .filter(Boolean)
      .sort((left, right) => String(right).length - String(left).length)[0] || null;

    return {
      ...article,
      summary: truncateSummary(bestSummaryCandidate, 760),
      image_url: imageUrl || null,
      metadata: {
        ...(article.metadata || {}),
        enriched_from_article: Boolean(imageUrl || bestSummaryCandidate),
      },
      updated_at: new Date().toISOString(),
    };
  } catch {
    return { ...article, image_url: currentImageUrl || null };
  }
}

export async function syncNewsArticlesLocally(supabase) {
  const startedAt = new Date().toISOString();
  const errors = [];
  const collected = [];
  let fetchedCount = 0;

  for (const feed of FEEDS) {
    try {
      const response = await fetch(feed.url, {
        headers: {
          accept: "application/rss+xml, application/xml, text/xml",
          "user-agent": "apex-fantasy-news-ingest/1.0",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        errors.push(`${feed.source}: ${response.status} ${response.statusText}`);
        continue;
      }

      const xml = await response.text();
      const parsed = parseFeed(feed.source, feed.priority, xml);
      fetchedCount += parsed.length;
      collected.push(...parsed);
    } catch (error) {
      errors.push(`${feed.source}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const articles = dedupeArticles(collected);
  const enrichedArticles = await Promise.all(
    articles.map((article, index) => (index < 64 ? enrichArticle(article) : Promise.resolve(article)))
  );

  if (enrichedArticles.length) {
    const { error } = await supabase.from("news_articles").upsert(enrichedArticles, { onConflict: "url" });
    if (error) errors.push(`news_articles: ${error.message}`);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 120);
  await supabase.from("news_articles").delete().lt("published_at", cutoff.toISOString());

  await supabase.from("news_ingest_runs").insert({
    source: "rss",
    fetched_count: fetchedCount,
    upserted_count: enrichedArticles.length,
    status: errors.length ? "partial" : "ok",
    error_text: errors.length ? errors.join("\n") : null,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });

  return {
    fetchedCount,
    upsertedCount: enrichedArticles.length,
    errors,
  };
}
