'use client';

import { useEffect, useRef, useState } from 'react';
import { submitScore } from '@/lib/db/scores';
import GameShell, { GameShellState, GameResult } from '@/components/GameShell';
import { getGameMetadata } from '@/lib/games/registry';
import { useMe } from '@/app/providers/MeContext';
import { createClient } from '@/lib/supabase/client';
import ResultCard from '@/components/ResultCard';

type Phase = 'idle' | 'showing' | 'hidden' | 'failed';

type Cell = {
  id: number;
  value: number | null;
};

// Helper functions
function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function computeGridSize(level: number) {
  if (level <= 25) return 5;
  if (level <= 36) return 6;
  return 7;
}

function pickRandomUniqueIndices(count: number, maxExclusive: number) {
  const all: number[] = [];
  for (let i = 0; i < maxExclusive; i++) all.push(i);

  // Fisher-Yates shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    const temp = all[i];
    all[i] = all[j];
    all[j] = temp;
  }

  return all.slice(0, count);
}

function makeCells(level: number, gridSize: number): Cell[] {
  const total = gridSize * gridSize;
  const cells: Cell[] = [];
  for (let id = 0; id < total; id++) {
    cells.push({ id, value: null });
  }

  const chosenPositions = pickRandomUniqueIndices(level, total);
  for (let i = 0; i < level; i++) {
    const cellIndex = chosenPositions[i];
    cells[cellIndex].value = i + 1;
  }

  return cells;
}

export default function ChimpGamePage() {
  const { me } = useMe();
  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState(4);
  const [gridSize, setGridSize] = useState(computeGridSize(4));
  const [cells, setCells] = useState<Cell[]>(() => makeCells(4, computeGridSize(4)));
  const [nextExpected, setNextExpected] = useState(1);
  const [clicked, setClicked] = useState<number[]>([]);
  const [bestLevel, setBestLevel] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GameResult | undefined>(undefined);
  const [memorizeProgress, setMemorizeProgress] = useState(0);
  const [scoreTimestamp, setScoreTimestamp] = useState<Date | undefined>(undefined);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressAnimationRef = useRef<number | null>(null);
  const progressStartTimeRef = useRef<number | null>(null);
  const isShowingPhaseRef = useRef(false);

  // Load/save best score
  useEffect(() => {
    // First load from localStorage
    const stored = localStorage.getItem('chimp_best_level');
    let localBest = 0;
    if (stored !== null) {
      localBest = Number(stored);
      setBestLevel(localBest);
    }

    // If user is logged in, fetch best score from Supabase
    if (me?.isLoggedIn && me?.userId) {
      const fetchBestScore = async () => {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('scores')
            .select('score_value')
            .eq('test_slug', 'chimp')
            .eq('user_id', me.userId)
            .order('score_value', { ascending: false }) // Higher is better
            .limit(1);

          if (!error && data && data.length > 0) {
            const dbBest = data[0].score_value;
            // Use the higher of localStorage and database
            setBestLevel(Math.max(localBest, dbBest));
          }
        } catch (error) {
          console.error('Error fetching best score from Supabase:', error);
        }
      };

      fetchBestScore();
    }
  }, [me?.isLoggedIn, me?.userId]);

  useEffect(() => {
    localStorage.setItem('chimp_best_level', String(bestLevel));
  }, [bestLevel]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
      if (progressAnimationRef.current !== null) {
        cancelAnimationFrame(progressAnimationRef.current);
      }
    };
  }, []);

  // Animate progress bar during showing phase
  useEffect(() => {
    if (phase === 'showing') {
      setMemorizeProgress(100);
      progressStartTimeRef.current = Date.now();
      isShowingPhaseRef.current = true;
      
      const animate = () => {
        if (progressStartTimeRef.current === null || !isShowingPhaseRef.current) return;
        
        const elapsed = Date.now() - progressStartTimeRef.current;
        const elapsedProgress = Math.min((elapsed / 5000) * 100, 100);
        const remainingProgress = 100 - elapsedProgress;
        setMemorizeProgress(remainingProgress);
        
        if (remainingProgress > 0 && isShowingPhaseRef.current) {
          progressAnimationRef.current = requestAnimationFrame(animate);
        }
      };
      
      progressAnimationRef.current = requestAnimationFrame(animate);
    } else {
      isShowingPhaseRef.current = false;
      setMemorizeProgress(0);
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

  // Map phase to GameShell state
  const getShellState = (): GameShellState => {
    if (phase === 'idle') return 'IDLE';
    if (phase === 'showing' || phase === 'hidden') return 'PLAYING';
    if (phase === 'failed') return 'FINISHED';
    return 'IDLE';
  };

  function scheduleHideNumbers() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setPhase('hidden');
    }, 5000);
  }

  function startRun(startLevel: number) {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    const gs = computeGridSize(startLevel);
    setLevel(startLevel);
    setGridSize(gs);
    setCells(makeCells(startLevel, gs));
    setNextExpected(1);
    setClicked([]);
    setResult(undefined);
    setPhase('showing');
    scheduleHideNumbers();
  }

  async function advanceToNextLevel() {
    const clearedLevel = level;
    if (clearedLevel > bestLevel) {
      setBestLevel(clearedLevel);
    }
    const nextLevel = clearedLevel + 1;
    startRun(nextLevel);
  }

  async function handleCellClick(cell: Cell) {
    if (phase !== 'hidden') return;
    if (cell.value === null) return;

    const valueClicked = cell.value;

    if (valueClicked !== nextExpected) {
      setPhase('failed');
      setScoreTimestamp(new Date());
      const finalScore = Math.max(level - 1, 0);
      setResult({
        score: finalScore,
        scoreLabel: 'levels',
        personalBest: bestLevel,
        personalBestLabel: 'levels',
      });

      if (finalScore > 0) {
        setSubmitting(true);
        setIsNewHighScore(false);
        const submitResult = await submitScore('chimp', finalScore);
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
      return;
    }

    setClicked((prev) => [...prev, valueClicked]);

    if (valueClicked === level) {
      await advanceToNextLevel();
      return;
    }

    setNextExpected((prev) => prev + 1);
  }

  function shouldShowNumber(value: number | null) {
    if (value === null) return false;
    if (phase === 'showing') return true;
    if (phase === 'hidden') return clicked.includes(value);
    if (phase === 'failed') return true;
    return false;
  }

  function cellClass(cell: Cell) {
    const base = 'aspect-square rounded-xl flex items-center justify-center font-extrabold select-none transition border border-amber-400/20 text-white';
    const isNumberCell = cell.value !== null;
    const isClicked = cell.value !== null && clicked.includes(cell.value);

    if (phase === 'failed') {
      if (!isNumberCell) return base + ' bg-amber-950/40';
      return base + ' bg-amber-900/40';
    }

    if (phase === 'showing') {
      return base + (isNumberCell ? ' bg-amber-900/40 cursor-default' : ' bg-amber-950/40');
    }

    if (phase === 'hidden') {
      if (!isNumberCell) return base + ' bg-amber-950/40 cursor-default';
      if (isClicked) return base + ' bg-amber-900/40 cursor-default';
      return base + ' bg-amber-950/25 hover:bg-amber-950/40 cursor-pointer active:scale-[0.98]';
    }

    return base + ' bg-amber-950/25';
  }

  const getStatusText = () => {
    switch (phase) {
      case 'showing':
        return `Level ${level} — Memorize`;
      case 'hidden':
        return `Level ${level} — Tap ${nextExpected}`;
      case 'failed':
        return submitting ? 'Saving score...' : 'Score saved!';
      default:
        return '';
    }
  };

  const renderGame = () => (
    <div className="w-full max-w-xl mx-auto">
      <div
        className="grid gap-2 sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => (
          <button
            key={cell.id}
            className={cellClass(cell)}
            onClick={() => handleCellClick(cell)}
            disabled={
              phase !== 'hidden' ||
              cell.value === null ||
              (cell.value !== null && clicked.includes(cell.value))
            }
          >
            {shouldShowNumber(cell.value) ? (
              <span className="text-2xl sm:text-3xl text-white">{cell.value}</span>
            ) : (
              <span className="opacity-0">0</span>
            )}
          </button>
        ))}
      </div>
      {phase !== 'idle' && phase !== 'failed' && (
        <div className="mt-5">
          {phase === 'showing' ? (
            <div className="w-full">
              <div className="h-2 bg-amber-950/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-75 ease-linear"
                  style={{ width: `${memorizeProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center text-[#0a0a0a]/70 text-sm">
              Next: {nextExpected}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderReady = () => (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] mb-3">
          Chimp Test
        </h2>
        <p className="text-[#0a0a0a]/70 text-lg">
          Numbers appear, then vanish. Tap squares in ascending order. One mistake ends the run.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 text-sm">
        <div className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/25 text-[#0a0a0a]">
          Best: <span className="font-bold">{bestLevel}</span>
        </div>
        <div className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/25 text-[#0a0a0a]">
          Grid: <span className="font-bold">{gridSize}×{gridSize}</span>
        </div>
      </div>
      <button
        onClick={() => startRun(4)}
        className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-black font-bold text-lg rounded-xl transition-colors"
      >
        Press Space / Tap Start
      </button>
    </div>
  );

  const renderResult = (result: GameResult) => (
    <ResultCard
      gameMetadata={gameMetadata}
      score={result.score}
      scoreLabel="levels"
      personalBest={bestLevel > 0 ? bestLevel : undefined}
      personalBestLabel="levels"
      isNewHighScore={isNewHighScore}
      timestamp={scoreTimestamp}
      onPlayAgain={() => startRun(4)}
      isSubmitting={submitting}
    />
  );

  const gameMetadata = getGameMetadata('chimp');

  return (
    <GameShell
      gameMetadata={gameMetadata}
      gameState={getShellState()}
      onStart={() => startRun(4)}
      onRestart={() => startRun(4)}
      onQuit={() => {
        setPhase('idle');
        setResult(undefined);
      }}
      renderGame={renderGame}
      renderReady={renderReady}
      renderResult={renderResult}
      result={result}
      statusText={getStatusText()}
      maxWidth="2xl"
    />
  );
}
