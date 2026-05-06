// HMAC sign/verify smoke. Mirrors the ContentPulse-side test by design — same
// wire format both directions.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signSignal, verifySignal } from '../hmac';
import type { SignalPayload } from '../types';

const ORIGINAL = process.env.AURORA_SUITE_SIGNALS_SECRET;

beforeEach(() => {
  process.env.AURORA_SUITE_SIGNALS_SECRET = 'a'.repeat(64);
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AURORA_SUITE_SIGNALS_SECRET;
  else process.env.AURORA_SUITE_SIGNALS_SECRET = ORIGINAL;
});

function basePayload(overrides: Partial<SignalPayload> = {}): SignalPayload {
  return {
    v: 1,
    rf_client_id: 'rf-client-1',
    rf_client_name: 'Acme Co',
    agency_email: 'sasa@example.com',
    signal_type: 'content_velocity',
    period: '2026-W17',
    value: 4,
    metadata: { prev_week: 6, delta: -2 },
    emitted_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('signal HMAC', () => {
  it('round-trips a valid payload', () => {
    const token = signSignal(basePayload());
    const result = verifySignal(token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.value).toBe(4);
  });

  it('rejects a tampered body', () => {
    const token = signSignal(basePayload());
    const [, sig] = token.split('.');
    const evilBody = Buffer.from(JSON.stringify(basePayload({ value: 999 }))).toString('base64url');
    const result = verifySignal(`${evilBody}.${sig}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_sig');
  });

  it('rejects an expired emitted_at', () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const token = signSignal(basePayload({ emitted_at: old }));
    const result = verifySignal(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects a malformed token', () => {
    const result = verifySignal('not-a-token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('malformed');
  });

  it('rejects unknown protocol versions', () => {
    const token = signSignal(basePayload({ v: 99 as 1 }));
    const result = verifySignal(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_version');
  });

  it('rejects when secret is missing', () => {
    delete process.env.AURORA_SUITE_SIGNALS_SECRET;
    const result = verifySignal('AAA.BBB');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_configured');
  });

  it('rejects when secret is too short', () => {
    process.env.AURORA_SUITE_SIGNALS_SECRET = 'short';
    expect(() => signSignal(basePayload())).toThrow();
  });
});
