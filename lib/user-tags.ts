/**
 * User Tags Configuration (Client-Side)
 * 
 * This file contains only the display configuration for tags.
 * The actual user ID to tag mapping is server-side only (see lib/user-tags.server.ts)
 * to prevent exposing developer/admin identities in client code.
 */

export type UserTagType = 'developer' | 'contributor'; // earlyGoose

export interface UserTag {
  type: UserTagType;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Display configuration for each tag type
 * Used by the UserTag component to render tags
 */
export const USER_TAG_CONFIG: Record<UserTagType, Omit<UserTag, 'type'>> = {
  developer: {
    label: 'Developer',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
  },
  contributor: {
    label: 'Contributor',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
  },
//   earlyGoose: {
//     label: 'Early Goose',
//     color: 'text-cyan-700',
//     bgColor: 'bg-cyan-100',
//     borderColor: 'border-cyan-300',
//   },
};

