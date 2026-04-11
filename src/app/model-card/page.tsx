'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Zap,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle,
  Users,
  Code,
  Database,
  Eye,
  Mail,
  FileText,
} from 'lucide-react';

export default function ModelCardPage() {
  const [activeSection, setActiveSection] = useState('product');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  const navItems = [
    { id: 'product', label: 'Product Description' },
    { id: 'systems', label: 'AI Systems' },
    { id: 'data', label: 'Data Processed' },
    { id: 'risk', label: 'Risk Classification' },
    { id: 'controls', label: 'Human-in-the-Loop' },
    { id: 'transparency', label: 'Transparency' },
    { id: 'bias', label: 'Bias & Fairness' },
    { id: 'limitations', label: 'Limitations' },
    { id: 'contact', label: 'Contact & Review' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#06090f] to-[#0a0d15] text-white font-outfit">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full bg-[#06090f]/80 backdrop-blur-md border-b border-[#1a2540]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ArrowLeft size={20} className="text-[#38e8c8]" />
            <span className="text-sm font-semibold text-[#7a88a8]">Back to ClientPulse</span>
          </Link>
          <h1 className="text-xl font-playfair font-bold bg-gradient-to-r from-[#38e8c8] to-[#e74c3c] bg-clip-text text-transparent">
            Model Card
          </h1>
          <div className="w-[120px]"></div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <p className="text-[#7a88a8] text-sm uppercase tracking-widest mb-4">Sprint 4 Compliance</p>
            <h1 className="text-5xl sm:text-6xl font-playfair font-bold mb-4">AI Model Card</h1>
            <p className="text-xl text-[#7a88a8] max-w-2xl">
              ClientPulse AI Model Card - California AI Executive Order Transparency Requirements
            </p>
          </div>

          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-6">
                <p className="text-xs uppercase tracking-widest text-[#7a88a8] font-semibold mb-4">
                  Sections
                </p>
                <nav className="space-y-2">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`block w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        activeSection === item.id
                          ? 'bg-[#e74c3c]/10 text-[#e74c3c] font-semibold'
                          : 'text-[#7a88a8] hover:text-white hover:bg-[#1a2540]/50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-12">
              {/* Section 1: Product Description */}
              <section id="product" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Zap className="text-[#38e8c8] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Product Description</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-4">
                  <div>
                    <p className="text-[#7a88a8] text-sm uppercase tracking-widest font-semibold mb-2">
                      Product Name
                    </p>
                    <p className="text-white text-lg">ClientPulse by Aurora AI Solutions Studio UG</p>
                  </div>
                  <div>
                    <p className="text-[#7a88a8] text-sm uppercase tracking-widest font-semibold mb-2">
                      Version & Classification Date
                    </p>
                    <p className="text-white">Version 1.0 (Beta) | Classification Date: April 10, 2026</p>
                  </div>
                  <div>
                    <p className="text-[#7a88a8] text-sm uppercase tracking-widest font-semibold mb-2">
                      What It Does
                    </p>
                    <p className="text-[#c0c7d1] leading-relaxed">
                      ClientPulse is an AI-powered Client Health Intelligence platform that combines financial,
                      relationship, delivery, and engagement signals into a composite Client Health Score (0–100).
                      The system predicts client churn, identifies upsell opportunities, and generates AI-recommended
                      action plans—all requiring explicit human approval before any client-facing communication.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 2: AI Systems */}
              <section id="systems" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Code className="text-[#4cc9f0] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">AI Systems Used</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#0a0d15] border-b border-[#1a2540]">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-[#7a88a8] uppercase tracking-widest">
                            Agent
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-[#7a88a8] uppercase tracking-widest">
                            Function
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-[#7a88a8] uppercase tracking-widest">
                            Data Source
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a2540]">
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">Financial Signal Agent</td>
                          <td className="px-6 py-4 text-[#c0c7d1]">
                            Analyzes Stripe invoicing data; calculates financial health sub-score (30% weight)
                          </td>
                          <td className="px-6 py-4 text-[#7a88a8]">Stripe API</td>
                        </tr>
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">Meeting Intelligence Agent</td>
                          <td className="px-6 py-4 text-[#c0c7d1]">
                            Transcription + extraction: sentiment (1–10), action items, scope changes, escalations
                          </td>
                          <td className="px-6 py-4 text-[#7a88a8]">Whisper + Claude Sonnet</td>
                        </tr>
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">Health Scoring Agent</td>
                          <td className="px-6 py-4 text-[#c0c7d1]">
                            Composite 0–100 score from Financial (30%), Relationship (30%), Delivery (25%), Engagement (15%)
                          </td>
                          <td className="px-6 py-4 text-[#7a88a8]">All signals</td>
                        </tr>
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">Churn Prediction Agent</td>
                          <td className="px-6 py-4 text-[#c0c7d1]">
                            Probability (0–100%) per client based on multi-signal pattern matching
                          </td>
                          <td className="px-6 py-4 text-[#7a88a8]">Claude Sonnet</td>
                        </tr>
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">Upsell Detection Agent</td>
                          <td className="px-6 py-4 text-[#c0c7d1]">
                            Transcript analysis for expansion signals and cross-sell opportunities
                          </td>
                          <td className="px-6 py-4 text-[#7a88a8]">Claude Sonnet</td>
                        </tr>
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">Monday Brief Agent</td>
                          <td className="px-6 py-4 text-[#c0c7d1]">
                            Weekly summary generation with action proposals (requires approval)
                          </td>
                          <td className="px-6 py-4 text-[#7a88a8]">Claude Sonnet</td>
                        </tr>
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">Action Proposal Engine</td>
                          <td className="px-6 py-4 text-[#c0c7d1]">
                            Auto-drafts save plans and retention actions for at-risk clients
                          </td>
                          <td className="px-6 py-4 text-[#7a88a8]">Claude Sonnet</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-[#1a2540] p-8 bg-[#06090f]">
                    <p className="text-[#7a88a8] text-sm uppercase tracking-widest font-semibold mb-4">
                      Model Configuration
                    </p>
                    <div className="space-y-2 text-[#c0c7d1]">
                      <p><span className="text-white font-semibold">Primary Model:</span> Anthropic Claude Sonnet (analysis, scoring, prediction)</p>
                      <p><span className="text-white font-semibold">Transcription:</span> OpenAI Whisper API</p>
                      <p><span className="text-white font-semibold">Temperature (Scoring/Prediction):</span> 0.3 (deterministic)</p>
                      <p><span className="text-white font-semibold">Temperature (Brief Generation):</span> 0.7 (creative)</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: Data Processed */}
              <section id="data" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Database className="text-[#7b8ff0] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Data Processed</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8">
                  <div className="space-y-4">
                    <div className="pb-4 border-b border-[#1a2540]">
                      <p className="text-white font-semibold mb-2 flex items-center gap-2">
                        <CheckCircle size={18} className="text-[#38e8c8]" />
                        Processed Data Types
                      </p>
                      <ul className="ml-8 space-y-2 text-[#c0c7d1]">
                        <li>• Client financial data via Stripe API (invoices, payments, disputes)</li>
                        <li>• Meeting audio recordings (uploaded by agency, processed via Whisper, stored in Supabase)</li>
                        <li>• Meeting transcripts (extracted text, stored per-client)</li>
                        <li>• Client metadata (name, contract value, engagement history)</li>
                        <li>• Agency owner email for communications</li>
                      </ul>
                    </div>

                    <div className="pt-4">
                      <p className="text-white font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-[#e74c3c]" />
                        NOT Collected
                      </p>
                      <ul className="ml-8 space-y-2 text-[#c0c7d1]">
                        <li>• PII of agency&apos;s end-clients (only business names)</li>
                        <li>• Biometric data</li>
                        <li>• Health insurance or employment data</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Risk Classification */}
              <section id="risk" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Shield className="text-[#b388eb] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Risk Classification</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#0a0d15] border-b border-[#1a2540]">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-[#7a88a8] uppercase tracking-widest">
                            Framework
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-[#7a88a8] uppercase tracking-widest">
                            Classification
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-[#7a88a8] uppercase tracking-widest">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a2540]">
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">EU AI Act</td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-3 py-1 rounded bg-[#4cc9f0]/10 text-[#4cc9f0] text-sm font-semibold">
                              Limited Risk (Article 52)
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#c0c7d1] text-sm">
                            AI-driven scoring requires transparency obligations; not high-risk but above minimal
                          </td>
                        </tr>
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">California AI Executive Order</td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-3 py-1 rounded bg-[#e74c3c]/10 text-[#e74c3c] text-sm font-semibold">
                              Moderate Risk
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#c0c7d1] text-sm">
                            Health Score + Churn Prediction are AI assessments of business relationships; requires transparency & bias documentation
                          </td>
                        </tr>
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">Colorado AI Act</td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-3 py-1 rounded bg-[#e74c3c]/10 text-[#e74c3c] text-sm font-semibold">
                              Potentially Applicable
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#c0c7d1] text-sm">
                            Effective June 30, 2026. Churn-based action proposals could constitute &ldquo;consequential decisions.&rdquo; Bias assessment required.
                          </td>
                        </tr>
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">AMERICA AI Act (Draft)</td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-3 py-1 rounded bg-[#e74c3c]/10 text-[#e74c3c] text-sm font-semibold">
                              Moderate Risk
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#c0c7d1] text-sm">
                            Scoring system with measurable business impact
                          </td>
                        </tr>
                        <tr className="hover:bg-[#1a2540]/30 transition-colors">
                          <td className="px-6 py-4 text-white font-semibold">GDPR / EU Data Protection</td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-3 py-1 rounded bg-[#38e8c8]/10 text-[#38e8c8] text-sm font-semibold">
                              Compliant
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#c0c7d1] text-sm">
                            EU hosting (Frankfurt), data minimization, right-to-delete
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* Section 5: Human-in-the-Loop Controls */}
              <section id="controls" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Users className="text-[#4cc9f0] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Human-in-the-Loop Controls</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-6">
                  <p className="text-[#c0c7d1] leading-relaxed">
                    All automated outbound actions are queued in an approval system requiring explicit human authorization:
                  </p>

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#e74c3c]/10 flex items-center justify-center">
                        <span className="text-[#e74c3c] font-bold">1</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Action Queuing</p>
                        <p className="text-[#c0c7d1]">Monday Brief emails, churn alerts, save plans, check-in invites are drafted and held for review</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#38e8c8]/10 flex items-center justify-center">
                        <span className="text-[#38e8c8] font-bold">2</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Human Approval Required</p>
                        <p className="text-[#c0c7d1]">Agency owner must explicitly approve each action before it reaches client</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#7b8ff0]/10 flex items-center justify-center">
                        <span className="text-[#7b8ff0] font-bold">3</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Optional Auto-Approve</p>
                        <p className="text-[#c0c7d1]">Per-action-type auto-approve toggle available once trust is established</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#1a2540] pt-6 mt-6">
                    <p className="text-[#e74c3c] font-semibold flex items-center gap-2 mb-3">
                      <AlertTriangle size={18} />
                      No Autonomous Communication
                    </p>
                    <p className="text-[#c0c7d1]">
                      Zero client-facing outbound communication is sent without explicit human approval in this sprint
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 6: Transparency Measures */}
              <section id="transparency" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Eye className="text-[#38e8c8] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Transparency Measures</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8">
                  <div className="space-y-4">
                    <div className="flex gap-4 pb-4 border-b border-[#1a2540]">
                      <FileText size={20} className="text-[#e74c3c] flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-white mb-1">AI-Generated Disclosures</p>
                        <p className="text-[#c0c7d1]">All health scores clearly labeled as &ldquo;AI-generated using financial, relationship, and delivery signals&rdquo;</p>
                      </div>
                    </div>

                    <div className="flex gap-4 pb-4 border-b border-[#1a2540]">
                      <BarChart3 size={20} className="text-[#4cc9f0] flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-white mb-1">Signal Source Display</p>
                        <p className="text-[#c0c7d1]">Each score shows which data sources contributed to the final calculation</p>
                      </div>
                    </div>

                    <div className="flex gap-4 pb-4 border-b border-[#1a2540]">
                      <Code size={20} className="text-[#7b8ff0] flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-white mb-1">Audit Logging</p>
                        <p className="text-[#c0c7d1]">All AI-driven recommendations logged with input data, model version, and timestamp</p>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                      <FileText size={20} className="text-[#b388eb] flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-white mb-1">Public Model Card</p>
                        <p className="text-[#c0c7d1]">This page is publicly accessible and linked from Impressum and in-app footer</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 7: Bias & Fairness */}
              <section id="bias" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <AlertTriangle className="text-[#e74c3c] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Bias & Fairness</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-white font-semibold mb-2">Algorithm Foundation</p>
                      <p className="text-[#c0c7d1]">
                        Health Score algorithm uses only objective business metrics: payment timeliness, meeting frequency,
                        contract value trends, no demographic or protected-class data
                      </p>
                    </div>

                    <div>
                      <p className="text-white font-semibold mb-2">Data Restrictions</p>
                      <p className="text-[#c0c7d1]">
                        No collection or use of demographic, racial, gender, or protected-class information
                      </p>
                    </div>

                    <div>
                      <p className="text-white font-semibold mb-2">Bias Impact Assessment</p>
                      <p className="text-[#c0c7d1]">
                        Conducted per Colorado AI Act requirements (see <code className="bg-[#0a0d15] px-2 py-1 rounded text-[#38e8c8]">/docs/BIAS-IMPACT-ASSESSMENT.md</code>)
                      </p>
                    </div>

                    <div>
                      <p className="text-white font-semibold mb-2">Review Cadence</p>
                      <p className="text-[#c0c7d1]">
                        Quarterly evaluation; A3 + D3 evaluation tests serve as regulatory canaries
                      </p>
                    </div>

                    <div>
                      <p className="text-white font-semibold mb-2">Future Work (Sprint 5)</p>
                      <p className="text-[#c0c7d1]">
                        Synthetic test cohort evaluation planned to measure fairness across client segments
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 8: Limitations & Known Issues */}
              <section id="limitations" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <AlertTriangle className="text-[#e87fa5] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Limitations & Known Issues</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <span className="text-[#e74c3c] font-bold flex-shrink-0">•</span>
                      <p className="text-[#c0c7d1]">
                        <span className="font-semibold text-white">Health Score Accuracy:</span> Depends on data completeness;
                        clients with &lt;3 meetings and no Stripe connection will have lower-confidence scores
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <span className="text-[#e74c3c] font-bold flex-shrink-0">•</span>
                      <p className="text-[#c0c7d1]">
                        <span className="font-semibold text-white">Churn Prediction:</span> Requires minimum 30 days of history per client
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <span className="text-[#e74c3c] font-bold flex-shrink-0">•</span>
                      <p className="text-[#c0c7d1]">
                        <span className="font-semibold text-white">Transcription Quality:</span> Depends on audio quality and speaker diarization accuracy
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <span className="text-[#e74c3c] font-bold flex-shrink-0">•</span>
                      <p className="text-[#c0c7d1]">
                        <span className="font-semibold text-white">Language Support:</span> Sentiment analysis is English-only in v1.0
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <span className="text-[#e74c3c] font-bold flex-shrink-0">•</span>
                      <p className="text-[#c0c7d1]">
                        <span className="font-semibold text-white">Recursive Learning:</span> Self-calibration requires 50+ client outcomes—not available until Sprint 6
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 9: Contact & Review */}
              <section id="contact" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Mail className="text-[#7b8ff0] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Contact & Review</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8">
                  <div className="space-y-6">
                    <div>
                      <p className="text-[#7a88a8] text-sm uppercase tracking-widest font-semibold mb-2">
                        Contact for Questions
                      </p>
                      <p className="text-white text-lg font-semibold">
                        <a href="mailto:hello@helloaurora.ai" className="text-[#38e8c8] hover:underline">
                          hello@helloaurora.ai
                        </a>
                      </p>
                    </div>

                    <div className="border-t border-[#1a2540] pt-6">
                      <p className="text-[#7a88a8] text-sm uppercase tracking-widest font-semibold mb-2">
                        Review Cycle
                      </p>
                      <p className="text-[#c0c7d1] mb-2">Quarterly assessment of model performance, bias indicators, and regulatory changes</p>
                      <p className="text-white">Next review: <span className="font-semibold">July 2026</span></p>
                    </div>

                    <div className="border-t border-[#1a2540] pt-6">
                      <p className="text-[#7a88a8] text-sm uppercase tracking-widest font-semibold mb-2">
                        Regulatory Monitoring
                      </p>
                      <p className="text-[#c0c7d1]">Active monitoring for:</p>
                      <ul className="ml-4 mt-2 space-y-1 text-[#c0c7d1]">
                        <li>• EU AI Act (compliance target)</li>
                        <li>• California AI Executive Order (compliance target)</li>
                        <li>• Colorado AI Act (effective June 30, 2026)</li>
                        <li>• AMERICA AI Act (draft tracking)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1a2540] bg-[#06090f]/50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-playfair font-bold mb-4">ClientPulse</h3>
              <p className="text-[#7a88a8] text-sm">
                AI Client Health Intelligence for agencies managing 5–50 clients.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Quick Links</h3>
              <nav className="space-y-2">
                <Link href="/" className="text-[#7a88a8] hover:text-white text-sm transition-colors">
                  Home
                </Link>
                <Link href="/auth/login" className="text-[#7a88a8] hover:text-white text-sm transition-colors">
                  Sign In
                </Link>
              </nav>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Legal</h3>
              <div className="space-y-2 text-sm">
                <p className="text-[#7a88a8]">
                  Aurora AI Solutions Studio UG (haftungsbeschränkt)
                </p>
                <p className="text-[#7a88a8]">
                  Contact: <a href="mailto:hello@helloaurora.ai" className="text-[#38e8c8] hover:underline">
                    hello@helloaurora.ai
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-[#1a2540] pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-[#7a88a8] text-sm">
              &copy; 2026 Aurora AI Solutions Studio UG. All rights reserved.
            </p>
            <p className="text-[#7a88a8] text-sm">
              Model Card Classification Date: April 10, 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
