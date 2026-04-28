// HMAC-signed magic-link tokens for one-click unsubscribe (RFC 8058).
//
// Format: v1.<base64url(payloadJson)>.<base64url(hmacSha256(payload, secret))>
// Lifetime: 365 days — Gmail's bulk-sender policy expects unsubscribe links
// to keep working for at least a year after the email was sent.
//
// Mirror of brief-token.ts; kept separate so the two token classes can
// rotate keys independently if we ever need to.

import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 'v1';
export const UNSUB_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface UnsubscribeTokenPayload {
  /** The user the token unsubscribes (1:1 with profiles.id). */
  userId: string;
  /** Which mailing list — only "monday-brief" today. */
  list: 'monday-brief';
  /** Unix ms timestamp of issuance. */
  issuedAt: number;
}

export type VerifyUnsubResult =
  | { ok: true; payload: UnsubscribeTokenPayload }
  | {
      ok: false;
      reason: 'malformed' | 'wrong-version' | 'bad-signature' | 'expired';
    };

export function signUnsubscribeToken(
  payload: UnsubscribeTokenPayload,
  secret: string,
): string {
  if (!secret) {
    throw new Error('EMAIL_TOKEN_SECRET is required to sign unsubscribe tokens');
  }
  const json = JSON.stringify(payload);
  const body = base64UrlEncode(Buffer.from(json, 'utf8'));
  const sig = base64UrlEncode(hmac(body, secret));
  return `${TOKEN_VERSION}.${body}.${sig}`;
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): VerifyUnsubResult {
  if (typeof token !== 'string') return { ok: false, reason: 'malformed' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };

  const [version, body, sig] = parts;
  if (version !== TOKEN_VERSION) return { ok: false, reason: 'wrong-version' };
  if (!body || !sig) return { ok: false, reason: 'malformed' };

  const expectedSig = base64UrlEncode(hmac(body, secret));
  if (!constantTimeStringEqual(sig, expectedSig)) {
    return { ok: false, reason: 'bad-signature' };
  }

  let payload: UnsubscribeTokenPayload;
  try {
    const decoded = base64UrlDecode(body).toString('utf8');
    payload = JSON.parse(decoded);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    typeof payload?.userId !== 'string' ||
    typeof payload?.list !== 'string' ||
    typeof payload?.issuedAt !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  if (now - payload.issuedAt > UNSUB_TOKEN_TTL_MS) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload };
}

function hmac(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data, 'utf8').digest();
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
