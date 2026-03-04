create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  insight_key text not null unique,
  scope text not null default 'upcoming_race',
  race_name text,
  meeting_key bigint,
  session_key bigint,
  headline text not null,
  summary text not null,
  confidence numeric(4,3),
  key_factors jsonb not null default '[]'::jsonb,
  prediction_edges jsonb not null default '[]'::jsonb,
  watchlist jsonb not null default '[]'::jsonb,
  news_article_ids uuid[] not null default '{}'::uuid[],
  news_article_urls text[] not null default '{}'::text[],
  source_count integer not null default 0,
  provider text not null default 'openai',
  model text,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_insights_scope_generated_at_idx
  on public.ai_insights (scope, generated_at desc);

create index if not exists ai_insights_race_name_idx
  on public.ai_insights (race_name);

create table if not exists public.ai_insight_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'upcoming_race',
  race_name text,
  status text not null default 'ok',
  model text,
  source_count integer not null default 0,
  article_count integer not null default 0,
  error_text text,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

create index if not exists ai_insight_runs_started_at_idx
  on public.ai_insight_runs (started_at desc);

create or replace function public.set_ai_insights_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists ai_insights_set_updated_at on public.ai_insights;

create trigger ai_insights_set_updated_at
before update on public.ai_insights
for each row
execute function public.set_ai_insights_updated_at();

alter table public.ai_insights enable row level security;
alter table public.ai_insight_runs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_insights'
      and policyname = 'Public can read ai insights'
  ) then
    create policy "Public can read ai insights"
      on public.ai_insights
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;
