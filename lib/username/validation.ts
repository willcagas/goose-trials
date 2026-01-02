/**
 * Username Validation Utilities
 * 
 * Shared between server and client for consistent validation.
 * These functions are pure and have no side effects.
 * 
 * Shape rules match DB constraints exactly:
 * - 3–20 characters
 * - Only letters, digits, underscore
 * - No leading underscore
 * - No trailing underscore
 * - No consecutive underscores (__)
 */

/**
 * Normalizes a username input: trims whitespace and lowercases.
 * Safe to call with any string input.
 */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Validates username shape rules.
 * Assumes input is already normalized (lowercase).
 * 
 * @param username - The normalized username to validate
 * @returns Error message string if invalid, null if valid
 */
export function validateUsernameShape(username: string): string | null {
  // Length check
  if (username.length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (username.length > 20) {
    return 'Username must be 20 characters or less';
  }

  // Character set check (letters, digits, underscore only)
  if (!/^[a-z0-9_]+$/.test(username)) {
    return 'Username can only contain letters, numbers, and underscores';
  }

  // Underscore position rules
  if (username.startsWith('_')) {
    return 'Username cannot start with an underscore';
  }
  if (username.endsWith('_')) {
    return 'Username cannot end with an underscore';
  }
  if (username.includes('__')) {
    return 'Username cannot contain consecutive underscores';
  }

  return null;
}

