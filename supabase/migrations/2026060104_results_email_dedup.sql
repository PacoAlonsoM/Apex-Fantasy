-- ============================================================
-- Track which (user_id, race_round) predictions have had their
-- "Results published" email sent. Set on send; checked before
-- send to prevent duplicate emails if award-points is re-run.
-- ============================================================

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS results_email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS predictions_results_email_idx
  ON public.predictions (race_round)
  WHERE results_email_sent_at IS NOT NULL;
