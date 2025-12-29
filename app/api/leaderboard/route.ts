/**
 * API Route: Get Leaderboard
 * GET /api/leaderboard?test_slug=<slug>&university_id=<uuid>
 * 
 * Calls the get_leaderboard RPC function
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user (optional - for is_you flag)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const testSlug = searchParams.get('test_slug');
    const universityId = searchParams.get('university_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!testSlug) {
      return NextResponse.json(
        { error: 'test_slug is required' },
        { status: 400 }
      );
    }

    // Call the get_leaderboard RPC function
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_test_slug: testSlug,
      p_limit: limit,
      p_user_id: userId,
      p_university_id: universityId || null,
    });

    if (error) {
      console.error('Error calling get_leaderboard:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error in /api/leaderboard:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}