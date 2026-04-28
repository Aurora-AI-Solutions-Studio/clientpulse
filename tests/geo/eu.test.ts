// EU detection — used by the non-blocking notice banner on the
// landing page + the /api/eu-waitlist endpoint. Path allowlist
// removed Apr 28 evening when the hard geoblock was replaced with
// a banner per CEO call: launch globally, EU sees a notice.

import { describe, it, expect } from 'vitest';
import { isEuRequest, EU_COUNTRY_CODES } from '@/lib/geo/eu';

function headersWith(country: string | null, headerName: 'x-vercel-ip-country' | 'cf-ipcountry' = 'x-vercel-ip-country'): Headers {
  const h = new Headers();
  if (country !== null) h.set(headerName, country);
  return h;
}

describe('EU_COUNTRY_CODES', () => {
  it('contains exactly the 27 EU member states', () => {
    expect(EU_COUNTRY_CODES.size).toBe(27);
  });

  it('does NOT contain UK / CH / NO / IS / LI', () => {
    for (const cc of ['GB', 'UK', 'CH', 'NO', 'IS', 'LI']) {
      expect(EU_COUNTRY_CODES.has(cc)).toBe(false);
    }
  });

  it('contains DE / FR / IT / ES / NL (sanity)', () => {
    for (const cc of ['DE', 'FR', 'IT', 'ES', 'NL']) {
      expect(EU_COUNTRY_CODES.has(cc)).toBe(true);
    }
  });

  it('does NOT contain markets we explicitly want to launch in (UAE/SG/ID/IN/BR/etc.)', () => {
    for (const cc of ['AE', 'SG', 'ID', 'IN', 'BR', 'JP', 'KR', 'MX', 'ZA']) {
      expect(EU_COUNTRY_CODES.has(cc)).toBe(false);
    }
  });
});

describe('isEuRequest', () => {
  it('returns true for any EU-27 country code via x-vercel-ip-country', () => {
    expect(isEuRequest(headersWith('DE'))).toBe(true);
    expect(isEuRequest(headersWith('FR'))).toBe(true);
    expect(isEuRequest(headersWith('IT'))).toBe(true);
  });

  it('returns false for the global launch markets (US/UK/CA/AU/NZ/UAE/SG/ID)', () => {
    for (const cc of ['US', 'GB', 'CA', 'AU', 'NZ', 'AE', 'SG', 'ID']) {
      expect(isEuRequest(headersWith(cc))).toBe(false);
    }
  });

  it('returns false for non-EU European nations (CH/NO/IS)', () => {
    expect(isEuRequest(headersWith('CH'))).toBe(false);
    expect(isEuRequest(headersWith('NO'))).toBe(false);
    expect(isEuRequest(headersWith('IS'))).toBe(false);
  });

  it('falls back to cf-ipcountry header when x-vercel-ip-country is absent', () => {
    expect(isEuRequest(headersWith('DE', 'cf-ipcountry'))).toBe(true);
    expect(isEuRequest(headersWith('US', 'cf-ipcountry'))).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isEuRequest(headersWith('de'))).toBe(true);
    expect(isEuRequest(headersWith('De'))).toBe(true);
  });

  it('treats missing header as non-EU (fail-open for local dev)', () => {
    expect(isEuRequest(headersWith(null))).toBe(false);
  });

  it('treats Vercel "XX" unknown-country sentinel as non-EU', () => {
    expect(isEuRequest(headersWith('XX'))).toBe(false);
  });
});
