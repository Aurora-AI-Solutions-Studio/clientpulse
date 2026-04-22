// ─── MCP Tier Guard — Sprint 8A Tier Metering ───────────────────
// Tiny helper used by every write-scope MCP tool. Loads the profile
// once, asserts apiAccess is sufficient, and returns the tier profile
// so the tool can pass it to other tier helpers (enforceClientLimit etc.).

import { createServiceClient } from '@/lib/supabase/service';
import { MCPError } from '@/lib/llm/mcp/errors';
import { MCP_ERROR_CODES } from '@/lib/llm/mcp/types';
import type { MCPSession } from '@/lib/llm/mcp/tool';
import { enforceApiAccess, TierLimitError, type ApiScope } from './enforce';
import type { TierProfile } from './limits';

/**
 * Load the tier profile for an MCP session and enforce API access scope.
 * Returns the TierProfile so callers can pass it to other tier helpers
 * without re-reading `profiles`.
 *
 * Throws an MCPError(TIER_GATE) when the tier doesn't permit the scope —
 * the transport translates that into a JSON-RPC error visible to the
 * calling agent.
 */
export async function requireApiScope(
  session: MCPSession,
  scope: ApiScope
): Promise<TierProfile> {
  const supabase = createServiceClient();
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('subscription_plan')
    .eq('id', session.userId)
    .single();
  const tierProfile: TierProfile = profileRow ?? { subscription_plan: session.tier };
  try {
    enforceApiAccess(tierProfile, scope);
  } catch (err) {
    if (err instanceof TierLimitError) {
      throw new MCPError(MCP_ERROR_CODES.TIER_GATE, err.message);
    }
    throw err;
  }
  return tierProfile;
}
