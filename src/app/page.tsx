'use client';

import React, { useState, useEffect, FormEvent } from 'react';

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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector('input') as HTMLInputElement;
    const btn = form.querySelector('button') as HTMLButtonElement;
    // Supabase waitlist integration would go here
    input.value = '';
    btn.textContent = '\u2713 You\'re on the list!';
    setTimeout(() => {
      btn.textContent = 'Get Early Access';
    }, 3000);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const prices = [
    { monthly: '59', annual: '47' },
    { monthly: '199', annual: '159' },
    { monthly: '499', annual: '399' },
  ];

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
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'linear-gradient(135deg, var(--teal), var(--aurora-blue))' }}
            >
              📊
            </div>
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
              <button
                onClick={() => scrollToSection('waitlist')}
                className="py-[10px] px-6 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none"
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
                Get Early Access
              </button>
            </li>
          </ul>

          <button
            className="md:hidden bg-transparent border-none text-2xl cursor-pointer"
            style={{ color: 'var(--text-primary)' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰
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
            Launching June 2026
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
            ClientPulse combines your Stripe data, meeting intelligence, and engagement patterns into one Client Health Score — and predicts churn 60 days before it happens.
          </p>

          <form
            className="flex gap-3 max-w-[460px] mx-auto mb-5"
            onSubmit={handleSubmit}
          >
            <input
              type="email"
              placeholder="Enter your work email"
              required
              className="flex-1 py-[14px] px-5 rounded-[10px] text-[15px] outline-none transition-colors"
              style={{
                background: 'var(--color-surface-light)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-outfit)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--teal)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            />
            <button
              type="submit"
              className="py-[14px] px-7 rounded-[10px] text-[15px] font-semibold cursor-pointer whitespace-nowrap transition-all border-none"
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
              Get Early Access
            </button>
          </form>

          <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
            <strong style={{ color: 'var(--teal)', fontWeight: 600 }}>30% off your first year</strong> for founding members + shape the roadmap
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
                icon: '🚨',
                iconBg: 'rgba(231, 76, 60, 0.12)',
                title: 'Invisible warnings',
                desc: "Declining meeting sentiment, overdue payments, stakeholder disengagement — the signals are there, but they're spread across 6 different tools. Nobody connects the dots until the client is already gone.",
              },
              {
                icon: '📊',
                iconBg: 'rgba(240, 200, 76, 0.12)',
                title: 'Spreadsheet blindness',
                desc: '"I think Client X might be unhappy" is how 90% of agencies track client health. Gut feeling doesn\'t scale, and it misses the patterns that data catches 60 days earlier.',
              },
              {
                icon: '💸',
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
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-[22px] mb-5"
                  style={{ background: card.iconBg }}
                >
                  {card.icon}
                </div>
                <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>{card.title}</h3>
                <p className="text-[15px] leading-[1.65]" style={{ color: 'var(--color-muted)' }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DAY ONE VALUE — STRIPE FIRST WEDGE ═══ */}
      <section id="how-it-works" className="py-[120px] max-md:py-[80px]" style={{ background: 'var(--polar)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--teal)' }}>
            Value on Day One
          </div>
          <h2
            className="reveal font-playfair font-bold leading-[1.2] mb-5"
            style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-0.01em' }}
          >
            Connect Stripe. See your portfolio health<br />in under 5 minutes.
          </h2>
          <p className="reveal text-[17px] max-w-[640px] font-light leading-[1.7]" style={{ color: 'var(--text-secondary)' }}>
            No complex setup. One OAuth click to Stripe delivers immediate financial intelligence. Each additional data source you connect makes the score smarter — but isn&apos;t required for value.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mt-14">
            {/* Steps */}
            <div className="flex flex-col gap-7">
              {[
                { num: '1', title: 'Connect Stripe', desc: 'One click. Instantly see which clients are growing vs. shrinking, payment patterns that signal trouble, and revenue concentration risk.' },
                { num: '2', title: 'Get your first Health Scores', desc: "Financial signals alone deliver 30% of the composite score — and it's the 30% agency owners care about most because it's tied to cash flow." },
                { num: '3', title: 'Receive your Monday Brief', desc: 'Every Monday morning: "3 clients healthy, 1 at risk, 1 critical. Here\'s what to do." The email that replaces your spreadsheet.' },
                { num: '4', title: 'Enrich over time', desc: "Add Google Calendar, Gmail, Zoom, Slack. Each connector sharpens the score. After 50+ clients, the system knows YOUR agency's specific churn patterns." },
              ].map((step, i) => (
                <div key={i} className="reveal flex gap-5 items-start">
                  <div
                    className="w-10 h-10 min-w-[40px] rounded-[10px] flex items-center justify-center font-bold text-base"
                    style={{
                      background: 'var(--teal-subtle)',
                      border: '1px solid var(--border-teal)',
                      color: 'var(--teal)',
                    }}
                  >
                    {step.num}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold mb-1">{step.title}</h4>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mock Dashboard */}
            <div
              className="reveal p-10 rounded-2xl relative overflow-hidden"
              style={{
                background: 'var(--twilight)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                className="absolute top-0 right-0 w-[200px] h-[200px] pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(56, 232, 200, 0.06), transparent 70%)' }}
              />
              <div className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-6" style={{ color: 'var(--text-dim)' }}>
                Portfolio Health — Monday Brief Preview
              </div>

              {[
                { initials: 'AC', name: 'Acme Creative', rev: '$8,200/mo · 14 months', score: 89, color: 'var(--teal)', bg: 'rgba(56, 232, 200, 0.15)', width: '89%', class: 'high' },
                { initials: 'BV', name: 'BrightVista Media', rev: '$5,400/mo · 8 months', score: 62, color: 'var(--reforge-gold)', bg: 'rgba(240, 200, 76, 0.15)', width: '62%', class: 'mid' },
                { initials: 'NX', name: 'NexGen Solutions', rev: '$6,100/mo · 11 months', score: 34, color: 'var(--pulse-red)', bg: 'rgba(231, 76, 60, 0.15)', width: '34%', class: 'low' },
              ].map((client, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-[10px] mb-3"
                  style={{
                    background: 'var(--color-surface-light)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: client.bg, color: client.color }}
                    >
                      {client.initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{client.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{client.rev}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-[60px] h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--color-surface-hover)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: client.width, background: client.color }} />
                    </div>
                    <span className="text-sm font-bold min-w-[28px] text-right" style={{ color: client.color }}>
                      {client.score}
                    </span>
                  </div>
                </div>
              ))}

              <div
                className="mt-5 p-[14px_18px] rounded-[10px]"
                style={{
                  background: 'rgba(231, 76, 60, 0.08)',
                  border: '1px solid rgba(231, 76, 60, 0.2)',
                }}
              >
                <div className="text-xs font-semibold mb-[6px]" style={{ color: 'var(--pulse-red)' }}>
                  ⚠️ ACTION REQUIRED
                </div>
                <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  NexGen Solutions — 73% churn probability. Late payments (2 consecutive), no meetings in 3 weeks, declining email responsiveness.{' '}
                  <span className="font-semibold" style={{ color: 'var(--teal)' }}>Draft check-in email ready →</span>
                </div>
              </div>
            </div>
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
                { weight: '30%', icon: '💰', title: 'Financial Health', desc: 'Payment timeliness, invoice disputes, contract value trends, revenue concentration risk. Powered by Stripe.' },
                { weight: '30%', icon: '🤝', title: 'Relationship Health', desc: 'Meeting sentiment trends, stakeholder engagement (are decision-makers still showing up?), communication responsiveness.' },
                { weight: '25%', icon: '📦', title: 'Delivery Health', desc: 'Scope creep signals, action items completed vs. overdue, deliverable cadence and quality indicators.' },
                { weight: '15%', icon: '📡', title: 'Engagement Health', desc: 'Meeting frequency trends, email/Slack volume patterns, response time changes — the subtle signals that precede churn.' },
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
                    <h4 className="text-[15px] font-semibold mb-1">{signal.icon} {signal.title}</h4>
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
                ● Healthy — Low Risk
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
                  📊 Your Monday Brief — Apr 14: 1 client needs attention
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
              { icon: '💰', title: 'Financial Signal Agent', desc: 'Monitors Stripe invoicing data. Detects payment delays, disputes, contract value changes, and revenue concentration risk. Alerts on anomalies.' },
              { icon: '🎙️', title: 'Meeting Intelligence Agent', desc: 'Processes meeting recordings via Whisper + Claude. Extracts sentiment, action items, scope changes, and stakeholder engagement signals.' },
              { icon: '📊', title: 'Health Scoring Agent', desc: 'Computes the composite Client Health Score (0–100) from all signal categories. Updates as new data arrives. Self-calibrates on actual outcomes.' },
              { icon: '⚠️', title: 'Churn Prediction Agent', desc: 'Pattern-matches across all clients to predict churn probability. Alerts 60 days before predicted churn. Explains the driving factors behind each prediction.' },
              { icon: '📈', title: 'Upsell Detection Agent', desc: 'Analyzes meeting transcripts for expansion signals. Flags when clients mention needs outside their current package. Surfaces revenue growth opportunities.' },
              { icon: '🧠', title: 'Recursive Learning Engine', desc: 'Every client renewal or churn trains the model. After 50+ clients, predictions calibrate to YOUR agency\'s patterns. The moat that grows over time.' },
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
                <div className="text-[28px] mb-4">{agent.icon}</div>
                <h3 className="text-[17px] font-semibold mb-[10px]" style={{ fontFamily: 'var(--font-outfit)' }}>
                  {agent.title}
                </h3>
                <p className="text-sm leading-[1.65]" style={{ color: 'var(--color-muted)' }}>{agent.desc}</p>
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
              { icon: '🔒', text: '256-bit encryption' },
              { icon: '🧠', text: 'Your data never trains our AI' },
              { icon: '⚡', text: '99.9% uptime SLA' },
              { icon: '🏗️', text: 'Built on Stripe, AWS & Anthropic' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-[10px]">
                <span className="text-lg">{item.icon}</span>
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
                <div className="font-playfair text-4xl font-bold leading-[1.2]" style={{ color: 'var(--teal)' }}>$2,388</div>
                <div className="text-[13px] mt-[6px]" style={{ color: 'var(--color-muted)' }}>ClientPulse Pro — $199/mo annually</div>
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
            Start with a 7-day free trial. No credit card required. Cancel anytime.
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
              Save 20%
            </span>
          </div>

          {/* Price Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 max-md:max-w-[400px] max-md:mx-auto">
            {[
              {
                tier: 'Starter',
                featured: false,
                desc: 'For small agencies managing a handful of key accounts.',
                features: ['Up to 5 clients', 'Client Health Scores', 'Monday Client Brief', 'Stripe financial sync', 'Churn prediction alerts', 'Email support'],
              },
              {
                tier: 'Pro',
                featured: true,
                desc: "For growing agencies that can't afford to lose a single client.",
                features: ['Up to 20 clients', 'Everything in Starter', 'Meeting Intelligence (Zoom, Google Meet)', 'Upsell Detection Agent', 'Action Proposal Engine', 'Calendar & email sentiment sync', 'Priority support'],
              },
              {
                tier: 'Agency',
                featured: false,
                desc: 'For established agencies that treat client retention as a competitive advantage.',
                features: ['Unlimited clients', 'Everything in Pro', 'Team dashboard & multi-user', 'White-label PDF reports', 'Recursive Learning insights', 'Slack bot integration', 'API access', 'Dedicated onboarding'],
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
                      <span className="font-bold min-w-[16px]" style={{ color: 'var(--teal)' }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => scrollToSection('waitlist')}
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
                  {plan.featured ? 'Get Early Access' : 'Join Waitlist'}
                </button>
              </div>
            ))}
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
                a: 'The Agency plan ($499/mo) includes multi-user team access with role-based permissions. Account managers see their clients, agency owners see the full portfolio. The Monday Brief can be sent to multiple team members.',
              },
              {
                q: 'What happens after the 7-day trial?',
                a: "You choose a plan or your account pauses — no surprise charges. Your data stays available for 30 days so you can pick up where you left off. Founding members get 30% off their first year.",
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
      <div className="py-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="reveal text-center text-sm" style={{ color: 'var(--color-muted)' }}>
            <span style={{ color: 'var(--reforge-gold)' }}>♻️</span>{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>Also from Aurora:</strong>{' '}
            <a href="https://reforge.helloaurora.ai" className="no-underline" style={{ color: 'var(--teal)' }}>
              ReForge
            </a>{' '}
            — AI content intelligence for agencies. Win clients with better content. Keep them with ClientPulse.
          </div>
        </div>
      </div>

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
            Stop losing clients you<br />
            <span
              className="bg-clip-text"
              style={{
                background: 'var(--gradient-aurora)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              could have saved
            </span>
          </h2>

          <p className="reveal text-[17px] font-light leading-[1.7] max-w-[520px] mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
            Join the founding member waitlist. Get 30% off your first year, direct input on the roadmap, and priority onboarding when we launch in June.
          </p>

          <form className="reveal flex gap-3 max-w-[460px] mx-auto mb-5 max-sm:flex-col" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Enter your work email"
              required
              className="flex-1 py-[14px] px-5 rounded-[10px] text-[15px] outline-none transition-colors"
              style={{
                background: 'var(--color-surface-light)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-outfit)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--teal)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            />
            <button
              type="submit"
              className="py-[14px] px-7 rounded-[10px] text-[15px] font-semibold cursor-pointer whitespace-nowrap transition-all border-none"
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
              Get Early Access
            </button>
          </form>

          <p className="reveal text-[13px]" style={{ color: 'var(--text-dim)' }}>
            Launching June 2026 · No credit card required · Built for agencies managing 5–50 clients
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
                { label: 'Impressum', href: '#' },
                { label: 'Privacy', href: '#' },
                { label: 'Terms', href: '#' },
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
