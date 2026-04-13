// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENF1_BASE = "https://api.openf1.org/v1";
const OPENAI_BASE = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1";
const FALLBACK_ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_NEWS_ARTICLES = 48;
const INACTIVE_RACE_STATUSES = new Set(["cancelled", "postponed"]);
const CALENDAR_NAME_OVERRIDES: Record<string, string> = {
  "miami-gp": "Miami GP",
  "us-gp": "US GP",
  "sao-paulo-gp": "Sao Paulo GP",
  "abu-dhabi-gp": "Abu Dhabi GP",
  "saudi-arabian-gp": "Saudi Arabian GP",
};

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
const CATEGORY_LABELS = new Map(
  [...BASE_CATEGORY_OPTIONS, ...SPRINT_CATEGORY_OPTIONS].map((option) => [option.key, option.label]),
);
const CATEGORY_RESULT_FIELDS = {
  pole: "pole",
  winner: "winner",
  p2: "p2",
  p3: "p3",
  fl: "fastest_lap",
  dotd: "dotd",
  ctor: "best_constructor",
  sp_pole: "sp_pole",
  sp_winner: "sp_winner",
  sp_p2: "sp_p2",
  sp_p3: "sp_p3",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
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

const webResearchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sources"],
  properties: {
    sources: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "source", "url", "summary", "relevance"],
        properties: {
          title: { type: "string", minLength: 8 },
          source: { type: "string", minLength: 2 },
          url: { type: "string", minLength: 8 },
          summary: { type: "string", minLength: 30 },
          relevance: { type: "string", minLength: 20 },
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

function normalizeRaceName(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/grand prix/g, "gp")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCaseSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (part === "gp") return "GP";
      if (part === "us") return "US";
      return `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function getCalendarRaceName(row: Record<string, unknown>) {
  const eventSlug = String(row?.event_slug || "").trim().toLowerCase();
  if (eventSlug && CALENDAR_NAME_OVERRIDES[eventSlug]) {
    return CALENDAR_NAME_OVERRIDES[eventSlug];
  }

  const displayName = String(row?.display_name || "").trim();
  if (displayName && !/united states gp/i.test(displayName)) {
    return displayName;
  }

  if (eventSlug) {
    return titleCaseSlug(eventSlug);
  }

  return String(row?.display_name || row?.race_name || row?.official_name || "").trim();
}

function getCalendarRaceStatus(row: Record<string, unknown>) {
  const overrideStatus = String(row?.override_status || "").trim().toLowerCase();
  if (overrideStatus) return overrideStatus;
  return String(row?.status || row?.event_status || "scheduled").trim().toLowerCase();
}

function parseCalendarRaceDate(row: Record<string, unknown>) {
  const raw = row?.race_date || row?.weekend_end || row?.weekend_start || null;
  const timestamp = raw ? new Date(String(raw)).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function sameRaceDay(left: unknown, right: unknown) {
  if (!left || !right) return false;
  return String(left).slice(0, 10) === String(right).slice(0, 10);
}

function parseRequestedRound(value: unknown) {
  const round = Number(value || 0);
  return Number.isFinite(round) && round > 0 ? round : null;
}

function calendarRowMatchesRequestedRound(row: Record<string, unknown>, requestedRound: number | null) {
  if (!requestedRound) return true;

  return Number(row?.internal_round_number || 0) === requestedRound
    || Number(row?.source_round_number || 0) === requestedRound;
}

function findRaceSessionForCalendarRow(row: Record<string, unknown>, raceSessions: Array<Record<string, unknown>>) {
  const targetSessionKey = Number(row?.race_session_key || 0);
  if (targetSessionKey > 0) {
    const bySession = raceSessions.find((session) => Number(session?.session_key || 0) === targetSessionKey);
    if (bySession) return bySession;
  }

  const targetMeetingKey = Number(row?.meeting_key || 0);
  if (targetMeetingKey > 0) {
    const byMeeting = raceSessions.find((session) => Number(session?.meeting_key || 0) === targetMeetingKey);
    if (byMeeting) return byMeeting;
  }

  const targetDate = row?.race_date || row?.weekend_end || row?.weekend_start || null;
  const targetName = normalizeRaceName(row?.display_name || row?.race_name || row?.official_name);

  return raceSessions.find((session) => {
    const sameDay = sameRaceDay(session?.date_start, targetDate);
    const sessionName = normalizeRaceName(session?.meeting_name || session?.country_name);
    return sameDay && (!targetName || sessionName === targetName);
  }) || raceSessions.find((session) => sameRaceDay(session?.date_start, targetDate)) || null;
}

async function loadUpcomingRaceFromCalendar(
  supabase: ReturnType<typeof createClient>,
  year: number,
  raceSessions: Array<Record<string, unknown>>,
  now: number,
  requestedRound: number | null = null,
) {
  const { data, error } = await supabase
    .from("race_calendar")
    .select("event_slug,internal_round_number,source_round_number,display_name,official_name,race_date,event_status,override_status,meeting_key,race_session_key,circuit_name,country_name,city_name,location,weekend_start,weekend_end,sprint")
    .eq("season", year)
    .order("source_round_number", { ascending: true })
    .order("race_date", { ascending: true });

  if (error) {
    console.warn("race_calendar lookup unavailable", error.message);
    return null;
  }

  const activeRows = (data || [])
    .filter((row) => !INACTIVE_RACE_STATUSES.has(getCalendarRaceStatus(row)))
    .sort((left, right) => parseCalendarRaceDate(left) - parseCalendarRaceDate(right));

  if (!activeRows.length) return null;

  const candidateRows = requestedRound
    ? activeRows.filter((row) => calendarRowMatchesRequestedRound(row, requestedRound))
    : activeRows.filter((row) => parseCalendarRaceDate(row) >= now - (36 * 60 * 60 * 1000));
  const fallbackRow = requestedRound
    ? activeRows.find((row) => calendarRowMatchesRequestedRound(row, requestedRound)) || null
    : activeRows[activeRows.length - 1] || null;

  for (const row of [...candidateRows, ...(fallbackRow ? [fallbackRow] : [])]) {
    if (!row) continue;

    const matchedSession = findRaceSessionForCalendarRow(row, raceSessions);

    return {
      ...(matchedSession || {}),
      meeting_name: getCalendarRaceName(row) || matchedSession?.meeting_name || matchedSession?.country_name || "Upcoming race",
      circuit_short_name: row.circuit_name || matchedSession?.circuit_short_name || null,
      country_name: row.country_name || matchedSession?.country_name || null,
      location: row.city_name || row.location || matchedSession?.location || null,
      date_start: matchedSession?.date_start || row.race_date || row.weekend_end || row.weekend_start || null,
      meeting_key: matchedSession?.meeting_key || row.meeting_key || null,
      session_key: matchedSession?.session_key || row.race_session_key || null,
      sprint: typeof row.sprint === "boolean" ? row.sprint : Boolean(matchedSession && String(matchedSession.meeting_name || "").toLowerCase().includes("sprint")),
      event_slug: row.event_slug || null,
      internal_round_number: Number(row.internal_round_number || 0) || null,
      source_round_number: Number(row.source_round_number || 0) || null,
      calendar_status: getCalendarRaceStatus(row),
    };
  }

  return null;
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
    upcomingRace?.sprint === true ||
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

  const existingKeys = new Set(filtered.map((item) => item.key));
  const hasSprint = allowedOptions.some((option) => String(option?.key || "").startsWith("sp_"));
  const fallbackPickMap = buildFallbackPickMap(hasSprint);

  for (const option of allowedOptions) {
    if (existingKeys.has(String(option.key))) continue;

    const allowed = Array.isArray(option.allowed) ? option.allowed : [];
    const fallbackPick = String(fallbackPickMap[String(option.key)] || allowed[0] || "").trim();
    if (!fallbackPick || !allowed.includes(fallbackPick)) continue;

    filtered.push({
      key: String(option.key),
      category: String(option.label),
      type: String(option.type || "driver"),
      pick: fallbackPick,
      reason: `Model completion fallback for ${String(option.label)}. This category was filled to keep the stored AI board complete for historical tracking.`,
      confidence: 0.35,
      allowed,
    });
  }

  return filtered
    .sort((left, right) => CATEGORY_ORDER.indexOf(left.key) - CATEGORY_ORDER.indexOf(right.key))
    .map(({ allowed, ...item }) => item);
}

function trimText(value: unknown, maxLength: number) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function buildPrompt(context: Record<string, unknown>) {
  const promptContext = buildPromptContext(context);
  return [
    "You are writing one sharp F1 race brief for fantasy players.",
    "Use the supplied database context as the backbone of the brief.",
    "Use live_web_research as the current-news layer beyond the supplied recent_news sample.",
    "Be practical, specific, and concise.",
    "Use historical_context to explain recent form, actual recent results, volatility, fantasy market behavior, and strategy trends when it materially sharpens the brief.",
    "Return JSON only that matches the schema.",
    "For category_predictions, every pick must be an exact allowed value from category_rules.allowed_values.",
    "Do not use team names for driver categories or driver names for constructor categories.",
    "",
    JSON.stringify(promptContext, null, 2),
  ].join("\n");
}

function buildWebResearchPrompt(context: Record<string, unknown>) {
  return [
    "Use live web search to gather the latest relevant F1 reporting for the target race.",
    "Do not limit yourself to the supplied recent_news sample.",
    "Prioritize official F1, FIA, team announcements, and reputable motorsport outlets.",
    "Return 3 to 8 sources as JSON only.",
    "",
    JSON.stringify({
      target_race: context?.target_race || {},
      recent_news: Array.isArray(context?.recent_news) ? context.recent_news.slice(0, 4) : [],
      database_summary: context?.database_summary || {},
    }, null, 2),
  ].join("\n");
}

function buildPromptContext(context: Record<string, unknown>) {
  const categoryOptions = coerceArray(context?.category_options);
  const allowedValues: Record<string, unknown> = {};

  for (const option of categoryOptions) {
    const type = String(option?.type || "").trim();
    if (!type || allowedValues[type]) continue;
    allowedValues[type] = coerceArray(option?.allowed);
  }

  const historicalContext = summarizeHistoricalContextForPrompt(context?.historical_context);

  return {
    generated_at: context?.generated_at || null,
    target_race: coerceObject(context?.target_race),
    database_summary: coerceObject(context?.database_summary),
    recent_news: coerceArray(context?.recent_news).slice(0, 6),
    historical_context: historicalContext,
    category_rules: {
      categories: categoryOptions.map((option) => ({
        key: option?.key || null,
        label: option?.label || null,
        type: option?.type || null,
      })),
      allowed_values: allowedValues,
    },
  };
}

function summarizeHistoricalContextForPrompt(historical: unknown) {
  const source = coerceObject(historical);

  return {
    previous_race: summarizeRaceOutcome(source?.previous_race),
    previous_race_weather: summarizeWeather(source?.previous_race_weather),
    previous_race_strategy: summarizeStrategy(source?.previous_race_strategy),
    last_5_driver_form: coerceArray(source?.last_5_driver_form).slice(0, 8),
    last_5_constructor_form: coerceArray(source?.last_5_constructor_form).slice(0, 6),
    season_stats: coerceObject(source?.season_stats),
    season_volatility: coerceObject(source?.season_volatility),
    weather_strategy_patterns: coerceObject(source?.weather_strategy_patterns),
    fantasy_market_signals: summarizeFantasyMarket(source?.fantasy_market_signals),
    recent_results: coerceArray(source?.recent_results).slice(0, 3).map((row) => ({
      race_round: row?.race_round || null,
      race_name: row?.race_name || null,
      race_date: row?.race_date || null,
      winner: row?.winner || null,
      pole: row?.pole || null,
      p2: row?.p2 || null,
      p3: row?.p3 || null,
      fastest_lap: row?.fastest_lap || null,
      best_constructor: row?.best_constructor || null,
      safety_car: row?.safety_car ?? null,
      red_flag: row?.red_flag ?? null,
    })),
    detailed_recent_history: coerceArray(source?.detailed_recent_history).slice(0, 2).map(summarizeDetailedHistoryRow),
  };
}

function summarizeDetailedHistoryRow(row: unknown) {
  const source = coerceObject(row);
  const openf1 = coerceObject(source?.openf1_detail);
  const pace = coerceObject(openf1?.pace);
  const lapSummary = coerceObject(pace?.lap_summary);
  const positionSummary = coerceObject(pace?.position_summary);
  const overtakeSummary = coerceObject(pace?.overtake_summary);

  return {
    race_round: source?.race_round || null,
    race_name: source?.race_name || null,
    race_date: source?.race_date || null,
    race_outcome: summarizeRaceOutcome(source?.race_outcome),
    qualifying_outcome: summarizeQualifyingOutcome(source?.qualifying_outcome),
    sprint_outcome: summarizeSprintOutcome(source?.sprint_outcome),
    weather_summary: summarizeWeather(source?.weather_summary),
    strategy_summary: summarizeStrategy(source?.strategy_summary),
    volatility_summary: coerceObject(source?.volatility_summary),
    openf1_detail: {
      datapoint_counts: coerceObject(openf1?.datapoint_counts),
      meeting: {
        meeting_name: openf1?.meeting?.meeting_name || null,
        country_name: openf1?.meeting?.country_name || null,
        circuit: openf1?.meeting?.circuit || null,
        sessions: coerceArray(openf1?.meeting?.sessions).slice(0, 3),
      },
      classifications: {
        race: coerceArray(openf1?.classifications?.race).slice(0, 3),
        qualifying: coerceArray(openf1?.classifications?.qualifying).slice(0, 3),
        sprint: coerceArray(openf1?.classifications?.sprint).slice(0, 3),
      },
      race_control: {
        counts: coerceObject(openf1?.race_control?.counts),
        key_events: coerceArray(openf1?.race_control?.key_events).slice(0, 4),
      },
      strategy: {
        pit_summary: {
          total_pit_events: toFiniteNumber(openf1?.strategy?.pit_summary?.total_pit_events),
          total_stops: toFiniteNumber(openf1?.strategy?.pit_summary?.total_stops),
        },
        stints_by_driver: coerceArray(openf1?.strategy?.stints_by_driver).slice(0, 4),
      },
      pace: {
        lap_summary: {
          sampled_laps: toFiniteNumber(lapSummary?.sampled_laps),
          fastest_laps: coerceArray(lapSummary?.fastest_laps).slice(0, 2),
          driver_pace: coerceArray(lapSummary?.driver_pace).slice(0, 4),
        },
        position_summary: {
          sampled_points: toFiniteNumber(positionSummary?.sampled_points),
          leader_changes: toFiniteNumber(positionSummary?.leader_changes),
          leader_timeline: coerceArray(positionSummary?.leader_timeline).slice(0, 3),
          by_driver: coerceArray(positionSummary?.by_driver).slice(0, 4),
        },
        overtake_summary: {
          total_overtakes: toFiniteNumber(overtakeSummary?.total_overtakes),
          by_driver: coerceArray(overtakeSummary?.by_driver).slice(0, 4),
        },
      },
      weather: {
        summary: coerceObject(openf1?.weather?.summary),
      },
    },
  };
}

function summarizeRaceOutcome(value: unknown) {
  const source = coerceObject(value);
  return {
    winner: source?.winner || null,
    p2: source?.p2 || null,
    p3: source?.p3 || null,
    podium: coerceArray(source?.podium).slice(0, 3),
    fastest_lap: source?.fastest_lap || null,
    best_constructor: source?.best_constructor || null,
    dnf_count: toFiniteNumber(source?.dnf_count),
    finishers_count: toFiniteNumber(source?.finishers_count),
    safety_car_count: toFiniteNumber(source?.safety_car_count),
    red_flag_count: toFiniteNumber(source?.red_flag_count),
  };
}

function summarizeQualifyingOutcome(value: unknown) {
  const source = coerceObject(value);
  return {
    pole: source?.pole || null,
    front_row: coerceArray(source?.front_row).slice(0, 2),
    top_10: coerceArray(source?.top_10).slice(0, 6),
  };
}

function summarizeSprintOutcome(value: unknown) {
  const source = coerceObject(value);
  return {
    has_sprint: source?.has_sprint ?? null,
    sprint_pole: source?.sprint_pole || null,
    podium: coerceArray(source?.podium).slice(0, 3),
  };
}

function summarizeWeather(value: unknown) {
  const source = coerceObject(value);
  return {
    rainfall: source?.rainfall ?? null,
    air_temperature_avg: toFiniteNumber(source?.air_temperature_avg),
    track_temperature_avg: toFiniteNumber(source?.track_temperature_avg),
    humidity_avg: toFiniteNumber(source?.humidity_avg),
    sample_count: toFiniteNumber(source?.sample_count),
  };
}

function summarizeStrategy(value: unknown) {
  const source = coerceObject(value);
  return {
    average_stints_per_driver: toFiniteNumber(source?.average_stints_per_driver),
    average_pit_stops_per_driver: toFiniteNumber(source?.average_pit_stops_per_driver),
    zero_stop_drivers: toFiniteNumber(source?.zero_stop_drivers),
    one_stop_drivers: toFiniteNumber(source?.one_stop_drivers),
    two_stop_drivers: toFiniteNumber(source?.two_stop_drivers),
    three_plus_stop_drivers: toFiniteNumber(source?.three_plus_stop_drivers),
    most_common_opening_compound: source?.most_common_opening_compound || null,
    most_common_compound: source?.most_common_compound || null,
  };
}

function summarizeFantasyMarket(value: unknown) {
  const source = coerceObject(value);
  return {
    rounds_sampled: toFiniteNumber(source?.rounds_sampled),
    scored_predictions: toFiniteNumber(source?.scored_predictions),
    average_score: toFiniteNumber(source?.average_score),
    crowd_favorites: coerceArray(source?.crowd_favorites).slice(0, 4),
  };
}

function isPlainObject(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractWebSources(payload: Record<string, unknown>) {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const sources = [];

  for (const item of output) {
    const actionSources = Array.isArray(item?.action?.sources) ? item.action.sources : [];
    for (const source of actionSources) {
      const url = String(source?.url || "").trim();
      if (!url) continue;
      sources.push({
        title: String(source?.title || "").trim() || url,
        url,
        source: String(source?.site_name || source?.source || "").trim() || null,
      });
    }

    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      const annotations = Array.isArray(part?.annotations) ? part.annotations : [];
      for (const annotation of annotations) {
        if (String(annotation?.type || "") !== "url_citation") continue;
        const url = String(annotation?.url || "").trim();
        if (!url) continue;
        sources.push({
          title: String(annotation?.title || "").trim() || url,
          url,
          source: null,
        });
      }
    }
  }

  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).slice(0, 10);
}

function normalizeResearchSources(items: Array<Record<string, unknown>>) {
  function hostLabel(url: unknown) {
    try {
      return new URL(String(url || "")).hostname.replace(/^www\./i, "");
    } catch (_error) {
      return "";
    }
  }

  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      title: trimText(item?.title, 140),
      source: trimText(item?.source, 60) || trimText(hostLabel(item?.url), 60),
      url: String(item?.url || "").trim(),
      summary: trimText(item?.summary, 220) || trimText(item?.title, 220),
      relevance: trimText(item?.relevance, 180) || "Relevant recent coverage surfaced by live web research.",
    }))
    .filter((item) => /^https?:\/\//i.test(item.url) && item.title && item.source && item.summary && item.relevance);
}

async function generateLiveWebResearch(context: Record<string, unknown>, openAiKey: string, model: string) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(OPENAI_BASE, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          tools: [
            { type: "web_search" },
          ],
          tool_choice: "required",
          include: ["web_search_call.action.sources"],
          input: [
            {
              role: "user",
              content: buildWebResearchPrompt(context),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "stint_live_web_research",
              strict: true,
              schema: webResearchSchema,
            },
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI research error: ${response.status} ${text}`);
      }

      const payload = await response.json();
      const outputText = pickOutputText(payload);
      if (!outputText) throw new Error("OpenAI research returned no output text.");

      const parsed = JSON.parse(outputText);
      const structuredSources = normalizeResearchSources(parsed?.sources || []);
      const citedSources = normalizeResearchSources(
        extractWebSources(payload).map((source) => ({
          ...source,
          summary: source.title,
          relevance: "Captured from the live OpenAI web search citation trail.",
        })),
      );
      const merged = [...structuredSources, ...citedSources].filter((source, index, list) => (
        list.findIndex((candidate) => candidate.url === source.url) === index
      ));

      if (merged.length >= 1) {
        return merged.slice(0, 8);
      }

      lastError = new Error("OpenAI research returned no usable sources.");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("OpenAI web research failed.");
    }
  }

  throw lastError || new Error("OpenAI web research failed.");
}

async function generateInsightForContext({
  context,
  categoryOptions,
  articles,
  openAiKey,
  model,
}: {
  context: Record<string, unknown>;
  categoryOptions: Array<Record<string, unknown>>;
  articles: Array<Record<string, unknown>>;
  openAiKey: string;
  model: string;
}) {
  try {
    const liveWebResearch = await generateLiveWebResearch(context, openAiKey, model);
    const enrichedContext = {
      ...context,
      live_web_research: liveWebResearch,
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
            content: buildPrompt(enrichedContext),
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

    return {
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
      model,
      research_sources: liveWebResearch,
    };
  } catch (aiError) {
    const reason = aiError instanceof Error ? aiError.message : "Upstream AI generation failed.";
    console.error("AI brief fallback activated", reason);
    return buildFallbackInsight(context, categoryOptions, articles, reason);
  }
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

function toFiniteNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function roundMetric(value: unknown, digits = 1) {
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  const factor = 10 ** digits;
  return Math.round(next * factor) / factor;
}

function average(values: Array<unknown>, digits = 1) {
  const numbers = values
    .map(toFiniteNumber)
    .filter((value): value is number => value !== null);

  if (!numbers.length) return null;
  return roundMetric(numbers.reduce((sum, value) => sum + value, 0) / numbers.length, digits);
}

function coerceArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function coerceObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeListValue(value: unknown) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  if (typeof value === "string") {
    return [...new Set(
      value
        .split(/\s*\|\s*|\s*,\s*/)
        .map((item) => item.trim())
        .filter(Boolean)
    )];
  }

  if (value) {
    const normalized = String(value).trim();
    return normalized ? [normalized] : [];
  }

  return [];
}

function countMapLeader(counts: Record<string, unknown>) {
  const entries = Object.entries(counts || {}).filter(([, value]) => Number(value) > 0);
  entries.sort((left, right) => {
    if (Number(right[1]) !== Number(left[1])) return Number(right[1]) - Number(left[1]);
    return left[0].localeCompare(right[0]);
  });
  return entries[0]?.[0] || null;
}

function compareAverageFinish(left: number | null, right: number | null) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function sortDriverForm(list: Array<Record<string, unknown>>) {
  return [...list].sort((left, right) => {
    if (Number(right.points || 0) !== Number(left.points || 0)) return Number(right.points || 0) - Number(left.points || 0);
    if (Number(right.wins || 0) !== Number(left.wins || 0)) return Number(right.wins || 0) - Number(left.wins || 0);
    if (Number(right.podiums || 0) !== Number(left.podiums || 0)) return Number(right.podiums || 0) - Number(left.podiums || 0);
    const finishComparison = compareAverageFinish(toFiniteNumber(left.average_finish), toFiniteNumber(right.average_finish));
    if (finishComparison !== 0) return finishComparison;
    return String(left.driver || "").localeCompare(String(right.driver || ""));
  });
}

function sortConstructorForm(list: Array<Record<string, unknown>>) {
  return [...list].sort((left, right) => {
    if (Number(right.points || 0) !== Number(left.points || 0)) return Number(right.points || 0) - Number(left.points || 0);
    if (Number(right.wins || 0) !== Number(left.wins || 0)) return Number(right.wins || 0) - Number(left.wins || 0);
    if (Number(right.podiums || 0) !== Number(left.podiums || 0)) return Number(right.podiums || 0) - Number(left.podiums || 0);
    return String(left.team || "").localeCompare(String(right.team || ""));
  });
}

function aggregateDriverForm(rows: Array<Record<string, unknown>>) {
  const aggregate = new Map<string, Record<string, unknown>>();

  for (const row of rows || []) {
    for (const entry of coerceArray(row?.driver_results)) {
      const driver = String(entry?.driver || "").trim();
      if (!driver) continue;

      const current = aggregate.get(driver) || {
        driver,
        team: entry?.team || null,
        points: 0,
        finishes: [],
        wins: 0,
        podiums: 0,
        poles: 0,
        fastest_laps: 0,
        dnf_count: 0,
        rounds: 0,
      };

      current.team = entry?.team || current.team || null;
      current.points += Number(entry?.weekend_points || 0);
      const finish = toFiniteNumber(entry?.race_finish);
      if (finish !== null) current.finishes.push(finish);
      current.wins += entry?.won_race ? 1 : 0;
      current.podiums += entry?.podium ? 1 : 0;
      current.poles += entry?.pole ? 1 : 0;
      current.fastest_laps += entry?.fastest_lap ? 1 : 0;
      current.dnf_count += entry?.dnf ? 1 : 0;
      current.rounds += 1;

      aggregate.set(driver, current);
    }
  }

  return sortDriverForm(
    [...aggregate.values()].map((entry) => ({
      driver: entry.driver,
      team: entry.team,
      points: Number(entry.points || 0),
      average_finish: average(entry.finishes || [], 2),
      wins: Number(entry.wins || 0),
      podiums: Number(entry.podiums || 0),
      poles: Number(entry.poles || 0),
      fastest_laps: Number(entry.fastest_laps || 0),
      dnf_count: Number(entry.dnf_count || 0),
      rounds: Number(entry.rounds || 0),
    })),
  );
}

function aggregateConstructorForm(rows: Array<Record<string, unknown>>) {
  const aggregate = new Map<string, Record<string, unknown>>();

  for (const row of rows || []) {
    for (const entry of coerceArray(row?.constructor_results)) {
      const team = String(entry?.team || "").trim();
      if (!team) continue;

      const current = aggregate.get(team) || {
        team,
        points: 0,
        wins: 0,
        podiums: 0,
        top10_finishes: 0,
        rounds: 0,
      };

      current.points += Number(entry?.weekend_points || 0);
      current.wins += Number(entry?.wins || 0);
      current.podiums += Number(entry?.podiums || 0);
      current.top10_finishes += Number(entry?.top10_finishes || 0);
      current.rounds += 1;

      aggregate.set(team, current);
    }
  }

  return sortConstructorForm(
    [...aggregate.values()].map((entry) => ({
      team: entry.team,
      points: Number(entry.points || 0),
      average_points: roundMetric(Number(entry.points || 0) / Math.max(Number(entry.rounds || 1), 1), 2),
      wins: Number(entry.wins || 0),
      podiums: Number(entry.podiums || 0),
      top10_finishes: Number(entry.top10_finishes || 0),
      rounds: Number(entry.rounds || 0),
    })),
  );
}

function topByMetric(entries: Array<Record<string, unknown>>, metric: string, key: string, limit = 5) {
  return [...entries]
    .sort((left, right) => {
      if (Number(right?.[metric] || 0) !== Number(left?.[metric] || 0)) return Number(right?.[metric] || 0) - Number(left?.[metric] || 0);
      if (metric !== "average_finish") {
        const finishComparison = compareAverageFinish(toFiniteNumber(left?.average_finish), toFiniteNumber(right?.average_finish));
        if (finishComparison !== 0) return finishComparison;
      }
      return String(left?.[key] || "").localeCompare(String(right?.[key] || ""));
    })
    .slice(0, limit);
}

function buildPreviousRace(row: Record<string, unknown> | null) {
  if (!row) return null;

  const outcome = coerceObject(row?.race_outcome);
  const volatility = coerceObject(row?.volatility_summary);

  return {
    round: toFiniteNumber(row?.race_round),
    race_name: row?.race_name || null,
    winner: outcome.winner || null,
    podium: coerceArray(outcome.podium).filter(Boolean),
    fastest_lap: outcome.fastest_lap || null,
    best_constructor: outcome.best_constructor || null,
    dnfCount: toFiniteNumber(outcome.dnf_count ?? volatility.dnf_count),
    safetyCarCount: toFiniteNumber(outcome.safety_car_count ?? volatility.safety_car_count),
    redFlagCount: toFiniteNumber(outcome.red_flag_count ?? volatility.red_flag_count),
  };
}

function buildPreviousRaceWeather(row: Record<string, unknown> | null) {
  if (!row) return null;
  const weather = coerceObject(row?.weather_summary);
  return Object.keys(weather).length ? weather : null;
}

function buildPreviousRaceStrategy(row: Record<string, unknown> | null) {
  if (!row) return null;
  const strategy = coerceObject(row?.strategy_summary);
  if (!Object.keys(strategy).length) return null;

  return {
    average_stints_per_driver: strategy.average_stints_per_driver ?? null,
    average_pit_stops_per_driver: strategy.average_pit_stops_per_driver ?? null,
    most_common_opening_compound: strategy.most_common_opening_compound || null,
    most_common_compound: strategy.most_common_compound || null,
    zero_stop_drivers: strategy.zero_stop_drivers ?? null,
    one_stop_drivers: strategy.one_stop_drivers ?? null,
    two_stop_drivers: strategy.two_stop_drivers ?? null,
    three_plus_stop_drivers: strategy.three_plus_stop_drivers ?? null,
  };
}

function buildHistoricalForm(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return null;

  const recentRows = rows.slice(0, 5);
  const driverForm = aggregateDriverForm(recentRows);
  const constructorForm = aggregateConstructorForm(recentRows);

  return {
    rounds_sampled: recentRows.length,
    last_5_rounds: recentRows.map((row) => ({
      round: toFiniteNumber(row?.race_round),
      race_name: row?.race_name || null,
    })),
    last_5_driver_form: driverForm.slice(0, 5),
    last_5_constructor_form: constructorForm.slice(0, 5),
  };
}

function buildSeasonStats(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return null;

  const driverForm = aggregateDriverForm(rows);
  const constructorForm = aggregateConstructorForm(rows);
  const winners = [...new Set(rows.map((row) => coerceObject(row?.race_outcome).winner).filter(Boolean))];
  const poleSitters = [...new Set(rows.map((row) => coerceObject(row?.qualifying_outcome).pole).filter(Boolean))];

  return {
    rounds_sampled: rows.length,
    different_winners: winners.length,
    different_pole_sitters: poleSitters.length,
    driver_leaders: {
      weekend_points: driverForm.slice(0, 5),
      wins: topByMetric(driverForm, "wins", "driver"),
      podiums: topByMetric(driverForm, "podiums", "driver"),
      poles: topByMetric(driverForm, "poles", "driver"),
      fastest_laps: topByMetric(driverForm, "fastest_laps", "driver"),
    },
    constructor_leaders: {
      weekend_points: constructorForm.slice(0, 5),
      wins: topByMetric(constructorForm, "wins", "team"),
      podiums: topByMetric(constructorForm, "podiums", "team"),
    },
  };
}

function buildSeasonVolatility(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return null;

  const volatilityRows = rows.map((row) => coerceObject(row?.volatility_summary));
  const weatherRows = rows.map((row) => coerceObject(row?.weather_summary));
  const strategyRows = rows.map((row) => coerceObject(row?.strategy_summary));
  const safetyCarRaces = volatilityRows.filter((item) => item.safety_car).length;
  const redFlagRaces = volatilityRows.filter((item) => item.red_flag).length;
  const wetRaces = weatherRows.filter((item) => item.rainfall === true).length;

  return {
    rounds_sampled: rows.length,
    total_dnfs: volatilityRows.reduce((sum, item) => sum + Number(item.dnf_count || 0), 0),
    average_dnfs_per_race: average(volatilityRows.map((item) => item.dnf_count), 2),
    safety_car_races: safetyCarRaces,
    safety_car_rate: roundMetric(safetyCarRaces / rows.length, 3),
    average_safety_cars_per_race: average(volatilityRows.map((item) => item.safety_car_count), 2),
    red_flag_races: redFlagRaces,
    red_flag_rate: roundMetric(redFlagRaces / rows.length, 3),
    average_red_flags_per_race: average(volatilityRows.map((item) => item.red_flag_count), 2),
    average_virtual_safety_cars_per_race: average(volatilityRows.map((item) => item.virtual_safety_car_count), 2),
    wet_race_count: wetRaces,
    wet_race_rate: roundMetric(wetRaces / rows.length, 3),
    average_pit_stops_per_driver: average(strategyRows.map((item) => item.average_pit_stops_per_driver), 2),
  };
}

function buildWeatherStrategyPatterns(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return null;

  const weatherRows = rows.map((row) => coerceObject(row?.weather_summary));
  const strategyRows = rows.map((row) => coerceObject(row?.strategy_summary));
  const openingCounts = {};
  const compoundCounts = {};

  for (const row of strategyRows) {
    const opening = coerceObject(row?.opening_compounds);
    const compounds = coerceObject(row?.compound_usage);

    for (const [compound, count] of Object.entries(opening)) {
      openingCounts[compound] = (openingCounts[compound] || 0) + Number(count || 0);
    }

    for (const [compound, count] of Object.entries(compounds)) {
      compoundCounts[compound] = (compoundCounts[compound] || 0) + Number(count || 0);
    }
  }

  return {
    rounds_sampled: rows.length,
    wet_race_count: weatherRows.filter((item) => item.rainfall === true).length,
    dry_race_count: weatherRows.filter((item) => item.rainfall !== true).length,
    air_temperature_avg: average(weatherRows.map((item) => item.air_temperature_avg), 1),
    track_temperature_avg: average(weatherRows.map((item) => item.track_temperature_avg), 1),
    humidity_avg: average(weatherRows.map((item) => item.humidity_avg), 1),
    average_stints_per_driver: average(strategyRows.map((item) => item.average_stints_per_driver), 2),
    average_pit_stops_per_driver: average(strategyRows.map((item) => item.average_pit_stops_per_driver), 2),
    most_common_opening_compound: countMapLeader(openingCounts),
    most_common_compound: countMapLeader(compoundCounts),
  };
}

function categoryValueMatches(categoryKey: string, pick: string, result: Record<string, unknown>) {
  if (!pick || !result) return false;

  if (categoryKey === "dnf") {
    return normalizeListValue(result.dnf_list || result.dnf).includes(pick);
  }

  if (categoryKey === "sc") {
    return pick === (result.safety_car ? "Yes" : "No");
  }

  if (categoryKey === "rf") {
    return pick === (result.red_flag ? "Yes" : "No");
  }

  const field = CATEGORY_RESULT_FIELDS[categoryKey];
  if (!field) return false;
  return pick === String(result[field] || "");
}

function buildFantasyMarket(predictions: Array<Record<string, unknown>>, resultsRows: Array<Record<string, unknown>>) {
  if (!predictions.length || !resultsRows.length) return null;

  const resultsByRound = new Map(resultsRows.map((row) => [Number(row.race_round), row]));
  const categoryStats = new Map<string, Record<string, unknown>>();
  const scores = predictions.map((prediction) => Number(prediction?.score)).filter(Number.isFinite);

  for (const prediction of predictions) {
    const raceRound = Number(prediction?.race_round || 0);
    const result = resultsByRound.get(raceRound);
    if (!result) continue;

    const picks = coerceObject(prediction?.picks);
    for (const [categoryKey, rawPick] of Object.entries(picks)) {
      const pick = String(rawPick || "").trim();
      if (!pick || !CATEGORY_LABELS.has(categoryKey)) continue;

      const currentCategory = categoryStats.get(categoryKey) || {
        category: CATEGORY_LABELS.get(categoryKey),
        samples: 0,
        picks: new Map<string, Record<string, unknown>>(),
      };

      const pickStats = currentCategory.picks.get(pick) || {
        pick,
        count: 0,
        matches: 0,
      };

      pickStats.count += 1;
      if (categoryValueMatches(categoryKey, pick, result)) {
        pickStats.matches += 1;
      }

      currentCategory.samples += 1;
      currentCategory.picks.set(pick, pickStats);
      categoryStats.set(categoryKey, currentCategory);
    }
  }

  const categoryConsensus = {};
  const crowdFavorites = [];

  for (const [categoryKey, entry] of categoryStats.entries()) {
    const ranked = [...entry.picks.values()].sort((left, right) => {
      if (Number(right.count || 0) !== Number(left.count || 0)) return Number(right.count || 0) - Number(left.count || 0);
      if (Number(right.matches || 0) !== Number(left.matches || 0)) return Number(right.matches || 0) - Number(left.matches || 0);
      return String(left.pick || "").localeCompare(String(right.pick || ""));
    });

    const leader = ranked[0] || null;
    categoryConsensus[categoryKey] = leader ? {
      category: entry.category,
      pick: leader.pick,
      share: roundMetric(Number(leader.count || 0) / Math.max(Number(entry.samples || 1), 1), 3),
      accuracy: roundMetric(Number(leader.matches || 0) / Math.max(Number(leader.count || 1), 1), 3),
      samples: Number(entry.samples || 0),
      top_picks: ranked.slice(0, 3).map((item) => ({
        pick: item.pick,
        share: roundMetric(Number(item.count || 0) / Math.max(Number(entry.samples || 1), 1), 3),
        accuracy: roundMetric(Number(item.matches || 0) / Math.max(Number(item.count || 1), 1), 3),
        picks: Number(item.count || 0),
      })),
    } : null;

    if (leader) {
      crowdFavorites.push({
        key: categoryKey,
        category: entry.category,
        pick: leader.pick,
        share: roundMetric(Number(leader.count || 0) / Math.max(Number(entry.samples || 1), 1), 3),
        accuracy: roundMetric(Number(leader.matches || 0) / Math.max(Number(leader.count || 1), 1), 3),
        samples: Number(entry.samples || 0),
      });
    }
  }

  crowdFavorites.sort((left, right) => {
    if (Number(right.share || 0) !== Number(left.share || 0)) return Number(right.share || 0) - Number(left.share || 0);
    if (Number(right.samples || 0) !== Number(left.samples || 0)) return Number(right.samples || 0) - Number(left.samples || 0);
    return String(left.category || "").localeCompare(String(right.category || ""));
  });

  return {
    rounds_sampled: new Set(resultsRows.map((row) => Number(row.race_round || 0))).size,
    scored_predictions: predictions.length,
    average_score: average(scores, 2),
    category_consensus: categoryConsensus,
    crowd_favorites: crowdFavorites.slice(0, 5),
  };
}

function buildRecentResults(historyRows: Array<Record<string, unknown>>, resultsRows: Array<Record<string, unknown>>) {
  const resultsByRound = new Map(resultsRows.map((row) => [Number(row.race_round || 0), row]));

  return historyRows.slice(0, 5).map((row) => {
    const round = Number(row?.race_round || 0);
    const result = resultsByRound.get(round) || {};
    const raceOutcome = coerceObject(row?.race_outcome);
    const qualifyingOutcome = coerceObject(row?.qualifying_outcome);
    const podium = coerceArray(raceOutcome?.podium);

    return {
      race_round: round || null,
      race_name: row?.race_name || null,
      race_date: row?.race_date || null,
      winner: result?.winner || raceOutcome?.winner || null,
      pole: result?.pole || qualifyingOutcome?.pole || null,
      p2: result?.p2 || podium[1] || raceOutcome?.p2 || null,
      p3: result?.p3 || podium[2] || raceOutcome?.p3 || null,
      fastest_lap: result?.fastest_lap || raceOutcome?.fastest_lap || null,
      best_constructor: result?.best_constructor || raceOutcome?.best_constructor || null,
      safety_car: typeof result?.safety_car === "boolean" ? result.safety_car : Number(raceOutcome?.safety_car_count || 0) > 0,
      red_flag: typeof result?.red_flag === "boolean" ? result.red_flag : Number(raceOutcome?.red_flag_count || 0) > 0,
    };
  });
}

function normalizeSourcePayloadForContext(payload: Record<string, unknown> | null) {
  const source = coerceObject(payload);
  const simplifyClassification = (rows: unknown, limit = 6) => coerceArray(rows).slice(0, limit).map((row) => ({
    position: toFiniteNumber(row?.position),
    driver: row?.driver || null,
    team: row?.team || null,
    points: toFiniteNumber(row?.points),
    status: row?.status || null,
    dnf: typeof row?.dnf === "boolean" ? row.dnf : null,
  }));
  const simplifySessions = (rows: unknown) => coerceArray(rows).slice(0, 6).map((row) => ({
    session_name: row?.session_name || null,
    session_type: row?.session_type || null,
    date_start: row?.date_start || null,
  }));
  const simplifyRaceControl = (rows: unknown) => coerceArray(rows).slice(0, 6).map((row) => ({
    lap_number: toFiniteNumber(row?.lap_number),
    category: row?.category || null,
    flag: row?.flag || null,
    driver: row?.driver || null,
    message: trimText(row?.message, 120),
  }));
  const simplifyStints = (rows: unknown) => coerceArray(rows).slice(0, 6).map((row) => ({
    driver: row?.driver || null,
    team: row?.team || null,
    stint_count: toFiniteNumber(row?.stint_count),
    pit_stops: toFiniteNumber(row?.pit_stops),
    opening_compound: row?.opening_compound || null,
    compounds: coerceArray(row?.compounds).slice(0, 4),
  }));
  const lapSummary = coerceObject(source?.lap_summary);
  const positionSummary = coerceObject(source?.position_summary);
  const overtakeSummary = coerceObject(source?.overtake_summary);

  return {
    meeting: {
      meeting_name: source?.meeting_name || null,
      country_name: source?.country_name || null,
      circuit: source?.circuit || null,
      sessions: simplifySessions(source?.meeting_sessions),
    },
    classifications: {
      starting_grid: simplifyClassification(source?.starting_grid, 6),
      race: simplifyClassification(source?.race_classification, 6),
      qualifying: simplifyClassification(source?.qualifying_classification, 6),
      sprint: simplifyClassification(source?.sprint_classification, 5),
      sprint_qualifying: simplifyClassification(source?.sprint_qualifying_classification, 6),
    },
    race_control: {
      counts: coerceObject(source?.race_control_summary),
      key_events: simplifyRaceControl(source?.race_control_events),
    },
    strategy: {
      pit_summary: coerceObject(source?.pit_stop_summary),
      stints_by_driver: simplifyStints(source?.strategy_detail?.stints_by_driver),
    },
    pace: {
      lap_summary: {
        sampled_laps: toFiniteNumber(lapSummary?.sampled_laps),
        fastest_laps: coerceArray(lapSummary?.fastest_laps).slice(0, 3),
        driver_pace: coerceArray(lapSummary?.driver_pace).slice(0, 6),
      },
      position_summary: {
        sampled_points: toFiniteNumber(positionSummary?.sampled_points),
        leader_changes: toFiniteNumber(positionSummary?.leader_changes),
        leader_timeline: coerceArray(positionSummary?.leader_timeline).slice(0, 4),
        by_driver: coerceArray(positionSummary?.by_driver).slice(0, 6),
      },
      overtake_summary: {
        total_overtakes: toFiniteNumber(overtakeSummary?.total_overtakes),
        by_driver: coerceArray(overtakeSummary?.by_driver).slice(0, 6),
      },
    },
    weather: {
      summary: coerceObject(source?.weather_summary_detail),
      samples: coerceArray(source?.weather_timeline).slice(0, 4),
    },
    datapoint_counts: coerceObject(source?.counts),
  };
}

async function resolveUpcomingRound(supabase: ReturnType<typeof createClient>, year: number, upcomingRace: Record<string, unknown>, raceSessions: Array<Record<string, unknown>>) {
  const embeddedRound = Number(upcomingRace?.internal_round_number || upcomingRace?.source_round_number || 0);
  if (embeddedRound > 0) return embeddedRound;

  try {
    const bySession = await supabase
      .from("race_calendar")
      .select("internal_round_number,source_round_number")
      .eq("season", year)
      .eq("race_session_key", Number(upcomingRace?.session_key || 0))
      .maybeSingle();

    if (bySession?.data?.internal_round_number) return Number(bySession.data.internal_round_number);
    if (bySession?.data?.source_round_number) return Number(bySession.data.source_round_number);

    const byMeeting = await supabase
      .from("race_calendar")
      .select("internal_round_number,source_round_number")
      .eq("season", year)
      .eq("meeting_key", Number(upcomingRace?.meeting_key || 0))
      .maybeSingle();

    if (byMeeting?.data?.internal_round_number) return Number(byMeeting.data.internal_round_number);
    if (byMeeting?.data?.source_round_number) return Number(byMeeting.data.source_round_number);
  } catch (_error) {
    // Fall back to OpenF1 session ordering below.
  }

  const orderedSessions = sortByDate(raceSessions);
  const index = orderedSessions.findIndex((session) => Number(session?.session_key || 0) === Number(upcomingRace?.session_key || 0));
  return index >= 0 ? index + 1 : null;
}

function buildAiRacePredictionRows({
  upcomingRace,
  raceName,
  raceRound,
  insight,
  model,
  generatedAt,
}: {
  upcomingRace: Record<string, unknown>;
  raceName: string;
  raceRound: number | null;
  insight: Record<string, unknown>;
  model: string;
  generatedAt: string;
}) {
  if (!raceRound) return [];

  const categoryPredictions = Array.isArray(insight?.category_predictions)
    ? insight.category_predictions as Array<Record<string, unknown>>
    : [];

  return categoryPredictions
    .filter((prediction) => prediction?.key && prediction?.category && prediction?.pick)
    .map((prediction) => ({
      race_round: raceRound,
      race_name: raceName,
      meeting_key: Number(upcomingRace?.meeting_key || 0) || null,
      session_key: Number(upcomingRace?.session_key || 0) || null,
      target_race_date: String(upcomingRace?.date_start || "") || null,
      insight_key: "upcoming_race_brief",
      scope: "upcoming_race",
      category_key: String(prediction.key),
      category_label: String(prediction.category),
      category_type: String(prediction.type || "driver"),
      predicted_value: String(prediction.pick),
      reason: typeof prediction.reason === "string" ? prediction.reason : null,
      confidence: typeof prediction.confidence === "number" ? prediction.confidence : null,
      provider: insight.mode === "fallback" ? "fallback" : "openai",
      model,
      generated_at: generatedAt,
    }));
}

async function loadHistoricalContext({
  supabase,
  year,
  upcomingRace,
  raceSessions,
}: {
  supabase: ReturnType<typeof createClient>;
  year: number;
  upcomingRace: Record<string, unknown>;
  raceSessions: Array<Record<string, unknown>>;
}) {
  const targetRound = await resolveUpcomingRound(supabase, year, upcomingRace, raceSessions);

  let historyQuery = supabase
    .from("race_context_history")
    .select("season,race_round,race_name,race_date,race_outcome,qualifying_outcome,sprint_outcome,weather_summary,strategy_summary,driver_results,constructor_results,volatility_summary,source_payload")
    .eq("season", year)
    .order("race_round", { ascending: false });

  if (targetRound) {
    historyQuery = historyQuery.lt("race_round", targetRound);
  }

  const { data: historyRows, error: historyError } = await historyQuery;
  if (historyError) {
    console.warn("Historical context unavailable", historyError.message);
    return {
      targetRound,
      previousRace: null,
      previousRaceWeather: null,
      previousRaceStrategy: null,
      historicalForm: null,
      seasonStats: null,
      seasonVolatility: null,
      weatherStrategyPatterns: null,
      fantasyMarket: null,
      recentResults: [],
      detailedRecentHistory: [],
    };
  }

  const rows = (historyRows || []).sort((left, right) => Number(right.race_round || 0) - Number(left.race_round || 0));
  if (!rows.length) {
    return {
      targetRound,
      previousRace: null,
      previousRaceWeather: null,
      previousRaceStrategy: null,
      historicalForm: null,
      seasonStats: null,
      seasonVolatility: null,
      weatherStrategyPatterns: null,
      fantasyMarket: null,
      recentResults: [],
      detailedRecentHistory: [],
    };
  }

  const previousRow = rows[0] || null;
  const completedRounds = rows
    .map((row) => Number(row.race_round || 0))
    .filter((round) => Number.isFinite(round) && round > 0);

  let fantasyMarket = null;
  let recentResults = buildRecentResults(rows, []);
  if (completedRounds.length) {
    const [predictionResponse, resultsResponse] = await Promise.all([
      supabase
        .from("predictions")
        .select("race_round,picks,score")
        .in("race_round", completedRounds)
        .not("score", "is", null),
      supabase
        .from("race_results")
        .select("*")
        .in("race_round", completedRounds),
    ]);

    if (!predictionResponse.error && !resultsResponse.error) {
      fantasyMarket = buildFantasyMarket(predictionResponse.data || [], resultsResponse.data || []);
      recentResults = buildRecentResults(rows, resultsResponse.data || []);
    } else {
      console.warn(
        "Fantasy market history unavailable",
        predictionResponse.error?.message || resultsResponse.error?.message || "query failed",
      );
    }
  }

  return {
    targetRound,
    previousRace: buildPreviousRace(previousRow),
    previousRaceWeather: buildPreviousRaceWeather(previousRow),
    previousRaceStrategy: buildPreviousRaceStrategy(previousRow),
    historicalForm: buildHistoricalForm(rows),
    seasonStats: buildSeasonStats(rows),
    seasonVolatility: buildSeasonVolatility(rows),
    weatherStrategyPatterns: buildWeatherStrategyPatterns(rows),
    fantasyMarket,
    recentResults,
    detailedRecentHistory: rows.slice(0, 8).map((row) => ({
      race_round: row?.race_round || null,
      race_name: row?.race_name || null,
      race_date: row?.race_date || null,
      race_outcome: row?.race_outcome || {},
      qualifying_outcome: row?.qualifying_outcome || {},
      sprint_outcome: row?.sprint_outcome || {},
      weather_summary: row?.weather_summary || {},
      strategy_summary: row?.strategy_summary || {},
      volatility_summary: row?.volatility_summary || {},
      openf1_detail: normalizeSourcePayloadForContext(row?.source_payload),
    })),
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
  const sharedSyncSecret = Deno.env.get("RACE_RESULTS_SYNC_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !anonKey || !openAiKey) {
    return respond({ error: "Missing required environment variables." }, 500);
  }

  const requestSecret = req.headers.get("x-sync-secret");
  const requestApiKey = req.headers.get("apikey");
  let authorized = Boolean(sharedSyncSecret && requestSecret && requestSecret === sharedSyncSecret);

  if (!authorized) {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if ((serviceRoleKey && requestApiKey === serviceRoleKey) || (token && token === serviceRoleKey)) {
      authorized = true;
    } else if (!token) {
      return respond({ error: "Missing auth token." }, 401);
    } else {
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

      authorized = true;
    }
  }

  if (!authorized) {
    return respond({ error: "Forbidden." }, 403);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = new Date().toISOString();
  let raceName = null;
  let articleCount = 0;
  let sourceCount = 0;
  let responseModel = model;

  try {
    const body = await req.json().catch(() => ({}));
    const requestedYear = Number(body?.season || new Date().getUTCFullYear()) || new Date().getUTCFullYear();
    const requestedRound = parseRequestedRound(body?.raceRound || body?.round);
    responseModel = String(body?.model || "").trim() || model;
    const generateOnly = body?.generateOnly === true;
    const contextOverride = isPlainObject(body?.contextOverride) ? body.contextOverride as Record<string, unknown> : null;
    const categoryOptionsOverride = Array.isArray(body?.categoryOptionsOverride)
      ? body.categoryOptionsOverride.filter((item) => isPlainObject(item)) as Array<Record<string, unknown>>
      : null;

    if (generateOnly && (!contextOverride || !categoryOptionsOverride?.length)) {
      throw new Error("Missing contextOverride or categoryOptionsOverride for AI generate-only mode.");
    }

    if (contextOverride && categoryOptionsOverride?.length) {
      raceName = String(contextOverride?.target_race?.race_name || "Upcoming race");
      const articles = Array.isArray(contextOverride?.recent_news)
        ? contextOverride.recent_news.filter((item) => isPlainObject(item)) as Array<Record<string, unknown>>
        : [];
      articleCount = articles.length;
      sourceCount = new Set(articles.map((article) => article?.source).filter(Boolean)).size;

      const insight = await generateInsightForContext({
        context: contextOverride,
        categoryOptions: categoryOptionsOverride,
        articles,
        openAiKey,
        model: responseModel,
      });

      return respond({
        status: insight.mode === "fallback" ? "partial" : "ok",
        raceName,
        articleCount,
        sourceCount,
        headline: insight.headline,
        mode: insight.mode,
        provider: insight.mode === "fallback" ? "fallback" : "openai",
        model: insight.model || responseModel,
        researchSourceCount: Array.isArray(insight.research_sources) ? insight.research_sources.length : 0,
        insight,
      });
    }

    const { year, raceSessions } = await loadRaceSessionsWithFallback(requestedYear);
    const now = Date.now();
    const upcomingRace = await loadUpcomingRaceFromCalendar(supabase, year, raceSessions, now, requestedRound)
      || raceSessions.find((session) => new Date(String(session.date_start)).getTime() > now)
      || raceSessions[raceSessions.length - 1];

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
      summary: trimText(article.summary, 90),
      source: article.source,
      published_at: article.published_at,
      url: article.url,
    })).slice(0, 12);

    articleCount = articles.length;
    sourceCount = new Set(articles.map((article) => article.source).filter(Boolean)).size;

    const categoryOptions = getCategoryOptions(upcomingRace, meetingSessions);
    const historicalContext = await loadHistoricalContext({
      supabase,
      year,
      upcomingRace,
      raceSessions,
    });

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
      database_summary: {
        sampled_news_articles: articleCount,
        sampled_history_rows: Number(historicalContext.historicalForm?.rounds_sampled || 0),
        sampled_results_rows: Number(historicalContext.recentResults?.length || 0),
        sampled_scored_predictions: Number(historicalContext.fantasyMarket?.scored_predictions || 0),
      },
      recent_news: articles,
      historical_context: {
        previous_race: historicalContext.previousRace,
        previous_race_weather: historicalContext.previousRaceWeather,
        previous_race_strategy: historicalContext.previousRaceStrategy,
        last_5_driver_form: historicalContext.historicalForm?.last_5_driver_form || [],
        last_5_constructor_form: historicalContext.historicalForm?.last_5_constructor_form || [],
        season_stats: historicalContext.seasonStats,
        season_volatility: historicalContext.seasonVolatility,
        weather_strategy_patterns: historicalContext.weatherStrategyPatterns,
        fantasy_market_signals: historicalContext.fantasyMarket,
        recent_results: historicalContext.recentResults,
        detailed_recent_history: (historicalContext.detailedRecentHistory || []).slice(0, 3),
      },
    };

    const insight = await generateInsightForContext({
      context,
      categoryOptions,
      articles,
      openAiKey,
      model: responseModel,
    });

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
      model: insight.model || responseModel,
      generated_at: new Date().toISOString(),
      metadata: {
        category_predictions: insight.category_predictions,
        race_summary: insight.race_summary,
        news_digest: insight.news_digest,
        source_year: year,
        race_round: historicalContext.targetRound,
        target_race_date: upcomingRace.date_start,
        circuit: upcomingRace.circuit_short_name,
        country: upcomingRace.country_name,
        generation_mode: insight.mode,
        fallback_note: insight.note || null,
        research_sources: insight.research_sources || [],
        previous_race: historicalContext.previousRace,
        previous_race_weather: historicalContext.previousRaceWeather,
        previous_race_strategy: historicalContext.previousRaceStrategy,
        historical_form: historicalContext.historicalForm,
        season_stats: historicalContext.seasonStats,
        season_volatility: historicalContext.seasonVolatility,
        weather_strategy_patterns: historicalContext.weatherStrategyPatterns,
        fantasy_market: historicalContext.fantasyMarket,
        recent_results: historicalContext.recentResults,
      },
    };

    const { error: upsertError } = await supabase.from("ai_insights").upsert(row, { onConflict: "insight_key" });
    if (upsertError) throw new Error(upsertError.message);

    const aiPredictionRows = buildAiRacePredictionRows({
      upcomingRace,
      raceName,
      raceRound: historicalContext.targetRound,
      insight,
      model: insight.model || responseModel,
      generatedAt: row.generated_at,
    });

    if (aiPredictionRows.length) {
      try {
        const { error: deleteError } = await supabase.from("ai_race_predictions").delete().eq("race_round", historicalContext.targetRound);
        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase.from("ai_race_predictions").insert(aiPredictionRows);
        if (insertError) throw insertError;
      } catch (predictionError) {
        console.warn("AI race prediction history skipped", predictionError instanceof Error ? predictionError.message : predictionError);
      }
    }

    await supabase.from("ai_insight_runs").insert({
      scope: "upcoming_race",
      race_name: raceName,
      status: insight.mode === "fallback" ? "partial" : "ok",
      model: insight.model || responseModel,
      source_count: sourceCount,
      article_count: articleCount,
      error_text: insight.mode === "fallback" ? insight.note : null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return respond({
      status: insight.mode === "fallback" ? "partial" : "ok",
      raceName,
      articleCount,
      sourceCount,
      headline: insight.headline,
      mode: insight.mode,
      provider: insight.mode === "fallback" ? "fallback" : "openai",
      model: insight.model || responseModel,
      researchSourceCount: Array.isArray(insight.research_sources) ? insight.research_sources.length : 0,
    });
  } catch (error) {
    await supabase.from("ai_insight_runs").insert({
      scope: "upcoming_race",
      race_name: raceName,
      status: "error",
      model: responseModel,
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
