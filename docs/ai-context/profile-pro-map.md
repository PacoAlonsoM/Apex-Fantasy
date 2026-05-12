# Profile & Pro — Page Map

Reference for AI sessions redesigning or extending the Profile, Pro, or ProSuccess pages.

---

## Routes

| Route | Component | File |
|---|---|---|
| `/profile` | `ProfilePage` | `src/features/profile/ProfilePage.jsx` |
| `/pro` | `ProPage` | `src/features/pro/ProPage.jsx` |
| `/pro/success` | `ProSuccessPage` | `src/features/pro/ProSuccessPage.jsx` |

All three are `"use client"` components rendered inside the main SPA shell (`app/app/[[...slug]]/page.jsx`). They receive `user` and `setPage` as props from the shell.

---

## ProfilePage

### Top-level areas

```
ProfilePage
├── PageHeader (page title + Pro badge)
├── Profile tab bar  [ Profile | History | Insights ]
│
├── Tab: Profile
│   ├── Avatar picker (color themes + team themes)
│   ├── Username editor (inline, with uniqueness check)
│   └── Support team selector (updates avatar_color + favorite_team)
│
├── Tab: History
│   ├── Season summary stats (total points, races entered, accuracy %, best race)
│   └── Race-by-race card list (per round: score, category breakdown)
│
└── Tab: Insights  [Pro-gated]
    ├── ProGate gate (shown to free users with SAMPLE_INSIGHTS preview)
    └── BreakdownPanel  (Pro users only)
        ├── Season accuracy grid (per-category bars)
        ├── AI Coach panel (strength/weakness summary, comparisonAvailable block)
        └── AI Replay History (admin-only: manual re-trigger button)
    └── Insight cards list
        ├── PrimaryInsightCard (first/pinned insight)
        └── InsightCard (remaining insights)
```

### Internal tab state

```js
const [profileTab, setProfileTab] = useState("profile"); // "profile" | "history" | "insights"
```

Tab active style: `rgbaFromHex(ACCENT, 0.13)` bg + `1px solid rgbaFromHex(ACCENT, 0.30)` border + `color: ACCENT` — canonical pill state.

### Key state

| Variable | Source | Purpose |
|---|---|---|
| `user` | prop (shell) | Auth + subscription status |
| `predictions` | supabase query on mount | All user picks, used for History tab and `buildSeasonBreakdown` |
| `seasonBreakdown` | derived from `predictions` | Per-category accuracy, streak, best race |
| `aiCoach` | `/api/admin/ai/generate-brief` GET | AI strength/weakness text |
| `aiHistory` | `/api/admin/ai/generate-brief` GET (history endpoint) | List of past AI insights |
| `visibleInsights` | derived from `aiHistory` | Filtered + sorted insight list |
| `editingUsername` | local bool | Controls inline username editor |
| `avatarColor` / `supportTeam` | local, mirrors `user.avatar_color` / `user.favorite_team` | Avatar picker selection |
| `insightGenerating` | local bool | AI generation in-flight |

### Module-scope components

- `InsightCard({ insight, isMobile })` — single past AI insight row
- `PrimaryInsightCard({ insight, isMobile })` — pinned/first insight, slightly larger card
- `BreakdownPanel({ breakdown, coach, history, isMobile, isTablet, onGenerate, generating, hasInsights, aiLoadError, aiMessage, isAdmin, onReplay, replayBusy })` — full Pro analytics panel

### Module-scope helpers

- `isScoredPrediction(prediction)` — true if `score_breakdown` is non-null
- `raceNameForRound(round)` — looks up `CAL` for race name
- `insightTypeLabel(type)` — `"post_race"` | `"pre_race"` | `"season"` → display label
- `parseJsonResponse(response, fallback)` — safe JSON parse with error handling
- `buildInsightRequestHeaders(userId, includeJson)` — builds auth headers for AI endpoints
- `persistSupportMetadata(payload)` — calls `supabase.auth.updateUser` with avatar/team data
- `average(values)` — filtered mean, returns null for empty arrays
- `buildSeasonBreakdown(predictions)` — derives all season stats from raw prediction rows
- `buildAiReplayHistoryAction` (inside component) — admin-only replay trigger

### Data sources

- `supabase` client (direct, not via API) — fetches `predictions` table
- `/api/admin/ai/generate-brief` — GET for AI coach + history, POST to generate new insight
- `supabase.auth.updateUser` — persists avatar color and favorite team to auth metadata

### Design notes

- `PANEL_BG` = BG_SURFACE (depth 1), `PANEL_BG_ALT` = BG_ELEVATED (depth 2)
- The `usePageMetadata` call is intentionally omitted in ProfilePage — the shell handles it
- `isAdminUser(user)` from design constants gates the AI Replay History panel

---

## ProPage

### Areas

```
ProPage
├── Hero section
│   ├── Background: hero-glow.png + glow orbs + grid overlay
│   ├── "Stint Pro" badge pill
│   ├── h1 headline
│   ├── Subheadline paragraph
│   └── CTA block
│       ├── [Free users]: PriceToggle + price display + checkout button
│       └── [Pro users]: "You're a member" badge + Manage Subscription button
│
├── League wayfinding section
│   ├── Copy: Pro league now lives in Leagues tab
│   ├── "View Pro League" button → openLeagues()
│   ├── [Free users]: pricing card + Join Pro button
│   └── [Pro users]: "Auto-entered" badge
│
└── Features grid
    └── 6× FeatureCard (game modes, AI insights, breakdown, leagues, settings, Pro entry)
```

### Module-scope components

- `FeatureCard({ title, items, isMobile })` — one feature category card
- `PriceToggle({ plan, onChange })` — Monthly / Full Season toggle

### Module-scope data

- `PRO_FEATURES` — array of `{ title, items: [{ label, detail }] }` feature groups

### Key state

| Variable | Purpose |
|---|---|
| `plan` | `"monthly"` \| `"season"` — selected pricing plan |
| `checkoutLoading` | Stripe checkout in-flight |
| `portalLoading` | Stripe portal in-flight |
| `error` | Inline error message |

### Handlers

- `openLeagues()` — navigates to community page via `setPage` or `pageToHref`
- `handleCheckout()` — calls `/api/stripe/checkout` with `{ plan }`, redirects to Stripe
- `handlePortal()` — calls `/api/stripe/portal` (no body), redirects to Stripe portal

### Design notes

- `isPro = user?.subscription_status === "pro"` — controls which CTA block renders
- Glow orbs and grid overlay are intentional hero decoration, not banned patterns
- Background image: `/images/hero-glow.png`

---

## ProSuccessPage

### Areas

```
ProSuccessPage
├── Confirmation hero
│   ├── 🏁 emoji
│   ├── h1 "You're in, {username}!"
│   ├── Description paragraph
│   └── "Go to Dashboard" CTA → href="/"
│
└── Next Steps grid (2 cols mobile / 4 cols desktop)
    ├── Pick a Game Mode → /leagues
    ├── Check Your Stats → /profile?tab=history
    ├── Get an AI Insight → /profile?tab=insights
    └── Pro Community → /leagues
```

### Notes

- Transient confirmation page — rendered after Stripe redirect
- `useEffect` scrolls to top on mount
- No persistent state; display-only
- `user?.username` — used in h1 greeting with `"Manager"` fallback

---

## What to remove / merge / simplify on redesign

### ProfilePage
- `PageHeader` import is used for the page title — when redesigning, inline it or use the shared pattern from Picks/Leagues redesign
- `PANEL_BG_STRONG` alias — already removed; do not reintroduce
- History tab is currently a flat list; consider grouping by season half or adding a mini chart
- `buildSeasonBreakdown` is 80+ lines — could be extracted to `src/lib/statsUtils.js` when a second page needs it
- The avatar/support team picker is inline in the Profile tab — could become `src/ui/AvatarPicker.jsx` when needed elsewhere

### ProPage
- Glow orbs and grid overlay in the hero are noted for design review — keep or replace during redesign
- `openLeagues` navigation helper duplicates a pattern in other pages; consolidate into routing utils when touched

### ProSuccessPage
- Small page (160 lines); no cleanup needed beyond what's done
- NEXT_STEPS array is static; could be driven by user state if more personalization is needed later
