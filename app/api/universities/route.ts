/**
 * API Route: Get University Info
 * GET /api/universities?id=<universityId>
 * GET /api/universities?ids=<id1,id2,id3> (comma-separated)
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const ids = searchParams.get('ids');

    // Handle single ID request
    if (id) {
      const { data, error } = await supabase
        .from('universities')
        .select('id, name, country, alpha_two_code')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching university:', error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ data });
    }

    // Handle multiple IDs request
    if (ids) {
      const idArray = ids.split(',').filter(Boolean);
      
      if (idArray.length === 0) {
        return NextResponse.json(
          { error: 'ids parameter cannot be empty' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('universities')
        .select('id, name, country, alpha_two_code')
        .in('id', idArray);

      if (error) {
        console.error('Error fetching universities:', error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ data: data || [] });
    }

    return NextResponse.json(
      { error: 'id or ids parameter is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Unexpected error in /api/universities:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
