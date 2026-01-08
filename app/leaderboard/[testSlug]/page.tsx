'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useMe } from '@/app/providers/MeContext';
import Navbar from '@/components/Navbar';
import LoginModal from '@/components/LoginModal';
import UserTag from '@/components/UserTag';
import PercentileGraph from '@/components/PercentileGraph';

// Types for individual leaderboard entries
interface LeaderboardEntry {
  test_slug: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  university_id: string | null;
  best_score: number;
  achieved_at: string;
  rank: number;
  is_you: boolean;
  user_tag?: string | null;
}

// Types for university leaderboard entries
interface UniversityEntry {
  test_slug: string;
  university_id: string;
  university_name: string;
  alpha_two_code: string | null;
  players_considered: number;
  metric_value: number;
  rank: number;
}

interface TestInfo {
  slug: string;
  name: string;
  description: string | null;
  unit: string | null;
  lower_is_better: boolean;
}

interface UniversityInfo {
  id: string;
  name: string;
  country: string | null;
  alpha_two_code: string | null;
}

type UniversityMap = Record<string, UniversityInfo>;

type LeaderboardScope = 'universities' | 'country' | 'campus';

// Fetch individual leaderboard (with university or country filter)
async function fetchLeaderboard(
  testSlug: string,
  universityId: string | null,
  countryCode: string | null
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({
    test_slug: testSlug,
    limit: '50',
  });
  
  if (universityId) {
    params.append('university_id', universityId);
  }
  
  if (countryCode) {
    params.append('country_code', countryCode);
  }

  const response = await fetch(`/api/leaderboard?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
  }

  const { data } = await response.json();
  return data || [];
}

// Fetch top universities leaderboard
async function fetchTopUniversities(
  testSlug: string,
  countryCode: string | null = null
): Promise<UniversityEntry[]> {
  const params = new URLSearchParams({
    test_slug: testSlug,
    limit: '50',
    min_players: '5',
    top_n: '5',
  });
  
  if (countryCode) {
    params.append('country_code', countryCode);
  }

  const response = await fetch(`/api/top-universities?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch top universities');
  }

  const { data } = await response.json();
  return data || [];
}

async function fetchTestInfo(testSlug: string): Promise<TestInfo | null> {
  const response = await fetch(`/api/tests?slug=${testSlug}`);
  
  if (!response.ok) {
    return null;
  }

  const { data } = await response.json();
  return data?.[0] || null;
}

async function fetchUniversityInfo(universityId: string): Promise<UniversityInfo | null> {
  const response = await fetch(`/api/universities?id=${universityId}`);
  
  if (!response.ok) {
    return null;
  }

  const { data } = await response.json();
  return data || null;
}

async function fetchUniversities(universityIds: string[]): Promise<UniversityMap> {
  if (universityIds.length === 0) {
    return {};
  }
  
  const response = await fetch(`/api/universities?ids=${universityIds.join(',')}`);
  
  if (!response.ok) {
    return {};
  }

  const { data } = await response.json();
  const map: UniversityMap = {};
  
  if (data && Array.isArray(data)) {
    data.forEach((uni: UniversityInfo) => {
      map[uni.id] = uni;
    });
  }
  
  return map;
}

function formatScore(score: number, unit: string | null): string {
  if (unit === 'ms') {
    return `${score.toFixed(0)} ms`;
  }
  if (unit === 's') {
    return `${score.toFixed(2)} s`;
  }
  if (unit === 'level') {
    return `${score.toFixed(0)}`;
  }
  return unit ? `${score.toFixed(2)} ${unit}` : score.toFixed(2);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getFlagEmoji(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default function LeaderboardTestPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const testSlug = params.testSlug as string;
  const highlightUsername = searchParams.get('user');
  const { me, loading: meLoading } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  
  // Refs for scrolling to highlighted user
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  const hasScrolledToHighlight = useRef(false);

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Check if we came from a game page
    if (typeof window !== 'undefined') {
      const referrer = document.referrer;
      // Check if referrer is a game page
      if (referrer && referrer.includes('/games/')) {
        // Extract the game path from referrer
        const url = new URL(referrer);
        const gamePath = url.pathname;
        router.push(gamePath);
        return;
      }
    }
    
    // Otherwise, go to rankings section on home page
    if (pathname === '/') {
      const rankingsSection = document.getElementById('rankings');
      if (rankingsSection) {
        rankingsSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      router.push('/');
      setTimeout(() => {
        const rankingsSection = document.getElementById('rankings');
        if (rankingsSection) {
          rankingsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [universityInfo, setUniversityInfo] = useState<UniversityInfo | null>(null);
  const [universityMap, setUniversityMap] = useState<UniversityMap>({});
  
  // Data for each tab
  const [universitiesData, setUniversitiesData] = useState<UniversityEntry[]>([]);
  const [countryData, setCountryData] = useState<LeaderboardEntry[]>([]);
  const [campusData, setCampusData] = useState<LeaderboardEntry[]>([]);
  
  const [scope, setScope] = useState<LeaderboardScope>('universities');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedPercentileUserId, setExpandedPercentileUserId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // Determine default scope (only once when me data first loads)
  useEffect(() => {
    if (!meLoading && !scopeInitialized) {
      // Default to campus if user has a university, otherwise universities
      if (me?.universityId) {
        setScope('campus');
      } else {
        setScope('universities');
      }
      setScopeInitialized(true);
    }
  }, [meLoading, scopeInitialized, me?.universityId]);

  // Fetch test info
  useEffect(() => {
    async function loadTestInfo() {
      const info = await fetchTestInfo(testSlug);
      setTestInfo(info);
    }
    loadTestInfo();
  }, [testSlug]);

  // Fetch university info when user has universityId
  useEffect(() => {
    async function loadUniversityInfo() {
      if (me?.universityId) {
        const info = await fetchUniversityInfo(me.universityId);
        setUniversityInfo(info);
      } else {
        setUniversityInfo(null);
      }
    }
    if (!meLoading) {
      loadUniversityInfo();
    }
  }, [me?.universityId, meLoading]);

  // Function to load leaderboards (can be called manually for refresh)
  const loadLeaderboards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Always fetch top universities (available for everyone)
      const universities = await fetchTopUniversities(testSlug);
      setUniversitiesData(universities);

      // Fetch country leaderboard if user has country code
      if (me?.countryCode) {
        const country = await fetchLeaderboard(testSlug, null, me.countryCode);
        setCountryData(country);
        
        // Fetch university info for all unique university IDs in country leaderboard
        const uniqueUniversityIds = [...new Set(
          country
            .map(entry => entry.university_id)
            .filter((id): id is string => id !== null)
        )];
        
        if (uniqueUniversityIds.length > 0) {
          const uniMap = await fetchUniversities(uniqueUniversityIds);
          setUniversityMap(uniMap);
        }
      } else {
        setCountryData([]);
      }

      // Fetch campus leaderboard if user has universityId
      if (me?.universityId) {
        const campus = await fetchLeaderboard(testSlug, me.universityId, null);
        setCampusData(campus);
      } else {
        setCampusData([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [testSlug, me?.universityId, me?.countryCode]);

  // Fetch leaderboards on mount and when dependencies change
  useEffect(() => {
    if (!meLoading) {
      loadLeaderboards();
    }
  }, [meLoading, loadLeaderboards]);

  // Handle percentile graph expansion
  const handlePercentileClick = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedPercentileUserId === userId) {
      setExpandedPercentileUserId(null);
    } else {
      setExpandedPercentileUserId(userId);
    }
  };

  const canViewCampus = me?.universityId !== null;
  const canViewCountry = me?.countryCode !== null;

  // Scroll to highlighted user when data loads
  useEffect(() => {
    if (
      highlightUsername && 
      !loading && 
      !hasScrolledToHighlight.current && 
      highlightedRowRef.current
    ) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        highlightedRowRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        hasScrolledToHighlight.current = true;
      }, 100);
    }
  }, [highlightUsername, loading, countryData, campusData]);

  // Render universities leaderboard table
  const renderUniversitiesTable = () => {
    if (universitiesData.length === 0) {
      return (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-lg text-gray-600 mb-2">
            No universities with enough players yet.
          </p>
          <p className="text-gray-500">
            Universities need at least 5 players to appear on the leaderboard.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                Rank
              </th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                University
              </th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                Country
              </th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700">
                Median
              </th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700">
                Players
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {universitiesData.map((entry) => {
              const isUserUniversity = me?.universityId === entry.university_id;
              return (
                <tr
                  key={entry.university_id}
                  className={`${
                    isUserUniversity
                      ? 'bg-amber-400/10 font-semibold'
                      : 'hover:bg-amber-400/5'
                  } transition-colors`}
                >
                  <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.rank}
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="text-xs md:text-sm text-gray-900">
                        {entry.university_name}
                        {isUserUniversity && (
                          <span className="ml-1 md:ml-2 text-xs text-amber-400">(Your University)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-600">
                    {entry.alpha_two_code ? (
                      <span>{getFlagEmoji(entry.alpha_two_code)} {entry.alpha_two_code}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm md:text-base font-bold text-gray-900 text-right">
                    {formatScore(entry.metric_value, testInfo?.unit || null)}
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500 text-right">
                    {entry.players_considered}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Render individuals leaderboard table (for Country and My University tabs)
  const renderIndividualsTable = (data: LeaderboardEntry[], showUniversity: boolean) => {
    if (data.length === 0) {
      return (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-lg text-gray-600 mb-2">
            {scope === 'campus'
              ? universityInfo
                ? `No scores yet from ${universityInfo.name}.`
                : "No scores yet for your campus."
              : scope === 'country'
              ? me?.countryName
                ? `No scores yet from ${me.countryName}.`
                : "No scores yet for your country."
              : "No scores yet."}
          </p>
          <p className="text-gray-500">
            {scope === 'campus'
              ? "You're the first from your university. Play now to set a record!"
              : scope === 'country'
              ? "You're the first from your country. Play now to set a record!"
              : "Be the first! Play now to set a record."}
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                Rank
              </th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                Player
              </th>
              {showUniversity && (
                <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                  University
                </th>
              )}
              <th className="px-3 md:px-6 py-3 md:py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700">
                {testInfo?.unit === 'level' ? 'Level' : 'Score'}
              </th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700">
                Achieved
              </th>
              <th className="px-3 md:px-6 py-3 md:py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-700">
                Stats
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((entry) => {
              const isHighlighted = highlightUsername && entry.username?.toLowerCase() === highlightUsername.toLowerCase();
              return (
                <React.Fragment key={`${entry.rank}-${entry.username || 'anon'}`}>
                  {/* Main Row */}
                  <tr
                    ref={isHighlighted ? highlightedRowRef : undefined}
                    onClick={() => {
                      if (expandedPercentileUserId === entry.user_id) {
                        setExpandedPercentileUserId(null);
                      } else {
                        setExpandedPercentileUserId(entry.user_id);
                      }
                    }}
                    className={`${
                      isHighlighted
                        ? 'bg-amber-400/20 ring-2 ring-amber-400 ring-inset font-semibold'
                        : entry.is_you
                        ? 'bg-amber-400/10 font-semibold'
                        : 'hover:bg-amber-400/5'
                    } transition-colors cursor-pointer`}
                  >
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.rank}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 md:gap-3">
                        {entry.avatar_url ? (
                          <img
                            src={entry.avatar_url}
                            alt={entry.username || 'User'}
                            className="w-7 h-7 md:w-8 md:h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
                            {(entry.username || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                          <span className="text-xs md:text-sm text-gray-900">
                            {entry.username || 'Anonymous'}
                            {entry.is_you && (
                              <span className="ml-1 md:ml-2 text-xs text-amber-400">(You)</span>
                            )}
                          </span>
                          <UserTag tagType={entry.user_tag} />
                        </div>
                      </div>
                    </td>
                    {showUniversity && (
                      <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-600">
                        {entry.university_id && universityMap[entry.university_id]
                          ? universityMap[entry.university_id].name
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                    )}
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm md:text-base font-bold text-gray-900 text-right">
                      {formatScore(entry.best_score, testInfo?.unit || null)}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500 text-right">
                      {formatDate(entry.achieved_at)}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-center">
                      <button
                        onClick={(e) => {
                          handlePercentileClick(entry.user_id, e);
                        }}
                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors group"
                        title="View stats"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className={`w-5 h-5 mx-auto transition-all ${
                            expandedPercentileUserId === entry.user_id
                              ? 'text-blue-500'
                              : 'text-gray-400 group-hover:text-blue-500'
                          }`}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row - Stats (Percentile Graph) */}
                  {expandedPercentileUserId === entry.user_id && (
                    <tr className="animate-slideDown">
                      <td colSpan={showUniversity ? 6 : 5} className="px-3 md:px-6 py-4 md:py-6 overflow-hidden">
                        <div className="animate-fadeIn space-y-6">
                          {/* Percentile Graph */}
                          <PercentileGraph
                            testSlug={testSlug}
                            userId={entry.user_id}
                            username={entry.username}
                            unit={testInfo?.unit || null}
                            lowerIsBetter={testInfo?.lower_is_better || false}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <button
            onClick={handleBackClick}
            className="text-gray-600 hover:text-gray-900 mb-3 md:mb-4 inline-block text-sm md:text-base whitespace-nowrap"
          >
            ← Back
          </button>
          <div className="flex flex-col md:flex-row items-start md:items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-tighter mb-2 text-gray-900">
                {testInfo?.name || testSlug}
              </h1>
              {testInfo?.description && (
                <p className="text-gray-600 text-base md:text-lg">{testInfo.description}</p>
              )}
            </div>
            <button
              onClick={loadLeaderboards}
              disabled={loading}
              className="px-3 md:px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm md:text-base font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              title="Refresh leaderboard"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Signup CTA - Show when not logged in */}
        {!me?.isLoggedIn && !meLoading && (
          <div className="mb-6">
            <button
              onClick={() => setShowLogin(true)}
              className="w-full px-4 py-3 md:px-6 md:py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-gray-900 font-bold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 md:gap-3 group"
            >
              <span className="text-sm md:text-base lg:text-lg text-center leading-tight">
                <span className="hidden sm:inline">Sign up to see your university rank or country rank</span>
                <span className="sm:hidden">Sign up to see your university & country rank</span>
              </span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={2.5} 
                stroke="currentColor" 
                className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 transform group-hover:translate-x-1 transition-transform"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        )}

        {/* Scope Toggle */}
        <div className="mb-6">
          <div className="flex gap-2 md:gap-4 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setScope('universities')}
              className={`px-4 md:px-6 py-3 font-bold text-xs md:text-sm uppercase tracking-wide transition-colors whitespace-nowrap ${
                scope === 'universities'
                  ? 'border-b-2 border-amber-400 text-gray-900'
                  : 'text-gray-500 hover:text-amber-400'
              }`}
            >
              🏫 Universities
            </button>
            <button
              onClick={() => setScope('country')}
              disabled={!canViewCountry}
              className={`px-4 md:px-6 py-3 font-bold text-xs md:text-sm uppercase tracking-wide transition-colors whitespace-nowrap ${
                !canViewCountry
                  ? 'text-gray-300 cursor-not-allowed'
                  : scope === 'country'
                  ? 'border-b-2 border-amber-400 text-gray-900'
                  : 'text-gray-500 hover:text-amber-400'
              }`}
            >
              {me?.isLoggedIn && me?.countryName
                ? <><span className="hidden sm:inline">{getFlagEmoji(me.countryCode)}&nbsp;&nbsp;</span>{me.countryName}</>
                : 'Your Country'}
            </button>
            <button
              onClick={() => setScope('campus')}
              disabled={!canViewCampus}
              className={`px-4 md:px-6 py-3 font-bold text-xs md:text-sm uppercase tracking-wide transition-colors whitespace-nowrap ${
                !canViewCampus
                  ? 'text-gray-300 cursor-not-allowed'
                  : scope === 'campus'
                  ? 'border-b-2 border-amber-400 text-gray-900'
                  : 'text-gray-500 hover:text-amber-400'
              }`}
            >
              <span className="hidden sm:inline">{me?.isLoggedIn && universityInfo?.name
                ? universityInfo.name
                : 'My University'}</span>
              <span className="sm:hidden">My Campus</span>
            </button>
          </div>
          {/* Messages for campus/country access */}
          {!canViewCampus && me?.isLoggedIn && scope === 'campus' && (
            <div className="mt-4 px-6 py-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-gray-700">
                We couldn&apos;t match your email domain to a university yet. Campus leaderboard unavailable.
              </p>
            </div>
          )}
          {!canViewCountry && me?.isLoggedIn && scope === 'country' && (
            <div className="mt-4 px-6 py-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-gray-700">
                Country leaderboard requires university association. Sign in with your university email.
              </p>
            </div>
          )}
          {!me?.isLoggedIn && (scope === 'country' || scope === 'campus') && (
            <div className="mt-4 px-6 py-3 bg-amber-50 rounded-lg border border-amber-200 hover:border-amber-400 transition-colors">
              <button
                onClick={() => setShowLogin(true)}
                className="text-sm text-amber-600 hover:text-amber-700 font-semibold transition-all cursor-pointer w-full text-left flex items-center gap-2 group"
              >
                <span>Sign in with your university email to see {scope === 'country' ? 'country' : 'campus'} rankings.</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2.5} 
                  stroke="currentColor" 
                  className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Loading State */}
        {(loading || !scopeInitialized) && (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading leaderboard...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-600">Error: {error}</p>
          </div>
        )}

        {/* Leaderboard Tables */}
        {!loading && !error && scopeInitialized && (
          <>
            {scope === 'universities' && renderUniversitiesTable()}
            {scope === 'country' && renderIndividualsTable(countryData, true)}
            {scope === 'campus' && renderIndividualsTable(campusData, false)}
          </>
        )}
      </div>
      
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
