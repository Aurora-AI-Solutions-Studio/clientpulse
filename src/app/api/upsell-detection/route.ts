export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // Mock upsell detection based on current service type
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

    // Delete old opportunities for this client, then insert new ones
    await supabase
      .from('upsell_opportunities')
      .delete()
      .eq('agency_id', agencyId)
      .eq('client_id', clientId);

    const rows = suggestedServices.map((s) => ({
      agency_id: agencyId,
      client_id: clientId,
      client_name: client.name,
      signal: s.signal,
      context: s.context,
      current_services: currentService,
      suggested_service: s.service,
      estimated_value: s.value,
      confidence: Math.random() > 0.5 ? 'high' : 'medium',
      source_type: 'usage_pattern',
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
