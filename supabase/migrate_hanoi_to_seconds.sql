-- Migration: Convert all hanoi scores from milliseconds to seconds
-- This converts existing scores in the database and updates the test unit

BEGIN;

-- Step 1: Convert all existing hanoi scores from milliseconds to seconds (with 2 decimal places)
UPDATE scores
SET score_value = ROUND((score_value / 1000.0)::numeric, 2)
WHERE test_slug = 'hanoi';

-- Step 2: Update the unit in the tests table for hanoi
UPDATE tests
SET unit = 'seconds'
WHERE slug = 'hanoi';

COMMIT;

-- Verification queries (run these after migration to verify):
-- SELECT test_slug, COUNT(*), MIN(score_value), MAX(score_value), AVG(score_value)
-- FROM scores
-- WHERE test_slug = 'hanoi'
-- GROUP BY test_slug;
--
-- SELECT slug, name, unit FROM tests WHERE slug = 'hanoi';

