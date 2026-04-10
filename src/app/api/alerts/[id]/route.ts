export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Alert } from '@/types/alerts';

// In-memory storage reference (same as in route.ts)
// This is a workaround - in production, use Supabase directly
const alertsStore = new Map<string, Alert[]>();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    const body = await request.json();
    const { read, dismissed } = body;

    // Get alerts for agency
    const alerts = alertsStore.get(agencyId) || [];
    const alertIndex = alerts.findIndex((a) => a.id === id);

    if (alertIndex === -1) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Update alert
    const alert = alerts[alertIndex];
    if (read !== undefined) {
      alert.read = read;
    }
    if (dismissed !== undefined) {
      alert.dismissed = dismissed;
    }

    // Update store
    alertsStore.set(agencyId, alerts);

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    // Get alerts for agency
    const alerts = alertsStore.get(agencyId) || [];
    const alertIndex = alerts.findIndex((a) => a.id === id);

    if (alertIndex === -1) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Remove alert
    const deletedAlert = alerts[alertIndex];
    alerts.splice(alertIndex, 1);
    alertsStore.set(agencyId, alerts);

    return NextResponse.json({ success: true, deleted: deletedAlert });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
