# Supabase Setup

This folder contains the database and Edge Function pieces needed for:

- league-specific forum posts via `posts.league_id`
- an ingested news feed via `news_articles`

## 1. Run the migration

Run the SQL in:

- `supabase/migrations/20260302_league_forums_and_news.sql`

This adds:

- `posts.league_id`
- `news_articles`
- `news_ingest_runs`
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

## 5. Schedule the function

Run it every 30 or 60 minutes. You can do that from the Supabase dashboard or by using a database cron job that calls the function URL.

Suggested cadence:

- race weekends: every 30 minutes
- off week: every 60 minutes

## 5. What the frontend expects

`src/components/NewsPage.jsx` reads:

- `id`
- `title`
- `summary`
- `url`
- `source`
- `published_at`
- `image_url`

Once the table has rows, the News page will render them automatically.
