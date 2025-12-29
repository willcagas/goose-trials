/**
 * Score submission functions for both authenticated and guest users
 */

import { createClient } from '../supabase/client';
import { getOrCreateGuestId } from '../guest/guestId';

export interface ScoreSubmission {
  test_slug: string;
  score_value: number;
}

/**
 * Submit a score for a guest user
 * @deprecated Use submitScore instead, which handles both authenticated and guest users
 */
export async function submitGuestScore(
  testSlug: string,
  scoreValue: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Get or create guest ID
    const guestId = getOrCreateGuestId();

    const scoreData = {
      test_slug: testSlug,
      score_value: scoreValue,
      guest_id: guestId,
      user_id: null
    };

    const { error } = await supabase.from('scores').insert([scoreData]);

    if (error) {
      console.error('Error submitting score:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error submitting score:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Submit a score for either an authenticated user or a guest
 * Automatically detects if user is logged in and uses user_id or guest_id accordingly
 */
export async function submitScore(
  testSlug: string,
  scoreValue: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    let scoreData: {
      test_slug: string;
      score_value: number;
      user_id: string | null;
      guest_id: string | null;
    };

    if (user && !authError) {
      // User is authenticated, use user_id
      scoreData = {
        test_slug: testSlug,
        score_value: scoreValue,
        user_id: user.id,
        guest_id: null,
      };
    } else {
      // User is not authenticated, use guest_id
      const guestId = getOrCreateGuestId();
      scoreData = {
        test_slug: testSlug,
        score_value: scoreValue,
        user_id: null,
        guest_id: guestId,
      };
    }

    const { error } = await supabase.from('scores').insert([scoreData]);

    if (error) {
      console.error('Error submitting score:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error submitting score:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
