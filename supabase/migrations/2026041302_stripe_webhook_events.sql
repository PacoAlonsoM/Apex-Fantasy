-- Stripe webhook event log
-- Keeps a durable record of deliveries so webhook handling can be idempotent.

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT FALSE,
  api_version TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  customer_id TEXT,
  subscription_id TEXT,
  user_id TEXT,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_status_idx
  ON public.stripe_webhook_events (status, received_at DESC);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_customer_idx
  ON public.stripe_webhook_events (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS stripe_webhook_events_subscription_idx
  ON public.stripe_webhook_events (subscription_id)
  WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS stripe_webhook_events_user_idx
  ON public.stripe_webhook_events (user_id)
  WHERE user_id IS NOT NULL;
