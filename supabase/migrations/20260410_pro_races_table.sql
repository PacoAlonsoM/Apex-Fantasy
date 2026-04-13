-- ============================================================
-- Pro game system: races table
-- A canonical race record used by the Pro picks/leagues system.
-- Separate from race_calendar (the synced F1 calendar data).
-- race_calendar is for display; this table drives game logic.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.races (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,              -- "Monaco Grand Prix"
  circuit     TEXT        NOT NULL,              -- "Circuit de Monaco"
  country     TEXT        NOT NULL,
  date        TIMESTAMPTZ NOT NULL,              -- race start time (UTC)
  season      INT         NOT NULL,              -- e.g. 2026
  round       INT         NOT NULL,              -- race number in season (1–24)
  is_sprint   BOOLEAN     NOT NULL DEFAULT FALSE,
  lock_time   TIMESTAMPTZ NOT NULL,              -- when picks lock (qualifying start)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS races_season_round_idx ON public.races (season, round);
CREATE INDEX        IF NOT EXISTS races_season_idx        ON public.races (season);
CREATE INDEX        IF NOT EXISTS races_lock_time_idx     ON public.races (lock_time);

-- RLS: public read, no user writes
ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='races' AND policyname='Public can read races'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read races" ON public.races FOR SELECT USING (true)';
  END IF;
END $$;
