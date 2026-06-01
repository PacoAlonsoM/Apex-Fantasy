import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../admin/_lib/supabaseAdmin";
import { sendWelcomeEmail } from "@/src/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recency guard: we only honour welcome requests for users that signed up
// within this window. Stops abuse where someone tries to fire welcomes for
// arbitrary user_ids.
const RECENT_SIGNUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = String(body?.userId || "").trim();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 1. Look up the auth user — we need their email + created_at for the
  // recency check.
  const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr || !authData?.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const authUser = authData.user;
  const email = authUser.email;
  if (!email) {
    return NextResponse.json({ error: "User has no email on file" }, { status: 422 });
  }

  // 2. Enforce the recency window — must be a fresh signup.
  const createdAt = new Date(authUser.created_at || 0).getTime();
  if (!createdAt || Date.now() - createdAt > RECENT_SIGNUP_WINDOW_MS) {
    return NextResponse.json({ error: "Signup window has expired" }, { status: 409 });
  }

  // 3. Profile + email_preferences in one query.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, favorite_team, email_preferences(welcome_sent_at, unsubscribe_token)")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not yet created" }, { status: 409 });
  }

  const prefs = profile.email_preferences;
  if (!prefs) {
    return NextResponse.json({ error: "Email preferences row missing" }, { status: 500 });
  }

  // 4. Dedup — never send twice.
  if (prefs.welcome_sent_at) {
    return NextResponse.json({ ok: true, status: "already_sent" });
  }

  // 5. Send + mark.
  try {
    await sendWelcomeEmail({
      email,
      username: profile.username,
      favoriteTeam: profile.favorite_team,
      unsubscribeToken: prefs.unsubscribe_token,
    });
  } catch (err) {
    console.error("[auth/welcome] send failed", err?.message || err);
    return NextResponse.json({ error: "Failed to send welcome email" }, { status: 502 });
  }

  const { error: updateErr } = await supabase
    .from("email_preferences")
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (updateErr) {
    // Email already went; don't fail the caller, but log so we can spot
    // dedup gaps in case Resend ever retries.
    console.error("[auth/welcome] mark-sent failed", updateErr.message);
  }

  return NextResponse.json({ ok: true, status: "sent" });
}
