export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/integrations/stripe/disconnect
 *
 * Disconnects the agency's Stripe Connect connection. Clears
 * `agencies.stripe_connected_account_id` (so the UI flips back to
 * the Connect button) and best-effort deauthorizes the Connect
 * OAuth grant on Stripe's side via stripe.oauth.deauthorize().
 *
 * Cached invoices are left in place — disconnecting doesn't mean
 * the historical financial signal should disappear from the health
 * score. If the user wants to wipe the data they can re-sync after
 * reconnecting OR we add a separate "purge cached invoices" action
 * later.
 */
export async function POST(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient } = auth.ctx;

    const { data: agency } = await serviceClient
      .from('agencies')
      .select('stripe_connected_account_id')
      .eq('id', agencyId)
      .maybeSingle();

    const accountId = agency?.stripe_connected_account_id as string | null;
    if (!accountId) {
      return NextResponse.json({
        success: true,
        message: 'No Stripe connection to disconnect.',
      });
    }

    // Best-effort deauthorize the OAuth grant on Stripe's side. If
    // Stripe rejects it (already revoked, account deleted, missing
    // platform client_id, etc.) we still clear the local row so the
    // user can reconnect.
    let stripeDeauthError: string | null = null;
    const clientId = process.env.STRIPE_CLIENT_ID;
    if (clientId) {
      try {
        await stripe.oauth.deauthorize({
          client_id: clientId,
          stripe_user_id: accountId,
        });
      } catch (err) {
        stripeDeauthError =
          err instanceof Error ? err.message : 'unknown deauthorize error';
        console.warn(
          `Stripe deauthorize warning for ${accountId}: ${stripeDeauthError}`
        );
      }
    }

    const { error: updateErr } = await serviceClient
      .from('agencies')
      .update({
        stripe_connected_account_id: null,
        stripe_synced_at: null,
        stripe_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agencyId);

    if (updateErr) {
      console.error('Failed to clear Stripe connection:', updateErr);
      return NextResponse.json(
        { error: 'Failed to disconnect Stripe' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: stripeDeauthError
        ? `Disconnected locally; Stripe-side deauthorize warning: ${stripeDeauthError}`
        : 'Stripe disconnected successfully.',
    });
  } catch (err) {
    console.error('Stripe disconnect error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
