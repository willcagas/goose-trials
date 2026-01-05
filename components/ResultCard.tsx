'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useMe } from '@/app/providers/MeContext';
import LoginModal from './LoginModal';
import { GameMetadata } from '@/lib/games/registry';
import { toPng } from 'html-to-image';

interface TopScore {
  score_value: number;
  created_at: string;
}

export interface ResultCardProps {
  // Game info
  gameMetadata: GameMetadata;
  
  // Score data
  score: number | string;
  scoreLabel?: string;
  personalBest?: number | string;
  personalBestLabel?: string;
  personalAverage?: number | null;
  personalAverageLabel?: string;
  message?: string;
  
  // Top 5 scores for sidebar display
  topScores?: (TopScore | null)[];
  loadingScores?: boolean;
  
  // High score celebration
  isNewHighScore?: boolean;
  
  // User context (optional - will use MeContext if not provided)
  username?: string | null;
  universityName?: string | null;
  countryCode?: string | null;
  
  // Timestamp
  timestamp?: Date;
  
  // Callbacks
  onPlayAgain: () => void;
  
  // Optional: show submitting state
  isSubmitting?: boolean;
}

// Country code to flag emoji
function countryCodeToFlag(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Check if device supports native sharing (text/url)
function canNativeShare(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !!navigator.share;
}

// Check if device supports native file sharing (typically mobile)
function canShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.share || !navigator.canShare) return false;
  
  try {
    return navigator.canShare({ 
      files: [new File([''], 'test.png', { type: 'image/png' })] 
    });
  } catch {
    return false;
  }
}

export default function ResultCard({
  gameMetadata,
  score,
  scoreLabel,
  personalBest,
  personalBestLabel,
  personalAverage,
  personalAverageLabel,
  message,
  topScores,
  loadingScores = false,
  isNewHighScore = false,
  username: propUsername,
  universityName,
  countryCode,
  timestamp,
  onPlayAgain,
  isSubmitting = false,
}: ResultCardProps) {
  const { me } = useMe();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showHighScoreAnimation, setShowHighScoreAnimation] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play high score sound and trigger animation
  useEffect(() => {
    if (isNewHighScore && !isSubmitting) {
      setShowHighScoreAnimation(true);
      
      // Play the celebration sound
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/high-score.mp3');
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.log('Audio play failed:', err);
      });
    }
  }, [isNewHighScore, isSubmitting]);

  // Use prop username if provided, otherwise fall back to context
  const username = propUsername ?? me?.username;
  const isLoggedIn = me?.isLoggedIn ?? false;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    
    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showShareMenu]);

  // Generate shareable URL - points to a public result page
  const getShareUrl = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
      game: gameMetadata.slug,
      score: String(score),
    });
    
    if (scoreLabel) {
      params.set('label', scoreLabel);
    }
    if (username) {
      params.set('user', username);
    }
    if (timestamp) {
      params.set('ts', String(timestamp.getTime()));
    }
    
    return `${baseUrl}/share?${params.toString()}`;
  };

  const getShareText = () => {
    return username 
      ? `I scored ${score}${scoreLabel ? ` ${scoreLabel}` : ''} on ${gameMetadata.title}! Can you beat me?`
      : `I scored ${score}${scoreLabel ? ` ${scoreLabel}` : ''} on ${gameMetadata.title}!`;
  };

  // Generate image from card
  const generateImage = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;

    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a',
        skipFonts: true,
        cacheBust: true,
        filter: (node) => {
          if (node instanceof Element) {
            const tagName = node.tagName?.toLowerCase();
            if (tagName === 'link' || tagName === 'style') {
              return false;
            }
          }
          return true;
        },
      });

      const response = await fetch(dataUrl);
      return await response.blob();
    } catch (error) {
      console.error('Failed to generate image:', error);
      return null;
    }
  };

  // Show temporary feedback
  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      showFeedback('Link copied!');
      setShowShareMenu(false);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Native share (link only)
  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: `${gameMetadata.title} - Goose Trials`,
        text: getShareText(),
        url: getShareUrl(),
      });
      setShowShareMenu(false);
    } catch (err) {
      // User cancelled - that's okay
      console.log('Share cancelled:', err);
    }
  };

  // Share with image (mobile) or download image (desktop)
  const handleShareImage = async () => {
    setIsGenerating(true);
    
    try {
      const imageBlob = await generateImage();
      
      if (!imageBlob) {
        showFeedback('Failed to generate image');
        return;
      }

      // On mobile with file sharing support, use native share
      if (canShareFiles()) {
        const file = new File(
          [imageBlob], 
          `goose-trials-${gameMetadata.slug}-${score}.png`, 
          { type: 'image/png' }
        );

        try {
          await navigator.share({
            title: `${gameMetadata.title} - Goose Trials`,
            text: getShareText(),
            url: getShareUrl(),
            files: [file],
          });
          setShowShareMenu(false);
          return;
        } catch (err) {
          console.log('File share cancelled:', err);
        }
      } else {
        // Desktop: download the image
        const url = URL.createObjectURL(imageBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `goose-trials-${gameMetadata.slug}-${score}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showFeedback('Image downloaded!');
        setShowShareMenu(false);
      }
    } catch (error) {
      console.error('Share image failed:', error);
      showFeedback('Failed to share image');
    } finally {
      setIsGenerating(false);
    }
  };

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const flag = countryCodeToFlag(countryCode ?? null);
  const supportsNativeShare = canNativeShare();
  const supportsFileShare = canShareFiles();

  return (
    <>
      <div className="w-full max-w-md mx-auto">
        {/* Card Container - this is the part we'll capture as image */}
        <div 
          ref={cardRef}
          className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Header with branding */}
          <div className="bg-gradient-to-r from-amber-400/20 to-amber-600/10 px-6 py-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="/goosetrialspfp-removebg-preview.png" 
                  alt="Goose Trials"
                  className="w-8 h-8 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider">Goose Trials</div>
                  <div className="text-lg font-bold text-white">{gameMetadata.title}</div>
                </div>
              </div>
              {timestamp && (
                <div className="text-xs text-white/40">
                  {formatTimestamp(timestamp)}
                </div>
              )}
            </div>
          </div>

          {/* Score Section */}
          <div className="px-6 py-8 text-center">
            {/* New High Score Badge */}
            {showHighScoreAnimation && (
              <div className="mb-4 animate-bounce">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 rounded-full shadow-lg shadow-amber-500/30 animate-pulse">
                  <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-black font-bold text-sm uppercase tracking-wide">New High Score!</span>
                  <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
              </div>
            )}

            {/* Main Score */}
            <div className="mb-4">
              <div className={`text-6xl md:text-7xl font-bold mb-1 ${showHighScoreAnimation ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 animate-pulse' : 'text-amber-400'}`}>
                {score}
                {scoreLabel && (
                  <span className={`text-2xl md:text-3xl ml-2 ${showHighScoreAnimation ? 'text-amber-300/70' : 'text-white'}`}>
                    {scoreLabel}
                  </span>
                )}
              </div>
              
              {/* Submission status */}
              {isSubmitting ? (
                <p className="text-white/50 text-sm mt-2">Saving score...</p>
              ) : (
                <p className="text-green-500 text-sm mt-2">✓ Score saved!</p>
              )}
            </div>

            {/* Personal Best & Average */}
            {(personalBest !== undefined || personalAverage !== undefined) && (
              <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
                {personalBest !== undefined && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                    <span className="text-white/60 text-sm">Personal Best:</span>
                    <span className="text-amber-400 font-bold">
                      {personalBest}
                      {personalBestLabel && ` ${personalBestLabel}`}
                    </span>
                  </div>
                )}
                {personalAverage !== undefined && personalAverage !== null && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400/10 border border-amber-400/30 rounded-full">
                    <span className="text-white/60 text-sm">Personal Avg:</span>
                    <span className="text-amber-400 font-bold">
                      {Math.round(personalAverage)}
                      {personalAverageLabel && ` ${personalAverageLabel}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Message */}
            {message && (
              <p className="text-white/50 text-sm mb-4">{message}</p>
            )}

            {/* User Info */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {/* Username badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <span className="text-white/80 text-sm font-medium">
                  {username || 'Guest'}
                </span>
              </div>

              {/* School badge */}
              {universityName && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-400/10 border border-amber-400/30 rounded-full">
                  {flag && <span className="text-base">{flag}</span>}
                  <span className="text-amber-400/90 text-sm font-medium truncate max-w-[150px]">
                    {universityName}
                  </span>
                </div>
              )}
            </div>

            {/* Top 5 Scores */}
            {topScores && topScores.length > 0 && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Your Top 5 Scores</div>
                <div className="space-y-1.5">
                  {loadingScores ? (
                    <div className="flex items-center justify-center py-4">
                      <svg className="w-5 h-5 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : (
                    topScores.map((scoreItem, index) => (
                      <div 
                        key={index}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                          index === 0 ? 'bg-amber-400/10 border border-amber-400/30' : 'bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${index === 0 ? 'text-amber-400' : 'text-white/40'}`}>
                            #{index + 1}
                          </span>
                          {scoreItem ? (
                            <span className={`font-medium ${index === 0 ? 'text-amber-400' : 'text-white/80'}`}>
                              {scoreItem.score_value}
                              {scoreLabel && <span className="text-white/50 ml-1">{scoreLabel}</span>}
                            </span>
                          ) : (
                            <span className="text-white/30">--</span>
                          )}
                        </div>
                        {scoreItem && (
                          <span className="text-white/30 text-xs">
                            {new Date(scoreItem.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Shareable footer - visible in image */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-white/40 text-xs">goosetrials.com</p>
            </div>
          </div>
        </div>

        {/* Actions Section - outside the captured card */}
        <div className="mt-6 space-y-3">
          {/* Primary Actions Row */}
          <div className="flex gap-3">
            {/* Play Again */}
            <button
              onClick={onPlayAgain}
              className="flex-1 px-5 py-3.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black font-bold rounded-xl transition-all shadow-lg shadow-amber-400/20 hover:shadow-amber-400/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              Play Again
            </button>

            {/* Share Button with Dropdown */}
            <div className="relative flex-1" ref={menuRef}>
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                disabled={isGenerating}
                className="w-full px-5 py-3.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black font-bold rounded-xl transition-all shadow-lg shadow-amber-400/20 hover:shadow-amber-400/30 flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isGenerating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Loading...</span>
                  </>
                ) : feedback ? (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-400">{feedback}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <span>Share</span>
                    <svg className={`w-3 h-3 transition-transform ${showShareMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>

              {/* Dropdown Menu */}
              {showShareMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1a] border border-white/20 rounded-xl overflow-hidden shadow-xl z-50">
                  {/* Link option */}
                  <button
                    onClick={supportsNativeShare ? handleNativeShare : handleCopyLink}
                    className="w-full px-4 py-3 text-left text-white hover:bg-white/10 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="text-sm font-medium">Link</span>
                  </button>

                  {/* Image option */}
                  <button
                    onClick={handleShareImage}
                    disabled={isGenerating}
                    className="w-full px-4 py-3 text-left text-white hover:bg-white/10 flex items-center gap-3 transition-colors border-t border-white/10 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium">Image</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Leaderboard / Sign In CTA */}
          {isLoggedIn ? (
            <Link
              href={`/leaderboard/${gameMetadata.slug}`}
              className="block w-full px-5 py-3.5 bg-[#2a2a2a] hover:bg-[#363636] active:bg-[#2a2a2a] text-white font-medium rounded-xl transition-all text-center group hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="inline-flex items-center gap-2">
                View Leaderboard
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full px-5 py-3.5 bg-[#2a2a2a] hover:bg-[#363636] active:bg-[#2a2a2a] text-white font-medium rounded-xl transition-all text-center group hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="inline-flex items-center gap-2">
                Sign in to see your rank
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </>
  );
}
