export const dynamic = 'force-dynamic';
/**
 * Stripe Checkout Session Creation API
 * POST /api/stripe/checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { BillingInterval, getPriceIdForInterval, initializeStripePriceIds } from '@/lib/stripe-config';
import { SubscriptionPlan } from '@/types/stripe';

initializeStripePriceIds();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, interval } = body as { plan: SubscriptionPlan; interval?: BillingInterval };

    if (!plan || !['solo', 'pro', 'agency'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan parameter' },
        { status: 400 }
      );
    }

    const billingInterval: BillingInterval =
      interval === 'year' || interval === 'month' ? interval : 'month';

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

    let priceId: string;
    try {
      priceId = getPriceIdForInterval(plan, billingInterval);
    } catch {
      return NextResponse.json(
        { error: `No ${billingInterval === 'year' ? 'annual' : 'monthly'} price configured for plan ${plan}` },
        { status: 500 }
      );
    }

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
        interval: billingInterval,
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
