import { getSupabaseAdmin } from "../../admin/_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Categories accepted in the ?cat= query string. Each maps to a column on
// public.email_preferences. Defaults to "all" — turns every category off.
const CATEGORY_COLUMNS = {
  pick_reminders:    "pick_reminders",
  results_published: "results_published",
  weekly_summary:    "weekly_summary",
  ai_insights:       "ai_insights",
  marketing:         "marketing",
};

function renderPage({ title, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; background: #06101b; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 480px; width: 100%; background: #0d1f2e; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 32px; }
    h1 { margin: 0 0 12px; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
    p { margin: 0 0 16px; color: rgba(255,255,255,0.65); font-size: 15px; line-height: 1.6; }
    a { color: #FF6A1A; text-decoration: none; font-weight: 700; }
    .brand { font-size: 12px; letter-spacing: 0.1em; color: rgba(255,255,255,0.4); margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">STINT</div>
    ${body}
  </div>
</body>
</html>`;
}

export async function GET(request) {
  const url = new URL(request.url);
  const token = (url.searchParams.get("token") || "").trim();
  const category = (url.searchParams.get("cat") || "all").trim();

  if (!token) {
    return new Response(renderPage({
      title: "Invalid unsubscribe link",
      body: "<h1>This link is missing a token.</h1><p>If you arrived here from an email, please contact <a href=\"mailto:support@stint-web.com\">support@stint-web.com</a> and we'll handle it.</p>",
    }), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const supabase = getSupabaseAdmin();

  const { data: prefs, error } = await supabase
    .from("email_preferences")
    .select("user_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (error || !prefs) {
    return new Response(renderPage({
      title: "Link no longer valid",
      body: "<h1>This unsubscribe link is no longer valid.</h1><p>You may have already unsubscribed, or the token has been rotated. <a href=\"/profile?tab=email\">Manage your email preferences here</a>.</p>",
    }), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Build the update payload — either a single category or all of them.
  let update;
  let categoryLabel;
  if (category === "all") {
    update = {
      pick_reminders: false,
      results_published: false,
      weekly_summary: false,
      ai_insights: false,
      marketing: false,
    };
    categoryLabel = "all Stint emails";
  } else if (CATEGORY_COLUMNS[category]) {
    update = { [CATEGORY_COLUMNS[category]]: false };
    categoryLabel = category.replace(/_/g, " ");
  } else {
    return new Response(renderPage({
      title: "Unknown category",
      body: "<h1>Unknown email category.</h1><p>Please contact <a href=\"mailto:support@stint-web.com\">support@stint-web.com</a>.</p>",
    }), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const { error: updateErr } = await supabase
    .from("email_preferences")
    .update(update)
    .eq("user_id", prefs.user_id);

  if (updateErr) {
    return new Response(renderPage({
      title: "Something went wrong",
      body: `<h1>We couldn't update your preferences.</h1><p>${updateErr.message}</p><p>Try again, or email <a href=\"mailto:support@stint-web.com\">support@stint-web.com</a>.</p>`,
    }), { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  return new Response(renderPage({
    title: "You're unsubscribed",
    body: `<h1>You're unsubscribed.</h1><p>You won't receive ${categoryLabel} from Stint anymore.</p><p>Changed your mind? <a href="/profile?tab=email">Manage your email preferences</a>.</p>`,
  }), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// One-click unsubscribe (RFC 8058) — Gmail/Outlook POST to the same URL.
export async function POST(request) {
  return GET(request);
}
