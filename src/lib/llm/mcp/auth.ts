// ─── MCP Auth + Connection Gating — Sprint 8A M2 ────────────────
// Resolves an incoming API key into an authenticated MCPSession and
// enforces the per-tier connection limit.
//
// Tables (provisioned by the 20260421_sprint8a_mcp_tables.sql migration):
//   api_keys          — per-user API keys, SHA-256 hashed, with prefix
//   mcp_connections   — one row per active session (cleared on disconnect)
//
// Why hash the key?
//   - We store only `key_hash` + a 12-char `prefix` for display.
//   - On auth we look up by prefix, then constant-time compare the hash.
//
// Why a separate `mcp_connections` row per session?
//   - Lets us enforce tier-based connection limits (pro: 3, agency: ∞).
//   - Gives the dashboard "Active MCP Sessions" a real count.
//   - Rows are heartbeat'd by the transport and GC'd after idle timeout.

import { createHash, timingSafeEqual, webcrypto } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { MCP_CONNECTION_LIMITS, type MCPTier } from './types';
import {
  MCPAuthRequiredError,
  MCPConnectionLimitError,
  MCPTierGateError,
} from './errors';
import type { MCPSession } from './tool';

/** Public prefix length stored on api_keys.prefix. Same length we display. */
export const API_KEY_PREFIX_LEN = 12;

/** Idle timeout — connections older than this are considered dead. */
export const MCP_CONNECTION_IDLE_MS = 30 * 60 * 1000; // 30 minutes

interface ApiKeyRow {
  id: string;
  user_id: string;
  key_hash: string;
  prefix: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

interface ProfileRow {
  id: string;
  subscription_plan: string | null;
}

/** Hash an API key the same way we store it. Exposed for tests/seeders. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Map a `profiles.subscription_plan` value to an MCPTier. Unknown /
 * missing plans fall back to `free` (MCP disabled).
 */
export function resolveTier(profile: Pick<ProfileRow, 'subscription_plan'>): MCPTier {
  const p = profile.subscription_plan;
  if (p === 'pro' || p === 'agency' || p === 'solo' || p === 'free') return p;
  return 'free';
}

export interface AuthContext {
  /** Raw header string, e.g. "Bearer cp_sk_abc…" or just the key. */
  authorizationHeader?: string | null;
  /** Optional explicit api key (used by non-HTTP transports). */
  apiKey?: string;
  /** A stable id for this transport connection (e.g. SSE stream id). */
  connectionId?: string;
  /** User-Agent / client label, stored on mcp_connections for observability. */
  clientLabel?: string | null;
}

/**
 * Authenticate an incoming MCP request.
 *
 * Side effects on success:
 *   - Updates api_keys.last_used_at
 *   - Inserts/upserts an mcp_connections row (after the tier gate passes)
 *
 * Throws:
 *   - MCPAuthRequiredError — missing or invalid api key
 *   - MCPTierGateError     — tier has MCP disabled (free, solo)
 *   - MCPConnectionLimitError — too many active connections on this tier
 */
export async function authenticateMCPRequest(ctx: AuthContext): Promise<MCPSession> {
  const rawKey = extractApiKey(ctx);
  if (!rawKey) throw new MCPAuthRequiredError();

  const prefix = rawKey.slice(0, API_KEY_PREFIX_LEN);
  const hash = hashApiKey(rawKey);

  const supabase = createServiceClient();

  // Look up by prefix (indexed), then constant-time compare the hash.
  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, user_id, key_hash, prefix, revoked_at, last_used_at')
    .eq('prefix', prefix)
    .limit(5);

  const matched = (keys ?? []).find((row: ApiKeyRow) => {
    if (row.revoked_at) return false;
    try {
      const a = Buffer.from(row.key_hash, 'hex');
      const b = Buffer.from(hash, 'hex');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });

  if (!matched) throw new MCPAuthRequiredError('Invalid or revoked API key');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, subscription_plan')
    .eq('id', matched.user_id)
    .single();

  if (!profile) throw new MCPAuthRequiredError('User profile not found');

  const tier = resolveTier(profile as ProfileRow);
  const limit = MCP_CONNECTION_LIMITS[tier];

  // Tier gate — free/solo are not allowed to open MCP at all.
  if (limit === 0) {
    throw new MCPTierGateError('pro', tier);
  }

  // Prune stale connections before counting. A session that hasn't
  // heartbeat'd within MCP_CONNECTION_IDLE_MS is considered gone.
  const cutoff = new Date(Date.now() - MCP_CONNECTION_IDLE_MS).toISOString();
  await supabase
    .from('mcp_connections')
    .delete()
    .eq('user_id', matched.user_id)
    .lt('last_seen_at', cutoff);

  // Count active connections.
  const { count: activeCount } = await supabase
    .from('mcp_connections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', matched.user_id);

  const active = activeCount ?? 0;
  if (limit !== Infinity && active >= limit) {
    throw new MCPConnectionLimitError(limit, active, tier);
  }

  const connectionId = ctx.connectionId ?? cryptoRandomId();
  const nowIso = new Date().toISOString();

  await supabase
    .from('mcp_connections')
    .upsert(
      {
        id: connectionId,
        user_id: matched.user_id,
        api_key_id: matched.id,
        tier,
        client_label: ctx.clientLabel ?? null,
        created_at: nowIso,
        last_seen_at: nowIso,
      },
      { onConflict: 'id' }
    );

  await supabase
    .from('api_keys')
    .update({ last_used_at: nowIso })
    .eq('id', matched.id);

  return {
    userId: matched.user_id,
    tier,
    apiKeyId: matched.id,
    connectionId,
  };
}

/** Heartbeat an active connection so it doesn't get GC'd. */
export async function touchConnection(connectionId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('mcp_connections')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', connectionId);
}

/** Close a connection row explicitly when the transport disconnects. */
export async function closeConnection(connectionId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from('mcp_connections').delete().eq('id', connectionId);
}

// ─── helpers ─────────────────────────────────────────────────────

function extractApiKey(ctx: AuthContext): string | null {
  if (ctx.apiKey) return ctx.apiKey.trim() || null;
  const header = ctx.authorizationHeader?.trim();
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return (m ? m[1] : header).trim() || null;
}

function cryptoRandomId(): string {
  const bytes = new Uint8Array(16);
  (globalThis.crypto ?? webcrypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
