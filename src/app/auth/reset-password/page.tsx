'use client';
export const dynamic = 'force-dynamic';

// Recovery flow landing page. Supabase emails users a magic recovery
// link (template type=recovery). When they click it, the link points
// here and the supabase-js browser client picks up the access_token
// from the URL fragment and establishes a session before the form is
// rendered. From there we just call updateUser({ password }) to set
// the new password — no token plumbing required on our side.
//
// Pair: src/app/auth/forgot-password/page.tsx (request side)
//       Supabase email template "Reset Password"

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthFooter } from '@/components/ui/auth-footer';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '@/lib/auth/password-validation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  // We don't block the form on session check — supabase-js processes
  // the recovery token in the URL fragment asynchronously. If the user
  // landed here without a recovery token (bookmarked the page, link
  // expired) updateUser() returns an "Auth session missing" error and
  // we surface it. Cheaper than a pre-flight session probe.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Give supabase-js a tick to pick up the recovery token from the
    // URL hash and persist a session. Then flip the flag so the form
    // renders. This is best-effort UX — submit still validates.
    const t = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validation = validateNewPassword(password, confirm);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message || 'Failed to update password');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 text-center">
            <div className="flex justify-center mb-2">
              <h1 className="text-3xl font-bold font-playfair">
                Client<span className="text-[#e74c3c]">Pulse</span>
              </h1>
            </div>
            <CardTitle className="text-2xl">Set New Password</CardTitle>
            <CardDescription>Choose a new password for your account</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 text-green-400 text-sm">
                Password updated. Redirecting to your dashboard…
              </div>
            )}

            {!success && (
              <form onSubmit={handleResetPassword} className="space-y-4" aria-busy={!ready || loading}>
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Updating password...' : 'Update Password'}
                </Button>
              </form>
            )}

            <div className="text-center pt-2">
              <Link
                href="/auth/login"
                className="text-sm text-[#7a88a8] hover:text-[#e74c3c] transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-4">
        <AuthFooter />
      </div>
    </div>
  );
}
