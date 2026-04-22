// ─── MCP Tools: write path — Sprint 8A Tier Metering ────────────
// Thin adapters over the same Supabase tables the HTTP API uses.
// Every write here goes through requireApiScope('write') — only the
// Agency tier's apiAccess = 'full' passes. Free/Solo/Pro reject early
// with a TIER_GATE error the transport surfaces to the caller.
//
// Business logic does not live here. Scoring lives in lib/health,
// brief composition lives in lib/agents/monday-brief-agent. These
// wrappers exist only to bridge the MCP envelope to the same code
// path the dashboard uses.

import { createServiceClient } from '@/lib/supabase/service';
import { MondayBriefAgent } from '@/lib/agents/monday-brief-agent';
import { refreshClientHealth } from '@/lib/health/refresh';
import { requireApiScope } from '@/lib/tiers/mcp-guard';
import type { MCPTool } from '../tool';
import { MCPError, MCPInvalidParamsError } from '../errors';
import { MCP_ERROR_CODES } from '../types';
import { resolveAgencyId } from './helpers';

// ─── create_action_item ──────────────────────────────────────────

export const createActionItemTool: MCPTool = {
  name: 'create_action_item',
  description:
    "Create an action item on a client in the authenticated agency. Status defaults to 'open'; set due_date (YYYY-MM-DD) to have the item surface in upcoming-due filters. Agency-tier write scope required.",
  inputSchema: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'Client id (from list_clients).' },
      title: { type: 'string', description: 'Short action item title.' },
      description: {
        type: 'string',
        description: 'Optional longer description or notes.',
      },
      due_date: {
        type: 'string',
        description: 'Optional YYYY-MM-DD due date.',
      },
    },
    required: ['client_id', 'title'],
    additionalProperties: false,
  },
  async handler(args, session) {
    await requireApiScope(session, 'write');
    const agencyId = await resolveAgencyId(session);

    const clientId = args.client_id;
    const title = args.title;
    const description = args.description;
    const dueDate = args.due_date;

    if (typeof clientId !== 'string' || !clientId) {
      throw new MCPInvalidParamsError('`client_id` is required');
    }
    if (typeof title !== 'string' || !title.trim()) {
      throw new MCPInvalidParamsError('`title` must be a non-empty string');
    }
    if (description !== undefined && typeof description !== 'string') {
      throw new MCPInvalidParamsError('`description` must be a string');
    }
    if (dueDate !== undefined) {
      if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        throw new MCPInvalidParamsError('`due_date` must be YYYY-MM-DD');
      }
    }

    const supabase = createServiceClient();

    // Scope the client to this agency before inserting — we bypass RLS
    // on the service client, so the app has to enforce ownership.
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, company_name, name')
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

    const { data: inserted, error: insertErr } = await supabase
      .from('action_items')
      .insert({
        client_id: clientId,
        title: title.trim(),
        description:
          typeof description === 'string' && description.trim()
            ? description.trim()
            : null,
        due_date: dueDate ?? null,
        status: 'open',
      })
      .select(
        'id, client_id, meeting_id, title, description, status, due_date, assigned_to, created_at'
      )
      .single();
    if (insertErr || !inserted) {
      throw new MCPError(
        MCP_ERROR_CODES.INTERNAL_ERROR,
        insertErr?.message ?? 'Failed to create action item'
      );
    }

    return {
      content: [
        {
          type: 'text',
          text:
            `Created action item "${inserted.title}" on ${client.company_name} (id=${inserted.id})` +
            (inserted.due_date ? ` · due ${inserted.due_date}` : '') +
            '.',
        },
      ],
      structuredContent: { action_item: inserted },
    };
  },
};

// ─── trigger_health_refresh ──────────────────────────────────────

interface RefreshResult {
  client_id: string;
  overall: number;
  status: 'healthy' | 'at-risk' | 'critical';
}

export const triggerHealthRefreshTool: MCPTool = {
  name: 'trigger_health_refresh',
  description:
    "Recompute one client's health score now, or omit client_id to refresh every client in the agency sequentially. Returns the fresh overall score and status per client. Agency-tier write scope required.",
  inputSchema: {
    type: 'object',
    properties: {
      client_id: {
        type: 'string',
        description:
          'Optional — single client scope. Omit to refresh the whole portfolio.',
      },
    },
    additionalProperties: false,
  },
  async handler(args, session) {
    await requireApiScope(session, 'write');
    const agencyId = await resolveAgencyId(session);
    const clientId = typeof args.client_id === 'string' ? args.client_id : undefined;

    const supabase = createServiceClient();

    // Resolve the target set up-front so we can report partial failures
    // with meaningful numerators/denominators.
    let targetIds: string[];
    if (clientId) {
      const { data: client, error } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('agency_id', agencyId)
        .maybeSingle();
      if (error) throw new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, error.message);
      if (!client) {
        throw new MCPError(
          MCP_ERROR_CODES.INVALID_PARAMS,
          'Client not found in this agency.'
        );
      }
      targetIds = [clientId];
    } else {
      const { data: rows, error } = await supabase
        .from('clients')
        .select('id')
        .eq('agency_id', agencyId);
      if (error) throw new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, error.message);
      targetIds = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id);
    }

    if (targetIds.length === 0) {
      return {
        content: [{ type: 'text', text: 'No clients in this agency to refresh.' }],
        structuredContent: { refreshed: 0, total: 0, results: [] },
      };
    }

    // Sequential — each refresh issues several queries; paralleling the
    // loop would multiply Supabase concurrency without a clear throughput
    // win at typical portfolio sizes (<~25 clients per agency).
    const results: RefreshResult[] = [];
    for (const id of targetIds) {
      try {
        const score = await refreshClientHealth({ supabase, clientId: id });
        results.push({ client_id: id, overall: score.overall, status: score.status });
      } catch (err) {
        // Skip on per-client failure so one bad row doesn't sink the batch.
        console.error('[mcp trigger_health_refresh] failed for client', id, err);
      }
    }

    const preview = results
      .slice(0, 25)
      .map((r) => `- ${r.client_id} · ${r.status} · ${r.overall}/100`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text:
            `Refreshed ${results.length} of ${targetIds.length} client(s).` +
            (preview ? `\n${preview}` : '') +
            (results.length > 25 ? `\n…and ${results.length - 25} more.` : ''),
        },
      ],
      structuredContent: {
        refreshed: results.length,
        total: targetIds.length,
        results,
      },
    };
  },
};

// ─── generate_monday_brief ───────────────────────────────────────

export const generateMondayBriefTool: MCPTool = {
  name: 'generate_monday_brief',
  description:
    "Generate a fresh Monday Brief for the authenticated agency and persist it to monday_briefs. Does NOT send email — use the HTTP /api/monday-brief endpoint if you want delivery. Agency-tier write scope required.",
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  async handler(_args, session) {
    await requireApiScope(session, 'write');
    const agencyId = await resolveAgencyId(session);

    const supabase = createServiceClient();
    const agent = new MondayBriefAgent(supabase);
    const content = await agent.generate(agencyId);

    const { data: saved, error } = await supabase
      .from('monday_briefs')
      .insert({ agency_id: agencyId, content, email_sent: false })
      .select('id, content, email_sent, sent_at, created_at')
      .single();
    if (error || !saved) {
      throw new MCPError(
        MCP_ERROR_CODES.INTERNAL_ERROR,
        error?.message ?? 'Failed to persist Monday Brief'
      );
    }

    const summary =
      typeof content.narrative?.summary === 'string'
        ? content.narrative.summary
        : '(no narrative summary — inspect structuredContent.brief.content)';

    return {
      content: [
        {
          type: 'text',
          text:
            `Generated Monday Brief for week of ${content.weekOf} (id=${saved.id}).\n\n` +
            String(summary).slice(0, 1500),
        },
      ],
      structuredContent: { brief: saved },
    };
  },
};
