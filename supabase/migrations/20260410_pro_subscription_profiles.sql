-- ============================================================
-- Pro Subscription: extend profiles table
-- Adds Stripe + subscription tracking columns to profiles.
-- Existing rows default to 'free' status — no data loss.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Unique constraints (deferred so existing NULL rows are fine)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_stripe_customer_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_stripe_customer_id_key UNIQUE (stripe_customer_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_stripe_subscription_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
  END IF;
END $$;

-- Fast lookup by Stripe IDs (used in webhook handler)
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx       ON public.profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_stripe_subscription_id_idx   ON public.profiles (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_subscription_status_idx      ON public.profiles (subscription_status);
