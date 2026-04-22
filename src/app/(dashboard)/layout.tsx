'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/dashboard/sidebar';
import Header from '@/components/dashboard/header';
import MobileSidebar from '@/components/dashboard/mobile-sidebar';
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
    <div className="flex h-screen bg-[#06090f]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-[280px] fixed left-0 top-0 h-screen">
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
      <div className="flex-1 flex flex-col md:ml-[280px]">
        {/* Header */}
        <Header
          user={user}
          onMenuClick={() => setMobileMenuOpen(true)}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
