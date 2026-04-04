'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  AlertCircle,
  Zap,
  Target,
  BarChart3,
  Brain,
  MessageSquare,
  Users,
  CheckCircle,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

export default function Home() {
  const [numClients, setNumClients] = useState(15);
  const [monthlyRetainer, setMonthlyRetainer] = useState(5000);

  const annualChurnCost = numClients * monthlyRetainer * 12 * 0.1; // Assuming 10% churn
  const clientpulseCost = numClients < 5 ? 29 : numClients < 20 ? 79 : 199;
  const savingsWithOne = annualChurnCost / numClients;

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#06090f] to-[#0a0d15] text-white font-outfit">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full bg-[#06090f]/80 backdrop-blur-md border-b border-[#1a2540]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-playfair font-bold bg-gradient-to-r from-[#38e8c8] to-[#e74c3c] bg-clip-text text-transparent">
            ClientPulse
          </h1>
          <div className="hidden md:flex gap-8">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-[#7a88a8] hover:text-white transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-[#7a88a8] hover:text-white transition-colors"
            >
              Pricing
            </button>
          </div>
          <Link
            href="/auth/signup"
            className="px-6 py-2 bg-[#e74c3c] hover:bg-[#d73a2e] rounded-lg font-semibold transition-colors"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Aurora Gradient Background */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-30 blur-3xl"
          style={{
            background: 'linear-gradient(90deg, #38e8c8, #4cc9f0, #7b8ff0, #b388eb, #e87fa5)',
          }}
        />

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-[#0d1422] border border-[#1a2540] rounded-full">
            <p className="text-[#7a88a8] text-sm">Built for digital marketing, social media, creative, and PR agencies</p>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-playfair font-bold mb-6 leading-tight">
            Know Which Clients Are Thriving
            <span className="block text-transparent bg-gradient-to-r from-[#38e8c8] via-[#4cc9f0] to-[#e87fa5] bg-clip-text">
              — And Which Are About to Leave
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-[#7a88a8] mb-8 max-w-3xl mx-auto leading-relaxed">
            AI-powered Client Health Intelligence that predicts churn 60 days before it happens. Built for agencies managing 5–50 clients.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/auth/signup"
              className="px-8 py-4 bg-[#e74c3c] hover:bg-[#d73a2e] rounded-lg font-semibold text-lg transition-all transform hover:scale-105"
            >
              Start Free Trial
            </Link>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="px-8 py-4 border border-[#1a2540] hover:border-[#38e8c8] rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2"
            >
              See How It Works <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-playfair font-bold text-center mb-16">
            Client Churn Is Killing Your Agency
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Pain Point 1 */}
            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 hover:border-[#38e8c8] transition-colors">
              <div className="mb-4 w-12 h-12 bg-[#e74c3c]/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="text-[#e74c3c]" size={24} />
              </div>
              <h3 className="text-xl font-playfair font-bold mb-4">Invisible Early Warnings</h3>
              <p className="text-[#7a88a8]">
                Declining sentiment, overdue invoices, and missed engagement signals go completely unnoticed until it&apos;s too late.
              </p>
            </div>

            {/* Pain Point 2 */}
            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 hover:border-[#4cc9f0] transition-colors">
              <div className="mb-4 w-12 h-12 bg-[#4cc9f0]/20 rounded-lg flex items-center justify-center">
                <Brain className="text-[#4cc9f0]" size={24} />
              </div>
              <h3 className="text-xl font-playfair font-bold mb-4">Operational Blindness</h3>
              <p className="text-[#7a88a8]">
                Spreadsheets and gut feeling aren&apos;t enough. You need real-time intelligence across all your clients simultaneously.
              </p>
            </div>

            {/* Pain Point 3 */}
            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 hover:border-[#38e8c8] transition-colors">
              <div className="mb-4 w-12 h-12 bg-[#38e8c8]/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-[#38e8c8]" size={24} />
              </div>
              <h3 className="text-xl font-playfair font-bold mb-4">The Cost</h3>
              <p className="text-[#7a88a8]">
                Every churned client at $5K/month costs you ~$60K/year in lost revenue. That adds up fast.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0a0d15]/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-playfair font-bold text-center mb-4">How It Works</h2>
          <p className="text-center text-[#7a88a8] text-lg mb-16 max-w-2xl mx-auto">
            4 simple steps to predict and prevent client churn
          </p>

          <div className="grid md:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 text-center h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-[#38e8c8] to-[#4cc9f0] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="text-white" size={32} />
                </div>
                <h3 className="text-xl font-playfair font-bold mb-3">Connect</h3>
                <p className="text-[#7a88a8] text-sm">
                  Link your Stripe account and upload meeting recordings
                </p>
              </div>
              <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-[#1a2540]">
                <ChevronDown size={24} className="rotate-90" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 text-center h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-[#4cc9f0] to-[#7b8ff0] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="text-white" size={32} />
                </div>
                <h3 className="text-xl font-playfair font-bold mb-3">Analyze</h3>
                <p className="text-[#7a88a8] text-sm">
                  AI extracts signals from financial data and meeting intelligence
                </p>
              </div>
              <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-[#1a2540]">
                <ChevronDown size={24} className="rotate-90" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 text-center h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-[#7b8ff0] to-[#b388eb] rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="text-white" size={32} />
                </div>
                <h3 className="text-xl font-playfair font-bold mb-3">Score</h3>
                <p className="text-[#7a88a8] text-sm">
                  Client Health Score (0-100) computed from 4 signal categories
                </p>
              </div>
              <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-[#1a2540]">
                <ChevronDown size={24} className="rotate-90" />
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative">
              <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 text-center h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-[#b388eb] to-[#e87fa5] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="text-white" size={32} />
                </div>
                <h3 className="text-xl font-playfair font-bold mb-3">Act</h3>
                <p className="text-[#7a88a8] text-sm">
                  Get Monday briefs, churn alerts, and action proposals
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Client Health Score Showcase */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-playfair font-bold text-center mb-16">
            The Client Health Score
          </h2>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[#7a88a8] text-lg mb-8">
                A single, comprehensive score that combines four critical dimensions of client health:
              </p>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[#0d1422] border border-[#1a2540] rounded-xl flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#38e8c8]">30%</span>
                    <span className="text-xs text-[#7a88a8]">Financial</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Financial Health</h4>
                    <p className="text-[#7a88a8] text-sm">Payment patterns and revenue trends</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[#0d1422] border border-[#1a2540] rounded-xl flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#4cc9f0]">30%</span>
                    <span className="text-xs text-[#7a88a8]">Relationship</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Relationship Health</h4>
                    <p className="text-[#7a88a8] text-sm">Communication sentiment and engagement</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[#0d1422] border border-[#1a2540] rounded-xl flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#b388eb]">25%</span>
                    <span className="text-xs text-[#7a88a8]">Delivery</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Delivery Health</h4>
                    <p className="text-[#7a88a8] text-sm">Project milestones and deliverables</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[#0d1422] border border-[#1a2540] rounded-xl flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#e87fa5]">15%</span>
                    <span className="text-xs text-[#7a88a8]">Engagement</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Engagement Level</h4>
                    <p className="text-[#7a88a8] text-sm">Activity frequency and responsiveness</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0d1422] border border-[#1a2540] rounded-2xl p-12 text-center">
              <div className="mb-8">
                <div className="text-7xl font-bold bg-gradient-to-r from-[#38e8c8] to-[#e74c3c] bg-clip-text text-transparent mb-4">
                  78
                </div>
                <p className="text-[#7a88a8] text-lg">Acme Creative Co.</p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#7a88a8]">Financial</span>
                  <div className="w-32 h-2 bg-[#1a2540] rounded-full overflow-hidden">
                    <div className="h-full bg-[#38e8c8] rounded-full" style={{ width: '85%' }} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7a88a8]">Relationship</span>
                  <div className="w-32 h-2 bg-[#1a2540] rounded-full overflow-hidden">
                    <div className="h-full bg-[#4cc9f0] rounded-full" style={{ width: '72%' }} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7a88a8]">Delivery</span>
                  <div className="w-32 h-2 bg-[#1a2540] rounded-full overflow-hidden">
                    <div className="h-full bg-[#b388eb] rounded-full" style={{ width: '78%' }} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7a88a8]">Engagement</span>
                  <div className="w-32 h-2 bg-[#1a2540] rounded-full overflow-hidden">
                    <div className="h-full bg-[#e87fa5] rounded-full" style={{ width: '68%' }} />
                  </div>
                </div>
              </div>

              <p className="text-[#7a88a8] text-xs mt-8">Status: <span className="text-[#38e8c8] font-semibold">Healthy & Growing</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0a0d15]/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-playfair font-bold text-center mb-16">
            Powerful Features
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 hover:border-[#38e8c8] transition-colors">
              <BarChart3 className="text-[#38e8c8] mb-4" size={32} />
              <h3 className="text-xl font-playfair font-bold mb-2">Multi-Signal Health Score</h3>
              <p className="text-[#7a88a8]">Combines financial, relationship, delivery, and engagement signals into one actionable metric</p>
            </div>

            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 hover:border-[#4cc9f0] transition-colors">
              <TrendingUp className="text-[#4cc9f0] mb-4" size={32} />
              <h3 className="text-xl font-playfair font-bold mb-2">Churn Prediction Agent</h3>
              <p className="text-[#7a88a8]">Identify at-risk clients 60 days before churn with AI-powered early warnings</p>
            </div>

            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 hover:border-[#7b8ff0] transition-colors">
              <MessageSquare className="text-[#7b8ff0] mb-4" size={32} />
              <h3 className="text-xl font-playfair font-bold mb-2">Meeting Intelligence</h3>
              <p className="text-[#7a88a8]">Extract sentiment, action items, and concerns from client meetings automatically</p>
            </div>

            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 hover:border-[#b388eb] transition-colors">
              <Users className="text-[#b388eb] mb-4" size={32} />
              <h3 className="text-xl font-playfair font-bold mb-2">Monday Client Brief</h3>
              <p className="text-[#7a88a8]">Get a smart weekly snapshot of all your clients&apos; health at a glance</p>
            </div>

            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 hover:border-[#e87fa5] transition-colors">
              <Zap className="text-[#e87fa5] mb-4" size={32} />
              <h3 className="text-xl font-playfair font-bold mb-2">Upsell Detection</h3>
              <p className="text-[#7a88a8]">Find expansion opportunities by identifying high-performing, satisfied clients</p>
            </div>

            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8 hover:border-[#e74c3c] transition-colors">
              <Brain className="text-[#e74c3c] mb-4" size={32} />
              <h3 className="text-xl font-playfair font-bold mb-2">Recursive Learning</h3>
              <p className="text-[#7a88a8]">Models improve over time with your feedback, getting smarter the more you use it</p>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-playfair font-bold text-center mb-4">
            See Your ROI
          </h2>
          <p className="text-center text-[#7a88a8] text-lg mb-12">
            How much could you save by preventing just one client from churning?
          </p>

          <div className="bg-[#0d1422] border border-[#1a2540] rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-12">
              {/* Input Controls */}
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-semibold mb-4">
                    How many clients do you manage?
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={numClients}
                      onChange={(e) => setNumClients(Number(e.target.value))}
                      className="flex-1 h-2 bg-[#1a2540] rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #38e8c8 0%, #38e8c8 ${(numClients / 100) * 100}%, #1a2540 ${(numClients / 100) * 100}%, #1a2540 100%)`,
                      }}
                    />
                    <span className="text-3xl font-bold text-[#38e8c8] w-16 text-right">
                      {numClients}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-4">
                    Average monthly retainer?
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1000"
                      max="50000"
                      step="1000"
                      value={monthlyRetainer}
                      onChange={(e) => setMonthlyRetainer(Number(e.target.value))}
                      className="flex-1 h-2 bg-[#1a2540] rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #4cc9f0 0%, #4cc9f0 ${((monthlyRetainer - 1000) / 49000) * 100}%, #1a2540 ${((monthlyRetainer - 1000) / 49000) * 100}%, #1a2540 100%)`,
                      }}
                    />
                    <span className="text-3xl font-bold text-[#4cc9f0] w-32 text-right">
                      ${(monthlyRetainer / 1000).toFixed(1)}K
                    </span>
                  </div>
                </div>
              </div>

              {/* ROI Display */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-[#38e8c8]/20 to-transparent rounded-xl p-6 border border-[#38e8c8]/30">
                  <p className="text-[#7a88a8] text-sm mb-2">Annual Churn Risk</p>
                  <p className="text-4xl font-bold text-[#38e8c8] mb-2">
                    ${(annualChurnCost / 1000).toFixed(0)}K
                  </p>
                  <p className="text-xs text-[#7a88a8]">
                    Estimated annual loss if you lose 1 client to preventable churn
                  </p>
                </div>

                <div className="bg-gradient-to-br from-[#e74c3c]/20 to-transparent rounded-xl p-6 border border-[#e74c3c]/30">
                  <p className="text-[#7a88a8] text-sm mb-2">ClientPulse Cost</p>
                  <p className="text-4xl font-bold text-[#e74c3c] mb-2">
                    ${clientpulseCost}/mo
                  </p>
                  <p className="text-xs text-[#7a88a8]">
                    Based on your client count
                  </p>
                </div>

                <div className="bg-gradient-to-br from-[#4cc9f0]/20 to-transparent rounded-xl p-6 border border-[#4cc9f0]/30">
                  <p className="text-[#7a88a8] text-sm mb-2">ROI from Preventing 1 Churn</p>
                  <p className="text-4xl font-bold text-[#4cc9f0]">
                    {Math.round((savingsWithOne / (clientpulseCost * 12)) * 100)}x
                  </p>
                  <p className="text-xs text-[#7a88a8]">
                    Your money back {Math.round((savingsWithOne / (clientpulseCost * 12)) * 100)}x over in one year
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0a0d15]/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-playfair font-bold text-center mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-center text-[#7a88a8] text-lg mb-12">
            Save 20% with annual billing
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="bg-[#0d1422] border border-[#1a2540] rounded-2xl p-8 hover:border-[#38e8c8] transition-colors">
              <h3 className="text-2xl font-playfair font-bold mb-2">Starter</h3>
              <p className="text-[#7a88a8] text-sm mb-6">For small agencies</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-[#7a88a8] text-sm">/month</span>
              </div>
              <p className="text-[#7a88a8] text-sm mb-6">Up to 5 clients</p>
              <Link
                href="/auth/signup"
                className="block w-full px-6 py-3 bg-[#e74c3c] hover:bg-[#d73a2e] rounded-lg font-semibold transition-colors text-center mb-8"
              >
                Start Free Trial
              </Link>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">Client Health Scores</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">Basic churn alerts</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">Weekly briefs</span>
                </li>
              </ul>
            </div>

            {/* Pro (Featured) */}
            <div className="bg-gradient-to-b from-[#0d1422] to-[#0d1422] border border-[#38e8c8] rounded-2xl p-8 transform md:scale-105 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#38e8c8] rounded-full">
                <p className="text-xs font-bold text-[#06090f]">MOST POPULAR</p>
              </div>
              <h3 className="text-2xl font-playfair font-bold mb-2">Pro</h3>
              <p className="text-[#7a88a8] text-sm mb-6">For growing agencies</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$79</span>
                <span className="text-[#7a88a8] text-sm">/month</span>
              </div>
              <p className="text-[#7a88a8] text-sm mb-6">Up to 20 clients</p>
              <Link
                href="/auth/signup"
                className="block w-full px-6 py-3 bg-[#38e8c8] hover:bg-[#2ed5b7] text-[#06090f] rounded-lg font-semibold transition-colors text-center mb-8"
              >
                Start Free Trial
              </Link>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">Everything in Starter</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">Meeting Intelligence</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">Upsell Detection</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">Priority support</span>
                </li>
              </ul>
            </div>

            {/* Agency */}
            <div className="bg-[#0d1422] border border-[#1a2540] rounded-2xl p-8 hover:border-[#e87fa5] transition-colors">
              <h3 className="text-2xl font-playfair font-bold mb-2">Agency</h3>
              <p className="text-[#7a88a8] text-sm mb-6">For large agencies</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$199</span>
                <span className="text-[#7a88a8] text-sm">/month</span>
              </div>
              <p className="text-[#7a88a8] text-sm mb-6">Unlimited clients</p>
              <Link
                href="/auth/signup"
                className="block w-full px-6 py-3 bg-[#e74c3c] hover:bg-[#d73a2e] rounded-lg font-semibold transition-colors text-center mb-8"
              >
                Start Free Trial
              </Link>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">Everything in Pro</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">Custom integrations</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">Dedicated support</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-[#38e8c8]" />
                  <span className="text-sm">API access</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-playfair font-bold mb-12">
            Join Agencies Already Protecting Their Client Revenue
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8">
              <p className="text-[#7a88a8] text-sm mb-4">Coming Soon</p>
              <p className="text-white text-lg font-semibold">Agency Partner 1</p>
            </div>
            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8">
              <p className="text-[#7a88a8] text-sm mb-4">Coming Soon</p>
              <p className="text-white text-lg font-semibold">Agency Partner 2</p>
            </div>
            <div className="bg-[#0d1422] border border-[#1a2540] rounded-xl p-8">
              <p className="text-[#7a88a8] text-sm mb-4">Coming Soon</p>
              <p className="text-white text-lg font-semibold">Agency Partner 3</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0a0d15]/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-playfair font-bold mb-6">
            Stop Losing Clients You Could Have Saved
          </h2>
          <p className="text-[#7a88a8] text-xl mb-8 max-w-2xl mx-auto">
            Start your free trial today. No credit card required. See your client health scores in minutes.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block px-10 py-4 bg-gradient-to-r from-[#38e8c8] to-[#4cc9f0] hover:from-[#2ed5b7] hover:to-[#3ab8dd] rounded-lg font-semibold text-lg text-white transition-all transform hover:scale-105"
          >
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a2540] py-12 px-4 sm:px-6 lg:px-8 bg-[#06090f]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 mb-8">
            <div>
              <h3 className="text-2xl font-playfair font-bold bg-gradient-to-r from-[#38e8c8] to-[#e74c3c] bg-clip-text text-transparent mb-2">
                ClientPulse
              </h3>
              <p className="text-[#7a88a8]">a product by Aurora</p>
            </div>
            <div className="flex flex-wrap gap-6 md:justify-end">
              <a href="https://helloaurora.ai/impressum.html" className="text-[#7a88a8] hover:text-white transition-colors">
                Impressum
              </a>
              <a href="https://helloaurora.ai/privacy.html" className="text-[#7a88a8] hover:text-white transition-colors">
                Privacy
              </a>
              <a href="https://helloaurora.ai/terms.html" className="text-[#7a88a8] hover:text-white transition-colors">
                Terms
              </a>
              <a href="https://helloaurora.ai/refund.html" className="text-[#7a88a8] hover:text-white transition-colors">
                Refund Policy
              </a>
            </div>
          </div>
          <div className="border-t border-[#1a2540] pt-8 text-center text-[#7a88a8] text-sm">
            <p>© 2026 Aurora AI Solutions Studio UG (haftungsbeschränkt)</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
