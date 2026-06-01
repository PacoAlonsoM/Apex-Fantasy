-- ============================================================
-- Seed: Stint Community League (free, open to everyone)
--
-- Mirrors the Pro Community League pattern (type='pro_community')
-- but uses type='community' and is open to free + Pro users alike.
-- Auto-enrols every new profile via a trigger; backfills all
-- existing profiles on first run.
--
-- Owner resolution (in order):
--   1. existing 'stint_system' profile (if Pro Community was seeded)
--   2. owner of the existing Pro Community league
--   3. first profile in the table (any real user) — placeholder only
-- profiles.id is not gen-defaulted because it's normally seeded
-- from auth.users.id; we never try to INSERT a new profile here.
-- ============================================================

-- Extend the leagues.type CHECK constraint to allow 'community'.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.leagues'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%pro_community%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.leagues DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.leagues
  DROP CONSTRAINT IF EXISTS leagues_type_check;

ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_type_check
  CHECK (type IN ('standard', 'pro_community', 'community'));

DO $$
DECLARE
  v_system_user_id UUID;
  v_league_id      UUID;
BEGIN
  -- 1. Try to find an existing 'stint_system' profile
  SELECT id INTO v_system_user_id
  FROM public.profiles
  WHERE username = 'stint_system'
  LIMIT 1;

  -- 2. Fallback: reuse the Pro Community league owner if available
  IF v_system_user_id IS NULL THEN
    SELECT owner_id INTO v_system_user_id
    FROM public.leagues
    WHERE type = 'pro_community'
    LIMIT 1;
  END IF;

  -- 3. Last resort: pick the oldest profile as the placeholder owner.
  -- This row is never user-facing as an owner — owner_id is required
  -- by FK but the league treats itself as system-owned in code.
  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id
    FROM public.profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Create the Stint Community league (idempotent)
  IF v_system_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.leagues WHERE type = 'community'
  ) THEN
    INSERT INTO public.leagues (
      name,
      code,
      owner_id,
      type,
      game_mode,
      visibility,
      is_public,
      season,
      is_active,
      settings
    ) VALUES (
      'Stint Community',
      'STINT',
      v_system_user_id,
      'community',
      'standard',
      'public',
      true,
      2026,
      true,
      '{
        "double_points_races": [],
        "sprint_multiplier": 0.5,
        "pick_weights": {"pole":1,"winner":2,"p2":1,"p3":1,"fastest_lap":1,"dnf":1},
        "tiebreaker_order": ["most_correct","best_single_race","head_to_head","earliest_joined"],
        "late_joiner_cutoff_round": 24,
        "late_joiner_handicap_points": 0,
        "allow_new_members": true,
        "announcement": "Welcome to Stint Community. Everyone competes here, free and Pro. No invite needed."
      }'::jsonb
    );
  END IF;

  SELECT id INTO v_league_id FROM public.leagues WHERE type = 'community' LIMIT 1;

  -- Backfill: enrol every existing profile
  IF v_league_id IS NOT NULL THEN
    INSERT INTO public.league_members (league_id, user_id, role, status, joined_at)
    SELECT v_league_id, p.id, 'member', 'active', NOW()
    FROM public.profiles p
    ON CONFLICT (league_id, user_id) DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Auto-enrol every new profile in the Community league
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enrol_new_profile_in_community_league()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_league_id UUID;
BEGIN
  SELECT id INTO v_league_id FROM public.leagues WHERE type = 'community' LIMIT 1;

  IF v_league_id IS NOT NULL THEN
    INSERT INTO public.league_members (league_id, user_id, role, status, joined_at)
    VALUES (v_league_id, NEW.id, 'member', 'active', NOW())
    ON CONFLICT (league_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_community_league_trigger ON public.profiles;
CREATE TRIGGER profiles_community_league_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enrol_new_profile_in_community_league();
