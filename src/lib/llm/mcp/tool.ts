// ─── MCP Tool contract — Sprint 8A M2 ───────────────────────────
// Every MCP tool is a single value implementing this interface. The
// registry keeps them in a Map by name; the server calls handler with
// the already-authenticated session.

import type { CallToolResult, MCPJSONSchema, MCPTier } from './types';

/** The authenticated user and environment for a single MCP request. */
export interface MCPSession {
  userId: string;
  tier: MCPTier;
  apiKeyId: string;
  /** Connection row id from mcp_connections — tools may use this for idempotency keys. */
  connectionId: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPJSONSchema;
  /**
   * Handler is called after the session is authenticated and the tool
   * is resolved. Throw MCPError subclasses for anything user-visible;
   * anything else is mapped to INTERNAL_ERROR by the server.
   */
  handler: (args: Record<string, unknown>, session: MCPSession) => Promise<CallToolResult>;
}

/**
 * Simple in-process tool registry. No hot-reload, no remote lookup —
 * deliberately minimal. Tools register once at module load.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, MCPTool>();

  register(tool: MCPTool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  list(): MCPTool[] {
    // Stable alphabetical order for deterministic tools/list output.
    return Array.from(this.tools.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  size(): number {
    return this.tools.size;
  }
}
