/**
 * stripe-config helpers — Sprint 8A Pricing UI
 *
 * Pins the canonical CP launch prices and the annual-discount math so
 * the pricing page + upgrade page + Stripe checkout all stay in lock-step.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STRIPE_PLANS,
  getAnnualMonthly,
  getPlanByPriceId,
  getPriceId,
  getPriceIdForInterval,
  initializeStripePriceIds,
} from './stripe-config';

const MONTHLY_ENV_KEYS = [
  'STRIPE_PRICE_ID_SOLO',
  'STRIPE_PRICE_ID_PRO',
  'STRIPE_PRICE_ID_AGENCY',
] as const;
const YEARLY_ENV_KEYS = [
  'STRIPE_PRICE_ID_SOLO_YEARLY',
  'STRIPE_PRICE_ID_PRO_YEARLY',
  'STRIPE_PRICE_ID_AGENCY_YEARLY',
] as const;

const PRICE_ID_FIELDS = ['priceId', 'priceIdYearly'] as const;

function snapshotPlans() {
  return (['solo', 'pro', 'agency'] as const).map((p) => ({
    id: p,
    priceId: STRIPE_PLANS[p].priceId,
    priceIdYearly: STRIPE_PLANS[p].priceIdYearly,
  }));
}

function restorePlans(snapshot: ReturnType<typeof snapshotPlans>) {
  for (const row of snapshot) {
    for (const field of PRICE_ID_FIELDS) {
      if (row[field] === undefined) {
        delete STRIPE_PLANS[row.id][field];
      } else {
        STRIPE_PLANS[row.id][field] = row[field];
      }
    }
  }
}

describe('stripe-config: canonical launch prices', () => {
  it('exposes $59 / $199 / $799 monthly', () => {
    expect(STRIPE_PLANS.solo.price).toBe(59);
    expect(STRIPE_PLANS.pro.price).toBe(199);
    expect(STRIPE_PLANS.agency.price).toBe(799);
  });

  it('exposes 10× monthly = 2 months free as the yearly total', () => {
    // 59 × 10 = 590; 199 × 10 = 1990; 799 × 10 = 7990.
    // This is the "2 months free" promise — if you change one, change both.
    expect(STRIPE_PLANS.solo.priceYearly).toBe(59 * 10);
    expect(STRIPE_PLANS.pro.priceYearly).toBe(199 * 10);
    expect(STRIPE_PLANS.agency.priceYearly).toBe(799 * 10);
  });
});

describe('stripe-config: getAnnualMonthly()', () => {
  it('returns the effective monthly when billed annually', () => {
    // floor(590 / 12) = 49; floor(1990 / 12) = 165; floor(7990 / 12) = 665.
    // These are the numbers the pricing page shows under the annual toggle.
    expect(getAnnualMonthly('solo')).toBe(49);
    expect(getAnnualMonthly('pro')).toBe(165);
    expect(getAnnualMonthly('agency')).toBe(665);
  });

  it('produces a ~16.7% discount vs. the monthly rate', () => {
    for (const plan of ['solo', 'pro', 'agency'] as const) {
      const monthly = STRIPE_PLANS[plan].price;
      const annualMonthly = getAnnualMonthly(plan);
      const discount = 1 - annualMonthly / monthly;
      // 2/12 = 0.1666… — allow a small fudge for integer flooring.
      expect(discount).toBeGreaterThan(0.15);
      expect(discount).toBeLessThan(0.18);
    }
  });
});

describe('stripe-config: getPriceIdForInterval() + initializeStripePriceIds()', () => {
  const originalEnv: Record<string, string | undefined> = {};
  let snapshot: ReturnType<typeof snapshotPlans>;

  beforeEach(() => {
    snapshot = snapshotPlans();
    for (const k of MONTHLY_ENV_KEYS) originalEnv[k] = process.env[k];
    for (const k of YEARLY_ENV_KEYS) originalEnv[k] = process.env[k];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    restorePlans(snapshot);
  });

  it('loads monthly + yearly price IDs from the environment', () => {
    process.env.STRIPE_PRICE_ID_SOLO = 'price_solo_mo';
    process.env.STRIPE_PRICE_ID_PRO = 'price_pro_mo';
    process.env.STRIPE_PRICE_ID_AGENCY = 'price_agency_mo';
    process.env.STRIPE_PRICE_ID_SOLO_YEARLY = 'price_solo_yr';
    process.env.STRIPE_PRICE_ID_PRO_YEARLY = 'price_pro_yr';
    process.env.STRIPE_PRICE_ID_AGENCY_YEARLY = 'price_agency_yr';

    initializeStripePriceIds();

    expect(getPriceIdForInterval('solo', 'month')).toBe('price_solo_mo');
    expect(getPriceIdForInterval('pro', 'month')).toBe('price_pro_mo');
    expect(getPriceIdForInterval('agency', 'month')).toBe('price_agency_mo');
    expect(getPriceIdForInterval('solo', 'year')).toBe('price_solo_yr');
    expect(getPriceIdForInterval('pro', 'year')).toBe('price_pro_yr');
    expect(getPriceIdForInterval('agency', 'year')).toBe('price_agency_yr');
  });

  it('getPriceId() is a back-compat alias for monthly', () => {
    process.env.STRIPE_PRICE_ID_SOLO = 'price_solo_mo';
    initializeStripePriceIds();
    expect(getPriceId('solo')).toBe('price_solo_mo');
  });

  it('throws a helpful error when the interval price is unconfigured', () => {
    // Wipe any leftover IDs so the lookup really is unconfigured.
    for (const p of ['solo', 'pro', 'agency'] as const) {
      delete STRIPE_PLANS[p].priceId;
      delete STRIPE_PLANS[p].priceIdYearly;
    }

    expect(() => getPriceIdForInterval('solo', 'year')).toThrow(/SOLO_YEARLY/);
    expect(() => getPriceIdForInterval('pro', 'month')).toThrow(/STRIPE_PRICE_ID_PRO/);
  });
});

describe('stripe-config: getPlanByPriceId()', () => {
  let snapshot: ReturnType<typeof snapshotPlans>;

  beforeEach(() => {
    snapshot = snapshotPlans();
    STRIPE_PLANS.solo.priceId = 'price_solo_mo';
    STRIPE_PLANS.solo.priceIdYearly = 'price_solo_yr';
    STRIPE_PLANS.pro.priceId = 'price_pro_mo';
    STRIPE_PLANS.agency.priceIdYearly = 'price_agency_yr';
  });

  afterEach(() => {
    restorePlans(snapshot);
  });

  it('resolves both monthly and annual price IDs back to their plan', () => {
    expect(getPlanByPriceId('price_solo_mo')).toBe('solo');
    expect(getPlanByPriceId('price_solo_yr')).toBe('solo');
    expect(getPlanByPriceId('price_pro_mo')).toBe('pro');
    expect(getPlanByPriceId('price_agency_yr')).toBe('agency');
  });

  it('returns null for unknown price IDs', () => {
    expect(getPlanByPriceId('price_nope')).toBeNull();
  });
});
