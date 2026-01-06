/**
 * User Highlights - Best scores across all games with ranks
 * 
 * Used for profile cards to show a user's best performances.
 */

import { createClient } from '@/lib/supabase/server';
import { getAllGameSlugs, getGameMetadata, type GameSlug } from '@/lib/games/registry';

export interface UserHighlight {
  test_slug: GameSlug;
  best_score: number;
  rank: number | null; // User's rank for this test (deprecated, use scoped ranks)
  total_players: number;
  achieved_at: string;
  // Scoped ranks
  country_rank: number | null;
  country_total: number;
  university_rank: number | null;
  university_total: number;
}

/**
 * Get a user's highlights: best score per game with rank
 * 
 * @param userId - User ID to fetch highlights for
 * @param limit - Maximum number of highlights to return (default 6)
 * @returns Array of user highlights sorted by most recent
 */
export async function getUserHighlights(
  userId: string,
  limit: number = 6
): Promise<UserHighlight[]> {
  try {
    const supabase = await createClient();
    const allSlugs = getAllGameSlugs();
    const highlights: UserHighlight[] = [];

    // For each game, get the user's best score and their rank
    for (const testSlug of allSlugs) {
      // Get user's best score for this test
      const { data: userScore, error: userScoreError } = await supabase
        .from('scores')
        .select('score_value, created_at')
        .eq('test_slug', testSlug)
        .eq('user_id', userId)
        .order('score_value', { ascending: isLowerBetter(testSlug) })
        .limit(1)
        .single();

      if (userScoreError || !userScore) {
        // User hasn't played this game
        continue;
      }

      // Count total players for this test
      const { count: totalPlayers } = await supabase
        .from('scores')
        .select('user_id', { count: 'exact', head: true })
        .eq('test_slug', testSlug)
        .not('user_id', 'is', null);

      // Calculate rank by counting how many users have a better score
      let rank: number | null = null;
      
      if (isLowerBetter(testSlug)) {
        // For lower-is-better tests, count users with lower scores
        const { count: betterCount } = await supabase
          .from('scores')
          .select('user_id', { count: 'exact', head: true })
          .eq('test_slug', testSlug)
          .not('user_id', 'is', null)
          .lt('score_value', userScore.score_value);
        
        // Get distinct user count with better scores
        const { data: betterUsers } = await supabase
          .rpc('count_users_with_better_score', {
            p_test_slug: testSlug,
            p_score: userScore.score_value,
            p_lower_is_better: true
          });
        
        rank = (betterUsers ?? betterCount ?? 0) + 1;
      } else {
        // For higher-is-better tests, count users with higher scores
        const { data: betterUsers } = await supabase
          .rpc('count_users_with_better_score', {
            p_test_slug: testSlug,
            p_score: userScore.score_value,
            p_lower_is_better: false
          });
        
        rank = (betterUsers ?? 0) + 1;
      }

      highlights.push({
        test_slug: testSlug,
        best_score: userScore.score_value,
        rank,
        total_players: totalPlayers ?? 0,
        achieved_at: userScore.created_at,
        country_rank: null,
        country_total: 0,
        university_rank: null,
        university_total: 0,
      });
    }

    // Sort by most recent achievement and limit
    return highlights
      .sort((a, b) => new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching user highlights:', error);
    return [];
  }
}

/**
 * Simplified version that doesn't calculate ranks (faster)
 * Used when rank display is not needed
 */
export interface UserHighlightSimple {
  test_slug: GameSlug;
  best_score: number;
  achieved_at: string;
}

export async function getUserHighlightsSimple(
  userId: string,
  limit: number = 6
): Promise<UserHighlightSimple[]> {
  try {
    const supabase = await createClient();
    const allSlugs = getAllGameSlugs();
    const highlights: UserHighlightSimple[] = [];

    for (const testSlug of allSlugs) {
      const { data: userScore, error } = await supabase
        .from('scores')
        .select('score_value, created_at')
        .eq('test_slug', testSlug)
        .eq('user_id', userId)
        .order('score_value', { ascending: isLowerBetter(testSlug) })
        .limit(1)
        .single();

      if (error || !userScore) continue;

      highlights.push({
        test_slug: testSlug,
        best_score: userScore.score_value,
        achieved_at: userScore.created_at,
      });
    }

    return highlights
      .sort((a, b) => new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching simple highlights:', error);
    return [];
  }
}

/**
 * Check if lower score is better for a given test
 */
function isLowerBetter(testSlug: GameSlug): boolean {
  const game = getGameMetadata(testSlug);
  return game.lowerIsBetter;
}

/**
 * Get user's rank for a specific test
 * 
 * @param userId - User ID
 * @param testSlug - Test slug
 * @returns Rank object or null if user hasn't played
 */
export async function getUserRankForTest(
  userId: string,
  testSlug: GameSlug
): Promise<{ rank: number; total_players: number; best_score: number } | null> {
  try {
    const supabase = await createClient();
    const lowerBetter = isLowerBetter(testSlug);

    // Get user's best score
    const { data: userScore, error: userError } = await supabase
      .from('scores')
      .select('score_value')
      .eq('test_slug', testSlug)
      .eq('user_id', userId)
      .order('score_value', { ascending: lowerBetter })
      .limit(1)
      .single();

    if (userError || !userScore) return null;

    // Use a simpler approach: get leaderboard and find user's position
    const { data: leaderboard, error: lbError } = await supabase.rpc('get_leaderboard', {
      p_test_slug: testSlug,
      p_limit: 10000, // High limit to get full leaderboard
      p_university_id: null,
    });

    if (lbError || !leaderboard) return null;

    // Find user's entry using is_you flag (set by auth.uid() in SQL function)
    const userEntry = leaderboard.find((entry: { is_you: boolean }) => entry.is_you);
    
    return {
      rank: userEntry?.rank ?? leaderboard.length + 1,
      total_players: leaderboard.length,
      best_score: userScore.score_value,
    };
  } catch (error) {
    console.error('Error fetching user rank:', error);
    return null;
  }
}

/**
 * Get highlights with scoped ranks (country and university)
 * 
 * @param userId - User ID to fetch highlights for
 * @param limit - Maximum number of highlights to return
 * @param universityId - User's university ID (optional, for university rank)
 * @param countryCode - User's country code (optional, for country rank)
 */
export async function getUserHighlightsWithRanks(
  userId: string,
  limit: number = 6,
  universityId?: string | null,
  countryCode?: string | null
): Promise<UserHighlight[]> {
  try {
    const supabase = await createClient();
    const allSlugs = getAllGameSlugs();
    const highlights: UserHighlight[] = [];

    for (const testSlug of allSlugs) {
      // Get user's best score from the scores table
      const lowerBetter = isLowerBetter(testSlug);
      const { data: userScore, error: scoreError } = await supabase
        .from('scores')
        .select('score_value, created_at')
        .eq('test_slug', testSlug)
        .eq('user_id', userId)
        .order('score_value', { ascending: lowerBetter })
        .limit(1)
        .single();

      if (scoreError || !userScore) continue;

      // Initialize rank values
      let countryRank: number | null = null;
      let countryTotal = 0;
      let universityRank: number | null = null;
      let universityTotal = 0;

      // Fetch country leaderboard if country code is provided
      if (countryCode) {
        const { data: countryLeaderboard } = await supabase.rpc('get_leaderboard', {
          p_test_slug: testSlug,
          p_limit: 10000,
          p_university_id: null,
          p_country_code: countryCode,
        });

        if (countryLeaderboard && countryLeaderboard.length > 0) {
          countryTotal = countryLeaderboard.length;
          // Find user by user_id
          const userCountryEntry = countryLeaderboard.find(
            (entry: { user_id: string }) => entry.user_id === userId
          );
          if (userCountryEntry) {
            countryRank = userCountryEntry.rank;
          }
        }
      }

      // Fetch university leaderboard if university ID is provided
      if (universityId) {
        const { data: uniLeaderboard } = await supabase.rpc('get_leaderboard', {
          p_test_slug: testSlug,
          p_limit: 10000,
          p_university_id: universityId,
          p_country_code: null,
        });

        if (uniLeaderboard && uniLeaderboard.length > 0) {
          universityTotal = uniLeaderboard.length;
          // Find user by user_id
          const userUniEntry = uniLeaderboard.find(
            (entry: { user_id: string }) => entry.user_id === userId
          );
          if (userUniEntry) {
            universityRank = userUniEntry.rank;
          }
        }
      }

      highlights.push({
        test_slug: testSlug,
        best_score: userScore.score_value,
        rank: null, // Deprecated - use scoped ranks
        total_players: 0, // Deprecated
        achieved_at: userScore.created_at,
        country_rank: countryRank,
        country_total: countryTotal,
        university_rank: universityRank,
        university_total: universityTotal,
      });
    }

    // Sort by most recent and limit
    return highlights
      .sort((a, b) => new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching highlights with ranks:', error);
    return [];
  }
}

