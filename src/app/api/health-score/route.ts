export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { refreshClientHealth } from '@/lib/health/refresh';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    const body = await request.json();
    const { clientId } = body;
    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const healthScore = await refreshClientHealth({ supabase, clientId });

    return NextResponse.json({
      success: true,
      clientId,
      score: healthScore.overall,
      status: healthScore.status,
      breakdown: healthScore.breakdown,
      signals: healthScore.signals,
      explanation: healthScore.explanation,
    });
  } catch (error) {
    console.error('Error computing health score:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
