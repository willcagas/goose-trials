/**
 * Score submission functions for guest users
 */

import { createClient } from '../supabase/client';
import { getOrCreateGuestId } from '../guest/guestId';

export interface ScoreSubmission {
  test_slug: string;
  score_value: number;
}

/**
 * Submit a score for a guest user
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
