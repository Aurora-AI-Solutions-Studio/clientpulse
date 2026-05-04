// Pure validation helpers for the password-reset / signup flows.
// Kept side-effect-free so unit tests can import without pulling in
// React or supabase-js.

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** Validate a new password + its confirmation field. Returns the
 *  first user-visible error, or { ok: true } if the inputs are good
 *  to submit. */
export function validateNewPassword(
  password: string,
  confirm: string,
): PasswordValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }
  if (password !== confirm) {
    return { ok: false, error: 'Passwords do not match' };
  }
  return { ok: true };
}
