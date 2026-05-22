-- ============================================================
-- WC 2026 prediction platform
-- All objects in this migration are prefixed with wc_ so the
-- World Cup product slice can be removed cleanly after the
-- tournament.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.wc_teams (
  code        text primary key,
  name        text not null,
  group_code  text not null check (group_code in ('A','B','C','D','E','F','G','H','I','J','K','L')),
  seed_order  integer not null check (seed_order between 1 and 4),
  flag        text,
  created_at  timestamptz not null default timezone('utc', now()),
  unique (group_code, seed_order)
);

create table if not exists public.wc_matches (
  id                uuid primary key default gen_random_uuid(),
  match_number      integer not null unique check (match_number between 1 and 104),
  season            integer not null default 2026,
  stage             text not null check (stage in ('group','round_of_32','round_of_16','quarterfinal','semifinal','third_place','final')),
  group_code        text check (group_code is null or group_code in ('A','B','C','D','E','F','G','H','I','J','K','L')),
  home_team_code    text references public.wc_teams(code),
  away_team_code    text references public.wc_teams(code),
  home_label        text not null,
  away_label        text not null,
  kickoff_at        timestamptz not null,
  lock_at           timestamptz not null,
  venue             text,
  city              text,
  country           text,
  status            text not null default 'scheduled' check (status in ('scheduled','locked','live','completed','cancelled')),
  home_score        integer check (home_score is null or home_score >= 0),
  away_score        integer check (away_score is null or away_score >= 0),
  winner_team_code  text references public.wc_teams(code),
  source_note       text not null default 'WC seed',
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

create table if not exists public.wc_match_predictions (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.profiles(id) on delete cascade,
  match_id                    uuid not null references public.wc_matches(id) on delete cascade,
  predicted_home_score        integer not null check (predicted_home_score between 0 and 99),
  predicted_away_score        integer not null check (predicted_away_score between 0 and 99),
  predicted_winner_team_code  text references public.wc_teams(code),
  points                      integer,
  score_breakdown             jsonb not null default '[]'::jsonb,
  created_at                  timestamptz not null default timezone('utc', now()),
  updated_at                  timestamptz not null default timezone('utc', now()),
  unique (user_id, match_id)
);

create table if not exists public.wc_bracket_predictions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  picks            jsonb not null default '{}'::jsonb,
  points           integer,
  score_breakdown  jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now()),
  unique (user_id)
);

create table if not exists public.wc_leagues (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  code        text not null unique,
  visibility  text not null default 'private' check (visibility in ('private','public')),
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create table if not exists public.wc_league_members (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.wc_leagues(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner','member')),
  joined_at   timestamptz not null default timezone('utc', now()),
  unique (league_id, user_id)
);

create table if not exists public.wc_score_runs (
  id              uuid primary key default gen_random_uuid(),
  operation_type  text not null,
  match_id        uuid references public.wc_matches(id) on delete set null,
  status          text not null default 'ok' check (status in ('ok','partial','error')),
  message         text,
  counts          jsonb not null default '{}'::jsonb,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists wc_matches_stage_idx on public.wc_matches(stage);
create index if not exists wc_matches_kickoff_idx on public.wc_matches(kickoff_at);
create index if not exists wc_match_predictions_user_idx on public.wc_match_predictions(user_id);
create index if not exists wc_match_predictions_match_idx on public.wc_match_predictions(match_id);
create index if not exists wc_bracket_predictions_user_idx on public.wc_bracket_predictions(user_id);
create index if not exists wc_league_members_user_idx on public.wc_league_members(user_id);
create index if not exists wc_league_members_league_idx on public.wc_league_members(league_id);
create index if not exists wc_score_runs_created_idx on public.wc_score_runs(created_at desc);

create or replace function public.wc_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists wc_matches_updated_at on public.wc_matches;
create trigger wc_matches_updated_at
  before update on public.wc_matches
  for each row execute function public.wc_set_updated_at();

drop trigger if exists wc_match_predictions_updated_at on public.wc_match_predictions;
create trigger wc_match_predictions_updated_at
  before update on public.wc_match_predictions
  for each row execute function public.wc_set_updated_at();

drop trigger if exists wc_bracket_predictions_updated_at on public.wc_bracket_predictions;
create trigger wc_bracket_predictions_updated_at
  before update on public.wc_bracket_predictions
  for each row execute function public.wc_set_updated_at();

drop trigger if exists wc_leagues_updated_at on public.wc_leagues;
create trigger wc_leagues_updated_at
  before update on public.wc_leagues
  for each row execute function public.wc_set_updated_at();

create or replace function public.wc_is_league_member(target_league uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wc_league_members member
    where member.league_id = target_league
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.wc_is_league_owner(target_league uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wc_league_members member
    where member.league_id = target_league
      and member.user_id = auth.uid()
      and member.role = 'owner'
  );
$$;

grant execute on function public.wc_is_league_member(uuid) to anon, authenticated;
grant execute on function public.wc_is_league_owner(uuid) to anon, authenticated;

alter table public.wc_teams enable row level security;
alter table public.wc_matches enable row level security;
alter table public.wc_match_predictions enable row level security;
alter table public.wc_bracket_predictions enable row level security;
alter table public.wc_leagues enable row level security;
alter table public.wc_league_members enable row level security;
alter table public.wc_score_runs enable row level security;

drop policy if exists "WC public can read teams" on public.wc_teams;
create policy "WC public can read teams" on public.wc_teams for select using (true);

drop policy if exists "WC public can read matches" on public.wc_matches;
create policy "WC public can read matches" on public.wc_matches for select using (true);

drop policy if exists "WC users can read own or locked match picks" on public.wc_match_predictions;
create policy "WC users can read own or locked match picks"
  on public.wc_match_predictions for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.wc_matches match
      where match.id = wc_match_predictions.match_id
        and match.lock_at <= timezone('utc', now())
    )
  );

drop policy if exists "WC users can insert own match picks before lock" on public.wc_match_predictions;
create policy "WC users can insert own match picks before lock"
  on public.wc_match_predictions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.wc_matches match
      where match.id = match_id
        and match.lock_at > timezone('utc', now())
    )
  );

drop policy if exists "WC users can update own match picks before lock" on public.wc_match_predictions;
create policy "WC users can update own match picks before lock"
  on public.wc_match_predictions for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.wc_matches match
      where match.id = match_id
        and match.lock_at > timezone('utc', now())
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.wc_matches match
      where match.id = match_id
        and match.lock_at > timezone('utc', now())
    )
  );

drop policy if exists "WC users can read own bracket or locked brackets" on public.wc_bracket_predictions;
create policy "WC users can read own bracket or locked brackets"
  on public.wc_bracket_predictions for select
  using (auth.uid() = user_id or timezone('utc', now()) >= '2026-06-11 19:00:00+00'::timestamptz);

drop policy if exists "WC users can insert own bracket before tournament lock" on public.wc_bracket_predictions;
create policy "WC users can insert own bracket before tournament lock"
  on public.wc_bracket_predictions for insert
  with check (auth.uid() = user_id and timezone('utc', now()) < '2026-06-11 19:00:00+00'::timestamptz);

drop policy if exists "WC users can update own bracket before tournament lock" on public.wc_bracket_predictions;
create policy "WC users can update own bracket before tournament lock"
  on public.wc_bracket_predictions for update
  using (auth.uid() = user_id and timezone('utc', now()) < '2026-06-11 19:00:00+00'::timestamptz)
  with check (auth.uid() = user_id and timezone('utc', now()) < '2026-06-11 19:00:00+00'::timestamptz);

drop policy if exists "WC users can read public or joined leagues" on public.wc_leagues;
create policy "WC users can read public or joined leagues"
  on public.wc_leagues for select
  using (visibility = 'public' or owner_id = auth.uid() or public.wc_is_league_member(id));

drop policy if exists "WC users can create leagues" on public.wc_leagues;
create policy "WC users can create leagues"
  on public.wc_leagues for insert
  with check (auth.uid() = owner_id);

drop policy if exists "WC owners can update leagues" on public.wc_leagues;
create policy "WC owners can update leagues"
  on public.wc_leagues for update
  using (public.wc_is_league_owner(id));

drop policy if exists "WC users can read their memberships" on public.wc_league_members;
create policy "WC users can read their memberships"
  on public.wc_league_members for select
  using (auth.uid() = user_id or public.wc_is_league_owner(league_id));

drop policy if exists "WC users can join leagues" on public.wc_league_members;
create policy "WC users can join leagues"
  on public.wc_league_members for insert
  with check (
    auth.uid() = user_id
    and (
      role = 'member'
      or exists (
        select 1
        from public.wc_leagues league
        where league.id = league_id
          and league.owner_id = auth.uid()
          and role = 'owner'
      )
    )
  );

drop policy if exists "WC users can leave leagues" on public.wc_league_members;
create policy "WC users can leave leagues"
  on public.wc_league_members for delete
  using (auth.uid() = user_id or public.wc_is_league_owner(league_id));

drop policy if exists "WC admins can read score runs" on public.wc_score_runs;
create policy "WC admins can read score runs" on public.wc_score_runs for select using (false);

insert into public.wc_teams (code, name, group_code, seed_order, flag) values
  ('MEX','Mexico','A',1,'MX'), ('RSA','South Africa','A',2,'ZA'), ('KOR','Korea Republic','A',3,'KR'), ('CZE','Czechia','A',4,'CZ'),
  ('CAN','Canada','B',1,'CA'), ('BIH','Bosnia and Herzegovina','B',2,'BA'), ('QAT','Qatar','B',3,'QA'), ('SUI','Switzerland','B',4,'CH'),
  ('BRA','Brazil','C',1,'BR'), ('MAR','Morocco','C',2,'MA'), ('HAI','Haiti','C',3,'HT'), ('SCO','Scotland','C',4,'GB-SCT'),
  ('USA','United States','D',1,'US'), ('PAR','Paraguay','D',2,'PY'), ('AUS','Australia','D',3,'AU'), ('TUR','Turkiye','D',4,'TR'),
  ('GER','Germany','E',1,'DE'), ('CUW','Curacao','E',2,'CW'), ('CIV','Cote d''Ivoire','E',3,'CI'), ('ECU','Ecuador','E',4,'EC'),
  ('NED','Netherlands','F',1,'NL'), ('JPN','Japan','F',2,'JP'), ('SWE','Sweden','F',3,'SE'), ('TUN','Tunisia','F',4,'TN'),
  ('BEL','Belgium','G',1,'BE'), ('EGY','Egypt','G',2,'EG'), ('IRN','IR Iran','G',3,'IR'), ('NZL','New Zealand','G',4,'NZ'),
  ('ESP','Spain','H',1,'ES'), ('CPV','Cabo Verde','H',2,'CV'), ('KSA','Saudi Arabia','H',3,'SA'), ('URU','Uruguay','H',4,'UY'),
  ('FRA','France','I',1,'FR'), ('SEN','Senegal','I',2,'SN'), ('IRQ','Iraq','I',3,'IQ'), ('NOR','Norway','I',4,'NO'),
  ('ARG','Argentina','J',1,'AR'), ('ALG','Algeria','J',2,'DZ'), ('AUT','Austria','J',3,'AT'), ('JOR','Jordan','J',4,'JO'),
  ('POR','Portugal','K',1,'PT'), ('COD','DR Congo','K',2,'CD'), ('UZB','Uzbekistan','K',3,'UZ'), ('COL','Colombia','K',4,'CO'),
  ('ENG','England','L',1,'GB-ENG'), ('CRO','Croatia','L',2,'HR'), ('GHA','Ghana','L',3,'GH'), ('PAN','Panama','L',4,'PA')
on conflict (code) do update set
  name = excluded.name,
  group_code = excluded.group_code,
  seed_order = excluded.seed_order,
  flag = excluded.flag;

do $$
declare
  group_row record;
  pair_home integer[] := array[1,3,1,2,1,2];
  pair_away integer[] := array[2,4,3,4,4,3];
  venue_names text[] := array['Estadio Azteca','BMO Field','SoFi Stadium','AT&T Stadium','MetLife Stadium','Mercedes-Benz Stadium','NRG Stadium','BC Place','Estadio BBVA','Lumen Field'];
  venue_cities text[] := array['Mexico City','Toronto','Los Angeles','Dallas','New York New Jersey','Atlanta','Houston','Vancouver','Monterrey','Seattle'];
  venue_countries text[] := array['Mexico','Canada','United States','United States','United States','United States','United States','Canada','Mexico','United States'];
  codes text[];
  names text[];
  match_no integer := 1;
  pair_idx integer;
  venue_idx integer;
  kickoff timestamptz;
  stage_names text[] := array['round_of_32','round_of_16','quarterfinal','semifinal','third_place','final'];
  stage_labels text[] := array['Round of 32','Round of 16','Quarterfinal','Semifinal','Third-place match','Final'];
  stage_counts integer[] := array[16,8,4,2,1,1];
  stage_idx integer;
  slot_idx integer;
  day_offset integer := 17;
begin
  for group_row in
    select group_code, array_agg(code order by seed_order) as team_codes, array_agg(name order by seed_order) as team_names
    from public.wc_teams
    group by group_code
    order by group_code
  loop
    codes := group_row.team_codes;
    names := group_row.team_names;

    for pair_idx in 1..6 loop
      venue_idx := ((match_no - 1) % array_length(venue_names, 1)) + 1;
      kickoff := '2026-06-11 19:00:00+00'::timestamptz
        + (((match_no - 1) / 4)::integer * interval '1 day')
        + (case when match_no % 2 = 0 then interval '3 hours' else interval '0 hours' end);

      insert into public.wc_matches (
        match_number, season, stage, group_code,
        home_team_code, away_team_code, home_label, away_label,
        kickoff_at, lock_at, venue, city, country, source_note
      ) values (
        match_no, 2026, 'group', group_row.group_code,
        codes[pair_home[pair_idx]], codes[pair_away[pair_idx]],
        names[pair_home[pair_idx]], names[pair_away[pair_idx]],
        kickoff, kickoff, venue_names[venue_idx], venue_cities[venue_idx], venue_countries[venue_idx],
        'WC 2026 seed. Verify final kickoff and venue details against FIFA before launch.'
      )
      on conflict (match_number) do update set
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

      match_no := match_no + 1;
    end loop;
  end loop;

  match_no := 73;

  for stage_idx in 1..array_length(stage_names, 1) loop
    for slot_idx in 1..stage_counts[stage_idx] loop
      venue_idx := ((match_no - 1) % array_length(venue_names, 1)) + 1;
      kickoff := case
        when stage_names[stage_idx] = 'final' then '2026-07-19 19:00:00+00'::timestamptz
        else '2026-06-11 19:00:00+00'::timestamptz
          + ((day_offset + ((slot_idx - 1) / 2)::integer) * interval '1 day')
          + (case when slot_idx % 2 = 0 then interval '3 hours' else interval '0 hours' end)
      end;

      insert into public.wc_matches (
        match_number, season, stage, group_code,
        home_team_code, away_team_code, home_label, away_label,
        kickoff_at, lock_at, venue, city, country, source_note
      ) values (
        match_no, 2026, stage_names[stage_idx], null,
        null, null,
        stage_labels[stage_idx] || ' slot ' || slot_idx || 'A',
        stage_labels[stage_idx] || ' slot ' || slot_idx || 'B',
        kickoff, kickoff,
        case when stage_names[stage_idx] = 'final' then 'MetLife Stadium' else venue_names[venue_idx] end,
        case when stage_names[stage_idx] = 'final' then 'New York New Jersey' else venue_cities[venue_idx] end,
        case when stage_names[stage_idx] = 'final' then 'United States' else venue_countries[venue_idx] end,
        'WC knockout placeholder. Admin updates team slots as the tournament advances.'
      )
      on conflict (match_number) do update set
        stage = excluded.stage,
        home_label = excluded.home_label,
        away_label = excluded.away_label,
        kickoff_at = excluded.kickoff_at,
        lock_at = excluded.lock_at,
        venue = excluded.venue,
        city = excluded.city,
        country = excluded.country,
        source_note = excluded.source_note;

      match_no := match_no + 1;
    end loop;

    day_offset := day_offset + greatest(2, ceiling(stage_counts[stage_idx]::numeric / 2)::integer);
  end loop;
end $$;
