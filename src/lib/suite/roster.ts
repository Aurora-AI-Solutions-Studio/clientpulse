// Aurora Suite Roster — HMAC sign/verify for cross-product roster RPC.
//
// COPY THIS FILE BETWEEN ContentPulse AND CP VERBATIM. Same wire format as the
// suite/handoff and signal pipeline tokens — `<base64url(payload-json)>.<base64url(HMAC)>`.
//
// Reuses the AURORA_SUITE_HANDOFF_SECRET — same trust domain (cross-product
// agency identity proof), same provisioning, no extra env var to manage.
// The payload `kind` field discriminates from SSO handoff tokens so a
// roster token can never be substituted for an SSO bootstrap or vice
// versa, even if someone fat-fingers a route.
//
// Threat model:
//  - Tampering: HMAC-SHA256 over the canonical JSON body.
//  - Replay: this is a read-only RPC — replay just returns the same data
//    the original caller would already have. No side effects.
//  - Stale tokens: each payload carries `exp` (60s TTL), verifier rejects
//    expired tokens.
//  - Token confusion: the `kind: 'roster'` field rejects SSO tokens at
//    the verifier; SSO verifier rejects `kind: 'roster'` symmetrically.

import crypto from 'crypto';

export interface RosterPayload {
  kind: 'roster';
  /** Lowercased agency owner email — CP looks the user up by this. */
  agency_email: string;
  /** Unix seconds. */
  iat: number;
  /** Unix seconds. */
  exp: number;
}

const TOKEN_TTL_SECONDS = 60;

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function signRosterToken(agencyEmail: string): string {
  const secret = process.env.AURORA_SUITE_HANDOFF_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AURORA_SUITE_HANDOFF_SECRET missing or too short (min 32 chars)');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: RosterPayload = {
    kind: 'roster',
    agency_email: agencyEmail.toLowerCase().trim(),
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

export type VerifyRosterResult =
  | { ok: true; payload: RosterPayload }
  | {
      ok: false;
      reason:
        | 'not_configured'
        | 'malformed'
        | 'bad_sig'
        | 'bad_payload'
        | 'wrong_kind'
        | 'expired';
    };

export function verifyRosterToken(token: string): VerifyRosterResult {
  const secret = process.env.AURORA_SUITE_HANDOFF_SECRET;
  if (!secret || secret.length < 32) return { ok: false, reason: 'not_configured' };

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [body, sig] = parts;

  const expectedSig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  if (!timingSafeEqualStr(sig, expectedSig)) return { ok: false, reason: 'bad_sig' };

  let payload: RosterPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }
  if (typeof payload !== 'object' || payload === null) return { ok: false, reason: 'bad_payload' };
  if (payload.kind !== 'roster') return { ok: false, reason: 'wrong_kind' };
  if (typeof payload.agency_email !== 'string' || payload.agency_email.length === 0) {
    return { ok: false, reason: 'bad_payload' };
  }
  if (typeof payload.exp !== 'number') return { ok: false, reason: 'bad_payload' };

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}
