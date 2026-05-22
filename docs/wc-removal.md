# WC Removal Manifest

This document lists the removable World Cup 2026 product slice. Everything named here is intentionally labeled `WC`, `wc`, or `world-cup`.

## Frontend folders and files

- `src/features/wc/`
- `src/lib/wc/`
- `src/constants/wc/`
- `app/world-cup/`

## API routes

- `app/api/wc/`
  - `bootstrap/route.js`
  - `picks/route.js`
  - `bracket/route.js`
  - `survivor/route.js`
  - `survivor/leaderboard/route.js`
  - `leagues/route.js`
  - `leagues/join/route.js`
  - `leagues/leave/route.js` (also serves owner-kick when `userId` set)
  - `leagues/[id]/standings/route.js`
  - `matches/[id]/consensus/route.js`
  - `_lib/wcServer.js`
- `app/api/admin/wc/`
  - `matches/update/route.js`
  - `results/publish/route.js`
  - `score/route.js`
  - `sync/route.js` (admin + Vercel cron + `WC_CRON_SECRET`)
  - `reset/route.js` (destructive, confirm-token gated)

## External data sources

- FIFA World Cup 26 official match schedule PDF, April 2026 — canonical source for `wc_matches` order, teams, slots, venues, and kickoff times. Stored in `src/constants/wc/fixtures.js` and `supabase/migrations/2026052201_wc_official_fixture_schedule.sql`.
- `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026` — public, no key, free tier. Used only by `app/api/admin/wc/sync/route.js` for result/status/scorer sync after matching an existing official group fixture. It must not rewrite official fixture teams, match numbers, kickoff times, or venues. Sync is idempotent and called by admin button, by the Vercel cron in `vercel.json` (every 15 min), or with `WC_CRON_SECRET` from an external pinger. The app never reads from TheSportsDB at request time.

## Vercel cron entry

`vercel.json` has a `crons[]` entry for `/api/admin/wc/sync?cron=1`. Remove the `crons` array when ripping the WC slice out, or leave it pointing at nothing — Vercel will surface a "missing path" warning but nothing breaks.

## Launch / one-shot scripts

- `scripts/wc-launch-reset.mjs` — wipes all WC user data and resets `wc_matches` back to `scheduled` with null scores. Run once before launch to clear staging data. Equivalent to the admin UI's "Reset WC platform" red button.

## App router pages

- `app/world-cup/page.jsx`
- `app/world-cup/fixtures/page.jsx`
- `app/world-cup/picks/page.jsx`
- `app/world-cup/bracket/page.jsx`
- `app/world-cup/leagues/page.jsx`
- `app/world-cup/profile/page.jsx`
- `app/world-cup/admin/page.jsx`

## Supabase objects

- Migrations:
  - `supabase/migrations/2026052001_wc_2026_prediction_platform.sql`
  - `supabase/migrations/2026052002_wc_survivor.sql`
  - `supabase/migrations/2026052101_wc_scorer_picks.sql`
  - `supabase/migrations/2026052201_wc_official_fixture_schedule.sql`
- Mock seed: `supabase/wc_mock_seed.sql`
- Tables:
  - `wc_teams`
  - `wc_matches`
  - `wc_match_predictions`
  - `wc_bracket_predictions`
  - `wc_leagues`
  - `wc_league_members`
  - `wc_score_runs`
  - `wc_survivor_picks`
- Functions:
  - `wc_set_updated_at`
  - `wc_is_league_member`
  - `wc_is_league_owner`
- Triggers:
  - `wc_matches_updated_at`
  - `wc_match_predictions_updated_at`
  - `wc_bracket_predictions_updated_at`
  - `wc_leagues_updated_at`
  - `wc_survivor_picks_updated_at`

## Shared integration points

- `src/shell/routing.js`
  - WC page ids prefixed with `wc-`
  - `/world-cup/*` route mappings
  - `isWcPage`
- `src/shell/StintApp.jsx`
  - `WCPage` import/render
  - WC theme CSS variable overrides
  - WC mode background and `BgCanvas` skip
  - WC footer sport prop
- `src/shell/Navbar.jsx`
  - WC sport switch
  - WC nav tabs
  - WC CTA redirects
- `src/ui/BrandLockup.jsx`
  - `descriptorText` prop used by WC mode
- `src/ui/LegalFooter.jsx`
  - WC legal disclaimer
- `src/lib/siteData.js`
  - WC public nav, footer, metadata entries
- `app/sitemap.js`
  - `/world-cup` URLs

## Environment variables

No WC-only environment variable is required for v1. WC backend routes use the existing Supabase/Vercel env contract:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

If WC-only config is added later, name it with `WC_` and list it here before shipping.

## Removal order

1. Remove `app/world-cup`, `app/api/wc`, `app/api/admin/wc`, `src/features/wc`, `src/lib/wc`, and `src/constants/wc`.
2. Remove the shared integration points listed above (search for `wc-`, `wcMode`, `isWcPage`, and the `WC` pill in `Navbar.jsx` to find every site).
3. Drop the `wc_` tables, triggers, functions, and policies from Supabase using the SQL below.
4. Remove WC URLs from `app/sitemap.js`.
5. Drop both migration files (`supabase/migrations/2026052001_wc_2026_prediction_platform.sql`, `supabase/wc_mock_seed.sql`) from the migrations history bucket if you replay migrations from scratch elsewhere.
6. Run the F1 smoke path and build to confirm the original product remains intact.

## Removal SQL

Run inside Supabase SQL editor or via `supabase db` once the tournament is over. Safe to re-run.

```sql
-- Tables (cascades drop triggers + indexes + policies)
drop table if exists public.wc_survivor_picks      cascade;
drop table if exists public.wc_score_runs          cascade;
drop table if exists public.wc_league_members      cascade;
drop table if exists public.wc_leagues             cascade;
drop table if exists public.wc_bracket_predictions cascade;
drop table if exists public.wc_match_predictions   cascade;
drop table if exists public.wc_matches             cascade;
drop table if exists public.wc_teams               cascade;

-- Helper functions
drop function if exists public.wc_is_league_member(uuid);
drop function if exists public.wc_is_league_owner(uuid);
drop function if exists public.wc_set_updated_at();
```

## Smoke checks before/after removal

- Sport switcher in the navbar disappears with the WC code removed; F1 nav remains.
- `/world-cup*` returns 404 after the `app/world-cup` directory is deleted (Next.js auto-revalidates).
- `npm run check:repo` and `npm run build` succeed.
- F1 predictions, AI insight, and leagues continue to behave unchanged.
