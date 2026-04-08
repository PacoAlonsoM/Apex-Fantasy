// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const FALLBACK_ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";

const PTS = {
  pole: 10,
  winner: 25,
  p2: 18,
  p3: 15,
  dnf: 12,
  sc: 5,
  rf: 8,
  fl: 7,
  dotd: 6,
  ctor: 8,
  perfectPodium: 15,
  sp_pole: 5,
  sp_winner: 12,
  sp_p2: 9,
  sp_p3: 7,
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function toNumber(value: unknown) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
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

function getDnfDrivers(results: Record<string, unknown>) {
  const fromList = normalizeListValue(results?.dnf_list);
  if (fromList.length) return fromList;
  return normalizeListValue(results?.dnf);
}

function calculatePoints(picks: Record<string, string>, results: Record<string, unknown>) {
  let points = 0;
  const breakdown: Array<{ label: string; pts: number }> = [];

  if (!picks || !results) return { points, breakdown };

  if (picks.pole && picks.pole === results.pole) { points += PTS.pole; breakdown.push({ label: "Pole Position", pts: PTS.pole }); }
  if (picks.winner && picks.winner === results.winner) { points += PTS.winner; breakdown.push({ label: "Race Winner", pts: PTS.winner }); }
  if (picks.p2 && picks.p2 === results.p2) { points += PTS.p2; breakdown.push({ label: "2nd Place", pts: PTS.p2 }); }
  if (picks.p3 && picks.p3 === results.p3) { points += PTS.p3; breakdown.push({ label: "3rd Place", pts: PTS.p3 }); }
  if (picks.winner && picks.p2 && picks.p3 && picks.winner === results.winner && picks.p2 === results.p2 && picks.p3 === results.p3) {
    points += PTS.perfectPodium;
    breakdown.push({ label: "Perfect Podium Bonus", pts: PTS.perfectPodium });
  }
  if (picks.dnf && getDnfDrivers(results).includes(picks.dnf)) { points += PTS.dnf; breakdown.push({ label: "DNF Driver", pts: PTS.dnf }); }
  if (picks.fl && picks.fl === results.fastest_lap) { points += PTS.fl; breakdown.push({ label: "Fastest Lap", pts: PTS.fl }); }
  if (picks.dotd && picks.dotd === results.dotd) { points += PTS.dotd; breakdown.push({ label: "Driver of the Day", pts: PTS.dotd }); }
  if (picks.ctor && picks.ctor === results.best_constructor) { points += PTS.ctor; breakdown.push({ label: "Best Constructor", pts: PTS.ctor }); }
  if (picks.sc && picks.sc === "Yes" && results.safety_car) { points += PTS.sc; breakdown.push({ label: "Safety Car", pts: PTS.sc }); }
  if (picks.rf && picks.rf === "Yes" && results.red_flag) { points += PTS.rf; breakdown.push({ label: "Red Flag", pts: PTS.rf }); }
  if (picks.sp_pole && picks.sp_pole === results.sp_pole) { points += PTS.sp_pole; breakdown.push({ label: "Sprint Pole", pts: PTS.sp_pole }); }
  if (picks.sp_winner && picks.sp_winner === results.sp_winner) { points += PTS.sp_winner; breakdown.push({ label: "Sprint Winner", pts: PTS.sp_winner }); }
  if (picks.sp_p2 && picks.sp_p2 === results.sp_p2) { points += PTS.sp_p2; breakdown.push({ label: "Sprint 2nd", pts: PTS.sp_p2 }); }
  if (picks.sp_p3 && picks.sp_p3 === results.sp_p3) { points += PTS.sp_p3; breakdown.push({ label: "Sprint 3rd", pts: PTS.sp_p3 }); }

  return { points, breakdown };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;
  const adminId = Deno.env.get("AI_ADMIN_USER_ID") || FALLBACK_ADMIN_ID;
  const syncSecret = Deno.env.get("RACE_RESULTS_SYNC_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return respond({ error: "Missing required environment variables." }, 500);
  }

  const requestSecret = req.headers.get("x-sync-secret");
  let authorized = Boolean(syncSecret && requestSecret && requestSecret === syncSecret);

  if (!authorized) {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return respond({ error: "Missing auth token." }, 401);
    }

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

  if (!authorized) {
    return respond({ error: "Forbidden." }, 403);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const raceRound = Number(body?.raceRound || 1);

    if (!Number.isFinite(raceRound) || raceRound <= 0) {
      return respond({ error: "Missing or invalid raceRound." }, 400);
    }

    const { data: results, error: resultsError } = await supabase
      .from("race_results")
      .select("*")
      .eq("race_round", raceRound)
      .single();

    if (resultsError || !results || !results.results_entered) {
      return respond({ error: "No results found for this round." }, 400);
    }

    const { data: predictions, error: predictionsError } = await supabase
      .from("predictions")
      .select("user_id,race_round,picks,score,score_breakdown")
      .eq("race_round", raceRound);

    if (predictionsError) throw predictionsError;
    if (!predictions?.length) {
      return respond({ error: "No predictions found for this round." }, 400);
    }

    const recalculated = predictions.map((prediction) => {
      const { points, breakdown } = calculatePoints(prediction.picks || {}, results);
      const previousScore = toNumber(prediction.score);

      return {
        prediction,
        previousScore,
        nextScore: points,
        delta: points - previousScore,
        breakdown,
      };
    });

    for (const entry of recalculated) {
      const { error } = await supabase
        .from("predictions")
        .update({
          score: entry.nextScore,
          score_breakdown: entry.breakdown,
        })
        .eq("user_id", entry.prediction.user_id)
        .eq("race_round", raceRound);

      if (error) throw error;
    }

    const deltasByUser = recalculated.reduce((map, entry) => {
      const current = map.get(entry.prediction.user_id) || 0;
      map.set(entry.prediction.user_id, current + entry.delta);
      return map;
    }, new Map<string, number>());

    const userIds = [...new Set(recalculated.map((entry) => entry.prediction.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,username,points")
      .in("id", userIds);

    if (profilesError) throw profilesError;

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const changes = [];

    for (const userId of userIds) {
      const profile = profileMap.get(userId);
      const delta = deltasByUser.get(userId) || 0;
      const previousPoints = toNumber(profile?.points);
      const nextPoints = previousPoints + delta;

      if (delta !== 0) {
        const { error } = await supabase
          .from("profiles")
          .update({ points: nextPoints })
          .eq("id", userId);

        if (error) throw error;
      }

      const roundEntry = recalculated.find((entry) => entry.prediction.user_id === userId);
      changes.push({
        user_id: userId,
        username: profile?.username || userId,
        previousScore: roundEntry?.previousScore || 0,
        nextScore: roundEntry?.nextScore || 0,
        previousPoints,
        nextPoints,
        delta,
      });
    }

    return respond({
      status: "ok",
      raceRound,
      repaired: changes.length,
      changedUsers: changes.filter((item) => item.delta !== 0).length,
      changes: changes.sort((left, right) => right.nextPoints - left.nextPoints),
    });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Unexpected repair error." }, 500);
  }
});
