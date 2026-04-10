'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Shield,
  Users,
  Database,
  BarChart3,
  MessageSquare,
  Zap,
  Clock,
} from 'lucide-react';

export default function ContentPolicyPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'principles', label: 'Generation Principles' },
    { id: 'restrictions', label: 'What We Won&apos;t Generate' },
    { id: 'oversight', label: 'Human Oversight' },
    { id: 'data', label: 'Data Handling' },
    { id: 'accuracy', label: 'Accuracy & Limitations' },
    { id: 'disputes', label: 'Disputed Outputs' },
    { id: 'escalation', label: 'Escalation Path' },
    { id: 'review', label: 'Review Schedule' },
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
            Content Policy
          </h1>
          <div className="w-[120px]"></div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <p className="text-[#7a88a8] text-sm uppercase tracking-widest mb-4">
              AI Content Policy
            </p>
            <h1 className="text-5xl sm:text-6xl font-playfair font-bold mb-4">
              Content Policy
            </h1>
            <p className="text-xl text-[#7a88a8] max-w-2xl mb-6">
              Guidelines for AI-generated content in ClientPulse
            </p>
            <div className="flex gap-6 text-sm text-[#7a88a8]">
              <p>
                <span className="text-white font-semibold">Last updated:</span> April 2026
              </p>
              <p>
                <span className="text-white font-semibold">Next review:</span> July 2026
              </p>
            </div>
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
              {/* Section 1: Overview */}
              <section id="overview" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <BookOpen className="text-[#38e8c8] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Overview</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-4">
                  <p className="text-[#c0c7d1] leading-relaxed">
                    ClientPulse generates AI-powered outputs to help agencies manage client relationships effectively. This policy defines what content we generate, our principles for generation, and what we explicitly will not create.
                  </p>

                  <div className="border-t border-[#1a2540] pt-6 space-y-3">
                    <p className="text-white font-semibold">What ClientPulse generates:</p>
                    <ul className="ml-4 space-y-2 text-[#c0c7d1]">
                      <li>• <span className="font-semibold">Health Scores:</span> Composite 0–100 client health indicators</li>
                      <li>• <span className="font-semibold">Meeting Summaries:</span> Automated transcription and extraction of action items</li>
                      <li>• <span className="font-semibold">Churn Predictions:</span> Probability-based risk assessments</li>
                      <li>• <span className="font-semibold">Action Suggestions:</span> Proactive recommendations for client engagement</li>
                      <li>• <span className="font-semibold">Monday Briefs:</span> Weekly client summaries</li>
                      <li>• <span className="font-semibold">Save Plans:</span> Structured churn-prevention proposals</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section 2: Generation Principles */}
              <section id="principles" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Zap className="text-[#4cc9f0] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Generation Principles</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-6">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <CheckCircle size={20} className="text-[#38e8c8] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white mb-1">Accuracy over Speculation</p>
                        <p className="text-[#c0c7d1]">
                          We prioritize factual, data-grounded insights. We never guess or extrapolate beyond available signals.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <CheckCircle size={20} className="text-[#38e8c8] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white mb-1">Data-Grounded Only</p>
                        <p className="text-[#c0c7d1]">
                          All outputs reference concrete data points: financial records, meeting transcripts, engagement metrics.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <CheckCircle size={20} className="text-[#38e8c8] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white mb-1">No Fabricated Quotes</p>
                        <p className="text-[#c0c7d1]">
                          We never create fake client statements or meeting quotes. All quoted material is extracted from actual transcripts.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <CheckCircle size={20} className="text-[#38e8c8] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white mb-1">No Financial Advice</p>
                        <p className="text-[#c0c7d1]">
                          We do not generate financial recommendations, investment guidance, or tax advice.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <CheckCircle size={20} className="text-[#38e8c8] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white mb-1">No Legal Recommendations</p>
                        <p className="text-[#c0c7d1]">
                          We do not provide legal interpretations or contract advice.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: What We Will Not Generate */}
              <section id="restrictions" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <AlertTriangle className="text-[#e74c3c] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">What We Will Not Generate</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-white mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-[#e74c3c]" />
                        Discriminatory Content
                      </p>
                      <p className="text-[#c0c7d1] ml-6">
                        Content targeting protected classes (race, gender, religion, national origin, age, disability status, sexual orientation).
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-white mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-[#e74c3c]" />
                        Manipulation & Coercion
                      </p>
                      <p className="text-[#c0c7d1] ml-6">
                        Content designed to manipulate client relationships, coerce contract renewal, or exploit emotional pressure.
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-white mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-[#e74c3c]" />
                        Fake Testimonials
                      </p>
                      <p className="text-[#c0c7d1] ml-6">
                        Synthetic client feedback or fabricated success stories.
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-white mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-[#e74c3c]" />
                        Unsubstantiated Claims
                      </p>
                      <p className="text-[#c0c7d1] ml-6">
                        Claims about client intent, behavior, or future actions without evidence from data.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Human Oversight */}
              <section id="oversight" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Users className="text-[#7b8ff0] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Human Oversight</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-6">
                  <p className="text-[#c0c7d1] leading-relaxed">
                    All automated outputs requiring client communication are queued for human review and approval before delivery.
                  </p>

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#e74c3c]/10 flex items-center justify-center">
                        <span className="text-[#e74c3c] font-bold">1</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Content Generation</p>
                        <p className="text-[#c0c7d1]">
                          AI generates briefs, alerts, save plans, and meeting invitations
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#38e8c8]/10 flex items-center justify-center">
                        <span className="text-[#38e8c8] font-bold">2</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Approval Queue</p>
                        <p className="text-[#c0c7d1]">
                          Content held in approval dashboard for agency owner review
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#7b8ff0]/10 flex items-center justify-center">
                        <span className="text-[#7b8ff0] font-bold">3</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Human Review & Approval</p>
                        <p className="text-[#c0c7d1]">
                          Agency owner must explicitly approve each piece of content before it reaches the client
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4cc9f0]/10 flex items-center justify-center">
                        <span className="text-[#4cc9f0] font-bold">4</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Optional Auto-Approve</p>
                        <p className="text-[#c0c7d1]">
                          Once confidence is established, agency owners may opt-in to auto-approval for specific action types
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#1a2540] pt-6">
                    <p className="text-white font-semibold mb-2">Full Agency Control</p>
                    <p className="text-[#c0c7d1]">
                      Agency owners maintain full control over all client-facing communications. No outbound content is sent without explicit human authorization in the current sprint.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 5: Data Handling */}
              <section id="data" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Database className="text-[#7b8ff0] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Data Handling</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-6">
                  <div>
                    <p className="text-white font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle size={18} className="text-[#38e8c8]" />
                      Data We Process
                    </p>
                    <ul className="ml-6 space-y-2 text-[#c0c7d1]">
                      <li>• Meeting transcripts (audio → text via Whisper)</li>
                      <li>• Financial data from Stripe (invoices, payment history, disputes)</li>
                      <li>• Calendar data (meeting frequency and dates)</li>
                      <li>• Client metadata (name, contract value, engagement history)</li>
                      <li>• Agency owner contact information for communications</li>
                    </ul>
                  </div>

                  <div>
                    <p className="text-white font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle size={18} className="text-[#e74c3c]" />
                      Data We Do NOT Store
                    </p>
                    <ul className="ml-6 space-y-2 text-[#c0c7d1]">
                      <li>• Raw audio files (deleted after transcription)</li>
                      <li>• Personally identifiable information of end-clients beyond business name</li>
                      <li>• Biometric data</li>
                      <li>• Health or employment records</li>
                    </ul>
                  </div>

                  <div className="border-t border-[#1a2540] pt-6 space-y-3">
                    <div>
                      <p className="text-white font-semibold mb-1">Retention Policy</p>
                      <p className="text-[#c0c7d1]">
                        Client data retained for 24 months after contract termination; deletion available upon request. GDPR right-to-delete honored within 30 days.
                      </p>
                    </div>

                    <div>
                      <p className="text-white font-semibold mb-1">EU Hosting</p>
                      <p className="text-[#c0c7d1]">
                        All data processed and stored in Frankfurt, Germany (AWS EU region) for GDPR compliance.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 6: Accuracy & Limitations */}
              <section id="accuracy" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <BarChart3 className="text-[#4cc9f0] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Accuracy & Limitations</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold text-white mb-2">Health Scores are Probabilistic, Not Deterministic</p>
                      <p className="text-[#c0c7d1]">
                        Scores reflect trends and patterns, not certainties. A client with a health score of 45 is at elevated risk, but not guaranteed to churn.
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-white mb-2">Churn Predictions Based on Available Signals</p>
                      <p className="text-[#c0c7d1]">
                        Predictions depend on data quality and historical coverage. Clients with fewer than 30 days of history will have lower-confidence predictions.
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-white mb-2">Sentiment Analysis Limitations</p>
                      <p className="text-[#c0c7d1]">
                        English-only in v1.0; known limitations with sarcasm, cultural context, and tone.
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-white mb-2">Transcription Accuracy Varies</p>
                      <p className="text-[#c0c7d1]">
                        Whisper transcription quality depends on audio input quality and speaker diarization. Heavy accents, background noise, and technical jargon may reduce accuracy.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 7: Disputed Outputs */}
              <section id="disputes" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <MessageSquare className="text-[#e74c3c] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Disputed Outputs</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-4">
                  <p className="text-[#c0c7d1] leading-relaxed">
                    If an AI-generated output is inaccurate or misleading, users can flag it directly in the dashboard.
                  </p>

                  <div className="space-y-3 border-t border-[#1a2540] pt-6">
                    <div>
                      <p className="font-semibold text-white mb-1">Correction Workflow</p>
                      <p className="text-[#c0c7d1]">
                        Flagged outputs reviewed by support team within 48 hours. Corrections applied to future outputs.
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-white mb-1">Feedback Loop</p>
                      <p className="text-[#c0c7d1]">
                        All corrections and disputes logged and used to improve model behavior and decision logic.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 8: Escalation Path */}
              <section id="escalation" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Shield className="text-[#7b8ff0] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Escalation Path</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-4">
                  <p className="text-[#c0c7d1] leading-relaxed">
                    Users may dispute any AI-generated output and request human review.
                  </p>

                  <div className="space-y-4 border-t border-[#1a2540] pt-6">
                    <div>
                      <p className="text-white font-semibold mb-1">Contact for AI Decisions</p>
                      <p className="text-[#c0c7d1] mb-2">
                        <a
                          href="mailto:hello@helloaurora.ai"
                          className="text-[#38e8c8] hover:underline"
                        >
                          hello@helloaurora.ai
                        </a>
                      </p>
                      <p className="text-[#7a88a8] text-sm">
                        Subject: &ldquo;AI Output Dispute&rdquo; + specific health score ID or output reference
                      </p>
                    </div>

                    <div>
                      <p className="text-white font-semibold mb-1">Response Time</p>
                      <p className="text-[#c0c7d1]">48-hour acknowledgment; 5-business-day resolution target</p>
                    </div>

                    <div>
                      <p className="text-white font-semibold mb-1">Right to Human Review</p>
                      <p className="text-[#c0c7d1]">
                        Any user may request human review of any AI-generated output. A member of the Aurora team will manually re-evaluate the decision.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 9: Review Schedule */}
              <section id="review" className="scroll-mt-24">
                <div className="flex items-start gap-3 mb-6">
                  <Clock className="text-[#38e8c8] flex-shrink-0 mt-1" size={24} />
                  <h2 className="text-4xl font-playfair font-bold">Review Schedule</h2>
                </div>

                <div className="bg-[#0d1422]/50 border border-[#1a2540] rounded-lg p-8 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-white font-semibold mb-1">Quarterly Content Review</p>
                      <p className="text-[#c0c7d1]">
                        All output categories (health scores, predictions, summaries) evaluated for accuracy and bias every three months.
                      </p>
                    </div>

                    <div>
                      <p className="text-white font-semibold mb-1">Annual Bias Audit</p>
                      <p className="text-[#c0c7d1]">
                        Comprehensive evaluation of potential fairness issues across demographic and business segments.
                      </p>
                    </div>

                    <div>
                      <p className="text-white font-semibold mb-1">Changelog & Transparency</p>
                      <p className="text-[#c0c7d1]">
                        All policy updates, model improvements, and bias assessments logged and publicly disclosed.
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-[#1a2540] pt-6 space-y-2">
                    <div>
                      <p className="text-white font-semibold">Last Updated</p>
                      <p className="text-[#c0c7d1]">April 2026</p>
                    </div>
                    <div>
                      <p className="text-white font-semibold">Next Review</p>
                      <p className="text-[#c0c7d1]">July 2026</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Footer CTA */}
              <div className="border-t border-[#1a2540] pt-12 mt-12">
                <p className="text-[#c0c7d1] mb-4">
                  For more details on our AI systems and oversight, see our{' '}
                  <Link
                    href="/model-card"
                    className="text-[#38e8c8] hover:underline font-semibold"
                  >
                    Model Card
                  </Link>
                  .
                </p>
              </div>
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
              Content Policy: April 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
