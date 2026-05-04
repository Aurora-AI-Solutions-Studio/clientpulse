export const dynamic = 'force-dynamic';
/**
 * Stripe Billing Portal Session Creation API
 * POST /api/stripe/portal
 *
 * Opens the customer-facing Stripe Billing Portal so subscribers can manage
 * their subscription (upgrade/downgrade/cancel/invoice history) without us
 * building a full billing UI. Sprint 8A pricing work.
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

export async function POST(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, serviceClient: supabase } = auth.ctx;

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 404 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/dashboard/upgrade`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 },
    );
  }
}
