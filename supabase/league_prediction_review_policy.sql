alter table public.predictions enable row level security;

grant select on table public.predictions to authenticated;

drop policy if exists "League members can read scored predictions" on public.predictions;
create policy "League members can read scored predictions"
on public.predictions
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.league_members viewer
    join public.league_members teammate
      on teammate.league_id = viewer.league_id
    join public.race_results rr
      on rr.race_round = predictions.race_round
    where viewer.user_id = auth.uid()
      and teammate.user_id = predictions.user_id
      and rr.results_entered = true
  )
);
