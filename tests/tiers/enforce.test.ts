// ─── Tier metering enforcement tests — Sprint 8A ────────────────
// Covers the CP tier helpers end-to-end. Pure helpers use no mocks;
// DB-touching ones stub @/lib/supabase/service with a tiny query-builder
// fake modelled on the RF 7.6 pattern.
//
// What we assert:
//   1. Tier matrix values match Sprint 8A scope exactly
//      (clients 0/3/10/∞, retention 30/90/365/1095,
//       refresh none/daily/hourly/realtime, seats 1/1/3/8,
//       mcp 0/0/3/∞, api none/none/read/full).
//   2. resolveTier falls back to 'free' on unknown/null inputs.
//   3. enforceClientLimit throws with dimension='clients' at cap.
//   4. enforceSeatsLimit throws with dimension='seats' at cap.
//   5. enforceApiAccess behaves per the matrix for each tier + scope.
//   6. getRetentionDays + getHealthRefreshCadence return expected values.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Supabase mock — only the methods the helpers actually call ──

type FakeRow = Record<string, unknown>;

interface TableState {
  rows: FakeRow[];
  count: number;
}

const makeTable = (): TableState => ({ rows: [], count: 0 });

const state = {
  clients: makeTable(),
  agency_members: makeTable(),
};

function reset() {
  state.clients = makeTable();
  state.agency_members = makeTable();
}

function makeQuery(table: keyof typeof state) {
  let mode: 'select' | 'count' | 'maybeSingle' = 'select';

  const resolveTerminal = (): unknown => {
    const t = state[table];
    if (mode === 'count') return { count: t.count, error: null };
    if (mode === 'maybeSingle') return { data: t.rows[0] ?? null, error: null };
    return { data: null, error: null };
  };

  const q: Record<string, unknown> = {
    select(_cols: string, opts?: { count?: string; head?: boolean }) {
      mode = opts?.count ? 'count' : 'select';
      return q;
    },
    eq() { return q; },
    maybeSingle() { mode = 'maybeSingle'; return resolveTerminal(); },
    single() { mode = 'maybeSingle'; return resolveTerminal(); },
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(resolveTerminal()).then(resolve);
    },
  };
  return q;
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => makeQuery(table as keyof typeof state),
  }),
}));

// ─── Actual imports — AFTER the mock above ──────────────────────

import {
  TIER_LIMITS,
  resolveTier,
  getTierLimits,
  getRetentionDays,
  getHealthRefreshCadence,
  tierDisplayName,
} from '@/lib/tiers/limits';
import {
  TierLimitError,
  enforceApiAccess,
  enforceClientLimit,
  enforceSeatsLimit,
  requireTier,
  tierMeetsMin,
} from '@/lib/tiers/enforce';

beforeEach(() => {
  reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1. Matrix — Sprint 8A canonical values ─────────────────────

describe('TIER_LIMITS matrix', () => {
  it('clients: 0 / 3 / 10 / ∞', () => {
    expect(TIER_LIMITS.free.clients).toBe(0);
    expect(TIER_LIMITS.solo.clients).toBe(3);
    expect(TIER_LIMITS.pro.clients).toBe(10);
    expect(TIER_LIMITS.agency.clients).toBe(Infinity);
  });

  it('retentionDays: 30 / 90 / 365 / 1095', () => {
    expect(TIER_LIMITS.free.retentionDays).toBe(30);
    expect(TIER_LIMITS.solo.retentionDays).toBe(90);
    expect(TIER_LIMITS.pro.retentionDays).toBe(365);
    expect(TIER_LIMITS.agency.retentionDays).toBe(1095);
  });

  it('healthRefreshCadence: none / daily / hourly / realtime', () => {
    expect(TIER_LIMITS.free.healthRefreshCadence).toBe('none');
    expect(TIER_LIMITS.solo.healthRefreshCadence).toBe('daily');
    expect(TIER_LIMITS.pro.healthRefreshCadence).toBe('hourly');
    expect(TIER_LIMITS.agency.healthRefreshCadence).toBe('realtime');
  });

  it('seats: 1 / 1 / 3 / 8', () => {
    expect(TIER_LIMITS.free.seats).toBe(1);
    expect(TIER_LIMITS.solo.seats).toBe(1);
    expect(TIER_LIMITS.pro.seats).toBe(3);
    expect(TIER_LIMITS.agency.seats).toBe(8);
  });

  it('mcpConnections: 0 / 0 / 3 / ∞', () => {
    expect(TIER_LIMITS.free.mcpConnections).toBe(0);
    expect(TIER_LIMITS.solo.mcpConnections).toBe(0);
    expect(TIER_LIMITS.pro.mcpConnections).toBe(3);
    expect(TIER_LIMITS.agency.mcpConnections).toBe(Infinity);
  });

  it('apiAccess: none / none / read / full', () => {
    expect(TIER_LIMITS.free.apiAccess).toBe('none');
    expect(TIER_LIMITS.solo.apiAccess).toBe('none');
    expect(TIER_LIMITS.pro.apiAccess).toBe('read');
    expect(TIER_LIMITS.agency.apiAccess).toBe('full');
  });
});

// ─── 2. Tier resolution ─────────────────────────────────────────

describe('resolveTier', () => {
  it('returns the plan when it is a known tier', () => {
    expect(resolveTier({ subscription_plan: 'solo' })).toBe('solo');
    expect(resolveTier({ subscription_plan: 'pro' })).toBe('pro');
    expect(resolveTier({ subscription_plan: 'agency' })).toBe('agency');
    expect(resolveTier({ subscription_plan: 'free' })).toBe('free');
  });

  it('falls back to free for null/undefined/unknown', () => {
    expect(resolveTier(null)).toBe('free');
    expect(resolveTier(undefined)).toBe('free');
    expect(resolveTier({ subscription_plan: null })).toBe('free');
    expect(resolveTier({ subscription_plan: 'enterprise' })).toBe('free');
    expect(resolveTier({ subscription_plan: 'starter' })).toBe('free');
  });
});

describe('getTierLimits + display helpers', () => {
  it('getTierLimits(null) → free limits', () => {
    expect(getTierLimits(null)).toEqual(TIER_LIMITS.free);
  });

  it('tierDisplayName maps each tier to its proper case', () => {
    expect(tierDisplayName('free')).toBe('Free');
    expect(tierDisplayName('solo')).toBe('Solo');
    expect(tierDisplayName('pro')).toBe('Pro');
    expect(tierDisplayName('agency')).toBe('Agency');
  });
});

describe('getRetentionDays + getHealthRefreshCadence', () => {
  it('proxy through to the matrix', () => {
    expect(getRetentionDays({ subscription_plan: 'solo' })).toBe(90);
    expect(getRetentionDays({ subscription_plan: 'pro' })).toBe(365);
    expect(getRetentionDays({ subscription_plan: 'agency' })).toBe(1095);

    expect(getHealthRefreshCadence({ subscription_plan: 'solo' })).toBe('daily');
    expect(getHealthRefreshCadence({ subscription_plan: 'pro' })).toBe('hourly');
    expect(getHealthRefreshCadence({ subscription_plan: 'agency' })).toBe('realtime');
  });
});

// ─── 3. enforceClientLimit ───────────────────────────────────────

describe('enforceClientLimit', () => {
  it('no-op for agency (∞ cap)', async () => {
    state.clients.count = 9_999;
    await expect(
      enforceClientLimit('a1', { subscription_plan: 'agency' })
    ).resolves.toBeUndefined();
  });

  it('allows solo below 3 clients', async () => {
    state.clients.count = 2;
    await expect(
      enforceClientLimit('a1', { subscription_plan: 'solo' })
    ).resolves.toBeUndefined();
  });

  it('rejects solo at cap (3)', async () => {
    state.clients.count = 3;
    await expect(
      enforceClientLimit('a1', { subscription_plan: 'solo' })
    ).rejects.toBeInstanceOf(TierLimitError);
  });

  it('rejects pro at cap (10) with dimension=clients, status=403', async () => {
    state.clients.count = 10;
    try {
      await enforceClientLimit('a1', { subscription_plan: 'pro' });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TierLimitError);
      const e = err as TierLimitError;
      expect(e.dimension).toBe('clients');
      expect(e.status).toBe(403);
      expect(e.tier).toBe('pro');
    }
  });

  it('rejects free on any attempt (cap=0)', async () => {
    state.clients.count = 0;
    await expect(
      enforceClientLimit('a1', { subscription_plan: 'free' })
    ).rejects.toBeInstanceOf(TierLimitError);
  });
});

// ─── 4. enforceSeatsLimit ────────────────────────────────────────

describe('enforceSeatsLimit', () => {
  it('allows pro below 3 seats', async () => {
    state.agency_members.count = 2;
    await expect(
      enforceSeatsLimit('a1', { subscription_plan: 'pro' })
    ).resolves.toBeUndefined();
  });

  it('rejects pro at cap (3)', async () => {
    state.agency_members.count = 3;
    await expect(
      enforceSeatsLimit('a1', { subscription_plan: 'pro' })
    ).rejects.toBeInstanceOf(TierLimitError);
  });

  it('allows agency up to 8 seats, rejects past', async () => {
    state.agency_members.count = 7;
    await expect(
      enforceSeatsLimit('a1', { subscription_plan: 'agency' })
    ).resolves.toBeUndefined();

    state.agency_members.count = 8;
    await expect(
      enforceSeatsLimit('a1', { subscription_plan: 'agency' })
    ).rejects.toBeInstanceOf(TierLimitError);
  });

  it('rejects solo beyond 1 seat', async () => {
    state.agency_members.count = 1;
    await expect(
      enforceSeatsLimit('a1', { subscription_plan: 'solo' })
    ).rejects.toBeInstanceOf(TierLimitError);
  });
});

// ─── 5. requireTier ──────────────────────────────────────────────

describe('tierMeetsMin', () => {
  it('respects the free < solo < pro < agency ladder', () => {
    expect(tierMeetsMin('free', 'free')).toBe(true);
    expect(tierMeetsMin('solo', 'free')).toBe(true);
    expect(tierMeetsMin('pro', 'solo')).toBe(true);
    expect(tierMeetsMin('agency', 'pro')).toBe(true);

    expect(tierMeetsMin('free', 'solo')).toBe(false);
    expect(tierMeetsMin('solo', 'pro')).toBe(false);
    expect(tierMeetsMin('pro', 'agency')).toBe(false);
  });
});

describe('requireTier — Pro+ feature gate', () => {
  it('free is rejected on requireTier(pro)', () => {
    expect(() => requireTier({ subscription_plan: 'free' }, 'pro')).toThrow(TierLimitError);
  });

  it('solo is rejected on requireTier(pro) — the key launch-gate case', () => {
    try {
      requireTier({ subscription_plan: 'solo' }, 'pro');
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TierLimitError);
      const e = err as TierLimitError;
      expect(e.dimension).toBe('tier');
      expect(e.status).toBe(403);
      expect(e.tier).toBe('solo');
      expect(e.message).toContain('Pro');
    }
  });

  it('pro is allowed on requireTier(pro)', () => {
    expect(() => requireTier({ subscription_plan: 'pro' }, 'pro')).not.toThrow();
  });

  it('agency is allowed on requireTier(pro) and requireTier(agency)', () => {
    expect(() => requireTier({ subscription_plan: 'agency' }, 'pro')).not.toThrow();
    expect(() => requireTier({ subscription_plan: 'agency' }, 'agency')).not.toThrow();
  });

  it('pro is rejected on requireTier(agency)', () => {
    expect(() => requireTier({ subscription_plan: 'pro' }, 'agency')).toThrow(TierLimitError);
  });

  it('null/unknown plan collapses to free and is rejected', () => {
    expect(() => requireTier({ subscription_plan: null }, 'pro')).toThrow(TierLimitError);
    expect(() => requireTier({ subscription_plan: 'starter' }, 'pro')).toThrow(TierLimitError);
  });
});

// ─── 6. enforceApiAccess ─────────────────────────────────────────

describe('enforceApiAccess', () => {
  it('free rejects any scope', () => {
    expect(() => enforceApiAccess({ subscription_plan: 'free' }, 'read')).toThrow(TierLimitError);
    expect(() => enforceApiAccess({ subscription_plan: 'free' }, 'write')).toThrow(TierLimitError);
  });

  it('solo rejects any scope', () => {
    expect(() => enforceApiAccess({ subscription_plan: 'solo' }, 'read')).toThrow(TierLimitError);
    expect(() => enforceApiAccess({ subscription_plan: 'solo' }, 'write')).toThrow(TierLimitError);
  });

  it('pro allows read, rejects write', () => {
    expect(() => enforceApiAccess({ subscription_plan: 'pro' }, 'read')).not.toThrow();
    expect(() => enforceApiAccess({ subscription_plan: 'pro' }, 'write')).toThrow(TierLimitError);
  });

  it('agency allows any scope', () => {
    expect(() => enforceApiAccess({ subscription_plan: 'agency' }, 'read')).not.toThrow();
    expect(() => enforceApiAccess({ subscription_plan: 'agency' }, 'write')).not.toThrow();
  });

  it('dimension=api + status=403 on throw', () => {
    try {
      enforceApiAccess({ subscription_plan: 'solo' }, 'write');
      expect.fail('expected throw');
    } catch (err) {
      const e = err as TierLimitError;
      expect(e.dimension).toBe('api');
      expect(e.status).toBe(403);
      expect(e.tier).toBe('solo');
    }
  });
});
