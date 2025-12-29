/**
 * API Route: Get Test Info
 * GET /api/tests?slug=<testSlug>
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'slug is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('tests')
      .select('slug, name, description, unit, lower_is_better')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('Error fetching test:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data ? [data] : [] });
  } catch (error) {
    console.error('Unexpected error in /api/tests:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
