'use client';

import { useState } from 'react';
import { useSession } from '@/app/providers/SessionContext';
import Navbar from '@/components/Navbar';
import ProfileCard, { type ProfileData } from '@/components/ProfileCard';
import LoginModal from '@/components/LoginModal';
import PercentileGraph from '@/components/PercentileGraph';
import { GAMES_REGISTRY } from '@/lib/games/registry';
import Link from 'next/link';
import type { UserHighlight } from '@/lib/db/user-highlights';
import { formatMonthYear } from '@/utils/format';

interface UniversityInfo {
  id: string;
  name: string;
  country: string | null;
  alpha_two_code: string | null;
}

interface PublicProfileClientProps {
  profile: ProfileData;
  highlights: UserHighlight[];
  universityInfo: UniversityInfo | null;
}

export default function PublicProfileClient({
  profile,
  highlights,
  universityInfo,
}: PublicProfileClientProps) {
  const { user } = useSession();
  const [showLogin, setShowLogin] = useState(false);
  const [copied, setCopied] = useState(false);

  // Handle share/copy URL
  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.username || 'Player'} on Goose Trials`,
          url,
        });
      } catch (err) {
        // User cancelled or error
        console.log('Share cancelled');
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 md:px-6 lg:px-8 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Profile Card */}
          <ProfileCard
            profile={profile}
            highlights={highlights}
            universityName={universityInfo?.name}
            universityCountryCode={universityInfo?.alpha_two_code}
          />

          {/* Detailed Stats Section */}
          {highlights.length > 0 && (
            <div className="mt-8 space-y-6">
              <h2 className="text-2xl font-bold text-white uppercase tracking-wide">
                Performance Stats
              </h2>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Games Played */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="text-white/60 text-sm uppercase tracking-wide mb-2">
                    Games Played
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {highlights.length}
                  </div>
                </div>

                {/* Best Country Rank */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="text-white/60 text-sm uppercase tracking-wide mb-2">
                    Best Country Rank
                  </div>
                  <div className="text-3xl font-bold text-amber-400">
                    {(() => {
                      const countryRanks = highlights
                        .filter(h => h.country_rank !== null)
                        .map(h => h.country_rank!);
                      if (countryRanks.length === 0) return '—';
                      return `#${Math.min(...countryRanks)}`;
                    })()}
                  </div>
                </div>

                {/* Best University Rank */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="text-white/60 text-sm uppercase tracking-wide mb-2">
                    Best Campus Rank
                  </div>
                  <div className="text-3xl font-bold text-amber-400">
                    {(() => {
                      const uniRanks = highlights
                        .filter(h => h.university_rank !== null)
                        .map(h => h.university_rank!);
                      if (uniRanks.length === 0) return '—';
                      return `#${Math.min(...uniRanks)}`;
                    })()}
                  </div>
                </div>

                {/* Playing Since */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="text-white/60 text-sm uppercase tracking-wide mb-2">
                    Playing Since
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {(() => {
                      const dates = highlights
                        .filter(h => h.achieved_at)
                        .map(h => new Date(h.achieved_at).getTime());
                      if (dates.length === 0) return '—';
                      const earliest = new Date(Math.min(...dates));
                      return formatMonthYear(earliest.toISOString());
                    })()}
                  </div>
                </div>
              </div>

              {/* Performance Graphs */}
              <div className="space-y-6 mt-8">
                <h3 className="text-xl font-bold text-white uppercase tracking-wide">
                  Score Distributions
                </h3>
                {highlights.map((highlight) => {
                  const game = GAMES_REGISTRY[highlight.test_slug];
                  return (
                    <div key={highlight.test_slug} className="bg-white/5 border border-white/10 rounded-xl p-6">
                      <h4 className="text-lg font-bold text-white mb-4">
                        {game?.title || highlight.test_slug}
                      </h4>
                      <PercentileGraph
                        testSlug={highlight.test_slug}
                        userId={profile.id}
                        username={profile.username}
                        unit={game?.unit || null}
                        lowerIsBetter={game?.lowerIsBetter || false}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            {/* Share Button */}
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/5 border border-white/20 text-white font-semibold uppercase tracking-wide rounded-full hover:bg-white/10 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              {copied ? 'Link Copied!' : 'Share Public Profile'}
            </button>

            {/* CTAs based on auth state */}
            {user ? (
              <Link
                href="/#rankings"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-400 text-gray-900 font-bold uppercase tracking-wide rounded-full hover:bg-amber-300 transition-colors"
              >
                View Leaderboards
              </Link>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-400 text-gray-900 font-bold uppercase tracking-wide rounded-full hover:bg-amber-300 transition-colors"
              >
                Sign In to Compete
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 md:px-6 lg:px-8 py-8 border-t border-white/10">
        <p className="text-sm text-gray-500 tracking-wide text-center">
          Built by students at the University of Waterloo.
        </p>
      </footer>

      {/* Login Modal */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}

