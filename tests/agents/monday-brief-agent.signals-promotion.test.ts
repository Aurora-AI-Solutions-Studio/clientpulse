// Slice 2C-1 — Monday Brief promotes signal-driven re-engagement to the
// headline / first recommended action.
//
// Independent test file with its own minimal mock so the new behavior
// is exercised in isolation from the existing 40-test brief suite.

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MondayBriefAgent } from '@/lib/agents/monday-brief-agent';

interface FakeData {
  clients?: Array<Record<string, unknown>>;
  healthScores?: Array<Record<string, unknown>>;
  historyRows?: Array<Record<string, unknown>>;
  actionItems?: Array<Record<string, unknown>>;
  engagementRows?: Array<Record<string, unknown>>;
  clientSignals?: Array<Record<string, unknown>>;
}

function fakeSupabase(data: FakeData): SupabaseClient {
  const make = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    };
    Object.defineProperty(chain, 'then', {
      get: () => (resolve: (v: unknown) => unknown) =>
        resolve({ data: rows, error: null }),
    });
    return chain;
  };
  const from = vi.fn().mockImplementation((table: string) => {
    switch (table) {
      case 'clients': return make(data.clients ?? []);
      case 'client_health_scores': return make(data.healthScores ?? []);
      case 'health_score_history': return make(data.historyRows ?? []);
      case 'action_items': return make(data.actionItems ?? []);
      case 'engagement_metrics': return make(data.engagementRows ?? []);
      case 'client_signals': return make(data.clientSignals ?? []);
      default: return make([]);
    }
  });
  return { from } as unknown as SupabaseClient;
}

const cypress = {
  id: 'c-cypress', name: 'Cypress Logistics', company_name: 'Cypress Logistics', status: 'active',
};
const linden = {
  id: 'c-linden', name: 'Linden & Co', company_name: 'Linden & Co Consulting', status: 'active',
};
const northwind = {
  id: 'c-northwind', name: 'Northwind', company_name: 'Northwind Capital', status: 'active',
};

const cypressHealth = {
  client_id: 'c-cypress', overall_score: 31, signals: [{ severity: 'high', message: 'paused' }],
};
const lindenHealth = {
  client_id: 'c-linden', overall_score: 55, signals: [],
};
const northwindHealth = {
  client_id: 'c-northwind', overall_score: 86, signals: [],
};

describe('MondayBriefAgent — signal-driven promotion (slice 2C-1)', () => {
  it('promotes a paused client to the top recommended action and headline', async () => {
    const supabase = fakeSupabase({
      clients: [cypress, linden, northwind],
      healthScores: [cypressHealth, lindenHealth, northwindHealth],
      clientSignals: [
        { client_id: 'c-cypress', signal_type: 'pause_resume', value: 1, emitted_at: '2026-04-27T08:20:24Z' },
        { client_id: 'c-cypress', signal_type: 'content_velocity', value: 0, emitted_at: '2026-04-27T08:20:24Z' },
      ],
    });
    const agent = new MondayBriefAgent(supabase);
    const brief = await agent.generate('agency-1');

    expect(brief.recommendedActions[0]).toBeDefined();
    expect(brief.recommendedActions[0].clientId).toBe('c-cypress');
    expect(brief.recommendedActions[0].signalReason).toBe('paused');
    expect(brief.recommendedActions[0].type).toBe('re-engagement');
    expect(brief.narrative.headline).toContain('Cypress Logistics');
    expect(brief.narrative.headline.toLowerCase()).toContain('paused');
  });

  it('promotes a velocity-drop client when no pause signal exists', async () => {
    const supabase = fakeSupabase({
      clients: [linden, northwind],
      healthScores: [lindenHealth, northwindHealth],
      clientSignals: [
        // Linden: 1 piece this week, 4 last week → 75% drop
        { client_id: 'c-linden', signal_type: 'content_velocity', value: 1, emitted_at: '2026-04-27T08:20:24Z' },
        { client_id: 'c-linden', signal_type: 'content_velocity', value: 4, emitted_at: '2026-04-20T08:20:24Z' },
      ],
    });
    const agent = new MondayBriefAgent(supabase);
    const brief = await agent.generate('agency-1');

    expect(brief.recommendedActions[0].clientId).toBe('c-linden');
    expect(brief.recommendedActions[0].signalReason).toBe('velocity_drop');
    expect(brief.narrative.headline).toMatch(/dropped sharply|paused/i);
    expect(brief.narrative.headline).toContain('Linden');
  });

  it('does not promote a small velocity drop (<60%)', async () => {
    const supabase = fakeSupabase({
      clients: [northwind],
      healthScores: [northwindHealth],
      clientSignals: [
        // 4 → 3 = 25% drop, below threshold
        { client_id: 'c-northwind', signal_type: 'content_velocity', value: 3, emitted_at: '2026-04-27T08:20:24Z' },
        { client_id: 'c-northwind', signal_type: 'content_velocity', value: 4, emitted_at: '2026-04-20T08:20:24Z' },
      ],
    });
    const agent = new MondayBriefAgent(supabase);
    const brief = await agent.generate('agency-1');

    const top = brief.recommendedActions[0];
    expect(top?.signalReason).toBeUndefined();
    expect(brief.narrative.headline).not.toContain('Northwind');
  });

  it('is no-op when client_signals is empty (preserves existing 4-priority behavior)', async () => {
    const supabase = fakeSupabase({
      clients: [linden, northwind],
      healthScores: [lindenHealth, northwindHealth],
      clientSignals: [],
    });
    const agent = new MondayBriefAgent(supabase);
    const brief = await agent.generate('agency-1');

    for (const a of brief.recommendedActions) {
      expect(a.signalReason).toBeUndefined();
    }
  });

  it('tolerates object-shaped client_health_scores.signals (demo-seed legacy)', async () => {
    // The demo seed historically wrote `{ demo: true, scenario: '...' }`
    // into the JSONB column instead of the expected array. Generating
    // a brief against this shape used to crash with "signals is not
    // iterable"; it must now resolve cleanly.
    const supabase = fakeSupabase({
      clients: [northwind],
      healthScores: [
        {
          client_id: 'c-northwind',
          overall_score: 86,
          signals: { demo: true, scenario: 'Healthy fintech' },
        },
      ],
      clientSignals: [],
    });
    const agent = new MondayBriefAgent(supabase);
    const brief = await agent.generate('agency-1');
    expect(brief.snapshot.totalClients).toBe(1);
    expect(brief.needsAttention[0]?.topSignal).toBeUndefined();
  });

  it('does not double-up when the paused client is also critical', async () => {
    const supabase = fakeSupabase({
      clients: [cypress],
      healthScores: [{ client_id: 'c-cypress', overall_score: 22, signals: [] }],
      clientSignals: [
        { client_id: 'c-cypress', signal_type: 'pause_resume', value: 1, emitted_at: '2026-04-27T08:20:24Z' },
      ],
    });
    const agent = new MondayBriefAgent(supabase);
    const brief = await agent.generate('agency-1');

    const cypressActions = brief.recommendedActions.filter((a) => a.clientId === 'c-cypress');
    expect(cypressActions).toHaveLength(1);
    expect(cypressActions[0].signalReason).toBe('paused');
  });
});
