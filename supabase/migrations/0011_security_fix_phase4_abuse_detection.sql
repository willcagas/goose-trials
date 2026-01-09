-- PHASE 4: DETECT & AUDIT PAST ABUSE
-- This script identifies potentially compromised scores based on impossible values
-- Run this to audit existing data before/after implementing the fixes
-- 
-- NOTE: Review results carefully before deleting - some scores may be legitimate outliers
-- Consider flagging instead of deleting, or implement a review process

-- Create a view to identify suspicious scores
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
    WHEN s.test_slug = 'chimp' AND s.score_value > 50 THEN 'Chimp level too high (unlikely: >50)'
    WHEN s.test_slug = 'number-memory' AND s.score_value > 30 THEN 'Number memory too high (world record is ~20)'
    WHEN s.test_slug = 'aim-trainer' AND s.score_value > 1000 THEN 'Aim trainer hits too high (unlikely: >1000)'
    WHEN s.test_slug = 'pathfinding' AND s.score_value > 100 THEN 'Pathfinding rounds too high (unlikely: >100)'
    WHEN s.test_slug = 'hanoi' AND s.score_value < 0.01 THEN 'Hanoi time too fast (impossible: <0.01s)'
    WHEN s.test_slug = 'hanoi' AND s.score_value > 3600 THEN 'Hanoi time too slow (unlikely: >1 hour)'
    WHEN s.test_slug = 'tetris' AND s.score_value < 0.01 THEN 'Tetris time too fast (impossible: <0.01s)'
    WHEN s.test_slug = 'tetris' AND s.score_value > 3600 THEN 'Tetris time too slow (unlikely: >1 hour)'
    ELSE 'Unknown issue'
  END as reason
FROM scores s
WHERE 
  -- Reaction time: suspiciously fast (<50ms) or very slow (>5000ms)
  (s.test_slug = 'reaction-time' AND (s.score_value < 50 OR s.score_value > 5000))
  -- Chimp: levels > 50 (extremely unlikely)
  OR (s.test_slug = 'chimp' AND s.score_value > 50)
  -- Number memory: >30 digits (world record is ~20)
  OR (s.test_slug = 'number-memory' AND s.score_value > 30)
  -- Aim trainer: >1000 hits (generous but suspicious)
  OR (s.test_slug = 'aim-trainer' AND s.score_value > 1000)
  -- Pathfinding: >100 rounds (unlikely)
  OR (s.test_slug = 'pathfinding' AND s.score_value > 100)
  -- Hanoi: <0.01s (impossible) or >1 hour (unlikely)
  OR (s.test_slug = 'hanoi' AND (s.score_value < 0.01 OR s.score_value > 3600))
  -- Tetris: <0.01s (impossible) or >1 hour (unlikely)
  OR (s.test_slug = 'tetris' AND (s.score_value < 0.01 OR s.score_value > 3600));

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

