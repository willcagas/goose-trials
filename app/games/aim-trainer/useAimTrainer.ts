import type { PointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { submitScore } from '@/lib/db/scores';
import { MAX_TARGET, MIN_TARGET, ROUND_DURATION_MS } from './constants';
import type { Phase, Target } from './types';

const clamp = (min: number, value: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function useAimTrainer() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [target, setTarget] = useState<Target | null>(null);
  const [targetFeedback, setTargetFeedback] = useState<'hit' | 'miss' | null>(
    null
  );
  const [timeLeftMs, setTimeLeftMs] = useState(ROUND_DURATION_MS);
  const [bestHits, setBestHits] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const [boardSize, setBoardSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const targetIdRef = useRef(0);
  const lastTargetRef = useRef<{ x: number; y: number } | null>(null);
  const finishingRef = useRef(false);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const accuracy = useMemo(() => {
    const attempts = hits + misses;
    if (attempts === 0) return 100;
    return Math.round((hits / attempts) * 100);
  }, [hits, misses]);

  useEffect(() => {
    const stored = localStorage.getItem('aim_trainer_best_hits');
    if (stored) {
      const parsed = Number(stored);
      if (!Number.isNaN(parsed)) setBestHits(parsed);
    }
  }, []);

  useEffect(() => {
    if (bestHits !== null) {
      localStorage.setItem('aim_trainer_best_hits', String(bestHits));
    }
  }, [bestHits]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const finishRun = useCallback(async () => {
    if (finishingRef.current || startTimeRef.current === null) return;
    finishingRef.current = true;
    const finalHits = hitsRef.current;
    setPhase('complete');
    setTarget(null);
    setTargetFeedback(null);
    setTimeLeftMs(0);
    setBestHits((prev) =>
      prev === null || finalHits > prev ? finalHits : prev
    );
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    setSubmitting(true);
    setSubmitState('idle');
    const result = await submitScore('aim-trainer', finalHits);
    setSubmitting(false);
    setSubmitState(result.success ? 'success' : 'error');
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const interval = window.setInterval(() => {
      if (startTimeRef.current !== null) {
        const elapsed = performance.now() - startTimeRef.current;
        const remaining = Math.max(0, ROUND_DURATION_MS - elapsed);
        setTimeLeftMs(Math.round(remaining));
        if (remaining <= 0) {
          void finishRun();
        }
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [finishRun, phase]);

  useEffect(() => {
    if (!boardRef.current) return;
    const node = boardRef.current;
    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setBoardSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const spawnTarget = useCallback(
    (nextHits: number) => {
      if (!boardSize) return;
      const base = Math.min(boardSize.width, boardSize.height);
      const size = clamp(
        MIN_TARGET,
        Math.round(base * 0.16 - nextHits * 0.4),
        MAX_TARGET
      );
      const padding = 12 + size / 2;
      const minX = padding;
      const maxX = boardSize.width - padding;
      const minY = padding;
      const maxY = boardSize.height - padding;

      if (maxX <= minX || maxY <= minY) return;

      let x = minX + Math.random() * (maxX - minX);
      let y = minY + Math.random() * (maxY - minY);

      const last = lastTargetRef.current;
      if (last) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const distance = Math.hypot(x - last.x, y - last.y);
          if (distance > size * 1.4) break;
          x = minX + Math.random() * (maxX - minX);
          y = minY + Math.random() * (maxY - minY);
        }
      }

      const nextTarget = {
        id: targetIdRef.current++,
        x,
        y,
        size,
      };
      lastTargetRef.current = { x, y };
      setTarget(nextTarget);
    },
    [boardSize]
  );

  useEffect(() => {
    if (phase !== 'running' || target || !boardSize) return;
    spawnTarget(hitsRef.current);
  }, [boardSize, phase, spawnTarget, target]);

  const resetRun = () => {
    setPhase('idle');
    setHits(0);
    setMisses(0);
    setTarget(null);
    setTargetFeedback(null);
    setTimeLeftMs(ROUND_DURATION_MS);
    setSubmitState('idle');
    setSubmitting(false);
    startTimeRef.current = null;
    hitsRef.current = 0;
    missesRef.current = 0;
    targetIdRef.current = 0;
    lastTargetRef.current = null;
    finishingRef.current = false;
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
  };

  const startRun = () => {
    if (!boardSize) return;
    setPhase('running');
    setHits(0);
    setMisses(0);
    setTarget(null);
    setTargetFeedback(null);
    setTimeLeftMs(ROUND_DURATION_MS);
    setSubmitState('idle');
    setSubmitting(false);
    startTimeRef.current = performance.now();
    hitsRef.current = 0;
    missesRef.current = 0;
    targetIdRef.current = 0;
    lastTargetRef.current = null;
    finishingRef.current = false;
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    spawnTarget(0);
  };

  const registerMiss = () => {
    if (phase !== 'running') return;
    missesRef.current += 1;
    setMisses(missesRef.current);
    setTargetFeedback('miss');
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setTargetFeedback(null);
    }, 120);
  };

  const handleHit = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (phase !== 'running') return;
    const nextHits = hitsRef.current + 1;
    hitsRef.current = nextHits;
    setHits(nextHits);
    setTargetFeedback('hit');
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setTargetFeedback(null);
    }, 120);
    if (finishingRef.current) return;
    spawnTarget(nextHits);
  };

  const handleBoardPointerDown = () => {
    registerMiss();
  };

  const canStart = Boolean(boardSize);
  const phaseLabel =
    phase === 'running' ? 'Live' : phase === 'complete' ? 'Ended' : 'Ready';

  return {
    phase,
    hits,
    misses,
    target,
    targetFeedback,
    timeLeftMs,
    bestHits,
    accuracy,
    submitting,
    submitState,
    canStart,
    phaseLabel,
    boardRef,
    handleBoardPointerDown,
    handleHit,
    resetRun,
    startRun,
  };
}
