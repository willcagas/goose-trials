/**
 * API Route: Get User's Top 5 Scores for a Test
 * GET /api/user-top-scores?test_slug=reaction-time&username=johndoe
 * 
 * Now uses username instead of user_id for privacy.
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user (optional for this endpoint)
    const { data: { user } } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    const testSlug = searchParams.get('test_slug');
    const targetUsername = searchParams.get('username'); // Use username instead of user_id

    if (!testSlug) {
      return NextResponse.json(
        { error: 'test_slug is required' },
        { status: 400 }
      );
    }

    // Determine which user's scores to fetch
    let queryUserId: string | null = null;

    if (targetUsername) {
      // Look up user_id from username
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', targetUsername)
        .single();

      if (profileError || !profile) {
        // User not found
        const emptyScores = Array(5).fill(null);
        return NextResponse.json({
          data: emptyScores,
          average: null
        });
      }

      queryUserId = profile.id;
    } else if (user) {
      // Fetch current user's scores (for game sidebar)
      queryUserId = user.id;
    } else {
      // Not authenticated and no target user specified
      const emptyScores = Array(5).fill(null);
      return NextResponse.json({
        data: emptyScores,
        average: null
      });
    }

    // Get top 5 scores for the target user and test
    const { data, error } = await supabase
      .from('scores')
      .select('score_value, created_at')
      .eq('test_slug', testSlug)
      .eq('user_id', queryUserId)
      .order('score_value', { ascending: true }) // Lower is better for reaction time
      .limit(5);

    if (error) {
      console.error('Error fetching top scores:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const scores = data || [];

    // Calculate average of existing scores
    let average = null;
    if (scores.length > 0) {
      const sum = scores.reduce((acc, s) => acc + s.score_value, 0);
      average = sum / scores.length;
    }

    // Create array with scores and fill remaining slots with null
    const filledScores: (typeof scores[0] | null)[] = [...scores];
    while (filledScores.length < 5) {
      filledScores.push(null);
    }

    return NextResponse.json({
      data: filledScores,
      average: average
    });
  } catch (error) {
    console.error('Unexpected error in /api/user-top-scores:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
