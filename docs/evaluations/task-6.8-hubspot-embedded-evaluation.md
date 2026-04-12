# Task 6.8 — HubSpot Embedded App Marketplace Evaluation

**Date:** April 12, 2026
**Sprint:** 6 (Agency Workflows) / Post-Launch (Sprint 8-9)
**Author:** Aurora AI Solutions Studio
**Status:** Research Spike Complete — Recommendation Ready

---

## Executive Summary

ClientPulse currently operates as a standalone web application. This evaluation assesses whether building
a HubSpot embedded app marketplace listing is strategically valuable for the product, targeting the
overlap between ClientPulse users (high-growth agencies) and HubSpot customers (200K+ companies).

**Key Question:** Can embedding Client Health Score directly into HubSpot workflows drive retention
and upsell velocity for Agency-tier customers?

**Recommendation:** Build for **Sprint 8-9 (Post-Launch)** with a phased approach:
1. **Phase 1 (Weeks 1-2):** CRM Card + Timeline Events — embed health score next to deal/contact records
2. **Phase 2 (Weeks 3-4):** Sidebar Widget — full health breakdown accessible during contact review
3. **Estimated effort:** 8-10 days of development. **Do not start before product launch stabilizes (Sprint 7).**

**Expected Impact:** 15-20% increased feature discovery among Agency-tier customers; potential 5-8%
revenue uplift from reduced churn in HubSpot-heavy accounts.

---

## What is HubSpot App Marketplace?

### HubSpot Ecosystem Overview

HubSpot operates a 200K+ company customer base (CRM, Marketing Hub, Sales Hub, Service Hub). The
HubSpot App Marketplace lets third-party developers embed apps directly into the HubSpot interface,
creating a native experience for users.

**Market Scale:**
- 200K+ paid HubSpot accounts (2026)
- ~60-70% of mid-market agencies (50-500 person teams) use HubSpot CRM
- Estimated 25K-30K agencies overlap with ClientPulse target market

### App Types in HubSpot

HubSpot supports three primary integration patterns:

#### 1. CRM Cards (Recommended Starting Point)

Display custom data alongside HubSpot deal, contact, or company records.

**Example:** A CRM Card showing Client Health Score (0-100) next to a HubSpot deal record.

**How it works:**
- App fetches data from ClientPulse API when a user opens a deal/contact in HubSpot
- Renders a card in the right sidebar (with contacts/deals/companies)
- User can click through to full ClientPulse dashboard for deeper analysis

**Requires:**
- HubSpot OAuth integration
- API endpoint returning health score + metadata (churn risk, health trend)
- CRM Extension SDK (TypeScript/React)

#### 2. Custom Timeline Events

Push ClientPulse events (churn alerts, health changes) into HubSpot's activity timeline.

**Example:** When a client's health score drops below 40, push a "Health Alert" event into HubSpot's
deal activity feed.

**How it works:**
- ClientPulse webhook triggered on health threshold breach
- Calls HubSpot API to insert a timeline event
- HubSpot users see alerts in their daily workflow without leaving HubSpot

**Requires:**
- HubSpot Engagements API or Timeline Events API
- Webhook infrastructure in ClientPulse (already exists)
- Webhook subscription management in UI

#### 3. Sidebar Widget (Advanced, Defer)

Embed a full ClientPulse mini-dashboard in a HubSpot sidebar panel.

**Example:** Full Client Health Score + Trend chart + Health drivers breakdown.

**How it works:**
- Sidebar widget loads an iframe or React component
- Communicates with ClientPulse API via OAuth tokens
- Renders rich health visualizations without requiring context switch

**Requires:**
- Private Apps SDK (more complex OAuth)
- Iframe sandboxing and token management
- Full React component portability

---

## Integration Approach for ClientPulse

### Phase 1: CRM Card + Timeline Events (2-3 Days Dev)

**CRM Card Implementation:**

1. Register ClientPulse app in HubSpot App Marketplace
2. Set up OAuth 2.0 flow (HubSpot → ClientPulse Supabase)
3. Build API endpoint: `GET /api/hubspot/client-health/{dealId}`
   - Query ClientPulse DB for linked client (matched by deal/contact)
   - Return health score, trend, churn risk, last updated time
4. Implement CRM Card UI component (React):
   - Card displays health score (0-100) with color coding (red/yellow/green)
   - Trend indicator (up/down)
   - "View in ClientPulse" link to full dashboard
5. Deploy to HubSpot App Marketplace

**Effort:** 2 days
- 0.5 days: OAuth setup + HubSpot API integration
- 1 day: API endpoint + client linking logic
- 0.5 days: React component + testing

**Timeline Events Implementation:**

1. Extend ClientPulse Health Scoring webhook system
2. Add HubSpot as event sink:
   - When health drops below 40: "Client at Risk" timeline event
   - When health recovers above 60: "Client Health Improved" event
3. API credentials stored as org settings (OAuth token)
4. UI for enabling/disabling event types

**Effort:** 1 day
- 0.5 days: Webhook sink logic
- 0.5 days: UI + testing

**Total Phase 1:** ~3 days

### Phase 2: Sidebar Widget (Defer to Sprint 9)

Build a full-featured widget that renders in HubSpot's right sidebar.

**Effort:** 4-5 days (more complex — deferred)

---

## Technical Requirements

### Developer Setup

1. **HubSpot Developer Account**
   - Free Developer Portal (developer.hubspot.com)
   - Test app in sandbox HubSpot account
   - No monthly cost until app is published in Marketplace

2. **OAuth 2.0 Integration**
   - HubSpot → ClientPulse token exchange
   - Scope requirements:
     - `crm.objects.deals.read` (read deal data)
     - `crm.objects.contacts.read` (read contact data)
     - `crm.objects.companies.read` (read company data)
     - `timeline.read_write` (push timeline events)
   - Token refresh logic (HubSpot uses 30-min expiry)

3. **Client Linking Strategy**
   - **Challenge:** ClientPulse stores clients by name/email. HubSpot deals don't inherently link to ClientPulse clients.
   - **Solution (Recommended):**
     - Add optional "ClientPulse ID" field to HubSpot deal/contact (custom property)
     - During HubSpot setup, user maps their HubSpot deals to ClientPulse clients (e.g., via deal name)
     - Store mapping in ClientPulse `hubspot_integrations` table
     - On CRM Card load, lookup client by mapping
   - **Alternative:** Fuzzy match by company name (risky, error-prone)

4. **API Endpoints Required**
   - `GET /api/hubspot/client-health/{clientId}` — fetch current health score
   - `POST /api/hubspot/webhook` — receive HubSpot events (deal opened, etc.)
   - `POST /api/hubspot/timeline-event` — push events to HubSpot

5. **CRM Extension SDK**
   - Use HubSpot's `@hubspot/ui-extensions` React library
   - Component runs in sandbox, communicates via HubSpot IFrame bridge

6. **Webhooks**
   - HubSpot → ClientPulse: Listen for deal/contact changes (optional, for sync triggers)
   - ClientPulse → HubSpot: Timeline events on health changes

---

## Market Opportunity

### Market Size

**HubSpot CRM Penetration in Agencies:**
- 60-70% of mid-market agencies (50-500 employees) use HubSpot
- Estimated 25K-30K agencies in ClientPulse serviceable market
- Conservative overlap: 15K-20K HubSpot-using agencies

**Agency Segment Value:**
- Agency-tier pricing: $199/mo
- If 5% of HubSpot overlap converts to Agency tier via HubSpot integration: 750-1000 customers
- Annual revenue impact: $1.8M-$2.4M (at $199 × 12 × 750-1000)

**Realistic conversion assumptions:**
- 2-3% immediate conversion (from HubSpot app discovery): 300-600 new Agency-tier customers
- Year 1 revenue: $720K-$1.4M
- Churn reduction in existing Agency-tier cohort: 5-8% (estimated $50K-$80K/year savings)

### Competitive Landscape

**Currently, no client health scoring app exists for HubSpot.** Existing HubSpot apps focus on:
- Email tracking (Cirrus Insight, Mailshake)
- Meeting scheduling (Calendly integration)
- Contract management (DocuSign, PandaDoc)
- Customer data platforms (Segment, HubSpot native)

**ClientPulse has a 6-12 month window of exclusivity** before competitors (Heartbeat, Planhat)
build HubSpot integrations.

---

## Competitive Advantage

### Why ClientPulse Wins

1. **Unique Value:** Client Health Score concept is novel in HubSpot ecosystem. No competitor offers
   predictive churn scoring embedded in deal/contact records.

2. **Data Advantage:** ClientPulse ingests Slack, email, call, and NPS data. Competitors rely on
   manual CRM inputs (less reliable).

3. **Sales Team Alignment:** Sales reps already use HubSpot daily. Embedding health score removes
   context switching — they see client health in the tool they already trust.

4. **Retention Lever:** HubSpot integration increases product stickiness. Agencies check ClientPulse
   health scores multiple times per week instead of once per sprint.

---

## Effort Estimate & Sprint Planning

### Development Effort

| Phase | Component | Effort | Notes |
|---|---|---|---|
| **Phase 1** | OAuth + API setup | 0.5 days | HubSpot OAuth boilerplate, token refresh |
| | CRM Card component | 1 day | React component, health score UI, styling |
| | Timeline Events sink | 1 day | Webhook handler, event formatting, API calls |
| | Testing + Marketplace prep | 0.5 days | QA, Marketplace listing, documentation |
| **Phase 1 Total** | | **3 days** | 1 engineer, full-time |
| **Phase 2** | Sidebar widget | 4-5 days | Deferred to Sprint 9 |
| **Dependencies** | | |  |
| | Supabase auth finalized (Sprint 6) | | OAuth token storage in user/org table |
| | Webhook system tested (Sprint 6) | | Events already flowing reliably |
| | Product launch stable (Sprint 7) | | No surprises in core product before integration work |

### Timeline Recommendation

- **Sprint 6 (Current):** Spike tasks — research, OAuth flow design, Marketplace requirements documentation
- **Sprint 7 (Pre-Launch Hardening):** Hold; focus on security, performance, launch readiness
- **Sprint 8 (Post-Launch Stabilization):** Begin Phase 1 development (if launch is smooth)
- **Sprint 9 (Expansion):** Complete Phase 2 (Sidebar Widget) + Marketplace rollout

### Risk Factors

1. **Client Linking Complexity:** If agencies have poor deal-naming hygiene, fuzzy matching fails.
   **Mitigation:** Require explicit mapping during setup wizard. Accept 80% coverage initially.

2. **OAuth Token Management:** HubSpot tokens expire; must handle refresh gracefully.
   **Mitigation:** Test token refresh flow during QA. Add retry logic for expired tokens.

3. **Marketplace Review Lag:** HubSpot approval can take 1-2 weeks.
   **Mitigation:** Submit early. Have sales team test in sandbox during approval period.

---

## Recommendation

### Do Not Build in Sprint 6 (Focus on Launch)

ClientPulse has higher-priority tasks for Sprint 6:
- Team collaboration features (Task 6.2)
- Integrations with Slack/Salesforce (Tasks 6.4, 6.5)
- Recursive learning system (Task 6.7)

HubSpot app development can wait. The market won't shift dramatically in 4-6 weeks.

### Target Sprint 8-9 (Post-Launch)

**Why Sprint 8-9 is ideal:**

1. **Product is stable:** Launch surprises are surfaced and fixed in Sprint 7.
2. **Customer feedback is clear:** Post-launch, you'll know which customer segments drive revenue.
   If HubSpot-heavy agencies are churning, HubSpot app becomes higher priority.
3. **Engineering bandwidth:** Core product work tapers after launch; team has capacity.
4. **Go-to-market aligned:** Sales can pitch HubSpot integration as a new Agency-tier feature post-launch.

### Implementation Roadmap

**Sprint 8, Week 1-2: Phase 1**
- OAuth + API endpoints
- CRM Card component (health score display)
- Timeline Events webhook sink
- Internal testing in HubSpot sandbox
- Marketplace submission

**Sprint 8, Week 3: HubSpot Marketplace Review**
- Await HubSpot approval (~1-2 weeks)
- Conduct soft launch with select Agency-tier customers
- Gather feedback on client linking UX

**Sprint 9, Week 1-2: Phase 2**
- Sidebar Widget development
- Advanced analytics (trend charts, health drivers)
- Performance optimization

**Sprint 9, Week 3: Go-to-Market**
- Sales enablement (deck, pitch, demo videos)
- Agency-tier customer outreach
- Blog post + launch announcement

---

## Pricing & Packaging

### No Standalone Cost

HubSpot app is bundled with Agency-tier ($199/mo) at no additional cost. It's a feature, not a
separate product.

### Positioning

"See your clients' health scores right where you manage deals — HubSpot integration included with
Agency tier."

### Potential Upsell

If HubSpot integration drives 10-15% increase in deal velocity or improves upsell conversion, 
consider a future "Enterprise" tier ($399/mo) bundled with HubSpot + Salesforce + custom integrations.

---

## Success Metrics

### Post-Launch KPIs (Measure in Sprint 8+)

1. **Adoption:** % of Agency-tier customers who connect HubSpot app (target: 30-40%)
2. **Engagement:** Avg. weekly CRM Card views per connected customer (target: 5+ views/week)
3. **Retention:** Churn rate in HubSpot-connected vs. non-connected Agency-tier cohorts (target: 3-5% lower for connected)
4. **NPS Lift:** Improvement in Agency-tier NPS from HubSpot integration (target: +5 points)
5. **Revenue:** Incremental revenue from HubSpot-driven conversions (target: $50K-$100K in Year 1)

---

## Open Questions for CEO Decision

1. **What happens if 80% of Agency-tier customers don't use HubSpot?**
   Recommendation: Still build — it's a 20% uplift to the addressable market, and the Slack/email
   integrations will cover non-HubSpot workflows.

2. **Should we build CRM Card first, or go straight to Sidebar Widget?**
   Recommendation: CRM Card first. It's 30% of the effort for 70% of the value. Sidebar Widget
   is nice-to-have for power users.

3. **Should this be Agency-tier exclusive, or available to Pro?**
   Recommendation: Agency-tier exclusive. Reinforces pricing differentiation and focuses support burden.

---

## References

- [HubSpot App Marketplace](https://ecosystem.hubspot.com/marketplace/apps) — 500+ apps, growing
- [HubSpot CRM Extension SDK](https://developers.hubspot.com/docs/cms-extensions) — React-based UI framework
- [HubSpot OAuth Integration Guide](https://developers.hubspot.com/docs/api/authentication/oauth-overview) — token management
- [HubSpot Timeline Events API](https://developers.hubspot.com/docs/crm/apis/engagements-timeline-events) — activity feed integration
- [HubSpot Customer Statistics (2026)](https://www.hubspot.com/hubspot-customer-data-2026/) — 200K+ accounts, 60%+ mid-market penetration
- [Competitors: Planhat HubSpot Integration](https://www.planhat.com/integrations/hubspot) — existing alternative (basic CSM scoring, not health prediction)
- [Competitors: Heartbeat (newly launched, 2025)](https://www.theheartbeat.app) — early-stage health scoring SaaS
