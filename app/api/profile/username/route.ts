/**
 * API Route: Update Username
 * POST /api/profile/username
 *
 * Updates the authenticated user's username.
 * 
 * Security notes:
 * - Uses service role client to bypass RLS (users cannot update their own username directly)
 * - Profanity/ban list is kept server-side only to prevent circumvention
 * - Username is never logged in production to protect user privacy
 */

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeUsername, validateUsernameShape } from '@/lib/username/validation';
import { isReservedUsername, isBannedUsername } from '@/lib/username/banlist.server';

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate using cookie-based session
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Input hardening: ensure body is an object and username is a string
    if (
      typeof body !== 'object' ||
      body === null ||
      !('username' in body) ||
      typeof (body as Record<string, unknown>).username !== 'string'
    ) {
      return NextResponse.json(
        { ok: false, error: 'Username must be a string' },
        { status: 400 }
      );
    }

    const rawUsername = (body as { username: string }).username;

    // Normalize: trim whitespace and lowercase (using shared utility)
    const username = normalizeUsername(rawUsername);

    // Validate shape rules (using shared utility)
    const shapeError = validateUsernameShape(username);
    if (shapeError) {
      return NextResponse.json(
        { ok: false, error: shapeError },
        { status: 400 }
      );
    }

    // Check reserved usernames (server-only)
    if (isReservedUsername(username)) {
      return NextResponse.json(
        { ok: false, error: 'This username is reserved' },
        { status: 400 }
      );
    }

    // Check profanity/ban list (server-only)
    if (isBannedUsername(username)) {
      return NextResponse.json(
        { ok: false, error: 'This username is not allowed' },
        { status: 400 }
      );
    }

    // Update username using service role client
    // Service role bypasses RLS, which is required because users cannot
    // update their own username directly via RLS policy.
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ username })
      .eq('id', user.id);

    if (updateError) {
      // Handle specific Postgres error codes
      // 23505 = unique_violation (username already taken)
      // 23514 = check_violation (constraint failed)
      if (updateError.code === '23505') {
        return NextResponse.json(
          { ok: false, error: 'Username is already taken' },
          { status: 409 }
        );
      }
      if (updateError.code === '23514') {
        return NextResponse.json(
          { ok: false, error: 'Username does not meet requirements' },
          { status: 400 }
        );
      }

      // Log error without exposing the username (privacy)
      if (process.env.NODE_ENV !== 'production') {
        console.error('Username update error:', updateError);
      } else {
        console.error('Username update error:', updateError.code, updateError.message);
      }

      return NextResponse.json(
        { ok: false, error: 'Failed to update username' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Log without username for privacy
    console.error('Unexpected error in username update:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
