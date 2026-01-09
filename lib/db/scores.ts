/**
 * Score submission functions for both authenticated and guest users
 * Now uses server-side API endpoint for secure submission
 */

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
const LOWER_IS_BETTER_GAMES = ['reaction-time', 'hanoi', 'tetris'];

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
 * This function now uses the secure API endpoint for backward compatibility
 */
export async function submitGuestScore(
  testSlug: string,
  scoreValue: number
): Promise<{ success: boolean; error?: string }> {
  // Delegate to the main submitScore function which uses the secure API endpoint
  const result = await submitScore(testSlug, scoreValue);
  return {
    success: result.success,
    error: result.error,
  };
}

/**
 * Submit a score for either an authenticated user or a guest
 * Now calls server-side API endpoint for secure score submission
 * Returns whether this score is a new personal high score
 * 
 * @param testSlug - The game identifier
 * @param scoreValue - The score to submit
 * @param previousBest - Optional: the client's known previous best score (avoids race conditions)
 */
export async function submitScore(
  testSlug: string,
  scoreValue: number,
  previousBest?: number | null
): Promise<SubmitScoreResult> {
  try {
    // Get guest ID if user is not authenticated (for guest submissions)
    const guestId = getOrCreateGuestId();

    // Call server-side API endpoint for secure score submission
    const response = await fetch('/api/submit-score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testSlug,
        scoreValue,
        previousBest: previousBest ?? null,
        guestId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Error submitting score:', errorData);
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: result.success,
      isNewHighScore: result.isNewHighScore ?? false,
      error: result.error,
    };
  } catch (error) {
    console.error('Unexpected error submitting score:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
