/**
 * User Highlights - Best scores across all games with ranks
 * 
 * Used for profile cards to show a user's best performances.
 */

import { createClient } from '@/lib/supabase/server';
import { getAllGameSlugs, type GameSlug } from '@/lib/games/registry';

export interface UserHighlight {
  test_slug: GameSlug;
  best_score: number;
  rank: number | null; // Global rank for this test
  total_players: number;
  achieved_at: string;
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
export async function getUserHighlightsSimple(
  userId: string,
  limit: number = 6
): Promise<Omit<UserHighlight, 'rank' | 'total_players'>[]> {
  try {
    const supabase = await createClient();
    const allSlugs = getAllGameSlugs();
    const highlights: Omit<UserHighlight, 'rank' | 'total_players'>[] = [];

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
  // Tests where lower is better (time-based or penalty-based)
  const lowerIsBetter: GameSlug[] = ['reaction-time', 'hanoi'];
  return lowerIsBetter.includes(testSlug);
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
      p_user_id: userId,
      p_university_id: null,
    });

    if (lbError || !leaderboard) return null;

    const userEntry = leaderboard.find((entry: { user_id: string }) => entry.user_id === userId);
    
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
 * Get highlights with ranks using the leaderboard RPC (more accurate)
 */
export async function getUserHighlightsWithRanks(
  userId: string,
  limit: number = 6
): Promise<UserHighlight[]> {
  try {
    const supabase = await createClient();
    const allSlugs = getAllGameSlugs();
    const highlights: UserHighlight[] = [];

    for (const testSlug of allSlugs) {
      // Use leaderboard RPC which handles ranking correctly
      const { data: leaderboard, error } = await supabase.rpc('get_leaderboard', {
        p_test_slug: testSlug,
        p_limit: 10000,
        p_user_id: userId,
        p_university_id: null,
      });

      if (error || !leaderboard || leaderboard.length === 0) continue;

      // Find user in leaderboard
      const userEntry = leaderboard.find(
        (entry: { user_id: string }) => entry.user_id === userId
      );

      if (!userEntry) continue;

      highlights.push({
        test_slug: testSlug,
        best_score: userEntry.best_score,
        rank: userEntry.rank,
        total_players: leaderboard.length,
        achieved_at: userEntry.achieved_at,
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

