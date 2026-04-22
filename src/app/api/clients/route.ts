export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Client, ClientCreateInput, HealthScore } from '@/types/client';
import { enforceClientLimit, TierLimitError } from '@/lib/tiers';

// Generate mock health score for demonstration
function generateMockHealthScore(): HealthScore {
  const overall = Math.floor(Math.random() * 100);
  return {
    overall,
    breakdown: {
      financial: Math.floor(Math.random() * 100),
      relationship: Math.floor(Math.random() * 100),
      delivery: Math.floor(Math.random() * 100),
      engagement: Math.floor(Math.random() * 100),
    },
    lastUpdated: new Date().toISOString(),
    status: overall >= 70 ? 'healthy' : overall >= 40 ? 'at-risk' : 'critical',
  };
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

    // Get user's agency ID from profiles table
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

    // Fetch clients for the user's agency
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('agency_id', profile.agency_id)
      .order('created_at', { ascending: false });

    if (clientError) {
      return NextResponse.json(
        { error: 'Failed to fetch clients' },
        { status: 500 }
      );
    }

    // Fetch current health scores for the agency's clients
    const clientIds = (clients ?? []).map((c) => c.id as string);
    const { data: healthRows } = clientIds.length > 0
      ? await supabase
          .from('client_health_scores')
          .select('client_id, overall_score, financial_score, relationship_score, delivery_score, engagement_score, computed_at')
          .in('client_id', clientIds)
      : { data: [] as Array<Record<string, unknown>> };

    const healthByClient = new Map<string, HealthScore>();
    for (const row of healthRows ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any;
      const overall = (r.overall_score as number) ?? 0;
      healthByClient.set(r.client_id as string, {
        overall,
        breakdown: {
          financial: r.financial_score ?? 0,
          relationship: r.relationship_score ?? 0,
          delivery: r.delivery_score ?? 0,
          engagement: r.engagement_score ?? 0,
        },
        lastUpdated: r.computed_at as string,
        status: overall >= 70 ? 'healthy' : overall >= 40 ? 'at-risk' : 'critical',
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedClients: Client[] = clients?.map((client: any) => ({
      id: client.id as string,
      name: client.name as string,
      company: client.company_name as string,
      contactEmail: client.contact_email as string | undefined,
      monthlyRetainer: client.monthly_retainer as number | undefined,
      serviceType: client.service_type as string | undefined,
      healthScore: healthByClient.get(client.id as string) ?? generateMockHealthScore(),
      status: client.status as string,
      lastMeetingDate: undefined,
      notes: client.notes as string | undefined,
      createdAt: client.created_at as string,
      updatedAt: client.updated_at as string,
      agencyId: client.agency_id as string,
    })) || [];

    return NextResponse.json(mappedClients);
  } catch (error) {
    console.error('Error fetching clients:', error);
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

    // Get user's agency ID + tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id, subscription_plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const body: ClientCreateInput = await request.json();

    // Validate required fields
    if (!body.name || !body.company) {
      return NextResponse.json(
        { error: 'Client name and company are required' },
        { status: 400 }
      );
    }

    // Enforce tier-based client-count cap.
    try {
      await enforceClientLimit(profile.agency_id, {
        subscription_plan: profile.subscription_plan,
      });
    } catch (err) {
      if (err instanceof TierLimitError) {
        return NextResponse.json(
          { error: err.message, dimension: err.dimension, tier: err.tier },
          { status: err.status }
        );
      }
      throw err;
    }

    // Create client in database
    const { data: newClient, error: createError } = await supabase
      .from('clients')
      .insert({
        name: body.name,
        company_name: body.company,
        contact_email: body.contactEmail,
        monthly_retainer: body.monthlyRetainer,
        service_type: body.serviceType,
        notes: body.notes,
        agency_id: profile.agency_id,
        status: 'active',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating client:', createError);
      return NextResponse.json(
        { error: 'Failed to create client' },
        { status: 500 }
      );
    }

    // Map to Client type
    const mappedClient: Client = {
      id: newClient.id,
      name: newClient.name,
      company: newClient.company_name,
      contactEmail: newClient.contact_email,
      monthlyRetainer: newClient.monthly_retainer,
      serviceType: newClient.service_type,
      healthScore: generateMockHealthScore(),
      status: newClient.status,
      lastMeetingDate: undefined,
      notes: newClient.notes,
      createdAt: newClient.created_at,
      updatedAt: newClient.updated_at,
      agencyId: newClient.agency_id,
    };

    return NextResponse.json(mappedClient, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
