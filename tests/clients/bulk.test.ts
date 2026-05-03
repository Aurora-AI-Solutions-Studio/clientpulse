import { describe, expect, it } from 'vitest';
import { CLIENT_CSV_TEMPLATE, parseClientCsv } from '@/lib/clients/bulk';

describe('parseClientCsv', () => {
  it('parses the canonical template', () => {
    const r = parseClientCsv(CLIENT_CSV_TEMPLATE);
    expect(r.invalidRows).toEqual([]);
    expect(r.validRows).toHaveLength(2);
    expect(r.validRows[0]).toMatchObject({
      name: 'Jane Doe',
      company_name: 'Acme Corp',
      contact_email: 'jane@acme.com',
      monthly_retainer: 500_000, // 5000 dollars => cents
      service_type: 'Full Service',
      notes: 'Renewal due Aug',
    });
    expect(r.validRows[1].monthly_retainer).toBe(350_000);
    expect(r.validRows[1].notes).toBeNull();
  });

  it('accepts header aliases (company, primary_contact, monthly_value)', () => {
    const csv =
      'name,company,primary_contact,monthly_value\n' +
      'Sasa,Aurora,sasa@aurora.test,9999\n';
    const r = parseClientCsv(csv);
    expect(r.invalidRows).toEqual([]);
    expect(r.validRows[0]).toMatchObject({
      name: 'Sasa',
      company_name: 'Aurora',
      contact_email: 'sasa@aurora.test',
      monthly_retainer: 999_900,
    });
  });

  it('flags missing required column', () => {
    const csv = 'name,monthly_value\nFoo,100\n';
    const r = parseClientCsv(csv);
    expect(r.validRows).toEqual([]);
    expect(r.invalidRows[0].reason).toContain('company_name');
  });

  it('rejects rows with missing name', () => {
    const csv = 'name,company_name\n,Acme\nReal Person,Acme2\n';
    const r = parseClientCsv(csv);
    expect(r.validRows).toHaveLength(1);
    expect(r.validRows[0].name).toBe('Real Person');
    expect(r.invalidRows).toHaveLength(1);
    expect(r.invalidRows[0].rowNumber).toBe(2);
    expect(r.invalidRows[0].reason).toMatch(/name/i);
  });

  it('rejects rows with missing company_name', () => {
    const csv = 'name,company_name\nJane,\n';
    const r = parseClientCsv(csv);
    expect(r.validRows).toEqual([]);
    expect(r.invalidRows[0].reason).toMatch(/company_name/);
  });

  it('flags duplicate against existing names (case-insensitive)', () => {
    const csv = 'name,company_name\nJane Doe,Acme\n';
    const r = parseClientCsv(csv, { existingNames: ['JANE doe'] });
    expect(r.validRows).toEqual([]);
    expect(r.invalidRows[0].reason).toMatch(/already exists/);
  });

  it('flags in-batch duplicates (first wins)', () => {
    const csv =
      'name,company_name\n' +
      'Jane Doe,Acme\n' +
      'Jane Doe,Acme2\n';
    const r = parseClientCsv(csv);
    expect(r.validRows).toHaveLength(1);
    expect(r.invalidRows).toHaveLength(1);
    expect(r.invalidRows[0].rowNumber).toBe(3);
    expect(r.invalidRows[0].reason).toMatch(/within upload/);
  });

  it('parses dollar amounts with $ and commas', () => {
    const csv = 'name,company_name,monthly_value\nJane,Acme,"$5,000.50"\n';
    const r = parseClientCsv(csv);
    expect(r.invalidRows).toEqual([]);
    expect(r.validRows[0].monthly_retainer).toBe(500_050);
  });

  it('rejects unparseable monthly_value', () => {
    const csv = 'name,company_name,monthly_value\nJane,Acme,not-a-number\n';
    const r = parseClientCsv(csv);
    expect(r.validRows).toEqual([]);
    expect(r.invalidRows[0].reason).toMatch(/monthly_value/);
  });

  it('rejects negative monthly_value', () => {
    const csv = 'name,company_name,monthly_value\nJane,Acme,-100\n';
    const r = parseClientCsv(csv);
    expect(r.validRows).toEqual([]);
  });

  it('rejects malformed contact email', () => {
    const csv = 'name,company_name,primary_contact\nJane,Acme,not-an-email\n';
    const r = parseClientCsv(csv);
    expect(r.validRows).toEqual([]);
    expect(r.invalidRows[0].reason).toMatch(/contact_email/);
  });

  it('handles quoted fields with embedded commas', () => {
    const csv =
      'name,company_name,notes\n' +
      'Jane,"Acme, Inc.","Renewal in Q3, push for upsell"\n';
    const r = parseClientCsv(csv);
    expect(r.validRows[0].company_name).toBe('Acme, Inc.');
    expect(r.validRows[0].notes).toBe('Renewal in Q3, push for upsell');
  });

  it('handles CRLF line endings', () => {
    const csv = 'name,company_name\r\nJane,Acme\r\n';
    const r = parseClientCsv(csv);
    expect(r.validRows).toHaveLength(1);
  });

  it('strips UTF-8 BOM from header', () => {
    const csv = '﻿name,company_name\nJane,Acme\n';
    const r = parseClientCsv(csv);
    expect(r.validRows).toHaveLength(1);
    expect(r.invalidRows).toEqual([]);
  });

  it('caps at maxRows', () => {
    const lines = ['name,company_name'];
    for (let i = 0; i < 5; i++) lines.push(`Person${i},Co${i}`);
    const r = parseClientCsv(lines.join('\n'), { maxRows: 3 });
    expect(r.validRows).toEqual([]);
    expect(r.invalidRows[0].reason).toMatch(/Too many rows/);
  });

  it('returns empty headers result for empty input', () => {
    const r = parseClientCsv('');
    expect(r.validRows).toEqual([]);
    expect(r.invalidRows).toHaveLength(1);
  });
});
