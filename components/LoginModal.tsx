'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { extractEmailDomain } from '@/lib/auth/domain-utils';
import { getPendingLogin, clearPendingLogin } from './LoginNotification';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'email' | 'code';

const PENDING_LOGIN_KEY = 'goose_trials_pending_login';

function savePendingLogin(email: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify({
      step: 'code' as const,
      email,
      timestamp: Date.now(),
    }));
  } catch (error) {
    console.error('Failed to save pending login:', error);
  }
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Restore pending login state when modal opens
  useEffect(() => {
    if (isOpen) {
      const pending = getPendingLogin();
      if (pending) {
        setStep('code');
        setEmail(pending.email);
        setCode('');
        setResendCooldown(0);
      } else {
        setStep('email');
        setEmail('');
        setCode('');
      }
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Trim email
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }

      // Extract and validate domain (advisory check)
      const domain = extractEmailDomain(trimmedEmail);
      if (!domain) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }

      // Check if domain is in allowlist (advisory check)
      const supabase = createClient();
      // const { data: isAllowed, error: domainCheckError } = await supabase
      //   .rpc('is_domain_allowed', { p_email_domain: domain });

      // if (domainCheckError) {
      //   console.error('Error checking domain:', domainCheckError);
      //   // Continue anyway - server-side enforcement will catch it
      // } else if (isAllowed !== true) {
      //   setError('Use your university email to sign in.');
      //   setLoading(false);
      //   return;
      // }

      // Send OTP code (not magic link)
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        // Log the full error for debugging
        console.error('SignInWithOtp error:', error);
        console.error('Error message:', error.message);
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // Check if error is related to domain validation
        if (error.message.includes('university email') || error.message.includes('domain')) {
          setError('Use a university email to sign in.');
        } else {
          setError(error.message || 'Failed to send verification code. Please try again.');
        }
        return;
      }

      // Success - move to code entry step
      setStep('code');
      setCode('');
      setResendCooldown(60); // 60 second cooldown
      // Save pending login state
      savePendingLogin(trimmedEmail);
    } catch (err) {
      // Handle any unexpected errors
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('university email') || errorMessage.includes('domain')) {
        setError('Use a university email to sign in.');
      } else {
        setError('Failed to send verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Clean code - remove any non-digits
      const cleanCode = code.replace(/\D/g, '');
      
      if (cleanCode.length !== 6) {
        setError('Please enter a valid 6-digit code.');
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const trimmedEmail = email.trim();

      // Verify OTP code
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: cleanCode,
        type: 'email',
      });

      if (error) {
        if (error.message.includes('expired') || error.message.includes('invalid')) {
          setError('Invalid or expired code. Please try again or request a new code.');
        } else {
          setError(error.message || 'Verification failed. Please try again.');
        }
        return;
      }

      // Success - user is now authenticated
      // SessionContext will handle onboarding/migration via onAuthStateChange
      // Clear pending login state
      clearPendingLogin();
      // Close modal and let the session state update
      handleClose();
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    setError('');

    try {
      const trimmedEmail = email.trim();
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        setError(error.message || 'Failed to resend code. Please try again.');
        return;
      }

      // Reset cooldown
      setResendCooldown(60);
      setCode('');
      // Update pending login timestamp
      savePendingLogin(trimmedEmail);
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 6 characters
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setCode(pasted);
  };

  const handleClose = () => {
    // Only clear state if user explicitly closes (not if they're just navigating away)
    // The pending login state will persist so they can come back
    setError('');
    onClose();
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode('');
    setError('');
    setResendCooldown(0);
    // Clear pending login when going back to email step
    clearPendingLogin();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4" 
      onClick={(e) => e.stopPropagation()}
      data-auth-modal="true"
    >
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
            {step === 'code' ? 'Enter Verification Code' : 'Join the Trials'}
          </h2>
          <p className="text-white/60 mt-2">
            {step === 'code'
              ? `We sent a 6-digit code to ${email}`
              : 'Enter your email to receive a verification code'}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Use your university/college email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#FFD700] transition-colors"
                required
                autoFocus
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
              {loading ? 'Sending...' : 'Send Code'}
            </button>

            <p className="text-white/40 text-xs text-center">
              Use your university email to appear on campus leaderboards
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="000000"
                value={code}
                onChange={handleCodeChange}
                onPaste={handleCodePaste}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#FFD700] transition-colors text-center text-2xl tracking-widest font-mono"
                required
                maxLength={6}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            {/* Prominent spam email warning - moved up and made more visible */}
            <div className="bg-amber-400/20 border-2 border-amber-400/50 rounded-lg p-4 -mt-2 mb-2">
              <div className="flex items-start gap-3">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2} 
                  stroke="currentColor" 
                  className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" 
                  />
                </svg>
                <div>
                  <p className="text-amber-200 text-base font-semibold mb-1">
                    📧 Check Your Spam/Junk Folder!
                  </p>
                  <p className="text-amber-300/90 text-sm leading-relaxed">
                    Verification codes may take <strong>1–2 minutes</strong> to arrive and often end up in <strong className="underline">spam or junk folders</strong>. Keep this tab open and check your email spam folder!
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full px-4 py-3 bg-[#FFD700] text-gray-900 font-bold uppercase tracking-wide rounded-lg hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || loading}
                  className="text-[#FFD700] hover:underline font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </div>


            <button
              type="button"
              onClick={handleBackToEmail}
              className="text-white/60 hover:text-white text-sm font-medium"
            >
              ← Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
