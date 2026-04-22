// ─── Tier Enforcement — Sprint 8A Tier Metering ─────────────────
// The enforcement helpers called from API routes + MCP write tools.
// Ported from reforge/lib/tiers/enforce.ts and adapted to CP's domain
// (agencies + clients + agency_members, no pieces/channels/voices).

import { createServiceClient } from '@/lib/supabase/service';
import {
  getTierLimits,
  resolveTier,
  tierDisplayName,
  type ApiAccess,
  type CPTier,
  type TierProfile,
} from './limits';

/** Thrown when a tier cap or gate denies the operation. */
export class TierLimitError extends Error {
  /** HTTP status the API route should return. */
  readonly status: number;
  /** Machine-readable cap dimension ('clients', 'seats', 'api'). */
  readonly dimension: string;
  /** Tier that was evaluated. */
  readonly tier: CPTier;
  constructor(
    message: string,
    opts: { status?: number; dimension: string; tier: CPTier }
  ) {
    super(message);
    this.name = 'TierLimitError';
    this.status = opts.status ?? 429;
    this.dimension = opts.dimension;
    this.tier = opts.tier;
  }
}

// ─── 1. Client-count limit ────────────────────────────────────────

/**
 * Enforce the max-clients-per-agency cap.
 * Called from POST /api/clients before insert.
 *
 *   free   → 0  (rejected outright — free tier can't create clients)
 *   solo   → 3
 *   pro    → 10
 *   agency → ∞  (no-op)
 */
export async function enforceClientLimit(
  agencyId: string,
  profile: TierProfile
): Promise<void> {
  const tier = resolveTier(profile);
  const limits = getTierLimits(profile);
  if (limits.clients === Infinity) return;

  const supabase = createServiceClient();
  const { count } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId);

  const current = count ?? 0;
  if (current >= limits.clients) {
    throw new TierLimitError(
      `Your ${tierDisplayName(tier)} plan allows up to ${limits.clients} client(s). ` +
        `Upgrade to add more.`,
      { status: 403, dimension: 'clients', tier }
    );
  }
}

// ─── 2. Seats limit ──────────────────────────────────────────────

/**
 * Enforce the agency seats cap. Called from the (future) team-invite
 * endpoint before inserting into agency_members.
 *
 *   free/solo → 1 (self only, invite rejected)
 *   pro       → 3
 *   agency    → 8
 */
export async function enforceSeatsLimit(
  agencyId: string,
  profile: TierProfile
): Promise<void> {
  const tier = resolveTier(profile);
  const limits = getTierLimits(profile);
  if (limits.seats === Infinity) return;

  const supabase = createServiceClient();
  const { count } = await supabase
    .from('agency_members')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId);

  const current = count ?? 0;
  if (current >= limits.seats) {
    throw new TierLimitError(
      `Your ${tierDisplayName(tier)} plan includes ${limits.seats} seat(s). ` +
        `Remove a member or upgrade to invite more.`,
      { status: 403, dimension: 'seats', tier }
    );
  }
}

// ─── 3. API access scope ─────────────────────────────────────────

export type ApiScope = 'read' | 'write';

/**
 * Enforce that the current tier permits the requested API/MCP scope.
 *
 *   'none' → rejects all scopes.
 *   'read' → allows scope='read', rejects scope='write'.
 *   'full' → allows any scope.
 */
export function enforceApiAccess(
  profile: TierProfile,
  scope: ApiScope = 'read'
): void {
  const tier = resolveTier(profile);
  const limits = getTierLimits(profile);
  if (limits.apiAccess === 'full') return;
  if (limits.apiAccess === 'read' && scope === 'read') return;
  const niceScope = scope === 'read' ? 'read-only' : 'read/write';
  throw new TierLimitError(
    `Your ${tierDisplayName(tier)} plan does not include ${niceScope} API access. ` +
      `Upgrade to Pro (read-only) or Agency (full).`,
    { status: 403, dimension: 'api', tier }
  );
}

// Re-export the ApiAccess type for downstream callers that only import
// from './enforce'.
export type { ApiAccess };
