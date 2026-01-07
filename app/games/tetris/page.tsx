'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import GameShell, { GameShellState, GameResult } from '@/components/GameShell';
import { getGameMetadata } from '@/lib/games/registry';
import { useMe } from '@/app/providers/MeContext';
import { createClient } from '@/lib/supabase/client';
import { submitScore } from '@/lib/db/scores';

// Tetromino shapes
const TETROMINOS = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: '#00f0f0',
  },
  O: {
    shape: [[1, 1], [1, 1]],
    color: '#f0f000',
  },
  T: {
    shape: [[0, 1, 0], [1, 1, 1]],
    color: '#a000f0',
  },
  S: {
    shape: [[0, 1, 1], [1, 1, 0]],
    color: '#00f000',
  },
  Z: {
    shape: [[1, 1, 0], [0, 1, 1]],
    color: '#f00000',
  },
  L: {
    shape: [[1, 0], [1, 0], [1, 1]],
    color: '#f0a000',
  },
  J: {
    shape: [[0, 1], [0, 1], [1, 1]],
    color: '#0000f0',
  }
};

type TetrominoType = keyof typeof TETROMINOS;

interface Position {
  x: number;
  y: number;
}

interface Piece {
  type: TetrominoType;
  rotation: number;
  position: Position;
  shape: number[][];
  color: string;
}

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 26;
const GOAL_LINES = 30;
const FALL_SPEED = 800;
const FAST_FALL_SPEED = 30;
const SIDE_SHIFT_DELAY = 120;
const SIDE_SHIFT_INTERVAL = 35;

type InternalGameState = 'idle' | 'playing' | 'completed' | 'failed';

export default function TetrisGame() {
  const { me } = useMe();
  const [internalState, setInternalState] = useState<InternalGameState>('idle');
  const [board, setBoard] = useState<(string | null)[][]>(
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null))
  );
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [heldPiece, setHeldPiece] = useState<TetrominoType | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [nextPieces, setNextPieces] = useState<TetrominoType[]>([]);
  const [linesCleared, setLinesCleared] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [isFastFalling, setIsFastFalling] = useState(false);
  const [recentPieces, setRecentPieces] = useState(0);

  const boardRef = useRef<(string | null)[][]>(board);
  const currentPieceRef = useRef<Piece | null>(null);
  const piecePlacementTimesRef = useRef<number[]>([]);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lockDelayRef = useRef<NodeJS.Timeout | null>(null);
  const shiftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shiftIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shiftDirectionRef = useRef<number | null>(null);
  const keyStateRef = useRef({ left: false, right: false });

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    currentPieceRef.current = currentPiece;
  }, [currentPiece]);

  const updateCurrentPiece = useCallback((piece: Piece | null) => {
    currentPieceRef.current = piece;
    setCurrentPiece(piece);
  }, []);

  const updateRecentPieces = useCallback(() => {
    const now = Date.now();
    const times = piecePlacementTimesRef.current;
    while (times.length > 0 && now - times[0] > 1000) {
      times.shift();
    }
    setRecentPieces(times.length);
  }, []);

  const recordPiecePlacement = useCallback(() => {
    const now = Date.now();
    const times = piecePlacementTimesRef.current;
    times.push(now);
    while (times.length > 0 && now - times[0] > 1000) {
      times.shift();
    }
    setRecentPieces(times.length);
  }, []);

  const clearAutoShift = useCallback(() => {
    if (shiftTimeoutRef.current) {
      clearTimeout(shiftTimeoutRef.current);
      shiftTimeoutRef.current = null;
    }
    if (shiftIntervalRef.current) {
      clearInterval(shiftIntervalRef.current);
      shiftIntervalRef.current = null;
    }
    shiftDirectionRef.current = null;
  }, []);

  const getShellState = (): GameShellState => {
    if (internalState === 'idle') return 'IDLE';
    if (internalState === 'playing') return 'PLAYING';
    if (internalState === 'completed' || internalState === 'failed') return 'FINISHED';
    return 'IDLE';
  };

  useEffect(() => {
    if (!me?.isLoggedIn || !me?.userId) {
      setBestScore(null);
      return;
    }

    const stored = localStorage.getItem('tetris_best_score');
    let localBest: number | null = null;
    if (stored) {
      const parsed = Number(stored);
      if (!Number.isNaN(parsed)) {
        localBest = parsed;
        setBestScore(parsed);
      }
    }

    const fetchBestScore = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('scores')
          .select('score_value')
          .eq('test_slug', 'tetris')
          .eq('user_id', me.userId)
          .order('score_value', { ascending: true })
          .limit(1);

        if (!error && data && data.length > 0) {
          const dbBest = data[0].score_value;
          setBestScore(dbBest);
          localStorage.setItem('tetris_best_score', dbBest.toString());
        } else if (localBest !== null) {
          setBestScore(localBest);
        }
      } catch (err) {
        console.error('Failed to fetch best score:', err);
        if (localBest !== null) {
          setBestScore(localBest);
        }
      }
    };

    fetchBestScore();
  }, [me?.isLoggedIn, me?.userId]);

  const getRandomTetromino = (): TetrominoType => {
    const types = Object.keys(TETROMINOS) as TetrominoType[];
    return types[Math.floor(Math.random() * types.length)];
  };

  const rotatePiece = (shape: number[][]): number[][] => {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated: number[][] = Array(cols).fill(null).map(() => Array(rows).fill(0));

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        rotated[x][rows - 1 - y] = shape[y][x];
      }
    }
    return rotated;
  };

  const createPiece = (type: TetrominoType, rotation: number = 0): Piece => {
    let shape = TETROMINOS[type].shape;
    for (let i = 0; i < rotation % 4; i++) {
      shape = rotatePiece(shape);
    }

    return {
      type,
      rotation,
      position: { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(shape[0].length / 2), y: 0 },
      shape,
      color: TETROMINOS[type].color
    };
  };

  const checkCollision = useCallback(
    (
      piece: Piece,
      offsetX: number = 0,
      offsetY: number = 0,
      boardState: (string | null)[][] = boardRef.current
    ): boolean => {
      for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
          if (piece.shape[y][x]) {
            const boardX = piece.position.x + x + offsetX;
            const boardY = piece.position.y + y + offsetY;

            if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
              return true;
            }

            if (boardY >= 0 && boardState[boardY][boardX]) {
              return true;
            }
          }
        }
      }
      return false;
    },
    []
  );

  const mergePieceToBoard = useCallback((
    piece: Piece,
    boardState: (string | null)[][] = boardRef.current
  ): (string | null)[][] => {
    const newBoard = boardState.map(row => [...row]);

    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const boardY = piece.position.y + y;
          const boardX = piece.position.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT) {
            newBoard[boardY][boardX] = piece.color;
          }
        }
      }
    }
    return newBoard;
  }, []);

  const clearLines = (boardState: (string | null)[][]): { newBoard: (string | null)[][], cleared: number } => {
    let cleared = 0;
    const newBoard = boardState.filter(row => {
      if (row.every(cell => cell !== null)) {
        cleared++;
        return false;
      }
      return true;
    });

    while (newBoard.length < BOARD_HEIGHT) {
      newBoard.unshift(Array(BOARD_WIDTH).fill(null));
    }

    return { newBoard, cleared };
  };

  const spawnNewPiece = useCallback(() => {
    const [nextType, ...remainingPieces] = nextPieces;

    // Refill queue if needed
    if (remainingPieces.length < 5) {
      const newPieces = Array.from({ length: 5 }, () => getRandomTetromino());
      setNextPieces([...remainingPieces, ...newPieces]);
    } else {
      setNextPieces(remainingPieces);
    }

    const piece = createPiece(nextType);
    setCanHold(true);

    if (checkCollision(piece)) {
      setInternalState('failed');
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      setResult({
        score: `${linesCleared}/${GOAL_LINES}`,
        scoreLabel: 'lines',
        message: 'Game Over!'
      });
      return;
    }

    updateCurrentPiece(piece);
  }, [nextPieces, linesCleared, checkCollision, updateCurrentPiece]);

  const lockPiece = useCallback((piece: Piece) => {
    const newBoard = mergePieceToBoard(piece);
    const { newBoard: clearedBoard, cleared } = clearLines(newBoard);

    setBoard(clearedBoard);
    const newLinesCleared = linesCleared + cleared;
    setLinesCleared(newLinesCleared);
    recordPiecePlacement();

    if (newLinesCleared >= GOAL_LINES) {
      const finalTime = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
      setFinalScore(finalTime);

      const isNewBest = bestScore === null || finalTime < bestScore;
      setIsNewHighScore(isNewBest);

      if (isNewBest) {
        setBestScore(finalTime);
        localStorage.setItem('tetris_best_score', finalTime.toString());
      }

      setInternalState('completed');
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);

      setResult({
        score: finalTime.toFixed(2),
        scoreLabel: 's',
        personalBest: bestScore ?? undefined,
        personalBestLabel: 's',
        message: `Cleared ${GOAL_LINES} lines!`
      });

      if (me?.isLoggedIn && me?.userId) {
        setSubmitting(true);
        submitScore('tetris', finalTime, bestScore)
          .then(() => setSubmitting(false))
          .catch(err => {
            console.error('Failed to submit score:', err);
            setSubmitting(false);
          });
      }
      return;
    }

    spawnNewPiece();
  }, [linesCleared, spawnNewPiece, bestScore, me, mergePieceToBoard, recordPiecePlacement]);

  const moveDown = useCallback(() => {
    if (internalState !== 'playing') return;
    const piece = currentPieceRef.current;
    if (!piece) return;

    if (!checkCollision(piece, 0, 1)) {
      updateCurrentPiece({
        ...piece,
        position: { ...piece.position, y: piece.position.y + 1 }
      });
    } else {
      lockPiece(piece);
    }
  }, [internalState, checkCollision, lockPiece, updateCurrentPiece]);

  const moveSideways = useCallback((direction: number) => {
    if (internalState !== 'playing') return;
    const piece = currentPieceRef.current;
    if (!piece) return;

    if (!checkCollision(piece, direction, 0)) {
      updateCurrentPiece({
        ...piece,
        position: { ...piece.position, x: piece.position.x + direction }
      });
    }
  }, [internalState, checkCollision, updateCurrentPiece]);

  const startAutoShift = useCallback((direction: number) => {
    if (internalState !== 'playing') return;
    clearAutoShift();
    shiftDirectionRef.current = direction;
    moveSideways(direction);
    shiftTimeoutRef.current = setTimeout(() => {
      shiftIntervalRef.current = setInterval(() => {
        moveSideways(direction);
      }, SIDE_SHIFT_INTERVAL);
    }, SIDE_SHIFT_DELAY);
  }, [internalState, clearAutoShift, moveSideways]);

  useEffect(() => {
    return () => {
      clearAutoShift();
    };
  }, [clearAutoShift]);

  useEffect(() => {
    if (internalState !== 'playing') {
      clearAutoShift();
      keyStateRef.current = { left: false, right: false };
    }
  }, [internalState, clearAutoShift]);

  const rotatePieceClockwise = () => {
    if (!currentPiece || internalState !== 'playing') return;

    const newRotation = (currentPiece.rotation + 1) % 4;
    const newPiece = createPiece(currentPiece.type, newRotation);
    newPiece.position = { ...currentPiece.position };

    if (!checkCollision(newPiece)) {
      updateCurrentPiece(newPiece);
    } else {
      const wallKicks = [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: -2, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: -1 }
      ];

      for (const kick of wallKicks) {
        newPiece.position = {
          x: currentPiece.position.x + kick.x,
          y: currentPiece.position.y + kick.y
        };
        if (!checkCollision(newPiece)) {
          updateCurrentPiece(newPiece);
          return;
        }
      }
    }
  };

  const hardDrop = useCallback(() => {
    if (!currentPiece || internalState !== 'playing') return;

    let dropDistance = 0;
    while (!checkCollision(currentPiece, 0, dropDistance + 1)) {
      dropDistance++;
    }

    const droppedPiece = {
      ...currentPiece,
      position: { ...currentPiece.position, y: currentPiece.position.y + dropDistance }
    };

    updateCurrentPiece(droppedPiece);

    // Use setTimeout with 0 delay to ensure state updates, then lock immediately
    setTimeout(() => {
      const finalBoard = board.map(row => [...row]);
      for (let y = 0; y < droppedPiece.shape.length; y++) {
        for (let x = 0; x < droppedPiece.shape[y].length; x++) {
          if (droppedPiece.shape[y][x]) {
            const boardY = droppedPiece.position.y + y;
            const boardX = droppedPiece.position.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT) {
              finalBoard[boardY][boardX] = droppedPiece.color;
            }
          }
        }
      }

      const { newBoard: clearedBoard, cleared } = clearLines(finalBoard);
      setBoard(clearedBoard);
      const newLinesCleared = linesCleared + cleared;
      setLinesCleared(newLinesCleared);
      recordPiecePlacement();

      if (newLinesCleared >= GOAL_LINES) {
        const finalTime = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
        setFinalScore(finalTime);

        const isNewBest = bestScore === null || finalTime < bestScore;
        setIsNewHighScore(isNewBest);

        if (isNewBest) {
          setBestScore(finalTime);
          localStorage.setItem('tetris_best_score', finalTime.toString());
        }

        setInternalState('completed');
        if (gameLoopRef.current) clearInterval(gameLoopRef.current);
        if (timerRef.current) clearInterval(timerRef.current);

        setResult({
          score: finalTime.toFixed(2),
          scoreLabel: 's',
          personalBest: bestScore ?? undefined,
          personalBestLabel: 's',
          message: `Cleared ${GOAL_LINES} lines!`
        });

        if (me?.isLoggedIn && me?.userId) {
          setSubmitting(true);
          submitScore('tetris', finalTime, bestScore)
            .then(() => setSubmitting(false))
            .catch(err => {
              console.error('Failed to submit score:', err);
              setSubmitting(false);
            });
        }
        return;
      }

      spawnNewPiece();
    }, 0);
  }, [currentPiece, internalState, board, linesCleared, spawnNewPiece, bestScore, me, updateCurrentPiece, checkCollision, recordPiecePlacement]);

  const holdPiece = () => {
    if (!currentPiece || internalState !== 'playing' || !canHold) return;

    const currentType = currentPiece.type;

    if (heldPiece === null) {
      setHeldPiece(currentType);
      spawnNewPiece();
    } else {
      const piece = createPiece(heldPiece);
      if (!checkCollision(piece)) {
        setHeldPiece(currentType);
        updateCurrentPiece(piece);
      }
    }

    setCanHold(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (internalState !== 'playing') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.repeat) return;
        keyStateRef.current.left = true;
        startAutoShift(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.repeat) return;
        keyStateRef.current.right = true;
        startAutoShift(1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isFastFalling) {
          setIsFastFalling(true);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        rotatePieceClockwise();
      } else if (e.key === ' ') {
        e.preventDefault();
        hardDrop();
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') {
        e.preventDefault();
        holdPiece();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        keyStateRef.current.left = false;
        if (shiftDirectionRef.current === -1) {
          if (keyStateRef.current.right) {
            startAutoShift(1);
          } else {
            clearAutoShift();
          }
        }
      } else if (e.key === 'ArrowRight') {
        keyStateRef.current.right = false;
        if (shiftDirectionRef.current === 1) {
          if (keyStateRef.current.left) {
            startAutoShift(-1);
          } else {
            clearAutoShift();
          }
        }
      } else if (e.key === 'ArrowDown') {
        setIsFastFalling(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    internalState,
    isFastFalling,
    hardDrop,
    startAutoShift,
    clearAutoShift,
    rotatePieceClockwise,
    holdPiece
  ]);

  useEffect(() => {
    if (internalState === 'playing') {
      const speed = isFastFalling ? FAST_FALL_SPEED : FALL_SPEED;

      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }

      gameLoopRef.current = setInterval(() => {
        moveDown();
      }, speed);
    }

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [internalState, moveDown, isFastFalling]);

  useEffect(() => {
    if (internalState === 'playing') {
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setTimeElapsed((Date.now() - startTimeRef.current) / 1000);
        }
        updateRecentPieces();
      }, 100);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [internalState, updateRecentPieces]);

  const startGame = () => {
    setBoard(Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null)));
    setLinesCleared(0);
    setTimeElapsed(0);
    setRecentPieces(0);
    piecePlacementTimesRef.current = [];
    setFinalScore(null);
    setResult(undefined);
    setHeldPiece(null);
    setCanHold(true);
    setIsFastFalling(false);
    setInternalState('playing');
    startTimeRef.current = Date.now();

    // Initialize piece queue
    const initialPieces = Array.from({ length: 7 }, () => getRandomTetromino());
    setNextPieces(initialPieces);

    const [firstPiece, ...rest] = initialPieces;
    setNextPieces(rest);
    updateCurrentPiece(createPiece(firstPiece));
  };

  const handleRestart = () => {
    startGame();
  };

  const handleQuit = () => {
    setInternalState('idle');
    setBoard(Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null)));
    updateCurrentPiece(null);
    setHeldPiece(null);
    setNextPieces([]);
    setLinesCleared(0);
    setTimeElapsed(0);
    setRecentPieces(0);
    piecePlacementTimesRef.current = [];
    setFinalScore(null);
    setResult(undefined);
    setIsFastFalling(false);
    startTimeRef.current = null;
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const renderPreviewPiece = (type: TetrominoType | null, size: 'large' | 'small' = 'large') => {
    if (!type) {
      return <div className="flex items-center justify-center h-20 text-gray-500 text-xs">EMPTY</div>;
    }

    const { shape, color } = TETROMINOS[type];
    const blockSize = size === 'large' ? 14 : 10;

    return (
      <div className="flex flex-col items-center justify-center gap-[1px] py-2">
        {shape.map((row, y) => (
          <div key={y} className="flex gap-[1px]">
            {row.map((cell, x) => (
              <div
                key={`${y}-${x}`}
                style={{
                  width: `${blockSize}px`,
                  height: `${blockSize}px`,
                  backgroundColor: cell ? color : 'transparent',
                  border: cell ? '1px solid rgba(0,0,0,0.2)' : 'none'
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderGame = () => {
    // Calculate ghost piece position
    let ghostY = currentPiece?.position.y || 0;
    if (currentPiece) {
      while (!checkCollision(currentPiece, 0, ghostY - currentPiece.position.y + 1)) {
        ghostY++;
      }
    }

    return (
      <div className="flex flex-col lg:flex-row items-start justify-center gap-4 p-4">
        {/* Left Panel - Hold */}
        <div className="flex flex-col gap-2 w-32">
          <div className="text-white text-xs uppercase font-bold tracking-wider border-b-2 border-white pb-1">
            HOLD
          </div>
          <div className="bg-white border-4 border-black h-24 flex items-center justify-center">
            {renderPreviewPiece(heldPiece)}
          </div>
          <div className="text-white/60 text-[10px] text-center font-mono">C / SHIFT</div>
        </div>

        {/* Center - Game Board */}
        <div className="flex flex-col gap-3">
          {/* Stats */}
          <div className="bg-black/80 text-white px-4 py-2 rounded font-mono text-xs space-y-1">
            <div className="flex justify-between gap-6">
              <span className="text-gray-400">PIECES</span>
              <span className="tabular-nums">{recentPieces}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-400">LINES</span>
              <span className="tabular-nums">{linesCleared}/{GOAL_LINES}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-400">TIME</span>
              <span className="tabular-nums">{Math.floor(timeElapsed / 60)}:{String(Math.floor(timeElapsed % 60)).padStart(2, '0')}</span>
            </div>
          </div>

          {/* Board */}
          <div
            className="relative bg-white"
            style={{
              width: BOARD_WIDTH * BLOCK_SIZE,
              height: BOARD_HEIGHT * BLOCK_SIZE,
              outline: '4px solid #000',
              outlineOffset: '0px'
            }}
          >
            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: BOARD_HEIGHT + 1 }).map((_, y) => (
                <div
                  key={`h-${y}`}
                  className="absolute left-0 right-0 border-t border-gray-300"
                  style={{ top: y * BLOCK_SIZE }}
                />
              ))}
              {Array.from({ length: BOARD_WIDTH + 1 }).map((_, x) => (
                <div
                  key={`v-${x}`}
                  className="absolute top-0 bottom-0 border-l border-gray-300"
                  style={{ left: x * BLOCK_SIZE }}
                />
              ))}
            </div>

            {/* Locked blocks */}
            {board.map((row, y) =>
              row.map((cell, x) =>
                cell ? (
                  <div
                    key={`${y}-${x}`}
                    className="absolute"
                    style={{
                      left: x * BLOCK_SIZE,
                      top: y * BLOCK_SIZE,
                      width: BLOCK_SIZE,
                      height: BLOCK_SIZE,
                      backgroundColor: cell,
                      boxSizing: 'border-box',
                      border: '1px solid rgba(0,0,0,0.2)'
                    }}
                  />
                ) : null
              )
            )}

            {/* Ghost piece */}
            {currentPiece && currentPiece.shape.map((row, y) =>
              row.map((cell, x) =>
                cell ? (
                  <div
                    key={`ghost-${y}-${x}`}
                    className="absolute"
                    style={{
                      left: (currentPiece.position.x + x) * BLOCK_SIZE,
                      top: (ghostY + y) * BLOCK_SIZE,
                      width: BLOCK_SIZE,
                      height: BLOCK_SIZE,
                      backgroundColor: 'transparent',
                      border: `2px dashed ${currentPiece.color}60`,
                      boxSizing: 'border-box'
                    }}
                  />
                ) : null
              )
            )}

            {/* Current piece */}
            {currentPiece && currentPiece.shape.map((row, y) =>
              row.map((cell, x) =>
                cell ? (
                  <div
                    key={`piece-${y}-${x}`}
                    className="absolute"
                    style={{
                      left: (currentPiece.position.x + x) * BLOCK_SIZE,
                      top: (currentPiece.position.y + y) * BLOCK_SIZE,
                      width: BLOCK_SIZE,
                      height: BLOCK_SIZE,
                      backgroundColor: currentPiece.color,
                      boxSizing: 'border-box',
                      border: '1px solid rgba(0,0,0,0.2)'
                    }}
                  />
                ) : null
              )
            )}
          </div>

          {/* Controls */}
          <div className="text-white/50 text-[10px] text-center font-mono space-y-0.5">
            <div>← → MOVE • ↑ ROTATE • SPACE DROP</div>
            <div>↓ FAST FALL • C/SHIFT HOLD</div>
          </div>
        </div>

        {/* Right Panel - Next */}
        <div className="flex flex-col gap-2 w-32">
          <div className="text-white text-xs uppercase font-bold tracking-wider border-b-2 border-white pb-1">
            NEXT
          </div>
          <div className="bg-white border-4 border-black flex flex-col divide-y divide-gray-300">
            {nextPieces.slice(0, 5).map((type, index) => (
              <div key={index} className="h-16">
                {renderPreviewPiece(type, index === 0 ? 'large' : 'small')}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const getStatusText = () => {
    if (internalState === 'idle') return 'Press Start to begin';
    if (internalState === 'playing') return `Lines: ${linesCleared}/${GOAL_LINES} · Time: ${Math.floor(timeElapsed)}s`;
    return '';
  };

  const gameMetadata = getGameMetadata('tetris');

  return (
    <GameShell
      gameMetadata={gameMetadata}
      gameState={getShellState()}
      onStart={startGame}
      onRestart={handleRestart}
      onQuit={handleQuit}
      renderGame={renderGame}
      result={result}
      statusText={getStatusText()}
      maxWidth="full"
    />
  );
}
