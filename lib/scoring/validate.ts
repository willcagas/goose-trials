// Score validation - shared between client and server

// Score validation ranges per game (realistic human bounds)
// Must match the ranges in app/api/submit-score/route.ts
export const SCORE_RANGES: Record<string, { min: number; max: number }> = {
  'reaction-time': { min: 50, max: 5000 },      // 50ms - 5000ms (humans: 100-1000ms typical)
  'chimp': { min: 0, max: 50 },                 // 0-50 levels
  'number-memory': { min: 0, max: 50 },         // 0-50 digits (20 is world record territory)
  'aim-trainer': { min: 0, max: 200 },         // 0-200 hits (generous upper bound)
  'pathfinding': { min: 0, max: 100 },          // 0-100 rounds
  'hanoi': { min: 3, max: 60 },                 // 3 - 60 seconds
  'tetris': { min: 3, max: 2000 },              // 3 - 2000 seconds
};

/**
 * Validate score is within acceptable bounds for the game
 * Can be used on both client and server
 */
export function validateScore(testSlug: string, scoreValue: number): { valid: boolean; error?: string } {
  // Basic sanity checks
  if (!Number.isFinite(scoreValue)) {
    return { valid: false, error: 'Score must be a finite number' };
  }

  if (scoreValue < 0) {
    return { valid: false, error: 'Score cannot be negative' };
  }

  // Game-specific range validation
  const range = SCORE_RANGES[testSlug];
  if (range) {
    if (scoreValue < range.min || scoreValue > range.max) {
      return {
        valid: false,
        error: `Score ${scoreValue} is outside acceptable range [${range.min}, ${range.max}] for ${testSlug}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate and sanitize a score from localStorage
 * Returns null if the score is invalid
 */
export function validateStoredScore(testSlug: string, storedValue: string | null): number | null {
  if (!storedValue) {
    return null;
  }

  const parsed = Number(storedValue);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return null;
  }

  const validation = validateScore(testSlug, parsed);
  if (!validation.valid) {
    return null;
  }

  return parsed;
}
