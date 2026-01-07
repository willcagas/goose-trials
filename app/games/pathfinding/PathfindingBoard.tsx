'use client';

import { useEffect, useState } from 'react';
import type {
  Cell,
  GamePhase,
  PathSegment,
  Position,
  WallSegment,
} from './types';
import PathfindingMazeGrid from './PathfindingMazeGrid';
import PathfindingMazeOverlays from './PathfindingMazeOverlays';

interface PathfindingBoardProps {
  phaseLabel: string;
  phase: GamePhase;
  mazeSize: number;
  maze: Cell[][];
  showMaze: boolean;
  showPath: boolean;
  wallColor: string;
  wallSegments: WallSegment[];
  revealedWallSegments: WallSegment[];
  pathSegments: PathSegment[];
  pathSet: Set<string>;
  lastPosition?: Position;
  failReason: string | null;
  submitting: boolean;
  submitState: 'idle' | 'success' | 'error';
  shakeTick: number;
  onStart: () => void;
  onReset: () => void;
  onPointerDown: (row: number, col: number) => void;
  onPointerEnter: (row: number, col: number) => void;
}

export default function PathfindingBoard({
  phaseLabel,
  phase,
  mazeSize,
  maze,
  showMaze,
  showPath,
  wallColor,
  wallSegments,
  revealedWallSegments,
  pathSegments,
  pathSet,
  lastPosition,
  failReason,
  submitting,
  submitState,
  shakeTick,
  onStart,
  onReset,
  onPointerDown,
  onPointerEnter,
}: PathfindingBoardProps) {
  const showControls = phase !== 'input';
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (shakeTick === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsShaking(false);
    const frame = window.requestAnimationFrame(() => setIsShaking(true));
    const timeout = window.setTimeout(() => setIsShaking(false), 300);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [shakeTick]);

  return (
    <section className="fade-up">
      <div
        className={`bg-white/80 border border-white/70 shadow-xl p-6 ${
          isShaking ? 'board-shake' : ''
        }`}
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-amber-400/70">
          <span>{phaseLabel}</span>
          <span>{showMaze ? 'Preview' : 'Trace Mode'}</span>
        </div>

        <div className="mt-6 flex justify-center">
          <div
            className="relative touch-none"
            style={{
              width: 'min(90vw, 480px)',
              aspectRatio: '1 / 1',
            }}
          >
            <PathfindingMazeGrid
              phase={phase}
              mazeSize={mazeSize}
              maze={maze}
              showMaze={showMaze}
              showPath={showPath}
              pathSet={pathSet}
              lastPosition={lastPosition}
              onPointerDown={onPointerDown}
              onPointerEnter={onPointerEnter}
            />
            <PathfindingMazeOverlays
              mazeSize={mazeSize}
              showMaze={showMaze}
              showPath={showPath}
              wallColor={wallColor}
              wallSegments={wallSegments}
              revealedWallSegments={revealedWallSegments}
              pathSegments={pathSegments}
            />
            {showControls && (
              <div className="absolute inset-0 z-30 flex items-center justify-center">
                <div className="rounded-2xl bg-white/90 backdrop-blur px-6 py-5 shadow-lg border border-amber-400/30 text-center max-w-[80%]">
                  {phase === 'failed' ? (
                    <>
                      <p className="text-sm uppercase tracking-[0.2em] text-amber-400/80">
                        Run ended
                      </p>
                      {failReason && (
                        <p className="mt-2 text-sm text-rose-500">
                          {failReason}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-amber-400/70">
                        {submitting && 'Saving score...'}
                        {!submitting &&
                          submitState === 'success' &&
                          'Score saved.'}
                        {!submitting &&
                          submitState === 'error' &&
                          'Score save failed.'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm uppercase tracking-[0.2em] text-amber-400/80">
                      Ready
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    {phase === 'idle' && (
                      <button
                        onClick={onStart}
                        className="px-6 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold shadow-lg shadow-amber-400/20 transition"
                      >
                        Start Run
                      </button>
                    )}
                    {phase === 'failed' && (
                      <>
                        <button
                          onClick={onStart}
                          className="px-6 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold shadow-lg shadow-amber-400/20 transition"
                        >
                          Try Again
                        </button>
                        <button
                          onClick={onReset}
                          className="px-6 py-2 rounded-full bg-white/80 text-amber-400/90 text-sm font-semibold shadow-sm border border-amber-400/30 hover:bg-white transition"
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .board-shake {
          animation: shake 0.25s ease;
        }
        @keyframes shake {
          0% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-6px);
          }
          50% {
            transform: translateX(5px);
          }
          75% {
            transform: translateX(-4px);
          }
          100% {
            transform: translateX(0);
          }
        }
      `}</style>
    </section>
  );
}
