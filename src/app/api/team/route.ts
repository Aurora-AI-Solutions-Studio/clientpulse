export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// ─── Email delivery (Resend) ───────────────────────────────────
async function sendInvitationEmail(params: {
  to: string;
  agencyName: string;
  inviteUrl: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[team] RESEND_API_KEY not configured — skipping email');
    return false;
  }

  const from = process.env.RESEND_FROM_EMAIL || 'ClientPulse <hello@helloaurora.ai>';

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're Invited!</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>You've been invited to join <strong>${params.agencyName}</strong> on ClientPulse, a platform for managing client relationships and predicting churn.</p>
      <p>Click the button below to create your account and get started:</p>
      <div style="text-align: center;">
        <a href="${params.inviteUrl}" class="cta-button">Accept Invitation</a>
      </div>
      <p style="margin-top: 20px; font-size: 14px;">Or copy this link into your browser:</p>
      <p style="word-break: break-all; background: #e8e8e8; padding: 10px; border-radius: 4px; font-size: 12px;">${params.inviteUrl}</p>
      <p style="margin-top: 30px; font-size: 14px; color: #666;">This invitation expires in 7 days.</p>
    </div>
    <div class="footer">
      <p>ClientPulse by Aurora | Questions? Contact your agency administrator</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: `You've been invited to join ${params.agencyName} on ClientPulse`,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[team] Resend send failed', res.status, text);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[team] Resend send error', err);
    return false;
  }
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
    sendInvitationEmail({
      to: body.email,
      agencyName,
      inviteUrl: signupUrl,
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
