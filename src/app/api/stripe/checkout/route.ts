export const dynamic = 'force-dynamic';
/**
 * Stripe Checkout Session Creation API
 * POST /api/stripe/checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { getPriceId } from '@/lib/stripe-config';
import { SubscriptionPlan } from '@/types/stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan } = body as { plan: SubscriptionPlan };

    if (!plan || !['solo', 'pro', 'agency'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan parameter' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
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

    const priceId = getPriceId(plan);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      customer_email: user.email,
      success_url: `${appUrl}/(dashboard)?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${appUrl}/(dashboard)?cancel=true`,
      metadata: {
        userId: user.id,
        plan,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
