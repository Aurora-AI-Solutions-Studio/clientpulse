export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const typeFilter = searchParams.get('type');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    let query = supabase
      .from('alerts')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('read', false).eq('dismissed', false);
    }

    if (typeFilter) {
      query = query.eq('type', typeFilter);
    }

    const { data: alerts, error: alertsError } = await query;

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
      return NextResponse.json(
        { error: 'Failed to fetch alerts' },
        { status: 500 }
      );
    }

    // Map snake_case DB columns to camelCase for frontend
    const mapped = (alerts || []).map((a) => ({
      id: a.id,
      agencyId: a.agency_id,
      clientId: a.client_id,
      clientName: a.client_name,
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      data: a.data,
      read: a.read,
      dismissed: a.dismissed,
      createdAt: a.created_at,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching alerts:', error);
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

    if (!body.clientId || !body.type || !body.title || !body.message) {
      return NextResponse.json(
        { error: 'clientId, type, title, and message are required' },
        { status: 400 }
      );
    }

    // Verify client ownership and get client name
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', body.clientId)
      .eq('agency_id', agencyId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { data: newAlert, error: insertError } = await supabase
      .from('alerts')
      .insert({
        agency_id: agencyId,
        client_id: body.clientId,
        client_name: client.name,
        type: body.type,
        severity: body.severity || 'medium',
        title: body.title,
        message: body.message,
        data: body.data || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating alert:', insertError);
      return NextResponse.json(
        { error: 'Failed to create alert' },
        { status: 500 }
      );
    }

    // Map to camelCase
    const mapped = {
      id: newAlert.id,
      agencyId: newAlert.agency_id,
      clientId: newAlert.client_id,
      clientName: newAlert.client_name,
      type: newAlert.type,
      severity: newAlert.severity,
      title: newAlert.title,
      message: newAlert.message,
      data: newAlert.data,
      read: newAlert.read,
      dismissed: newAlert.dismissed,
      createdAt: newAlert.created_at,
    };

    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
