// Demo seed — shared identities.
//
// COPY THIS FILE VERBATIM between:
//   clientpulse/scripts/demo-seed/identities.ts
//   contentpulse/scripts/demo-seed/identities.ts
//
// The deterministic client UUIDs are the cross-product identity glue:
// same UUID on CP and ContentPulse means the cp_rf_client_map row is identity
// by construction (`rf_client_id === cp_client_id`). The `rf_*` schema
// column names are preserved — they are wire identifiers shared with the
// sibling product's writers. The signal pipe already supports the
// explicit map row, so this just makes the seed honest end-to-end
// without a setup wizard.

export const DEMO_USER_EMAIL = 'demo@helloaurora.ai';
/** Set on demo account creation. Sasa logs in via the regular login
 *  form to verify the seed; production "See demo" autologin is a
 *  separate slice and won't reuse this constant. Kept simple
 *  (alphanumerics only) so manual login isn't a typo lottery. */
export const DEMO_USER_PASSWORD = 'AuroraDemo2026';
export const DEMO_AGENCY_NAME = 'Aurora Demo Agency';
export const DEMO_ORG_NAME = 'Aurora Demo Studio';

const CID = (last: number) =>
  `aaa00d00-c000-4000-8000-${String(last).padStart(12, '0')}`;

export type DemoClientStatus = 'healthy' | 'at_risk' | 'churning';

export interface DemoClient {
  id: string;
  name: string;
  company: string;
  email: string;
  monthlyRetainer: number;
  serviceType: string;
  status: DemoClientStatus;
  /** 4 weeks of weekly approve/publish counts, oldest → newest. */
  velocityProfile: [number, number, number, number];
  /** Plain-English scenario — used for content_pieces text + screenshot copy. */
  scenario: string;
}

export const DEMO_CLIENTS: DemoClient[] = [
  // ─── Healthy (3) ───
  {
    id: CID(1),
    name: 'Northwind Capital',
    company: 'Northwind Capital',
    email: 'jane@northwindcapital.com',
    monthlyRetainer: 5000,
    serviceType: 'Content',
    status: 'healthy',
    velocityProfile: [3, 4, 4, 5],
    scenario: 'FinTech firm climbing weekly cadence; Q3 results coming.',
  },
  {
    id: CID(2),
    name: 'Verdant Health',
    company: 'Verdant Health',
    email: 'ops@verdanthealth.io',
    monthlyRetainer: 4500,
    serviceType: 'Content',
    status: 'healthy',
    velocityProfile: [3, 3, 4, 4],
    scenario: 'Healthcare SaaS with a steady weekly publishing rhythm.',
  },
  {
    id: CID(3),
    name: 'Aperture Studios',
    company: 'Aperture Studios',
    email: 'team@aperture.studio',
    monthlyRetainer: 3200,
    serviceType: 'Social',
    status: 'healthy',
    velocityProfile: [4, 4, 3, 4],
    scenario: 'Creative agency: video-first, mixed cadence.',
  },
  // ─── At risk (2) ───
  {
    id: CID(4),
    name: 'Linden & Co',
    company: 'Linden & Co Consulting',
    email: 'pe@linden.co',
    monthlyRetainer: 7500,
    serviceType: 'Full Service',
    status: 'at_risk',
    velocityProfile: [4, 4, 2, 1],
    scenario: 'B2B consulting; senior partner went quiet, velocity halved.',
  },
  {
    id: CID(5),
    name: 'Helios Robotics',
    company: 'Helios Robotics',
    email: 'founder@helios.ai',
    monthlyRetainer: 2800,
    serviceType: 'Content',
    status: 'at_risk',
    velocityProfile: [3, 2, 1, 1],
    scenario: 'Hardware founder buried in Series A — content slowing.',
  },
  // ─── Churning (1) ───
  {
    id: CID(6),
    name: 'Cypress Logistics',
    company: 'Cypress Logistics',
    email: 'cmo@cypresslogistics.com',
    monthlyRetainer: 6000,
    serviceType: 'Content',
    status: 'churning',
    velocityProfile: [3, 0, 0, 0],
    scenario: 'Supply-chain client; gone dark for 3 weeks. Re-engagement opportunity.',
  },
];

export interface HealthScoreStub {
  overall: number;
  financial: number;
  relationship: number;
  delivery: number;
  engagement: number;
}

/** Deterministic per-status health scores so the demo dashboard reads
 *  the same way every run. The real health-score engine would compute
 *  these from signals; the seed pre-populates so the demo has data
 *  even before the signal pipeline runs. */
export const HEALTH_BY_STATUS: Record<DemoClientStatus, HealthScoreStub> = {
  healthy: { overall: 86, financial: 92, relationship: 88, delivery: 80, engagement: 78 },
  at_risk: { overall: 58, financial: 78, relationship: 52, delivery: 55, engagement: 38 },
  churning: { overall: 31, financial: 70, relationship: 22, delivery: 18, engagement: 8 },
};
