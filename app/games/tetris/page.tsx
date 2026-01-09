'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import GameShell, { GameShellState, GameResult } from '@/components/GameShell';
import { getGameMetadata } from '@/lib/games/registry';
import { useMe } from '@/app/providers/MeContext';
import { createClient } from '@/lib/supabase/client';
import { submitScore } from '@/lib/db/scores';
import { X } from 'lucide-react';
import ResultCard from '@/components/ResultCard';
import { validateStoredScore, validateScore } from '@/lib/scoring/validate';

// Tetromino shapes with two color schemes
const TETROMINO_COLORS = {
  yellow: {
    I: '#d97706', // amber-600 - darker
    O: '#b45309', // amber-700 - darker
    T: '#92400e', // amber-800 - darker
    S: '#eab308', // yellow-500 - darker
    Z: '#ca8a04', // yellow-600 - darker
    L: '#a16207', // yellow-700 - darker
    J: '#854d0e', // yellow-800 - darker
  },
  rainbow: {
    I: '#7dd3fc', // pastel cyan (sky-300)
    O: '#fde047', // pastel yellow (yellow-300)
    T: '#d8b4fe', // pastel purple (purple-300)
    S: '#86efac', // pastel green (green-300)
    Z: '#fca5a5', // pastel red (red-300)
    L: '#fdba74', // pastel orange (orange-300)
    J: '#93c5fd', // pastel blue (blue-300)
  }
};

const TETROMINOS = {
  I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] }, // 4x4 for proper SRS rotation
  O: { shape: [[1, 1], [1, 1]] },
  T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] }, // 3x3 with fixed pivot at center
  S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] }, // 3x3 with pivot at (1,1)
  Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] }, // 3x3 with pivot at (1,1)
  L: { shape: [[0, 0, 0], [1, 1, 1], [0, 0, 1]] }, // 3x3 for proper SRS rotation
  J: { shape: [[0, 0, 0], [1, 1, 1], [1, 0, 0]] }  // 3x3 for proper SRS rotation
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
  justRotated?: boolean; // Track if piece just rotated for T-spin detection
}

type ColorScheme = 'yellow' | 'rainbow';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 26;
const GOAL_LINES = 15;
const FALL_SPEED = 800;
const FAST_FALL_SPEED = 30;
const SIDE_SHIFT_DELAY = 120;
const SIDE_SHIFT_INTERVAL = 35;
const LOCK_DELAY = 500; // 500ms lock delay (standard Tetris timing)

// SRS Wall Kick Data - Official Super Rotation System
// Format: [rotation_from][rotation_to] = array of kick offsets to test
// Offsets are in (x, y) where positive x is right, positive y is DOWN (in screen coordinates)
// NOTE: Official SRS uses positive y = UP, so we invert y values for screen coordinates
type WallKickOffset = { x: number; y: number };

// Wall kicks for J, L, S, T, Z pieces
// Verified against Tetris Guideline SRS specification
// Screen coordinates: +X = right, +Y = down
const SRS_WALL_KICKS: Record<string, WallKickOffset[]> = {
  // Clockwise rotations
  '0->1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }],
  '1->2': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  '2->3': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }],
  '3->0': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }],
  // Counter-clockwise rotations
  '1->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }],
  '2->1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }],
  '3->2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }],
  '0->3': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
};

// Wall kicks for I piece (different from other pieces)
// Verified against Tetris Guideline SRS specification
// Screen coordinates: +X = right, +Y = down
const SRS_I_WALL_KICKS: Record<string, WallKickOffset[]> = {
  // Clockwise rotations
  '0->1': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }],
  '1->2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }],
  '2->3': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }],
  '3->0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }],
  // Counter-clockwise rotations
  '1->0': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }],
  '2->1': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }],
  '3->2': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }],
  '0->3': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }],
};

type InternalGameState = 'idle' | 'ready' | 'playing' | 'completed' | 'failed';

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
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isFastFalling, setIsFastFalling] = useState(false);
  const [recentPieces, setRecentPieces] = useState(0);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => {
    if (typeof window !== 'undefined') {
      const saved = document.cookie.split('; ').find(row => row.startsWith('tetris_color_scheme='));
      return (saved?.split('=')[1] as ColorScheme) || 'rainbow';
    }
    return 'rainbow';
  });
  const [showControls, setShowControls] = useState(false);

  const boardRef = useRef<(string | null)[][]>(board);
  const currentPieceRef = useRef<Piece | null>(null);
  const piecePlacementTimesRef = useRef<number[]>([]);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bagRef = useRef<TetrominoType[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const lockDelayRef = useRef<NodeJS.Timeout | null>(null);
  const shiftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shiftIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shiftDirectionRef = useRef<number | null>(null);
  const keyStateRef = useRef({ left: false, right: false });
  const suppressSidewaysRef = useRef(false); // One-frame movement immunity after rotation

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
    const times = piecePlacementTimesRef.current;

    // Calculate average pieces per second for entire game
    if (times.length === 0 || !startTimeRef.current) {
      setRecentPieces(0);
    } else {
      // Calculate from game start to now
      const now = Date.now();
      const totalTimeSeconds = (now - startTimeRef.current) / 1000;
      const averagePiecesPerSecond = times.length / totalTimeSeconds;
      setRecentPieces(averagePiecesPerSecond);
    }
  }, []);

  const recordPiecePlacement = useCallback(() => {
    const now = Date.now();
    const times = piecePlacementTimesRef.current;
    times.push(now);

    // Calculate average pieces per second for entire game
    if (startTimeRef.current) {
      const totalTimeSeconds = (now - startTimeRef.current) / 1000;
      const averagePiecesPerSecond = times.length / totalTimeSeconds;
      setRecentPieces(averagePiecesPerSecond);
    }
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
    if (internalState === 'ready' || internalState === 'playing') return 'PLAYING';
    if (internalState === 'completed' || internalState === 'failed') return 'FINISHED';
    return 'IDLE';
  };

  useEffect(() => {
    if (!me?.isLoggedIn || !me?.userId) {
      setBestScore(null);
      return;
    }

    const stored = localStorage.getItem('tetris_best_score');
    let localBest: number | null = validateStoredScore('tetris', stored);
    if (localBest !== null) {
      setBestScore(localBest);
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
          // Validate database score before using it
          const validation = validateScore('tetris', dbBest);
          if (validation.valid) {
            setBestScore(dbBest);
            localStorage.setItem('tetris_best_score', dbBest.toString());
          } else if (localBest !== null) {
            // If DB score is invalid but local is valid, use local
            setBestScore(localBest);
          }
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

  // 7-bag randomization system (standard Tetris)
  const shuffleBag = useCallback((): TetrominoType[] => {
    const types = Object.keys(TETROMINOS) as TetrominoType[];
    const bag = [...types];
    // Fisher-Yates shuffle
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }, []);

  const getNextTetrominoFromBag = useCallback((): TetrominoType => {
    if (bagRef.current.length === 0) {
      bagRef.current = shuffleBag();
    }
    return bagRef.current.shift()!;
  }, [shuffleBag]);

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

  const rotatePieceCounterClockwiseShape = (shape: number[][]): number[][] => {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated: number[][] = Array(cols).fill(null).map(() => Array(rows).fill(0));

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        rotated[cols - 1 - x][y] = shape[y][x];
      }
    }
    return rotated;
  };

  const createPiece = (type: TetrominoType, rotation: number = 0): Piece => {
    let shape = TETROMINOS[type].shape;

    // Apply any initial rotations
    for (let i = 0; i < rotation; i++) {
      shape = rotatePiece(shape);
    }

    // Calculate spawn position - center horizontally at top of board
    const spawnX = Math.floor(BOARD_WIDTH / 2) - Math.floor(shape[0].length / 2);

    return {
      type,
      rotation,
      position: { x: spawnX, y: 0 },
      shape
    };
  };

  const getPieceColor = (type: TetrominoType): string => {
    return TETROMINO_COLORS[colorScheme][type];
  };

  const toggleColorScheme = () => {
    const newScheme = colorScheme === 'yellow' ? 'rainbow' : 'yellow';
    setColorScheme(newScheme);
    // Save to cookie with 1 year expiry
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `tetris_color_scheme=${newScheme}; expires=${expires.toUTCString()}; path=/`;
  };

  // Handle ESC key for controls modal
  useEffect(() => {
    if (!showControls) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowControls(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showControls]);

  // Prevent body scroll when controls modal is open
  useEffect(() => {
    if (showControls) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showControls]);

  const checkCollision = useCallback(
    (
      piece: Piece,
      offsetX: number = 0,
      offsetY: number = 0,
      boardState: (string | null)[][] = boardRef.current
    ): boolean => {
      const debugThis = (piece.type === 'L' || piece.type === 'J') && (piece.position.x <= 1 || piece.position.x >= 7) && piece.justRotated;

      for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
          if (piece.shape[y][x]) {
            const boardX = piece.position.x + x + offsetX;
            const boardY = piece.position.y + y + offsetY;

            if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
              if (debugThis) {
                console.log(`  Collision: block at shape(${x},${y}) -> board(${boardX},${boardY}) OUT OF BOUNDS`);
              }
              return true;
            }

            if (boardY >= 0 && boardState[boardY][boardX]) {
              if (debugThis) {
                console.log(`  Collision: block at shape(${x},${y}) -> board(${boardX},${boardY}) OCCUPIED`);
              }
              return true;
            }
          }
        }
      }
      if (debugThis) {
        console.log(`  No collision detected`);
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
    const color = getPieceColor(piece.type);

    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const boardY = piece.position.y + y;
          const boardX = piece.position.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT) {
            newBoard[boardY][boardX] = color;
          }
        }
      }
    }
    return newBoard;
  }, [colorScheme]);

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

    // Refill queue if needed (using 7-bag system)
    if (remainingPieces.length < 5) {
      const newPieces = Array.from({ length: 5 }, () => getNextTetrominoFromBag());
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
  }, [nextPieces, linesCleared, checkCollision, updateCurrentPiece, getNextTetrominoFromBag]);

  // Check if a T-piece is in a T-spin position
  const checkTSpin = useCallback((piece: Piece, board: (string | null)[][]): boolean => {
    // Only T pieces can T-spin
    if (piece.type !== 'T') return false;
    // Must have just rotated
    if (!piece.justRotated) return false;

    const {x, y} = piece.position;

    // Check the 4 corners of the T-piece's 3x3 bounding box
    // T shape is [[0,1,0],[1,1,1],[0,0,0]] with center pivot at (1,1)
    // Corners are at the 4 corners of this 3x3 grid
    const corners = [
      {dx: 0, dy: 0},     // top-left
      {dx: 2, dy: 0},     // top-right
      {dx: 0, dy: 2},     // bottom-left
      {dx: 2, dy: 2}      // bottom-right
    ];

    let filledCorners = 0;

    for (const corner of corners) {
      const checkX = x + corner.dx;
      const checkY = y + corner.dy;

      // Corner is "filled" if out of bounds or has a block
      if (checkX < 0 || checkX >= BOARD_WIDTH ||
          checkY < 0 || checkY >= BOARD_HEIGHT ||
          board[checkY]?.[checkX]) {
        filledCorners++;
      }
    }

    // T-spin requires at least 3 of 4 corners to be filled
    return filledCorners >= 3;
  }, []);

  const lockPiece = useCallback((piece: Piece) => {
    const newBoard = mergePieceToBoard(piece);

    // Check for T-spin before clearing lines
    const isTSpin = checkTSpin(piece, boardRef.current);

    const { newBoard: clearedBoard, cleared } = clearLines(newBoard);

    setBoard(clearedBoard);
    const newLinesCleared = linesCleared + cleared;
    setLinesCleared(newLinesCleared);
    recordPiecePlacement();

    // Show T-spin notification if it occurred
    if (isTSpin && cleared > 0) {
      // You can add visual feedback here later if desired
      console.log(`T-SPIN ${cleared === 1 ? 'Single' : cleared === 2 ? 'Double' : 'Triple'}!`);
    }

    if (newLinesCleared >= GOAL_LINES) {
      const finalTime = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
      setFinalScore(finalTime);

      // Only update best score if valid
      const validation = validateScore('tetris', finalTime);
      const isNewBest = validation.valid && (bestScore === null || finalTime < bestScore);
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

      // Submit score for both logged-in and guest users
      setSubmitting(true);
      setSubmissionError(null);
      submitScore('tetris', finalTime, bestScore)
        .then((response) => {
          setSubmitting(false);
          if (response.success) {
            if (response.isNewHighScore) {
              setIsNewHighScore(true);
            }
          } else {
            const errorMessage = response.error || 'Failed to save score. Please try again.';
            setSubmissionError(errorMessage);
            console.error('Failed to submit score:', response.error);
          }
        })
        .catch(err => {
          setSubmitting(false);
          const errorMessage = err instanceof Error ? err.message : 'Failed to save score. Please try again.';
          setSubmissionError(errorMessage);
          console.error('Failed to submit score:', err);
        });
      return;
    }

    spawnNewPiece();
  }, [linesCleared, spawnNewPiece, bestScore, me, mergePieceToBoard, recordPiecePlacement, checkTSpin]);

  const moveDown = useCallback(() => {
    if (internalState !== 'playing') return;
    const piece = currentPieceRef.current;
    if (!piece) return;

    if (!checkCollision(piece, 0, 1)) {
      // Piece can still move down - clear any existing lock delay
      if (lockDelayRef.current) {
        clearTimeout(lockDelayRef.current);
        lockDelayRef.current = null;
      }
      updateCurrentPiece({
        ...piece,
        position: { ...piece.position, y: piece.position.y + 1 },
        justRotated: false // Clear rotation flag on movement
      });
    } else {
      // Piece has hit the ground - start lock delay if not already started
      if (!lockDelayRef.current) {
        lockDelayRef.current = setTimeout(() => {
          lockPiece(piece);
          lockDelayRef.current = null;
        }, LOCK_DELAY);
      }
    }
  }, [internalState, checkCollision, lockPiece, updateCurrentPiece]);

  const moveSideways = useCallback((direction: number) => {
    if (suppressSidewaysRef.current) return;
    if (internalState !== 'playing') return;
    const piece = currentPieceRef.current;
    if (!piece) return;

    if (!checkCollision(piece, direction, 0)) {
      const newPiece = {
        ...piece,
        position: { ...piece.position, x: piece.position.x + direction },
        justRotated: false // Clear rotation flag on sideways movement
      };

      updateCurrentPiece(newPiece);

      // Check if piece is on ground after moving
      if (checkCollision(newPiece, 0, 1)) {
        // Piece is on ground - reset lock delay
        if (lockDelayRef.current) {
          clearTimeout(lockDelayRef.current);
        }
        lockDelayRef.current = setTimeout(() => {
          lockPiece(currentPieceRef.current!);
          lockDelayRef.current = null;
        }, LOCK_DELAY);
      } else {
        // Piece is not on ground - clear any existing lock delay
        if (lockDelayRef.current) {
          clearTimeout(lockDelayRef.current);
          lockDelayRef.current = null;
        }
      }
    }
  }, [internalState, checkCollision, updateCurrentPiece, lockPiece]);

  const startAutoShift = useCallback((direction: number, immediate: boolean = true) => {
    if (internalState !== 'playing') return;
    clearAutoShift();
    shiftDirectionRef.current = direction;

    // Only apply immediate movement if requested (not after rotation)
    if (immediate) {
      moveSideways(direction);
    }

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

  const rotatePieceClockwise = useCallback(() => {
    if (internalState !== 'playing') return;

    // CRITICAL: Clear auto-shift BEFORE reading piece position
    // This prevents auto-shift from moving the piece to the wall
    // just before rotation is tested (which breaks L/J specifically)
    const wasAutoShifting = shiftDirectionRef.current !== null;
    const savedDirection = shiftDirectionRef.current;
    if (wasAutoShifting) {
      clearAutoShift();
    }

    // Use ref to get the most current piece state, avoiding race conditions with setState
    const piece = currentPieceRef.current;
    if (!piece) return;

    // O piece doesn't rotate
    if (piece.type === 'O') {
      // Restore auto-shift for O piece since it doesn't rotate
      if (wasAutoShifting &&
          ((savedDirection === -1 && keyStateRef.current.left) ||
           (savedDirection === 1 && keyStateRef.current.right))) {
        startAutoShift(savedDirection);
      }
      return;
    }

    const oldRotation = piece.rotation;
    const newRotation = (oldRotation + 1) % 4;
    const newShape = rotatePiece(piece.shape);

    // Get the appropriate wall kick table
    const kickTable = piece.type === 'I' ? SRS_I_WALL_KICKS : SRS_WALL_KICKS;
    const kickKey = `${oldRotation}->${newRotation}`;
    const kicks = kickTable[kickKey] || [{ x: 0, y: 0 }];

    // Try each kick offset in order
    for (const kick of kicks) {
      const testPiece: Piece = {
        ...piece,
        rotation: newRotation,
        shape: newShape,
        position: {
          x: piece.position.x + kick.x,
          y: piece.position.y + kick.y
        },
        justRotated: true // Mark for T-spin detection
      };

      // DEBUG: Log rotation attempts for L/J pieces near walls
      if ((piece.type === 'L' || piece.type === 'J') && (piece.position.x <= 1 || piece.position.x >= 7)) {
        console.log(`[${piece.type}] Rotation ${piece.rotation}->${newRotation}, pos:(${piece.position.x},${piece.position.y}), kick:(${kick.x},${kick.y}), testPos:(${testPiece.position.x},${testPiece.position.y})`);
        console.log('Shape:', newShape);
      }

      if (!checkCollision(testPiece)) {
        // Rotation successful with this kick
        updateCurrentPiece(testPiece);

        // Block sideways movement for one frame to prevent undoing wall kicks
        suppressSidewaysRef.current = true;
        queueMicrotask(() => {
          suppressSidewaysRef.current = false;
        });

        // Restart auto-shift if key is still held, but WITHOUT immediate movement
        // This prevents the piece from being pushed back into the wall after a valid kick
        if (wasAutoShifting &&
            ((savedDirection === -1 && keyStateRef.current.left) ||
             (savedDirection === 1 && keyStateRef.current.right))) {
          startAutoShift(savedDirection, false);  // false = no immediate movement
        }

        // Handle lock delay
        if (checkCollision(testPiece, 0, 1)) {
          // Piece is on the ground - reset lock delay
          if (lockDelayRef.current) {
            clearTimeout(lockDelayRef.current);
          }
          lockDelayRef.current = setTimeout(() => {
            lockPiece(currentPieceRef.current!);
            lockDelayRef.current = null;
          }, LOCK_DELAY);
        } else {
          // Piece is not on ground - clear lock delay
          if (lockDelayRef.current) {
            clearTimeout(lockDelayRef.current);
            lockDelayRef.current = null;
          }
        }
        return;
      }
    }

    // All kicks failed - rotation not possible
    // Restore auto-shift since rotation failed, with immediate movement
    if (wasAutoShifting &&
        ((savedDirection === -1 && keyStateRef.current.left) ||
         (savedDirection === 1 && keyStateRef.current.right))) {
      startAutoShift(savedDirection, true);  // true = immediate movement (default)
    }
  }, [internalState, checkCollision, updateCurrentPiece, lockPiece, clearAutoShift, startAutoShift]);

  const rotatePieceCounterClockwise = useCallback(() => {
    if (internalState !== 'playing') return;

    // CRITICAL: Clear auto-shift BEFORE reading piece position
    // This prevents auto-shift from moving the piece to the wall
    // just before rotation is tested (which breaks L/J specifically)
    const wasAutoShifting = shiftDirectionRef.current !== null;
    const savedDirection = shiftDirectionRef.current;
    if (wasAutoShifting) {
      clearAutoShift();
    }

    // Use ref to get the most current piece state, avoiding race conditions with setState
    const piece = currentPieceRef.current;
    if (!piece) return;

    // O piece doesn't rotate
    if (piece.type === 'O') {
      // Restore auto-shift for O piece since it doesn't rotate
      if (wasAutoShifting &&
          ((savedDirection === -1 && keyStateRef.current.left) ||
           (savedDirection === 1 && keyStateRef.current.right))) {
        startAutoShift(savedDirection, true);  // true = default immediate movement
      }
      return;
    }

    const oldRotation = piece.rotation;
    const newRotation = (oldRotation - 1 + 4) % 4;
    const newShape = rotatePieceCounterClockwiseShape(piece.shape);

    // Get the appropriate wall kick table
    const kickTable = piece.type === 'I' ? SRS_I_WALL_KICKS : SRS_WALL_KICKS;
    const kickKey = `${oldRotation}->${newRotation}`;
    const kicks = kickTable[kickKey] || [{ x: 0, y: 0 }];

    // Try each kick offset in order
    for (const kick of kicks) {
      const testPiece: Piece = {
        ...piece,
        rotation: newRotation,
        shape: newShape,
        position: {
          x: piece.position.x + kick.x,
          y: piece.position.y + kick.y
        },
        justRotated: true // Mark for T-spin detection
      };

      // DEBUG: Log rotation attempts for L/J pieces near walls
      if ((piece.type === 'L' || piece.type === 'J') && (piece.position.x <= 1 || piece.position.x >= 7)) {
        console.log(`[${piece.type}] Rotation ${piece.rotation}->${newRotation}, pos:(${piece.position.x},${piece.position.y}), kick:(${kick.x},${kick.y}), testPos:(${testPiece.position.x},${testPiece.position.y})`);
        console.log('Shape:', newShape);
      }

      if (!checkCollision(testPiece)) {
        // Rotation successful with this kick
        updateCurrentPiece(testPiece);

        // Block sideways movement for one frame to prevent undoing wall kicks
        suppressSidewaysRef.current = true;
        queueMicrotask(() => {
          suppressSidewaysRef.current = false;
        });

        // Restart auto-shift if key is still held, but WITHOUT immediate movement
        // This prevents the piece from being pushed back into the wall after a valid kick
        if (wasAutoShifting &&
            ((savedDirection === -1 && keyStateRef.current.left) ||
             (savedDirection === 1 && keyStateRef.current.right))) {
          startAutoShift(savedDirection, false);  // false = no immediate movement
        }

        // Handle lock delay
        if (checkCollision(testPiece, 0, 1)) {
          // Piece is on the ground - reset lock delay
          if (lockDelayRef.current) {
            clearTimeout(lockDelayRef.current);
          }
          lockDelayRef.current = setTimeout(() => {
            lockPiece(currentPieceRef.current!);
            lockDelayRef.current = null;
          }, LOCK_DELAY);
        } else {
          // Piece is not on ground - clear lock delay
          if (lockDelayRef.current) {
            clearTimeout(lockDelayRef.current);
            lockDelayRef.current = null;
          }
        }
        return;
      }
    }

    // All kicks failed - rotation not possible
    // Restore auto-shift since rotation failed, with immediate movement
    if (wasAutoShifting &&
        ((savedDirection === -1 && keyStateRef.current.left) ||
         (savedDirection === 1 && keyStateRef.current.right))) {
      startAutoShift(savedDirection, true);  // true = immediate movement (default)
    }
  }, [internalState, checkCollision, updateCurrentPiece, lockPiece, clearAutoShift, startAutoShift]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || internalState !== 'playing') return;

    // Clear any existing lock delay - hard drop is immediate
    if (lockDelayRef.current) {
      clearTimeout(lockDelayRef.current);
      lockDelayRef.current = null;
    }

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
      const color = getPieceColor(droppedPiece.type);
      for (let y = 0; y < droppedPiece.shape.length; y++) {
        for (let x = 0; x < droppedPiece.shape[y].length; x++) {
          if (droppedPiece.shape[y][x]) {
            const boardY = droppedPiece.position.y + y;
            const boardX = droppedPiece.position.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT) {
              finalBoard[boardY][boardX] = color;
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

        // Submit score for both logged-in and guest users
        setSubmitting(true);
        setSubmissionError(null);
        submitScore('tetris', finalTime, bestScore)
          .then((response) => {
            setSubmitting(false);
            if (response.success) {
              if (response.isNewHighScore) {
                setIsNewHighScore(true);
              }
            } else {
              const errorMessage = response.error || 'Failed to save score. Please try again.';
              setSubmissionError(errorMessage);
              console.error('Failed to submit score:', response.error);
            }
          })
          .catch(err => {
            setSubmitting(false);
            const errorMessage = err instanceof Error ? err.message : 'Failed to save score. Please try again.';
            setSubmissionError(errorMessage);
            console.error('Failed to submit score:', err);
          });
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

  const startGame = useCallback(() => {
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

    // Enter ready state - show "Press any key to start" overlay
    setInternalState('ready');
    startTimeRef.current = null;

    // Initialize 7-bag system and piece queue
    bagRef.current = shuffleBag();
    const initialPieces = Array.from({ length: 7 }, () => getNextTetrominoFromBag());
    setNextPieces(initialPieces);

    const [firstPiece, ...rest] = initialPieces;
    setNextPieces(rest);
    updateCurrentPiece(createPiece(firstPiece));
  }, [getNextTetrominoFromBag, updateCurrentPiece]);

  const beginPlaying = useCallback(() => {
    // Start the timer and gravity
    setInternalState('playing');
    startTimeRef.current = Date.now();
  }, []);

  const handleQuit = useCallback(() => {
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
  }, [updateCurrentPiece]);

  const handleRestart = useCallback(() => {
    // Clear any existing timers/intervals before restarting
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (lockDelayRef.current) clearTimeout(lockDelayRef.current);
    clearAutoShift();

    // Immediately start a fresh game (don't return to idle)
    startGame();
  }, [clearAutoShift, startGame]);

  // Global keyboard handler for restart
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check if authentication modal is open (LoginModal with data-auth-modal attribute)
      const isAuthModalOpen = document.querySelector('[data-auth-modal="true"]') !== null;
      // Also check for any modal with z-50 as fallback
      const isAnyModalOpen = document.querySelector('.fixed.inset-0.z-50') !== null;
      const isModalOpen = isAuthModalOpen || isAnyModalOpen;
      
      // Check if event target is inside a modal
      const target = e.target as HTMLElement;
      const isTargetInModal = target?.closest('[data-auth-modal="true"]') !== null || 
                              target?.closest('.fixed.inset-0.z-50') !== null;
      
      // Don't interfere if user is typing in an input/textarea/contentEditable
      // This check should happen FIRST, regardless of modal state, to allow normal typing
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }
      
      if (isModalOpen || isTargetInModal) {
        // Prevent default and stop propagation for game keys to ensure they don't trigger game actions
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      
      // Restart with R key (works during playing or completed/failed, returns to idle)
      if ((e.key === 'r' || e.key === 'R') && (internalState === 'playing' || internalState === 'completed' || internalState === 'failed')) {
        e.preventDefault();
        handleRestart();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [internalState, handleRestart]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if authentication modal is open (LoginModal with data-auth-modal attribute)
      const isAuthModalOpen = document.querySelector('[data-auth-modal="true"]') !== null;
      // Also check for any modal with z-50 as fallback
      const isAnyModalOpen = document.querySelector('.fixed.inset-0.z-50') !== null;
      const isModalOpen = isAuthModalOpen || isAnyModalOpen;
      
      // Check if event target is inside a modal
      const target = e.target as HTMLElement;
      const isTargetInModal = target?.closest('[data-auth-modal="true"]') !== null || 
                              target?.closest('.fixed.inset-0.z-50') !== null;
      
      // Don't interfere if user is typing in an input/textarea/contentEditable
      // This check should happen FIRST, regardless of modal state, to allow normal typing
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }
      
      if (isModalOpen || isTargetInModal) {
        // Prevent default and stop propagation for all game-related keys
        const gameKeys = [' ', 'r', 'R', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 
                         'a', 'A', 'd', 'D', 's', 'S', 'w', 'W', 'x', 'X', 'z', 'Z', 
                         'c', 'C', 'Control', 'Shift'];
        if (gameKeys.includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      
      // Start the game from ready state and process the key that started it
      if (internalState === 'ready') {
        e.preventDefault();
        beginPlaying();
        // Don't return - let the key be processed below
      }

      if (internalState !== 'playing' && internalState !== 'ready') return;

      // Move Left: Arrow Left, A
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (e.repeat) return;
        keyStateRef.current.left = true;
        if (internalState === 'playing') {
          startAutoShift(-1);
        }
      }
      // Move Right: Arrow Right, D
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        if (e.repeat) return;
        keyStateRef.current.right = true;
        if (internalState === 'playing') {
          startAutoShift(1);
        }
      }
      // Soft Drop: Arrow Down, S
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (internalState === 'playing' && !isFastFalling) {
          setIsFastFalling(true);
        }
      }
      // Rotate Clockwise: Arrow Up, W, X
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        if (internalState === 'playing') {
          rotatePieceClockwise();
        }
      }
      // Rotate Counter-Clockwise: Z, Ctrl
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'Control') {
        e.preventDefault();
        if (internalState === 'playing') {
          rotatePieceCounterClockwise();
        }
      }
      // Hard Drop: Space
      else if (e.key === ' ') {
        e.preventDefault();
        if (internalState === 'playing') {
          hardDrop();
        }
      }
      // Hold: C, Shift
      else if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') {
        e.preventDefault();
        if (internalState === 'playing') {
          holdPiece();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Check if authentication modal is open (LoginModal with data-auth-modal attribute)
      const isAuthModalOpen = document.querySelector('[data-auth-modal="true"]') !== null;
      // Also check for any modal with z-50 as fallback
      const isAnyModalOpen = document.querySelector('.fixed.inset-0.z-50') !== null;
      const isModalOpen = isAuthModalOpen || isAnyModalOpen;
      
      // Check if event target is inside a modal
      const target = e.target as HTMLElement;
      const isTargetInModal = target?.closest('[data-auth-modal="true"]') !== null || 
                              target?.closest('.fixed.inset-0.z-50') !== null;
      
      // Don't interfere if user is typing in an input/textarea/contentEditable
      // This check should happen FIRST, regardless of modal state, to allow normal typing
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }
      
      if (isModalOpen || isTargetInModal) {
        e.stopPropagation();
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keyStateRef.current.left = false;
        if (shiftDirectionRef.current === -1) {
          if (keyStateRef.current.right) {
            startAutoShift(1);
          } else {
            clearAutoShift();
          }
        }
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keyStateRef.current.right = false;
        if (shiftDirectionRef.current === 1) {
          if (keyStateRef.current.left) {
            startAutoShift(-1);
          } else {
            clearAutoShift();
          }
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
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
    rotatePieceCounterClockwise,
    holdPiece,
    beginPlaying
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
      }, 16); // ~60fps for smooth updates
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [internalState, updateRecentPieces]);

  const renderPreviewPiece = (type: TetrominoType | null, size: 'large' | 'medium' | 'small' = 'large') => {
    if (!type) {
      return <div className="flex items-center justify-center h-full text-gray-400 text-xs">EMPTY</div>;
    }

    const shape = TETROMINOS[type].shape;
    const color = getPieceColor(type);
    const blockSize = size === 'large' ? 22 : size === 'medium' ? 16 : 12;

    return (
      <div className="flex flex-col items-center justify-center gap-[2px]">
        {shape.map((row, y) => (
          <div key={y} className="flex gap-[2px]">
            {row.map((cell, x) => (
              <div
                key={`${y}-${x}`}
                style={{
                  width: `${blockSize}px`,
                  height: `${blockSize}px`,
                  backgroundColor: cell ? color : 'transparent',
                  border: cell ? '1px solid rgba(0,0,0,0.15)' : 'none',
                  borderRadius: '2px'
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
        {/* Left Panel - Hold and Stats */}
        <div className="flex flex-col justify-between w-32" style={{ height: BOARD_HEIGHT * BLOCK_SIZE }}>
          <div className="flex flex-col gap-2">
            <div className="text-[#0a0a0a] text-xs uppercase font-bold tracking-wider">
              HOLD
            </div>
            <div className="bg-gray-800 border-2 border-gray-700 rounded-lg w-32 h-28 flex items-center justify-center shadow-sm">
              {renderPreviewPiece(heldPiece)}
            </div>
          </div>

          {/* Stats - bottom left aligned with playzone bottom */}
          <div className="text-[#0a0a0a] font-bold text-right space-y-3">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-[#0a0a0a]/50">PIECES</div>
              <div className="text-3xl tabular-nums font-bold">
                {recentPieces.toFixed(2)}<span className="text-base text-[#0a0a0a]/50 ml-1">s</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-[#0a0a0a]/50">LINES</div>
              <div className="text-3xl tabular-nums font-bold">
                {linesCleared}<span className="text-base text-[#0a0a0a]/50 ml-1">/{GOAL_LINES}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-[#0a0a0a]/50">TIME</div>
              <div className="text-3xl tabular-nums font-bold">
                {Math.floor(timeElapsed / 60)}:{String(Math.floor(timeElapsed % 60)).padStart(2, '0')}<span className="text-base text-[#0a0a0a]/50">.{String(Math.floor((timeElapsed % 1) * 100)).padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center - Game Board */}
        <div className="flex flex-col gap-3">
          {/* Board */}
          <div
            className="relative bg-gray-800"
            style={{
              width: BOARD_WIDTH * BLOCK_SIZE,
              height: BOARD_HEIGHT * BLOCK_SIZE,
              outline: '4px solid #1f2937',
              outlineOffset: '0px'
            }}
          >
            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: BOARD_HEIGHT + 1 }).map((_, y) => (
                <div
                  key={`h-${y}`}
                  className="absolute left-0 right-0 border-t border-gray-700"
                  style={{ top: y * BLOCK_SIZE }}
                />
              ))}
              {Array.from({ length: BOARD_WIDTH + 1 }).map((_, x) => (
                <div
                  key={`v-${x}`}
                  className="absolute top-0 bottom-0 border-l border-gray-700"
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
                      backgroundColor: 'rgba(128, 128, 128, 0.3)',
                      border: '1px solid rgba(128, 128, 128, 0.5)',
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
                      backgroundColor: getPieceColor(currentPiece.type),
                      boxSizing: 'border-box',
                      border: '1px solid rgba(0,0,0,0.2)'
                    }}
                  />
                ) : null
              )
            )}

            {/* Ready State Overlay */}
            {internalState === 'ready' && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
                <div className="text-amber-400 text-4xl font-bold text-center px-4">
                  Press any key to start
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Right Panel - Next and Toggle */}
        <div className="flex flex-col gap-2 w-32">
          <div className="text-[#0a0a0a] text-xs uppercase font-bold tracking-wider">
            NEXT
          </div>

          {/* Next Most Piece - Separate */}
          {nextPieces.length > 0 && (
            <div className="bg-gray-800 border-2 border-gray-700 rounded-lg h-24 flex items-center justify-center shadow-sm">
              {renderPreviewPiece(nextPieces[0], 'large')}
            </div>
          )}

          {/* Remaining Next Pieces */}
          <div className="bg-gray-800 border-2 border-gray-700 rounded-lg flex flex-col divide-y divide-gray-700 shadow-sm overflow-hidden">
            {nextPieces.slice(1, 5).map((type, index) => (
              <div
                key={index}
                className="h-14 w-32 flex items-center justify-center"
              >
                {renderPreviewPiece(type, 'small')}
              </div>
            ))}
          </div>

          {/* Controls and Color Toggle - bottom right aligned with playzone bottom */}
          <div className="mt-auto space-y-2">
            <button
              onClick={() => setShowControls(true)}
              className="w-full px-3 py-2 bg-[#0a0a0a]/5 hover:bg-[#0a0a0a]/10 border border-[#0a0a0a]/20 rounded-lg text-[#0a0a0a] text-xs font-semibold transition-colors"
            >
              Controls
            </button>
            <button
              onClick={toggleColorScheme}
              className="w-full px-3 py-2 bg-[#0a0a0a]/5 hover:bg-[#0a0a0a]/10 border border-[#0a0a0a]/20 rounded-lg text-[#0a0a0a] text-xs font-semibold transition-colors"
            >
              {colorScheme === 'yellow' ? 'Colors' : 'Yellow'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getStatusText = () => {
    if (internalState === 'idle') return 'Press Start to begin';
    if (internalState === 'ready') return 'Press any key to start';
    if (internalState === 'playing') return `Lines: ${linesCleared}/${GOAL_LINES} · Time: ${Math.floor(timeElapsed)}s`;
    return '';
  };

  const renderResult = () => {
    if (!result) return null;

    return (
      <ResultCard
        gameMetadata={gameMetadata}
        score={result.score}
        scoreLabel={result.scoreLabel}
        personalBest={result.personalBest}
        personalBestLabel={result.personalBestLabel}
        message={result.message}
        submissionError={submissionError}
        isNewHighScore={isNewHighScore}
        isSubmitting={submitting}
        onPlayAgain={handleRestart}
      />
    );
  };

  const gameMetadata = getGameMetadata('tetris');

  return (
    <>
      <GameShell
        gameMetadata={gameMetadata}
        gameState={getShellState()}
        onStart={startGame}
        onRestart={handleRestart}
        onQuit={handleQuit}
        renderGame={renderGame}
        renderResult={renderResult}
        result={result}
        statusText={getStatusText()}
        maxWidth="full"
      />

      {/* Controls Modal */}
      {showControls && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowControls(false);
            }
          }}
          aria-modal="true"
          aria-labelledby="controls-modal-title"
          role="dialog"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />

          {/* Modal */}
          <div
            className="relative bg-[#0a0a0a] border border-white/20 rounded-2xl p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowControls(false)}
              className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
              aria-label="Close controls modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="pr-10 mb-6">
              <h2 id="controls-modal-title" className="text-2xl md:text-3xl font-bold text-white mb-2">
                Tetris Controls
              </h2>
              <p className="text-white/60 text-sm md:text-base">Keyboard controls for playing Tetris</p>
            </div>

            {/* Controls */}
            <section>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-amber-400">Keyboard Controls</span>
              </h3>

              <div className="space-y-6">
                {/* Movement */}
                <div>
                  <h4 className="text-sm font-medium text-white/90 mb-2 uppercase tracking-wide">
                    Movement
                  </h4>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2 text-white/70 text-sm">
                      <span className="text-amber-400/60 shrink-0">•</span>
                      <span><span className="text-white/90 font-medium">← →</span> or <span className="text-white/90 font-medium">A D</span> - Move piece left/right</span>
                    </li>
                    <li className="flex items-start gap-2 text-white/70 text-sm">
                      <span className="text-amber-400/60 shrink-0">•</span>
                      <span><span className="text-white/90 font-medium">↓</span> or <span className="text-white/90 font-medium">S</span> - Soft drop (move down faster)</span>
                    </li>
                    <li className="flex items-start gap-2 text-white/70 text-sm">
                      <span className="text-amber-400/60 shrink-0">•</span>
                      <span><span className="text-white/90 font-medium">Space</span> - Hard drop (instant drop)</span>
                    </li>
                  </ul>
                </div>

                {/* Rotation */}
                <div>
                  <h4 className="text-sm font-medium text-white/90 mb-2 uppercase tracking-wide">
                    Rotation
                  </h4>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2 text-white/70 text-sm">
                      <span className="text-amber-400/60 shrink-0">•</span>
                      <span><span className="text-white/90 font-medium">↑</span>, <span className="text-white/90 font-medium">W</span>, or <span className="text-white/90 font-medium">X</span> - Rotate clockwise</span>
                    </li>
                    <li className="flex items-start gap-2 text-white/70 text-sm">
                      <span className="text-amber-400/60 shrink-0">•</span>
                      <span><span className="text-white/90 font-medium">Ctrl</span> or <span className="text-white/90 font-medium">Z</span> - Rotate counter-clockwise</span>
                    </li>
                  </ul>
                </div>

                {/* Special Actions */}
                <div>
                  <h4 className="text-sm font-medium text-white/90 mb-2 uppercase tracking-wide">
                    Special Actions
                  </h4>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2 text-white/70 text-sm">
                      <span className="text-amber-400/60 shrink-0">•</span>
                      <span><span className="text-white/90 font-medium">C</span> or <span className="text-white/90 font-medium">Shift</span> - Hold piece (swap with held piece)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <button
                onClick={() => setShowControls(false)}
                className="w-full px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
