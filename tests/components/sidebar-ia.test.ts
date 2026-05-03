// IA contract test for the unified-suite sidebar. Asserts the workspaces
// + items match the locked spec — protects against accidental renames or
// item moves that would break the CP/RF parity story.
//
// Pure data assertion (no React render) — that's intentional: the visual
// behavior is reviewed on Vercel preview, not in tests.
//
// May 2026 — workspace IDs renamed to canonical synchronize/analyze/
// strategize/execute/compound (was connect/discover/decide/act/learn).
// Same workspaces, same shape — just the verb-noun rename Sasa locked in
// in commit 5f3f01a (the canonical workflow names update).

import { describe, expect, it } from 'vitest';
import { WORKSPACES } from '../../src/components/dashboard/sidebar-config';

describe('Sidebar IA — unified suite shell', () => {
  it('exposes exactly 5 workspaces in the locked order', () => {
    expect(WORKSPACES.map((w) => w.id)).toEqual([
      'synchronize',
      'analyze',
      'strategize',
      'execute',
      'compound',
    ]);
  });

  it('Analyze collapses to a single Clients destination (no standalone Health/Predictions/Alerts)', () => {
    const analyze = WORKSPACES.find((w) => w.id === 'analyze');
    expect(analyze).toBeDefined();
    const hrefs = analyze!.items.map((i) => i.href);
    expect(hrefs).toEqual(['/dashboard/clients']);
  });

  it('Strategize carries the weekly-decision items', () => {
    const strategize = WORKSPACES.find((w) => w.id === 'strategize');
    expect(strategize?.items.map((i) => i.label)).toEqual([
      'Monday Brief',
      'Proposals',
      'Approvals',
    ]);
  });

  it('Execute carries the doing items', () => {
    const execute = WORKSPACES.find((w) => w.id === 'execute');
    expect(execute?.items.map((i) => i.label)).toEqual(['Check-ins', 'Upsell', 'Meetings']);
  });

  it('Compound carries the insights items', () => {
    const compound = WORKSPACES.find((w) => w.id === 'compound');
    expect(compound?.items.map((i) => i.label)).toEqual(['Reports', 'Outcomes', 'Learning']);
  });

  it('Synchronize carries the data-source items', () => {
    // Apr 28, 2026 — Slack + Transcription consolidated into the
    // Integrations panel (cards on /dashboard/settings) so the sidebar
    // is not cluttered with a top-level entry per integration.
    const synchronize = WORKSPACES.find((w) => w.id === 'synchronize');
    expect(synchronize?.items.map((i) => i.label)).toEqual([
      'Integrations',
    ]);
  });

  it('every item href points under /dashboard', () => {
    for (const ws of WORKSPACES) {
      for (const item of ws.items) {
        expect(item.href.startsWith('/dashboard')).toBe(true);
      }
    }
  });

  it('no duplicate hrefs across workspaces', () => {
    const all = WORKSPACES.flatMap((w) => w.items.map((i) => i.href));
    expect(new Set(all).size).toBe(all.length);
  });
});
