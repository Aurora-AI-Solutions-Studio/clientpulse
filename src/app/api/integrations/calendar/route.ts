export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleCalendarAuthUrl } from '@/lib/agents/calendar-intelligence-agent';

/**
 * GET /api/integrations/calendar
 * Returns Google Calendar OAuth URL to initiate connection
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/calendar/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Google Calendar integration not configured. Set GOOGLE_CLIENT_ID.' },
        { status: 503 }
      );
    }

    // Generate state token for CSRF protection
    const state = Buffer.from(
      JSON.stringify({
        provider: 'google_calendar',
        timestamp: Date.now(),
        returnTo: request.nextUrl.searchParams.get('returnTo') || '/dashboard/settings',
      })
    ).toString('base64url');

    const authUrl = buildGoogleCalendarAuthUrl(clientId, redirectUri, state);

    return NextResponse.json({ authUrl, state });
  } catch (error) {
    console.error('Error generating calendar auth URL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
