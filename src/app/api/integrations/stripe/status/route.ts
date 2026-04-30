export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

/**
 * GET /api/integrations/stripe/status
 *
 * Returns the agency's Stripe Connect connection state for the
 * settings UI:
 *   - connected: bool
 *   - accountId: ca_xxx (or null)
 *   - syncedAt: ISO timestamp of last sync (or null)
 *   - syncError: last sync error message (or null)
 *   - invoiceCount: cached invoices for this agency
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient } = auth.ctx;

    const { data: agency } = await serviceClient
      .from('agencies')
      .select('stripe_connected_account_id, stripe_synced_at, stripe_sync_error')
      .eq('id', agencyId)
      .maybeSingle();

    const { count: invoiceCount } = await serviceClient
      .from('stripe_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId);

    return NextResponse.json({
      connected: !!agency?.stripe_connected_account_id,
      accountId: agency?.stripe_connected_account_id ?? null,
      syncedAt: agency?.stripe_synced_at ?? null,
      syncError: agency?.stripe_sync_error ?? null,
      invoiceCount: invoiceCount ?? 0,
    });
  } catch (error) {
    console.error('Stripe status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
