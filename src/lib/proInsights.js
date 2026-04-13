import "server-only";
import { createClient } from "@supabase/supabase-js";

function env(name) {
  return String(process.env[name] || "").trim();
}

function getAdminClient() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function buildTransientInsight({ insightType, content, raceName = null }) {
  return {
    id: `transient-${crypto.randomUUID()}`,
    insight_type: insightType,
    content,
    race_name: raceName,
    generated_at: new Date().toISOString(),
    transient: true,
  };
}

// ─── Prompt builders ───────────────────────────────────────────────────────────

function buildPostRacePrompt({ username, raceName, userPicks, results }) {
  const pickLines = userPicks
    .map((p) =>
      `  - ${p.pick_type}: picked "${p.picked_value}" → ${p.is_correct ? "✓ correct" : "✗ wrong"} (${p.points_earned ?? 0} pts)`
    )
    .join("\n");

  return `You are an F1 fantasy analyst. The user "${username}" just completed their picks for ${raceName}.

Their picks:
${pickLines}

Actual results: pole=${results.pole}, winner=${results.winner}, P2=${results.p2}, P3=${results.p3}, fastest_lap=${results.fastest_lap}, DNFs=${JSON.stringify(results.dnf_drivers ?? [])}.

Write a short, punchy post-race insight (3–5 sentences) covering:
1. How they did this race and their total points
2. One thing that went well (or badly)
3. A one-sentence tip for their next race

Tone: enthusiastic but honest. Do NOT use bullet points — write in flowing prose. No intro phrase like "Sure!" or "Great!".`;
}

function buildPreRacePrompt({ username, raceName, circuit, country, userStats }) {
  const topDrivers = Object.entries(userStats.drivers ?? {})
    .slice(0, 3)
    .map(([d, s]) => `${d} (${s.accuracy}% accuracy, picked ${s.picked}x)`)
    .join(", ");

  return `You are an F1 fantasy analyst. The user "${username}" is preparing their picks for ${raceName} at ${circuit}, ${country}.

Their season stats so far: ${userStats.overall?.correct ?? 0}/${userStats.overall?.total ?? 0} correct picks (${userStats.overall?.accuracy ?? 0}% accuracy), ${userStats.overall?.totalPoints ?? 0} total points.
Most picked drivers: ${topDrivers || "none yet"}.

Write a short pre-race briefing (3–5 sentences) covering:
1. One or two F1 strategic factors relevant to ${circuit} that affect fantasy picks (e.g. overtaking difficulty, DNF likelihood, historically dominant teams)
2. A specific suggestion for one pick type to prioritize this race, based on their past tendencies

Tone: analytical, confident. Flowing prose only. No intro filler.`;
}

function buildMonthlyPrompt({ username, month, userStats }) {
  const byType = Object.entries(userStats.byType ?? {})
    .map(([t, s]) => `${t}: ${s.correct}/${s.total} (${s.accuracy}% accuracy, ${s.totalPoints ?? 0} pts)`)
    .join(", ");
  const bestRace = userStats.bestRace?.name
    ? `${userStats.bestRace.name} (${userStats.bestRace.score} pts, ${userStats.bestRace.accuracy ?? 0}% accuracy)`
    : "not enough race data yet";
  const strongestCategory = userStats.strongestCategory?.label
    ? `${userStats.strongestCategory.label} (${userStats.strongestCategory.accuracy}% accuracy, ${userStats.strongestCategory.totalPoints ?? 0} pts)`
    : "still forming";
  const weakestCategory = userStats.weakestCategory?.label
    ? `${userStats.weakestCategory.label} (${userStats.weakestCategory.accuracy}% accuracy, ${userStats.weakestCategory.totalPoints ?? 0} pts)`
    : "not clear yet";
  const recentForm = Array.isArray(userStats.recentForm) && userStats.recentForm.length
    ? userStats.recentForm.join("; ")
    : "No recent scored rounds yet.";
  const aiCoach = userStats.aiCoach || {};

  return `You are an F1 fantasy analyst reviewing a premium season-performance report for "${username}".

Report window: ${month}
Overall: ${userStats.overall?.correct ?? 0}/${userStats.overall?.total ?? 0} correct (${userStats.overall?.accuracy ?? 0}% accuracy), ${userStats.overall?.totalPoints ?? 0} pts, ${userStats.overall?.racesScored ?? 0} scored races, ${userStats.overall?.averageScore ?? 0} average points per scored race
By pick type: ${byType || "no data yet"}
Current streak: ${userStats.streaks?.current ?? 0} correct picks in a row
Longest streak: ${userStats.streaks?.longest ?? 0}
Best race: ${bestRace}
Strongest category: ${strongestCategory}
Weakest category: ${weakestCategory}
Recent form: ${recentForm}
AI coach verdict: ${aiCoach.verdict || "No verdict yet"}
AI archetype: ${aiCoach.archetype || "Still forming"}
AI confidence: ${aiCoach.confidence || "Early read"}
AI history status: ${aiCoach.historyStatus || "No stored AI history yet"}
AI history detail: ${aiCoach.historyDetail || "Historical AI pick tracking starts with the next saved race brief."}
AI comparison summary: ${aiCoach.comparisonSummary || "No stored AI comparison yet"}
AI comparison edge: ${aiCoach.biggestComparisonWin || "No standout stored AI edge yet"}
AI comparison gap: ${aiCoach.biggestComparisonLoss || "No clear stored AI gap yet"}
AI next move: ${aiCoach.nextMoveTitle || "Protect the floor"} — ${aiCoach.nextMoveDetail || "Focus on one category upgrade instead of changing the whole board."}

Write a premium season report using these exact section labels, each followed by 1-2 sentences:
SEASON SNAPSHOT
AI COMPARISON
STRONGEST EDGE
PRESSURE POINT
TRENDLINE
NEXT MOVE

Rules:
- Mention at least four concrete numbers from the stats above.
- The AI COMPARISON section must clearly distinguish between stored AI race history and coach inference.
- If stored AI history does not exist yet, say that plainly instead of inventing a benchmark.
- Be specific about where the user is winning and where they are leaking points.
- Keep it under 220 words total.
- No markdown bullets, no intro filler, and no closing sign-off.`;
}

function buildMonthlyFallbackSummary({ month, userStats }) {
  const strongestCategory = userStats.strongestCategory?.label
    ? `${userStats.strongestCategory.label} is leading your board at ${userStats.strongestCategory.accuracy}% accuracy and ${userStats.strongestCategory.totalPoints ?? 0} points.`
    : "Your strongest category is still taking shape.";
  const weakestCategory = userStats.weakestCategory?.label
    ? `${userStats.weakestCategory.label} is the main leak right now at ${userStats.weakestCategory.accuracy}% accuracy and ${userStats.weakestCategory.totalPoints ?? 0} points.`
    : "No single weak category is standing out yet.";
  const bestRace = userStats.bestRace?.name
    ? `${userStats.bestRace.name} was your best-scoring weekend at ${userStats.bestRace.score} points.`
    : "Your best weekend will show up once more rounds are scored.";
  const recentForm = Array.isArray(userStats.recentForm) && userStats.recentForm.length
    ? userStats.recentForm.slice(0, 3).join(" | ")
    : "Recent form will populate after a few scored rounds.";
  const aiCoach = userStats.aiCoach || {};

  return [
    "SEASON SNAPSHOT",
    `${month}: ${userStats.overall?.correct ?? 0}/${userStats.overall?.total ?? 0} correct picks (${userStats.overall?.accuracy ?? 0}% accuracy) across ${userStats.overall?.racesScored ?? 0} scored races for ${userStats.overall?.totalPoints ?? 0} total points. You are averaging ${userStats.overall?.averageScore ?? 0} points per scored race, with a longest streak of ${userStats.streaks?.longest ?? 0} correct picks.`,
    "AI COMPARISON",
    `${aiCoach.historyStatus || "No stored AI history yet."} ${aiCoach.historyDetail || "Historical AI tracking starts with the next saved race brief."} ${aiCoach.comparisonSummary || ""} ${aiCoach.biggestComparisonWin || "No standout stored AI edge has separated yet."} ${aiCoach.biggestComparisonLoss || "There is no stored AI gap yet."}`,
    "STRONGEST EDGE",
    `${strongestCategory} ${bestRace}`,
    "PRESSURE POINT",
    `${weakestCategory} Tightening that category is the clearest route to lifting your weekly floor.`,
    "TRENDLINE",
    recentForm,
    "NEXT MOVE",
    `${aiCoach.nextMoveTitle || "Protect the floor"}: ${aiCoach.nextMoveDetail || "Keep protecting your strongest read early on the board, then use the weaker category as your deliberate improvement focus instead of spreading risk across every pick."}`,
  ].join("\n\n");
}

// ─── Core generation ───────────────────────────────────────────────────────────

async function generateInsight({ prompt, insightType, fallbackContent }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const resolvedFallback = fallbackContent || {
    post_race: "Your race is scored and your Pro board is up to date. The live AI debrief is temporarily unavailable, but your picks, points and finishing trends are still being tracked for the next update.",
    pre_race: "Your next-race briefing is waiting on the live AI analyst. Your Pro history is still synced, so you can review your strongest categories and lock your board as usual.",
    monthly: "Your monthly Pro recap is waiting on the live AI analyst. Your stats, streaks and total points are still being tracked and will feed the next summary.",
  }[insightType] || "Your Pro insight is temporarily unavailable, but your stats and scoring data are still synced.";

  if (!apiKey) {
    console.warn("[proInsights] OPENAI_API_KEY missing. Returning fallback insight copy.");
    return resolvedFallback;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.75,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[proInsights] OpenAI request failed (${response.status}): ${errorText}`);
      return resolvedFallback;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || resolvedFallback;
  } catch (error) {
    console.error("[proInsights] OpenAI request error:", error?.message || error);
    return resolvedFallback;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate and persist a post-race AI insight for a user.
 *
 * @param {{ userId: string, raceId: string }} opts
 * @returns {Promise<{ id: string, content: string }|null>}
 */
export async function generatePostRaceInsight({ userId, raceId, client = null }) {
  const supabase = client || getAdminClient();
  if (!supabase) return null;

  // Fetch race + results
  const { data: race } = await supabase
    .from("races")
    .select("id, name, round, season")
    .eq("id", raceId)
    .single();

  if (!race) return null;

  const { data: results } = await supabase
    .from("race_results")
    .select("*")
    .eq("race_round", race.round)
    .single();

  if (!results?.results_entered) return null;

  // Fetch user picks for this race
  const { data: picks } = await supabase
    .from("picks")
    .select("pick_type, picked_value, is_correct, points_earned")
    .eq("user_id", userId)
    .eq("race_id", raceId)
    .not("is_correct", "is", null);

  if (!picks?.length) return null;

  // Fetch username
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  const prompt  = buildPostRacePrompt({
    username:  profile?.username ?? "Manager",
    raceName:  race.name,
    userPicks: picks,
    results,
  });
  const content = await generateInsight({ prompt, insightType: "post_race" });
  const fallbackRow = buildTransientInsight({
    insightType: "post_race",
    content,
    raceName: race.name,
  });

  // Persist
  const { data: row, error } = await supabase
    .from("user_ai_insights")
    .insert({
      user_id:      userId,
      race_id:      raceId,
      insight_type: "post_race",
      content,
      race_name:    race.name,
    })
    .select("id, insight_type, content, race_name, generated_at")
    .single();

  if (error) {
    console.error("[proInsights] persist error:", error.message);
    return fallbackRow;
  }
  return row;
}

/**
 * Generate and persist a pre-race AI insight for a user.
 *
 * @param {{ userId: string, raceId: string, userStats: object }} opts
 */
export async function generatePreRaceInsight({ userId, raceId, userStats, client = null }) {
  const supabase = client || getAdminClient();
  if (!supabase) return null;

  const { data: race } = await supabase
    .from("races")
    .select("id, name, circuit, country, season")
    .eq("id", raceId)
    .single();

  if (!race) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  const prompt  = buildPreRacePrompt({
    username:  profile?.username ?? "Manager",
    raceName:  race.name,
    circuit:   race.circuit,
    country:   race.country,
    userStats,
  });
  const content = await generateInsight({ prompt, insightType: "pre_race" });
  const fallbackRow = buildTransientInsight({
    insightType: "pre_race",
    content,
    raceName: race.name,
  });

  const { data: row, error } = await supabase
    .from("user_ai_insights")
    .insert({
      user_id:      userId,
      race_id:      raceId,
      insight_type: "pre_race",
      content,
      race_name:    race.name,
    })
    .select("id, insight_type, content, race_name, generated_at")
    .single();

  if (error) {
    console.error("[proInsights] persist error:", error.message);
    return fallbackRow;
  }
  return row;
}

/**
 * Generate and persist a monthly performance summary.
 *
 * @param {{ userId: string, month: string, userStats: object }} opts
 *   month: e.g. "April 2026"
 */
export async function generateMonthlyInsight({ userId, month, userStats, username = null, client = null }) {
  const supabase = client || getAdminClient();
  let resolvedUsername = username || "Manager";

  if (supabase && !username) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.username) {
      resolvedUsername = profile.username;
    }
  }

  const prompt  = buildMonthlyPrompt({
    username:  resolvedUsername,
    month,
    userStats,
  });
  const content = await generateInsight({
    prompt,
    insightType: "monthly",
    fallbackContent: buildMonthlyFallbackSummary({ month, userStats }),
  });
  const fallbackRow = buildTransientInsight({
    insightType: "monthly",
    content,
    raceName: null,
  });

  if (!supabase) {
    return fallbackRow;
  }

  const { data: row, error } = await supabase
    .from("user_ai_insights")
    .insert({
      user_id:      userId,
      race_id:      null,
      insight_type: "monthly",
      content,
      race_name:    null,
    })
    .select("id, insight_type, content, race_name, generated_at")
    .single();

  if (error) {
    console.error("[proInsights] monthly persist error:", error.message);
    return fallbackRow;
  }
  return row;
}

/**
 * Fetch saved insights for a user.
 * Returns latest 20, newest first.
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getUserInsights(userId) {
  const client = arguments[1] || null;
  const supabase = client || getAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("user_ai_insights")
    .select("id, insight_type, content, race_name, generated_at")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[proInsights] fetch error:", error.message);
    return [];
  }
  return data ?? [];
}
