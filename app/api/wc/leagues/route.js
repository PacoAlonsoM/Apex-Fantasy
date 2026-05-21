import { NextResponse } from "next/server";
import { requireWcUser } from "../_lib/wcServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEAGUE_NAME_LENGTH = 60;

function makeCode(name) {
  const base = String(name || "WC")
    .replace(/[^a-z0-9]+/gi, "")
    .toUpperCase()
    .slice(0, 6) || "WC";
  return `${base}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function isUniqueViolation(error) {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate key|unique constraint/i.test(String(error.message || ""));
}

export async function GET(request) {
  try {
    const { user, supabase } = await requireWcUser(request);
    const { data, error } = await supabase
      .from("wc_league_members")
      .select("league_id, role, wc_leagues(id,name,code,visibility,owner_id,created_at)")
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({
      status: "ok",
      leagues: (data || []).map((row) => ({ ...(row.wc_leagues || {}), role: row.role })).filter((league) => league.id),
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not load WC leagues.",
    }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  try {
    const { user, supabase } = await requireWcUser(request, body);
    const name = String(body?.name || "").trim().slice(0, MAX_LEAGUE_NAME_LENGTH);
    if (!name) return NextResponse.json({ status: "error", message: "Name your WC league." }, { status: 400 });

    let league = null;
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await supabase
        .from("wc_leagues")
        .insert({
          owner_id: user.id,
          name,
          code: makeCode(name),
          visibility: body?.visibility === "public" ? "public" : "private",
        })
        .select("*")
        .single();
      if (!error) {
        league = data;
        break;
      }
      lastError = error;
      if (!isUniqueViolation(error)) break;
    }

    if (!league) throw lastError || new Error("Could not allocate a WC league code.");

    const { error: memberError } = await supabase
      .from("wc_league_members")
      .insert({
        league_id: league.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) throw memberError;
    return NextResponse.json({ status: "ok", message: "WC league created.", league });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not create WC league.",
    }, { status: error.status || 500 });
  }
}
