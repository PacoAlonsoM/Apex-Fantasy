// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { inferCompletedRounds, inferLatestCompletedRound, scoreRaceRound, syncRaceRoundFromOpenF1 } from "../_shared/race-sync.ts";

const FALLBACK_ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;
  const syncSecret = Deno.env.get("RACE_RESULTS_SYNC_SECRET");
  const adminId = Deno.env.get("AI_ADMIN_USER_ID") || FALLBACK_ADMIN_ID;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return respond({ error: "Missing required environment variables." }, 500);
  }

  const requestSecret = req.headers.get("x-sync-secret");
  const requestApiKey = req.headers.get("apikey");
  let authorized = Boolean(syncSecret && requestSecret && requestSecret === syncSecret);

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

  try {
    const body = await req.json().catch(() => ({}));
    const requestedYear = Number(body?.year || new Date().getUTCFullYear());
    const requestedRound = body?.raceRound ? Number(body.raceRound) : null;
    const shouldBackfillSeason = body?.backfillSeason === true;
    const historyOnly = body?.historyOnly === true;
    const persistRaceResults = typeof body?.persistRaceResults === "boolean"
      ? body.persistRaceResults
      : shouldBackfillSeason
        ? false
        : !historyOnly;
    const persistRaceContextHistory = typeof body?.persistRaceContextHistory === "boolean"
      ? body.persistRaceContextHistory
      : true;
    const shouldScore = typeof body?.score === "boolean"
      ? body.score
      : (!shouldBackfillSeason && persistRaceResults);

    if (!persistRaceResults && !persistRaceContextHistory) {
      return respond({ error: "Nothing to persist. Enable race results or race context history." }, 400);
    }

    if (shouldScore && !persistRaceResults) {
      return respond({ error: "Cannot score predictions when race_results persistence is disabled." }, 400);
    }

    if (shouldBackfillSeason) {
      const completedRounds = await inferCompletedRounds(requestedYear, { supabase });
      if (!completedRounds.length) {
        return respond({ error: `No completed OpenF1 race sessions found for ${requestedYear}.` }, 400);
      }

      const rounds = [];
      const errors = [];

      for (const completedRound of completedRounds) {
        try {
          const synced = await syncRaceRoundFromOpenF1({
            supabase,
            year: requestedYear,
            round: completedRound,
            persist: true,
            persistRaceResults,
            persistRaceContextHistory,
          });

          const scoring = shouldScore
            ? await scoreRaceRound({ supabase, raceRound: completedRound })
            : { status: "skipped", scored: 0, message: "Scoring skipped by request." };

          rounds.push({
            round: completedRound,
            raceName: synced?.raceName || null,
            synced,
            scoring,
          });
        } catch (error) {
          errors.push({
            round: completedRound,
            error: error instanceof Error ? error.message : "Unexpected race sync error.",
          });
        }
      }

      if (!rounds.length && errors.length) {
        return respond({
          error: `Season backfill failed for ${requestedYear}.`,
          errors,
        }, 500);
      }

      return respond({
        status: errors.length ? "partial" : "ok",
        mode: persistRaceResults ? "season_backfill" : "season_history_backfill",
        year: requestedYear,
        completedRoundCount: completedRounds.length,
        syncedCount: rounds.length,
        errorCount: errors.length,
        rounds,
        errors,
      }, errors.length ? 207 : 200);
    }

    const target = requestedRound
      ? { round: requestedRound }
      : await inferLatestCompletedRound(requestedYear, { supabase });

    if (!target?.round) {
      return respond({ error: `No completed OpenF1 race session found for ${requestedYear}.` }, 400);
    }

    const synced = await syncRaceRoundFromOpenF1({
      supabase,
      year: requestedYear,
      round: target.round,
      persist: true,
      persistRaceResults,
      persistRaceContextHistory,
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
