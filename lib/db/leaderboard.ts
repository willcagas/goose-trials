import { createClient } from '@/lib/supabase/server';
import { getUserTagsForIds } from '@/lib/user-tags.server';

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
  user_tag?: string | null; // UserTagType from server
}

export interface TopUniversityEntry {
  test_slug: string;
  university_id: string;
  university_name: string;
  alpha_two_code: string | null;
  players_considered: number;
  metric_value: number;
  rank: number;
}

export interface GetLeaderboardParams {
  testSlug: string;
  limit?: number;
  universityId?: string | null;
  countryCode?: string | null;
}

export interface GetTopUniversitiesParams {
  testSlug: string;
  limit?: number;
  topN?: number;
  minPlayers?: number;
  countryCode?: string | null;
}

export interface GetPlayerCountParams {
  testSlug: string;
  universityId?: string | null;
  countryCode?: string | null;
}

/**
 * Get leaderboard data for a specific test (individual players)
 * 
 * @param params - Leaderboard query parameters
 * @returns Array of leaderboard entries or empty array on error
 */
export async function getLeaderboard(
  params: GetLeaderboardParams
): Promise<{ data: LeaderboardEntry[]; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { testSlug, limit = 50, universityId = null, countryCode = null } = params;

    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_test_slug: testSlug,
      p_limit: limit,
      p_university_id: universityId,
      p_country_code: countryCode,
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

/**
 * Get total count of authenticated players for a specific test
 * 
 * @param params - Player count query parameters
 * @returns Total player count or 0 on error
 */
export async function getPlayerCount(
  params: GetPlayerCountParams
): Promise<{ count: number; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { testSlug, universityId = null, countryCode = null } = params;

    const { data, error } = await supabase.rpc('get_player_count', {
      p_test_slug: testSlug,
      p_university_id: universityId,
      p_country_code: countryCode,
    });

    if (error) {
      console.error('Error calling get_player_count RPC:', error);
      return { count: 0, error: error.message };
    }

    return { count: data ?? 0 };
  } catch (error) {
    console.error('Unexpected error in getPlayerCount:', error);
    return {
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get top universities leaderboard for a specific test
 * 
 * @param params - Top universities query parameters
 * @returns Array of top university entries or empty array on error
 */
export async function getTopUniversities(
  params: GetTopUniversitiesParams
): Promise<{ data: TopUniversityEntry[]; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { 
      testSlug, 
      limit = 50, 
      topN = 5, 
      minPlayers = 5, 
      countryCode = null 
    } = params;

    const { data, error } = await supabase.rpc('get_top_universities', {
      p_test_slug: testSlug,
      p_limit: limit,
      p_top_n: topN,
      p_min_players: minPlayers,
      p_alpha_two_code: countryCode,
    });

    if (error) {
      console.error('Error calling get_top_universities RPC:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getTopUniversities:', error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
