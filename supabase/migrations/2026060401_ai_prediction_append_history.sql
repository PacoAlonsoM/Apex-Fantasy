-- Store AI prediction history append-only.
--
-- The previous constraint kept only one AI pick per race/category, which made
-- the profile comparison usable but discarded older AI boards. Keep every
-- generated board, then let the profile UI choose the best benchmark row.

alter table public.ai_race_predictions
  drop constraint if exists ai_race_predictions_race_category_unique;

create unique index if not exists ai_race_predictions_generation_category_unique
  on public.ai_race_predictions (
    race_round,
    category_key,
    insight_key,
    scope,
    generated_at
  );

create index if not exists ai_race_predictions_round_category_generated_idx
  on public.ai_race_predictions (race_round, category_key, generated_at desc);

create index if not exists ai_race_predictions_scope_round_idx
  on public.ai_race_predictions (scope, race_round desc);

create index if not exists ai_race_predictions_provider_round_idx
  on public.ai_race_predictions (provider, race_round desc);

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
on conflict (race_round, category_key, insight_key, scope, generated_at) do nothing;
