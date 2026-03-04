// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENF1_BASE = "https://api.openf1.org/v1";
const OPENAI_BASE = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1";
const FALLBACK_ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";
const NEWS_LOOKBACK_DAYS = 365;
const NEWS_FETCH_LIMIT = 180;
const NEWS_CONTEXT_LIMIT = 72;
const NEWS_SUMMARY_CONTEXT_MAX = 360;
const DRIVER_OPTIONS = [
  "Lando Norris",
  "Oscar Piastri",
  "Charles Leclerc",
  "Lewis Hamilton",
  "George Russell",
  "Kimi Antonelli",
  "Max Verstappen",
  "Isack Hadjar",
  "Fernando Alonso",
  "Lance Stroll",
  "Pierre Gasly",
  "Franco Colapinto",
  "Oliver Bearman",
  "Esteban Ocon",
  "Liam Lawson",
  "Arvid Lindblad",
  "Alexander Albon",
  "Carlos Sainz",
  "Nico Hulkenberg",
  "Gabriel Bortoleto",
  "Sergio Perez",
  "Valtteri Bottas",
];
const CONSTRUCTOR_OPTIONS = [
  "McLaren",
  "Ferrari",
  "Mercedes",
  "Red Bull Racing",
  "Aston Martin",
  "Alpine",
  "Haas",
  "Racing Bulls",
  "Williams",
  "Audi",
  "Cadillac",
];
const CURRENT_GRID = [
  { driver: "Lando Norris", team: "McLaren" },
  { driver: "Oscar Piastri", team: "McLaren" },
  { driver: "Charles Leclerc", team: "Ferrari" },
  { driver: "Lewis Hamilton", team: "Ferrari" },
  { driver: "George Russell", team: "Mercedes" },
  { driver: "Kimi Antonelli", team: "Mercedes" },
  { driver: "Max Verstappen", team: "Red Bull Racing" },
  { driver: "Isack Hadjar", team: "Red Bull Racing" },
  { driver: "Fernando Alonso", team: "Aston Martin" },
  { driver: "Lance Stroll", team: "Aston Martin" },
  { driver: "Pierre Gasly", team: "Alpine" },
  { driver: "Franco Colapinto", team: "Alpine" },
  { driver: "Oliver Bearman", team: "Haas" },
  { driver: "Esteban Ocon", team: "Haas" },
  { driver: "Liam Lawson", team: "Racing Bulls" },
  { driver: "Arvid Lindblad", team: "Racing Bulls" },
  { driver: "Alexander Albon", team: "Williams" },
  { driver: "Carlos Sainz", team: "Williams" },
  { driver: "Nico Hulkenberg", team: "Audi" },
  { driver: "Gabriel Bortoleto", team: "Audi" },
  { driver: "Sergio Perez", team: "Cadillac" },
  { driver: "Valtteri Bottas", team: "Cadillac" },
];
const BASE_CATEGORY_OPTIONS = [
  { key: "pole", label: "Pole Position", type: "driver", allowed: DRIVER_OPTIONS },
  { key: "winner", label: "Race Winner", type: "driver", allowed: DRIVER_OPTIONS },
  { key: "p2", label: "2nd Place", type: "driver", allowed: DRIVER_OPTIONS },
  { key: "p3", label: "3rd Place", type: "driver", allowed: DRIVER_OPTIONS },
  { key: "dnf", label: "DNF Driver", type: "driver", allowed: DRIVER_OPTIONS },
  { key: "fl", label: "Fastest Lap", type: "driver", allowed: DRIVER_OPTIONS },
  { key: "dotd", label: "Driver of the Day", type: "driver", allowed: DRIVER_OPTIONS },
  { key: "ctor", label: "Constructor with Most Points", type: "constructor", allowed: CONSTRUCTOR_OPTIONS },
  { key: "sc", label: "Safety Car", type: "binary", allowed: ["Yes", "No"] },
  { key: "rf", label: "Red Flag", type: "binary", allowed: ["Yes", "No"] },
];
const SPRINT_CATEGORY_OPTIONS = [
  { key: "sp_pole", label: "Sprint Pole", type: "driver", allowed: DRIVER_OPTIONS },
  { key: "sp_winner", label: "Sprint Winner", type: "driver", allowed: DRIVER_OPTIONS },
  { key: "sp_p2", label: "Sprint 2nd", type: "driver", allowed: DRIVER_OPTIONS },
  { key: "sp_p3", label: "Sprint 3rd", type: "driver", allowed: DRIVER_OPTIONS },
];
const CATEGORY_ORDER = [
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function sortByDate(list: Array<Record<string, unknown>>, field = "date_start") {
  return [...list].sort((left, right) => new Date(String(left[field] || 0)).getTime() - new Date(String(right[field] || 0)).getTime());
}

function pickOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) return part.text.trim();
    }
  }

  return null;
}

function truncateText(value: string, max: number) {
  if (!value) return value;
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function balanceNewsBySource(articles: Array<Record<string, unknown>>, maxItems: number) {
  const buckets = new Map<string, Array<Record<string, unknown>>>();
  for (const article of articles) {
    const source = String(article.source || "Unknown");
    if (!buckets.has(source)) buckets.set(source, []);
    buckets.get(source)?.push(article);
  }

  const sources = [...buckets.keys()];
  const picked: Array<Record<string, unknown>> = [];

  while (picked.length < maxItems) {
    let addedInRound = false;

    for (const source of sources) {
      const queue = buckets.get(source) || [];
      if (!queue.length) continue;
      picked.push(queue.shift()!);
      addedInRound = true;
      if (picked.length >= maxItems) break;
    }

    if (!addedInRound) break;
  }

  return picked;
}

async function fetchOpenF1(path: string) {
  const response = await fetch(`${OPENF1_BASE}${path}`, {
    headers: {
      accept: "application/json",
      "user-agent": "apex-fantasy-ai-race-brief/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`OpenF1 ${path}: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function loadRaceSessionsWithFallback(baseYear: number) {
  const candidateYears = [baseYear, baseYear - 1];

  for (const year of candidateYears) {
    const rawRaceSessions = await fetchOpenF1(`/sessions?year=${year}&session_name=Race`);
    const raceSessions = sortByDate(rawRaceSessions);
    if (raceSessions.length) {
      return { year, raceSessions };
    }
  }

  return { year: baseYear, raceSessions: [] };
}

function buildPreviousRaceSummary(results: Array<Record<string, unknown>>, raceControl: Array<Record<string, unknown>>, drivers: Array<Record<string, unknown>>) {
  const driverMap = Object.fromEntries(
    drivers.map((driver) => [driver.driver_number, driver.full_name || driver.name_acronym || `#${driver.driver_number}`])
  );

  const sortedResults = [...results]
    .filter((row) => row.position)
    .sort((left, right) => Number(left.position || 999) - Number(right.position || 999));

  const podium = sortedResults.slice(0, 3).map((row) => driverMap[row.driver_number] || `#${row.driver_number}`);
  const dnfCount = results.filter((row) => row.position === null || row.classified_position === null).length;
  const safetyCarCount = raceControl.filter((item) => String(item.category || "").toLowerCase().includes("safety") || String(item.message || "").toUpperCase().includes("SAFETY CAR")).length;
  const redFlagCount = raceControl.filter((item) => String(item.flag || "").toUpperCase() === "RED" || String(item.message || "").toUpperCase().includes("RED FLAG")).length;

  return {
    winner: podium[0] || null,
    podium,
    dnfCount,
    safetyCarCount,
    redFlagCount,
  };
}

function summarizeWeather(samples: Array<Record<string, unknown>>) {
  if (!samples.length) return null;

  const average = (field: string) => {
    const values = samples
      .map((sample) => Number(sample[field]))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return null;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
  };

  const rainfall = samples.some((sample) => Number(sample.rainfall || 0) > 0);

  return {
    air_temperature_avg: average("air_temperature"),
    track_temperature_avg: average("track_temperature"),
    humidity_avg: average("humidity"),
    rainfall,
  };
}

function summarizeStints(stints: Array<Record<string, unknown>>) {
  if (!stints.length) return null;

  const byDriver = new Map<string, number>();
  const compounds = new Map<string, number>();

  for (const stint of stints) {
    const driver = String(stint.driver_number || "");
    const compound = String(stint.compound || stint.tyre_compound || "").trim();

    if (driver) byDriver.set(driver, (byDriver.get(driver) || 0) + 1);
    if (compound) compounds.set(compound, (compounds.get(compound) || 0) + 1);
  }

  const averageStints = byDriver.size
    ? Number((Array.from(byDriver.values()).reduce((sum, value) => sum + value, 0) / byDriver.size).toFixed(1))
    : null;

  const compoundUsage = Array.from(compounds.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([compound, count]) => ({ compound, count }));

  return {
    average_stints_per_driver: averageStints,
    top_compounds: compoundUsage,
  };
}

function formatSessionWindow(sessions: Array<Record<string, unknown>>) {
  return sessions.map((session) => ({
    session_name: session.session_name,
    session_type: session.session_type,
    date_start: session.date_start,
    location: session.location,
  }));
}

function buildPrompt(context: Record<string, unknown>) {
  return [
    "You are an F1 analyst for a fantasy prediction product.",
    "Your job is to transform race-week news and OpenF1 context into a detailed, useful race brief for fantasy prediction players.",
    "Do not invent facts. Only infer cautiously from the supplied context.",
    "Treat the supplied current_grid as the authoritative 2026 driver-team mapping.",
    "If general F1 knowledge or article context conflicts with current_grid, current_grid wins.",
    "Never describe a driver as belonging to a different team than the one listed in current_grid.",
    "Focus on fantasy utility: qualifying outlook, race volatility, constructor trend, strategy shape, and what could move user picks.",
    "Make the output strong enough that a user gets value without needing to immediately leave the page to read source articles.",
    "Keep the tone personalized and practical, not generic newsroom copy.",
    "Write with enough depth that the brief feels like a real premium weekend read, not a short recap.",
    "The summary should feel like the executive read. The race_summary should feel like the full page read.",
    "The race_summary should be multi-paragraph, specific, and long enough to cover likely pace hierarchy, qualifying outlook, race-shape risk, strategy variables, and what could change between now and lights out.",
    "For category_predictions, you must use the exact keys, labels, types and allowed values provided in the category_options context.",
    "For driver categories, the pick must be one exact driver name from the allowed driver list.",
    "For constructor categories, the pick must be one exact constructor name from the allowed constructor list.",
    "For binary categories, the pick must be exactly Yes or No.",
    "Never answer a driver category with a team name. Never answer a constructor category with a driver name.",
    "Make key_factors structural, prediction_edges actionable, and watchlist conditional. They must not feel like the same list rewritten three times.",
    "Use this distinction exactly:",
    "- key_factors = the underlying forces shaping the weekend",
    "- prediction_edges = the exploitable fantasy conclusions or category-level leans",
    "- watchlist = the events or signals that would make you change the board later",
    "Every item should be concrete and detailed. Avoid vague phrases like 'momentum matters' unless you explain why in this race context.",
    "If the context is thin on one area, say less there and deepen the areas that are actually supported by the supplied news and OpenF1 data.",
    "Return JSON only following the schema.",
    "",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function getCategoryOptions(upcomingRace: Record<string, unknown>, meetingSessions: Array<Record<string, unknown>>) {
  const hasSprint =
    String(upcomingRace.meeting_name || "").toLowerCase().includes("sprint")
    || meetingSessions.some((session) => String(session.session_name || "").toLowerCase().includes("sprint"));

  return hasSprint ? [...BASE_CATEGORY_OPTIONS, ...SPRINT_CATEGORY_OPTIONS] : [...BASE_CATEGORY_OPTIONS];
}

function normalizeCategoryPredictions(items: Array<Record<string, unknown>>, allowedOptions: Array<Record<string, unknown>>) {
  const optionByKey = new Map(allowedOptions.map((option) => [option.key, option]));
  const filtered = items
    .filter((item) => optionByKey.has(String(item.key || "")))
    .map((item) => {
      const option = optionByKey.get(String(item.key));
      const pick = String(item.pick || "").trim();
      const allowed = Array.isArray(option.allowed) ? option.allowed : [];
      return {
        key: option.key,
        category: option.label,
        type: option.type,
        pick,
        reason: String(item.reason || "").trim(),
        confidence: Number(item.confidence || 0),
        allowed,
      };
    })
    .filter((item) => item.pick && item.reason && item.allowed.includes(item.pick))
    .sort((left, right) => CATEGORY_ORDER.indexOf(left.key) - CATEGORY_ORDER.indexOf(right.key));

  return filtered.map(({ allowed, ...item }) => item);
}

const insightSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "race_summary", "confidence", "news_digest", "key_factors", "prediction_edges", "watchlist", "category_predictions"],
  properties: {
    headline: { type: "string", minLength: 24 },
    summary: { type: "string", minLength: 520 },
    race_summary: { type: "string", minLength: 1500 },
    confidence: { type: "number" },
    news_digest: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "detail", "why_it_matters"],
        properties: {
          headline: { type: "string", minLength: 14 },
          detail: { type: "string", minLength: 240 },
          why_it_matters: { type: "string", minLength: 120 },
        },
      },
    },
    key_factors: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "why_it_matters", "fantasy_take", "impact"],
        properties: {
          title: { type: "string", minLength: 14 },
          detail: { type: "string", minLength: 220 },
          why_it_matters: { type: "string", minLength: 120 },
          fantasy_take: { type: "string", minLength: 120 },
          impact: { type: "string", enum: ["positive", "negative", "mixed"] },
        },
      },
    },
    prediction_edges: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "detail", "action", "risk_level"],
        properties: {
          label: { type: "string", minLength: 14 },
          detail: { type: "string", minLength: 180 },
          action: { type: "string", minLength: 100 },
          risk_level: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    watchlist: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "trigger", "what_changes", "how_to_react"],
        properties: {
          label: { type: "string", minLength: 14 },
          trigger: { type: "string", minLength: 90 },
          what_changes: { type: "string", minLength: 100 },
          how_to_react: { type: "string", minLength: 100 },
        },
      },
    },
    category_predictions: {
      type: "array",
      minItems: 6,
      maxItems: 14,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "category", "type", "pick", "reason", "confidence"],
        properties: {
          key: { type: "string" },
          category: { type: "string", minLength: 6 },
          type: { type: "string", enum: ["driver", "constructor", "binary"] },
          pick: { type: "string", minLength: 2 },
          reason: { type: "string", minLength: 90 },
          confidence: { type: "number" },
        },
      },
    },
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODEL;
  const adminId = Deno.env.get("AI_ADMIN_USER_ID") || FALLBACK_ADMIN_ID;

  if (!supabaseUrl || !serviceRoleKey || !anonKey || !openAiKey) {
    return respond({ error: "Missing required environment variables." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return respond({ error: "Missing auth token." }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return respond({ error: "Invalid auth token." }, 401);
  }

  if (user.id !== adminId) {
    return respond({ error: "Forbidden." }, 403);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = new Date().toISOString();
  let raceName = null;
  let articleCount = 0;
  let sourceCount = 0;

  try {
    const requestedYear = new Date().getUTCFullYear();
    const { year, raceSessions } = await loadRaceSessionsWithFallback(requestedYear);
    const now = Date.now();
    const upcomingRace = raceSessions.find((session) => new Date(String(session.date_start)).getTime() > now) || raceSessions[raceSessions.length - 1];
    const previousRace = [...raceSessions].reverse().find((session) => new Date(String(session.date_start)).getTime() <= now) || null;

    if (!upcomingRace) {
      throw new Error(`No OpenF1 race sessions were found for ${requestedYear} or ${requestedYear - 1}.`);
    }

    raceName = String(upcomingRace.meeting_name || upcomingRace.country_name || "Upcoming race");

    const newsCutoff = new Date(Date.now() - NEWS_LOOKBACK_DAYS * 86400000).toISOString();

    const [meetingSessions, articleResponse] = await Promise.all([
      fetchOpenF1(`/sessions?meeting_key=${upcomingRace.meeting_key}`),
      supabase
        .from("news_articles")
        .select("id,title,summary,url,source,published_at")
        .gte("published_at", newsCutoff)
        .order("published_at", { ascending: false })
        .limit(NEWS_FETCH_LIMIT),
    ]);

    if (articleResponse.error) throw new Error(articleResponse.error.message);

    const rawArticles = (articleResponse.data || []).map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      source: article.source,
      published_at: article.published_at,
      url: article.url,
    }));

    const articles = balanceNewsBySource(rawArticles, NEWS_CONTEXT_LIMIT);

    articleCount = rawArticles.length;
    sourceCount = new Set(rawArticles.map((article) => article.source).filter(Boolean)).size;

    let previousRaceSummary = null;
    let previousRaceWeather = null;
    let previousRaceStrategy = null;
    if (previousRace?.session_key) {
      const [results, raceControl, drivers, weather, stints] = await Promise.all([
        fetchOpenF1(`/session_result?session_key=${previousRace.session_key}`),
        fetchOpenF1(`/race_control?session_key=${previousRace.session_key}`),
        fetchOpenF1(`/drivers?session_key=${previousRace.session_key}`),
        fetchOpenF1(`/weather?session_key=${previousRace.session_key}`),
        fetchOpenF1(`/stints?session_key=${previousRace.session_key}`),
      ]);

      previousRaceSummary = {
        meeting_name: previousRace.meeting_name,
        country_name: previousRace.country_name,
        date_start: previousRace.date_start,
        ...buildPreviousRaceSummary(results, raceControl, drivers),
      };
      previousRaceWeather = summarizeWeather(weather);
      previousRaceStrategy = summarizeStints(stints);
    }

    const categoryOptions = getCategoryOptions(upcomingRace, meetingSessions);

    const context = {
      generated_at: new Date().toISOString(),
      target_race: {
        race_name: raceName,
        circuit: upcomingRace.circuit_short_name,
        country: upcomingRace.country_name,
        location: upcomingRace.location,
        date_start: upcomingRace.date_start,
        meeting_key: upcomingRace.meeting_key,
        session_key: upcomingRace.session_key,
        schedule: formatSessionWindow(sortByDate(meetingSessions)),
      },
      category_options: categoryOptions,
      current_grid: CURRENT_GRID,
      previous_race: previousRaceSummary,
      previous_race_weather: previousRaceWeather,
      previous_race_strategy: previousRaceStrategy,
      recent_news: articles.map((article) => ({
        title: article.title,
        summary: truncateText(String(article.summary || ""), NEWS_SUMMARY_CONTEXT_MAX),
        source: article.source,
        published_at: article.published_at,
      })),
    };

    const openAiResponse = await fetch(OPENAI_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: buildPrompt(context),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "race_brief",
            strict: true,
            schema: insightSchema,
          },
        },
      }),
    });

    if (!openAiResponse.ok) {
      const text = await openAiResponse.text();
      throw new Error(`OpenAI error: ${openAiResponse.status} ${text}`);
    }

    const openAiPayload = await openAiResponse.json();
    const outputText = pickOutputText(openAiPayload);
    if (!outputText) throw new Error("OpenAI returned no output text.");

    const insight = JSON.parse(outputText);
    const normalizedCategoryPredictions = normalizeCategoryPredictions(insight.category_predictions || [], categoryOptions);

    const row = {
      insight_key: "upcoming_race_brief",
      scope: "upcoming_race",
      race_name: raceName,
      meeting_key: upcomingRace.meeting_key || null,
      session_key: upcomingRace.session_key || null,
      headline: insight.headline,
      summary: insight.summary,
      confidence: insight.confidence,
      key_factors: insight.key_factors,
      prediction_edges: insight.prediction_edges,
      watchlist: insight.watchlist,
      news_article_ids: articles.map((article) => article.id),
      news_article_urls: articles.map((article) => article.url),
      source_count: sourceCount,
      provider: "openai",
      model,
      generated_at: new Date().toISOString(),
      metadata: {
        category_predictions: normalizedCategoryPredictions,
        race_summary: insight.race_summary,
        news_digest: insight.news_digest,
        source_year: year,
        target_race_date: upcomingRace.date_start,
        circuit: upcomingRace.circuit_short_name,
        country: upcomingRace.country_name,
        previous_race: previousRaceSummary,
        previous_race_weather: previousRaceWeather,
        previous_race_strategy: previousRaceStrategy,
      },
    };

    const { error: upsertError } = await supabase.from("ai_insights").upsert(row, { onConflict: "insight_key" });
    if (upsertError) throw new Error(upsertError.message);

    await supabase.from("ai_insight_runs").insert({
      scope: "upcoming_race",
      race_name: raceName,
      status: "ok",
      model,
      source_count: sourceCount,
      article_count: articleCount,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return respond({
      status: "ok",
      raceName,
      articleCount,
      sourceCount,
      headline: insight.headline,
    });
  } catch (error) {
    await supabase.from("ai_insight_runs").insert({
      scope: "upcoming_race",
      race_name: raceName,
      status: "error",
      model,
      source_count: sourceCount,
      article_count: articleCount,
      error_text: error instanceof Error ? error.message : "unknown error",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return respond({
      error: error instanceof Error ? error.message : "unknown error",
    }, 500);
  }
});
