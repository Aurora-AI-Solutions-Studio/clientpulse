// ─── MCP tool helpers — Sprint 8A M2 ────────────────────────────
// Shared utilities used by every CP tool. Kept tiny on purpose — the
// moment a helper grows business logic, move it up into `src/lib/`.

import { createServiceClient } from '@/lib/supabase/service';
import { MCPError } from '../errors';
import { MCP_ERROR_CODES } from '../types';
import type { MCPSession } from '../tool';

/**
 * Resolve the authenticated user to their agency id. Every CP domain
 * object is scoped by agency, so every tool needs this up-front.
 *
 * Throws with a friendly message when the profile row is missing or
 * the user hasn't been provisioned with an agency yet — the dashboard
 * walks users through creating one, so agents should surface that
 * clearly instead of returning empty lists.
 */
export async function resolveAgencyId(session: MCPSession): Promise<string> {
  const supabase = createServiceClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('agency_id')
    .eq('id', session.userId)
    .single();

  if (error || !profile?.agency_id) {
    throw new MCPError(
      MCP_ERROR_CODES.INTERNAL_ERROR,
      'No agency is provisioned for this account — finish ClientPulse onboarding first.'
    );
  }
  return profile.agency_id as string;
}

export type ClientStatus = 'active' | 'at_risk' | 'critical' | 'churned' | 'paused';
export const CLIENT_STATUSES: readonly ClientStatus[] = [
  'active',
  'at_risk',
  'critical',
  'churned',
  'paused',
] as const;
