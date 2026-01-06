/**
 * API Route: Get Top Universities Leaderboard
 * GET /api/top-universities?test_slug=<slug>&country_code=<alpha_two_code>&limit=<n>&min_players=<n>
 * 
 * Calls the get_top_universities RPC function
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTopUniversities } from '@/lib/db/leaderboard';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const testSlug = searchParams.get('test_slug');
    const countryCode = searchParams.get('country_code');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const minPlayers = parseInt(searchParams.get('min_players') || '5', 10);
    const topN = parseInt(searchParams.get('top_n') || '5', 10);

    if (!testSlug) {
      return NextResponse.json(
        { error: 'test_slug is required' },
        { status: 400 }
      );
    }

    // Get top universities leaderboard data
    const { data, error } = await getTopUniversities({
      testSlug,
      limit,
      topN,
      minPlayers,
      countryCode: countryCode || null,
    });

    if (error) {
      return NextResponse.json(
        { error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in /api/top-universities:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

