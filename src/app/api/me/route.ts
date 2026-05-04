export const dynamic = 'force-dynamic';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { NextRequest, NextResponse } from 'next/server';
import { resolveTier, tierDisplayName } from '@/lib/tiers';
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
    // getAuthedContext handles auth verification, profile lookup via
    // service client (bypassing RLS context drift), and self-heal of
    // missing agency_id via ensureAgencyForUser.
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, agencyId, serviceClient: profileService } = auth.ctx;

    // Re-read the full profile row — getAuthedContext only exposes a
    // narrow projection. We need stripe_customer_id, has_suite_access,
    // onboarding_completed_at, etc.
    let { data: profile } = await profileService
      .from('profiles')
      .select(
        'agency_id, subscription_plan, subscription_status, stripe_customer_id, onboarding_completed_at, full_name, email, has_suite_access'
      )
      .eq('id', userId)
      .maybeSingle();

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
            await profileService
              .from('profiles')
              .update({
                subscription_plan: plan,
                subscription_status: sub.status,
              })
              .eq('id', userId);
            profile = { ...profile, subscription_plan: plan, subscription_status: sub.status };
          }
        }
      } catch (err) {
        console.error('[/api/me] stripe reconcile failed', err);
        // Non-fatal — fall through to original profile state.
      }
    }

    const tier = resolveTier({ subscription_plan: profile.subscription_plan });
    const suiteAccess = Boolean((profile as { has_suite_access?: boolean }).has_suite_access);
    // Suite buyers see "Suite" instead of their underlying CP tier in
    // the sidebar plan badge — surfaces the cross-product entitlement
    // they actually paid for instead of the per-product tier they
    // happened to slot into.
    const tierLabel = suiteAccess ? 'Suite' : tierDisplayName(tier);
    return NextResponse.json({
      userId,
      email: profile.email ?? null,
      fullName: profile.full_name ?? null,
      agencyId: profile.agency_id ?? agencyId,
      subscriptionPlan: profile.subscription_plan ?? 'free',
      subscriptionStatus: profile.subscription_status ?? 'active',
      stripeCustomerId: profile.stripe_customer_id ?? null,
      onboardingCompletedAt: profile.onboarding_completed_at ?? null,
      tier,
      tierLabel,
      suiteAccess,
    });
  } catch (error) {
    console.error('[/api/me GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
