'use client';

import { useState, useEffect, useRef } from 'react';
import { submitScore } from '@/lib/db/scores';
import Link from 'next/link';
import { useMe } from '@/app/providers/MeContext';

type GameState = 'idle' | 'waiting' | 'ready' | 'clicked' | 'tooEarly' | 'complete';

interface TopScore {
  score_value: number;
  created_at: string;
}

export default function ReactionTimeGame() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // NEW STATE: Top 5 scores
  const [topScores, setTopScores] = useState<(TopScore | null)[]>(Array(5).fill(null));
  const [leaderboardAverage, setLeaderboardAverage] = useState<number | null>(null);
  const [loadingScores, setLoadingScores] = useState(true);

  const { me } = useMe();

  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load best time from localStorage on mount
  useEffect(() => {
    const storedBestTime = localStorage.getItem('reaction_best_time');
    if (storedBestTime) {
      setBestTime(Number(storedBestTime));
    }
  }, []);

  // NEW: Fetch top 5 scores
  const fetchTopScores = async () => {
    setLoadingScores(true);
    try {
      const response = await fetch('/api/user-top-scores?test_slug=reaction-time');
      if (response.ok) {
        const { data, average } = await response.json();
        setTopScores(data);
        setLeaderboardAverage(average);
      }
    } catch (error) {
      console.error('Error fetching top scores:', error);
    } finally {
      setLoadingScores(false);
    }
  };

  // Fetch top scores on mount and when user logs in
  useEffect(() => {
    fetchTopScores();
  }, [me?.userId]);

  // Save best time to localStorage whenever it changes
  useEffect(() => {
    if (bestTime !== null) {
      localStorage.setItem('reaction_best_time', bestTime.toString());
    }
  }, [bestTime]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startGame = () => {
    setGameState('waiting');
    setReactionTime(null);

    // Random delay between 2-5 seconds
    const delay = 2000 + Math.random() * 3000;

    timeoutRef.current = setTimeout(() => {
      startTimeRef.current = Date.now();
      setGameState('ready');
    }, delay);
  };

  const handleClick = async () => {
    if (gameState === 'waiting') {
      // Clicked too early!
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setGameState('tooEarly');
      return;
    }

    if (gameState === 'ready') {
      // Calculate reaction time
      const endTime = Date.now();
      const reaction = endTime - startTimeRef.current;
      setReactionTime(reaction);
      setAttempts(prev => prev + 1);

      // Update best time
      if (bestTime === null || reaction < bestTime) {
        setBestTime(reaction);
      }

      setGameState('clicked');

      // Submit score to database
      setSubmitting(true);
      const result = await submitScore('reaction-time', reaction);
      setSubmitting(false);

      if (result.success) {
        console.log('Score submitted successfully!');
        // Refresh top scores after submission
        await fetchTopScores();
      } else {
        console.error('Failed to submit score:', result.error);
      }
    }
  };

  const reset = () => {
    setGameState('idle');
    setReactionTime(null);
  };

  const getBackgroundColor = () => {
    switch (gameState) {
      case 'idle':
        return 'bg-blue-500';
      case 'waiting':
        return 'bg-red-500';
      case 'ready':
        return 'bg-green-500';
      case 'tooEarly':
        return 'bg-orange-500';
      case 'clicked':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getMessage = () => {
    switch (gameState) {
      case 'idle':
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">Reaction Time Test</h2>
            <p className="text-xl mb-6">Click when the screen turns green!</p>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-white text-blue-600 font-bold text-xl rounded-lg hover:bg-gray-100 transition"
            >
              Start Game
            </button>
          </div>
        );
      case 'waiting':
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">Wait for Green...</h2>
            <p className="text-xl">Don't click yet!</p>
          </div>
        );
      case 'ready':
        return (
          <div className="text-center">
            <h2 className="text-6xl font-bold animate-pulse">CLICK NOW!</h2>
          </div>
        );
      case 'tooEarly':
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">Too Early!</h2>
            <p className="text-xl mb-6">Wait for the green screen</p>
            <button
              onClick={reset}
              className="px-8 py-4 bg-white text-orange-600 font-bold text-xl rounded-lg hover:bg-gray-100 transition"
            >
              Try Again
            </button>
          </div>
        );
      case 'clicked':
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">Reaction Time</h2>
            <div className="text-8xl font-bold mb-4">{reactionTime}ms</div>
            {submitting && <p className="text-lg mb-2 text-blue-200">Saving score...</p>}
            {!submitting && <p className="text-lg mb-2 text-green-200">✓ Score saved!</p>}
            {bestTime && (
              <p className="text-xl mb-6">
                Best: {bestTime}ms | Attempts: {attempts}
              </p>
            )}
            <div className="space-x-4">
              <button
                onClick={startGame}
                className="px-6 py-3 bg-white text-blue-600 font-bold text-lg rounded-lg hover:bg-gray-100 transition"
              >
                Play Again
              </button>
              <button
                onClick={reset}
                className="px-6 py-3 bg-white/20 text-white font-bold text-lg rounded-lg hover:bg-white/30 transition"
              >
                Back
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Main Game Area */}
      <div
        className={`flex-1 ${getBackgroundColor()} transition-colors duration-300 flex items-center justify-center text-white cursor-pointer select-none relative`}
        onClick={handleClick}
      >
        {/* Back Home Button */}
        <Link
          href="/"
          className="absolute top-4 left-4 px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg transition z-10"
          onClick={(e) => e.stopPropagation()}
        >
          ← Back Home
        </Link>

        <div className="max-w-2xl mx-auto px-4">
          {getMessage()}
        </div>
      </div>

      {/* Top 5 Scores Sidebar */}
      <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Your Top 5 Scores</h3>

        {!me?.isLoggedIn ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-700">
              <Link href="/" className="text-blue-600 hover:text-blue-800 font-semibold underline">
                Sign in
              </Link>
              {' '}to track your top scores and appear on the leaderboard!
            </p>
          </div>
        ) : (
          <>
            {/* Leaderboard Requirement Notice */}
            {topScores.filter(s => s !== null).length < 5 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-xs font-semibold text-amber-800 mb-1">
                  Leaderboard Requirement
                </p>
                <p className="text-sm text-amber-700">
                  Complete 5 attempts to appear on the leaderboard.
                  <span className="font-semibold"> ({topScores.filter(s => s !== null).length}/5)</span>
                </p>
              </div>
            )}
          </>
        )}

        {me?.isLoggedIn && loadingScores ? (
          <p className="text-gray-500 text-sm">Loading scores...</p>
        ) : me?.isLoggedIn ? (
          <>
            {/* Leaderboard Average */}
            {leaderboardAverage !== null && (
              <div className="bg-[#c9a504]/10 border border-[#c9a504]/30 rounded-lg p-4 mb-4">
                <p className="text-xs text-gray-600 mb-1">Leaderboard Score (Avg)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {leaderboardAverage.toFixed(0)} ms
                </p>
              </div>
            )}

            {/* Top 5 Scores List */}
            <div className="space-y-2">
              {topScores.map((score, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    score
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50 border-gray-300 border-dashed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">
                      #{index + 1}
                    </span>
                    <span className={`text-lg font-bold ${score ? 'text-gray-900' : 'text-gray-400'}`}>
                      {score ? `${score.score_value} ms` : '—'}
                    </span>
                  </div>
                  {score && (
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(score.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* View Full Leaderboard Link */}
            <Link
              href="/leaderboard/reaction-time"
              className="mt-6 block w-full px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-center rounded-lg transition"
              onClick={(e) => e.stopPropagation()}
            >
              View Full Leaderboard
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
