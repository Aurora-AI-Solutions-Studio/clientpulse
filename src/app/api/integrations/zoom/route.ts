export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { buildZoomAuthUrl } from '@/lib/agents/zoom-intelligence-agent';

/**
 * GET /api/integrations/zoom
 * Returns Zoom OAuth URL to initiate connection
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/zoom/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Zoom integration not configured. Set ZOOM_CLIENT_ID.' },
        { status: 503 }
      );
    }

    // Generate state token for CSRF protection
    const state = Buffer.from(
      JSON.stringify({
        provider: 'zoom',
        timestamp: Date.now(),
        returnTo: request.nextUrl.searchParams.get('returnTo') || '/dashboard/settings',
      })
    ).toString('base64url');

    const authUrl = buildZoomAuthUrl(clientId, redirectUri, state);

    return NextResponse.json({ authUrl, state });
  } catch (error) {
    console.error('Error generating Zoom auth URL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
