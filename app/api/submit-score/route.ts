import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { GAMES_REGISTRY, type GameSlug } from '@/lib/games/registry';

// Score validation ranges per game (realistic human bounds)
const SCORE_RANGES: Record<string, { min: number; max: number }> = {
  'reaction-time': { min: 50, max: 5000 },      // 50ms - 5000ms (humans: 100-1000ms typical)
  'chimp': { min: 0, max: 50 },                 // 0-50 levels
  'number-memory': { min: 0, max: 50 },         // 0-40 digits (20 is world record territory)
  'aim-trainer': { min: 0, max: 200 },         // 0-200 hits (generous upper bound)
  'pathfinding': { min: 0, max: 100 },          // 0-100 rounds
  'hanoi': { min: 3, max: 60 },            // 3 - 60 seconds
  'tetris': { min: 3, max: 2000 },           // 3 - 2000 seconds
};

interface SubmitScoreRequest {
  testSlug: string;
  scoreValue: number;
  previousBest?: number | null;
  guestId?: string;
}

/**
 * Validate score is within acceptable bounds for the game
 */
function validateScore(testSlug: string, scoreValue: number): { valid: boolean; error?: string } {
  // Check if test slug is valid
  if (!(testSlug in GAMES_REGISTRY)) {
    return { valid: false, error: `Invalid test_slug: ${testSlug}` };
  }

  // Basic sanity checks
  if (!Number.isFinite(scoreValue)) {
    return { valid: false, error: 'Score must be a finite number' };
  }

  if (scoreValue < 0) {
    return { valid: false, error: 'Score cannot be negative' };
  }

  // Game-specific range validation
  const range = SCORE_RANGES[testSlug];
  if (range) {
    if (scoreValue < range.min || scoreValue > range.max) {
      return {
        valid: false,
        error: `Score ${scoreValue} is outside acceptable range [${range.min}, ${range.max}] for ${testSlug}`,
      };
    }
  }

  return { valid: true };
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

      // Basic validation of guest ID format (should be UUID-like)
      if (!/^[a-f0-9-]{36}$/i.test(guestId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid guest_id format' },
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

