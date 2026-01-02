'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { submitScore } from '@/lib/db/scores';

// ============================================================================
// CONFIGURATION - All tunables in one place
// ============================================================================
const CONFIG = {
  TUTORIAL_DISKS: 3,           // Practice mode, no submission
  RANKED_DISKS: 5,             // Ranked leaderboard run
  MAX_RUN_MS: 60_000,          // Auto-end / DNF threshold
  EXTRA_MOVE_PENALTY_MS: 1200, // Penalty per extra move beyond optimal
  MIN_PLAUSIBLE_MS: 2500,      // Anti-cheat minimum time for n=5
  GAME_SLUG: 'hanoi',
} as const;

// Optimal moves for n disks = 2^n - 1
function getOptimalMoves(disks: number): number {
  return Math.pow(2, disks) - 1;
}

// Calculate final score
function calculateScore(elapsedMs: number, moves: number, disks: number): number {
  const optimal = getOptimalMoves(disks);
  const extraMoves = Math.max(0, moves - optimal);
  return elapsedMs + extraMoves * CONFIG.EXTRA_MOVE_PENALTY_MS;
}

// Format milliseconds as mm:ss.ms
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// Move a disk from one rod to another (immutably)
// Returns new rods state if move is legal, null otherwise
function moveDisk(
  rods: [number[], number[], number[]],
  fromRod: number,
  toRod: number
): [number[], number[], number[]] | null {
  const source = rods[fromRod];
  const target = rods[toRod];
  
  // Can't move from empty rod
  if (source.length === 0) return null;
  
  const movingDisk = source[source.length - 1];
  const targetTop = target.length > 0 ? target[target.length - 1] : Infinity;
  
  // Can't place larger disk on smaller disk
  if (movingDisk > targetTop) return null;
  
  // Perform the move immutably
  const newRods: [number[], number[], number[]] = [
    [...rods[0]],
    [...rods[1]],
    [...rods[2]],
  ];
  const disk = newRods[fromRod].pop()!;
  newRods[toRod].push(disk);
  
  return newRods;
}

// ============================================================================
// TYPES
// ============================================================================
type GameState = 'intro' | 'playing' | 'results';
type GameMode = 'practice' | 'ranked';
type Rod = number[]; // Array of disk sizes, bottom to top

interface GameResult {
  elapsedMs: number;
  moves: number;
  optimalMoves: number;
  extraMoves: number;
  scoreMs: number;
  mode: GameMode;
  disks: number;
  completed: boolean; // Did they actually solve it?
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function HanoiGame() {
  // Game state
  const [gameState, setGameState] = useState<GameState>('intro');
  const [gameMode, setGameMode] = useState<GameMode>('ranked');
  const [diskCount, setDiskCount] = useState<number>(CONFIG.RANKED_DISKS);
  
  // Rods: [left, middle, right] - each rod is an array of disk sizes (larger = bigger)
  const [rods, setRods] = useState<[Rod, Rod, Rod]>([[], [], []]);
  
  // Game tracking
  const [moves, setMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedRod, setSelectedRod] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  
  // Score submission state (ranked mode only)
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Animation state
  const [errorRod, setErrorRod] = useState<number | null>(null);
  const [lastMovedDisk, setLastMovedDisk] = useState<{ rod: number; disk: number } | null>(null);
  
  // Timer refs
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimeRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs to track current game state for timeout callback (avoid stale closures)
  const gameModeRef = useRef<GameMode>(gameMode);
  const diskCountRef = useRef<number>(diskCount);
  const movesRef = useRef<number>(moves);
  
  // Keep refs in sync with state
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { diskCountRef.current = diskCount; }, [diskCount]);
  useEffect(() => { movesRef.current = moves; }, [moves]);

  // Haptic feedback helper (mobile only, optional)
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'error') => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        error: [50, 30, 50],
      };
      navigator.vibrate(patterns[type]);
    }
  }, []);

  // Initialize rods with disks on the first rod
  const initializeGame = useCallback((disks: number) => {
    const initialRod: Rod = [];
    for (let i = disks; i >= 1; i--) {
      initialRod.push(i);
    }
    setRods([initialRod, [], []]);
    setMoves(0);
    setElapsedMs(0);
    setSelectedRod(null);
  }, []);

  // Start the game
  const startGame = useCallback((mode: GameMode) => {
    const disks = mode === 'practice' ? CONFIG.TUTORIAL_DISKS : CONFIG.RANKED_DISKS;
    setGameMode(mode);
    setDiskCount(disks);
    initializeGame(disks);
    setGameState('playing');
    startTimeRef.current = Date.now();
    
    // Reset submission state
    setSubmitting(false);
    setSubmitStatus('idle');
    setSubmitError(null);
    
    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 10);
    
    // Max time auto-end (DNF)
    maxTimeRef.current = setTimeout(() => {
      endGame(false); // false = did not complete
    }, CONFIG.MAX_RUN_MS);
  }, [initializeGame]);

  // End the game - uses refs to avoid stale closures in timeout
  const endGame = useCallback((completed: boolean = true) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimeRef.current) {
      clearTimeout(maxTimeRef.current);
      maxTimeRef.current = null;
    }
    
    // Use refs for values that might be stale in timeout callbacks
    const currentMoves = movesRef.current;
    const currentDiskCount = diskCountRef.current;
    const currentGameMode = gameModeRef.current;
    
    const finalElapsed = completed ? Date.now() - startTimeRef.current : CONFIG.MAX_RUN_MS;
    const optimal = getOptimalMoves(currentDiskCount);
    const extra = Math.max(0, currentMoves - optimal);
    const score = calculateScore(finalElapsed, currentMoves, currentDiskCount);
    
    setResult({
      elapsedMs: finalElapsed,
      moves: currentMoves,
      optimalMoves: optimal,
      extraMoves: extra,
      scoreMs: score,
      mode: currentGameMode,
      disks: currentDiskCount,
      completed,
    });
    setGameState('results');
  }, []);

  // Check for win condition
  useEffect(() => {
    if (gameState === 'playing') {
      // Win: all disks on the rightmost rod
      if (rods[2].length === diskCount) {
        endGame(true); // true = completed successfully
      }
    }
  }, [rods, gameState, diskCount, endGame]);

  // Auto-submit score when results are reached in ranked mode
  useEffect(() => {
    if (gameState === 'results' && result && result.mode === 'ranked' && result.completed) {
      const doSubmit = async () => {
        setSubmitting(true);
        setSubmitStatus('idle');
        setSubmitError(null);
        
        try {
          const response = await submitScore(CONFIG.GAME_SLUG, result.scoreMs);
          
          if (response.success) {
            setSubmitStatus('success');
          } else {
            setSubmitStatus('error');
            setSubmitError(response.error || 'Failed to submit score');
          }
        } catch (err) {
          setSubmitStatus('error');
          setSubmitError(err instanceof Error ? err.message : 'Failed to submit score');
        } finally {
          setSubmitting(false);
        }
      };
      
      doSubmit();
    }
  }, [gameState, result]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimeRef.current) clearTimeout(maxTimeRef.current);
    };
  }, []);

  // Handle rod interaction (click or keyboard)
  const handleRodAction = useCallback((rodIndex: number) => {
    if (gameState !== 'playing') return;
    
    // Clear any previous error state
    setErrorRod(null);
    
    if (selectedRod === null) {
      // Select a rod (must have disks)
      if (rods[rodIndex].length > 0) {
        setSelectedRod(rodIndex);
        triggerHaptic('light');
      }
    } else {
      // Try to move disk
      if (selectedRod === rodIndex) {
        // Deselect
        setSelectedRod(null);
        triggerHaptic('light');
      } else {
        // Attempt move using helper - only increment moves if legal
        const newRods = moveDisk(rods, selectedRod, rodIndex);
        if (newRods !== null) {
          // Track which disk just moved for animation
          const movedDisk = rods[selectedRod][rods[selectedRod].length - 1];
          setLastMovedDisk({ rod: rodIndex, disk: movedDisk });
          setTimeout(() => setLastMovedDisk(null), 300);
          
          setRods(newRods);
          setMoves(m => m + 1);
          setSelectedRod(null);
          triggerHaptic('medium');
        } else {
          // Illegal move - show error feedback
          setErrorRod(rodIndex);
          triggerHaptic('error');
          setTimeout(() => setErrorRod(null), 400);
          // Keep selection active so user can try another rod
        }
      }
    }
  }, [gameState, selectedRod, rods, triggerHaptic]);

  // Legacy click handler for backwards compatibility
  const handleRodClick = (rodIndex: number) => handleRodAction(rodIndex);

  // Quit to intro
  const quitGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimeRef.current) clearTimeout(maxTimeRef.current);
    setGameState('intro');
    setResult(null);
  }, []);

  // Restart current mode
  const restartGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimeRef.current) clearTimeout(maxTimeRef.current);
    startGame(gameMode);
  }, [startGame, gameMode]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      
      // Rod selection: 1, 2, 3 keys
      if (e.key === '1' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleRodAction(0);
      } else if (e.key === '2' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleRodAction(1);
      } else if (e.key === '3' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleRodAction(2);
      } else if (e.key === 'Escape') {
        // Cancel selection
        e.preventDefault();
        setSelectedRod(null);
        triggerHaptic('light');
      } else if (e.key === 'r' || e.key === 'R') {
        // Quick restart
        e.preventDefault();
        restartGame();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleRodAction, triggerHaptic, restartGame]);

  // ============================================================================
  // RENDER
  // ============================================================================
  
  // Disk component with animations
  const Disk = ({ 
    size, 
    maxDisks, 
    isTop, 
    isSelected,
    isJustMoved 
  }: { 
    size: number; 
    maxDisks: number; 
    isTop: boolean; 
    isSelected: boolean;
    isJustMoved: boolean;
  }) => {
    const widthPercent = 30 + (size / maxDisks) * 60; // 30% to 90% width
    const colors = [
      'bg-gradient-to-b from-rose-400 to-rose-600',
      'bg-gradient-to-b from-amber-400 to-amber-600', 
      'bg-gradient-to-b from-emerald-400 to-emerald-600',
      'bg-gradient-to-b from-cyan-400 to-cyan-600',
      'bg-gradient-to-b from-violet-400 to-violet-600',
      'bg-gradient-to-b from-pink-400 to-pink-600',
      'bg-gradient-to-b from-lime-400 to-lime-600',
    ];
    const color = colors[(size - 1) % colors.length];
    
    return (
      <div
        className={`
          h-6 sm:h-8 rounded-md shadow-md border-b-2 border-black/20
          ${color}
          transition-all duration-200 ease-out
          ${isTop && isSelected 
            ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white scale-110 -translate-y-2 shadow-lg shadow-amber-400/30' 
            : ''
          }
          ${isJustMoved ? 'animate-bounce-once' : ''}
        `}
        style={{ 
          width: `${widthPercent}%`,
          animationDuration: isJustMoved ? '0.3s' : undefined,
        }}
      />
    );
  };

  // Rod component with animations
  const RodDisplay = ({ rodIndex, rod }: { rodIndex: number; rod: Rod }) => {
    const isSelected = selectedRod === rodIndex;
    const isError = errorRod === rodIndex;
    const hasDisks = rod.length > 0;
    const rodLabels = ['A', 'B', 'C'];
    const keyHints = ['1', '2', '3'];
    
    // Calculate heights
    const poleHeight = (diskCount + 1) * 32; // Height for pole
    
    return (
      <button
        onClick={() => handleRodClick(rodIndex)}
        className={`
          relative flex-1 flex flex-col items-center justify-end p-2 sm:p-4 rounded-xl 
          min-h-[200px] sm:min-h-[280px]
          transition-all duration-200 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2
          ${isError
            ? 'bg-rose-100/80 ring-2 ring-rose-400 animate-shake'
            : isSelected
            ? 'bg-amber-50/80 ring-2 ring-amber-400 shadow-lg shadow-amber-400/20'
            : hasDisks
            ? 'bg-white/60 hover:bg-white/80 hover:shadow-md backdrop-blur'
            : 'bg-white/40 hover:bg-white/60 backdrop-blur'
          }
          border ${isError ? 'border-rose-300' : isSelected ? 'border-amber-300' : 'border-white/70'}
        `}
        disabled={gameState !== 'playing'}
      >
        {/* Rod structure - pole behind disks */}
        <div className="relative w-full flex flex-col items-center pointer-events-none" style={{ height: `${poleHeight + 16}px` }}>
          {/* Vertical pole (behind disks) */}
          <div 
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 w-2 rounded-t-full transition-colors duration-200 ${
              isSelected ? 'bg-amber-400' : 'bg-slate-400'
            }`} 
            style={{ height: `${poleHeight}px` }} 
          />
          
          {/* Disks stack - positioned at bottom, above base */}
          <div 
            className="absolute bottom-3 left-0 right-0 flex flex-col-reverse items-center gap-0.5 z-10"
          >
            {rod.map((diskSize, idx) => (
              <Disk
                key={`${rodIndex}-${idx}-${diskSize}`}
                size={diskSize}
                maxDisks={diskCount}
                isTop={idx === rod.length - 1}
                isSelected={isSelected && idx === rod.length - 1}
                isJustMoved={lastMovedDisk?.rod === rodIndex && lastMovedDisk?.disk === diskSize && idx === rod.length - 1}
              />
            ))}
          </div>
          
          {/* Base platform */}
          <div className={`absolute bottom-0 w-full h-3 rounded-sm transition-colors duration-200 ${
            isSelected ? 'bg-amber-400' : 'bg-slate-400'
          }`} />
        </div>
        
        {/* Label with keyboard hint */}
        <div className="mt-3 flex items-center gap-1.5">
          <span className={`font-bold text-sm transition-colors duration-150 ${
            isError ? 'text-rose-500' : isSelected ? 'text-amber-600' : 'text-slate-500'
          }`}>
            {rodLabels[rodIndex]}
          </span>
          <kbd className={`hidden sm:inline-block text-xs px-1.5 py-0.5 rounded border transition-colors duration-150 ${
            isSelected 
              ? 'bg-amber-100 border-amber-300 text-amber-600' 
              : 'bg-white/80 border-slate-200 text-slate-500'
          }`}>
            {keyHints[rodIndex]}
          </kbd>
        </div>
        
        {/* Error message */}
        {isError && (
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-rose-500 text-xs font-medium">
            Can&apos;t place here!
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen text-slate-900 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute -top-16 -right-24 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl" />
      
      {/* Back Home Button */}
      <Link
        href="/"
        className="absolute top-6 left-6 px-4 py-2 rounded-full bg-white/80 backdrop-blur border border-white/60 shadow-sm text-sm font-semibold hover:bg-white transition z-10"
      >
        ← Back Home
      </Link>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        {/* ================================================================ */}
        {/* INTRO STATE */}
        {/* ================================================================ */}
        {gameState === 'intro' && (
          <div className="text-center space-y-6 fade-up">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm border border-white/60">
              Logic Puzzle
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-slate-900">
              Move the tower.
            </h1>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Transfer all disks from rod A to rod C. Only move one disk at a time, 
              and never place a larger disk on a smaller one.
            </p>
            
            {/* Rules */}
            <div className="bg-white/80 backdrop-blur rounded-2xl p-6 max-w-md mx-auto text-left border border-white/70 shadow-sm">
              <h3 className="font-bold text-slate-700 mb-3 text-center">Rules</h3>
              <ul className="space-y-2 text-slate-600 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  Click a rod to select the top disk
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  Click another rod to move it there
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  Can't place larger disks on smaller ones
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  Goal: Move all disks to rod C
                </li>
              </ul>
            </div>

            {/* Scoring info */}
            <div className="bg-white/60 backdrop-blur rounded-xl p-4 max-w-md mx-auto border border-white/50">
              <p className="text-slate-500 text-sm">
                <span className="text-slate-700 font-medium">Score</span> = Time + ({CONFIG.EXTRA_MOVE_PENALTY_MS}ms × extra moves)
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Optimal: {getOptimalMoves(CONFIG.TUTORIAL_DISKS)} moves (3 disks) • {getOptimalMoves(CONFIG.RANKED_DISKS)} moves (5 disks)
              </p>
            </div>
            
            {/* Mode buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <button
                onClick={() => startGame('practice')}
                className="px-8 py-4 bg-white/80 hover:bg-white backdrop-blur text-slate-700 font-bold text-lg rounded-xl transition border border-white/70 shadow-sm"
              >
                Practice ({CONFIG.TUTORIAL_DISKS} disks)
                <span className="block text-sm font-normal text-slate-400">No leaderboard</span>
              </button>
              <button
                onClick={() => startGame('ranked')}
                className="px-8 py-4 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-900 font-bold text-lg rounded-xl transition shadow-lg shadow-amber-400/25"
              >
                Ranked Run ({CONFIG.RANKED_DISKS} disks)
                <span className="block text-sm font-normal text-amber-900/70">Compete on leaderboard</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* PLAYING STATE */}
        {/* ================================================================ */}
        {gameState === 'playing' && (
          <div className="fade-up">
            {/* Header with stats */}
            <header className="text-center space-y-4 mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm border border-white/60">
                {gameMode === 'ranked' ? '⚡ Ranked' : '🎯 Practice'}
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold leading-tight text-slate-900">
                Move all disks to rod C.
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm border border-white/70">
                  {formatTime(elapsedMs)}
                </div>
                <div className={`rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] shadow-sm border border-white/70 ${
                  moves <= getOptimalMoves(diskCount) ? 'text-emerald-600' : 'text-slate-500'
                }`}>
                  {moves} / {getOptimalMoves(diskCount)} moves
                </div>
                <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm border border-white/70">
                  {diskCount} disks
                </div>
              </div>
            </header>

            {/* Game board */}
            <div className="flex gap-2 sm:gap-4 mb-8">
              {rods.map((rod, idx) => (
                <RodDisplay key={idx} rodIndex={idx} rod={rod} />
              ))}
            </div>

            {/* Instructions with keyboard hints */}
            <div className="text-center text-slate-500 text-sm mb-6 space-y-1">
              <p>
                {selectedRod !== null 
                  ? 'Click a rod to move the disk there, or click again to deselect'
                  : 'Click a rod to select its top disk'
                }
              </p>
              <p className="hidden sm:block text-xs text-slate-400">
                <kbd className="px-1.5 py-0.5 bg-white/80 border border-white/60 rounded text-slate-500 shadow-sm">1</kbd>
                <kbd className="px-1.5 py-0.5 bg-white/80 border border-white/60 rounded text-slate-500 shadow-sm ml-1">2</kbd>
                <kbd className="px-1.5 py-0.5 bg-white/80 border border-white/60 rounded text-slate-500 shadow-sm ml-1">3</kbd>
                {' '}select rods • 
                <kbd className="px-1.5 py-0.5 bg-white/80 border border-white/60 rounded text-slate-500 shadow-sm ml-1">Esc</kbd>
                {' '}cancel •
                <kbd className="px-1.5 py-0.5 bg-white/80 border border-white/60 rounded text-slate-500 shadow-sm ml-1">R</kbd>
                {' '}restart
              </p>
            </div>

            {/* Control buttons */}
            <div className="flex justify-center gap-4">
              <button
                onClick={restartGame}
                className="px-6 py-3 bg-white/80 hover:bg-white backdrop-blur text-slate-700 font-bold rounded-xl transition border border-white/70 shadow-sm"
              >
                Restart
              </button>
              <button
                onClick={quitGame}
                className="px-6 py-3 bg-white/60 hover:bg-white/80 backdrop-blur text-slate-500 font-bold rounded-xl transition border border-white/50"
              >
                Quit
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* RESULTS STATE */}
        {/* ================================================================ */}
        {gameState === 'results' && result && (
          <div className="text-center space-y-6 fade-up">
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] shadow-sm border ${
              result.completed 
                ? 'bg-emerald-100/80 text-emerald-700 border-emerald-200' 
                : 'bg-rose-100/80 text-rose-700 border-rose-200'
            }`}>
              {result.completed 
                ? (result.mode === 'ranked' ? '🏆 Run Complete' : '✓ Practice Complete')
                : '⏱️ Time\'s Up'
              }
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-slate-900">
              {result.completed ? 'Well done!' : 'Keep practicing!'}
            </h1>
            <p className="text-slate-500">
              {result.disks} disks • {result.mode === 'ranked' ? 'Ranked' : 'Practice'}
              {!result.completed && ' • Did Not Finish'}
            </p>

            {/* Results card */}
            <div className="bg-white/80 backdrop-blur rounded-2xl p-6 sm:p-8 max-w-md mx-auto border border-white/70 shadow-sm">
              {/* Final score */}
              <div className="mb-6">
                <div className="text-slate-500 text-sm uppercase tracking-wide mb-1">Final Score</div>
                <div className="text-5xl sm:text-6xl font-mono font-black text-amber-500">
                  {formatTime(result.scoreMs)}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                  <div className="text-slate-400 text-xs uppercase tracking-wide">Time</div>
                  <div className="text-xl font-mono font-bold text-slate-900">{formatTime(result.elapsedMs)}</div>
                </div>
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                  <div className="text-slate-400 text-xs uppercase tracking-wide">Moves</div>
                  <div className="text-xl font-mono font-bold text-slate-900">{result.moves}</div>
                </div>
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                  <div className="text-slate-400 text-xs uppercase tracking-wide">Optimal</div>
                  <div className="text-xl font-mono font-bold text-emerald-600">{result.optimalMoves}</div>
                </div>
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                  <div className="text-slate-400 text-xs uppercase tracking-wide">Extra Moves</div>
                  <div className={`text-xl font-mono font-bold ${result.extraMoves === 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {result.extraMoves === 0 ? '0 ★' : `+${result.extraMoves}`}
                  </div>
                </div>
              </div>

              {/* Score breakdown */}
              {result.completed && result.extraMoves > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-500">
                  {formatTime(result.elapsedMs)} + ({result.extraMoves} × {CONFIG.EXTRA_MOVE_PENALTY_MS}ms) = {formatTime(result.scoreMs)}
                </div>
              )}
              {result.completed && result.extraMoves === 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-emerald-600">
                  ★ Perfect! Solved in optimal moves!
                </div>
              )}
              {!result.completed && (
                <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-rose-500">
                  Time ran out before completing the puzzle.
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <button
                onClick={() => startGame(result.mode)}
                className={`px-8 py-4 font-bold text-lg rounded-xl transition ${
                  result.mode === 'ranked'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-900 shadow-lg shadow-amber-400/25'
                    : 'bg-white/80 hover:bg-white backdrop-blur text-slate-700 border border-white/70 shadow-sm'
                }`}
              >
                Play Again
              </button>
              <button
                onClick={quitGame}
                className="px-8 py-4 bg-white/60 hover:bg-white/80 backdrop-blur text-slate-500 font-bold text-lg rounded-xl transition border border-white/50"
              >
                Back to Menu
              </button>
            </div>

            {/* Practice mode disclaimer */}
            {result.mode === 'practice' && (
              <p className="text-slate-400 text-sm">
                Practice runs are not submitted to the leaderboard.
              </p>
            )}
            
            {/* Ranked mode submission status */}
            {result.mode === 'ranked' && result.completed && (
              <div>
                {submitting && (
                  <p className="text-amber-600 text-sm flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    Submitting score...
                  </p>
                )}
                {!submitting && submitStatus === 'success' && (
                  <p className="text-emerald-600 text-sm">
                    ✓ Score submitted to leaderboard!
                  </p>
                )}
                {!submitting && submitStatus === 'error' && (
                  <p className="text-rose-500 text-sm">
                    ✗ {submitError || 'Failed to submit score'}
                  </p>
                )}
              </div>
            )}
            
            {/* DNF - not submitted */}
            {result.mode === 'ranked' && !result.completed && (
              <p className="text-slate-400 text-sm">
                Incomplete runs are not submitted to the leaderboard.
              </p>
            )}
          </div>
        )}
      </main>

      <style jsx>{`
        .fade-up {
          animation: fadeUp 0.6s ease-out both;
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

