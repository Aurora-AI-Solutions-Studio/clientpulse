import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const AGENCY = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const CLIENT = '33333333-3333-3333-3333-333333333333';
const SCORE_ROW = '44444444-4444-4444-4444-444444444444';

const mockGetAuthedContext = vi.fn();

vi.mock('../../src/lib/auth/get-authed-context', () => ({
  getAuthedContext: () => mockGetAuthedContext(),
}));

interface FakeOpts {
  /** Returned by clients ownership check. null = not found. */
  client?: { id: string } | null;
  /** Returned by latest health-score lookup. null = no score yet. */
  scoreRow?: { id: string } | null;
  /** When set, the update step records the patch + returned row. */
  recorder?: {
    update?: Record<string, unknown>;
    returned?: Record<string, unknown>;
  };
  /** Updated row to return from the .single() after .update().eq().select(). */
  updatedReturned?: Record<string, unknown> | null;
  /** Force an error on update. */
  updateError?: { message: string } | null;
}

function fakeSupabase(opts: FakeOpts): SupabaseClient {
  return {
    from(table: string) {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: opts.client ?? null,
                  error: null,
                }),
              }),
            }),
          }),
        } as unknown as ReturnType<SupabaseClient['from']>;
      }
      if (table === 'client_health_scores') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: opts.scoreRow ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: vi.fn((patch: Record<string, unknown>) => ({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: opts.updatedReturned ?? null,
                  error: opts.updateError ?? null,
                }),
              }),
            }),
            // For DELETE-flow: chained .eq() returning resolution directly
          })).mockImplementation((patch: Record<string, unknown>) => {
            if (opts.recorder) opts.recorder.update = patch;
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: opts.updatedReturned ?? null,
                    error: opts.updateError ?? null,
                  }),
                }),
              }),
            };
          }),
        } as unknown as ReturnType<SupabaseClient['from']>;
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

async function callPost(
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const { POST } = await import(
    '../../src/app/api/clients/[id]/health/override/route'
  );
  const req = {
    json: async () => body,
  } as unknown as import('next/server').NextRequest;
  const res = await POST(req, { params: Promise.resolve({ id: CLIENT }) });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.resetModules();
  mockGetAuthedContext.mockReset();
});

afterEach(() => {
  mockGetAuthedContext.mockReset();
});

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

describe('POST /api/clients/[id]/health/override', () => {
  it('rejects non-integer score', async () => {
    authOk(fakeSupabase({}));
    const r = await callPost({ score: 50.5, reason: 'valid reason here' });
    expect(r.status).toBe(400);
  });

  it('rejects score out of range', async () => {
    authOk(fakeSupabase({}));
    expect((await callPost({ score: -1, reason: 'valid reason' })).status).toBe(400);
    expect((await callPost({ score: 101, reason: 'valid reason' })).status).toBe(400);
  });

  it('rejects missing reason', async () => {
    authOk(fakeSupabase({}));
    expect((await callPost({ score: 50 })).status).toBe(400);
  });

  it('rejects too-short reason (<5 chars)', async () => {
    authOk(fakeSupabase({}));
    expect((await callPost({ score: 50, reason: 'tiny' })).status).toBe(400);
  });

  it('rejects too-long reason (>500 chars)', async () => {
    authOk(fakeSupabase({}));
    expect((await callPost({ score: 50, reason: 'x'.repeat(501) })).status).toBe(400);
  });

  it('returns 401 when unauthorized', async () => {
    mockGetAuthedContext.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const r = await callPost({ score: 50, reason: 'reasonable text here' });
    expect(r.status).toBe(401);
  });

  it('returns 404 when client not in agency', async () => {
    authOk(fakeSupabase({ client: null }));
    const r = await callPost({ score: 50, reason: 'reasonable text here' });
    expect(r.status).toBe(404);
  });

  it('returns 409 when no computed score exists yet', async () => {
    authOk(fakeSupabase({ client: { id: CLIENT }, scoreRow: null }));
    const r = await callPost({ score: 50, reason: 'reasonable text here' });
    expect(r.status).toBe(409);
  });

  it('happy path: writes override columns + returns effectiveScore', async () => {
    const recorder: { update?: Record<string, unknown> } = {};
    authOk(
      fakeSupabase({
        client: { id: CLIENT },
        scoreRow: { id: SCORE_ROW },
        updatedReturned: {
          overall_score: 30,
          override_score: 60,
          override_reason: 'Verbal commitment from CFO; model over-weights last late invoice',
          overridden_by: USER,
          overridden_at: '2026-04-26T11:00:00Z',
        },
        recorder,
      }),
    );
    const r = await callPost({
      score: 60,
      reason: 'Verbal commitment from CFO; model over-weights last late invoice',
    });
    expect(r.status).toBe(200);
    const body = r.body as {
      effectiveScore: number;
      reason: string;
    };
    expect(body.effectiveScore).toBe(60);
    expect(body.reason).toContain('Verbal commitment');

    // The patch must include all four override columns.
    expect(recorder.update).toMatchObject({
      override_score: 60,
      override_reason: 'Verbal commitment from CFO; model over-weights last late invoice',
      overridden_by: USER,
    });
    expect(typeof recorder.update?.overridden_at).toBe('string');
  });
});
