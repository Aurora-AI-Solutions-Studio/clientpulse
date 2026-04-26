export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';
import { resolveTier, tierDisplayName } from '@/lib/tiers';
import { ensureAgencyForUser } from '@/lib/agency/bootstrap';
import { stripe } from '@/lib/stripe';
import { getPlanByPriceId } from '@/lib/stripe-config';

// GET /api/me
//
// Session profile summary. Used by the dashboard layout to decide
// onboarding redirect, by the sidebar to render the real tier badge
// (instead of hardcoded "Free"), and by the onboarding wizard to
// check subscription status before advancing.
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service client for profile reads. We've already verified the user
    // via auth.getUser() above; the .eq('id', user.id) filter scopes the
    // query to their row alone. This bypasses any RLS context drift caused
    // by JWT/cookie issues. (Previous bug: RLS returned null even when the
    // row existed, causing /api/me to 404 silently.)
    const profileService = createServiceClient();
    let { data: profile } = await profileService
      .from('profiles')
      .select(
        'agency_id, subscription_plan, subscription_status, stripe_customer_id, onboarding_completed_at, full_name, email, has_suite_access'
      )
      .eq('id', user.id)
      .maybeSingle();

    // Self-heal: backfill agency for users whose accounts predate the
    // handle_new_user trigger (migration 20260411). Idempotent.
    if (!profile?.agency_id) {
      await ensureAgencyForUser(supabase, {
        userId: user.id,
        email: profile?.email ?? user.email ?? null,
        fullName: profile?.full_name ?? null,
      });
      const { data: healed } = await profileService
        .from('profiles')
        .select(
          'agency_id, subscription_plan, subscription_status, stripe_customer_id, onboarding_completed_at, full_name, email, has_suite_access'
        )
        .eq('id', user.id)
        .maybeSingle();
      profile = healed;
    }

    if (!profile) {
      return NextResponse.json({ error: 'No profile' }, { status: 404 });
    }

    // Self-heal subscription state from Stripe. If profile says 'free' but
    // there's a stripe_customer_id, the webhook either didn't fire or signature
    // verification failed. Query Stripe directly and reconcile. Cheap (~150ms)
    // and idempotent.
    if (
      profile.stripe_customer_id &&
      (profile.subscription_plan === 'free' || profile.subscription_plan == null)
    ) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'active',
          limit: 1,
        });
        const sub = subs.data[0];
        if (sub) {
          const priceId = sub.items.data[0]?.price.id;
          const plan = priceId ? getPlanByPriceId(priceId) : null;
          if (plan) {
            const service = createServiceClient();
            await service
              .from('profiles')
              .update({
                subscription_plan: plan,
                subscription_status: sub.status,
              })
              .eq('id', user.id);
            profile = { ...profile, subscription_plan: plan, subscription_status: sub.status };
          }
        }
      } catch (err) {
        console.error('[/api/me] stripe reconcile failed', err);
        // Non-fatal — fall through to original profile state.
      }
    }

    const tier = resolveTier({ subscription_plan: profile.subscription_plan });
    return NextResponse.json({
      userId: user.id,
      email: profile.email ?? user.email ?? null,
      fullName: profile.full_name ?? null,
      agencyId: profile.agency_id ?? null,
      subscriptionPlan: profile.subscription_plan ?? 'free',
      subscriptionStatus: profile.subscription_status ?? 'active',
      stripeCustomerId: profile.stripe_customer_id ?? null,
      onboardingCompletedAt: profile.onboarding_completed_at ?? null,
      tier,
      tierLabel: tierDisplayName(tier),
      // Aurora Suite access — read directly from the dedicated
      // profiles.has_suite_access column. Set true only for buyers of
      // the Aurora Suite bundle ($999/mo). Agency-tier-only customers
      // do NOT get cross-product access.
      suiteAccess: Boolean((profile as { has_suite_access?: boolean }).has_suite_access),
    });
  } catch (error) {
    console.error('[/api/me GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
