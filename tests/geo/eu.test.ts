// EU geoblock — country detection + path allowlist invariants.

import { describe, it, expect } from 'vitest';
import { isEuRequest, isEuAllowedPath, EU_COUNTRY_CODES } from '@/lib/geo/eu';

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
});

describe('isEuRequest', () => {
  it('returns true for any EU-27 country code via x-vercel-ip-country', () => {
    expect(isEuRequest(headersWith('DE'))).toBe(true);
    expect(isEuRequest(headersWith('FR'))).toBe(true);
    expect(isEuRequest(headersWith('IT'))).toBe(true);
  });

  it('returns false for the launch-permitted countries (US/UK/CA/AU/NZ)', () => {
    expect(isEuRequest(headersWith('US'))).toBe(false);
    expect(isEuRequest(headersWith('GB'))).toBe(false);
    expect(isEuRequest(headersWith('CA'))).toBe(false);
    expect(isEuRequest(headersWith('AU'))).toBe(false);
    expect(isEuRequest(headersWith('NZ'))).toBe(false);
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

describe('isEuAllowedPath', () => {
  it('allows /eu-waitlist itself (prevents redirect loop)', () => {
    expect(isEuAllowedPath('/eu-waitlist')).toBe(true);
  });

  it('allows the email-capture API route', () => {
    expect(isEuAllowedPath('/api/eu-waitlist')).toBe(true);
  });

  it('allows /robots.txt + /sitemap.xml (SEO + crawler hygiene)', () => {
    expect(isEuAllowedPath('/robots.txt')).toBe(true);
    expect(isEuAllowedPath('/sitemap.xml')).toBe(true);
  });

  it('blocks every product surface', () => {
    for (const path of ['/', '/dashboard', '/dashboard/clients', '/dashboard/upgrade', '/auth/login', '/auth/signup', '/api/clients', '/api/monday-brief']) {
      expect(isEuAllowedPath(path)).toBe(false);
    }
  });

  it('matches subpaths of allowed prefixes', () => {
    expect(isEuAllowedPath('/eu-waitlist/anything')).toBe(true);
  });
});
