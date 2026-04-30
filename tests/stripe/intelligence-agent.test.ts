import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import {
  mapInvoiceToData,
  matchCustomersToClients,
  aggregateClientRevenues,
} from '@/lib/agents/stripe-intelligence-agent';
import type { StripeInvoiceData } from '@/types/stripe';

describe('stripe-intelligence-agent', () => {
  describe('matchCustomersToClients', () => {
    it('matches by email (case-insensitive, trimmed)', () => {
      const customers = [
        { id: 'cus_1', email: 'Alice@Acme.com', name: null },
        { id: 'cus_2', email: '  bob@beta.io ', name: null },
      ];
      const clients = [
        { id: 'cli_a', contact_email: 'alice@acme.com', company: null },
        { id: 'cli_b', contact_email: 'bob@beta.io', company: null },
      ];
      const result = matchCustomersToClients(customers, clients);
      expect(result.get('cus_1')).toBe('cli_a');
      expect(result.get('cus_2')).toBe('cli_b');
    });

    it('falls back to company name when email does not match', () => {
      const customers = [
        { id: 'cus_1', email: 'billing@acme.com', name: 'Acme Corp' },
      ];
      const clients = [
        {
          id: 'cli_a',
          contact_email: 'support@acme.com',
          company: 'acme corp',
        },
      ];
      const result = matchCustomersToClients(customers, clients);
      expect(result.get('cus_1')).toBe('cli_a');
    });

    it('omits unmatched customers from the map', () => {
      const customers = [
        { id: 'cus_unmatched', email: 'random@nowhere.com', name: 'Random' },
      ];
      const clients = [
        { id: 'cli_a', contact_email: 'alice@acme.com', company: 'Acme' },
      ];
      const result = matchCustomersToClients(customers, clients);
      expect(result.has('cus_unmatched')).toBe(false);
      expect(result.size).toBe(0);
    });

    it('email match takes precedence over company match', () => {
      const customers = [
        { id: 'cus_1', email: 'alice@acme.com', name: 'Beta Co' },
      ];
      const clients = [
        { id: 'cli_a', contact_email: 'alice@acme.com', company: 'Acme' },
        { id: 'cli_b', contact_email: 'someone@beta.co', company: 'Beta Co' },
      ];
      const result = matchCustomersToClients(customers, clients);
      expect(result.get('cus_1')).toBe('cli_a');
    });

    it('handles null emails and names without crashing', () => {
      const customers = [
        { id: 'cus_1', email: null, name: null },
        { id: 'cus_2', email: 'a@b.c', name: null },
      ];
      const clients = [
        { id: 'cli_a', contact_email: null, company: null },
        { id: 'cli_b', contact_email: 'a@b.c', company: null },
      ];
      const result = matchCustomersToClients(customers, clients);
      expect(result.has('cus_1')).toBe(false);
      expect(result.get('cus_2')).toBe('cli_b');
    });
  });

  describe('mapInvoiceToData', () => {
    it('maps a paid invoice with all fields populated', () => {
      const invoice = {
        id: 'in_test_1',
        number: 'INV-001',
        customer: 'cus_test',
        amount_due: 5000,
        currency: 'usd',
        status: 'paid',
        due_date: 1735660800,
        status_transitions: { paid_at: 1735674000 },
        created: 1735574400,
        description: 'Monthly subscription',
        attempt_count: 1,
        payment_intent: { status: 'succeeded' },
      } as unknown as Stripe.Invoice;

      const data = mapInvoiceToData(invoice);
      expect(data.id).toBe('in_test_1');
      expect(data.invoiceNumber).toBe('INV-001');
      expect(data.customerId).toBe('cus_test');
      expect(data.amount).toBe(5000);
      expect(data.status).toBe('paid');
      expect(data.dueDate).toBe(1735660800);
      expect(data.paidDate).toBe(1735674000);
      expect(data.paymentIntentStatus).toBe('succeeded');
      expect(data.attemptedPayments).toBe(1);
    });

    it('handles a draft invoice with missing optional fields', () => {
      const invoice = {
        id: 'in_test_2',
        customer: 'cus_test',
        amount_due: 0,
        currency: 'usd',
        status: 'draft',
        created: 1735574400,
      } as unknown as Stripe.Invoice;

      const data = mapInvoiceToData(invoice);
      expect(data.id).toBe('in_test_2');
      expect(data.status).toBe('draft');
      expect(data.dueDate).toBeUndefined();
      expect(data.paidDate).toBeUndefined();
      expect(data.attemptedPayments).toBe(0);
    });

    it('handles invoices with non-string customer reference (expanded object)', () => {
      const invoice = {
        id: 'in_test_3',
        customer: { id: 'cus_test_obj' },
        amount_due: 1000,
        currency: 'usd',
        status: 'open',
        created: 1735574400,
      } as unknown as Stripe.Invoice;

      const data = mapInvoiceToData(invoice);
      // Mapper only extracts string customer references; expanded
      // objects fall through to empty string. Sync route handles this
      // by skipping invoices with empty customerId.
      expect(data.customerId).toBe('');
    });
  });

  describe('aggregateClientRevenues', () => {
    it('aggregates only paid invoices per matched client', () => {
      const invoices: StripeInvoiceData[] = [
        {
          id: 'in_1',
          customerId: 'cus_a',
          amount: 5000,
          currency: 'usd',
          status: 'paid',
          createdAt: 1,
        },
        {
          id: 'in_2',
          customerId: 'cus_a',
          amount: 5000,
          currency: 'usd',
          status: 'paid',
          createdAt: 2,
        },
        {
          id: 'in_3',
          customerId: 'cus_a',
          amount: 5000,
          currency: 'usd',
          status: 'open',
          createdAt: 3,
        },
        {
          id: 'in_4',
          customerId: 'cus_b',
          amount: 10000,
          currency: 'usd',
          status: 'paid',
          createdAt: 4,
        },
      ];
      const matches = new Map<string, string>([
        ['cus_a', 'cli_a'],
        ['cus_b', 'cli_b'],
      ]);
      const result = aggregateClientRevenues(invoices, matches);
      const cliA = result.find((r) => r.clientId === 'cli_a');
      const cliB = result.find((r) => r.clientId === 'cli_b');
      // cus_a paid 2 invoices of 5000 each — open one excluded.
      expect(cliA?.totalRevenue).toBe(10000);
      expect(cliA?.invoiceCount).toBe(2);
      expect(cliA?.avgInvoiceAmount).toBe(5000);
      // cus_b paid 1 invoice of 10000.
      expect(cliB?.totalRevenue).toBe(10000);
      expect(cliB?.invoiceCount).toBe(1);
    });

    it('drops invoices for unmatched customers', () => {
      const invoices: StripeInvoiceData[] = [
        {
          id: 'in_1',
          customerId: 'cus_unknown',
          amount: 999,
          currency: 'usd',
          status: 'paid',
          createdAt: 1,
        },
      ];
      const result = aggregateClientRevenues(invoices, new Map());
      expect(result.length).toBe(0);
    });
  });
});
