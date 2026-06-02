import "server-only";
import { sendResultsPublishedEmail } from "@/src/lib/email";

/**
 * Dispatch "Results published" emails for a single race round.
 *
 * Called from /api/admin/results/award-points via Next.js `after()` so the
 * admin response isn't blocked. Idempotent: each prediction is marked with
 * `results_email_sent_at` on success and skipped on subsequent calls.
 *
 * Returns a summary suitable for logging.
 */
export async function dispatchResultsEmails(supabase, raceRound) {
  const summary = {
    raceRound,
    candidates: 0,
    skipped_already_sent: 0,
    skipped_opted_out: 0,
    skipped_no_email: 0,
    sent: 0,
    errors: [],
  };

  // 1. Pull every prediction for this round. We only email rows that
  // haven't been emailed yet — the column gates re-runs.
  const { data: predictions, error: predErr } = await supabase
    .from("predictions")
    .select("user_id, race_round, score, score_breakdown, results_email_sent_at")
    .eq("race_round", raceRound);

  if (predErr) {
    summary.errors.push({ phase: "predictions", error: predErr.message });
    return summary;
  }
  if (!predictions?.length) return summary;

  summary.candidates = predictions.length;
  const pending = predictions.filter((p) => !p.results_email_sent_at);
  summary.skipped_already_sent = predictions.length - pending.length;
  if (!pending.length) return summary;

  // 2. Race metadata in one shot.
  const { data: race } = await supabase
    .from("race_calendar")
    .select("display_name, country_name")
    .eq("race_round", raceRound)
    .maybeSingle();
  const raceName    = race?.display_name || `Round ${raceRound}`;
  const raceCountry = race?.country_name || null;

  // 3. Email prefs for the candidate set.
  const userIds = pending.map((p) => p.user_id);
  const { data: prefs } = await supabase
    .from("email_preferences")
    .select("user_id, results_published, unsubscribe_token")
    .in("user_id", userIds);
  const prefsByUser = new Map((prefs || []).map((p) => [p.user_id, p]));

  // 4. Auth emails — listUsers is paginated; iterate until we cover the
  // candidate set. With our current user base one page suffices.
  const emailByUser = new Map();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      summary.errors.push({ phase: "auth.listUsers", error: error.message });
      break;
    }
    (data?.users || []).forEach((u) => { if (u.email) emailByUser.set(u.id, u.email); });
    if (!data?.users || data.users.length < 1000) break;
    page += 1;
    if (page > 10) break;
  }

  // 5. Send + mark.
  for (const prediction of pending) {
    const pref = prefsByUser.get(prediction.user_id);
    if (!pref || pref.results_published === false) {
      summary.skipped_opted_out += 1;
      continue;
    }
    const email = emailByUser.get(prediction.user_id);
    if (!email) { summary.skipped_no_email += 1; continue; }

    // Username for the salutation.
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", prediction.user_id)
      .maybeSingle();

    // Find the single best-scoring pick from the breakdown.
    const breakdown = Array.isArray(prediction.score_breakdown) ? prediction.score_breakdown : [];
    let bestPick = null;
    for (const entry of breakdown) {
      const pts = Number(entry?.pts ?? 0);
      if (!bestPick || pts > bestPick.points) {
        bestPick = {
          type:   String(entry?.pick_type || entry?.type || ""),
          value:  String(entry?.picked_value || entry?.value || ""),
          points: pts,
        };
      }
    }

    try {
      await sendResultsPublishedEmail({
        email,
        username: profile?.username,
        raceName,
        raceCountry,
        raceRound,
        score: Number(prediction.score || 0),
        bestPick,
        unsubscribeToken: pref.unsubscribe_token,
      });

      const { error: markErr } = await supabase
        .from("predictions")
        .update({ results_email_sent_at: new Date().toISOString() })
        .eq("user_id", prediction.user_id)
        .eq("race_round", raceRound);

      if (markErr) throw markErr;
      summary.sent += 1;
    } catch (err) {
      summary.errors.push({ user_id: prediction.user_id, error: err?.message || String(err) });
    }
  }

  return summary;
}
