'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimeRef.current) clearTimeout(maxTimeRef.current);
    };
  }, []);

  // Handle rod click
  const handleRodClick = (rodIndex: number) => {
    if (gameState !== 'playing') return;
    
    if (selectedRod === null) {
      // Select a rod (must have disks)
      if (rods[rodIndex].length > 0) {
        setSelectedRod(rodIndex);
      }
    } else {
      // Try to move disk
      if (selectedRod === rodIndex) {
        // Deselect
        setSelectedRod(null);
      } else {
        // Attempt move
        const sourceRod = rods[selectedRod];
        const targetRod = rods[rodIndex];
        const diskToMove = sourceRod[sourceRod.length - 1];
        const topOfTarget = targetRod[targetRod.length - 1];
        
        // Valid move: target is empty OR disk is smaller than top of target
        if (targetRod.length === 0 || diskToMove < topOfTarget) {
          setRods(prev => {
            const newRods: [Rod, Rod, Rod] = [
              [...prev[0]],
              [...prev[1]],
              [...prev[2]],
            ];
            newRods[selectedRod].pop();
            newRods[rodIndex].push(diskToMove);
            return newRods;
          });
          setMoves(m => m + 1);
        }
        setSelectedRod(null);
      }
    }
  };

  // Quit to intro
  const quitGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimeRef.current) clearTimeout(maxTimeRef.current);
    setGameState('intro');
    setResult(null);
  };

  // Restart current mode
  const restartGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimeRef.current) clearTimeout(maxTimeRef.current);
    startGame(gameMode);
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  // Disk component
  const Disk = ({ size, maxDisks, isTop, isSelected }: { size: number; maxDisks: number; isTop: boolean; isSelected: boolean }) => {
    const widthPercent = 30 + (size / maxDisks) * 60; // 30% to 90% width
    const colors = [
      'bg-rose-500',
      'bg-amber-500', 
      'bg-emerald-500',
      'bg-cyan-500',
      'bg-violet-500',
      'bg-pink-500',
      'bg-lime-500',
    ];
    const color = colors[(size - 1) % colors.length];
    
    return (
      <div
        className={`h-6 sm:h-8 rounded-md ${color} transition-all duration-150 ${
          isTop && isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-105' : ''
        }`}
        style={{ width: `${widthPercent}%` }}
      />
    );
  };

  // Rod component
  const RodDisplay = ({ rodIndex, rod }: { rodIndex: number; rod: Rod }) => {
    const isSelected = selectedRod === rodIndex;
    const hasDisks = rod.length > 0;
    const rodLabels = ['A', 'B', 'C'];
    
    return (
      <button
        onClick={() => handleRodClick(rodIndex)}
        className={`flex-1 flex flex-col items-center justify-end p-2 sm:p-4 rounded-xl transition-all duration-200 min-h-[200px] sm:min-h-[280px] ${
          isSelected
            ? 'bg-zinc-700/80 ring-2 ring-amber-400'
            : hasDisks
            ? 'bg-zinc-800/60 hover:bg-zinc-700/60'
            : 'bg-zinc-800/40 hover:bg-zinc-700/40'
        }`}
        disabled={gameState !== 'playing'}
      >
        {/* Disks stack */}
        <div className="flex flex-col-reverse items-center gap-1 w-full mb-2">
          {rod.map((diskSize, idx) => (
            <Disk
              key={idx}
              size={diskSize}
              maxDisks={diskCount}
              isTop={idx === rod.length - 1}
              isSelected={isSelected && idx === rod.length - 1}
            />
          ))}
        </div>
        
        {/* Rod pole */}
        <div className="w-2 bg-zinc-600 rounded-t-sm" style={{ height: `${(diskCount + 1) * 28}px` }} />
        
        {/* Base */}
        <div className="w-full h-3 bg-zinc-600 rounded-sm mt-1" />
        
        {/* Label */}
        <span className={`mt-2 font-bold text-sm ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`}>
          {rodLabels[rodIndex]}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      
      {/* Back Home Button */}
      <Link
        href="/"
        className="absolute top-4 left-4 px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 font-medium rounded-lg transition z-10 border border-zinc-700"
      >
        ← Games
      </Link>

      <div className="relative max-w-4xl mx-auto px-4 py-16 sm:py-20">
        {/* ================================================================ */}
        {/* INTRO STATE */}
        {/* ================================================================ */}
        {gameState === 'intro' && (
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-4 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              Tower of Hanoi
            </h1>
            <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
              Move all disks from rod A to rod C. Only move one disk at a time, 
              and never place a larger disk on a smaller one.
            </p>
            
            {/* Rules */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 mb-8 max-w-md mx-auto text-left border border-zinc-700/50">
              <h3 className="font-bold text-amber-400 mb-3 text-center">Rules</h3>
              <ul className="space-y-2 text-zinc-300 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">•</span>
                  Click a rod to select the top disk
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">•</span>
                  Click another rod to move it there
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">•</span>
                  Can't place larger disks on smaller ones
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">•</span>
                  Goal: Move all disks to rod C
                </li>
              </ul>
            </div>

            {/* Scoring info */}
            <div className="bg-zinc-800/30 rounded-xl p-4 mb-8 max-w-md mx-auto border border-zinc-700/30">
              <p className="text-zinc-500 text-sm">
                <span className="text-zinc-400 font-medium">Score</span> = Time + ({CONFIG.EXTRA_MOVE_PENALTY_MS}ms × extra moves)
              </p>
              <p className="text-zinc-500 text-xs mt-1">
                Optimal: {getOptimalMoves(CONFIG.TUTORIAL_DISKS)} moves (3 disks) • {getOptimalMoves(CONFIG.RANKED_DISKS)} moves (5 disks)
              </p>
            </div>
            
            {/* Mode buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => startGame('practice')}
                className="px-8 py-4 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-bold text-lg rounded-xl transition border border-zinc-600"
              >
                Practice ({CONFIG.TUTORIAL_DISKS} disks)
                <span className="block text-sm font-normal text-zinc-400">No leaderboard</span>
              </button>
              <button
                onClick={() => startGame('ranked')}
                className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-900 font-bold text-lg rounded-xl transition shadow-lg shadow-amber-500/25"
              >
                Ranked Run ({CONFIG.RANKED_DISKS} disks)
                <span className="block text-sm font-normal text-zinc-800">Compete on leaderboard</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* PLAYING STATE */}
        {/* ================================================================ */}
        {gameState === 'playing' && (
          <div>
            {/* Header with stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  gameMode === 'ranked' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'bg-zinc-700 text-zinc-400 border border-zinc-600'
                }`}>
                  {gameMode === 'ranked' ? '⚡ Ranked' : '🎯 Practice'}
                </span>
                <span className="text-zinc-500">{diskCount} disks</span>
              </div>
              
              <div className="flex items-center gap-6">
                {/* Timer */}
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-mono font-bold text-amber-400">
                    {formatTime(elapsedMs)}
                  </div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wide">Time</div>
                </div>
                
                {/* Moves */}
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-mono font-bold text-zinc-100">
                    {moves}
                  </div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wide">
                    Moves <span className="text-zinc-600">(opt: {getOptimalMoves(diskCount)})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Game board */}
            <div className="flex gap-2 sm:gap-4 mb-8">
              {rods.map((rod, idx) => (
                <RodDisplay key={idx} rodIndex={idx} rod={rod} />
              ))}
            </div>

            {/* Instructions */}
            <p className="text-center text-zinc-500 text-sm mb-6">
              {selectedRod !== null 
                ? 'Click a rod to move the disk there, or click again to deselect'
                : 'Click a rod to select its top disk'
              }
            </p>

            {/* Control buttons */}
            <div className="flex justify-center gap-4">
              <button
                onClick={restartGame}
                className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-bold rounded-xl transition border border-zinc-600"
              >
                Restart
              </button>
              <button
                onClick={quitGame}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold rounded-xl transition border border-zinc-700"
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
          <div className="text-center">
            <h1 className={`text-4xl sm:text-5xl font-black mb-2 bg-gradient-to-r bg-clip-text text-transparent ${
              result.completed 
                ? 'from-emerald-400 to-cyan-400' 
                : 'from-rose-400 to-orange-400'
            }`}>
              {result.completed 
                ? (result.mode === 'ranked' ? '🏆 Run Complete!' : '✓ Practice Complete!')
                : '⏱️ Time\'s Up!'
              }
            </h1>
            <p className="text-zinc-500 mb-8">
              {result.disks} disks • {result.mode === 'ranked' ? 'Ranked' : 'Practice'}
              {!result.completed && ' • Did Not Finish'}
            </p>

            {/* Results card */}
            <div className="bg-zinc-800/60 rounded-2xl p-6 sm:p-8 max-w-md mx-auto mb-8 border border-zinc-700/50">
              {/* Final score */}
              <div className="mb-6">
                <div className="text-zinc-400 text-sm uppercase tracking-wide mb-1">Final Score</div>
                <div className="text-5xl sm:text-6xl font-mono font-black text-amber-400">
                  {formatTime(result.scoreMs)}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="bg-zinc-900/50 rounded-xl p-4">
                  <div className="text-zinc-500 text-xs uppercase tracking-wide">Time</div>
                  <div className="text-xl font-mono font-bold text-zinc-100">{formatTime(result.elapsedMs)}</div>
                </div>
                <div className="bg-zinc-900/50 rounded-xl p-4">
                  <div className="text-zinc-500 text-xs uppercase tracking-wide">Moves</div>
                  <div className="text-xl font-mono font-bold text-zinc-100">{result.moves}</div>
                </div>
                <div className="bg-zinc-900/50 rounded-xl p-4">
                  <div className="text-zinc-500 text-xs uppercase tracking-wide">Optimal</div>
                  <div className="text-xl font-mono font-bold text-emerald-400">{result.optimalMoves}</div>
                </div>
                <div className="bg-zinc-900/50 rounded-xl p-4">
                  <div className="text-zinc-500 text-xs uppercase tracking-wide">Extra Moves</div>
                  <div className={`text-xl font-mono font-bold ${result.extraMoves === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.extraMoves === 0 ? '0 ★' : `+${result.extraMoves}`}
                  </div>
                </div>
              </div>

              {/* Score breakdown */}
              {result.completed && result.extraMoves > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-700/50 text-sm text-zinc-500">
                  {formatTime(result.elapsedMs)} + ({result.extraMoves} × {CONFIG.EXTRA_MOVE_PENALTY_MS}ms) = {formatTime(result.scoreMs)}
                </div>
              )}
              {result.completed && result.extraMoves === 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-700/50 text-sm text-emerald-400">
                  ★ Perfect! Solved in optimal moves!
                </div>
              )}
              {!result.completed && (
                <div className="mt-4 pt-4 border-t border-zinc-700/50 text-sm text-rose-400">
                  Time ran out before completing the puzzle.
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => startGame(result.mode)}
                className={`px-8 py-4 font-bold text-lg rounded-xl transition ${
                  result.mode === 'ranked'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-900 shadow-lg shadow-amber-500/25'
                    : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100 border border-zinc-600'
                }`}
              >
                Play Again
              </button>
              <button
                onClick={quitGame}
                className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-lg rounded-xl transition border border-zinc-700"
              >
                Back to Menu
              </button>
            </div>

            {result.mode === 'practice' && (
              <p className="mt-6 text-zinc-500 text-sm">
                Practice runs are not submitted to the leaderboard.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
