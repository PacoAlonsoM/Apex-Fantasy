-- ============================================================
-- Pro game system: picks table
-- Individual per-pick rows for Pro league game modes.
-- Separate from the existing `predictions` table (which stores
-- picks as a JSONB blob per race, per user — that system stays
-- unchanged).  This table drives game-mode scoring.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.picks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  race_id        UUID        NOT NULL REFERENCES public.races(id)    ON DELETE CASCADE,
  pick_type      TEXT        NOT NULL
    CHECK (pick_type IN ('pole','winner','p2','p3','fastest_lap','dnf')),
  picked_value   TEXT        NOT NULL,
  is_correct     BOOLEAN,                -- NULL until results scored
  points_earned  INT,                    -- NULL until scored
  is_double_down BOOLEAN     NOT NULL DEFAULT FALSE,   -- Double Down mode
  is_substitute  BOOLEAN     NOT NULL DEFAULT FALSE,   -- Draft mode substitute
  bet_amount     INT         CHECK (bet_amount BETWEEN 1 AND 20), -- Budget Picks mode
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, race_id, pick_type)
);

CREATE INDEX IF NOT EXISTS picks_user_race_idx  ON public.picks (user_id, race_id);
CREATE INDEX IF NOT EXISTS picks_race_idx       ON public.picks (race_id);
CREATE INDEX IF NOT EXISTS picks_user_idx       ON public.picks (user_id);

-- updated_at trigger
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

-- RLS
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Users read their own picks; after lock all league members can read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='picks' AND policyname='Users read own picks') THEN
    EXECUTE $pol$
      CREATE POLICY "Users read own picks"
        ON public.picks FOR SELECT
        USING (
          auth.uid() = user_id
          OR EXISTS (
            SELECT 1
            FROM public.races r
            WHERE r.id = race_id AND r.lock_time < NOW()
              AND EXISTS (
                SELECT 1 FROM public.league_members lm
                WHERE lm.user_id = auth.uid() AND lm.status = 'active'
                  AND EXISTS (
                    SELECT 1 FROM public.league_members lm2
                    WHERE lm2.league_id = lm.league_id
                      AND lm2.user_id = picks.user_id
                      AND lm2.status = 'active'
                  )
              )
          )
        )
    $pol$;
  END IF;

  -- Users insert/update their own picks only before lock
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='picks' AND policyname='Users write own picks before lock') THEN
    EXECUTE $pol$
      CREATE POLICY "Users write own picks before lock"
        ON public.picks FOR INSERT
        WITH CHECK (
          auth.uid() = user_id
          AND EXISTS (
            SELECT 1 FROM public.races r WHERE r.id = race_id AND r.lock_time > NOW()
          )
        )
    $pol$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='picks' AND policyname='Users update own picks before lock') THEN
    EXECUTE $pol$
      CREATE POLICY "Users update own picks before lock"
        ON public.picks FOR UPDATE
        USING (
          auth.uid() = user_id
          AND EXISTS (
            SELECT 1 FROM public.races r WHERE r.id = race_id AND r.lock_time > NOW()
          )
        )
    $pol$;
  END IF;
END $$;
