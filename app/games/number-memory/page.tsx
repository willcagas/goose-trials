'use client';

import { useEffect, useRef, useState } from 'react';
import { submitScore } from '@/lib/db/scores';
import GameShell, { GameShellState, GameResult } from '@/components/GameShell';
import { getGameMetadata } from '@/lib/games/registry';
import { useMe } from '@/app/providers/MeContext';
import { createClient } from '@/lib/supabase/client';

type Phase = 'idle' | 'showing' | 'input' | 'failed';

export default function NumberMemoryGamePage() {
  const { me } = useMe();
  // Game state
  const [phase, setPhase] = useState<Phase>('idle');
  const [currentDigits, setCurrentDigits] = useState(3);
  const [currentNumber, setCurrentNumber] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [highestRecalled, setHighestRecalled] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GameResult | undefined>(undefined);

  // Timer reference for cleanup
  const displayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load best score from localStorage and Supabase on mount
  useEffect(() => {
    // First load from localStorage
    const stored = localStorage.getItem('number_memory_best');
    let localBest = 0;
    if (stored !== null) {
      localBest = Number(stored);
      setBestScore(localBest);
    }

    // If user is logged in, fetch best score from Supabase
    if (me?.isLoggedIn && me?.userId) {
      const fetchBestScore = async () => {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('scores')
            .select('score_value')
            .eq('test_slug', 'number-memory')
            .eq('user_id', me.userId)
            .order('score_value', { ascending: false }) // Higher is better
            .limit(1);

          if (!error && data && data.length > 0) {
            const dbBest = data[0].score_value;
            // Use the higher of localStorage and database
            setBestScore(Math.max(localBest, dbBest));
          }
        } catch (error) {
          console.error('Error fetching best score from Supabase:', error);
        }
      };

      fetchBestScore();
    }
  }, [me?.isLoggedIn, me?.userId]);

  // Save best score to localStorage when it changes
  useEffect(() => {
    if (bestScore > 0) {
      localStorage.setItem('number_memory_best', String(bestScore));
    }
  }, [bestScore]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (displayTimerRef.current !== null) {
        clearTimeout(displayTimerRef.current);
      }
    };
  }, []);

  // Focus input when entering input phase
  useEffect(() => {
    if (phase === 'input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase]);

  // Map phase to GameShell state
  const getShellState = (): GameShellState => {
    if (phase === 'idle') return 'IDLE';
    if (phase === 'showing' || phase === 'input') return 'PLAYING';
    if (phase === 'failed') return 'FINISHED';
    return 'IDLE';
  };

  // Generate random N-digit number
  function generateNumber(digitCount: number): string {
    const min = Math.pow(10, digitCount - 1);
    const max = Math.pow(10, digitCount) - 1;
    const num = Math.floor(min + Math.random() * (max - min + 1));
    return String(num).padStart(digitCount, '0');
  }

  // Start a level with given digit count
  function startLevel(digitCount: number) {
    // Clear any existing timer
    if (displayTimerRef.current !== null) {
      clearTimeout(displayTimerRef.current);
    }

    const number = generateNumber(digitCount);
    setCurrentNumber(number);
    setInputValue('');
    setPhase('showing');

    // Random display time between 2-4 seconds
    const displayTime = 2000 + Math.random() * 2000;
    displayTimerRef.current = setTimeout(() => {
      setPhase('input');
    }, displayTime);
  }

  // Handle start
  function handleStart() {
    setCurrentDigits(3);
    setHighestRecalled(0);
    setResult(undefined);
    startLevel(3);
  }

  // Handle input submission
  async function handleSubmit() {
    if (phase !== 'input') return;

    const trimmedInput = inputValue.trim();
    
    // Validate input is not empty
    if (trimmedInput === '') {
      return;
    }

    // Compare as strings
    if (trimmedInput === currentNumber) {
      // Correct answer
      const recalledDigits = currentDigits;
      setHighestRecalled(recalledDigits);
      
      // Update best score if needed
      if (recalledDigits > bestScore) {
        setBestScore(recalledDigits);
      }

      // Move to next level
      const nextDigits = currentDigits + 1;
      setCurrentDigits(nextDigits);
      startLevel(nextDigits);
    } else {
      // Incorrect answer - game over
      setPhase('failed');
      
      // Clear timer
      if (displayTimerRef.current !== null) {
        clearTimeout(displayTimerRef.current);
      }

      // Submit score
      const finalScore = highestRecalled;
      setResult({
        score: finalScore,
        scoreLabel: 'digits',
        personalBest: bestScore,
        personalBestLabel: 'digits',
      });

      if (finalScore > 0) {
        setSubmitting(true);
        const submitResult = await submitScore('number-memory', finalScore);
        setSubmitting(false);

        if (submitResult.success) {
          console.log('Score submitted successfully!');
        } else {
          console.error('Failed to submit score:', submitResult.error);
        }
      }
    }
  }

  // Handle input change - only allow numeric input
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    // Filter to only digits
    const numericValue = value.replace(/\D/g, '');
    setInputValue(numericValue);
  }

  // Handle paste event - prevent or sanitize
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const numericValue = pastedText.replace(/\D/g, '');
    setInputValue(numericValue);
  }

  // Handle Enter key
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && phase === 'input') {
      e.preventDefault();
      handleSubmit();
    }
  }

  // Handle restart
  function handleRestart() {
    setPhase('idle');
    setCurrentDigits(3);
    setHighestRecalled(0);
    setInputValue('');
    setCurrentNumber('');
    setResult(undefined);
  }

  // Get status text
  const getStatusText = () => {
    switch (phase) {
      case 'showing':
        return `Level ${currentDigits} — Memorize`;
      case 'input':
        return `Level ${currentDigits} — Enter Number`;
      case 'failed':
        return submitting ? 'Saving score...' : 'Score saved!';
      default:
        return '';
    }
  };

  // Render game UI
  const renderGame = () => {
    if (phase === 'showing') {
      return (
        <div className="text-center space-y-6">
          <div className="flex justify-center items-center">
            <div className="text-8xl md:text-[12rem] font-mono font-black text-amber-400 select-none tabular-nums">
              {currentNumber}
            </div>
          </div>
          <p className="text-[#0a0a0a]/70 text-lg">Memorize…</p>
        </div>
      );
    }

    if (phase === 'input') {
      return (
        <div className="text-center space-y-6 w-full">
          <div className="mb-8">
            <div className="flex justify-center items-center mb-4">
              <div className="text-5xl md:text-6xl font-mono font-black text-amber-400/20 select-none tabular-nums">
                {'•'.repeat(currentDigits)}
              </div>
            </div>
            <p className="text-[#0a0a0a]/70 text-base mb-6">Enter the {currentDigits}-digit number</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-center items-center w-full">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={inputValue}
                onChange={handleInputChange}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                maxLength={currentDigits}
                className="px-6 py-4 text-4xl md:text-5xl font-mono text-center bg-[#0a0a0a]/10 border-2 border-amber-400/30 rounded-xl text-[#0a0a0a] placeholder-[#0a0a0a]/40 focus:outline-none focus:border-amber-400 transition-colors tabular-nums"
                style={{ width: `${Math.max(currentDigits * 2.5, 10)}rem`, maxWidth: '100%' }}
                placeholder="Type number..."
              />
            </div>
            
            <button
              onClick={handleSubmit}
              disabled={inputValue.trim() === ''}
              className="px-8 py-4 bg-amber-400 text-black font-bold text-lg rounded-xl hover:bg-amber-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // Custom ready view
  const renderReady = () => (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] mb-3">
          Number Memory
        </h2>
        <p className="text-[#0a0a0a]/70 text-lg">
          Remember the number, then type it back. Each level adds one more digit.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 text-sm">
        <div className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/25 text-[#0a0a0a]">
          Best: <span className="font-bold">{bestScore}</span>
        </div>
      </div>
      <button
        onClick={handleStart}
        className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-black font-bold text-lg rounded-xl transition-colors"
      >
        Press Space / Tap Start
      </button>
    </div>
  );

  // Custom result view
  const renderResult = (result: GameResult) => (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#0a0a0a] mb-2">Game Over</h2>
        <div className="text-5xl md:text-6xl font-bold text-amber-400 mb-2">
          {result.score}
          {result.scoreLabel && (
            <span className="text-2xl md:text-3xl text-[#0a0a0a]/60 ml-2">
              {result.scoreLabel}
            </span>
          )}
        </div>
        {submitting && <p className="text-[#0a0a0a]/60 text-base">Saving score...</p>}
        {!submitting && highestRecalled > 0 && <p className="text-green-600 text-base">✓ Score saved!</p>}
        {result.personalBest !== undefined && (
          <p className="text-[#0a0a0a]/60 text-sm md:text-base mt-2">
            Personal Best: {result.personalBest} {result.personalBestLabel}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={handleRestart}
          className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl transition-colors"
        >
          Play Again
        </button>
        <a
          href={`/leaderboard/number-memory`}
          className="px-6 py-3 bg-[#0a0a0a]/10 hover:bg-[#0a0a0a]/20 text-[#0a0a0a] font-semibold rounded-xl transition-colors border border-[#0a0a0a]/20"
        >
          View Leaderboard
        </a>
      </div>
    </div>
  );

  const gameMetadata = getGameMetadata('number-memory');

  return (
    <GameShell
      gameMetadata={gameMetadata}
      gameState={getShellState()}
      onStart={handleStart}
      onRestart={handleRestart}
      onQuit={handleRestart}
      renderGame={renderGame}
      renderReady={renderReady}
      renderResult={renderResult}
      result={result}
      statusText={getStatusText()}
      maxWidth="2xl"
    />
  );
}
