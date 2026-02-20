# 🏎️ Apex Fantasy F1 — Setup Guide

> A complete Fantasy F1 platform with real accounts, live scoring, leagues, and auto-updating results.

---

## What You Need (all free)
- A **GitHub** account → github.com/signup
- A **Vercel** account → vercel.com (sign up with GitHub)
- A **Supabase** account → supabase.com (sign up with GitHub)
- **Node.js** installed → nodejs.org (click the big green LTS button)

---

## Step 1 — Set Up Supabase (your database + auth)

1. Go to **supabase.com** → click "New Project"
2. Name it `apex-fantasy`, choose any region, set a strong password
3. Wait ~2 minutes for it to provision
4. Click **SQL Editor** in the left sidebar
5. Copy the entire contents of `supabase/schema.sql` and paste it in
6. Click **Run** — this creates all your tables in one go ✓
7. Go to **Project Settings → API** and copy:
   - `Project URL` (looks like https://abc123.supabase.co)
   - `anon public` key
   - `service_role` key (scroll down, keep this secret!)

---

## Step 2 — Set Up Your Environment Variables

1. Rename `.env.local.example` to `.env.local`
2. Fill in your values from Step 1:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=any-random-string-you-make-up
```

---

## Step 3 — Run Locally (optional, to test before deploying)

Open your terminal (or VS Code's built-in terminal):
```bash
cd apex-fantasy
npm install
npm run dev
```
Then open http://localhost:3000 in your browser. 

---

## Step 4 — Deploy to Vercel (your live website)

**Option A — Drag & Drop (easiest):**
1. Go to vercel.com → "Add New Project" → "Continue with GitHub"
2. Create a new GitHub repo, upload this folder
3. Vercel auto-detects Next.js — click Deploy

**Option B — GitHub (recommended, enables auto-deploy):**
1. Install Git if you haven't: git-scm.com
2. Create a GitHub repo named `apex-fantasy`
3. In your terminal:
```bash
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/YOUR-USERNAME/apex-fantasy.git
git push -u origin main
```
4. Go to vercel.com → Import from GitHub → select `apex-fantasy` → Deploy

**After deploying, add your env variables in Vercel:**
1. Go to your project on Vercel → Settings → Environment Variables
2. Add all 4 variables from your `.env.local` file
3. Redeploy (Deployments → the latest → Redeploy)

---

## Step 5 — How Auto-Scoring Works

The file `pages/api/cron-score.js` runs automatically every 3 hours via Vercel Cron.

After each race weekend:
1. It fetches official results from the Ergast F1 API (free)
2. Compares every user's predictions against the results
3. Awards points and updates the leaderboard automatically

**You don't need to do anything** — it just works once the season starts.

---

## Editing Your App

Whenever you want to change the app:
1. Edit files locally in VS Code
2. Come back to Claude and paste your updated code for help
3. Run `git push` and Vercel auto-deploys in ~30 seconds

The main file to edit is: `pages/index.js`

---

## Architecture Overview

```
apex-fantasy/
├── pages/
│   ├── _app.js          — Auth context, session management
│   ├── index.js         — The entire app UI
│   └── api/
│       ├── leaderboard.js  — Public leaderboard endpoint
│       └── cron-score.js   — Auto-scoring (runs every 3 hours)
├── lib/
│   ├── supabase.js      — Supabase client
│   └── f1api.js         — Ergast + OpenF1 data fetching + scoring logic
├── supabase/
│   └── schema.sql       — All database tables (run once in Supabase)
├── .env.local           — Your secret keys (never commit!)
└── vercel.json          — Cron job schedule
```

---

## Supabase Tables

| Table | Purpose |
|---|---|
| `profiles` | User accounts (username, points, country) |
| `predictions` | Each user's picks per race |
| `race_results` | Official results (auto-filled by cron) |
| `leagues` | Private friend leagues |
| `league_members` | Who's in which league |
| `forum_posts` | Community discussion posts |
| `forum_comments` | Replies to posts |

---

## Need Help?

Paste any error messages back into this Claude chat and I'll fix them instantly.
