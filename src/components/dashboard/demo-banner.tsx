'use client';

// Persistent demo-mode banner. Visible at the top of every authed
// dashboard page when the active session is the shared demo user
// (demo@helloaurora.ai). Gives prospects a clear "switch to my real
// account" escape hatch — pre-PR-#70 the only path was to manually
// sign out elsewhere, which was confusing.
//
// Behavior:
//   - Self-contained: fetches the current user from the supabase
//     browser client; no props required.
//   - Renders nothing for non-demo users (signed-in or signed-out).
//   - Sign-out button signs the demo session out and redirects to
//     /auth/signup so the user can create their real account in the
//     same browser tab.

import { useEffect, useState } from 'react';
import { Sparkles, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const DEMO_EMAIL = 'demo@helloaurora.ai';

export default function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email === DEMO_EMAIL) setIsDemo(true);
      } catch {
        // Best-effort; banner just doesn't render on failure.
      }
    };
    check();
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      // Land on landing-page #pricing so the user picks a tier first;
      // matches the regular Get Started funnel (5a). The picked tier
      // then flows landing → /auth/signup?plan=X → /dashboard/upgrade?plan=X.
      window.location.href = '/#pricing';
    } catch {
      setSigningOut(false);
    }
  };

  if (!isDemo) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm"
      style={{
        background: 'linear-gradient(90deg, rgba(56,232,200,0.12), rgba(56,232,200,0.04))',
        borderBottom: '1px solid rgba(56,232,200,0.25)',
        color: '#e8ecf5',
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: '#38e8c8' }} />
        <span>
          <strong style={{ color: '#38e8c8' }}>Demo workspace</strong> · Data is shared and may reset periodically. Ready to start your own?
        </span>
      </div>
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
        style={{ background: '#38e8c8', color: '#06090f' }}
      >
        <LogOut className="h-3.5 w-3.5" />
        {signingOut ? 'Signing out…' : 'Sign out & create your account'}
      </button>
    </div>
  );
}
