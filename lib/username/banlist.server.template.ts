/**
 * Username Ban List Logic (SERVER-ONLY) - TEMPLATE
 * 
 * Copy this file to banlist.server.ts and populate with actual banned words.
 * The banlist.server.ts file is gitignored for security reasons.
 * 
 * SECURITY:
 * - The .server.ts suffix ensures Next.js blocks client imports at build time
 * - The gitignore keeps the actual list out of source control
 */

// ============================================================================
// BANNED WORDS (SERVER-ONLY, GITIGNORED)
// Add words here that should be blocked. Checked against normalized usernames
// (lowercase, underscores removed, leetspeak converted: 0→o, 1→i, 3→e, 4→a, 5→s, 7→t).
// ============================================================================
const BANNED_WORDS: string[] = [
  // Add banned words here, one per line
  // Example: 'badword',
];

// ============================================================================
// RESERVED USERNAMES
// These are blocked to prevent impersonation and confusion
// ============================================================================
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'mod',
  'moderator',
  'support',
  'staff',
  'goosetrials',
  'goose',
  'leaderboard',
]);

// ============================================================================
// BAN CHECK HELPERS
// ============================================================================

/**
 * Normalizes a string for ban-list checking:
 * - Lowercases
 * - Converts basic leetspeak to letters
 * - Strips underscores
 * 
 * This catches common circumvention attempts like "f_u_c_k" or "4ss".
 */
function normalizeForBanCheck(input: string): string {
  return input
    .toLowerCase()
    .replace(/0/g, 'o')     // 0 → o
    .replace(/1/g, 'i')     // 1 → i
    .replace(/3/g, 'e')     // 3 → e
    .replace(/4/g, 'a')     // 4 → a
    .replace(/5/g, 's')     // 5 → s
    .replace(/7/g, 't')     // 7 → t
    .replace(/_/g, '');     // Strip underscores
}

/**
 * Checks if a normalized string contains any banned substrings
 */
function containsBannedSubstring(normalizedUsername: string): boolean {
  return BANNED_WORDS.some((word) => normalizedUsername.includes(word));
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Checks if username is in the reserved list.
 * Reserved names are blocked to prevent impersonation of staff/system accounts.
 * 
 * @param username - The normalized (lowercase) username to check
 * @returns true if the username is reserved
 */
export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username);
}

/**
 * Checks if username contains banned words/profanity.
 * Uses leetspeak normalization to catch circumvention attempts.
 * 
 * @param username - The normalized (lowercase) username to check
 * @returns true if the username contains banned content
 */
export function isBannedUsername(username: string): boolean {
  const normalizedForBan = normalizeForBanCheck(username);
  return containsBannedSubstring(normalizedForBan);
}

