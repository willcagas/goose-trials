import { createClient } from '@/lib/supabase/server';

export interface ProfileData {
  id: string;
  email: string;
  university_id?: string | null;
  username?: string | null;
}

/**
 * Get existing profile data for a user
 * 
 * @param userId - User ID to fetch profile for
 * @returns Profile data or null if not found or error
 */
export async function getProfile(userId: string): Promise<{
  id: string;
  university_id: string | null;
  username: string | null;
} | null> {
  try {
    const supabase = await createClient();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, university_id, username')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching profile:', error);
      return null;
    }

    return profile || null;
  } catch (error) {
    console.error('Unexpected error fetching profile:', error);
    return null;
  }
}

/**
 * Upsert profile data (insert or update)
 * 
 * @param profileData - Profile data to upsert
 * @returns Success status and optional error message
 */
export async function upsertProfile(profileData: ProfileData): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
      });

    if (error) {
      console.error('Profile upsert error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error upserting profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
