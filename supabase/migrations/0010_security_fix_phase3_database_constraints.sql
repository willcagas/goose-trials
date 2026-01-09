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
-- Must match SCORE_RANGES in app/api/submit-score/route.ts

-- First, delete violating scores (these are likely from testing/abuse before security fixes)
-- Run this BEFORE adding the constraint to avoid constraint violation errors
DELETE FROM scores
WHERE 
  (test_slug = 'reaction-time' AND (score_value < 50 OR score_value > 5000))
  OR (test_slug = 'chimp' AND (score_value < 0 OR score_value > 50))
  OR (test_slug = 'number-memory' AND (score_value < 0 OR score_value > 50))
  OR (test_slug = 'aim-trainer' AND (score_value < 0 OR score_value > 200))
  OR (test_slug = 'pathfinding' AND (score_value < 0 OR score_value > 100))
  OR (test_slug = 'hanoi' AND (score_value < 3 OR score_value > 60))
  OR (test_slug = 'tetris' AND (score_value < 3 OR score_value > 2000));

-- Now add the constraint (should succeed since violating rows are deleted)
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS score_bounds_by_game;
ALTER TABLE public.scores ADD CONSTRAINT score_bounds_by_game CHECK (
  -- reaction-time: 50ms - 5000ms (humans typically 100-1000ms)
  (test_slug = 'reaction-time' AND score_value >= 50 AND score_value <= 5000)
  -- chimp: 0-50 levels (0 = failed immediately)
  OR (test_slug = 'chimp' AND score_value >= 0 AND score_value <= 50)
  -- number-memory: 0-50 digits (0 = failed immediately, 20 is world record)
  OR (test_slug = 'number-memory' AND score_value >= 0 AND score_value <= 50)
  -- aim-trainer: 0-200 hits (0 = hit nothing)
  OR (test_slug = 'aim-trainer' AND score_value >= 0 AND score_value <= 200)
  -- pathfinding: 0-100 rounds (0 = failed immediately)
  OR (test_slug = 'pathfinding' AND score_value >= 0 AND score_value <= 100)
  -- hanoi: 3-60 seconds (matches MAX_RUN_MS: 60_000ms = 60s)
  OR (test_slug = 'hanoi' AND score_value >= 3 AND score_value <= 60)
  -- tetris: 3-2000 seconds (no hard limit, but generous upper bound)
  OR (test_slug = 'tetris' AND score_value >= 3 AND score_value <= 2000)
  -- Unknown game slugs will fail this constraint - this is intentional
  -- When adding new games, update this constraint AND app/api/submit-score/route.ts
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

