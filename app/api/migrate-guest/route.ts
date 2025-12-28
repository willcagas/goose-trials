/**
 * API Route: Migrate Guest Scores
 * POST /api/migrate-guest
 *
 * Migrates all scores from a guest_id to the currently logged-in user
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
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

    // Get guest_id from request body
    const body = await request.json();
    const { guest_id } = body;

    if (!guest_id) {
      return NextResponse.json(
        { success: false, error: 'guest_id is required' },
        { status: 400 }
      );
    }

    // Call the Supabase RPC function to migrate scores
    const { error } = await supabase.rpc('migrate_guest_scores', {
      target_guest_id: guest_id,
    });

    if (error) {
      console.error('Migration error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Guest scores migrated successfully',
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
