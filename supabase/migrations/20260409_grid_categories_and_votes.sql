-- ============================================================
-- The Grid: category structure + Feature Requests voting
-- ============================================================

-- 1. Add category column to posts
--    Existing global posts default to 'general' — no data loss.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS posts_category_created_at_idx
  ON public.posts (category, created_at DESC)
  WHERE league_id IS NULL;

-- 2. Ensure global posts are publicly readable and writable by auth users.
--    Use DO block so re-running is safe.
DO $$
BEGIN
  -- Public read: global posts visible to everyone
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'posts'
      AND policyname = 'Public can read global posts'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read global posts"
      ON public.posts FOR SELECT
      USING (league_id IS NULL)';
  END IF;

  -- Auth insert: authenticated users can create global posts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'posts'
      AND policyname = 'Auth users can create global posts'
  ) THEN
    EXECUTE 'CREATE POLICY "Auth users can create global posts"
      ON public.posts FOR INSERT
      WITH CHECK (league_id IS NULL AND auth.uid() = author_id)';
  END IF;
END $$;

-- 3. Ensure comments on global posts are readable/insertable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments'
      AND policyname = 'Public can read global post comments'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read global post comments"
      ON public.comments FOR SELECT
      USING (
        post_id IN (SELECT id FROM public.posts WHERE league_id IS NULL)
      )';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments'
      AND policyname = 'Auth users can reply to global posts'
  ) THEN
    EXECUTE 'CREATE POLICY "Auth users can reply to global posts"
      ON public.comments FOR INSERT
      WITH CHECK (
        auth.uid() = author_id
        AND post_id IN (SELECT id FROM public.posts WHERE league_id IS NULL)
      )';
  END IF;
END $$;

-- 4. post_votes table — Feature Requests upvote/downvote
CREATE TABLE IF NOT EXISTS public.post_votes (
  id         uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid      NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    uuid      NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote       smallint  NOT NULL CHECK (vote IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read votes"
  ON public.post_votes FOR SELECT USING (true);

CREATE POLICY "Auth users can vote on others posts"
  ON public.post_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT author_id FROM public.posts WHERE id = post_id) <> auth.uid()
  );

CREATE POLICY "Users can change own vote"
  ON public.post_votes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vote"
  ON public.post_votes FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Convenience view: posts with aggregated vote score
CREATE OR REPLACE VIEW public.post_with_scores AS
SELECT
  p.*,
  COALESCE(SUM(v.vote), 0)::int AS vote_score,
  COUNT(v.id)::int               AS vote_count
FROM public.posts p
LEFT JOIN public.post_votes v ON v.post_id = p.id
GROUP BY p.id;

-- Grant read access to the view
GRANT SELECT ON public.post_with_scores TO anon, authenticated;
