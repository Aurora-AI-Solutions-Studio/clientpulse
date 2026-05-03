// CSV bulk-import for clients.
//
// Tiny, dependency-free CSV parser + per-row validator. We don't need
// papaparse: the agency-uploaded files we care about are short (<1k rows)
// and the column set is small + known. RFC 4180 quoting is supported,
// CRLF is handled, and quoted fields can contain commas + escaped quotes.
//
// The route layer (POST /api/clients/bulk) calls parseClientCsv() to get
// validated rows, then inserts them one by one into the user's agency
// (RLS scoping handled in the route, same pattern as POST /api/clients).
//
// Field mapping mirrors AddClientDialog so users get the same shape they
// see in the UI:
//   name              -> required
//   company_name      -> required (also accepts: company)
//   primary_contact   -> optional (also accepts: contact_email, email,
//                                   primary_contact_email)
//   monthly_value     -> optional (also accepts: monthly_retainer, retainer)
//                                   stored in cents, parsed from dollar amount
//   service_type      -> optional
//   notes             -> optional

export interface ClientCsvRow {
  name: string;
  company_name: string;
  contact_email: string | null;
  monthly_retainer: number | null;
  service_type: string | null;
  notes: string | null;
}

export interface ParseResult {
  /** Header columns as they appeared in the file (lowercased, trimmed). */
  headers: string[];
  /** Rows that passed validation, in insert-ready DB shape. */
  validRows: ClientCsvRow[];
  /** Rows that failed validation, with their original 1-indexed row number
   * (1 = header, so first data row is rowNumber=2) and a human-readable
   * reason. Includes rows that were rejected as in-batch duplicates. */
  invalidRows: Array<{ rowNumber: number; reason: string; raw: Record<string, string> }>;
}

const REQUIRED_HEADERS = ['name', 'company_name'] as const;
const HEADER_ALIASES: Record<string, string> = {
  company: 'company_name',
  primary_contact: 'contact_email',
  primary_contact_email: 'contact_email',
  email: 'contact_email',
  monthly_value: 'monthly_retainer',
  retainer: 'monthly_retainer',
};

/** Parse a single CSV line, RFC 4180 style. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        buf += ch;
      }
    } else {
      if (ch === ',') {
        out.push(buf);
        buf = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        buf += ch;
      }
    }
  }
  out.push(buf);
  return out;
}

/** Parse a full CSV string into header + array of row objects (header
 * fields normalized: lowercased, trimmed, alias-resolved). */
function parseCsv(text: string): { headers: string[]; rows: Array<Record<string, string>> } {
  // Normalise line endings, drop the optional UTF-8 BOM, drop trailing blank.
  const cleaned = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter((l, idx, arr) => {
    // Keep all but trailing empty line(s).
    if (l.length > 0) return true;
    return idx < arr.length - 1 ? false : false;
  });
  if (lines.length === 0) return { headers: [], rows: [] };

  const rawHeaders = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const headers = rawHeaders.map((h) => HEADER_ALIASES[h] ?? h);

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (cells[j] ?? '').trim();
    }
    rows.push(row);
  }
  return { headers, rows };
}

/** Parse a "5,000" / "$5000.50" / "1234" dollar string into cents. Returns
 * null if the field is empty, NaN if it's truly unparseable. */
function parseMoney(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === '') return null;
  // Strip currency symbols and thousands separators, keep digits + . + -.
  const stripped = trimmed.replace(/[$€£,\s]/g, '');
  const n = Number(stripped);
  if (!Number.isFinite(n)) return Number.NaN;
  if (n < 0) return Number.NaN;
  // Store in cents — matches the existing /api/clients POST contract
  // (see add-client-dialog.tsx lines 163-169).
  return Math.round(n * 100);
}

export interface ParseOptions {
  /** Names already in the agency. Lowercased + trimmed comparisons.
   * Used to flag duplicates BEFORE we hit the DB. */
  existingNames?: string[];
  /** Hard cap on data rows to process. Anything beyond is invalid. */
  maxRows?: number;
}

/** Parse + validate a CSV string. Never throws on bad rows — collects
 * errors and returns a structured result the route can stream back. */
export function parseClientCsv(text: string, opts: ParseOptions = {}): ParseResult {
  const { headers, rows } = parseCsv(text);
  const result: ParseResult = { headers, validRows: [], invalidRows: [] };

  if (headers.length === 0) {
    // No header row at all — surface a single synthetic invalid row so
    // the caller has something to show.
    result.invalidRows.push({
      rowNumber: 1,
      reason: 'CSV is empty — at minimum a header row with "name,company_name" is required.',
      raw: {},
    });
    return result;
  }

  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      result.invalidRows.push({
        rowNumber: 1,
        reason: `Missing required column "${required}" in header row. Use the template.`,
        raw: {},
      });
    }
  }
  if (result.invalidRows.length > 0) return result;

  const maxRows = opts.maxRows ?? 1000;
  if (rows.length > maxRows) {
    result.invalidRows.push({
      rowNumber: 1,
      reason: `Too many rows (${rows.length}). Maximum is ${maxRows} per upload.`,
      raw: {},
    });
    return result;
  }

  const existingLower = new Set(
    (opts.existingNames ?? []).map((n) => n.toLowerCase().trim()),
  );
  // Track duplicates inside the batch too — first wins.
  const seenInBatch = new Set<string>();

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // 1 is header, data starts at 2
    const name = (row.name ?? '').trim();
    const company = (row.company_name ?? '').trim();

    if (!name) {
      result.invalidRows.push({ rowNumber, reason: 'Missing required field: name', raw: row });
      return;
    }
    if (!company) {
      result.invalidRows.push({
        rowNumber,
        reason: 'Missing required field: company_name',
        raw: row,
      });
      return;
    }

    const nameKey = name.toLowerCase();
    if (existingLower.has(nameKey)) {
      result.invalidRows.push({
        rowNumber,
        reason: `Duplicate: a client named "${name}" already exists in this agency.`,
        raw: row,
      });
      return;
    }
    if (seenInBatch.has(nameKey)) {
      result.invalidRows.push({
        rowNumber,
        reason: `Duplicate within upload: "${name}" appears more than once.`,
        raw: row,
      });
      return;
    }

    const moneyRaw = row.monthly_retainer ?? '';
    const monthly = parseMoney(moneyRaw);
    if (Number.isNaN(monthly)) {
      result.invalidRows.push({
        rowNumber,
        reason: `Invalid monthly_value "${moneyRaw}" — expected a non-negative number.`,
        raw: row,
      });
      return;
    }

    const email = (row.contact_email ?? '').trim();
    if (email && !email.includes('@')) {
      result.invalidRows.push({
        rowNumber,
        reason: `Invalid contact_email "${email}".`,
        raw: row,
      });
      return;
    }

    seenInBatch.add(nameKey);
    result.validRows.push({
      name,
      company_name: company,
      contact_email: email || null,
      monthly_retainer: monthly,
      service_type: (row.service_type ?? '').trim() || null,
      notes: (row.notes ?? '').trim() || null,
    });
  });

  return result;
}

/** The CSV the dashboard offers as a downloadable template. */
export const CLIENT_CSV_TEMPLATE =
  'name,company_name,primary_contact,monthly_value,service_type,notes\n' +
  'Jane Doe,Acme Corp,jane@acme.com,5000,Full Service,Renewal due Aug\n' +
  'John Smith,Initech,john@initech.com,3500,SEO,\n';
