-- PHASE 3: DATABASE-LEVEL SAFETY NETS
-- Add hard constraints to prevent invalid scores even if server logic has bugs
-- These constraints act as a final safety net

-- Ensure created_at column exists (for auditing and rate limiting)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scores' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.scores ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Basic constraint: scores must be non-negative
-- Drop constraint if it exists (in case of re-runs)
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS score_positive;
ALTER TABLE public.scores ADD CONSTRAINT score_positive CHECK (score_value >= 0);

-- Per-game score bounds constraints
-- These use CHECK constraints with OR conditions for each game
-- Note: These are conservative bounds - actual realistic ranges are tighter
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS score_bounds_by_game;
ALTER TABLE public.scores ADD CONSTRAINT score_bounds_by_game CHECK (
  -- reaction-time: 50ms - 5000ms (humans typically 100-1000ms)
  (test_slug = 'reaction-time' AND score_value >= 50 AND score_value <= 5000)
  -- chimp: 1-50 levels
  OR (test_slug = 'chimp' AND score_value >= 1 AND score_value <= 50)
  -- number-memory: 1-30 digits (20+ is exceptional)
  OR (test_slug = 'number-memory' AND score_value >= 1 AND score_value <= 30)
  -- aim-trainer: 1-1000 hits (generous upper bound)
  OR (test_slug = 'aim-trainer' AND score_value >= 1 AND score_value <= 1000)
  -- pathfinding: 1-100 rounds
  OR (test_slug = 'pathfinding' AND score_value >= 1 AND score_value <= 100)
  -- hanoi: 0.01s - 1 hour (seconds)
  OR (test_slug = 'hanoi' AND score_value >= 0.01 AND score_value <= 3600)
  -- tetris: 0.01s - 1 hour (seconds)
  OR (test_slug = 'tetris' AND score_value >= 0.01 AND score_value <= 3600)
  -- Unknown game slugs will fail this constraint - this is intentional
  -- When adding new games, update this constraint
);

-- Constraint: Must have either user_id OR guest_id (not both, not neither)
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_user_or_guest;
ALTER TABLE public.scores ADD CONSTRAINT scores_user_or_guest CHECK (
  (user_id IS NOT NULL AND guest_id IS NULL) OR
  (user_id IS NULL AND guest_id IS NOT NULL)
);

-- Constraint: test_slug must exist in tests table (if tests table exists)
-- This is optional but helps maintain referential integrity
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tests') THEN
    -- Only add foreign key if tests table exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'scores_test_slug_fkey'
    ) THEN
      ALTER TABLE public.scores 
      ADD CONSTRAINT scores_test_slug_fkey 
      FOREIGN KEY (test_slug) REFERENCES tests(slug);
    END IF;
  END IF;
END $$;

-- Index on created_at for efficient querying and rate limiting
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON public.scores(created_at);

-- Index on (test_slug, user_id, score_value) for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_scores_test_user_score ON public.scores(test_slug, user_id, score_value);

-- Index on (test_slug, guest_id, score_value) for guest leaderboards
CREATE INDEX IF NOT EXISTS idx_scores_test_guest_score ON public.scores(test_slug, guest_id, score_value);

