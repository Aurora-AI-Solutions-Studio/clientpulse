// Sprint 7.8 — applySuiteAccess flips local + sister profiles (CP).
//
// Mirror of contentpulse/__tests__/stripe/suite-access.test.ts. Same shape
// — sister here points at ContentPulse.
//
// Tests set the new CONTENTPULSE_SUPABASE_* env names. createSisterClient()
// also accepts legacy RF_SUPABASE_* names during the Vercel cutover; that
// fallback path is exercised by the existing missing-env case below.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const ORIG_URL = process.env.CONTENTPULSE_SUPABASE_URL;
const ORIG_KEY = process.env.CONTENTPULSE_SUPABASE_SERVICE_ROLE_KEY;
const ORIG_LEGACY_URL = process.env.RF_SUPABASE_URL;
const ORIG_LEGACY_KEY = process.env.RF_SUPABASE_SERVICE_ROLE_KEY;

interface UpdateCall {
  table: string;
  patch: Record<string, unknown>;
  filter: { col: string; val: unknown };
}

const localUpdates: UpdateCall[] = [];
const sisterUpdates: UpdateCall[] = [];
let localRowsMatched: number = 1;
let sisterRowsMatched: number = 1;

function fakeClient(updates: UpdateCall[], rowsMatched: () => number): SupabaseClient {
  return {
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => ({
          select: (_cols: string) => {
            updates.push({ table, patch, filter: { col, val } });
            const data = Array.from({ length: rowsMatched() }, (_, i) => ({ id: `row-${i}` }));
            return Promise.resolve({ data, error: null });
          },
        }),
        select: (_cols: string) => ({
          eq: (col: string, val: unknown) => {
            updates.push({ table, patch, filter: { col, val } });
            const data = Array.from({ length: rowsMatched() }, (_, i) => ({ id: `row-${i}` }));
            return Promise.resolve({ data, error: null });
          },
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => fakeClient(sisterUpdates, () => sisterRowsMatched),
}));

import { applySuiteAccess } from '@/lib/stripe/suite-access';

beforeEach(() => {
  process.env.CONTENTPULSE_SUPABASE_URL = 'https://contentpulse.example.supabase.co';
  process.env.CONTENTPULSE_SUPABASE_SERVICE_ROLE_KEY = 'service-role-stub';
  // Make sure stale legacy values from a previous test run don't satisfy
  // the env-missing case below via the fallback.
  delete process.env.RF_SUPABASE_URL;
  delete process.env.RF_SUPABASE_SERVICE_ROLE_KEY;
  localUpdates.length = 0;
  sisterUpdates.length = 0;
  localRowsMatched = 1;
  sisterRowsMatched = 1;
});

afterEach(() => {
  if (ORIG_URL === undefined) delete process.env.CONTENTPULSE_SUPABASE_URL;
  else process.env.CONTENTPULSE_SUPABASE_URL = ORIG_URL;
  if (ORIG_KEY === undefined) delete process.env.CONTENTPULSE_SUPABASE_SERVICE_ROLE_KEY;
  else process.env.CONTENTPULSE_SUPABASE_SERVICE_ROLE_KEY = ORIG_KEY;
  if (ORIG_LEGACY_URL === undefined) delete process.env.RF_SUPABASE_URL;
  else process.env.RF_SUPABASE_URL = ORIG_LEGACY_URL;
  if (ORIG_LEGACY_KEY === undefined) delete process.env.RF_SUPABASE_SERVICE_ROLE_KEY;
  else process.env.RF_SUPABASE_SERVICE_ROLE_KEY = ORIG_LEGACY_KEY;
});

describe('applySuiteAccess (CP)', () => {
  it('updates local profile by id when localUserId supplied', async () => {
    const local = fakeClient(localUpdates, () => localRowsMatched);
    const r = await applySuiteAccess({
      local,
      email: 'BUYER@Example.com',
      localUserId: 'user-1',
      grant: true,
    });
    expect(r.local).toBe('updated');
    expect(localUpdates[0]).toMatchObject({
      table: 'profiles',
      patch: { has_suite_access: true },
      filter: { col: 'id', val: 'user-1' },
    });
  });

  it('updates local profile by email when no localUserId', async () => {
    const local = fakeClient(localUpdates, () => localRowsMatched);
    await applySuiteAccess({ local, email: 'buyer@example.com', grant: true });
    expect(localUpdates[0].filter).toMatchObject({ col: 'email', val: 'buyer@example.com' });
  });

  it('updates sister profile by lowercased email', async () => {
    const local = fakeClient(localUpdates, () => localRowsMatched);
    const r = await applySuiteAccess({
      local,
      email: 'BUYER@Example.com',
      localUserId: 'u',
      grant: true,
    });
    expect(r.sister).toBe('updated');
    expect(sisterUpdates[0].filter).toMatchObject({ col: 'email', val: 'buyer@example.com' });
    expect(sisterUpdates[0].patch).toMatchObject({ has_suite_access: true });
  });

  it('flips both rows to false on revoke', async () => {
    const local = fakeClient(localUpdates, () => localRowsMatched);
    const r = await applySuiteAccess({
      local,
      email: 'a@b.com',
      localUserId: 'u',
      grant: false,
    });
    expect(r.local).toBe('updated');
    expect(r.sister).toBe('updated');
    expect(localUpdates[0].patch).toMatchObject({ has_suite_access: false });
    expect(sisterUpdates[0].patch).toMatchObject({ has_suite_access: false });
  });

  it('returns no_local_row when local lookup matches nothing', async () => {
    localRowsMatched = 0;
    const local = fakeClient(localUpdates, () => localRowsMatched);
    const r = await applySuiteAccess({ local, email: 'a@b.com', localUserId: 'u', grant: true });
    expect(r.local).toBe('no_local_row');
    expect(r.sister).toBe('updated');
  });

  it('returns no_sister_row when sister lookup matches nothing', async () => {
    sisterRowsMatched = 0;
    const local = fakeClient(localUpdates, () => localRowsMatched);
    const r = await applySuiteAccess({ local, email: 'a@b.com', localUserId: 'u', grant: true });
    expect(r.local).toBe('updated');
    expect(r.sister).toBe('no_sister_row');
  });

  it('returns sister_db_unavailable when env vars missing — local still updates', async () => {
    delete process.env.CONTENTPULSE_SUPABASE_URL;
    delete process.env.CONTENTPULSE_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.RF_SUPABASE_URL;
    delete process.env.RF_SUPABASE_SERVICE_ROLE_KEY;
    const local = fakeClient(localUpdates, () => localRowsMatched);
    const r = await applySuiteAccess({ local, email: 'a@b.com', localUserId: 'u', grant: true });
    expect(r.local).toBe('updated');
    expect(r.sister).toBe('sister_db_unavailable');
  });

  it('falls back to legacy RF_SUPABASE_* env vars during cutover', async () => {
    delete process.env.CONTENTPULSE_SUPABASE_URL;
    delete process.env.CONTENTPULSE_SUPABASE_SERVICE_ROLE_KEY;
    process.env.RF_SUPABASE_URL = 'https://legacy.example.supabase.co';
    process.env.RF_SUPABASE_SERVICE_ROLE_KEY = 'legacy-stub';
    const local = fakeClient(localUpdates, () => localRowsMatched);
    const r = await applySuiteAccess({ local, email: 'a@b.com', localUserId: 'u', grant: true });
    expect(r.local).toBe('updated');
    expect(r.sister).toBe('updated');
  });
});
