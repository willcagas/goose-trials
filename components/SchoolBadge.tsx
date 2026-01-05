'use client';

import Link from 'next/link';

// Country code to flag emoji mapping
function countryCodeToFlag(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return '';
  
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}

interface SchoolBadgeProps {
  universityName: string;
  universityId?: string;
  countryCode?: string | null;
  showLink?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function SchoolBadge({
  universityName,
  universityId,
  countryCode,
  showLink = false,
  size = 'md',
}: SchoolBadgeProps) {
  const flag = countryCodeToFlag(countryCode ?? null);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };
  
  const content = (
    <div
      className={`
        inline-flex items-center gap-2 
        bg-amber-400/10 border border-amber-400/30 
        rounded-full 
        font-medium text-amber-400/90
        ${sizeClasses[size]}
        ${showLink && universityId ? 'hover:bg-amber-400/20 transition-colors cursor-pointer' : ''}
      `}
    >
      {flag && <span className="text-base">{flag}</span>}
      <span className="truncate max-w-[200px]">{universityName}</span>
    </div>
  );
  
  if (showLink && universityId) {
    // Link to university-filtered leaderboard (if implemented)
    return (
      <Link href={`/leaderboard?university=${universityId}`}>
        {content}
      </Link>
    );
  }
  
  return content;
}

// Compact version for tight spaces
export function SchoolBadgeCompact({
  universityName,
  countryCode,
}: {
  universityName: string;
  countryCode?: string | null;
}) {
  const flag = countryCodeToFlag(countryCode ?? null);
  
  return (
    <span className="inline-flex items-center gap-1.5 text-white/60 text-sm">
      {flag && <span>{flag}</span>}
      <span className="truncate">{universityName}</span>
    </span>
  );
}

