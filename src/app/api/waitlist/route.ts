import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase client (avoids build-time env var errors)
let _supabase: SupabaseClient | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, source, utm_source, utm_medium, utm_campaign } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Get referrer and IP for analytics
    const referrer = request.headers.get('referer') || null;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

    const { data, error } = await getSupabase()
      .from('waitlist_signups')
      .upsert(
        {
          email: email.toLowerCase().trim(),
          source: source || 'landing_page',
          utm_source: utm_source || null,
          utm_medium: utm_medium || null,
          utm_campaign: utm_campaign || null,
          referrer,
          ip_address: ip,
        },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (error) {
      console.error('Waitlist signup error:', error);
      return NextResponse.json(
        { error: 'Failed to save signup. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "You're on the list!", id: data.id },
      { status: 201 }
    );
  } catch (err) {
    console.error('Waitlist API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
