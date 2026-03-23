// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENF1_BASE = "https://api.openf1.org/v1";
const OPENAI_BASE = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4o-mini";
const FALLBACK_ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_NEWS_ARTICLES = 10;

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

const insightSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "race_summary", "confidence", "news_digest", "key_factors", "prediction_edges", "watchlist", "category_predictions"],
  properties: {
    headline: { type: "string", minLength: 12 },
    summary: { type: "string", minLength: 160 },
    race_summary: { type: "string", minLength: 420 },
    confidence: { type: "number" },
    news_digest: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "detail", "why_it_matters"],
        properties: {
          headline: { type: "string", minLength: 10 },
          detail: { type: "string", minLength: 60 },
          why_it_matters: { type: "string", minLength: 40 },
        },
      },
    },
    key_factors: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "why_it_matters", "fantasy_take", "impact"],
        properties: {
          title: { type: "string", minLength: 10 },
          detail: { type: "string", minLength: 70 },
          why_it_matters: { type: "string", minLength: 40 },
          fantasy_take: { type: "string", minLength: 40 },
          impact: { type: "string", enum: ["positive", "negative", "mixed"] },
        },
      },
    },
    prediction_edges: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "detail", "action", "risk_level"],
        properties: {
          label: { type: "string", minLength: 10 },
          detail: { type: "string", minLength: 50 },
          action: { type: "string", minLength: 30 },
          risk_level: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    watchlist: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "trigger", "what_changes", "how_to_react"],
        properties: {
          label: { type: "string", minLength: 10 },
          trigger: { type: "string", minLength: 30 },
          what_changes: { type: "string", minLength: 30 },
          how_to_react: { type: "string", minLength: 30 },
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
          category: { type: "string", minLength: 4 },
          type: { type: "string", enum: ["driver", "constructor", "binary"] },
          pick: { type: "string", minLength: 2 },
          reason: { type: "string", minLength: 40 },
          confidence: { type: "number" },
        },
      },
    },
  },
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

async function fetchJson(url: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOpenF1(path: string) {
  return await fetchJson(`${OPENF1_BASE}${path}`, {
    accept: "application/json",
    "user-agent": "apex-fantasy-ai-race-brief/2.0",
  });
}

async function safeOpenF1(path: string) {
  try {
    return await fetchOpenF1(path);
  } catch (error) {
    console.error(`OpenF1 fetch failed for ${path}`, error);
    return [];
  }
}

async function loadRaceSessionsWithFallback(baseYear: number) {
  const candidateYears = [baseYear, baseYear - 1];

  for (const year of candidateYears) {
    const rawRaceSessions = await safeOpenF1(`/sessions?year=${year}&session_name=Race`);
    const raceSessions = sortByDate(rawRaceSessions);
    if (raceSessions.length) {
      return { year, raceSessions };
    }
  }

  return { year: baseYear, raceSessions: [] };
}

function formatSessionWindow(sessions: Array<Record<string, unknown>>) {
  return sessions.map((session) => ({
    session_name: session.session_name,
    session_type: session.session_type,
    date_start: session.date_start,
    location: session.location,
  }));
}

function getCategoryOptions(upcomingRace: Record<string, unknown>, meetingSessions: Array<Record<string, unknown>>) {
  const hasSprint =
    String(upcomingRace.meeting_name || "").toLowerCase().includes("sprint") ||
    meetingSessions.some((session) => String(session.session_name || "").toLowerCase().includes("sprint"));

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

function trimText(value: unknown, maxLength: number) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function buildPrompt(context: Record<string, unknown>) {
  return [
    "You are writing one sharp F1 race brief for fantasy players.",
    "Use only the supplied context.",
    "Be practical, specific, and concise.",
    "Return JSON only that matches the schema.",
    "For category_predictions, every pick must be an exact allowed value from category_options.",
    "Do not use team names for driver categories or driver names for constructor categories.",
    "",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function buildFallbackPickMap(hasSprint: boolean) {
  const picks = {
    pole: "Max Verstappen",
    winner: "George Russell",
    p2: "Oscar Piastri",
    p3: "Charles Leclerc",
    dnf: "Lance Stroll",
    fl: "Max Verstappen",
    dotd: "Lewis Hamilton",
    ctor: "McLaren",
    sc: "No",
    rf: "No",
  } as Record<string, string>;

  if (hasSprint) {
    picks.sp_pole = "Max Verstappen";
    picks.sp_winner = "George Russell";
    picks.sp_p2 = "Oscar Piastri";
    picks.sp_p3 = "Charles Leclerc";
  }

  return picks;
}

function buildFallbackInsight(context: Record<string, unknown>, categoryOptions: Array<Record<string, unknown>>, articles: Array<Record<string, unknown>>, reason: string) {
  const targetRace = context.target_race || {};
  const raceName = String(targetRace.race_name || "Upcoming Grand Prix");
  const circuit = String(targetRace.circuit || "the circuit");
  const country = String(targetRace.country || "the venue");
  const schedule = Array.isArray(targetRace.schedule) ? targetRace.schedule : [];
  const hasSprint = categoryOptions.some((option) => String(option.key).startsWith("sp_"));
  const defaultPickMap = buildFallbackPickMap(hasSprint);
  const newsLines = articles.slice(0, 3);

  const headline = `${raceName}: the main angles before qualifying`;
  const summary = newsLines.length
    ? `${raceName} is shaping up as a weekend where qualifying order and early pace read matter more than noise. The latest feed points to a small group of realistic front-runners, a few swing factors around setup and consistency, and enough uncertainty that fantasy players should keep their board flexible until the final pre-lock checks.`
    : `${raceName} is the next lock on the board, so the smartest move is to focus on the schedule, the likely front-running teams, and the biggest volatility signals before qualifying starts.`;

  const raceSummaryParts = [
    `${raceName} at ${circuit} in ${country} should be approached as a precision weekend. The core fantasy edge here is less about chasing every rumor and more about reading who actually looks stable enough to convert pace into qualifying position, race execution and category-level upside.`,
    newsLines.length
      ? `The latest stories are still useful because they point toward the themes worth tracking: ${newsLines.map((item) => trimText(item.title, 70)).join("; ")}. Rather than overreacting to every headline, use them to decide which teams and drivers deserve a second look when the final sessions come in.`
      : `Even without a deep article set, the schedule alone tells you where the pressure points are: qualifying pace, race management, and whether the weekend develops cleanly or turns volatile. That is enough to keep the board actionable.`,
    schedule.length
      ? `The session order matters: ${schedule.map((item) => `${item.session_name} on ${trimText(item.date_start, 22)}`).slice(0, 4).join(", ")}. Plan to make your final board decisions as late as possible so you can react to the strongest signals rather than locking too early.`
      : `Keep your final board decisions as late as possible. The best fantasy move is usually to wait for the clearest pace and reliability signals before lock.`,
  ];

  const newsDigest = newsLines.length
    ? newsLines.map((item) => ({
        headline: trimText(item.title, 70),
        detail: trimText(item.summary || item.title, 180),
        why_it_matters: "This headline helps narrow which drivers and constructors deserve the most attention before the board locks.",
      }))
    : [
        {
          headline: `${raceName} remains the focus`,
          detail: "The board is open and the priority is reading the session order, likely qualifying hierarchy and volatility signals rather than guessing too early.",
          why_it_matters: "When the news cycle is thin, timing and discipline become the real fantasy edge.",
        },
        {
          headline: "Use the late signals",
          detail: "Keep enough flexibility in the board to react to the clearest pre-lock information instead of relying on stale early-week reads.",
          why_it_matters: "Late-session pace and team stability usually matter more than broad race-week noise.",
        },
      ];

  const keyFactors = [
    {
      title: "Qualifying order should drive this board",
      detail: `${raceName} looks like the kind of weekend where the cleanest front-running package matters more than long-shot chaos picks.`,
      why_it_matters: "Pole, front-row and podium categories become tightly linked when the pace gap is small at the front.",
      fantasy_take: "Prioritize stable qualifying candidates before getting aggressive with contrarian picks.",
      impact: "positive",
    },
    {
      title: "Late-session confirmation matters more than early noise",
      detail: "The race-week feed is useful, but the strongest decisions still come from the last pre-lock signals rather than the first headlines.",
      why_it_matters: "Board value improves when you use the final pace and execution signals instead of locking too early.",
      fantasy_take: "Treat the brief as a direction setter, then confirm the final board with the latest session read.",
      impact: "mixed",
    },
  ];

  const predictionEdges = [
    {
      label: "Back the cleanest frontrunners",
      detail: "This board should lean toward drivers and teams that can convert pace into both qualifying position and race execution.",
      action: "Use the strongest all-around packages for pole, winner and constructor-heavy categories.",
      risk_level: "medium",
    },
    {
      label: "Avoid overreacting to one headline",
      detail: "Single stories can shift sentiment fast, but they do not always change the race-shape fundamentals.",
      action: "Use news to refine the shortlist, not to rebuild the whole board from scratch.",
      risk_level: "low",
    },
  ];

  const watchlist = [
    {
      label: "Front-running pace spread",
      trigger: "One team clears the field in the final pre-lock sessions.",
      what_changes: "That team becomes harder to fade for pole, winner and constructor calls.",
      how_to_react: "Concentrate the board instead of spreading picks across too many frontrunners.",
    },
    {
      label: "Weekend volatility signal",
      trigger: "Repeated incidents, interruptions or unstable execution start showing up before lock.",
      what_changes: "Safety car, red flag and DNF-style categories become more live.",
      how_to_react: "Upgrade chaos categories and reduce confidence on the cleanest-script assumptions.",
    },
  ];

  const categoryPredictions = categoryOptions.map((option) => ({
    key: option.key,
    category: option.label,
    type: option.type,
    pick: defaultPickMap[option.key] || option.allowed[0],
    reason: `Fallback brief: this pick keeps the board usable while upstream AI context is temporarily limited. Reconfirm it with the final pre-lock read for ${raceName}.`,
    confidence: 0.55,
  }));

  return {
    mode: "fallback",
    note: reason,
    headline,
    summary,
    race_summary: raceSummaryParts.join("\n\n"),
    confidence: 0.55,
    news_digest: newsDigest,
    key_factors: keyFactors,
    prediction_edges: predictionEdges,
    watchlist,
    category_predictions: categoryPredictions,
  };
}

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

    if (!upcomingRace) {
      throw new Error(`No OpenF1 race sessions were found for ${requestedYear} or ${requestedYear - 1}.`);
    }

    raceName = String(upcomingRace.meeting_name || upcomingRace.country_name || "Upcoming race");

    const [meetingSessionsRaw, articleResponse] = await Promise.all([
      safeOpenF1(`/sessions?meeting_key=${upcomingRace.meeting_key}`),
      supabase
        .from("news_articles")
        .select("id,title,summary,url,source,published_at")
        .order("published_at", { ascending: false })
        .limit(MAX_NEWS_ARTICLES),
    ]);

    if (articleResponse.error) throw new Error(articleResponse.error.message);

    const meetingSessions = sortByDate(meetingSessionsRaw);
    const articles = (articleResponse.data || []).map((article) => ({
      id: article.id,
      title: trimText(article.title, 140),
      summary: trimText(article.summary, 260),
      source: article.source,
      published_at: article.published_at,
      url: article.url,
    }));

    articleCount = articles.length;
    sourceCount = new Set(articles.map((article) => article.source).filter(Boolean)).size;

    const categoryOptions = getCategoryOptions(upcomingRace, meetingSessions);

    const context = {
      generated_at: new Date().toISOString(),
      target_race: {
        race_name: raceName,
        circuit: upcomingRace.circuit_short_name,
        country: upcomingRace.country_name,
        location: upcomingRace.location,
        date_start: upcomingRace.date_start,
        schedule: formatSessionWindow(meetingSessions),
      },
      category_options: categoryOptions,
      current_grid: CURRENT_GRID,
      recent_news: articles,
    };

    let insight;
    try {
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

      const parsed = JSON.parse(outputText);
      const normalizedCategoryPredictions = normalizeCategoryPredictions(parsed.category_predictions || [], categoryOptions);

      if (!normalizedCategoryPredictions.length) {
        throw new Error("OpenAI returned no usable category predictions.");
      }

      insight = {
        mode: "openai",
        headline: parsed.headline,
        summary: parsed.summary,
        race_summary: parsed.race_summary,
        confidence: parsed.confidence,
        news_digest: parsed.news_digest,
        key_factors: parsed.key_factors,
        prediction_edges: parsed.prediction_edges,
        watchlist: parsed.watchlist,
        category_predictions: normalizedCategoryPredictions,
      };
    } catch (aiError) {
      const reason = aiError instanceof Error ? aiError.message : "Upstream AI generation failed.";
      console.error("AI brief fallback activated", reason);
      insight = buildFallbackInsight(context, categoryOptions, articles, reason);
    }

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
      provider: insight.mode === "fallback" ? "fallback" : "openai",
      model,
      generated_at: new Date().toISOString(),
      metadata: {
        category_predictions: insight.category_predictions,
        race_summary: insight.race_summary,
        news_digest: insight.news_digest,
        source_year: year,
        target_race_date: upcomingRace.date_start,
        circuit: upcomingRace.circuit_short_name,
        country: upcomingRace.country_name,
        generation_mode: insight.mode,
        fallback_note: insight.note || null,
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
      error_text: insight.mode === "fallback" ? insight.note : null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return respond({
      status: "ok",
      raceName,
      articleCount,
      sourceCount,
      headline: insight.headline,
      mode: insight.mode,
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
