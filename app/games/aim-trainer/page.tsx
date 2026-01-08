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
        targets,
        targetFeedback,
        timeLeftMs,
        bestScore,
        calculatedScore,
        accuracy,
        submitting,
        submitState,
        isNewHighScore,
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
        score: calculatedScore,
        scoreLabel: 'score',
        personalBest: bestScore ?? undefined,
        personalBestLabel: 'score',
        message: `Hits: ${hits} · Accuracy: ${accuracy}% · Misses: ${misses}`,
    } : undefined;

    const overlay = (
        <div className="rounded-3xl bg-white/95 backdrop-blur-xl px-8 py-6 shadow-2xl border-2 border-gray-200 text-center max-w-[85%]">
            {phase === 'complete' ? (
                <>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 mb-4 shadow-lg">
                        <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-sm font-bold uppercase tracking-[0.25em] text-gray-600 mb-2">
                        Run Complete
                    </p>
                    <p className="mt-2 text-5xl font-black text-yellow-500 tabular-nums">
                        {calculatedScore}
                    </p>
                    <p className="text-sm font-semibold text-gray-500 mt-1">Final Score</p>
                    <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                        <div className="flex flex-col">
                            <span className="font-bold text-emerald-600 text-lg">{hits}</span>
                            <span className="text-xs text-gray-500">Hits</span>
                        </div>
                        <div className="h-8 w-px bg-gray-300"></div>
                        <div className="flex flex-col">
                            <span className="font-bold text-blue-600 text-lg">{accuracy}%</span>
                            <span className="text-xs text-gray-500">Accuracy</span>
                        </div>
                        <div className="h-8 w-px bg-gray-300"></div>
                        <div className="flex flex-col">
                            <span className="font-bold text-rose-600 text-lg">{misses}</span>
                            <span className="text-xs text-gray-500">Misses</span>
                        </div>
                    </div>
                    <p className="mt-4 text-xs font-medium text-gray-400">
                        {submitting && '⏳ Saving score...'}
                        {!submitting && submitState === 'success' && '✓ Score saved!'}
                        {!submitting && submitState === 'error' && '✗ Score save failed'}
                    </p>
                </>
            ) : (
                <>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 mb-4 shadow-lg">
                        <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <p className="text-sm font-bold uppercase tracking-[0.25em] text-gray-600 mb-3">
                        Ready to Start
                    </p>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">
                        Hit as many targets as you can before time runs out.
                    </p>
                    <div className="mt-3 px-4 py-2 rounded-lg bg-yellow-50 border border-yellow-200">
                        <p className="text-xs font-semibold text-gray-700">
                            Score = Hits × Accuracy
                        </p>
                    </div>
                </>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {phase === 'idle' && (
                    <button
                        onClick={startRun}
                        className="px-8 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-bold shadow-xl shadow-yellow-400/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Start Run
                    </button>
                )}
                {phase === 'complete' && (
                    <>
                        <button
                            onClick={startRun}
                            className="px-8 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-bold shadow-xl shadow-yellow-400/30 transition-all transform hover:scale-105 active:scale-95"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={resetRun}
                            className="px-8 py-3 rounded-xl bg-white text-gray-700 text-sm font-bold shadow-lg border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all transform hover:scale-105 active:scale-95"
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
            <div className="bg-gray-50 border-2 border-gray-200 shadow-2xl rounded-2xl overflow-hidden">
                {/* Stats Header */}
                <div className="bg-gray-800 px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Hits</span>
                                <span className="text-2xl font-bold text-white tabular-nums">{hits}</span>
                            </div>
                            <div className="h-12 w-px bg-gray-600"></div>
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Accuracy</span>
                                <span className="text-2xl font-bold text-white tabular-nums">{accuracy}%</span>
                            </div>
                            <div className="h-12 w-px bg-gray-600"></div>
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Score</span>
                                <span className="text-2xl font-bold text-yellow-400 tabular-nums">{calculatedScore}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Time</span>
                            <span className="text-3xl font-bold text-yellow-400 tabular-nums" aria-live="polite">
                                {formatMs(timeLeftMs)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Game Board */}
                <div className="flex justify-center px-4 py-6">
                    <AimTrainerBoard
                        phase={phase}
                        targets={targets}
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
                    Best: <span className="font-bold">{bestScore ?? '--'}</span>
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
            scoreLabel="score"
            personalBest={bestScore ?? undefined}
            personalBestLabel="score"
            message={`Hits: ${hits} · Accuracy: ${accuracy}% · Misses: ${misses}`}
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
            showRestart={true}
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
