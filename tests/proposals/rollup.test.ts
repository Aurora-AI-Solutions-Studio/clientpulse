import { describe, expect, it } from 'vitest';
import {
  getPortfolioProposals,
  rankProposals,
  type Proposal,
} from '@/lib/proposals/rollup';
import type {
  MondayBriefContent,
  MondayBriefRecommendedAction,
} from '@/lib/agents/monday-brief-agent';

const AGENCY = '00000000-0000-0000-0000-000000000aaa';
const CLIENT_A = '00000000-0000-0000-0000-000000000bbb';
const CLIENT_B = '00000000-0000-0000-0000-000000000ccc';

function ra(
  over: Partial<MondayBriefRecommendedAction> = {}
): MondayBriefRecommendedAction {
  return {
    id: 'ra_1',
    type: 'check-in',
    clientId: CLIENT_A,
    clientName: 'Alice',
    companyName: 'Acme',
    title: 'Check in with Acme',
    rationale: 'No email in 10d',
    urgency: 'medium',
    ...over,
  };
}

function briefContent(
  actions: MondayBriefRecommendedAction[]
): MondayBriefContent {
  return {
    generatedAt: '2026-04-22T00:00:00Z',
    weekOf: '2026-04-20',
    snapshot: {
      totalClients: 3,
      healthy: 1,
      atRisk: 1,
      critical: 1,
      averageScore: 60,
      weekOverWeekDelta: -2,
    },
    needsAttention: [],
    trendingRisks: [],
    risingStars: [],
    topActionItems: [],
    recommendedActions: actions,
    engagementInsights: [],
    narrative: { headline: '', summary: '', recommendation: '' },
  };
}

function fakeSupabase(opts: {
  brief?: { id: string; content: MondayBriefContent } | null;
  error?: { message: string };
}) {
  return {
    from(table: string) {
      if (table !== 'monday_briefs') throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle: () =>
          Promise.resolve({
            data: opts.brief ?? null,
            error: opts.error ?? null,
          }),
      };
    },
  } as never;
}

describe('rankProposals', () => {
  it('high before medium before low', () => {
    const rows: Proposal[] = [
      { ...ra({ urgency: 'low', id: 'l' }), weekOf: 'x', briefId: 'b' },
      { ...ra({ urgency: 'high', id: 'h' }), weekOf: 'x', briefId: 'b' },
      { ...ra({ urgency: 'medium', id: 'm' }), weekOf: 'x', briefId: 'b' },
    ];
    expect(rankProposals(rows).map((r) => r.id)).toEqual(['h', 'm', 'l']);
  });
});

describe('getPortfolioProposals', () => {
  it('free tier returns empty without touching DB', async () => {
    const sb = fakeSupabase({ brief: null });
    const r = await getPortfolioProposals(sb, AGENCY, 'free');
    expect(r).toEqual({ proposals: [], weekOf: null, briefId: null, hasBrief: false });
  });

  it('solo tier reads brief and returns ranked proposals', async () => {
    const sb = fakeSupabase({
      brief: {
        id: 'brief_1',
        content: briefContent([
          ra({ id: 'a', urgency: 'low' }),
          ra({ id: 'b', urgency: 'high', clientId: CLIENT_B, clientName: 'Bob' }),
          ra({ id: 'c', urgency: 'medium' }),
        ]),
      },
    });
    const r = await getPortfolioProposals(sb, AGENCY, 'solo');
    expect(r.hasBrief).toBe(true);
    expect(r.weekOf).toBe('2026-04-20');
    expect(r.briefId).toBe('brief_1');
    expect(r.proposals.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(r.proposals[0].briefId).toBe('brief_1');
  });

  it('limit parameter trims after ranking', async () => {
    const sb = fakeSupabase({
      brief: {
        id: 'brief_1',
        content: briefContent([
          ra({ id: 'a', urgency: 'low' }),
          ra({ id: 'b', urgency: 'high' }),
          ra({ id: 'c', urgency: 'medium' }),
          ra({ id: 'd', urgency: 'high' }),
        ]),
      },
    });
    const r = await getPortfolioProposals(sb, AGENCY, 'agency', { limit: 2 });
    expect(r.proposals.map((p) => p.urgency)).toEqual(['high', 'high']);
  });

  it('returns hasBrief=false when no monday_brief exists', async () => {
    const sb = fakeSupabase({ brief: null });
    const r = await getPortfolioProposals(sb, AGENCY, 'pro');
    expect(r.hasBrief).toBe(false);
    expect(r.proposals).toEqual([]);
  });

  it('returns empty on query error (does not throw)', async () => {
    const sb = fakeSupabase({ error: { message: 'db down' } });
    const r = await getPortfolioProposals(sb, AGENCY, 'pro');
    expect(r.hasBrief).toBe(false);
    expect(r.proposals).toEqual([]);
  });

  it('handles brief with empty recommendedActions', async () => {
    const sb = fakeSupabase({
      brief: { id: 'brief_1', content: briefContent([]) },
    });
    const r = await getPortfolioProposals(sb, AGENCY, 'pro');
    expect(r.hasBrief).toBe(true);
    expect(r.proposals).toEqual([]);
  });
});
