-- Check for existing scores that violate the new constraints
-- Run this first to see what needs to be cleaned up

-- Find scores that violate the new bounds
SELECT 
  test_slug,
  COUNT(*) as violating_count,
  MIN(score_value) as min_score,
  MAX(score_value) as max_score
FROM scores
WHERE 
  -- reaction-time: must be 50-5000
  (test_slug = 'reaction-time' AND (score_value < 50 OR score_value > 5000))
  -- chimp: must be 0-50
  OR (test_slug = 'chimp' AND (score_value < 0 OR score_value > 50))
  -- number-memory: must be 0-50
  OR (test_slug = 'number-memory' AND (score_value < 0 OR score_value > 50))
  -- aim-trainer: must be 0-200
  OR (test_slug = 'aim-trainer' AND (score_value < 0 OR score_value > 200))
  -- pathfinding: must be 0-100
  OR (test_slug = 'pathfinding' AND (test_slug = 'pathfinding' AND (score_value < 0 OR score_value > 100)))
  -- hanoi: must be 3-60
  OR (test_slug = 'hanoi' AND (score_value < 3 OR score_value > 60))
  -- tetris: must be 3-2000
  OR (test_slug = 'tetris' AND (score_value < 3 OR score_value > 2000))
GROUP BY test_slug;

-- Show actual violating rows (first 20)
SELECT 
  id,
  test_slug,
  score_value,
  created_at,
  user_id,
  guest_id
FROM scores
WHERE 
  (test_slug = 'reaction-time' AND (score_value < 50 OR score_value > 5000))
  OR (test_slug = 'chimp' AND (score_value < 0 OR score_value > 50))
  OR (test_slug = 'number-memory' AND (score_value < 0 OR score_value > 50))
  OR (test_slug = 'aim-trainer' AND (score_value < 0 OR score_value > 200))
  OR (test_slug = 'pathfinding' AND (score_value < 0 OR score_value > 100))
  OR (test_slug = 'hanoi' AND (score_value < 3 OR score_value > 60))
  OR (test_slug = 'tetris' AND (score_value < 3 OR score_value > 2000))
ORDER BY created_at DESC
LIMIT 20;

