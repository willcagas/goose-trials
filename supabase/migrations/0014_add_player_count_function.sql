-- Migration: Add get_player_count function
-- This function returns the total count of authenticated players for a test
-- Used to display accurate player counts on the frontpage leaderboards

-- Function to get total count of authenticated players for a test
-- This matches the logic in get_leaderboard but only returns the count

DROP FUNCTION IF EXISTS get_player_count(TEXT, UUID, TEXT);

CREATE FUNCTION get_player_count(
  p_test_slug TEXT,
  p_university_id UUID DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_count INT;
BEGIN
  IF p_test_slug = 'reaction-time' THEN
    -- For reaction-time, count users with at least 5 scores
    WITH user_top5_scores AS (
      SELECT
        s.user_id,
        s.score_value,
        ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.score_value ASC) as score_rank
      FROM scores s
      WHERE s.test_slug = p_test_slug
        AND s.user_id IS NOT NULL
        AND (p_university_id IS NULL OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = s.user_id
          AND p.university_id = p_university_id
        ))
        AND (p_country_code IS NULL OR EXISTS (
          SELECT 1 FROM profiles p
          JOIN universities u ON u.id = p.university_id
          WHERE p.id = s.user_id
          AND u.alpha_two_code = p_country_code
        ))
    ),
    user_average_scores AS (
      SELECT
        uts.user_id
      FROM user_top5_scores uts
      WHERE uts.score_rank <= 5
      GROUP BY uts.user_id
      HAVING COUNT(*) >= 5
    )
    SELECT COUNT(DISTINCT uas.user_id)::INT INTO v_count
    FROM user_average_scores uas;
  ELSE
    -- For other tests, count distinct users with at least one score
    SELECT COUNT(DISTINCT s.user_id)::INT INTO v_count
    FROM scores s
    WHERE s.test_slug = p_test_slug
      AND s.user_id IS NOT NULL
      AND (p_university_id IS NULL OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = s.user_id
        AND p.university_id = p_university_id
      ))
      AND (p_country_code IS NULL OR EXISTS (
        SELECT 1 FROM profiles p
        JOIN universities u ON u.id = p.university_id
        WHERE p.id = s.user_id
        AND u.alpha_two_code = p_country_code
      ));
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$func$;

