// Pathfinding game
// Description:
// A maze will appear on the user's screen for one second, it will then dissapear and
// the user will have to navigate the maze from memory. The maze should only have one solution.
// After each attempt, the maze becomes 1 square bigger horizontally and veriticaly. The test
// ends once the user fails to navigate the maze and the ammount of rounds becomes the score.
// The user navigates the maze using their mouse by either dragging it accross the squares or 
// by tapping squares on at a time. The user will finally submit their answer by reaching the 
// final tile.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { submitScore } from '@/lib/db/scores';
import PathfindingBoard from './PathfindingBoard';
import GameShell, { GameShellState, GameResult } from '@/components/GameShell';
import { getGameMetadata } from '@/lib/games/registry';
import { useMe } from '@/app/providers/MeContext';
import { createClient } from '@/lib/supabase/client';
import type {
  Cell,
  Direction,
  GamePhase,
  Position,
  WallSegment,
} from './types';

const BASE_SIZE = 3;
const EXTRA_LIVES_PER_MAZE = 1;
const WALL_COLOR = 'rgb(8, 8, 8)';

const directions = [
  { dr: -1, dc: 0, direction: 'top', opposite: 'bottom' },
  { dr: 0, dc: 1, direction: 'right', opposite: 'left' },
  { dr: 1, dc: 0, direction: 'bottom', opposite: 'top' },
  { dr: 0, dc: -1, direction: 'left', opposite: 'right' },
] as const;

const createGrid = (size: number): Cell[][] => {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      row,
      col,
      walls: {
        top: true,
        right: true,
        bottom: true,
        left: true,
      },
    }))
  );
};

const generateMaze = (size: number): Cell[][] => {
  const grid = createGrid(size);
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const stack: Position[] = [{ row: 0, col: 0 }];
  visited[0][0] = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = directions
      .map((dir) => ({
        row: current.row + dir.dr,
        col: current.col + dir.dc,
        dir,
      }))
      .filter(
        (next) =>
          next.row >= 0 &&
          next.row < size &&
          next.col >= 0 &&
          next.col < size &&
          !visited[next.row][next.col]
      );

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    grid[current.row][current.col].walls[next.dir.direction] = false;
    grid[next.row][next.col].walls[next.dir.opposite] = false;
    visited[next.row][next.col] = true;
    stack.push({ row: next.row, col: next.col });
  }

  return grid;
};

const getDirection = (from: Position, to: Position): Direction | null => {
  if (to.row === from.row - 1 && to.col === from.col) return 'top';
  if (to.row === from.row + 1 && to.col === from.col) return 'bottom';
  if (to.row === from.row && to.col === from.col + 1) return 'right';
  if (to.row === from.row && to.col === from.col - 1) return 'left';
  return null;
};

const getWallSegment = (from: Position, direction: Direction): WallSegment => {
  switch (direction) {
    case 'top':
      return {
        x1: from.col,
        y1: from.row,
        x2: from.col + 1,
        y2: from.row,
      };
    case 'right':
      return {
        x1: from.col + 1,
        y1: from.row,
        x2: from.col + 1,
        y2: from.row + 1,
      };
    case 'bottom':
      return {
        x1: from.col,
        y1: from.row + 1,
        x2: from.col + 1,
        y2: from.row + 1,
      };
    case 'left':
    default:
      return {
        x1: from.col,
        y1: from.row,
        x2: from.col,
        y2: from.row + 1,
      };
  }
};

export default function PathfindingGame() {
  const { me } = useMe();
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [mazeSize, setMazeSize] = useState(BASE_SIZE);
  const [maze, setMaze] = useState<Cell[][]>(() => generateMaze(BASE_SIZE));
  const [playerPath, setPlayerPath] = useState<Position[]>([]);
  const [showMaze, setShowMaze] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [revealedWallSegments, setRevealedWallSegments] = useState<
    WallSegment[]
  >([]);
  const [shakeTick, setShakeTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const pathRef = useRef<Position[]>([]);
  const extraLivesRef = useRef(EXTRA_LIVES_PER_MAZE);
  const revealedWallKeysRef = useRef<Set<string>>(new Set());
  const blockedMoveKeysRef = useRef<Set<string>>(new Set());

  // Load best score from localStorage and Supabase on mount
  useEffect(() => {
    // First load from localStorage (for guest users or fallback)
    const stored = localStorage.getItem('pathfinding_best_score');
    if (stored !== null && stored !== '') {
      const parsed = Number(stored);
      if (!isNaN(parsed)) {
        setBestScore(parsed);
      }
    }

    // If user is logged in, fetch best score from Supabase
    if (me?.isLoggedIn && me?.userId) {
      const fetchBestScore = async () => {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('scores')
            .select('score_value')
            .eq('test_slug', 'pathfinding')
            .eq('user_id', me.userId)
            .order('score_value', { ascending: false }) // Higher is better for pathfinding
            .limit(1);

          if (!error && data && data.length > 0) {
            const dbBest = data[0].score_value;
            // Use the higher of localStorage and database
            setBestScore((prev) => Math.max(prev, dbBest));
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
      localStorage.setItem('pathfinding_best_score', String(bestScore));
    }
  }, [bestScore]);

  const lastPosition = playerPath[playerPath.length - 1];
  const pathSet = useMemo(() => {
    return new Set(playerPath.map((pos) => `${pos.row}-${pos.col}`));
  }, [playerPath]);
  const pathSegments = useMemo(() => {
    if (playerPath.length < 2) return [];
    return playerPath.slice(1).map((point, index) => ({
      from: playerPath[index],
      to: point,
    }));
  }, [playerPath]);
  const wallSegments = useMemo(() => {
    const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];

    maze.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell.walls.top) {
          segments.push({
            x1: colIndex,
            y1: rowIndex,
            x2: colIndex + 1,
            y2: rowIndex,
          });
        }
        if (cell.walls.left) {
          segments.push({
            x1: colIndex,
            y1: rowIndex,
            x2: colIndex,
            y2: rowIndex + 1,
          });
        }
        if (rowIndex === mazeSize - 1 && cell.walls.bottom) {
          segments.push({
            x1: colIndex,
            y1: rowIndex + 1,
            x2: colIndex + 1,
            y2: rowIndex + 1,
          });
        }
        if (colIndex === mazeSize - 1 && cell.walls.right) {
          segments.push({
            x1: colIndex + 1,
            y1: rowIndex,
            x2: colIndex + 1,
            y2: rowIndex + 1,
          });
        }
      });
    });

    return segments;
  }, [maze, mazeSize]);

  useEffect(() => {
    const stopDrawing = () => setIsDrawing(false);
    window.addEventListener('pointerup', stopDrawing);
    window.addEventListener('pointercancel', stopDrawing);
    return () => {
      window.removeEventListener('pointerup', stopDrawing);
      window.removeEventListener('pointercancel', stopDrawing);
    };
  }, []);

  useEffect(() => {
    pathRef.current = playerPath;
  }, [playerPath]);

  const beginRound = (nextRound: number) => {
    const size = BASE_SIZE + nextRound - 1;
    setMazeSize(size);
    setMaze(generateMaze(size));
    const startingPath = [{ row: 0, col: 0 }];
    pathRef.current = startingPath;
    setPlayerPath(startingPath);
    setFailReason(null);
    setSubmitState('idle');
    extraLivesRef.current = EXTRA_LIVES_PER_MAZE;
    revealedWallKeysRef.current = new Set();
    setRevealedWallSegments([]);
    blockedMoveKeysRef.current = new Set();
    setShowMaze(true);
    setPhase('input');
  };

  const startGame = () => {
    setScore(0);
    setRound(1);
    beginRound(1);
  };

  const handleSuccess = () => {
    const nextRound = round + 1;
    setIsDrawing(false);
    const newScore = score + 1;
    setScore(newScore);
    // Update best score if needed
    if (newScore > bestScore) {
      setBestScore(newScore);
    }
    setRound(nextRound);
    beginRound(nextRound);
  };

  const handleFail = async (reason: string) => {
    if (phase !== 'input') return;
    setIsDrawing(false);
    setFailReason(reason);
    setShowMaze(true);
    setPhase('failed');
    // Update best score if needed
    if (score > bestScore) {
      setBestScore(score);
    }
    setSubmitting(true);
    setSubmitState('idle');
    const result = await submitScore('pathfinding', score);
    setSubmitting(false);
    setSubmitState(result.success ? 'success' : 'error');
  };

  const revealWall = (segment: WallSegment) => {
    const key = `${segment.x1}-${segment.y1}-${segment.x2}-${segment.y2}`;
    if (revealedWallKeysRef.current.has(key)) return false;
    revealedWallKeysRef.current.add(key);
    setRevealedWallSegments((prev) => [...prev, segment]);
    return true;
  };

  const triggerShake = () => {
    setShakeTick((prev) => prev + 1);
  };

  const consumeExtraLife = () => {
    if (extraLivesRef.current > 0) {
      extraLivesRef.current -= 1;
      return true;
    }
    return false;
  };

  const attemptStep = (row: number, col: number) => {
    if (phase !== 'input') return;
    const currentPath = pathRef.current;
    const last = currentPath[currentPath.length - 1];
    if (!last) return;
    if (last.row === row && last.col === col) return;

    const next = { row, col };
    const direction = getDirection(last, next);
    if (!direction) return;
    const moveKey = `${last.row}-${last.col}-${row}-${col}`;
    if (blockedMoveKeysRef.current.has(moveKey)) return;
    if (maze[last.row][last.col].walls[direction]) {
      const didReveal = revealWall(getWallSegment(last, direction));
      blockedMoveKeysRef.current.add(moveKey);
      const canContinue = consumeExtraLife();
      if (didReveal) {
        triggerShake();
      }
      if (!canContinue) {
        void handleFail('You failed.');
      }
      return;
    }

    const nextPath = [...currentPath, next];
    pathRef.current = nextPath;
    setPlayerPath(nextPath);

    if (row === mazeSize - 1 && col === mazeSize - 1) {
      handleSuccess();
    }
  };

  const handlePointerDown = (row: number, col: number) => {
    if (phase !== 'input') return;
    if (showMaze) {
      setShowMaze(false);
    }
    setIsDrawing(true);
    attemptStep(row, col);
  };

  const handlePointerEnter = (row: number, col: number) => {
    if (!isDrawing || phase !== 'input') return;
    attemptStep(row, col);
  };

  const resetGame = () => {
    setPhase('idle');
    setScore(0);
    setRound(1);
    extraLivesRef.current = EXTRA_LIVES_PER_MAZE;
    setMazeSize(BASE_SIZE);
    setMaze(generateMaze(BASE_SIZE));
    pathRef.current = [];
    setPlayerPath([]);
    setShowMaze(false);
    setFailReason(null);
    revealedWallKeysRef.current = new Set();
    setRevealedWallSegments([]);
    blockedMoveKeysRef.current = new Set();
    setSubmitState('idle');
  };

  // Map phase to GameShell state
  const getShellState = (): GameShellState => {
    if (phase === 'idle') return 'IDLE';
    if (phase === 'memorize' || phase === 'input') return 'PLAYING';
    if (phase === 'failed') return 'FINISHED';
    return 'IDLE';
  };

  const phaseLabel =
    phase === 'memorize'
      ? 'Memorize'
      : phase === 'input'
        ? 'Navigate'
        : phase === 'failed'
          ? 'Ended'
          : 'Ready';

  const showPath = phase === 'input' || phase === 'failed';

  const getStatusText = () => {
    if (phase === 'memorize' || phase === 'input') {
      return `Round ${round} • Score: ${score} • ${mazeSize}×${mazeSize}`;
    }
    if (phase === 'failed') {
      return submitting ? 'Saving score...' : (submitState === 'success' ? 'Score saved!' : '');
    }
    return '';
  };

  const result: GameResult | undefined = phase === 'failed' ? {
    score: score,
    scoreLabel: 'rounds',
    message: failReason || 'Game over',
  } : undefined;

  // Render functions for GameShell
  const renderReady = () => (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] mb-3">
          Pathfinding
        </h2>
        <p className="text-[#0a0a0a]/70 text-lg max-w-xl mx-auto">
          A maze appears and stays visible until you start moving. Navigate from start to end from memory. You are allowed up to one mistake per round.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 text-sm">
        <div className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/25 text-[#0a0a0a]">
          Best: <span className="font-bold">{bestScore > 0 ? bestScore : '--'}</span>
        </div>
      </div>
      <button
        onClick={startGame}
        className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-black font-bold text-lg rounded-xl transition-colors"
      >
        Press Space / Tap Start
      </button>
    </div>
  );

  const renderGame = () => (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        <div className="rounded-full bg-[#0a0a0a]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0a0a0a] border border-[#0a0a0a]/20">
          Score {score}
        </div>
        <div className="rounded-full bg-[#0a0a0a]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0a0a0a] border border-[#0a0a0a]/20">
          Round {round}
        </div>
        <div className="rounded-full bg-[#0a0a0a]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0a0a0a] border border-[#0a0a0a]/20">
          {mazeSize} x {mazeSize}
        </div>
      </div>
      <PathfindingBoard
        phaseLabel={phaseLabel}
        phase={phase}
        mazeSize={mazeSize}
        maze={maze}
        showMaze={showMaze}
        showPath={showPath}
        wallColor={WALL_COLOR}
        wallSegments={wallSegments}
        revealedWallSegments={revealedWallSegments}
        pathSegments={pathSegments}
        pathSet={pathSet}
        lastPosition={lastPosition}
        failReason={failReason}
        submitting={submitting}
        submitState={submitState}
        shakeTick={shakeTick}
        onStart={startGame}
        onReset={resetGame}
        onPointerDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
      />
    </div>
  );

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
        {!submitting && submitState === 'success' && <p className="text-green-600 text-base">✓ Score saved!</p>}
        {result.message && (
          <p className="text-[#0a0a0a]/70 text-base mt-2">{result.message}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={startGame}
          className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl transition-colors"
        >
          Play Again
        </button>
        <a
          href={`/leaderboard/pathfinding`}
          className="px-6 py-3 bg-[#0a0a0a]/10 hover:bg-[#0a0a0a]/20 text-[#0a0a0a] font-semibold rounded-xl transition-colors border border-[#0a0a0a]/20"
        >
          View Leaderboard
        </a>
      </div>
    </div>
  );

  const gameMetadata = getGameMetadata('pathfinding');

  return (
    <GameShell
      gameMetadata={gameMetadata}
      gameState={getShellState()}
      onStart={startGame}
      onRestart={startGame}
      onQuit={resetGame}
      renderGame={renderGame}
      renderReady={renderReady}
      renderResult={renderResult}
      result={result}
      statusText={getStatusText()}
      maxWidth="2xl"
    />
  );
}
