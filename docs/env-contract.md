# Environment Contract

STINT uses one environment naming contract across localhost and production. The names stay the same in both places even when the values differ.

## Required public contract

These names must exist in localhost and production:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Behavior:

- missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` blocks startup and renders the branded config error screen
- missing `NEXT_PUBLIC_SITE_URL` does not need to blank the app, but it fails readiness and release checks because the contract is incomplete

## Required server/admin contract

These names are required for localhost admin reliability:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RACE_RESULTS_SYNC_SECRET`

Behavior:

- critical admin writes must use the server-side service-role path when available
- if these are missing locally, the admin dashboard should disable the affected actions with a clear reason instead of failing mid-request

## Optional integrations

- `OPENAI_API_KEY`
  enables fully local OpenAI-backed AI brief generation
- `OPENAI_MODEL`
  defaults to `gpt-4.1`
- `CALENDAR_SYNC_SECRET`
  supports schedule sync fallback paths
- `NEWS_INGEST_SECRET`
  supports remote/news function secret-based flows
- `LOCAL_ADMIN_STORE_DIR`
  local file store for admin drafts and history helpers

## Unsupported public names

Legacy Create React App names are not part of the supported contract:

- `REACT_APP_PUBLIC_SITE_URL`
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_KEY`

If those exist without the `NEXT_PUBLIC_*` equivalents, the env check should fail.

## Source of truth

- `.env.example` is the documentation source of truth
- `.env.local` holds local developer values and must never be committed
- Vercel Environment Variables must mirror the same names for production

## Verification

Before release, run:

```bash
npm run check:env
```

After deploy, verify:

```bash
npm run smoke:prod
```
