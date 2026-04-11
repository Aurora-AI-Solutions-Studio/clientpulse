export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGmailThreads,
  fetchGmailThreadDetail,
  matchThreadsToClients,
  computeEmailMetrics,
} from '@/lib/agents/email-intelligence-agent';
import { refreshCalendarToken } from '@/lib/agents/calendar-intelligence-agent';

/**
 * POST /api/integrations/gmail/sync
 * Trigger a Gmail sync: fetch threads, match to clients, compute email metrics
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (!profile?.agency_id) {
      return NextResponse.json({ error: 'No agency found' }, { status: 404 });
    }

    // Get Gmail connection
    const { data: connection } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('agency_id', profile.agency_id)
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
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      try {
        const refreshed = await refreshCalendarToken(
          connection.refresh_token!,
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!
        );
        accessToken = refreshed.access_token;
        await supabase
          .from('integration_connections')
          .update({
            access_token: refreshed.access_token,
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id);
      } catch {
        await supabase
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
    const { data: clients } = await supabase
      .from('clients')
      .select('id, contact_email, company')
      .eq('agency_id', profile.agency_id);

    if (!clients || clients.length === 0) {
      return NextResponse.json({ threadsFound: threadList.length, clientsMatched: 0 });
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
      await supabase
        .from('email_threads')
        .upsert(
          {
            agency_id: profile.agency_id,
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

    const { data: allEmailThreads } = await supabase
      .from('email_threads')
      .select('id, client_id, last_message_date, message_count, participants, is_inbound, synced_at')
      .eq('agency_id', profile.agency_id)
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
      const { error: rpcError } = await supabase.rpc('upsert_email_engagement', {
        p_agency_id: profile.agency_id,
        p_client_id: clientId,
        p_email_score: 50, // Will be recomputed by engagement agent
        p_email_volume_trend: metrics.volumeTrend,
        p_avg_response_time_hours: metrics.avgResponseTimeHours,
        p_client_responsiveness: metrics.clientAvgResponseTimeHours <= 12 ? 80 : 50,
      });
      if (rpcError) {
        // Fallback: direct upsert if RPC doesn't exist
        await supabase
          .from('engagement_metrics')
          .upsert(
            {
              agency_id: profile.agency_id,
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
    await supabase
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
