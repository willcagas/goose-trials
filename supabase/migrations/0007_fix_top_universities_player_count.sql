-- Migration: Fix top universities player count
-- This fixes a bug where players_considered showed only the top N players (default 5)
-- instead of the total number of players from each university
-- 
-- Problem: The players_considered field was counting only the top N players used
-- for median calculation, not all players from that university
-- 
-- Solution: Count all distinct players per university separately and join with
-- the aggregated top N data to show the actual total player count

-- Drop and recreate with proper permissions
DROP FUNCTION IF EXISTS get_top_universities(text, int, int, int, text);

CREATE FUNCTION get_top_universities(
  p_test_slug text,
  p_limit int default 50,
  p_top_n int default 5,
  p_min_players int default 5,
  p_alpha_two_code text default null
)
returns table (
  test_slug text,
  university_id uuid,
  university_name text,
  alpha_two_code text,
  players_considered int,
  metric_value numeric,
  rank bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
with base as (
  select
    ubs.test_slug,
    ubs.user_id,
    ubs.best_score,
    p.university_id,
    t.lower_is_better,
    uni.name as university_name,
    uni.alpha_two_code
  from user_best_scores ubs
  join profiles p on p.id = ubs.user_id
  join universities uni on uni.id = p.university_id
  join tests t on t.slug = ubs.test_slug
  where ubs.test_slug = p_test_slug
    and p.university_id is not null
    and (p_alpha_two_code is null or uni.alpha_two_code = p_alpha_two_code)
),
total_players_per_uni as (
  select
    test_slug,
    university_id,
    count(distinct user_id) as total_players
  from base
  group by test_slug, university_id
),
ranked_within_uni as (
  select
    *,
    row_number() over (
      partition by test_slug, university_id
      order by
        case when lower_is_better then best_score end asc,
        case when not lower_is_better then best_score end desc
    ) as rn
  from base
),
topn as (
  select *
  from ranked_within_uni
  where rn <= p_top_n
),
agg as (
  select
    test_slug,
    university_id,
    university_name,
    alpha_two_code,
    (percentile_cont(0.5) within group (order by best_score))::numeric as metric_value,
    bool_or(lower_is_better) as lower_is_better
  from topn
  group by test_slug, university_id, university_name, alpha_two_code
),
agg_with_counts as (
  select
    agg.*,
    tppu.total_players as players_considered
  from agg
  join total_players_per_uni tppu on tppu.test_slug = agg.test_slug
    and tppu.university_id = agg.university_id
),
filtered as (
  select *
  from agg_with_counts
  where players_considered >= p_min_players
),
final as (
  select
    *,
    rank() over (
      order by
        case when lower_is_better then metric_value end asc,
        case when not lower_is_better then metric_value end desc
    ) as rank
  from filtered
)
select
  test_slug,
  university_id,
  university_name,
  alpha_two_code,
  players_considered,
  metric_value,
  rank
from final
order by rank
limit p_limit;
$$;

-- Grant execute permissions to both anon and authenticated users
GRANT EXECUTE ON FUNCTION get_top_universities(text, int, int, int, text) TO anon;
GRANT EXECUTE ON FUNCTION get_top_universities(text, int, int, int, text) TO authenticated;

