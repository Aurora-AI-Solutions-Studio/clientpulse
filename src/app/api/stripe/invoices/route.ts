export const dynamic = 'force-dynamic';
/**
 * Stripe Invoices Data Ingestion API
 * GET /api/stripe/invoices
 *
 * Fetches invoices from a connected Stripe account and maps them to client records
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { StripeInvoiceData } from '@/types/stripe';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const connectedAccountId = searchParams.get('connectedAccountId');

    if (limit < 1 || limit > 500) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 500' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, subscriptionPlan, serviceClient: supabase } = auth.ctx;

    let accountId = connectedAccountId;

    // If no account ID provided, fetch from user profile
    if (!accountId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('stripe_connect_account_id')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        return NextResponse.json(
          { error: 'User profile not found' },
          { status: 404 }
        );
      }

      // Only Agency plan users can fetch invoices
      if (subscriptionPlan !== 'agency') {
        return NextResponse.json(
          { error: 'Invoice access is only available on the Agency plan' },
          { status: 403 }
        );
      }

      if (!profile.stripe_connect_account_id) {
        return NextResponse.json(
          { error: 'No connected Stripe account found' },
          { status: 400 }
        );
      }

      accountId = profile.stripe_connect_account_id;
    }

    // Fetch invoices from connected account
    const invoices = await stripe.invoices.list(
      {
        limit,
      },
      {
        stripeAccount: accountId ?? undefined,
      }
    );

    // Transform Stripe invoices to our format
    const transformedInvoices: StripeInvoiceData[] = invoices.data.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (invoice: any) => {
        return {
          id: invoice.id,
          invoiceNumber: invoice.number || undefined,
          customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || '',
          amount: invoice.amount_due,
          currency: invoice.currency,
          status: invoice.status as 'draft' | 'open' | 'paid' | 'uncollectible' | 'void',
          dueDate: invoice.due_date ? invoice.due_date * 1000 : undefined,
          paidDate: invoice.status_transitions?.paid_at ? invoice.status_transitions.paid_at * 1000 : undefined,
          createdAt: invoice.created * 1000,
          description: invoice.description || undefined,
          metadata: invoice.metadata || undefined,
          paymentIntentStatus: typeof invoice.payment_intent === 'string' ?
            undefined :
            invoice.payment_intent?.status,
          attemptedPayments: invoice.attempt_count,
        };
      }
    );

    // Optionally map to client records
    const clientMap: Record<string, { clientId: string; invoiceCount: number; totalAmount: number }> = {};

    for (const invoice of transformedInvoices) {
      if (!clientMap[invoice.customerId]) {
        clientMap[invoice.customerId] = {
          clientId: invoice.customerId,
          invoiceCount: 0,
          totalAmount: 0,
        };
      }
      clientMap[invoice.customerId].invoiceCount++;
      clientMap[invoice.customerId].totalAmount += invoice.amount;
    }

    return NextResponse.json({
      invoices: transformedInvoices,
      clientSummary: Object.values(clientMap).map((summary) => ({
        ...summary,
        avgInvoiceAmount: summary.totalAmount / summary.invoiceCount,
      })),
      total: invoices.data.length,
      hasMore: invoices.has_more,
    });
  } catch (error) {
    console.error('Failed to fetch invoices:', error);

    // Handle specific Stripe errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid account')) {
        return NextResponse.json(
          { error: 'Invalid or revoked connected account' },
          { status: 400 }
        );
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json(
          { error: 'Authentication failed for connected account' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}
