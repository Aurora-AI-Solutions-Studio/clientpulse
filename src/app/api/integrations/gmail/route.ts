export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { buildGmailAuthUrl } from '@/lib/agents/email-intelligence-agent';

/**
 * GET /api/integrations/gmail
 * Returns Gmail OAuth URL to initiate connection
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/gmail/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Gmail integration not configured. Set GOOGLE_CLIENT_ID.' },
        { status: 503 }
      );
    }

    const state = Buffer.from(
      JSON.stringify({
        provider: 'gmail',
        timestamp: Date.now(),
        returnTo: request.nextUrl.searchParams.get('returnTo') || '/dashboard/settings',
      })
    ).toString('base64url');

    const authUrl = buildGmailAuthUrl(clientId, redirectUri, state);

    return NextResponse.json({ authUrl, state });
  } catch (error) {
    console.error('Error generating Gmail auth URL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
