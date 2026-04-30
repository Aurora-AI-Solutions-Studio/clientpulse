// Roster RPC token sign/verify smoke. Mirrors the RF-side test by
// design — same wire format both directions, identical guards.

import crypto from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signRosterToken, verifyRosterToken } from '@/lib/suite/roster';

const ORIGINAL = process.env.AURORA_SUITE_HANDOFF_SECRET;

beforeEach(() => {
  process.env.AURORA_SUITE_HANDOFF_SECRET = 'a'.repeat(64);
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AURORA_SUITE_HANDOFF_SECRET;
  else process.env.AURORA_SUITE_HANDOFF_SECRET = ORIGINAL;
});

describe('roster token (CP)', () => {
  it('round-trips a valid email', () => {
    const token = signRosterToken('Sasa@Example.com');
    const result = verifyRosterToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.kind).toBe('roster');
      expect(result.payload.agency_email).toBe('sasa@example.com');
      expect(result.payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }
  });

  it('rejects a tampered signature', () => {
    const token = signRosterToken('a@b.com');
    const tampered = token.slice(0, -2) + 'XX';
    expect(verifyRosterToken(tampered)).toEqual({ ok: false, reason: 'bad_sig' });
  });

  it('rejects malformed token', () => {
    expect(verifyRosterToken('garbage')).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects expired tokens', () => {
    const real = Date.now;
    try {
      Date.now = () => real() - 5 * 60 * 1000;
      const token = signRosterToken('a@b.com');
      Date.now = real;
      expect(verifyRosterToken(token)).toEqual({ ok: false, reason: 'expired' });
    } finally {
      Date.now = real;
    }
  });

  it('refuses to verify when secret is missing', () => {
    const token = signRosterToken('a@b.com');
    delete process.env.AURORA_SUITE_HANDOFF_SECRET;
    expect(verifyRosterToken(token)).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('refuses to sign with a too-short secret', () => {
    process.env.AURORA_SUITE_HANDOFF_SECRET = 'short';
    expect(() => signRosterToken('a@b.com')).toThrow();
  });

  it('rejects non-roster kinds (token confusion guard)', () => {
    const secret = 'a'.repeat(64);
    const body = Buffer.from(
      JSON.stringify({ kind: 'handoff', agency_email: 'a@b.com', exp: Math.floor(Date.now() / 1000) + 60 }),
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(body).digest().toString('base64url');
    expect(verifyRosterToken(`${body}.${sig}`)).toEqual({ ok: false, reason: 'wrong_kind' });
  });
});
