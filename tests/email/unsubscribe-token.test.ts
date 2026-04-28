import { describe, expect, it } from 'vitest';
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  UNSUB_TOKEN_TTL_MS,
} from '@/lib/email/unsubscribe-token';

const SECRET = 'test-unsub-secret';

describe('unsubscribe token', () => {
  it('round-trips a fresh token', () => {
    const issuedAt = Date.now();
    const token = signUnsubscribeToken({ userId: 'u1', list: 'monday-brief', issuedAt }, SECRET);
    const r = verifyUnsubscribeToken(token, SECRET);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.userId).toBe('u1');
      expect(r.payload.list).toBe('monday-brief');
    }
  });

  it('rejects a token signed with a different secret', () => {
    const t = signUnsubscribeToken(
      { userId: 'u1', list: 'monday-brief', issuedAt: Date.now() },
      SECRET,
    );
    const r = verifyUnsubscribeToken(t, 'other-secret');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad-signature');
  });

  it('rejects a token past 365 days', () => {
    const issuedAt = Date.now() - UNSUB_TOKEN_TTL_MS - 1000;
    const t = signUnsubscribeToken({ userId: 'u1', list: 'monday-brief', issuedAt }, SECRET);
    const r = verifyUnsubscribeToken(t, SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('expired');
  });

  it('rejects malformed tokens', () => {
    expect(verifyUnsubscribeToken('not-a-token', SECRET).ok).toBe(false);
    expect(verifyUnsubscribeToken('v1.only-two-parts', SECRET).ok).toBe(false);
    expect(verifyUnsubscribeToken('v0.body.sig', SECRET).ok).toBe(false);
  });

  it('throws if the signing secret is empty', () => {
    expect(() =>
      signUnsubscribeToken({ userId: 'u1', list: 'monday-brief', issuedAt: Date.now() }, ''),
    ).toThrow();
  });
});
