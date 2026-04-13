-- ============================================================
-- Pro user insights table
-- Per-user AI-generated insights for Pro subscribers.
-- Named `user_ai_insights` (not `ai_insights`) because that
-- table already exists in this project for admin race briefings
-- (public race context, not user-specific data).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_ai_insights (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  race_id      UUID        REFERENCES public.races(id),
  insight_type TEXT        NOT NULL
    CHECK (insight_type IN ('post_race', 'pre_race', 'monthly')),
  content      TEXT        NOT NULL,
  race_name    TEXT,                    -- denormalized for display without join
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_ai_insights_user_type_idx ON public.user_ai_insights (user_id, insight_type);
CREATE INDEX IF NOT EXISTS user_ai_insights_user_time_idx ON public.user_ai_insights (user_id, generated_at DESC);

-- RLS: users read only their own insights
ALTER TABLE public.user_ai_insights ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_ai_insights' AND policyname='Users read own insights') THEN
    EXECUTE $pol$
      CREATE POLICY "Users read own insights"
        ON public.user_ai_insights FOR SELECT
        USING (auth.uid() = user_id)
    $pol$;
  END IF;
  -- INSERT is service-role only (backend generates insights, no client policy needed)
END $$;
