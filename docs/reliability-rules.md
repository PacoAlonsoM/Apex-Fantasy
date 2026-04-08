# Reliability Rules

These are the rules that keep STINT from drifting back into the broken setup that caused the recent admin and deployment failures.

## Workspace rules

- Use one repo only: `~/Code/apex-fantasy`
- Do not run dev, git, or publish flows from the Desktop copy
- Treat backup copies as backup only

## Repo hygiene rules

- No accidental backup files like `* 2.js`, `* 2.jsx`, `* 2.ts`, or `* 2.tsx`
- No tracked `.env.local`, `.env`, `.stint-local`, or `.vercel` artifacts
- No production env change without updating `.env.example` and [docs/env-contract.md](./env-contract.md)

## Delivery rules

- No push to production unless local gates pass
- No production-only fix unless the localhost path is reproduced or explicitly checked
- Push live changes by updating `main`; Vercel deploys from `main`
- Always run read-only production verification after deploy

## Admin architecture rules

- No new admin write flow may depend only on browser token forwarding when a server-side path is available
- Route handlers stay thin: auth, readiness, orchestration
- Shared business logic belongs in reusable helpers, not duplicated between local routes and Supabase functions
- Optional downstream syncs should warn, not hide a successful primary write

## Runtime rules

- Public startup must fail clearly and diagnosably, never as a generic blank white screen
- Missing config should show a branded error page locally and fail the readiness endpoint in deploys
- Localhost and production must use the same env variable names

## Required checks

Run these before release:

```bash
npm run check:repo
npm run check:env
npm run build
npm run smoke:local-admin
```

After `main` is pushed and Vercel deploys:

```bash
npm run smoke:prod
```
