export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Alert } from '@/types/alerts';

// In-memory storage for alerts (simulate Supabase)
// Structure: Map<agencyId, Alert[]>
const alertsStore = new Map<string, Alert[]>();

function generateId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const typeFilter = searchParams.get('type');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    // Get alerts from store
    let alerts = alertsStore.get(agencyId) || [];

    // Apply filters
    if (unreadOnly) {
      alerts = alerts.filter((a) => !a.read && !a.dismissed);
    }

    if (typeFilter) {
      alerts = alerts.filter((a) => a.type === typeFilter);
    }

    // Apply limit
    alerts = alerts.slice(0, limit);

    return NextResponse.json(alerts);
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

    // Validate required fields
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

    // Create new alert
    const newAlert: Alert = {
      id: generateId(),
      agencyId,
      clientId: body.clientId,
      clientName: client.name,
      type: body.type,
      severity: body.severity || 'medium',
      title: body.title,
      message: body.message,
      data: body.data || undefined,
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
    };

    // Store alert
    const existingAlerts = alertsStore.get(agencyId) || [];
    alertsStore.set(agencyId, [...existingAlerts, newAlert]);

    return NextResponse.json(newAlert, { status: 201 });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
