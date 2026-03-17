// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { inferLatestCompletedRound, scoreRaceRound, syncRaceRoundFromOpenF1 } from "../_shared/race-sync.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
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
  const syncSecret = Deno.env.get("RACE_RESULTS_SYNC_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !syncSecret) {
    return respond({ error: "Missing required environment variables." }, 500);
  }

  const requestSecret = req.headers.get("x-sync-secret");
  if (!requestSecret || requestSecret !== syncSecret) {
    return respond({ error: "Unauthorized." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const requestedYear = Number(body?.year || new Date().getUTCFullYear());
    const requestedRound = body?.raceRound ? Number(body.raceRound) : null;
    const shouldScore = body?.score !== false;

    const target = requestedRound
      ? { round: requestedRound }
      : await inferLatestCompletedRound(requestedYear);

    if (!target?.round) {
      return respond({ error: `No completed OpenF1 race session found for ${requestedYear}.` }, 400);
    }

    const synced = await syncRaceRoundFromOpenF1({
      supabase,
      year: requestedYear,
      round: target.round,
      persist: true,
    });

    const scoring = shouldScore
      ? await scoreRaceRound({ supabase, raceRound: target.round })
      : { status: "skipped", scored: 0, message: "Scoring skipped by request." };

    return respond({
      status: "ok",
      synced,
      scoring,
    });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Unexpected race sync error." }, 500);
  }
});
