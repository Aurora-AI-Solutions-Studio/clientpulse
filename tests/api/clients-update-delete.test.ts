import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const AGENCY = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CLIENT = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const mockGetAuthedContext = vi.fn();

vi.mock('@/lib/auth/get-authed-context', () => ({
  getAuthedContext: () => mockGetAuthedContext(),
}));

interface FakeOpts {
  /** Result of the .eq().eq().maybeSingle() ownership check on `clients`. */
  ownershipRow?: { id: string } | null;
  /** Result of the final UPDATE .single(). */
  updatedRow?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
  deleteError?: { message: string } | null;
  /** Capture writes for assertions. */
  recorder?: { update?: Record<string, unknown>; deletedId?: string };
}

function fakeSupabase(opts: FakeOpts): SupabaseClient {
  return {
    from(table: string) {
      if (table !== 'clients') throw new Error(`unexpected table ${table}`);

      const ownershipChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: opts.ownershipRow ?? null,
          error: null,
        }),
      };

      const updateChain = (patch: Record<string, unknown>) => {
        if (opts.recorder) opts.recorder.update = patch;
        return {
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: opts.updatedRow ?? null,
                error: opts.updateError ?? null,
              }),
            }),
          }),
        };
      };

      const deleteChain = () => {
        const eq2 = vi.fn().mockResolvedValue({ error: opts.deleteError ?? null });
        const eq1 = vi.fn((col: string, val: string) => {
          if (col === 'id' && opts.recorder) opts.recorder.deletedId = val;
          return { eq: eq2 };
        });
        return { eq: eq1 };
      };

      return {
        select: ownershipChain.select,
        eq: ownershipChain.eq,
        maybeSingle: ownershipChain.maybeSingle,
        update: vi.fn(updateChain),
        delete: vi.fn(deleteChain),
      } as unknown as ReturnType<SupabaseClient['from']>;
    },
  } as unknown as SupabaseClient;
}

function authOk(supabase: SupabaseClient) {
  mockGetAuthedContext.mockResolvedValue({
    ok: true,
    ctx: {
      userId: USER,
      email: 'u@test.test',
      agencyId: AGENCY,
      subscriptionPlan: 'agency',
      authClient: {} as never,
      serviceClient: supabase,
    },
  });
}

beforeEach(() => {
  vi.resetModules();
  mockGetAuthedContext.mockReset();
});

afterEach(() => {
  mockGetAuthedContext.mockReset();
});

async function callPut(body: unknown) {
  const { PUT } = await import('@/app/api/clients/[id]/route');
  const req = { json: async () => body } as unknown as import('next/server').NextRequest;
  const res = await PUT(req, { params: Promise.resolve({ id: CLIENT }) });
  return { status: res.status, body: await res.json() };
}

async function callPatch(body: unknown) {
  const { PATCH } = await import('@/app/api/clients/[id]/route');
  const req = { json: async () => body } as unknown as import('next/server').NextRequest;
  const res = await PATCH(req, { params: Promise.resolve({ id: CLIENT }) });
  return { status: res.status, body: await res.json() };
}

async function callDelete() {
  const { DELETE } = await import('@/app/api/clients/[id]/route');
  const req = {} as unknown as import('next/server').NextRequest;
  const res = await DELETE(req, { params: Promise.resolve({ id: CLIENT }) });
  return { status: res.status, body: await res.json() };
}

describe('PATCH /api/clients/[id]', () => {
  it('is exported as an alias for PUT (same handler)', async () => {
    const mod = await import('@/app/api/clients/[id]/route');
    expect(mod.PATCH).toBe(mod.PUT);
  });

  it('returns 401 when unauthorized', async () => {
    mockGetAuthedContext.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const r = await callPatch({ name: 'New' });
    expect(r.status).toBe(401);
  });

  it('returns 404 when client is not in the agency (RLS denial)', async () => {
    authOk(fakeSupabase({ ownershipRow: null }));
    const r = await callPatch({ name: 'New' });
    expect(r.status).toBe(404);
  });

  it('writes mapped column names and returns the updated client', async () => {
    const recorder: { update?: Record<string, unknown> } = {};
    authOk(
      fakeSupabase({
        ownershipRow: { id: CLIENT },
        updatedRow: {
          id: CLIENT,
          name: 'New Name',
          company_name: 'New Co',
          contact_email: 'new@co.test',
          monthly_retainer: 750_000,
          service_type: 'SEO',
          notes: null,
          status: 'paused',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-05-03T00:00:00Z',
          agency_id: AGENCY,
        },
        recorder,
      }),
    );
    const r = await callPatch({
      name: 'New Name',
      company: 'New Co',
      contactEmail: 'new@co.test',
      monthlyRetainer: 750_000,
      serviceType: 'SEO',
      status: 'paused',
    });
    expect(r.status).toBe(200);
    const body = r.body as { name: string; company: string; status: string };
    expect(body.name).toBe('New Name');
    expect(body.company).toBe('New Co');
    expect(body.status).toBe('paused');

    // Crucial: the update payload uses `company_name` (DB column) not `company`
    // (API surface) — same trap as PR #83.
    expect(recorder.update).toMatchObject({
      name: 'New Name',
      company_name: 'New Co',
      contact_email: 'new@co.test',
      monthly_retainer: 750_000,
      service_type: 'SEO',
      status: 'paused',
    });
  });

  it('PUT works directly (same handler reachable both ways)', async () => {
    authOk(
      fakeSupabase({
        ownershipRow: { id: CLIENT },
        updatedRow: {
          id: CLIENT,
          name: 'X',
          company_name: 'Y',
          contact_email: null,
          monthly_retainer: null,
          service_type: null,
          notes: null,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-05-03T00:00:00Z',
          agency_id: AGENCY,
        },
      }),
    );
    const r = await callPut({ name: 'X', company: 'Y' });
    expect(r.status).toBe(200);
  });
});

describe('DELETE /api/clients/[id]', () => {
  it('returns 401 when unauthorized', async () => {
    mockGetAuthedContext.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const r = await callDelete();
    expect(r.status).toBe(401);
  });

  it('returns 404 when client is not in the agency (RLS denial)', async () => {
    authOk(fakeSupabase({ ownershipRow: null }));
    const r = await callDelete();
    expect(r.status).toBe(404);
  });

  it('hard-deletes when ownership check passes', async () => {
    const recorder: { deletedId?: string } = {};
    authOk(fakeSupabase({ ownershipRow: { id: CLIENT }, recorder }));
    const r = await callDelete();
    expect(r.status).toBe(200);
    expect((r.body as { success: boolean }).success).toBe(true);
    expect(recorder.deletedId).toBe(CLIENT);
  });

  it('returns 500 when the delete itself errors', async () => {
    authOk(
      fakeSupabase({
        ownershipRow: { id: CLIENT },
        deleteError: { message: 'pg: cascade blocked' },
      }),
    );
    const r = await callDelete();
    expect(r.status).toBe(500);
  });
});
