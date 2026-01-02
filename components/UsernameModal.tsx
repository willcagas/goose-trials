'use client';
import { useState } from 'react';
import { normalizeUsername, validateUsernameClient } from '@/lib/username/client-validation';

interface UsernameModalProps {
  isOpen: boolean;
  onComplete: (username: string) => void;
}

export default function UsernameModal({ isOpen, onComplete }: UsernameModalProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalize to lowercase before validation and submission
    const normalizedUsername = normalizeUsername(username);
    
    // Client-side validation (UX only - server re-validates)
    const validationError = validateUsernameClient(normalizedUsername);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/profile/username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send normalized username - server will also normalize but this ensures consistency
        body: JSON.stringify({ username: normalizedUsername }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Display server error message
        throw new Error(data.error || 'Failed to set username');
      }

      onComplete(normalizedUsername);
    } catch (err) {
      // Show server-returned error message
      setError(err instanceof Error ? err.message : 'Failed to set username');
    } finally {
      setLoading(false);
    }
  };

  // Real-time validation feedback as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    
    // Clear error on new input, let them type freely
    // Validation happens on submit
    if (error) {
      setError('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - no close on click since this is required */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-[#0a0a0a] border border-white/20 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <img 
                src="/goosetrialspfp-removebg-preview.png" 
                alt="Goose Trials Logo"
                className="w-10 h-10 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-base font-bold text-white leading-[0.9] uppercase tracking-wider">
                GOOSE
              </span>
              <span className="text-base font-bold text-amber-400 leading-[0.9] uppercase tracking-wider">
                TRIALS
              </span>
            </div>
          </div>
          <h2 className="text-white text-2xl font-bold uppercase tracking-wide">
            Choose Your Username
          </h2>
          <p className="text-white/60 mt-2">
            This is how you&apos;ll appear on leaderboards
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={handleInputChange}
              disabled={loading}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#FFD700] transition-colors font-mono disabled:opacity-50"
              autoFocus
              maxLength={20}
            />
            <p className="text-white/40 text-xs mt-2">
              3-20 characters, letters, numbers, and underscores only. Will be lowercase.
            </p>
          </div>

          {/* Inline error display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full px-4 py-3 bg-[#FFD700] text-gray-900 font-bold uppercase tracking-wide rounded-lg hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
