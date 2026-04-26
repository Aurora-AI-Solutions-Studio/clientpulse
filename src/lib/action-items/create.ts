// Shared action-item creation core.
//
// Single insert path used by:
//   - POST /api/action-items           (dashboard Accept buttons)
//   - MCP createActionItemTool         (Agency-tier API callers)
//
// Validates shape + enforces client→agency ownership. Does NOT enforce
// tier — that lives at the callers (requireTier on the HTTP route,
// requireApiScope('write') on the MCP tool).

import type { SupabaseClient } from '@supabase/supabase-js';

export type ActionItemStatus = 'open' | 'done' | 'overdue';

export interface ActionItemRow {
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

export interface CreateActionItemInput {
  clientId: string;
  title: string;
  description?: string;
  dueDate?: string;
  meetingId?: string;
  assignedTo?: string;
  /**
   * Idempotency key for "Accept from email" magic links. When set, persists
   * to action_items.source_email_token_hash, which has a partial UNIQUE
   * index — a duplicate insert (same hash) surfaces the underlying
   * Postgres 23505 error to the caller, which can then redirect the user
   * to "already accepted" instead of silently creating a duplicate row.
   */
  sourceEmailTokenHash?: string;
}

export interface CreateActionItemArgs {
  supabase: SupabaseClient;
  agencyId: string;
  input: CreateActionItemInput;
}

export class ActionItemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionItemValidationError';
  }
}

export class ActionItemOwnershipError extends Error {
  constructor() {
    super('Client not found in this agency.');
    this.name = 'ActionItemOwnershipError';
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createActionItem(
  args: CreateActionItemArgs
): Promise<ActionItemRow> {
  const { supabase, agencyId, input } = args;
  const {
    clientId,
    title,
    description,
    dueDate,
    meetingId,
    assignedTo,
    sourceEmailTokenHash,
  } = input;

  if (typeof clientId !== 'string' || !clientId) {
    throw new ActionItemValidationError('client_id is required');
  }
  if (typeof title !== 'string' || !title.trim()) {
    throw new ActionItemValidationError('title must be a non-empty string');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw new ActionItemValidationError('description must be a string');
  }
  if (
    dueDate !== undefined &&
    (typeof dueDate !== 'string' || !DATE_RE.test(dueDate))
  ) {
    throw new ActionItemValidationError('due_date must be YYYY-MM-DD');
  }
  if (
    meetingId !== undefined &&
    (typeof meetingId !== 'string' || !UUID_RE.test(meetingId))
  ) {
    throw new ActionItemValidationError('meeting_id must be a UUID');
  }
  if (
    assignedTo !== undefined &&
    (typeof assignedTo !== 'string' || !UUID_RE.test(assignedTo))
  ) {
    throw new ActionItemValidationError('assigned_to must be a UUID');
  }

  // Ownership check — the service client bypasses RLS, so we enforce
  // agency scope in application code. Same pattern as the MCP tool
  // used before this extraction (writes.ts).
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('agency_id', agencyId)
    .maybeSingle();
  if (clientErr) throw new Error(clientErr.message);
  if (!client) throw new ActionItemOwnershipError();

  const payload = {
    client_id: clientId,
    title: title.trim(),
    description:
      typeof description === 'string' && description.trim()
        ? description.trim()
        : null,
    due_date: dueDate ?? null,
    meeting_id: meetingId ?? null,
    assigned_to: assignedTo ?? null,
    status: 'open' as const,
    source_email_token_hash: sourceEmailTokenHash ?? null,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('action_items')
    .insert(payload)
    .select(
      'id, client_id, meeting_id, title, description, status, due_date, assigned_to, created_at'
    )
    .single();

  if (insertErr || !inserted) {
    // Preserve Postgres error code (e.g. 23505 unique_violation) so callers
    // — like the magic-link Accept route — can branch on it.
    const err = new Error(insertErr?.message ?? 'Failed to create action item');
    if (insertErr) {
      Object.assign(err, {
        code: (insertErr as { code?: string }).code,
        details: (insertErr as { details?: string }).details,
      });
    }
    throw err;
  }

  return inserted as ActionItemRow;
}
