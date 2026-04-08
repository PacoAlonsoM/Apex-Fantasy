create table if not exists public.race_context_history (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  race_round integer not null,
  race_name text,
  race_date timestamptz,
  meeting_key bigint,
  session_key bigint,
  race_outcome jsonb not null default '{}'::jsonb,
  qualifying_outcome jsonb not null default '{}'::jsonb,
  sprint_outcome jsonb not null default '{}'::jsonb,
  weather_summary jsonb not null default '{}'::jsonb,
  strategy_summary jsonb not null default '{}'::jsonb,
  driver_results jsonb not null default '[]'::jsonb,
  constructor_results jsonb not null default '[]'::jsonb,
  volatility_summary jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint race_context_history_season_round_unique unique (season, race_round)
);

create index if not exists race_context_history_season_round_idx
  on public.race_context_history (season, race_round desc);

create index if not exists race_context_history_meeting_key_idx
  on public.race_context_history (meeting_key);

create index if not exists race_context_history_session_key_idx
  on public.race_context_history (session_key);

create or replace function public.set_race_context_history_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists race_context_history_set_updated_at on public.race_context_history;

create trigger race_context_history_set_updated_at
before update on public.race_context_history
for each row
execute function public.set_race_context_history_updated_at();

alter table public.race_context_history enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'race_context_history'
      and policyname = 'Public can read race context history'
  ) then
    create policy "Public can read race context history"
      on public.race_context_history
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;
