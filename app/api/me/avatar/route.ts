import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isValidAvatarId, getAvatarUrl } from '@/lib/avatars';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { avatarId } = await request.json();

    // Validate avatar ID
    if (!avatarId || !isValidAvatarId(avatarId)) {
      return NextResponse.json(
        { error: 'Invalid avatar ID' },
        { status: 400 }
      );
    }

    // Get the full avatar URL
    const avatarUrl = getAvatarUrl(avatarId);

    // Update the user's avatar_url in the profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (updateError) {
      console.error('Error updating avatar:', updateError);
      return NextResponse.json(
        { error: 'Failed to update avatar' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      avatarUrl,
    });
  } catch (error) {
    console.error('Unexpected error in /api/me/avatar:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
