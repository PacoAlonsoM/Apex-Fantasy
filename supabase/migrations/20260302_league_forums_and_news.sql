create extension if not exists pgcrypto;

alter table public.posts
  add column if not exists league_id uuid references public.leagues(id) on delete cascade;

comment on column public.posts.league_id is 'Null for global forum posts. Set for league-specific posts.';

create index if not exists posts_league_id_created_at_idx
  on public.posts (league_id, created_at desc);

create index if not exists posts_global_created_at_idx
  on public.posts (created_at desc)
  where league_id is null;

create or replace function public.is_league_member(target_league uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = target_league
      and lm.user_id = auth.uid()
  );
$$;

grant execute on function public.is_league_member(uuid) to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'League members can read league posts'
  ) then
    create policy "League members can read league posts"
      on public.posts
      for select
      using (
        league_id is not null
        and public.is_league_member(league_id)
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'League members can create league posts'
  ) then
    create policy "League members can create league posts"
      on public.posts
      for insert
      with check (
        league_id is not null
        and auth.uid() = author_id
        and public.is_league_member(league_id)
      );
  end if;
end $$;

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  url text not null unique,
  source text not null,
  published_at timestamptz,
  image_url text,
  is_featured boolean not null default false,
  source_priority smallint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists news_articles_published_at_idx
  on public.news_articles (published_at desc nulls last);

create index if not exists news_articles_source_idx
  on public.news_articles (source);

create or replace function public.set_news_articles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists news_articles_set_updated_at on public.news_articles;

create trigger news_articles_set_updated_at
before update on public.news_articles
for each row
execute function public.set_news_articles_updated_at();

create table if not exists public.news_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  fetched_count integer not null default 0,
  upserted_count integer not null default 0,
  status text not null default 'ok',
  error_text text,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

create index if not exists news_ingest_runs_started_at_idx
  on public.news_ingest_runs (started_at desc);

alter table public.news_articles enable row level security;
alter table public.news_ingest_runs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'news_articles'
      and policyname = 'Public can read news articles'
  ) then
    create policy "Public can read news articles"
      on public.news_articles
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;
