-- ============================================================
-- Pro game system: league_drafts + brackets tables
-- For Draft and Head-to-Head Bracket game modes respectively.
-- ============================================================

-- 1. league_drafts (Draft game mode)
CREATE TABLE IF NOT EXISTS public.league_drafts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID        NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_id    TEXT        NOT NULL,     -- driver identifier / name
  draft_round  INT         NOT NULL,     -- 1 or 2 for a 2-round snake draft
  draft_order  INT         NOT NULL,     -- position in that round's pick order
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, user_id, driver_id)
);

CREATE INDEX IF NOT EXISTS league_drafts_league_idx ON public.league_drafts (league_id);
CREATE INDEX IF NOT EXISTS league_drafts_user_idx   ON public.league_drafts (user_id);

ALTER TABLE public.league_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='league_drafts' AND policyname='League members can read drafts') THEN
    EXECUTE $pol$
      CREATE POLICY "League members can read drafts"
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

-- 2. brackets (Head-to-Head Bracket game mode)
CREATE TABLE IF NOT EXISTS public.brackets (
  id                 UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id          UUID     NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  round              INT      NOT NULL,
  race_id            UUID     REFERENCES public.races(id),
  player_a           UUID     NOT NULL REFERENCES public.profiles(id),
  player_b           UUID     NOT NULL REFERENCES public.profiles(id),
  winner             UUID     REFERENCES public.profiles(id),
  is_losers_bracket  BOOLEAN  NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brackets_league_idx ON public.brackets (league_id);
CREATE INDEX IF NOT EXISTS brackets_race_idx   ON public.brackets (race_id);

ALTER TABLE public.brackets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='brackets' AND policyname='League members can read brackets') THEN
    EXECUTE $pol$
      CREATE POLICY "League members can read brackets"
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
