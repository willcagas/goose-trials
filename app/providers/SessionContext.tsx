'use client';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { completeOnboarding } from '@/lib/guest/onboarding';

interface SessionContextType {
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

//can be type SessionContextType or undefined (if not existing yet)
//default value is undefined
const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Helper to check if onboarding is in progress or completed for this user in this session
function isOnboardingCompletedOrInProgress(userId: string | null): boolean {
  if (!userId || typeof window === 'undefined') return false;
  const key = `onboarded:${userId}`;
  const value = sessionStorage.getItem(key);
  return value === 'true' || value === 'pending';
}

// Helper to mark onboarding as in progress
function markOnboardingInProgress(userId: string): void {
  if (typeof window === 'undefined') return;
  const key = `onboarded:${userId}`;
  sessionStorage.setItem(key, 'pending');
}

// Helper to mark onboarding as completed for this user
function markOnboardingCompleted(userId: string): void {
  if (typeof window === 'undefined') return;
  const key = `onboarded:${userId}`;
  sessionStorage.setItem(key, 'true');
}

// Helper to clear onboarding flag
function clearOnboardingFlag(userId: string | null): void {
  if (!userId || typeof window === 'undefined') return;
  const key = `onboarded:${userId}`;
  sessionStorage.removeItem(key);
}

//destructuring to extract children
//children are of type React.ReactNode
export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const isOnboardingInProgressRef = useRef(false);
    const currentUserIdRef = useRef<string | null>(null);

    // Consolidated onboarding trigger function
    const triggerOnboardingIfNeeded = async (userId: string | null) => {
        // Don't trigger if no user logged in
        if (!userId) {
            return;
        }

        // Double-check that the ref still points to this user (prevent stale calls after sign out)
        if (currentUserIdRef.current !== userId) {
            return;
        }

        // Check sessionStorage FIRST (synchronously) - this is the primary guard
        // If already completed or in progress, bail out immediately
        if (isOnboardingCompletedOrInProgress(userId)) {
            return;
        }

        // Check if already in progress (ref guard as secondary check)
        if (isOnboardingInProgressRef.current) {
            return;
        }

        // At this point, we're the first caller. Set sessionStorage to "pending" IMMEDIATELY
        // This must happen synchronously before any async operations
        const key = `onboarded:${userId}`;
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(key, 'pending');
        }
        
        // Verify we successfully set it (in case another call set it between our check and set)
        // This is our atomic operation verification
        if (typeof window !== 'undefined' && sessionStorage.getItem(key) !== 'pending') {
            // Another call beat us to it, bail out
            return;
        }

        // Now set the ref guard
        isOnboardingInProgressRef.current = true;
        
        console.log('Starting onboarding for user:', userId);
        
        try {
            // Double-check user ID hasn't changed during async operation
            if (currentUserIdRef.current !== userId) {
                console.log('User changed during onboarding, aborting');
                clearOnboardingFlag(userId);
                return;
            }

            const success = await completeOnboarding();
            if (success) {
                console.log('Onboarding completed successfully');
                markOnboardingCompleted(userId);
            } else {
                console.warn('Onboarding completed with warnings');
                // Still mark as completed to avoid retrying immediately
                markOnboardingCompleted(userId);
            }
        } catch (error) {
            console.error('Onboarding error:', error);
            // Clear the flag on error so it can retry on next page load
            clearOnboardingFlag(userId);
        } finally {
            // Only clear the ref if we're still working on the same user
            if (currentUserIdRef.current === userId) {
                isOnboardingInProgressRef.current = false;
            }
        }
    };

    //useEffect only runs once React component renders
    useEffect(() => {
        const supabase = createClient();
        //checking if there's already a logged in session
        const checkSession = async () => {
            try {
                //get current session from Supabase
                const { data: { session } } = await supabase.auth.getSession();

                let result;
                if (session !== null && session !== undefined) {
                    result = session.user;
                } else {
                    result = undefined;
                }
                if (result === null || result === undefined) {
                    result = null;
                }
                setUser(result);
                currentUserIdRef.current = result?.id || null;

                // Don't trigger onboarding here - let onAuthStateChange handle it
                // This prevents duplicate calls when both checkSession and onAuthStateChange fire
            } catch (error) {
                setUser(null);
                currentUserIdRef.current = null;
            }
            //done checking, stop showing loading state
            setLoading(false);

        }

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            let result;
            if (session !== null && session !== undefined) {
                result = session.user;
            } else {
                result = undefined;
            }
            if (result === null || result === undefined) {
                result = null;
            }
            
            // Store previous user ID from ref before updating
            const previousUserId = currentUserIdRef.current;
            setUser(result);
            currentUserIdRef.current = result?.id || null;

            // Trigger onboarding on sign in or initial session (when user is already logged in on page load)
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && result?.id) {
                await triggerOnboardingIfNeeded(result.id);
            }
            if (event === 'SIGNED_OUT') {
                // Reset onboarding state when user signs out
                isOnboardingInProgressRef.current = false;
                clearOnboardingFlag(previousUserId);
            }
        })

        return () => {
            subscription.unsubscribe();
        }
    }, []) // Empty deps - setup once, cleanup on unmount

    const signOut = async () => {
        const supabase = createClient();
        const userIdToClear = currentUserIdRef.current;
        
        // Reset onboarding state before signing out
        isOnboardingInProgressRef.current = false;
        clearOnboardingFlag(userIdToClear);
        
        await supabase.auth.signOut();
        setUser(null);
        currentUserIdRef.current = null;
    }
    //function provides user, loading state, and signOut function to all children
    return (
        <SessionContext.Provider value={{ user, loading, signOut }}>
            {children}
        </SessionContext.Provider>
    )
}

//custom hook to use session data in any component
export function useSession() {
    const context = useContext(SessionContext);

    if (context === undefined) {
        throw Error('useSession must be used within SessionProvider');
    }
    return context;
}