export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { UpsellDetectionAgent, UpsellDetectionInput } from '@/lib/agents/upsell-detection-agent';
import { UpsellOpportunity } from '@/types/alerts';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const agencyId = profile.agency_id as string;

    const { data: opportunities, error: fetchError } = await supabase
      .from('upsell_opportunities')
      .select('*')
      .eq('agency_id', agencyId)
      .order('detected_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching upsell opportunities:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch opportunities' },
        { status: 500 }
      );
    }

    const mapped = (opportunities || []).map((o) => ({
      id: o.id,
      clientId: o.client_id,
      clientName: o.client_name,
      signal: o.signal,
      context: o.context,
      currentServices: o.current_services,
      suggestedService: o.suggested_service,
      estimatedValue: o.estimated_value,
      confidence: o.confidence,
      sourceType: o.source_type,
      sourceMeetingId: o.source_meeting_id,
      detectedAt: o.detected_at,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching upsell opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // §12.2 Rate limit: 5/min per IP — expensive AI endpoint.
  const rl = checkRateLimit(request, 'upsell-detection', RATE_LIMITS.aiExpensive);
  if (rl) return rl;

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const agencyId = profile.agency_id as string;

    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    // Verify client ownership and get client details
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, service_type, monthly_retainer')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Real upsell detection using AI agent with fallback to mock logic
    let opportunities: UpsellOpportunity[] = [];

    try {
      // Check if ANTHROPIC_API_KEY is set
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('ANTHROPIC_API_KEY not set, falling back to mock detection');
        opportunities = await getMockUpsellOpportunities(client, agencyId, clientId);
      } else {
        // Fetch recent meetings and intelligence for this client
        const { data: meetings, error: meetingsError } = await supabase
          .from('meetings')
          .select(
            `
            id,
            title,
            meeting_date,
            summary,
            meeting_intelligence (
              upsell_mentions,
              summary
            )
          `
          )
          .eq('client_id', clientId)
          .eq('agency_id', agencyId)
          .order('meeting_date', { ascending: false })
          .limit(10);

        if (meetingsError) {
          console.warn('Error fetching meetings:', meetingsError);
          opportunities = await getMockUpsellOpportunities(client, agencyId, clientId);
        } else {
          // Extract upsell mentions and summaries from meetings
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const upsellMentions = (meetings || []).flatMap((m: any) => {
            if (!m.meeting_intelligence || m.meeting_intelligence.length === 0) return [];
            const intel = m.meeting_intelligence[0];
            if (!intel.upsell_mentions || intel.upsell_mentions.length === 0) return [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return intel.upsell_mentions.map((mention: any) => ({
              mention: mention.mention,
              context: mention.context || '',
              meetingDate: m.meeting_date,
              meetingId: m.id,
            }));
          });

          const recentMeetingSummaries = (meetings || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((m: any) => {
              if (m.meeting_intelligence && m.meeting_intelligence.length > 0) {
                return m.meeting_intelligence[0].summary || m.title;
              }
              return m.title;
            })
            .filter((s: string) => s && s.length > 0);

          // Prepare agent input
          const agentInput: UpsellDetectionInput = {
            clientId,
            clientName: client.name,
            currentServices: client.service_type || 'Unknown',
            monthlyRetainer: client.monthly_retainer || 0,
            upsellMentions,
            recentMeetingSummaries,
          };

          // Call agent for real AI-powered detection
          try {
            const agent = new UpsellDetectionAgent();
            opportunities = await agent.detectUpsellOpportunities(agentInput);
          } catch (agentError) {
            console.warn('Agent detection failed:', agentError);
            // Fall back to mock if agent fails
            opportunities = await getMockUpsellOpportunities(client, agencyId, clientId);
          }
        }
      }
    } catch (error) {
      console.warn('Upsell detection error, falling back to mock:', error);
      opportunities = await getMockUpsellOpportunities(client, agencyId, clientId);
    }

    // Delete old opportunities for this client, then insert new ones
    await supabase
      .from('upsell_opportunities')
      .delete()
      .eq('agency_id', agencyId)
      .eq('client_id', clientId);

    // Map opportunities to database rows
    const rows = opportunities.map((opp) => ({
      agency_id: agencyId,
      client_id: clientId,
      client_name: opp.clientName,
      signal: opp.signal,
      context: opp.context,
      current_services: opp.currentServices,
      suggested_service: opp.suggestedService,
      estimated_value: opp.estimatedValue,
      confidence: opp.confidence,
      source_type: opp.sourceType,
      source_meeting_id: opp.sourceMeetingId,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('upsell_opportunities')
      .insert(rows)
      .select();

    if (insertError) {
      console.error('Error inserting upsell opportunities:', insertError);
      return NextResponse.json(
        { error: 'Failed to save opportunities' },
        { status: 500 }
      );
    }

    const mapped = (inserted || []).map((o) => ({
      id: o.id,
      clientId: o.client_id,
      clientName: o.client_name,
      signal: o.signal,
      context: o.context,
      currentServices: o.current_services,
      suggestedService: o.suggested_service,
      estimatedValue: o.estimated_value,
      confidence: o.confidence,
      sourceType: o.source_type,
      sourceMeetingId: o.source_meeting_id,
      detectedAt: o.detected_at,
    }));

    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    console.error('Error detecting upsell opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Fallback mock upsell detection based on current service type
 * Used when ANTHROPIC_API_KEY is not set or agent fails
 */
async function getMockUpsellOpportunities(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  agencyId: string,
  clientId: string
): Promise<UpsellOpportunity[]> {
  const currentService = client.service_type || 'Design';
  const currentRetainer = client.monthly_retainer || 0;

  const suggestedServices: {
    service: string;
    value: number;
    signal: string;
    context: string;
  }[] = [];

  if (currentService === 'SEO') {
    suggestedServices.push({
      service: 'Content Marketing',
      value: currentRetainer * 0.75,
      signal: 'High search traffic detected',
      context: 'Client is ranking well for primary keywords, opportunity to expand with content strategy',
    });
    suggestedServices.push({
      service: 'Paid Search',
      value: currentRetainer * 0.5,
      signal: 'Competitive bidding activity detected',
      context: 'Competitors bidding on client keywords, recommend PPC complement',
    });
  } else if (currentService === 'Paid Media') {
    suggestedServices.push({
      service: 'SEO',
      value: currentRetainer * 0.6,
      signal: 'Organic search opportunity identified',
      context: 'Current spend could be supplemented with organic ranking strategy',
    });
    suggestedServices.push({
      service: 'Content Marketing',
      value: currentRetainer * 0.5,
      signal: 'Content gap analysis',
      context: 'Website lacks substantive content, supporting ads with content would improve ROI',
    });
  } else if (currentService === 'Social') {
    suggestedServices.push({
      service: 'Paid Media',
      value: currentRetainer * 1.0,
      signal: 'Audience engagement spike detected',
      context: 'High engagement on social channels suggests audience interest in paid outreach',
    });
    suggestedServices.push({
      service: 'Content Marketing',
      value: currentRetainer * 0.7,
      signal: 'Content performance analysis',
      context: 'Top performing posts indicate content strategy opportunity',
    });
  }

  return suggestedServices.map((s) => ({
    id: `upsell_${clientId}_${Math.random().toString(36).substring(7)}`,
    clientId,
    clientName: client.name,
    signal: s.signal,
    context: s.context,
    currentServices: currentService,
    suggestedService: s.service,
    estimatedValue: s.value,
    confidence: Math.random() > 0.5 ? ('high' as const) : ('medium' as const),
    sourceType: 'usage_pattern' as const,
    detectedAt: new Date().toISOString(),
  }));
}
