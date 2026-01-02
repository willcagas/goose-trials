'use client';

import Link from 'next/link';
import AimTrainerBoard from './AimTrainerBoard';
import { ROUND_DURATION_MS } from './constants';
import { useAimTrainer } from './useAimTrainer';

const formatMs = (value: number | null) => {
    if (value === null) return '--';
    return `${(value / 1000).toFixed(2)}s`;
};

export default function AimTrainerGame() {
    const {
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
    } = useAimTrainer();

    const overlay = (
        <div className="rounded-2xl bg-white/90 backdrop-blur px-6 py-5 shadow-lg border border-white/70 text-center max-w-[80%]">
            {phase === 'complete' ? (
                <>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                        Run ended
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900 tabular-nums">
                        {hits} hits
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        Accuracy {accuracy}% · Misses {misses}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        {submitting && 'Saving score...'}
                        {!submitting && submitState === 'success' && 'Score saved.'}
                        {!submitting && submitState === 'error' && 'Score save failed.'}
                    </p>
                </>
            ) : (
                <>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                        Ready
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        Hit as many targets as you can before time runs out.
                    </p>
                </>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                {phase === 'idle' && (
                    <button
                        onClick={startRun}
                        className="px-6 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!canStart}
                    >
                        Start Run
                    </button>
                )}
                {phase === 'complete' && (
                    <>
                        <button
                            onClick={startRun}
                            className="px-6 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={resetRun}
                            className="px-6 py-2 rounded-full bg-white/80 text-slate-700 text-sm font-semibold shadow-sm border border-white/70 hover:bg-white transition"
                        >
                            Reset
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen text-slate-900 relative overflow-hidden">
            <Link
                href="/"
                className="absolute top-6 left-6 px-4 py-2 rounded-full bg-white/80 backdrop-blur border border-white/60 shadow-sm text-sm font-semibold hover:bg-white transition"
            >
                &lt;- Back Home
            </Link>

            <main className="relative z-10 max-w-5xl mx-auto px-6 py-16 flex flex-col items-center gap-10">
                <header className="text-center space-y-4 fade-up">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                        Aim Trainer
                    </div>
                    <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-slate-900">
                        Hit the targets fast.
                    </h1>
                    <p className="text-sm md:text-base text-slate-600 max-w-xl mx-auto">
                        You have {Math.round(ROUND_DURATION_MS / 1000)} seconds to hit as
                        many targets as possible.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 stagger">
                        <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm border border-white/70">
                            Time {formatMs(timeLeftMs)}
                        </div>
                        <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm border border-white/70">
                            Hits {hits}
                        </div>
                        <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm border border-white/70">
                            Accuracy {accuracy}%
                        </div>
                        <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm border border-white/70">
                            Best {bestHits ?? '--'}
                        </div>
                    </div>
                </header>

                <section className="fade-up w-full">
                    <div className="bg-white/80 border border-white/70 shadow-xl p-6">
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                            <span>{phaseLabel}</span>
                            <span>{Math.round(ROUND_DURATION_MS / 1000)}s Round</span>
                        </div>

                        <div className="mt-6 flex justify-center">
                            <AimTrainerBoard
                                phase={phase}
                                target={target}
                                targetFeedback={targetFeedback}
                                boardRef={boardRef}
                                onBoardPointerDown={handleBoardPointerDown}
                                onHit={handleHit}
                                overlay={overlay}
                            />
                        </div>
                    </div>
                </section>
            </main>

            <style jsx>{`
        .fade-up {
          animation: fadeUp 0.6s ease-out both;
        }
        .stagger > * {
          animation: fadeUp 0.6s ease-out both;
        }
        .stagger > *:nth-child(2) {
          animation-delay: 0.08s;
        }
        .stagger > *:nth-child(3) {
          animation-delay: 0.16s;
        }
        .stagger > *:nth-child(4) {
          animation-delay: 0.24s;
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
        </div>
    );
}
