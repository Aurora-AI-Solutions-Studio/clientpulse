export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { ApprovalItem } from '@/types/alerts';

// In-memory storage for approval items
// Structure: Map<agencyId, ApprovalItem[]>
const approvalsStore = new Map<string, ApprovalItem[]>();

function generateId(): string {
  return `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    const statusFilter = searchParams.get('status');

    // Get approvals from store
    let approvals = approvalsStore.get(agencyId) || [];

    // Apply status filter
    if (statusFilter) {
      approvals = approvals.filter((a) => a.status === statusFilter);
    }

    return NextResponse.json(approvals);
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

    // Create new approval item
    const newApproval: ApprovalItem = {
      id: generateId(),
      agencyId,
      clientId: body.clientId,
      clientName: client.name,
      type: body.type,
      status: 'pending',
      title: body.title,
      description: body.description,
      content: body.content,
      createdAt: new Date().toISOString(),
      autoApproveEnabled: body.autoApproveEnabled || false,
    };

    // Store approval item
    const existingApprovals = approvalsStore.get(agencyId) || [];
    approvalsStore.set(agencyId, [...existingApprovals, newApproval]);

    return NextResponse.json(newApproval, { status: 201 });
  } catch (error) {
    console.error('Error creating approval:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
