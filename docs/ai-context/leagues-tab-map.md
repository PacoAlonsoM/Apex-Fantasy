# Leagues Tab Architecture Map

> Reference for AI work on `src/features/community/CommunityPage.jsx` and `src/features/standings/StandingsPage.jsx`.
> Last updated: 2026-04-21.

---

## 1. Route / Page Scope

| Route | Page component | File |
|---|---|---|
| `/leagues` (slug-based) | `CommunityPage` | `src/features/community/CommunityPage.jsx` |
| — | `StandingsPage` (embedded as `<StandingsPage compact />`) | `src/features/standings/StandingsPage.jsx` |

`CommunityPage` is the single file that owns the Leagues tab, Global Leaderboard, and F1 Standings tabs. All three are rendered inside the same component by switching `tab` state.

---

## 2. Top-Level Tab Structure

State: `const [tab, setTab] = useState("leagues")`

| `tab` value | Label | What renders |
|---|---|---|
| `"leagues"` | Leagues | League rail + in-league content panel (see §3) |
| `"leaderboard"` | Global Leaderboard | Full-width ranked list of all players |
| `"standings"` | F1 Standings | `<StandingsPage compact />` embedded inline |

Tab pill bar is rendered at the top of the content area, inside `CommunityPage`'s main `<main>` block.

---

## 3. Leagues Tab — In-League Sub-Tab Structure

State: `const [leagueView, setLeagueView] = useState("standings")`

The Leagues tab has a **two-column layout** at laptop width (CSS `@media(min-width:920px)` on `.stnt-leagues-section`):
- **Left rail** — league list (Pro featured card + user leagues + create/join actions)
- **Right content panel** — league header card + sub-tab pill strip + sub-tab view

| `leagueView` value | Label | Component | Extracted? |
|---|---|---|---|
| `"standings"` | Standings | `<LeagueStandingsView>` | Yes (component, ~line 427) |
| `"review"` | Round Review | `<LeagueReviewView>` | Yes (component, ~line 520) |
| `"chat"` | Chat | `<LeagueChatView>` | Yes (component, ~line 680) |
| `"setup"` | Rules | `<LeagueSetupView>` | Yes (component, ~line 850) |

---

## 4. Section-by-Section Detail

### 4.1 Leagues Tab — Left Rail

**Purpose:** League selector. Shows Pro board (always first), then user's private leagues, then create/join actions.

**Renders when:** `tab === "leagues" && user` (logged-in path)

**Key UI elements:**
- Pro league featured card (gold ring, `type === "pro_community"` badge)
- List of private leagues (mapped from `leagues` state)
- "Create league" button → opens `CreateLeagueModal`
- Join-by-code input + button

**State consumed:** `leagues`, `selectedLeagueId`, `visibleProLeague`, `joinCode`
**Callbacks:** `setSelectedLeagueId`, `setJoinCode`, `joinLeague`, `setShowCreateModal`

---

### 4.2 Leagues Tab — League Header Card

**Purpose:** Shows the selected league's name, type badge, member stats, sprint multiplier, prize grid (Pro only), and sub-tab pills.

**Renders when:** `currentLeague` is set, inside the right content panel

**Key UI elements:**
- League name (large heading)
- Code copy + Delete/Leave buttons (private leagues only)
- Pro: competing-count + leader pill + Viewing/Competing badge
- Non-Pro: 4-stat StatCard grid (Members / Leader / Average / Next race)
- Pro: PRO_LEAGUE_PRIZES grid
- Sub-tab pill strip (`stnt-vtab-strip` + `stnt-vtab` buttons)

**State consumed:** `currentLeague`, `currentStandings`, `leagueSummary`, `leagueView`, `isProUser`, `user`
**Callbacks:** `setLeagueView`, `deleteLeague`, `leaveLeague`

---

### 4.3 LeagueStandingsView

**File location:** top of `CommunityPage.jsx`, before `LeagueChatView`
**Renders when:** `leagueView === "standings"`

**Props:**
```js
{ currentLeague, currentStandings, leagueStandings, leagueSummary, isMobile, isTablet }
```

**Key UI elements:**
- Card header: leader AvatarChip (40px) + leader name + "Leading · N pts · M members"
- Gap chip (right side of header, only when `leagueSummary.gap > 0`)
- Column headers: # / Player / Pts
- Standings rows: rank color (gold/silver/bronze), AvatarChip, username, gap sub-label, points
- Scroll container: `maxHeight: isTablet ? 640 : 720, overflowY: "auto"`
- Loading / empty states

**Data sources:** `leagueStandings[currentLeague.id]` fetched by `fetchLeagueStandings(id)` on `selectedLeagueId` change

---

### 4.4 LeagueReviewView

**File location:** top of `CommunityPage.jsx`, after `LeagueStandingsView`
**Renders when:** `leagueView === "review"`

**Props:**
```js
{
  currentLeague, currentLeagueReview, currentLeagueRoundResult,
  selectedLeagueRoundMeta, scoredRounds, leagueReviewRound,
  setLeagueReviewRound, isMobile, isTablet
}
```

**Key UI elements:**
- Card header: round title + round-selector pill strip (`stnt-vtab-strip`)
- Result facts row: Winner / Pole / DOTD / Constructor chips (4-grid, 2-col on mobile)
- Per-member review cards (2-col grid on desktop, 1-col on tablet):
  - Rank + AvatarChip + username + season points
  - Round score + correct-call count
  - "Scored hits" chip list (green = race hits, blue = Perfect Podium bonus)
  - Race board table: Label / Pick / Result / ±pts (2-col on mobile, 4-col on desktop)
  - Sprint board table (same pattern, only rendered when `entry.sprintRows.length > 0`)
  - "Saved {timestamp}" footer
- Loading / empty / error states

**Data sources:**
- `scoredRounds` — from `fetchScoredRounds()` on mount
- `leagueRoundReviews["{leagueId}:{round}"]` — from `fetchLeagueRoundReview(leagueId, round, members)`
- `currentLeagueRoundResult` — derived from `leagueRoundReviews` or `scoredRounds`

**Key derived values:**
```js
const currentLeagueReviewKey = `${currentLeague.id}:${leagueReviewRound}`;
const currentLeagueReview    = leagueRoundReviews[currentLeagueReviewKey];
const currentLeagueRoundResult = currentLeagueReview?.resultRow
  || scoredRounds.find(r => Number(r.race_round) === Number(leagueReviewRound));
```

---

### 4.5 LeagueChatView

**File location:** ~line 680 in `CommunityPage.jsx`
**Renders when:** `leagueView === "chat"`

**Props:**
```js
{
  items, user, isMobile, authorProfiles, currentLeague,
  canPost, leagueMessage, setLeagueMessage, onSubmit,
  forumReady, setPage, openAuth
}
```

**Key UI elements:**
- Chat header: live dot + "Pro Race Room" / "League Chat" + Pro badge
- Message composer (textarea + "Send ↑" button) — only when `canPost`
- Viewing-only banner: "Read-only" (Pro board) or "Log in to reply" (not logged in)
- Message list (reverse-chronological, chat bubbles):
  - Own messages: right-aligned, orange gradient bubble, author chip right
  - Others: left-aligned, neutral bubble, author chip left, author name above message

**State consumed:** `leaguePosts[currentLeague.id]`, `canPostInCurrentLeague`, `leagueForumReady[currentLeague.id]`
**Callbacks:** `setLeagueMessage`, `submitLeaguePost`

**Feature gate:** `canPostInCurrentLeague = Boolean(user && (!isViewingProLeague || (isProUser && !!proLeague?.id)))`

---

### 4.6 LeagueSetupView (Rules)

**File location:** ~line 850 in `CommunityPage.jsx`
**Renders when:** `leagueView === "setup"`

**Props:**
```js
{
  currentLeague, currentLeagueScoring, currentLeagueTiebreakers,
  currentLeagueSprintMultiplier, currentLeagueDoublePointsRaces,
  isMobile, isTablet
}
```

**Key UI elements:**
- 3-tile top row: Format / Access / Sprint multiplier
- Scoring board: 4-col grid of scoring tiles (alternating orange/blue tones), each shows label + big pts number
  - Sprint multiplier badge + double-points-rounds badge in header
- Tiebreaker ladder: numbered list with blue chips

**Data sources:** Derived from `currentLeague.settings` in `CommunityPage`:
```js
const currentLeagueScoring       = { ...DEFAULT_LEAGUE_SETTINGS.scoring_weights, ...settings.scoring_weights };
const currentLeagueTiebreakers   = settings.tiebreaker_order || DEFAULT_LEAGUE_SETTINGS.tiebreaker_order;
const currentLeagueSprintMultiplier = Number(settings.sprint_multiplier ?? ...);
const currentLeagueDoublePointsRaces = settings.double_points_races?.length || 0;
```

---

### 4.7 Global Leaderboard Tab

**Renders when:** `tab === "leaderboard"`

**Key UI elements:**
- Hero section: hero-glow.png, title "Global standings", live/loading status dot, player-count chip, season leader chip (AvatarChip + username)
- Column headers: # / Player / Pts
- Rows (stnt-stagger): rank color, AvatarChip, username, sub-label, points
  - Own row: orange highlight + `outline: 1px solid hexToRgba(ACCENT, 0.18)`
  - Top-3: taller padding (14px), larger avatar (36px), larger rank/pts numbers
  - Sub-labels: "Season leader" / "Podium pace" / "Prize bracket" / "Active player" / "You"

**State consumed:** `leaderboard`, `loadingLB`, `user`
**Data source:** `fetchPublicCommunity()` on mount — queries `profiles` table ordered by `points`

---

### 4.8 F1 Standings Tab

**Renders when:** `tab === "standings"`

**What renders:** `<StandingsPage compact />` — fully delegates to the standalone StandingsPage component.

**StandingsPage file:** `src/features/standings/StandingsPage.jsx`
- Has its own `useViewport()` hook and sub-components (`StatCard`, `DriversTable`, `ConstructorsTable`)
- `compact` prop removes the PageHeader so it embeds cleanly inside Leagues page layout
- Drivers / Constructors sub-tab managed internally

---

### 4.9 Logged-Out Leagues Preview

**Renders when:** `tab === "leagues" && !user`

**Key UI elements:**
- Hero: Hero-Main.png background with gradient overlay
- "Pro League Preview" badge
- League name + description + Login / Join Pro / Open Global Leaderboard buttons
- Preview standings table: top-5 mock players (from `buildMockProStandings(user)`)

**Mock data:** `MOCK_PRO_USERS`, `MOCK_PRO_USERNAMES`, `buildMockProStandings()`, `buildMockProPosts()`
**Fallback league:** `FALLBACK_PRO_LEAGUE` (used when Supabase `pro_community` row hasn't loaded yet)

---

### 4.10 CreateLeagueModal

**Triggers:** "Create league" button in the left rail
**Renders via:** `createPortal(…, document.body)` — portal modal, not in main flow

**Steps (managed by `createStep` state):**
- Step 0: League name + visibility
- Step 1: Game mode selection
- Step 2: Scoring weights
- Step 3: Tiebreaker order
- Step 4: Extra categories + submit

**State consumed:** All the `league*` form states + `createError`, `createStep`
**Callbacks:** `createLeague`, `setShowCreateModal`

---

## 5. File / Component Ownership

```
CommunityPage.jsx
├── Utility functions (top of file)
│   ├── hexToRgba(hex, alpha)
│   ├── avatarTone(name)  →  avatarPalette
│   └── formatStamp(value)
│
├── Shared sub-components
│   ├── AvatarChip         — avatar with optional Pro pip
│   ├── StatCard           — label + large value card
│   └── normalizeProfileIdentity — merges user.avatar_color into profile
│
├── Constants
│   ├── LEAGUE_RACE_REVIEW_PROMPTS / LEAGUE_SPRINT_REVIEW_PROMPTS
│   ├── PRO_LEAGUE_PRIZES
│   ├── DEFAULT_LEAGUE_SETTINGS
│   ├── LEAGUE_VIEW_LABELS / MODE_LABELS / VISIBILITY_LABELS / TIEBREAKER_LABELS
│   ├── LEAGUE_SCORING_FIELDS / LEAGUE_EXTRA_CATEGORY_LABELS
│   ├── LEAGUE_MODES / LEAGUE_BONUS_CATEGORIES
│   └── inputStyle
│
├── Mock data
│   ├── FALLBACK_PRO_LEAGUE
│   ├── MOCK_PRO_USERS / MOCK_PRO_USERNAMES / MOCK_PRO_POST_BLUEPRINTS
│   ├── buildMockProStandings(user)
│   └── buildMockProPosts(leagueId, user)
│
├── Data utilities
│   ├── identityKey / isUuidLike / isProProfile
│   ├── mergeProfilesByIdentity / mergePostsByIdentity
│   ├── buildLeagueReviewRows / totalRowPoints / bonusPointsFromBreakdown
│   ├── resultValueForKey / roundMeta
│   └── formatDnfDrivers / matchesDnfPick  (imported from resultHelpers)
│
├── Sub-views (extracted components — props-only, no internal state)
│   ├── LeagueStandingsView  { currentLeague, currentStandings, leagueStandings, leagueSummary, isMobile, isTablet }
│   ├── LeagueReviewView     { currentLeague, currentLeagueReview, currentLeagueRoundResult, selectedLeagueRoundMeta, scoredRounds, leagueReviewRound, setLeagueReviewRound, isMobile, isTablet }
│   ├── LeagueChatView       { items, user, isMobile, authorProfiles, currentLeague, canPost, leagueMessage, setLeagueMessage, onSubmit, forumReady, setPage, openAuth }
│   └── LeagueSetupView      { currentLeague, currentLeagueScoring, currentLeagueTiebreakers, currentLeagueSprintMultiplier, currentLeagueDoublePointsRaces, isMobile, isTablet }
│
├── CreateLeagueModal        — portal modal with multi-step form
│
└── CommunityPage (default export)
    ├── State: tab, leagueView, leaderboard, leagues, leagueStandings, leaguePosts,
    │         leagueForumReady, scoredRounds, leagueReviewRound, leagueRoundReviews,
    │         selectedLeagueId, loadingLB, leagueMessage, show/form modal states, proLeague
    ├── Derived: currentLeague, currentStandings, currentLeaguePosts, leagueSummary,
    │            currentLeagueScoring, currentLeagueTiebreakers, currentLeagueReview,
    │            currentLeagueRoundResult, canPostInCurrentLeague, leagueView labels
    ├── Data fetchers: fetchPublicCommunity, fetchLeagues, fetchProLeague,
    │                  fetchLeagueStandings, fetchScoredRounds, fetchLeagueRoundReview,
    │                  fetchLeaguePosts, hydrateAuthorProfiles
    └── Mutations: createLeague, joinLeague, leaveLeague, deleteLeague, submitLeaguePost

StandingsPage.jsx
├── StatCard       — label + value stat chip
├── DriversTable   — full driver championship table
├── ConstructorsTable — full constructor championship table
└── StandingsPage  (default export)
    ├── Props: compact (bool) — hides PageHeader when true
    └── State: tab ("drivers" | "constructors"), data arrays, loading
```

---

## 6. Important State Map

| State | Type | Owner | Purpose |
|---|---|---|---|
| `tab` | `"leagues" \| "leaderboard" \| "standings"` | CommunityPage | Top-level tab |
| `leagueView` | `"standings" \| "review" \| "chat" \| "setup"` | CommunityPage | In-league subtab |
| `selectedLeagueId` | uuid \| null | CommunityPage | Which league is open in the right panel |
| `leagues` | array | CommunityPage | User's joined private leagues |
| `proLeague` | object \| null | CommunityPage | The Supabase pro_community league row |
| `leagueStandings` | `{ [leagueId]: member[] }` | CommunityPage | Standings per league, loaded on demand |
| `leaguePosts` | `{ [leagueId]: post[] }` | CommunityPage | Chat posts per league |
| `scoredRounds` | array | CommunityPage | Rounds with official results (from `race_results`) |
| `leagueReviewRound` | number \| null | CommunityPage | Which round the review subtab is showing |
| `leagueRoundReviews` | `{ ["id:round"]: review }` | CommunityPage | Cached review data per league+round |
| `leaderboard` | array | CommunityPage | Global player list (all profiles by points) |
| `authorProfiles` | `{ [userId]: profile }` | CommunityPage | Avatar/name cache for chat posts |

---

## 7. Data Sources

| Data | Supabase table(s) | Fetch function | Trigger |
|---|---|---|---|
| Global leaderboard | `profiles` | `fetchPublicCommunity` | Mount |
| Scored rounds | `race_results` | `fetchScoredRounds` | Mount |
| Pro league row | `leagues` where `type = pro_community` | `fetchProLeague` | Mount |
| User's leagues | `league_members` → `leagues` | `fetchLeagues` | `user` change |
| League standings | `league_members` → `profiles` | `fetchLeagueStandings(id)` | `selectedLeagueId` change |
| Chat posts | `posts` where `league_id` | `fetchLeaguePosts(id)` | `selectedLeagueId` change |
| Round review | `predictions` + `race_results` | `fetchLeagueRoundReview(id, round, members)` | `leagueReviewRound` or `currentLeague` change |
| Author profiles | `profiles` where `id IN (...)` | `hydrateAuthorProfiles(posts)` | After chat posts load |

---

## 8. Key Interactions

| Action | Handler | Effect |
|---|---|---|
| Click league in rail | `setSelectedLeagueId(id)` | Loads standings + posts for new league |
| Click sub-tab pill | `setLeagueView(value)` | Switches content area view |
| Click round pill in review | `setLeagueReviewRound(round)` | Triggers round review fetch if not cached |
| Send chat message | `submitLeaguePost()` | POST to `posts`, re-fetches posts |
| Create league | `createLeague()` → modal multi-step | Inserts to `leagues` + `league_members`, re-fetches |
| Join by code | `joinLeague(code)` | Upsert to `league_members`, re-fetches |
| Leave league | `leaveLeague(id)` | Delete from `league_members`, re-fetches |
| Delete league | `deleteLeague(id)` | Deletes from `leagues`, removes from local state |

---

## 9. Design Problems / Old Layers to Clean Up

### Banned patterns present
- None currently known in Leagues tab (cleaned up in 2026-04 redesign pass)

### Structural issues
- `AvatarChip` and `StatCard` are defined locally in both `CommunityPage.jsx` and `StandingsPage.jsx` — candidate for extraction to `src/ui/AvatarChip.jsx` and `src/ui/StatCard.jsx`
- `hexToRgba` is defined locally in both files — should be in `src/lib/colorUtils.js`
- `formatStamp` is local to `CommunityPage.jsx` — should be in `src/lib/textUtils.js`

### Content issues
- `LEAGUE_EXTRA_CATEGORY_LABELS` and `extraCategories` are wired to the Create modal but not surfaced anywhere in the Rules view — the feature exists in the form but has no review/display path
- Double-points rounds (`currentLeagueDoublePointsRaces`) are shown as a count badge but not listed round-by-round

### Mock data coupling
- `MOCK_PRO_USERS` and `MOCK_PRO_POST_BLUEPRINTS` are mixed into real data flows via `mergeProfilesByIdentity` and `mergePostsByIdentity` — the merge logic is load-bearing until real Pro users exist

---

## 10. What Should Be Removed / Merged / Redesigned (Future Work)

| Item | Action | Reason |
|---|---|---|
| Local `AvatarChip` in both files | Extract to `src/ui/AvatarChip.jsx` | Duplicated logic, drift risk |
| Local `StatCard` in both files | Extract to `src/ui/StatCard.jsx` | Same component, different files |
| Local `hexToRgba` in both files | Move to `src/lib/colorUtils.js` | Design-system utility, should be shared |
| Local `formatStamp` | Move to `src/lib/textUtils.js` | Text utility, reused across features |
| `leagueView === "setup"` label | Rename tab label from "Rules" to "Setup" or keep "Rules" | "Setup" is the internal key but "Rules" is what users see — verify intent |
| Create modal step 4 (extra categories) | Wire display into `LeagueSetupView` | Feature exists in form but has no display |
| `PANEL_BG_STRONG` alias | Remove on contact | Dead alias — identical to `PANEL_BG` |
| Logged-out preview | Consider standalone `<LeaguePreviewCard>` component | Currently 60+ lines inline in main component |
