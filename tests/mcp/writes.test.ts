// ─── MCP write-tool tests — Sprint 8A Tier Metering ─────────────
// Exercises create_action_item, trigger_health_refresh, and
// generate_monday_brief end-to-end with a minimal Supabase fake.
//
// What we assert:
//   1. requireApiScope('write') is invoked first on every tool — if
//      the guard throws, the tool surfaces it (no DB side effects).
//   2. create_action_item:
//        - validates title + due_date shape
//        - rejects a client that doesn't belong to the agency
//        - inserts with status='open' and echoes the saved row back
//   3. trigger_health_refresh:
//        - single client scope verifies ownership before refreshing
//        - omit client_id → iterates every client in the agency
//        - per-client failure is swallowed (batch continues) and
//          reflected in structuredContent.refreshed vs total
//   4. generate_monday_brief:
//        - instantiates the agent, persists, and returns the saved row

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Control plane for the fake Supabase client ─────────────────

type FakeResult = { data: unknown; error: unknown };

interface ResponderBag {
  select?: (filters: Record<string, unknown>) => unknown;
  insert?: (row: unknown) => unknown;
  upsert?: (row: unknown) => unknown;
}

const responders = new Map<string, ResponderBag>();
const insertCalls: Array<{ table: string; row: unknown }> = [];

function setResp(table: string, bag: ResponderBag) {
  responders.set(table, bag);
}

function reset() {
  responders.clear();
  insertCalls.length = 0;
}

function makeQuery(table: string) {
  let mode: 'select' | 'insert' | 'upsert' = 'select';
  let lastInsert: unknown = null;
  const filters: Record<string, unknown> = {};

  const bag = () => responders.get(table) ?? {};

  const resolveTerminal = (terminal: 'single' | 'maybeSingle' | 'array'): FakeResult => {
    if (mode === 'insert') {
      const row = bag().insert?.(lastInsert);
      return { data: row ?? null, error: null };
    }
    if (mode === 'upsert') {
      // upsert resolves with { error } only; data is irrelevant.
      return { data: null, error: null };
    }
    const row = bag().select?.(filters);
    if (terminal === 'array') return { data: row ?? [], error: null };
    return { data: row ?? null, error: null };
  };

  const q: Record<string, unknown> = {
    select(_cols?: string) {
      return q;
    },
    insert(row: unknown) {
      lastInsert = row;
      mode = 'insert';
      insertCalls.push({ table, row });
      return q;
    },
    upsert(row: unknown, _opts?: unknown) {
      mode = 'upsert';
      insertCalls.push({ table, row });
      return Promise.resolve(resolveTerminal('array'));
    },
    eq(key: string, val: unknown) {
      filters[key] = val;
      return q;
    },
    order() { return q; },
    limit() { return q; },
    in() { return q; },
    lte() { return q; },
    single() { return Promise.resolve(resolveTerminal('single')); },
    maybeSingle() { return Promise.resolve(resolveTerminal('maybeSingle')); },
    then(onf: (v: FakeResult) => unknown) {
      return Promise.resolve(resolveTerminal('array')).then(onf);
    },
  };
  return q;
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => makeQuery(table),
  }),
}));

// Tier guard — default allow (agency tier), tests can flip per-test.
const requireApiScopeMock = vi.fn(async (_s: unknown, _scope: 'read' | 'write') => ({
  subscription_plan: 'agency',
}));

vi.mock('@/lib/tiers/mcp-guard', () => ({
  requireApiScope: (...args: unknown[]) =>
    requireApiScopeMock(args[0], args[1] as 'read' | 'write'),
}));

// Health refresh helper — mock so we don't drag in the full scoring stack.
const refreshMock = vi.fn();
vi.mock('@/lib/health/refresh', () => ({
  refreshClientHealth: (...args: unknown[]) => refreshMock(...args),
}));

// Monday Brief agent — stub so we don't need real portfolio data.
const briefGenerateMock = vi.fn();
vi.mock('@/lib/agents/monday-brief-agent', () => ({
  MondayBriefAgent: class {
    constructor(_supabase: unknown) {
      // no-op
    }
    generate(...args: unknown[]): unknown {
      return briefGenerateMock(...args);
    }
  },
}));

// ─── Imports AFTER mocks are declared ───────────────────────────

import {
  createActionItemTool,
  triggerHealthRefreshTool,
  generateMondayBriefTool,
} from '@/lib/llm/mcp/tools/writes';
import { MCPError } from '@/lib/llm/mcp/errors';
import { MCP_ERROR_CODES } from '@/lib/llm/mcp/types';
import type { MCPSession } from '@/lib/llm/mcp/tool';

const session: MCPSession = {
  userId: 'user-1',
  tier: 'agency',
  apiKeyId: 'key-1',
  connectionId: 'conn-1',
};

const defaultProfileResp = { agency_id: 'agency-1' };

beforeEach(() => {
  reset();
  requireApiScopeMock.mockReset();
  requireApiScopeMock.mockResolvedValue({ subscription_plan: 'agency' });
  refreshMock.mockReset();
  briefGenerateMock.mockReset();
});

// ─── Shared: tier guard enforcement ──────────────────────────────

describe('write tools — requireApiScope gate', () => {
  it('create_action_item surfaces the guard throw before touching the DB', async () => {
    requireApiScopeMock.mockRejectedValueOnce(
      new MCPError(MCP_ERROR_CODES.TIER_GATE, 'nope')
    );
    await expect(
      createActionItemTool.handler(
        { client_id: 'c-1', title: 'x' },
        session
      )
    ).rejects.toBeInstanceOf(MCPError);
    expect(insertCalls).toHaveLength(0);
  });

  it('trigger_health_refresh surfaces the guard throw', async () => {
    requireApiScopeMock.mockRejectedValueOnce(
      new MCPError(MCP_ERROR_CODES.TIER_GATE, 'nope')
    );
    await expect(
      triggerHealthRefreshTool.handler({}, session)
    ).rejects.toBeInstanceOf(MCPError);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('generate_monday_brief surfaces the guard throw', async () => {
    requireApiScopeMock.mockRejectedValueOnce(
      new MCPError(MCP_ERROR_CODES.TIER_GATE, 'nope')
    );
    await expect(
      generateMondayBriefTool.handler({}, session)
    ).rejects.toBeInstanceOf(MCPError);
    expect(briefGenerateMock).not.toHaveBeenCalled();
  });

  it.each(['create_action_item', 'trigger_health_refresh', 'generate_monday_brief'])(
    'all 3 tools call requireApiScope with scope="write"',
    async (toolName) => {
      // Prime just enough to make each tool succeed.
      setResp('profiles', { select: () => defaultProfileResp });
      setResp('clients', {
        // Single-client lookups (filter.id present) → object, whole-agency
        // enumerations (no filter.id) → array. Lets trigger_health_refresh's
        // bulk branch work in the same parameterized test as the others.
        select: (filters) =>
          filters.id
            ? { id: filters.id, name: 'Ann', company_name: 'Acme' }
            : [{ id: 'c-1' }],
      });
      setResp('action_items', {
        insert: (row: unknown) => ({ ...(row as object), id: 'ai-1', created_at: 'now' }),
      });
      setResp('monday_briefs', {
        insert: (row: unknown) => ({ ...(row as object), id: 'mb-1', created_at: 'now' }),
      });
      briefGenerateMock.mockResolvedValue({
        weekOf: '2026-04-20',
        narrative: { summary: 'ok' },
      });
      refreshMock.mockResolvedValue({ overall: 72, status: 'healthy' });

      const tool =
        toolName === 'create_action_item'
          ? createActionItemTool
          : toolName === 'trigger_health_refresh'
            ? triggerHealthRefreshTool
            : generateMondayBriefTool;

      const args =
        toolName === 'create_action_item' ? { client_id: 'c-1', title: 'x' } : {};

      await tool.handler(args, session);
      expect(requireApiScopeMock).toHaveBeenCalledWith(session, 'write');
    }
  );
});

// ─── create_action_item ──────────────────────────────────────────

describe('create_action_item', () => {
  beforeEach(() => {
    setResp('profiles', { select: () => defaultProfileResp });
  });

  it('rejects a missing title', async () => {
    await expect(
      createActionItemTool.handler({ client_id: 'c-1', title: '   ' }, session)
    ).rejects.toThrow(/non-empty string/);
  });

  it('rejects a bad due_date shape', async () => {
    await expect(
      createActionItemTool.handler(
        { client_id: 'c-1', title: 'ok', due_date: '2026/04/22' },
        session
      )
    ).rejects.toThrow(/YYYY-MM-DD/);
  });

  it('rejects when client does not belong to the agency', async () => {
    setResp('clients', { select: () => null });
    await expect(
      createActionItemTool.handler(
        { client_id: 'c-1', title: 'review proposal' },
        session
      )
    ).rejects.toThrow(/Client not found/);
    expect(insertCalls.filter((c) => c.table === 'action_items')).toHaveLength(0);
  });

  it('inserts an open item and echoes the saved row', async () => {
    setResp('clients', {
      select: () => ({ id: 'c-1', name: 'Ann', company_name: 'Acme Co' }),
    });
    setResp('action_items', {
      insert: (row: unknown) => ({
        ...(row as object),
        id: 'ai-42',
        meeting_id: null,
        assigned_to: null,
        created_at: '2026-04-22T10:00:00.000Z',
      }),
    });

    const res = await createActionItemTool.handler(
      {
        client_id: 'c-1',
        title: '  Kickoff call  ',
        description: '  bring the deck  ',
        due_date: '2026-04-30',
      },
      session
    );

    const call = insertCalls.find((c) => c.table === 'action_items');
    expect(call?.row).toMatchObject({
      client_id: 'c-1',
      title: 'Kickoff call',
      description: 'bring the deck',
      due_date: '2026-04-30',
      status: 'open',
    });

    const sc = res.structuredContent as { action_item: { id: string; title: string } };
    expect(sc.action_item.id).toBe('ai-42');
    expect(sc.action_item.title).toBe('Kickoff call');
    expect(res.content[0]).toMatchObject({ type: 'text' });
    if (res.content[0].type === 'text') {
      expect(res.content[0].text).toContain('Acme Co');
      expect(res.content[0].text).toContain('due 2026-04-30');
    }
  });

  it('coerces an empty description to null on insert', async () => {
    setResp('clients', {
      select: () => ({ id: 'c-1', name: 'Ann', company_name: 'Acme Co' }),
    });
    setResp('action_items', {
      insert: (row: unknown) => ({
        ...(row as object),
        id: 'ai-43',
        created_at: 'now',
      }),
    });

    await createActionItemTool.handler(
      { client_id: 'c-1', title: 'x', description: '   ' },
      session
    );

    const call = insertCalls.find((c) => c.table === 'action_items');
    expect((call?.row as { description: unknown }).description).toBeNull();
  });
});

// ─── trigger_health_refresh ──────────────────────────────────────

describe('trigger_health_refresh', () => {
  beforeEach(() => {
    setResp('profiles', { select: () => defaultProfileResp });
  });

  it('single client scope: rejects when the client is not in the agency', async () => {
    setResp('clients', { select: () => null });
    await expect(
      triggerHealthRefreshTool.handler({ client_id: 'c-1' }, session)
    ).rejects.toThrow(/Client not found/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('single client scope: refreshes one and returns the score', async () => {
    setResp('clients', { select: () => ({ id: 'c-1' }) });
    refreshMock.mockResolvedValue({ overall: 82, status: 'healthy' });

    const res = await triggerHealthRefreshTool.handler(
      { client_id: 'c-1' },
      session
    );

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(refreshMock.mock.calls[0][0]).toMatchObject({ clientId: 'c-1' });
    const sc = res.structuredContent as {
      refreshed: number;
      total: number;
      results: Array<{ client_id: string; overall: number }>;
    };
    expect(sc).toEqual({
      refreshed: 1,
      total: 1,
      results: [{ client_id: 'c-1', overall: 82, status: 'healthy' }],
    });
  });

  it('whole-agency scope: iterates every client', async () => {
    // No client_id filter matches single-client-check → we use the
    // array select instead. Differentiate via the absence of `id` filter.
    setResp('clients', {
      select: (filters) =>
        filters.id ? { id: filters.id } : [{ id: 'c-1' }, { id: 'c-2' }, { id: 'c-3' }],
    });
    refreshMock.mockImplementation(({ clientId }: { clientId: string }) =>
      Promise.resolve({ overall: clientId === 'c-2' ? 45 : 80, status: 'healthy' })
    );

    const res = await triggerHealthRefreshTool.handler({}, session);
    expect(refreshMock).toHaveBeenCalledTimes(3);

    const sc = res.structuredContent as {
      refreshed: number;
      total: number;
      results: Array<{ client_id: string }>;
    };
    expect(sc.refreshed).toBe(3);
    expect(sc.total).toBe(3);
    expect(sc.results.map((r) => r.client_id)).toEqual(['c-1', 'c-2', 'c-3']);
  });

  it('continues on per-client failure and reports refreshed vs total', async () => {
    setResp('clients', {
      select: (filters) => (filters.id ? { id: filters.id } : [{ id: 'c-1' }, { id: 'c-2' }]),
    });
    refreshMock.mockImplementation(({ clientId }: { clientId: string }) => {
      if (clientId === 'c-2') return Promise.reject(new Error('boom'));
      return Promise.resolve({ overall: 77, status: 'healthy' });
    });

    // Suppress the expected console.error without losing test signal.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await triggerHealthRefreshTool.handler({}, session);
    errSpy.mockRestore();

    const sc = res.structuredContent as { refreshed: number; total: number };
    expect(sc).toMatchObject({ refreshed: 1, total: 2 });
  });

  it('empty agency: returns refreshed=0 without calling the helper', async () => {
    setResp('clients', {
      select: (filters) => (filters.id ? null : []),
    });

    const res = await triggerHealthRefreshTool.handler({}, session);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(res.structuredContent).toEqual({ refreshed: 0, total: 0, results: [] });
  });
});

// ─── generate_monday_brief ───────────────────────────────────────

describe('generate_monday_brief', () => {
  beforeEach(() => {
    setResp('profiles', { select: () => defaultProfileResp });
  });

  it('generates, persists, and echoes the saved row', async () => {
    const briefContent = {
      weekOf: '2026-04-20',
      narrative: { summary: 'All quiet on the portfolio front.' },
    };
    briefGenerateMock.mockResolvedValue(briefContent);
    setResp('monday_briefs', {
      insert: (row: unknown) => ({
        ...(row as object),
        id: 'mb-9',
        sent_at: null,
        created_at: '2026-04-22T10:00:00.000Z',
      }),
    });

    const res = await generateMondayBriefTool.handler({}, session);
    expect(briefGenerateMock).toHaveBeenCalledWith('agency-1');

    const briefInsert = insertCalls.find((c) => c.table === 'monday_briefs');
    expect(briefInsert?.row).toMatchObject({
      agency_id: 'agency-1',
      content: briefContent,
      email_sent: false,
    });

    const sc = res.structuredContent as { brief: { id: string } };
    expect(sc.brief.id).toBe('mb-9');
    if (res.content[0].type === 'text') {
      expect(res.content[0].text).toContain('Generated Monday Brief');
      expect(res.content[0].text).toContain('2026-04-20');
      expect(res.content[0].text).toContain('All quiet');
    }
  });
});
