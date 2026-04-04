export const dynamic = 'force-dynamic';
/**
 * Stripe Connect OAuth Initialization
 * POST /api/stripe/connect
 *
 * Initiates OAuth flow to connect agency's Stripe account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user's subscription level (only Agency plan can use Connect)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (profile.subscription_plan !== 'agency') {
      return NextResponse.json(
        { error: 'Stripe Connect is only available on the Agency plan' },
        { status: 403 }
      );
    }

    // Generate OAuth URL for Stripe Connect
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
        userId: user.id,
        timestamp: Date.now(),
      })
    ).toString('base64');

    // Stripe Connect OAuth URL
    const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('state', state);
    oauthUrl.searchParams.set('stripe_user[email]', user.email || '');
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

    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || user.id !== stateData.userId) {
      return NextResponse.redirect(
        new URL('/dashboard?connect_error=unauthorized', request.url)
      );
    }

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

    // Store connected account ID in Supabase
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_connect_account_id: stripeUserId,
      })
      .eq('id', user.id);

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
