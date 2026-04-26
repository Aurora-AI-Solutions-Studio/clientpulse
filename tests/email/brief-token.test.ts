import { describe, expect, it } from 'vitest';
import {
  ACCEPT_TOKEN_TTL_MS,
  hashAcceptToken,
  signAcceptToken,
  verifyAcceptToken,
  type AcceptTokenPayload,
} from '../../src/lib/email/brief-token';

const SECRET = 'test-secret-do-not-use-in-prod';
const SECRET_B = 'different-secret';

const payload: AcceptTokenPayload = {
  agencyId: '11111111-1111-1111-1111-111111111111',
  briefId: '22222222-2222-2222-2222-222222222222',
  actionId: 'ra-1',
  clientId: '33333333-3333-3333-3333-333333333333',
  issuedAt: 1_700_000_000_000,
};

describe('brief-token', () => {
  describe('signAcceptToken / verifyAcceptToken', () => {
    it('round-trips', () => {
      const token = signAcceptToken(payload, SECRET);
      const verified = verifyAcceptToken(token, SECRET, payload.issuedAt + 1000);
      expect(verified.ok).toBe(true);
      if (verified.ok) {
        expect(verified.payload).toEqual(payload);
      }
    });

    it('rejects empty token', () => {
      const verified = verifyAcceptToken('', SECRET);
      expect(verified.ok).toBe(false);
      if (!verified.ok) expect(verified.reason).toBe('malformed');
    });

    it('rejects token without 3 parts', () => {
      const verified = verifyAcceptToken('v1.bad', SECRET);
      expect(verified.ok).toBe(false);
      if (!verified.ok) expect(verified.reason).toBe('malformed');
    });

    it('rejects token from a different secret', () => {
      const token = signAcceptToken(payload, SECRET);
      const verified = verifyAcceptToken(token, SECRET_B, payload.issuedAt + 1000);
      expect(verified.ok).toBe(false);
      if (!verified.ok) expect(verified.reason).toBe('bad-signature');
    });

    it('rejects token with tampered payload (bad signature)', () => {
      const token = signAcceptToken(payload, SECRET);
      const [v, body, sig] = token.split('.');
      // Flip a single character in the body
      const tamperedBody =
        body.slice(0, 5) + (body[5] === 'A' ? 'B' : 'A') + body.slice(6);
      const tampered = [v, tamperedBody, sig].join('.');
      const verified = verifyAcceptToken(tampered, SECRET, payload.issuedAt + 1000);
      expect(verified.ok).toBe(false);
      if (!verified.ok) expect(verified.reason).toBe('bad-signature');
    });

    it('rejects unknown version prefix', () => {
      const token = signAcceptToken(payload, SECRET);
      const [, body, sig] = token.split('.');
      const wrongVersion = ['v9', body, sig].join('.');
      const verified = verifyAcceptToken(wrongVersion, SECRET);
      expect(verified.ok).toBe(false);
      if (!verified.ok) expect(verified.reason).toBe('wrong-version');
    });

    it('rejects expired token (>24h)', () => {
      const token = signAcceptToken(payload, SECRET);
      const verified = verifyAcceptToken(
        token,
        SECRET,
        payload.issuedAt + ACCEPT_TOKEN_TTL_MS + 1,
      );
      expect(verified.ok).toBe(false);
      if (!verified.ok) expect(verified.reason).toBe('expired');
    });

    it('accepts token at exactly 24h boundary', () => {
      const token = signAcceptToken(payload, SECRET);
      const verified = verifyAcceptToken(
        token,
        SECRET,
        payload.issuedAt + ACCEPT_TOKEN_TTL_MS,
      );
      expect(verified.ok).toBe(true);
    });

    it('throws when secret is empty at sign time', () => {
      expect(() => signAcceptToken(payload, '')).toThrow(/EMAIL_TOKEN_SECRET/);
    });

    it('rejects payload missing required fields after b64-decode (malformed)', () => {
      // Sign a payload that omits actionId
      const partial = { ...payload } as Partial<AcceptTokenPayload>;
      delete partial.actionId;
      const token = signAcceptToken(partial as AcceptTokenPayload, SECRET);
      const verified = verifyAcceptToken(token, SECRET, payload.issuedAt + 1000);
      expect(verified.ok).toBe(false);
      if (!verified.ok) expect(verified.reason).toBe('malformed');
    });
  });

  describe('hashAcceptToken', () => {
    it('returns the same hash for the same token', () => {
      const token = signAcceptToken(payload, SECRET);
      expect(hashAcceptToken(token)).toBe(hashAcceptToken(token));
    });

    it('returns different hashes for different tokens', () => {
      const t1 = signAcceptToken(payload, SECRET);
      const t2 = signAcceptToken({ ...payload, actionId: 'ra-2' }, SECRET);
      expect(hashAcceptToken(t1)).not.toBe(hashAcceptToken(t2));
    });
  });
});
