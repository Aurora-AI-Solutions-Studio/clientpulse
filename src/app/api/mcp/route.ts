// ─── MCP Streamable HTTP transport — Sprint 8A M2 ──────────────
// Implements the MCP 2025-03-26 Streamable HTTP transport on a single
// route. Two verbs:
//
//   POST /api/mcp
//     Body: single JSON-RPC request OR batch (array).
//     Returns: JSON-RPC response(s) inline for request→response flows.
//     Notifications (no `id`) return 204 No Content.
//
//   GET /api/mcp (Accept: text/event-stream)
//     Opens an SSE stream. Used by clients that want server-initiated
//     messages (none in v1, but required for handshake compatibility
//     with Claude Desktop's remote MCP flow). We emit an initial
//     `endpoint` event pointing at the POST URL and keep the stream
//     alive with periodic pings.
//
// Auth:
//   Authorization: Bearer <api_key>
//   Keys are provisioned via the API Keys dashboard (future milestone).

import { NextRequest, NextResponse } from 'next/server';
import { MCPServer } from '@/lib/llm/mcp/server';
import { buildRegistry } from '@/lib/llm/mcp/tools';
import {
  authenticateMCPRequest,
  closeConnection,
  touchConnection,
} from '@/lib/llm/mcp/auth';
import { MCPError } from '@/lib/llm/mcp/errors';
import {
  MCP_ERROR_CODES,
  type JSONRPCRequest,
  type JSONRPCResponse,
} from '@/lib/llm/mcp/types';
import type { MCPSession } from '@/lib/llm/mcp/tool';

// Node runtime — needed for node:crypto (timingSafeEqual) used in auth.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Build the registry once per cold start. Tools are stateless.
const registry = buildRegistry();
const server = new MCPServer({
  registry,
  instructions:
    'ClientPulse MCP — inspect your agency client portfolio, health scores, and action items. See tools/list for the full surface.',
});

// ─── POST: JSON-RPC request/response ─────────────────────────────

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonRpcErrorResponse(null, MCP_ERROR_CODES.PARSE_ERROR, 'Invalid JSON');
  }

  let session: MCPSession | null = null;
  try {
    session = await authenticateMCPRequest({
      authorizationHeader: request.headers.get('authorization'),
      connectionId: request.headers.get('mcp-session-id') ?? undefined,
      clientLabel: request.headers.get('user-agent'),
    });
  } catch (err) {
    if (err instanceof MCPError) {
      return jsonRpcErrorResponse(null, err.code, err.message, err.data);
    }
    return jsonRpcErrorResponse(
      null,
      MCP_ERROR_CODES.AUTH_REQUIRED,
      'Authentication failed'
    );
  }

  const isBatch = Array.isArray(payload);
  const requests: unknown[] = isBatch ? (payload as unknown[]) : [payload];

  // Process sequentially — tools are not all safe for parallel writes to
  // the same user's rows. Callers that want throughput open multiple
  // connections (up to their tier limit).
  const responses: JSONRPCResponse[] = [];
  for (const raw of requests) {
    if (!isJSONRPCRequest(raw)) {
      responses.push({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: MCP_ERROR_CODES.INVALID_REQUEST,
          message: 'Malformed JSON-RPC request',
        },
      });
      continue;
    }

    const isNotification = raw.id === undefined;
    try {
      const res = await server.handle(raw as JSONRPCRequest, session);
      if (!isNotification) responses.push(res);
    } catch (err) {
      if (!isNotification) {
        const code = err instanceof MCPError ? err.code : MCP_ERROR_CODES.INTERNAL_ERROR;
        const message = err instanceof Error ? err.message : 'Internal error';
        responses.push({ jsonrpc: '2.0', id: raw.id ?? null, error: { code, message } });
      }
    }
  }

  // Heartbeat — we just did work on this connection. Fire-and-forget.
  if (session) void touchConnection(session.connectionId);

  if (responses.length === 0) {
    return new NextResponse(null, { status: 204 });
  }
  const body = isBatch ? responses : responses[0];
  return NextResponse.json(body, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'mcp-session-id': session.connectionId,
    },
  });
}

// ─── GET: SSE stream (optional server→client channel) ────────────

export async function GET(request: NextRequest) {
  const accept = request.headers.get('accept') ?? '';
  if (!accept.includes('text/event-stream')) {
    return NextResponse.json(
      {
        error:
          'MCP endpoint. POST JSON-RPC requests, or GET with Accept: text/event-stream.',
      },
      { status: 406 }
    );
  }

  let session: MCPSession;
  try {
    session = await authenticateMCPRequest({
      authorizationHeader: request.headers.get('authorization'),
      connectionId: request.headers.get('mcp-session-id') ?? undefined,
      clientLabel: request.headers.get('user-agent'),
    });
  } catch (err) {
    const msg = err instanceof MCPError ? err.message : 'Authentication failed';
    const code = err instanceof MCPError ? err.code : MCP_ERROR_CODES.AUTH_REQUIRED;
    return jsonRpcErrorResponse(null, code, msg);
  }

  const encoder = new TextEncoder();
  const origin = new URL(request.url).origin;
  const postEndpoint = `${origin}/api/mcp`;

  const stream = new ReadableStream({
    start(controller) {
      // Announce the POST endpoint per Streamable HTTP spec.
      controller.enqueue(
        encoder.encode(
          `event: endpoint\ndata: ${postEndpoint}?session=${session.connectionId}\n\n`
        )
      );

      // Heartbeat every 25s. Keeps proxies (Vercel/Cloudflare) from
      // killing the stream and refreshes last_seen_at on the connection.
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
          void touchConnection(session.connectionId);
        } catch {
          clearInterval(interval);
        }
      }, 25_000);

      const abort = () => {
        clearInterval(interval);
        void closeConnection(session.connectionId);
        try {
          controller.close();
        } catch {
          /* noop */
        }
      };
      request.signal.addEventListener('abort', abort);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'mcp-session-id': session.connectionId,
    },
  });
}

// ─── OPTIONS: CORS preflight ─────────────────────────────────────

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-session-id',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// ─── helpers ─────────────────────────────────────────────────────

function isJSONRPCRequest(v: unknown): v is JSONRPCRequest {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { jsonrpc?: unknown }).jsonrpc === '2.0' &&
    typeof (v as { method?: unknown }).method === 'string'
  );
}

function jsonRpcErrorResponse(
  id: JSONRPCRequest['id'] | null,
  code: number,
  message: string,
  data?: unknown
) {
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
