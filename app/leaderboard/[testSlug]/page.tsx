'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useMe } from '@/app/providers/MeContext';
import Navbar from '@/components/Navbar';
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
  if (unit === 'time') {
    // Format milliseconds as minutes (e.g., 0.25 min)
    const minutes = score / 60000;
    return `${minutes.toFixed(2)} min`;
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/leaderboard"
            className="text-gray-600 hover:text-gray-900 mb-4 inline-block"
          >
            ← Back to Leaderboards
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-2 text-gray-900">
                {testInfo?.name || testSlug}
              </h1>
              {testInfo?.description && (
                <p className="text-gray-600 text-lg">{testInfo.description}</p>
              )}
            </div>
            <button
              onClick={loadLeaderboards}
              disabled={loading}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setScope('global')}
              className={`px-6 py-3 font-bold text-sm uppercase tracking-wide transition-colors ${
                scope === 'global'
                  ? 'border-b-2 border-[#c9a504] text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Global
            </button>
            <button
              onClick={() => setScope('country')}
              disabled={!canViewCountry}
              className={`px-6 py-3 font-bold text-sm uppercase tracking-wide transition-colors ${
                !canViewCountry
                  ? 'text-gray-300 cursor-not-allowed'
                  : scope === 'country'
                  ? 'border-b-2 border-[#c9a504] text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {me?.isLoggedIn && universityInfo?.country
                ? <>{getFlagEmoji(universityInfo.alpha_two_code)}&nbsp;&nbsp;{universityInfo.country}</>
                : 'Your Country'}
            </button>
            <button
              onClick={() => setScope('campus')}
              disabled={!canViewCampus}
              className={`px-6 py-3 font-bold text-sm uppercase tracking-wide transition-colors ${
                !canViewCampus
                  ? 'text-gray-300 cursor-not-allowed'
                  : scope === 'campus'
                  ? 'border-b-2 border-[#c9a504] text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {me?.isLoggedIn && universityInfo?.name
                ? universityInfo.name
                : 'Your University'}
            </button>
          </div>
          {/* Messages for campus access */}
          {!canViewCampus && me?.isLoggedIn && (
            <div className="mt-4 px-6 py-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-gray-700">
                We couldn't match your email domain to a university yet. Campus leaderboard unavailable.
              </p>
            </div>
          )}
          {!me?.isLoggedIn && (
            <div className="mt-4 px-6 py-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Sign in to appear on leaderboards.</span>
                {' '}
                <Link href="/" className="text-blue-600 hover:text-blue-800 underline">
                  Sign in with your university email
                </Link>
              </p>
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
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                        Rank
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                        Player
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-700">
                        {(scope === 'global' || scope === 'country') ? 'University' : ''}
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700">
                        {testInfo?.unit === 'level' ? 'Level' : 'Score'}
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-700">
                        Achieved
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-700">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentData.map((entry) => (
                      <React.Fragment key={entry.user_id}>
                        {/* Main Row */}
                        <tr
                          onClick={() => handleRowClick(entry.user_id)}
                          className={`${
                            entry.is_you
                              ? 'bg-[#c9a504]/10 font-semibold'
                              : 'hover:bg-gray-50'
                          } transition-colors cursor-pointer`}
                        >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {entry.rank}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {entry.avatar_url ? (
                              <img
                                src={entry.avatar_url}
                                alt={entry.username || 'User'}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
                                {(entry.username || 'U')[0].toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm text-gray-900">
                              {entry.username || 'Anonymous'}
                              {entry.is_you && (
                                <span className="ml-2 text-xs text-[#c9a504]">(You)</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {(scope === 'global' || scope === 'country') && (
                            entry.university_id && universityMap[entry.university_id]
                              ? universityMap[entry.university_id].name
                              : <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                          {formatScore(entry.best_score, testInfo?.unit || null)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                          {formatDate(entry.achieved_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
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
                      </tr>

                      {/* Expanded Row - Top 5 Scores */}
                      {expandedUserId === entry.user_id && (
                        <tr className="animate-slideDown">
                          <td colSpan={6} className="px-6 bg-gray-50 overflow-hidden">
                            <div className="py-4 animate-fadeIn">
                              <div className="max-w-3xl">
                                <h4 className="text-sm font-bold text-gray-700 mb-3">
                                  {entry.username || 'Anonymous'}'s Top 5 Best Scores
                                </h4>
                                {loadingScores ? (
                                  <p className="text-sm text-gray-500">Loading scores...</p>
                                ) : (
                                  <div className="grid grid-cols-5 gap-3">
                                    {expandedScores.map((score, index) => (
                                      <div
                                        key={index}
                                        className={`p-3 rounded-lg border transform transition-all duration-300 ease-out ${
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
                                        <div className="text-lg font-bold text-gray-900">
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
    </div>
  );
}