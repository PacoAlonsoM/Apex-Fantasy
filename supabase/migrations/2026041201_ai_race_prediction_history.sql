create table if not exists public.ai_race_predictions (
  id uuid primary key default gen_random_uuid(),
  race_round integer not null,
  race_name text not null,
  meeting_key bigint,
  session_key bigint,
  target_race_date timestamptz,
  insight_key text not null default 'upcoming_race_brief',
  scope text not null default 'upcoming_race',
  category_key text not null,
  category_label text not null,
  category_type text not null,
  predicted_value text not null,
  reason text,
  confidence numeric(4,3),
  provider text not null default 'openai',
  model text,
  generated_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_race_predictions_race_category_unique unique (race_round, category_key)
);

create index if not exists ai_race_predictions_round_idx
  on public.ai_race_predictions (race_round desc);

create index if not exists ai_race_predictions_generated_at_idx
  on public.ai_race_predictions (generated_at desc);

create or replace function public.set_ai_race_predictions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists ai_race_predictions_set_updated_at on public.ai_race_predictions;

create trigger ai_race_predictions_set_updated_at
before update on public.ai_race_predictions
for each row
execute function public.set_ai_race_predictions_updated_at();

alter table public.ai_race_predictions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_race_predictions'
      and policyname = 'Public can read ai race predictions'
  ) then
    create policy "Public can read ai race predictions"
      on public.ai_race_predictions
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

insert into public.ai_race_predictions (
  race_round,
  race_name,
  meeting_key,
  session_key,
  target_race_date,
  insight_key,
  scope,
  category_key,
  category_label,
  category_type,
  predicted_value,
  reason,
  confidence,
  provider,
  model,
  generated_at
)
select
  coalesce(r.round, nullif(ai.metadata->>'race_round', '')::integer),
  ai.race_name,
  ai.meeting_key,
  ai.session_key,
  nullif(ai.metadata->>'target_race_date', '')::timestamptz,
  ai.insight_key,
  ai.scope,
  prediction->>'key',
  coalesce(nullif(prediction->>'category', ''), prediction->>'key'),
  coalesce(nullif(prediction->>'type', ''), 'driver'),
  prediction->>'pick',
  nullif(prediction->>'reason', ''),
  nullif(prediction->>'confidence', '')::numeric,
  ai.provider,
  ai.model,
  ai.generated_at
from public.ai_insights ai
left join public.races r
  on lower(r.name) = lower(ai.race_name)
cross join lateral jsonb_array_elements(coalesce(ai.metadata->'category_predictions', '[]'::jsonb)) prediction
where coalesce(r.round, nullif(ai.metadata->>'race_round', '')::integer) is not null
  and coalesce(prediction->>'key', '') <> ''
  and coalesce(prediction->>'pick', '') <> ''
on conflict (race_round, category_key) do update
set
  race_name = excluded.race_name,
  meeting_key = excluded.meeting_key,
  session_key = excluded.session_key,
  target_race_date = excluded.target_race_date,
  insight_key = excluded.insight_key,
  scope = excluded.scope,
  category_label = excluded.category_label,
  category_type = excluded.category_type,
  predicted_value = excluded.predicted_value,
  reason = excluded.reason,
  confidence = excluded.confidence,
  provider = excluded.provider,
  model = excluded.model,
  generated_at = excluded.generated_at;
