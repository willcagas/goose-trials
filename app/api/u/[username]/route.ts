/**
 * API Route: Get Public User Profile
 * GET /api/u/[username]
 * 
 * Returns profile data, highlights, and university info for a public profile
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getProfileByUsername } from '@/lib/db/profiles';
import { getUserHighlightsWithRanks } from '@/lib/db/user-highlights';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    
    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Fetch profile by username
    const profile = await getProfileByUsername(username);
    
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Fetch user highlights (best scores with ranks)
    const highlights = await getUserHighlightsWithRanks(profile.id, 6);

    // Fetch university info if user has one
    let universityInfo = null;
    if (profile.university_id) {
      const supabase = await createClient();
      const { data: university, error: uniError } = await supabase
        .from('universities')
        .select('id, name, country, alpha_two_code')
        .eq('id', profile.university_id)
        .single();

      if (!uniError && university) {
        universityInfo = university;
      }
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        avatar_url: profile.avatar_url,
        university_id: profile.university_id,
      },
      highlights,
      universityInfo,
    });
  } catch (error) {
    console.error('Unexpected error in /api/u/[username]:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

