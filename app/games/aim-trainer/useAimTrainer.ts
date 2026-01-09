import type { PointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { submitScore } from '@/lib/db/scores';
import { MAX_TARGET, MIN_TARGET, ROUND_DURATION_MS } from './constants';
import type { Phase, Target } from './types';
import { MAX_SIMULTANEOUS_TARGETS } from './types';
import { createClient } from '@/lib/supabase/client';
import { validateStoredScore, validateScore } from '@/lib/scoring/validate';

const clamp = (min: number, value: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function useAimTrainer(me?: { isLoggedIn?: boolean; userId?: string | null } | null) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetFeedback, setTargetFeedback] = useState<Map<number, 'hit' | 'miss'>>(new Map());
  const [timeLeftMs, setTimeLeftMs] = useState(ROUND_DURATION_MS);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [boardSize, setBoardSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const targetIdRef = useRef(0);
  const existingTargetsRef = useRef<Target[]>([]);
  const finishingRef = useRef(false);
  const feedbackTimeoutsRef = useRef<Map<number, number>>(new Map());

  const accuracy = useMemo(() => {
    const attempts = hits + misses;
    if (attempts === 0) return 100;
    return Math.round((hits / attempts) * 100);
  }, [hits, misses]);

  const calculatedScore = useMemo(() => {
    return Math.round(hits * (accuracy / 100));
  }, [hits, accuracy]);

  useEffect(() => {
    // Only show best scores for logged-in users
    if (!me?.isLoggedIn || !me?.userId) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setBestScore(null), 0);
      return;
    }

    // Load from localStorage as initial value (with validation)
    const stored = localStorage.getItem('aim_trainer_best_score');
    let localBest: number | null = validateStoredScore('aim-trainer', stored);
    if (localBest !== null) {
      setTimeout(() => setBestScore(localBest), 0);
    }

    // Fetch best score from Supabase
    const fetchBestScore = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('scores')
          .select('score_value')
          .eq('test_slug', 'aim-trainer')
          .eq('user_id', me.userId)
          .order('score_value', { ascending: false }) // Higher is better
          .limit(1);

        if (!error && data && data.length > 0) {
          const dbBest = data[0].score_value;
          // Validate database score before using it
          const validation = validateScore('aim-trainer', dbBest);
          if (validation.valid) {
            // Use the higher of localStorage and database
            if (localBest === null || dbBest > localBest) {
              setBestScore(dbBest);
            }
          } else if (localBest !== null) {
            // If DB score is invalid but local is valid, use local
            setBestScore(localBest);
          }
        } else if (localBest !== null) {
          // No DB score, use local if valid
          setBestScore(localBest);
        }
      } catch (error) {
        console.error('Error fetching best score from Supabase:', error);
      }
    };

    fetchBestScore();
  }, [me?.isLoggedIn, me?.userId]);

  useEffect(() => {
    if (bestScore !== null) {
      // Only save valid scores to localStorage
      const validation = validateScore('aim-trainer', bestScore);
      if (validation.valid) {
        localStorage.setItem('aim_trainer_best_score', String(bestScore));
      } else {
        // Invalid score - remove from localStorage
        localStorage.removeItem('aim_trainer_best_score');
      }
    }
  }, [bestScore]);

  useEffect(() => {
    return () => {
      feedbackTimeoutsRef.current.forEach((timeout) => {
        window.clearTimeout(timeout);
      });
    };
  }, []);

  const finishRun = useCallback(async () => {
    if (finishingRef.current || startTimeRef.current === null) return;
    finishingRef.current = true;
    const finalHits = hitsRef.current;
    const finalMisses = missesRef.current;
    const finalAttempts = finalHits + finalMisses;
    const finalAccuracy = finalAttempts === 0 ? 100 : Math.round((finalHits / finalAttempts) * 100);
    const finalScore = Math.round(finalHits * (finalAccuracy / 100));

    setPhase('complete');
    setTargets([]);
    setTargetFeedback(new Map());
    setTimeLeftMs(0);
    // Only update best score if valid
    const validation = validateScore('aim-trainer', finalScore);
    if (validation.valid) {
      setBestScore((prev) =>
        prev === null || finalScore > prev ? finalScore : prev
      );
    }
    feedbackTimeoutsRef.current.forEach((timeout) => {
      window.clearTimeout(timeout);
    });
    feedbackTimeoutsRef.current.clear();

    setSubmitting(true);
    setSubmitState('idle');
    setIsNewHighScore(false);
    setSubmissionError(null);
    // Pass previous best to avoid race condition with isNewHighScore
    const result = await submitScore('aim-trainer', finalScore, bestScore);
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
  }, [bestScore]);

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
    const node = boardRef.current;
    if (!node) return;
    
    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      // Only update if we have valid dimensions (not off-screen or zero-sized)
      if (rect.width > 0 && rect.height > 0 && rect.left >= 0) {
        setBoardSize({ width: rect.width, height: rect.height });
      }
    };
    
    // Initial measurement
    updateSize();
    
    // Set up ResizeObserver to watch for size changes
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    
    return () => observer.disconnect();
  }, [phase]); // Re-run when phase changes so we observe the correct board

  const spawnTarget = useCallback((existingTargets?: Target[]) => {
    if (!boardSize) return null;
    const base = Math.min(boardSize.width, boardSize.height);
    const size = clamp(
      MIN_TARGET,
      Math.round(base * 0.16),
      MAX_TARGET
    );
    const padding = 12 + size / 2;
    const minX = padding;
    const maxX = boardSize.width - padding;
    const minY = padding;
    const maxY = boardSize.height - padding;

    if (maxX <= minX || maxY <= minY) return null;

    let x = minX + Math.random() * (maxX - minX);
    let y = minY + Math.random() * (maxY - minY);

    // Ensure NO overlap with existing targets
    // Two circles overlap if distance between centers < sum of radii
    // Use passed existingTargets or fallback to ref
    const currentTargets = existingTargets ?? existingTargetsRef.current;
    const radius = size / 2;

    for (let attempt = 0; attempt < 100; attempt += 1) {
      let hasOverlap = false;
      for (const target of currentTargets) {
        const targetRadius = target.size / 2;
        const distance = Math.hypot(x - target.x, y - target.y);
        const minDistance = radius + targetRadius + 10; // Add 10px buffer

        if (distance < minDistance) {
          hasOverlap = true;
          break;
        }
      }
      if (!hasOverlap) break;
      x = minX + Math.random() * (maxX - minX);
      y = minY + Math.random() * (maxY - minY);
    }

    const nextTarget = {
      id: targetIdRef.current++,
      x,
      y,
      size,
    };

    return nextTarget;
  }, [boardSize]);

  // Maintain exactly MAX_SIMULTANEOUS_TARGETS targets at all times
  useEffect(() => {
    if (phase !== 'running' || !boardSize) return;

    const currentCount = targets.length;
    if (currentCount < MAX_SIMULTANEOUS_TARGETS) {
      const newTargets = [...targets];
      for (let i = currentCount; i < MAX_SIMULTANEOUS_TARGETS; i++) {
        // Pass newTargets so each spawn knows about previously spawned targets in this loop
        const newTarget = spawnTarget(newTargets);
        if (newTarget) {
          newTargets.push(newTarget);
        }
      }
      existingTargetsRef.current = newTargets;
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setTargets(newTargets), 0);
    }
  }, [boardSize, phase, spawnTarget, targets]);

  const resetRun = () => {
    setPhase('idle');
    setHits(0);
    setMisses(0);
    setTargets([]);
    setTargetFeedback(new Map());
    setTimeLeftMs(ROUND_DURATION_MS);
    setSubmitState('idle');
    setSubmitting(false);
    setIsNewHighScore(false);
    startTimeRef.current = null;
    hitsRef.current = 0;
    missesRef.current = 0;
    targetIdRef.current = 0;
    existingTargetsRef.current = [];
    finishingRef.current = false;
    feedbackTimeoutsRef.current.forEach((timeout) => {
      window.clearTimeout(timeout);
    });
    feedbackTimeoutsRef.current.clear();
  };

  const startRun = () => {
    setPhase('running');
    setHits(0);
    setMisses(0);
    setTargets([]);
    setTargetFeedback(new Map());
    setTimeLeftMs(ROUND_DURATION_MS);
    setSubmitState('idle');
    setSubmitting(false);
    startTimeRef.current = null;
    hitsRef.current = 0;
    missesRef.current = 0;
    targetIdRef.current = 0;
    existingTargetsRef.current = [];
    finishingRef.current = false;
    feedbackTimeoutsRef.current.forEach((timeout) => {
      window.clearTimeout(timeout);
    });
    feedbackTimeoutsRef.current.clear();
  };

  const registerMiss = () => {
    if (phase !== 'running') return;
    missesRef.current += 1;
    setMisses(missesRef.current);
  };

  const handleHit = (event: PointerEvent<HTMLButtonElement>, targetId: number) => {
    event.stopPropagation();
    if (phase !== 'running') return;
    if (startTimeRef.current === null) {
      startTimeRef.current = performance.now();
    }

    // Increment hits
    const nextHits = hitsRef.current + 1;
    hitsRef.current = nextHits;
    setHits(nextHits);

    // Set feedback for this target
    setTargetFeedback((prev) => {
      const newMap = new Map(prev);
      newMap.set(targetId, 'hit');
      return newMap;
    });

    // Clear feedback after animation
    const timeout = window.setTimeout(() => {
      setTargetFeedback((prev) => {
        const newMap = new Map(prev);
        newMap.delete(targetId);
        return newMap;
      });
    }, 120);
    feedbackTimeoutsRef.current.set(targetId, timeout);

    if (finishingRef.current) return;

    // Remove the hit target and spawn a new one
    setTargets((prev) => {
      const filtered = prev.filter((t) => t.id !== targetId);
      // Pass the filtered array to ensure no overlap with remaining targets
      const newTarget = spawnTarget(filtered);
      const updated = newTarget ? [...filtered, newTarget] : filtered;
      existingTargetsRef.current = updated;
      return updated;
    });
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
    targets,
    targetFeedback,
    timeLeftMs,
    bestScore,
    calculatedScore,
    accuracy,
    submitting,
    submitState,
    submissionError,
    isNewHighScore,
    canStart,
    phaseLabel,
    boardRef,
    handleBoardPointerDown,
    handleHit,
    resetRun,
    startRun,
  };
}
