export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/cron/retention
 *
 * §13.5 LRA: Data-retention enforcement cron.
 * Runs daily at 03:00 UTC (see vercel.json) and hard-deletes rows
 * that have aged past their retention window, enforcing the privacy
 * policy commitments documented in the ClientPulse LRA §13.
 *
 * Retention windows:
 *  - stripe_webhook_events …… 90 days   (financial audit trail minimum)
 *  - zoom_meetings …………………… 12 months  (meeting intelligence history)
 *  - calendar_events ………………… 12 months  (past events only)
 *  - email_threads ………………………12 months  (communication history)
 *  - alerts (dismissed) ……………  6 months  (operational noise cleanup)
 *  - approvals (non-pending) …… 6 months  (HITL queue hygiene)
 *  - upsell_opportunities ………… 12 months  (sales signal history)
 *  - learning_snapshots ……………  24 months  (ML model history)
 *
 * Authentication: `Authorization: Bearer ${RETENTION_CRON_SECRET}`
 * RLS is bypassed via the service-role client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

interface RetentionResult {
  table: string;
  deleted: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const secret = process.env.RETENTION_CRON_SECRET;
  if (!secret) {
    console.error('[cron/retention] RETENTION_CRON_SECRET not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const provided = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Cutoff dates ────────────────────────────────────────────────────────────
  const now = new Date();
  const cutoff90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff6m = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff12m = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff24m = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServiceClient();
  const results: RetentionResult[] = [];
  let totalDeleted = 0;

  // ── Helper ───────────────────────────────────────────────────────────────────
  async function purge(
    table: string,
    filters: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
  ) {
    try {
      const query = supabase.from(table).delete();
      const { error, count } = await (filters(query as unknown as ReturnType<typeof supabase.from>) as unknown as Promise<{ error: unknown; count: number | null }>);
      if (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[cron/retention] ${table} delete failed:`, msg);
        results.push({ table, deleted: 0, error: msg });
      } else {
        const deleted = count ?? 0;
        totalDeleted += deleted;
        results.push({ table, deleted });
        if (deleted > 0) {
          console.log(`[cron/retention] ${table}: deleted ${deleted} rows`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/retention] ${table} unexpected error:`, msg);
      results.push({ table, deleted: 0, error: msg });
    }
  }

  // ── Retention rules ──────────────────────────────────────────────────────────

  // 1. stripe_webhook_events — 90-day financial audit window
  await purge('stripe_webhook_events', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).lt('created_at', cutoff90d)
  );

  // 2. zoom_meetings — 12-month meeting history
  await purge('zoom_meetings', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).lt('created_at', cutoff12m)
  );

  // 3. calendar_events — past events older than 12 months
  //    Use start_time (the event date) rather than created_at so we don't
  //    accidentally delete future recurring event records.
  await purge('calendar_events', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).lt('start_time', cutoff12m)
  );

  // 4. email_threads — 12-month communication history
  await purge('email_threads', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).lt('last_message_date', cutoff12m)
  );

  // 5. alerts — dismissed alerts older than 6 months
  await purge('alerts', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).eq('dismissed', true).lt('created_at', cutoff6m)
  );

  // 6. approvals — resolved (approved / dismissed) approvals older than 6 months
  await purge('approvals', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).in('status', ['approved', 'dismissed']).lt('created_at', cutoff6m)
  );

  // 7. upsell_opportunities — 12-month sales signal history
  await purge('upsell_opportunities', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).lt('detected_at', cutoff12m)
  );

  // 8. learning_snapshots — 24-month ML model history
  await purge('learning_snapshots', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).lt('snapshot_date', cutoff24m)
  );

  // ── Response ─────────────────────────────────────────────────────────────────
  const failedTables = results.filter((r) => r.error);

  return NextResponse.json(
    {
      ok: failedTables.length === 0,
      ranAt: now.toISOString(),
      totalDeleted,
      results,
      ...(failedTables.length > 0 && {
        errors: failedTables.map((r) => ({ table: r.table, error: r.error })),
      }),
    },
    { status: failedTables.length === 0 ? 200 : 207 }
  );
}
