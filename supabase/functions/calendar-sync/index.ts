// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENF1_BASE = "https://api.openf1.org/v1";
const FALLBACK_ADMIN_ID = "cb9d7c71-74a6-4a5f-90d6-0809c83f4101";
const DEFAULT_SEASON = 2026;
const INTERNAL_ROUND_BY_SLUG = {
  "australian-gp": 1,
  "chinese-gp": 2,
  "japanese-gp": 3,
  "bahrain-gp": 4,
  "saudi-arabian-gp": 5,
  "miami-gp": 6,
  "canadian-gp": 7,
  "monaco-gp": 8,
  "spanish-gp": 9,
  "austrian-gp": 10,
  "british-gp": 11,
  "belgian-gp": 12,
  "hungarian-gp": 13,
  "dutch-gp": 14,
  "italian-gp": 15,
  "madrid-gp": 16,
  "azerbaijan-gp": 17,
  "singapore-gp": 18,
  "us-gp": 19,
  "mexico-city-gp": 20,
  "sao-paulo-gp": 21,
  "las-vegas-gp": 22,
  "qatar-gp": 23,
  "abu-dhabi-gp": 24,
};
const COUNTRY_TO_SLUG = {
  australia: "australian-gp",
  china: "chinese-gp",
  japan: "japanese-gp",
  bahrain: "bahrain-gp",
  "saudi-arabia": "saudi-arabian-gp",
  canada: "canadian-gp",
  monaco: "monaco-gp",
  austria: "austrian-gp",
  belgium: "belgian-gp",
  hungary: "hungarian-gp",
  netherlands: "dutch-gp",
  italy: "italian-gp",
  azerbaijan: "azerbaijan-gp",
  singapore: "singapore-gp",
  qatar: "qatar-gp",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-calendar-sync-secret, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function sortByDate(list: Array<Record<string, unknown>>, field = "date_start") {
  return [...list].sort((left, right) => new Date(String(left[field] || 0)).getTime() - new Date(String(right[field] || 0)).getTime());
}

async function fetchOpenF1(path: string) {
  const response = await fetch(`${OPENF1_BASE}${path}`, {
    headers: {
      accept: "application/json",
      "user-agent": "stint-calendar-sync/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`OpenF1 ${path}: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function formatDisplayName(raceSession: Record<string, unknown>) {
  const meetingName = String(raceSession?.meeting_name || "").trim();
  if (meetingName) {
    let display = meetingName.replace(/^Grand Prix of\s+/i, "").trim();
    display = display.replace(/\bGrand Prix\b/i, "GP").trim();
    if (!/\bgp\b/i.test(display)) display = `${display} GP`;
    return display;
  }

  const country = String(raceSession?.country_name || "").trim();
  if (country) return `${country} GP`;
  return "Grand Prix";
}

function buildEventSlug(raceSession: Record<string, unknown>, displayName: string) {
  const country = normalizeText(raceSession?.country_name || "");
  const city = normalizeText(raceSession?.location || "");
  const displaySlug = normalizeText(displayName || raceSession?.meeting_official_name || raceSession?.meeting_name || raceSession?.country_name || "grand-prix");

  if (country === "united-states" && city.includes("miami")) return "miami-gp";
  if (country === "united-states" && city.includes("austin")) return "us-gp";
  if (country === "united-states" && city.includes("las-vegas")) return "las-vegas-gp";
  if (country === "mexico" && city.includes("mexico-city")) return "mexico-city-gp";
  if (country === "spain" && city.includes("barcelona")) return "spanish-gp";
  if (country === "spain" && city.includes("madrid")) return "madrid-gp";
  if (country === "brazil" && city.includes("sao-paulo")) return "sao-paulo-gp";
  if (country === "united-kingdom") return "british-gp";
  if (country === "united-arab-emirates") return "abu-dhabi-gp";
  if (COUNTRY_TO_SLUG[country]) return COUNTRY_TO_SLUG[country];

  return displaySlug;
}

function deriveStatus(raceSession: Record<string, unknown>) {
  const endMoment = new Date(String(raceSession?.date_end || raceSession?.date_start || 0)).getTime();
  if (Number.isFinite(endMoment) && endMoment < Date.now()) return "completed";
  return "scheduled";
}

function groupRaceMeetings(sessions: Array<Record<string, unknown>>) {
  const grouped = new Map<number, Array<Record<string, unknown>>>();

  for (const session of sessions || []) {
    const meetingKey = Number(session?.meeting_key || 0);
    if (!Number.isFinite(meetingKey) || meetingKey <= 0) continue;

    const current = grouped.get(meetingKey) || [];
    current.push(session);
    grouped.set(meetingKey, current);
  }

  return [...grouped.entries()]
    .map(([meetingKey, meetingSessions]) => {
      const sorted = sortByDate(meetingSessions);
      const raceSession = sorted.find((session) => String(session?.session_name || "").toLowerCase() === "race") || null;
      if (!raceSession) return null;
      return { meetingKey, sessions: sorted, raceSession };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(String(left.raceSession?.date_start || 0)).getTime() - new Date(String(right.raceSession?.date_start || 0)).getTime());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;
  const adminId = Deno.env.get("AI_ADMIN_USER_ID") || FALLBACK_ADMIN_ID;
  const calendarSyncSecret = Deno.env.get("CALENDAR_SYNC_SECRET");
  const sharedSyncSecret = Deno.env.get("RACE_RESULTS_SYNC_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return respond({ error: "Missing required environment variables." }, 500);
  }

  const secretHeader = req.headers.get("x-calendar-sync-secret");
  const sharedSecretHeader = req.headers.get("x-sync-secret");
  const requestApiKey = req.headers.get("apikey");
  let authorized = Boolean(
    (calendarSyncSecret && secretHeader && secretHeader === calendarSyncSecret)
    || (sharedSyncSecret && sharedSecretHeader && sharedSecretHeader === sharedSyncSecret)
  );

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

  const startedAt = new Date().toISOString();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const season = Number(body?.season || DEFAULT_SEASON) || DEFAULT_SEASON;
    const sessions = sortByDate(await fetchOpenF1(`/sessions?year=${season}`));
    const meetings = groupRaceMeetings(sessions);

    if (!meetings.length) {
      throw new Error(`No race meetings found for season ${season}.`);
    }

    const { data: existingRows } = await supabase
      .from("race_calendar")
      .select("id,event_slug,override_status,internal_round_number")
      .eq("season", season);

    const existingBySlug = new Map((existingRows || []).map((row) => [row.event_slug, row]));
    const now = new Date().toISOString();
    const rows = meetings.map(({ meetingKey, sessions: meetingSessions, raceSession }, index) => {
      const displayName = formatDisplayName(raceSession);
      const eventSlug = buildEventSlug(raceSession, displayName);
      const overrideStatus = existingBySlug.get(eventSlug)?.override_status || null;

      return {
        season,
        event_slug: eventSlug,
        official_name: String(raceSession?.meeting_official_name || raceSession?.meeting_name || displayName || "").trim() || null,
        display_name: displayName,
        country_name: String(raceSession?.country_name || "").trim() || null,
        city_name: String(raceSession?.location || "").trim() || null,
        circuit_name: String(raceSession?.circuit_short_name || "").trim() || null,
        race_type: null,
        race_date: String(raceSession?.date_start || "").slice(0, 10),
        weekend_start: meetingSessions[0]?.date_start || null,
        weekend_end: meetingSessions[meetingSessions.length - 1]?.date_end || meetingSessions[meetingSessions.length - 1]?.date_start || null,
        sprint: meetingSessions.some((session) => String(session?.session_name || "").toLowerCase() === "sprint"),
        source_round_number: index + 1,
        internal_round_number: existingBySlug.get(eventSlug)?.internal_round_number || INTERNAL_ROUND_BY_SLUG[eventSlug] || null,
        meeting_key: Number(meetingKey),
        race_session_key: Number(raceSession?.session_key || 0) || null,
        event_status: overrideStatus || deriveStatus(raceSession),
        source_name: "OpenF1",
        source_url: `${OPENF1_BASE}/sessions?year=${season}`,
        source_payload: {
          meeting_name: raceSession?.meeting_name || null,
          meeting_official_name: raceSession?.meeting_official_name || null,
          session_names: meetingSessions.map((session) => session?.session_name).filter(Boolean),
        },
        last_synced_at: now,
        updated_at: now,
      };
    });

    const activeSlugs = new Set(rows.map((row) => row.event_slug));
    const cancelledIds = (existingRows || [])
      .filter((row) => !activeSlugs.has(row.event_slug))
      .map((row) => row.id);

    const { error: upsertError } = await supabase
      .from("race_calendar")
      .upsert(rows, { onConflict: "season,event_slug" });

    if (upsertError) throw upsertError;

    if (cancelledIds.length) {
      const { error: cancelError } = await supabase
        .from("race_calendar")
        .update({
          event_status: "cancelled",
          last_synced_at: now,
        })
        .in("id", cancelledIds);

      if (cancelError) throw cancelError;
    }

    await supabase.from("race_calendar_sync_runs").insert({
      season,
      status: "ok",
      source_name: "OpenF1",
      active_count: rows.length,
      cancelled_count: cancelledIds.length,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return respond({
      ok: true,
      season,
      upsertedCount: rows.length,
      cancelledCount: cancelledIds.length,
      source: "OpenF1",
    });
  } catch (error) {
    const errorText = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
    await supabase.from("race_calendar_sync_runs").insert({
      season: DEFAULT_SEASON,
      status: "error",
      source_name: "OpenF1",
      error_text: errorText,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return respond(
      { error: errorText || "Calendar sync failed." },
      500
    );
  }
});
