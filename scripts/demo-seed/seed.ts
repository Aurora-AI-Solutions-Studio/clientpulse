// ClientPulse demo seed.
//
// Creates / refreshes the Aurora Demo Agency on the CP Supabase
// project. Idempotent: re-runs delete the demo agency's clients +
// children first, then re-insert.
//
// Run from clientpulse/ root:
//   npm run seed:demo
//
// Required env vars (already in .env.local — pull via `vercel env pull`):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Touches ONLY rows scoped to the demo agency (matched by name) and
// the demo user (matched by email). Real customer data is untouched.

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'node:path';
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  DEMO_AGENCY_NAME,
  DEMO_CLIENTS,
  DEMO_USER_EMAIL,
  DEMO_USER_PASSWORD,
  HEALTH_BY_STATUS,
  type DemoClient,
} from './identities';

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. ' +
        'Note: SUPABASE_SERVICE_ROLE_KEY is marked Sensitive in Vercel, so ' +
        '`vercel env pull` writes it as empty. Copy the value from ' +
        'Supabase dashboard → Settings → API → service_role into .env.local.',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

interface DemoUserHandle {
  id: string;
  email: string;
}

async function ensureDemoUser(sb: SupabaseClient): Promise<DemoUserHandle> {
  // listUsers returns the first 200 users — fine for the demo project
  // size; the production-scale fix for this pattern is logged as a
  // separate task.
  const { data: list, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => (u.email ?? '').toLowerCase() === DEMO_USER_EMAIL);
  if (existing) {
    // Make sure email is confirmed + password matches the documented
    // demo credential (so login works after a password rotation).
    await sb.auth.admin.updateUserById(existing.id, {
      password: DEMO_USER_PASSWORD,
      email_confirm: true,
    });
    return { id: existing.id, email: existing.email ?? DEMO_USER_EMAIL };
  }
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email: DEMO_USER_EMAIL,
    password: DEMO_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Aurora Demo' },
  });
  if (createErr || !created.user) throw createErr ?? new Error('createUser failed');
  return { id: created.user.id, email: created.user.email ?? DEMO_USER_EMAIL };
}

async function ensureDemoAgency(sb: SupabaseClient, ownerId: string): Promise<string> {
  const { data: existing } = await sb
    .from('agencies')
    .select('id')
    .eq('name', DEMO_AGENCY_NAME)
    .maybeSingle();
  if (existing?.id) {
    await sb.from('agencies').update({ owner_id: ownerId }).eq('id', existing.id);
    return existing.id as string;
  }
  const { data: created, error } = await sb
    .from('agencies')
    .insert({ name: DEMO_AGENCY_NAME, owner_id: ownerId })
    .select('id')
    .single();
  if (error || !created) throw error ?? new Error('agency insert failed');
  return created.id as string;
}

async function alignDemoProfile(sb: SupabaseClient, userId: string, agencyId: string): Promise<void> {
  // Set the demo profile up so the dashboard renders the way prospects
  // should see it: agency-tier, suite-access, onboarding completed.
  await sb
    .from('profiles')
    .update({
      agency_id: agencyId,
      subscription_plan: 'agency',
      subscription_status: 'active',
      has_suite_access: true,
      onboarding_completed_at: new Date().toISOString(),
      full_name: 'Aurora Demo',
    })
    .eq('id', userId);
}

async function clearDemoChildren(sb: SupabaseClient, agencyId: string): Promise<void> {
  // Cascade order matters: signals/map/health rows reference clients,
  // so blow them away first, then clients themselves.
  // Using .in() with a sub-query isn't supported by supabase-js — fetch
  // the client ids first and delete by id.
  const { data: clientRows } = await sb.from('clients').select('id').eq('agency_id', agencyId);
  const clientIds = (clientRows ?? []).map((r) => r.id as string);
  if (clientIds.length > 0) {
    await sb.from('client_signals').delete().in('client_id', clientIds);
    await sb.from('client_health_scores').delete().in('client_id', clientIds);
    await sb.from('action_items').delete().in('client_id', clientIds);
  }
  await sb.from('cp_rf_client_map').delete().eq('agency_id', agencyId);
  await sb.from('clients').delete().eq('agency_id', agencyId);
}

async function insertClients(sb: SupabaseClient, agencyId: string, ownerId: string): Promise<void> {
  const rows = DEMO_CLIENTS.map((c) => ({
    id: c.id,
    agency_id: agencyId,
    name: c.name,
    company_name: c.company,
    contact_email: c.email,
    monthly_retainer: c.monthlyRetainer,
    service_type: c.serviceType,
    status: c.status === 'churning' ? 'churned' : 'active',
    notes: c.scenario,
    metadata: { demo: true, status_label: c.status },
    assigned_to: ownerId,
  }));
  const { error } = await sb.from('clients').insert(rows);
  if (error) throw error;
}

async function insertHealthScores(sb: SupabaseClient): Promise<void> {
  const rows = DEMO_CLIENTS.map((c) => {
    const h = HEALTH_BY_STATUS[c.status];
    return {
      client_id: c.id,
      overall_score: h.overall,
      financial_score: h.financial,
      relationship_score: h.relationship,
      delivery_score: h.delivery,
      engagement_score: h.engagement,
      signals: { demo: true, scenario: c.scenario },
      computed_at: new Date().toISOString(),
    };
  });
  const { error } = await sb.from('client_health_scores').insert(rows);
  if (error) throw error;
}

interface ActionItemRow {
  client_id: string;
  title: string;
  description: string;
  status: string;
  due_date: string;
  assigned_to: string;
}

async function insertActionItems(sb: SupabaseClient, ownerId: string): Promise<void> {
  const today = new Date();
  const days = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const rows: ActionItemRow[] = [];
  for (const c of DEMO_CLIENTS) {
    if (c.status === 'healthy') {
      rows.push({
        client_id: c.id,
        title: `Quarterly review with ${c.name}`,
        description: `${c.scenario}\n\nRecommended: schedule a 30-min review to share Q3 results and discuss next quarter's content slate.`,
        status: 'open',
        due_date: days(7),
        assigned_to: ownerId,
      });
    }
    if (c.status === 'at_risk') {
      rows.push({
        client_id: c.id,
        title: `Re-engage ${c.name} — velocity dropping`,
        description: `${c.scenario}\n\nRecommended: a check-in call this week. Bring a content audit + 3 ready-to-go pieces to lower friction.`,
        status: 'open',
        due_date: days(3),
        assigned_to: ownerId,
      });
    }
    if (c.status === 'churning') {
      rows.push({
        client_id: c.id,
        title: `URGENT: ${c.name} silent for 3 weeks`,
        description: `${c.scenario}\n\nRecommended: founder-to-founder outreach with a no-strings retention offer (e.g. 1 free month if they renew).`,
        status: 'open',
        due_date: days(1),
        assigned_to: ownerId,
      });
    }
  }
  // One upsell proposal — Northwind is climbing, ripe for a tier upsell.
  rows.push({
    client_id: DEMO_CLIENTS[0].id,
    title: `Upsell ${DEMO_CLIENTS[0].name} — output cadence is Pro-tier-shaped`,
    description: `Northwind has been shipping 4–5 pieces/week for the past month. Their current Solo retainer caps at 4. Propose an upgrade to Pro ($199/mo).`,
    status: 'open',
    due_date: days(5),
    assigned_to: ownerId,
  });
  const { error } = await sb.from('action_items').insert(rows);
  if (error) throw error;
}

async function insertClientMap(sb: SupabaseClient, agencyId: string): Promise<void> {
  // Identity by construction: same UUID on CP and RF, so each map row's
  // rf_client_id and cp_client_id are equal. Lets the signal pipeline
  // route signals from RF straight to the right CP client without the
  // exact-name fallback path.
  const rows = DEMO_CLIENTS.map((c) => ({
    agency_id: agencyId,
    cp_client_id: c.id,
    rf_client_id: c.id,
  }));
  const { error } = await sb.from('cp_rf_client_map').insert(rows);
  if (error) throw error;
}

async function main(): Promise<void> {
  const sb = admin();
  console.log('▶ ClientPulse demo seed');
  const user = await ensureDemoUser(sb);
  console.log(`  user: ${user.email} (${user.id})`);
  const agencyId = await ensureDemoAgency(sb, user.id);
  console.log(`  agency: ${agencyId}`);
  await alignDemoProfile(sb, user.id, agencyId);
  console.log('  profile aligned (agency tier, suite access, onboarded)');
  await clearDemoChildren(sb, agencyId);
  console.log('  prior demo data cleared');
  await insertClients(sb, agencyId, user.id);
  console.log(`  clients: ${DEMO_CLIENTS.length} inserted`);
  await insertHealthScores(sb);
  console.log('  health scores: 6 inserted');
  await insertActionItems(sb, user.id);
  console.log('  action items inserted');
  await insertClientMap(sb, agencyId);
  console.log('  cp_rf_client_map prepopulated');
  console.log('✔ done. Sign in as', DEMO_USER_EMAIL, 'to view the populated dashboard.');
}

main().catch((err) => {
  console.error('✖ seed failed:', err);
  process.exit(1);
});

interface ClientRow {
  id: string;
  agency_id: string;
  status: string;
}
// Re-export the noop type so the linter doesn't strip an unused-warning
// reference. Keeping it here documents the row shape for follow-up
// editors without polluting identities.ts.
export type { DemoClient, ClientRow };
