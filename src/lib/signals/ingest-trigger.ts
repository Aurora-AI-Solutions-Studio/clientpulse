// Orchestrates the APE auto-trigger after a client_signal is upserted.
//
// Responsible for:
//   1. Fetching the persisted signal row (id) and the previous-period
//      value of the same signal_type for the same client.
//   2. Resolving the client's display name for the action item title.
//   3. Calling evaluateSignalTrigger and, on a hit, calling
//      createActionItem with sourceSignalId set.
//
// All errors are swallowed and surfaced to the caller as a structured
// result — the ingest route MUST NOT fail because the APE could not
// auto-create an item, otherwise ContentPulse will retry the signal forever.
//
// Idempotency: action_items.source_signal_id has a partial UNIQUE
// index. A duplicate insert raises Postgres 23505, which we map to
// `outcome: 'already_exists'` instead of an error.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createActionItem,
  ActionItemOwnershipError,
  ActionItemValidationError,
} from '@/lib/action-items/create';
import {
  evaluateSignalTrigger,
  type SignalType,
  type SignalTriggerReason,
} from './triggers';

export interface MaybeCreateArgs {
  supabase: SupabaseClient;
  agencyId: string;
  clientId: string;
  signalType: SignalType;
  period: string;
  value: number;
}

export type IngestTriggerOutcome =
  | { outcome: 'skipped'; reason: 'no_match' | 'signal_not_found' | 'client_not_found' }
  | {
      outcome: 'created';
      actionItemId: string;
      reason: SignalTriggerReason;
    }
  | { outcome: 'already_exists'; reason: SignalTriggerReason }
  | { outcome: 'error'; message: string };

interface PgError {
  code?: string;
  message?: string;
}

export async function maybeCreateSignalTriggeredActionItem(
  args: MaybeCreateArgs
): Promise<IngestTriggerOutcome> {
  const { supabase, agencyId, clientId, signalType, period, value } = args;

  try {
    // 1) Resolve the persisted signal id (needed as the idempotency key).
    const { data: signalRow } = await supabase
      .from('client_signals')
      .select('id')
      .eq('client_id', clientId)
      .eq('signal_type', signalType)
      .eq('period', period)
      .maybeSingle();
    if (!signalRow?.id) {
      return { outcome: 'skipped', reason: 'signal_not_found' };
    }
    const signalId = signalRow.id as string;

    // 2) Resolve the client name for the action-item title.
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id, name, company_name')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .maybeSingle();
    if (!clientRow) {
      return { outcome: 'skipped', reason: 'client_not_found' };
    }
    const clientName =
      (clientRow.company_name as string | null) ??
      (clientRow.name as string | null) ??
      'this client';

    // 3) For velocity drops, fetch the previous-period value.
    let prevValue: number | null = null;
    if (signalType === 'content_velocity') {
      const { data: prevRow } = await supabase
        .from('client_signals')
        .select('value')
        .eq('client_id', clientId)
        .eq('signal_type', 'content_velocity')
        .neq('id', signalId)
        .order('emitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prevRow && typeof prevRow.value === 'number') {
        prevValue = prevRow.value;
      }
    }

    const decision = evaluateSignalTrigger({
      signalType,
      value,
      prevValue,
      clientName,
    });

    if (!decision.shouldCreate) {
      return { outcome: 'skipped', reason: 'no_match' };
    }

    try {
      const inserted = await createActionItem({
        supabase,
        agencyId,
        input: {
          clientId,
          title: decision.title,
          description: decision.description,
          sourceSignalId: signalId,
        },
      });
      return {
        outcome: 'created',
        actionItemId: inserted.id,
        reason: decision.reason,
      };
    } catch (err) {
      const pgErr = err as PgError;
      if (pgErr?.code === '23505') {
        return { outcome: 'already_exists', reason: decision.reason };
      }
      if (
        err instanceof ActionItemValidationError ||
        err instanceof ActionItemOwnershipError
      ) {
        return { outcome: 'error', message: err.message };
      }
      return {
        outcome: 'error',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  } catch (err) {
    return {
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
