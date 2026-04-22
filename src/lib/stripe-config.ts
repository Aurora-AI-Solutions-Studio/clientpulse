/**
 * Stripe configuration and plan definitions
 *
 * Canonical CP launch pricing (Pricing Deep-Dive Apr 14, aligned with the
 * Agency Suite cross-sell narrative):
 *   Solo    — $59/mo  (3 clients, Monday Brief, Stripe sync)
 *   Pro     — $199/mo (10 clients, Meeting Intelligence, Action Proposal Engine)
 *   Agency  — $799/mo (∞ clients, 8 seats, MCP unlimited, white-label reports)
 */

import { SubscriptionPlan } from '@/types/stripe';

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  productId: string;
  priceId?: string; // Loaded from env
}

export const STRIPE_PLANS: Record<SubscriptionPlan, PlanConfig> = {
  solo: {
    id: 'solo',
    name: 'Solo',
    description: 'For freelancers and solo consultants',
    price: 59,
    currency: 'usd',
    interval: 'month',
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
    currency: 'usd',
    interval: 'month',
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
    currency: 'usd',
    interval: 'month',
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
 * Format: STRIPE_PRICE_ID_SOLO, STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_AGENCY
 */
export function initializeStripePriceIds() {
  const solo = process.env.STRIPE_PRICE_ID_SOLO;
  const pro = process.env.STRIPE_PRICE_ID_PRO;
  const agency = process.env.STRIPE_PRICE_ID_AGENCY;

  if (solo) STRIPE_PLANS.solo.priceId = solo;
  if (pro) STRIPE_PLANS.pro.priceId = pro;
  if (agency) STRIPE_PLANS.agency.priceId = agency;
}

/**
 * Get price ID for a plan, either from env or fallback
 */
export function getPriceId(plan: SubscriptionPlan): string {
  const config = STRIPE_PLANS[plan];
  if (!config.priceId) {
    throw new Error(
      `Price ID not configured for plan ${plan}. Set STRIPE_PRICE_ID_${plan.toUpperCase()} environment variable.`
    );
  }
  return config.priceId;
}

/**
 * Get plan config by price ID
 */
export function getPlanByPriceId(priceId: string): SubscriptionPlan | null {
  for (const [planKey, config] of Object.entries(STRIPE_PLANS)) {
    if (config.priceId === priceId) {
      return planKey as SubscriptionPlan;
    }
  }
  return null;
}

/**
 * Feature comparison
 */
export const PLAN_FEATURES = {
  solo: STRIPE_PLANS.solo.features,
  pro: STRIPE_PLANS.pro.features,
  agency: STRIPE_PLANS.agency.features,
};
