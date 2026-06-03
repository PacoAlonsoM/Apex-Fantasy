-- ============================================================
-- Track which user_ai_insights rows have had their
-- "Insight ready" email dispatched. Set on send; checked before
-- send to prevent duplicate emails if the cron generator re-runs
-- or the same insight is regenerated.
-- ============================================================

ALTER TABLE public.user_ai_insights
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS user_ai_insights_email_sent_at_idx
  ON public.user_ai_insights (email_sent_at);
