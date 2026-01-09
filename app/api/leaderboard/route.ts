/**
 * API Route: Get Leaderboard (Individual Players)
 * GET /api/leaderboard?test_slug=<slug>&university_id=<uuid>&country_code=<alpha_two_code>
 * 
 * Calls the get_leaderboard RPC function
 * Note: is_you flag is determined by auth.uid() in the SQL function
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard, getPlayerCount } from '@/lib/db/leaderboard';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const testSlug = searchParams.get('test_slug');
    const universityId = searchParams.get('university_id');
    const countryCode = searchParams.get('country_code');
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
      countryCode: countryCode || null,
    });

    if (error) {
      return NextResponse.json(
        { error },
        { status: 500 }
      );
    }

    // Get total player count (for global leaderboard only, not filtered by university/country)
    let totalCount = null;
    if (!universityId && !countryCode) {
      const { count, error: countError } = await getPlayerCount({
        testSlug,
        universityId: null,
        countryCode: null,
      });
      if (!countError) {
        totalCount = count;
      }
    }

    return NextResponse.json({ data, totalCount });
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
