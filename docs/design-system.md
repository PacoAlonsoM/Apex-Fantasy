# STINT Design System

> Reference document for all tab redesigns. Read this before touching any page.
> Last updated: 2026-04-21. Picks page and Leagues tab redesigned — this is the current reference.

---

## 1. Brand Personality

**Fast. Precise. Tense.**

Like a timing screen in the garage — dense data, high contrast, everything communicating state. Not flashy for flash's sake. Every color and weight means something. This is not a lifestyle app. It is a competitive tool used by people under deadline pressure.

Anti-references: bubbly dark-mode dashboards with glowing gradients and lots of whitespace. No empty "breathing room." No decorative noise.

---

## 2. Color System

All colors live in `@/src/constants/design.js`. Import from there — never hard-code a hex value that already has a token.

### Depth Stack (4 levels, no more)
```
BG_BASE      #06101B  — page background (outer shell, body)
BG_SURFACE   #0E1929  — panel / card surface (= PANEL_BG)
BG_ELEVATED  #152338  — nested card / alt row (= PANEL_BG_ALT)
BG_HOVER     #1E304A  — hover state on interactive items
```

Every component sits on one of these four levels. Never invent a 5th level. Never use raw hex `#111827`, `#0f172a`, or `rgba(14,25,41,...)` — these are approximations of `BG_SURFACE` or `BG_ELEVATED` and should be replaced.

### Semantic Colors
```
ACCENT       #FF6A1A  — urgency, action, Pro features (use sparingly)
WARM         #FFC247  — secondary accent, pairs with ACCENT in gradients
SUCCESS      #22C55E  — complete, scored, confirmed
SPRINT       #A855F7  — sprint-weekend context
DANGER       #EF4444  — risk, error, locked-out
INFO / AI    #3B82F6  — AI-generated content (blue signal, NOT brand)
```

**ACCENT and blue must never be swapped.** Orange = Pro/brand urgency. Blue = AI signal. This is load-bearing.

### Text Levels
```
TEXT_PRIMARY  #F6F7FB                    — headlines, selected, active
MUTED_TEXT    rgba(214,223,239,0.74)     — body, secondary labels
SUBTLE_TEXT   rgba(214,223,239,0.62)     — captions, metadata, disabled
```

Minimum readable size is 12px at MUTED_TEXT. Never put SUBTLE_TEXT below 11px. Nothing below 10px, ever.

### Borders and Separators
```
PANEL_BORDER  1px solid rgba(214,223,239,0.08)  — panel outer ring
HAIRLINE      rgba(214,223,239,0.08)            — row separators, interior lines
EDGE_RING     inset 0 1px 0 rgba(255,255,255,0.04)  — top edge highlight on panels
```

Use HAIRLINE for all row separators and interior dividers. Use `borderBottom` with HAIRLINE — never `borderTop` on the first child.

### Dead Token: `PANEL_BG_STRONG`
`PANEL_BG_STRONG` is **identical** to `PANEL_BG`. It is a dead alias. Remove every reference to it when touching a page, then remove it from design.js once all references are gone.

### Status Tokens
```
SUCCESS_TEXT/BG/BORDER  — green (#86efac / rgba(34,197,94,0.08) / rgba(34,197,94,0.24))
WARN_TEXT/BG/BORDER     — amber (#fcd34d / rgba(252,211,77,0.08) / rgba(252,211,77,0.24))
ERROR_TEXT/BG/BORDER    — red (#fca5a5 / rgba(239,68,68,0.08) / rgba(239,68,68,0.24))
```

These are in design.js. Use them — never reinvent status colors inline.

---

## 3. Typography

Fonts: **Sora** (display, headlines) · **Manrope** (body, UI)

### Hierarchy Levels

| Role | Font | Size | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| Hero title | Sora | 28–54px (clamp) | 900 | -0.06em | Page hero only, one per page |
| Section title | Sora | 22–32px | 800–900 | -0.04em | Panel headers, major sections |
| Card title | Sora | 16–20px | 800 | -0.03em | Card headlines |
| Body | Manrope | 13–14px | 400–500 | -0.01em | Paragraph text |
| Label strong | Manrope | 12–13px | 700–800 | -0.01em | Interactive labels |
| Caption / kicker | Manrope | 10–11px | 800 | 0.08–0.12em, uppercase | Section kickers, eyebrow labels, badges |
| Metadata | Manrope | 10–11px | 600–700 | normal | Timestamps, secondary data |

### Hard Rules
- **Minimum 10px everywhere.** 11px for anything that must be read (not just scanned).
- `fontVariantNumeric: "tabular-nums"` on all numeric displays (scores, point counts, standings).
- `letterSpacing: -1` or negative tracking on display titles (28px+) — compressed = fast.
- Sora for headings, Manrope for everything else. Never flip these.
- `TYPE_SCALE` and `SPACE` constants in design.js exist but are not yet used. Don't block redesigns waiting for them.

---

## 4. Spacing

Base grid: **4pt** (the SPACE token uses 8pt but 4pt gives needed granularity).

```
4   — tight inline (icon + label gap)
6   — compact inline
8   — related elements in a row
12  — related elements in a column
14  — compact card padding horizontal
16  — standard card padding
18  — comfortable card padding
20  — generous card padding
24  — section gap, between cards in a grid
32  — between major sections within a page
48  — between top-level sections
```

Use `gap` for flex/grid spacing — avoid margins between siblings. Margins on containers only.

### Touch Targets
- Mobile tap targets: `minHeight: 44px`
- Desktop interactive: `minHeight: 36px`
- Pill buttons: `padding: "8px 14px"` (desktop), increase to `"10px 16px"` on mobile

---

## 5. Border Radius

```
RADIUS_SM     8px   — small chips, badges, inline code
RADIUS_MD    12px   — option cards, inputs, compact panels
RADIUS_LG    16px   — stat cards, standard data panels
RADIUS_XL    20px   — medium panels
SECTION_RADIUS 24px — outermost page sections, hero panels
RADIUS_PILL  999px  — pills, tags, filter buttons
CARD_RADIUS = RADIUS_LG (16px)
```

Rule: `SECTION_RADIUS` for outermost container of each page section. `CARD_RADIUS` for cards within that section. `RADIUS_MD` for interactive option items and inputs.

---

## 6. Shadows

```
CARD_SHADOW    0 4px 16px rgba(2,6,23,0.18)   — minimal depth on flat cards
SOFT_SHADOW    0 22px 46px rgba(2,6,23,0.24)  — raised panels
LIFTED_SHADOW  0 28px 72px rgba(2,6,23,0.3)   — hero/focal panels, Pro content
```

Selected states may use a color-tinted shadow: `0 14px 30px rgba(255,106,26,0.18)` for orange-active items.

---

## 7. Panel Pattern

Every major content block uses this structure:

```jsx
<section style={{
  borderRadius: SECTION_RADIUS,
  border: PANEL_BORDER,
  background: PANEL_BG,
  boxShadow: SOFT_SHADOW,
  overflow: "hidden",
}}>
  {/* Panel header */}
  <div style={{
    padding: "12px 18px",
    borderBottom: `1px solid ${HAIRLINE}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: PANEL_BG_ALT,
  }}>
    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
      Section Label
    </span>
    {/* optional action or count */}
  </div>

  {/* Panel body */}
  <div style={{ padding: "16px 18px" }}>
    {/* content */}
  </div>
</section>
```

Panels are **never nested more than two levels deep**: page section → card. Never page section → card → card.

The panel gradient `linear-gradient(180deg, rgba(255,255,255,0.03), rgba(14,25,41,0.98))` seen in some pages is a dead pattern — it's an approximation of `PANEL_BG` with irrelevant noise. Replace with `PANEL_BG` directly.

---

## 8. Card Pattern

Standard data card:
```jsx
<div style={{
  borderRadius: CARD_RADIUS,
  border: PANEL_BORDER,
  background: PANEL_BG_ALT,
  padding: "14px 16px",
}}>
  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
    Label
  </div>
  {/* card content */}
</div>
```

Interactive option cards (driver, constructor picks):
- Default: `PANEL_BG` bg + `PANEL_BORDER`
- Hover: team color bg at 7% + team color border at 22%
- Selected: team color gradient bg (18%→6%), team color border at 52%, shadow
- These are Picks-page-specific — do not apply this pattern to general cards

---

## 9. Active / Selected State — The Canonical Standard

This is the system-wide active state pattern. Use it everywhere a pill, tab, filter button, or list item can be selected/active.

### Tab / Pill / Filter Button
```jsx
// Active
background: hexToRgba(ACCENT, 0.13),
border: `1px solid ${hexToRgba(ACCENT, 0.30)}`,
color: ACCENT,
transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",

// Inactive
background: "transparent",
border: "1px solid rgba(148,163,184,0.14)",
color: MUTED_TEXT,
```

### Rail / List Item (row in a list, league selector, round nav)
```jsx
// Active
background: hexToRgba(ACCENT, 0.07),
outline: `1px solid ${hexToRgba(ACCENT, 0.18)}`,
outlineOffset: -1,

// Active Pro / amber context (e.g. Pro League button)
background: "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(14,25,41,0.98))",
outline: "1px solid rgba(245,158,11,0.30)",
outlineOffset: -1,
```

### What to Stop Using
| Old pattern | Replace with |
|---|---|
| `background: "linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,24,44,0.96))"` | `hexToRgba(ACCENT, 0.13)` |
| `border: "1px solid rgba(248,250,252,0.14)"` | `1px solid ${hexToRgba(ACCENT, 0.30)}` |
| `color: "#fff"` on active tab | `color: ACCENT` |
| `boxShadow: "inset 3px 0 0 ACCENT"` | `outline` with negative offset (see above) |
| `borderLeft: "3px solid ..."` | banned, see section 15 |
| `background: "rgba(255,106,26,0.16)"` + no border change | use full 3-property pattern above |

`hexToRgba` is defined as a module-scope function in CommunityPage — it should be moved to `@/src/lib/colorUtils.js` and imported wherever needed.

---

## 10. Navigation Treatment

### Top Nav (Navbar.jsx)
The Navbar is complete and correct. Do not redesign it. Active tab uses:
- `border: 1px solid ACCENT`
- Bottom bar gradient (`linear-gradient(90deg, ACCENT, WARM)`)
- `boxShadow: "0 14px 30px rgba(255,106,26,0.18)"`

This is the highest-fidelity active indicator in the product. Other active states are intentionally quieter.

### In-page Tab Switchers
Use the canonical pill pattern from section 9. The community tab switcher (Leagues / Leaderboard / Standings) at the top of CommunityPage still uses the old white-gradient pattern — update it when doing the next community cleanup pass.

### Rail / List Nav
Rail items use the `outline` approach (section 9). No `borderLeft` stripes.

---

## 11. Status / State Treatment

Every interactive page region has exactly one of five states:

| State | Accent | Signal |
|---|---|---|
| Open | `ACCENT` (#FF6A1A) | Orange border + bg tint |
| In Progress | `#F59E0B` (amber) | Amber border + bg tint |
| Complete | `SUCCESS` (#22C55E) | Green border + bg tint |
| Locked | `#60A5FA` (blue) | Blue border + bg tint |
| Scored | `SUCCESS` | Green border + score display |

Status is **always** communicated with both a border color AND a background tint at 8-12% opacity. Never just one signal alone.

Status badge pattern:
```jsx
<span style={{
  borderRadius: RADIUS_PILL,
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: STATUS_BG,
  border: `1px solid ${STATUS_BORDER}`,
  color: STATUS_TEXT,
}}>Label</span>
```

---

## 12. AI Feature Treatment

AI content uses **blue** as its signal — distinct from the orange ACCENT reserved for Pro/brand.

```
AI color:   #60A5FA
AI border:  rgba(96,165,250,0.16)
AI bg:      rgba(59,130,246,0.06)
AI text:    rgba(147,197,253,0.75)
```

AI Insight label pattern:
```jsx
<span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#60A5FA" }}>
  AI Insight
</span>
```

AI confidence display: use `confPct(key, pick, rawConf)` from PredictionsPage. This produces per-pick hash-based percentages in calibrated tiers (high: 68–82%, medium: 52–66%, low: 34–48%). Never show flat percentages or the same value for every pick.

For Pro-gated AI content: show first 1–2 items fully visible, blur/fade the rest, add compact upgrade prompt.

---

## 13. Pro Feature Treatment

Pro uses **ACCENT** (`#FF6A1A`) as its signal — brand orange = urgency = upgrade is the most important action.

Pro badge (pill):
```jsx
<span style={{
  fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
  color: ACCENT,
  background: hexToRgba(ACCENT, 0.10),
  borderRadius: RADIUS_PILL,
  padding: "2px 7px",
  border: `1px solid ${hexToRgba(ACCENT, 0.22)}`,
}}>PRO</span>
```

Pro Community League uses amber (`#f59e0b / #d97706`) as a secondary color within Pro context — because the season competition has its own premium feel separate from the brand orange. The amber is reserved for Pro Community and prize content only.

Upgrade CTA button:
```jsx
<button style={{
  background: BRAND_GRADIENT,
  border: "none",
  borderRadius: RADIUS_MD,
  color: "#fff",
  fontSize: 13, fontWeight: 800,
  padding: "12px 16px",
}}>Upgrade to Pro</button>
```

---

## 14. Image and Media Rules

Images are first-class. They make STINT feel human, editorial, and premium. Stripping images leaves a pure data tool. The product goal is a competitive tool that also feels like a destination — images support that.

### When to Use Images

**Hero/header sections** — use `<PageHeader bgImage="..." />` or equivalent:
- Full-bleed image behind text with `position: absolute, inset: 0, objectFit: cover`
- Gradient overlay: `linear-gradient(180deg, rgba(6,16,27,0.35) 0%, rgba(6,16,27,0.88) 65%, rgba(6,16,27,1) 100%)`
- Image opacity: 35–45% desktop, 22–30% mobile
- Text content is always on a `position: relative` layer above the image

Current header images available:
- `/images/Hero-Main.png` — race action, used for Pro League panel
- `/images/hero-glow.png` — atmospheric glow, used in StandingsPage
- `/images/header-calendar.png` — calendar page header
- `/images/header-insight.png` — wire/insight page header
- `/images/header-wire.png` — wire page (alternate)

**Content cards (Wire/News):**
- Lead image at top: `height: 120–160px`, `borderRadius: 16–18px`, `overflow: hidden`
- When no image: source-specific gradient placeholder at the same height — never collapse the card
- `NewsVisual` in NewsPage.jsx is the reference implementation for this

**Calendar race cards:**
- Flag images at 48×32px with `borderRadius: 4px` — already implemented well
- Circuit images: currently broken (`display: "none"` on the container). Either commit to loading the circuit image with `onLoad` reveal, or remove the dead block. Don't ship a `display: "none"` div.

**Podium / premium context:**
- Use `/images/Hero-Main.png` as background for Pro League and competition headers at 22–40% opacity
- This is what we established in the CommunityPage redesign

**What NOT to do:**
- No generic stock imagery without race-specific context
- No broken image states — always provide a gradient fallback
- No images inside chips or badges (< 48px height)
- No `display: "none"` image containers waiting to appear — either commit or remove
- No `width: 100%; height: 100%` without `objectFit: cover` (stretching)

### Image Fallback Pattern (required on every image)
```jsx
const [imgFailed, setImgFailed] = useState(false);

{article.image_url && !imgFailed ? (
  <img
    src={article.image_url}
    onError={() => setImgFailed(true)}
    style={{ width: "100%", height: "100%", objectFit: "cover" }}
  />
) : (
  <div style={{ background: gradientFallback, height: sameHeight, borderRadius: sameRadius }} />
)}
```

---

## 15. Absolute Bans

These patterns are permanently banned from all STINT UI:

1. **`border-left > 1px` accent stripes** — absolute ban. Use full borders, background tints, or `outline` with negative offset.
2. **`inset N px 0 0 color` box-shadow as a left stripe** — same concept, also banned. Specifically: `boxShadow: "..., inset 3px 0 0 ${ACCENT}"` in CalendarPage RaceRow.
3. **3px top-bar stripes** (`height: 3, background: gradient`) — they're just side stripes rotated. Also banned. CalendarPage detail panel still has one.
4. **Gradient text (`background-clip: text`)** — banned except the single intentional use in the home hero.
5. **`fontSize` below 10** — hard floor, no exceptions.
6. **`PANEL_BG_STRONG`** — dead alias for `PANEL_BG`. Remove on contact.
7. **`display: "none"` content blocks waiting to appear** — commit or delete.
8. **Old tab active state** (`linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,24,44,0.96))`) — use the canonical active pattern from section 9.
9. **Inline panel gradient** (`linear-gradient(180deg,rgba(10,18,32,0.98),${PANEL_BG_STRONG})`) — replace with `PANEL_BG`.

---

## 16. Motion Principles

All transitions use the strong ease-out: `cubic-bezier(0.23, 1, 0.32, 1)`. Never ease-in for UI.

| Element | Duration | Notes |
|---|---|---|
| Tab/filter active state | 120ms | `transition: background 120ms ease, border-color 120ms ease, color 120ms ease` |
| Button hover | 120ms | opacity or background only |
| Button press | 100ms | `scale(0.97)` via `:active` or pressable class |
| Panel reveal | 160–200ms | `fadeUp` animation (from global CSS) |
| Score reveal | 260ms | only on scored state entry |

**Never animate keyboard-initiated actions.** Only animate transitions users see a handful of times per session.

`prefers-reduced-motion` is handled globally in index.css — no per-component handling needed unless adding custom animations.

---

## 17. Shared Components

These live in `@/src/ui/` and should be imported, never re-implemented.

### Already Shared (use these now)
| Component | File | Notes |
|---|---|---|
| `PageHeader` | `PageHeader.jsx` | Use for every page hero — **StandingsPage needs migration** |
| `ProPip` | `ProPip.jsx` | Small Pro dot indicator |
| `ProBadge` | `ProBadge.jsx` | Pro badge component |
| `ProGate` | `ProGate.jsx` | Used in ProfilePage |
| `BrandLockup` | `BrandLockup.jsx` | Used in Navbar |

### Needs to Be Created (create when first needed, not before)
| Component | Location | Consolidating from |
|---|---|---|
| `AvatarChip` | `src/ui/AvatarChip.jsx` | CommunityPage.jsx + GridPage.jsx (identical implementations) |
| `StatCard` | `src/ui/StatCard.jsx` | StandingsPage + CommunityPage + CalendarPage `StatBox` |
| `FilterPill` | `src/ui/FilterPill.jsx` | CalendarPage `FilterButton` + all in-page tab systems |
| `StatusBadge` | `src/ui/StatusBadge.jsx` | Inline status chip pattern used in 4+ files |

### Needs to Be Extracted (move to lib)
| Utility | Destination | Currently in |
|---|---|---|
| `previewText()` | `src/lib/textUtils.js` | NewsPage.jsx + CommunityPage.jsx (duplicated) |
| `hexToRgba()` | `src/lib/colorUtils.js` | CommunityPage.jsx only (should be shareable) |
| `avatarTone()` + `avatarPalette` | `src/lib/avatarUtils.js` or co-locate with `AvatarChip` | CommunityPage.jsx + GridPage.jsx (duplicated) |
| `formatStamp()` | `src/lib/textUtils.js` | CommunityPage.jsx + GridPage.jsx (likely duplicated) |

---

## 18. Per-Page Cleanup Manifest

These are the concrete patterns to remove (or fix) in each page. Do this as part of the page redesign — not before, not separately.

### StandingsPage.jsx
- [ ] Remove `PANEL_BG_STRONG` import — replace with `PANEL_BG`
- [ ] Replace `background: linear-gradient(180deg,rgba(10,18,32,0.98),${PANEL_BG_STRONG})` with `background: PANEL_BG`
- [ ] Migrate the custom hero section to `<PageHeader>` (currently StandingsPage builds its own, unlike every other page)
- [ ] Sub-tabs ("Drivers / Constructors") need to use the canonical active state pattern (section 9)
- [ ] `StatCard` defined locally — when `src/ui/StatCard.jsx` exists, switch to it

### CalendarPage.jsx
- [ ] Kill the 3px top-bar stripe on the detail panel: `<div style={{ height: 3, background: "linear-gradient(90deg,${ACCENT},${rc(sel)},transparent)" }} />`
- [ ] Kill the inset side-shadow in `RaceRow` active state: `boxShadow: active ? "..., inset 3px 0 0 ${ACCENT}" : ...` — use the `outline` pattern instead
- [ ] Either commit to the circuit image (`display: "none"` → proper `onLoad` reveal with gradient fallback) or remove the dead image block entirely
- [ ] `FilterButton` uses inconsistent active pattern — update to canonical section 9 style
- [ ] `StatBox` defined locally — replace with shared `StatCard` when it exists
- [ ] `background: "linear-gradient(180deg,rgba(255,255,255,0.03),rgba(14,25,41,0.98))"` in StatBox → replace with `PANEL_BG_ALT`

### NewsPage.jsx (Wire / Insight)
- [ ] `previewText()` defined locally — move to `src/lib/textUtils.js` and import
- [ ] Review all hardcoded source-specific colors in `SOURCE_VISUALS` — these are intentional editorial choices, keep them, but ensure they use HAIRLINE for separators not raw `rgba(214,223,239,0.08)`
- [ ] AI Brief section headers should use the canonical blue AI signal pattern (section 12)
- [ ] Confirm confidence display uses `confPct()` pattern or real AI data — not flat percentages

### CommunityPage.jsx
- [ ] **Community tab switcher** (Leagues / Leaderboard / Standings, lines ~1503–1523) still uses old white-gradient active pattern — update to canonical section 9 style
- [ ] `avatarPalette` + `avatarTone()` defined locally — move to shared utility when `AvatarChip` is extracted
- [ ] `hexToRgba()` defined locally — move to `src/lib/colorUtils.js` when creating the utility
- [ ] `previewText()` defined locally — move to `src/lib/textUtils.js`
- [ ] `inputStyle` object defined inline — acceptable, but if ProfilePage also has one, consolidate to `src/lib/inputStyles.js`

### GridPage.jsx
- [ ] `AvatarChip` defined locally (identical to CommunityPage) — when `src/ui/AvatarChip.jsx` exists, switch to it
- [ ] `avatarPalette` + `avatarTone()` defined locally (same as CommunityPage) — deduplicate
- [ ] `formatStamp()` likely duplicated — consolidate

### ProfilePage.jsx
- [ ] Uses `BG_ELEVATED` directly — this is fine (`BG_ELEVATED` = `PANEL_BG_ALT`), just confirm it's used consistently
- [ ] `inputStyle` object defined locally — if same as CommunityPage, consolidate
- [ ] Profile sub-tabs need canonical active state treatment (section 9)
- [ ] AI Coach section — ensure it uses the blue AI signal, not orange

### Navbar.jsx
- [ ] Navbar is correct. Do not redesign it. Only touch it if fixing a bug or adding a required feature.

---

## 19. Image Usage by Page

Concrete guidance on where images should appear when each page is redesigned:

| Page | Image Usage |
|---|---|
| **Wire / Insight** | Article thumbnails as full-width card lead images. Gradient fallback per `NewsVisual`. Featured article gets larger treatment (160–200px image). Keep source-specific gradient fallbacks. |
| **Calendar** | Flag images (already correct). Circuit images: implement `onLoad` reveal or remove dead block. PageHeader with `header-calendar.png` (already done). |
| **Standings** | `hero-glow.png` is already well-used in the hero. Migrate to `<PageHeader>` — keep the glow image. Driver rows: no images, team color is the visual signal. |
| **Grid (Forum)** | PageHeader already present. No article images needed. AvatarChip is the identity signal. |
| **Profile** | PageHeader present. No hero image needed beyond existing treatment. AI Coach section: no imagery needed. History charts are the visual. |
| **Home** | Redesigned last. Will use `Hero-Main.png` or dedicated race photo as background. |

---

## 20. Redesign Order (Remaining)

Status as of last session:
- ✅ **Picks (PredictionsPage)** — reference implementation, complete
- ✅ **Leagues / Community (CommunityPage)** — major redesign complete; community tab switcher still needs canonical active state (small cleanup item)

Remaining, in order:

### 1. Wire / Insight — `NewsPage.jsx` ← **START HERE**
**Why first:**
- Has the highest image density in the product (article thumbnails from 8 sources)
- Two modes (Wire + AI Brief) that establish how AI-signal content should look across the whole app
- Currently the most dated hierarchy — section headers inconsistent, AI Brief has no confidence display
- Fixing it establishes the card hierarchy, image fallback pattern, and AI section treatment that cascades to everything downstream
- The `previewText` extraction should happen here (one of the two defining instances)

### 2. Calendar — `CalendarPage.jsx`
**Why second:**
- Has clear banned patterns to remove (3px bar, inset shadow, dead circuit image)
- `FilterButton` / `FilterPill` extraction happens here
- `RaceRow` active state needs the outline treatment, not the side-shadow
- Good bones — the flag images and session timeline are already well done. Mostly cleanup.

### 3. Standings — `StandingsPage.jsx`
**Why third:**
- `<PageHeader>` migration needed (it's the only page building its own hero)
- `PANEL_BG_STRONG` removal
- Podium treatment already done in CommunityPage — carry it here too
- Sub-tab active state needs canonical treatment
- Less structural work than Wire or Calendar

### 4. Grid — `GridPage.jsx`
**Why fourth:**
- `AvatarChip` extraction should happen here (one of the two defining instances)
- Forum post layout needs hierarchy audit — title / body / metadata contrast
- Voting UI needs state treatment
- Less work than Profile

### 5. Profile — `ProfilePage.jsx`
**Why fifth:**
- Most complex page in the app (multiple sub-tabs, AI Coach, prediction history, scoring breakdown)
- Sub-tabs need canonical active treatment
- AI Coach section needs blue signal treatment
- Correctness over aesthetics here — functionality is load-bearing

### 6. Home — `HomePage.jsx` (last)
- Only after all other pages are coherent
- The home is the face of the product — it synthesizes everything. Redesign it knowing all other pages are already right.

---

## 21. Redesign Checklist (for each tab)

Before marking a tab redesign complete:

**Colors and tokens:**
- [ ] No raw hex literals that have an existing token
- [ ] No `PANEL_BG_STRONG`
- [ ] No `rgba(10,18,32,...)`, `rgba(14,25,41,...)`, `#111827`, `#0f172a` (replace with depth stack tokens)
- [ ] Status states use `SUCCESS_TEXT/BG/BORDER`, `WARN_TEXT/BG/BORDER`, `ERROR_TEXT/BG/BORDER`

**Typography:**
- [ ] No `fontSize` below 10
- [ ] `fontVariantNumeric: "tabular-nums"` on all numeric live displays
- [ ] Kicker/eyebrow labels: `fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase"`

**Layout and panels:**
- [ ] Page uses `<PageHeader>` for the hero section
- [ ] Panel nesting: max 2 levels (section → card)
- [ ] No inline panel gradient — use `PANEL_BG` / `PANEL_BG_ALT` directly

**Active state:**
- [ ] All tab/pill/filter active states use section 9 canonical pattern
- [ ] No old white-gradient active treatment
- [ ] No `inset N 0 0 color` side-shadow
- [ ] No `border-left > 1px` accent stripes

**Images:**
- [ ] Images have `onError` fallback
- [ ] No `display: "none"` image containers — commit or delete
- [ ] Gradient fallback maintains same dimensions as the image it replaces

**AI / Pro:**
- [ ] AI content uses blue (#60A5FA) — not orange
- [ ] Pro features use ACCENT orange — not blue
- [ ] AI confidence shows `confPct()`-based percentage, not flat value

**Components:**
- [ ] No locally-defined component if a shared `@/src/ui/` version exists
- [ ] Cleanup manifest items for this page (section 18) addressed

**Responsive:**
- [ ] Tested at `isMobile`, `isTablet`, and desktop
- [ ] `minHeight: 44px` on mobile tap targets
