// HMAC-signed magic-link tokens for "Accept from email" on the Monday Brief.
//
// A token encodes the agency, brief, recommended-action id, client id and
// issue time. The server signs it with EMAIL_TOKEN_SECRET; a click on the
// link verifies signature + expiry before letting the action through.
//
// Format: v1.<base64url(payloadJson)>.<base64url(hmacSha256(payload, secret))>
// Lifetime: 24h (matches the typical "I'll get to email Monday morning"
// pattern for the Monday Brief and avoids stale links from the prior week).

import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 'v1';
export const ACCEPT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface AcceptTokenPayload {
  /** The agency the action belongs to (server enforces ownership). */
  agencyId: string;
  /** The brief row this magic link came from (audit trail). */
  briefId: string;
  /** The recommendedAction.id within the brief content. */
  actionId: string;
  /** The client the action targets. */
  clientId: string;
  /** Unix ms timestamp of issuance. */
  issuedAt: number;
}

export type VerifyAcceptTokenResult =
  | { ok: true; payload: AcceptTokenPayload }
  | {
      ok: false;
      reason: 'malformed' | 'wrong-version' | 'bad-signature' | 'expired';
    };

export function signAcceptToken(
  payload: AcceptTokenPayload,
  secret: string,
): string {
  if (!secret) {
    throw new Error('EMAIL_TOKEN_SECRET is required to sign accept tokens');
  }
  const json = JSON.stringify(payload);
  const body = base64UrlEncode(Buffer.from(json, 'utf8'));
  const sig = base64UrlEncode(hmac(body, secret));
  return `${TOKEN_VERSION}.${body}.${sig}`;
}

export function verifyAcceptToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): VerifyAcceptTokenResult {
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

  let payload: AcceptTokenPayload;
  try {
    const decoded = base64UrlDecode(body).toString('utf8');
    payload = JSON.parse(decoded);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    typeof payload?.agencyId !== 'string' ||
    typeof payload?.briefId !== 'string' ||
    typeof payload?.actionId !== 'string' ||
    typeof payload?.clientId !== 'string' ||
    typeof payload?.issuedAt !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  if (now - payload.issuedAt > ACCEPT_TOKEN_TTL_MS) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload };
}

/**
 * Stable hash of a token for the action_items.source_email_token_hash unique
 * index. NOT a security boundary — just an idempotency key that prevents two
 * clicks of the same magic link from creating two action items.
 */
export function hashAcceptToken(token: string): string {
  return base64UrlEncode(hmac(token, 'accept-token-hash-v1'));
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
