import { getGuestId, clearGuestId } from './guestId';

// Helper to get and clear pending username from localStorage
function getPendingUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('pending_username');
}

function clearPendingUsername(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('pending_username');
}

/**
 * Complete user onboarding:
 * - Ensures profile exists/updated
 * - Assigns university_id from email domain
 * - Migrates guest scores if guest_id exists
 * 
 * Idempotent: can be called multiple times safely
 */
export async function completeOnboarding(): Promise<boolean> {
  try {
    const guestId = getGuestId();
    const pendingUsername = getPendingUsername();

    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        guest_id: guestId || null,
        username: pendingUsername || null,
      }),
    });

    if (!response.ok) {
      console.error('Onboarding failed:', response.statusText);
      return false;
    }

    const data = await response.json();

    if (data.success) {
      // Clear guest_id only if migration was successful
      if (guestId && data.migration_success) {
        clearGuestId();
        console.log('Guest scores migrated and guest_id cleared');
      }
      // Clear pending username after successful onboarding
      if (pendingUsername) {
        clearPendingUsername();
        console.log('Username saved and pending username cleared');
      }
      console.log('Onboarding completed successfully');
      if (data.university_id) {
        console.log('University assigned:', data.university_id);
      }
      // Dispatch event to trigger me data refetch (only once)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('onboarding-complete'));
      }
      return true;
    }

    return false;
  } catch (error) {
    console.error('Onboarding error:', error);
    return false;
  }
}
