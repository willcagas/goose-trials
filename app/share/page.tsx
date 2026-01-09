'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { GAMES_REGISTRY, GameSlug } from '@/lib/games/registry';
import { formatLeaderboardDate } from '@/utils/format';

function ShareContent() {
  const searchParams = useSearchParams();
  
  // Get params from URL
  const game = searchParams.get('game') as GameSlug | null;
  const score = searchParams.get('score');
  const scoreLabel = searchParams.get('label') || '';
  const username = searchParams.get('user');
  const timestamp = searchParams.get('ts');
  
  // Validate game exists
  const gameMetadata = game ? GAMES_REGISTRY[game] : null;
  
  if (!game || !score || !gameMetadata) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Invalid share link</h1>
            <p className="text-white/60 mb-6">This result link is broken or expired.</p>
            <Link 
              href="/"
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl transition-colors"
            >
              Play Goose Trials
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Format timestamp if provided (using timezone-aware formatting)
  const formattedDate = timestamp 
    ? formatLeaderboardDate(new Date(parseInt(timestamp)).toISOString())
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />
      
      <main className="max-w-lg mx-auto px-4 py-12">
        {/* Result Card */}
        <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl mb-8">
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
              {formattedDate && (
                <div className="text-xs text-white/40">
                  {formattedDate}
                </div>
              )}
            </div>
          </div>

          {/* Score Section */}
          <div className="px-6 py-10 text-center">
            {/* Challenge text */}
            {username && (
              <p className="text-white/60 text-sm mb-2">
                <span className="text-amber-400 font-semibold">{username}</span> scored
              </p>
            )}
            
            {/* Main Score */}
            <div className="mb-6">
              <div className="text-7xl md:text-8xl font-bold text-amber-400 mb-2">
                {score}
                {scoreLabel && (
                  <span className="text-3xl md:text-4xl text-white/50 ml-2">
                    {scoreLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Challenge message */}
            <p className="text-white/70 text-lg mb-2">
              Think you can beat {username ? 'them' : 'this'}?
            </p>
            <p className="text-white/40 text-sm">
              {gameMetadata.description}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Primary CTA - Play the game */}
          <Link
            href={`/games/${game}`}
            className="block w-full px-6 py-4 bg-amber-400 hover:bg-amber-300 text-black font-bold text-lg rounded-xl transition-colors text-center"
          >
            Beat This Score
          </Link>

          {/* Secondary actions */}
          <div className="flex gap-3">
            <Link
              href={`/leaderboard/${game}?returnTo=${encodeURIComponent(`/games/${game}`)}`}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors border border-white/20 text-center"
            >
              View Leaderboard
            </Link>
            <Link
              href="/"
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold rounded-xl transition-colors border border-white/10 text-center"
            >
              All Games
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-white/30 text-xs">
            goosetrials.com • Test your brain against your campus
          </p>
        </div>
      </main>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}

