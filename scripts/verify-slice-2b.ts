// One-off verification script for the ContentPulse→CP signal pipeline (slices
// 2B + 2C-1) against prod.
//
// Runs the deployed refreshClientHealth() against prod for the demo
// workspace's "Cypress Logistics" client and exercises the APE
// auto-trigger path. After the slice 2C-1 ship, also generates a
// Monday Brief and confirms Cypress is promoted to the headline
// because of its pause_resume signal.
//
// Run with: npx tsx scripts/verify-slice-2b.ts

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'node:path';
import { refreshClientHealth } from '../src/lib/health/refresh';
import { maybeCreateSignalTriggeredActionItem } from '../src/lib/signals/ingest-trigger';
import { MondayBriefAgent } from '../src/lib/agents/monday-brief-agent';

// Project root .env.local takes precedence over any inherited shell env.
config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
}

const CYPRESS_ID = 'aaa00d00-c000-4000-8000-000000000006';

async function main() {
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  // Baseline read.
  const { data: before } = await supabase
    .from('client_health_scores')
    .select('overall_score, financial_score, relationship_score, delivery_score, engagement_score, signals_score')
    .eq('client_id', CYPRESS_ID)
    .maybeSingle();
  console.log('BEFORE refresh:', before);

  // Refresh — runs the deployed compute pipeline.
  const result = await refreshClientHealth({ supabase, clientId: CYPRESS_ID });
  console.log('REFRESH result:', {
    overall: result.overall,
    breakdown: result.breakdown,
    status: result.status,
  });

  // Persisted read.
  const { data: after } = await supabase
    .from('client_health_scores')
    .select('overall_score, financial_score, relationship_score, delivery_score, engagement_score, signals_score, status')
    .eq('client_id', CYPRESS_ID)
    .maybeSingle();
  console.log('AFTER refresh:', after);

  // Confirm a signals-typed HealthSignal landed in the explanation.
  const signalsSig = result.signals.find((s) => s.type === 'signals');
  console.log('SIGNALS-TYPED SIGNAL:', signalsSig);

  // ─── 2B-1: APE trigger ────────────────────────────────────────
  // Resolve the demo agency id from Cypress, then exercise the
  // trigger orchestration directly. Two calls — first creates,
  // second hits the partial UNIQUE index and reports already_exists.
  const { data: cypress } = await supabase
    .from('clients')
    .select('id, agency_id')
    .eq('id', CYPRESS_ID)
    .single();
  if (!cypress) throw new Error('Cypress client not found');

  const trig1 = await maybeCreateSignalTriggeredActionItem({
    supabase,
    agencyId: cypress.agency_id as string,
    clientId: CYPRESS_ID,
    signalType: 'pause_resume',
    period: '2026-W18',
    value: 1,
  });
  console.log('TRIGGER #1:', trig1);

  const trig2 = await maybeCreateSignalTriggeredActionItem({
    supabase,
    agencyId: cypress.agency_id as string,
    clientId: CYPRESS_ID,
    signalType: 'pause_resume',
    period: '2026-W18',
    value: 1,
  });
  console.log('TRIGGER #2 (idempotent):', trig2);

  const { data: items } = await supabase
    .from('action_items')
    .select('id, title, source_signal_id, status, created_at')
    .eq('client_id', CYPRESS_ID)
    .not('source_signal_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('SIGNAL-LINKED ACTION ITEMS:', items);

  // ─── 2C-1: Brief promotion ─────────────────────────────────────
  // Generate a Brief for the demo agency and confirm Cypress is the
  // top recommended action with signalReason='paused', plus the
  // headline mentions Cypress + 'paused'.
  const agencyId = cypress.agency_id as string;
  const briefAgent = new MondayBriefAgent(supabase);
  const brief = await briefAgent.generate(agencyId);
  console.log('BRIEF HEADLINE:', brief.narrative.headline);
  console.log('BRIEF TOP ACTION:', brief.recommendedActions[0]);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
