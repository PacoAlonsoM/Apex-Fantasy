create extension if not exists pgcrypto;

create table if not exists public.race_schedule_sessions (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  race_round integer not null,
  session_type text not null,
  session_name text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  status text not null default 'scheduled',
  session_key bigint,
  meeting_key bigint,
  source text not null default 'openf1',
  source_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint race_schedule_sessions_unique unique (season, race_round, session_type)
);

create table if not exists public.race_round_controls (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  race_round integer not null,
  event_status_override text,
  race_lock_override_at timestamptz,
  sprint_lock_override_at timestamptz,
  admin_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint race_round_controls_unique unique (season, race_round),
  constraint race_round_controls_status_check
    check (event_status_override is null or event_status_override in ('scheduled', 'completed', 'cancelled', 'postponed'))
);

create table if not exists public.race_result_drafts (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  race_round integer not null,
  draft_status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  integrity_summary jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  published_by text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint race_result_drafts_unique unique (season, race_round),
  constraint race_result_drafts_status_check
    check (draft_status in ('draft', 'published', 'archived'))
);

create table if not exists public.admin_operation_runs (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null,
  season integer not null default 2026,
  race_round integer,
  status text not null default 'ok',
  message text,
  warnings jsonb not null default '[]'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists race_schedule_sessions_round_idx
  on public.race_schedule_sessions (season, race_round);

create index if not exists race_round_controls_round_idx
  on public.race_round_controls (season, race_round);

create index if not exists race_result_drafts_round_idx
  on public.race_result_drafts (season, race_round);

create index if not exists admin_operation_runs_lookup_idx
  on public.admin_operation_runs (operation_type, season, race_round, created_at desc);

create or replace view public.admin_round_status as
select
  rc.season,
  rc.internal_round_number as race_round,
  coalesce(rc.display_name, rc.official_name, rc.event_slug) as race_name,
  rc.race_date,
  coalesce(rrc.event_status_override, rc.override_status, rc.event_status, 'scheduled') as effective_status,
  rrc.race_lock_override_at,
  rrc.sprint_lock_override_at,
  count(distinct rss.id) as session_rows,
  max(rss.last_synced_at) as session_last_synced_at,
  max(case when rrd.id is not null then 1 else 0 end) as has_draft,
  max(case when rr.results_entered = true then 1 else 0 end) as has_published_result,
  max(case when rch.id is not null then 1 else 0 end) as has_history_context
from public.race_calendar rc
left join public.race_round_controls rrc
  on rrc.season = rc.season
 and rrc.race_round = rc.internal_round_number
left join public.race_schedule_sessions rss
  on rss.season = rc.season
 and rss.race_round = rc.internal_round_number
left join public.race_result_drafts rrd
  on rrd.season = rc.season
 and rrd.race_round = rc.internal_round_number
left join public.race_results rr
  on rr.race_round = rc.internal_round_number
left join public.race_context_history rch
  on rch.season = rc.season
 and rch.race_round = rc.internal_round_number
group by
  rc.season,
  rc.internal_round_number,
  rc.display_name,
  rc.official_name,
  rc.event_slug,
  rc.race_date,
  rc.override_status,
  rc.event_status,
  rrc.event_status_override,
  rrc.race_lock_override_at,
  rrc.sprint_lock_override_at;

alter table public.race_schedule_sessions enable row level security;
alter table public.race_round_controls enable row level security;
alter table public.race_result_drafts enable row level security;
alter table public.admin_operation_runs enable row level security;
