'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/dashboard/sidebar';
import Header from '@/components/dashboard/header';
import MobileSidebar from '@/components/dashboard/mobile-sidebar';
import WorkflowStrip from '@/components/dashboard/workflow-strip';
import type { CPTier } from '@/lib/tiers';

interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface MeSummary {
  tier: CPTier;
  tierLabel: string;
  onboardingCompletedAt: string | null;
  /** True when the user is on a plan that includes Aurora Suite access
   *  (currently a proxy via tier === 'agency'; will switch to a real
   *  has_suite_access flag when that lands). */
  suiteAccess?: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<MeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          router.push('/auth/login');
          return;
        }

        setUser(user);

        // Best-effort profile fetch — feeds sidebar tier + onboarding gate.
        try {
          const meRes = await fetch('/api/me');
          if (meRes.ok) {
            const data: MeSummary = await meRes.json();
            setMe(data);
          }
        } catch {
          // Non-fatal — layout still renders, sidebar shows placeholder tier.
        }
      } catch (error) {
        console.error('Auth error:', error);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [router]);

  // Onboarding gate: redirect to the wizard until the user finishes it.
  // The wizard itself is exempt so the gate doesn't loop.
  useEffect(() => {
    if (loading || !me) return;
    const onOnboarding = pathname?.startsWith('/dashboard/onboarding');
    if (!me.onboardingCompletedAt && !onOnboarding) {
      router.replace('/dashboard/onboarding');
    }
  }, [loading, me, pathname, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#06090f]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#e74c3c] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#7a88a8]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="relative flex h-screen bg-[#06090f] overflow-hidden">
      {/* Aurora ambient depth — large radial glows that lift the page
          off "flat black". Mirrors the atmospheric depth of the landing
          hero. Opacity bumped after first review — too subtle to read
          before. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(70vw 60vh at 22% 8%, rgba(56,232,200,0.10), transparent 55%), radial-gradient(55vw 55vh at 88% 92%, rgba(179,136,235,0.09), transparent 55%), radial-gradient(45vw 45vh at 50% 105%, rgba(76,201,240,0.07), transparent 55%), radial-gradient(35vw 30vh at 95% 12%, rgba(232,127,165,0.05), transparent 60%)',
        }}
      />

      {/* Desktop Sidebar */}
      <div className="hidden md:block w-[280px] fixed left-0 top-0 h-screen z-30">
        <Sidebar user={user} tierLabel={me?.tierLabel ?? null} />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar
        user={user}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        tierLabel={me?.tierLabel ?? null}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-[280px] relative z-10">
        <Header
          user={user}
          onMenuClick={() => setMobileMenuOpen(true)}
          suiteAccess={me?.suiteAccess ?? me?.tier === 'agency'}
        />

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 max-w-[1400px] mx-auto w-full space-y-4">
            {/* Agency-workflow strip — visible spine of the suite. Surfaces
                Connect → Discover → Decide → Act → Learn with the current
                step lit. Hidden on the onboarding wizard so it doesn't
                compete with the wizard's own progress. */}
            {!pathname?.startsWith('/dashboard/onboarding') && <WorkflowStrip />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
