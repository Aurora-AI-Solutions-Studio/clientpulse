// Aurora Suite SSO handoff — short-lived signed tokens for cross-product
// session bootstrap.
//
// Threat model:
//  - Token interception → mitigated by short TTL (60s) + HTTPS-only.
//  - Replay → mitigated at the verifier by inserting the nonce into
//    `auth_handoff_nonces` with a UNIQUE PK. First claim wins.
//  - Forgery → HMAC-SHA256 with a 32-byte+ secret shared between
//    products via `AURORA_SUITE_HANDOFF_SECRET` (set on both Vercel
//    projects to the SAME value).
//  - Account takeover → email is taken from the issuer's authed user
//    only. Verifier looks up the user in its own auth.users by email.
//    No user is created from a token — if the email isn't already
//    registered, we redirect to /auth/signup with the email pre-filled.
//
// Token format: `<base64url(payload-json)>.<base64url(HMAC-SHA256)>`.
// Identical on CP and RF — copy this file as-is between the two
// products so the wire format never drifts.

import crypto from 'crypto';

export type HandoffSource = 'cp' | 'rf';

export interface HandoffPayload {
  email: string;
  source: HandoffSource;
  /** Unix seconds. */
  iat: number;
  /** Unix seconds. */
  exp: number;
  /** 16 random bytes hex — verifier writes to auth_handoff_nonces (UNIQUE). */
  nonce: string;
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

export function signHandoff(email: string, source: HandoffSource): string {
  const secret = process.env.AURORA_SUITE_HANDOFF_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AURORA_SUITE_HANDOFF_SECRET missing or too short (min 32 chars)');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: HandoffPayload = {
    email: email.toLowerCase().trim(),
    source,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: HandoffPayload }
  | { ok: false; reason: 'not_configured' | 'malformed' | 'bad_sig' | 'bad_payload' | 'expired' };

export function verifyHandoff(token: string): VerifyResult {
  const secret = process.env.AURORA_SUITE_HANDOFF_SECRET;
  if (!secret || secret.length < 32) return { ok: false, reason: 'not_configured' };

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };

  const [body, sig] = parts;
  const expectedSig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  if (!timingSafeEqualStr(sig, expectedSig)) return { ok: false, reason: 'bad_sig' };

  let payload: HandoffPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }
  if (
    typeof payload.email !== 'string' ||
    typeof payload.nonce !== 'string' ||
    typeof payload.exp !== 'number' ||
    (payload.source !== 'cp' && payload.source !== 'rf')
  ) {
    return { ok: false, reason: 'bad_payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}
