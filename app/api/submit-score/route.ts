import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { GAMES_REGISTRY, type GameSlug } from '@/lib/games/registry';
import { validateScore } from '@/lib/scoring/validate';

interface SubmitScoreRequest {
  testSlug: string;
  scoreValue: number;
  previousBest?: number | null;
  guestId?: string;
}

/**
 * Determine if a new score is better than the old score
 */
function isScoreBetter(testSlug: string, newScore: number, oldScore: number): boolean {
  const gameMeta = GAMES_REGISTRY[testSlug as GameSlug];
  if (!gameMeta) {
    return false;
  }

  if (gameMeta.lowerIsBetter) {
    return newScore < oldScore;
  }
  return newScore > oldScore;
}

/**
 * Server-side score submission endpoint
 * Uses service role key to insert scores, validates all inputs
 * 
 * POST /api/submit-score
 * Body: { testSlug: string, scoreValue: number, previousBest?: number | null, guestId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body: SubmitScoreRequest = await request.json();
    const { testSlug, scoreValue, previousBest, guestId } = body;

    // Validate required fields
    if (!testSlug || typeof testSlug !== 'string') {
      return NextResponse.json(
        { success: false, error: 'testSlug is required and must be a string' },
        { status: 400 }
      );
    }

    if (scoreValue === undefined || scoreValue === null || typeof scoreValue !== 'number') {
      return NextResponse.json(
        { success: false, error: 'scoreValue is required and must be a number' },
        { status: 400 }
      );
    }

    // Check if test slug is valid
    if (!(testSlug in GAMES_REGISTRY)) {
      return NextResponse.json(
        { success: false, error: `Invalid test_slug: ${testSlug}` },
        { status: 400 }
      );
    }

    // Validate score bounds
    const validation = validateScore(testSlug, scoreValue);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Get user session (server-side)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    let scoreData: {
      test_slug: string;
      score_value: number;
      user_id: string | null;
      guest_id: string | null;
    };

    if (user && !authError) {
      // Authenticated user
      scoreData = {
        test_slug: testSlug,
        score_value: scoreValue,
        user_id: user.id,
        guest_id: null,
      };
    } else {
      // Guest user - must provide guestId
      if (!guestId || typeof guestId !== 'string') {
        return NextResponse.json(
          { success: false, error: 'guestId is required for unauthenticated users' },
          { status: 400 }
        );
      }

      // Basic validation of guest ID format (should be UUID v4 format)
      // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (8-4-4-4-12 hex digits)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(guestId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid guest_id format. Must be a valid UUID.' },
          { status: 400 }
        );
      }

      scoreData = {
        test_slug: testSlug,
        score_value: scoreValue,
        user_id: null,
        guest_id: guestId,
      };
    }

    // Determine if this is a new high score
    // If previousBest is provided, compare client-side (avoids race condition)
    // Otherwise, query database for previous best
    let isNewHighScore = false;
    
    if (previousBest !== undefined && previousBest !== null) {
      // Client provided previous best - use that comparison
      isNewHighScore = isScoreBetter(testSlug, scoreValue, previousBest);
    } else {
      // Query database for previous best
      let query = supabaseAdmin
        .from('scores')
        .select('score_value')
        .eq('test_slug', testSlug);

      if (scoreData.user_id) {
        query = query.eq('user_id', scoreData.user_id);
      } else if (scoreData.guest_id) {
        query = query.eq('guest_id', scoreData.guest_id);
      }

      // Order by score_value: ascending for lower-is-better games, descending for higher-is-better
      const lowerIsBetter = GAMES_REGISTRY[testSlug as GameSlug]?.lowerIsBetter ?? false;
      query = query.order('score_value', { ascending: lowerIsBetter });

      const { data: existingScores } = await query.limit(1);

      if (!existingScores || existingScores.length === 0) {
        // First score for this user/game
        isNewHighScore = true;
      } else {
        const previousBestFromDb = existingScores[0].score_value;
        isNewHighScore = isScoreBetter(testSlug, scoreValue, previousBestFromDb);
      }
    }

    // Insert score using admin client (bypasses RLS)
    const { error: insertError } = await supabaseAdmin.from('scores').insert([scoreData]);

    if (insertError) {
      console.error('Error inserting score:', insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      isNewHighScore,
    });
  } catch (error) {
    console.error('Unexpected error in submit-score:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

