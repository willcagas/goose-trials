'use client';
import { useState, useEffect } from 'react';
import { useSession } from '@/app/providers/SessionContext';
import { useMe } from '@/app/providers/MeContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ShareProfileButton from '@/components/ShareProfileButton';
import AvatarSelectorModal from '@/components/AvatarSelectorModal';
import Image from 'next/image';

interface UniversityInfo {
  id: string;
  name: string;
  country: string | null;
  alpha_two_code: string | null;
}

async function fetchUniversityInfo(universityId: string): Promise<UniversityInfo | null> {
  const response = await fetch(`/api/universities?id=${universityId}`);
  
  if (!response.ok) {
    return null;
  }

  const { data } = await response.json();
  return data || null;
}

export default function ProfilePage() {
  const { user, loading: sessionLoading } = useSession();
  const { me, loading: meLoading } = useMe();
  const router = useRouter();

  const [universityInfo, setUniversityInfo] = useState<UniversityInfo | null>(null);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/');
    }
  }, [user, sessionLoading, router]);

  // Fetch university info when user has universityId
  useEffect(() => {
    async function loadUniversityInfo() {
      if (me?.universityId) {
        const info = await fetchUniversityInfo(me.universityId);
        setUniversityInfo(info);
      } else {
        setUniversityInfo(null);
      }
    }
    if (!meLoading) {
      loadUniversityInfo();
    }
  }, [me?.universityId, meLoading]);

  // Set avatar URL from me context
  useEffect(() => {
    if (me?.avatarUrl) {
      setCurrentAvatarUrl(me.avatarUrl);
    }
  }, [me?.avatarUrl]);

  // Handle avatar update
  const handleAvatarSelected = (newAvatarUrl: string) => {
    setCurrentAvatarUrl(newAvatarUrl);
    // Reload page to refresh me context
    window.location.reload();
  };

  if (sessionLoading || meLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <Navbar />
      
      <main className="flex-1 px-4 md:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white uppercase tracking-wide">
              Profile
            </h1>
            <p className="text-white/60 mt-2">
              Your account information
            </p>
          </div>

          {/* Profile Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
            {/* Avatar Section */}
            <div>
              <label className="block text-white/60 text-sm uppercase tracking-wide mb-3">
                Avatar
              </label>
              <div className="flex items-center gap-4">
                {/* Avatar Display */}
                <div className="w-20 h-20 rounded-full bg-amber-400/20 border-2 border-amber-400/40 flex items-center justify-center overflow-hidden">
                  {currentAvatarUrl ? (
                    <Image
                      src={currentAvatarUrl}
                      alt="Your avatar"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl text-amber-400 font-bold">
                      {me?.username ? me.username[0].toUpperCase() : '?'}
                    </span>
                  )}
                </div>

                {/* Change Avatar Button */}
                <button
                  onClick={() => setShowAvatarSelector(true)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm rounded-lg transition-colors"
                >
                  Change Avatar
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10" />

            {/* Username Section */}
            <div>
              <label className="block text-white/60 text-sm uppercase tracking-wide mb-2">
                Username
              </label>
              <span className="text-white text-lg font-mono">
                {me?.username || <span className="text-white/40 italic">Not set</span>}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10" />

            {/* Email Section */}
            <div>
              <label className="block text-white/60 text-sm uppercase tracking-wide mb-2">
                Email
              </label>
              <div className="flex items-center justify-between">
                <span className="text-white text-lg">
                  {user.email}
                </span>
                <span className="text-white/40 text-xs uppercase tracking-wide">
                  Verified
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10" />

            {/* University Section */}
            <div>
              <label className="block text-white/60 text-sm uppercase tracking-wide mb-2">
                University
              </label>
              <span className="text-white text-lg">
                {universityInfo ? (
                  <>
                    {universityInfo.name}
                    {universityInfo.country && (
                      <span className="text-white/50 ml-2 text-base">• {universityInfo.country}</span>
                    )}
                  </>
                ) : me?.universityId ? (
                  <span className="text-white/40 italic">Loading...</span>
                ) : (
                  <span className="text-white/40 italic">No university detected</span>
                )}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <ShareProfileButton variant="outline" size="lg" />
            {me?.username && (
              <Link
                href={`/u/${me.username}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-400 text-gray-900 font-bold tracking-wide rounded-xl hover:bg-amber-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Public Profile
              </Link>
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

      {/* Avatar Selector Modal */}
      <AvatarSelectorModal
        isOpen={showAvatarSelector}
        onClose={() => setShowAvatarSelector(false)}
        currentAvatarUrl={currentAvatarUrl}
        onAvatarSelected={handleAvatarSelected}
      />
    </div>
  );
}
