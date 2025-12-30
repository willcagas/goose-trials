/**
 * API Route: Update Username
 * POST /api/profile/username
 *
 * Updates the authenticated user's username.
 * Validates username format and checks for uniqueness.
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

    // Get username from request body
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();

    // Validate username format
    if (trimmedUsername.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Username must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (trimmedUsername.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Username must be 20 characters or less' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { success: false, error: 'Username can only contain letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    // Check if username is already taken (case-insensitive)
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', trimmedUsername)
      .neq('id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking username:', checkError);
      return NextResponse.json(
        { success: false, error: 'Failed to check username availability' },
        { status: 500 }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Username is already taken' },
        { status: 409 }
      );
    }

    // Update username in profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: trimmedUsername })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating username:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update username' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      username: trimmedUsername,
      message: 'Username updated successfully',
    });
  } catch (error) {
    console.error('Unexpected error in username update:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

