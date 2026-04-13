-- ============================================================
-- Pro game system: extend leagues + league_members tables
--
-- The existing leagues table has: id, name, code, owner_id, is_public
-- The existing league_members table has: id, league_id, user_id
--
-- This migration adds Pro-only columns to both without touching
-- any existing data. All new columns have safe defaults.
--
-- Mapping notes:
--   owner_id  → used as-is (spec calls it created_by, we keep owner_id)
--   code      → used as invite_code (spec calls it invite_code)
--   is_public → preserved; visibility column added separately for granularity
--
-- settings JSONB structure:
-- {
--   "double_points_races":    [],
--   "sprint_multiplier":      0.5,
--   "pick_weights":           { "pole":1, "winner":2, "p2":1, "p3":1, "fastest_lap":1, "dnf":1 },
--   "tiebreaker_order":       ["most_correct","best_single_race","head_to_head","earliest_joined"],
--   "late_joiner_cutoff_round":   5,
--   "late_joiner_handicap_points": 0,
--   "allow_new_members":      true,
--   "elimination_starts_round": 3,
--   "announcement":           null
-- }
-- ============================================================

-- 1. Extend leagues
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

-- Migrate existing is_public values into visibility column
UPDATE public.leagues
  SET visibility = CASE WHEN is_public THEN 'public' ELSE 'private' END
  WHERE visibility = 'private';  -- only rows not yet touched

CREATE INDEX IF NOT EXISTS leagues_type_idx       ON public.leagues (type);
CREATE INDEX IF NOT EXISTS leagues_game_mode_idx  ON public.leagues (game_mode);
CREATE INDEX IF NOT EXISTS leagues_visibility_idx ON public.leagues (visibility) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS leagues_season_idx     ON public.leagues (season);

-- 2. Extend league_members
ALTER TABLE public.league_members
  ADD COLUMN IF NOT EXISTS role                   TEXT    NOT NULL DEFAULT 'member'
    CHECK (role IN ('comisionado', 'member')),
  ADD COLUMN IF NOT EXISTS status                 TEXT    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'eliminated', 'banned', 'removed')),
  ADD COLUMN IF NOT EXISTS eliminated_at_race_id  UUID    REFERENCES public.races(id),
  ADD COLUMN IF NOT EXISTS handicap_points        INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS joined_at              TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill: league owners become comisionados
UPDATE public.league_members lm
  SET role = 'comisionado'
  FROM public.leagues l
  WHERE lm.league_id = l.id
    AND lm.user_id = l.owner_id
    AND lm.role = 'member';

CREATE INDEX IF NOT EXISTS league_members_status_idx ON public.league_members (status);
CREATE INDEX IF NOT EXISTS league_members_role_idx   ON public.league_members (role);

-- 3. RLS additions for leagues
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT: member leagues + all public leagues
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

  -- INSERT: any authenticated user
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leagues' AND policyname='Auth users can create leagues') THEN
    EXECUTE $pol$
      CREATE POLICY "Auth users can create leagues"
        ON public.leagues FOR INSERT
        WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid())
    $pol$;
  END IF;

  -- UPDATE: comisionado only
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

  -- DELETE: comisionado only
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

-- 4. RLS for league_members
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT: see members of leagues you belong to
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='league_members' AND policyname='Members can see league members') THEN
    EXECUTE $pol$
      CREATE POLICY "Members can see league members"
        ON public.league_members FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.league_members self
            WHERE self.league_id = league_id AND self.user_id = auth.uid() AND self.status = 'active'
          )
        )
    $pol$;
  END IF;

  -- INSERT: any auth user (invite code validated in application logic)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='league_members' AND policyname='Auth users can join leagues') THEN
    EXECUTE $pol$
      CREATE POLICY "Auth users can join leagues"
        ON public.league_members FOR INSERT
        WITH CHECK (auth.uid() = user_id)
    $pol$;
  END IF;

  -- UPDATE: comisionado or the member themselves
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='league_members' AND policyname='Comisionado or self can update membership') THEN
    EXECUTE $pol$
      CREATE POLICY "Comisionado or self can update membership"
        ON public.league_members FOR UPDATE
        USING (
          auth.uid() = user_id
          OR EXISTS (
            SELECT 1 FROM public.league_members com
            WHERE com.league_id = league_id AND com.user_id = auth.uid() AND com.role = 'comisionado'
          )
        )
    $pol$;
  END IF;

  -- DELETE: comisionado or self (to leave)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='league_members' AND policyname='Comisionado or self can remove membership') THEN
    EXECUTE $pol$
      CREATE POLICY "Comisionado or self can remove membership"
        ON public.league_members FOR DELETE
        USING (
          auth.uid() = user_id
          OR EXISTS (
            SELECT 1 FROM public.league_members com
            WHERE com.league_id = league_id AND com.user_id = auth.uid() AND com.role = 'comisionado'
          )
        )
    $pol$;
  END IF;
END $$;
