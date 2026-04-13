import "server-only";

const OPENAI_BASE = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

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

const INSIGHT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "race_summary", "confidence", "news_digest", "key_factors", "prediction_edges", "watchlist", "category_predictions"],
  properties: {
    headline: { type: "string", minLength: 12 },
    summary: { type: "string", minLength: 120 },
    race_summary: { type: "string", minLength: 240 },
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
          headline: { type: "string", minLength: 8 },
          detail: { type: "string", minLength: 30 },
          why_it_matters: { type: "string", minLength: 24 },
        },
      },
    },
    key_factors: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "why_it_matters", "fantasy_take", "impact"],
        properties: {
          title: { type: "string", minLength: 8 },
          detail: { type: "string", minLength: 40 },
          why_it_matters: { type: "string", minLength: 24 },
          fantasy_take: { type: "string", minLength: 24 },
          impact: { type: "string", enum: ["positive", "negative", "mixed"] },
        },
      },
    },
    prediction_edges: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "detail", "action", "risk_level"],
        properties: {
          label: { type: "string", minLength: 8 },
          detail: { type: "string", minLength: 24 },
          action: { type: "string", minLength: 20 },
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
          label: { type: "string", minLength: 8 },
          trigger: { type: "string", minLength: 20 },
          what_changes: { type: "string", minLength: 20 },
          how_to_react: { type: "string", minLength: 20 },
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
          category: { type: "string" },
          type: { type: "string", enum: ["driver", "constructor", "binary"] },
          pick: { type: "string" },
          reason: { type: "string", minLength: 24 },
          confidence: { type: "number" },
        },
      },
    },
  },
};

const WEB_RESEARCH_SCHEMA = {
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

function trimText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function pickOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();

  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) return part.text.trim();
    }
  }

  return null;
}

function formatSessionWindow(sessions = []) {
  return sessions.map((session) => ({
    session_name: session.session_name,
    session_type: session.session_type,
    date_start: session.scheduled_start || session.date_start || null,
    status: session.status || "scheduled",
  }));
}

function getCategoryOptions(race, sessions = []) {
  const hasSprint = race?.sprint === true || sessions.some((session) => String(session?.session_type || "").startsWith("sprint"));
  return hasSprint ? [...BASE_CATEGORY_OPTIONS, ...SPRINT_CATEGORY_OPTIONS] : [...BASE_CATEGORY_OPTIONS];
}

function normalizeCategoryPredictions(items = [], categoryOptions = []) {
  const optionByKey = new Map(categoryOptions.map((option) => [option.key, option]));
  const normalized = items
    .filter((item) => optionByKey.has(String(item?.key || "")))
    .map((item) => {
      const option = optionByKey.get(String(item.key));
      return {
        key: option.key,
        category: option.label,
        type: option.type,
        pick: String(item.pick || "").trim(),
        reason: trimText(item.reason, 220),
        confidence: Number(item.confidence || 0.55),
        allowed: option.allowed,
      };
    })
    .filter((item) => item.pick && item.reason && item.allowed.includes(item.pick))
    .sort((left, right) => CATEGORY_ORDER.indexOf(left.key) - CATEGORY_ORDER.indexOf(right.key));

  const existingKeys = new Set(normalized.map((item) => item.key));
  const hasSprint = categoryOptions.some((option) => String(option?.key || "").startsWith("sp_"));
  const fallbackPickMap = buildFallbackPickMap(hasSprint);

  for (const option of categoryOptions) {
    if (existingKeys.has(option.key)) continue;

    const fallbackPick = fallbackPickMap[option.key] || option.allowed?.[0] || "";
    if (!fallbackPick || !option.allowed?.includes?.(fallbackPick)) continue;

    normalized.push({
      key: option.key,
      category: option.label,
      type: option.type,
      pick: fallbackPick,
      reason: `Model completion fallback for ${option.label}. This category was filled to keep the stored AI board complete for historical tracking.`,
      confidence: 0.35,
      allowed: option.allowed,
    });
  }

  return normalized
    .sort((left, right) => CATEGORY_ORDER.indexOf(left.key) - CATEGORY_ORDER.indexOf(right.key))
    .map(({ allowed, ...item }) => item);
}

function buildFallbackPickMap(hasSprint) {
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
  };

  if (hasSprint) {
    picks.sp_pole = "Max Verstappen";
    picks.sp_winner = "George Russell";
    picks.sp_p2 = "Oscar Piastri";
    picks.sp_p3 = "Charles Leclerc";
  }

  return picks;
}

function buildFallbackInsight(context, categoryOptions, articles, reason) {
  const raceName = String(context?.target_race?.race_name || "Upcoming Grand Prix");
  const schedule = Array.isArray(context?.target_race?.schedule) ? context.target_race.schedule : [];
  const newsLines = (articles || []).slice(0, 3);
  const hasSprint = categoryOptions.some((option) => option.key.startsWith("sp_"));
  const fallbackPickMap = buildFallbackPickMap(hasSprint);

  return {
    mode: "fallback",
    note: reason,
    headline: `${raceName}: race-week priorities before lock`,
    summary: `${raceName} is best approached as a disciplined board. Use the latest news and recent 2026 context to narrow the real frontrunners, keep chaos categories flexible, and avoid overreacting to single headlines.`,
    race_summary: [
      `${raceName} should reward clean read discipline more than noise. The strongest edge is to use recent race form, volatility patterns, and the final pre-lock session signals together.`,
      newsLines.length
        ? `Recent coverage is pointing to these live themes: ${newsLines.map((item) => trimText(item.title, 72)).join("; ")}. Use them as direction, not as a full board rewrite.`
        : "If the news cycle is thin, rely even more heavily on the latest session read and recent 2026 results.",
      schedule.length
        ? `The lock-sensitive session order is ${schedule.map((item) => `${item.session_name} on ${trimText(item.date_start, 22)}`).slice(0, 4).join(", ")}.`
        : "Treat the final pre-lock session as the strongest decision point.",
    ].join("\n\n"),
    confidence: 0.56,
    news_digest: newsLines.length
      ? newsLines.map((item) => ({
          headline: trimText(item.title, 72),
          detail: trimText(item.summary || item.title, 220),
          why_it_matters: "This helps narrow which teams and drivers deserve more weight before the board locks.",
        }))
      : [
          {
            headline: "Use the latest clean signals",
            detail: "When the external signal is limited, the best edge comes from staying close to recent results and final-session pace.",
            why_it_matters: "It keeps the board grounded instead of reactive.",
          },
          {
            headline: "Stay flexible into lock",
            detail: "Late changes to pace, reliability, or schedule usually matter more than early-week noise.",
            why_it_matters: "It keeps the highest-value categories adjustable until the end.",
          },
        ],
    key_factors: [
      {
        title: "Qualifying shape should anchor the board",
        detail: "Front-running pace and one-lap confidence are still the cleanest way to separate realistic podium and win candidates.",
        why_it_matters: "Pole, winner, and constructor categories tend to compress around the same top packages.",
        fantasy_take: "Use the strongest qualifying packages as the spine of the board.",
        impact: "positive",
      },
      {
        title: "Volatility categories should stay conditional",
        detail: "DNF, safety car, and red flag calls should react to the latest reliability and race-control signals, not only historical averages.",
        why_it_matters: "These categories create edge only when the weekend context justifies the risk.",
        fantasy_take: "Upgrade chaos picks only when the live weekend looks unstable.",
        impact: "mixed",
      },
    ],
    prediction_edges: [
      {
        label: "Lean on the clean frontrunners",
        detail: "Use the most stable front-running teams and drivers for the highest-value categories.",
        action: "Keep pole, winner, and constructor calls concentrated unless the last session breaks the pattern.",
        risk_level: "medium",
      },
      {
        label: "Delay the volatile picks",
        detail: "The chaos categories gain value only when the weekend shows real instability.",
        action: "Finalize DNF, safety car, and red flag later than the core podium picks.",
        risk_level: "low",
      },
    ],
    watchlist: [
      {
        label: "Front-row reshuffle",
        trigger: "A different team takes over the last pace session or qualifying rehearsal.",
        what_changes: "Pole and podium probability shifts quickly.",
        how_to_react: "Update the top-end board before lock instead of clinging to older reads.",
      },
      {
        label: "Weekend instability",
        trigger: "Repeated incidents, interruptions, or reliability noise appear before lock.",
        what_changes: "Chaos categories become more live than usual.",
        how_to_react: "Increase confidence on DNF, safety car, and red flag picks only if the signal persists.",
      },
    ],
    category_predictions: categoryOptions.map((option) => ({
      key: option.key,
      category: option.label,
      type: option.type,
      pick: fallbackPickMap[option.key] || option.allowed[0],
      reason: `Fallback brief: keep this pick flexible, then confirm it with the latest race-week signal for ${raceName}.`,
      confidence: 0.55,
    })),
  };
}

function toFiniteNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function roundMetric(value, digits = 1) {
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  const factor = 10 ** digits;
  return Math.round(next * factor) / factor;
}

function average(values = [], digits = 1) {
  const numbers = values
    .map(toFiniteNumber)
    .filter((value) => value !== null);

  if (!numbers.length) return null;
  return roundMetric(numbers.reduce((sum, value) => sum + value, 0) / numbers.length, digits);
}

function coerceArray(value) {
  return Array.isArray(value) ? value : [];
}

function coerceObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeListValue(value) {
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

  if (!value) return [];
  const normalized = String(value).trim();
  return normalized ? [normalized] : [];
}

function countMapLeader(counts) {
  const entries = Object.entries(counts || {}).filter(([, value]) => Number(value) > 0);
  entries.sort((left, right) => {
    if (Number(right[1]) !== Number(left[1])) return Number(right[1]) - Number(left[1]);
    return left[0].localeCompare(right[0]);
  });
  return entries[0]?.[0] || null;
}

function compareAverageFinish(left, right) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function sortDriverForm(list = []) {
  return [...list].sort((left, right) => {
    if (Number(right.points || 0) !== Number(left.points || 0)) return Number(right.points || 0) - Number(left.points || 0);
    if (Number(right.wins || 0) !== Number(left.wins || 0)) return Number(right.wins || 0) - Number(left.wins || 0);
    if (Number(right.podiums || 0) !== Number(left.podiums || 0)) return Number(right.podiums || 0) - Number(left.podiums || 0);
    const finishComparison = compareAverageFinish(toFiniteNumber(left.average_finish), toFiniteNumber(right.average_finish));
    if (finishComparison !== 0) return finishComparison;
    return String(left.driver || "").localeCompare(String(right.driver || ""));
  });
}

function sortConstructorForm(list = []) {
  return [...list].sort((left, right) => {
    if (Number(right.points || 0) !== Number(left.points || 0)) return Number(right.points || 0) - Number(left.points || 0);
    if (Number(right.wins || 0) !== Number(left.wins || 0)) return Number(right.wins || 0) - Number(left.wins || 0);
    if (Number(right.podiums || 0) !== Number(left.podiums || 0)) return Number(right.podiums || 0) - Number(left.podiums || 0);
    return String(left.team || "").localeCompare(String(right.team || ""));
  });
}

function aggregateDriverForm(rows = []) {
  const aggregate = new Map();

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

function aggregateConstructorForm(rows = []) {
  const aggregate = new Map();

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

function topByMetric(entries = [], metric, key, limit = 5) {
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

function buildPreviousRace(row = null) {
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
    dnf_count: toFiniteNumber(outcome.dnf_count ?? volatility.dnf_count),
    safety_car_count: toFiniteNumber(outcome.safety_car_count ?? volatility.safety_car_count),
    red_flag_count: toFiniteNumber(outcome.red_flag_count ?? volatility.red_flag_count),
  };
}

function buildPreviousRaceWeather(row = null) {
  if (!row) return null;
  const weather = coerceObject(row?.weather_summary);
  return Object.keys(weather).length ? weather : null;
}

function buildPreviousRaceStrategy(row = null) {
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

function buildHistoricalForm(rows = []) {
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

function buildSeasonStats(rows = []) {
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

function buildSeasonVolatility(rows = []) {
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

function buildWeatherStrategyPatterns(rows = []) {
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

function categoryValueMatches(categoryKey, pick, result) {
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

function buildFantasyMarket(predictions = [], resultsRows = []) {
  if (!predictions.length || !resultsRows.length) return null;

  const resultsByRound = new Map(resultsRows.map((row) => [Number(row.race_round), row]));
  const categoryStats = new Map();
  const scores = predictions.map((prediction) => Number(prediction?.score)).filter(Number.isFinite);

  for (const prediction of predictions) {
    const raceRound = Number(prediction?.race_round || 0);
    const result = resultsByRound.get(raceRound);
    if (!result) continue;

    const picks = coerceObject(prediction?.picks);
    for (const [categoryKey, rawPick] of Object.entries(picks)) {
      const pick = String(rawPick || "").trim();
      if (!pick) continue;

      const currentCategory = categoryStats.get(categoryKey) || {
        samples: 0,
        picks: new Map(),
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

  const crowdFavorites = [];
  for (const [categoryKey, entry] of categoryStats.entries()) {
    const ranked = [...entry.picks.values()].sort((left, right) => {
      if (Number(right.count || 0) !== Number(left.count || 0)) return Number(right.count || 0) - Number(left.count || 0);
      if (Number(right.matches || 0) !== Number(left.matches || 0)) return Number(right.matches || 0) - Number(left.matches || 0);
      return String(left.pick || "").localeCompare(String(right.pick || ""));
    });

    const leader = ranked[0] || null;
    if (leader) {
      crowdFavorites.push({
        key: categoryKey,
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
    return String(left.key || "").localeCompare(String(right.key || ""));
  });

  return {
    rounds_sampled: new Set(resultsRows.map((row) => Number(row.race_round || 0))).size,
    scored_predictions: predictions.length,
    average_score: average(scores, 2),
    crowd_favorites: crowdFavorites.slice(0, 6),
  };
}

function buildRecentResults(historyRows = [], resultsRows = []) {
  const resultsByRound = new Map(resultsRows.map((row) => [Number(row.race_round || 0), row]));

  return historyRows.slice(0, 6).map((row) => {
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

function buildDatabaseSummary({ articles = [], historyRows = [], resultsRows = [], predictionRows = [] }) {
  const scoredPredictions = predictionRows.filter((row) => row?.score !== null && row?.score !== undefined);
  return {
    sampled_news_articles: articles.length,
    sampled_history_rows: historyRows.length,
    sampled_results_rows: resultsRows.length,
    sampled_scored_predictions: scoredPredictions.length,
    history_rounds_available: new Set(historyRows.map((row) => Number(row?.race_round || 0)).filter(Boolean)).size,
    results_rounds_available: new Set(resultsRows.map((row) => Number(row?.race_round || 0)).filter(Boolean)).size,
  };
}

function normalizeSourcePayloadForContext(payload) {
  const source = coerceObject(payload);
  const simplifyClassification = (rows, limit = 6) => coerceArray(rows).slice(0, limit).map((row) => ({
    position: toFiniteNumber(row?.position),
    driver: row?.driver || null,
    team: row?.team || null,
    points: toFiniteNumber(row?.points),
    status: row?.status || null,
    dnf: typeof row?.dnf === "boolean" ? row.dnf : null,
  }));
  const simplifySessions = (rows) => coerceArray(rows).slice(0, 6).map((row) => ({
    session_name: row?.session_name || null,
    session_type: row?.session_type || null,
    date_start: row?.date_start || null,
  }));
  const simplifyRaceControl = (rows) => coerceArray(rows).slice(0, 6).map((row) => ({
    lap_number: toFiniteNumber(row?.lap_number),
    category: row?.category || null,
    flag: row?.flag || null,
    driver: row?.driver || null,
    message: trimText(row?.message, 120),
  }));
  const simplifyStints = (rows) => coerceArray(rows).slice(0, 6).map((row) => ({
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

function buildPrompt(context) {
  const promptContext = buildPromptContext(context);
  return [
    "You are writing one sharp F1 fantasy race brief.",
    "Use the supplied database context as the backbone of the brief.",
    "Use live_web_research as the current-news layer beyond the supplied recent_news sample.",
    "Blend recent results, AI history, scored fantasy market patterns, and live news into one practical briefing.",
    "Summarize without repetition.",
    "Return JSON only.",
    "Every category_predictions pick must exactly match an allowed option from category_rules.allowed_values.",
    "",
    JSON.stringify(promptContext, null, 2),
  ].join("\n");
}

function buildWebResearchPrompt(context) {
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

function buildPromptContext(context) {
  const categoryOptions = coerceArray(context?.category_options);
  const allowedValues = {};

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

function summarizeHistoricalContextForPrompt(historical) {
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

function summarizeDetailedHistoryRow(row) {
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

function summarizeRaceOutcome(value) {
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

function summarizeQualifyingOutcome(value) {
  const source = coerceObject(value);
  return {
    pole: source?.pole || null,
    front_row: coerceArray(source?.front_row).slice(0, 2),
    top_10: coerceArray(source?.top_10).slice(0, 6),
  };
}

function summarizeSprintOutcome(value) {
  const source = coerceObject(value);
  return {
    has_sprint: source?.has_sprint ?? null,
    sprint_pole: source?.sprint_pole || null,
    podium: coerceArray(source?.podium).slice(0, 3),
  };
}

function summarizeWeather(value) {
  const source = coerceObject(value);
  return {
    rainfall: source?.rainfall ?? null,
    air_temperature_avg: toFiniteNumber(source?.air_temperature_avg),
    track_temperature_avg: toFiniteNumber(source?.track_temperature_avg),
    humidity_avg: toFiniteNumber(source?.humidity_avg),
    sample_count: toFiniteNumber(source?.sample_count),
  };
}

function summarizeStrategy(value) {
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

function summarizeFantasyMarket(value) {
  const source = coerceObject(value);
  return {
    rounds_sampled: toFiniteNumber(source?.rounds_sampled),
    scored_predictions: toFiniteNumber(source?.scored_predictions),
    average_score: toFiniteNumber(source?.average_score),
    crowd_favorites: coerceArray(source?.crowd_favorites).slice(0, 4),
  };
}

function extractWebSources(payload) {
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

  const seen = new Set();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).slice(0, 10);
}

function normalizeResearchSources(items = []) {
  function hostLabel(url) {
    try {
      return new URL(url).hostname.replace(/^www\./i, "");
    } catch (_error) {
      return "";
    }
  }

  return items
    .map((item) => ({
      title: trimText(item?.title, 140),
      source: trimText(item?.source, 60) || trimText(hostLabel(item?.url), 60),
      url: String(item?.url || "").trim(),
      summary: trimText(item?.summary, 220) || trimText(item?.title, 220),
      relevance: trimText(item?.relevance, 180) || "Relevant recent coverage surfaced by live web research.",
    }))
    .filter((item) => /^https?:\/\//i.test(item.url) && item.title && item.source && item.summary && item.relevance);
}

async function generateLiveWebResearch(context, openAiKey) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(OPENAI_BASE, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
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
              schema: WEB_RESEARCH_SCHEMA,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI research error: ${response.status} ${await response.text()}`);
      }

      const payload = await response.json();
      const outputText = pickOutputText(payload);
      if (!outputText) {
        throw new Error("OpenAI research returned no output text.");
      }

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

async function generateWithOpenAI(context, categoryOptions) {
  const openAiKey = process.env.OPENAI_API_KEY || "";
  if (!openAiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const liveWebResearch = await generateLiveWebResearch(context, openAiKey);
  const enrichedContext = {
    ...context,
    live_web_research: liveWebResearch,
  };

  const response = await fetch(OPENAI_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "user",
          content: buildPrompt(enrichedContext),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "stint_race_brief",
          strict: true,
          schema: INSIGHT_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const outputText = pickOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI returned no output text.");
  }

  const parsed = JSON.parse(outputText);
  const categoryPredictions = normalizeCategoryPredictions(parsed.category_predictions || [], categoryOptions);
  if (!categoryPredictions.length) {
    throw new Error("OpenAI returned no usable category predictions.");
  }

  return {
    mode: "openai",
    note: null,
    headline: parsed.headline,
    summary: parsed.summary,
    race_summary: parsed.race_summary,
    confidence: Number(parsed.confidence || 0.66),
    news_digest: parsed.news_digest,
    key_factors: parsed.key_factors,
    prediction_edges: parsed.prediction_edges,
    watchlist: parsed.watchlist,
    category_predictions: categoryPredictions,
    model: DEFAULT_MODEL,
    research_sources: liveWebResearch,
  };
}

export function buildAiContext({ race, sessions, articles, historyRows, resultsRows, predictionRows = [] }) {
  const categoryOptions = getCategoryOptions(race, sessions);
  const orderedHistoryRows = [...(historyRows || [])].sort((left, right) => Number(right?.race_round || 0) - Number(left?.race_round || 0));
  const orderedResultsRows = [...(resultsRows || [])].sort((left, right) => Number(right?.race_round || 0) - Number(left?.race_round || 0));
  const orderedPredictionRows = [...(predictionRows || [])]
    .filter((row) => row?.score !== null && row?.score !== undefined)
    .sort((left, right) => Number(right?.race_round || 0) - Number(left?.race_round || 0));
  const previousRace = buildPreviousRace(orderedHistoryRows[0] || null);
  const previousRaceWeather = buildPreviousRaceWeather(orderedHistoryRows[0] || null);
  const previousRaceStrategy = buildPreviousRaceStrategy(orderedHistoryRows[0] || null);
  const historicalForm = buildHistoricalForm(orderedHistoryRows);
  const seasonStats = buildSeasonStats(orderedHistoryRows);
  const seasonVolatility = buildSeasonVolatility(orderedHistoryRows);
  const weatherStrategyPatterns = buildWeatherStrategyPatterns(orderedHistoryRows);
  const fantasyMarket = buildFantasyMarket(orderedPredictionRows, orderedResultsRows);
  const recentResults = buildRecentResults(orderedHistoryRows, orderedResultsRows);
  const databaseSummary = buildDatabaseSummary({
    articles,
    historyRows: orderedHistoryRows,
    resultsRows: orderedResultsRows,
    predictionRows: orderedPredictionRows,
  });
  const context = {
    generated_at: new Date().toISOString(),
    target_race: {
      race_name: race?.n,
      circuit: race?.circuit,
      country: race?.cc,
      date_start: race?.date,
      schedule: formatSessionWindow(sessions),
    },
    category_options: categoryOptions,
    current_grid: CURRENT_GRID,
    database_summary: databaseSummary,
    recent_news: (articles || []).slice(0, 12).map((article) => ({
      id: article.id,
      title: trimText(article.title, 120),
      summary: trimText(article.summary, 90),
      source: article.source,
      source_priority: Number(article.source_priority || 0) || 0,
      published_at: article.published_at,
      url: article.url,
    })),
    historical_context: {
      previous_race: previousRace,
      previous_race_weather: previousRaceWeather,
      previous_race_strategy: previousRaceStrategy,
      last_5_driver_form: historicalForm?.last_5_driver_form || [],
      last_5_constructor_form: historicalForm?.last_5_constructor_form || [],
      season_stats: seasonStats,
      season_volatility: seasonVolatility,
      weather_strategy_patterns: weatherStrategyPatterns,
      fantasy_market_signals: fantasyMarket,
      recent_results: recentResults,
      detailed_recent_history: orderedHistoryRows.slice(0, 3).map((row) => ({
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
    },
  };

  return {
    context,
    categoryOptions,
    databaseSummary,
  };
}

export async function generateInsightPayload({ race, sessions, articles, historyRows, resultsRows, predictionRows = [] }) {
  const { context, categoryOptions } = buildAiContext({ race, sessions, articles, historyRows, resultsRows, predictionRows });

  try {
    return await generateWithOpenAI(context, categoryOptions);
  } catch (error) {
    return buildFallbackInsight(context, categoryOptions, articles, error instanceof Error ? error.message : "Fallback mode");
  }
}

function resolvePredictionRaceRound(race) {
  const round = Number(
    race?.r
    || race?.round
    || race?.sourceRoundNumber
    || race?.source_round_number
    || race?.displayRound
    || race?.display_round_number
    || 0
  );

  return Number.isFinite(round) && round > 0 ? round : null;
}

export function buildAiRacePredictionRows({ race, sessions, insight, generatedAt = new Date().toISOString() }) {
  const raceRound = resolvePredictionRaceRound(race);
  const meetingKey = sessions?.[0]?.meeting_key || race?.meetingKey || null;
  const sessionKey = sessions?.find((session) => session.session_type === "race")?.session_key || race?.raceSessionKey || null;

  if (!raceRound) return [];

  return (Array.isArray(insight?.category_predictions) ? insight.category_predictions : [])
    .filter((prediction) => prediction?.key && prediction?.category && prediction?.pick)
    .map((prediction) => ({
      race_round: raceRound,
      race_name: race?.n || "Upcoming Grand Prix",
      meeting_key: meetingKey,
      session_key: sessionKey,
      target_race_date: race?.date || null,
      insight_key: "upcoming_race_brief",
      scope: "upcoming_race",
      category_key: prediction.key,
      category_label: prediction.category,
      category_type: prediction.type || "driver",
      predicted_value: prediction.pick,
      reason: prediction.reason || null,
      confidence: prediction.confidence,
      provider: insight?.mode === "fallback" ? "fallback" : "openai",
      model: insight?.model || DEFAULT_MODEL,
      generated_at: generatedAt,
    }));
}

export function buildAiInsightRow({ race, sessions, articles, historyRows, resultsRows, predictionRows = [], insight }) {
  const { context, databaseSummary } = buildAiContext({ race, sessions, articles, historyRows, resultsRows, predictionRows });
  return {
    insight_key: "upcoming_race_brief",
    scope: "upcoming_race",
    race_name: race?.n || "Upcoming Grand Prix",
    meeting_key: sessions?.[0]?.meeting_key || race?.meetingKey || null,
    session_key: sessions?.find((session) => session.session_type === "race")?.session_key || race?.raceSessionKey || null,
    headline: insight.headline,
    summary: insight.summary,
    confidence: insight.confidence,
    key_factors: insight.key_factors,
    prediction_edges: insight.prediction_edges,
    watchlist: insight.watchlist,
    news_article_ids: (articles || []).map((article) => article.id),
    news_article_urls: (articles || []).map((article) => article.url),
    source_count: new Set((articles || []).map((article) => article.source).filter(Boolean)).size,
    provider: insight.mode === "fallback" ? "fallback" : "openai",
    model: insight.model || DEFAULT_MODEL,
    generated_at: new Date().toISOString(),
    metadata: {
      category_predictions: insight.category_predictions,
      race_summary: insight.race_summary,
      news_digest: insight.news_digest,
      race_round: resolvePredictionRaceRound(race),
      target_race_date: race?.date || null,
      circuit: race?.circuit || null,
      country: race?.cc || null,
      generation_mode: insight.mode,
      fallback_note: insight.note || null,
      research_sources: insight.research_sources || [],
      database_summary: databaseSummary,
      previous_race: context.historical_context.previous_race || null,
      previous_race_weather: context.historical_context.previous_race_weather || null,
      previous_race_strategy: context.historical_context.previous_race_strategy || null,
      historical_form: {
        last_5_driver_form: context.historical_context.last_5_driver_form || [],
        last_5_constructor_form: context.historical_context.last_5_constructor_form || [],
      },
      season_stats: context.historical_context.season_stats || null,
      season_volatility: context.historical_context.season_volatility || null,
      weather_strategy_patterns: context.historical_context.weather_strategy_patterns || null,
      fantasy_market: context.historical_context.fantasy_market_signals || null,
      recent_results: context.historical_context.recent_results || [],
      recent_context_rows: (historyRows || []).slice(0, 6),
      recent_official_rows: (resultsRows || []).slice(0, 6),
      session_window: formatSessionWindow(sessions),
    },
  };
}
