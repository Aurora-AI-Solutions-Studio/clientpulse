export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import {
  fetchConnectedAccountInvoices,
  fetchConnectedAccountCustomer,
  mapInvoiceToData,
  matchCustomersToClients,
  type StripeCustomerMatchInput,
  type ClientMatchInput,
} from '@/lib/agents/stripe-intelligence-agent';

/**
 * POST /api/integrations/stripe/sync
 *
 * Fetches invoices from the agency's connected Stripe account, matches
 * Stripe customers to CP clients (email-first, company-name fallback),
 * and upserts into stripe_invoices. The synced rows feed the
 * FinancialSignalAgent during the next health-score refresh, which
 * surfaces in the Monday Brief — closing the marketing-vs-code gap on
 * CP's #1 selling point.
 *
 * Auth + writes via service-client (RLS-context-drift safe).
 */
export async function POST(_request: NextRequest) {
  const startedAt = Date.now();

  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient } = auth.ctx;

    // Need the connected account ID off the agency row.
    const { data: agency } = await serviceClient
      .from('agencies')
      .select('stripe_connected_account_id')
      .eq('id', agencyId)
      .maybeSingle();

    const connectedAccountId = agency?.stripe_connected_account_id as
      | string
      | null;
    if (!connectedAccountId) {
      return NextResponse.json(
        {
          error: 'Stripe not connected',
          message: 'Connect your Stripe account first via Settings → Stripe → Connect.',
        },
        { status: 400 }
      );
    }

    // 1. Fetch invoices from the connected account.
    let rawInvoices;
    try {
      rawInvoices = await fetchConnectedAccountInvoices(connectedAccountId, {
        sinceDaysAgo: 365,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      // Persist the error on the agency row so the UI can surface it.
      await serviceClient
        .from('agencies')
        .update({
          stripe_synced_at: new Date().toISOString(),
          stripe_sync_error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agencyId);
      return NextResponse.json(
        {
          error: 'stripe_fetch_failed',
          message: `Stripe API error: ${errorMsg}`,
        },
        { status: 502 }
      );
    }

    // 2. Build the unique-customer set we need to look up names/emails for.
    const customerIds = new Set<string>();
    for (const inv of rawInvoices) {
      if (typeof inv.customer === 'string' && inv.customer) {
        customerIds.add(inv.customer);
      }
    }

    // 3. Pull current CP clients for matching.
    const { data: clientsRaw } = await serviceClient
      .from('clients')
      .select('id, contact_email, company')
      .eq('agency_id', agencyId);
    const clients = (clientsRaw ?? []) as ClientMatchInput[];

    // 4. Hydrate Stripe customer details for matching. Cap the lookup
    //    to avoid runaway API calls on accounts with thousands of
    //    customers; the unmatched ones won't surface in CP anyway.
    const customerMatchInputs: StripeCustomerMatchInput[] = [];
    const customerIdList = Array.from(customerIds).slice(0, 200);
    for (const customerId of customerIdList) {
      try {
        const c = await fetchConnectedAccountCustomer(
          connectedAccountId,
          customerId
        );
        if ('deleted' in c && c.deleted) continue;
        // After the type-narrowed deleted check, c is Stripe.Customer.
        const cust = c as { id: string; email?: string | null; name?: string | null };
        customerMatchInputs.push({
          id: cust.id,
          email: cust.email ?? null,
          name: cust.name ?? null,
        });
      } catch (err) {
        // Single-customer fetch failures don't kill the sync — skip.
        console.warn(`Stripe customer ${customerId} fetch failed:`, err);
      }
    }

    const customerToClient = matchCustomersToClients(customerMatchInputs, clients);
    const customerEmailById = new Map<string, string | null>();
    for (const c of customerMatchInputs) customerEmailById.set(c.id, c.email);

    // 5. Upsert invoices.
    let upsertedCount = 0;
    let matchedToClient = 0;
    for (const raw of rawInvoices) {
      const data = mapInvoiceToData(raw);
      const customerIdStr =
        typeof raw.customer === 'string' ? raw.customer : '';
      if (!customerIdStr) continue;

      const clientId = customerToClient.get(customerIdStr) ?? null;
      if (clientId) matchedToClient += 1;

      const dueDate = data.dueDate
        ? new Date(data.dueDate * 1000).toISOString()
        : null;
      const paidDate = data.paidDate
        ? new Date(data.paidDate * 1000).toISOString()
        : null;
      const invoiceCreatedAt = new Date(data.createdAt * 1000).toISOString();

      const { error: upsertErr } = await serviceClient
        .from('stripe_invoices')
        .upsert(
          {
            agency_id: agencyId,
            client_id: clientId,
            stripe_invoice_id: data.id,
            stripe_customer_id: customerIdStr,
            customer_email: customerEmailById.get(customerIdStr) ?? null,
            amount: data.amount,
            currency: data.currency,
            status: data.status,
            due_date: dueDate,
            paid_date: paidDate,
            invoice_created_at: invoiceCreatedAt,
            attempted_payments: data.attemptedPayments ?? 0,
            payment_intent_status: data.paymentIntentStatus ?? null,
            invoice_number: data.invoiceNumber ?? null,
            description: data.description ?? null,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'agency_id,stripe_invoice_id' }
        );
      if (!upsertErr) upsertedCount += 1;
    }

    // 6. Stamp the agency row with sync success.
    await serviceClient
      .from('agencies')
      .update({
        stripe_synced_at: new Date().toISOString(),
        stripe_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agencyId);

    return NextResponse.json({
      success: true,
      invoicesFound: rawInvoices.length,
      invoicesUpserted: upsertedCount,
      customersChecked: customerMatchInputs.length,
      customersMatchedToClient: customerToClient.size,
      invoicesMatchedToClient: matchedToClient,
      durationMs: Date.now() - startedAt,
      message:
        clients.length === 0
          ? 'Sync ran — no clients to match against. Add a client first to surface per-client financial signals.'
          : `${matchedToClient} invoice(s) matched to ${customerToClient.size} CP client(s). Health scores will refresh on the next cycle.`,
    });
  } catch (err) {
    console.error('Stripe sync error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
