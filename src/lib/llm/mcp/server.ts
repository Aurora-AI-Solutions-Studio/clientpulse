// ─── MCP Server Core — Sprint 8A M2 ─────────────────────────────
// Transport-independent JSON-RPC handler. Given a parsed MCP request
// and an authenticated session, returns an MCP response. The HTTP/SSE
// transport layer wraps this handler — it does not know about tools.

import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  type InitializeResult,
  type ListToolsResult,
  type CallToolResult,
  type CallToolParams,
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
} from './types';
import { MCPError, MCPToolNotFoundError, MCPInvalidParamsError } from './errors';
import type { ToolRegistry, MCPSession } from './tool';

/**
 * Server metadata announced to clients in `initialize`. Versioned
 * independently from the product so the tool surface can bump without
 * bumping the whole package.
 */
export const SERVER_INFO = {
  name: 'clientpulse-mcp',
  version: '1.0.0',
} as const;

export interface MCPServerOptions {
  registry: ToolRegistry;
  serverInfo?: { name: string; version: string };
  instructions?: string;
}

/**
 * Single-request handler. One MCPServer instance can handle many
 * sessions; state (connection tracking, auth) is carried on the
 * `session` argument, not on the server.
 */
export class MCPServer {
  private readonly registry: ToolRegistry;
  private readonly serverInfo: { name: string; version: string };
  private readonly instructions?: string;

  constructor(opts: MCPServerOptions) {
    this.registry = opts.registry;
    this.serverInfo = opts.serverInfo ?? SERVER_INFO;
    this.instructions = opts.instructions;
  }

  /**
   * Handle a single JSON-RPC request. Always returns a response — even
   * for errors — so the transport can write it back verbatim.
   *
   * The `session` carries the authenticated user, their tier, and the
   * connection id. It is `null` for unauthenticated handshake attempts
   * (only `initialize` and `ping` are allowed without auth).
   */
  async handle(req: JSONRPCRequest, session: MCPSession | null): Promise<JSONRPCResponse> {
    try {
      if (req.jsonrpc !== '2.0') {
        return this.errorResponse(req.id, MCP_ERROR_CODES.INVALID_REQUEST, 'jsonrpc must be "2.0"');
      }

      switch (req.method) {
        case 'initialize':
          return this.successResponse(req.id, this.handleInitialize(req.params));

        case 'ping':
          return this.successResponse(req.id, {});

        case 'notifications/initialized':
          return this.successResponse(req.id, {});

        case 'tools/list':
          this.requireSession(session);
          return this.successResponse(req.id, this.handleListTools());

        case 'tools/call':
          this.requireSession(session);
          return this.successResponse(
            req.id,
            await this.handleCallTool(req.params, session)
          );

        default:
          return this.errorResponse(
            req.id,
            MCP_ERROR_CODES.METHOD_NOT_FOUND,
            `Unknown method: ${req.method}`
          );
      }
    } catch (err) {
      if (err instanceof MCPError) {
        return this.errorResponse(req.id, err.code, err.message, err.data);
      }
      // Log server-side; return opaque message so internals don't leak.
      console.error('[mcp] unexpected error:', err);
      return this.errorResponse(
        req.id,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        'Internal server error'
      );
    }
  }

  // ─── Method handlers ───────────────────────────────────────────

  private handleInitialize(params: Record<string, unknown> | undefined): InitializeResult {
    const requested = (params?.protocolVersion as string | undefined) ?? MCP_PROTOCOL_VERSION;
    const negotiated = MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
      ? requested
      : MCP_PROTOCOL_VERSION;

    return {
      protocolVersion: negotiated,
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: this.serverInfo,
      instructions: this.instructions,
    };
  }

  private handleListTools(): ListToolsResult {
    return {
      tools: this.registry.list().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  }

  private async handleCallTool(
    params: Record<string, unknown> | undefined,
    session: MCPSession
  ): Promise<CallToolResult> {
    const p = (params ?? {}) as Partial<CallToolParams>;
    if (!p.name || typeof p.name !== 'string') {
      throw new MCPInvalidParamsError('tools/call requires a `name` string param');
    }

    const tool = this.registry.get(p.name);
    if (!tool) throw new MCPToolNotFoundError(p.name);

    return tool.handler(p.arguments ?? {}, session);
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private requireSession(session: MCPSession | null): asserts session is MCPSession {
    if (!session) {
      throw new MCPError(MCP_ERROR_CODES.AUTH_REQUIRED, 'API key required for this method');
    }
  }

  private successResponse<T>(id: JSONRPCRequest['id'], result: T) {
    return { jsonrpc: '2.0' as const, id, result };
  }

  private errorResponse(
    id: JSONRPCRequest['id'],
    code: number,
    message: string,
    data?: unknown
  ): JSONRPCResponse {
    return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
  }
}
