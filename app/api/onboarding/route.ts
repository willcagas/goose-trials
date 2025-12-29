/**
 * API Route: User Onboarding
 * POST /api/onboarding
 *
 * Idempotent endpoint that:
 * 1. Ensures profiles exists/updated
 * 2. Assigns university_id from email domain
 * 3. Migrates guest scores if guest_id provided
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { extractEmailDomain, findUniversityByDomain } from '@/lib/auth/domain';
import { getProfile, upsertProfile } from '@/lib/db/profiles';
import { migrateGuestScores } from '@/lib/guest/migrate';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const email = user.email;
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'User email not found' },
        { status: 400 }
      );
    }

    // Extract email domain and find university
    const emailDomain = extractEmailDomain(email);
    if (!emailDomain) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get guest_id and username from request body (optional)
    let guest_id: string | null = null;
    let username: string | null = null;
    try {
      const body = await request.json();
      guest_id = body.guest_id || null;
      username = body.username || null;
    } catch {
      guest_id = null;
      username = null;
    }

    // Get existing profile to preserve username if needed
    const existingProfile = await getProfile(user.id);
    
    // Find university by domain
    const university_id = await findUniversityByDomain(emailDomain);
    
    // Determine final username (preserve existing if new one not provided)
    const finalUsername = username || existingProfile?.username || null;

    // Upsert profile
    const profileData = {
      id: user.id,
      email: email,
      university_id: university_id,
      ...(finalUsername && { username: finalUsername }),
    };

    const profileResult = await upsertProfile(profileData);
    if (!profileResult.success) {
      return NextResponse.json(
        { success: false, error: profileResult.error || 'Failed to create/update profile' },
        { status: 500 }
      );
    }

    // Migrate guest scores if guest_id provided
    let migrationSuccess = true;
    if (guest_id) {
      const migrationResult = await migrateGuestScores(guest_id, user.id);
      migrationSuccess = migrationResult.success;
      if (!migrationResult.success) {
        console.error('Migration error:', migrationResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      university_id: university_id,
      migration_success: migrationSuccess,
      message: 'Onboarding completed successfully',
    });
  } catch (error) {
    console.error('Unexpected error in onboarding:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}