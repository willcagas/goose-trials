'use client';

import { useState, useEffect, useRef } from 'react';
import { submitScore } from '@/lib/db/scores';
import Link from 'next/link';
import { useMe } from '@/app/providers/MeContext';
import { createClient } from '@/lib/supabase/client';
import GameShell, { GameShellState, GameResult } from '@/components/GameShell';
import { getGameMetadata } from '@/lib/games/registry';

interface TopScore {
  score_value: number;
  created_at: string;
}

type InternalGameState = 'idle' | 'waiting' | 'ready' | 'clicked' | 'tooEarly';

export default function ReactionTimeGame() {
  const [internalState, setInternalState] = useState<InternalGameState>('idle');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GameResult | undefined>(undefined);

  // Top 5 scores
  const [topScores, setTopScores] = useState<(TopScore | null)[]>(Array(5).fill(null));
  const [leaderboardAverage, setLeaderboardAverage] = useState<number | null>(null);
  const [loadingScores, setLoadingScores] = useState(true);

  const { me } = useMe();

  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Map internal state to GameShell state
  const getShellState = (): GameShellState => {
    if (internalState === 'idle') return 'IDLE';
    if (internalState === 'waiting' || internalState === 'ready') return 'PLAYING';
    if (internalState === 'clicked' || internalState === 'tooEarly') return 'FINISHED';
    return 'IDLE';
  };

  // Load best time from localStorage and Supabase on mount
  useEffect(() => {
    // First load from localStorage
    const storedBestTime = localStorage.getItem('reaction_best_time');
    let localBest: number | null = null;
    if (storedBestTime) {
      localBest = Number(storedBestTime);
      setBestTime(localBest);
    }

    // If user is logged in, fetch best score from Supabase
    if (me?.isLoggedIn && me?.userId) {
      const fetchBestScore = async () => {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('scores')
            .select('score_value')
            .eq('test_slug', 'reaction-time')
            .eq('user_id', me.userId)
            .order('score_value', { ascending: true }) // Lower is better for reaction time
            .limit(1);

          if (!error && data && data.length > 0) {
            const dbBest = data[0].score_value;
            // Use the lower of localStorage and database (lower is better for reaction time)
            if (localBest === null || dbBest < localBest) {
              setBestTime(dbBest);
            }
          }
        } catch (error) {
          console.error('Error fetching best score from Supabase:', error);
        }
      };

      fetchBestScore();
    }
  }, [me?.isLoggedIn, me?.userId]);

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
    setInternalState('waiting');
    setReactionTime(null);
    setResult(undefined);

    // Random delay between 2-5 seconds
    const delay = 2000 + Math.random() * 3000;

    timeoutRef.current = setTimeout(() => {
      startTimeRef.current = Date.now();
      setInternalState('ready');
    }, delay);
  };

  const handleClick = async () => {
    if (internalState === 'waiting') {
      // Clicked too early!
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setInternalState('tooEarly');
      setResult({
        score: 'Too Early!',
        message: 'Wait for the green screen before clicking.',
      });
      return;
    }

    if (internalState === 'ready') {
      // Calculate reaction time
      const endTime = Date.now();
      const reaction = endTime - startTimeRef.current;
      setReactionTime(reaction);
      setAttempts(prev => prev + 1);

      // Update best time
      const newBest = bestTime === null || reaction < bestTime ? reaction : bestTime;
      if (reaction < (bestTime ?? Infinity)) {
        setBestTime(reaction);
      }

      setInternalState('clicked');
      setResult({
        score: reaction,
        scoreLabel: 'ms',
        personalBest: newBest,
        personalBestLabel: 'ms',
        message: `Attempts: ${attempts + 1}`,
      });

      // Submit score to database
      setSubmitting(true);
      const submitResult = await submitScore('reaction-time', reaction);
      setSubmitting(false);

      if (submitResult.success) {
        console.log('Score submitted successfully!');
        // Refresh top scores after submission
        await fetchTopScores();
        // Refresh best score from Supabase
        if (me?.isLoggedIn && me?.userId) {
          try {
            const supabase = createClient();
            const { data, error } = await supabase
              .from('scores')
              .select('score_value')
              .eq('test_slug', 'reaction-time')
              .eq('user_id', me.userId)
              .order('score_value', { ascending: true }) // Lower is better for reaction time
              .limit(1);

            if (!error && data && data.length > 0) {
              const dbBest = data[0].score_value;
              // Update best time if database has a better score
              if (bestTime === null || dbBest < bestTime) {
                setBestTime(dbBest);
              }
            }
          } catch (error) {
            console.error('Error refreshing best score from Supabase:', error);
          }
        }
      } else {
        console.error('Failed to submit score:', submitResult.error);
      }
    }
  };

  const reset = () => {
    setInternalState('idle');
    setReactionTime(null);
    setResult(undefined);
  };

  const handleRestart = () => {
    reset();
    startGame();
  };

  const getBackgroundColor = () => {
    switch (internalState) {
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

  const getStatusText = () => {
    switch (internalState) {
      case 'waiting':
        return 'Wait for green...';
      case 'ready':
        return 'Click now!';
      case 'clicked':
        return submitting ? 'Saving score...' : 'Score saved!';
      case 'tooEarly':
        return 'Too early!';
      default:
        return '';
    }
  };

  // Render game UI
  const renderGame = () => {
    const bgColor = getBackgroundColor();
    
    return (
      <div
        className={`min-h-[60vh] ${bgColor} transition-colors duration-300 flex items-center justify-center text-white cursor-pointer select-none rounded-xl`}
        onClick={handleClick}
      >
        <div className="text-center px-4">
          {internalState === 'waiting' && (
            <>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Wait for Green...</h2>
              <p className="text-xl md:text-2xl">Don't click yet!</p>
            </>
          )}
          {internalState === 'ready' && (
            <h2 className="text-5xl md:text-7xl font-bold animate-pulse">CLICK NOW!</h2>
          )}
        </div>
      </div>
    );
  };

  // Custom result render for better formatting
  const renderResult = (result: GameResult) => {
    if (internalState === 'tooEarly') {
      return (
        <div className="text-center space-y-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Too Early!</h2>
            <p className="text-white/70 text-lg">{result.message}</p>
          </div>
          <button
            onClick={handleRestart}
            className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return (
      <div className="text-center space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Run Complete</h2>
          <div className="text-5xl md:text-6xl font-bold text-amber-400 mb-2">
            {reactionTime}
            {result.scoreLabel && (
              <span className="text-2xl md:text-3xl text-white/60 ml-2">
                {result.scoreLabel}
              </span>
            )}
          </div>
          {submitting && <p className="text-white/60 text-base">Saving score...</p>}
          {!submitting && <p className="text-green-400 text-base">✓ Score saved!</p>}
          {result.personalBest !== undefined && (
            <p className="text-white/60 text-sm md:text-base mt-2">
              Personal Best: {result.personalBest}
              {result.personalBestLabel && ` ${result.personalBestLabel}`}
            </p>
          )}
          {result.message && (
            <p className="text-white/60 text-sm mt-2">{result.message}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleRestart}
            className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl transition-colors"
          >
            Play Again
          </button>
          <Link
            href={`/leaderboard/reaction-time`}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors border border-white/20"
          >
            View Leaderboard
          </Link>
        </div>
      </div>
    );
  };

  // Custom ready view
  const renderReady = () => (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] mb-3">
          Reaction Time
        </h2>
        <p className="text-[#0a0a0a]/70 text-lg">
          Click when the screen turns green!
        </p>
      </div>
      {bestTime && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <div className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/25 text-[#0a0a0a]">
            Best: <span className="font-bold">{bestTime} ms</span>
          </div>
        </div>
      )}
      <button
        onClick={startGame}
        className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-black font-bold text-lg rounded-xl transition-colors"
      >
        Press Space / Tap Start
      </button>
    </div>
  );

  const gameMetadata = getGameMetadata('reaction-time');

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Main Game Area with GameShell */}
      <div className="flex-1">
        <GameShell
          gameMetadata={gameMetadata}
          gameState={getShellState()}
          onStart={startGame}
          onRestart={handleRestart}
          onQuit={reset}
          renderGame={renderGame}
          renderReady={renderReady}
          renderResult={renderResult}
          result={result}
          statusText={getStatusText()}
          maxWidth="2xl"
        />
      </div>

      {/* Top 5 Scores Sidebar */}
      <div className="w-full md:w-80 bg-[#0a0a0a] border-t md:border-t-0 md:border-l border-white/10 p-4 md:p-6 overflow-y-auto">
        <h3 className="text-lg md:text-xl font-bold text-white mb-2">Your Top 5 Scores</h3>

        {!me?.isLoggedIn ? (
          <div className="bg-white/10 border border-amber-400/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-white/80">
              <Link href="/" className="text-amber-400 hover:text-amber-300 font-semibold underline">
                Sign in
              </Link>
              {' '}to track your top scores and appear on the leaderboard!
            </p>
          </div>
        ) : (
          <>
            {/* Leaderboard Requirement Notice */}
            {topScores.filter(s => s !== null).length < 5 && (
              <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-4 mb-4">
                <p className="text-xs font-semibold text-amber-400 mb-1">
                  Leaderboard Requirement
                </p>
                <p className="text-sm text-white/70">
                  Complete 5 attempts to appear on the leaderboard.
                  <span className="font-semibold"> ({topScores.filter(s => s !== null).length}/5)</span>
                </p>
              </div>
            )}
          </>
        )}

        {me?.isLoggedIn && loadingScores ? (
          <p className="text-white/60 text-sm">Loading scores...</p>
        ) : me?.isLoggedIn ? (
          <>
            {/* Leaderboard Average */}
            {leaderboardAverage !== null && (
              <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-4 mb-4">
                <p className="text-xs text-white/60 mb-1">Leaderboard Score (Avg)</p>
                <p className="text-2xl font-bold text-amber-400">
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
                      ? 'bg-white/10 border-white/20'
                      : 'bg-white/5 border-white/10 border-dashed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/60">
                      #{index + 1}
                    </span>
                    <span className={`text-lg font-bold ${score ? 'text-white' : 'text-white/40'}`}>
                      {score ? `${score.score_value} ms` : '—'}
                    </span>
                  </div>
                  {score && (
                    <div className="text-xs text-white/40 mt-1">
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
              className="mt-6 block w-full px-4 py-3 bg-amber-400 hover:bg-amber-300 text-black font-semibold text-center rounded-lg transition"
            >
              View Full Leaderboard
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
