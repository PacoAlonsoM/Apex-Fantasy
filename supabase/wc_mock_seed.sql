-- WC mock backend data for product testing.
-- Safe to rerun. Only touches wc_ tables.

do $$
declare
  users uuid[];
  public_league_id uuid;
  private_league_id uuid;
  idx integer;
begin
  select array_agg(id order by created_at asc nulls last)
  into users
  from (
    select id, created_at
    from public.profiles
    order by created_at asc nulls last
    limit 6
  ) profile_rows;

  if coalesce(array_length(users, 1), 0) = 0 then
    raise notice 'WC mock seed skipped: no profiles exist.';
    return;
  end if;

  update public.wc_matches as match
  set
    home_score = result.home_score,
    away_score = result.away_score,
    winner_team_code = result.winner_team_code,
    status = 'completed',
    source_note = 'WC mock result seed for product testing. Replace before live tournament use.',
    updated_at = timezone('utc', now())
  from (
    values
      (1, 2, 1, 'MEX'),
      (2, 1, 1, null),
      (3, 2, 0, 'CAN'),
      (4, 0, 2, 'SUI'),
      (5, 3, 1, 'BRA'),
      (6, 0, 1, 'SCO'),
      (7, 2, 1, 'USA'),
      (8, 1, 2, 'TUR')
  ) as result(match_number, home_score, away_score, winner_team_code)
  where match.match_number = result.match_number;

  insert into public.wc_leagues (owner_id, name, code, visibility, settings)
  values (
    users[1],
    'STINT WC Mock Room',
    'WC2026',
    'public',
    '{"mock": true, "description": "Shared public room for WC product testing."}'::jsonb
  )
  on conflict (code) do update set
    owner_id = excluded.owner_id,
    name = excluded.name,
    visibility = excluded.visibility,
    settings = excluded.settings,
    updated_at = timezone('utc', now())
  returning id into public_league_id;

  insert into public.wc_leagues (owner_id, name, code, visibility, settings)
  values (
    users[1],
    'Ugga WC Room',
    'UGGA26',
    'private',
    '{"mock": true, "description": "Private mock room to test join-code flow."}'::jsonb
  )
  on conflict (code) do update set
    owner_id = excluded.owner_id,
    name = excluded.name,
    visibility = excluded.visibility,
    settings = excluded.settings,
    updated_at = timezone('utc', now())
  returning id into private_league_id;

  for idx in 1..coalesce(array_length(users, 1), 0) loop
    insert into public.wc_league_members (league_id, user_id, role)
    values (public_league_id, users[idx], case when idx = 1 then 'owner' else 'member' end)
    on conflict (league_id, user_id) do update set role = excluded.role;

    if idx <= 3 then
      insert into public.wc_league_members (league_id, user_id, role)
      values (private_league_id, users[idx], case when idx = 1 then 'owner' else 'member' end)
      on conflict (league_id, user_id) do update set role = excluded.role;
    end if;
  end loop;

  insert into public.wc_match_predictions (
    user_id,
    match_id,
    predicted_home_score,
    predicted_away_score,
    predicted_winner_team_code,
    points,
    score_breakdown
  )
  select
    users[pick.user_index],
    match.id,
    pick.predicted_home_score,
    pick.predicted_away_score,
    null,
    pick.points,
    pick.score_breakdown::jsonb
  from (
    values
      (1, 1, 2, 1, 5, '[{"label":"Exact score","pts":5}]'),
      (1, 2, 2, 1, 0, '[]'),
      (1, 3, 2, 0, 5, '[{"label":"Exact score","pts":5}]'),
      (1, 4, 1, 2, 3, '[{"label":"Correct outcome","pts":3}]'),
      (1, 5, 3, 1, 5, '[{"label":"Exact score","pts":5}]'),
      (1, 6, 0, 1, 5, '[{"label":"Exact score","pts":5}]'),
      (1, 7, 1, 0, 4, '[{"label":"Outcome plus goal difference","pts":4}]'),
      (1, 8, 1, 2, 5, '[{"label":"Exact score","pts":5}]'),
      (2, 1, 1, 1, 0, '[]'),
      (2, 2, 1, 1, 5, '[{"label":"Exact score","pts":5}]'),
      (2, 3, 1, 0, 4, '[{"label":"Outcome plus goal difference","pts":4}]'),
      (2, 4, 0, 1, 4, '[{"label":"Outcome plus goal difference","pts":4}]'),
      (2, 5, 2, 1, 4, '[{"label":"Outcome plus goal difference","pts":4}]'),
      (2, 6, 1, 1, 0, '[]'),
      (2, 7, 2, 1, 5, '[{"label":"Exact score","pts":5}]'),
      (2, 8, 1, 1, 0, '[]'),
      (3, 1, 3, 1, 4, '[{"label":"Outcome plus goal difference","pts":4}]'),
      (3, 2, 0, 0, 4, '[{"label":"Outcome plus goal difference","pts":4}]'),
      (3, 3, 2, 1, 3, '[{"label":"Correct outcome","pts":3}]'),
      (3, 4, 1, 3, 4, '[{"label":"Outcome plus goal difference","pts":4}]'),
      (3, 5, 2, 0, 4, '[{"label":"Outcome plus goal difference","pts":4}]'),
      (3, 6, 0, 2, 3, '[{"label":"Correct outcome","pts":3}]'),
      (3, 7, 1, 1, 0, '[]'),
      (3, 8, 0, 1, 4, '[{"label":"Outcome plus goal difference","pts":4}]'),
      (4, 1, 2, 0, 3, '[{"label":"Correct outcome","pts":3}]'),
      (4, 2, 1, 0, 0, '[]'),
      (4, 3, 1, 1, 0, '[]'),
      (4, 4, 0, 2, 5, '[{"label":"Exact score","pts":5}]'),
      (4, 5, 1, 0, 3, '[{"label":"Correct outcome","pts":3}]'),
      (4, 6, 0, 0, 0, '[]'),
      (4, 7, 3, 1, 3, '[{"label":"Correct outcome","pts":3}]'),
      (4, 8, 1, 3, 4, '[{"label":"Outcome plus goal difference","pts":4}]')
  ) as pick(user_index, match_number, predicted_home_score, predicted_away_score, points, score_breakdown)
  join public.wc_matches match on match.match_number = pick.match_number
  where users[pick.user_index] is not null
  on conflict (user_id, match_id) do update set
    predicted_home_score = excluded.predicted_home_score,
    predicted_away_score = excluded.predicted_away_score,
    predicted_winner_team_code = excluded.predicted_winner_team_code,
    points = excluded.points,
    score_breakdown = excluded.score_breakdown,
    updated_at = timezone('utc', now());

  insert into public.wc_bracket_predictions (user_id, picks, points, score_breakdown)
  select
    users[bracket.user_index],
    bracket.picks::jsonb,
    bracket.points,
    bracket.score_breakdown::jsonb
  from (
    values
      (1, '{"groupWinners":{"A":"MEX","B":"CAN","C":"BRA","D":"USA"},"groupRunnersUp":{"A":"KOR","B":"SUI","C":"MAR","D":"PAR"},"champion":"BRA","goldenBoot":"Kylian Mbappe","goldenBall":"Vinicius Junior"}', 14, '[{"label":"Mock bracket seed","pts":14}]'),
      (2, '{"groupWinners":{"A":"MEX","B":"SUI","C":"BRA","D":"USA"},"groupRunnersUp":{"A":"RSA","B":"CAN","C":"SCO","D":"TUR"},"champion":"ARG","goldenBoot":"Erling Haaland","goldenBall":"Lionel Messi"}', 10, '[{"label":"Mock bracket seed","pts":10}]'),
      (3, '{"groupWinners":{"A":"KOR","B":"CAN","C":"MAR","D":"USA"},"groupRunnersUp":{"A":"MEX","B":"SUI","C":"BRA","D":"AUS"},"champion":"FRA","goldenBoot":"Kylian Mbappe","goldenBall":"Jude Bellingham"}', 8, '[{"label":"Mock bracket seed","pts":8}]'),
      (4, '{"groupWinners":{"A":"MEX","B":"SUI","C":"BRA","D":"PAR"},"groupRunnersUp":{"A":"CZE","B":"CAN","C":"MAR","D":"USA"},"champion":"ENG","goldenBoot":"Harry Kane","goldenBall":"Bukayo Saka"}', 6, '[{"label":"Mock bracket seed","pts":6}]')
  ) as bracket(user_index, picks, points, score_breakdown)
  where users[bracket.user_index] is not null
  on conflict (user_id) do update set
    picks = excluded.picks,
    points = excluded.points,
    score_breakdown = excluded.score_breakdown,
    updated_at = timezone('utc', now());

  insert into public.wc_score_runs (operation_type, status, message, counts, metadata)
  values (
    'mock-seed',
    'ok',
    'Inserted WC mock leagues, picks, bracket picks, and sample match results.',
    jsonb_build_object(
      'users', coalesce(array_length(users, 1), 0),
      'leagues', 2,
      'matchesWithMockResults', 8
    ),
    '{"mock": true}'::jsonb
  );
end $$;
