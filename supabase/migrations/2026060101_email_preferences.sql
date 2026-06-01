-- ============================================================
-- Email preferences + pick-reminder dedup
--
-- email_preferences:
--   Per-user opt-in toggles for each lifecycle email category,
--   plus an unsubscribe token used in unsubscribe links.
--   Backfilled for existing profiles; new profiles get a row
--   automatically via trigger.
--
-- pick_reminders_sent:
--   Idempotency log. A unique (user_id, race_id, reminder_window)
--   row is inserted on send. The UNIQUE constraint prevents the
--   cron from double-sending if it fires twice in the same window.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id            UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pick_reminders     BOOLEAN     NOT NULL DEFAULT TRUE,
  results_published  BOOLEAN     NOT NULL DEFAULT TRUE,
  weekly_summary     BOOLEAN     NOT NULL DEFAULT TRUE,
  ai_insights        BOOLEAN     NOT NULL DEFAULT TRUE,
  marketing          BOOLEAN     NOT NULL DEFAULT TRUE,
  unsubscribe_token  TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_preferences_unsub_token_idx
  ON public.email_preferences (unsubscribe_token);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_email_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_preferences_updated_at_trigger ON public.email_preferences;
CREATE TRIGGER email_preferences_updated_at_trigger
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_email_preferences_updated_at();

-- Auto-create a preferences row for every new profile
CREATE OR REPLACE FUNCTION public.create_email_preferences_for_new_profile()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.email_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_email_preferences_trigger ON public.profiles;
CREATE TRIGGER profiles_email_preferences_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_email_preferences_for_new_profile();

-- Backfill: every existing profile gets a default-true preferences row
INSERT INTO public.email_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- RLS: users read/update their own preferences; service role bypasses
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_preferences' AND policyname='Users read own preferences') THEN
    EXECUTE 'CREATE POLICY "Users read own preferences" ON public.email_preferences FOR SELECT USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_preferences' AND policyname='Users update own preferences') THEN
    EXECUTE 'CREATE POLICY "Users update own preferences" ON public.email_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- ============================================================

CREATE TABLE IF NOT EXISTS public.pick_reminders_sent (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  race_id            UUID        NOT NULL REFERENCES public.races(id)    ON DELETE CASCADE,
  reminder_window    TEXT        NOT NULL CHECK (reminder_window IN ('24h', '3h')),
  pick_count_at_send INT         NOT NULL DEFAULT 0,
  email_variant      TEXT        NOT NULL CHECK (email_variant IN ('zero', 'incomplete')),
  sent_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, race_id, reminder_window)
);

CREATE INDEX IF NOT EXISTS pick_reminders_sent_user_race_idx
  ON public.pick_reminders_sent (user_id, race_id);

ALTER TABLE public.pick_reminders_sent ENABLE ROW LEVEL SECURITY;
-- No user-facing RLS policies — only the service role writes/reads this table.
