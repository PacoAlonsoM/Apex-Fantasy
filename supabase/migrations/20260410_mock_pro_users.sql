-- ============================================================
-- Seed: 10 Mock Pro Users for visual testing
-- Creates placeholder profiles with subscription_status='pro'
-- and auto-enrolls them in the Pro Community League.
--
-- Safe to run multiple times (idempotent via ON CONFLICT).
-- ============================================================

DO $$
DECLARE
  v_league_id UUID;
  v_user_id   UUID;
  mock_users  TEXT[][] := ARRAY[
    ARRAY['grid_racer_hk',   'gold',   '2420'],
    ARRAY['pitwall_pro',     'ocean',  '2195'],
    ARRAY['apexhunter_v',    'ember',  '1988'],
    ARRAY['tyre_whisperer',  'steel',  '1876'],
    ARRAY['overcut_king',    'teal',   '1754'],
    ARRAY['drs_zone_r',      'violet', '1612'],
    ARRAY['stint_veteran',   'gold',   '1540'],
    ARRAY['paddock_analyst', 'ocean',  '1433'],
    ARRAY['lauda_line',      'ember',  '1381'],
    ARRAY['box_box_bella',   'steel',  '1290']
  ];
  pair TEXT[];
BEGIN
  -- Get Pro Community League id
  SELECT id INTO v_league_id FROM public.leagues WHERE type = 'pro_community' LIMIT 1;

  FOREACH pair SLICE 1 IN ARRAY mock_users
  LOOP
    -- Upsert profile
    INSERT INTO public.profiles (id, username, avatar_color, points, subscription_status)
    VALUES (gen_random_uuid(), pair[1], pair[2], pair[3]::int, 'pro')
    ON CONFLICT (username) DO UPDATE
      SET subscription_status = 'pro',
          points = GREATEST(public.profiles.points, pair[3]::int);

    -- Get their id
    SELECT id INTO v_user_id FROM public.profiles WHERE username = pair[1];

    -- Enroll in Pro Community League if it exists
    IF v_league_id IS NOT NULL AND v_user_id IS NOT NULL THEN
      INSERT INTO public.league_members (league_id, user_id)
      VALUES (v_league_id, v_user_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
