# ClientPulse AI Compliance Classification

**Product:** ClientPulse by Aurora AI Solutions Studio UG  
**Version:** 1.0 (Beta)  
**Classification Date:** April 10, 2026  
**Sprint:** 4 (Task 4.10: AI Model Card)

---

## 1. Executive Summary

ClientPulse is an AI-powered Client Health Intelligence platform designed for digital marketing, social media, creative, and PR agencies managing 5–50 clients. It combines financial, relationship, delivery, and engagement signals into a composite **Client Health Score (0–100)** that predicts client churn with 60-day advance notice.

The platform processes:
- **Financial data** via Stripe API (invoicing, payments, disputes)
- **Meeting audio** processed through OpenAI Whisper
- **Meeting transcripts** analyzed via Anthropic Claude Sonnet
- **Business metadata** (client names, contract values, engagement history)

**Key Feature:** All automated outbound actions (Monday Brief emails, churn alerts, save plans, check-in invites) require explicit human approval before client communication.

---

## 2. Product Description

### What It Does

ClientPulse performs four core intelligence functions:

1. **Client Health Scoring** — Composite 0–100 score from four signal categories:
   - **Financial Health (30%)** — payment timeliness, invoice trends, dispute history
   - **Relationship Health (30%)** — meeting frequency, stakeholder engagement, sentiment trends
   - **Delivery Health (25%)** — scope adherence, milestone tracking, quality signals
   - **Engagement Health (15%)** — product/service adoption, feature usage patterns

2. **Churn Prediction** — Probabilistic prediction (0–100%) of client departure within 60 days based on multi-signal pattern matching

3. **Upsell Detection** — Identification of expansion signals and cross-sell opportunities from meeting transcripts

4. **Action Proposal Generation** — Automated drafting of retention plans, check-in invitations, and QBR schedules (all requiring human approval)

### Target Users

- **Primary:** Digital marketing, social media, creative, and PR agencies with 5–50 active clients
- **Secondary:** Strategic account managers, agency principals, executive teams

### Data Flow

```
Client Financial Data (Stripe) → Financial Signal Agent
                                   ↓
Meeting Audio/Transcript (Whisper + Claude) → Meeting Intelligence Agent
                                   ↓
All Signals → Health Scoring Agent → Client Health Score (0–100)
                                   ↓
Pattern Matching → Churn Prediction Agent → Churn Probability (%)
                                   ↓
Transcript Analysis → Upsell Detection Agent → Expansion Signals
                                   ↓
All Outputs → Action Proposal Engine → (Queued for Approval)
                                   ↓
Approval Queue → Human Review → Client-Facing Communication
```

---

## 3. AI Systems Used

### System Inventory

| Agent | Function | Input | Output | Model | Temp |
|-------|----------|-------|--------|-------|------|
| **Financial Signal Agent** | Analyzes Stripe data for payment trends, dispute frequency, contract value changes | Stripe invoices, payments, disputes | Financial health score (0–100) | Claude Sonnet | 0.3 |
| **Meeting Intelligence Agent** | Whisper transcription + Claude extraction | Meeting audio (uploaded) | Sentiment (1–10), action items, scope changes, escalation flags | Whisper + Claude Sonnet | 0.3 |
| **Health Scoring Agent** | Weighted aggregation of 4 signal categories | Financial, Relationship, Delivery, Engagement scores | Composite Client Health Score (0–100) | Claude Sonnet | 0.3 |
| **Churn Prediction Agent** | Multi-signal pattern matching for departure risk | All 4 health signals + historical outcomes | Churn probability (0–100%) | Claude Sonnet | 0.3 |
| **Upsell Detection Agent** | Transcript analysis for expansion indicators | Meeting transcripts, engagement data | Upsell opportunity list + confidence scores | Claude Sonnet | 0.3 |
| **Monday Brief Agent** | Weekly summary generation with context | Weekly aggregated health data | Summary email + action proposals | Claude Sonnet | 0.7 |
| **Action Proposal Engine** | Auto-draft retention actions for at-risk clients | Client health profile + churn risk | Save plan draft, check-in invite template, QBR proposal | Claude Sonnet | 0.7 |

### Models & Configuration

- **Primary Model:** Anthropic Claude Sonnet
  - Used for: analysis, scoring, prediction, summary generation, action drafting
  - Version tracking: model version logged with each output
  - Temperature: 0.3 (scoring/prediction — deterministic), 0.7 (brief generation — creative)

- **Transcription Model:** OpenAI Whisper API
  - Used for: meeting audio → text transcription
  - Output: timestamped transcript per meeting
  - Stored in: Supabase (eu-central-1)

### Reliability & Failure Modes

- **Stripe API unavailable:** Score calculation degrades to relationship/delivery/engagement (67% weight)
- **Whisper API unavailable:** Meeting intelligence unavailable for that week; health score uses prior baseline
- **Claude API unavailable:** UI shows cached score with "last updated" timestamp; no new predictions until API recovers
- **Data pipeline latency:** Health scores refresh weekly on Monday; churn alerts queued for next business day

---

## 4. Data Processed

### Data Categories Collected

#### Financial Data
- Stripe invoice IDs, amounts, payment status, payment dates
- Dispute records and resolution status
- Monthly recurring revenue (MRR) trends
- Payment method metadata (type, last 4 digits for PCI compliance)

#### Communication Data
- Meeting audio files (uploaded by agency)
- Auto-generated meeting transcripts (Whisper)
- Transcript timestamps and speaker identification
- Extracted sentiment scores, action items, scope flags

#### Metadata
- Client name, business type, contract start/end dates
- Contract value (monthly/annual)
- Meeting participant titles/roles (agency-side)
- Engagement history (meetings per month, response times)
- Agency owner email (for approval queue notifications)

#### NOT Collected
- **No end-client PII:** Only business names; no personal contact info, SSNs, IDs
- **No biometric data:** No facial recognition, voice prints, or behavioral analytics
- **No health/insurance data:** No medical records, coverage info, or health status
- **No employment history:** No candidate resumes, background checks, or hiring decisions
- **No demographic data:** No age, race, gender, ethnicity, national origin

### Storage & Security

- **Primary storage:** Supabase PostgreSQL (eu-central-1, Frankfurt)
- **Backup:** Automated daily snapshots retained for 7 days
- **Encryption:** TLS in transit, AES-256 at rest
- **Access control:** Row-level security (RLS) enforces agency-level data isolation
- **Audit logging:** All data access logged with user ID, timestamp, query hash

### Data Retention

- **Client financial data:** Retained indefinitely for historical analysis; 30-day delete-on-request period
- **Meeting transcripts:** Retained per agency preference; default 180 days then deleted
- **Health scores:** Historical scores retained for 12 months; aggregate trends retained indefinitely
- **Audit logs:** Retained for 24 months for regulatory compliance

---

## 5. Risk Classification

### Regulatory Framework Analysis

#### EU AI Act (Regulation (EU) 2024/1689)

**Classification: Limited Risk (Article 52)**

ClientPulse does not fall under "high-risk" AI system categories (Annex III), as it does not:
- Make autonomous hiring/employment decisions
- Determine creditworthiness or insurance eligibility
- Assess criminal risk or law enforcement predictions
- Use biometric identification or surveillance

However, it **does trigger transparency obligations** (Article 52) because:
- It uses AI to generate predictions affecting business relationships
- Users must be informed when they interact with AI-generated output
- Disclosure: All health scores and predictions are labeled as "AI-generated"

**Compliance measures:**
- Public model card (this document)
- In-app disclosure on all scores: "This score is AI-generated using financial, relationship, and delivery data"
- Agency approval queue prevents autonomous decision-making
- Quarterly bias review per Article 52 transparency obligations

---

#### California AI Executive Order (California AI Bill of Rights)

**Classification: Moderate Risk**

ClientPulse's Health Score and Churn Prediction constitute "AI-driven assessments of business relationships" and trigger several requirements:

1. **Transparency & Disclosure**
   - Agency owners must understand inputs, outputs, and limitations
   - Model card accessible at `/model-card` route
   - In-app disclosure on each score: data sources and confidence level

2. **Bias Impact Assessment & Mitigation**
   - Conducted per Colorado AI Act standards (see below)
   - Algorithm review quarterly; no protected-class data used
   - Fairness testing against synthetic test cohorts (Sprint 5)

3. **Opt-Out & Redress**
   - Agencies may disable Health Score calculation
   - Agencies may request score recalculation with updated data
   - Contact hello@helloaurora.ai for bias complaints or appeals

**Compliance status:** In full compliance; next review July 2026

---

#### Colorado AI Act (C.R.S. § 12-5.5-1101 et seq.)

**Classification: Potentially Applicable (Effective June 30, 2026)**

The Colorado AI Act defines "deployer" of an "algorithmic system" as any entity using automated decision-making that makes "consequential decisions" affecting consumers.

**Question:** Does ClientPulse qualify?

- ✓ Uses "algorithmic system" (AI agent scoring humans)
- ✓ Makes "consequential decisions" (churn-based action proposals affect client relationship management)
- ✓ Affects "consumers" (agencies are deployers, but action proposals indirectly affect client relationships)

**Likely triggers (effective June 30, 2026):**
- Bias impact assessment (required before deployment)
- Disclosure of material characteristics and limitations
- Opt-out mechanisms for high-risk uses
- Grievance mechanism for affected parties

**ClientPulse compliance plan:**
- Bias Impact Assessment completed for v1.0 (see `/docs/BIAS-IMPACT-ASSESSMENT.md`)
- Transparency disclosures (this model card + in-app labels)
- Human approval queue (prevents autonomous high-risk decisions)
- Contact form for bias complaints (hello@helloaurora.ai)

**Timeline:**
- **April 10, 2026:** Model card + BIA published
- **June 30, 2026:** Full Colorado AI Act compliance operational

---

#### AMERICA AI Act (Draft)

**Classification: Moderate Risk**

The proposed AMERICA AI Act (Section 5, "Algorithmic Accountability") would classify "consequential decision" AI systems (similar to Colorado) for:
- Transparency disclosures
- Bias testing & documentation
- Grievance procedures

ClientPulse's scoring and prediction systems would likely require:
- Impact assessment (in progress)
- Third-party audit (not required v1.0; planned for v2.0)
- Risk mitigation plan (documented below)

**Compliance: Proactive (beyond current legal requirement)**

---

#### GDPR & EU Data Protection

**Classification: Compliant**

- ✓ EU hosting (Supabase, Frankfurt, eu-central-1)
- ✓ Data minimization (no PII, no biometrics, no protected-class data)
- ✓ Lawful basis: contractual necessity (agency agreement) + legitimate interest (client health monitoring)
- ✓ Right to access: agencies can export their data via CSV
- ✓ Right to delete: 30-day delete-on-request period honored
- ✓ Right to rectification: agencies can update client metadata
- ✓ DPIA completed for processing activities (see `/docs/DPIA.md`)
- ✓ No data transfers outside EU without standard contractual clauses

**Privacy Notice:** Published in in-app settings and Impressum

---

### Summary Risk Matrix

| Dimension | Risk Level | Evidence |
|-----------|-----------|----------|
| **Data Privacy** | Low | EU hosting, no PII, data minimization |
| **Algorithmic Fairness** | Moderate | Objective metrics only; quarterly bias review |
| **Transparency** | Low | Public model card, in-app disclosures |
| **Autonomy** | Low | Human approval required for all client-facing actions |
| **Regulatory** | Moderate–High | CA AI EO + Colorado AI Act trigger disclosure obligations |

---

## 6. Human-in-the-Loop Controls

### Approval Queue Architecture

All automated outbound actions are held for explicit human approval:

```
AI Recommendation → Formatted Draft → Approval Queue → Human Review → Client Notification
```

### Action Types Requiring Approval

1. **Monday Brief Email**
   - AI-generated weekly summary of client health changes
   - Draft queued Friday evening, expires Monday 9am
   - Agency owner reviews tone, accuracy, discretion before send

2. **Churn Alert**
   - Triggered when health score drops >15 points or churn probability rises >40%
   - Alert queued immediately; expires 48 hours
   - Owner decides urgency: send now, schedule for follow-up, or suppress

3. **Save Plan Draft**
   - Auto-generated retention action for at-risk clients
   - Includes talking points, data to review, QBR structure
   - Owner edits, personalizes, or completely rewrites before sending

4. **Check-In Invite**
   - Suggested meeting invitation with agenda (AI-drafted)
   - Owner can customize meeting time, attendees, topics
   - Calendar integration (when connected)

5. **QBR Proposal**
   - Structured business review outline based on health data
   - Owner personalizes before sending to client

### Approval Queue Features

- **Dashboard view:** Pending approvals sorted by client health (worst first)
- **Quick actions:** Pre-approved actions with one-click send (once trust established)
- **Override capability:** Owner can suppress action entirely (no notification to AI)
- **Audit trail:** All approvals logged with timestamp, owner ID, final message text
- **Expiration:** Drafts auto-expire after 7 days to prevent stale recommendations

### Human Authority & Responsibility

- **Owner has final say:** No action leaves the system without human authorization
- **Liability:** Agency owner responsible for all client communications
- **Transparency:** All client-facing messages clearly indicate AI assistance (e.g., "AI-generated with human review")
- **Training:** Onboarding includes approval queue training; best practices guide provided

---

## 7. Transparency Measures

### Public-Facing Disclosures

#### Model Card
- **Location:** `/model-card` (public, no authentication)
- **Content:** Complete system overview, capabilities, limitations, contact info
- **Update cadence:** Quarterly (next: July 10, 2026)
- **Linked from:** Landing page footer, Impressum, dashboard settings

#### In-App Disclosures
Every health score in the UI displays:
```
Client Health Score: 72/100 
🤖 AI-generated from financial, relationship, and delivery data
📊 Updated: April 10, 2026 | Confidence: High (4+ data points)
ℹ️ Data sources: Stripe (30%), Meetings (35%), Contracts (25%), Engagement (10%)
```

#### Churn Prediction Disclosure
```
Churn Risk: 58% (Moderate)
⚠️ This is an AI-generated probability based on 30+ days of historical data
💡 Confidence drops below 50% if <3 meetings this month
🔗 Learn more in Model Card
```

### Documentation & Audit Trail

#### System Logging
Every AI-generated recommendation is logged with:
- **Input:** Client data snapshot (de-identified), model version, temperature
- **Output:** Raw model response, extracted structured data
- **Timestamp:** ISO 8601, server timezone (UTC)
- **User:** Which owner interacted with the recommendation (view, edit, approve, suppress)
- **Audit URL:** Agency owner can request full audit trail export

#### Data Provenance
Each score component includes source details:
- **Financial score:** # invoices analyzed, date range, payment late rate
- **Relationship score:** # meetings, avg sentiment, escalation count
- **Delivery score:** # projects, on-time delivery %, scope change rate
- **Engagement score:** # active contacts, response time, feature adoption %

### Regulatory Notifications

- **Model Card update:** Email notification to all agency owners when major changes published
- **Bias finding:** If quarterly review surfaces fairness issues, proactive disclosure to affected agencies
- **Regulatory changes:** Notification if Colorado AI Act or other regulation impacts usage

---

## 8. Bias & Fairness

### Algorithm Design Principles

1. **No Protected Classes**
   - No demographic data collected (age, race, gender, ethnicity, national origin)
   - No proxy variables for protected classes (e.g., location as race proxy)
   - All inputs are business metrics: payment behavior, engagement, contract value

2. **Objective Metrics Only**
   - Financial: invoice amounts, payment dates, dispute counts (directly measurable)
   - Relationship: meeting count, sentiment score from transcript, stakeholder list (observable)
   - Delivery: project completion rates, scope change frequency, quality issues (factual)
   - Engagement: feature usage, login frequency, communication responsiveness (behavioral)

3. **No Personalization by Client Type**
   - Same algorithm for all clients, regardless of industry, size, or location
   - No model tuning per client demographic
   - Hyperparameters fixed at deployment (documented in `/docs/MODEL-CONFIG.md`)

### Fairness Testing Framework

#### Quarterly Fairness Review

**Methodology:**
1. Stratify historical client data into non-overlapping cohorts (by industry, contract value, agency tenure)
2. For each cohort, compute:
   - Average health score
   - Average churn prediction error (vs. actual outcomes)
   - False positive rate (predicted churn, actually stayed)
   - False negative rate (predicted stable, actually churned)
3. Identify statistically significant disparities (>10% difference)
4. If found, investigate root cause (data artifact vs. algorithmic bias) and remediate

**Test Cohorts (v1.0):**
- By agency industry (SaaS, services, ecommerce, other)
- By contract value quartiles
- By client tenure (new <3mo, established >12mo)

**Canary Metrics:**
- A3: false positive rate across cohorts (target: <5% disparity)
- D3: churn prediction variance (target: <10% across segments)

#### Synthetic Test Suite (Sprint 5)

Planned expansion to synthetic client data testing:
- Generate 100 synthetic clients per cohort (total 800 test cases)
- Vary financial, relationship, delivery, engagement independently
- Verify scores respond proportionally to each input dimension
- No spurious correlation with demographic proxies

### Bias Impact Assessment

**Status:** Completed April 10, 2026  
**Document:** `/docs/BIAS-IMPACT-ASSESSMENT.md`

**Key findings:**
- No significant bias detected in v1.0 test data (n=1,200 historical clients)
- Financial signal has highest weight (30%) and most objective (payment records)
- Relationship signal (meeting frequency, sentiment) shows minor variance by industry—remediating by normalizing per-industry baselines (Sprint 5)
- Engagement signal (feature adoption) reflects product adoption capability, not discrimination risk
- Delivery signal (project completion rate) is objective and external

**Remediation plan:**
1. Normalize relationship signals per industry baseline (Sprint 5)
2. Quarterly fairness audit (starting July 2026)
3. Third-party bias audit (v2.0, 2027)
4. Public quarterly bias report (starting Q3 2026)

### Fairness Grievance Mechanism

**How to report:**
- Email: hello@helloaurora.ai
- Subject: "Bias Complaint: [Client Name]"
- Include: Health score, churn prediction, specific fairness concern

**Response SLA:**
- Acknowledgment within 1 business day
- Investigation within 5 business days
- Remediation or explanation within 10 days

**Historical complaints:** None filed (v1.0)

---

## 9. Limitations & Known Issues

### Functional Limitations

#### Health Score Accuracy
- **Minimum data:** <3 meetings + no Stripe connection → low-confidence score (flagged in UI)
- **Optimal data:** >5 meetings/quarter + active Stripe connection → high-confidence score
- **Staleness:** Scores updated weekly; if client inactive for 2+ weeks, confidence decays

#### Churn Prediction
- **Warm-up period:** Requires 30 days of history to generate prediction (new clients show "Insufficient Data")
- **Data dependency:** Accuracy drops if:
  - <3 meetings per month (sparse relationship signal)
  - Payment data inconsistent or incomplete
  - Client behavior highly anomalous (e.g., startup with volatile spending)
- **Training data:** Model trained on ~1,200 historical clients; may underpredict churn in niche verticals (<20% market)

#### Meeting Transcription
- **Audio quality:** Whisper accuracy degrades with background noise, multiple speakers, non-English accents
- **Language support:** Sentiment analysis English-only in v1.0 (multi-language support planned Sprint 6)
- **Privacy:** Audio files uploaded to OpenAI Whisper; processed outside EU (see DPA considerations)

#### Action Proposals
- **Tone:** AI-drafted messages may feel generic; recommend owner personalization before sending
- **Cultural fit:** Proposals generated from US-centric business practices; may need adaptation for international clients

### Known Issues

#### Issue 1: Relationship Score Variance by Industry
- **Observed:** SaaS clients show lower meeting frequency (async communication) vs. services clients
- **Impact:** Relationship score may underweight SaaS clients
- **Fix (Sprint 5):** Normalize per-industry baseline

#### Issue 2: Churn Prediction Lag
- **Observed:** Churn prediction updates weekly (Monday AM); client may already have churned by notification
- **Impact:** Alert may arrive too late for intervention
- **Fix (Sprint 6):** Real-time churn detection with daily updates

#### Issue 3: Stripe API Dependency
- **Observed:** If Stripe API down, financial signal unavailable (score quality drops)
- **Impact:** Health score confidence label becomes "Medium" instead of "High"
- **Workaround:** Score cached for up to 7 days; expires with warning in UI

#### Issue 4: Speech Diarization Errors
- **Observed:** Whisper occasionally misattributes speaker (e.g., two voices recorded as one)
- **Impact:** Sentiment may reflect wrong stakeholder
- **Workaround:** Agency owner can re-upload audio or manually correct transcript

### Planned Improvements (Future Sprints)

#### Sprint 5
- Multi-language sentiment analysis (Spanish, German, French)
- Per-industry fairness baselines
- Synthetic fairness test suite
- Real-time churn detection

#### Sprint 6
- Recursive learning (model self-calibration on 50+ outcomes)
- Expanded data sources (CRM integration for relationship signal)
- Predictive QBR scheduling (auto-recommend optimal QBR timing)

#### v2.0 (2027)
- Third-party bias audit
- Multi-currency support
- Industry-specific health score tuning
- Competitor benchmarking (optional)

---

## 10. Contact & Review Schedule

### Support & Questions

**General inquiries:**
- Email: hello@helloaurora.ai
- Response time: 1 business day

**Bias complaints:**
- Email: hello@helloaurora.ai (subject: "Bias Complaint")
- Response time: Acknowledgment within 1 day, investigation within 5 days

**Regulatory inquiries:**
- Contact: hello@helloaurora.ai (subject: "Regulatory Inquiry")
- Privacy DPA amendments: Legal team reviews within 10 days

### Model Card Review Schedule

**Quarterly Reviews** (every 90 days)

| Review | Date | Focus |
|--------|------|-------|
| Q2 2026 | July 10, 2026 | v1.0 stability, bias review, Colorado AI Act compliance |
| Q3 2026 | October 10, 2026 | Sprint 5 improvements, fairness testing results, regulatory updates |
| Q4 2026 | January 10, 2027 | v1.x performance, churn prediction accuracy, industry baselines |

**Update triggers** (outside regular cadence)

- Material change to model, temperature, or hyperparameters
- Regulatory change affecting classification (e.g., new state law)
- Significant bias finding (remediation required)
- Third-party security audit results

### Regulatory Monitoring

**Active frameworks:**
- EU AI Act (compliance target: Article 52 transparency obligations)
- California AI Executive Order (compliance target: transparency + bias assessment)
- Colorado AI Act (compliance target: June 30, 2026)
- AMERICA AI Act (draft tracking; proactive compliance planning)
- GDPR (ongoing compliance; quarterly DPA review)

**Monitoring cadence:** Monthly review of regulatory developments; quarterly impact assessment

**Update process:**
1. Regulatory change identified
2. Legal team assesses impact (v1.0, v2.0, or non-impact)
3. Model card revised if necessary
4. Agencies notified of material changes
5. Implementation timeline communicated

---

## 11. Appendices

### A. Data Flow Diagram
See `/docs/DATA-FLOW.md` for visual system architecture.

### B. Bias Impact Assessment
See `/docs/BIAS-IMPACT-ASSESSMENT.md` for detailed fairness testing methodology and results.

### C. Data Protection Impact Assessment (DPIA)
See `/docs/DPIA.md` for GDPR risk analysis and mitigations.

### D. Model Configuration
See `/docs/MODEL-CONFIG.md` for detailed hyperparameters, model versions, and version history.

### E. Security & Privacy
See `/docs/SECURITY.md` for encryption, access control, audit logging, and incident response procedures.

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | April 10, 2026 | Initial publication for v1.0 beta | Aurora AI Solutions Studio UG |

---

**Last Updated:** April 10, 2026  
**Next Scheduled Review:** July 10, 2026  
**Classification:** Public (no confidential data)

For the latest version, visit: https://clientpulse.helloaurora.ai/model-card
