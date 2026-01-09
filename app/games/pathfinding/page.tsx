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
import ResultCard from '@/components/ResultCard';
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

const generateMaze = (size: number, targetTurns: number): Cell[][] => {
  // Generate a solution path with exactly targetTurns turns first
  const solutionPath = generatePathWithTurns(size, targetTurns);

  // Create grid and carve out the solution path
  const grid = createGrid(size);
  for (let i = 0; i < solutionPath.length - 1; i++) {
    const from = solutionPath[i];
    const to = solutionPath[i + 1];
    const dir = getDirection(from, to);
    if (!dir) continue;

    const oppositeDir = directions.find(d => d.direction === dir)?.opposite;
    if (!oppositeDir) continue;

    grid[from.row][from.col].walls[dir] = false;
    grid[to.row][to.col].walls[oppositeDir as Direction] = false;
  }

  // Mark solution path as visited
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  for (const pos of solutionPath) {
    visited[pos.row][pos.col] = true;
  }

  // Fill rest of maze using DFS starting from random positions on solution path
  const pathPositions = [...solutionPath];
  shuffleArray(pathPositions);

  for (const startPos of pathPositions) {
    const stack: Position[] = [startPos];

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
  }

  return grid;
};

const generatePathWithTurns = (size: number, targetTurns: number): Position[] => {
  // Use a more complex algorithm that can generate paths with many turns
  // by moving in all 4 directions and creating a winding path
  const start: Position = { row: 0, col: 0 };
  const end: Position = { row: size - 1, col: size - 1 };

  // For small turn counts or impossible cases, use simple path
  const manhattanDist = Math.abs(end.row - start.row) + Math.abs(end.col - start.col);
  if (targetTurns === 0 || manhattanDist < 2) {
    // Generate straight path
    const path: Position[] = [start];
    let curr = { ...start };
    while (curr.row < end.row) {
      curr = { row: curr.row + 1, col: curr.col };
      path.push({ ...curr });
    }
    while (curr.col < end.col) {
      curr = { row: curr.row, col: curr.col + 1 };
      path.push({ ...curr });
    }
    return path;
  }

  // Try to generate a path with exact turns using backtracking
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  visited[start.row][start.col] = true;

  const findPath = (
    current: Position,
    path: Position[],
    currentDir: Direction | null,
    turnsUsed: number
  ): Position[] | null => {
    // Reached end - check if we have exact turns
    if (current.row === end.row && current.col === end.col) {
      return turnsUsed === targetTurns ? path : null;
    }

    // Pruning: if we've used too many turns already, stop
    if (turnsUsed > targetTurns) return null;

    // Pruning: if we can't possibly reach target turns
    const remainingDist = Math.abs(end.row - current.row) + Math.abs(end.col - current.col);
    const turnsLeft = targetTurns - turnsUsed;
    // We need at least remainingDist steps; max turns possible is remainingDist - 1
    if (turnsLeft > remainingDist - 1) return null;

    // Try all 4 directions in random order
    const dirs = [...directions];
    shuffleArray(dirs);

    for (const dir of dirs) {
      const next: Position = {
        row: current.row + dir.dr,
        col: current.col + dir.dc,
      };

      // Check bounds and visited
      if (
        next.row < 0 ||
        next.row >= size ||
        next.col < 0 ||
        next.col >= size ||
        visited[next.row][next.col]
      ) {
        continue;
      }

      // Calculate turns if we move in this direction
      const nextDir = dir.direction;
      const willTurn = currentDir !== null && currentDir !== nextDir;
      const nextTurns = turnsUsed + (willTurn ? 1 : 0);

      // Mark as visited
      visited[next.row][next.col] = true;
      const newPath = [...path, next];

      const result = findPath(next, newPath, nextDir, nextTurns);
      if (result) return result;

      // Backtrack
      visited[next.row][next.col] = false;
    }

    return null;
  };

  // Try to find a path with exact turns
  const result = findPath(start, [start], null, 0);

  if (result) return result;

  // Fallback: generate a simple path if backtracking fails
  console.warn(`Could not generate path with exactly ${targetTurns} turns for size ${size}`);
  const path: Position[] = [start];
  let curr = { ...start };
  while (curr.row < end.row) {
    curr = { row: curr.row + 1, col: curr.col };
    path.push({ ...curr });
  }
  while (curr.col < end.col) {
    curr = { row: curr.row, col: curr.col + 1 };
    path.push({ ...curr });
  }
  return path;
};

const shuffleArray = <T,>(array: T[]): void => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
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
  const [maze, setMaze] = useState<Cell[][]>(() => generateMaze(BASE_SIZE, 1));
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
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [scoreTimestamp, setScoreTimestamp] = useState<Date | undefined>(undefined);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const pathRef = useRef<Position[]>([]);
  const extraLivesRef = useRef(EXTRA_LIVES_PER_MAZE);
  const revealedWallKeysRef = useRef<Set<string>>(new Set());
  const blockedMoveKeysRef = useRef<Set<string>>(new Set());

  // Load best score from localStorage and Supabase on mount
  useEffect(() => {
    // Only show best scores for logged-in users
    if (!me?.isLoggedIn || !me?.userId) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setBestScore(0), 0);
      return;
    }

    // Load from localStorage as initial value
    const stored = localStorage.getItem('pathfinding_best_score');
    if (stored !== null && stored !== '') {
      const parsed = Number(stored);
      if (!isNaN(parsed)) {
        // Use setTimeout to avoid synchronous setState in effect
        setTimeout(() => setBestScore(parsed), 0);
      }
    }

    // Fetch best score from Supabase
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
    const targetTurns = nextRound; // Number of turns = round number
    setMazeSize(size);
    setMaze(generateMaze(size, targetTurns));
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
    setScoreTimestamp(new Date());
    // Update best score if needed
    if (score > bestScore) {
      setBestScore(score);
    }
    setSubmitting(true);
    setSubmitState('idle');
    setIsNewHighScore(false);
    setSubmissionError(null);
    // Pass previous best to avoid race condition with isNewHighScore
    const previousBest = bestScore > 0 ? bestScore : null;
    const result = await submitScore('pathfinding', score, previousBest);
    setSubmitting(false);
    if (result.success) {
      setSubmitState('success');
      if (result.isNewHighScore) {
        setIsNewHighScore(true);
      }
    } else {
      setSubmitState('error');
      const errorMessage = result.error || 'Failed to save score. Please try again.';
      setSubmissionError(errorMessage);
    }
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

    // Check if clicking on a previous position in the path (backtracking)
    const posKey = `${row}-${col}`;
    const pathIndex = currentPath.findIndex(pos => `${pos.row}-${pos.col}` === posKey);

    if (pathIndex >= 0 && pathIndex < currentPath.length - 1) {
      // Backtracking: remove all positions after the clicked position
      const newPath = currentPath.slice(0, pathIndex + 1);
      pathRef.current = newPath;
      setPlayerPath(newPath);
      return;
    }

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
    setMaze(generateMaze(BASE_SIZE, 1));
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
      <ResultCard
        gameMetadata={gameMetadata}
        score={result.score}
        scoreLabel="rounds"
        personalBest={bestScore > 0 ? bestScore : undefined}
        personalBestLabel="rounds"
        message={result.message}
        isNewHighScore={isNewHighScore}
        timestamp={scoreTimestamp}
        onPlayAgain={startGame}
        isSubmitting={submitting}
        submissionError={submissionError}
    />
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
