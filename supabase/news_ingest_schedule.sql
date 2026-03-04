-- Automatic News Ingest Schedule
--
-- Run this after:
-- 1. deploying the `news-ingest` Edge Function
-- 2. setting the `NEWS_INGEST_SECRET` secret in Supabase
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
  'Supabase project URL for news-ingest cron'
);

select vault.create_secret(
  'YOUR_LONG_RANDOM_SECRET',
  'news_ingest_secret',
  'Header secret used by the news-ingest cron job'
);

-- Schedule the function every 30 minutes.
select cron.schedule(
  'news-ingest-every-30-min',
  '*/30 * * * *',
  $$
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/news-ingest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-ingest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'news_ingest_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
