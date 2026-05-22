# Supabase Setup

This folder contains the database and Edge Function pieces needed for:

- league-specific forum posts via `posts.league_id`
- an ingested news feed via `news_articles`
- AI-generated race briefs via `ai_insights`
- a synced live race calendar via `race_calendar`
- WC 2026 predictions via isolated `wc_` tables

## 1. Run the migration

Run the SQL in:

- `supabase/migrations/20260302_league_forums_and_news.sql`
- `supabase/migrations/20260303_ai_race_insights.sql`
- `supabase/migrations/20260325_race_calendar_sync.sql`

This adds:

- `posts.league_id`
- `news_articles`
- `news_ingest_runs`
- `ai_insights`
- `ai_insight_runs`
- `race_calendar`
- `race_calendar_sync_runs`
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
npx supabase functions deploy ai-race-brief --no-verify-jwt
```

This function is designed for manual admin-triggered testing from the app. It uses the logged-in Supabase user token and only allows your admin user id.

## 8. What success looks like

After deploying the function and running it from the in-app Admin page:

- `ai_insights` should contain one row for `upcoming_race_brief`
- `ai_insight_runs` should contain a log row
- the News page should render an `AI Race Brief` block above the article feed

## 9. Deploy the calendar sync function

The Edge Function lives at:

- `supabase/functions/calendar-sync/index.ts`

Recommended secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_ADMIN_USER_ID`
- `CALENDAR_SYNC_SECRET`

Then deploy:

```bash
npx supabase functions deploy calendar-sync --no-verify-jwt
```

This function supports either:

- an authenticated admin user from the app
- or the `x-calendar-sync-secret` header for cron jobs

## 10. What success looks like

After deploying the function and running it from the in-app Admin page:

- `race_calendar` should contain the active season schedule
- missing races from the source should be marked `cancelled`
- `race_calendar_sync_runs` should contain a log row
- the homepage, Calendar page, and Predictions page should stop relying on the stale hardcoded order

## 11. Automate the calendar sync

If you want this to run automatically, use the SQL template in:

- `supabase/calendar_sync_schedule.sql`

Suggested cadence:

- every 6 hours during the season
- manually from admin right after any official schedule change

## 12. WC 2026 backend

The removable World Cup product slice is created by:

- `supabase/migrations/2026052001_wc_2026_prediction_platform.sql` — teams, matches, predictions, brackets, leagues, score runs
- `supabase/migrations/2026052002_wc_survivor.sql` — survivor pool game mode

It creates only `wc_` tables, policies, helper functions and seed rows. User-facing WC actions run through Vercel/Next routes under:

- `app/api/wc/*` (public + auth: bootstrap, picks, bracket, survivor, leagues, consensus, standings)
- `app/api/admin/wc/*` (admin-gated: results/publish, matches/update, score, sync, reset)

### Real fixture data + automation

- The canonical WC fixture order, teams, venues, and kickoff times live in `src/constants/wc/fixtures.js` and `supabase/migrations/2026052201_wc_official_fixture_schedule.sql`, based on FIFA's published World Cup 26 schedule.
- The admin Sync button and the Vercel cron (`vercel.json` `crons[]`) both call `POST /api/admin/wc/sync`, which reads `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026` only for live result/status/scorer fields. It must not overwrite official match numbers, teams, kickoffs, or venues. Any newly completed match automatically rescores its predictions and the relevant survivor picks.
- `WC_CRON_SECRET` (optional) — set if you want an external pinger to call the sync route. Vercel cron is already authorized via Vercel's signed headers.

### Launch SOP

1. Push migrations: `npx supabase db query --linked --file supabase/migrations/2026052002_wc_survivor.sql` (and the platform migration if not already applied).
2. Clear staging/mock data: `node ./scripts/wc-launch-reset.mjs` (or, signed in as admin, click "Reset WC platform" in `/world-cup/admin`).
3. Confirm zero state: `/world-cup` → no completed matches, leaderboard empty, group tables all zeros.
4. Confirm official fixtures: `/api/wc/bootstrap` should return 104 matches and `fallback: false`.
5. Once matches start, either publish results manually in `/world-cup/admin` or let the cron sync status/scores from TheSportsDB. Every completed match is auto-scored.

Removal tracking lives in:

- `docs/wc-removal.md`
