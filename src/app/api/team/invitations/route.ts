export const dynamic = 'force-dynamic';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    // Fetch pending invitations for the agency
    const { data: invitations, error: invitationsError } = await supabase
      .from('team_invitations')
      .select(
        `
        id,
        email,
        role,
        status,
        created_at,
        expires_at,
        invited_by,
        profiles:invited_by (
          full_name
        )
      `
      )
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (invitationsError) {
      console.error('Error fetching invitations:', invitationsError);
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      );
    }

    // Map to response format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedInvitations = (invitations || []).map((inv: any) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
      invitedBy: inv.profiles?.full_name || 'Unknown',
    }));

    return NextResponse.json(formattedInvitations);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, agencyId, serviceClient: supabase } = auth.ctx;

    // Check if user is owner or manager
    const { data: currentMember } = await supabase
      .from('agency_members')
      .select('role')
      .eq('user_id', userId)
      .eq('agency_id', agencyId)
      .single();

    if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'manager')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required field
    if (!body.invitationId) {
      return NextResponse.json(
        { error: 'invitationId is required' },
        { status: 400 }
      );
    }

    // Verify invitation belongs to this agency
    const { data: invitation, error: checkError } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('id', body.invitationId)
      .eq('agency_id', agencyId)
      .single();

    if (checkError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Delete the invitation
    const { error: deleteError } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', body.invitationId)
      .eq('agency_id', agencyId);

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete invitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
