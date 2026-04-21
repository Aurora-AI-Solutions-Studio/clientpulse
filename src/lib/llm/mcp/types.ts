// ─── MCP Protocol Types — Sprint 8A M2 ─────────────────────────
// Subset of the Model Context Protocol v2025-03-26 spec needed for
// ClientPulse's server-side exposure. Reference: modelcontextprotocol.io
//
// We intentionally implement only what we need — initialize, tools/list,
// tools/call, ping. Resources, prompts, sampling, roots, and logging are
// out of scope for v1. Add them when needed.

// ─── JSON-RPC 2.0 envelopes ──────────────────────────────────────

export type JSONRPCId = string | number | null;

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: JSONRPCId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCSuccess<T = unknown> {
  jsonrpc: '2.0';
  id: JSONRPCId;
  result: T;
}

export interface JSONRPCError {
  jsonrpc: '2.0';
  id: JSONRPCId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JSONRPCResponse<T = unknown> = JSONRPCSuccess<T> | JSONRPCError;

// ─── MCP error codes ─────────────────────────────────────────────
// JSON-RPC reserved range is -32768 to -32000. MCP-specific errors
// above -32000 per the spec.

export const MCP_ERROR_CODES = {
  // Standard JSON-RPC
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific
  TOOL_NOT_FOUND: -32000,
  TIER_GATE: -32001,
  AUTH_REQUIRED: -32002,
  CONNECTION_LIMIT: -32003,
  RATE_LIMITED: -32004,
} as const;

export type MCPErrorCode = (typeof MCP_ERROR_CODES)[keyof typeof MCP_ERROR_CODES];

// ─── Capabilities ────────────────────────────────────────────────

export interface MCPServerInfo {
  name: string;
  version: string;
}

export interface MCPServerCapabilities {
  tools?: { listChanged?: boolean };
}

export interface MCPClientInfo {
  name: string;
  version: string;
}

export interface MCPClientCapabilities {
  [k: string]: unknown;
}

export interface InitializeParams {
  protocolVersion: string;
  capabilities: MCPClientCapabilities;
  clientInfo: MCPClientInfo;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: MCPServerInfo;
  instructions?: string;
}

export const MCP_PROTOCOL_VERSION = '2025-03-26';
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = ['2025-03-26', '2024-11-05'];

// ─── Tools ───────────────────────────────────────────────────────

export interface MCPJSONSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
  [k: string]: unknown;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: MCPJSONSchema;
}

export interface ListToolsResult {
  tools: MCPToolDefinition[];
}

export interface CallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export type MCPContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string } };

export interface CallToolResult {
  content: MCPContentBlock[];
  isError?: boolean;
  structuredContent?: unknown;
}

// ─── Tier gate ───────────────────────────────────────────────────
// Per-tier MCP connection allowance per Pricing D-D2.
// Keys mirror the `profiles.subscription_plan` CHECK constraint
// ('free' | 'starter' | 'pro' | 'agency'). The tier-naming sweep
// (starter → solo) happens with the Tier Metering milestone.

export const MCP_CONNECTION_LIMITS = {
  free: 0,
  starter: 0,
  pro: 3,
  agency: Infinity,
} as const;

export type MCPTier = keyof typeof MCP_CONNECTION_LIMITS;
