// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    source: "Autosport",
    url: "https://www.autosport.com/rss/f1/news/",
    priority: 3,
  },
  {
    source: "Motorsport",
    url: "https://www.motorsport.com/rss/f1/news/",
    priority: 2,
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

  const img = block.match(/<img[^>]+src="([^"]+)"/i);
  if (img?.[1]) return img[1].trim();

  return null;
}

function truncateSummary(value: string | null, max = 280) {
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
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return items
    .map((block) => {
      const title = extractTag(block, ["title"]);
      const url = extractLink(block);
      const description = extractTag(block, ["description", "content:encoded"]);
      const publishedAt = parsePublished(extractTag(block, ["pubDate", "published", "updated"], false));
      const imageUrl = extractImage(block);

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const configuredSecret = Deno.env.get("NEWS_INGEST_SECRET");
  if (configuredSecret && req.headers.get("x-ingest-secret") !== configuredSecret) {
    return respond({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return respond({ error: "Missing Supabase environment variables." }, 500);
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

  if (articles.length) {
    const { error } = await supabase.from("news_articles").upsert(articles, { onConflict: "url" });
    if (error) errors.push(`news_articles: ${error.message}`);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  await supabase.from("news_articles").delete().lt("published_at", cutoff.toISOString());

  await supabase.from("news_ingest_runs").insert({
    source: "rss",
    fetched_count: fetchedCount,
    upserted_count: articles.length,
    status: errors.length ? "partial" : "ok",
    error_text: errors.length ? errors.join("\n") : null,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });

  return respond({
    fetchedCount,
    upsertedCount: articles.length,
    errors,
  });
});
