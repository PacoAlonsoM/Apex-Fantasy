// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scoreRaceRound, syncRaceRoundFromOpenF1 } from "../_shared/race-sync.ts";

const FALLBACK_ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
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

    if (action === "sync_openf1_results") {
      const requestedYear = Number(body?.payload?.year || body?.year || new Date().getUTCFullYear());
      const synced = await syncRaceRoundFromOpenF1({
        supabase,
        year: requestedYear,
        round: raceRound,
        persist: true,
      });

      return respond({
        status: "ok",
        ...synced,
      });
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
      const scoreResult = await scoreRaceRound({ supabase, raceRound });
      if (scoreResult.status === "missing_results") {
        return respond({ error: scoreResult.message }, 400);
      }
      return respond(scoreResult);
    }

    return respond({ error: "Unknown action." }, 400);
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Unexpected admin function error." }, 500);
  }
});
