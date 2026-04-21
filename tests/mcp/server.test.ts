// ─── MCP server + registry + tool dispatch tests — Sprint 8A M2 ─
// Pure unit tests. No Supabase, no Anthropic — we exercise the
// transport-independent MCPServer with stub tools and assert the
// JSON-RPC envelopes are well-formed.

import { describe, it, expect, vi } from 'vitest';
import { MCPServer } from '@/lib/llm/mcp/server';
import { ToolRegistry, type MCPTool, type MCPSession } from '@/lib/llm/mcp/tool';
import {
  MCPError,
  MCPInvalidParamsError,
  MCPTierGateError,
} from '@/lib/llm/mcp/errors';
import { MCP_ERROR_CODES, MCP_PROTOCOL_VERSION } from '@/lib/llm/mcp/types';

const session: MCPSession = {
  userId: 'user-1',
  tier: 'pro',
  apiKeyId: 'key-1',
  connectionId: 'conn-1',
};

function stubTool(name: string, handler?: MCPTool['handler']): MCPTool {
  return {
    name,
    description: `stub ${name}`,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler:
      handler ??
      (async () => ({
        content: [{ type: 'text', text: `called ${name}` }],
      })),
  };
}

function server(tools: MCPTool[] = []) {
  const reg = new ToolRegistry();
  for (const t of tools) reg.register(t);
  return new MCPServer({ registry: reg });
}

describe('MCPServer — initialize + ping', () => {
  it('negotiates protocolVersion 2025-03-26 by default', async () => {
    const res = await server().handle(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      null
    );
    expect('result' in res).toBe(true);
    if ('result' in res) {
      const r = res.result as { protocolVersion: string; serverInfo: { name: string } };
      expect(r.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
      expect(r.serverInfo.name).toBe('clientpulse-mcp');
    }
  });

  it('respects the requested protocolVersion when supported', async () => {
    const res = await server().handle(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      },
      null
    );
    if ('result' in res) {
      expect((res.result as { protocolVersion: string }).protocolVersion).toBe(
        '2024-11-05'
      );
    }
  });

  it('ping returns success with no auth', async () => {
    const res = await server().handle(
      { jsonrpc: '2.0', id: 3, method: 'ping' },
      null
    );
    expect('result' in res).toBe(true);
  });

  it('rejects malformed jsonrpc field', async () => {
    const res = await server().handle(
      { jsonrpc: '1.0' as '2.0', id: 4, method: 'ping' },
      null
    );
    expect('error' in res).toBe(true);
    if ('error' in res) {
      expect(res.error.code).toBe(MCP_ERROR_CODES.INVALID_REQUEST);
    }
  });
});

describe('MCPServer — auth gating', () => {
  it('tools/list requires a session', async () => {
    const res = await server().handle(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      null
    );
    expect('error' in res).toBe(true);
    if ('error' in res) {
      expect(res.error.code).toBe(MCP_ERROR_CODES.AUTH_REQUIRED);
    }
  });

  it('tools/call requires a session', async () => {
    const res = await server([stubTool('foo')]).handle(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'foo' } },
      null
    );
    expect('error' in res).toBe(true);
  });
});

describe('MCPServer — tools/list', () => {
  it('returns stable alphabetical order', async () => {
    const srv = server([stubTool('zeta'), stubTool('alpha'), stubTool('mu')]);
    const res = await srv.handle(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      session
    );
    if ('result' in res) {
      const names = (res.result as { tools: { name: string }[] }).tools.map((t) => t.name);
      expect(names).toEqual(['alpha', 'mu', 'zeta']);
    }
  });

  it('includes description + inputSchema for each tool', async () => {
    const srv = server([stubTool('foo')]);
    const res = await srv.handle(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      session
    );
    if ('result' in res) {
      const tools = (res.result as { tools: unknown[] }).tools;
      expect(tools[0]).toMatchObject({
        name: 'foo',
        description: expect.any(String),
        inputSchema: expect.any(Object),
      });
    }
  });
});

describe('MCPServer — tools/call', () => {
  it('dispatches to the named tool', async () => {
    const handler = vi.fn(async () => ({
      content: [{ type: 'text' as const, text: 'ok' }],
    }));
    const srv = server([stubTool('foo', handler)]);
    const res = await srv.handle(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'foo', arguments: { bar: 1 } },
      },
      session
    );
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ bar: 1 }, session);
    if ('result' in res) {
      expect((res.result as { content: unknown[] }).content).toHaveLength(1);
    }
  });

  it('returns TOOL_NOT_FOUND for unknown tool', async () => {
    const res = await server().handle(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'nope' } },
      session
    );
    if ('error' in res) {
      expect(res.error.code).toBe(MCP_ERROR_CODES.TOOL_NOT_FOUND);
    }
  });

  it('surfaces MCPError subclasses with their code', async () => {
    const handler = async () => {
      throw new MCPInvalidParamsError('bad input');
    };
    const res = await server([stubTool('foo', handler)]).handle(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'foo' } },
      session
    );
    if ('error' in res) {
      expect(res.error.code).toBe(MCP_ERROR_CODES.INVALID_PARAMS);
      expect(res.error.message).toBe('bad input');
    }
  });

  it('maps non-MCPError exceptions to INTERNAL_ERROR with opaque message', async () => {
    const handler = async () => {
      throw new Error('db exploded — do not leak this');
    };
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await server([stubTool('foo', handler)]).handle(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'foo' } },
      session
    );
    if ('error' in res) {
      expect(res.error.code).toBe(MCP_ERROR_CODES.INTERNAL_ERROR);
      expect(res.error.message).toBe('Internal server error');
      expect(res.error.message).not.toContain('db exploded');
    }
    errSpy.mockRestore();
  });

  it('rejects calls without a `name` param', async () => {
    const res = await server([stubTool('foo')]).handle(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} },
      session
    );
    if ('error' in res) {
      expect(res.error.code).toBe(MCP_ERROR_CODES.INVALID_PARAMS);
    }
  });
});

describe('MCPServer — unknown method', () => {
  it('returns METHOD_NOT_FOUND', async () => {
    const res = await server().handle(
      { jsonrpc: '2.0', id: 1, method: 'resources/list' },
      session
    );
    if ('error' in res) {
      expect(res.error.code).toBe(MCP_ERROR_CODES.METHOD_NOT_FOUND);
    }
  });
});

describe('ToolRegistry', () => {
  it('throws on duplicate registration', () => {
    const r = new ToolRegistry();
    r.register(stubTool('foo'));
    expect(() => r.register(stubTool('foo'))).toThrow(/already registered/);
  });

  it('get returns undefined for missing tools', () => {
    expect(new ToolRegistry().get('nope')).toBeUndefined();
  });
});

describe('MCPError subclasses carry the right code', () => {
  it('MCPTierGateError uses TIER_GATE', () => {
    const e = new MCPTierGateError('pro', 'free');
    expect(e.code).toBe(MCP_ERROR_CODES.TIER_GATE);
    expect(e.data).toEqual({ requiredTier: 'pro', actualTier: 'free' });
  });

  it('isMCPError-style check works', () => {
    expect(new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, 'x') instanceof MCPError).toBe(true);
  });
});

describe('Registry bootstrap — built-in CP tools', () => {
  it('buildRegistry registers all 5 tools with unique names', async () => {
    const { buildRegistry, TOOL_NAMES } = await import('@/lib/llm/mcp/tools');
    const reg = buildRegistry();
    expect(reg.size()).toBe(TOOL_NAMES.length);
    const names = reg.list().map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of TOOL_NAMES) {
      expect(names).toContain(n);
    }
  });
});
