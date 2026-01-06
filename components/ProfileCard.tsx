'use client';

import { GAMES_REGISTRY, type GameSlug } from '@/lib/games/registry';
import type { UserHighlight } from '@/lib/db/user-highlights';
import SchoolBadge from './SchoolBadge';

export interface ProfileData {
  id: string;
  username: string | null;
  avatar_url: string | null;
  university_id: string | null;
}

interface ProfileCardProps {
  profile: ProfileData;
  highlights: UserHighlight[];
  universityName?: string | null;
  universityCountryCode?: string | null;
  compact?: boolean; // For OG image rendering
}

// Format score based on test type
function formatScore(testSlug: GameSlug, score: number): string {
  switch (testSlug) {
    case 'reaction-time':
      return `${Math.round(score)} ms (avg)`;
    case 'hanoi':
      // Hanoi is already stored in seconds
      return `${score.toFixed(2)}s`;
    case 'number-memory':
      return `${Math.round(score)} digits`;
    case 'chimp':
      return `${Math.round(score)} levels`;
    case 'pathfinding':
      return `${Math.round(score)} rounds`;
    case 'aim-trainer':
      return `${Math.round(score)} hits`;
    default:
      return `${score}`;
  }
}

// Generate avatar placeholder from username
function getAvatarPlaceholder(username: string | null): string {
  if (!username) return '?';
  return username.charAt(0).toUpperCase();
}

// Get display name (username or fallback)
function getDisplayName(profile: ProfileData): string {
  if (profile.username) {
    return profile.username;
  }
  // Fallback: truncated user ID
  return `User_${profile.id.slice(0, 8)}`;
}

export default function ProfileCard({
  profile,
  highlights,
  universityName,
  universityCountryCode,
  compact = false,
}: ProfileCardProps) {
  const displayName = getDisplayName(profile);
  const hasUsername = !!profile.username;
  
  return (
    <div
      className={`
        bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]
        border border-white/10 
        rounded-2xl 
        overflow-hidden
        ${compact ? 'p-4' : 'p-6 md:p-8'}
      `}
    >
      {/* Header Section */}
      <div className={`flex items-center gap-4 ${compact ? 'mb-4' : 'mb-6'}`}>
        {/* Avatar */}
        <div
          className={`
            flex-shrink-0 
            ${compact ? 'w-12 h-12' : 'w-16 h-16 md:w-20 md:h-20'}
            rounded-full 
            bg-amber-400/20 
            border-2 border-amber-400/40
            flex items-center justify-center
            text-amber-400 font-bold
            ${compact ? 'text-lg' : 'text-2xl md:text-3xl'}
          `}
        >
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            getAvatarPlaceholder(profile.username)
          )}
        </div>
        
        {/* Name and School */}
        <div className="flex-1 min-w-0">
          <h2
            className={`
              font-bold text-white truncate
              ${compact ? 'text-xl' : 'text-2xl md:text-3xl'}
            `}
          >
            {displayName}
          </h2>
          
          {/* No username warning */}
          {!hasUsername && !compact && (
            <p className="text-amber-400/60 text-sm mt-1">
              This user hasn&apos;t set a username yet
            </p>
          )}
          
          {/* School Badge */}
          {universityName && (
            <div className="mt-2">
              <SchoolBadge
                universityName={universityName}
                countryCode={universityCountryCode}
                size={compact ? 'sm' : 'md'}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Highlights Grid */}
      <div className={compact ? 'mt-4' : 'mt-6'}>
        <h3
          className={`
            text-white/60 uppercase tracking-wider font-semibold
            ${compact ? 'text-xs mb-3' : 'text-sm mb-4'}
          `}
        >
          Highlights
        </h3>
        
        {highlights.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            <p>No games played yet</p>
          </div>
        ) : (
          <div
            className={`
              grid gap-3
              ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}
            `}
          >
            {highlights.map((highlight) => (
              <HighlightCard
                key={highlight.test_slug}
                highlight={highlight}
                compact={compact}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Get ordinal suffix for rank
function getOrdinalSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

// Individual highlight card
function HighlightCard({
  highlight,
  compact,
}: {
  highlight: UserHighlight;
  compact: boolean;
}) {
  const game = GAMES_REGISTRY[highlight.test_slug];
  const hasUniRank = highlight.university_rank !== null;
  const isTopUniRank = hasUniRank && highlight.university_rank! <= 3;
  
  return (
    <div
      className={`
        bg-white/5 border border-white/10 rounded-xl
        ${compact ? 'p-3' : 'p-4'}
        ${isTopUniRank ? 'border-amber-400/30 bg-amber-400/5' : ''}
      `}
    >
      {/* Game Title */}
      <div
        className={`
          text-white/70 font-medium truncate
          ${compact ? 'text-xs' : 'text-sm'}
        `}
      >
        {game?.title || highlight.test_slug}
      </div>
      
      {/* Score */}
      <div
        className={`
          font-mono font-bold text-white
          ${compact ? 'text-lg mt-1' : 'text-xl md:text-2xl mt-2'}
          ${isTopUniRank ? 'text-amber-400' : ''}
        `}
      >
        {formatScore(highlight.test_slug, highlight.best_score)}
      </div>
      
      {/* Scoped Ranks */}
      <div className={`${compact ? 'mt-1 space-y-0.5' : 'mt-2 space-y-1'}`}>
        {/* University Rank */}
        {highlight.university_rank !== null && (
          <div className={`text-white/50 ${compact ? 'text-xs' : 'text-sm'}`}>
            <span className={isTopUniRank ? 'text-amber-400/80 font-semibold' : ''}>
              {highlight.university_rank}
              <sup>{getOrdinalSuffix(highlight.university_rank)}</sup>
              <span className={`${isTopUniRank ? 'text-white/40' : 'text-white/30'} font-normal ml-1`}>
                on campus
              </span>
            </span>
          </div>
        )}
        
        {/* Country Rank */}
        {highlight.country_rank !== null && (
          <div className={`text-white/40 ${compact ? 'text-xs' : 'text-xs'}`}>
            {highlight.country_rank}
            <sup>{getOrdinalSuffix(highlight.country_rank)}</sup>
            <span className="ml-1">in country</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Variant for sharing/download - cleaner look with branding
export function ProfileCardShareable({
  profile,
  highlights,
  universityName,
  universityCountryCode,
}: Omit<ProfileCardProps, 'compact'>) {
  return (
    <div className="bg-[#0a0a0a] p-8 rounded-3xl">
      {/* Branding */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/goose.svg" alt="Goose Trials" className="w-8 h-8" />
          <span className="text-amber-400 font-bold text-lg">Goose Trials</span>
        </div>
        <span className="text-white/40 text-sm">goosetrials.com</span>
      </div>
      
      {/* Main Card */}
      <ProfileCard
        profile={profile}
        highlights={highlights}
        universityName={universityName}
        universityCountryCode={universityCountryCode}
        compact={false}
      />
    </div>
  );
}

