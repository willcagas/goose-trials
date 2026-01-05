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
  const [scoreTimestamp, setScoreTimestamp] = useState<Date | undefined>(undefined);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load/save best score
  useEffect(() => {
    // Only show best scores for logged-in users
    if (!me?.isLoggedIn || !me?.userId) {
      setBestLevel(0);
      return;
    }

    // Load from localStorage as initial value
    const stored = localStorage.getItem('chimp_best_level');
    let localBest = 0;
    if (stored !== null) {
      localBest = Number(stored);
      setBestLevel(localBest);
    }

    // Fetch best score from Supabase
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
  }, [me?.isLoggedIn, me?.userId]);

  useEffect(() => {
    localStorage.setItem('chimp_best_level', String(bestLevel));
  }, [bestLevel]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    };
  }, []);


  // Map phase to GameShell state
  const getShellState = (): GameShellState => {
    if (phase === 'idle') return 'IDLE';
    if (phase === 'showing' || phase === 'hidden') return 'PLAYING';
    if (phase === 'failed') return 'FINISHED';
    return 'IDLE';
  };

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
    // Only allow clicking on numbered cells
    if (cell.value === null) return;

    // If we're in showing phase, first click transitions to hidden phase AND counts as a click
    if (phase === 'showing') {
      setPhase('hidden');
      // Continue to process this click below
    } else if (phase !== 'hidden') {
      return;
    }

    const valueClicked = cell.value;

    if (valueClicked !== nextExpected) {
      setPhase('failed');
      setScoreTimestamp(new Date());
      const finalScore = Math.max(level - 1, 0);
      setResult({
        score: finalScore,
        scoreLabel: 'numbers',
        personalBest: bestLevel,
        personalBestLabel: 'numbers',
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
    const base = 'aspect-square rounded-xl flex items-center justify-center font-extrabold select-none transition border text-white';
    const isNumberCell = cell.value !== null;
    const isClicked = cell.value !== null && clicked.includes(cell.value);

    if (phase === 'failed') {
      if (!isNumberCell) return base + ' bg-amber-950/35 border-amber-400/15';
      return base + ' bg-amber-700/70 border-amber-400/30';
    }

    if (phase === 'showing') {
      return base + (isNumberCell ? ' bg-amber-700/70 border-amber-400/30 cursor-pointer hover:bg-amber-600/80 active:scale-[0.98]' : ' bg-amber-950/35 border-amber-400/15 cursor-default');
    }

    if (phase === 'hidden') {
      if (!isNumberCell) return base + ' bg-amber-950/35 border-amber-400/15 cursor-default';
      if (isClicked) return base + ' bg-amber-700/70 border-amber-400/30 cursor-default';
      return base + ' bg-amber-950/25 border-amber-400/18 hover:bg-amber-950/45 cursor-pointer active:scale-[0.98]';
    }

    return base + ' bg-amber-950/30 border-amber-400/15';
  }

  const getStatusText = () => {
    switch (phase) {
      case 'showing':
        return `Level ${level} — Memorize, then click 1`;
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
              phase === 'idle' ||
              phase === 'failed' ||
              cell.value === null ||
              (phase === 'hidden' && clicked.includes(cell.value))
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
          Best: <span className="font-bold">{bestLevel > 0 ? bestLevel : '--'}</span>
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
