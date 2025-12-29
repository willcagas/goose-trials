'use client';

import { useState, useEffect, useRef } from 'react';
import { submitScore } from '@/lib/db/scores';
import Link from 'next/link';

type GameState = 'idle' | 'waiting' | 'ready' | 'clicked' | 'tooEarly' | 'complete';

export default function ReactionTimeGame() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load best time from localStorage on mount
  useEffect(() => {
    const storedBestTime = localStorage.getItem('reaction_best_time');
    if (storedBestTime) {
      setBestTime(Number(storedBestTime));
    }
  }, []);

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
    <div
      className={`min-h-screen ${getBackgroundColor()} transition-colors duration-300 flex items-center justify-center text-white cursor-pointer select-none relative`}
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
  );
}
