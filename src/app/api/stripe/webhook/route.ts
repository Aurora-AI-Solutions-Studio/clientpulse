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
import { createServiceClient } from '@/lib/supabase/service';
import { getPlanByPriceId } from '@/lib/stripe-config';
import { isSuiteSubscription, shouldGrantSuiteAccess } from '@/lib/stripe/suite-detect';
import { applySuiteAccess } from '@/lib/stripe/suite-access';
import type Stripe from 'stripe';

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

    const supabase = createServiceClient();
    
    // §11.7 Idempotency guard — reject duplicate event deliveries.
    // Stripe retries webhooks aggressively (up to 3 days). Without this, every
    // retry would re-apply subscription mutations. event_id has a UNIQUE PK
    // constraint in stripe_webhook_events; the duplicate INSERT throws 23505.
    const { error: idempotencyError } = await supabase
      .from('stripe_webhook_events')
      .insert({ event_id: event.id, event_type: event.type });

    if (idempotencyError) {
      if (idempotencyError.code === '23505') {
        // Already processed (or in flight). 200 so Stripe stops retrying.
        return NextResponse.json({ received: true, idempotent: true });
      }
      console.error('Idempotency insert failed:', idempotencyError);
      return NextResponse.json(
        { error: 'Idempotency check failed' },
        { status: 500 }
      );
    }

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
            subscription_plan: plan || 'solo',
            subscription_status: 'active',
            stripe_customer_id: customerId,
            subscription_start_date: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update user subscription:', updateError);
        }

        // Suite-access flip — when the buyer's subscription is on the
        // Suite SKU, mirror has_suite_access=true on local + sister.
        if (session.subscription) {
          try {
            const sub = (await stripe.subscriptions.retrieve(
              session.subscription as string,
            )) as unknown as Stripe.Subscription;
            if (isSuiteSubscription(sub) && session.customer_details?.email) {
              await applySuiteAccess({
                local: supabase,
                email: session.customer_details.email,
                localUserId: userId,
                grant: shouldGrantSuiteAccess(sub),
              });
            }
          } catch (err) {
            console.error('[webhook] Suite-access flip on checkout threw:', err);
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const items = subscription.items.data;

        if (!items || items.length === 0) break;

        const priceId = items[0].price.id;
        // Suite SKU isn't in CP's stripe-config.ts (it's an RF-issued
        // product), so getPlanByPriceId returns null. That's fine — we
        // skip the per-tier plan update for Suite events and only fire
        // the has_suite_access flip below. The buyer's subscription_plan
        // stays at whatever they had before (most often a CP tier they
        // upgraded from).
        const plan = getPlanByPriceId(priceId);
        const isSuite = isSuiteSubscription(subscription as unknown as Stripe.Subscription);

        if (!plan && !isSuite) {
          console.warn('Unknown price ID:', priceId);
          break;
        }

        // Find user by stripe customer ID
        const { data: profiles, error: queryError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1);

        if (queryError) {
          console.warn('Profile lookup failed for customer:', customerId, queryError);
        }

        const userId = profiles && profiles.length > 0 ? profiles[0].id : null;

        // Skip the tier write for Suite — only update for known CP plans.
        if (plan && userId) {
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
        }

        // Suite-access flip — fetch customer email + apply on local + sister.
        // Runs even when the local profile lookup missed, because the sister
        // RF profile may still exist and need the flip.
        if (isSuite) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            const email = (customer as Stripe.Customer).email ?? null;
            if (email) {
              await applySuiteAccess({
                local: supabase,
                email,
                localUserId: userId,
                grant: shouldGrantSuiteAccess(subscription as unknown as Stripe.Subscription),
              });
            } else {
              console.warn('[webhook] Suite event but customer has no email — skipping flip:', customerId);
            }
          } catch (err) {
            console.error('[webhook] Suite-access flip threw:', err);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const isSuite = isSuiteSubscription(subscription as unknown as Stripe.Subscription);

        // Find user and downgrade to free
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1);

        const userId = profiles && profiles.length > 0 ? profiles[0].id : null;

        // Only set to 'free' for non-Suite cancellations. Suite leaves
        // the underlying CP plan alone — the buyer might still be on
        // their Pro/Agency tier, only Suite access goes away.
        if (userId && !isSuite) {
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
        }

        // Suite revoke — flip both profiles back to has_suite_access=false.
        if (isSuite) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            const email = (customer as Stripe.Customer).email ?? null;
            if (email) {
              await applySuiteAccess({
                local: supabase,
                email,
                localUserId: userId,
                grant: false,
              });
            } else {
              console.warn('[webhook] Suite delete but customer has no email — skipping flip:', customerId);
            }
          } catch (err) {
            console.error('[webhook] Suite-access revoke threw:', err);
          }
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

    // §11.7 Mark event as processed — completes the idempotency lifecycle.
    await supabase
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
