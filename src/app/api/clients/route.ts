export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse, after } from 'next/server';
import { Client, ClientCreateInput, HealthScore } from '@/types/client';
import { enforceClientLimit, TierLimitError } from '@/lib/tiers';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { maybeClaimFirstBriefSend } from '@/lib/brief/first-brief-trigger';
import { generateAndSendBrief } from '@/lib/brief/send-brief';
import { resolveAppUrl } from '@/lib/url';

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
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    // Fetch clients for the user's agency
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('agency_id', agencyId)
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
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, subscriptionPlan, serviceClient: supabase } = auth.ctx;

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
      await enforceClientLimit(agencyId, {
        subscription_plan: subscriptionPlan,
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
        agency_id: agencyId,
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

    // First-Brief auto-send: when this insert pushes the agency to 3 clients
    // for the first time, fire a real Monday Brief in the background so the
    // new agency sees actionable output before they've waited a week. Atomic
    // claim via maybeClaimFirstBriefSend ensures exactly-once.
    const claim = await maybeClaimFirstBriefSend(supabase, agencyId);
    if (claim.shouldFire && claim.ownerEmail) {
      const appUrl = resolveAppUrl(request);
      const emailTokenSecret = process.env.EMAIL_TOKEN_SECRET;
      if (emailTokenSecret) {
        const { data: agencyForBrand } = await supabase
          .from('agencies')
          .select('brand_logo_url, brand_color')
          .eq('id', agencyId)
          .maybeSingle();
        after(async () => {
          try {
            await generateAndSendBrief({
              supabase,
              agency: {
                id: agencyId,
                name: claim.agencyName,
                brandLogoUrl: (agencyForBrand?.brand_logo_url as string | null) ?? null,
                brandColor: (agencyForBrand?.brand_color as string | null) ?? null,
              },
              to: claim.ownerEmail,
              send: true,
              appUrl,
              emailTokenSecret,
            });
          } catch (err) {
            console.error('[clients POST] first-brief auto-send failed', err);
          }
        });
      }
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
