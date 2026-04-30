export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeZoomCode, getZoomUserInfo } from '@/lib/agents/zoom-intelligence-agent';
import { encryptToken } from '@/lib/crypto/integration-tokens';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

/**
 * GET /api/integrations/zoom/callback
 * OAuth callback handler for Zoom.
 *
 * Auth + agency resolution goes through getAuthedContext so we don't get
 * bitten by the auth-client RLS context drift bug (Apr 25/26 incident
 * documented in get-authed-context.ts) — the auth client occasionally
 * returns null on profile lookup even for valid sessions, which silently
 * sent users to ?error=no_agency. Fix: resolve agency_id via the service
 * client and persist the connection via the service client too. The user
 * is still authenticated via the auth client up-front; the service-client
 * write is constrained to (agency_id, user_id) pairs we already verified.
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('Zoom OAuth error:', error);
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=zoom_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=zoom_missing_code', request.url)
      );
    }

    let stateData: { provider: string; returnTo: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=zoom_invalid_state', request.url)
      );
    }

    const auth = await getAuthedContext();
    if (!auth.ok) {
      return NextResponse.redirect(
        new URL('/auth/login?error=unauthorized', request.url)
      );
    }
    const { userId, email, agencyId, serviceClient } = auth.ctx;

    const clientId = process.env.ZOOM_CLIENT_ID!;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/zoom/callback`;

    const tokens = await exchangeZoomCode(code, clientId, clientSecret, redirectUri);
    const zoomUser = await getZoomUserInfo(tokens.access_token);

    const { error: upsertError } = await serviceClient
      .from('integration_connections')
      .upsert(
        {
          agency_id: agencyId,
          user_id: userId,
          provider: 'zoom',
          status: 'connected',
          access_token: encryptToken(tokens.access_token),
          refresh_token: encryptToken(tokens.refresh_token),
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          scopes: tokens.scope ? tokens.scope.split(' ') : [],
          account_email: zoomUser.email || email,
          account_name: zoomUser.display_name || `${zoomUser.first_name} ${zoomUser.last_name}`,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agency_id,user_id,provider' }
      );

    if (upsertError) {
      console.error('Error saving Zoom connection:', upsertError);
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=zoom_save_failed', request.url)
      );
    }

    return NextResponse.redirect(
      new URL(stateData.returnTo + '?connected=zoom', request.url)
    );
  } catch (err) {
    console.error('Zoom callback error:', err);
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=zoom_failed', request.url)
    );
  }
}
