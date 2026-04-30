export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

/**
 * GET /api/integrations/connections
 * List all integration connections for the user's agency
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient } = auth.ctx;

    const { data: connections, error } = await serviceClient
      .from('integration_connections')
      .select('id, provider, status, account_email, account_name, connected_at, last_sync_at, token_expires_at, error, scopes')
      .eq('agency_id', agencyId)
      .order('connected_at', { ascending: false });

    if (error) {
      console.error('Error fetching connections:', error);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    return NextResponse.json({ connections: connections || [] });
  } catch (error) {
    console.error('Error in GET /api/integrations/connections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/integrations/connections?id=<connection_id>
 * (legacy alias `connectionId=` also accepted to match the settings-page caller)
 * Disconnect an integration. Service-client auth + writes to avoid the
 * RLS-context-drift bug; ownership is checked manually via agency_id.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient } = auth.ctx;

    const connectionId =
      request.nextUrl.searchParams.get('id') ||
      request.nextUrl.searchParams.get('connectionId');
    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
    }

    // Ownership check — match the agency, not just the user, so a manager
    // can disconnect a connection started by an owner (and vice versa).
    const { data: connection } = await serviceClient
      .from('integration_connections')
      .select('id, agency_id')
      .eq('id', connectionId)
      .maybeSingle();

    if (!connection || connection.agency_id !== agencyId) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Soft disconnect (keep data, revoke tokens)
    const { error } = await serviceClient
      .from('integration_connections')
      .update({
        status: 'disconnected',
        access_token: null,
        refresh_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    if (error) {
      console.error('Error disconnecting:', error);
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/integrations/connections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
