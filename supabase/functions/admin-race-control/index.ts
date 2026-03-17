// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FALLBACK_ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

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

function calculatePoints(picks: Record<string, unknown>, results: Record<string, unknown>) {
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
  if (picks.dnf && picks.dnf === results.dnf) { points += PTS.dnf; breakdown.push({ label: "DNF Driver", pts: PTS.dnf }); }
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

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
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

  if (authError || !user) return respond({ error: "Invalid auth token." }, 401);
  if (user.id !== adminId) return respond({ error: "Forbidden." }, 403);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();
    const action = String(body?.action || "");
    const raceRound = Number(body?.raceRound);

    if (!action || !Number.isFinite(raceRound) || raceRound <= 0) {
      return respond({ error: "Missing action or raceRound." }, 400);
    }

    if (action === "save_results") {
      const payload = body?.payload || {};
      const row = {
        race_round: raceRound,
        pole: payload.pole || null,
        winner: payload.winner || null,
        p2: payload.p2 || null,
        p3: payload.p3 || null,
        dnf: payload.dnf || null,
        fastest_lap: payload.fastest_lap || null,
        dotd: payload.dotd || null,
        best_constructor: payload.best_constructor || null,
        safety_car: !!payload.safety_car,
        red_flag: !!payload.red_flag,
        sp_pole: payload.sp_pole || null,
        sp_winner: payload.sp_winner || null,
        sp_p2: payload.sp_p2 || null,
        sp_p3: payload.sp_p3 || null,
        results_entered: true,
        locked_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("race_results").upsert(row, { onConflict: "race_round" });
      if (error) throw error;

      return respond({ status: "ok", raceRound });
    }

    if (action === "score_race") {
      const { data: results, error: resultError } = await supabase
        .from("race_results")
        .select("*")
        .eq("race_round", raceRound)
        .single();

      if (resultError || !results || !results.results_entered) {
        return respond({ error: "No saved race results found for this round." }, 400);
      }

      const { data: predictions, error: predictionError } = await supabase
        .from("predictions")
        .select("*")
        .eq("race_round", raceRound);

      if (predictionError) throw predictionError;
      if (!predictions?.length) return respond({ error: "No predictions found for this round." }, 400);

      const unscored = predictions.filter((prediction) => !prediction.score || prediction.score === 0);
      if (!unscored.length) {
        return respond({ error: "This round was already scored. Reset points first if you need to rescore." }, 400);
      }

      for (const prediction of unscored) {
        const { points, breakdown } = calculatePoints(prediction.picks || {}, results);

        const { error: predictionUpdateError } = await supabase
          .from("predictions")
          .update({ score: points, score_breakdown: breakdown })
          .eq("user_id", prediction.user_id)
          .eq("race_round", raceRound);

        if (predictionUpdateError) throw predictionUpdateError;

        const { data: profile, error: profileReadError } = await supabase
          .from("profiles")
          .select("points")
          .eq("id", prediction.user_id)
          .single();

        if (profileReadError) throw profileReadError;

        const currentPoints = Number(profile?.points || 0);
        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update({ points: currentPoints + points })
          .eq("id", prediction.user_id);

        if (profileUpdateError) throw profileUpdateError;
      }

      return respond({ status: "ok", scored: unscored.length });
    }

    return respond({ error: "Unknown action." }, 400);
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Unexpected admin function error." }, 500);
  }
});
