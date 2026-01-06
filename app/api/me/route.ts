// Me API route - Returns current user profile data
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const NOT_LOGGED_IN_RESPONSE = {
  isLoggedIn: false,
  userId: null,
  universityId: null,
  username: null,
  avatarUrl: null,
  countryCode: null,
  countryName: null,
};

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user (verifies with Supabase Auth server)
    let user = null;
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) {
        // Handle invalid refresh token gracefully - treat as not logged in
        if (userError.code === 'refresh_token_not_found' || 
            userError.message?.includes('Refresh Token')) {
          console.warn('Invalid refresh token, treating as logged out');
          return NextResponse.json(NOT_LOGGED_IN_RESPONSE);
        }
        // For other auth errors, also treat as not logged in
        return NextResponse.json(NOT_LOGGED_IN_RESPONSE);
      }
      user = data?.user;
    } catch (authError) {
      // Catch any auth errors and treat as not logged in
      console.warn('Auth error in /api/me:', authError);
      return NextResponse.json(NOT_LOGGED_IN_RESPONSE);
    }
    
    if (!user) {
      // Not authenticated
      return NextResponse.json(NOT_LOGGED_IN_RESPONSE);
    }

    const userId = user.id;

    // Fetch profile data from profiles table with university info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id, 
        username, 
        avatar_url, 
        university_id,
        universities (
          alpha_two_code,
          country
        )
      `)
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      // Profile doesn't exist yet, return user ID but null for profile fields
      return NextResponse.json({
        isLoggedIn: true,
        userId,
        universityId: null,
        username: null,
        avatarUrl: null,
        countryCode: null,
        countryName: null,
      });
    }

    // Extract university info from the join
    // Supabase returns the joined data - it can be an object or null
    const universities = profile.universities as unknown;
    let countryCode: string | null = null;
    let countryName: string | null = null;
    
    if (universities && typeof universities === 'object' && !Array.isArray(universities)) {
      const uni = universities as { alpha_two_code?: string | null; country?: string | null };
      countryCode = uni.alpha_two_code || null;
      countryName = uni.country || null;
    }

    return NextResponse.json({
      isLoggedIn: true,
      userId: profile.id,
      universityId: profile.university_id || null,
      username: profile.username || null,
      avatarUrl: profile.avatar_url || null,
      countryCode,
      countryName,
    });
  } catch (error) {
    console.error('Error in /api/me:', error);
    return NextResponse.json(NOT_LOGGED_IN_RESPONSE, { status: 500 });
  }
}