/**
 * Score submission functions for both authenticated and guest users
 */

import { createClient } from '../supabase/client';
import { getOrCreateGuestId } from '../guest/guestId';

export interface ScoreSubmission {
  test_slug: string;
  score_value: number;
}

export interface SubmitScoreResult {
  success: boolean;
  error?: string;
  isNewHighScore?: boolean;
}

// Games where lower scores are better (like reaction time, hanoi)
const LOWER_IS_BETTER_GAMES = ['reaction-time', 'hanoi'];

/**
 * Determine if a new score is better than the old score
 */
function isScoreBetter(testSlug: string, newScore: number, oldScore: number): boolean {
  if (LOWER_IS_BETTER_GAMES.includes(testSlug)) {
    return newScore < oldScore;
  }
  return newScore > oldScore;
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
 * Returns whether this score is a new personal high score
 */
export async function submitScore(
  testSlug: string,
  scoreValue: number
): Promise<SubmitScoreResult> {
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

    let identifierField: 'user_id' | 'guest_id';
    let identifierValue: string;

    if (user && !authError) {
      // User is authenticated, use user_id
      identifierField = 'user_id';
      identifierValue = user.id;
      scoreData = {
        test_slug: testSlug,
        score_value: scoreValue,
        user_id: user.id,
        guest_id: null,
      };
    } else {
      // User is not authenticated, use guest_id
      const guestId = getOrCreateGuestId();
      identifierField = 'guest_id';
      identifierValue = guestId;
      scoreData = {
        test_slug: testSlug,
        score_value: scoreValue,
        user_id: null,
        guest_id: guestId,
      };
    }

    // Check for existing best score before inserting
    const isLowerBetter = LOWER_IS_BETTER_GAMES.includes(testSlug);
    const { data: existingScores } = await supabase
      .from('scores')
      .select('score_value')
      .eq('test_slug', testSlug)
      .eq(identifierField, identifierValue)
      .order('score_value', { ascending: isLowerBetter })
      .limit(1);

    const previousBest = existingScores?.[0]?.score_value;
    const isNewHighScore = previousBest === undefined || isScoreBetter(testSlug, scoreValue, previousBest);

    const { error } = await supabase.from('scores').insert([scoreData]);

    if (error) {
      console.error('Error submitting score:', error);
      return { success: false, error: error.message };
    }

    return { success: true, isNewHighScore };
  } catch (error) {
    console.error('Unexpected error submitting score:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
