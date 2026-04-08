# STINT

STINT is the fantasy racing web app, admin control center, and data-sync stack that powers:

- live weekend state and predictions
- news ingest and AI race briefs
- admin-controlled result publishing and scoring
- synced race calendar and richer OpenF1 history context

## Canonical workspace

Use one repo only:

```bash
cd ~/Code/apex-fantasy
```

The old Desktop copy is backup-only and should not be used for dev, git, or production release work.

## Local start

```bash
npm start
```

That script:

- enforces the canonical repo path
- forces Node 20 if available through `nvm`
- installs dependencies if needed
- starts Next.js on `http://localhost:3000`
- fails clearly if port `3000` is already taken

## Required local workflow

1. Work in `~/Code/apex-fantasy`
2. Verify locally
3. Push `main`
4. Let Vercel auto-deploy from `main`
5. Run read-only production verification

The verification gates are:

```bash
npm run check:repo
npm run check:env
npm run build
npm run smoke:local-admin
npm run smoke:prod
```

For the full guarded release flow:

```bash
npm run release:main
```

## Environment contract

The supported public contract is Next.js-only:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Required server/admin contract:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RACE_RESULTS_SYNC_SECRET`

Optional integrations:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CALENDAR_SYNC_SECRET`
- `NEWS_INGEST_SECRET`

See [docs/env-contract.md](docs/env-contract.md) for the full contract and failure behavior.

## Reliability guardrails

- public startup config must fail clearly, never as a blank white screen
- localhost admin writes must use the server-side path when available
- no push to production unless local gates pass
- no backup files like `* 2.js` or `* 2.jsx` in the repo
- no production env change without updating `.env.example` and the env docs in the same change

See [docs/reliability-rules.md](docs/reliability-rules.md) and [docs/local-workflow.md](docs/local-workflow.md).

## Readiness

The app exposes a safe read-only readiness endpoint:

```bash
GET /api/health/readiness
```

It reports:

- app version and commit
- public env contract presence
- server env presence
- Supabase reachability
- admin capability flags

This is the endpoint that the production smoke test uses to catch deploy/config regressions before they waste time.

## Architecture map

See [docs/architecture.md](docs/architecture.md) for the route/shell/lib split and the ownership of the high-risk admin/data modules.
