// Sprint 7.9 Slice 7b — verify /api/signals/ingest now records misses
// to cp_rf_unmatched_signals so the Suite mapping wizard has something
// to surface.
//
// Mocks the supabase service client and stubs the HMAC verifier so we
// can drive the unmatched branch directly. We don't go through the
// real auth.admin.listUsers path; we mock the lookup as a hit.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const AGENCY = '00000000-0000-0000-0000-000000000aaa';
const RF_CLIENT = 'rf-acme-1';

interface UnmatchedRow {
  id: string;
  agency_id: string;
  rf_client_id: string;
  rf_client_name: string;
  signal_count: number;
  last_seen_at: string;
}

let unmatchedTable: UnmatchedRow[] = [];
let lastUpsertCall: { table: string; row: Record<string, unknown> } | null = null;

function fakeSupabase() {
  return {
    auth: {
      admin: {
        listUsers: async () => ({
          data: { users: [{ id: 'cp-user-1', email: 'agency@example.com' }] },
          error: null,
        }),
      },
    },
    from(table: string) {
      // profiles → return agency_id for the mocked user
      if (table === 'profiles') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: () =>
            Promise.resolve({ data: { agency_id: AGENCY }, error: null }),
        } as unknown as Record<string, unknown>;
      }

      // cp_rf_client_map and clients name-match — both return null so we
      // fall through to the unmatched branch.
      if (table === 'cp_rf_client_map') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          insert: () => Promise.resolve({ error: null }),
        } as unknown as Record<string, unknown>;
      }

      if (table === 'clients') {
        return {
          select() { return this; },
          eq() { return this; },
          ilike: () => Promise.resolve({ data: [], error: null }),
        } as unknown as Record<string, unknown>;
      }

      if (table === 'cp_rf_unmatched_signals') {
        const builder = {
          select() { return builder; },
          eq(_col: string, val: string) {
            // Filter the in-memory table so the second .eq narrows to
            // the (agency_id, rf_client_id) pair we care about.
            (builder as { _filtered?: UnmatchedRow[] })._filtered =
              ((builder as { _filtered?: UnmatchedRow[] })._filtered ?? unmatchedTable)
                .filter((r) =>
                  Object.entries({ agency_id: r.agency_id, rf_client_id: r.rf_client_id })
                    .find(([k, v]) => k === _col && v === val),
                );
            return builder;
          },
          maybeSingle: () => {
            const filtered =
              (builder as { _filtered?: UnmatchedRow[] })._filtered ?? unmatchedTable;
            const found = filtered[0] ?? null;
            return Promise.resolve({ data: found, error: null });
          },
          insert: (row: Omit<UnmatchedRow, 'id' | 'signal_count' | 'last_seen_at'>) => {
            const inserted: UnmatchedRow = {
              id: `unm-${unmatchedTable.length + 1}`,
              agency_id: row.agency_id,
              rf_client_id: row.rf_client_id,
              rf_client_name: row.rf_client_name,
              signal_count: 1,
              last_seen_at: new Date().toISOString(),
            };
            unmatchedTable.push(inserted);
            lastUpsertCall = {
              table: 'cp_rf_unmatched_signals',
              row: inserted as unknown as Record<string, unknown>,
            };
            return Promise.resolve({ error: null });
          },
          update: (row: Partial<UnmatchedRow>) => ({
            eq: (_col: string, id: string) => {
              const found = unmatchedTable.find((r) => r.id === id);
              if (found) Object.assign(found, row);
              lastUpsertCall = { table: 'cp_rf_unmatched_signals', row: { id, ...row } };
              return Promise.resolve({ error: null });
            },
          }),
        };
        return builder as unknown as Record<string, unknown>;
      }

      if (table === 'client_signals') {
        return {
          upsert: () => Promise.resolve({ error: null }),
        } as unknown as Record<string, unknown>;
      }

      throw new Error(`unexpected table: ${table}`);
    },
  };
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => fakeSupabase(),
}));

vi.mock('@/lib/signals/hmac', () => ({
  verifySignal: () => ({
    ok: true,
    payload: {
      v: 1,
      rf_client_id: RF_CLIENT,
      rf_client_name: 'Acme Co',
      agency_email: 'agency@example.com',
      signal_type: 'content_velocity',
      period: '2026-W17',
      value: 4,
      metadata: {},
      emitted_at: new Date().toISOString(),
    },
  }),
}));

vi.mock('@/lib/signals/ingest-trigger', () => ({
  maybeCreateSignalTriggeredActionItem: async () => ({ outcome: 'noop' as const }),
}));

import { POST } from '@/app/api/signals/ingest/route';

beforeEach(() => {
  unmatchedTable = [];
  lastUpsertCall = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

function postBody() {
  return new Request('http://x/api/signals/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'stub' }),
  });
}

describe('POST /api/signals/ingest — unmatched tracking', () => {
  it('inserts a cp_rf_unmatched_signals row on first miss', async () => {
    const res = await POST(postBody() as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(false);
    expect(body.reason).toBe('unmatched_client');
    expect(unmatchedTable).toHaveLength(1);
    expect(unmatchedTable[0]).toMatchObject({
      agency_id: AGENCY,
      rf_client_id: RF_CLIENT,
      rf_client_name: 'Acme Co',
      signal_count: 1,
    });
  });

  it('bumps signal_count + last_seen_at on a repeat miss (no duplicate row)', async () => {
    await POST(postBody() as unknown as import('next/server').NextRequest);
    const before = unmatchedTable[0].last_seen_at;
    // Tiny delay so last_seen_at changes
    await new Promise((r) => setTimeout(r, 10));
    await POST(postBody() as unknown as import('next/server').NextRequest);
    expect(unmatchedTable).toHaveLength(1);
    expect(unmatchedTable[0].signal_count).toBe(2);
    expect(new Date(unmatchedTable[0].last_seen_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime(),
    );
  });
});
