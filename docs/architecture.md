# STINT Architecture

## Runtime flow

```text
Next route in app/
  -> src/shell/LegacyAppEntry.jsx
  -> src/shell/StintApp.jsx
  -> feature page in src/features/*
  -> shared UI in src/ui/*
  -> shared data/services in src/lib/*
  -> Supabase / OpenF1 / static constants
```

## Source layout

```text
app/                         Next routes, metadata, sitemap, robots
public/                      active static assets
src/
  shell/                     app shell, auth, navbar, routing
  features/                  page-level product logic
  ui/                        shared presentational components
  lib/                       Supabase, OpenF1, calendar, scoring, helpers
  constants/                 design tokens and static domain constants
supabase/                    functions, migrations, SQL operations
scripts/                     dev and publish helpers
docs/                        local workflow and architecture docs
```

## Active ownership by layer

- `app/`: route entrypoints only
- `src/shell/`: navigation, auth, page state, redirects
- `src/features/`: page behavior and data composition
- `src/ui/`: reusable page sections and visual components
- `src/lib/`: integrations and domain helpers

## Intent

This structure keeps one clear path for changes:

- route changes in `app/`
- app flow changes in `src/shell/`
- product/page changes in `src/features/`
- visual reuse in `src/ui/`
- data and service logic in `src/lib/`
