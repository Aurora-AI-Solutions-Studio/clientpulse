export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    const body = await request.json();

    // Validate required field
    if (!body.token) {
      return NextResponse.json(
        { error: 'token is required' },
        { status: 400 }
      );
    }

    // Find the invitation by token
    const { data: invitation, error: inviteError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('token', body.token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    // Check if the user email matches (safety check)
    // Get user's email from auth
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser?.email && authUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email mismatch. Sign in with the email the invitation was sent to' },
        { status: 400 }
      );
    }

    // Check if user already has a profile with agency_id (if not, we need to create one)
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      // PGRST116 is "not found" error
      console.error('Error checking profile:', profileCheckError);
      return NextResponse.json(
        { error: 'Failed to process invitation' },
        { status: 500 }
      );
    }

    if (existingProfile?.agency_id) {
      return NextResponse.json(
        { error: 'You are already a member of another agency' },
        { status: 409 }
      );
    }

    // Start a transaction-like operation
    // 1. Update or create user profile with agency_id if needed
    if (!existingProfile) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            agency_id: invitation.agency_id,
            email: user.email,
          },
          { onConflict: 'id' }
        );

      if (profileUpdateError) {
        console.error('Error updating profile:', profileUpdateError);
        return NextResponse.json(
          { error: 'Failed to process invitation' },
          { status: 500 }
        );
      }
    }

    // 2. Add user to agency_members
    const { data: newMember, error: memberError } = await supabase
      .from('agency_members')
      .insert({
        user_id: user.id,
        agency_id: invitation.agency_id,
        role: invitation.role,
      })
      .select(
        `
        id,
        user_id,
        role,
        created_at
      `
      )
      .single();

    if (memberError) {
      console.error('Error adding agency member:', memberError);
      return NextResponse.json(
        { error: 'Failed to process invitation' },
        { status: 500 }
      );
    }

    // 3. Update invitation status
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete invitation acceptance' },
        { status: 500 }
      );
    }

    // Return success with member info
    return NextResponse.json(
      {
        success: true,
        member: {
          id: newMember.id,
          userId: newMember.user_id,
          role: newMember.role,
          createdAt: newMember.created_at,
        },
        agencyId: invitation.agency_id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
