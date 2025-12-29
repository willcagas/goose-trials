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

    // Extract email domain
    const email = user.email;
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'User email not found' },
        { status: 400 }
      );
    }

    const emailDomain = email.split('@')[1]?.toLowerCase();
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
      // Body is optional, continue without guest_id or username
      guest_id = null;
      username = null;
    }

    // Step 1: Check if profile exists (to preserve existing username if not provided)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, university_id, username')
      .eq('id', user.id)
      .single();

    // Step 2: Find university by domain
    const { data: universityData, error: universityError } = await supabase
      .rpc('find_university_by_domain', { p_email_domain: emailDomain });

    const university_id = universityError ? null : (universityData as string | null);

    // Step 3: Upsert profile with university_id and username
    // If username is provided, use it (for new profiles or updates)
    // If username is not provided but profile exists, preserve existing username
    const finalUsername = username || existingProfile?.username || null;

    const profileData: {
      id: string;
      email: string;
      university_id?: string | null;
      username?: string | null;
    } = {
      id: user.id,
      email: email,
      university_id: university_id,
    };

    // Include username if we have one (either new or existing)
    if (finalUsername) {
      profileData.username = finalUsername;
    }

    // If profile exists, update it; otherwise insert
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
      });

    if (profileError) {
      console.error('Profile upsert error:', profileError);
      return NextResponse.json(
        { success: false, error: 'Failed to create/update profile' },
        { status: 500 }
      );
    }

    // Step 4: Migrate guest scores if guest_id provided
    let migrationSuccess = true;
    if (guest_id) {
      const { error: migrationError } = await supabase.rpc('migrate_guest_scores', {
        target_guest_id: guest_id,
      });

      if (migrationError) {
        console.error('Migration error:', migrationError);
        // Don't fail the entire request if migration fails
        migrationSuccess = false;
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
