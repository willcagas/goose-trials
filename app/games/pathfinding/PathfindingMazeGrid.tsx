'use client';

import { useRef, type PointerEvent } from 'react';
import type { Cell, GamePhase, Position } from './types';

interface PathfindingMazeGridProps {
  phase: GamePhase;
  mazeSize: number;
  maze: Cell[][];
  showMaze: boolean;
  showPath: boolean;
  pathSet: Set<string>;
  lastPosition?: Position;
  onPointerDown: (row: number, col: number) => void;
  onPointerEnter: (row: number, col: number) => void;
}

export default function PathfindingMazeGrid({
  phase,
  mazeSize,
  maze,
  showMaze,
  showPath,
  pathSet,
  lastPosition,
  onPointerDown,
  onPointerEnter,
}: PathfindingMazeGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const col = Math.min(
      mazeSize - 1,
      Math.max(0, Math.floor((x / rect.width) * mazeSize))
    );
    const row = Math.min(
      mazeSize - 1,
      Math.max(0, Math.floor((y / rect.height) * mazeSize))
    );

    onPointerEnter(row, col);
  };

  return (
    <div
      className={`absolute inset-0 grid rounded-2xl overflow-hidden bg-white/70 shadow-inner z-10 ${
        phase === 'input' ? 'cursor-crosshair' : 'cursor-default'
      }`}
      style={{
        gridTemplateColumns: `repeat(${mazeSize}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${mazeSize}, minmax(0, 1fr))`,
      }}
      ref={gridRef}
      onPointerMove={handlePointerMove}
    >
      {maze.map((row, rowIndex) =>
        row.map((_, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          const isStart = rowIndex === 0 && colIndex === 0;
          const isEnd = rowIndex === mazeSize - 1 && colIndex === mazeSize - 1;
          const inPath = showPath && pathSet.has(key);
          const isCurrent =
            showPath &&
            lastPosition?.row === rowIndex &&
            lastPosition?.col === colIndex;
          const circleTone = isCurrent
            ? 'bg-emerald-500 text-white shadow-emerald-300/70'
            : inPath
            ? 'bg-emerald-300 text-emerald-900 shadow-emerald-200/60'
            : isEnd
            ? 'bg-amber-200 text-amber-900 shadow-amber-200/60'
            : 'bg-slate-100 text-slate-500 shadow-slate-200/70';

          return (
            <div
              key={key}
              className="relative flex items-center justify-center bg-white/40"
            >
              <button
                type="button"
                className={`h-[66%] w-[66%] rounded-full transition-all duration-150 shadow-sm flex items-center justify-center text-[10px] font-semibold uppercase ${circleTone} ${
                  phase === 'input'
                    ? 'hover:scale-105 active:scale-95'
                    : 'opacity-80'
                }`}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onPointerDown(rowIndex, colIndex);
                }}
                onPointerEnter={() => onPointerEnter(rowIndex, colIndex)}
              >
                {isStart ? 'S' : isEnd ? 'F' : ''}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
