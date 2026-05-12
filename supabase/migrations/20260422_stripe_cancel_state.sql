-- Track scheduled Stripe cancellations without dropping Pro access early.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMPTZ;
