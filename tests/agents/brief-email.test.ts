import { describe, expect, it } from 'vitest';
import {
  buildBriefPreheader,
  buildBriefSubject,
  buildHeroLine,
  renderBriefEmailHtml,
  renderBriefEmailText,
} from '../../src/lib/agents/brief-email';
import type { MondayBriefContent } from '../../src/lib/agents/monday-brief-agent';

const briefBase: MondayBriefContent = {
  generatedAt: '2026-04-26T08:00:00Z',
  weekOf: '2026-04-20',
  snapshot: {
    totalClients: 6,
    healthy: 3,
    atRisk: 2,
    critical: 1,
    averageScore: 64,
    weekOverWeekDelta: -3,
  },
  needsAttention: [
    {
      clientId: 'c-crit',
      clientName: 'Crit Lead',
      companyName: 'CritCorp',
      overallScore: 28,
      previousScore: 35,
      delta: -7,
      status: 'critical',
      topSignal: 'No reply in 17 days',
    },
  ],
  trendingRisks: [
    {
      clientId: 'c-tr',
      clientName: 'Trend Lead',
      companyName: 'TrendCo',
      overallScore: 48,
      previousScore: 60,
      delta: -12,
      status: 'at-risk',
      topSignal: 'Sentiment dropping',
    },
  ],
  risingStars: [],
  topActionItems: [],
  recommendedActions: [
    {
      id: 'ra-1',
      type: 'escalation',
      clientId: 'c-crit',
      clientName: 'Crit Lead',
      companyName: 'CritCorp',
      title: 'Schedule executive sync with CritCorp this week',
      rationale: 'Critical health, no reply in 17 days. Lead with empathy + retainer review.',
      urgency: 'high',
      engagementContext: 'No meetings in 17 days, email volume down 60%',
    },
    {
      id: 'ra-2',
      type: 'check-in',
      clientId: 'c-tr',
      clientName: 'Trend Lead',
      companyName: 'TrendCo',
      title: 'Check in with TrendCo on QBR follow-ups',
      rationale: 'Sentiment dropping, score down 12 WoW.',
      urgency: 'medium',
    },
  ],
  engagementInsights: [],
  narrative: {
    headline: '1 client in critical — act today · 2 proposals ready',
    summary:
      '6 active clients tracked. Avg health 64/100 (down 3 pts WoW). 3 healthy · 2 at-risk · 1 critical. 2 proposed actions below — Accept to add to your action items.',
    recommendation:
      'Start here: Schedule executive sync with CritCorp this week — CritCorp. Critical health, no reply in 17 days.',
  },
};

describe('brief-email', () => {
  describe('buildBriefSubject', () => {
    it('mirrors agency name + week + critical/action counts', () => {
      const subject = buildBriefSubject({
        brief: briefBase,
        agency: { name: 'Acme Agency' },
      });
      expect(subject).toBe(
        'Acme Agency — Monday Brief · Week of 2026-04-20 — 1 critical, 2 actions ready',
      );
    });

    it('omits the tail when nothing critical and no actions', () => {
      const calm: MondayBriefContent = {
        ...briefBase,
        snapshot: { ...briefBase.snapshot, critical: 0 },
        recommendedActions: [],
      };
      const subject = buildBriefSubject({ brief: calm });
      expect(subject).toBe('Monday Brief · Week of 2026-04-20');
    });
  });

  describe('buildBriefPreheader', () => {
    it('uses the top action title when present', () => {
      const ph = buildBriefPreheader({ brief: briefBase });
      expect(ph).toBe('Top action: Schedule executive sync with CritCorp this week');
    });

    it('falls back to needsAttention[0] when no actions', () => {
      const ph = buildBriefPreheader({
        brief: { ...briefBase, recommendedActions: [] },
      });
      expect(ph).toBe('CritCorp needs your eyes');
    });

    it('falls back to narrative headline when nothing critical/action', () => {
      const calm: MondayBriefContent = {
        ...briefBase,
        snapshot: { ...briefBase.snapshot, critical: 0 },
        needsAttention: [],
        recommendedActions: [],
      };
      const ph = buildBriefPreheader({ brief: calm });
      expect(ph).toBe(briefBase.narrative.headline);
    });
  });

  describe('renderBriefEmailHtml', () => {
    it('places the actions block before the client lanes', () => {
      const html = renderBriefEmailHtml({ brief: briefBase });
      const doIdx = html.indexOf('Do this week');
      const lanesIdx = html.indexOf('Needs your eyes');
      expect(doIdx).toBeGreaterThan(0);
      expect(lanesIdx).toBeGreaterThan(0);
      expect(doIdx).toBeLessThan(lanesIdx);
    });

    it('wires Accept button to the magic link when acceptUrlFor is supplied', () => {
      const html = renderBriefEmailHtml({
        brief: briefBase,
        acceptUrlFor: (id) => `https://x.test/accept?id=${id}`,
      });
      expect(html).toContain('https://x.test/accept?id=ra-1');
      expect(html).toContain('https://x.test/accept?id=ra-2');
    });

    it('falls back to dashboard URL when acceptUrlFor missing', () => {
      const html = renderBriefEmailHtml({
        brief: briefBase,
        dashboardUrl: 'https://dash.test',
      });
      expect(html).toContain('https://dash.test');
    });

    it('uses brand color override when provided', () => {
      const html = renderBriefEmailHtml({
        brief: briefBase,
        agency: { name: 'A', brandColor: '#123abc' },
      });
      expect(html).toContain('#123abc');
    });

    it('ignores invalid brand color and falls back to product accent', () => {
      const html = renderBriefEmailHtml({
        brief: briefBase,
        agency: { name: 'A', brandColor: 'red; <script>' },
      });
      expect(html).not.toContain('red; ');
      expect(html).toContain('#e74c3c');
    });

    it('renders an <img> when brandLogoUrl is present', () => {
      const html = renderBriefEmailHtml({
        brief: briefBase,
        agency: { name: 'A', brandLogoUrl: 'https://cdn.test/logo.png' },
      });
      expect(html).toContain('<img src="https://cdn.test/logo.png"');
    });

    it('escapes hostile agency name in branded header', () => {
      const html = renderBriefEmailHtml({
        brief: briefBase,
        agency: { name: '<script>alert(1)</script>' },
      });
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('contains a hidden preheader', () => {
      const html = renderBriefEmailHtml({ brief: briefBase });
      expect(html).toContain('Top action: Schedule executive sync with CritCorp this week');
    });
  });

  describe('renderBriefEmailText', () => {
    it('renders the same hero line as HTML', () => {
      const text = renderBriefEmailText({ brief: briefBase });
      expect(text).toContain(buildHeroLine(briefBase));
    });

    it('lists every action with title + Why + Accept URL', () => {
      const text = renderBriefEmailText({
        brief: briefBase,
        acceptUrlFor: (id) => `https://x.test/${id}`,
      });
      expect(text).toContain('Schedule executive sync with CritCorp this week');
      expect(text).toContain('Why: Critical health, no reply in 17 days.');
      expect(text).toContain('Accept: https://x.test/ra-1');
      expect(text).toContain('Accept: https://x.test/ra-2');
    });

    it('lists snapshot numbers in a single SNAPSHOT line', () => {
      const text = renderBriefEmailText({ brief: briefBase });
      expect(text).toMatch(
        /Clients: 6 · Avg health: 64 · Critical: 1 · At-risk: 2 · Healthy: 3/,
      );
    });

    it('omits Accept lines when no acceptUrlFor', () => {
      const text = renderBriefEmailText({ brief: briefBase });
      expect(text).not.toContain('Accept:');
    });
  });

  describe('buildHeroLine', () => {
    it('leads with critical client name', () => {
      const line = buildHeroLine(briefBase);
      expect(line.startsWith('CritCorp is critical')).toBe(true);
    });

    it('appends action count when critical present', () => {
      const line = buildHeroLine(briefBase);
      expect(line).toContain('2 actions ready');
    });

    it('handles all-healthy state', () => {
      const calm: MondayBriefContent = {
        ...briefBase,
        snapshot: { ...briefBase.snapshot, critical: 0 },
        needsAttention: [],
        trendingRisks: [],
        risingStars: [],
        recommendedActions: [],
      };
      expect(buildHeroLine(calm)).toBe('All clients healthy this week');
    });
  });
});
