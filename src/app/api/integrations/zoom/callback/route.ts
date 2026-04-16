export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeZoomCode, getZoomUserInfo } from '@/lib/agents/zoom-intelligence-agent';
import { encryptToken } from '@/lib/crypto/integration-tokens';

/**
 * GET /api/integrations/zoom/callback
 * OAuth callback handler for Zoom
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

    // Verify state
    let stateData: { provider: string; returnTo: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=zoom_invalid_state', request.url)
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
    const clientId = process.env.ZOOM_CLIENT_ID!;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/zoom/callback`;

    const tokens = await exchangeZoomCode(code, clientId, clientSecret, redirectUri);

    // Get Zoom user info
    const zoomUser = await getZoomUserInfo(tokens.access_token);

    // Upsert connection
    const { error: upsertError } = await supabase
      .from('integration_connections')
      .upsert(
        {
          agency_id: profile.agency_id,
          user_id: user.id,
          provider: 'zoom',
          status: 'connected',
          access_token: encryptToken(tokens.access_token),
          refresh_token: encryptToken(tokens.refresh_token),
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          scopes: tokens.scope ? tokens.scope.split(' ') : [],
          account_email: zoomUser.email || user.email,
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
