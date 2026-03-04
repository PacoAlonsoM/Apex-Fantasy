# Supabase Setup

This folder contains the database and Edge Function pieces needed for:

- league-specific forum posts via `posts.league_id`
- an ingested news feed via `news_articles`
- AI-generated race briefs via `ai_insights`

## 1. Run the migration

Run the SQL in:

- `supabase/migrations/20260302_league_forums_and_news.sql`
- `supabase/migrations/20260303_ai_race_insights.sql`

This adds:

- `posts.league_id`
- `news_articles`
- `news_ingest_runs`
- `ai_insights`
- `ai_insight_runs`
- helper indexes and policies

## 2. Deploy the news ingest function

The Edge Function lives at:

- `supabase/functions/news-ingest/index.ts`

Recommended secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEWS_INGEST_SECRET`

Example:

```bash
npx supabase secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
  NEWS_INGEST_SECRET="YOUR_LONG_RANDOM_SECRET"
```

Then deploy:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy news-ingest --no-verify-jwt
```

`--no-verify-jwt` is intentional here. This function is protected with the custom `x-ingest-secret` header instead of a user JWT.

## 3. Test the function

Call the function once manually and confirm rows land in `news_articles`.

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/news-ingest" \
  -H "x-ingest-secret: YOUR_LONG_RANDOM_SECRET"
```

## 4. What success looks like

After the curl request:

- `news_articles` should contain rows
- `news_ingest_runs` should contain a log row
- the in-app News page should stop showing the empty-state message

## 5. Automate the ingest

If you want this to run automatically, use the SQL template in:

- `supabase/news_ingest_schedule.sql`

That file:

- stores your project URL in Vault
- stores your `NEWS_INGEST_SECRET` in Vault
- schedules `news-ingest` every 30 minutes with `pg_cron`

Before running it:

- make sure the function is already deployed
- make sure `NEWS_INGEST_SECRET` is already set
- enable `pg_cron`, `pg_net`, and Vault in the Supabase dashboard
- replace the placeholders in the SQL file

Suggested cadence:

- race weekends: every 30 minutes
- off week: every 60 minutes

## 6. What the frontend expects

`src/components/NewsPage.jsx` reads:

- `id`
- `title`
- `summary`
- `url`
- `source`
- `published_at`
- `image_url`

Once the table has rows, the News page will render them automatically.

## 7. Deploy the AI race brief function

The Edge Function lives at:

- `supabase/functions/ai-race-brief/index.ts`

Recommended secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_ADMIN_USER_ID`

Example:

```bash
npx supabase secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_ANON_KEY="YOUR_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
  OPENAI_API_KEY="YOUR_OPENAI_API_KEY" \
  OPENAI_MODEL="gpt-4o-mini" \
  AI_ADMIN_USER_ID="YOUR_ADMIN_USER_ID"
```

Then deploy:

```bash
npx supabase functions deploy ai-race-brief
```

This function is designed for manual admin-triggered testing from the app. It uses the logged-in Supabase user token and only allows your admin user id.

## 8. What success looks like

After deploying the function and running it from the in-app Admin page:

- `ai_insights` should contain one row for `upcoming_race_brief`
- `ai_insight_runs` should contain a log row
- the News page should render an `AI Race Brief` block above the article feed
