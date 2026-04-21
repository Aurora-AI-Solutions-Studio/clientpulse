// ─── MCP Tools: client domain — Sprint 8A M2 ────────────────────
// Read-only surface over clients + current health scores. Agents use
// these to pull a portfolio snapshot before deciding which clients to
// focus on — "which clients are in trouble right now?" is the #1 query.
//
// Write paths (create_action_item, trigger_health_refresh, …) land in
// the next milestone once tier-metering helpers are in place.

import { createServiceClient } from '@/lib/supabase/service';
import type { MCPTool } from '../tool';
import { MCPError, MCPInvalidParamsError } from '../errors';
import { MCP_ERROR_CODES } from '../types';
import { resolveAgencyId, CLIENT_STATUSES, type ClientStatus } from './helpers';

interface ClientRow {
  id: string;
  name: string;
  company_name: string;
  status: ClientStatus;
  monthly_retainer: number | null;
  service_type: string | null;
  created_at: string;
}

interface HealthRow {
  client_id: string;
  overall_score: number | null;
  financial_score: number | null;
  relationship_score: number | null;
  delivery_score: number | null;
  engagement_score: number | null;
  signals: unknown;
  computed_at: string;
}

// ─── list_clients ────────────────────────────────────────────────

export const listClientsTool: MCPTool = {
  name: 'list_clients',
  description:
    "List the authenticated agency's clients with current status, monthly retainer, and latest overall health score. Optional status filter.",
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: `Filter by lifecycle status. Allowed: ${CLIENT_STATUSES.join(', ')}.`,
      },
      limit: {
        type: 'number',
        description: 'Max rows to return. Default 100, max 500.',
      },
    },
    additionalProperties: false,
  },
  async handler(args, session) {
    const agencyId = await resolveAgencyId(session);
    const status = typeof args.status === 'string' ? args.status : undefined;
    if (status && !CLIENT_STATUSES.includes(status as ClientStatus)) {
      throw new MCPInvalidParamsError(
        `Unknown status "${status}". Allowed: ${CLIENT_STATUSES.join(', ')}`
      );
    }
    const limit = resolveLimit(args.limit, 100, 500);

    const supabase = createServiceClient();
    let query = supabase
      .from('clients')
      .select('id, name, company_name, status, monthly_retainer, service_type, created_at')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);

    const { data: clients, error } = await query;
    if (error) throw new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, error.message);

    const rows = (clients ?? []) as ClientRow[];
    const ids = rows.map((c) => c.id);

    // Batch-fetch current health scores; join client-side so we don't
    // pay a round-trip per row.
    const healthByClient = new Map<string, number | null>();
    if (ids.length > 0) {
      const { data: health } = await supabase
        .from('client_health_scores')
        .select('client_id, overall_score')
        .in('client_id', ids);
      for (const row of (health ?? []) as Array<Pick<HealthRow, 'client_id' | 'overall_score'>>) {
        healthByClient.set(row.client_id, row.overall_score);
      }
    }

    const enriched = rows.map((c) => ({
      id: c.id,
      name: c.name,
      company_name: c.company_name,
      status: c.status,
      monthly_retainer: c.monthly_retainer,
      service_type: c.service_type,
      overall_score: healthByClient.get(c.id) ?? null,
    }));

    const preview = enriched
      .slice(0, 25)
      .map(
        (c) =>
          `- ${c.company_name} (${c.name}) · ${c.status} · score=${c.overall_score ?? 'n/a'}` +
          (c.monthly_retainer ? ` · $${c.monthly_retainer}/mo` : '')
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: enriched.length
            ? `Found ${enriched.length} client(s):\n${preview}` +
              (enriched.length > 25 ? `\n…and ${enriched.length - 25} more.` : '')
            : 'No clients found for this agency.',
        },
      ],
      structuredContent: { clients: enriched },
    };
  },
};

// ─── get_client_health ───────────────────────────────────────────

export const getClientHealthTool: MCPTool = {
  name: 'get_client_health',
  description:
    'Return the current health score breakdown for a single client: overall + financial + relationship + delivery + engagement subscores plus raw signals and the timestamp it was computed.',
  inputSchema: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'Client id (from list_clients).' },
    },
    required: ['client_id'],
    additionalProperties: false,
  },
  async handler(args, session) {
    const agencyId = await resolveAgencyId(session);
    const clientId = args.client_id;
    if (typeof clientId !== 'string' || !clientId) {
      throw new MCPInvalidParamsError('`client_id` is required');
    }

    const supabase = createServiceClient();

    // Fetch the client first so we can enforce agency scoping AND return
    // a useful "not found" error distinct from "no health score yet".
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, company_name, status, agency_id')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (clientErr) throw new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, clientErr.message);
    if (!client) {
      throw new MCPError(
        MCP_ERROR_CODES.INVALID_PARAMS,
        'Client not found in this agency.'
      );
    }

    const { data: health } = await supabase
      .from('client_health_scores')
      .select(
        'overall_score, financial_score, relationship_score, delivery_score, engagement_score, signals, computed_at'
      )
      .eq('client_id', clientId)
      .maybeSingle();

    const summary =
      health && health.overall_score !== null
        ? `Overall ${health.overall_score}/100 · financial ${health.financial_score ?? '—'} · ` +
          `relationship ${health.relationship_score ?? '—'} · delivery ${health.delivery_score ?? '—'} · ` +
          `engagement ${health.engagement_score ?? '—'} · computed ${health.computed_at}`
        : 'No health score computed yet for this client.';

    return {
      content: [
        {
          type: 'text',
          text: `${client.company_name} (${client.name}) · status=${client.status}\n${summary}`,
        },
      ],
      structuredContent: { client, health: health ?? null },
    };
  },
};

// ─── list_at_risk_clients ────────────────────────────────────────

export const listAtRiskClientsTool: MCPTool = {
  name: 'list_at_risk_clients',
  description:
    'List clients that are at risk of churning — status = at_risk or critical, OR latest overall health score below the threshold. Sorted worst-first so the most urgent clients come first.',
  inputSchema: {
    type: 'object',
    properties: {
      score_threshold: {
        type: 'number',
        description:
          'Include clients whose latest overall_score is strictly less than this value. Default 50.',
      },
      limit: {
        type: 'number',
        description: 'Max rows to return. Default 50, max 200.',
      },
    },
    additionalProperties: false,
  },
  async handler(args, session) {
    const agencyId = await resolveAgencyId(session);
    const threshold = resolveThreshold(args.score_threshold, 50);
    const limit = resolveLimit(args.limit, 50, 200);

    const supabase = createServiceClient();
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, company_name, status, monthly_retainer, service_type')
      .eq('agency_id', agencyId)
      .in('status', ['active', 'at_risk', 'critical'] as ClientStatus[]);

    if (error) throw new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, error.message);
    const rows = (clients ?? []) as ClientRow[];
    const ids = rows.map((c) => c.id);

    const healthByClient = new Map<string, number | null>();
    const signalsByClient = new Map<string, unknown>();
    if (ids.length > 0) {
      const { data: health } = await supabase
        .from('client_health_scores')
        .select('client_id, overall_score, signals')
        .in('client_id', ids);
      for (const row of (health ?? []) as HealthRow[]) {
        healthByClient.set(row.client_id, row.overall_score);
        signalsByClient.set(row.client_id, row.signals);
      }
    }

    const atRisk = rows
      .map((c) => ({
        id: c.id,
        name: c.name,
        company_name: c.company_name,
        status: c.status,
        monthly_retainer: c.monthly_retainer,
        service_type: c.service_type,
        overall_score: healthByClient.get(c.id) ?? null,
        signals: signalsByClient.get(c.id) ?? null,
      }))
      .filter((c) => {
        if (c.status === 'at_risk' || c.status === 'critical') return true;
        return typeof c.overall_score === 'number' && c.overall_score < threshold;
      })
      .sort((a, b) => {
        // critical > at_risk > active when scores are tied/missing.
        const statusWeight = (s: ClientStatus) =>
          s === 'critical' ? 2 : s === 'at_risk' ? 1 : 0;
        const sw = statusWeight(b.status) - statusWeight(a.status);
        if (sw !== 0) return sw;
        const ascore = a.overall_score ?? 999;
        const bscore = b.overall_score ?? 999;
        return ascore - bscore;
      })
      .slice(0, limit);

    const preview = atRisk
      .slice(0, 25)
      .map(
        (c) =>
          `- ${c.company_name} (${c.name}) · ${c.status} · score=${c.overall_score ?? 'n/a'}`
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: atRisk.length
            ? `Found ${atRisk.length} at-risk client(s) (threshold=${threshold}):\n${preview}` +
              (atRisk.length > 25 ? `\n…and ${atRisk.length - 25} more.` : '')
            : 'No at-risk clients right now.',
        },
      ],
      structuredContent: { threshold, clients: atRisk },
    };
  },
};

// ─── helpers ─────────────────────────────────────────────────────

function resolveLimit(raw: unknown, fallback: number, max: number): number {
  if (typeof raw !== 'number') return fallback;
  if (!Number.isFinite(raw) || raw < 1) {
    throw new MCPInvalidParamsError('`limit` must be a positive number');
  }
  return Math.min(max, Math.floor(raw));
}

function resolveThreshold(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number') return fallback;
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
    throw new MCPInvalidParamsError('`score_threshold` must be between 0 and 100');
  }
  return raw;
}
