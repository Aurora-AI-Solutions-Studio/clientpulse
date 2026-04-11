export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { UpsellOpportunity } from '@/types/alerts';

// In-memory storage for upsell opportunities
// Structure: Map<agencyId, UpsellOpportunity[]>
const upsellStore = new Map<string, UpsellOpportunity[]>();

function generateId(): string {
  return `upsell_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's agency ID
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

    // Get all detected upsell opportunities for the agency
    const opportunities = upsellStore.get(agencyId) || [];

    return NextResponse.json(opportunities);
  } catch (error) {
    console.error('Error fetching upsell opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's agency ID
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

    // Verify client ownership and get client name and details
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, service_type, monthly_retainer')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // TODO: In production, run actual upsell detection algorithm
    // This would analyze meeting transcripts, usage patterns, market signals, etc.
    // For now, generate mock opportunities based on client service type

    const opportunities: UpsellOpportunity[] = [];

    // Mock upsell opportunities based on current service type
    const currentService = client.service_type || 'Design';
    const currentRetainer = client.monthly_retainer || 0;

    // Suggest complementary services
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

    // Create upsell opportunities from suggestions
    for (const suggestion of suggestedServices) {
      const opportunity: UpsellOpportunity = {
        id: generateId(),
        clientId,
        clientName: client.name,
        signal: suggestion.signal,
        context: suggestion.context,
        currentServices: currentService,
        suggestedService: suggestion.service,
        estimatedValue: suggestion.value,
        confidence: Math.random() > 0.5 ? 'high' : 'medium',
        sourceType: 'usage_pattern',
        detectedAt: new Date().toISOString(),
      };
      opportunities.push(opportunity);
    }

    // Store opportunities (add to existing for this client)
    const allOpportunities = upsellStore.get(agencyId) || [];
    // Remove old opportunities for this client
    const filtered = allOpportunities.filter((o) => o.clientId !== clientId);
    filtered.push(...opportunities);
    upsellStore.set(agencyId, filtered);

    return NextResponse.json(opportunities, { status: 201 });
  } catch (error) {
    console.error('Error detecting upsell opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
