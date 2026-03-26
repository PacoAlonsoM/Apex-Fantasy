create table if not exists public.race_calendar (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  event_slug text not null,
  official_name text,
  display_name text not null,
  country_name text,
  city_name text,
  circuit_name text,
  race_type text,
  race_date date not null,
  weekend_start timestamptz,
  weekend_end timestamptz,
  sprint boolean not null default false,
  source_round_number integer,
  internal_round_number integer,
  meeting_key bigint,
  race_session_key bigint,
  event_status text not null default 'scheduled',
  override_status text,
  override_note text,
  source_name text not null default 'OpenF1',
  source_url text,
  source_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint race_calendar_season_event_slug_unique unique (season, event_slug),
  constraint race_calendar_event_status_check check (event_status in ('scheduled', 'completed', 'cancelled', 'postponed')),
  constraint race_calendar_override_status_check check (override_status is null or override_status in ('scheduled', 'completed', 'cancelled', 'postponed'))
);

create index if not exists race_calendar_season_round_idx
  on public.race_calendar (season, source_round_number);

create index if not exists race_calendar_season_date_idx
  on public.race_calendar (season, race_date);

create index if not exists race_calendar_season_status_idx
  on public.race_calendar (season, event_status);

create index if not exists race_calendar_internal_round_idx
  on public.race_calendar (season, internal_round_number);

create table if not exists public.race_calendar_sync_runs (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  status text not null default 'ok',
  source_name text not null default 'OpenF1',
  active_count integer not null default 0,
  cancelled_count integer not null default 0,
  error_text text,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

create index if not exists race_calendar_sync_runs_started_at_idx
  on public.race_calendar_sync_runs (started_at desc);

create or replace function public.set_race_calendar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists race_calendar_set_updated_at on public.race_calendar;

create trigger race_calendar_set_updated_at
before update on public.race_calendar
for each row
execute function public.set_race_calendar_updated_at();

alter table public.race_calendar enable row level security;
alter table public.race_calendar_sync_runs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'race_calendar'
      and policyname = 'Public can read race calendar'
  ) then
    create policy "Public can read race calendar"
      on public.race_calendar
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;
