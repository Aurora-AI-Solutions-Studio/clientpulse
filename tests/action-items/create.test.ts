import { describe, expect, it, vi } from 'vitest';
import {
  ActionItemOwnershipError,
  ActionItemValidationError,
  createActionItem,
} from '@/lib/action-items/create';

// Minimal fake SupabaseClient — enough surface for createActionItem:
//   clients.select('id').eq(...).eq(...).maybeSingle()
//   action_items.insert(payload).select(cols).single()
type FakeRow = Record<string, unknown> | null;

function fakeSupabase(opts: {
  clientRow?: FakeRow;
  clientError?: { message: string };
  insertRow?: FakeRow;
  insertError?: { message: string };
  onInsert?: (row: Record<string, unknown>) => void;
}) {
  return {
    from(table: string) {
      if (table === 'clients') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: () =>
            Promise.resolve({
              data: opts.clientRow ?? null,
              error: opts.clientError ?? null,
            }),
        };
      }
      if (table === 'action_items') {
        return {
          insert(row: Record<string, unknown>) {
            opts.onInsert?.(row);
            return this;
          },
          select() {
            return this;
          },
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

const AGENCY = '00000000-0000-0000-0000-000000000aaa';
const CLIENT = '00000000-0000-0000-0000-000000000bbb';
const MEETING = '00000000-0000-0000-0000-000000000ccc';
const USER = '00000000-0000-0000-0000-000000000ddd';

describe('createActionItem — validation', () => {
  it('rejects empty clientId', async () => {
    const sb = fakeSupabase({});
    await expect(
      createActionItem({
        supabase: sb,
        agencyId: AGENCY,
        input: { clientId: '', title: 'x' },
      })
    ).rejects.toBeInstanceOf(ActionItemValidationError);
  });

  it('rejects empty title', async () => {
    const sb = fakeSupabase({});
    await expect(
      createActionItem({
        supabase: sb,
        agencyId: AGENCY,
        input: { clientId: CLIENT, title: '   ' },
      })
    ).rejects.toBeInstanceOf(ActionItemValidationError);
  });

  it('rejects malformed due_date', async () => {
    const sb = fakeSupabase({});
    await expect(
      createActionItem({
        supabase: sb,
        agencyId: AGENCY,
        input: { clientId: CLIENT, title: 'x', dueDate: '2026/05/01' },
      })
    ).rejects.toBeInstanceOf(ActionItemValidationError);
  });

  it('rejects malformed meeting_id', async () => {
    const sb = fakeSupabase({});
    await expect(
      createActionItem({
        supabase: sb,
        agencyId: AGENCY,
        input: { clientId: CLIENT, title: 'x', meetingId: 'not-a-uuid' },
      })
    ).rejects.toBeInstanceOf(ActionItemValidationError);
  });
});

describe('createActionItem — ownership', () => {
  it('throws ActionItemOwnershipError when client not found for agency', async () => {
    const sb = fakeSupabase({ clientRow: null });
    await expect(
      createActionItem({
        supabase: sb,
        agencyId: AGENCY,
        input: { clientId: CLIENT, title: 'x' },
      })
    ).rejects.toBeInstanceOf(ActionItemOwnershipError);
  });

  it('surfaces supabase error from clients lookup', async () => {
    const sb = fakeSupabase({ clientError: { message: 'db down' } });
    await expect(
      createActionItem({
        supabase: sb,
        agencyId: AGENCY,
        input: { clientId: CLIENT, title: 'x' },
      })
    ).rejects.toThrow('db down');
  });
});

describe('createActionItem — insert', () => {
  it('inserts with status=open, trimmed title/description, nulls for missing optionals', async () => {
    const onInsert = vi.fn();
    const sb = fakeSupabase({
      clientRow: { id: CLIENT },
      insertRow: {
        id: 'abc',
        client_id: CLIENT,
        meeting_id: null,
        title: 'hi',
        description: null,
        status: 'open',
        due_date: null,
        assigned_to: null,
        created_at: '2026-04-22T00:00:00Z',
      },
      onInsert,
    });

    const row = await createActionItem({
      supabase: sb,
      agencyId: AGENCY,
      input: { clientId: CLIENT, title: '  hi  ' },
    });

    expect(onInsert).toHaveBeenCalledWith({
      client_id: CLIENT,
      title: 'hi',
      description: null,
      due_date: null,
      meeting_id: null,
      assigned_to: null,
      status: 'open',
      source_email_token_hash: null,
    });
    expect(row.status).toBe('open');
    expect(row.id).toBe('abc');
  });

  it('passes through valid due_date, meeting_id, assigned_to, description', async () => {
    const onInsert = vi.fn();
    const sb = fakeSupabase({
      clientRow: { id: CLIENT },
      insertRow: {
        id: 'xyz',
        client_id: CLIENT,
        meeting_id: MEETING,
        title: 'Follow-up',
        description: 'Call Acme.',
        status: 'open',
        due_date: '2026-05-01',
        assigned_to: USER,
        created_at: '2026-04-22T00:00:00Z',
      },
      onInsert,
    });

    await createActionItem({
      supabase: sb,
      agencyId: AGENCY,
      input: {
        clientId: CLIENT,
        title: 'Follow-up',
        description: '  Call Acme.  ',
        dueDate: '2026-05-01',
        meetingId: MEETING,
        assignedTo: USER,
      },
    });

    expect(onInsert).toHaveBeenCalledWith({
      client_id: CLIENT,
      title: 'Follow-up',
      description: 'Call Acme.',
      due_date: '2026-05-01',
      meeting_id: MEETING,
      assigned_to: USER,
      status: 'open',
      source_email_token_hash: null,
    });
  });

  it('surfaces insert error from supabase', async () => {
    const sb = fakeSupabase({
      clientRow: { id: CLIENT },
      insertError: { message: 'constraint violated' },
    });
    await expect(
      createActionItem({
        supabase: sb,
        agencyId: AGENCY,
        input: { clientId: CLIENT, title: 'x' },
      })
    ).rejects.toThrow('constraint violated');
  });
});
