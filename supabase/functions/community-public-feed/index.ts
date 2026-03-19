// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function uniqueIds(values: unknown[]) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value)))];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return respond({ error: "Missing required environment variables." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const postId = body?.postId ? String(body.postId) : null;

    if (postId) {
      const { data: comments, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;

      const authorIds = uniqueIds((comments || []).map((item) => item.author_id));
      const { data: authorProfiles, error: authorError } = authorIds.length
        ? await supabase
          .from("profiles")
          .select("id,username,avatar_color,favorite_team,favorite_driver,points")
          .in("id", authorIds)
        : { data: [], error: null };

      if (authorError) throw authorError;

      return respond({
        status: "ok",
        comments: comments || [],
        authorProfiles: authorProfiles || [],
      });
    }

    const [{ data: leaderboard, error: leaderboardError }, { data: posts, error: postsError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,username,avatar_color,favorite_team,favorite_driver,points")
        .order("points", { ascending: false })
        .limit(120),
      supabase
        .from("posts")
        .select("*")
        .is("league_id", null)
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    if (leaderboardError) throw leaderboardError;
    if (postsError) throw postsError;

    const postIds = (posts || []).map((post) => post.id).filter(Boolean);
    const { data: comments, error: commentsError } = postIds.length
      ? await supabase
        .from("comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true })
      : { data: [], error: null };

    if (commentsError) throw commentsError;

    const authorIds = uniqueIds([
      ...(leaderboard || []).map((item) => item.id),
      ...(posts || []).map((item) => item.author_id),
      ...(comments || []).map((item) => item.author_id),
    ]);

    const { data: authorProfiles, error: authorError } = authorIds.length
      ? await supabase
        .from("profiles")
        .select("id,username,avatar_color,favorite_team,favorite_driver,points")
        .in("id", authorIds)
      : { data: [], error: null };

    if (authorError) throw authorError;

    const commentsByPost = Object.fromEntries(postIds.map((id) => [id, []]));
    (comments || []).forEach((comment) => {
      if (!commentsByPost[comment.post_id]) commentsByPost[comment.post_id] = [];
      commentsByPost[comment.post_id].push(comment);
    });

    return respond({
      status: "ok",
      leaderboard: leaderboard || [],
      posts: posts || [],
      commentsByPost,
      authorProfiles: authorProfiles || [],
    });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Unexpected public feed error." }, 500);
  }
});
