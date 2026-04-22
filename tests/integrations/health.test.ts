import { describe, expect, it } from 'vitest';
import {
  classifyOAuthConnection,
  classifyStripe,
  getIntegrationHealth,
  isHealthyOverall,
  unhealthyProviders,
  type IntegrationConnectionRow,
} from '@/lib/integrations/health';

const NOW = new Date('2026-04-22T12:00:00Z').getTime();
const AGENCY = '00000000-0000-0000-0000-000000000aaa';
const USER = '00000000-0000-0000-0000-000000000ddd';

function daysAgo(n: number) {
  return new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();
}
function daysFromNow(n: number) {
  return new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString();
}

describe('classifyOAuthConnection', () => {
  const baseConn = (over: Partial<IntegrationConnectionRow> = {}): IntegrationConnectionRow => ({
    provider: 'gmail',
    status: 'connected',
    token_expires_at: daysFromNow(1),
    last_sync_at: daysAgo(1),
    error: null,
    account_email: 'a@b.com',
    ...over,
  });

  it('returns disconnected when no row present', () => {
    const h = classifyOAuthConnection('gmail', undefined, NOW);
    expect(h.status).toBe('disconnected');
    expect(h.message).toMatch(/not connected/i);
  });

  it('returns healthy when token valid and last sync recent', () => {
    const h = classifyOAuthConnection('gmail', baseConn(), NOW);
    expect(h.status).toBe('healthy');
    expect(h.message).toBeNull();
  });

  it('returns error when connection has an error field', () => {
    const h = classifyOAuthConnection(
      'gmail',
      baseConn({ error: 'Rate limited by Google' }),
      NOW
    );
    expect(h.status).toBe('error');
    expect(h.message).toBe('Rate limited by Google');
  });

  it('returns stale when token expired (but no error)', () => {
    const h = classifyOAuthConnection(
      'gmail',
      baseConn({ token_expires_at: daysAgo(1) }),
      NOW
    );
    expect(h.status).toBe('stale');
    expect(h.message).toMatch(/expired/i);
  });

  it('returns stale when last_sync older than 7d', () => {
    const h = classifyOAuthConnection(
      'gmail',
      baseConn({ last_sync_at: daysAgo(10), token_expires_at: daysFromNow(1) }),
      NOW
    );
    expect(h.status).toBe('stale');
    expect(h.message).toMatch(/10d ago/);
  });

  it('error takes precedence over expiry', () => {
    const h = classifyOAuthConnection(
      'gmail',
      baseConn({ error: 'bad', token_expires_at: daysAgo(30) }),
      NOW
    );
    expect(h.status).toBe('error');
  });
});

describe('classifyStripe', () => {
  it('disconnected when no customer id', () => {
    const h = classifyStripe({
      stripe_customer_id: null,
      subscription_plan: 'free',
      subscription_status: 'active',
    });
    expect(h.status).toBe('disconnected');
  });

  it('healthy when active subscription', () => {
    const h = classifyStripe({
      stripe_customer_id: 'cus_X',
      subscription_plan: 'pro',
      subscription_status: 'active',
    });
    expect(h.status).toBe('healthy');
    expect(h.message).toMatch(/pro/);
  });

  it('healthy when trialing', () => {
    const h = classifyStripe({
      stripe_customer_id: 'cus_X',
      subscription_plan: 'solo',
      subscription_status: 'trialing',
    });
    expect(h.status).toBe('healthy');
  });

  it('error when past_due / cancelled', () => {
    const h = classifyStripe({
      stripe_customer_id: 'cus_X',
      subscription_plan: 'pro',
      subscription_status: 'past_due',
    });
    expect(h.status).toBe('error');
    expect(h.message).toMatch(/past_due/);
  });
});

describe('getIntegrationHealth (orchestration)', () => {
  function fakeSupabase(opts: {
    connections?: IntegrationConnectionRow[];
    profile?: {
      stripe_customer_id: string | null;
      subscription_plan: string | null;
      subscription_status: string | null;
    } | null;
  }) {
    return {
      from(table: string) {
        if (table === 'integration_connections') {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            then(onf: (v: { data: unknown; error: unknown }) => unknown) {
              return Promise.resolve({
                data: opts.connections ?? [],
                error: null,
              }).then(onf);
            },
          };
        }
        if (table === 'profiles') {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: () =>
              Promise.resolve({ data: opts.profile ?? null, error: null }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as never;
  }

  it('returns 4 rows: gmail, calendar, zoom, stripe', async () => {
    const sb = fakeSupabase({});
    const result = await getIntegrationHealth(sb, AGENCY, USER, NOW);
    expect(result.map((r) => r.provider)).toEqual([
      'gmail',
      'calendar',
      'zoom',
      'stripe',
    ]);
  });

  it('classifies mix correctly', async () => {
    const sb = fakeSupabase({
      connections: [
        {
          provider: 'gmail',
          status: 'connected',
          token_expires_at: daysFromNow(1),
          last_sync_at: daysAgo(1),
          error: null,
          account_email: 'u@g.com',
        },
        {
          provider: 'calendar',
          status: 'connected',
          token_expires_at: daysAgo(1), // expired
          last_sync_at: daysAgo(2),
          error: null,
          account_email: 'u@g.com',
        },
      ],
      profile: {
        stripe_customer_id: 'cus_X',
        subscription_plan: 'agency',
        subscription_status: 'active',
      },
    });
    const result = await getIntegrationHealth(sb, AGENCY, USER, NOW);
    const byProvider = Object.fromEntries(result.map((r) => [r.provider, r.status]));
    expect(byProvider).toEqual({
      gmail: 'healthy',
      calendar: 'stale',
      zoom: 'disconnected',
      stripe: 'healthy',
    });
  });
});

describe('helpers', () => {
  it('isHealthyOverall true if all healthy or disconnected', () => {
    expect(
      isHealthyOverall([
        { provider: 'gmail', status: 'healthy', lastSyncAt: null, tokenExpiresAt: null, message: null, accountEmail: null },
        { provider: 'calendar', status: 'disconnected', lastSyncAt: null, tokenExpiresAt: null, message: null, accountEmail: null },
      ])
    ).toBe(true);
  });

  it('isHealthyOverall false if any stale', () => {
    expect(
      isHealthyOverall([
        { provider: 'gmail', status: 'stale', lastSyncAt: null, tokenExpiresAt: null, message: null, accountEmail: null },
      ])
    ).toBe(false);
  });

  it('unhealthyProviders returns only stale + error', () => {
    const rows = [
      { provider: 'gmail' as const, status: 'healthy' as const, lastSyncAt: null, tokenExpiresAt: null, message: null, accountEmail: null },
      { provider: 'calendar' as const, status: 'stale' as const, lastSyncAt: null, tokenExpiresAt: null, message: null, accountEmail: null },
      { provider: 'zoom' as const, status: 'error' as const, lastSyncAt: null, tokenExpiresAt: null, message: null, accountEmail: null },
      { provider: 'stripe' as const, status: 'disconnected' as const, lastSyncAt: null, tokenExpiresAt: null, message: null, accountEmail: null },
    ];
    const u = unhealthyProviders(rows);
    expect(u.map((r) => r.provider)).toEqual(['calendar', 'zoom']);
  });
});
