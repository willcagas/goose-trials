/**
 * User Tags Configuration (Server-Side Only)
 * 
 * This file should NOT be imported in client components.
 * Maps Supabase user IDs to special tags/roles.
 * 
 * Keep this file server-side only to prevent exposing developer/admin identities.
 */

export type UserTagType = 'developer' | 'contributor';

/**
 * Maps user IDs to their special tags
 * Add developer/user IDs here to give them special tags
 * 
 * IMPORTANT: This file is server-side only. Do not import in client components.
 */
export const USER_TAGS: Record<string, UserTagType> = {
  // Example: Add your developer/user IDs here
  // 'user-id-1': 'developer',
  // 'user-id-2': 'contributor',
  '656aa9f5-7e51-40b0-a0a4-3adc8d41e208': 'developer',
  '42b733f6-fca0-4531-86ee-17d2fe735e69': 'developer',
  '64e20f13-81b7-4fee-a23c-d818a1c07bc1': 'developer',
  '8078722e-c82f-43b1-b186-4a761e977719': 'developer',
  'fd39380f-1de8-4168-aa23-4c614e9eda60': 'developer',
};

/**
 * Get the tag for a specific user ID (server-side only)
 */
export function getUserTag(userId: string): UserTagType | null {
  return USER_TAGS[userId] || null;
}

/**
 * Get tags for multiple user IDs at once (server-side only)
 * Returns a map of userId -> tag
 */
export function getUserTagsForIds(userIds: string[]): Record<string, UserTagType> {
  const result: Record<string, UserTagType> = {};
  for (const id of userIds) {
    const tag = USER_TAGS[id];
    if (tag) {
      result[id] = tag;
    }
  }
  return result;
}

/**
 * Check if a user has a special tag (server-side only)
 */
export function hasUserTag(userId: string): boolean {
  return userId in USER_TAGS;
}

