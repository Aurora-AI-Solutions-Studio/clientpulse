export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeGmailCode } from '@/lib/agents/email-intelligence-agent';
import { encryptToken } from '@/lib/crypto/integration-tokens';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

/**
 * GET /api/integrations/gmail/callback
 * OAuth callback handler for Gmail.
 *
 * Auth + agency resolution goes through getAuthedContext + service-client
 * upsert — see the parallel comment in zoom/callback/route.ts for the
 * RLS-context-drift rationale.
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=gmail_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=gmail_missing_code', request.url)
      );
    }

    let stateData: { provider: string; returnTo: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=gmail_invalid_state', request.url)
      );
    }

    const auth = await getAuthedContext();
    if (!auth.ok) {
      return NextResponse.redirect(
        new URL('/auth/login?error=unauthorized', request.url)
      );
    }
    const { userId, email, agencyId, serviceClient } = auth.ctx;

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/gmail/callback`;

    const tokens = await exchangeGmailCode(code, clientId, clientSecret, redirectUri);

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    const { error: upsertError } = await serviceClient
      .from('integration_connections')
      .upsert(
        {
          agency_id: agencyId,
          user_id: userId,
          provider: 'gmail',
          status: 'connected',
          access_token: encryptToken(tokens.access_token),
          refresh_token: encryptToken(tokens.refresh_token),
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.metadata',
          ],
          account_email: userInfo.email || email,
          account_name: userInfo.name || undefined,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agency_id,user_id,provider' }
      );

    if (upsertError) {
      console.error('Error saving Gmail connection:', upsertError);
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=gmail_save_failed', request.url)
      );
    }

    return NextResponse.redirect(
      new URL(stateData.returnTo + '?connected=gmail', request.url)
    );
  } catch (err) {
    console.error('Gmail callback error:', err);
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=gmail_failed', request.url)
    );
  }
}
