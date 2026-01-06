import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { GAMES_REGISTRY, type GameSlug } from '@/lib/games/registry';

// Define realistic ranges for each test (based on human averages)
const TEST_RANGES: Record<string, { min: number; max: number }> = {
  'reaction-time': { min: 100, max: 1000 },     // 100ms - 1000ms (human reaction time)
  'chimp': { min: 1, max: 50 },                 // 1-50 numbers (realistic chimp test range)
  'number-memory': { min: 1, max: 20 },         // 1-20 digits (realistic memory range)
  'verbal-memory': { min: 1, max: 200 },        // 1-200 words (realistic verbal memory)
  'aim-trainer': { min: 100, max: 2000 },       // 100ms - 2000ms (realistic aim time)
  'sequence-memory': { min: 1, max: 30 },       // 1-30 levels (realistic sequence memory)
  'typing': { min: 10, max: 200 },              // 10-200 WPM (realistic typing speed)
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testSlug = searchParams.get('test_slug') as GameSlug | null;
  const userId = searchParams.get('user_id');

  if (!testSlug || !(testSlug in GAMES_REGISTRY)) {
    return NextResponse.json(
      { error: 'test_slug is required and must be valid' },
      { status: 400 }
    );
  }

  const gameMeta = GAMES_REGISTRY[testSlug];
  const supabase = await createClient();

  try {
    // Fetch all scores for this test to calculate distribution
    const { data: scoreData, error } = await supabase
      .from('scores')
      .select('score_value, user_id')
      .eq('test_slug', testSlug)
      .order('score_value', { ascending: true });

    if (error) {
      throw error;
    }

    if (!scoreData || scoreData.length === 0) {
      return NextResponse.json({
        data: {
          distribution: [],
          userPercentile: null,
          userScore: null
        }
      });
    }

    // Filter out unrealistic scores based on test type
    const range = TEST_RANGES[testSlug];
    let filteredScores = scoreData;

    if (range) {
      filteredScores = scoreData.filter(s =>
        s.score_value >= range.min && s.score_value <= range.max
      );

      // If filtering removed too many scores, fall back to using all scores
      if (filteredScores.length < scoreData.length * 0.5) {
        filteredScores = scoreData;
      }
    }

    // Get user's best score if userId provided
    let userBestScore: number | null = null;
    let userPercentile: number | null = null;

    if (userId) {
      if (testSlug === 'reaction-time') {
        // For reaction-time, use average of top 5 scores
        const { data: userScores } = await supabase
          .from('scores')
          .select('score_value')
          .eq('test_slug', testSlug)
          .eq('user_id', userId)
          .order('score_value', { ascending: true }) // Lower is better
          .limit(5);

        if (userScores && userScores.length > 0) {
          // Calculate average of available scores (could be less than 5)
          const sum = userScores.reduce((acc, s) => acc + s.score_value, 0);
          userBestScore = sum / userScores.length;
        }
      } else {
        // For other tests, use best single score
        const { data: userScores } = await supabase
          .from('scores')
          .select('score_value')
          .eq('test_slug', testSlug)
          .eq('user_id', userId)
          .order('score_value', { ascending: gameMeta.lowerIsBetter })
          .limit(1);

        if (userScores && userScores.length > 0) {
          userBestScore = userScores[0].score_value;
        }
      }
    }

    // Calculate statistics for normal distribution curve
    const totalScores = filteredScores.length;
    const scores = filteredScores.map(s => s.score_value);

    // Get the max score from the leaderboard (best score)
    const { data: topScore } = await supabase
      .from('scores')
      .select('score_value')
      .eq('test_slug', testSlug)
      .order('score_value', { ascending: gameMeta.lowerIsBetter })
      .limit(1);

    const maxLeaderboardScore = topScore && topScore.length > 0 ? topScore[0].score_value : null;

    // Calculate mean and standard deviation
    const mean = scores.reduce((sum, val) => sum + val, 0) / totalScores;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totalScores;
    const stdDev = Math.sqrt(variance);

    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    // Handle case where there's no range of scores to create a distribution
    if (minScore >= maxScore || stdDev === 0) {
      return NextResponse.json({
        data: {
          distribution: [],
          userPercentile,
          userScore: userBestScore,
          totalScores,
          mean,
          stdDev: 0,
          maxLeaderboardScore,
        },
      });
    }

    // Generate smooth normal distribution curve
    // For reaction-time, use 0ms lower bound, but extend upper bound to fit data and user score
    // For aim-trainer, use fixed bounds: 0ms to 225ms
    // For other games, use the data range with max leaderboard score as upper bound
    let lowerBound: number;
    let upperBound: number;

    if (testSlug === 'reaction-time') {
      lowerBound = 0;
      // Use the maximum of: 500ms (default), maxScore, or userBestScore
      const maxBound = Math.max(500, maxScore, userBestScore || 0);
      upperBound = maxBound;
    } else if (testSlug === 'aim-trainer') {
      lowerBound = 0;
      upperBound = 225;
    } else {
      lowerBound = minScore;
      upperBound = maxLeaderboardScore || maxScore;
    }

    const numPoints = 100; // More points for smoother curve
    const distribution = [];

    // Normal distribution PDF function
    const normalPDF = (x: number, mu: number, sigma: number) => {
      return (1 / (sigma * Math.sqrt(2 * Math.PI))) *
             Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2));
    };

    // Generate points along the normal distribution curve
    for (let i = 0; i <= numPoints; i++) {
      const x = lowerBound + (i / numPoints) * (upperBound - lowerBound);
      const y = normalPDF(x, mean, stdDev);
      // Scale the frequency to match total scores for better visualization
      const scaledFrequency = y * totalScores * ((upperBound - lowerBound) / numPoints);

      distribution.push({
        score: x,
        frequency: scaledFrequency,
      });
    }

    // Calculate user's percentile if we have their score (using filtered scores)
    if (userBestScore !== null) {
      let scoresWorse;
      if (gameMeta.lowerIsBetter) {
        // For lower-is-better, "worse" scores are higher
        scoresWorse = filteredScores.filter(s => s.score_value > userBestScore).length;
      } else {
        // For higher-is-better, "worse" scores are lower
        scoresWorse = filteredScores.filter(s => s.score_value < userBestScore).length;
      }
      userPercentile = (scoresWorse / totalScores) * 100;
    }

    return NextResponse.json({
      data: {
        distribution,
        userPercentile,
        userScore: userBestScore,
        totalScores,
        mean,
        stdDev,
        maxLeaderboardScore,
      }
    });
  } catch (error) {
    console.error('Error fetching percentile stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch percentile statistics' },
      { status: 500 }
    );
  }
}
