/**
 * Username Ban List Logic (SERVER-ONLY)
 * 
 * SECURITY:
 * - This file uses .server.ts suffix = Next.js blocks client imports at build time
 * - This file is gitignored = stays out of source control
 * - See banlist.server.template.ts for the expected format
 * 
 * The profanity/ban list is kept server-side only to prevent users from
 * seeing which words are blocked and circumventing the filter.
 */

// ============================================================================
// BANNED WORDS (SERVER-ONLY, GITIGNORED)
// Add words here that should be blocked. Checked against normalized usernames
// (lowercase, underscores removed, leetspeak converted).
// 
// DEPLOYMENT: In production, this list is loaded from the USERNAME_BANLIST
// environment variable (JSON array string) to keep sensitive words out of git.
// For local development, the list below is used as a fallback.
// ============================================================================

// Load from environment variable in production, fallback to local list in development
function getBannedWords(): string[] {
  // In production (Vercel), read from environment variable
  if (process.env.USERNAME_BANLIST) {
    try {
      return JSON.parse(process.env.USERNAME_BANLIST);
    } catch (error) {
      console.error('Failed to parse USERNAME_BANLIST environment variable:', error);
      // Fall through to local list
    }
  }
  
  // Local development fallback
  // NOTE: This file is gitignored. For production, use USERNAME_BANLIST env var.
  // For local testing, you can temporarily add words here, but they won't be committed.
  return [
    // Add test words here for local development only
    // In production, these come from USERNAME_BANLIST environment variable
  ];
}

const BANNED_WORDS: string[] = getBannedWords();

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
