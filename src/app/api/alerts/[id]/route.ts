export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.read !== undefined) updates.read = body.read;
    if (body.dismissed !== undefined) updates.dismissed = body.dismissed;

    const { data: alert, error: updateError } = await supabase
      .from('alerts')
      .update(updates)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (updateError || !alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    const mapped = {
      id: alert.id,
      agencyId: alert.agency_id,
      clientId: alert.client_id,
      clientName: alert.client_name,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data,
      read: alert.read,
      dismissed: alert.dismissed,
      createdAt: alert.created_at,
    };

    return NextResponse.json(mapped);
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
    const { id } = await params;

    const { data: deleted, error: deleteError } = await supabase
      .from('alerts')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (deleteError || !deleted) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: { id: deleted.id } });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
