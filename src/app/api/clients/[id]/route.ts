export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Client, ClientUpdateInput } from '@/types/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Fetch the specific client and verify ownership
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', params.id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Map to Client type
    const mappedClient: Client = {
      id: client.id,
      name: client.name,
      company: client.company_name,
      contactEmail: client.contact_email,
      monthlyRetainer: client.monthly_retainer,
      serviceType: client.service_type,
      healthScore: undefined,
      status: client.status,
      lastMeetingDate: undefined,
      notes: client.notes,
      createdAt: client.created_at,
      updatedAt: client.updated_at,
      agencyId: client.agency_id,
    };

    return NextResponse.json(mappedClient);
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Verify client ownership
    const { data: existingClient, error: checkError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', params.id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (checkError || !existingClient) {
      return NextResponse.json(
        { error: 'Client not found or unauthorized' },
        { status: 404 }
      );
    }

    const body: ClientUpdateInput = await request.json();

    // Build update object with snake_case keys
    const updateData: Record<string, string | number | boolean | null> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.company !== undefined) updateData.company_name = body.company;
    if (body.contactEmail !== undefined) updateData.contact_email = body.contactEmail;
    if (body.monthlyRetainer !== undefined) updateData.monthly_retainer = body.monthlyRetainer;
    if (body.serviceType !== undefined) updateData.service_type = body.serviceType;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    // Update the client
    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update client' },
        { status: 500 }
      );
    }

    // Map to Client type
    const mappedClient: Client = {
      id: updatedClient.id,
      name: updatedClient.name,
      company: updatedClient.company_name,
      contactEmail: updatedClient.contact_email,
      monthlyRetainer: updatedClient.monthly_retainer,
      serviceType: updatedClient.service_type,
      healthScore: undefined,
      status: updatedClient.status,
      lastMeetingDate: undefined,
      notes: updatedClient.notes,
      createdAt: updatedClient.created_at,
      updatedAt: updatedClient.updated_at,
      agencyId: updatedClient.agency_id,
    };

    return NextResponse.json(mappedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Verify client ownership and delete
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', params.id)
      .eq('agency_id', profile.agency_id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete client' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
