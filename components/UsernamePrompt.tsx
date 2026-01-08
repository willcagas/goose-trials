'use client';
import { useState, useEffect } from 'react';
import { useMe } from '@/app/providers/MeContext';
import UsernameModal from './UsernameModal';

/**
 * UsernamePrompt - Shows username modal when user is logged in but has no username
 * 
 * This component should be placed at the app layout level.
 * It automatically shows the username modal after:
 * 1. User successfully logs in via OTP verification
 * 2. Onboarding completes (profile created, university assigned, guest scores migrated)
 * 3. User's profile has no username set
 * 
 * Once the username is set, it won't show again unless they edit it in /profile.
 */
export default function UsernamePrompt() {
  const { me, loading, refetch } = useMe();
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Derive modal state instead of setting in effect
  const shouldShowModal = Boolean(!loading && !dismissed && me?.isLoggedIn && !me?.username);

  // Sync derived state to showModal
  useEffect(() => {
    if (shouldShowModal !== showModal) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setShowModal(shouldShowModal), 0);
    }
  }, [shouldShowModal, showModal]);

  const handleComplete = async (username: string) => {
    console.log('Username set successfully:', username);
    setShowModal(false);
    setDismissed(true);
    
    // Refetch me data to update the context with new username
    await refetch();
  };

  return <UsernameModal isOpen={showModal} onComplete={handleComplete} />;
}

