-- ============================================================
-- WC 2026 survivor pool game mode
-- One pick per round. Pick a team to win their match in that round.
-- Win advances you. Draw or loss eliminates you for the rest of the
-- tournament. Each team can be used at most once across all rounds.
-- Cleanly removable: all objects prefixed wc_survivor_.
-- ============================================================

create table if not exists public.wc_survivor_picks (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  round_key           text not null check (round_key in ('group_md1','group_md2','group_md3','round_of_32','round_of_16','quarterfinal','semifinal','final')),
  picked_team_code    text not null references public.wc_teams(code),
  match_id            uuid references public.wc_matches(id) on delete set null,
  status              text not null default 'pending' check (status in ('pending','correct','eliminated','locked')),
  points              integer,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),
  unique (user_id, round_key)
);

create index if not exists wc_survivor_picks_user_idx on public.wc_survivor_picks(user_id);
create index if not exists wc_survivor_picks_round_idx on public.wc_survivor_picks(round_key);
create index if not exists wc_survivor_picks_match_idx on public.wc_survivor_picks(match_id);

drop trigger if exists wc_survivor_picks_updated_at on public.wc_survivor_picks;
create trigger wc_survivor_picks_updated_at
  before update on public.wc_survivor_picks
  for each row execute function public.wc_set_updated_at();

alter table public.wc_survivor_picks enable row level security;

drop policy if exists "WC users can read own survivor picks" on public.wc_survivor_picks;
create policy "WC users can read own survivor picks"
  on public.wc_survivor_picks for select
  using (auth.uid() = user_id);

drop policy if exists "WC users can insert own survivor picks" on public.wc_survivor_picks;
create policy "WC users can insert own survivor picks"
  on public.wc_survivor_picks for insert
  with check (auth.uid() = user_id);

drop policy if exists "WC users can update own survivor picks before lock" on public.wc_survivor_picks;
create policy "WC users can update own survivor picks before lock"
  on public.wc_survivor_picks for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id);
