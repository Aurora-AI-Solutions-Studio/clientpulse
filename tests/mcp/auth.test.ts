// ─── MCP auth + connection gating tests — Sprint 8A M2 ─────────
// Mocks @/lib/supabase/service so we can assert hashing, tier resolution,
// tier gating, and connection-limit enforcement without a real DB.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Supabase mock — a tiny query-builder fake ──────────────────
// Each .from() call returns a chainable stub whose .single()/.delete()/
// .update()/.upsert()/.select()/.insert() resolve to whatever the test
// set up in the `state` map.

type FakeRow = Record<string, unknown>;

const state = {
  apiKeys: [] as FakeRow[],
  profiles: [] as FakeRow[],
  connectionsCount: 0,
  deleted: [] as string[],
  upserts: [] as FakeRow[],
  updates: [] as FakeRow[],
};

function resetState() {
  state.apiKeys = [];
  state.profiles = [];
  state.connectionsCount = 0;
  state.deleted = [];
  state.upserts = [];
  state.updates = [];
}

/**
 * Minimal Supabase-style query builder. The terminal operations the
 * auth layer actually calls are:
 *   - .select(cols).eq(...).limit(n) [await]           → { data, error }
 *   - .select(cols).eq(...).single() [await]           → { data, error }
 *   - .select(cols, { count, head }).eq(...) [await]   → { count, error }
 *   - .delete().eq(...).lt(...) [await]                → { error }
 *   - .update(vals).eq(...) [await]                    → { error }
 *   - .upsert(vals, opts) [await]                      → { error }
 * Modelled by returning an object that is itself a thenable so the chain
 * resolves on the first `await`.
 */
function makeQuery(table: string) {
  let mode: 'select' | 'count' | 'single' | 'delete' | 'update' | 'upsert' | null = null;
  let countOpts = false;

  const resolveTerminal = (): unknown => {
    if (mode === 'count' || countOpts) {
      return { count: state.connectionsCount, error: null };
    }
    if (mode === 'select') {
      if (table === 'api_keys') return { data: state.apiKeys, error: null };
      return { data: [], error: null };
    }
    if (mode === 'delete') {
      state.deleted.push(table);
      return { data: null, error: null };
    }
    if (mode === 'update') {
      return { data: null, error: null };
    }
    if (mode === 'upsert') {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  };

  const q: Record<string, unknown> = {
    eq() {
      return q;
    },
    lt() {
      return q;
    },
    limit() {
      return q;
    },
    order() {
      return q;
    },
    async single() {
      if (table === 'profiles') return { data: state.profiles[0] ?? null, error: null };
      return { data: null, error: null };
    },
    select(_cols: string, opts?: { count?: 'exact'; head?: boolean }) {
      mode = 'select';
      countOpts = Boolean(opts?.count === 'exact' && opts.head);
      return q;
    },
    delete() {
      mode = 'delete';
      return q;
    },
    update(vals: FakeRow) {
      mode = 'update';
      state.updates.push({ table, ...vals });
      return q;
    },
    upsert(vals: FakeRow) {
      mode = 'upsert';
      state.upserts.push({ table, ...vals });
      return q;
    },
    insert() {
      return { data: null, error: null } as unknown;
    },
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(resolveTerminal()).then(onFulfilled, onRejected);
    },
  };

  return q;
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => makeQuery(table),
  }),
}));

// ─── Tests ──────────────────────────────────────────────────────

import {
  authenticateMCPRequest,
  hashApiKey,
  resolveTier,
} from '@/lib/llm/mcp/auth';
import {
  MCPAuthRequiredError,
  MCPConnectionLimitError,
  MCPTierGateError,
} from '@/lib/llm/mcp/errors';

describe('hashApiKey', () => {
  it('is deterministic and hex-encoded SHA-256', () => {
    const h = hashApiKey('cp_sk_test_abc');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(hashApiKey('cp_sk_test_abc')).toBe(h);
  });

  it('differs for different inputs', () => {
    expect(hashApiKey('a')).not.toBe(hashApiKey('b'));
  });
});

describe('resolveTier', () => {
  it('maps known plans through', () => {
    expect(resolveTier({ subscription_plan: 'agency' })).toBe('agency');
    expect(resolveTier({ subscription_plan: 'pro' })).toBe('pro');
    expect(resolveTier({ subscription_plan: 'solo' })).toBe('solo');
    expect(resolveTier({ subscription_plan: 'free' })).toBe('free');
  });

  it('falls back to free for unknown or missing plans', () => {
    expect(resolveTier({ subscription_plan: null })).toBe('free');
    expect(resolveTier({ subscription_plan: 'enterprise' })).toBe('free');
  });
});

describe('authenticateMCPRequest', () => {
  beforeEach(() => resetState());

  it('throws AUTH_REQUIRED with no header', async () => {
    await expect(
      authenticateMCPRequest({ authorizationHeader: null })
    ).rejects.toBeInstanceOf(MCPAuthRequiredError);
  });

  it('throws AUTH_REQUIRED with unknown key', async () => {
    state.apiKeys = [];
    await expect(
      authenticateMCPRequest({ authorizationHeader: 'Bearer cp_sk_zzz' })
    ).rejects.toBeInstanceOf(MCPAuthRequiredError);
  });

  it('blocks free-tier users with TIER_GATE', async () => {
    const key = 'cp_sk_freeuser01234';
    state.apiKeys = [
      {
        id: 'k1',
        user_id: 'u1',
        key_hash: hashApiKey(key),
        prefix: key.slice(0, 12),
        revoked_at: null,
        last_used_at: null,
      },
    ];
    state.profiles = [{ id: 'u1', subscription_plan: 'free' }];

    await expect(
      authenticateMCPRequest({ authorizationHeader: `Bearer ${key}` })
    ).rejects.toBeInstanceOf(MCPTierGateError);
  });

  it('blocks solo-tier users with TIER_GATE (MCP is pro+)', async () => {
    const key = 'cp_sk_soloabc9999a';
    state.apiKeys = [
      {
        id: 'k1a',
        user_id: 'u1a',
        key_hash: hashApiKey(key),
        prefix: key.slice(0, 12),
        revoked_at: null,
        last_used_at: null,
      },
    ];
    state.profiles = [{ id: 'u1a', subscription_plan: 'solo' }];

    await expect(
      authenticateMCPRequest({ authorizationHeader: `Bearer ${key}` })
    ).rejects.toBeInstanceOf(MCPTierGateError);
  });

  it('enforces connection limit on pro tier (3)', async () => {
    const key = 'cp_sk_prouser0123456';
    state.apiKeys = [
      {
        id: 'k2',
        user_id: 'u2',
        key_hash: hashApiKey(key),
        prefix: key.slice(0, 12),
        revoked_at: null,
        last_used_at: null,
      },
    ];
    state.profiles = [{ id: 'u2', subscription_plan: 'pro' }];
    state.connectionsCount = 3; // already at the limit

    await expect(
      authenticateMCPRequest({ authorizationHeader: `Bearer ${key}` })
    ).rejects.toBeInstanceOf(MCPConnectionLimitError);
  });

  it('admits an agency user regardless of connection count', async () => {
    const key = 'cp_sk_agencyxx999999';
    state.apiKeys = [
      {
        id: 'k3',
        user_id: 'u3',
        key_hash: hashApiKey(key),
        prefix: key.slice(0, 12),
        revoked_at: null,
        last_used_at: null,
      },
    ];
    state.profiles = [{ id: 'u3', subscription_plan: 'agency' }];
    state.connectionsCount = 999;

    const sess = await authenticateMCPRequest({
      authorizationHeader: `Bearer ${key}`,
      connectionId: 'conn-xyz',
    });
    expect(sess.userId).toBe('u3');
    expect(sess.tier).toBe('agency');
    expect(sess.connectionId).toBe('conn-xyz');
  });

  it('rejects revoked keys', async () => {
    const key = 'cp_sk_revokedxxxx99';
    state.apiKeys = [
      {
        id: 'k4',
        user_id: 'u4',
        key_hash: hashApiKey(key),
        prefix: key.slice(0, 12),
        revoked_at: '2025-01-01T00:00:00Z',
        last_used_at: null,
      },
    ];
    await expect(
      authenticateMCPRequest({ authorizationHeader: `Bearer ${key}` })
    ).rejects.toBeInstanceOf(MCPAuthRequiredError);
  });

  it('accepts a raw key without "Bearer " prefix', async () => {
    const key = 'cp_sk_rawkeytest12345';
    state.apiKeys = [
      {
        id: 'k5',
        user_id: 'u5',
        key_hash: hashApiKey(key),
        prefix: key.slice(0, 12),
        revoked_at: null,
        last_used_at: null,
      },
    ];
    state.profiles = [{ id: 'u5', subscription_plan: 'pro' }];
    state.connectionsCount = 0;

    const sess = await authenticateMCPRequest({ authorizationHeader: key });
    expect(sess.userId).toBe('u5');
  });
});
