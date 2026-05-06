// Aurora Suite Signal pipeline — HMAC sign/verify utilities.
//
// COPY THIS FILE BETWEEN CP AND ContentPulse VERBATIM. Same wire format as the
// suite/handoff token — `<base64url(payload-json)>.<base64url(HMAC)>` —
// but a different shared secret (AURORA_SUITE_SIGNALS_SECRET) so a leak
// of the SSO secret can't forge signals and vice versa.
//
// Threat model:
//  - Replay: rejected at the verifier via the (client_id, signal_type,
//    period) UNIQUE constraint on client_signals — same period + same
//    type = idempotent insert, second wins as a no-op update.
//  - Tampering: HMAC-SHA256 over the canonical JSON body.
//  - Stale signals: each payload carries `emitted_at`; verifier
//    rejects anything older than MAX_SIGNAL_AGE_SECONDS.
//
// The body the HMAC signs is the JSON-stringified SignalPayload. We
// don't sort keys — sender and receiver both serialize via the same
// JSON.stringify call on the same object shape, which Node's
// JSON.stringify keeps insertion-ordered.

import crypto from 'crypto';
import type { SignalPayload } from './types';

/** Reject signals older than 10 minutes — clock-skew tolerant, replay-resistant. */
const MAX_SIGNAL_AGE_SECONDS = 600;

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function signSignal(payload: SignalPayload): string {
  const secret = process.env.AURORA_SUITE_SIGNALS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AURORA_SUITE_SIGNALS_SECRET missing or too short (min 32 chars)');
  }
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: SignalPayload }
  | { ok: false; reason: 'not_configured' | 'malformed' | 'bad_sig' | 'bad_payload' | 'bad_version' | 'expired' };

export function verifySignal(token: string): VerifyResult {
  const secret = process.env.AURORA_SUITE_SIGNALS_SECRET;
  if (!secret || secret.length < 32) return { ok: false, reason: 'not_configured' };

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [body, sig] = parts;

  const expectedSig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  if (!timingSafeEqualStr(sig, expectedSig)) return { ok: false, reason: 'bad_sig' };

  let payload: SignalPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }

  if (typeof payload !== 'object' || payload === null) return { ok: false, reason: 'bad_payload' };
  if (payload.v !== 1) return { ok: false, reason: 'bad_version' };

  const requiredString: (keyof SignalPayload)[] = [
    'rf_client_id', 'rf_client_name', 'agency_email', 'signal_type', 'period', 'emitted_at',
  ];
  for (const k of requiredString) {
    if (typeof payload[k] !== 'string' || (payload[k] as string).length === 0) {
      return { ok: false, reason: 'bad_payload' };
    }
  }
  if (typeof payload.value !== 'number' || !Number.isFinite(payload.value)) {
    return { ok: false, reason: 'bad_payload' };
  }

  // Freshness check.
  const emittedMs = Date.parse(payload.emitted_at);
  if (!Number.isFinite(emittedMs)) return { ok: false, reason: 'bad_payload' };
  const ageSec = (Date.now() - emittedMs) / 1000;
  if (ageSec > MAX_SIGNAL_AGE_SECONDS) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}
