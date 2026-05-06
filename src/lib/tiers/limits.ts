// ─── Tier Limits — Sprint 8A Tier Metering ──────────────────────
// Single source of truth for per-tier limits across ClientPulse.
//
// Canonical CP matrix (Apr 14 Pricing Deep-Dive + Unified Sprint Plan v2):
//
//                         free   solo       pro       agency
//   clients               0      3          10        ∞
//   retentionDays         30     90         365       1095
//   healthRefreshCadence  none   daily      hourly    realtime
//   seats                 1      1          3         8
//   mcpConnections        0      0          3         ∞
//   apiAccess             'none' 'none'     'read'    'full'
//
// Tier source is `profiles.subscription_plan` — a single-column 4-tier
// enum, unlike ContentPulse's dual `plan` / `launch_plan` setup. Unknown /
// missing values fall back to 'free'.

import type { SubscriptionPlan } from '@/types/stripe';

/** All accepted DB-level tier strings including `free`. */
export type CPTier = 'free' | SubscriptionPlan;

/** How often a client's health score is recomputed for this tier. */
export type HealthRefreshCadence = 'none' | 'daily' | 'hourly' | 'realtime';

/** Scope of API + MCP write access granted to a tier. */
export type ApiAccess = 'none' | 'read' | 'full';

export interface TierLimits {
  /** Max clients that can be created under a single agency. */
  clients: number;
  /** Data retention window in days — used by the retention cron. */
  retentionDays: number;
  /** Health-score refresh cadence — used by the refresh scheduler. */
  healthRefreshCadence: HealthRefreshCadence;
  /** Max agency_members (seats) on this agency. */
  seats: number;
  /** Max concurrent MCP connections. Mirrors MCP_CONNECTION_LIMITS. */
  mcpConnections: number;
  /** API key issuance + MCP tool scope. */
  apiAccess: ApiAccess;
}

export const TIER_LIMITS: Record<CPTier, TierLimits> = {
  free: {
    clients: 0,
    retentionDays: 30,
    healthRefreshCadence: 'none',
    seats: 1,
    mcpConnections: 0,
    apiAccess: 'none',
  },
  solo: {
    clients: 3,
    retentionDays: 90,
    healthRefreshCadence: 'daily',
    seats: 1,
    mcpConnections: 0,
    apiAccess: 'none',
  },
  pro: {
    clients: 10,
    retentionDays: 365,
    healthRefreshCadence: 'hourly',
    seats: 3,
    mcpConnections: 3,
    apiAccess: 'read',
  },
  agency: {
    clients: Infinity,
    retentionDays: 1095,
    healthRefreshCadence: 'realtime',
    seats: 8,
    mcpConnections: Infinity,
    apiAccess: 'full',
  },
};

export interface TierProfile {
  subscription_plan?: string | null;
}

/**
 * Resolve the effective tier for a profile row. Unknown or missing
 * values collapse to `free` — the conservative default that gates every
 * optional feature off.
 */
export function resolveTier(profile: TierProfile | null | undefined): CPTier {
  if (!profile) return 'free';
  const p = profile.subscription_plan;
  if (p === 'solo' || p === 'pro' || p === 'agency' || p === 'free') return p;
  return 'free';
}

/** Resolve tier limits for a profile in one call. */
export function getTierLimits(profile: TierProfile | null | undefined): TierLimits {
  return TIER_LIMITS[resolveTier(profile)];
}

/** Short, user-facing tier name for error messages. */
export function tierDisplayName(tier: CPTier): string {
  switch (tier) {
    case 'free':   return 'Free';
    case 'solo':   return 'Solo';
    case 'pro':    return 'Pro';
    case 'agency': return 'Agency';
  }
}

/**
 * Retention window helper used by the retention cron. Returns the
 * number of days a tier's data is kept before expiry.
 */
export function getRetentionDays(profile: TierProfile | null | undefined): number {
  return getTierLimits(profile).retentionDays;
}

/**
 * Health refresh cadence helper used by the scheduler to decide how
 * often to recompute a client's health score.
 */
export function getHealthRefreshCadence(
  profile: TierProfile | null | undefined
): HealthRefreshCadence {
  return getTierLimits(profile).healthRefreshCadence;
}
