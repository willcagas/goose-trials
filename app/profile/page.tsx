'use client';
import { useState, useEffect } from 'react';
import { useSession } from '@/app/providers/SessionContext';
import { useMe } from '@/app/providers/MeContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

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
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 md:px-6 lg:px-8 py-8 border-t border-white/10">
        <p className="text-sm text-gray-500 tracking-wide text-center">
          Built by students at the University of Waterloo.
        </p>
      </footer>
    </div>
  );
}
