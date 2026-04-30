# ClientPulse — Frequently Asked Questions

**Last updated:** 2026-04-30
**Live page:** [clientpulse.helloaurora.ai/faq](https://clientpulse.helloaurora.ai/faq)

The 10 launch-honest questions below are the canonical answers. The public `/faq` route renders these same answers with section anchors and styling. When you change one, change both — keep wording in lockstep.

---

## Pricing & Plans

### 1. How much does ClientPulse cost?

Three monthly plans: **Solo $59** · **Pro $199** · **Agency $799**. Annual billing gives you **two months free** on every tier. The Aurora Agency Suite — ReForge Agency + ClientPulse Agency bundled — is **$999/mo** (vs $1,398 stacked).

Each tier raises the number of clients you can track, the data retention window, the health-score refresh cadence, agency seats, and API/MCP access. Solo tracks 3 clients; Pro tracks 10; Agency is unlimited.

### 2. Can I cancel anytime?

Yes. Cancel from **Settings → Billing → Manage subscription** at any time (the Stripe billing portal opens in a new tab). You keep full access until the end of your current billing period — no prorated clawbacks, no exit fees, no long-term contract.

Annual subscribers who cancel keep access through the paid year. We do not auto-renew cancelled subscriptions.

### 3. Do you offer refunds?

We offer a **14-day refund window** on first-time monthly subscriptions and a **30-day window** on first-time annual subscriptions, no questions asked. Full policy at [helloaurora.ai/refund](https://helloaurora.ai/refund).

---

## Data Sources & Signals

### 4. What does ClientPulse connect to?

Four OAuth-based connections at launch: **Google Calendar** (meeting cadence, attendee patterns), **Gmail** (response latency, sentiment shifts, reply-rate decay), **Zoom** (recording cadence, attendance, transcripts when present), and **Stripe** (subscription status, MRR changes, churn signals).

Plus content velocity from **ReForge** when both products are connected via the Aurora Suite — engagement events from each client's published content feed CP's health signals automatically.

All connections are **read-only**. CP never sends emails, books meetings, or modifies billing on your behalf.

### 5. How does the client health score work?

CP rolls every signal it sees per client into a 0–100 health score across five dimensions: **communication frequency**, **communication sentiment**, **meeting cadence**, **commercial signals** (Stripe), and **content velocity** (ReForge engagement when connected).

The scoring isn't a black box — every score change shows the underlying signals that moved it, with timestamps and the raw data that caused the swing. You can mark a signal as "not applicable" and it stops weighing into the score for that client.

Solo refreshes daily, Pro hourly, Agency in real-time as signals arrive.

### 6. How does the Action Proposal Engine + Monday Brief actually help me?

Every Monday morning at 6 a.m. local time, you get the **Monday Brief** — a one-screen email + dashboard view of every client ranked by urgency, with three things spelled out for each: what changed since last week, what that probably means, and what action to take.

The **Action Proposal Engine (APE)** turns the "what to take" into one-click action items: send this follow-up, book this check-in, escalate this conversation. Each proposal is ranked by urgency and impact; you accept it (it becomes a tracked action item), edit it, or dismiss it.

The Brief is also where Suite-connected agencies see the cross-product picture: CP signals × ReForge engagement × content velocity in one place.

---

## Refresh Cadence & Limits

### 7. How often does CP recalculate signals?

**Solo: daily** at 5 a.m. UTC. **Pro: hourly**. **Agency: real-time** — webhooks from connected providers trigger an immediate recompute for the affected client.

Data retention follows the same tier ladder: **90 days on Solo**, **12 months on Pro**, **36 months on Agency**. Beyond those windows, raw signals are aggregated into rollups so historical trends survive while raw records expire (per GDPR data-minimization).

---

## Privacy & Compliance

### 8. Where is my data stored, and is it used to train AI models?

All data is stored in the **EU (Frankfurt, Germany)** on Supabase infrastructure. OAuth tokens are encrypted at rest with AES-256-GCM; signals, scores, and Brief content live in an EU Postgres database. Both are tenant-isolated via row-level security.

Brief generation and APE proposals are produced via the Anthropic Claude API under their commercial terms — which contractually prohibit using customer inputs to train their models. **Your client data is never used to train any AI model.** It is never shared with other ClientPulse users, and never sold.

Right-to-erasure (GDPR Art. 17) is one click in **Settings → Account → Delete account**. Full details in our [Privacy Policy](https://helloaurora.ai/privacy) and [DPA](https://helloaurora.ai/dpa).

### 9. I'm in the EU — am I blocked from using ClientPulse?

**No.** ClientPulse is globally accessible. EU visitors see a non-blocking notice on the landing page about the EU AI Act (enforcement begins August 2, 2026) and can choose to opt into a launch waitlist or proceed with normal signup.

Aurora's posture is **global by default, exclude per regulator**. Today only the EU-27 carries enforcement-eligible AI regulation that affects our product class (per our Apr 30 launch-jurisdiction scan covering UAE, Singapore, KSA, Indonesia, Hong Kong, Malaysia, Israel, Mexico, Brazil, and South Africa — all cleared as no-op for pre-launch).

See our [Model Card](/model-card) for the full risk classification across EU AI Act Art. 50, the California AI Transparency Act, the Colorado AI Act, GDPR, and UK GDPR.

### 10. Are you charging real money today, or am I in test mode?

ClientPulse is currently in **pre-launch**. The pricing page shows real tiers, but Stripe is in test mode — no real card is charged.

We flip to live mode when our German UG entity registration (HRB) clears, expected mid-May 2026. Existing test-mode signups carry forward; you'll be invited to re-confirm your tier on a live Stripe price before any charge is made.

---

Didn't find your question? Email [hello@helloaurora.ai](mailto:hello@helloaurora.ai) — we reply within one business day. Pre-sales questions go to the same address.
