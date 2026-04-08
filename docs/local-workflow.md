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

Link the repo once:

```bash
npm run publish:whoami
npm run publish:link
```

Then publish manually only when you want production updated:

```bash
npm run publish:preview
npm run publish:prod
```

## Working rule

Changes requested during development stay local by default.

If you did not run a `publish:*` command, the change is not live.
