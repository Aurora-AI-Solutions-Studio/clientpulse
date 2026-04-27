'use client';

import React, { useState, useEffect } from 'react';
import { STRIPE_PLANS, getAnnualMonthly } from '@/lib/stripe-config';
import { SubscriptionPlan } from '@/types/stripe';

export default function Home() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  // Price cards are driven off STRIPE_PLANS (single source of truth with
  // src/lib/stripe-config.ts). Annual is 2 months free (10/12 multiplier =
  // 16.7% off) computed via getAnnualMonthly(). Order matches the cards
  // below: Solo, Pro, Agency.
  const PLAN_ORDER: SubscriptionPlan[] = ['solo', 'pro', 'agency'];
  const prices = PLAN_ORDER.map((p) => ({
    monthly: String(STRIPE_PLANS[p].price),
    annual: String(getAnnualMonthly(p)),
    yearlyTotal: STRIPE_PLANS[p].priceYearly,
  }));

  // ── SVG Icon Components (premium look, no emojis) ──
  const Icon = {
    // Logo / Analytics
    pulse: (size = 32) => (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="10" fill="url(#cpLogoGrad)"/>
        <circle cx="20" cy="20" r="13" stroke="#06090f" strokeWidth="2" opacity="0.3" fill="none"/>
        <circle cx="20" cy="20" r="7" fill="#06090f" opacity="0.15"/>
        <polyline points="7,20 13,20 16,12 20,28 24,12 27,20 33,20" stroke="#06090f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="20" cy="7" r="2.5" fill="#06090f"/>
        <circle cx="33" cy="20" r="2" fill="#06090f" opacity="0.6"/>
        <defs>
          <linearGradient id="cpLogoGrad" x1="0" y1="0" x2="40" y2="40">
            <stop offset="0%" stopColor="#38e8c8"/>
            <stop offset="100%" stopColor="#4cc9f0"/>
          </linearGradient>
        </defs>
      </svg>
    ),
    // Alert / Warning
    alertTriangle: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    ),
    // Spreadsheet / Grid
    grid: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
    ),
    // Dollar / Financial
    dollar: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    ),
    // Handshake / Relationship
    handshake: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.42 4.58a5.4 5.4 0 00-7.65 0l-.77.78-.77-.78a5.4 5.4 0 00-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>
    ),
    // Package / Delivery
    package: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
    ),
    // Signal / Radar / Engagement
    radio: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 012.28-1.49"/><path d="M10.71 5.05A16 16 0 000.01 12"/><path d="M13.29 5.05A16 16 0 0124 12"/><circle cx="12" cy="12" r="2"/></svg>
    ),
    // Microphone / Meeting
    mic: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
    ),
    // Chart / Analytics bar
    barChart: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    ),
    // Trend up / Upsell
    trendUp: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
    ),
    // Brain / Learning
    brain: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A5.5 5.5 0 005 5.5C5 7 5.5 8 6.5 9c-2 1.5-2.5 4-2 6 .5 1.5 2 3 4 3.5"/><path d="M14.5 2A5.5 5.5 0 0119 5.5c0 1.5-.5 2.5-1.5 3.5 2 1.5 2.5 4 2 6-.5 1.5-2 3-4 3.5"/><path d="M12 2v20"/><path d="M8 8c1.5 0 3 .5 4 2 1-1.5 2.5-2 4-2"/><path d="M8 14c1.5 0 3 .5 4 2 1-1.5 2.5-2 4-2"/></svg>
    ),
    // Lock / Security
    lock: (size = 18, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    ),
    // Zap / Lightning
    zap: (size = 18, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    ),
    // Building / Infrastructure
    server: (size = 18, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
    ),
    // Shield / Data protection
    shield: (size = 18, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    ),
    // Menu / Hamburger
    menu: (size = 24, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    ),
    // Checkmark
    check: (size = 16, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    ),
    // Recycle / ReForge cross-sell
    refresh: (size = 16, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
    ),
    // Clock / timer
    clock: (size = 18, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    ),
    // Alert circle (for action required)
    alertCircle: (size = 14, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    ),
    // Link / Connection
    link2: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    ),
    // Eye / Visibility
    eye: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    ),
    // Bar chart (already have barChart but adding as chart variant)
    barChart3: (size = 22, color = 'currentColor') => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
    ),
  };

  return (
    <div className="min-h-screen font-outfit" style={{ background: 'var(--deep)', color: 'var(--text-primary)' }}>

      {/* ═══ NAVIGATION ═══ */}
      <nav
        className="fixed top-0 left-0 right-0 z-[100] py-4"
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
            {Icon.pulse(32)}
            <span className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
              Client
              <span
                className="bg-clip-text"
                style={{
                  background: 'var(--gradient-aurora)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Pulse
              </span>
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
                onClick={() => scrollToSection('features')}
                className="bg-transparent border-none text-sm font-medium tracking-wide transition-colors cursor-pointer"
                style={{ color: 'var(--color-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
              >
                Features
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
                className="bg-transparent border-none text-sm font-medium tracking-wide transition-colors cursor-pointer no-underline"
                style={{ color: 'var(--color-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
              >
                See live demo
              </a>
            </li>
            <li>
              <button
                onClick={() => scrollToSection('pricing')}
                className="py-[10px] px-6 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none inline-block"
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
                Get Started
              </button>
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
      </nav>

      {/* ═══ HERO ═══ */}
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
            Private launch · Summer 2026
          </div>

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
            ClientPulse combines your Stripe data, meeting recordings, email patterns, and calendar signals into one Client Health Score per account. Get a Monday Brief with exactly who needs attention and what to do about it.
          </p>

          <div className="flex justify-center gap-3 mb-5">
            <button
              onClick={() => scrollToSection('pricing')}
              className="py-[14px] px-8 rounded-[10px] text-[15px] font-semibold cursor-pointer whitespace-nowrap transition-all border-none"
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
              Get Started
            </button>
            <a
              href="/api/demo/signin"
              className="py-[14px] px-8 rounded-[10px] text-[15px] font-semibold whitespace-nowrap transition-all no-underline inline-flex items-center"
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-outfit)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            >
              See live demo
            </a>
          </div>

          <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
            <strong style={{ color: 'var(--teal)', fontWeight: 600 }}>30% off Agency &amp; Suite</strong> &middot; early adopter pricing
          </p>
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
              { number: '4 signals', label: 'Combined into one health score no spreadsheet can replicate' },
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
                desc: "Declining meeting sentiment, overdue payments, stakeholder disengagement — the signals are there, but they're spread across 6 different tools. Nobody connects the dots until the client is already gone.",
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
                desc: "A $5K/month client is $60K/year in recurring revenue. Agencies with 20 clients losing 3 per year? That's $180K gone. Preventing even one saves more than a year of ClientPulse.",
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

      {/* ═══ THE WORKFLOW (canonical 5-step rail) ═══ */}
      <section id="how-it-works" className="py-[120px] max-md:py-[80px] relative overflow-hidden" style={{ background: 'var(--polar)' }}>
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
            One workflow. <span style={{ color: 'var(--teal)' }}>Two products.</span>
          </h2>
          <p className="reveal text-[17px] max-w-[680px] font-light leading-[1.7] text-center mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Same five steps across content (ReForge) and clients (ClientPulse). Bring your tools in once, see where you stand, get the next move ranked, ship it, and let every outcome sharpen the next decision.
          </p>

          {/* Workflow rail — 5 nodes connected by a hairline with a slow left-to-right pulse */}
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
                { num: '01', title: 'Connect', cue: 'wire it up', desc: 'Bring your tools, voices, and clients in once.', cp: 'Stripe, calendar, email, transcripts' },
                { num: '02', title: 'Discover', cue: 'look around', desc: "See where you stand — what's working, what's quiet, what's at risk.", cp: 'Clients overview — health, signals, risk' },
                { num: '03', title: 'Decide', cue: 'pick the play', desc: 'Get the next-best move ranked, with the why behind it.', cp: 'Monday Brief — ranked re-engage / upsell / save plays' },
                { num: '04', title: 'Act', cue: 'execute', desc: 'Ship it — content, proposals, check-ins — without leaving the suite.', cp: 'Proposals, check-ins, follow-ups' },
                { num: '05', title: 'Learn', cue: 'compound', desc: 'Every outcome trains the next decision. The more you use it, the sharper it gets.', cp: 'Outcome feedback sharpens future Briefs' },
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

          {/* CP-specific translation — what each step looks like in the ClientPulse product */}
          <div className="reveal mx-auto mt-20 max-w-3xl rounded-2xl p-7" style={{ background: 'var(--deep)', border: '1px solid var(--hairline)', borderTop: '2px solid var(--teal)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--teal)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>
              In ClientPulse, that means
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--color-muted)', fontWeight: 300 }}>
              The same five steps, applied to client retention.
            </p>
            <dl className="grid gap-2" style={{ gridTemplateColumns: 'max-content 1fr', columnGap: '1rem' }}>
              {[
                { num: '01', title: 'Connect', cp: 'Stripe, calendar, email, transcripts' },
                { num: '02', title: 'Discover', cp: 'Clients overview — health, signals, risk' },
                { num: '03', title: 'Decide', cp: 'Monday Brief — ranked re-engage / upsell / save plays' },
                { num: '04', title: 'Act', cp: 'Proposals, check-ins, follow-ups' },
                { num: '05', title: 'Learn', cp: 'Outcome feedback sharpens future Briefs' },
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
            Four signals. One score.<br />No blind spots.
          </h2>
          <p className="reveal text-[17px] max-w-[640px] font-light leading-[1.7] text-center mx-auto" style={{ color: 'var(--text-secondary)' }}>
            No single data source predicts churn. ClientPulse combines four signal categories into one composite Client Health Score (0–100) that gives you the full picture.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mt-14">
            <div className="flex flex-col gap-5">
              {[
                { weight: '30%', iconEl: Icon.dollar(18, 'var(--teal)'), title: 'Financial Health', desc: 'Payment timeliness, invoice disputes, contract value trends, revenue concentration risk. Powered by Stripe.' },
                { weight: '30%', iconEl: Icon.handshake(18, 'var(--teal)'), title: 'Relationship Health', desc: 'Meeting sentiment trends, stakeholder engagement (are decision-makers still showing up?), communication responsiveness.' },
                { weight: '25%', iconEl: Icon.package(18, 'var(--teal)'), title: 'Delivery Health', desc: 'Scope creep signals, action items completed vs. overdue, deliverable cadence and quality indicators.' },
                { weight: '15%', iconEl: Icon.radio(18, 'var(--teal)'), title: 'Engagement Health', desc: 'Meeting frequency trends, email/Slack volume patterns, response time changes — the subtle signals that precede churn.' },
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
                Healthy — Low Risk
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MONDAY BRIEF — KILLER FEATURE ═══ */}
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
                It&apos;s not a status report. It&apos;s an action plan — with draft check-in emails, QBR suggestions, and upsell opportunities already prepared for your review.
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
                  Your Monday Brief — Apr 14: 1 client needs attention
                </div>
              </div>
              <div className="p-6">
                <p className="text-[13px] mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Good morning, Sasa. Here&apos;s your portfolio snapshot for the week:
                </p>

                {[
                  { color: 'var(--teal)', name: 'Acme Creative', detail: '— Score 89 ↑ Invoice paid early. Meeting sentiment positive.' },
                  { color: 'var(--teal)', name: 'Stellar Digital', detail: '— Score 84 → Stable. All deliverables on track.' },
                  { color: 'var(--reforge-gold)', name: 'BrightVista', detail: '— Score 62 ↓ Meeting cancellation. Check in this week.' },
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
                        <>— Score 34 ↓↓ <strong style={{ color: 'var(--pulse-red)' }}>73% churn risk.</strong> Action plan ready →</>
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
                  <strong style={{ color: 'var(--teal)' }}>Prepared action:</strong> Draft check-in email for NexGen — addresses the invoice delay, proposes a QBR next week.{' '}
                  <a href="#" style={{ color: 'var(--teal)' }}>Review &amp; send →</a>
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
            ClientPulse isn&apos;t a dashboard. It&apos;s six specialized AI agents that monitor, predict, and prepare actions — so you make better decisions without the busywork.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
            {[
              { iconEl: Icon.dollar(24, 'var(--teal)'), iconBg: 'rgba(56, 232, 200, 0.08)', title: 'Financial Signal Agent', desc: 'Monitors Stripe invoicing data. Detects payment delays, disputes, contract value changes, and revenue concentration risk. Alerts on anomalies.' },
              { iconEl: Icon.mic(24, 'var(--aurora-blue)'), iconBg: 'rgba(76, 201, 240, 0.08)', title: 'Meeting Intelligence Agent', desc: 'Processes meeting recordings via Whisper + Claude. Extracts sentiment, action items, scope changes, and stakeholder engagement signals.' },
              { iconEl: Icon.barChart(24, 'var(--teal)'), iconBg: 'rgba(56, 232, 200, 0.08)', title: 'Health Scoring Agent', desc: 'Computes the composite Client Health Score (0–100) from all signal categories. Updates as new data arrives. Self-calibrates on actual outcomes.' },
              { iconEl: Icon.alertTriangle(24, 'var(--reforge-gold)'), iconBg: 'rgba(240, 200, 76, 0.08)', title: 'Churn Prediction Agent', desc: 'Pattern-matches across all clients to predict churn probability. Alerts 60 days before predicted churn. Explains the driving factors behind each prediction.' },
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

      {/* ═══ COMPETITIVE COMPARISON ═══ */}
      <section className="py-[120px] max-md:py-[80px]" style={{ background: 'var(--polar)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4 text-center" style={{ color: 'var(--teal)' }}>
            Why Not Just Use...
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-5 text-center"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            &ldquo;We already track clients in<br />[spreadsheet / CRM / gut feeling].&rdquo;
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-14">
            {[
              {
                title: 'vs. Spreadsheets',
                desc: 'Your spreadsheet can\'t process a meeting recording, detect sentiment shifts, cross-reference payment patterns, and draft a check-in email. ClientPulse can. Before you finish your first coffee.',
              },
              {
                title: 'vs. ChurnZero / Gainsight / Vitally',
                desc: 'Built for SaaS companies tracking product usage. You\'re an agency — you don\'t have product usage data. And they cost $26K–$40K/year. ClientPulse is built for agencies at 1/10th the price.',
              },
              {
                title: 'vs. CRM (HubSpot, Salesforce)',
                desc: 'CRMs track contacts and deals. They don\'t track ongoing client health, meeting sentiment, or financial risk signals. ClientPulse sits on top of your CRM, not instead of it.',
              },
              {
                title: 'vs. Gong / Fireflies',
                desc: 'Meeting intelligence tools built for sales prospecting, not client retention. They don\'t combine financial signals, delivery data, and engagement patterns into a predictive Health Score.',
              },
            ].map((card, i) => (
              <div
                key={i}
                className="reveal p-8 rounded-2xl transition-all hover:-translate-y-[2px]"
                style={{
                  background: 'var(--twilight)',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-teal)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <h3 className="text-base font-semibold mb-3">{card.title}</h3>
                <p className="text-sm leading-[1.65]" style={{ color: 'var(--color-muted)' }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY CLIENTPULSE ═══ */}
      <section className="py-[120px] max-md:py-[80px] text-center">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--teal)' }}>
            Why ClientPulse
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-5"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            This isn&apos;t another dashboard<br />you&apos;ll forget to check
          </h2>
          <p className="reveal text-base font-light leading-[1.7] max-w-[680px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
            ClientPulse connects to your Stripe, calendar, email, and meeting recordings — then runs continuously in the background. It monitors 50 clients at once, learns your agency&apos;s specific patterns, and sends you an automated brief with action plans every Monday. No prompting, no manual checks, no spreadsheets.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14 text-left">
            {[
              { title: 'Gets smarter every month', desc: "Health Scores train on YOUR client patterns, not generic benchmarks. Every renewal and every churn teaches the system. By month 6, predictions are calibrated to your agency specifically." },
              { title: '5 minutes to first value', desc: "Connect Stripe — one OAuth click. You get financial health intelligence immediately. Every additional data source enriches the score, but isn't required to start seeing value." },
              { title: 'Actions, not just alerts', desc: "When a client is at risk, ClientPulse doesn't just flag it. It prepares a draft check-in email, suggests a QBR agenda, and surfaces talking points — ready for your review and send." },
            ].map((card, i) => (
              <div
                key={i}
                className="reveal p-[32px_28px] rounded-2xl"
                style={{
                  background: 'var(--polar)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <h4 className="text-base font-semibold mb-[10px]" style={{ color: 'var(--teal)' }}>{card.title}</h4>
                <p className="text-sm leading-[1.65]" style={{ color: 'var(--color-muted)' }}>{card.desc}</p>
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
              { iconEl: Icon.shield(18, 'var(--teal)'), text: 'Your data never trains our AI' },
              { iconEl: Icon.zap(18, 'var(--teal)'), text: '99.9% uptime SLA' },
              { iconEl: Icon.server(18, 'var(--teal)'), text: 'Built on Stripe, AWS & Anthropic' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-[10px]">
                <span className="flex items-center justify-center">{item.iconEl}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>{item.text}</span>
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
            {/* Aurora gradient top bar */}
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
                <div className="text-[13px] mt-[6px]" style={{ color: 'var(--color-muted)' }}>ClientPulse Pro — $199/mo, billed annually at $1,990 (2 months free)</div>
              </div>
            </div>

            <p className="text-lg font-semibold" style={{ color: 'var(--teal)' }}>
              Prevent one churn = <span className="font-playfair text-[28px]">25x ROI</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
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
            Plans from ${STRIPE_PLANS.solo.price}/mo. Cancel anytime.
          </p>

          {/* Toggle */}
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

          {/* Price Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 max-md:max-w-[400px] max-md:mx-auto">
            {[
              {
                tier: 'Solo',
                featured: false,
                desc: 'For freelancers and solo consultants with a focused book of key accounts.',
                workflows: {
                  'CONNECT': ['Stripe financial sync'],
                  'MONITOR': ['Up to 3 clients', 'Daily health refresh', 'Client Health Scores', 'Monday Client Brief'],
                  'ACT': [],
                  'REVIEW': ['Churn prediction alerts', '90-day retention'],
                },
                features: ['Up to 3 clients', 'Client Health Scores', 'Monday Client Brief', 'Stripe financial sync', 'Churn prediction alerts', '90-day data retention', 'Email support'],
              },
              {
                tier: 'Pro',
                featured: false,
                desc: "For growing agencies that can't afford to lose a single client.",
                workflows: {
                  'CONNECT': ['Stripe financial sync', 'Calendar & email sentiment sync'],
                  'MONITOR': ['Up to 10 clients', 'Hourly health refresh', 'Everything in Solo'],
                  'ACT': ['Action Proposal Engine', 'Meeting Intelligence (Zoom, Google Meet)', 'Upsell Detection Agent'],
                  'REVIEW': ['Historical trends & accuracy tracking', '12-month retention'],
                },
                features: ['Up to 10 clients', 'Everything in Solo', 'Meeting Intelligence (Zoom, Google Meet)', 'Upsell Detection Agent', 'Action Proposal Engine', 'Calendar & email sentiment sync', '12-month data retention', '3 seats', '3 MCP connections', 'All models (Claude, GPT, Gemini)', 'Priority support'],
              },
              {
                tier: 'Agency',
                featured: true,
                desc: 'For established agencies that treat client retention as a competitive advantage.',
                workflows: {
                  'CONNECT': ['Stripe financial sync', 'Calendar & email sentiment sync', 'Multi-data connectors'],
                  'MONITOR': ['Unlimited clients', 'Real-time health refresh', 'Team dashboard & multi-user'],
                  'ACT': ['Everything in Pro', 'Slack bot integration'],
                  'REVIEW': ['White-label PDF reports', 'Recursive Learning insights', 'Portfolio analytics', '36-month retention'],
                },
                features: ['Unlimited clients', 'Everything in Pro', 'Team dashboard & 8 seats', 'Real-time health refresh', 'White-label PDF reports', 'Recursive Learning insights', 'Slack bot integration', 'Full API · unlimited MCP', '36-month data retention', 'On-device (post-launch)', 'Dedicated onboarding'],
              },
            ].map((plan, i) => (
              <div
                key={i}
                className="reveal p-[40px_32px] rounded-[20px] relative transition-all hover:-translate-y-[2px]"
                style={{
                  background: plan.featured
                    ? 'linear-gradient(to bottom, rgba(56, 232, 200, 0.04), var(--polar))'
                    : 'var(--polar)',
                  border: plan.featured ? '1px solid var(--teal)' : '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => {
                  if (!plan.featured) e.currentTarget.style.borderColor = 'var(--border-teal)';
                }}
                onMouseLeave={(e) => {
                  if (!plan.featured) e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                {/* Aurora gradient top bar for featured */}
                {plan.featured && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[20px]" style={{ background: 'var(--gradient-aurora)' }} />
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 py-1 px-4 rounded-full text-[11px] font-bold uppercase tracking-wide"
                      style={{ background: 'var(--teal)', color: 'var(--deep)' }}
                    >
                      Most Popular
                    </div>
                  </>
                )}

                <div className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-muted)' }}>
                  {plan.tier}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>$</span>
                  <span className="font-playfair text-5xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
                    {isAnnual ? prices[i].annual : prices[i].monthly}
                  </span>
                  <span className="text-[15px]" style={{ color: 'var(--text-dim)' }}>/mo</span>
                </div>
                <div className="text-[13px] mb-5 min-h-[20px]" style={{ color: 'var(--teal)' }}>
                  {isAnnual ? 'billed annually' : `$${prices[i].annual}/mo billed annually`}
                </div>
                <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{plan.desc}</p>

                <ul className="flex flex-col gap-3 mb-8 list-none">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-[10px] text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      <span className="min-w-[16px] mt-[2px] flex items-center">{Icon.check(16, 'var(--teal)')}</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    window.location.href = `/auth/signup?plan=${plan.tier.toLowerCase()}`;
                  }}
                  className="block w-full py-[14px] text-center rounded-[10px] text-[15px] font-semibold cursor-pointer transition-all border-none"
                  style={
                    plan.featured
                      ? { background: 'var(--teal)', color: 'var(--deep)' }
                      : { background: 'var(--color-surface-light)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }
                  }
                  onMouseEnter={(e) => {
                    if (plan.featured) {
                      e.currentTarget.style.background = '#50f0d4';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(56, 232, 200, 0.3)';
                    } else {
                      e.currentTarget.style.borderColor = 'var(--border-teal)';
                      e.currentTarget.style.background = 'var(--color-surface-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (plan.featured) {
                      e.currentTarget.style.background = 'var(--teal)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    } else {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.background = 'var(--color-surface-light)';
                    }
                  }}
                >
                  {plan.featured ? 'Get Started' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>

          {/* ─── Agency Suite — full-feature card mirroring RF's SuiteCard ─── */}
          {/* Same density/structure as the ReForge landing's Suite card so the
              two products feel like one Suite story. CTA lands directly in
              ReForge's /auth/signup?plan=suite (Suite is a ReForge SKU and
              the signup UX is on that side). */}
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
                    Early Adopter · 30% off 1st year
                  </span>
                </div>
                <h3 className="mt-3 font-playfair text-[22px] font-bold leading-[1.3]" style={{ color: 'var(--text-primary)' }}>
                  ClientPulse Agency + ReForge Agency, talking to each other.
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Most agencies use a content tool <em>and</em> a client-health tool.
                  Ours talk to each other. Yours don&apos;t. Content velocity becomes a
                  leading churn indicator — a 30-day head start on every risk.
                </p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    'Everything in both Agency plans',
                    'RF → CP content-velocity pipeline',
                    'Content velocity as a leading churn indicator',
                    'A 30-day head start on every churn risk',
                    '20 EA slots · 30% off first year',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--teal)' }}>{'✓'}</span>
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
                    Billed $9,984 · <span style={{ color: 'var(--teal)' }}>2 months free</span>
                  </p>
                )}
                <a
                  href="https://reforge.helloaurora.ai/auth/signup?plan=suite"
                  className="mt-4 block rounded-xl px-6 py-3 text-center text-sm font-semibold transition-all"
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
                  Get Agency Suite
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
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
                q: 'How much data do I need before predictions are useful?',
                a: "ClientPulse delivers value from day one with financial health intelligence (Stripe). Churn predictions improve over time — after 2-3 months of data across your client base, the system starts producing calibrated risk scores. We don't over-promise early predictions; we let the accuracy earn your trust.",
              },
              {
                q: "What if I don't use Stripe?",
                a: "Stripe is our primary financial connector for launch. QuickBooks and FreshBooks integrations are on the roadmap for Q3 2026. In the meantime, you can still get value from meeting intelligence, calendar patterns, and engagement signals — the financial component just won't be active.",
              },
              {
                q: 'How is this different from my CRM?',
                a: "CRMs track contacts and deals. They don't analyze meeting sentiment, detect payment patterns, predict churn probability, or send you a weekly brief with prepared action plans. ClientPulse sits on top of your existing tools and turns raw data into client intelligence.",
              },
              {
                q: 'Is my client data safe?',
                a: "All data is encrypted at rest and in transit (256-bit). Your data is never used to train our AI models. We use Anthropic's Claude API with strict data processing agreements. Each agency's data is fully isolated — no cross-tenant access, no shared models.",
              },
              {
                q: 'Can my whole team use it?',
                a: 'The Agency plan ($799/mo) includes 8 seats with role-based permissions. Account managers see their clients, agency owners see the full portfolio. The Monday Brief can be sent to multiple team members.',
              },
              {
                q: 'What happens after the 7-day trial?',
                a: "You choose a plan or your account pauses — no surprise charges. Your data stays available for 30 days so you can pick up where you left off. Founding members get 30% off their first year.",
              },
              {
                q: "What's the difference between Solo, Pro, and Agency?",
                a: "Solo ($59/mo) covers up to 3 clients with Health Scores, Monday Brief, and Stripe sync — perfect for freelancers or solo consultants. Pro ($199/mo) adds Meeting Intelligence, Upsell Detection, the Action Proposal Engine, and calendar/email sentiment for up to 10 clients. Agency ($799/mo) unlocks unlimited clients, team dashboard with 8 seats, white-label reports, Slack bot, Recursive Learning insights, and full API access.",
              },
              {
                q: 'Is there a discount for annual billing?',
                a: "Yes — annual plans get 2 months free (16.7% off). That brings Solo to $49/mo, Pro to $166/mo, and Agency to $666/mo. Early Adopters also get an additional 30% off the first year on Agency + Agency Suite — apply the EA-CP-AGENCY-30 or EA-SUITE-30 coupon at checkout (20 slots each).",
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
            <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--reforge-gold)' }}>
              <span className="inline-flex items-center align-middle" style={{ marginRight: '8px' }}>{Icon.refresh(16, 'var(--reforge-gold)')}</span>
              Also from Aurora
            </div>
            <h3 className="reveal font-playfair font-bold leading-[1.2] mb-4" style={{ fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-0.01em' }}>
              Creating content for clients?<br />Meet <a href="https://reforge.helloaurora.ai" className="no-underline" style={{ color: 'var(--teal)' }}>ReForge</a>.
            </h3>
            <p className="reveal text-base font-light leading-[1.7] max-w-[680px] mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
              ClientPulse tells you which clients need attention. ReForge helps you deliver the content that keeps them happy. Same workflow thinking. Same agency focus. Built to work together.
            </p>
            <div className="reveal text-sm" style={{ color: 'var(--color-muted)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>ReForge:</strong> Discover → Create → Engage → Learn<br />
              <strong style={{ color: 'var(--text-primary)' }}>ClientPulse:</strong> Connect → Monitor → Act → Review<br />
              <strong style={{ color: 'var(--text-primary)' }}>Two products. One operating system for your agency.</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section id="waitlist" className="py-[120px] max-md:py-[80px] text-center relative">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(56, 232, 200, 0.06) 0%, transparent 70%)' }}
        />
        <div className="max-w-[1140px] mx-auto px-6 relative">
          <div
            className="reveal inline-flex items-center gap-2 py-2 px-5 rounded-full text-[13px] font-semibold mb-6"
            style={{
              background: 'rgba(231, 76, 60, 0.08)',
              border: '1px solid rgba(231, 76, 60, 0.2)',
              color: 'var(--pulse-red)',
            }}
          >
            <span
              className="w-[6px] h-[6px] rounded-full inline-block"
              style={{ background: 'var(--teal)', animation: 'dot-pulse 2s ease-in-out infinite' }}
            />
            Limited to the first 50 founding agencies
          </div>

          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-4"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
          >
            Stop finding out about churn<br />
            <span
              className="bg-clip-text"
              style={{
                background: 'var(--gradient-aurora)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              from a cancellation email
            </span>
          </h2>

          <p className="reveal text-[17px] font-light leading-[1.7] max-w-[520px] mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
            Pick a plan and start tracking client health in minutes. Agency &amp; Suite tiers come with 30% off year one for early adopters.
          </p>

          <div className="reveal flex justify-center mb-5">
            <button
              onClick={() => scrollToSection('pricing')}
              className="py-[14px] px-8 rounded-[10px] text-[15px] font-semibold cursor-pointer whitespace-nowrap transition-all border-none"
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
              Get Started
            </button>
          </div>

          <p className="reveal text-[13px]" style={{ color: 'var(--text-dim)' }}>
            Private launch · Summer 2026 · Built for agencies managing 5–50 clients
          </p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="flex items-center justify-between max-md:flex-col max-md:gap-6 max-md:text-center">
            <a href="https://helloaurora.ai" className="flex items-center gap-2 no-underline">
              <span className="font-semibold text-sm" style={{ color: 'var(--color-muted)' }}>
                by Aurora AI Solutions Studio
              </span>
            </a>
            <ul className="flex gap-6 list-none max-md:flex-wrap max-md:justify-center">
              {[
                { label: 'Aurora', href: 'https://helloaurora.ai' },
                { label: 'ReForge', href: 'https://reforge.helloaurora.ai' },
                { label: 'Impressum', href: 'https://helloaurora.ai/impressum' },
                { label: 'Privacy', href: 'https://helloaurora.ai/privacy' },
                { label: 'Terms', href: 'https://helloaurora.ai/terms' },
                { label: 'Refund', href: 'https://helloaurora.ai/refund' },
              ].map((link, i) => (
                <li key={i}>
                  <a
                    href={link.href}
                    className="text-[13px] no-underline transition-colors"
                    style={{ color: 'var(--text-dim)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              © 2026 Aurora AI Solutions Studio UG
            </span>
          </div>
        </div>
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
      `}</style>
    </div>
  );
}
