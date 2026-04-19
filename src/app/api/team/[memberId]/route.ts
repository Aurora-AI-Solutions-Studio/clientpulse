export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's agency ID and check permissions
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

    // Check if user is owner (only owners can change roles)
    const { data: currentMember } = await supabase
      .from('agency_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (!currentMember || currentMember.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can change member roles' },
        { status: 403 }
      );
    }

    // Verify member exists in this agency
    const { data: member, error: memberCheckError } = await supabase
      .from('agency_members')
      .select('id, user_id')
      .eq('id', memberId)
      .eq('agency_id', profile.agency_id)
      .single();

    if (memberCheckError || !member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Prevent changing own role
    if (member.user_id === user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate new role
    if (!body.role || !['owner', 'manager', 'member'].includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be owner, manager, or member' },
        { status: 400 }
      );
    }

    // Update member role
    const { data: updatedMember, error: updateError } = await supabase
      .from('agency_members')
      .update({ role: body.role })
      .eq('id', memberId)
      .select(
        `
        id,
        user_id,
        role,
        created_at,
        profiles:user_id (
          id,
          full_name,
          avatar_url
        )
      `
      )
      .single();

    if (updateError) {
      console.error('Error updating member:', updateError);
      return NextResponse.json(
        { error: 'Failed to update member role' },
        { status: 500 }
      );
    }

    // Map to response format
    const response = {
      id: updatedMember.id,
      userId: updatedMember.user_id,
      name: (updatedMember.profiles as unknown as { full_name: string; avatar_url: string })?.full_name || 'Unknown',
      avatar: (updatedMember.profiles as unknown as { full_name: string; avatar_url: string })?.avatar_url || null,
      role: updatedMember.role,
      createdAt: updatedMember.created_at,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's agency ID and check permissions
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

    // Check if user is owner or manager
    const { data: currentMember } = await supabase
      .from('agency_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'manager')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Verify member exists in this agency
    const { data: member, error: memberCheckError } = await supabase
      .from('agency_members')
      .select('user_id')
      .eq('id', memberId)
      .eq('agency_id', profile.agency_id)
      .single();

    if (memberCheckError || !member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Prevent removing yourself
    if (member.user_id === user.id) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from the team' },
        { status: 400 }
      );
    }

    // Delete the member
    const { error: deleteError } = await supabase
      .from('agency_members')
      .delete()
      .eq('id', memberId)
      .eq('agency_id', profile.agency_id);

    if (deleteError) {
      console.error('Error removing member:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove team member' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
