'use client';

import React, { useState, useEffect } from 'react';
import { STRIPE_PLANS, getAnnualMonthly } from '@/lib/stripe-config';
import { SubscriptionPlan } from '@/types/stripe';

// Solo+ pricing constants (not in stripe-config — display-only, no checkout yet)
const SOLO_PLUS_MONTHLY = 99;
const SOLO_PLUS_ANNUAL_MONTHLY = 83; // $990/yr ÷ 12, rounded
const SOLO_PLUS_PRICE_ID_MONTHLY = 'price_1TSMHCLER55AcgjYkSAJnw4Q';
const SOLO_PLUS_PRICE_ID_ANNUAL = 'price_1TSMHFLER55AcgjYetT25Dkn';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SOLO_PLUS_IDS_VERIFIED = { SOLO_PLUS_PRICE_ID_MONTHLY, SOLO_PLUS_PRICE_ID_ANNUAL };

export default function Home() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySubmitted, setNotifySubmitted] = useState(false);

  // Intersection Observer for reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('visible'), i * 60);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Nav scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Price cards driven off STRIPE_PLANS. Order: Solo, Solo+, Pro, Agency.
  const PLAN_ORDER: SubscriptionPlan[] = ['solo', 'pro', 'agency'];
  const prices = PLAN_ORDER.map((p) => ({
    monthly: String(STRIPE_PLANS[p].price),
    annual: String(getAnnualMonthly(p)),
    yearlyTotal: STRIPE_PLANS[p].priceYearly,
  }));

  // ── SVG Icon Components ──
  const Icon = {
    pulse: (size = 32) => (
      <img src="/icon.png" width={size} height={size} alt="Aurora Logo" className="rounded-full shadow-[0_0_8px_rgba(0,229,255,0.4)] inline-block" />
    ),
    alertTriangle: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    ),
    grid: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
    ),
    dollar: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    ),
    handshake: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.42 4.58a5.4 5.4 0 00-7.65 0l-.77.78-.77-.78a5.4 5.4 0 00-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>
    ),
    package: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
    ),
    radio: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 012.28-1.49"/><path d="M10.71 5.05A16 16 0 000.01 12"/><path d="M13.29 5.05A16 16 0 0124 12"/><circle cx="12" cy="12" r="2"/></svg>
    ),
    mic: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
    ),
    barChart: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    ),
    trendUp: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
    ),
    brain: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A5.5 5.5 0 005 5.5C5 7 5.5 8 6.5 9c-2 1.5-2.5 4-2 6 .5 1.5 2 3 4 3.5"/><path d="M14.5 2A5.5 5.5 0 0119 5.5c0 1.5-.5 2.5-1.5 3.5 2 1.5 2.5 4 2 6-.5 1.5-2 3-4 3.5"/><path d="M12 2v20"/><path d="M8 8c1.5 0 3 .5 4 2 1-1.5 2.5-2 4-2"/><path d="M8 14c1.5 0 3 .5 4 2 1-1.5 2.5-2 4-2"/></svg>
    ),
    lock: (size = 18, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    ),
    zap: (size = 18, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    ),
    server: (size = 18, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
    ),
    shield: (size = 18, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    ),
    menu: (size = 24, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    ),
    check: (size = 16, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    ),
    refresh: (size = 16, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
    ),
    clock: (size = 18, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    ),
    alertCircle: (size = 14, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    ),
    link2: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    ),
    eye: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    ),
  };

  return (
    <div className="min-h-screen font-outfit" style={{ background: 'var(--deep)', color: 'var(--text-primary)' }}>

      {/* ═══ SECTION 1: PRE-LAUNCH BANNER ═══ */}
      <div
        style={{
          background: 'linear-gradient(90deg, rgba(56,232,200,0.16), rgba(76,201,240,0.16))',
          borderBottom: '1px solid rgba(56,232,200,0.3)',
          padding: '0.55rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.82rem',
          fontWeight: 500,
          letterSpacing: '0.2px',
          lineHeight: 1.4,
        }}
      >
        <strong style={{ color: 'var(--teal)', fontWeight: 700 }}>Private launch &middot; Summer 2026.</strong>{' '}
        Try the live demo today; paid signups open after our German company registration completes.
      </div>

      {/* ═══ NAVIGATION ═══ */}
      <nav
        className="sticky top-0 left-0 right-0 z-[100] py-4"
        style={{
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          background: 'rgba(6, 9, 15, 0.8)',
          borderBottom: `1px solid ${scrolled ? 'rgba(56, 232, 200, 0.08)' : 'rgba(122, 136, 168, 0.12)'}`,
          transition: 'all 0.3s ease',
        }}
      >
        <div className="max-w-[1140px] mx-auto px-6 flex items-center justify-between">
          <a href="#" className="flex items-center gap-[10px] no-underline">
            <img src="/icon.png" alt="Aurora Logo" style={{ width: 32, height: 32, borderRadius: '50%', boxShadow: '0 0 8px rgba(0, 229, 255, 0.4)' }} />
            <span className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
              ClientPulse
            </span>
          </a>

          <ul className="hidden md:flex items-center gap-8 list-none">
            <li>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="bg-transparent border-none text-sm font-medium tracking-wide transition-colors cursor-pointer"
                style={{ color: 'var(--color-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
              >
                How It Works
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollToSection('pricing')}
                className="bg-transparent border-none text-sm font-medium tracking-wide transition-colors cursor-pointer"
                style={{ color: 'var(--color-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
              >
                Pricing
              </button>
            </li>
            <li>
              <a
                href="/auth/login"
                className="bg-transparent border-none text-sm font-medium tracking-wide transition-colors cursor-pointer no-underline"
                style={{ color: 'var(--color-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
              >
                Sign in
              </a>
            </li>
            <li>
              <a
                href="/api/demo/signin"
                className="py-[10px] px-6 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none inline-block no-underline"
                style={{ background: 'var(--teal)', color: 'var(--deep)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#50f0d4';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(56, 232, 200, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--teal)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Try the demo
              </a>
            </li>
          </ul>

          <button
            className="md:hidden bg-transparent border-none cursor-pointer flex items-center justify-center"
            style={{ color: 'var(--text-primary)' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {Icon.menu(24, 'var(--text-primary)')}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-6 pb-4 flex flex-col gap-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button onClick={() => { scrollToSection('how-it-works'); setMobileMenuOpen(false); }} className="text-left bg-transparent border-none text-sm cursor-pointer py-2" style={{ color: 'var(--color-muted)' }}>How It Works</button>
            <button onClick={() => { scrollToSection('pricing'); setMobileMenuOpen(false); }} className="text-left bg-transparent border-none text-sm cursor-pointer py-2" style={{ color: 'var(--color-muted)' }}>Pricing</button>
            <a href="/auth/login" className="text-sm no-underline py-2" style={{ color: 'var(--color-muted)' }}>Sign in</a>
            <a href="/api/demo/signin" className="text-sm font-semibold no-underline py-2 px-4 rounded-lg text-center" style={{ background: 'var(--teal)', color: 'var(--deep)' }}>Try the demo</a>
          </div>
        )}
      </nav>

      {/* ═══ SECTION 3: HERO ═══ */}
      <section className="pt-[180px] pb-[120px] text-center relative overflow-hidden">
        {/* Glow effect */}
        <div
          className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(56, 232, 200, 0.08) 0%, rgba(76, 201, 240, 0.04) 40%, transparent 70%)',
            animation: 'pulse-glow 8s ease-in-out infinite',
          }}
        />
        <div className="max-w-[1140px] mx-auto px-6 relative">
          <div
            className="inline-flex items-center gap-2 py-2 px-5 rounded-full text-[13px] font-medium mb-8 tracking-wide"
            style={{
              background: 'var(--teal-subtle)',
              border: '1px solid var(--border-teal)',
              color: 'var(--teal)',
            }}
          >
            <span
              className="w-[6px] h-[6px] rounded-full inline-block"
              style={{ background: 'var(--teal)', animation: 'dot-pulse 2s ease-in-out infinite' }}
            />
            Private launch &middot; Summer 2026
          </div>

          {/* Closed-loop secondary line — spec section 3 */}
          <p
            className="mx-auto mb-4 max-w-[640px] text-[15px] font-medium"
            style={{ color: 'var(--color-muted)', letterSpacing: '0.01em' }}
          >
            Most AI client-retention products surface counts. ClientPulse explains them.
          </p>

          <h1
            className="font-playfair font-bold leading-[1.1] mb-6 mx-auto max-w-[800px] tracking-tight"
            style={{ fontSize: 'clamp(40px, 5.5vw, 68px)', letterSpacing: '-0.02em' }}
          >
            Know which clients are{' '}
            <span
              className="bg-clip-text"
              style={{
                background: 'var(--gradient-aurora)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              about to leave
            </span>{' '}
            before they tell you
          </h1>

          <p
            className="mx-auto mb-12 max-w-[600px] font-light"
            style={{
              fontSize: 'clamp(17px, 2vw, 20px)',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
            }}
          >
            Stripe + meeting + email + calendar + content velocity signals fused into one Health Score per client. Monday Brief tells you who needs attention and what to do. Predict churn 60 days early. MCP-native, agency-priced.
          </p>

          {/* Hero CTAs — spec section 8 */}
          <div className="flex justify-center gap-3 mb-5">
            <a
              href="/api/demo/signin"
              className="py-[14px] px-8 rounded-[10px] text-[15px] font-semibold cursor-pointer whitespace-nowrap transition-all border-none no-underline inline-block"
              style={{
                background: 'var(--teal)',
                color: 'var(--deep)',
                fontFamily: 'var(--font-outfit)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#50f0d4';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(56, 232, 200, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--teal)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Try the live demo &rarr;
            </a>
            <button
              onClick={() => scrollToSection('pricing')}
              className="py-[14px] px-8 rounded-[10px] text-[15px] font-semibold whitespace-nowrap transition-all inline-flex items-center border-none cursor-pointer"
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-outfit)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            >
              See pricing
            </button>
          </div>

          <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
            <strong style={{ color: 'var(--teal)', fontWeight: 600 }}>30% off Agency &amp; Suite</strong> &middot; early adopter pricing &middot; first 20 customers per tier
          </p>

          {/* Premium Dashboard Integration Preview */}
          <div className="relative mx-auto mt-16 max-w-[960px] reveal rounded-xl overflow-hidden border border-[rgba(56,232,200,0.2)] shadow-2xl shadow-[rgba(56,232,200,0.15)] bg-[#06090f]">
            {/* Browser Chrome */}
            <div className="flex items-center px-4 py-3 bg-[#0a0f1a] border-b border-[rgba(56,232,200,0.1)] gap-2">
              <div className="w-3 h-3 rounded-full bg-[#e74c3c]"></div>
              <div className="w-3 h-3 rounded-full bg-[#f0c84c]"></div>
              <div className="w-3 h-3 rounded-full bg-[#38e8c8]"></div>
            </div>
            {/* High-Fidelity DOM Mockup */}
            <div className="aspect-[16/9] w-full relative flex bg-[#0c1220] text-left overflow-hidden">
              {/* Sidebar */}
              <div className="w-48 shrink-0 border-r border-[rgba(56,232,200,0.08)] bg-[#0a0f1a] p-4 flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-[linear-gradient(135deg,#38e8c8,#4cc9f0)]" />
                  <div className="h-4 w-20 rounded bg-[rgba(232,236,245,0.1)]" />
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-full rounded bg-[rgba(56,232,200,0.15)]" />
                  <div className="h-3 w-3/4 rounded bg-[rgba(232,236,245,0.05)]" />
                  <div className="h-3 w-5/6 rounded bg-[rgba(232,236,245,0.05)]" />
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 flex flex-col bg-[#0c1220]">
                {/* Header */}
                <div className="h-14 border-b border-[rgba(232,236,245,0.06)] flex items-center px-6 justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-playfair text-lg font-bold text-white">Client Health Portfolio</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="h-6 w-20 rounded-md bg-[rgba(232,236,245,0.05)]" />
                    <div className="h-7 w-24 rounded-full bg-[#38e8c8]/10 border border-[#38e8c8]/30 flex items-center justify-center">
                      <span className="text-[10px] text-[#38e8c8] font-bold">Stripe Synced</span>
                    </div>
                  </div>
                </div>
                
                {/* Dashboard Area */}
                <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
                  {/* Top Stats */}
                  <div className="flex gap-4">
                    <div className="flex-1 rounded-xl bg-polar border border-[rgba(232,236,245,0.06)] p-4 flex flex-col justify-center">
                      <span className="text-xs text-[#7a88a8] mb-1">Avg Health Score</span>
                      <span className="font-playfair text-3xl font-bold text-[#38e8c8]">88</span>
                    </div>
                    <div className="flex-1 rounded-xl bg-polar border border-[rgba(232,236,245,0.06)] p-4 flex flex-col justify-center">
                      <span className="text-xs text-[#7a88a8] mb-1">Total ARR</span>
                      <span className="font-playfair text-3xl font-bold text-white">$4.2M</span>
                    </div>
                    <div className="flex-1 rounded-xl bg-[rgba(232,76,76,0.05)] border border-[rgba(232,76,76,0.2)] p-4 flex flex-col justify-center">
                      <span className="text-xs text-[#e74c3c] mb-1">Churn Risk</span>
                      <span className="font-playfair text-3xl font-bold text-white">$120k</span>
                    </div>
                  </div>

                  {/* Client List */}
                  <div className="flex-1 rounded-xl bg-polar border border-[rgba(232,236,245,0.06)] p-4 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-semibold text-white">Recent Signals</span>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {/* Row 1 */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[rgba(232,236,245,0.02)] border border-[rgba(232,236,245,0.04)]">
                        <div className="flex items-center gap-3 w-1/3">
                          <div className="w-8 h-8 rounded-full bg-[rgba(232,236,245,0.1)]" />
                          <div className="flex flex-col gap-1">
                            <div className="w-24 h-3 bg-white/80 rounded" />
                            <div className="w-16 h-2 bg-white/30 rounded" />
                          </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                          <div className="w-full max-w-[120px] h-2 bg-[rgba(232,236,245,0.1)] rounded-full overflow-hidden">
                            <div className="w-[94%] h-full bg-[#38e8c8]" />
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          <span className="rounded bg-[#38e8c8]/10 px-2 py-1 text-[10px] font-bold text-[#38e8c8]">Healthy</span>
                        </div>
                      </div>

                      {/* Row 2 - Risk */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[rgba(232,76,76,0.05)] border border-[rgba(232,76,76,0.2)]">
                        <div className="flex items-center gap-3 w-1/3">
                          <div className="w-8 h-8 rounded-full bg-[rgba(232,236,245,0.1)]" />
                          <div className="flex flex-col gap-1">
                            <div className="w-32 h-3 bg-white/80 rounded" />
                            <div className="w-20 h-2 bg-white/30 rounded" />
                          </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                          <div className="w-full max-w-[120px] h-2 bg-[rgba(232,236,245,0.1)] rounded-full overflow-hidden">
                            <div className="w-[42%] h-full bg-[#e74c3c]" />
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          <span className="rounded bg-[#e74c3c]/10 px-2 py-1 text-[10px] font-bold text-[#e74c3c]">At Risk</span>
                        </div>
                      </div>

                      {/* Row 3 */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[rgba(232,236,245,0.02)] border border-[rgba(232,236,245,0.04)] opacity-60">
                        <div className="flex items-center gap-3 w-1/3">
                          <div className="w-8 h-8 rounded-full bg-[rgba(232,236,245,0.1)]" />
                          <div className="flex flex-col gap-1">
                            <div className="w-20 h-3 bg-white/80 rounded" />
                            <div className="w-12 h-2 bg-white/30 rounded" />
                          </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                          <div className="w-full max-w-[120px] h-2 bg-[rgba(232,236,245,0.1)] rounded-full overflow-hidden">
                            <div className="w-[78%] h-full bg-[#f0c84c]" />
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          <span className="rounded bg-[#f0c84c]/10 px-2 py-1 text-[10px] font-bold text-[#f0c84c]">Stable</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ IMPACT STRIP ═══ */}
      <section
        className="py-[60px]"
        style={{
          borderTop: '1px solid var(--border-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--polar)',
        }}
      >
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {[
              { number: '$60K', label: 'Lost per year for every $5K/mo client that churns' },
              { number: '60 days', label: 'Earlier churn warning vs. gut feeling' },
              { number: '5 signals', label: 'Fused into one health score: financial, relationship, engagement, delivery, content velocity' },
            ].map((stat, i) => (
              <div key={i} className="reveal">
                <div
                  className="font-playfair text-[42px] font-bold leading-[1.2] bg-clip-text"
                  style={{
                    background: 'var(--gradient-aurora)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {stat.number}
                </div>
                <div className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE PROBLEM ═══ */}
      <section className="py-[120px] max-md:py-[80px]">
        <div className="max-w-[1140px] mx-auto px-6">
          <div
            className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4"
            style={{ color: 'var(--teal)' }}
          >
            The Problem
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-5"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            Client churn is the silent killer<br />of agency profitability
          </h2>
          <p className="reveal text-[17px] max-w-[640px] font-light leading-[1.7]" style={{ color: 'var(--text-secondary)' }}>
            By the time you know a client is unhappy, the decision to leave has already been made. There&apos;s no system that aggregates the early warning signals into one predictive view.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
            {[
              {
                iconEl: Icon.alertTriangle(22, '#e74c3c'),
                iconBg: 'rgba(231, 76, 60, 0.12)',
                title: 'Invisible warnings',
                desc: "Declining meeting sentiment, overdue payments, stakeholder disengagement — the signals are there, but they're spread across 6 different products. Nobody connects the dots until the client is already gone.",
              },
              {
                iconEl: Icon.grid(22, '#f0c84c'),
                iconBg: 'rgba(240, 200, 76, 0.12)',
                title: 'Spreadsheet blindness',
                desc: '"I think Client X might be unhappy" is how 90% of agencies track client health. Gut feeling doesn\'t scale, and it misses the patterns that data catches 60 days earlier.',
              },
              {
                iconEl: Icon.dollar(22, '#b388eb'),
                iconBg: 'rgba(179, 136, 235, 0.12)',
                title: '$60K per miss',
                desc: "A $5K/month client is $60K/year in recurring revenue. Agencies with 20 clients losing 3 per year? That’s $180K gone. Preventing even one saves more than a year of ClientPulse.",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="reveal p-[36px_32px] rounded-2xl transition-all hover:-translate-y-[2px]"
                style={{
                  background: 'var(--polar)',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: card.iconBg }}
                >
                  {card.iconEl}
                </div>
                <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>{card.title}</h3>
                <p className="text-[15px] leading-[1.65]" style={{ color: 'var(--color-muted)' }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4: SUITE CROSS-LINK — present-tense ═══ */}
      <section className="py-[80px]" style={{ background: 'var(--polar)', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal max-w-[800px] mx-auto rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, rgba(56,232,200,0.04), rgba(76,201,240,0.04))', border: '1px solid rgba(56,232,200,0.2)' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--teal)' }}>Agency Suite</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--teal)', color: 'var(--deep)' }}>Live</span>
            </div>
            <h3 className="font-playfair font-bold text-[22px] leading-[1.3] mb-3" style={{ color: 'var(--text-primary)' }}>
              The Agency Suite is live.
            </h3>
            <p className="text-[15px] font-light leading-[1.7]" style={{ color: 'var(--text-secondary)' }}>
              ContentPulse publishes content events (velocity, channel diversity, voice freshness, engagement delta). ClientPulse consumes them as a privileged signal alongside Stripe, meeting, email, and calendar data. Content velocity per client is a leading churn indicator no standalone CS product can offer &mdash; a 30-day head start on every retention risk.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="/api/demo/signin"
                className="text-sm font-semibold no-underline px-4 py-2 rounded-lg transition-all"
                style={{ background: 'var(--teal)', color: 'var(--deep)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#50f0d4'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal)'; }}
              >
                Try the demo &rarr;
              </a>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-sm font-semibold px-4 py-2 rounded-lg border-none cursor-pointer transition-all"
                style={{ background: 'rgba(56,232,200,0.08)', color: 'var(--teal)', border: '1px solid rgba(56,232,200,0.2)' }}
              >
                Suite pricing &darr;
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WORKFLOW (canonical 5-step rail) ═══ */}
      <section id="how-it-works" className="py-[120px] max-md:py-[80px] relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: '1100px', height: '1100px', background: 'radial-gradient(ellipse, rgba(56,232,200,0.05) 0%, transparent 60%)' }}
        />
        <div className="max-w-[1140px] mx-auto px-6 relative">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4 text-center" style={{ color: 'var(--teal)' }}>
            The Workflow
          </div>
          <h2
            className="reveal font-playfair font-semibold leading-[1.2] mb-5 text-center"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.02em' }}
          >
            One workflow. <span style={{ color: 'var(--teal)' }}>Five steps.</span>
          </h2>
          <p className="reveal text-[17px] max-w-[680px] font-light leading-[1.7] text-center mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Synchronize your data, analyze your client health, strategize the next move, execute it, and compound your retention success.
          </p>

          {/* Workflow rail — 5 nodes */}
          <div className="relative mt-16">
            <div
              aria-hidden="true"
              className="absolute hidden md:block"
              style={{
                top: '38px',
                left: '6%',
                right: '6%',
                height: '1px',
                background: 'linear-gradient(90deg, transparent 0%, var(--hairline-strong) 8%, var(--hairline-strong) 92%, transparent 100%)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '-10%',
                  height: '100%',
                  width: '22%',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(56,232,200,0.6) 50%, transparent 100%)',
                  animation: 'wfPulse 6s ease-in-out infinite',
                }}
              />
            </div>
            <div className="grid gap-10 md:grid-cols-5 md:gap-6">
              {[
                { num: '01', title: 'Synchronize', cue: 'wire it up', desc: 'Bring your data, voices, and clients in once.', cp: 'Stripe, calendar, email, transcripts' },
                { num: '02', title: 'Analyze', cue: 'look around', desc: "See where you stand — what’s healthy, what’s quiet, what’s at risk.", cp: 'Clients overview — health, signals, risk' },
                { num: '03', title: 'Strategize', cue: 'pick the play', desc: 'Get the next-best move ranked, with the why behind it.', cp: 'Monday Brief — ranked re-engage / upsell / save plays' },
                { num: '04', title: 'Execute', cue: 'execute', desc: 'Ship it — proposals, check-ins, follow-ups — without leaving the suite.', cp: 'Proposals, check-ins, follow-ups' },
                { num: '05', title: 'Compound', cue: 'compound', desc: 'Every outcome trains the next decision. The more you use it, the sharper it gets.', cp: 'Outcome feedback sharpens future Briefs' },
              ].map((node) => (
                <div key={node.num} className="reveal flex flex-col items-center text-center gap-3 px-2">
                  <div
                    className="flex items-center justify-center transition-all duration-300"
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '50%',
                      background: 'var(--deep)',
                      border: '1px solid var(--hairline-strong)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      color: 'var(--color-muted)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {node.num}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                    {node.title}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 400, color: 'var(--teal)', textTransform: 'lowercase', letterSpacing: '0.3px', opacity: 0.85 }}>
                    {node.cue}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--color-muted)', fontWeight: 300, lineHeight: 1.55, maxWidth: '180px' }}>
                    {node.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CP translation card */}
          <div className="reveal mx-auto mt-20 max-w-3xl rounded-2xl p-7" style={{ background: 'var(--deep)', border: '1px solid var(--hairline)', borderTop: '2px solid var(--teal)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--teal)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>
              In ClientPulse, that means
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--color-muted)', fontWeight: 300 }}>
              The same five steps, applied to client retention.
            </p>
            <dl className="grid gap-2" style={{ gridTemplateColumns: 'max-content 1fr', columnGap: '1rem' }}>
              {[
                { num: '01', title: 'Synchronize', cp: 'Stripe, calendar, email, transcripts' },
                { num: '02', title: 'Analyze', cp: 'Clients overview — health, signals, risk' },
                { num: '03', title: 'Strategize', cp: 'Monday Brief — ranked re-engage / upsell / save plays' },
                { num: '04', title: 'Execute', cp: 'Proposals, check-ins, follow-ups' },
                { num: '05', title: 'Compound', cp: 'Outcome feedback sharpens future Briefs' },
              ].map((row) => (
                <div key={row.num} className="contents">
                  <dt style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '0.1rem' }}>
                    {row.num} {row.title}
                  </dt>
                  <dd style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{row.cp}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ═══ HEALTH SCORE BREAKDOWN ═══ */}
      <section id="health-score" className="py-[120px] max-md:py-[80px]" style={{ background: 'var(--polar)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4 text-center" style={{ color: 'var(--teal)' }}>
            The Core Product
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-5 text-center"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            Five signals. One score.<br />No blind spots.
          </h2>
          <p className="reveal text-[17px] max-w-[640px] font-light leading-[1.7] text-center mx-auto" style={{ color: 'var(--text-secondary)' }}>
            No single data source predicts churn. ClientPulse fuses five signal categories into one composite Health Score (0&ndash;100) that gives you the full picture.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mt-14">
            <div className="flex flex-col gap-5">
              {[
                { weight: '30%', iconEl: Icon.dollar(18, 'var(--teal)'), title: 'Financial Health', desc: 'Payment timeliness, invoice disputes, contract value trends, revenue concentration risk. Powered by Stripe.' },
                { weight: '25%', iconEl: Icon.handshake(18, 'var(--teal)'), title: 'Relationship Health', desc: 'Meeting sentiment trends, stakeholder engagement (are decision-makers still showing up?), communication responsiveness.' },
                { weight: '20%', iconEl: Icon.radio(18, 'var(--teal)'), title: 'Engagement Health', desc: 'Meeting frequency trends, email volume patterns, response time changes — the subtle signals that precede churn.' },
                { weight: '15%', iconEl: Icon.refresh(18, 'var(--teal)'), title: 'Content Velocity', desc: 'When you also run ContentPulse, content velocity per client flows in automatically. A 30-day early warning signal no standalone CS product can offer.' },
                { weight: '10%', iconEl: Icon.package(18, 'var(--teal)'), title: 'Delivery Health', desc: 'Scope creep signals, action items completed vs. overdue, deliverable cadence and quality indicators.' },
              ].map((signal, i) => (
                <div
                  key={i}
                  className="reveal flex items-center gap-4 p-5 rounded-xl transition-all"
                  style={{
                    background: 'var(--twilight)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <div className="font-playfair text-[28px] font-bold min-w-[64px]" style={{ color: 'var(--teal)' }}>
                    {signal.weight}
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold mb-1 flex items-center gap-2">{signal.iconEl} {signal.title}</h4>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>{signal.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Score Circle */}
            <div className="reveal flex flex-col items-center justify-center">
              <div
                className="w-[220px] h-[220px] rounded-full flex items-center justify-center relative"
                style={{ background: 'conic-gradient(var(--teal) 0deg, var(--teal) 280deg, var(--color-surface-light) 280deg)' }}
              >
                <div
                  className="w-[180px] h-[180px] rounded-full flex flex-col items-center justify-center"
                  style={{ background: 'var(--polar)' }}
                >
                  <div
                    className="font-playfair text-[56px] font-bold leading-none bg-clip-text"
                    style={{
                      background: 'var(--gradient-aurora)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    78
                  </div>
                  <div className="text-[13px] font-medium mt-1" style={{ color: 'var(--color-muted)' }}>
                    Health Score
                  </div>
                </div>
              </div>
              <div
                className="mt-4 py-2 px-5 rounded-full text-[13px] font-semibold"
                style={{
                  background: 'rgba(56, 232, 200, 0.1)',
                  border: '1px solid rgba(56, 232, 200, 0.2)',
                  color: 'var(--teal)',
                }}
              >
                Healthy &mdash; Low Risk
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 5: MCP POSITIONING ═══ */}
      <section id="mcp" className="py-[120px] max-md:py-[80px]">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4 text-center" style={{ color: 'var(--teal)' }}>
            Built into your stack
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-5 text-center"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            Drive ClientPulse from your IDE.<br />
            <span
              className="bg-clip-text"
              style={{
                background: 'var(--gradient-aurora)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Agency-priced, MCP-native.
            </span>
          </h2>
          <p className="reveal text-[17px] max-w-[680px] font-light leading-[1.7] text-center mx-auto mb-14" style={{ color: 'var(--text-secondary)' }}>
            Check a client&apos;s Health Score, pull Monday Brief summaries, or trigger a re-engage proposal &mdash; from Claude Desktop, Cursor, or VS Code, without opening a browser tab.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: 'Per-client signal fusion',
                desc: 'Single-product CS platforms (Vitally, ChurnZero, Planhat) live in B2B SaaS land — they bill from $1,250/mo+ and assume product-usage signals you don’t have. ClientPulse fuses Stripe, meeting recordings, email patterns, calendar attendance, and content velocity for the actual buying motion of an agency: retainer relationships.',
              },
              {
                label: 'Closed loop with ContentPulse',
                desc: 'When you also run ContentPulse, the content velocity signal flows in automatically. The Agency Suite is the only place a content product and a retention product talk to each other — that’s why it’s $999/mo, not a bundle discount.',
              },
              {
                label: 'Agency-priced MCP',
                desc: 'Drive ClientPulse from Claude Desktop, Cursor, or VS Code via MCP. Vitally and ChurnZero don’t ship MCP at all. Aurora $799 CP Agency / $999 Suite is the only sub-$1K MCP-native client-health product.',
              },
            ].map((card, i) => (
              <div
                key={i}
                className="reveal rounded-2xl p-7"
                style={{
                  background: 'var(--polar)',
                  border: '1px solid rgba(76,201,240,0.08)',
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>
                  {card.label}
                </p>
                <p className="text-[14px] leading-[1.65]" style={{ color: 'var(--color-muted)', fontWeight: 300 }}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 6: FOR AGENCIES, NOT B2B SAAS CS TEAMS ═══ */}
      <section className="py-[80px]" style={{ background: 'var(--polar)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div
            className="reveal max-w-[820px] mx-auto rounded-2xl p-8"
            style={{
              background: 'linear-gradient(135deg, rgba(56,232,200,0.03), rgba(76,201,240,0.03))',
              border: '1px solid rgba(76,201,240,0.12)',
              borderLeft: '4px solid var(--teal)',
            }}
          >
            <h3 className="font-playfair font-bold text-[20px] leading-[1.3] mb-4" style={{ color: 'var(--text-primary)' }}>
              For agencies. Not B2B SaaS customer success teams.
            </h3>
            <p className="text-[15px] font-light leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>
              Vitally / ChurnZero / Planhat are built for product-usage signals (logins, feature adoption, NPS surveys). Agencies don&apos;t have those. We&apos;re built for retainer relationships: payment patterns, meeting attendance, email response cadence, and content velocity. The signals that actually predict whether your retainer renews.
            </p>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Vitally / ChurnZero', note: '$1,250+/mo · product-usage signals · B2B SaaS ICP' },
                { label: 'Planhat', note: '$500+/mo · usage analytics · SaaS-native' },
                { label: 'ClientPulse Agency', note: '$799/mo · retainer signals · agency-native · MCP-native' },
              ].map((row, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl"
                  style={{
                    background: i === 2 ? 'rgba(56,232,200,0.06)' : 'rgba(255,255,255,0.02)',
                    border: i === 2 ? '1px solid rgba(56,232,200,0.2)' : '1px solid var(--border-subtle)',
                  }}
                >
                  <p className="text-[13px] font-semibold mb-1" style={{ color: i === 2 ? 'var(--teal)' : 'var(--text-primary)' }}>{row.label}</p>
                  <p className="text-[12px]" style={{ color: 'var(--color-muted)' }}>{row.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MONDAY BRIEF ═══ */}
      <section className="py-[120px] max-md:py-[80px]">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--teal)' }}>
            The Killer Feature
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-5"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            The Monday Brief that replaces<br />your client spreadsheet
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mt-14">
            <div className="reveal">
              <h3 className="font-playfair text-[28px] font-bold mb-5 leading-[1.3]">
                Agency owners don&apos;t log into dashboards. They read emails.
              </h3>
              <p className="text-base font-light leading-[1.7] mb-4" style={{ color: 'var(--text-secondary)' }}>
                Every Monday morning, ClientPulse sends you one email with everything you need to know: which clients are thriving, which are slipping, and exactly what to do about it.
              </p>
              <p className="text-base font-light leading-[1.7] mb-4" style={{ color: 'var(--text-secondary)' }}>
                It&apos;s not a status report. It&apos;s an action plan &mdash; with draft check-in emails, QBR suggestions, and upsell opportunities already prepared for your review.
              </p>
              <div
                className="py-4 px-5 rounded-r-lg mt-6 text-[15px] italic"
                style={{
                  background: 'var(--teal-subtle)',
                  borderLeft: '3px solid var(--teal)',
                  color: 'var(--text-primary)',
                }}
              >
                &ldquo;3 clients healthy, 1 at risk, 1 critical. Here are 3 actions I&apos;ve prepared for your approval.&rdquo;
              </div>
            </div>

            {/* Mock Email */}
            <div
              className="reveal rounded-2xl overflow-hidden"
              style={{ background: 'var(--twilight)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="p-5 flex flex-col gap-[6px]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  From: ClientPulse &lt;brief@clientpulse.helloaurora.ai&gt;
                </div>
                <div className="text-[15px] font-semibold">
                  Your Monday Brief &mdash; Apr 14: 1 client needs attention
                </div>
              </div>
              <div className="p-6">
                <p className="text-[13px] mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Good morning, Sasa. Here&apos;s your portfolio snapshot for the week:
                </p>
                {[
                  { color: 'var(--teal)', name: 'Acme Creative', detail: '— Score 89 ↑ Invoice paid early. Meeting sentiment positive.' },
                  { color: 'var(--teal)', name: 'Stellar Digital', detail: '— Score 84 → Stable. All deliverables on track.' },
                  { color: 'var(--contentpulse-gold)', name: 'BrightVista', detail: '— Score 62 ↓ Meeting cancellation. Check in this week.' },
                  { color: 'var(--pulse-red)', name: 'NexGen', detail: '', special: true },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-[10px] p-[10px_14px] rounded-lg mb-2 text-[13px]"
                    style={{ background: 'var(--color-surface-light)' }}
                  >
                    <span className="w-2 h-2 rounded-full min-w-[8px]" style={{ background: item.color }} />
                    <span>
                      <strong>{item.name}</strong>{' '}
                      {item.special ? (
                        <>— Score 34 ↓↓ <strong style={{ color: 'var(--pulse-red)' }}>73% churn risk.</strong> Action plan ready &rarr;</>
                      ) : (
                        item.detail
                      )}
                    </span>
                  </div>
                ))}
                <p
                  className="mt-3 p-3 rounded-lg text-[13px]"
                  style={{ background: 'rgba(56, 232, 200, 0.06)' }}
                >
                  <strong style={{ color: 'var(--teal)' }}>Prepared action:</strong> Draft check-in email for NexGen &mdash; addresses the invoice delay, proposes a QBR next week.{' '}
                  <a href="#" style={{ color: 'var(--teal)' }}>Review &amp; send &rarr;</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES / 6 AGENTS ═══ */}
      <section id="features" className="py-[120px] max-md:py-[80px]" style={{ background: 'var(--polar)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4 text-center" style={{ color: 'var(--teal)' }}>
            Six AI Agents Working For You
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-5 text-center"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            Intelligence that acts,<br />not just reports
          </h2>
          <p className="reveal text-[17px] max-w-[640px] font-light leading-[1.7] text-center mx-auto" style={{ color: 'var(--text-secondary)' }}>
            ClientPulse isn&apos;t a dashboard. It&apos;s six specialized AI agents that monitor, predict, and prepare actions &mdash; so you make better decisions without the busywork.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
            {[
              { iconEl: Icon.dollar(24, 'var(--teal)'), iconBg: 'rgba(56, 232, 200, 0.08)', title: 'Financial Signal Agent', desc: 'Monitors Stripe invoicing data. Detects payment delays, disputes, contract value changes, and revenue concentration risk. Alerts on anomalies.' },
              { iconEl: Icon.mic(24, 'var(--aurora-blue)'), iconBg: 'rgba(76, 201, 240, 0.08)', title: 'Meeting Intelligence Agent', desc: 'Processes meeting recordings via Whisper + Claude. Extracts sentiment, action items, scope changes, and stakeholder engagement signals.' },
              { iconEl: Icon.barChart(24, 'var(--teal)'), iconBg: 'rgba(56, 232, 200, 0.08)', title: 'Health Scoring Agent', desc: 'Computes the composite Client Health Score (0–100) from all signal categories. Updates as new data arrives. Self-calibrates on actual outcomes.' },
              { iconEl: Icon.alertTriangle(24, 'var(--contentpulse-gold)'), iconBg: 'rgba(240, 200, 76, 0.08)', title: 'Churn Prediction Agent', desc: 'Pattern-matches across all clients to predict churn probability. Alerts 60 days before predicted churn. Explains the driving factors behind each prediction.' },
              { iconEl: Icon.trendUp(24, 'var(--aurora-purple)'), iconBg: 'rgba(179, 136, 235, 0.08)', title: 'Upsell Detection Agent', desc: 'Analyzes meeting transcripts for expansion signals. Flags when clients mention needs outside their current package. Surfaces revenue growth opportunities.' },
              { iconEl: Icon.brain(24, 'var(--aurora-pink)'), iconBg: 'rgba(232, 127, 165, 0.08)', title: 'Recursive Learning Engine', desc: 'Every client renewal or churn trains the model. After 50+ clients, predictions calibrate to YOUR agency\'s patterns. The moat that grows over time.' },
            ].map((agent, i) => (
              <div
                key={i}
                className="reveal p-[36px_32px] rounded-2xl transition-all hover:-translate-y-[2px]"
                style={{
                  background: 'var(--twilight)',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: agent.iconBg }}>
                  {agent.iconEl}
                </div>
                <h3 className="text-[17px] font-semibold mb-[10px]" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {agent.title}
                </h3>
                <p className="text-sm leading-[1.65]" style={{ color: 'var(--color-muted)' }}>{agent.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TRUST BAR ═══ */}
      <section className="py-12" style={{ background: 'var(--polar)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal flex items-center justify-center gap-12 flex-wrap max-md:gap-6">
            {[
              { iconEl: Icon.lock(18, 'var(--teal)'), text: '256-bit encryption' },
              { iconEl: Icon.shield(18, 'var(--teal)'), text: 'EU Frankfurt · GDPR compliant' },
              { iconEl: Icon.zap(18, 'var(--teal)'), text: 'Your data never trains our AI' },
              { iconEl: Icon.server(18, 'var(--teal)'), text: 'Built on Stripe, Supabase &amp; Anthropic' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-[10px]">
                <span className="flex items-center justify-center">{item.iconEl}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-muted)' }} dangerouslySetInnerHTML={{ __html: item.text }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ROI ═══ */}
      <section className="py-[120px] max-md:py-[80px]" style={{ background: 'var(--polar)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4 text-center" style={{ color: 'var(--teal)' }}>
            The ROI Is Simple
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] text-center"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            Save one client. Pay for a year.
          </h2>

          <div
            className="reveal max-w-[720px] mx-auto mt-12 p-12 rounded-[20px] text-center relative overflow-hidden"
            style={{
              background: 'var(--twilight)',
              border: '1px solid var(--border-teal)',
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'var(--gradient-aurora)' }} />

            <p className="text-[15px] leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
              Your agency has <strong style={{ color: 'var(--text-primary)' }}>15 clients</strong> at an average{' '}
              <strong style={{ color: 'var(--text-primary)' }}>$5,000/month</strong> retainer. Historically, you lose{' '}
              <strong style={{ color: 'var(--text-primary)' }}>3 per year</strong>. That&apos;s{' '}
              <strong style={{ color: 'var(--text-primary)' }}>$180,000 in annual revenue gone.</strong>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center mb-8">
              <div className="p-6 rounded-xl" style={{ background: 'var(--color-surface-light)' }}>
                <div className="font-playfair text-4xl font-bold leading-[1.2]" style={{ color: 'var(--pulse-red)' }}>$60,000</div>
                <div className="text-[13px] mt-[6px]" style={{ color: 'var(--color-muted)' }}>Cost of one churned client per year</div>
              </div>
              <div className="font-playfair text-2xl hidden md:block" style={{ color: 'var(--text-dim)' }}>vs.</div>
              <div className="p-6 rounded-xl" style={{ background: 'var(--color-surface-light)' }}>
                <div className="font-playfair text-4xl font-bold leading-[1.2]" style={{ color: 'var(--teal)' }}>$1,990</div>
                <div className="text-[13px] mt-[6px]" style={{ color: 'var(--color-muted)' }}>ClientPulse Pro &mdash; $199/mo, billed annually (2 months free)</div>
              </div>
            </div>

            <p className="text-lg font-semibold" style={{ color: 'var(--teal)' }}>
              Prevent one churn = <span className="font-playfair text-[28px]">25&times; ROI</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 9: MID-PAGE EA PROMO BLOCK ═══ */}
      <div
        className="reveal py-[60px] text-center relative"
        style={{
          background: 'linear-gradient(180deg, var(--deep), var(--polar))',
          borderTop: '1px solid var(--border-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-[800px] mx-auto px-6 relative z-[1]">
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-2 rounded-full mb-5"
            style={{ color: 'var(--teal)', background: 'rgba(56,232,200,0.08)', border: '1px solid rgba(56,232,200,0.2)' }}
          >
            First 20 customers &middot; Agency + Suite only
          </span>
          <h3 className="font-playfair font-bold text-[24px] leading-[1.3] mb-3" style={{ color: 'var(--text-primary)' }}>
            30% off for 12 months. Twenty seats per tier.
          </h3>
          <p className="text-[15px] font-light leading-[1.7] mb-6" style={{ color: 'var(--text-secondary)' }}>
            Redeem at checkout with{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85em', background: 'rgba(56,232,200,0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: 'var(--teal)' }}>EA-CP-AGENCY-30</code>{' '}
            or{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85em', background: 'rgba(56,232,200,0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: 'var(--teal)' }}>EA-SUITE-30</code>.{' '}
            Stripe enforces the cap automatically.
          </p>
          <div className="flex justify-center gap-3">
            <a
              href="/api/demo/signin"
              className="py-[14px] px-8 rounded-[10px] text-[14px] font-semibold no-underline transition-all inline-block"
              style={{ background: 'var(--teal)', color: 'var(--deep)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#50f0d4'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Try the demo &rarr;
            </a>
            <button
              onClick={() => scrollToSection('pricing')}
              className="py-[14px] px-8 rounded-[10px] text-[14px] font-semibold border-none cursor-pointer transition-all"
              style={{ background: 'rgba(56,232,200,0.08)', color: 'var(--teal)', border: '1px solid rgba(56,232,200,0.2)' }}
            >
              See pricing &darr;
            </button>
          </div>
        </div>
      </div>

      {/* ═══ SECTION 7: PRICING ═══ */}
      <section id="pricing" className="py-[120px] max-md:py-[80px]">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4 text-center" style={{ color: 'var(--teal)' }}>
            Pricing
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-5 text-center"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            Plans that pay for themselves
          </h2>
          <p className="reveal text-[17px] max-w-[640px] font-light leading-[1.7] text-center mx-auto" style={{ color: 'var(--text-secondary)' }}>
            From ${STRIPE_PLANS.solo.price}/mo. Cancel anytime.{' '}
            <strong style={{ color: 'var(--teal)' }}>Early Adopter: 30% off first year on Agency + Suite &mdash; first 20 customers per tier.</strong>
          </p>

          {/* Annual toggle */}
          <div className="flex items-center justify-center gap-4 my-10">
            <span className="text-sm font-medium" style={{ color: isAnnual ? 'var(--color-muted)' : 'var(--text-primary)' }}>Monthly</span>
            <button
              className="w-12 h-[26px] rounded-[13px] relative cursor-pointer transition-all border-none"
              style={{
                background: isAnnual ? 'var(--teal)' : 'var(--color-surface-light)',
                border: isAnnual ? '1px solid var(--teal)' : '1px solid var(--border-subtle)',
              }}
              onClick={() => setIsAnnual(!isAnnual)}
            >
              <span
                className="absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full transition-transform"
                style={{
                  background: isAnnual ? 'var(--deep)' : 'var(--text-primary)',
                  transform: isAnnual ? 'translateX(22px)' : 'translateX(0)',
                }}
              />
            </button>
            <span className="text-sm font-medium" style={{ color: isAnnual ? 'var(--text-primary)' : 'var(--color-muted)' }}>Annual</span>
            <span
              className="text-xs font-semibold py-1 px-[10px] rounded-full"
              style={{ color: 'var(--teal)', background: 'var(--teal-subtle)' }}
            >
              2 months free
            </span>
          </div>

          {/* Section 6 callout near Agency tier */}
          <div
            className="reveal mb-8 p-4 rounded-xl text-center text-[13px]"
            style={{ background: 'rgba(56,232,200,0.04)', border: '1px solid rgba(56,232,200,0.12)' }}
          >
            <strong style={{ color: 'var(--teal)' }}>For agencies. Not B2B SaaS CS teams.</strong>{' '}
            <span style={{ color: 'var(--color-muted)' }}>Built for retainer relationships &mdash; payment patterns, meeting attendance, email cadence, content velocity.</span>
          </div>

          {/* Price Cards: Solo · Solo+ · Pro · Agency */}
          <div className="reveal grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>

            {/* Solo */}
            <div
              className="p-[32px_24px] rounded-[20px] relative transition-all hover:-translate-y-[2px]"
              style={{ background: 'var(--polar)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            >
              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-muted)' }}>Solo</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>$</span>
                <span className="font-playfair text-5xl font-bold leading-none">{isAnnual ? prices[0].annual : prices[0].monthly}</span>
                <span className="text-[15px]" style={{ color: 'var(--text-dim)' }}>/mo</span>
              </div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--teal)' }}>
                {isAnnual ? 'billed annually' : `$${prices[0].annual}/mo billed annually`}
              </div>
              <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                For freelancers and solo consultants with a focused book of key accounts.
              </p>
              <ul className="flex flex-col gap-2 mb-6 list-none">
                {['Up to 3 clients', 'Daily health refresh', 'Stripe financial sync', 'Client Health Scores', 'Monday Client Brief', '90-day data retention', '1 seat', 'Email support'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="mt-0.5 flex-shrink-0">{Icon.check(14, 'var(--teal)')}</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/api/demo/signin"
                className="block w-full py-[12px] text-center rounded-[10px] text-[14px] font-semibold no-underline transition-all"
                style={{ background: 'var(--color-surface-light)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-teal)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              >
                Try the demo &rarr;
              </a>
            </div>

            {/* Solo+ */}
            <div
              className="p-[32px_24px] rounded-[20px] relative transition-all hover:-translate-y-[2px]"
              style={{ background: 'var(--polar)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            >
              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-muted)' }}>Solo+</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>$</span>
                <span className="font-playfair text-5xl font-bold leading-none">{isAnnual ? SOLO_PLUS_ANNUAL_MONTHLY : SOLO_PLUS_MONTHLY}</span>
                <span className="text-[15px]" style={{ color: 'var(--text-dim)' }}>/mo</span>
              </div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--teal)' }}>
                {isAnnual ? 'billed annually ($990/yr)' : `$${SOLO_PLUS_ANNUAL_MONTHLY}/mo billed annually`}
              </div>
              <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                For solo consultants growing past 5 retained clients.
              </p>
              <ul className="flex flex-col gap-2 mb-6 list-none">
                {[
                  '7 clients tracked',
                  'Hourly health refresh',
                  'Stripe + Calendar integration',
                  '12-month data retention',
                  '1 seat',
                  'All models (Claude, GPT, Gemini)',
                  'Recursive learning insights',
                  'Read-only API · 3 MCP connections',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="mt-0.5 flex-shrink-0">{Icon.check(14, 'var(--teal)')}</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/api/demo/signin"
                className="block w-full py-[12px] text-center rounded-[10px] text-[14px] font-semibold no-underline transition-all"
                style={{ background: 'var(--color-surface-light)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-teal)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              >
                Try the demo &rarr;
              </a>
            </div>

            {/* Pro */}
            <div
              className="p-[32px_24px] rounded-[20px] relative transition-all hover:-translate-y-[2px]"
              style={{ background: 'var(--polar)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            >
              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-muted)' }}>Pro</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>$</span>
                <span className="font-playfair text-5xl font-bold leading-none">{isAnnual ? prices[1].annual : prices[1].monthly}</span>
                <span className="text-[15px]" style={{ color: 'var(--text-dim)' }}>/mo</span>
              </div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--teal)' }}>
                {isAnnual ? 'billed annually' : `$${prices[1].annual}/mo billed annually`}
              </div>
              <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                For growing agencies that can&apos;t afford to lose a single client.
              </p>
              <ul className="flex flex-col gap-2 mb-6 list-none">
                {['Up to 10 clients', 'Hourly health refresh', 'Churn Prediction + Upsell Detection', 'Action Proposal Engine', 'Meeting Intelligence (Zoom, Google Meet)', 'Calendar & email sentiment sync', '12-month data retention', '3 seats', '3 MCP connections', 'All models (Claude, GPT, Gemini)', 'Priority support'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="mt-0.5 flex-shrink-0">{Icon.check(14, 'var(--teal)')}</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/api/demo/signin"
                className="block w-full py-[12px] text-center rounded-[10px] text-[14px] font-semibold no-underline transition-all"
                style={{ background: 'var(--color-surface-light)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-teal)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              >
                Try the demo &rarr;
              </a>
            </div>

            {/* Agency */}
            <div
              className="p-[32px_24px] rounded-[20px] relative transition-all hover:-translate-y-[2px]"
              style={{
                background: 'linear-gradient(to bottom, rgba(56, 232, 200, 0.04), var(--polar))',
                border: '1px solid var(--teal)',
              }}
            >
              {/* Aurora gradient top bar + badge */}
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[20px]" style={{ background: 'var(--gradient-aurora)' }} />
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 py-1 px-4 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap"
                style={{ background: 'var(--teal)', color: 'var(--deep)' }}
              >
                Most Popular
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-2 mt-2" style={{ color: 'var(--teal)' }}>Agency</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>$</span>
                <span className="font-playfair text-5xl font-bold leading-none">{isAnnual ? prices[2].annual : prices[2].monthly}</span>
                <span className="text-[15px]" style={{ color: 'var(--text-dim)' }}>/mo</span>
              </div>
              <div className="text-[13px] mb-1" style={{ color: 'var(--teal)' }}>
                {isAnnual ? 'billed annually · 30% off first year (EA)' : `$${prices[2].annual}/mo billed annually`}
              </div>
              <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                For established agencies treating client retention as a competitive advantage.
              </p>
              <ul className="flex flex-col gap-2 mb-6 list-none">
                {['Unlimited clients', 'Real-time health refresh', 'Team dashboard · 8 seats', 'White-label PDF reports', 'Recursive Learning insights', 'Slack bot integration', 'Full API · unlimited MCP', '36-month data retention', 'On-device (post-launch)', 'Dedicated onboarding'].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="mt-0.5 flex-shrink-0">{Icon.check(14, 'var(--teal)')}</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/api/demo/signin"
                className="block w-full py-[12px] text-center rounded-[10px] text-[14px] font-semibold no-underline transition-all"
                style={{ background: 'var(--teal)', color: 'var(--deep)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#50f0d4'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(56, 232, 200, 0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                Try the demo &rarr;
              </a>
            </div>
          </div>

          {/* Agency Suite */}
          <div className="reveal mt-14 max-w-[1140px] mx-auto relative overflow-hidden rounded-2xl p-8 max-md:p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(56, 232, 200, 0.06), rgba(56, 232, 200, 0.02) 60%), var(--polar)',
              border: '1px solid rgba(56, 232, 200, 0.25)',
            }}
          >
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'var(--teal)', color: 'var(--deep)' }}>
                    Agency Suite
                  </span>
                  <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'rgba(56, 232, 200, 0.15)', color: 'var(--teal)', border: '1px solid rgba(56, 232, 200, 0.3)' }}>
                    Early Adopter &middot; 30% off 1st year
                  </span>
                  <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'rgba(76,201,240,0.1)', color: 'var(--aurora-blue)', border: '1px solid rgba(76,201,240,0.2)' }}>
                    Live
                  </span>
                </div>
                <h3 className="mt-3 font-playfair text-[22px] font-bold leading-[1.3]" style={{ color: 'var(--text-primary)' }}>
                  ClientPulse Agency + ContentPulse Agency, talking to each other.
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Most agencies use a content product <em>and</em> a client-health product.
                  Ours talk to each other. Yours don&apos;t. Content velocity becomes a
                  leading churn indicator &mdash; a 30-day head start on every risk. That&apos;s why it&apos;s $999/mo, not a bundle discount.
                </p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    'Everything in both Agency plans',
                    'ContentPulse → ClientPulse content-velocity pipeline',
                    'Content velocity as a leading churn indicator',
                    'A 30-day head start on every churn risk',
                    '20 EA slots · 30% off first year',
                    'MCP-native · agency-priced',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--teal)' }}>&#x2713;</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col items-start md:items-end">
                <p>
                  <span className="font-playfair text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    ${isAnnual ? 832 : 999}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/mo</span>
                </p>
                {isAnnual && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Billed $9,984 &middot; <span style={{ color: 'var(--teal)' }}>2 months free</span>
                  </p>
                )}
                <a
                  href="/api/demo/signin"
                  className="mt-4 block rounded-[10px] px-8 py-3.5 text-center text-sm font-semibold transition-all no-underline"
                  style={{ background: 'var(--teal)', color: 'var(--deep)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#50f0d4';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(56, 232, 200, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--teal)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Try the demo &rarr;
                </a>
              </div>
            </div>
          </div>

          <p className="reveal text-center text-[12px] mt-6 opacity-60" style={{ color: 'var(--text-muted)' }}>
            All prices in USD. Annual plans get 2 months free (16.7% off). Early Adopter 30% discount applies to Agency + Suite only, first 20 per tier, Stripe-enforced.
          </p>
        </div>
      </section>

      {/* ═══ SECTION 10: FAQ ═══ */}
      <section className="py-[120px] max-md:py-[80px]" style={{ background: 'var(--polar)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4 text-center" style={{ color: 'var(--teal)' }}>
            Common Questions
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-5 text-center"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            Everything you need to know
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 max-w-[900px] mx-auto">
            {[
              {
                q: "What’s the Solo+ tier?",
                a: "Solo+ is the bridge between Solo (3 clients, daily refresh) and Pro (10 clients, full agent suite). At $99/mo you get 7 clients tracked, hourly health refresh, Stripe + Calendar integration, 12-month data retention, all models (Claude, GPT, Gemini), recursive learning insights, and 3 MCP connections. One seat. No advanced agents (Churn Prediction / Upsell Detection / Action Proposal) — those are Pro. Right tier if you’re a solo consultant growing past 5 retained clients.",
              },
              {
                q: 'What signals does the Health Score include?',
                a: 'Five categories: Financial Health (30%) — payment timeliness, invoice disputes, contract value trends via Stripe. Relationship Health (25%) — meeting sentiment, stakeholder engagement, communication responsiveness. Engagement Health (20%) — meeting frequency, email patterns, response time changes. Content Velocity (15%) — when you also run ContentPulse, content velocity per client flows in automatically. Delivery Health (10%) — scope creep, action items, deliverable cadence.',
              },
              {
                q: 'How is this different from Vitally, ChurnZero, Planhat?',
                a: 'Different ICP entirely. Vitally / ChurnZero / Planhat are built for B2B SaaS companies with product-usage signals (logins, feature adoption, NPS). They bill from $1,250/mo+ and assume you have usage telemetry. Agencies don’t have that. ClientPulse is built for retainer relationships: payment patterns, meeting attendance, email cadence, content velocity. Price floor is 1/2 to 1/6 of those platforms. MCP-native at agency price — Vitally and ChurnZero don’t ship MCP at all.',
              },
              {
                q: 'What integrations are supported?',
                a: 'At launch: Stripe (financial signals), Google Calendar (meeting attendance), Gmail (email pattern analysis), Zoom and Google Meet (meeting recordings for sentiment analysis). On the roadmap: QuickBooks, FreshBooks (for agencies not on Stripe). Content Velocity via ContentPulse is available when you’re on the Agency Suite.',
              },
              {
                q: 'How do I get started right now?',
                a: 'Try the live demo — auto-signs you in as a sandboxed user with realistic seed clients, Health Scores, and a Monday Brief preview. Poke around before committing anything. Paid signups open after our German company registration completes (Summer 2026). Drop your email below and we’ll send one note when paid signups open.',
              },
              {
                q: "What’s the EA discount?",
                a: '30% off for 12 months on the Agency tier or the full Agency Suite. First 20 customers per tier — Stripe enforces the cap automatically. Redeem at checkout with EA-CP-AGENCY-30 (CP Agency) or EA-SUITE-30 (Agency Suite). Solo, Solo+, and Pro are full price. Early Adopters get direct access to Sasa and influence over the roadmap.',
              },
              {
                q: 'Is my data safe?',
                a: 'All data stored in EU Frankfurt (Supabase), encrypted at rest and in transit (256-bit). Your data never trains our AI models — we use Anthropic’s Claude API with strict data processing agreements. Each agency’s data is fully isolated. GDPR compliant with full data retention controls and account deletion.',
              },
              {
                q: 'What if we cancel?',
                a: 'Export all your data at any time — client health reports, signal history, Monday Brief archives. No retention penalty, no lock-in. We’d rather earn your subscription every month than trap you. The intelligence compounds with use, so the longer you stay, the more valuable it gets — that’s the only switching cost that should matter.',
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="reveal p-7 rounded-[14px] transition-colors"
                style={{
                  background: 'var(--twilight)',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <h4 className="text-[15px] font-semibold mb-[10px] leading-[1.4]">{faq.q}</h4>
                <p className="text-sm leading-[1.65]" style={{ color: 'var(--color-muted)' }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CROSS-SELL BANNER ═══ */}
      <section className="py-[80px]" style={{ background: 'linear-gradient(to bottom, transparent, rgba(56, 232, 200, 0.02))' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="text-center">
            <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--contentpulse-gold)' }}>
              <span className="inline-flex items-center align-middle" style={{ marginRight: '8px' }}>{Icon.refresh(16, 'var(--contentpulse-gold)')}</span>
              Also from Aurora
            </div>
            <h3 className="reveal font-playfair font-bold leading-[1.2] mb-4" style={{ fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-0.01em' }}>
              Creating content for clients?<br />Meet <a href="https://contentpulse.helloaurora.ai" className="no-underline" style={{ color: 'var(--teal)' }}>ContentPulse</a>.
            </h3>
            <p className="reveal text-base font-light leading-[1.7] max-w-[680px] mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
              ClientPulse tells you which clients need attention. ContentPulse helps you deliver the content that keeps them happy. Same workflow. Same agency focus. Built to work together &mdash; and when they do, content velocity becomes your earliest churn signal.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 11: BOTTOM CTA — notify me ═══ */}
      <section id="waitlist" className="py-[120px] max-md:py-[80px] text-center relative" style={{ background: 'var(--polar)' }}>
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(56, 232, 200, 0.06) 0%, transparent 70%)' }}
        />
        <div className="max-w-[600px] mx-auto px-6 relative">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--teal)' }}>
            Stay in the loop
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-4"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
          >
            Notify me when paid signups open.
          </h2>
          <p className="reveal text-[17px] font-light leading-[1.7] mb-10" style={{ color: 'var(--text-secondary)' }}>
            Try the live demo today. Drop your email and we&apos;ll send one note when paid signups open in Summer 2026 &mdash; including the Early Adopter window for the first 20 customers per tier.
          </p>
          <p className="reveal text-[13px] mb-6" style={{ color: 'var(--color-muted)' }}>
            No drip nurture. One email. Unsubscribe is one click.
          </p>

          {!notifySubmitted ? (
            <form
              className="reveal flex gap-3 max-w-[440px] mx-auto"
              onSubmit={async (e) => {
                e.preventDefault();
                // Best-effort submission — non-blocking
                try {
                  await fetch('/api/waitlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: notifyEmail, source: 'clientpulse-landing-bottom' }),
                  });
                } catch { /* silent */ }
                setNotifySubmitted(true);
              }}
            >
              <input
                type="email"
                required
                placeholder="you@agency.com"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                className="flex-1 px-4 py-3 rounded-[10px] text-[14px] outline-none"
                style={{
                  background: 'var(--twilight)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              />
              <button
                type="submit"
                className="py-3 px-6 rounded-[10px] text-[14px] font-semibold border-none cursor-pointer transition-all"
                style={{ background: 'var(--teal)', color: 'var(--deep)', fontFamily: 'var(--font-body)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#50f0d4'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal)'; }}
              >
                Notify me
              </button>
            </form>
          ) : (
            <div
              className="reveal py-4 px-6 rounded-[10px] text-[15px] font-semibold"
              style={{ background: 'rgba(56,232,200,0.08)', border: '1px solid rgba(56,232,200,0.2)', color: 'var(--teal)' }}
            >
              Got it. We&apos;ll send one email when paid signups open.
            </div>
          )}

          <div className="reveal mt-6 flex justify-center gap-3">
            <a
              href="/api/demo/signin"
              className="py-[14px] px-8 rounded-[10px] text-[14px] font-semibold no-underline transition-all inline-block"
              style={{ background: 'var(--teal)', color: 'var(--deep)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#50f0d4'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Try the live demo &rarr;
            </a>
          </div>

          <p className="reveal mt-4 text-[13px]" style={{ color: 'var(--text-dim)' }}>
            Private launch &middot; Summer 2026 &middot; Built for agencies managing 5&ndash;50 clients
          </p>
        </div>
      </section>

      {/* ═══ SECTION 12: FOOTER ═══ */}
      {/* Three-row layout, mirrors ContentPulse's footer pattern:
          row 1: brand left, primary nav right
          row 2: legal links centered
          row 3: copyright centered
          Top accent: Aurora gradient hairline. */}
      <footer>
        <div className="h-[2px] w-full" style={{ background: 'var(--gradient-aurora)' }} />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10 md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <img src="/icon.png" width={24} height={24} alt="Aurora Logo" className="rounded-full shadow-[0_0_8px_rgba(0,229,255,0.4)]" />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>ClientPulse</span>
            <span className="ml-2 text-sm" style={{ color: 'var(--color-muted)' }}>
              by <a href="https://helloaurora.ai" target="_blank" rel="noopener noreferrer" className="font-medium transition hover:text-white" style={{ background: 'var(--gradient-aurora)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Aurora</a>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {[
              { label: 'Log In', href: '/auth/login' },
              { label: 'Sign Up', href: '/auth/signup' },
              { label: 'Aurora', href: 'https://helloaurora.ai' },
              { label: 'ContentPulse', href: 'https://contentpulse.helloaurora.ai' },
              { label: 'For Creators', href: '/for-creators' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-sm transition hover:text-white"
                style={{ color: 'var(--color-muted)' }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-6 px-6 pb-8">
          {[
            { label: 'Impressum', href: 'https://helloaurora.ai/impressum' },
            { label: 'Privacy', href: 'https://helloaurora.ai/privacy' },
            { label: 'DPA', href: 'https://helloaurora.ai/dpa' },
            { label: 'Terms', href: 'https://helloaurora.ai/terms' },
            { label: 'Model Card', href: '/model-card' },
            { label: 'Content Policy', href: '/content-policy' },
            { label: 'FAQ', href: '/faq' },
            { label: 'Refund Policy', href: 'https://helloaurora.ai/refund' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="text-xs transition hover:text-white"
              style={{ color: 'var(--color-muted)' }}
            >
              {link.label}
            </a>
          ))}
        </div>
        <p className="pb-6 text-center text-xs" style={{ color: 'var(--color-muted)', opacity: 0.5 }}>
          &copy; 2026 Aurora AI Solutions Studio UG
        </p>
      </footer>

      {/* Reveal animation styles */}
      <style jsx global>{`
        .reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes wfPulse {
          0% { transform: translateX(0%); opacity: 0.85; }
          70% { opacity: 0.85; }
          100% { transform: translateX(550%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
