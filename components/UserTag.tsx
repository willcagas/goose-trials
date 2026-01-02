'use client';

import { USER_TAG_CONFIG, type UserTagType } from '@/lib/user-tags';

interface UserTagProps {
  tagType: string | null | undefined; // UserTagType from server
  className?: string;
}

/**
 * UserTag component - Displays special tags for users (developers, admins, etc.)
 * 
 * Receives tag type from server-side API (secure - no client-side user ID mapping)
 */
export default function UserTag({ tagType, className = '' }: UserTagProps) {
  if (!tagType) return null;
  
  const tagConfig = USER_TAG_CONFIG[tagType as UserTagType];
  if (!tagConfig) return null;
  
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${tagConfig.color} ${tagConfig.bgColor} ${tagConfig.borderColor} ${className}`}
      title={tagConfig.label}
    >
      {tagConfig.label}
    </span>
  );
}

