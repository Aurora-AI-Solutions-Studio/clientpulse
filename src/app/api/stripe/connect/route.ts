export const dynamic = 'force-dynamic';
/**
 * Stripe Connect OAuth Initialization
 * POST /api/stripe/connect
 *
 * Initiates OAuth flow to connect agency's Stripe account
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

export async function POST(_request: NextRequest) {
  try {
    // Auth + profile resolution via service-client to avoid RLS-context drift
    // (see /api/slack/route.ts for the rationale).
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, email, subscriptionPlan } = auth.ctx;

    if (subscriptionPlan !== 'agency') {
      return NextResponse.json(
        { error: 'Stripe Connect is only available on the Agency plan' },
        { status: 403 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const clientId = process.env.STRIPE_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Stripe Connect not configured' },
        { status: 500 }
      );
    }

    // Create state parameter for security
    const state = Buffer.from(
      JSON.stringify({
        userId,
        timestamp: Date.now(),
      })
    ).toString('base64');

    // Stripe Connect OAuth URL
    const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('state', state);
    oauthUrl.searchParams.set('stripe_user[email]', email || '');
    oauthUrl.searchParams.set('stripe_user[url]', appUrl);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', 'read_write');

    return NextResponse.json({
      authorizationUrl: oauthUrl.toString(),
    });
  } catch (error) {
    console.error('Stripe Connect initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize Stripe Connect' },
      { status: 500 }
    );
  }
}

/**
 * Handle Stripe Connect OAuth callback
 * GET /api/stripe/connect?code=...&state=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard?connect_error=${error}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard?connect_error=missing_params', request.url)
      );
    }

    // Decode state
    let stateData: { userId: string; timestamp: number };
    try {
      stateData = JSON.parse(
        Buffer.from(state, 'base64').toString()
      );
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard?connect_error=invalid_state', request.url)
      );
    }

    // Verify state is fresh (within 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(
        new URL('/dashboard?connect_error=state_expired', request.url)
      );
    }

    const auth = await getAuthedContext();
    if (!auth.ok || auth.ctx.userId !== stateData.userId) {
      return NextResponse.redirect(
        new URL('/dashboard?connect_error=unauthorized', request.url)
      );
    }
    const { agencyId, serviceClient } = auth.ctx;

    // Exchange code for connected account ID
    // This would typically call Stripe's OAuth token endpoint
    // For now, we'll store the code and fetch details server-side
    const clientSecret = process.env.STRIPE_SECRET_KEY;
    const clientId = process.env.STRIPE_CLIENT_ID;

    if (!clientSecret || !clientId) {
      return NextResponse.redirect(
        new URL('/dashboard?connect_error=not_configured', request.url)
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      console.error('Failed to exchange authorization code');
      return NextResponse.redirect(
        new URL('/dashboard?connect_error=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json() as {
      stripe_user_id?: string;
      access_token?: string;
    };
    const stripeUserId = tokenData.stripe_user_id;

    if (!stripeUserId) {
      return NextResponse.redirect(
        new URL('/dashboard?connect_error=no_user_id', request.url)
      );
    }

    // Store connected account ID on the agency (column lives on `agencies`,
    // not `profiles`). Service client bypasses RLS-context drift.
    const { error: updateError } = await serviceClient
      .from('agencies')
      .update({
        stripe_connected_account_id: stripeUserId,
      })
      .eq('id', agencyId);

    if (updateError) {
      console.error('Failed to store connected account:', updateError);
      return NextResponse.redirect(
        new URL('/dashboard?connect_error=storage_failed', request.url)
      );
    }

    // Redirect back to dashboard with success
    return NextResponse.redirect(
      new URL('/dashboard?connect_success=true', request.url)
    );
  } catch (error) {
    console.error('Stripe Connect callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard?connect_error=unknown', request.url)
    );
  }
}
