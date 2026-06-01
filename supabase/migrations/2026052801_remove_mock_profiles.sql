-- Remove mock/demo profile data that was used for early community testing.
--
-- Targets only:
-- - auth users with @stint.community emails created by seed-fake-community
-- - legacy mock Pro profile usernames from 20260410_mock_pro_users.sql, but
--   only when the profile is not attached to a real auth user.

create temp table _mock_profile_ids on commit drop as
select u.id
from auth.users u
where u.email ilike '%@stint.community'
union
select p.id
from public.profiles p
where p.username in (
  'grid_racer_hk',
  'pitwall_pro',
  'apexhunter_v',
  'tyre_whisperer',
  'overcut_king',
  'drs_zone_r',
  'stint_veteran',
  'paddock_analyst',
  'lauda_line',
  'box_box_bella'
)
and not exists (
  select 1
  from auth.users u
  where u.id = p.id
    and u.email not ilike '%@stint.community'
);

create temp table _mock_league_ids on commit drop as
select l.id
from public.leagues l
where l.owner_id in (select id from _mock_profile_ids);

create temp table _mock_wc_league_ids on commit drop as
select l.id
from public.wc_leagues l
where l.owner_id in (select id from _mock_profile_ids);

create temp table _mock_post_ids on commit drop as
select p.id
from public.posts p
where p.author_id in (select id from _mock_profile_ids)
   or p.league_id in (select id from _mock_league_ids);

delete from public.comments
where author_id in (select id from _mock_profile_ids)
   or post_id in (select id from _mock_post_ids);

delete from public.posts
where id in (select id from _mock_post_ids);

delete from public.predictions
where user_id in (select id from _mock_profile_ids);

delete from public.picks
where user_id in (select id from _mock_profile_ids);

delete from public.league_drafts
where user_id in (select id from _mock_profile_ids);

delete from public.brackets
where player_a in (select id from _mock_profile_ids)
   or player_b in (select id from _mock_profile_ids)
   or winner in (select id from _mock_profile_ids);

delete from public.user_ai_insights
where user_id in (select id from _mock_profile_ids);

delete from public.league_members
where user_id in (select id from _mock_profile_ids)
   or league_id in (select id from _mock_league_ids);

delete from public.leagues
where id in (select id from _mock_league_ids);

delete from public.wc_match_predictions
where user_id in (select id from _mock_profile_ids);

delete from public.wc_bracket_predictions
where user_id in (select id from _mock_profile_ids);

delete from public.wc_survivor_picks
where user_id in (select id from _mock_profile_ids);

delete from public.wc_league_members
where user_id in (select id from _mock_profile_ids)
   or league_id in (select id from _mock_wc_league_ids);

delete from public.wc_leagues
where id in (select id from _mock_wc_league_ids);

delete from public.profiles
where id in (select id from _mock_profile_ids);

delete from auth.one_time_tokens
where user_id in (select id from _mock_profile_ids);

delete from auth.mfa_factors
where user_id in (select id from _mock_profile_ids);

delete from auth.sessions
where user_id in (select id from _mock_profile_ids);

delete from auth.refresh_tokens
where user_id in (select id::text from _mock_profile_ids);

delete from auth.identities
where user_id in (select id from _mock_profile_ids);

delete from auth.flow_state
where user_id in (select id from _mock_profile_ids)
   or linking_target_id in (select id from _mock_profile_ids);

delete from auth.users
where id in (select id from _mock_profile_ids)
  and email ilike '%@stint.community';
