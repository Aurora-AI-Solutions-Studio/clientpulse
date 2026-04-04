/**
 * Stripe configuration and plan definitions
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
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for freelancers and small teams',
    price: 29,
    currency: 'usd',
    interval: 'month',
    productId: 'prod_UGHPAJi3MzjPFU',
    features: [
      'Up to 10 clients',
      'Basic financial signals',
      'Email notifications',
      'Invoice tracking',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For growing agencies and consultants',
    price: 79,
    currency: 'usd',
    interval: 'month',
    productId: 'prod_UGHPMZvDuwJwGR',
    features: [
      'Up to 50 clients',
      'Advanced financial signals',
      'Real-time alerts',
      'Stripe integration',
      'Custom reporting',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    description: 'For large teams and enterprises',
    price: 199,
    currency: 'usd',
    interval: 'month',
    productId: 'prod_UGHP5p2K5IaHoy',
    features: [
      'Unlimited clients',
      'AI-powered Financial Signal Agent',
      'Stripe Connect integration',
      'Invoice ingestion & analysis',
      'Advanced predictive analytics',
      'Priority support',
      'Custom integrations',
    ],
  },
};

/**
 * Load price IDs from environment variables
 * Format: STRIPE_PRICE_ID_STARTER, STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_AGENCY
 */
export function initializeStripePriceIds() {
  const starter = process.env.STRIPE_PRICE_ID_STARTER;
  const pro = process.env.STRIPE_PRICE_ID_PRO;
  const agency = process.env.STRIPE_PRICE_ID_AGENCY;

  if (starter) STRIPE_PLANS.starter.priceId = starter;
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
  starter: STRIPE_PLANS.starter.features,
  pro: STRIPE_PLANS.pro.features,
  agency: STRIPE_PLANS.agency.features,
};
