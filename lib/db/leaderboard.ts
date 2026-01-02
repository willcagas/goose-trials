import { createClient } from '@/lib/supabase/server';
import { getUserTag } from '@/lib/user-tags.server';

export interface LeaderboardEntry {
  test_slug: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  university_id: string | null;
  best_score: number;
  achieved_at: string;
  rank: number;
  is_you: boolean;
  user_tag?: string | null; // UserTagType or null
}

export interface GetLeaderboardParams {
  testSlug: string;
  limit?: number;
  userId?: string | null;
  universityId?: string | null;
}

/**
 * Get leaderboard data for a specific test
 * 
 * @param params - Leaderboard query parameters
 * @returns Array of leaderboard entries or empty array on error
 */
export async function getLeaderboard(
  params: GetLeaderboardParams
): Promise<{ data: LeaderboardEntry[]; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { testSlug, limit = 50, userId = null, universityId = null } = params;

    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_test_slug: testSlug,
      p_limit: limit,
      p_user_id: userId,
      p_university_id: universityId,
    });

    if (error) {
      console.error('Error calling get_leaderboard RPC:', error);
      return { data: [], error: error.message };
    }

    // Add user tags server-side (secure - tags not exposed in client code)
    const entriesWithTags = (data || []).map((entry: LeaderboardEntry) => ({
      ...entry,
      user_tag: getUserTag(entry.user_id) || null,
    }));

    return { data: entriesWithTags };
  } catch (error) {
    console.error('Unexpected error in getLeaderboard:', error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}