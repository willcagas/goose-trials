/**
 * API Route: Get Leaderboard
 * GET /api/leaderboard?test_slug=<slug>&university_id=<uuid>
 * 
 * Calls the get_leaderboard RPC function
 * Note: is_you flag is determined by auth.uid() in the SQL function
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/db/leaderboard';

export async function GET(request: NextRequest) {
  try {
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

    // Get leaderboard data (is_you determined by auth context in SQL)
    const { data, error } = await getLeaderboard({
      testSlug,
      limit,
      universityId: universityId || null,
    });

    if (error) {
      return NextResponse.json(
        { error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
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
