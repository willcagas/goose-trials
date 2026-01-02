'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { submitScore } from '@/lib/db/scores';

type Phase = 'idle' | 'showing' | 'input' | 'failed';

export default function NumberMemoryGamePage() {
  // Game state
  const [phase, setPhase] = useState<Phase>('idle');
  const [currentDigits, setCurrentDigits] = useState(3);
  const [currentNumber, setCurrentNumber] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [highestRecalled, setHighestRecalled] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Timer reference for cleanup
  const displayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load best score from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('number_memory_best');
    if (stored !== null) {
      setBestScore(Number(stored));
    }
  }, []);

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

  // Handle start button
  function handleStart() {
    setCurrentDigits(3);
    setHighestRecalled(0);
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
      if (finalScore > 0) {
        setSubmitting(true);
        const result = await submitScore('number-memory', finalScore);
        setSubmitting(false);

        if (result.success) {
          console.log('Score submitted successfully!');
        } else {
          console.error('Failed to submit score:', result.error);
        }
      }

      // Update best score display if needed (already done above on correct answers)
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
    if (e.key === 'Enter') {
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
  }

  // Background color based on phase
  function getBackgroundColor() {
    switch (phase) {
      case 'idle':
      case 'showing':
        return 'bg-black';
      case 'input':
        return 'bg-zinc-900';
      case 'failed':
        return 'bg-yellow-600';
      default:
        return 'bg-black';
    }
  }

  // Header text based on phase
  function getHeaderText() {
    switch (phase) {
      case 'idle':
        return 'Number Memory';
      case 'showing':
        return `Level ${currentDigits} — Memorize`;
      case 'input':
        return `Level ${currentDigits} — Enter Number`;
      case 'failed':
        return `Game Over — You reached ${highestRecalled} digits`;
      default:
        return 'Number Memory';
    }
  }

  // Sub text based on phase
  function getSubText() {
    switch (phase) {
      case 'idle':
        return 'Remember the number, then type it back. Each level adds one more digit.';
      case 'showing':
        return 'You have 2-4 seconds to memorize…';
      case 'input':
        return 'Type the number exactly as you saw it.';
      case 'failed':
        return 'One mistake ends the run.';
      default:
        return '';
    }
  }

  return (
    <div className={`relative min-h-screen w-full ${getBackgroundColor()} transition-colors duration-300 text-yellow-50`}>
      {/* Back Home Button */}
      <Link
        href="/"
        className="absolute top-6 left-6 px-4 py-2 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-50 font-semibold rounded-lg transition z-10 border border-yellow-400/30"
      >
        ← Back Home
      </Link>

      {/* Main content wrapper - grid for viewport centering */}
      <div className="min-h-screen grid place-items-center px-6">
        {/* Inner content container */}
        <div className="max-w-2xl w-full flex flex-col items-center text-center gap-6">
          {/* Header section */}
          <div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-yellow-50">{getHeaderText()}</h1>
            <p className="text-xl font-semibold text-yellow-100/80 mt-2">{getSubText()}</p>

            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <div className="px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/25">
                Best: <span className="font-bold text-yellow-50">{bestScore}</span>
              </div>
              {phase !== 'idle' && phase !== 'failed' && (
                <div className="px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/25">
                  Digits: <span className="font-bold text-yellow-50">{currentDigits}</span>
                </div>
              )}
            </div>
          </div>

          {/* Idle phase - Start screen */}
          {phase === 'idle' && (
            <>
              <button
                onClick={handleStart}
                className="px-8 py-4 bg-yellow-400 text-black font-black text-xl rounded-xl hover:bg-yellow-300 transition"
              >
                Start
              </button>

              <div className="text-center text-yellow-100/80 text-lg max-w-lg leading-relaxed">
                <p className="mb-3 font-semibold">Rules:</p>
                <ul className="mt-2 space-y-2">
                  <li>• A number appears for 2-4 seconds</li>
                  <li>• Type the number exactly as you saw it</li>
                  <li>• Each correct answer adds one more digit</li>
                  <li>• One mistake ends the game</li>
                  <li>• Score = highest number of digits you correctly recalled</li>
                </ul>
              </div>
            </>
          )}

          {/* Showing phase - Display number */}
          {phase === 'showing' && (
            <div className="w-full">
              <div className="text-center">
                <div className="text-9xl sm:text-[12rem] font-black text-yellow-400 mb-6 select-none">
                  {currentNumber}
                </div>
                <p className="text-yellow-100/80 text-sm">Memorize…</p>
              </div>
            </div>
          )}

          {/* Input phase - User enters number */}
          {phase === 'input' && (
            <div className="w-full">
              <div className="text-center">
                <div className="mb-8">
                  <div className="text-6xl font-black text-yellow-400/20 mb-4 select-none">
                    {'•'.repeat(currentDigits)}
                  </div>
                  <p className="text-yellow-100/80 text-sm mb-6">Enter the {currentDigits}-digit number</p>
                </div>
                
                <div className="space-y-4">
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
                    className="w-full px-6 py-4 text-5xl font-mono text-center bg-yellow-950/40 border-2 border-yellow-400/30 rounded-xl text-yellow-50 placeholder-yellow-400/40 focus:outline-none focus:border-yellow-400 transition-colors"
                    placeholder="Type number..."
                  />
                  
                  <button
                    onClick={handleSubmit}
                    disabled={inputValue.trim() === ''}
                    className="px-8 py-4 bg-yellow-400 text-black font-bold text-lg rounded-xl hover:bg-yellow-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Failed phase - Game over */}
          {phase === 'failed' && (
            <div className="text-center">
              <div className="text-2xl font-bold mb-2 text-yellow-50">
                Score: <span className="text-yellow-50">{highestRecalled}</span>
              </div>

              {submitting && <p className="text-yellow-100/80 mb-2">Saving score...</p>}
              {!submitting && highestRecalled > 0 && <p className="text-green-300/80 mb-2">✓ Score saved!</p>}

              <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                <button
                  onClick={handleRestart}
                  className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition"
                >
                  Restart
                </button>
              </div>

              <p className="text-yellow-100/80 mt-4 text-sm">Tip: type the number exactly as shown, including leading zeros.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
