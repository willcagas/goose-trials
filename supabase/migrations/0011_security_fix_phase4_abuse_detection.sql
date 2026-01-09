-- PHASE 4: DETECT & AUDIT PAST ABUSE (OPTIONAL)
-- This script creates tools to identify suspicious scores for audit purposes
-- 
-- IMPORTANT: This is primarily for HISTORICAL AUDIT only
-- Since migration 0010 adds database constraints, new suspicious scores 
-- cannot be inserted (they'll be rejected at the database level).
--
-- Use cases:
-- 1. Review scores that existed BEFORE constraints were added
-- 2. Flag edge-case scores that pass constraints but are still suspicious
--    (e.g., reaction time 51ms - technically valid but suspiciously fast)
-- 3. Audit tool for ongoing monitoring (though it should be mostly empty)
--
-- NOTE: If you already deleted violating scores in migration 0010, this view
-- will be mostly empty. It's still useful for ongoing monitoring of edge cases.

-- Create a view to identify suspicious scores
-- Updated to match current score constraints from migration 0010 and API validation
CREATE OR REPLACE VIEW suspicious_scores AS
SELECT 
  s.id,
  s.test_slug,
  s.score_value,
  s.user_id,
  s.guest_id,
  s.created_at,
  CASE 
    WHEN s.test_slug = 'reaction-time' AND s.score_value < 50 THEN 'Reaction time too fast (impossible: <50ms)'
    WHEN s.test_slug = 'reaction-time' AND s.score_value > 5000 THEN 'Reaction time too slow (unlikely: >5000ms)'
    WHEN s.test_slug = 'chimp' AND s.score_value < 0 THEN 'Chimp level invalid (negative)'
    WHEN s.test_slug = 'chimp' AND s.score_value > 50 THEN 'Chimp level too high (unlikely: >50)'
    WHEN s.test_slug = 'number-memory' AND s.score_value < 0 THEN 'Number memory invalid (negative)'
    WHEN s.test_slug = 'number-memory' AND s.score_value > 50 THEN 'Number memory too high (world record is ~20, max 50)'
    WHEN s.test_slug = 'aim-trainer' AND s.score_value < 0 THEN 'Aim trainer invalid (negative)'
    WHEN s.test_slug = 'aim-trainer' AND s.score_value > 200 THEN 'Aim trainer hits too high (unlikely: >200)'
    WHEN s.test_slug = 'pathfinding' AND s.score_value < 0 THEN 'Pathfinding invalid (negative)'
    WHEN s.test_slug = 'pathfinding' AND s.score_value > 100 THEN 'Pathfinding rounds too high (unlikely: >100)'
    WHEN s.test_slug = 'hanoi' AND s.score_value < 3 THEN 'Hanoi time too fast (impossible: <3s, matches game limit)'
    WHEN s.test_slug = 'hanoi' AND s.score_value > 60 THEN 'Hanoi time exceeds game limit (>60s, matches MAX_RUN_MS)'
    WHEN s.test_slug = 'tetris' AND s.score_value < 3 THEN 'Tetris time too fast (impossible: <3s)'
    WHEN s.test_slug = 'tetris' AND s.score_value > 2000 THEN 'Tetris time too slow (unlikely: >2000s)'
    ELSE 'Unknown issue'
  END as reason
FROM scores s
WHERE 
  -- Reaction time: suspiciously fast (<50ms) or very slow (>5000ms)
  (s.test_slug = 'reaction-time' AND (s.score_value < 50 OR s.score_value > 5000))
  -- Chimp: invalid (<0) or levels > 50
  OR (s.test_slug = 'chimp' AND (s.score_value < 0 OR s.score_value > 50))
  -- Number memory: invalid (<0) or >50 digits
  OR (s.test_slug = 'number-memory' AND (s.score_value < 0 OR s.score_value > 50))
  -- Aim trainer: invalid (<0) or >200 hits
  OR (s.test_slug = 'aim-trainer' AND (s.score_value < 0 OR s.score_value > 200))
  -- Pathfinding: invalid (<0) or >100 rounds
  OR (s.test_slug = 'pathfinding' AND (s.score_value < 0 OR s.score_value > 100))
  -- Hanoi: <3s (impossible) or >60s (exceeds game limit)
  OR (s.test_slug = 'hanoi' AND (s.score_value < 3 OR s.score_value > 60))
  -- Tetris: <3s (impossible) or >2000s (unlikely)
  OR (s.test_slug = 'tetris' AND (s.score_value < 3 OR s.score_value > 2000));

-- Query to see all suspicious scores with user info (if available)
-- Run this to review before taking action:
/*
SELECT 
  ss.*,
  p.username,
  p.email
FROM suspicious_scores ss
LEFT JOIN profiles p ON p.id = ss.user_id
ORDER BY ss.created_at DESC;
*/

-- Query to identify users with multiple suspicious scores (likely cheaters)
-- Run this to find repeat offenders:
/*
SELECT 
  COALESCE(ss.user_id::text, ss.guest_id::text) as identifier,
  COUNT(*) as suspicious_count,
  ARRAY_AGG(DISTINCT ss.test_slug) as affected_games,
  MIN(ss.created_at) as first_suspicious,
  MAX(ss.created_at) as last_suspicious
FROM suspicious_scores ss
GROUP BY COALESCE(ss.user_id::text, ss.guest_id::text)
HAVING COUNT(*) > 1
ORDER BY suspicious_count DESC;
*/

-- OPTIONAL: Delete suspicious scores (UNCOMMENT TO USE - REVIEW FIRST!)
-- This will permanently delete scores identified as suspicious
-- Consider backing up the database first, or flagging scores instead
/*
DELETE FROM scores
WHERE id IN (SELECT id FROM suspicious_scores);
*/

-- OPTIONAL: Flag suspicious scores instead of deleting
-- Add a column to mark scores as suspicious
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scores' 
    AND column_name = 'is_suspicious'
  ) THEN
    ALTER TABLE public.scores ADD COLUMN is_suspicious BOOLEAN DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_scores_is_suspicious ON public.scores(is_suspicious);
  END IF;
END $$;

-- Mark suspicious scores (safer than deleting)
-- Uncomment to run:
/*
UPDATE scores
SET is_suspicious = true
WHERE id IN (SELECT id FROM suspicious_scores);
*/

-- Query to exclude suspicious scores from leaderboards
-- Update your leaderboard queries to filter: WHERE is_suspicious = false

