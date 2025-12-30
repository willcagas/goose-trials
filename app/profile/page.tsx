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
  const { me, loading: meLoading, refetch } = useMe();
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [universityInfo, setUniversityInfo] = useState<UniversityInfo | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push('/');
    }
  }, [user, sessionLoading, router]);

  // Initialize username from me data
  useEffect(() => {
    if (me?.username) {
      setUsername(me.username);
    }
  }, [me]);

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

  const validateUsername = (value: string): string | null => {
    if (value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (value.length > 20) {
      return 'Username must be 20 characters or less';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return null;
  };

  const handleSave = async () => {
    const trimmedUsername = username.trim();
    const validationError = validateUsername(trimmedUsername);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/profile/username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: trimmedUsername }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update username');
      }

      setSuccess('Username updated successfully!');
      setIsEditing(false);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update username');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setUsername(me?.username || '');
    setIsEditing(false);
    setError('');
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
              Manage your account settings
            </p>
          </div>

          {/* Profile Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
            {/* Username Section */}
            <div>
              <label className="block text-white/60 text-sm uppercase tracking-wide mb-2">
                Username
              </label>
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError('');
                      setSuccess('');
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#FFD700] transition-colors font-mono"
                    maxLength={20}
                    autoFocus
                  />
                  <p className="text-white/40 text-xs">
                    3-20 characters, letters, numbers, and underscores only
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-[#FFD700] text-gray-900 font-bold text-sm uppercase tracking-wide rounded-lg hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-4 py-2 bg-white/10 text-white font-bold text-sm uppercase tracking-wide rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-white text-lg font-mono">
                    {me?.username || <span className="text-white/40 italic">Not set</span>}
                  </span>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-[#FFD700] hover:text-[#FFD700]/80 text-sm font-medium uppercase tracking-wide transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )}
              
              {error && (
                <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              
              {success && (
                <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-sm">{success}</p>
                </div>
              )}
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
              <div className="flex items-center justify-between">
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
