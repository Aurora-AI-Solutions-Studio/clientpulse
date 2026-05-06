// Sprint 7.8 — Suite SKU detection for the webhook handler.
//
// Mirror of contentpulse/lib/stripe/suite-detect.ts. The Suite SKU is one
// product (single Stripe product id) sold from either ContentPulse or CP
// checkout. Two prices live under it (monthly + annual). Both
// products' webhook handlers read from the SAME env vars so the
// detection is symmetric.
//
// Pure data — no Supabase, no Stripe API calls. Unit-testable in
// isolation.

import type Stripe from 'stripe';

/** Status values for which a Suite subscription should grant access. */
const SUITE_GRANT_STATUSES = new Set<string>(['active', 'trialing']);

export function getSuitePriceIds(): Set<string> {
  const ids = new Set<string>();
  if (process.env.STRIPE_SUITE_PRICE_ID) ids.add(process.env.STRIPE_SUITE_PRICE_ID);
  if (process.env.STRIPE_SUITE_ANNUAL_PRICE_ID) ids.add(process.env.STRIPE_SUITE_ANNUAL_PRICE_ID);
  // Sandbox fallbacks — the canonical live IDs from ContentPulse's
  // SUITE_LAUNCH_PLAN config. Allows webhook detection to keep working
  // in tests + dev without env vars set.
  if (ids.size === 0) {
    ids.add('price_1TOg21LER55AcgjYgO4wGltx');
    ids.add('price_1TOg24LER55AcgjYF0zC8mha');
  }
  return ids;
}

/** Return the price id of the first item on a subscription, or null. */
export function firstPriceId(
  sub: Stripe.Subscription | { items?: { data?: Array<{ price?: { id?: string } }> } },
): string | null {
  const item = (sub as { items?: { data?: Array<{ price?: { id?: string } }> } }).items?.data?.[0];
  return item?.price?.id ?? null;
}

/** True if the subscription's first item points at a Suite price. */
export function isSuiteSubscription(
  sub: Stripe.Subscription | { items?: { data?: Array<{ price?: { id?: string } }> } },
): boolean {
  const priceId = firstPriceId(sub);
  if (!priceId) return false;
  return getSuitePriceIds().has(priceId);
}

/**
 * True if a webhook event for this subscription should result in
 * `has_suite_access = true`. False = the user should NOT have suite
 * (cancellation, past-due, unpaid, etc — the revoke path).
 */
export function shouldGrantSuiteAccess(
  sub:
    | Stripe.Subscription
    | { status?: string; items?: { data?: Array<{ price?: { id?: string } }> } },
): boolean {
  if (!isSuiteSubscription(sub as Stripe.Subscription)) return false;
  const status = (sub as { status?: string }).status ?? '';
  return SUITE_GRANT_STATUSES.has(status);
}
