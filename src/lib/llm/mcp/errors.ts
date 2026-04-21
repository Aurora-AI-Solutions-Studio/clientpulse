// ─── MCP Error types — Sprint 8A M2 ─────────────────────────────
// Domain errors thrown by tool handlers and the auth layer. The server
// maps these to JSON-RPC error envelopes with the correct MCP code.

import { MCP_ERROR_CODES, type MCPErrorCode } from './types';

export class MCPError extends Error {
  public readonly code: MCPErrorCode;
  public readonly data?: unknown;

  constructor(code: MCPErrorCode, message: string, data?: unknown) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.data = data;
  }
}

export class MCPAuthRequiredError extends MCPError {
  constructor(message = 'API key required') {
    super(MCP_ERROR_CODES.AUTH_REQUIRED, message);
    this.name = 'MCPAuthRequiredError';
  }
}

export class MCPTierGateError extends MCPError {
  constructor(
    public readonly requiredTier: string,
    public readonly actualTier: string,
    message?: string
  ) {
    super(
      MCP_ERROR_CODES.TIER_GATE,
      message ??
        `MCP access requires ${requiredTier} tier or higher (current: ${actualTier})`,
      { requiredTier, actualTier }
    );
    this.name = 'MCPTierGateError';
  }
}

export class MCPConnectionLimitError extends MCPError {
  constructor(
    public readonly limit: number,
    public readonly active: number,
    public readonly tier: string
  ) {
    super(
      MCP_ERROR_CODES.CONNECTION_LIMIT,
      `Connection limit reached: ${active}/${limit} active MCP connections for ${tier} tier`,
      { limit, active, tier }
    );
    this.name = 'MCPConnectionLimitError';
  }
}

export class MCPToolNotFoundError extends MCPError {
  constructor(public readonly toolName: string) {
    super(MCP_ERROR_CODES.TOOL_NOT_FOUND, `Unknown tool: ${toolName}`, { toolName });
    this.name = 'MCPToolNotFoundError';
  }
}

export class MCPInvalidParamsError extends MCPError {
  constructor(message: string, data?: unknown) {
    super(MCP_ERROR_CODES.INVALID_PARAMS, message, data);
    this.name = 'MCPInvalidParamsError';
  }
}

export class MCPRateLimitedError extends MCPError {
  constructor(public readonly resetMs: number) {
    super(
      MCP_ERROR_CODES.RATE_LIMITED,
      `Rate limit exceeded, retry in ${Math.ceil(resetMs / 1000)}s`,
      { resetMs }
    );
    this.name = 'MCPRateLimitedError';
  }
}

export function isMCPError(err: unknown): err is MCPError {
  return err instanceof MCPError;
}
