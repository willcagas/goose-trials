'use client';
import { useState, useEffect } from 'react';
import { useSession } from '@/app/providers/SessionContext';

const PENDING_LOGIN_KEY = 'goose_trials_pending_login';

interface PendingLoginState {
  step: 'code';
  email: string;
  timestamp: number;
}

export function getPendingLogin(): PendingLoginState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(PENDING_LOGIN_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as PendingLoginState;
    // Only show if less than 10 minutes old (OTP codes expire)
    if (Date.now() - parsed.timestamp > 10 * 60 * 1000) {
      localStorage.removeItem(PENDING_LOGIN_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingLogin(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PENDING_LOGIN_KEY);
}

interface LoginNotificationProps {
  onOpenModal: () => void;
}

export default function LoginNotification({ onOpenModal }: LoginNotificationProps) {
  const { user } = useSession();
  const [pendingLogin, setPendingLogin] = useState<PendingLoginState | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Don't show if user is already logged in
    if (user) {
      clearPendingLogin();
      setIsVisible(false);
      return;
    }

    const checkPending = () => {
      const pending = getPendingLogin();
      setPendingLogin(pending);
      setIsVisible(pending !== null);
    };

    checkPending();
    // Check periodically in case localStorage was updated in another tab
    const interval = setInterval(checkPending, 2000);
    return () => clearInterval(interval);
  }, [user]);

  if (!isVisible || !pendingLogin) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm animate-in slide-in-from-bottom-4 fade-in">
      <button
        onClick={onOpenModal}
        className="w-full bg-amber-400 hover:bg-amber-300 text-gray-900 font-bold rounded-lg shadow-lg p-4 border-2 border-amber-500 hover:border-amber-400 transition-all hover:scale-105 active:scale-95 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-bold uppercase tracking-wide">
              Complete Sign In
            </div>
            <div className="text-xs opacity-80 mt-0.5">
              Enter code sent to {pendingLogin.email}
            </div>
          </div>
          <div className="flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>
    </div>
  );
}

