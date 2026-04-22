// ─── MCP Tool Registry bootstrap — Sprint 8A M2 ─────────────────
// One place to register all built-in ClientPulse MCP tools. The HTTP
// route imports `buildRegistry()` rather than individual tools so
// adding a new tool is a one-line change in this file.

import { ToolRegistry } from '../tool';
import {
  listClientsTool,
  getClientHealthTool,
  listAtRiskClientsTool,
} from './clients';
import { listActionItemsTool, getLatestMondayBriefTool } from './actions';
import {
  createActionItemTool,
  triggerHealthRefreshTool,
  generateMondayBriefTool,
} from './writes';

/** Construct a fresh registry with all v1 tools registered. */
export function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry
    .register(listClientsTool)
    .register(getClientHealthTool)
    .register(listAtRiskClientsTool)
    .register(listActionItemsTool)
    .register(getLatestMondayBriefTool)
    .register(createActionItemTool)
    .register(triggerHealthRefreshTool)
    .register(generateMondayBriefTool);
  return registry;
}

export const TOOL_NAMES = [
  'list_clients',
  'get_client_health',
  'list_at_risk_clients',
  'list_action_items',
  'get_latest_monday_brief',
  'create_action_item',
  'trigger_health_refresh',
  'generate_monday_brief',
] as const;
