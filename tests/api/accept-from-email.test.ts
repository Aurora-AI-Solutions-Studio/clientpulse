import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ActionItemOwnershipError,
  type CreateActionItemArgs,
  type ActionItemRow,
} from '../../src/lib/action-items/create';
import {
  ACCEPT_TOKEN_TTL_MS,
  signAcceptToken,
  type AcceptTokenPayload,
} from '../../src/lib/email/brief-token';
import type { MondayBriefContent } from '../../src/lib/agents/monday-brief-agent';

// -- module mocks --
const mockCreateActionItem = vi.fn();
const mockCreateServiceClient = vi.fn();

vi.mock('../../src/lib/action-items/create', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/lib/action-items/create')>();
  return {
    ...original,
    createActionItem: (args: CreateActionItemArgs) => mockCreateActionItem(args),
  };
});

vi.mock('../../src/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

const SECRET = 'test-secret';
const AGENCY = '11111111-1111-1111-1111-111111111111';
const BRIEF = '22222222-2222-2222-2222-222222222222';
const CLIENT = '33333333-3333-3333-3333-333333333333';

const action = {
  id: 'ra-1',
  type: 'check-in' as const,
  clientId: CLIENT,
  clientName: 'Lead',
  companyName: 'AcmeCo',
  title: 'Check in with AcmeCo this week',
  rationale: 'No reply in 12 days.',
  urgency: 'high' as const,
};

const briefContent: MondayBriefContent = {
  generatedAt: '2026-04-26T08:00:00Z',
  weekOf: '2026-04-20',
  snapshot: { totalClients: 4, healthy: 2, atRisk: 1, critical: 1, averageScore: 60, weekOverWeekDelta: 0 },
  needsAttention: [],
  trendingRisks: [],
  risingStars: [],
  topActionItems: [],
  recommendedActions: [action],
  engagementInsights: [],
  narrative: { headline: 'h', summary: 's', recommendation: 'r' },
};

interface FakeBriefRow {
  id: string;
  agency_id: string;
  content: MondayBriefContent;
}

interface FakeOpts {
  brief?: FakeBriefRow | null;
  briefError?: { message: string } | null;
  /** When set, the action_items.update step records the call here. */
  updateRecorder?: { id?: string; hash?: string };
  /** When set, action_items lookup by hash returns this row. */
  existingByHash?: { id: string } | null;
}

function fakeSupabase(opts: FakeOpts): SupabaseClient {
  return {
    from(table: string) {
      if (table === 'monday_briefs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: opts.brief ?? null,
                  error: opts.briefError ?? null,
                }),
              }),
            }),
          }),
        } as unknown as ReturnType<SupabaseClient['from']>;
      }
      if (table === 'action_items') {
        return {
          update: vi.fn((vals: { source_email_token_hash?: string }) => ({
            eq: vi.fn(async (_col: string, id: string) => {
              if (opts.updateRecorder) {
                opts.updateRecorder.id = id;
                opts.updateRecorder.hash = vals.source_email_token_hash;
              }
              return { data: null, error: null };
            }),
          })),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: opts.existingByHash ?? null,
                error: null,
              }),
            }),
          }),
        } as unknown as ReturnType<SupabaseClient['from']>;
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

function buildToken(overrides: Partial<AcceptTokenPayload> = {}): string {
  return signAcceptToken(
    {
      agencyId: AGENCY,
      briefId: BRIEF,
      actionId: 'ra-1',
      clientId: CLIENT,
      issuedAt: Date.now(),
      ...overrides,
    },
    SECRET,
  );
}

async function callRoute(token: string) {
  const { GET } = await import(
    '../../src/app/api/action-items/accept-from-email/route'
  );
  const url = new URL(
    `https://app.test/api/action-items/accept-from-email?t=${encodeURIComponent(token)}`,
  );
  const req = { nextUrl: url, headers: new Headers({ host: 'app.test' }) } as unknown as import('next/server').NextRequest;
  return GET(req);
}

beforeEach(() => {
  vi.resetModules();
  mockCreateActionItem.mockReset();
  mockCreateServiceClient.mockReset();
  process.env.EMAIL_TOKEN_SECRET = SECRET;
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
});

afterEach(() => {
  delete process.env.EMAIL_TOKEN_SECRET;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe('GET /api/action-items/accept-from-email', () => {
  it('redirects to error when EMAIL_TOKEN_SECRET missing', async () => {
    delete process.env.EMAIL_TOKEN_SECRET;
    mockCreateServiceClient.mockReturnValue(fakeSupabase({}));
    const res = await callRoute('any');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('reason=server-error');
  });

  it('redirects to error on bad signature', async () => {
    mockCreateServiceClient.mockReturnValue(fakeSupabase({}));
    const res = await callRoute('v1.aaaa.bbbb');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('status=error');
  });

  it('redirects to error on expired token', async () => {
    mockCreateServiceClient.mockReturnValue(fakeSupabase({}));
    const past = Date.now() - ACCEPT_TOKEN_TTL_MS - 60_000;
    const token = buildToken({ issuedAt: past });
    const res = await callRoute(token);
    expect(res.headers.get('location')).toContain('reason=expired');
  });

  it('redirects to error when brief not found', async () => {
    mockCreateServiceClient.mockReturnValue(fakeSupabase({ brief: null }));
    const res = await callRoute(buildToken());
    expect(res.headers.get('location')).toContain('reason=brief-missing');
  });

  it('redirects to error when action not in brief', async () => {
    mockCreateServiceClient.mockReturnValue(
      fakeSupabase({
        brief: { id: BRIEF, agency_id: AGENCY, content: { ...briefContent, recommendedActions: [] } },
      }),
    );
    const res = await callRoute(buildToken());
    expect(res.headers.get('location')).toContain('reason=action-missing');
  });

  it('redirects to bad-signature when client_id in token does not match brief action', async () => {
    mockCreateServiceClient.mockReturnValue(
      fakeSupabase({
        brief: { id: BRIEF, agency_id: AGENCY, content: briefContent },
      }),
    );
    const wrongClient = '99999999-9999-9999-9999-999999999999';
    const token = buildToken({ clientId: wrongClient });
    const res = await callRoute(token);
    expect(res.headers.get('location')).toContain('reason=bad-signature');
  });

  it('happy path: creates action item, stamps source hash, redirects ok=created', async () => {
    const updateRecorder: { id?: string; hash?: string } = {};
    mockCreateServiceClient.mockReturnValue(
      fakeSupabase({
        brief: { id: BRIEF, agency_id: AGENCY, content: briefContent },
        updateRecorder,
      }),
    );
    const created: ActionItemRow = {
      id: 'ai-1',
      client_id: CLIENT,
      meeting_id: null,
      title: action.title,
      description: action.rationale,
      status: 'open',
      due_date: null,
      assigned_to: null,
      created_at: '2026-04-26T08:00:00Z',
    };
    mockCreateActionItem.mockResolvedValueOnce(created);

    const res = await callRoute(buildToken());
    expect(res.status).toBe(303);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('status=ok');
    expect(loc).toContain('id=ai-1');
    expect(loc).toContain('variant=created');
    expect(loc).toContain('title=');
    expect(updateRecorder.id).toBe('ai-1');
    expect(updateRecorder.hash).toBeTruthy();
  });

  it('already-accepted (UNIQUE violation) redirects ok=already-accepted', async () => {
    const updateRecorder: { id?: string; hash?: string } = {};
    mockCreateServiceClient.mockReturnValue(
      fakeSupabase({
        brief: { id: BRIEF, agency_id: AGENCY, content: briefContent },
        existingByHash: { id: 'ai-existing' },
        updateRecorder,
      }),
    );
    const dupErr = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    mockCreateActionItem.mockRejectedValueOnce(dupErr);

    const res = await callRoute(buildToken());
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('status=ok');
    expect(loc).toContain('id=ai-existing');
    expect(loc).toContain('variant=already-accepted');
  });

  it('ownership error redirects to ownership reason', async () => {
    mockCreateServiceClient.mockReturnValue(
      fakeSupabase({
        brief: { id: BRIEF, agency_id: AGENCY, content: briefContent },
      }),
    );
    mockCreateActionItem.mockRejectedValueOnce(new ActionItemOwnershipError());
    const res = await callRoute(buildToken());
    expect(res.headers.get('location')).toContain('reason=ownership');
  });
});
