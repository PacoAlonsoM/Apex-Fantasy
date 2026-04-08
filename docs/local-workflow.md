# Local Workflow

## Canonical setup

- Website repo: `~/Code/apex-fantasy`
- Add-on / video repo: keep separate
- Website owns `localhost:3000`
- Add-on / video owns `localhost:3002`
- The old Desktop copy is backup only and should not be used for dev or publish

## Website dev

```bash
cd ~/Code/apex-fantasy
npm start
```

What this does:

- forces Node 20 if available through `nvm`
- runs the website directly from the repo
- starts Next.js on `http://localhost:3000`
- fails clearly if `3000` is already taken

## Publish flow

Standard release path:

```bash
npm run check:repo
npm run check:env
npm run build
npm run smoke:local-admin
git push origin main
npm run smoke:prod
```

Or run the guarded release command:

```bash
npm run release:main
```

What that release path means:

- localhost must pass before `main` is pushed
- Vercel auto-deploys from `main`
- production verification is read-only
- if production smoke fails, treat it as a blocked release until fixed

## Working rules

- all website work happens in `~/Code/apex-fantasy`
- the Desktop copy is backup only
- if you did not push `main`, the change is not live
- if local gates are red, do not push to production
