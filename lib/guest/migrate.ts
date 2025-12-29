import { createClient } from '@/lib/supabase/server';

/**
 * Migrate guest scores to the authenticated user
 * Server-side function (use in API routes)
 * 
 * @param guestId - The guest ID whose scores should be migrated
 * @param userId - The authenticated user ID to migrate scores to
 * @returns Success status and optional error message
 */
export async function migrateGuestScores(
  guestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Call the Supabase RPC function to migrate scores
    const { error } = await supabase.rpc('migrate_guest_scores', {
      target_guest_id: guestId,
    });

    if (error) {
      console.error('Migration error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error migrating guest scores:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}