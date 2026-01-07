'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { extractEmailDomain } from '@/lib/auth/domain-utils';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Extract and validate domain (advisory check)
      const domain = extractEmailDomain(email);
      if (!domain) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }

      // Check if domain is in allowlist (advisory check)
      const supabase = createClient();
      const { data: isAllowed, error: domainCheckError } = await supabase
        .rpc('is_domain_allowed', { p_email_domain: domain });

      if (domainCheckError) {
        console.error('Error checking domain:', domainCheckError);
        // Continue anyway - server-side enforcement will catch it
      } else if (isAllowed !== true) {
        setError('Use your university email to sign in.');
        setLoading(false);
        return;
      }

      // Send magic link
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        // Check if error is related to domain validation
        if (error.message.includes('university email') || error.message.includes('domain')) {
          setError('Use a university email to sign in.');
        } else {
          setError(error.message || 'Failed to send magic link. Please try again.');
        }
        return;
      }

      setSuccess(true);
      setEmail('');
    } catch (err: unknown) {
      // Handle any unexpected errors
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.includes('university email') || errorMessage.includes('domain')) {
        setError('Use a university email to sign in.');
      } else {
        setError('Failed to send magic link. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0a0a0a] border border-white/20 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
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
            {success ? 'Check Your Email' : 'Join the Trials'}
          </h2>
          <p className="text-white/60 mt-2">
            {success
              ? "We've sent you a link to sign in"
              : 'Enter your email to receive a sign-in link'}
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-[#FFD700]/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-[#FFD700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-white/80">
              Click the link in your email and you&apos;re good to go.
            </p>
            <p className="text-white/50 text-sm">
              Your guest scores will be transferred automatically.
            </p>
            <button
              onClick={() => {
                setSuccess(false);
                setEmail('');
              }}
              className="text-[#FFD700] hover:underline font-medium"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Use your university/college email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#FFD700] transition-colors"
                required
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-[#FFD700] text-gray-900 font-bold uppercase tracking-wide rounded-lg hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Sign-In Link'}
            </button>

            <p className="text-white/40 text-xs text-center">
              Use your university email to appear on campus leaderboards
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
