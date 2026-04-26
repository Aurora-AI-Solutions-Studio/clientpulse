import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FIRST_BRIEF_CLIENT_THRESHOLD,
  maybeClaimFirstBriefSend,
} from '../../src/lib/brief/first-brief-trigger';

interface FakeOptions {
  clientCount: number;
  /** Whether the atomic UPDATE returned a row (i.e. we won the race). */
  claimedRow:
    | { id: string; name: string | null; owner_id: string }
    | null;
  ownerEmail?: string | null;
}

function fakeSupabase(opts: FakeOptions): SupabaseClient {
  return {
    from(table: string) {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: opts.clientCount,
              error: null,
            }),
          }),
        } as unknown as ReturnType<SupabaseClient['from']>;
      }
      if (table === 'agencies') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: opts.claimedRow, error: null }),
                }),
              }),
            }),
          }),
        } as unknown as ReturnType<SupabaseClient['from']>;
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data:
                  opts.ownerEmail !== undefined
                    ? { email: opts.ownerEmail }
                    : null,
                error: null,
              }),
            }),
          }),
        } as unknown as ReturnType<SupabaseClient['from']>;
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe('maybeClaimFirstBriefSend', () => {
  it('does not fire below the threshold', async () => {
    const supabase = fakeSupabase({
      clientCount: FIRST_BRIEF_CLIENT_THRESHOLD - 1,
      claimedRow: null,
    });
    const decision = await maybeClaimFirstBriefSend(supabase, 'a-1');
    expect(decision.shouldFire).toBe(false);
  });

  it('does not fire when the atomic UPDATE returns no row (already fired)', async () => {
    const supabase = fakeSupabase({
      clientCount: FIRST_BRIEF_CLIENT_THRESHOLD,
      claimedRow: null,
    });
    const decision = await maybeClaimFirstBriefSend(supabase, 'a-1');
    expect(decision.shouldFire).toBe(false);
  });

  it('fires once when threshold met + claim wins + owner email present', async () => {
    const supabase = fakeSupabase({
      clientCount: FIRST_BRIEF_CLIENT_THRESHOLD,
      claimedRow: { id: 'a-1', name: 'Acme', owner_id: 'u-1' },
      ownerEmail: 'owner@acme.test',
    });
    const decision = await maybeClaimFirstBriefSend(supabase, 'a-1');
    expect(decision.shouldFire).toBe(true);
    expect(decision.ownerEmail).toBe('owner@acme.test');
    expect(decision.agencyName).toBe('Acme');
  });

  it('reports shouldFire=true even when owner email is missing (caller decides)', async () => {
    const supabase = fakeSupabase({
      clientCount: FIRST_BRIEF_CLIENT_THRESHOLD,
      claimedRow: { id: 'a-1', name: 'Acme', owner_id: 'u-1' },
      ownerEmail: null,
    });
    const decision = await maybeClaimFirstBriefSend(supabase, 'a-1');
    expect(decision.shouldFire).toBe(true);
    expect(decision.ownerEmail).toBeNull();
  });

  it('fires past the threshold (e.g. 5 clients) when not yet claimed', async () => {
    const supabase = fakeSupabase({
      clientCount: 5,
      claimedRow: { id: 'a-1', name: 'Acme', owner_id: 'u-1' },
      ownerEmail: 'owner@acme.test',
    });
    const decision = await maybeClaimFirstBriefSend(supabase, 'a-1');
    expect(decision.shouldFire).toBe(true);
  });
});
