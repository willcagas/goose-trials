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
  const [showDeliverabilityModal, setShowDeliverabilityModal] = useState(false);

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
        setLoading(false);
        return;
      }

      // Success - wait 3 seconds, then transition directly to code entry step
      setTimeout(() => {
        setStep('code');
        setCode('');
        setResendCooldown(60); // 60 second cooldown
        setLoading(false);
        // Save pending login state
        savePendingLogin(trimmedEmail);
      }, 3000);
    } catch (err) {
      // Handle any unexpected errors
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('university email') || errorMessage.includes('domain')) {
        setError('Use a university email to sign in.');
      } else {
        setError('Failed to send verification code. Please try again.');
      }
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
            {/* Notice about code delivery - must be read before email input */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2} 
                  stroke="currentColor" 
                  className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" 
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-blue-300/90 text-sm leading-relaxed mb-2">
                      Our goose may get stuck in campus admin 🦢
                  </p>
                  <ul className="text-blue-300/80 text-xs leading-relaxed space-y-1 list-decimal list-inside mb-0 ml-1">
                    <li>
                      <strong className="text-blue-200">Check for our email in your Spam / Junk or</strong>{' '}
                      <a
                        href="https://security.microsoft.com/quarantine"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-200 hover:text-blue-100 underline font-semibold"
                      >
                        Microsoft Quarantine
                      </a>
                    </li>
                    <li>
                      <strong className="text-blue-200">
                        Mark it as Not Junk to help future codes arrive faster.
                      </strong>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

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
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </span>
              ) : (
                'Send Code'
              )}
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

            {/* Code delivery reminder */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-300/90 text-xs leading-relaxed">
                Didn't get the code? Check Spam / Junk or{' '}
                <a
                  href="https://security.microsoft.com/quarantine"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-200 hover:text-blue-100 underline font-medium"
                >
                  Microsoft Quarantine
                </a>
                {' '}and search for "Goose Trials"
              </p>
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

      {/* Deliverability Instructions Modal */}
      {showDeliverabilityModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4" 
          onClick={(e) => {
            e.stopPropagation();
            setShowDeliverabilityModal(false);
          }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowDeliverabilityModal(false)}
          />

          {/* Modal */}
          <div 
            className="relative bg-[#0a0a0a] border border-white/20 rounded-2xl p-6 md:p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowDeliverabilityModal(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="mb-6">
              <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-2">
                Ensure Your Code Arrives Instantly
              </h3>
              <p className="text-white/60 text-sm">
                Add <span className="font-mono text-blue-300">auth@auth.goosetrials.com</span> to your Safe Senders list before clicking "Send Code"
              </p>
            </div>

            {/* Instructions */}
            <div className="space-y-6">
              {/* Outlook Web Instructions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    strokeWidth={2} 
                    stroke="currentColor" 
                    className="w-5 h-5 text-blue-400"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" 
                    />
                  </svg>
                  <h4 className="text-white font-semibold text-base">For University Outlook (Web)</h4>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-white/80 text-sm ml-2">
                  <li>Click the <strong className="text-white">Gear icon (Settings)</strong> in the top right</li>
                  <li>Go to <strong className="text-white">Mail → Junk email</strong></li>
                  <li>Under <strong className="text-white">Safe senders and domains</strong>, click <strong className="text-white">+ Add</strong></li>
                  <li>Type <span className="font-mono text-blue-300 bg-white/5 px-2 py-0.5 rounded">auth@auth.goosetrials.com</span> and press <strong className="text-white">Enter</strong></li>
                  <li>Click <strong className="text-white">Save</strong></li>
                </ol>
              </div>

              {/* Alternative: Add to Contacts */}
              <div className="border-t border-white/10 pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    strokeWidth={2} 
                    stroke="currentColor" 
                    className="w-5 h-5 text-amber-400"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0z" 
                    />
                  </svg>
                  <h4 className="text-white font-semibold text-base">One-Step Alternative: Add to Contacts</h4>
                </div>
                <p className="text-white/70 text-sm leading-relaxed ml-2">
                  For Mobile or Gmail users: Adding <span className="font-mono text-amber-300 bg-white/5 px-2 py-0.5 rounded">auth@auth.goosetrials.com</span> as a contact in your phone or email app is the easiest method. Once added to your Contacts, most filters (including Google and Apple) will automatically bypass the Spam folder because both Microsoft and Google trust email from contacts by default.
                </p>
              </div>

              {/* Why this works */}
              <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-4">
                <p className="text-amber-200 text-xs leading-relaxed">
                  <strong className="text-amber-100">Why this works:</strong> When you add us to Safe Senders, it manually sets the Spam Confidence Level (SCL) to -1 for your account. This overrides server-wide filters and ensures your verification code arrives instantly, even if your university's AI initially flags our domain.
                </p>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowDeliverabilityModal(false)}
              className="mt-6 w-full px-4 py-3 bg-[#FFD700] text-gray-900 font-bold uppercase tracking-wide rounded-lg hover:bg-[#FFD700]/90 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
