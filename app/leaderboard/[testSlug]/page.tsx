'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useMe } from '@/app/providers/MeContext';
import Navbar from '@/components/Navbar';
import LoginModal from '@/components/LoginModal';
import UserTag from '@/components/UserTag';
import Link from 'next/link';

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
  user_tag?: string | null; // UserTagType from server
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

type LeaderboardScope = 'global' | 'country' | 'campus';

async function fetchLeaderboard(
  testSlug: string,
  universityId: string | null,
  userId: string | null
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({
    test_slug: testSlug,
    limit: '50',
  });
  
  if (universityId) {
    params.append('university_id', universityId);
  }

  const response = await fetch(`/api/leaderboard?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
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

interface TopScore {
  score_value: number;
  created_at: string;
}

export default function LeaderboardTestPage() {
  const params = useParams();
  const testSlug = params.testSlug as string;
  const { me, loading: meLoading } = useMe();

  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [universityInfo, setUniversityInfo] = useState<UniversityInfo | null>(null);
  const [universityMap, setUniversityMap] = useState<UniversityMap>({});
  const [globalData, setGlobalData] = useState<LeaderboardEntry[]>([]);
  const [countryData, setCountryData] = useState<LeaderboardEntry[]>([]);
  const [campusData, setCampusData] = useState<LeaderboardEntry[]>([]);
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NEW STATE: Track expanded rows
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedScores, setExpandedScores] = useState<(TopScore | null)[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Determine default scope (only once when me data first loads)
  useEffect(() => {
    if (!meLoading && !scopeInitialized) {
      if (me?.universityId) {
        setScope('campus');
      }
      setScopeInitialized(true);
    }
  }, [meLoading, me?.universityId, scopeInitialized]);

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
      // Always fetch global
      const global = await fetchLeaderboard(testSlug, null, me?.userId || null);
      setGlobalData(global);

      // Fetch university info for all unique university IDs in global leaderboard
      const uniqueUniversityIds = [...new Set(
        global
          .map(entry => entry.university_id)
          .filter((id): id is string => id !== null)
      )];
      
      let uniMap: UniversityMap = {};
      if (uniqueUniversityIds.length > 0) {
        uniMap = await fetchUniversities(uniqueUniversityIds);
        setUniversityMap(uniMap);
      }

      // Fetch campus if user has universityId
      if (me?.universityId) {
        const campus = await fetchLeaderboard(testSlug, me.universityId, me?.userId || null);
        setCampusData(campus);

        // Filter global data by user's country for country leaderboard
        const userUni = uniMap[me.universityId];
        if (userUni?.country) {
          const countryFiltered = global.filter(entry => {
            if (!entry.university_id) return false;
            const entryUni = uniMap[entry.university_id];
            return entryUni?.country === userUni.country;
          });
          // Re-rank the filtered entries
          const countryRanked = countryFiltered.map((entry, index) => ({
            ...entry,
            rank: index + 1,
          }));
          setCountryData(countryRanked);
        } else {
          setCountryData([]);
        }
      } else {
        setCountryData([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [testSlug, me?.userId, me?.universityId]);

  // Fetch leaderboards on mount and when dependencies change
  useEffect(() => {
    if (!meLoading) {
      loadLeaderboards();
    }
  }, [meLoading, loadLeaderboards]);

  // NEW FUNCTION: Handle row expansion
  const handleRowClick = async (userId: string) => {
    if (expandedUserId === userId) {
      // Close instantly without animation
      setExpandedUserId(null);
      setExpandedScores([]);
      return;
    }

    setExpandedUserId(userId);
    setLoadingScores(true);

    try {
      const response = await fetch(`/api/user-top-scores?test_slug=${testSlug}&user_id=${userId}`);
      if (response.ok) {
        const { data } = await response.json();
        setExpandedScores(data || Array(5).fill(null));
      } else {
        setExpandedScores(Array(5).fill(null));
      }
    } catch (error) {
      console.error('Error loading top scores:', error);
      setExpandedScores(Array(5).fill(null));
    } finally {
      setLoadingScores(false);
    }
  };

  const currentData = scope === 'campus' ? campusData : scope === 'country' ? countryData : globalData;
  const canViewCampus = me?.universityId !== null;
  const canViewCountry = me?.universityId !== null && universityInfo?.country !== null;
  const isReactionTime = testSlug === 'reaction-time';

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <Link
            href="/#rankings"
            className="text-gray-600 hover:text-gray-900 mb-3 md:mb-4 inline-block text-sm md:text-base"
          >
            ← Back Home
          </Link>
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

        {/* Scope Toggle */}
        <div className="mb-6">
          <div className="flex gap-2 md:gap-4 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setScope('global')}
              className={`px-4 md:px-6 py-3 font-bold text-xs md:text-sm uppercase tracking-wide transition-colors whitespace-nowrap ${
                scope === 'global'
                  ? 'border-b-2 border-amber-400 text-gray-900'
                  : 'text-gray-500 hover:text-amber-400'
              }`}
            >
              Global
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
              {me?.isLoggedIn && universityInfo?.country
                ? <><span className="hidden sm:inline">{getFlagEmoji(universityInfo.alpha_two_code)}&nbsp;&nbsp;</span>{universityInfo.country}</>
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
                : 'Your University'}</span>
              <span className="sm:hidden">Campus</span>
            </button>
          </div>
          {/* Messages for campus access */}
          {!canViewCampus && me?.isLoggedIn && (
            <div className="mt-4 px-6 py-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-gray-700">
                We couldn't match your email domain to a university yet. Campus leaderboard unavailable.
              </p>
            </div>
          )}
          {!me?.isLoggedIn && (
            <div className="mt-4 px-6 py-3 bg-amber-50 rounded-lg border border-amber-200 hover:border-amber-400 transition-colors">
              <button
                onClick={() => setShowLogin(true)}
                className="text-sm text-amber-600 hover:text-amber-700 font-semibold transition-all cursor-pointer w-full text-left flex items-center gap-2 group"
              >
                <span>Sign in with your university email to appear on leaderboards.</span>
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

        {/* Leaderboard Table */}
        {!loading && !error && scopeInitialized && (
          <>
            {currentData.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                <p className="text-lg text-gray-600 mb-2">
                  {scope === 'campus'
                    ? universityInfo
                      ? `No scores yet from ${universityInfo.name}.`
                      : "No scores yet for your campus."
                    : scope === 'country'
                    ? universityInfo?.country
                      ? `No scores yet from ${universityInfo.country}.`
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
            ) : (
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
                      <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                        {(scope === 'global' || scope === 'country') ? 'University' : ''}
                      </th>
                      <th className="px-3 md:px-6 py-3 md:py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700">
                        {testInfo?.unit === 'level' ? 'Level' : 'Score'}
                      </th>
                      <th className="px-3 md:px-6 py-3 md:py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700">
                        Achieved
                      </th>
                      {isReactionTime && (
                        <th className="px-3 md:px-6 py-3 md:py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-700">
                          Details
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentData.map((entry) => (
                      <React.Fragment key={entry.user_id}>
                        {/* Main Row */}
                        <tr
                          onClick={isReactionTime ? () => handleRowClick(entry.user_id) : undefined}
                          className={`${
                            entry.is_you
                              ? 'bg-amber-400/10 font-semibold'
                              : 'hover:bg-amber-400/5'
                          } transition-colors ${isReactionTime ? 'cursor-pointer' : ''}`}
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
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-600">
                          {(scope === 'global' || scope === 'country') && (
                            entry.university_id && universityMap[entry.university_id]
                              ? universityMap[entry.university_id].name
                              : <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm md:text-base font-bold text-gray-900 text-right">
                          {formatScore(entry.best_score, testInfo?.unit || null)}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500 text-right">
                          {formatDate(entry.achieved_at)}
                        </td>
                        {isReactionTime && (
                          <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-center">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className={`w-5 h-5 mx-auto transition-transform ${
                                expandedUserId === entry.user_id ? 'rotate-180' : ''
                              }`}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </td>
                        )}
                      </tr>

                      {/* Expanded Row - Top 5 Scores (only for reaction-time) */}
                      {isReactionTime && expandedUserId === entry.user_id && (
                        <tr className="animate-slideDown">
                          <td colSpan={(scope === 'global' || scope === 'country') ? 6 : 5} className="px-3 md:px-6 bg-gray-50 overflow-hidden">
                            <div className="py-3 md:py-4 animate-fadeIn">
                              <div className="max-w-3xl">
                                <h4 className="text-xs md:text-sm font-bold text-gray-700 mb-2 md:mb-3">
                                  {entry.username || 'Anonymous'}'s Top 5 Best Scores
                                </h4>
                                {loadingScores ? (
                                  <p className="text-xs md:text-sm text-gray-500">Loading scores...</p>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
                                    {expandedScores.map((score, index) => (
                                      <div
                                        key={index}
                                        className={`p-2 md:p-3 rounded-lg border transform transition-all duration-300 ease-out ${
                                          score
                                            ? 'bg-white border-gray-200'
                                            : 'bg-gray-100 border-gray-300 border-dashed'
                                        }`}
                                        style={{
                                          animationDelay: `${index * 50}ms`,
                                          animation: 'cardSlideUp 0.3s ease-out forwards',
                                          opacity: 0,
                                          transform: 'translateY(10px)'
                                        }}
                                      >
                                        <div className="text-xs text-gray-500 mb-1">
                                          #{index + 1}
                                        </div>
                                        <div className="text-base md:text-lg font-bold text-gray-900">
                                          {score
                                            ? formatScore(score.score_value, testInfo?.unit || null)
                                            : '—'}
                                        </div>
                                        {score && (
                                          <div className="text-xs text-gray-400 mt-1">
                                            {formatDate(score.created_at)}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}