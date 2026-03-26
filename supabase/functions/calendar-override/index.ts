// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FALLBACK_ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";
const DEFAULT_SEASON = 2026;
const ALLOWED_OVERRIDE_STATUSES = new Set(["scheduled", "completed", "cancelled", "postponed"]);

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;
  const adminId = Deno.env.get("AI_ADMIN_USER_ID") || FALLBACK_ADMIN_ID;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return respond({ error: "Missing required environment variables." }, 500);
  }

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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const season = Number(body?.season || DEFAULT_SEASON) || DEFAULT_SEASON;
    const internalRoundNumber = Number(body?.internalRoundNumber || body?.round || 0) || null;
    const eventSlug = String(body?.eventSlug || "").trim() || null;
    const rawOverrideStatus = body?.overrideStatus;
    const overrideStatus = rawOverrideStatus === null || rawOverrideStatus === undefined || rawOverrideStatus === ""
      ? null
      : String(rawOverrideStatus).trim().toLowerCase();

    if (!internalRoundNumber && !eventSlug) {
      return respond({ error: "Missing race identifier." }, 400);
    }

    if (overrideStatus && !ALLOWED_OVERRIDE_STATUSES.has(overrideStatus)) {
      return respond({ error: "Invalid override status." }, 400);
    }

    let updateQuery = supabase
      .from("race_calendar")
      .update({
        override_status: overrideStatus,
        override_note: overrideStatus ? "Manual admin override" : null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("season", season);

    if (internalRoundNumber) {
      updateQuery = updateQuery.eq("internal_round_number", internalRoundNumber);
    } else if (eventSlug) {
      updateQuery = updateQuery.eq("event_slug", eventSlug);
    }

    const { data, error } = await updateQuery
      .select("display_name,event_slug,event_status,override_status,internal_round_number")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return respond({ error: "Race calendar row not found. Run calendar sync first." }, 404);
    }

    return respond({
      ok: true,
      season,
      internalRoundNumber: data.internal_round_number,
      eventSlug: data.event_slug,
      displayName: data.display_name,
      overrideStatus: data.override_status,
      effectiveStatus: data.override_status || data.event_status,
    });
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error || "Calendar override failed.");
    return respond({ error: errorText }, 500);
  }
});
