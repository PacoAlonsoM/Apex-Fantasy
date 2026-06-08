-- Repair missing standard-league score rows.
--
-- Standard leagues should never mix per-league score rows for one member with
-- global profile totals for another member. When a standard league has no
-- league-specific submission for an already-scored round, use the user's
-- standard prediction score as the league score for that round.

insert into public.league_round_scores (
  league_id,
  user_id,
  race_round,
  score,
  breakdown,
  game_mode,
  computed_at
)
select
  lm.league_id,
  p.user_id,
  p.race_round,
  coalesce(p.score, 0)::integer,
  coalesce(p.score_breakdown, '[]'::jsonb),
  'standard',
  timezone('utc', now())
from public.predictions p
join public.race_results rr
  on rr.race_round = p.race_round
  and rr.results_entered = true
join public.league_members lm
  on lm.user_id = p.user_id
  and lm.status in ('active', 'eliminated')
join public.leagues l
  on l.id = lm.league_id
  and coalesce(l.game_mode, 'standard') = 'standard'
where p.score is not null
on conflict (league_id, user_id, race_round)
do nothing;
