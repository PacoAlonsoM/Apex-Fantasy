// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FALLBACK_ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";

type NewsArticleRow = {
  title: string;
  summary: string | null;
  url: string;
  source: string;
  published_at: string | null;
  image_url: string | null;
  source_priority: number;
  metadata: Record<string, unknown>;
  updated_at: string;
};

const FEEDS = [
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
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string) {
  return normalizeWhitespace(decodeEntities(value).replace(/<[^>]*>/g, " "));
}

function extractTag(block: string, tags: string[], strip = true) {
  for (const tag of tags) {
    const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (!match?.[1]) continue;
    const raw = decodeEntities(match[1]);
    return strip ? stripHtml(raw) : normalizeWhitespace(raw);
  }
  return null;
}

function extractLink(block: string) {
  const direct = extractTag(block, ["link"], false);
  if (direct && /^https?:\/\//i.test(direct)) return direct;

  const atom = block.match(/<link[^>]+href="([^"]+)"/i);
  if (atom?.[1]) return atom[1].trim();

  return null;
}

function extractImage(block: string) {
  const enclosure = block.match(/<enclosure[^>]+url="([^"]+)"/i);
  if (enclosure?.[1]) return enclosure[1].trim();

  const media = block.match(/<media:content[^>]+url="([^"]+)"/i);
  if (media?.[1]) return media[1].trim();

  const thumbnail = block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
  if (thumbnail?.[1]) return thumbnail[1].trim();

  const img = block.match(/<img[^>]+src="([^"]+)"/i);
  if (img?.[1]) return img[1].trim();

  return null;
}

function extractMetaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const escaped = escapeRegExp(key);
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeEntities(match[1].trim());
    }
  }

  return null;
}

function extractParagraphSummary(html: string) {
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1] || ""))
    .filter((paragraph) => paragraph.length > 90)
    .filter((paragraph) => !/cookie|subscribe|newsletter|advertisement|privacy|sign up/i.test(paragraph))
    .slice(0, 3);

  if (!paragraphs.length) return null;
  return paragraphs.join(" ");
}

function truncateSummary(value: string | null, max = 720) {
  if (!value) return null;
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function parsePublished(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseFeed(source: string, priority: number, xml: string): NewsArticleRow[] {
  const items = [
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) || []),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || []),
  ];

  return items
    .map((block) => {
      const title = extractTag(block, ["title"]);
      const url = extractLink(block);
      const description = extractTag(block, ["description", "content:encoded", "summary", "content"]);
      const publishedAt = parsePublished(extractTag(block, ["pubDate", "published", "updated"], false));
      const imageUrl = extractImage(block);

      if (!title || !url) return null;

      return {
        title,
      summary: truncateSummary(description, 820),
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
    .filter((item): item is NewsArticleRow => item !== null);
}

function dedupeArticles(articles: NewsArticleRow[]) {
  const seen = new Map<string, NewsArticleRow>();

  for (const article of articles) {
    const url = String(article.url || "");
    if (!url) continue;

    const current = seen.get(url);
    if (!current) {
      seen.set(url, article);
      continue;
    }

    const currentPriority = Number(current.source_priority || 0);
    const nextPriority = Number(article.source_priority || 0);
    if (nextPriority > currentPriority) seen.set(url, article);
  }

  return [...seen.values()].sort((a, b) => {
    const left = a.published_at ? new Date(String(a.published_at)).getTime() : 0;
    const right = b.published_at ? new Date(String(b.published_at)).getTime() : 0;
    return right - left;
  });
}

async function enrichArticle(article: NewsArticleRow) {
  const summaryLength = article.summary?.length || 0;
  if (article.image_url && summaryLength >= 220) return article;

  try {
    const response = await fetch(article.url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "apex-fantasy-news-ingest/1.0",
      },
    });

    if (!response.ok) return article;

    const html = await response.text();
    const imageUrl =
      article.image_url
      || extractMetaContent(html, ["og:image", "twitter:image", "twitter:image:src"]);
    const metaDescription = extractMetaContent(html, ["og:description", "description", "twitter:description"]);
    const paragraphSummary = extractParagraphSummary(html);

    const bestSummaryCandidate = [article.summary, paragraphSummary, metaDescription]
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.length - left.length)[0] || null;

    return {
      ...article,
      summary: truncateSummary(bestSummaryCandidate, 1040),
      image_url: imageUrl || null,
      metadata: {
        ...article.metadata,
        enriched_from_article: Boolean(imageUrl || bestSummaryCandidate),
      },
      updated_at: new Date().toISOString(),
    };
  } catch (_error) {
    return article;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const configuredSecret = Deno.env.get("NEWS_INGEST_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;
  const adminId = Deno.env.get("AI_ADMIN_USER_ID") || FALLBACK_ADMIN_ID;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return respond({ error: "Missing Supabase environment variables." }, 500);
  }

  const providedSecret = req.headers.get("x-ingest-secret");
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let authorized = false;

  if (configuredSecret && providedSecret === configuredSecret) {
    authorized = true;
  } else if (token) {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (!authError && user?.id === adminId) {
      authorized = true;
    }
  } else if (!configuredSecret) {
    authorized = true;
  }

  if (!authorized) {
    return respond({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const collected: NewsArticleRow[] = [];
  let fetchedCount = 0;

  for (const feed of FEEDS) {
    try {
      const response = await fetch(feed.url, {
        headers: {
          accept: "application/rss+xml, application/xml, text/xml",
          "user-agent": "apex-fantasy-news-ingest/1.0",
        },
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
  const enrichedArticles = await Promise.all(articles.map((article) => enrichArticle(article)));

  if (enrichedArticles.length) {
    const { error } = await supabase.from("news_articles").upsert(enrichedArticles, { onConflict: "url" });
    if (error) errors.push(`news_articles: ${error.message}`);
  }

  await supabase.from("news_articles").delete().eq("source", "Formula1.com");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
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

  return respond({
    fetchedCount,
    upsertedCount: enrichedArticles.length,
    errors,
  });
});
