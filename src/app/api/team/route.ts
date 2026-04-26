export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email/resend';

function renderInvitationHtml(agencyName: string, inviteUrl: string): string {
  const escName = escapeHtml(agencyName);
  const escUrl = escapeHtml(inviteUrl);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:30px 20px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="margin:0;">You're Invited!</h1>
  </div>
  <div style="background:#f9f9f9;padding:30px 20px;border-radius:0 0 8px 8px;">
    <p>Hello,</p>
    <p>You've been invited to join <strong>${escName}</strong> on ClientPulse, a platform for managing client relationships and predicting churn.</p>
    <p>Click the button below to create your account and get started:</p>
    <div style="text-align:center;">
      <a href="${escUrl}" style="display:inline-block;background:#667eea;color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;margin:20px 0;">Accept Invitation</a>
    </div>
    <p style="margin-top:20px;font-size:14px;">Or copy this link into your browser:</p>
    <p style="word-break:break-all;background:#e8e8e8;padding:10px;border-radius:4px;font-size:12px;">${escUrl}</p>
    <p style="margin-top:30px;font-size:14px;color:#666;">This invitation expires in 7 days.</p>
  </div>
  <div style="margin-top:20px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#666;text-align:center;">
    <p>ClientPulse by Aurora · Questions? Contact your agency administrator</p>
  </div>
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(_request: NextRequest) {
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

    // Fetch all agency members with their profile info
    const { data: members, error: membersError } = await supabase
      .from('agency_members')
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
      .eq('agency_id', profile.agency_id)
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      );
    }

    // Map to response format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamMembers = (members || []).map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      name: m.profiles?.full_name || 'Unknown',
      avatar: m.profiles?.avatar_url || null,
      role: m.role,
      createdAt: m.created_at,
    }));

    return NextResponse.json(teamMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
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

    const body = await request.json();

    // Validate required fields
    if (!body.email || !body.role) {
      return NextResponse.json(
        { error: 'email and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['owner', 'manager', 'member'].includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be owner, manager, or member' },
        { status: 400 }
      );
    }

    // Check if email is already invited or a member
    const { data: existingInvitation } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('email', body.email)
      .eq('agency_id', profile.agency_id)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Invitation already exists for this email' },
        { status: 409 }
      );
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('profiles')
      .select('id')
      .eq('agency_id', profile.agency_id)
      .textSearch('email', body.email)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a team member' },
        { status: 409 }
      );
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: inviteError } = await supabase
      .from('team_invitations')
      .insert({
        agency_id: profile.agency_id,
        invited_by: user.id,
        email: body.email,
        role: body.role,
        token: token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      );
    }

    // Send invitation email via Resend (fire-and-forget, don't block response)
    const { data: agency } = await supabase
      .from('agencies')
      .select('name')
      .eq('id', profile.agency_id)
      .single();

    const agencyName = agency?.name || 'ClientPulse';
    const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://clientpulse.helloaurora.ai'}/auth/signup?invite=${token}`;

    // Send email without awaiting (fire-and-forget)
    sendEmail({
      to: body.email,
      subject: `You've been invited to join ${agencyName} on ClientPulse`,
      html: renderInvitationHtml(agencyName, signupUrl),
      from: process.env.RESEND_FROM_EMAIL || 'ClientPulse <hello@helloaurora.ai>',
      tags: { product: 'clientpulse', kind: 'team-invitation' },
    }).then((r) => {
      if (!r.ok && !r.skipped) {
        console.warn('[team] Resend send failed', r.status, r.error);
      }
    }).catch((err) => {
      console.warn('[team] Failed to send invitation email:', err);
    });

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    console.error('Error inviting team member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
