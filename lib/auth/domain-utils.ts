/**
 * Client-safe domain utilities
 * These functions are pure and don't require server-side dependencies
 */

/**
 * Extract email domain from email address
 * 
 * @param email - Full email address (e.g., "user@example.com")
 * @returns Domain part of email (e.g., "example.com") or null if invalid
 */
export function extractEmailDomain(email: string): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const domain = trimmed.split('@')[1];
  return domain || null;
}


