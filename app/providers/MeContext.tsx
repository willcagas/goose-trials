'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from './SessionContext';
import posthog from 'posthog-js';

export interface MeData {
  isLoggedIn: boolean;
  userId: string | null;
  universityId: string | null;
  username: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  countryName: string | null;
}

interface MeContextType {
  me: MeData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const MeContext = createContext<MeContextType | undefined>(undefined);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useSession(); // Listen to auth state changes
  const isFetchingRef = useRef(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  // Store fetchMe function in ref to avoid dependency issues
  const fetchMeRef = useRef<(() => Promise<void>) | undefined>(undefined);
  
  const fetchMe = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
      setError(null);
      setLoading(true);
      const response = await fetch('/api/me');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user data: ${response.statusText}`);
      }
      
      const data: MeData = await response.json();
      setMe(data);
      lastFetchedUserIdRef.current = data.userId;
      
      // Update PostHog user properties with username
      if (data.isLoggedIn && data.userId && data.username) {
        posthog.people.set({
          username: data.username,
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      // Set default state on error
      setMe({
        isLoggedIn: false,
        userId: null,
        universityId: null,
        username: null,
        avatarUrl: null,
        countryCode: null,
        countryName: null,
      });
      lastFetchedUserIdRef.current = null;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Update ref whenever fetchMe changes
  fetchMeRef.current = fetchMe;

  // Track the current user ID to detect changes
  const currentUserId = user?.id ?? null;
  const currentUserIdRef = useRef<string | null>(null);

  // Initial fetch on mount
  const hasFetchedInitialRef = useRef(false);
  
  // Fetch on mount (once) and when user ID changes (login/logout)
  useEffect(() => {
    const prevUserId = currentUserIdRef.current;
    const hasUserIdChanged = prevUserId !== currentUserId;
    
    // Update ref immediately to track current user ID
    currentUserIdRef.current = currentUserId;

    // Only fetch if:
    // 1. Initial mount (never fetched before), OR
    // 2. We haven't fetched yet for this user (initial load or first login), OR
    // 3. The user ID has actually changed (login/logout)
    const shouldFetch = 
      !hasFetchedInitialRef.current ||
      (lastFetchedUserIdRef.current === null && currentUserId !== null) ||
      (hasUserIdChanged && currentUserId !== null) ||
      (hasUserIdChanged && currentUserId === null && prevUserId !== null); // Logout case

    if (shouldFetch && !isFetchingRef.current && fetchMeRef.current) {
      hasFetchedInitialRef.current = true;
      fetchMeRef.current();
    }
  }, [currentUserId]);

  // Listen for onboarding completion to refetch me data (only once)
  useEffect(() => {
    const handleOnboardingComplete = () => {
      // Only refetch if we're currently logged in and not already fetching
      if (currentUserIdRef.current && !isFetchingRef.current && fetchMeRef.current) {
        fetchMeRef.current();
      }
    };

    window.addEventListener('onboarding-complete', handleOnboardingComplete);
    return () => {
      window.removeEventListener('onboarding-complete', handleOnboardingComplete);
    };
  }, []); // Only set up listener once

  return (
    <MeContext.Provider value={{ me, loading, error, refetch: fetchMe }}>
      {children}
    </MeContext.Provider>
  );
}

export function useMe() {
  const context = useContext(MeContext);
  
  if (context === undefined) {
    throw new Error('useMe must be used within MeProvider');
  }
  
  return context;
}
