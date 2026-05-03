// POST /api/clients/bulk
//
// CSV mass-upload for clients. Accepts either:
//   - a JSON body { csv: string }, OR
//   - multipart/form-data with a "file" part (the dashboard sends this).
//
// Validates each row in src/lib/clients/bulk.ts, then inserts the valid
// rows one at a time so a single bad row never tanks the whole batch.
// Returns a per-row summary the UI shows in a result modal.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { getTierLimits, type TierProfile } from '@/lib/tiers';
import { CLIENT_CSV_TEMPLATE, parseClientCsv, type ClientCsvRow } from '@/lib/clients/bulk';

interface BulkInsertedRow {
  id: string;
  name: string;
  company_name: string;
}

export interface BulkUploadResponse {
  added: number;
  skipped: number;
  inserted: BulkInsertedRow[];
  errors: Array<{ rowNumber: number; reason: string }>;
}

async function readCsvText(request: NextRequest): Promise<string | NextResponse> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
    }
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing "file" field in upload' }, { status: 400 });
    }
    // 1 MB cap — far more than 1k rows of client data needs.
    if (file.size > 1_000_000) {
      return NextResponse.json({ error: 'CSV too large — 1 MB max.' }, { status: 413 });
    }
    return await file.text();
  }

  if (contentType.includes('application/json')) {
    let body: { csv?: string };
    try {
      body = (await request.json()) as { csv?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (typeof body.csv !== 'string') {
      return NextResponse.json({ error: 'Missing "csv" string in JSON body' }, { status: 400 });
    }
    if (body.csv.length > 1_000_000) {
      return NextResponse.json({ error: 'CSV too large — 1 MB max.' }, { status: 413 });
    }
    return body.csv;
  }

  return NextResponse.json(
    { error: 'Expected multipart/form-data with "file" or application/json with "csv".' },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, subscriptionPlan, serviceClient: supabase } = auth.ctx;

    const csvOrError = await readCsvText(request);
    if (csvOrError instanceof NextResponse) return csvOrError;
    const csvText = csvOrError;

    // Pull existing names so we can flag duplicates before insertion. RLS
    // is bypassed here (service client) but we manually scope by agency.
    const { data: existing, error: existingErr } = await supabase
      .from('clients')
      .select('name')
      .eq('agency_id', agencyId);
    if (existingErr) {
      console.error('[clients/bulk] existing-names lookup failed', existingErr);
      return NextResponse.json({ error: 'Failed to load existing clients' }, { status: 500 });
    }
    const existingNames = (existing ?? []).map((r) => (r as { name: string }).name);

    const parsed = parseClientCsv(csvText, { existingNames });

    // Tier cap — figure out remaining slots upfront, then mark anything
    // above that cap as invalid (still report, don't crash).
    const limits = getTierLimits({ subscription_plan: subscriptionPlan } as TierProfile);
    const remaining =
      limits.clients === Infinity
        ? Number.POSITIVE_INFINITY
        : Math.max(0, limits.clients - existingNames.length);

    const acceptedRows: ClientCsvRow[] = [];
    const overflowErrors: Array<{ rowNumber: number; reason: string }> = [];
    parsed.validRows.forEach((row, idx) => {
      if (idx < remaining) {
        acceptedRows.push(row);
      } else {
        overflowErrors.push({
          rowNumber: idx + 2 /* approximate; row order preserved */,
          reason: `Tier limit reached (${limits.clients} clients) — upgrade to add more.`,
        });
      }
    });

    const inserted: BulkInsertedRow[] = [];
    const insertErrors: Array<{ rowNumber: number; reason: string }> = [];

    // Per-row insert. Could batch with a single .insert([...]) but then a
    // single FK/constraint failure would roll the whole call back; better
    // to surface row-level success/failure for the result modal.
    for (let i = 0; i < acceptedRows.length; i++) {
      const row = acceptedRows[i];
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: row.name,
          company_name: row.company_name,
          contact_email: row.contact_email,
          monthly_retainer: row.monthly_retainer,
          service_type: row.service_type,
          notes: row.notes,
          agency_id: agencyId,
          status: 'active',
        })
        .select('id, name, company_name')
        .single();

      if (error || !data) {
        insertErrors.push({
          rowNumber: i + 2,
          reason: error?.message ?? 'Insert failed',
        });
        continue;
      }
      inserted.push({
        id: data.id as string,
        name: data.name as string,
        company_name: data.company_name as string,
      });
    }

    const allErrors = [
      ...parsed.invalidRows.map((r) => ({ rowNumber: r.rowNumber, reason: r.reason })),
      ...overflowErrors,
      ...insertErrors,
    ];

    const body: BulkUploadResponse = {
      added: inserted.length,
      skipped: allErrors.length,
      inserted,
      errors: allErrors,
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error('[clients/bulk POST] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET returns the CSV template so the UI can offer a "Download template"
// link without bundling the string into the client JS.
export async function GET() {
  return new NextResponse(CLIENT_CSV_TEMPLATE, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="clientpulse-client-template.csv"',
    },
  });
}
