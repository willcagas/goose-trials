'use client';

import type { PointerEvent, ReactNode, RefObject } from 'react';
import type { Phase, Target } from './types';

interface AimTrainerBoardProps {
  phase: Phase;
  targets: Target[];
  targetFeedback: Map<number, 'hit' | 'miss'>;
  boardRef: RefObject<HTMLDivElement | null>;
  onBoardPointerDown: () => void;
  onHit: (event: PointerEvent<HTMLButtonElement>, targetId: number) => void;
  overlay?: ReactNode;
}

export default function AimTrainerBoard({
  phase,
  targets,
  targetFeedback,
  boardRef,
  onBoardPointerDown,
  onHit,
  overlay,
}: AimTrainerBoardProps) {
  const showOverlay = phase !== 'running';

  const getTargetClass = (targetId: number) => {
    const feedback = targetFeedback.get(targetId);
    if (feedback === 'hit') {
      return 'bg-emerald-400 ring-4 ring-emerald-300/70 shadow-[0_0_40px_rgba(16,185,129,0.6)] scale-110';
    }
    if (feedback === 'miss') {
      return 'bg-rose-400 ring-4 ring-rose-300/70 shadow-[0_0_20px_rgba(244,63,94,0.5)] scale-90';
    }
    return 'bg-yellow-400 ring-2 ring-yellow-500/30 shadow-md hover:scale-105 hover:shadow-lg';
  };

  return (
    <div
      ref={boardRef}
      className="relative touch-none rounded-3xl bg-white border-4 border-gray-300 shadow-inner overflow-hidden"
      style={{
        width: 'min(90vw, 500px)',
        aspectRatio: '1 / 1',
      }}
      onPointerDown={phase === 'running' ? onBoardPointerDown : undefined}
    >
      {phase === 'running' && targets.map((target) => (
        <button
          key={target.id}
          type="button"
          aria-label="Target"
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ease-out active:scale-90 cursor-crosshair ${getTargetClass(target.id)}`}
          onPointerDown={(e) => onHit(e, target.id)}
          style={{
            left: `${target.x}px`,
            top: `${target.y}px`,
            width: `${target.size}px`,
            height: `${target.size}px`,
          }}
        />
      ))}

      {showOverlay && overlay && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          {overlay}
        </div>
      )}
    </div>
  );
}
