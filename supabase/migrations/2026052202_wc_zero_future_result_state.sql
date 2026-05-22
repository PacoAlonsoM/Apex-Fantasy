-- ============================================================
-- WC 2026 pre-tournament zero standings guard
-- Clears any mock/staging result data for matches that have not kicked off
-- yet so group tables, leaderboards, and picks start from zero.
-- ============================================================

with reset_matches as (
  update public.wc_matches
  set
    home_score = null,
    away_score = null,
    winner_team_code = null,
    scorers = null,
    status = 'scheduled',
    updated_at = timezone('utc', now())
  where kickoff_at > timezone('utc', now())
    and (
      status <> 'scheduled'
      or home_score is not null
      or away_score is not null
      or winner_team_code is not null
      or scorers is not null
    )
  returning id
),
reset_match_picks as (
  update public.wc_match_predictions prediction
  set
    points = null,
    score_breakdown = '[]'::jsonb,
    updated_at = timezone('utc', now())
  from reset_matches match
  where prediction.match_id = match.id
  returning prediction.id
),
reset_survivor_picks as (
  update public.wc_survivor_picks pick
  set
    status = 'pending',
    points = null,
    updated_at = timezone('utc', now())
  from reset_matches match
  where pick.match_id = match.id
  returning pick.id
)
insert into public.wc_score_runs (operation_type, status, message, counts)
select
  'future-result-zero',
  'ok',
  'Cleared future WC result data so standings start from zero.',
  jsonb_build_object(
    'matches_reset', (select count(*) from reset_matches),
    'match_picks_reset', (select count(*) from reset_match_picks),
    'survivor_picks_reset', (select count(*) from reset_survivor_picks)
  );
