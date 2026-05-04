// Coverage for the pure validator that backs the /auth/reset-password
// form submit handler. Keeps the recovery flow honest about minimum
// length + confirmation match without booting React.

import { describe, it, expect } from 'vitest';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '@/lib/auth/password-validation';

describe('validateNewPassword', () => {
  it('rejects passwords shorter than the minimum length', () => {
    const r = validateNewPassword('short', 'short');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain(String(MIN_PASSWORD_LENGTH));
    }
  });

  it('rejects passwords that do not match the confirmation', () => {
    const r = validateNewPassword('correcthorse', 'wrongbattery');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/match/i);
  });

  it('rejects empty strings', () => {
    const r = validateNewPassword('', '');
    expect(r.ok).toBe(false);
  });

  it('accepts a valid matching password at the minimum length', () => {
    const pw = 'a'.repeat(MIN_PASSWORD_LENGTH);
    expect(validateNewPassword(pw, pw)).toEqual({ ok: true });
  });

  it('accepts a longer matching password', () => {
    expect(validateNewPassword('correcthorsebatterystaple', 'correcthorsebatterystaple')).toEqual({ ok: true });
  });

  it('exposes the minimum length constant', () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
  });
});
