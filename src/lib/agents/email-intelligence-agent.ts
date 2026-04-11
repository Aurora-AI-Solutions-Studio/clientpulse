/**
 * Email Intelligence Agent — Sprint 5
 *
 * Syncs Gmail thread metadata, matches threads to clients,
 * and computes per-client email engagement metrics (response time,
 * volume trend, responsiveness).
 *
 * PRIVACY: We only store thread metadata (subject, participants, dates, counts).
 * We never store email bodies. Sentiment analysis is optional and runs on snippets only.
 */

import { ClientEmailMetrics } from '@/types/integrations';

interface EmailThreadRow {
  id: string;
  client_id: string | null;
  last_message_date: string;
  message_count: number;
  participants: string[];
  is_inbound: boolean;
  synced_at: string;
}

/**
 * Match email threads to clients based on participant emails / domains
 */
export function matchThreadsToClients(
  threads: Array<{
    id: string;
    participants: string[];
    [key: string]: unknown;
  }>,
  clients: Array<{
    id: string;
    contact_email?: string;
    company: string;
  }>
): Map<string, string> {
  const threadToClient = new Map<string, string>();

  const emailToClient = new Map<string, string>();
  const domainToClient = new Map<string, string>();

  for (const client of clients) {
    if (client.contact_email) {
      emailToClient.set(client.contact_email.toLowerCase(), client.id);
      const domain = client.contact_email.split('@')[1]?.toLowerCase();
      if (domain && !isGenericDomain(domain)) {
        domainToClient.set(domain, client.id);
      }
    }
  }

  for (const thread of threads) {
    if (!thread.participants || thread.participants.length === 0) continue;

    for (const participant of thread.participants) {
      const email = participant.toLowerCase();
      if (emailToClient.has(email)) {
        threadToClient.set(thread.id as string, emailToClient.get(email)!);
        break;
      }
      const domain = email.split('@')[1];
      if (domain && domainToClient.has(domain)) {
        threadToClient.set(thread.id as string, domainToClient.get(domain)!);
        break;
      }
    }
  }

  return threadToClient;
}

/**
 * Compute email engagement metrics for a single client
 */
export function computeEmailMetrics(
  clientId: string,
  threads: EmailThreadRow[],
  now: Date = new Date()
): ClientEmailMetrics {
  const clientThreads = threads
    .filter((t) => t.client_id === clientId)
    .sort(
      (a, b) =>
        new Date(a.last_message_date).getTime() -
        new Date(b.last_message_date).getTime()
    );

  const msPerDay = 1000 * 60 * 60 * 24;
  const now30d = new Date(now.getTime() - 30 * msPerDay);
  const now60d = new Date(now.getTime() - 60 * msPerDay);

  const threads30d = clientThreads.filter(
    (t) => new Date(t.last_message_date) >= now30d
  );
  const threads30to60d = clientThreads.filter(
    (t) =>
      new Date(t.last_message_date) >= now60d &&
      new Date(t.last_message_date) < now30d
  );

  const totalThreads30d = threads30d.length;
  const totalMessages30d = threads30d.reduce(
    (sum, t) => sum + t.message_count,
    0
  );

  // Volume trend: compare last 30d vs prior 30d
  const priorThreads = threads30to60d.length;
  let volumeTrend: 'increasing' | 'stable' | 'declining' = 'stable';
  if (totalThreads30d > priorThreads * 1.3) volumeTrend = 'increasing';
  else if (totalThreads30d < priorThreads * 0.7 && priorThreads > 0)
    volumeTrend = 'declining';

  // Response time estimation from thread message counts and timing
  // Heuristic: avg messages per thread × avg thread age / 2 = approximate turnaround
  let avgResponseTimeHours = 24; // Default 24h
  let clientAvgResponseTimeHours = 24;

  if (threads30d.length > 0) {
    const inboundThreads = threads30d.filter((t) => t.is_inbound);
    const outboundThreads = threads30d.filter((t) => !t.is_inbound);

    // If we have both directions, estimate response cadence from message density
    if (inboundThreads.length > 0 && outboundThreads.length > 0) {
      const avgMsgsPerThread =
        totalMessages30d / threads30d.length;
      // More messages per thread = faster back-and-forth = lower response time
      avgResponseTimeHours = Math.max(1, 48 / avgMsgsPerThread);
      clientAvgResponseTimeHours = Math.max(1, 48 / avgMsgsPerThread);
    }
  }

  // Response time trend (compare avg msg density 30d vs 30-60d)
  let responseTimeTrend: 'improving' | 'stable' | 'worsening' = 'stable';
  if (threads30d.length > 0 && threads30to60d.length > 0) {
    const density30d = totalMessages30d / Math.max(1, threads30d.length);
    const msgs30to60d = threads30to60d.reduce(
      (sum, t) => sum + t.message_count,
      0
    );
    const density60d = msgs30to60d / Math.max(1, threads30to60d.length);
    if (density30d > density60d * 1.2) responseTimeTrend = 'improving';
    else if (density30d < density60d * 0.8) responseTimeTrend = 'worsening';
  }

  // Last email date
  const lastThread = clientThreads[clientThreads.length - 1];
  const lastEmailDate = lastThread ? lastThread.last_message_date : undefined;

  return {
    clientId,
    totalThreads30d,
    totalMessages30d,
    avgResponseTimeHours: Math.round(avgResponseTimeHours * 10) / 10,
    clientAvgResponseTimeHours:
      Math.round(clientAvgResponseTimeHours * 10) / 10,
    responseTimetrend: responseTimeTrend,
    volumeTrend,
    lastEmailDate,
  };
}

/**
 * Build Gmail OAuth URL
 */
export function buildGmailAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.metadata',
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange Gmail authorization code for tokens
 */
export async function exchangeGmailCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail OAuth token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Fetch Gmail thread list (metadata only)
 */
export async function fetchGmailThreads(
  accessToken: string,
  query: string = '',
  maxResults: number = 100
): Promise<
  Array<{
    id: string;
    snippet: string;
    historyId: string;
  }>
> {
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    ...(query ? { q: query } : {}),
  });

  const response = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/threads?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail API error: ${error}`);
  }

  const data = await response.json();
  return data.threads || [];
}

/**
 * Fetch Gmail thread detail (metadata only — no body)
 */
export async function fetchGmailThreadDetail(
  accessToken: string,
  threadId: string
): Promise<{
  id: string;
  messages: Array<{
    id: string;
    internalDate: string;
    payload: {
      headers: Array<{ name: string; value: string }>;
    };
    labelIds: string[];
  }>;
}> {
  const response = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail API thread detail error: ${error}`);
  }

  return response.json();
}

function isGenericDomain(domain: string): boolean {
  const generic = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'aol.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
    'live.com', 'msn.com', 'me.com', 'googlemail.com',
  ]);
  return generic.has(domain);
}
