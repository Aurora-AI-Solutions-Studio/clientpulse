/**
 * Stripe Intelligence Agent — Sprint 7.8 #21 (May 1 2026).
 *
 * Closes the Financial Health signal pipeline. The OAuth handshake on
 * /api/stripe/connect was the only piece in place pre-this-file —
 * lib/health/refresh.ts fed an empty invoice array to
 * FinancialSignalAgent so the financial dimension was always neutral
 * regardless of what was happening in the agency's actual Stripe
 * account. This agent provides:
 *
 *   - Connected-account API helpers (fetch invoices, customers,
 *     subscriptions via Stripe-Account header)
 *   - Customer→Client matcher (email-first with company-name fallback)
 *   - Mapping helpers from Stripe API shape to StripeInvoiceData (the
 *     shape the existing FinancialSignalAgent already consumes)
 *
 * Pattern mirrors zoom-intelligence-agent + calendar-intelligence-agent.
 */

import Stripe from 'stripe';
import type { StripeInvoiceData } from '@/types/stripe';

// ─── Stripe client factory ─────────────────────────────────────────

function buildStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
}

// ─── Connected-account fetchers ────────────────────────────────────
// Every fetcher takes the agency's connected_account_id (a `ca_…`
// value stored on agencies.stripe_connected_account_id) and uses
// Stripe-Account: <id> via the SDK's `stripeAccount` option to read
// the agency's data on their behalf.

export interface FetchInvoicesOpts {
  /** Stripe API only — limits how far back to fetch. Default 365 days. */
  sinceDaysAgo?: number;
  /** Optional cursor for pagination. */
  startingAfter?: string;
  /** Per-page (max 100). */
  pageSize?: number;
}

export async function fetchConnectedAccountInvoices(
  connectedAccountId: string,
  opts: FetchInvoicesOpts = {}
): Promise<Stripe.Invoice[]> {
  const stripe = buildStripeClient();
  const sinceDaysAgo = opts.sinceDaysAgo ?? 365;
  const sinceTimestamp = Math.floor(
    (Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000) / 1000
  );
  const out: Stripe.Invoice[] = [];

  // Auto-paginate. Stripe caps pageSize at 100; for an agency with
  // hundreds of invoices we walk all pages.
  let starting_after: string | undefined = opts.startingAfter;
  // Hard cap to prevent runaway pagination on huge accounts.
  for (let i = 0; i < 50; i += 1) {
    const page = await stripe.invoices.list(
      {
        limit: opts.pageSize ?? 100,
        created: { gte: sinceTimestamp },
        ...(starting_after ? { starting_after } : {}),
        expand: ['data.payment_intent'],
      },
      { stripeAccount: connectedAccountId }
    );
    out.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return out;
}

export async function fetchConnectedAccountCustomer(
  connectedAccountId: string,
  customerId: string
): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
  const stripe = buildStripeClient();
  // The Stripe SDK splits per-call options into a separate trailing
  // RequestOptions argument. `stripeAccount` lives there, not in the
  // params object.
  return stripe.customers.retrieve(
    customerId,
    undefined,
    { stripeAccount: connectedAccountId }
  );
}

// ─── Stripe.Invoice → StripeInvoiceData mapping ────────────────────
// FinancialSignalAgent already consumes the StripeInvoiceData shape;
// this mapper converts Stripe's raw API objects into it. Anything the
// agent doesn't read is dropped to keep the row lean.

export function mapInvoiceToData(invoice: Stripe.Invoice): StripeInvoiceData {
  // Stripe stores timestamps in seconds; the agent's StripeInvoiceData
  // also uses seconds, so no conversion needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pi = (invoice as any).payment_intent;
  const paymentIntentStatus =
    pi && typeof pi === 'object' && 'status' in pi
      ? (pi.status as string)
      : undefined;

  // status_transitions.paid_at is the canonical "paid date" on
  // newer invoice objects. Some older accounts only carry the legacy
  // `status_transitions.paid_at = null` + `paid = true`, so fall back
  // to invoice.webhooks_delivered_at or null.
  const paidAt =
    invoice.status_transitions?.paid_at ??
    null;

  return {
    id: invoice.id ?? '',
    invoiceNumber: invoice.number ?? undefined,
    customerId: typeof invoice.customer === 'string' ? invoice.customer : '',
    amount: invoice.amount_due ?? 0,
    currency: invoice.currency,
    status: (invoice.status ?? 'open') as StripeInvoiceData['status'],
    dueDate: invoice.due_date ?? undefined,
    paidDate: paidAt ?? undefined,
    createdAt: invoice.created,
    description: invoice.description ?? undefined,
    paymentIntentStatus,
    attemptedPayments: invoice.attempt_count ?? 0,
  };
}

// ─── Customer→Client matcher ───────────────────────────────────────
// Matches Stripe customers (by email, with company-name fallback) to
// CP clients. Returns a Map<stripeCustomerId, clientId>.
//
// Email match takes precedence; company match is the fallback for
// customers whose Stripe email differs from the CP-recorded contact
// email (common when agencies use a billing-only email on Stripe).
//
// Customers that don't match any client get omitted from the map —
// downstream callers treat that as "not a CP client" and persist the
// row with client_id=null.

export interface ClientMatchInput {
  id: string;
  contact_email: string | null;
  company: string | null;
}

export interface StripeCustomerMatchInput {
  id: string;
  email: string | null;
  name: string | null;
}

export function matchCustomersToClients(
  customers: StripeCustomerMatchInput[],
  clients: ClientMatchInput[]
): Map<string, string> {
  const out = new Map<string, string>();

  // Build lookup tables. Lowercase + trim for fuzzy match.
  const clientsByEmail = new Map<string, string>();
  const clientsByCompany = new Map<string, string>();
  for (const c of clients) {
    if (c.contact_email) {
      const normalized = c.contact_email.toLowerCase().trim();
      if (normalized && !clientsByEmail.has(normalized)) {
        clientsByEmail.set(normalized, c.id);
      }
    }
    if (c.company) {
      const normalized = c.company.toLowerCase().trim();
      if (normalized && !clientsByCompany.has(normalized)) {
        clientsByCompany.set(normalized, c.id);
      }
    }
  }

  for (const cust of customers) {
    let matchedClientId: string | undefined;

    if (cust.email) {
      matchedClientId = clientsByEmail.get(cust.email.toLowerCase().trim());
    }
    if (!matchedClientId && cust.name) {
      matchedClientId = clientsByCompany.get(cust.name.toLowerCase().trim());
    }
    if (matchedClientId) {
      out.set(cust.id, matchedClientId);
    }
  }

  return out;
}

// ─── Aggregator: per-client revenue snapshot ───────────────────────
// Used by FinancialSignalAgent.detectRevenueConcentrationRisk for the
// portfolio-level concentration score. Keep it in this module so the
// sync route can compute + persist it in one pass.

import type { ClientRevenue } from '@/types/stripe';

export function aggregateClientRevenues(
  invoices: StripeInvoiceData[],
  customerToClient: Map<string, string>
): ClientRevenue[] {
  const totals = new Map<string, { totalRevenue: number; invoiceCount: number }>();
  for (const inv of invoices) {
    if (inv.status !== 'paid') continue;
    const clientId = customerToClient.get(inv.customerId);
    if (!clientId) continue;
    const cur = totals.get(clientId) ?? { totalRevenue: 0, invoiceCount: 0 };
    cur.totalRevenue += inv.amount;
    cur.invoiceCount += 1;
    totals.set(clientId, cur);
  }
  return Array.from(totals.entries()).map(([clientId, t]) => ({
    clientId,
    totalRevenue: t.totalRevenue,
    invoiceCount: t.invoiceCount,
    avgInvoiceAmount: t.invoiceCount > 0 ? t.totalRevenue / t.invoiceCount : 0,
  }));
}
