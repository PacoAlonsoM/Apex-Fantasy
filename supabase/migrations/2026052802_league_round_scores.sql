-- League-aware round scoring.
--
-- The predictions table stores ONE row per (user, race_round) with the user's
-- picks JSONB. The scoring engine writes a single `score` per prediction. But
-- Pro game modes (Survival, Double Down, Budget Picks) are league-level
-- settings, so the same picks should score differently in different leagues.
--
-- This table stores per-league per-round scores so league standings can read
-- the mode-adjusted score directly. The legacy `predictions.score` stays as
-- the standard-mode score for backward compatibility and global Free leagues.

CREATE TABLE IF NOT EXISTS league_round_scores (
  league_id   uuid        NOT NULL REFERENCES leagues(id)   ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  race_round  integer     NOT NULL,
  score       integer     NOT NULL DEFAULT 0,
  breakdown   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  game_mode   text        NOT NULL DEFAULT 'standard',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id, race_round)
);

CREATE INDEX IF NOT EXISTS league_round_scores_league_idx
  ON league_round_scores (league_id);

CREATE INDEX IF NOT EXISTS league_round_scores_user_idx
  ON league_round_scores (user_id);

ALTER TABLE public.league_round_scores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'league_round_scores'
      AND policyname = 'League members can read league round scores'
  ) THEN
    CREATE POLICY "League members can read league round scores"
      ON public.league_round_scores
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.league_members lm
          WHERE lm.league_id = league_round_scores.league_id
            AND lm.user_id = auth.uid()
            AND lm.status IN ('active', 'eliminated')
        )
      );
  END IF;
END $$;

GRANT SELECT ON public.league_round_scores TO authenticated;

-- One-time compatibility backfill for standard leagues that already had
-- predictions before league-specific scoring existed. Pro game modes are
-- intentionally left to the JS scorer because their rules are mode-specific.
INSERT INTO public.league_round_scores (
  league_id,
  user_id,
  race_round,
  score,
  breakdown,
  game_mode,
  computed_at
)
SELECT
  l.id,
  p.user_id,
  p.race_round,
  COALESCE(p.score, 0)::integer,
  COALESCE(p.score_breakdown, '[]'::jsonb),
  l.game_mode,
  now()
FROM public.predictions p
CROSS JOIN LATERAL jsonb_object_keys(p.picks->'__league_submissions') AS stored(league_id)
JOIN public.leagues l
  ON l.id::text = stored.league_id
  AND l.game_mode = 'standard'
JOIN public.race_results rr
  ON rr.race_round = p.race_round
  AND rr.results_entered = true
WHERE p.picks ? '__league_submissions'
ON CONFLICT (league_id, user_id, race_round)
DO UPDATE SET
  score = EXCLUDED.score,
  breakdown = EXCLUDED.breakdown,
  game_mode = EXCLUDED.game_mode,
  computed_at = EXCLUDED.computed_at;
