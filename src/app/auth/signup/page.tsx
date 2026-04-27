'use client';
export const dynamic = 'force-dynamic';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthFooter } from '@/components/ui/auth-footer';

// Next 15 requires every component that calls useSearchParams() to be
// wrapped in a Suspense boundary at build time, otherwise prerender
// bails on the page. Split the component: the page is a server-safe
// shell that mounts the form inside <Suspense>; the form uses the hook.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  /** When email confirmation is required by the Supabase project,
   *  signUp returns a user but no session — show this state so the
   *  user knows to check their inbox instead of staring at a blank
   *  /dashboard redirect that bounces back to /auth/login. */
  const [confirmEmailFor, setConfirmEmailFor] = useState<string | null>(null);

  // Pre-fill email from ?email=… (landing-page hero hands it off).
  useEffect(() => {
    const e = search.get('email');
    if (e) setEmail(e);
  }, [search]);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message || 'Failed to sign up');
        return;
      }

      // Two cases:
      //   1) project has email confirmation OFF → session present → redirect.
      //   2) project requires email confirmation → user object but no
      //      session → show "Check your email" message.
      if (data?.session) {
        router.push('/dashboard');
        return;
      }
      setConfirmEmailFor(email);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message || 'Failed to sign up with Google');
      }
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
            <CardTitle className="text-2xl">
              {confirmEmailFor ? 'Check your inbox' : 'Create Account'}
            </CardTitle>
            <CardDescription>
              {confirmEmailFor
                ? `We sent a confirmation link to ${confirmEmailFor}. Click it to finish creating your account, then sign in.`
                : 'Get started with ClientPulse today'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {confirmEmailFor && (
              <Link
                href="/auth/login"
                className="block w-full bg-[#e74c3c] hover:bg-[#ff5e45] text-white font-medium text-center py-2.5 rounded-md transition"
              >
                Go to sign in
              </Link>
            )}

            {!confirmEmailFor && (<>
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleEmailSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#1a2540]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#0d1422] text-[#7a88a8]">or sign up with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleGoogleSignup}
              disabled={loading}
            >
              Sign up with Google
            </Button>

            <div className="text-center pt-2">
              <p className="text-sm text-[#7a88a8]">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-[#e74c3c] hover:text-[#ff5e45] font-medium">
                  Sign in
                </Link>
              </p>
            </div>
            </>)}
          </CardContent>
        </Card>
      </div>

      <div className="px-4">
        <AuthFooter />
      </div>
    </div>
  );
}
