'use client';

import { useState } from 'react';
import { useSession } from '@/app/providers/SessionContext';
import Navbar from '@/components/Navbar';
import ProfileCard, { type ProfileData } from '@/components/ProfileCard';
import LoginModal from '@/components/LoginModal';
import Link from 'next/link';
import type { UserHighlight } from '@/lib/db/user-highlights';

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

