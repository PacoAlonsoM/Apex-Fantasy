alter table public.race_results enable row level security;

grant select on table public.race_results to anon;
grant select, insert, update on table public.race_results to authenticated;

drop policy if exists "Public can read race results" on public.race_results;
create policy "Public can read race results"
on public.race_results
for select
using (true);

drop policy if exists "Admin can insert race results" on public.race_results;
create policy "Admin can insert race results"
on public.race_results
for insert
to authenticated
with check (auth.uid() = 'cb9d7c71-74a6-4a5f-90d6-0809c83f4101');

drop policy if exists "Admin can update race results" on public.race_results;
create policy "Admin can update race results"
on public.race_results
for update
to authenticated
using (auth.uid() = 'cb9d7c71-74a6-4a5f-90d6-0809c83f4101')
with check (auth.uid() = 'cb9d7c71-74a6-4a5f-90d6-0809c83f4101');
