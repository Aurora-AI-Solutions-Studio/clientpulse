export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/integrations/connections
 * List all integration connections for the user's agency
 */
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (!profile?.agency_id) {
      return NextResponse.json({ error: 'No agency found' }, { status: 404 });
    }

    const { data: connections, error } = await supabase
      .from('integration_connections')
      .select('id, provider, status, account_email, account_name, connected_at, last_sync_at, token_expires_at, error, scopes')
      .eq('agency_id', profile.agency_id)
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
 * Disconnect an integration
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connectionId = request.nextUrl.searchParams.get('id');
    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
    }

    // Verify ownership
    const { data: connection } = await supabase
      .from('integration_connections')
      .select('id, user_id')
      .eq('id', connectionId)
      .single();

    if (!connection || connection.user_id !== user.id) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Soft disconnect (keep data, revoke tokens)
    const { error } = await supabase
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
