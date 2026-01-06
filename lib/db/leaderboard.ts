import { createClient } from '@/lib/supabase/server';
import { getUserTagsForIds } from '@/lib/user-tags.server';

export interface LeaderboardEntry {
  test_slug: string;
  username: string | null;
  avatar_url: string | null;
  university_id: string | null;
  best_score: number;
  achieved_at: string;
  rank: number;
  is_you: boolean;
  user_tag?: string | null; // UserTagType from server
}

export interface GetLeaderboardParams {
  testSlug: string;
  limit?: number;
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
    
    const { testSlug, limit = 50, universityId = null } = params;

    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_test_slug: testSlug,
      p_limit: limit,
      p_university_id: universityId,
    });

    if (error) {
      console.error('Error calling get_leaderboard RPC:', error);
      return { data: [], error: error.message };
    }

    if (!data || data.length === 0) {
      return { data: [] };
    }

    // Get usernames for tag lookup - query profiles to get user_ids
    const usernames = data
      .map((entry: LeaderboardEntry) => entry.username)
      .filter((u: string | null): u is string => u !== null);

    // Query profiles to get user_ids for these usernames
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('username', usernames);

    // Create username -> user_id map
    const usernameToId: Record<string, string> = {};
    if (profiles) {
      for (const p of profiles) {
        if (p.username) {
          usernameToId[p.username] = p.id;
        }
      }
    }

    // Get tags for all user_ids
    const userIds = Object.values(usernameToId);
    const tagsById = getUserTagsForIds(userIds);

    // Add user tags to entries
    const entriesWithTags = data.map((entry: LeaderboardEntry) => {
      const userId = entry.username ? usernameToId[entry.username] : null;
      const tag = userId ? tagsById[userId] : null;
      return {
        ...entry,
        user_tag: tag || null,
      };
    });

    return { data: entriesWithTags };
  } catch (error) {
    console.error('Unexpected error in getLeaderboard:', error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
