-- ============================================================
-- WC 2026 official fixture correction
-- Replaces the original generated placeholder schedule with the
-- official FIFA World Cup 26 match order and slots.
-- All objects remain in the removable wc_ namespace.
-- ============================================================

begin;

alter table public.wc_matches drop constraint if exists wc_matches_home_team_code_fkey;
alter table public.wc_matches drop constraint if exists wc_matches_away_team_code_fkey;
alter table public.wc_matches drop constraint if exists wc_matches_winner_team_code_fkey;
alter table public.wc_match_predictions drop constraint if exists wc_match_predictions_predicted_winner_team_code_fkey;

do $$
begin
  if to_regclass('public.wc_survivor_picks') is not null then
    execute 'alter table public.wc_survivor_picks drop constraint if exists wc_survivor_picks_picked_team_code_fkey';
    update public.wc_survivor_picks
      set picked_team_code = 'IRQ'
      where picked_team_code = 'BOL';
  end if;
end $$;

update public.wc_matches set home_team_code = 'IRQ' where home_team_code = 'BOL';
update public.wc_matches set away_team_code = 'IRQ' where away_team_code = 'BOL';
update public.wc_matches set winner_team_code = 'IRQ' where winner_team_code = 'BOL';
update public.wc_match_predictions set predicted_winner_team_code = 'IRQ' where predicted_winner_team_code = 'BOL';
update public.wc_bracket_predictions
  set picks = replace(picks::text, '"BOL"', '"IRQ"')::jsonb
  where picks::text like '%"BOL"%';

update public.wc_teams
  set code = 'IRQ', name = 'Iraq', group_code = 'I', seed_order = 3, flag = 'IQ'
  where code = 'BOL'
    and not exists (select 1 from public.wc_teams where code = 'IRQ');

delete from public.wc_teams
  where code = 'BOL'
    and exists (select 1 from public.wc_teams where code = 'IRQ');

insert into public.wc_teams (code, name, group_code, seed_order, flag) values
  ('MEX', 'Mexico', 'A', 1, 'MX'),
  ('RSA', 'South Africa', 'A', 2, 'ZA'),
  ('KOR', 'Korea Republic', 'A', 3, 'KR'),
  ('CZE', 'Czechia', 'A', 4, 'CZ'),
  ('CAN', 'Canada', 'B', 1, 'CA'),
  ('BIH', 'Bosnia and Herzegovina', 'B', 2, 'BA'),
  ('QAT', 'Qatar', 'B', 3, 'QA'),
  ('SUI', 'Switzerland', 'B', 4, 'CH'),
  ('BRA', 'Brazil', 'C', 1, 'BR'),
  ('MAR', 'Morocco', 'C', 2, 'MA'),
  ('HAI', 'Haiti', 'C', 3, 'HT'),
  ('SCO', 'Scotland', 'C', 4, 'GB-SCT'),
  ('USA', 'United States', 'D', 1, 'US'),
  ('PAR', 'Paraguay', 'D', 2, 'PY'),
  ('AUS', 'Australia', 'D', 3, 'AU'),
  ('TUR', 'Turkiye', 'D', 4, 'TR'),
  ('GER', 'Germany', 'E', 1, 'DE'),
  ('CUW', 'Curacao', 'E', 2, 'CW'),
  ('CIV', 'Cote d''Ivoire', 'E', 3, 'CI'),
  ('ECU', 'Ecuador', 'E', 4, 'EC'),
  ('NED', 'Netherlands', 'F', 1, 'NL'),
  ('JPN', 'Japan', 'F', 2, 'JP'),
  ('SWE', 'Sweden', 'F', 3, 'SE'),
  ('TUN', 'Tunisia', 'F', 4, 'TN'),
  ('BEL', 'Belgium', 'G', 1, 'BE'),
  ('EGY', 'Egypt', 'G', 2, 'EG'),
  ('IRN', 'IR Iran', 'G', 3, 'IR'),
  ('NZL', 'New Zealand', 'G', 4, 'NZ'),
  ('ESP', 'Spain', 'H', 1, 'ES'),
  ('CPV', 'Cabo Verde', 'H', 2, 'CV'),
  ('KSA', 'Saudi Arabia', 'H', 3, 'SA'),
  ('URU', 'Uruguay', 'H', 4, 'UY'),
  ('FRA', 'France', 'I', 1, 'FR'),
  ('SEN', 'Senegal', 'I', 2, 'SN'),
  ('IRQ', 'Iraq', 'I', 3, 'IQ'),
  ('NOR', 'Norway', 'I', 4, 'NO'),
  ('ARG', 'Argentina', 'J', 1, 'AR'),
  ('ALG', 'Algeria', 'J', 2, 'DZ'),
  ('AUT', 'Austria', 'J', 3, 'AT'),
  ('JOR', 'Jordan', 'J', 4, 'JO'),
  ('POR', 'Portugal', 'K', 1, 'PT'),
  ('COD', 'DR Congo', 'K', 2, 'CD'),
  ('UZB', 'Uzbekistan', 'K', 3, 'UZ'),
  ('COL', 'Colombia', 'K', 4, 'CO'),
  ('ENG', 'England', 'L', 1, 'GB-ENG'),
  ('CRO', 'Croatia', 'L', 2, 'HR'),
  ('GHA', 'Ghana', 'L', 3, 'GH'),
  ('PAN', 'Panama', 'L', 4, 'PA')
on conflict (code) do update set
  name = excluded.name,
  group_code = excluded.group_code,
  seed_order = excluded.seed_order,
  flag = excluded.flag;

with wc_fixture_rows (
  match_number, stage, group_code, home_team_code, away_team_code,
  home_label, away_label, kickoff_at, venue, city, country
) as (
  values
  (1, 'group', 'A', 'MEX', 'RSA', 'Mexico', 'South Africa', '2026-06-11T19:00:00Z', 'Estadio Azteca', 'Mexico City', 'Mexico'),
  (2, 'group', 'A', 'KOR', 'CZE', 'Korea Republic', 'Czechia', '2026-06-12T02:00:00Z', 'Estadio Akron', 'Zapopan', 'Mexico'),
  (3, 'group', 'B', 'CAN', 'BIH', 'Canada', 'Bosnia and Herzegovina', '2026-06-12T19:00:00Z', 'BMO Field', 'Toronto', 'Canada'),
  (4, 'group', 'D', 'USA', 'PAR', 'United States', 'Paraguay', '2026-06-13T01:00:00Z', 'SoFi Stadium', 'Inglewood', 'United States'),
  (5, 'group', 'C', 'HAI', 'SCO', 'Haiti', 'Scotland', '2026-06-14T01:00:00Z', 'Gillette Stadium', 'Foxborough', 'United States'),
  (6, 'group', 'D', 'AUS', 'TUR', 'Australia', 'Turkiye', '2026-06-14T04:00:00Z', 'BC Place', 'Vancouver', 'Canada'),
  (7, 'group', 'C', 'BRA', 'MAR', 'Brazil', 'Morocco', '2026-06-13T22:00:00Z', 'MetLife Stadium', 'East Rutherford', 'United States'),
  (8, 'group', 'B', 'QAT', 'SUI', 'Qatar', 'Switzerland', '2026-06-13T19:00:00Z', 'Levi''s Stadium', 'Santa Clara', 'United States'),
  (9, 'group', 'E', 'CIV', 'ECU', 'Cote d''Ivoire', 'Ecuador', '2026-06-14T23:00:00Z', 'Lincoln Financial Field', 'Philadelphia', 'United States'),
  (10, 'group', 'E', 'GER', 'CUW', 'Germany', 'Curacao', '2026-06-14T17:00:00Z', 'NRG Stadium', 'Houston', 'United States'),
  (11, 'group', 'F', 'NED', 'JPN', 'Netherlands', 'Japan', '2026-06-14T20:00:00Z', 'AT&T Stadium', 'Arlington', 'United States'),
  (12, 'group', 'F', 'SWE', 'TUN', 'Sweden', 'Tunisia', '2026-06-15T02:00:00Z', 'Estadio BBVA', 'Guadalupe', 'Mexico'),
  (13, 'group', 'H', 'KSA', 'URU', 'Saudi Arabia', 'Uruguay', '2026-06-15T22:00:00Z', 'Hard Rock Stadium', 'Miami Gardens', 'United States'),
  (14, 'group', 'H', 'ESP', 'CPV', 'Spain', 'Cabo Verde', '2026-06-15T16:00:00Z', 'Mercedes-Benz Stadium', 'Atlanta', 'United States'),
  (15, 'group', 'G', 'IRN', 'NZL', 'IR Iran', 'New Zealand', '2026-06-16T01:00:00Z', 'SoFi Stadium', 'Inglewood', 'United States'),
  (16, 'group', 'G', 'BEL', 'EGY', 'Belgium', 'Egypt', '2026-06-15T19:00:00Z', 'Lumen Field', 'Seattle', 'United States'),
  (17, 'group', 'I', 'FRA', 'SEN', 'France', 'Senegal', '2026-06-16T19:00:00Z', 'MetLife Stadium', 'East Rutherford', 'United States'),
  (18, 'group', 'I', 'IRQ', 'NOR', 'Iraq', 'Norway', '2026-06-16T22:00:00Z', 'Gillette Stadium', 'Foxborough', 'United States'),
  (19, 'group', 'J', 'ARG', 'ALG', 'Argentina', 'Algeria', '2026-06-17T01:00:00Z', 'Arrowhead Stadium', 'Kansas City', 'United States'),
  (20, 'group', 'J', 'AUT', 'JOR', 'Austria', 'Jordan', '2026-06-17T04:00:00Z', 'Levi''s Stadium', 'Santa Clara', 'United States'),
  (21, 'group', 'L', 'GHA', 'PAN', 'Ghana', 'Panama', '2026-06-17T23:00:00Z', 'BMO Field', 'Toronto', 'Canada'),
  (22, 'group', 'L', 'ENG', 'CRO', 'England', 'Croatia', '2026-06-17T20:00:00Z', 'AT&T Stadium', 'Arlington', 'United States'),
  (23, 'group', 'K', 'POR', 'COD', 'Portugal', 'DR Congo', '2026-06-17T17:00:00Z', 'NRG Stadium', 'Houston', 'United States'),
  (24, 'group', 'K', 'UZB', 'COL', 'Uzbekistan', 'Colombia', '2026-06-18T02:00:00Z', 'Estadio Azteca', 'Mexico City', 'Mexico'),
  (25, 'group', 'A', 'CZE', 'RSA', 'Czechia', 'South Africa', '2026-06-18T16:00:00Z', 'Mercedes-Benz Stadium', 'Atlanta', 'United States'),
  (26, 'group', 'B', 'SUI', 'BIH', 'Switzerland', 'Bosnia and Herzegovina', '2026-06-18T19:00:00Z', 'SoFi Stadium', 'Inglewood', 'United States'),
  (27, 'group', 'B', 'CAN', 'QAT', 'Canada', 'Qatar', '2026-06-18T22:00:00Z', 'BC Place', 'Vancouver', 'Canada'),
  (28, 'group', 'A', 'MEX', 'KOR', 'Mexico', 'Korea Republic', '2026-06-19T01:00:00Z', 'Estadio Akron', 'Zapopan', 'Mexico'),
  (29, 'group', 'C', 'BRA', 'HAI', 'Brazil', 'Haiti', '2026-06-20T00:30:00Z', 'Lincoln Financial Field', 'Philadelphia', 'United States'),
  (30, 'group', 'C', 'SCO', 'MAR', 'Scotland', 'Morocco', '2026-06-19T22:00:00Z', 'Gillette Stadium', 'Foxborough', 'United States'),
  (31, 'group', 'D', 'TUR', 'PAR', 'Turkiye', 'Paraguay', '2026-06-20T03:00:00Z', 'Levi''s Stadium', 'Santa Clara', 'United States'),
  (32, 'group', 'D', 'USA', 'AUS', 'United States', 'Australia', '2026-06-19T22:00:00Z', 'Lumen Field', 'Seattle', 'United States'),
  (33, 'group', 'E', 'GER', 'CIV', 'Germany', 'Cote d''Ivoire', '2026-06-20T20:00:00Z', 'BMO Field', 'Toronto', 'Canada'),
  (34, 'group', 'E', 'ECU', 'CUW', 'Ecuador', 'Curacao', '2026-06-21T00:00:00Z', 'Arrowhead Stadium', 'Kansas City', 'United States'),
  (35, 'group', 'F', 'NED', 'SWE', 'Netherlands', 'Sweden', '2026-06-20T17:00:00Z', 'NRG Stadium', 'Houston', 'United States'),
  (36, 'group', 'F', 'TUN', 'JPN', 'Tunisia', 'Japan', '2026-06-21T04:00:00Z', 'Estadio BBVA', 'Guadalupe', 'Mexico'),
  (37, 'group', 'H', 'URU', 'CPV', 'Uruguay', 'Cabo Verde', '2026-06-21T22:00:00Z', 'Hard Rock Stadium', 'Miami Gardens', 'United States'),
  (38, 'group', 'H', 'ESP', 'KSA', 'Spain', 'Saudi Arabia', '2026-06-21T16:00:00Z', 'Mercedes-Benz Stadium', 'Atlanta', 'United States'),
  (39, 'group', 'G', 'BEL', 'IRN', 'Belgium', 'IR Iran', '2026-06-21T19:00:00Z', 'SoFi Stadium', 'Inglewood', 'United States'),
  (40, 'group', 'G', 'NZL', 'EGY', 'New Zealand', 'Egypt', '2026-06-22T01:00:00Z', 'BC Place', 'Vancouver', 'Canada'),
  (41, 'group', 'I', 'NOR', 'SEN', 'Norway', 'Senegal', '2026-06-23T00:00:00Z', 'MetLife Stadium', 'East Rutherford', 'United States'),
  (42, 'group', 'I', 'FRA', 'IRQ', 'France', 'Iraq', '2026-06-22T21:00:00Z', 'Lincoln Financial Field', 'Philadelphia', 'United States'),
  (43, 'group', 'J', 'ARG', 'AUT', 'Argentina', 'Austria', '2026-06-22T17:00:00Z', 'AT&T Stadium', 'Arlington', 'United States'),
  (44, 'group', 'J', 'JOR', 'ALG', 'Jordan', 'Algeria', '2026-06-23T03:00:00Z', 'Levi''s Stadium', 'Santa Clara', 'United States'),
  (45, 'group', 'L', 'ENG', 'GHA', 'England', 'Ghana', '2026-06-23T20:00:00Z', 'Gillette Stadium', 'Foxborough', 'United States'),
  (46, 'group', 'L', 'PAN', 'CRO', 'Panama', 'Croatia', '2026-06-23T23:00:00Z', 'BMO Field', 'Toronto', 'Canada'),
  (47, 'group', 'K', 'POR', 'UZB', 'Portugal', 'Uzbekistan', '2026-06-23T17:00:00Z', 'NRG Stadium', 'Houston', 'United States'),
  (48, 'group', 'K', 'COL', 'COD', 'Colombia', 'DR Congo', '2026-06-24T02:00:00Z', 'Estadio Akron', 'Zapopan', 'Mexico'),
  (49, 'group', 'C', 'SCO', 'BRA', 'Scotland', 'Brazil', '2026-06-24T22:00:00Z', 'Hard Rock Stadium', 'Miami Gardens', 'United States'),
  (50, 'group', 'C', 'MAR', 'HAI', 'Morocco', 'Haiti', '2026-06-24T22:00:00Z', 'Mercedes-Benz Stadium', 'Atlanta', 'United States'),
  (51, 'group', 'B', 'SUI', 'CAN', 'Switzerland', 'Canada', '2026-06-24T19:00:00Z', 'BC Place', 'Vancouver', 'Canada'),
  (52, 'group', 'B', 'BIH', 'QAT', 'Bosnia and Herzegovina', 'Qatar', '2026-06-24T19:00:00Z', 'Lumen Field', 'Seattle', 'United States'),
  (53, 'group', 'A', 'CZE', 'MEX', 'Czechia', 'Mexico', '2026-06-25T01:00:00Z', 'Estadio Azteca', 'Mexico City', 'Mexico'),
  (54, 'group', 'A', 'RSA', 'KOR', 'South Africa', 'Korea Republic', '2026-06-25T01:00:00Z', 'Estadio BBVA', 'Guadalupe', 'Mexico'),
  (55, 'group', 'E', 'CUW', 'CIV', 'Curacao', 'Cote d''Ivoire', '2026-06-25T20:00:00Z', 'Lincoln Financial Field', 'Philadelphia', 'United States'),
  (56, 'group', 'E', 'ECU', 'GER', 'Ecuador', 'Germany', '2026-06-25T20:00:00Z', 'MetLife Stadium', 'East Rutherford', 'United States'),
  (57, 'group', 'F', 'JPN', 'SWE', 'Japan', 'Sweden', '2026-06-25T23:00:00Z', 'AT&T Stadium', 'Arlington', 'United States'),
  (58, 'group', 'F', 'TUN', 'NED', 'Tunisia', 'Netherlands', '2026-06-25T23:00:00Z', 'Arrowhead Stadium', 'Kansas City', 'United States'),
  (59, 'group', 'D', 'TUR', 'USA', 'Turkiye', 'United States', '2026-06-26T02:00:00Z', 'SoFi Stadium', 'Inglewood', 'United States'),
  (60, 'group', 'D', 'PAR', 'AUS', 'Paraguay', 'Australia', '2026-06-26T02:00:00Z', 'Levi''s Stadium', 'Santa Clara', 'United States'),
  (61, 'group', 'I', 'NOR', 'FRA', 'Norway', 'France', '2026-06-26T19:00:00Z', 'Gillette Stadium', 'Foxborough', 'United States'),
  (62, 'group', 'I', 'SEN', 'IRQ', 'Senegal', 'Iraq', '2026-06-26T19:00:00Z', 'BMO Field', 'Toronto', 'Canada'),
  (63, 'group', 'G', 'EGY', 'IRN', 'Egypt', 'IR Iran', '2026-06-27T03:00:00Z', 'Lumen Field', 'Seattle', 'United States'),
  (64, 'group', 'G', 'NZL', 'BEL', 'New Zealand', 'Belgium', '2026-06-27T03:00:00Z', 'BC Place', 'Vancouver', 'Canada'),
  (65, 'group', 'H', 'CPV', 'KSA', 'Cabo Verde', 'Saudi Arabia', '2026-06-27T00:00:00Z', 'NRG Stadium', 'Houston', 'United States'),
  (66, 'group', 'H', 'URU', 'ESP', 'Uruguay', 'Spain', '2026-06-27T00:00:00Z', 'Estadio Akron', 'Zapopan', 'Mexico'),
  (67, 'group', 'L', 'PAN', 'ENG', 'Panama', 'England', '2026-06-27T21:00:00Z', 'MetLife Stadium', 'East Rutherford', 'United States'),
  (68, 'group', 'L', 'CRO', 'GHA', 'Croatia', 'Ghana', '2026-06-27T21:00:00Z', 'Lincoln Financial Field', 'Philadelphia', 'United States'),
  (69, 'group', 'J', 'ALG', 'AUT', 'Algeria', 'Austria', '2026-06-28T02:00:00Z', 'Arrowhead Stadium', 'Kansas City', 'United States'),
  (70, 'group', 'J', 'JOR', 'ARG', 'Jordan', 'Argentina', '2026-06-28T02:00:00Z', 'AT&T Stadium', 'Arlington', 'United States'),
  (71, 'group', 'K', 'COL', 'POR', 'Colombia', 'Portugal', '2026-06-27T23:30:00Z', 'Hard Rock Stadium', 'Miami Gardens', 'United States'),
  (72, 'group', 'K', 'COD', 'UZB', 'DR Congo', 'Uzbekistan', '2026-06-27T23:30:00Z', 'Mercedes-Benz Stadium', 'Atlanta', 'United States'),
  (73, 'round_of_32', null, null, null, 'Runner-up Group A', 'Runner-up Group B', '2026-06-28T19:00:00Z', 'SoFi Stadium', 'Inglewood', 'United States'),
  (74, 'round_of_32', null, null, null, 'Winner Group E', 'Third Group A/B/C/D/F', '2026-06-29T20:30:00Z', 'Gillette Stadium', 'Foxborough', 'United States'),
  (75, 'round_of_32', null, null, null, 'Winner Group F', 'Runner-up Group C', '2026-06-30T01:00:00Z', 'Estadio BBVA', 'Guadalupe', 'Mexico'),
  (76, 'round_of_32', null, null, null, 'Winner Group C', 'Runner-up Group F', '2026-06-29T17:00:00Z', 'NRG Stadium', 'Houston', 'United States'),
  (77, 'round_of_32', null, null, null, 'Winner Group I', 'Third Group C/D/F/G/H', '2026-06-30T21:00:00Z', 'MetLife Stadium', 'East Rutherford', 'United States'),
  (78, 'round_of_32', null, null, null, 'Runner-up Group E', 'Runner-up Group I', '2026-06-30T17:00:00Z', 'AT&T Stadium', 'Arlington', 'United States'),
  (79, 'round_of_32', null, null, null, 'Winner Group A', 'Third Group C/E/F/H/I', '2026-07-01T01:00:00Z', 'Estadio Azteca', 'Mexico City', 'Mexico'),
  (80, 'round_of_32', null, null, null, 'Winner Group L', 'Third Group E/H/I/J/K', '2026-07-01T16:00:00Z', 'Mercedes-Benz Stadium', 'Atlanta', 'United States'),
  (81, 'round_of_32', null, null, null, 'Winner Group D', 'Third Group B/E/F/I/J', '2026-07-02T00:00:00Z', 'Levi''s Stadium', 'Santa Clara', 'United States'),
  (82, 'round_of_32', null, null, null, 'Winner Group G', 'Third Group A/E/H/I/J', '2026-07-01T20:00:00Z', 'Lumen Field', 'Seattle', 'United States'),
  (83, 'round_of_32', null, null, null, 'Runner-up Group K', 'Runner-up Group L', '2026-07-02T23:00:00Z', 'BMO Field', 'Toronto', 'Canada'),
  (84, 'round_of_32', null, null, null, 'Winner Group H', 'Runner-up Group J', '2026-07-02T19:00:00Z', 'SoFi Stadium', 'Inglewood', 'United States'),
  (85, 'round_of_32', null, null, null, 'Winner Group B', 'Third Group E/F/G/I/J', '2026-07-03T03:00:00Z', 'BC Place', 'Vancouver', 'Canada'),
  (86, 'round_of_32', null, null, null, 'Winner Group J', 'Runner-up Group H', '2026-07-03T22:00:00Z', 'Hard Rock Stadium', 'Miami Gardens', 'United States'),
  (87, 'round_of_32', null, null, null, 'Winner Group K', 'Third Group D/E/I/J/L', '2026-07-04T01:30:00Z', 'Arrowhead Stadium', 'Kansas City', 'United States'),
  (88, 'round_of_32', null, null, null, 'Runner-up Group D', 'Runner-up Group G', '2026-07-03T18:00:00Z', 'AT&T Stadium', 'Arlington', 'United States'),
  (89, 'round_of_16', null, null, null, 'Winner Match 74', 'Winner Match 77', '2026-07-04T21:00:00Z', 'Lincoln Financial Field', 'Philadelphia', 'United States'),
  (90, 'round_of_16', null, null, null, 'Winner Match 73', 'Winner Match 75', '2026-07-04T17:00:00Z', 'NRG Stadium', 'Houston', 'United States'),
  (91, 'round_of_16', null, null, null, 'Winner Match 76', 'Winner Match 78', '2026-07-05T20:00:00Z', 'MetLife Stadium', 'East Rutherford', 'United States'),
  (92, 'round_of_16', null, null, null, 'Winner Match 79', 'Winner Match 80', '2026-07-06T00:00:00Z', 'Estadio Azteca', 'Mexico City', 'Mexico'),
  (93, 'round_of_16', null, null, null, 'Winner Match 83', 'Winner Match 84', '2026-07-06T19:00:00Z', 'AT&T Stadium', 'Arlington', 'United States'),
  (94, 'round_of_16', null, null, null, 'Winner Match 81', 'Winner Match 82', '2026-07-07T00:00:00Z', 'Lumen Field', 'Seattle', 'United States'),
  (95, 'round_of_16', null, null, null, 'Winner Match 86', 'Winner Match 88', '2026-07-07T16:00:00Z', 'Mercedes-Benz Stadium', 'Atlanta', 'United States'),
  (96, 'round_of_16', null, null, null, 'Winner Match 85', 'Winner Match 87', '2026-07-07T20:00:00Z', 'BC Place', 'Vancouver', 'Canada'),
  (97, 'quarterfinal', null, null, null, 'Winner Match 89', 'Winner Match 90', '2026-07-09T20:00:00Z', 'Gillette Stadium', 'Foxborough', 'United States'),
  (98, 'quarterfinal', null, null, null, 'Winner Match 93', 'Winner Match 94', '2026-07-10T19:00:00Z', 'SoFi Stadium', 'Inglewood', 'United States'),
  (99, 'quarterfinal', null, null, null, 'Winner Match 91', 'Winner Match 92', '2026-07-11T21:00:00Z', 'Hard Rock Stadium', 'Miami Gardens', 'United States'),
  (100, 'quarterfinal', null, null, null, 'Winner Match 95', 'Winner Match 96', '2026-07-12T01:00:00Z', 'Arrowhead Stadium', 'Kansas City', 'United States'),
  (101, 'semifinal', null, null, null, 'Winner Match 97', 'Winner Match 98', '2026-07-14T19:00:00Z', 'AT&T Stadium', 'Arlington', 'United States'),
  (102, 'semifinal', null, null, null, 'Winner Match 99', 'Winner Match 100', '2026-07-15T19:00:00Z', 'Mercedes-Benz Stadium', 'Atlanta', 'United States'),
  (103, 'third_place', null, null, null, 'Loser Match 101', 'Loser Match 102', '2026-07-18T21:00:00Z', 'Hard Rock Stadium', 'Miami Gardens', 'United States'),
  (104, 'final', null, null, null, 'Winner Match 101', 'Winner Match 102', '2026-07-19T19:00:00Z', 'MetLife Stadium', 'East Rutherford', 'United States')
)
insert into public.wc_matches (
  match_number, season, stage, group_code,
  home_team_code, away_team_code, home_label, away_label,
  kickoff_at, lock_at, venue, city, country, source_note
)
select
  match_number, 2026, stage, group_code,
  home_team_code, away_team_code, home_label, away_label,
  kickoff_at::timestamptz, kickoff_at::timestamptz, venue, city, country,
  'Official FIFA World Cup 26 match schedule, published April 2026.'
from wc_fixture_rows
on conflict (match_number) do update set
  season = excluded.season,
  stage = excluded.stage,
  group_code = excluded.group_code,
  home_team_code = excluded.home_team_code,
  away_team_code = excluded.away_team_code,
  home_label = excluded.home_label,
  away_label = excluded.away_label,
  kickoff_at = excluded.kickoff_at,
  lock_at = excluded.lock_at,
  venue = excluded.venue,
  city = excluded.city,
  country = excluded.country,
  source_note = excluded.source_note;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wc_matches_home_team_code_fkey'
      and conrelid = 'public.wc_matches'::regclass
  ) then
    alter table public.wc_matches
      add constraint wc_matches_home_team_code_fkey
      foreign key (home_team_code) references public.wc_teams(code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'wc_matches_away_team_code_fkey'
      and conrelid = 'public.wc_matches'::regclass
  ) then
    alter table public.wc_matches
      add constraint wc_matches_away_team_code_fkey
      foreign key (away_team_code) references public.wc_teams(code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'wc_matches_winner_team_code_fkey'
      and conrelid = 'public.wc_matches'::regclass
  ) then
    alter table public.wc_matches
      add constraint wc_matches_winner_team_code_fkey
      foreign key (winner_team_code) references public.wc_teams(code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'wc_match_predictions_predicted_winner_team_code_fkey'
      and conrelid = 'public.wc_match_predictions'::regclass
  ) then
    alter table public.wc_match_predictions
      add constraint wc_match_predictions_predicted_winner_team_code_fkey
      foreign key (predicted_winner_team_code) references public.wc_teams(code);
  end if;

  if to_regclass('public.wc_survivor_picks') is not null
    and not exists (
      select 1 from pg_constraint
      where conname = 'wc_survivor_picks_picked_team_code_fkey'
        and conrelid = 'public.wc_survivor_picks'::regclass
    )
  then
    execute 'alter table public.wc_survivor_picks add constraint wc_survivor_picks_picked_team_code_fkey foreign key (picked_team_code) references public.wc_teams(code)';
  end if;
end $$;

insert into public.wc_score_runs (operation_type, status, message, counts, metadata)
values (
  'fixture-correction',
  'ok',
  'WC fixtures replaced with official FIFA World Cup 26 schedule.',
  '{"matches":104,"group_matches":72,"knockout_matches":32}'::jsonb,
  '{"source":"FIFA World Cup 26 official match schedule PDF, April 2026"}'::jsonb
);

commit;
