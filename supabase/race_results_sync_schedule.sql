-- Automatic Race Results + Scoring Schedule
--
-- Run this after:
-- 1. deploying the `race-results-sync` Edge Function
-- 2. setting the `RACE_RESULTS_SYNC_SECRET` secret in Supabase
-- 3. enabling `pg_cron`, `pg_net`, and Vault in the Supabase dashboard
--
-- Replace BOTH placeholders before running:
--   YOUR_PROJECT_REF
--   YOUR_LONG_RANDOM_SECRET
--
-- Create Vault secrets once.
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'race_sync_project_url',
  'Supabase project URL for race-results-sync cron'
);

select vault.create_secret(
  'YOUR_LONG_RANDOM_SECRET',
  'race_results_sync_secret',
  'Header secret used by the race-results-sync cron job'
);

-- Schedule the function once per hour on Sundays (UTC).
-- This keeps the flow close to "after every race" without running all week.
-- It will detect the latest completed race automatically and only score unscored predictions.
select cron.schedule(
  'race-results-sync-hourly-sunday',
  '0 * * * 0',
  $$
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'race_sync_project_url') || '/functions/v1/race-results-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'race_results_sync_secret')
      ),
      body := jsonb_build_object(
        'year', 2026,
        'score', true
      )
    ) as request_id;
  $$
);
