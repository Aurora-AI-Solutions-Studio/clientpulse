export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCalendarCode } from '@/lib/agents/calendar-intelligence-agent';

/**
 * GET /api/integrations/calendar/callback
 * OAuth callback handler for Google Calendar
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('Google Calendar OAuth error:', error);
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=calendar_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=calendar_missing_code', request.url)
      );
    }

    // Verify state
    let stateData: { provider: string; returnTo: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=calendar_invalid_state', request.url)
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(
        new URL('/auth/login?error=unauthorized', request.url)
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (!profile?.agency_id) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=no_agency', request.url)
      );
    }

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/calendar/callback`;

    const tokens = await exchangeCalendarCode(code, clientId, clientSecret, redirectUri);

    // Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    // Upsert connection
    const { error: upsertError } = await supabase
      .from('integration_connections')
      .upsert(
        {
          agency_id: profile.agency_id,
          user_id: user.id,
          provider: 'google_calendar',
          status: 'connected',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          scopes: [
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events.readonly',
          ],
          account_email: userInfo.email || user.email,
          account_name: userInfo.name || undefined,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agency_id,user_id,provider' }
      );

    if (upsertError) {
      console.error('Error saving calendar connection:', upsertError);
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=calendar_save_failed', request.url)
      );
    }

    return NextResponse.redirect(
      new URL(stateData.returnTo + '?connected=google_calendar', request.url)
    );
  } catch (err) {
    console.error('Calendar callback error:', err);
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=calendar_failed', request.url)
    );
  }
}
