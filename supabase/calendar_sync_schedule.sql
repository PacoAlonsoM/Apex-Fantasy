-- Automatic Calendar Sync Schedule
--
-- Run this after:
-- 1. deploying the `calendar-sync` Edge Function
-- 2. setting the `CALENDAR_SYNC_SECRET` secret in Supabase
-- 3. enabling `pg_cron`, `pg_net`, and Vault in the Supabase dashboard
--
-- Replace BOTH placeholders before running:
--   YOUR_PROJECT_REF
--   YOUR_LONG_RANDOM_SECRET
--
-- Create Vault secrets once.
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'project_url',
  'Supabase project URL for calendar-sync cron'
);

select vault.create_secret(
  'YOUR_LONG_RANDOM_SECRET',
  'calendar_sync_secret',
  'Header secret used by the calendar-sync cron job'
);

-- Schedule the function every 6 hours.
select cron.schedule(
  'calendar-sync-every-6-hours',
  '0 */6 * * *',
  $$
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/calendar-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-calendar-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_sync_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
