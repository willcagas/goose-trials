'use client';

import AimTrainerBoard from './AimTrainerBoard';
import { ROUND_DURATION_MS } from './constants';
import { useAimTrainer } from './useAimTrainer';
import GameShell, { GameShellState, GameResult } from '@/components/GameShell';
import { getGameMetadata } from '@/lib/games/registry';
import { useMe } from '@/app/providers/MeContext';
import ResultCard from '@/components/ResultCard';

const formatMs = (value: number | null) => {
    if (value === null) return '--';
    return `${(value / 1000).toFixed(2)}s`;
};

export default function AimTrainerGame() {
    const { me } = useMe();
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
        isNewHighScore,
        canStart,
        phaseLabel,
        boardRef,
        handleBoardPointerDown,
        handleHit,
        resetRun,
        startRun,
    } = useAimTrainer(me);

    // Map phase to GameShell state
    const getShellState = (): GameShellState => {
        if (phase === 'idle') return 'IDLE';
        if (phase === 'running') return 'PLAYING';
        if (phase === 'complete') return 'FINISHED';
        return 'IDLE';
    };

    const result: GameResult | undefined = phase === 'complete' ? {
        score: hits,
        scoreLabel: 'hits',
        personalBest: bestHits ?? undefined,
        personalBestLabel: 'hits',
        message: `Accuracy: ${accuracy}% · Misses: ${misses}`,
    } : undefined;

    const overlay = (
        <div className="rounded-2xl bg-white/90 backdrop-blur px-6 py-5 shadow-lg border border-amber-400/30 text-center max-w-[80%]">
            {phase === 'complete' ? (
                <>
                    <p className="text-sm uppercase tracking-[0.2em] text-amber-400/80">
                        Run ended
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-black tabular-nums">
                        {hits} hits
                    </p>
                    <p className="mt-2 text-xs text-amber-400/70">
                        Accuracy {accuracy}% · Misses {misses}
                    </p>
                    <p className="mt-2 text-xs text-amber-400/70">
                        {submitting && 'Saving score...'}
                        {!submitting && submitState === 'success' && 'Score saved.'}
                        {!submitting && submitState === 'error' && 'Score save failed.'}
                    </p>
                </>
            ) : (
                <>
                    <p className="text-sm uppercase tracking-[0.2em] text-amber-400/80">
                        Ready
                    </p>
                    <p className="mt-2 text-xs text-amber-400/70">
                        Hit as many targets as you can before time runs out.
                    </p>
                </>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                {phase === 'idle' && (
                    <button
                        onClick={startRun}
                        className="px-6 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold shadow-lg shadow-amber-400/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Start Run
                    </button>
                )}
                {phase === 'complete' && (
                    <>
                        <button
                            onClick={startRun}
                            className="px-6 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold shadow-lg shadow-amber-400/20 transition"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={resetRun}
                            className="px-6 py-2 rounded-full bg-white/80 text-amber-400/90 text-sm font-semibold shadow-sm border border-amber-400/30 hover:bg-white transition"
                        >
                            Reset
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    const getStatusText = () => {
        if (phase === 'running') {
            return `Time: ${formatMs(timeLeftMs)} · Hits: ${hits} · Accuracy: ${accuracy}%`;
        }
        if (phase === 'complete') {
            return submitting ? 'Saving score...' : (submitState === 'success' ? 'Score saved!' : '');
        }
        return '';
    };

    const renderGame = () => (
        <div className="w-full">
            <div className="bg-[#0a0a0a]/10 border border-[#0a0a0a]/20 shadow-xl p-6 rounded-xl">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-[#0a0a0a]/70 mb-4">
                    <span>{phaseLabel}</span>
                    <span>{Math.round(ROUND_DURATION_MS / 1000)}s Round</span>
                </div>
                <div className="flex justify-center">
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
        </div>
    );

    const renderReady = () => (
        <div className="text-center space-y-6">
            <div>
                <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] mb-3">
                    Aim Trainer
                </h2>
                <p className="text-[#0a0a0a]/70 text-lg">
                    You have {Math.round(ROUND_DURATION_MS / 1000)} seconds to hit as many targets as possible.
                </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                <div className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/25 text-[#0a0a0a]">
                    Best: <span className="font-bold">{bestHits ?? '--'}</span>
                </div>
            </div>
            <button
                onClick={startRun}
                className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-black font-bold text-lg rounded-xl transition-colors"
            >
                Press Space / Tap Start
            </button>
        </div>
    );

    const renderResult = (result: GameResult) => (
        <ResultCard
            gameMetadata={gameMetadata}
            score={result.score}
            scoreLabel="hits"
            personalBest={bestHits ?? undefined}
            personalBestLabel="hits"
            message={`Accuracy: ${accuracy}% · Misses: ${misses}`}
            isNewHighScore={isNewHighScore}
            timestamp={new Date()}
            onPlayAgain={startRun}
            isSubmitting={submitting}
        />
    );

    const gameMetadata = getGameMetadata('aim-trainer');

    return (
        <GameShell
            gameMetadata={gameMetadata}
            gameState={getShellState()}
            onStart={startRun}
            onRestart={startRun}
            onQuit={resetRun}
            renderGame={renderGame}
            renderReady={renderReady}
            renderResult={renderResult}
            result={result}
            statusText={getStatusText()}
      maxWidth="2xl"
    />
    );
}
