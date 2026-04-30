export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGmailThreads,
  fetchGmailThreadDetail,
  matchThreadsToClients,
  computeEmailMetrics,
} from '@/lib/agents/email-intelligence-agent';
import { refreshCalendarToken } from '@/lib/agents/calendar-intelligence-agent';
import { encryptToken, decryptToken } from '@/lib/crypto/integration-tokens';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

/**
 * POST /api/integrations/gmail/sync
 * Trigger a Gmail sync: fetch threads, match to clients, compute email metrics.
 * Auth + writes via service client to avoid RLS-context drift (see /api/slack/route.ts).
 */
export async function POST(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient } = auth.ctx;

    // Get Gmail connection
    const { data: connection } = await serviceClient
      .from('integration_connections')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('provider', 'gmail')
      .eq('status', 'connected')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'No active Gmail connection found' },
        { status: 404 }
      );
    }

    // Refresh token if expired (same Google OAuth, same refresh function)
    let accessToken = connection.access_token ? decryptToken(connection.access_token) : null;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      try {
        const refreshed = await refreshCalendarToken(
          decryptToken(connection.refresh_token!),
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!
        );
        accessToken = refreshed.access_token;
        await serviceClient
          .from('integration_connections')
          .update({
            access_token: encryptToken(refreshed.access_token),
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id);
      } catch {
        await serviceClient
          .from('integration_connections')
          .update({ status: 'expired', error: 'Token refresh failed' })
          .eq('id', connection.id);
        return NextResponse.json({ error: 'Gmail connection expired, please reconnect' }, { status: 401 });
      }
    }

    // Fetch threads (last 60 days, max 100)
    const query = `newer_than:60d`;
    const threadList = await fetchGmailThreads(accessToken!, query, 100);

    // Get agency clients for matching
    const { data: clients } = await serviceClient
      .from('clients')
      .select('id, contact_email, company:company_name')
      .eq('agency_id', agencyId);

    if (!clients || clients.length === 0) {
      // Record sync ran (mirrors calendar/sync — see comment there).
      await serviceClient
        .from('integration_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);
      return NextResponse.json({
        success: true,
        threadsFound: threadList.length,
        clientsMatched: 0,
        message: 'Sync ran — no clients to match against. Add a client first to surface engagement.',
      });
    }

    // Fetch thread details and extract metadata
    let threadsProcessed = 0;
    const threadDetails: Array<{
      id: string;
      subject: string;
      participants: string[];
      lastMessageDate: string;
      messageCount: number;
      isInbound: boolean;
      snippet: string;
    }> = [];

    // Process threads in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < Math.min(threadList.length, 100); i += batchSize) {
      const batch = threadList.slice(i, i + batchSize);
      const details = await Promise.all(
        batch.map(async (t) => {
          try {
            const detail = await fetchGmailThreadDetail(accessToken!, t.id);
            const messages = detail.messages || [];
            const lastMsg = messages[messages.length - 1];

            // Extract headers
            const getHeader = (msg: typeof lastMsg, name: string) =>
              msg?.payload?.headers?.find(
                (h) => h.name.toLowerCase() === name.toLowerCase()
              )?.value || '';

            const subject = getHeader(messages[0], 'Subject') || '(no subject)';
            const participantSet = new Set<string>();

            for (const msg of messages) {
              const from = getHeader(msg, 'From');
              const to = getHeader(msg, 'To');
              // Extract email from "Name <email>" format
              const extractEmail = (s: string) => {
                const match = s.match(/<([^>]+)>/);
                return match ? match[1].toLowerCase() : s.toLowerCase().trim();
              };
              if (from) participantSet.add(extractEmail(from));
              if (to) {
                to.split(',').forEach((addr) => participantSet.add(extractEmail(addr.trim())));
              }
            }

            // Determine if last message is inbound (not from the connected account)
            const lastFrom = getHeader(lastMsg, 'From');
            const connectedEmail = connection.account_email?.toLowerCase() || '';
            const isInbound = !lastFrom.toLowerCase().includes(connectedEmail);

            return {
              id: t.id,
              subject,
              participants: Array.from(participantSet),
              lastMessageDate: lastMsg
                ? new Date(parseInt(lastMsg.internalDate)).toISOString()
                : new Date().toISOString(),
              messageCount: messages.length,
              isInbound,
              snippet: t.snippet || '',
            };
          } catch (err) {
            console.error(`Error fetching thread ${t.id}:`, err);
            return null;
          }
        })
      );

      for (const d of details) {
        if (d) {
          threadDetails.push(d);
          threadsProcessed++;
        }
      }
    }

    // Match threads to clients
    const threadClientMap = matchThreadsToClients(threadDetails, clients);

    // Upsert email threads into DB
    for (const thread of threadDetails) {
      const clientId = threadClientMap.get(thread.id) || null;
      await serviceClient
        .from('email_threads')
        .upsert(
          {
            agency_id: agencyId,
            client_id: clientId,
            connection_id: connection.id,
            gmail_thread_id: thread.id,
            subject: thread.subject,
            last_message_date: thread.lastMessageDate,
            message_count: thread.messageCount,
            participants: thread.participants,
            snippet: thread.snippet,
            is_inbound: thread.isInbound,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'connection_id,gmail_thread_id' }
        );
    }

    // Compute email metrics per matched client
    const matchedClientIds = new Set(threadClientMap.values());

    const { data: allEmailThreads } = await serviceClient
      .from('email_threads')
      .select('id, client_id, last_message_date, message_count, participants, is_inbound, synced_at')
      .eq('agency_id', agencyId)
      .not('client_id', 'is', null);

    for (const clientId of Array.from(matchedClientIds)) {
      if (!allEmailThreads) continue;
      const metrics = computeEmailMetrics(clientId, allEmailThreads as Array<{
        id: string;
        client_id: string | null;
        last_message_date: string;
        message_count: number;
        participants: string[];
        is_inbound: boolean;
        synced_at: string;
      }>);

      // Upsert into engagement_metrics (merge with calendar data if exists)
      const { error: rpcError } = await serviceClient.rpc('upsert_email_engagement', {
        p_agency_id: agencyId,
        p_client_id: clientId,
        p_email_score: 50, // Will be recomputed by engagement agent
        p_email_volume_trend: metrics.volumeTrend,
        p_avg_response_time_hours: metrics.avgResponseTimeHours,
        p_client_responsiveness: metrics.clientAvgResponseTimeHours <= 12 ? 80 : 50,
      });
      if (rpcError) {
        // Fallback: direct upsert if RPC doesn't exist
        await serviceClient
          .from('engagement_metrics')
          .upsert(
            {
              agency_id: agencyId,
              client_id: clientId,
              email_score: 50,
              email_volume_trend: metrics.volumeTrend,
              avg_response_time_hours: metrics.avgResponseTimeHours,
              client_responsiveness: metrics.clientAvgResponseTimeHours <= 12 ? 80 : 50,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'agency_id,client_id' }
          );
      }
    }

    // Update last sync time
    await serviceClient
      .from('integration_connections')
      .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', connection.id);

    return NextResponse.json({
      success: true,
      threadsFound: threadList.length,
      threadsProcessed,
      clientsMatched: matchedClientIds.size,
    });
  } catch (error) {
    console.error('Gmail sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
