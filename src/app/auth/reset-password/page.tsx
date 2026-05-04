'use client';
export const dynamic = 'force-dynamic';

// Recovery flow landing page. Two arrival shapes are supported:
//
//  1. Canonical (PKCE via callback): the email link points at
//     /auth/callback?next=/auth/reset-password. The callback route
//     exchanges the ?code= server-side, sets the session cookie, and
//     redirects here without any code in the URL. We just render the
//     form and call updateUser({ password }).
//
//  2. Defensive (PKCE direct): if the email template ever points
//     straight at /auth/reset-password?code=<uuid> (legacy CP config,
//     manual edit, or callback failure), we run the exchange in-page
//     so the user isn't stranded. Same outcome as path #1.
//
// We deliberately don't probe getSession() up front — a brief
// "Verifying recovery link…" banner only renders while exchange is
// in flight. Once it completes (or there's no ?code= to exchange),
// the form is shown and updateUser surfaces any remaining auth error.
//
// Pair: src/app/auth/forgot-password/page.tsx (request side, redirects via /auth/callback)
//       src/app/auth/callback/route.ts (canonical PKCE exchange)
//       Supabase email template "Reset Password"

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthFooter } from '@/components/ui/auth-footer';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '@/lib/auth/password-validation';
import { runRecoveryExchange } from '@/lib/auth/recovery-exchange';

export default function ResetPasswordPage() {
  // Suspense wrapper required by Next.js for useSearchParams() inside
  // a client component — even with `force-dynamic`, the build still
  // bails CSR rendering without it. Falls back to the same empty card
  // so the layout doesn't shift while the param reads.
  return (
    <Suspense fallback={<ResetPasswordCardShell />}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordCardShell() {
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
          <CardContent />
        </Card>
      </div>
      <div className="px-4">
        <AuthFooter />
      </div>
    </div>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  // exchanging: true while we run exchangeCodeForSession on a ?code=
  // landing. linkInvalid: true if the exchange failed (expired/used
  // link). Both default to "no work needed" so the form renders
  // instantly when the user arrived via the canonical callback path.
  const [exchanging, setExchanging] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  useEffect(() => {
    const code = searchParams?.get('code');
    if (!code) {
      // No ?code= in URL — either canonical callback flow (session
      // already in cookies) or legacy hash flow (supabase-js will
      // pick it up). Form render is immediate; updateUser will
      // surface "Auth session missing" if neither path ran.
      return;
    }

    let cancelled = false;
    setExchanging(true);
    void (async () => {
      const { status } = await runRecoveryExchange(supabase, code);
      if (cancelled) return;
      if (status === 'invalid') {
        setLinkInvalid(true);
      }
      setExchanging(false);
    })();

    return () => {
      cancelled = true;
    };
    // supabase client is created fresh per render but exchange is keyed
    // on the URL-derived code, so re-runs are safe and rare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
            {linkInvalid && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm space-y-2">
                <p>This password reset link has expired or already been used.</p>
                <p>
                  <Link
                    href="/auth/forgot-password"
                    className="underline hover:text-red-300 transition-colors"
                  >
                    Request a new reset link
                  </Link>
                </p>
              </div>
            )}

            {exchanging && !linkInvalid && (
              <div className="bg-[#7a88a8]/10 border border-[#7a88a8]/30 rounded-lg p-4 text-[#7a88a8] text-sm">
                Verifying recovery link…
              </div>
            )}

            {error && !linkInvalid && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 text-green-400 text-sm">
                Password updated. Redirecting to your dashboard…
              </div>
            )}

            {!success && !linkInvalid && (
              <form onSubmit={handleResetPassword} className="space-y-4" aria-busy={exchanging || loading}>
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
                    disabled={loading || exchanging}
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
                    disabled={loading || exchanging}
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || exchanging}
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
