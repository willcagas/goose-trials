'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { GameMetadata } from '@/lib/games/registry';

interface GameHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameMetadata: GameMetadata;
}

/**
 * GameHelpModal - Accessible help modal for game rules and controls
 * 
 * Features:
 * - Focus trap when open
 * - ESC key closes modal
 * - Click outside to close
 * - ARIA labels for accessibility
 */
export default function GameHelpModal({ isOpen, onClose, gameMetadata }: GameHelpModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Focus the close button when modal opens
    const timeout = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 100);

    // Trap focus within modal
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTab);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('keydown', handleTab);
    };
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Close if clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      aria-modal="true"
      aria-labelledby="help-modal-title"
      role="dialog"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-[#0a0a0a] border border-white/20 rounded-2xl p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
          aria-label="Close help modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="pr-10 mb-6">
          <h2 id="help-modal-title" className="text-2xl md:text-3xl font-bold text-white mb-2">
            {gameMetadata.title}
          </h2>
          <p className="text-white/60 text-sm md:text-base">{gameMetadata.description}</p>
        </div>

        {/* How to Play */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="text-amber-400">How to Play</span>
          </h3>
          <ol className="space-y-2">
            {gameMetadata.howToPlay.map((step, index) => (
              <li key={index} className="flex gap-3 text-white/80 text-sm md:text-base">
                <span className="text-amber-400 font-bold shrink-0">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Scoring */}
        <section className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="text-amber-400">Scoring</span>
          </h3>
          <p className="text-white/80 text-sm md:text-base">{gameMetadata.scoring}</p>
        </section>

        {/* Controls */}
        <section>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="text-amber-400">Controls</span>
          </h3>
          
          {/* Keyboard Controls */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-white/90 mb-2 uppercase tracking-wide">
              Keyboard
            </h4>
            <ul className="space-y-1.5">
              {gameMetadata.controls.keyboard.map((control, index) => (
                <li key={index} className="flex items-start gap-2 text-white/70 text-sm">
                  <span className="text-amber-400/60 shrink-0">•</span>
                  <span>{control}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mobile Controls */}
          <div>
            <h4 className="text-sm font-medium text-white/90 mb-2 uppercase tracking-wide">
              Mobile
            </h4>
            <ul className="space-y-1.5">
              {gameMetadata.controls.mobile.map((control, index) => (
                <li key={index} className="flex items-start gap-2 text-white/70 text-sm">
                  <span className="text-amber-400/60 shrink-0">•</span>
                  <span>{control}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

