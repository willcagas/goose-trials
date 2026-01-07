'use client';
import { useState, useEffect } from 'react';
import { useMe } from '@/app/providers/MeContext';
import UsernameModal from './UsernameModal';

/**
 * UsernamePrompt - Shows username modal when user is logged in but has no username
 * 
 * This component should be placed at the app layout level.
 * It automatically shows the username modal after:
 * 1. User successfully logs in via magic link
 * 2. Onboarding completes (profile created, university assigned, guest scores migrated)
 * 3. User's profile has no username set
 * 
 * Once the username is set, it won't show again unless they edit it in /profile.
 */
export default function UsernamePrompt() {
  const { me, loading, refetch } = useMe();
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if we should show the username modal
  useEffect(() => {
    // Don't show while loading
    if (loading) return;
    
    // Don't show if already dismissed this session
    if (dismissed) return;
    
    // Don't show if no user data
    if (!me) return;
    
    // Don't show if not logged in
    if (!me.isLoggedIn) return;
    
    // Show modal if logged in but no username
    if (!me.username) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowModal(true);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowModal(false);
    }
  }, [me, loading, dismissed]);

  const handleComplete = async (username: string) => {
    console.log('Username set successfully:', username);
    setShowModal(false);
    setDismissed(true);
    
    // Refetch me data to update the context with new username
    await refetch();
  };

  return <UsernameModal isOpen={showModal} onComplete={handleComplete} />;
}

