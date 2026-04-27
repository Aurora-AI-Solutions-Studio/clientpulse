import { describe, expect, it, vi } from 'vitest';
import { maybeCreateSignalTriggeredActionItem } from '@/lib/signals/ingest-trigger';

const AGENCY = '00000000-0000-0000-0000-000000000aaa';
const CLIENT = '00000000-0000-0000-0000-000000000bbb';
const SIGNAL = '00000000-0000-0000-0000-000000000eee';

interface FakeSupabaseOpts {
  signalRow?: { id: string } | null;
  clientRow?: { id: string; name: string | null; company_name: string | null } | null;
  prevValueRow?: { value: number } | null;
  insertError?: { code?: string; message?: string };
  insertRow?: { id: string };
  onInsert?: (row: Record<string, unknown>) => void;
}

function fakeSupabase(opts: FakeSupabaseOpts) {
  return {
    from(table: string) {
      if (table === 'client_signals') {
        // Builder used twice: once to fetch the persisted signal row (id),
        // once to fetch the previous-period value. Distinguish by whether
        // .neq() is called (only the prev-value query uses it).
        let isPrevQuery = false;
        const builder: Record<string, unknown> = {
          select() { return builder; },
          eq() { return builder; },
          neq() { isPrevQuery = true; return builder; },
          order() { return builder; },
          limit() { return builder; },
          maybeSingle: () =>
            isPrevQuery
              ? Promise.resolve({ data: opts.prevValueRow ?? null, error: null })
              : Promise.resolve({ data: opts.signalRow ?? null, error: null }),
        };
        return builder;
      }
      if (table === 'clients') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: () => Promise.resolve({ data: opts.clientRow ?? null, error: null }),
        };
      }
      if (table === 'action_items') {
        return {
          insert(row: Record<string, unknown>) {
            opts.onInsert?.(row);
            return this;
          },
          select() { return this; },
          single: () =>
            Promise.resolve({
              data: opts.insertRow ?? null,
              error: opts.insertError ?? null,
            }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

describe('maybeCreateSignalTriggeredActionItem', () => {
  it('skips when the persisted signal row is missing', async () => {
    const sb = fakeSupabase({ signalRow: null });
    const out = await maybeCreateSignalTriggeredActionItem({
      supabase: sb,
      agencyId: AGENCY,
      clientId: CLIENT,
      signalType: 'pause_resume',
      period: '2026-W17',
      value: 1,
    });
    expect(out.outcome).toBe('skipped');
  });

  it('skips when the client lookup fails', async () => {
    const sb = fakeSupabase({
      signalRow: { id: SIGNAL },
      clientRow: null,
    });
    const out = await maybeCreateSignalTriggeredActionItem({
      supabase: sb,
      agencyId: AGENCY,
      clientId: CLIENT,
      signalType: 'pause_resume',
      period: '2026-W17',
      value: 1,
    });
    expect(out.outcome).toBe('skipped');
    if (out.outcome === 'skipped') expect(out.reason).toBe('client_not_found');
  });

  it('creates an action item on pause_resume=1', async () => {
    const onInsert = vi.fn();
    const sb = fakeSupabase({
      signalRow: { id: SIGNAL },
      clientRow: { id: CLIENT, name: 'Cypress Logistics', company_name: null },
      insertRow: { id: 'item-1' },
      onInsert,
    });
    const out = await maybeCreateSignalTriggeredActionItem({
      supabase: sb,
      agencyId: AGENCY,
      clientId: CLIENT,
      signalType: 'pause_resume',
      period: '2026-W17',
      value: 1,
    });
    expect(out.outcome).toBe('created');
    if (out.outcome === 'created') {
      expect(out.reason).toBe('paused');
      expect(out.actionItemId).toBe('item-1');
    }
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: CLIENT,
        source_signal_id: SIGNAL,
        status: 'open',
      })
    );
  });

  it('creates on a content_velocity 60% drop using prev-period value', async () => {
    const onInsert = vi.fn();
    const sb = fakeSupabase({
      signalRow: { id: SIGNAL },
      clientRow: { id: CLIENT, name: 'Linden', company_name: null },
      prevValueRow: { value: 5 },
      insertRow: { id: 'item-2' },
      onInsert,
    });
    const out = await maybeCreateSignalTriggeredActionItem({
      supabase: sb,
      agencyId: AGENCY,
      clientId: CLIENT,
      signalType: 'content_velocity',
      period: '2026-W17',
      value: 1, // 80% drop from 5
    });
    expect(out.outcome).toBe('created');
    if (out.outcome === 'created') expect(out.reason).toBe('velocity_drop');
  });

  it('skips on a content_velocity small drop (no prev row needed for skip)', async () => {
    const sb = fakeSupabase({
      signalRow: { id: SIGNAL },
      clientRow: { id: CLIENT, name: 'Helios', company_name: null },
      prevValueRow: { value: 4 },
    });
    const out = await maybeCreateSignalTriggeredActionItem({
      supabase: sb,
      agencyId: AGENCY,
      clientId: CLIENT,
      signalType: 'content_velocity',
      period: '2026-W17',
      value: 3, // 25% drop
    });
    expect(out.outcome).toBe('skipped');
  });

  it('returns already_exists on unique-violation 23505', async () => {
    const sb = fakeSupabase({
      signalRow: { id: SIGNAL },
      clientRow: { id: CLIENT, name: 'Cypress', company_name: null },
      insertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    const out = await maybeCreateSignalTriggeredActionItem({
      supabase: sb,
      agencyId: AGENCY,
      clientId: CLIENT,
      signalType: 'pause_resume',
      period: '2026-W17',
      value: 1,
    });
    expect(out.outcome).toBe('already_exists');
  });
});
