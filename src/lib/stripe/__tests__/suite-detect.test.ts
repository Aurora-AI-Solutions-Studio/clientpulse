// Sprint 7.8 — Suite SKU detection helpers (CP).
//
// Mirror of contentpulse/__tests__/stripe/suite-detect.test.ts. Same wire
// shape both directions so a Suite event detected on ContentPulse is also
// detected on CP, and vice versa.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  firstPriceId,
  getSuitePriceIds,
  isSuiteSubscription,
  shouldGrantSuiteAccess,
} from '@/lib/stripe/suite-detect';

const ORIG_M = process.env.STRIPE_SUITE_PRICE_ID;
const ORIG_A = process.env.STRIPE_SUITE_ANNUAL_PRICE_ID;

beforeEach(() => {
  process.env.STRIPE_SUITE_PRICE_ID = 'price_suite_monthly';
  process.env.STRIPE_SUITE_ANNUAL_PRICE_ID = 'price_suite_annual';
});

afterEach(() => {
  if (ORIG_M === undefined) delete process.env.STRIPE_SUITE_PRICE_ID;
  else process.env.STRIPE_SUITE_PRICE_ID = ORIG_M;
  if (ORIG_A === undefined) delete process.env.STRIPE_SUITE_ANNUAL_PRICE_ID;
  else process.env.STRIPE_SUITE_ANNUAL_PRICE_ID = ORIG_A;
});

function sub(priceId: string | null, status: string = 'active') {
  return {
    status,
    items: { data: priceId ? [{ price: { id: priceId } }] : [] },
  };
}

describe('getSuitePriceIds (CP)', () => {
  it('reads from env vars when set', () => {
    const ids = getSuitePriceIds();
    expect(ids.has('price_suite_monthly')).toBe(true);
    expect(ids.has('price_suite_annual')).toBe(true);
  });

  it('falls back to canonical sandbox IDs when env vars unset', () => {
    delete process.env.STRIPE_SUITE_PRICE_ID;
    delete process.env.STRIPE_SUITE_ANNUAL_PRICE_ID;
    const ids = getSuitePriceIds();
    expect(ids.has('price_1TOg21LER55AcgjYgO4wGltx')).toBe(true);
    expect(ids.has('price_1TOg24LER55AcgjYF0zC8mha')).toBe(true);
  });
});

describe('firstPriceId (CP)', () => {
  it('returns first item price id', () => {
    expect(firstPriceId(sub('price_x'))).toBe('price_x');
  });
  it('null on empty items', () => {
    expect(firstPriceId(sub(null))).toBe(null);
  });
});

describe('isSuiteSubscription (CP)', () => {
  it('true for monthly Suite price', () => {
    expect(isSuiteSubscription(sub('price_suite_monthly'))).toBe(true);
  });
  it('true for annual Suite price', () => {
    expect(isSuiteSubscription(sub('price_suite_annual'))).toBe(true);
  });
  it('false for non-Suite prices', () => {
    expect(isSuiteSubscription(sub('price_cp_pro'))).toBe(false);
  });
  it('false for empty subscription', () => {
    expect(isSuiteSubscription(sub(null))).toBe(false);
  });
});

describe('shouldGrantSuiteAccess (CP)', () => {
  it.each([
    ['active', true],
    ['trialing', true],
    ['canceled', false],
    ['past_due', false],
    ['unpaid', false],
    ['incomplete', false],
    ['incomplete_expired', false],
    ['paused', false],
  ] as const)('Suite SKU + status=%s → grant=%s', (status, expected) => {
    expect(shouldGrantSuiteAccess(sub('price_suite_monthly', status))).toBe(expected);
  });

  it('non-Suite SKU never grants regardless of status', () => {
    expect(shouldGrantSuiteAccess(sub('price_cp_pro', 'active'))).toBe(false);
  });
});
