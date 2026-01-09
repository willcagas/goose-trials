'use client';

import { useEffect, useRef, useState } from 'react';
import { submitScore } from '@/lib/db/scores';
import GameShell, { GameShellState, GameResult } from '@/components/GameShell';
import { getGameMetadata } from '@/lib/games/registry';
import { useMe } from '@/app/providers/MeContext';
import { createClient } from '@/lib/supabase/client';
import ResultCard from '@/components/ResultCard';

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
  const [memorizeProgress, setMemorizeProgress] = useState(100);
  const [scoreTimestamp, setScoreTimestamp] = useState<Date | undefined>(undefined);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  // Timer reference for cleanup
  const displayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressAnimationRef = useRef<number | null>(null);
  const progressStartTimeRef = useRef<number | null>(null);
  const displayTimeRef = useRef<number>(3000);
  const isShowingPhaseRef = useRef(false);

  // Load best score from localStorage and Supabase on mount
  useEffect(() => {
    // Only show best scores for logged-in users
    if (!me?.isLoggedIn || !me?.userId) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setBestScore(0), 0);
      return;
    }

    // Load from localStorage as initial value
    const stored = localStorage.getItem('number_memory_best');
    let localBest = 0;
    if (stored !== null) {
      localBest = Number(stored);
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setBestScore(localBest), 0);
    }

    // Fetch best score from Supabase
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
      if (progressAnimationRef.current !== null) {
        cancelAnimationFrame(progressAnimationRef.current);
      }
    };
  }, []);

  // Animate progress bar during showing phase
  useEffect(() => {
    if (phase === 'showing') {
      // Initialize state and refs - this is fine to do synchronously for initialization
      setMemorizeProgress(100);
      const startTime = Date.now();
      progressStartTimeRef.current = startTime;
      isShowingPhaseRef.current = true;
      
      const animate = () => {
        if (progressStartTimeRef.current === null || !isShowingPhaseRef.current) return;
        
        const elapsed = Date.now() - progressStartTimeRef.current;
        const elapsedProgress = Math.min((elapsed / displayTimeRef.current) * 100, 100);
        const remainingProgress = 100 - elapsedProgress;
        setMemorizeProgress(remainingProgress);
        
        if (remainingProgress > 0 && isShowingPhaseRef.current) {
          progressAnimationRef.current = requestAnimationFrame(animate);
        }
      };
      
      // Start animation on next frame to ensure state update is processed
      progressAnimationRef.current = requestAnimationFrame(() => {
        requestAnimationFrame(animate);
      });
    } else {
      isShowingPhaseRef.current = false;
      setMemorizeProgress(100);
      if (progressAnimationRef.current !== null) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
      progressStartTimeRef.current = null;
    }
    
    return () => {
      isShowingPhaseRef.current = false;
      if (progressAnimationRef.current !== null) {
        cancelAnimationFrame(progressAnimationRef.current);
      }
    };
  }, [phase]);

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
  // Generate digit by digit to avoid precision loss and scientific notation
  // JavaScript's Number type loses precision beyond ~15-16 digits
  function generateNumber(digitCount: number): string {
    const digits: string[] = [];
    // First digit can't be 0 (unless digitCount is 1, in which case it can be 0-9)
    if (digitCount === 1) {
      digits.push(String(Math.floor(Math.random() * 10)));
    } else {
      // First digit: 1-9
      digits.push(String(Math.floor(Math.random() * 9) + 1));
      // Remaining digits: 0-9
      for (let i = 1; i < digitCount; i++) {
        digits.push(String(Math.floor(Math.random() * 10)));
      }
    }
    return digits.join('');
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

    // Display time scales with number of digits for fairness
    // Base time of 2 seconds + 0.5 seconds per digit
    // Example: 3 digits = 3.5s, 10 digits = 7s, 20 digits = 12s
    // Add some randomization (±0.3 seconds) to keep it interesting
    const baseTime = 2000;
    const timePerDigit = 500;
    const randomVariation = (Math.random() - 0.5) * 600; // -300ms to +300ms
    const displayTime = baseTime + (digitCount * timePerDigit) + randomVariation;
    displayTimeRef.current = displayTime;
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
      setScoreTimestamp(new Date());
      
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
        setIsNewHighScore(false);
        // Pass previous best to avoid race condition with isNewHighScore
        const previousBest = bestScore > 0 ? bestScore : null;
        const submitResult = await submitScore('number-memory', finalScore, previousBest);
        setSubmitting(false);

        if (submitResult.success) {
          console.log('Score submitted successfully!');
          if (submitResult.isNewHighScore) {
            setIsNewHighScore(true);
          }
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
    // Clear any pending display timer and progress animation to avoid
    // orphaned callbacks firing after restart (which caused the reported
    // glitch where the UI would jump to the input screen unexpectedly).
    if (displayTimerRef.current !== null) {
      clearTimeout(displayTimerRef.current);
      displayTimerRef.current = null;
    }

    if (progressAnimationRef.current !== null) {
      cancelAnimationFrame(progressAnimationRef.current);
      progressAnimationRef.current = null;
    }

    progressStartTimeRef.current = null;
    isShowingPhaseRef.current = false;
    setMemorizeProgress(100);

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
      // Calculate responsive font size that shrinks as digits increase
      // Desktop: starts at 12rem (192px) and shrinks proportionally based on digit count
      const baseFontSize = 192; // 12rem in pixels
      // More aggressive scaling for longer numbers
      const desktopFontSize = baseFontSize * Math.min(1, 8 / currentNumber.length);
      const mobileFontSize = 90 / currentNumber.length;

      return (
        <div className="text-center space-y-6">
          <div className="flex justify-center items-center w-full px-4">
            <div
              className="font-mono font-black text-amber-400 select-none tabular-nums whitespace-nowrap"
              style={{
                fontSize: `clamp(2rem, ${mobileFontSize}vw, ${desktopFontSize}px)`,
                lineHeight: '1.1'
              }}
            >
              {currentNumber}
            </div>
          </div>
          <div className="w-full max-w-md mx-auto">
            <div className="h-2 bg-amber-950/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full"
                style={{
                  width: `${memorizeProgress}%`,
                  transition: 'none'
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    if (phase === 'input') {
      return (
        <div className="text-center space-y-8 w-full">
          <div className="mb-4">
            <p className="text-[#0a0a0a]/60 text-sm mb-6">What was the number?</p>
          </div>

          <div className="space-y-6">
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
                className="px-4 py-3 text-5xl md:text-6xl font-mono text-center bg-transparent border-b-2 border-gray-300 text-gray-900 focus:outline-none focus:border-amber-400 transition-colors tabular-nums"
                style={{ width: `${Math.min(currentDigits * 2.8 + 2, 20)}rem`, maxWidth: '90vw' }}
                placeholder=""
                autoComplete="off"
                autoFocus
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={inputValue.trim() === ''}
              className="px-8 py-3 bg-amber-400 text-black font-semibold text-base rounded-lg hover:bg-amber-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
          Best: <span className="font-bold">{bestScore > 0 ? bestScore : '--'}</span>
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
    <ResultCard
      gameMetadata={gameMetadata}
      score={result.score}
      scoreLabel="digits"
      personalBest={bestScore > 0 ? bestScore : undefined}
      personalBestLabel="digits"
      isNewHighScore={isNewHighScore}
      timestamp={scoreTimestamp}
      onPlayAgain={handleRestart}
      isSubmitting={submitting}
    />
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
