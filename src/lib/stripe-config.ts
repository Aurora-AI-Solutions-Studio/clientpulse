/**
 * Stripe configuration and plan definitions
 *
 * Canonical CP launch pricing (Pricing Deep-Dive Apr 14, aligned with the
 * Agency Suite cross-sell narrative):
 *   Solo    — $59/mo  · $590/yr  ($49/mo billed annually — 2 months free)
 *   Pro     — $199/mo · $1,990/yr ($166/mo billed annually — 2 months free)
 *   Agency  — $799/mo · $7,990/yr ($666/mo billed annually — 2 months free)
 *
 * Annual discount = 2 months free = 10/12 multiplier = 16.7% off.
 */

import { SubscriptionPlan } from '@/types/stripe';

export type BillingInterval = 'month' | 'year';

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  description: string;
  price: number;           // USD / month when billed monthly
  priceYearly: number;     // USD / year when billed annually (10× monthly = 2 months free)
  currency: string;
  features: string[];
  productId: string;
  priceId?: string;        // Monthly Stripe price ID — loaded from env
  priceIdYearly?: string;  // Annual Stripe price ID — loaded from env
}

export const STRIPE_PLANS: Record<SubscriptionPlan, PlanConfig> = {
  solo: {
    id: 'solo',
    name: 'Solo',
    description: 'For freelancers and solo consultants',
    price: 59,
    priceYearly: 590,
    currency: 'usd',
    productId: 'prod_UGHPAJi3MzjPFU',
    features: [
      'Up to 3 clients',
      'Health Scores & Monday Brief',
      'Stripe sync',
      'Email notifications',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For growing agencies',
    price: 199,
    priceYearly: 1990,
    currency: 'usd',
    productId: 'prod_UGHPMZvDuwJwGR',
    features: [
      'Up to 10 clients',
      'Meeting Intelligence + Action Proposal Engine',
      'Upsell Detection',
      'Calendar & email sentiment',
      '3 seats',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    description: 'For multi-team agencies and enterprises',
    price: 799,
    priceYearly: 7990,
    currency: 'usd',
    productId: 'prod_UGHP5p2K5IaHoy',
    features: [
      'Unlimited clients',
      '8 seats',
      'Team dashboard + white-label reports',
      'Slack bot + Recursive Learning insights',
      'Full API access + unlimited MCP connections',
      'Priority support',
    ],
  },
};

/**
 * Load price IDs from environment variables.
 *
 * Monthly:  STRIPE_PRICE_ID_SOLO,        STRIPE_PRICE_ID_PRO,        STRIPE_PRICE_ID_AGENCY
 * Annual:   STRIPE_PRICE_ID_SOLO_YEARLY, STRIPE_PRICE_ID_PRO_YEARLY, STRIPE_PRICE_ID_AGENCY_YEARLY
 */
export function initializeStripePriceIds() {
  const solo = process.env.STRIPE_PRICE_ID_SOLO;
  const pro = process.env.STRIPE_PRICE_ID_PRO;
  const agency = process.env.STRIPE_PRICE_ID_AGENCY;

  if (solo) STRIPE_PLANS.solo.priceId = solo;
  if (pro) STRIPE_PLANS.pro.priceId = pro;
  if (agency) STRIPE_PLANS.agency.priceId = agency;

  const soloYearly = process.env.STRIPE_PRICE_ID_SOLO_YEARLY;
  const proYearly = process.env.STRIPE_PRICE_ID_PRO_YEARLY;
  const agencyYearly = process.env.STRIPE_PRICE_ID_AGENCY_YEARLY;

  if (soloYearly) STRIPE_PLANS.solo.priceIdYearly = soloYearly;
  if (proYearly) STRIPE_PLANS.pro.priceIdYearly = proYearly;
  if (agencyYearly) STRIPE_PLANS.agency.priceIdYearly = agencyYearly;
}

/**
 * Get the Stripe price ID for a plan + billing interval.
 * Falls back to monthly if interval is 'year' and no yearly ID is configured.
 */
export function getPriceIdForInterval(
  plan: SubscriptionPlan,
  interval: BillingInterval,
): string {
  const config = STRIPE_PLANS[plan];
  if (interval === 'year') {
    if (config.priceIdYearly) return config.priceIdYearly;
    throw new Error(
      `Annual price ID not configured for plan ${plan}. Set STRIPE_PRICE_ID_${plan.toUpperCase()}_YEARLY environment variable.`,
    );
  }
  if (!config.priceId) {
    throw new Error(
      `Price ID not configured for plan ${plan}. Set STRIPE_PRICE_ID_${plan.toUpperCase()} environment variable.`,
    );
  }
  return config.priceId;
}

/**
 * Back-compat monthly-only getter.
 * Prefer getPriceIdForInterval for new code.
 */
export function getPriceId(plan: SubscriptionPlan): string {
  return getPriceIdForInterval(plan, 'month');
}

/**
 * Effective monthly price when billed annually — displayed as "$X/mo billed annually".
 * Uses the stored yearly amount rather than recomputing, so marketing copy tracks
 * whatever round number we've published in Stripe.
 */
export function getAnnualMonthly(plan: SubscriptionPlan): number {
  const { priceYearly } = STRIPE_PLANS[plan];
  return Math.floor(priceYearly / 12);
}

/**
 * Get plan config by price ID (monthly or annual).
 */
export function getPlanByPriceId(priceId: string): SubscriptionPlan | null {
  for (const [planKey, config] of Object.entries(STRIPE_PLANS)) {
    if (config.priceId === priceId || config.priceIdYearly === priceId) {
      return planKey as SubscriptionPlan;
    }
  }
  return null;
}

/**
 * Feature comparison (by plan id).
 */
export const PLAN_FEATURES = {
  solo: STRIPE_PLANS.solo.features,
  pro: STRIPE_PLANS.pro.features,
  agency: STRIPE_PLANS.agency.features,
};
