// IA contract test for the unified-suite sidebar. Asserts the workspaces
// + items match the locked Apr-25 spec — protects against accidental
// renames or item moves that would break the CP/RF parity story.
//
// Pure data assertion (no React render) — that's intentional: the visual
// behavior is reviewed on Vercel preview, not in tests.

import { describe, expect, it } from 'vitest';
import { WORKSPACES } from '../../src/components/dashboard/sidebar-config';

describe('Sidebar IA — unified suite shell', () => {
  it('exposes exactly 5 workspaces in the locked order', () => {
    expect(WORKSPACES.map((w) => w.id)).toEqual([
      'connect',
      'discover',
      'decide',
      'act',
      'learn',
    ]);
  });

  it('Discover collapses to a single Clients destination (no standalone Health/Predictions/Alerts)', () => {
    const discover = WORKSPACES.find((w) => w.id === 'discover');
    expect(discover).toBeDefined();
    const hrefs = discover!.items.map((i) => i.href);
    expect(hrefs).toEqual(['/dashboard/clients']);
  });

  it('Decide carries the weekly-decision items', () => {
    const decide = WORKSPACES.find((w) => w.id === 'decide');
    expect(decide?.items.map((i) => i.label)).toEqual([
      'Monday Brief',
      'Proposals',
      'Approvals',
    ]);
  });

  it('Act carries the doing items', () => {
    const act = WORKSPACES.find((w) => w.id === 'act');
    expect(act?.items.map((i) => i.label)).toEqual(['Check-ins', 'Upsell', 'Meetings']);
  });

  it('Learn carries the insights items', () => {
    const learn = WORKSPACES.find((w) => w.id === 'learn');
    expect(learn?.items.map((i) => i.label)).toEqual(['Reports', 'Outcomes', 'Learning']);
  });

  it('Connect carries the data-source items', () => {
    // Apr 28, 2026 — Slack + Transcription consolidated into the
    // Integrations panel (cards on /dashboard/settings) so the sidebar
    // is not cluttered with a top-level entry per integration.
    const connect = WORKSPACES.find((w) => w.id === 'connect');
    expect(connect?.items.map((i) => i.label)).toEqual([
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
