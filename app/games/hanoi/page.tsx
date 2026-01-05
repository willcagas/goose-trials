'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { submitScore } from '@/lib/db/scores';
import GameShell, { GameShellState, GameResult as ShellGameResult } from '@/components/GameShell';
import { getGameMetadata } from '@/lib/games/registry';
import { useMe } from '@/app/providers/MeContext';
import { createClient } from '@/lib/supabase/client';
import ResultCard from '@/components/ResultCard';

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
  const { me } = useMe();
  
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
  
  // Best score (lower is better for time-based scoring)
  const [bestScore, setBestScore] = useState<number | null>(null);
  
  // Score submission state (ranked mode only)
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scoreTimestamp, setScoreTimestamp] = useState<Date | undefined>(undefined);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  
  // Animation state
  const [errorRod, setErrorRod] = useState<number | null>(null);
  const [lastMovedDisk, setLastMovedDisk] = useState<{ rod: number; disk: number } | null>(null);
  
  // Timer refs
  const startTimeRef = useRef<number | null>(null);
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
    // Clear any existing timers first
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimeRef.current) clearTimeout(maxTimeRef.current);
    
    // Reset restart flag when game actually starts
    isRestartingRef.current = false;
    
    const disks = mode === 'practice' ? CONFIG.TUTORIAL_DISKS : CONFIG.RANKED_DISKS;
    setGameMode(mode);
    setDiskCount(disks);
    initializeGame(disks);
    setGameState('playing');
    startTimeRef.current = null;
    
    // Reset submission state
    setSubmitting(false);
    setSubmitStatus('idle');
    setSubmitError(null);
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
    
    // Reset restart flag when game ends
    isRestartingRef.current = false;
    
    // Use refs for values that might be stale in timeout callbacks
    const currentMoves = movesRef.current;
    const currentDiskCount = diskCountRef.current;
    const currentGameMode = gameModeRef.current;
    
    const finalElapsed = completed && startTimeRef.current !== null
      ? Date.now() - startTimeRef.current
      : CONFIG.MAX_RUN_MS;
    const optimal = getOptimalMoves(currentDiskCount);
    const extra = Math.max(0, currentMoves - optimal);
    const score = calculateScore(finalElapsed, currentMoves, currentDiskCount);
    
    setScoreTimestamp(new Date());
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
        setIsNewHighScore(false);
        
        try {
          // Convert milliseconds to seconds with 2 decimal places
          const scoreInSeconds = Math.round(result.scoreMs / 10) / 100;
          const response = await submitScore(CONFIG.GAME_SLUG, scoreInSeconds);
          
          if (response.success) {
            setSubmitStatus('success');
            if (response.isNewHighScore) {
              setIsNewHighScore(true);
            }
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

  // Load best score from localStorage and Supabase
  useEffect(() => {
    // Load from localStorage first
    const stored = localStorage.getItem('hanoi_best_score');
    let localBest: number | null = null;
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) {
        localBest = parsed;
      }
    }

    // If user is logged in, fetch from Supabase
    if (me?.isLoggedIn && me?.userId) {
      const fetchBestScore = async () => {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('scores')
            .select('score_value')
            .eq('test_slug', 'hanoi')
            .eq('user_id', me.userId)
            .order('score_value', { ascending: true }) // Lower is better
            .limit(1);

          if (error) throw error;

          if (data && data.length > 0) {
            // Convert seconds to milliseconds
            const supabaseBest = data[0].score_value * 1000;
            // Use the better (lower) score
            if (localBest === null || supabaseBest < localBest) {
              setBestScore(supabaseBest);
            } else {
              setBestScore(localBest);
            }
          } else if (localBest !== null) {
            setBestScore(localBest);
          }
        } catch (error) {
          console.error('Error fetching best score from Supabase:', error);
          if (localBest !== null) {
            setBestScore(localBest);
          }
        }
      };

      fetchBestScore();
    } else if (localBest !== null) {
      setBestScore(localBest);
    }
  }, [me?.isLoggedIn, me?.userId]);

  // Save best score to localStorage
  useEffect(() => {
    if (bestScore !== null) {
      localStorage.setItem('hanoi_best_score', bestScore.toString());
    }
  }, [bestScore]);

  // Update best score when a new record is set (ranked mode only)
  useEffect(() => {
    if (result && result.mode === 'ranked' && result.completed) {
      const currentScore = result.scoreMs;
      if (bestScore === null || currentScore < bestScore) {
        setBestScore(currentScore);
      }
    }
  }, [result, bestScore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimeRef.current) clearTimeout(maxTimeRef.current);
    };
  }, []);

  const startTimerIfNeeded = useCallback(() => {
    if (startTimeRef.current !== null) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current === null) return;
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 10);
    maxTimeRef.current = setTimeout(() => {
      endGame(false); // false = did not complete
    }, CONFIG.MAX_RUN_MS);
  }, [endGame]);

  // Handle rod interaction (click or keyboard)
  const handleRodAction = useCallback((rodIndex: number) => {
    if (gameState !== 'playing') {
      return;
    }
    
    // Clear any previous error state
    setErrorRod(null);
    
    if (selectedRod === null) {
      // Select a rod (must have disks)
      if (rods[rodIndex].length > 0) {
        setSelectedRod(rodIndex);
        triggerHaptic('light');
        return;
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
          startTimerIfNeeded();
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
  }, [gameState, selectedRod, rods, triggerHaptic, startTimerIfNeeded]);

  // Legacy click handler for backwards compatibility
  const handleRodClick = (rodIndex: number) => handleRodAction(rodIndex);

  // Quit to intro
  const quitGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimeRef.current) clearTimeout(maxTimeRef.current);
    isRestartingRef.current = false; // Reset flag when quitting
    setGameState('intro');
    setResult(null);
  }, []);

  // Restart current mode
  const isRestartingRef = useRef(false);
  const restartGame = useCallback(() => {
    // Prevent multiple simultaneous restarts (debounce rapid clicks)
    if (isRestartingRef.current) return;
    isRestartingRef.current = true;
    
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimeRef.current) clearTimeout(maxTimeRef.current);
    
    // startGame will reset the flag when it actually starts
    startGame(gameMode);
  }, [startGame, gameMode]);

  // Map gameState to GameShell state
  const getShellState = (): GameShellState => {
    if (gameState === 'intro') return 'IDLE';
    if (gameState === 'playing') return 'PLAYING';
    if (gameState === 'results') return 'FINISHED';
    return 'IDLE';
  };

  // Convert internal result to ShellGameResult
  const getShellResult = (): ShellGameResult | undefined => {
    if (!result) return undefined;
    return {
      score: formatTime(result.scoreMs),
      scoreLabel: '',
      message: result.completed 
        ? `${result.moves} moves • ${result.extraMoves === 0 ? 'Perfect!' : `+${result.extraMoves} extra`}`
        : 'Did Not Finish',
    };
  };

  const getStatusText = () => {
    if (gameState === 'playing') {
      return `${formatTime(elapsedMs)} • ${moves}/${getOptimalMoves(diskCount)} moves`;
    }
    if (gameState === 'results' && submitting) {
      return 'Saving score...';
    }
    if (gameState === 'results' && submitStatus === 'success') {
      return 'Score saved!';
    }
    return '';
  };

  // Keyboard controls (hanoi-specific, disable global keybinds during play)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      
      // Rod selection: 1, 2, 3 keys or 8, 9, 0 keys
      if (e.key === '1' || e.key === 'a' || e.key === 'A' || e.key === '8') {
        e.preventDefault();
        handleRodAction(0);
      } else if (e.key === '2' || e.key === 's' || e.key === 'S' || e.key === '9') {
        e.preventDefault();
        handleRodAction(1);
      } else if (e.key === '3' || e.key === 'd' || e.key === 'D' || e.key === '0') {
        e.preventDefault();
        handleRodAction(2);
      } else if (e.key === 'Escape') {
        // Don't handle ESC here - let GameShell handle quit
        // ESC cancel selection feature disabled per user request
      } else if (e.key === 'r' || e.key === 'R') {
        // Quick restart (don't prevent default - let GameShell handle)
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
        type="button"
        onClick={() => {
          if (gameState === 'playing') {
            handleRodClick(rodIndex);
          }
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (gameState === 'playing') {
            handleRodClick(rodIndex);
          }
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (gameState === 'playing') {
            handleRodClick(rodIndex);
          }
        }}
        className={`
          relative flex-1 flex flex-col items-center justify-end p-2 sm:p-4 rounded-xl 
          min-h-[200px] sm:min-h-[280px]
          transition-all duration-200 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2
          ${gameState !== 'playing' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
        <div className="relative w-full flex flex-col items-center" style={{ height: `${poleHeight + 16}px` }}>
          {/* Vertical pole (behind disks) */}
          <div 
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 w-2 rounded-t-full transition-colors duration-200 pointer-events-none ${
              isSelected ? 'bg-amber-400' : 'bg-amber-400/40'
            }`} 
            style={{ height: `${poleHeight}px` }} 
          />
          
          {/* Disks stack - positioned at bottom, above base */}
          <div 
            className="absolute bottom-3 left-0 right-0 flex flex-col-reverse items-center gap-0.5 z-10 pointer-events-none"
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
          <div className={`absolute bottom-0 w-full h-3 rounded-sm transition-colors duration-200 pointer-events-none ${
            isSelected ? 'bg-amber-400' : 'bg-amber-400/40'
          }`} />
        </div>
        
        {/* Label with keyboard hint */}
        <div className="mt-3 flex items-center gap-1.5">
          <span className={`font-bold text-sm transition-colors duration-150 ${
            isError ? 'text-rose-500' : isSelected ? 'text-amber-400' : 'text-amber-400/60'
          }`}>
            {rodLabels[rodIndex]}
          </span>
          <kbd className={`hidden sm:inline-block text-xs px-1.5 py-0.5 rounded border transition-colors duration-150 ${
            isSelected 
              ? 'bg-amber-400/20 border-amber-400/40 text-amber-400' 
              : 'bg-white/10 border-amber-400/20 text-amber-400/70'
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

  // Render functions for GameShell
  const renderReady = () => (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] mb-3">
          Tower of Hanoi
        </h2>
        <p className="text-[#0a0a0a]/70 text-lg max-w-xl mx-auto">
          Transfer all disks from rod A to rod C. Only move one disk at a time, 
          and never place a larger disk on a smaller one.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 text-sm">
        {bestScore !== null && (
          <div className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/25 text-[#0a0a0a]">
            Best: <span className="font-bold">{(bestScore / 1000).toFixed(2)} s</span>
          </div>
        )}
        <div className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/25 text-[#0a0a0a]">
          Disks: <span className="font-bold">{CONFIG.RANKED_DISKS}</span>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <button
          onClick={() => startGame('ranked')}
          className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-black font-bold text-lg rounded-xl transition-colors"
        >
          Press Space / Tap Start
        </button>
        <button
          onClick={() => startGame('practice')}
          className="px-6 py-4 bg-white hover:bg-amber-50 text-black font-bold text-lg rounded-xl transition-colors border border-amber-400"
        >
          Practice ({CONFIG.TUTORIAL_DISKS} disks)
        </button>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="space-y-6">
      {/* Header with stats */}
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#0a0a0a]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0a0a0a] border border-[#0a0a0a]/20">
          {gameMode === 'ranked' ? '⚡ Ranked' : '🎯 Practice'}
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold leading-tight text-[#0a0a0a]">
          Move all disks to rod C.
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="rounded-full bg-[#0a0a0a]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0a0a0a] border border-[#0a0a0a]/20">
            {formatTime(elapsedMs)}
          </div>
          <div className={`rounded-full bg-[#0a0a0a]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] border border-[#0a0a0a]/20 ${
            moves <= getOptimalMoves(diskCount) ? 'text-emerald-600' : 'text-[#0a0a0a]/70'
          }`}>
            {moves} / {getOptimalMoves(diskCount)} moves
          </div>
          <div className="rounded-full bg-[#0a0a0a]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0a0a0a] border border-[#0a0a0a]/20">
            {diskCount} disks
          </div>
        </div>
      </header>

      {/* Game board */}
      <div className="flex gap-2 sm:gap-4">
        {rods.map((rod, idx) => (
          <RodDisplay key={idx} rodIndex={idx} rod={rod} />
        ))}
      </div>

      {/* Instructions */}
      <div className="text-center text-[#0a0a0a]/70 text-sm space-y-1">
        <p>
          {selectedRod !== null 
            ? 'Click a rod to move the disk there, or click again to deselect'
            : 'Click a rod to select its top disk'
          }
        </p>
        <p className="hidden sm:block text-xs text-[#0a0a0a]/50">
          <kbd className="px-1.5 py-0.5 bg-[#0a0a0a]/10 border border-[#0a0a0a]/20 rounded text-[#0a0a0a]/70">1</kbd>
          <kbd className="px-1.5 py-0.5 bg-[#0a0a0a]/10 border border-[#0a0a0a]/20 rounded text-[#0a0a0a]/70 ml-1">2</kbd>
          <kbd className="px-1.5 py-0.5 bg-[#0a0a0a]/10 border border-[#0a0a0a]/20 rounded text-[#0a0a0a]/70 ml-1">3</kbd>
          {' '}select rods
        </p>
      </div>
    </div>
  );

  const renderResult = (shellResult: ShellGameResult) => {
    if (!result) return null;
    
    // For Hanoi, create a message with the stats
    const statsMessage = result.completed 
      ? `${result.moves} moves • ${result.extraMoves === 0 ? 'Perfect!' : `+${result.extraMoves} extra`}`
      : 'Did Not Finish';
    
    return (
      <ResultCard
        gameMetadata={gameMetadata}
        score={formatTime(result.scoreMs)}
        personalBest={bestScore !== null ? formatTime(bestScore) : undefined}
        message={statsMessage}
        isNewHighScore={isNewHighScore}
        timestamp={scoreTimestamp}
        onPlayAgain={() => startGame(result.mode)}
        isSubmitting={submitting}
      />
    );
  };

  const gameMetadata = getGameMetadata('hanoi');

  return (
    <GameShell
      gameMetadata={gameMetadata}
      gameState={getShellState()}
      onStart={() => startGame('ranked')}
      onRestart={restartGame}
      onQuit={quitGame}
      renderGame={renderGame}
      renderReady={renderReady}
      renderResult={renderResult}
      result={getShellResult()}
      statusText={getStatusText()}
      maxWidth="2xl"
      disableKeybinds={gameState === 'playing'} // Disable global keybinds during play (hanoi has its own)
    />
  );
}
