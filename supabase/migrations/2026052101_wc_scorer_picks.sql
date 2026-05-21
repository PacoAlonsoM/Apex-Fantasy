-- ============================================================
-- WC 2026 goalscorer picks
-- Adds optional scorer name to match predictions, and a JSONB
-- column on matches to store normalized scorer arrays parsed
-- from the TheSportsDB sync. Both additions are nullable so
-- existing rows remain valid without backfill.
-- Cleanly removable: drop the two columns to unwind.
-- ============================================================

alter table public.wc_match_predictions
  add column if not exists predicted_scorer_name text;

alter table public.wc_matches
  add column if not exists scorers jsonb;

comment on column public.wc_match_predictions.predicted_scorer_name is
  'Optional free-text goalscorer pick. Normalized at score time against wc_matches.scorers.';
comment on column public.wc_matches.scorers is
  'Normalized scorer lists parsed from TheSportsDB goal-details. Shape: {home: ["lastname", ...], away: [...]}.';
