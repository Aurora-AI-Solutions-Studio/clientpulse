// ─── MCP Tools: action items + monday brief — Sprint 8A M2 ──────
// Read-only access to the two workflow primitives agents need most:
// open action items (what the human committed to) and the latest
// Monday Brief (the agency's weekly narrative).
//
// Creating/mutating action items is a write path and lands with the
// tier-metering milestone so we can gate it against seats + retention.

import { createServiceClient } from '@/lib/supabase/service';
import type { MCPTool } from '../tool';
import { MCPError, MCPInvalidParamsError } from '../errors';
import { MCP_ERROR_CODES } from '../types';
import { resolveAgencyId } from './helpers';

const ACTION_ITEM_STATUSES = ['open', 'done', 'overdue'] as const;
type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

interface ActionItemRow {
  id: string;
  client_id: string;
  meeting_id: string | null;
  title: string;
  description: string | null;
  status: ActionItemStatus;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

// ─── list_action_items ───────────────────────────────────────────

export const listActionItemsTool: MCPTool = {
  name: 'list_action_items',
  description:
    "List action items across the authenticated agency's clients. Defaults to open items, sorted by due date (soonest first, nulls last). Filter by client_id or status.",
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: `Filter by status. Allowed: ${ACTION_ITEM_STATUSES.join(', ')}. Default "open".`,
      },
      client_id: {
        type: 'string',
        description: 'Optional — restrict to one client.',
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
    const status = typeof args.status === 'string' ? args.status : 'open';
    if (!ACTION_ITEM_STATUSES.includes(status as ActionItemStatus)) {
      throw new MCPInvalidParamsError(
        `Unknown status "${status}". Allowed: ${ACTION_ITEM_STATUSES.join(', ')}`
      );
    }
    const clientId = typeof args.client_id === 'string' ? args.client_id : undefined;
    const limitRaw = args.limit;
    let limit = 100;
    if (typeof limitRaw === 'number') {
      if (!Number.isFinite(limitRaw) || limitRaw < 1) {
        throw new MCPInvalidParamsError('`limit` must be a positive number');
      }
      limit = Math.min(500, Math.floor(limitRaw));
    }

    const supabase = createServiceClient();

    // Scope by agency via clients.agency_id — we can't filter action_items
    // directly because the column lives on the parent. One extra query
    // per list call keeps the write path simple.
    const { data: clientIdsRows, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('agency_id', agencyId);
    if (clientErr) throw new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, clientErr.message);

    const clientIds = ((clientIdsRows ?? []) as Array<{ id: string }>).map((c) => c.id);
    if (clientIds.length === 0) {
      return {
        content: [{ type: 'text', text: 'No clients in this agency yet.' }],
        structuredContent: { action_items: [] },
      };
    }

    if (clientId && !clientIds.includes(clientId)) {
      throw new MCPError(
        MCP_ERROR_CODES.INVALID_PARAMS,
        'client_id does not belong to this agency.'
      );
    }

    const { data, error } = await supabase
      .from('action_items')
      .select('id, client_id, meeting_id, title, description, status, due_date, assigned_to, created_at')
      .eq('status', status)
      .in('client_id', clientId ? [clientId] : clientIds)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, error.message);

    const items = (data ?? []) as ActionItemRow[];
    const preview = items
      .slice(0, 25)
      .map(
        (a) =>
          `- ${a.title}${a.due_date ? ` · due ${a.due_date}` : ''} · client=${a.client_id} · id=${a.id}`
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: items.length
            ? `Found ${items.length} ${status} action item(s):\n${preview}` +
              (items.length > 25 ? `\n…and ${items.length - 25} more.` : '')
            : `No ${status} action items found.`,
        },
      ],
      structuredContent: { action_items: items },
    };
  },
};

// ─── get_latest_monday_brief ─────────────────────────────────────

export const getLatestMondayBriefTool: MCPTool = {
  name: 'get_latest_monday_brief',
  description:
    "Return the most recent Monday Brief for the authenticated agency — the weekly summary of portfolio health, at-risk clients, and next steps. Use this to pick up where the last weekly review left off.",
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  async handler(_args, session) {
    const agencyId = await resolveAgencyId(session);
    const supabase = createServiceClient();

    const { data: brief, error } = await supabase
      .from('monday_briefs')
      .select('id, content, email_sent, sent_at, created_at')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new MCPError(MCP_ERROR_CODES.INTERNAL_ERROR, error.message);

    if (!brief) {
      return {
        content: [
          {
            type: 'text',
            text: 'No Monday Briefs generated yet for this agency.',
          },
        ],
        structuredContent: { brief: null },
      };
    }

    const content = brief.content as Record<string, unknown> | null;
    const summary =
      content && typeof content === 'object' && typeof content.summary === 'string'
        ? content.summary
        : '(no summary text — inspect structuredContent.brief.content)';

    return {
      content: [
        {
          type: 'text',
          text:
            `Latest Monday Brief (created ${brief.created_at}, emailed=${brief.email_sent}):\n\n` +
            String(summary).slice(0, 1500),
        },
      ],
      structuredContent: { brief },
    };
  },
};
