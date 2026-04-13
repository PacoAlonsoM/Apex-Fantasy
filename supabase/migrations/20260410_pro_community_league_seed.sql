-- ============================================================
-- Seed: Stint Pro Community League
-- Creates the shared Pro league that all Pro subscribers are
-- auto-enrolled in via the Stripe webhook handler.
--
-- NOTE: This migration uses a DO block so it's idempotent.
-- The system user and league are only inserted if absent.
--
-- The system user email is system@stint-web.com — create this
-- user in Supabase Auth manually (or via the admin panel) before
-- running this migration. The migration will succeed without it
-- but the league created_by will be NULL until backfilled.
-- ============================================================

DO $$
DECLARE
  v_system_user_id UUID;
  v_league_id UUID;
BEGIN
  -- Look up the system user by email if it exists
  SELECT id INTO v_system_user_id
  FROM public.profiles
  WHERE username = 'stint_system'
  LIMIT 1;

  -- Create a placeholder profile row if system user doesn't exist yet
  -- (The auth user should be created separately in Supabase Auth)
  IF v_system_user_id IS NULL THEN
    INSERT INTO public.profiles (username, points, avatar_color)
    VALUES ('stint_system', 0, 'ember')
    ON CONFLICT (username) DO NOTHING
    RETURNING id INTO v_system_user_id;

    -- If still null (conflict on username), get it
    IF v_system_user_id IS NULL THEN
      SELECT id INTO v_system_user_id FROM public.profiles WHERE username = 'stint_system';
    END IF;
  END IF;

  -- Only create the Pro Community League if it doesn't exist
  IF v_system_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.leagues WHERE type = 'pro_community'
  ) THEN
    INSERT INTO public.leagues (
      name,
      owner_id,
      type,
      game_mode,
      visibility,
      is_public,
      season,
      is_active,
      settings
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
        "double_points_races": [],
        "sprint_multiplier": 0.5,
        "pick_weights": {"pole":1,"winner":2,"p2":1,"p3":1,"fastest_lap":1,"dnf":1},
        "tiebreaker_order": ["most_correct","best_single_race","head_to_head","earliest_joined"],
        "late_joiner_cutoff_round": 24,
        "late_joiner_handicap_points": 0,
        "allow_new_members": true,
        "elimination_starts_round": 3,
        "announcement": "Welcome to the Stint Pro Community League. Compete against every Pro subscriber across the full season."
      }'::jsonb
    );
  END IF;
END $$;
