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

  // 4b. Compute Stint Community league rank deltas. If anything in this
  // block fails we fall back to (delta=0, rank=null, name=null) per user
  // so the email still sends with the round summary.
  let rankByUser = new Map(); // user_id -> { delta, currentRank, leagueName }
  let communityLeagueName = null;
  try {
    const { data: community, error: leagueErr } = await supabase
      .from("leagues")
      .select("id, name")
      .eq("type", "community")
      .maybeSingle();

    if (leagueErr) throw leagueErr;

    if (community?.id) {
      communityLeagueName = community.name || "Stint Community";

      // Pull every scored row for the community league once, then compute
      // prev/new totals and ranks across all members in JS.
      const { data: allScores, error: scoresErr } = await supabase
        .from("league_round_scores")
        .select("user_id, race_round, score")
        .eq("league_id", community.id);

      if (scoresErr) throw scoresErr;

      const prevTotals = new Map(); // user_id -> total through race_round - 1
      const newTotals  = new Map(); // user_id -> total through race_round

      for (const row of allScores || []) {
        const uid = row.user_id;
        const round = Number(row.race_round);
        const pts = Number(row.score || 0);
        if (round < raceRound) {
          prevTotals.set(uid, (prevTotals.get(uid) || 0) + pts);
          newTotals.set(uid,  (newTotals.get(uid)  || 0) + pts);
        } else if (round === raceRound) {
          newTotals.set(uid,  (newTotals.get(uid)  || 0) + pts);
        }
      }

      // Members of the community league set the rank universe.
      const { data: members, error: membersErr } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", community.id);

      if (membersErr) throw membersErr;

      const memberIds = (members || []).map((m) => m.user_id);
      const prevSorted = memberIds
        .map((uid) => prevTotals.get(uid) || 0)
        .sort((a, b) => b - a);
      const newSorted = memberIds
        .map((uid) => newTotals.get(uid) || 0)
        .sort((a, b) => b - a);

      const rankFor = (sorted, total) => {
        // Count strictly greater totals, then +1. Matches the spec:
        // count(totals > userTotal) + 1.
        let count = 0;
        for (const v of sorted) {
          if (v > total) count += 1;
          else break; // sorted desc
        }
        return count + 1;
      };

      for (const uid of memberIds) {
        const prevTotal = prevTotals.get(uid) || 0;
        const newTotal  = newTotals.get(uid)  || 0;
        const prevRank = rankFor(prevSorted, prevTotal);
        const newRank  = rankFor(newSorted,  newTotal);
        rankByUser.set(uid, {
          delta: prevRank - newRank,
          currentRank: newRank,
          leagueName: communityLeagueName,
        });
      }
    }
  } catch (err) {
    summary.errors.push({ phase: "league_rank", error: err?.message || String(err) });
    rankByUser = new Map();
    communityLeagueName = null;
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

    const rankInfo = rankByUser.get(prediction.user_id) || null;
    const leagueRankDelta   = rankInfo ? rankInfo.delta       : 0;
    const currentLeagueRank = rankInfo ? rankInfo.currentRank : null;
    const leagueName        = rankInfo ? rankInfo.leagueName  : null;

    try {
      await sendResultsPublishedEmail({
        email,
        username: profile?.username,
        raceName,
        raceCountry,
        raceRound,
        score: Number(prediction.score || 0),
        bestPick,
        leagueRankDelta,
        currentLeagueRank,
        leagueName,
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
