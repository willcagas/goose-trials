'use client';

import type { PointerEvent, ReactNode, RefObject } from 'react';
import type { Phase, Target } from './types';

interface AimTrainerBoardProps {
  phase: Phase;
  target: Target | null;
  targetFeedback: 'hit' | 'miss' | null;
  boardRef: RefObject<HTMLDivElement | null>;
  onBoardPointerDown: () => void;
  onHit: (event: PointerEvent<HTMLButtonElement>) => void;
  overlay?: ReactNode;
}

export default function AimTrainerBoard({
  phase,
  target,
  targetFeedback,
  boardRef,
  onBoardPointerDown,
  onHit,
  overlay,
}: AimTrainerBoardProps) {
  const showOverlay = phase !== 'running';
  const targetClass =
    targetFeedback === 'hit'
      ? 'bg-amber-400 ring-2 ring-emerald-300/70 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
      : targetFeedback === 'miss'
      ? 'bg-amber-400 ring-2 ring-rose-300/70 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
      : 'bg-amber-400 ring-2 ring-amber-300/70 shadow-sm';

  return (
    <div
      ref={boardRef}
      className="relative touch-none rounded-2xl bg-white/80 border border-amber-400/30 shadow-inner overflow-hidden"
      style={{
        width: 'min(90vw, 480px)',
        aspectRatio: '1 / 1',
      }}
      onPointerDown={phase === 'running' ? onBoardPointerDown : undefined}
    >
      {phase === 'running' && target && (
        <button
          type="button"
          aria-label="Target"
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform transition-shadow duration-150 ease-out active:scale-95 ${targetClass}`}
          onPointerDown={onHit}
          style={{
            left: `${target.x}px`,
            top: `${target.y}px`,
            width: `${target.size}px`,
            height: `${target.size}px`,
          }}
        />
      )}

      {showOverlay && overlay && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          {overlay}
        </div>
      )}
    </div>
  );
}
