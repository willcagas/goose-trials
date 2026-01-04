'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import GameHelpModal from './GameHelpModal';
import { GameMetadata } from '@/lib/games/registry';
import { cn } from '@/lib/utils';

export type GameShellState = 'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'FINISHED';

export interface GameResult {
  score: number | string;
  scoreLabel?: string; // e.g., "ms", "digits", "level"
  personalBest?: number | string;
  personalBestLabel?: string;
  message?: string; // Optional message to show with result
}

export interface GameShellProps {
  // Game metadata
  gameMetadata: GameMetadata;
  
  // Game state
  gameState: GameShellState;
  
  // Callbacks
  onStart: () => void;
  onRestart: () => void;
  onQuit: () => void; // Returns to IDLE state
  
  // Render functions
  renderGame: () => ReactNode; // Main game UI (PLAYING state)
  renderReady?: () => ReactNode; // Custom ready/IDLE UI (optional, defaults to standard)
  renderResult?: (result: GameResult) => ReactNode; // Custom result UI (optional, defaults to standard)
  
  // Result data (for FINISHED state)
  result?: GameResult;
  
  // Status text shown in footer
  statusText?: string; // e.g., "Press Space to start", "Level 5", etc.
  
  // Optional props
  showBackButton?: boolean; // Show "Back to games" button (default: true)
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'; // Max width of game area (default: '2xl')
  className?: string; // Additional classes for the shell container
  gameClassName?: string; // Additional classes for the game panel area
  
  // Allow games to disable global keybinds if needed
  disableKeybinds?: boolean;
}

/**
 * GameShell - Standardized shell component for all games
 * 
 * Provides:
 * - Consistent header with title, help button, back button
 * - Standardized game panel area
 * - Consistent footer with controls hint and status
 * - Result card for finished state
 * - Global keybinds (Space, R, Esc)
 * - Help modal integration
 */
export default function GameShell({
  gameMetadata,
  gameState,
  onStart,
  onRestart,
  onQuit,
  renderGame,
  renderReady,
  renderResult,
  result,
  statusText,
  showBackButton = true,
  maxWidth = '2xl',
  className,
  gameClassName,
  disableKeybinds = false,
}: GameShellProps) {
  const [showHelp, setShowHelp] = useState(false);
  const gamePanelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pathname === '/') {
      const trialsSection = document.getElementById('trials');
      if (trialsSection) {
        trialsSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      router.push('/');
      setTimeout(() => {
        const trialsSection = document.getElementById('trials');
        if (trialsSection) {
          trialsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  // Global keybinds
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Esc: Always available (quit to IDLE or close help)
      if (e.key === 'Escape' && !e.repeat) {
        e.preventDefault();
        if (showHelp) {
          setShowHelp(false);
        } else if (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'FINISHED') {
          onQuit();
        }
        return; // ESC always works, even if other keybinds are disabled
      }

      // If keybinds are disabled, don't handle other keys
      if (disableKeybinds) return;

      // Space: Start (from IDLE) or Restart (from FINISHED)
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        if (gameState === 'IDLE') {
          onStart();
        } else if (gameState === 'FINISHED') {
          onRestart();
        }
      }

      // R: Restart (always available except during countdown)
      if ((e.key === 'r' || e.key === 'R') && !e.repeat) {
        if (gameState !== 'COUNTDOWN') {
          e.preventDefault();
          onRestart();
        }
      }

      // ?: Toggle help
      if (e.key === '?' && !e.shiftKey && !e.repeat) {
        e.preventDefault();
        setShowHelp(!showHelp);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, onStart, onRestart, onQuit, showHelp, disableKeybinds]);

  // Default ready view
  const defaultReadyView = () => (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] mb-3">
          {gameMetadata.title}
        </h2>
        <p className="text-[#0a0a0a]/70 text-lg">{gameMetadata.description}</p>
      </div>
      <button
        onClick={onStart}
        className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-black font-bold text-lg rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-white"
      >
        Press Space / Tap Start
      </button>
    </div>
  );

  // Default result view
  const defaultResultView = (result: GameResult) => (
    <div className="text-center space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#0a0a0a] mb-2">Run Complete</h2>
        <div className="text-5xl md:text-6xl font-bold text-amber-400 mb-2">
          {result.score}
          {result.scoreLabel && (
            <span className="text-2xl md:text-3xl text-[#0a0a0a]/60 ml-2">
              {result.scoreLabel}
            </span>
          )}
        </div>
        {result.personalBest !== undefined && (
          <p className="text-[#0a0a0a]/60 text-sm md:text-base">
            Personal Best: {result.personalBest}
            {result.personalBestLabel && ` ${result.personalBestLabel}`}
          </p>
        )}
        {result.message && (
          <p className="text-[#0a0a0a]/70 text-base mt-2">{result.message}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onRestart}
          className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-white"
        >
          Play Again
        </button>
        <Link
          href={`/leaderboard/${gameMetadata.slug}`}
          className="px-6 py-3 bg-[#0a0a0a]/10 hover:bg-[#0a0a0a]/20 text-[#0a0a0a] font-semibold rounded-xl transition-colors border border-[#0a0a0a]/20 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-white"
        >
          View Leaderboard
        </Link>
      </div>
    </div>
  );

  // Determine what to render in the game panel
  const renderGamePanel = () => {
    if (gameState === 'IDLE') {
      return renderReady ? renderReady() : defaultReadyView();
    }
    
    if (gameState === 'FINISHED' && result) {
      return renderResult ? renderResult(result) : defaultResultView(result);
    }
    
    // COUNTDOWN, PLAYING, PAUSED
    return renderGame();
  };

  // Get status text for footer
  const getStatusText = () => {
    if (statusText) return statusText;
    
    switch (gameState) {
      case 'IDLE':
        return 'Press Space to start';
      case 'COUNTDOWN':
        return 'Get ready...';
      case 'PLAYING':
        return 'Playing';
      case 'PAUSED':
        return 'Paused';
      case 'FINISHED':
        return 'Run complete';
      default:
        return '';
    }
  };

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  };

  return (
    <div className={cn('min-h-screen bg-[#0a0a0a] text-white relative', className)}>
      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-[#1a1a1a]">
        <div className={cn('mx-auto px-4 md:px-6 py-4', maxWidthClasses[maxWidth])}>
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back button */}
            <div className="flex items-center gap-4">
              {showBackButton && (
                <Link
                  href="/"
                  onClick={handleBackClick}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg transition-colors border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
                >
                  ← Back
                </Link>
              )}
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">
                  {gameMetadata.title}
                </h1>
                <p className="text-xs md:text-sm text-white/60 hidden sm:block">
                  {gameMetadata.description}
                </p>
              </div>
            </div>

            {/* Right: Help button */}
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
              aria-label="Show help"
            >
              <HelpCircle className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Game Panel */}
      <main
        ref={gamePanelRef}
        className={cn(
          'flex-1 flex items-center justify-center px-4 md:px-6 py-8 md:py-12 min-h-[calc(100vh-8rem)] bg-[#fafafa]',
          gameClassName
        )}
      >
        <div className={cn('w-full', maxWidthClasses[maxWidth])}>
          {renderGamePanel()}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#1a1a1a]">
        <div className={cn('mx-auto px-4 md:px-6 py-3', maxWidthClasses[maxWidth])}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs md:text-sm text-white/60">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span>Space: start</span>
              <span>•</span>
              <span>R: restart</span>
              <span>•</span>
              <span>Esc: exit</span>
              <span>•</span>
              <span>?: help</span>
            </div>
            <div className="text-white/80 font-medium">
              {getStatusText()}
            </div>
          </div>
        </div>
      </footer>

      {/* Help Modal */}
      <GameHelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        gameMetadata={gameMetadata}
      />
    </div>
  );
}
