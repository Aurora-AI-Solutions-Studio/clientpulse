// Monday Brief — email rendering (HTML + plain-text + subject + preheader).
//
// Mirrors the Brief v2 web layout (src/app/(dashboard)/dashboard/brief/page.tsx)
// in an email-safe way:
//   - Branded header (agency logo+color hooks, fall back to product accent)
//   - Hero one-liner that tells the user what to do this week
//   - Actions block at the top with magic-link Accept buttons (24h tokens)
//   - Client lanes: Needs eyes / Trending down / Good news (light theme)
//   - Snapshot strip
//   - HRAI compliance footer (Art 50 generator label, Art 13 model-card link)
//   - Plain-text fallback rendered from the same data so HTML-disabled
//     clients see the same numbers + URLs.
//
// All CSS is inlined; no <style> blocks (Gmail strips them). Layout is
// table-based (Outlook compatibility). Bulletproof button technique used
// for every action button.
//
// The render functions take a single args object so callers explicitly
// supply branding + magic-link + dashboard URL — no implicit globals.

import type {
  MondayBriefClientEntry,
  MondayBriefContent,
  MondayBriefRecommendedAction,
} from './monday-brief-agent';

// -----------------------------
// Public types
// -----------------------------

export interface BriefAgencyBranding {
  name?: string | null;
  brandLogoUrl?: string | null;
  brandColor?: string | null;
}

export interface RenderBriefEmailArgs {
  brief: MondayBriefContent;
  agency?: BriefAgencyBranding;
  /** Returns the public URL to accept the given recommended action via magic
   *  link. Omit to render Accept buttons that point at the dashboard
   *  (used by tests + previews where there's no token signing context). */
  acceptUrlFor?: (actionId: string) => string;
  /** Public URL to "Open dashboard" footer link. */
  dashboardUrl?: string;
  /** Public URL to "How accurate is this brief?" model card. */
  modelCardUrl?: string;
}

// -----------------------------
// Constants
// -----------------------------

const DEFAULT_ACCENT = '#e74c3c';
const TEXT_PRIMARY = '#0f172a';
const TEXT_MUTED = '#6b7280';
const BG_PAGE = '#f8fafc';
const BG_CARD = '#ffffff';
const BORDER = '#eef2f7';
const COLOR_OK = '#16a34a';
const COLOR_WARN = '#f59e0b';
const COLOR_BAD = '#e74c3c';

const URGENCY_COLOR: Record<MondayBriefRecommendedAction['urgency'], string> = {
  high: COLOR_BAD,
  medium: COLOR_WARN,
  low: COLOR_OK,
};

const URGENCY_LABEL: Record<MondayBriefRecommendedAction['urgency'], string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

const TYPE_LABEL: Record<MondayBriefRecommendedAction['type'], string> = {
  'check-in': 'Check-in',
  escalation: 'Escalation',
  upsell: 'Upsell',
  're-engagement': 'Re-engage',
  'delivery-fix': 'Delivery Fix',
};

const AI_MODEL_LABEL = 'Claude Sonnet 4.6';

// -----------------------------
// Subject + preheader
// -----------------------------

export function buildBriefSubject(args: RenderBriefEmailArgs): string {
  const { brief, agency } = args;
  const namePart = agency?.name ? `${agency.name} — ` : '';
  const critical = brief.snapshot.critical;
  const actions = (brief.recommendedActions ?? []).length;
  const tail =
    critical > 0 || actions > 0
      ? ` — ${critical} critical, ${actions} action${actions === 1 ? '' : 's'} ready`
      : '';
  return `${namePart}Monday Brief · Week of ${brief.weekOf}${tail}`;
}

export function buildBriefPreheader(args: RenderBriefEmailArgs): string {
  const { brief } = args;
  const top = (brief.recommendedActions ?? [])[0];
  if (top) return `Top action: ${top.title}`;
  if (brief.needsAttention[0]) {
    const c = brief.needsAttention[0];
    return `${c.companyName || c.clientName} needs your eyes`;
  }
  return brief.narrative.headline;
}

// -----------------------------
// HTML render
// -----------------------------

export function renderBriefEmailHtml(args: RenderBriefEmailArgs): string {
  const { brief, agency, acceptUrlFor, dashboardUrl, modelCardUrl } = args;
  const accent = pickBrandColor(agency?.brandColor) ?? DEFAULT_ACCENT;
  const preheader = buildBriefPreheader(args);
  const heroLine = buildHeroLine(brief);

  const headerHtml = renderHeader(agency, accent);
  const heroHtml = renderHero(heroLine, brief.weekOf, accent);
  const actionsHtml = renderActions(brief, acceptUrlFor, dashboardUrl);
  const lanesHtml = renderClientLanes(brief, dashboardUrl);
  const snapshotHtml = renderSnapshot(brief, accent);
  const footerHtml = renderFooter(dashboardUrl, modelCardUrl, accent);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(buildBriefSubject(args))}</title>
</head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${TEXT_PRIMARY};">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BG_PAGE};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_PAGE};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:${BG_CARD};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
      ${headerHtml}
      <tr><td style="padding:28px 28px 0 28px;">${heroHtml}</td></tr>
      ${actionsHtml ? `<tr><td style="padding:8px 28px 0 28px;">${actionsHtml}</td></tr>` : ''}
      ${lanesHtml ? `<tr><td style="padding:8px 28px 0 28px;">${lanesHtml}</td></tr>` : ''}
      <tr><td style="padding:8px 28px 0 28px;">${snapshotHtml}</td></tr>
      <tr><td style="padding:24px 28px 28px 28px;">${footerHtml}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// -----------------------------
// Plain-text render
// -----------------------------

export function renderBriefEmailText(args: RenderBriefEmailArgs): string {
  const { brief, agency, acceptUrlFor, dashboardUrl } = args;
  const lines: string[] = [];
  const head = agency?.name ? `${agency.name} — ` : '';
  lines.push(`${head}Monday Brief · Week of ${brief.weekOf}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(buildHeroLine(brief));
  lines.push('');

  const actions = brief.recommendedActions ?? [];
  if (actions.length > 0) {
    lines.push(`DO THIS WEEK (${actions.length} action${actions.length === 1 ? '' : 's'} for your approval)`);
    lines.push('-'.repeat(60));
    actions.forEach((a, i) => {
      lines.push(`${i + 1}. [${URGENCY_LABEL[a.urgency]} · ${TYPE_LABEL[a.type] ?? a.type}] ${a.companyName || a.clientName}`);
      lines.push(`   ${a.title}`);
      lines.push(`   Why: ${a.rationale}`);
      if (a.engagementContext) lines.push(`   Signal: ${a.engagementContext}`);
      const url = acceptUrlFor?.(a.id);
      if (url) lines.push(`   Accept: ${url}`);
      lines.push('');
    });
  }

  if (brief.needsAttention.length > 0) {
    lines.push('NEEDS YOUR EYES');
    lines.push('-'.repeat(60));
    brief.needsAttention.forEach((c) => {
      lines.push(textClientLine(c));
    });
    lines.push('');
  }

  if (brief.trendingRisks.length > 0) {
    lines.push('TRENDING DOWN');
    lines.push('-'.repeat(60));
    brief.trendingRisks.forEach((c) => lines.push(textClientLine(c)));
    lines.push('');
  }

  if (brief.risingStars.length > 0) {
    lines.push('GOOD NEWS');
    lines.push('-'.repeat(60));
    brief.risingStars.forEach((c) => lines.push(textClientLine(c)));
    lines.push('');
  }

  const s = brief.snapshot;
  lines.push('SNAPSHOT');
  lines.push('-'.repeat(60));
  lines.push(`Clients: ${s.totalClients} · Avg health: ${s.averageScore} · Critical: ${s.critical} · At-risk: ${s.atRisk} · Healthy: ${s.healthy}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push(`Generated by ClientPulse · ${AI_MODEL_LABEL}`);
  lines.push('You approve before anything is sent or saved.');
  if (dashboardUrl) lines.push(`Open dashboard: ${dashboardUrl}`);
  return lines.join('\n');
}

// -----------------------------
// HTML helpers
// -----------------------------

function renderHeader(agency: BriefAgencyBranding | undefined, accent: string): string {
  const wordmark = agency?.brandLogoUrl
    ? `<img src="${escapeAttr(agency.brandLogoUrl)}" alt="${escapeAttr(agency?.name ?? 'Agency')}" height="32" style="display:block;height:32px;border:0;outline:none;">`
    : `<div style="font-weight:700;font-size:18px;color:#ffffff;letter-spacing:-0.01em;">${escapeHtml(agency?.name ?? 'ClientPulse')}</div>`;

  return `<tr><td style="background:${accent};padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">${wordmark}</td>
        <td align="right" valign="middle" style="color:#ffffff;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">Monday Brief</td>
      </tr>
    </table>
  </td></tr>`;
}

function renderHero(heroLine: string, weekOf: string, accent: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid ${accent};background:${BG_PAGE};border-radius:8px;">
    <tr><td style="padding:16px 18px;">
      <div style="font-size:11px;color:${accent};font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Week of ${escapeHtml(weekOf)}</div>
      <div style="font-size:18px;color:${TEXT_PRIMARY};font-weight:600;line-height:1.4;">${escapeHtml(heroLine)}</div>
    </td></tr>
  </table>`;
}

function renderActions(
  brief: MondayBriefContent,
  acceptUrlFor: ((id: string) => string) | undefined,
  dashboardUrl: string | undefined,
): string {
  const actions = brief.recommendedActions ?? [];
  if (actions.length === 0) return '';

  const cards = actions
    .map((a, i) => {
      const urgencyColor = URGENCY_COLOR[a.urgency];
      const acceptUrl = acceptUrlFor?.(a.id) ?? dashboardUrl ?? '#';
      const buttonText = `Accept · add to action items`;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:${i === 0 ? '0' : '10px'};border:1px solid ${BORDER};border-left:4px solid ${urgencyColor};border-radius:8px;background:${BG_CARD};">
        <tr><td style="padding:14px 16px;">
          <div style="font-size:11px;color:${urgencyColor};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">
            ${i + 1}. ${escapeHtml(URGENCY_LABEL[a.urgency])} · ${escapeHtml(TYPE_LABEL[a.type] ?? a.type)} · ${escapeHtml(a.companyName || a.clientName)}
          </div>
          <div style="font-size:15px;font-weight:600;color:${TEXT_PRIMARY};line-height:1.35;margin-bottom:6px;">${escapeHtml(a.title)}</div>
          <div style="font-size:13px;color:${TEXT_MUTED};line-height:1.45;"><span style="color:${TEXT_PRIMARY};">Why: </span>${escapeHtml(a.rationale)}</div>
          ${a.engagementContext ? `<div style="font-size:12px;color:${urgencyColor};margin-top:6px;">Signal: ${escapeHtml(a.engagementContext)}</div>` : ''}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr><td bgcolor="${urgencyColor}" style="border-radius:6px;">
            <a href="${escapeAttr(acceptUrl)}" style="display:inline-block;padding:8px 14px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;background:${urgencyColor};">${escapeHtml(buttonText)}</a>
          </td></tr></table>
        </td></tr>
      </table>`;
    })
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
        <tr>
          <td align="left" style="font-size:13px;font-weight:700;color:${TEXT_PRIMARY};text-transform:uppercase;letter-spacing:0.08em;">
            Do this week · ${actions.length} action${actions.length === 1 ? '' : 's'}
          </td>
          <td align="right" style="font-size:11px;color:${TEXT_MUTED};">For your approval</td>
        </tr>
      </table>
      <div style="margin-top:8px;">${cards}</div>
      <div style="font-size:11px;color:${TEXT_MUTED};margin-top:8px;">
        Generated by ${escapeHtml(AI_MODEL_LABEL)}. You approve before anything is sent or saved.
      </div>
    </td></tr>
  </table>`;
}

function renderClientLanes(brief: MondayBriefContent, dashboardUrl: string | undefined): string {
  const lanes: string[] = [];
  if (brief.needsAttention.length > 0) {
    lanes.push(renderLane('Needs your eyes', COLOR_BAD, brief.needsAttention, dashboardUrl));
  }
  if (brief.trendingRisks.length > 0) {
    lanes.push(renderLane('Trending down', COLOR_WARN, brief.trendingRisks, dashboardUrl));
  }
  if (brief.risingStars.length > 0) {
    lanes.push(renderLane('Good news', COLOR_OK, brief.risingStars, dashboardUrl));
  }
  if (lanes.length === 0) return '';
  return `<div style="margin-top:16px;">${lanes.join('')}</div>`;
}

function renderLane(
  title: string,
  accent: string,
  entries: MondayBriefClientEntry[],
  dashboardUrl: string | undefined,
): string {
  const rows = entries
    .map((e) => {
      const link = dashboardUrl ? `${dashboardUrl}/clients/${encodeURIComponent(e.clientId)}` : null;
      const nameCell = link
        ? `<a href="${escapeAttr(link)}" style="color:${TEXT_PRIMARY};text-decoration:none;font-weight:500;">${escapeHtml(e.companyName || e.clientName)}</a>`
        : `<span style="color:${TEXT_PRIMARY};font-weight:500;">${escapeHtml(e.companyName || e.clientName)}</span>`;
      const dColor =
        e.delta === undefined || e.delta === 0
          ? TEXT_MUTED
          : e.delta > 0
            ? COLOR_OK
            : COLOR_BAD;
      const dLabel =
        e.delta === undefined ? '—' : e.delta > 0 ? `+${e.delta}` : `${e.delta}`;
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};">${nameCell}</td>
        <td align="right" style="padding:10px 12px;border-bottom:1px solid ${BORDER};color:${TEXT_PRIMARY};font-weight:600;">${e.overallScore}</td>
        <td align="right" style="padding:10px 12px;border-bottom:1px solid ${BORDER};color:${dColor};font-weight:600;">${dLabel}</td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};color:${TEXT_MUTED};font-size:12px;">${escapeHtml(e.topSignal ?? '')}</td>
      </tr>`;
    })
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;background:${BG_CARD};">
    <tr><td style="padding:12px 14px;background:${BG_PAGE};">
      <span style="display:inline-block;width:10px;height:10px;background:${accent};border-radius:50%;margin-right:8px;vertical-align:middle;"></span>
      <span style="font-size:13px;font-weight:700;color:${TEXT_PRIMARY};">${escapeHtml(title)}</span>
      <span style="font-size:11px;color:${accent};font-weight:700;margin-left:6px;">(${entries.length})</span>
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <thead><tr style="background:${BG_PAGE};">
          <th align="left" style="padding:8px 12px;font-size:10px;color:${TEXT_MUTED};font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Client</th>
          <th align="right" style="padding:8px 12px;font-size:10px;color:${TEXT_MUTED};font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Score</th>
          <th align="right" style="padding:8px 12px;font-size:10px;color:${TEXT_MUTED};font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Δ WoW</th>
          <th align="left" style="padding:8px 12px;font-size:10px;color:${TEXT_MUTED};font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Signal</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </td></tr>
  </table>`;
}

function renderSnapshot(brief: MondayBriefContent, accent: string): string {
  const s = brief.snapshot;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background:${BG_PAGE};border-radius:8px;">
    <tr>
      ${snapshotCell('Clients', `${s.totalClients}`, TEXT_PRIMARY)}
      ${snapshotCell('Avg health', `${s.averageScore}`, accent)}
      ${snapshotCell('Critical', `${s.critical}`, COLOR_BAD)}
      ${snapshotCell('At-risk', `${s.atRisk}`, COLOR_WARN)}
      ${snapshotCell('Healthy', `${s.healthy}`, COLOR_OK)}
    </tr>
  </table>`;
}

function snapshotCell(label: string, value: string, valueColor: string): string {
  return `<td align="center" style="padding:14px 8px;">
    <div style="font-size:10px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">${escapeHtml(label)}</div>
    <div style="font-size:20px;font-weight:700;color:${valueColor};margin-top:4px;">${escapeHtml(value)}</div>
  </td>`;
}

function renderFooter(
  dashboardUrl: string | undefined,
  modelCardUrl: string | undefined,
  accent: string,
): string {
  const dashboard = dashboardUrl
    ? `<a href="${escapeAttr(dashboardUrl)}" style="color:${accent};text-decoration:none;">Open dashboard</a>`
    : '';
  const modelCard = modelCardUrl
    ? `<a href="${escapeAttr(modelCardUrl)}" style="color:${TEXT_MUTED};text-decoration:underline;">How accurate is this brief?</a>`
    : '';
  return `<div style="border-top:1px solid ${BORDER};padding-top:14px;font-size:11px;color:${TEXT_MUTED};line-height:1.6;">
    Generated by ${escapeHtml(AI_MODEL_LABEL)}. You approve before anything is sent or saved.
    ${dashboard ? ` · ${dashboard}` : ''}
    ${modelCard ? ` · ${modelCard}` : ''}
  </div>`;
}

// -----------------------------
// Hero line — same priority order as the dashboard
// -----------------------------

export function buildHeroLine(brief: MondayBriefContent): string {
  const parts: string[] = [];
  const critical = brief.snapshot.critical;
  const trending = brief.trendingRisks.length;
  const rising = brief.risingStars.length;
  const actions = (brief.recommendedActions ?? []).length;

  if (critical > 0) {
    const lead = brief.needsAttention[0];
    if (lead) {
      parts.push(`${lead.companyName || lead.clientName} is critical`);
      if (critical > 1) {
        parts.push(`${critical - 1} other${critical - 1 === 1 ? '' : 's'} need eyes`);
      }
    } else {
      parts.push(`${critical} client${critical === 1 ? '' : 's'} critical`);
    }
  }
  if (trending > 0) parts.push(`${trending} trending down`);
  if (actions > 0) parts.push(`${actions} action${actions === 1 ? '' : 's'} ready`);
  if (parts.length === 0 && rising > 0) {
    parts.push(`${rising} client${rising === 1 ? '' : 's'} trending up`);
  }
  if (parts.length === 0) parts.push('All clients healthy this week');
  return parts.join(' · ');
}

function textClientLine(e: MondayBriefClientEntry): string {
  const dLabel = e.delta === undefined ? '—' : e.delta > 0 ? `+${e.delta}` : `${e.delta}`;
  const signal = e.topSignal ? ` · ${e.topSignal}` : '';
  return `  - ${e.companyName || e.clientName} (score ${e.overallScore}, Δ ${dLabel} WoW)${signal}`;
}

function pickBrandColor(c: string | null | undefined): string | null {
  if (!c) return null;
  const trimmed = c.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : null;
}

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
