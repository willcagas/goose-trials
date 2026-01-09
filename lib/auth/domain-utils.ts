/**
 * Client-safe domain utilities
 * These functions are pure and don't require server-side dependencies
 */

/**
 * Extract email domain from email address
 * Handles emails with multiple '@' by taking substring after the last '@'
 * 
 * @param email - Full email address (e.g., "user@example.com" or "name@dept@utoronto.ca")
 * @returns Domain part of email (e.g., "example.com" or "utoronto.ca") or null if invalid
 */
export function extractEmailDomain(email: string): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  
  // Handle multiple '@' by finding the last occurrence
  const lastAt = trimmed.lastIndexOf('@');
  if (lastAt === -1) return null;
  
  const domain = trimmed.substring(lastAt + 1);
  
  // Basic validation: domain should not be empty
  if (!domain || domain.length === 0) return null;
  
  // Reject IPv6 literal addresses (containing '[' or ']')
  if (domain.includes('[') || domain.includes(']')) return null;
  
  // Reject IPv4-like addresses (starts with digit, contains only digits and dots)
  // This is conservative - only reject obvious IP literals
  if (/^\d+\./.test(domain) && /^[\d.]+$/.test(domain)) {
    return null;
  }
  
  return domain;
}


