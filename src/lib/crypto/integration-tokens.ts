/**
 * Integration token encryption (LRA §24.13)
 *
 * AES-256-GCM for OAuth access_token / refresh_token storage in
 * integration_connections. Key sourced from INTEGRATION_TOKEN_KEY env var
 * (base64-encoded 32 bytes). Fails loudly on missing/invalid key — never
 * silently falls back to plaintext on the write path.
 *
 * Wire format (base64 of concatenated bytes):
 *   v1:<base64(iv || ciphertext || authTag)>
 * where:
 *   - iv        = 12 bytes (GCM standard)
 *   - ciphertext = variable
 *   - authTag   = 16 bytes (GCM standard)
 *
 * Read path is tolerant of legacy plaintext values (tokens written before
 * this module shipped). Detection is strict: only the "v1:" prefix triggers
 * decryption. Anything else is returned as-is. This lets us roll out the
 * encryption without a data-migration window; plaintext rows naturally cycle
 * to encrypted on the next OAuth token refresh.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const PREFIX = 'v1:';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.INTEGRATION_TOKEN_KEY;
  if (!raw) {
    throw new Error(
      'INTEGRATION_TOKEN_KEY is not set. Cannot encrypt/decrypt integration tokens. ' +
        'Generate one with: openssl rand -base64 32'
    );
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error('INTEGRATION_TOKEN_KEY is not valid base64.');
  }

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `INTEGRATION_TOKEN_KEY must decode to exactly ${KEY_BYTES} bytes (got ${key.length}). ` +
        'Generate one with: openssl rand -base64 32'
    );
  }

  cachedKey = key;
  return key;
}

/**
 * Encrypt a plaintext OAuth token. Throws if the key is missing/invalid.
 * Call this on every write path (OAuth callback + token refresh).
 */
export function encryptToken(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptToken: plaintext must be a non-empty string');
  }
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/**
 * Decrypt a token that was written via encryptToken. Tolerant of legacy
 * plaintext values (no "v1:" prefix) so existing rows keep working until they
 * naturally cycle on the next token refresh.
 */
export function decryptToken(value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('decryptToken: value must be a non-empty string');
  }

  // Legacy plaintext — return as-is. The next token refresh will re-write it
  // through encryptToken() and it will then have the v1: prefix.
  if (!value.startsWith(PREFIX)) return value;

  const key = getKey();
  const payload = Buffer.from(value.slice(PREFIX.length), 'base64');

  if (payload.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('decryptToken: ciphertext too short');
  }

  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(payload.length - TAG_BYTES);
  const ciphertext = payload.subarray(IV_BYTES, payload.length - TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Null-tolerant variants for DB columns that may be NULL.
 * Returns null for null/undefined, otherwise delegates to the strict functions.
 */
export function encryptTokenOrNull(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === '') return null;
  return encryptToken(plaintext);
}

export function decryptTokenOrNull(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return decryptToken(value);
}
