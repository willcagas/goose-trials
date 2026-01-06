DROP FUNCTION IF EXISTS get_leaderboard(TEXT, INT, UUID, UUID);
DROP FUNCTION IF EXISTS get_leaderboard(TEXT, INT, UUID);

CREATE FUNCTION get_leaderboard(
  p_test_slug TEXT,
  p_limit INT DEFAULT 50,
  p_university_id UUID DEFAULT NULL
)
RETURNS TABLE (
  test_slug TEXT,
  username TEXT,
  avatar_url TEXT,
  university_id UUID,
  best_score NUMERIC,
  achieved_at TIMESTAMP,
  rank BIGINT,
  is_you BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_lower_is_better BOOLEAN;
  v_current_user_id UUID;
BEGIN
  -- Get the current user ID from auth context
  v_current_user_id := auth.uid();

  -- Get lower_is_better from tests table
  SELECT lower_is_better INTO v_lower_is_better
  FROM tests
  WHERE slug = p_test_slug;
  
  -- Default to true (lower is better) if test not found
  IF v_lower_is_better IS NULL THEN
    v_lower_is_better := true;
  END IF;

  IF p_test_slug = 'reaction-time' THEN
    RETURN QUERY
    WITH user_top5_scores AS (
      SELECT
        s.user_id,
        s.score_value,
        s.created_at,
        ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.score_value ASC) as score_rank
      FROM scores s
      WHERE s.test_slug = p_test_slug
        AND s.user_id IS NOT NULL
        AND (p_university_id IS NULL OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = s.user_id
          AND p.university_id = p_university_id
        ))
    ),
    user_average_scores AS (
      SELECT
        uts.user_id,
        AVG(uts.score_value)::NUMERIC as avg_score,
        MAX(uts.created_at) as achieved_at,
        COUNT(*) as score_count
      FROM user_top5_scores uts
      WHERE uts.score_rank <= 5
      GROUP BY uts.user_id
      HAVING COUNT(*) >= 5
    )
    SELECT
      p_test_slug::TEXT as test_slug,
      p.username,
      p.avatar_url,
      p.university_id,
      uas.avg_score as best_score,
      uas.achieved_at::TIMESTAMP,
      ROW_NUMBER() OVER (ORDER BY uas.avg_score ASC) as rank,
      (uas.user_id = v_current_user_id) as is_you
    FROM user_average_scores uas
    JOIN profiles p ON p.id = uas.user_id
    ORDER BY uas.avg_score ASC
    LIMIT p_limit;
  ELSE
    -- For other tests, use MIN or MAX based on lower_is_better
    IF v_lower_is_better THEN
      -- Lower is better: use MIN and order ASC
      RETURN QUERY
      WITH best_scores AS (
        SELECT
          s.user_id,
          MIN(s.score_value)::NUMERIC as best_score,
          MIN(s.created_at) FILTER (WHERE s.score_value = (
            SELECT MIN(s2.score_value) FROM scores s2 
            WHERE s2.user_id = s.user_id AND s2.test_slug = p_test_slug
          )) as achieved_at
        FROM scores s
        WHERE s.test_slug = p_test_slug
          AND s.user_id IS NOT NULL
          AND (p_university_id IS NULL OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = s.user_id
            AND p.university_id = p_university_id
          ))
        GROUP BY s.user_id
      )
      SELECT
        p_test_slug::TEXT as test_slug,
        p.username,
        p.avatar_url,
        p.university_id,
        bs.best_score,
        bs.achieved_at::TIMESTAMP,
        ROW_NUMBER() OVER (ORDER BY bs.best_score ASC) as rank,
        (bs.user_id = v_current_user_id) as is_you
      FROM best_scores bs
      JOIN profiles p ON p.id = bs.user_id
      ORDER BY bs.best_score ASC
      LIMIT p_limit;
    ELSE
      -- Higher is better: use MAX and order DESC
      RETURN QUERY
      WITH best_scores AS (
        SELECT
          s.user_id,
          MAX(s.score_value)::NUMERIC as best_score,
          MIN(s.created_at) FILTER (WHERE s.score_value = (
            SELECT MAX(s2.score_value) FROM scores s2 
            WHERE s2.user_id = s.user_id AND s2.test_slug = p_test_slug
          )) as achieved_at
        FROM scores s
        WHERE s.test_slug = p_test_slug
          AND s.user_id IS NOT NULL
          AND (p_university_id IS NULL OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = s.user_id
            AND p.university_id = p_university_id
          ))
        GROUP BY s.user_id
      )
      SELECT
        p_test_slug::TEXT as test_slug,
        p.username,
        p.avatar_url,
        p.university_id,
        bs.best_score,
        bs.achieved_at::TIMESTAMP,
        ROW_NUMBER() OVER (ORDER BY bs.best_score DESC) as rank,
        (bs.user_id = v_current_user_id) as is_you
      FROM best_scores bs
      JOIN profiles p ON p.id = bs.user_id
      ORDER BY bs.best_score DESC
      LIMIT p_limit;
    END IF;
  END IF;
END;
$func$;
