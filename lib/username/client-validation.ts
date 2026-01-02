/**
 * Client-side Username Validation
 * 
 * Uses the shared validation utilities for UX feedback.
 * This is NOT a security boundary - the server always re-validates.
 * 
 * NOTE: Profanity list is intentionally NOT included client-side.
 * Only a small subset of reserved words is checked for early feedback.
 */

import { normalizeUsername, validateUsernameShape } from './validation';

// Re-export for convenience
export { normalizeUsername, validateUsernameShape };

/**
 * Small subset of reserved usernames for client-side feedback.
 * The full list is checked server-side.
 * DO NOT include profanity here - that stays server-only.
 */
const CLIENT_RESERVED_USERNAMES = new Set([
  'admin',
  'support',
  'mod',
  'goosetrials',
]);

/**
 * Checks if username is in the client-side reserved list.
 * This is just for early UX feedback - server does full check.
 */
export function isClientReservedUsername(username: string): boolean {
  return CLIENT_RESERVED_USERNAMES.has(username);
}

/**
 * Combined client-side validation for username.
 * Returns error message or null if valid.
 * 
 * Checks:
 * 1. Shape rules (length, charset, underscore rules)
 * 2. Reserved words (small subset for UX)
 * 
 * @param rawUsername - The raw input from the user
 * @returns Error message string or null if valid
 */
export function validateUsernameClient(rawUsername: string): string | null {
  // Normalize first
  const username = normalizeUsername(rawUsername);
  
  // Check shape rules
  const shapeError = validateUsernameShape(username);
  if (shapeError) {
    return shapeError;
  }
  
  // Check reserved words (small subset for early feedback)
  if (isClientReservedUsername(username)) {
    return 'This username is reserved';
  }
  
  return null;
}

