// Me API route - Returns current user profile data
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user (verifies with Supabase Auth server)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      // Not authenticated
      return NextResponse.json({
        isLoggedIn: false,
        userId: null,
        universityId: null,
        username: null,
        avatarUrl: null,
      });
    }

    const userId = user.id;

    // Fetch profile data from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, university_id')
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
      });
    }

    return NextResponse.json({
      isLoggedIn: true,
      userId: profile.id,
      universityId: profile.university_id || null,
      username: profile.username || null,
      avatarUrl: profile.avatar_url || null,
    });
  } catch (error) {
    console.error('Error in /api/me:', error);
    return NextResponse.json(
      {
        isLoggedIn: false,
        userId: null,
        universityId: null,
        username: null,
        avatarUrl: null,
      },
      { status: 500 }
    );
  }
}