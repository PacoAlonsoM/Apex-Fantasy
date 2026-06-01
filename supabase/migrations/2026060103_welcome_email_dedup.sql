-- ============================================================
-- Add welcome_sent_at to email_preferences for dedup.
-- /api/auth/welcome reads this column to decide whether to send;
-- writes NOW() on success. Existing preference rows leave it NULL,
-- so users created before this column existed will receive a
-- welcome email on their next signup-flow call (zero risk —
-- subsequent runs see the timestamp and skip).
-- ============================================================

ALTER TABLE public.email_preferences
  ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS email_preferences_welcome_sent_at_idx
  ON public.email_preferences (welcome_sent_at);
