-- ============================================================
-- STINT PRO — Full setup script
-- Paste this entire file into the Supabase SQL editor and run.
-- Safe to run multiple times (all statements are idempotent).
-- Run order matters: races → profiles → leagues → picks →
--   drafts/brackets → user_insights → community league seed
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. RACES TABLE
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.races (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  circuit     TEXT        NOT NULL,
  country     TEXT        NOT NULL,
  date        TIMESTAMPTZ NOT NULL,
  season      INT         NOT NULL,
  round       INT         NOT NULL,
  is_sprint   BOOLEAN     NOT NULL DEFAULT FALSE,
  lock_time   TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS races_season_round_idx ON public.races (season, round);
CREATE INDEX        IF NOT EXISTS races_season_idx        ON public.races (season);
CREATE INDEX        IF NOT EXISTS races_lock_time_idx     ON public.races (lock_time);

ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='races' AND policyname='Public can read races'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read races" ON public.races FOR SELECT USING (true)';
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 2. PROFILES — subscription + Stripe columns
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status    TEXT        NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS subscription_start     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_stripe_customer_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_stripe_customer_id_key UNIQUE (stripe_customer_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_stripe_subscription_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON public.profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_stripe_subscription_id_idx
  ON public.profiles (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_subscription_status_idx
  ON public.profiles (subscription_status);


-- ────────────────────────────────────────────────────────────
-- 3. LEAGUES — extend with game mode, visibility, settings
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS type          TEXT    NOT NULL DEFAULT 'standard'
    CHECK (type IN ('standard', 'pro_community')),
  ADD COLUMN IF NOT EXISTS game_mode     TEXT    NOT NULL DEFAULT 'standard'
    CHECK (game_mode IN ('standard','survival','draft','double_down','head_to_head','budget_picks')),
  ADD COLUMN IF NOT EXISTS visibility    TEXT    NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public','private','password')),
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS settings      JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS season        INT     NOT NULL DEFAULT 2026,
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT TRUE;

-- Migrate existing is_public → visibility (safe to re-run)
UPDATE public.leagues
  SET visibility = CASE WHEN is_public THEN 'public' ELSE 'private' END
  WHERE visibility = 'private';

CREATE INDEX IF NOT EXISTS leagues_type_idx       ON public.leagues (type);
CREATE INDEX IF NOT EXISTS leagues_game_mode_idx  ON public.leagues (game_mode);
CREATE INDEX IF NOT EXISTS leagues_season_idx     ON public.leagues (season);


-- ────────────────────────────────────────────────────────────
-- 4. LEAGUE_MEMBERS — extend with role, status, etc.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.league_members
  ADD COLUMN IF NOT EXISTS role                  TEXT    NOT NULL DEFAULT 'member'
    CHECK (role IN ('comisionado', 'member')),
  ADD COLUMN IF NOT EXISTS status                TEXT    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'eliminated', 'banned', 'removed')),
  ADD COLUMN IF NOT EXISTS eliminated_at_race_id UUID    REFERENCES public.races(id),
  ADD COLUMN IF NOT EXISTS handicap_points       INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS joined_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill: league owners become comisionados
UPDATE public.league_members lm
  SET role = 'comisionado'
  FROM public.leagues l
  WHERE lm.league_id = l.id
    AND lm.user_id = l.owner_id
    AND lm.role = 'member';

CREATE INDEX IF NOT EXISTS league_members_status_idx ON public.league_members (status);
CREATE INDEX IF NOT EXISTS league_members_role_idx   ON public.league_members (role);

-- RLS for leagues
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leagues' AND policyname='Users can read their leagues and public leagues') THEN
    EXECUTE $pol$
      CREATE POLICY "Users can read their leagues and public leagues"
        ON public.leagues FOR SELECT
        USING (
          visibility = 'public'
          OR EXISTS (
            SELECT 1 FROM public.league_members lm
            WHERE lm.league_id = id AND lm.user_id = auth.uid() AND lm.status = 'active'
          )
        )
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leagues' AND policyname='Auth users can create leagues') THEN
    EXECUTE $pol$
      CREATE POLICY "Auth users can create leagues"
        ON public.leagues FOR INSERT
        WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid())
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leagues' AND policyname='Comisionado can update league') THEN
    EXECUTE $pol$
      CREATE POLICY "Comisionado can update league"
        ON public.leagues FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.league_members lm
            WHERE lm.league_id = id AND lm.user_id = auth.uid() AND lm.role = 'comisionado'
          )
        )
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leagues' AND policyname='Comisionado can delete league') THEN
    EXECUTE $pol$
      CREATE POLICY "Comisionado can delete league"
        ON public.leagues FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.league_members lm
            WHERE lm.league_id = id AND lm.user_id = auth.uid() AND lm.role = 'comisionado'
          )
        )
    $pol$;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 5. PICKS TABLE
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.picks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  race_id        UUID        NOT NULL REFERENCES public.races(id)    ON DELETE CASCADE,
  pick_type      TEXT        NOT NULL
    CHECK (pick_type IN ('pole','winner','p2','p3','fastest_lap','dnf')),
  picked_value   TEXT        NOT NULL,
  is_correct     BOOLEAN,
  points_earned  INT,
  is_double_down BOOLEAN     NOT NULL DEFAULT FALSE,
  is_substitute  BOOLEAN     NOT NULL DEFAULT FALSE,
  bet_amount     INT         CHECK (bet_amount BETWEEN 1 AND 20),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, race_id, pick_type)
);

CREATE INDEX IF NOT EXISTS picks_user_race_idx ON public.picks (user_id, race_id);
CREATE INDEX IF NOT EXISTS picks_race_idx      ON public.picks (race_id);
CREATE INDEX IF NOT EXISTS picks_user_idx      ON public.picks (user_id);

CREATE OR REPLACE FUNCTION public.set_picks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS picks_updated_at_trigger ON public.picks;
CREATE TRIGGER picks_updated_at_trigger
  BEFORE UPDATE ON public.picks
  FOR EACH ROW EXECUTE FUNCTION public.set_picks_updated_at();

ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='picks' AND policyname='Users read own picks') THEN
    EXECUTE $pol$
      CREATE POLICY "Users read own picks"
        ON public.picks FOR SELECT
        USING (auth.uid() = user_id)
    $pol$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='picks' AND policyname='Users write own picks before lock') THEN
    EXECUTE $pol$
      CREATE POLICY "Users write own picks before lock"
        ON public.picks FOR INSERT
        WITH CHECK (
          auth.uid() = user_id
          AND EXISTS (SELECT 1 FROM public.races r WHERE r.id = race_id AND r.lock_time > NOW())
        )
    $pol$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='picks' AND policyname='Users update own picks before lock') THEN
    EXECUTE $pol$
      CREATE POLICY "Users update own picks before lock"
        ON public.picks FOR UPDATE
        USING (
          auth.uid() = user_id
          AND EXISTS (SELECT 1 FROM public.races r WHERE r.id = race_id AND r.lock_time > NOW())
        )
    $pol$;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 6. LEAGUE_DRAFTS + BRACKETS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_drafts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID        NOT NULL REFERENCES public.leagues(id)  ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_id    TEXT        NOT NULL,
  draft_round  INT         NOT NULL DEFAULT 1,
  draft_order  INT         NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, user_id, driver_id)
);

CREATE INDEX IF NOT EXISTS league_drafts_league_idx ON public.league_drafts (league_id);

ALTER TABLE public.league_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='league_drafts' AND policyname='League members read drafts') THEN
    EXECUTE $pol$
      CREATE POLICY "League members read drafts"
        ON public.league_drafts FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.league_members lm
            WHERE lm.league_id = league_id AND lm.user_id = auth.uid() AND lm.status = 'active'
          )
        )
    $pol$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.brackets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id         UUID        NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  round             INT         NOT NULL,
  race_id           UUID        REFERENCES public.races(id),
  player_a          UUID        REFERENCES public.profiles(id),
  player_b          UUID        REFERENCES public.profiles(id),
  winner            UUID        REFERENCES public.profiles(id),
  is_losers_bracket BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brackets_league_idx ON public.brackets (league_id);

ALTER TABLE public.brackets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='brackets' AND policyname='League members read brackets') THEN
    EXECUTE $pol$
      CREATE POLICY "League members read brackets"
        ON public.brackets FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.league_members lm
            WHERE lm.league_id = league_id AND lm.user_id = auth.uid() AND lm.status = 'active'
          )
        )
    $pol$;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 7. USER_AI_INSIGHTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_ai_insights (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  race_id      UUID        REFERENCES public.races(id),
  insight_type TEXT        NOT NULL
    CHECK (insight_type IN ('post_race', 'pre_race', 'monthly')),
  content      TEXT        NOT NULL,
  race_name    TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_ai_insights_user_type_idx ON public.user_ai_insights (user_id, insight_type);
CREATE INDEX IF NOT EXISTS user_ai_insights_user_time_idx ON public.user_ai_insights (user_id, generated_at DESC);

ALTER TABLE public.user_ai_insights ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_ai_insights' AND policyname='Users read own insights') THEN
    EXECUTE $pol$
      CREATE POLICY "Users read own insights"
        ON public.user_ai_insights FOR SELECT
        USING (auth.uid() = user_id)
    $pol$;
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 8. STINT PRO COMMUNITY LEAGUE SEED
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_system_user_id UUID;
BEGIN
  SELECT id INTO v_system_user_id
  FROM public.profiles
  WHERE username = 'stint_system'
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    INSERT INTO public.profiles (username, points, avatar_color)
    VALUES ('stint_system', 0, 'ember')
    ON CONFLICT (username) DO NOTHING
    RETURNING id INTO v_system_user_id;

    IF v_system_user_id IS NULL THEN
      SELECT id INTO v_system_user_id FROM public.profiles WHERE username = 'stint_system';
    END IF;
  END IF;

  IF v_system_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.leagues WHERE type = 'pro_community'
  ) THEN
    INSERT INTO public.leagues (
      name, owner_id, type, game_mode, visibility,
      is_public, season, is_active, settings
    ) VALUES (
      'Stint Pro Community',
      v_system_user_id,
      'pro_community',
      'standard',
      'public',
      true,
      2026,
      true,
      '{
        "allow_new_members": true,
        "sprint_multiplier": 0.5,
        "pick_weights": {"pole":1,"winner":2,"p2":1,"p3":1,"fastest_lap":1,"dnf":1},
        "tiebreaker_order": ["most_correct","best_single_race","head_to_head","earliest_joined"],
        "announcement": "Welcome to the Stint Pro Community League."
      }'::jsonb
    );
  END IF;
END $$;
