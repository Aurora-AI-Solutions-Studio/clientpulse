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
    const statusFilter = searchParams.get('status');

    let query = supabase
      .from('approvals')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: approvals, error: approvalsError } = await query;

    if (approvalsError) {
      console.error('Error fetching approvals:', approvalsError);
      return NextResponse.json(
        { error: 'Failed to fetch approvals' },
        { status: 500 }
      );
    }

    const mapped = (approvals || []).map((a) => ({
      id: a.id,
      agencyId: a.agency_id,
      clientId: a.client_id,
      clientName: a.client_name,
      type: a.type,
      status: a.status,
      title: a.title,
      description: a.description,
      content: a.content,
      createdAt: a.created_at,
      reviewedAt: a.reviewed_at,
      reviewedBy: a.reviewed_by,
      autoApproveEnabled: a.auto_approve_enabled,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching approvals:', error);
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

    if (!body.clientId || !body.type || !body.title || !body.description || !body.content) {
      return NextResponse.json(
        { error: 'clientId, type, title, description, and content are required' },
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

    const { data: newApproval, error: insertError } = await supabase
      .from('approvals')
      .insert({
        agency_id: agencyId,
        client_id: body.clientId,
        client_name: client.name,
        type: body.type,
        title: body.title,
        description: body.description,
        content: body.content,
        auto_approve_enabled: body.autoApproveEnabled || false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating approval:', insertError);
      return NextResponse.json(
        { error: 'Failed to create approval' },
        { status: 500 }
      );
    }

    const mapped = {
      id: newApproval.id,
      agencyId: newApproval.agency_id,
      clientId: newApproval.client_id,
      clientName: newApproval.client_name,
      type: newApproval.type,
      status: newApproval.status,
      title: newApproval.title,
      description: newApproval.description,
      content: newApproval.content,
      createdAt: newApproval.created_at,
      autoApproveEnabled: newApproval.auto_approve_enabled,
    };

    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    console.error('Error creating approval:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
