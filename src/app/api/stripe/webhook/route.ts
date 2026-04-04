export const dynamic = 'force-dynamic';
/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 *
 * Handles the following events:
 * - checkout.session.completed: User completed checkout
 * - customer.subscription.updated: Subscription changed
 * - customer.subscription.deleted: Subscription canceled
 * - invoice.paid: Invoice payment succeeded
 * - invoice.payment_failed: Invoice payment failed
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { getPlanByPriceId } from '@/lib/stripe-config';

// Store raw body for signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
    } catch (signatureError) {
      console.error('Webhook signature verification failed:', signatureError);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        const customerId = session.customer as string;

        if (!userId) {
          console.warn('checkout.session.completed missing userId');
          break;
        }

        // Update user subscription in Supabase
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_plan: plan || 'starter',
            subscription_status: 'active',
            stripe_customer_id: customerId,
            subscription_start_date: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update user subscription:', updateError);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const items = subscription.items.data;

        if (!items || items.length === 0) break;

        const priceId = items[0].price.id;
        const plan = getPlanByPriceId(priceId);

        if (!plan) {
          console.warn('Unknown price ID:', priceId);
          break;
        }

        // Find user by stripe customer ID
        const { data: profiles, error: queryError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1);

        if (queryError || !profiles || profiles.length === 0) {
          console.warn('User not found for customer:', customerId);
          break;
        }

        const userId = profiles[0].id;

        // Update subscription details
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_plan: plan,
            subscription_status: status,
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update subscription:', updateError);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        // Find user and downgrade to free
        const { data: profiles, error: queryError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1);

        if (queryError || !profiles || profiles.length === 0) {
          break;
        }

        const userId = profiles[0].id;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_plan: 'free',
            subscription_status: 'canceled',
            subscription_end_date: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update subscription on deletion:', updateError);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;

        // Find user
        const { data: profiles, error: queryError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1);

        if (queryError || !profiles || profiles.length === 0) {
          break;
        }

        // Create payment record if needed
        // This could be extended to track payment history
        console.log('Invoice paid for customer:', customerId, 'Amount:', invoice.amount_paid);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;

        // Find user and log payment failure
        const { data: profiles, error: queryError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1);

        if (queryError || !profiles || profiles.length === 0) {
          break;
        }

        console.warn(
          'Invoice payment failed for customer:',
          customerId,
          'Amount:',
          invoice.amount_due
        );
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
