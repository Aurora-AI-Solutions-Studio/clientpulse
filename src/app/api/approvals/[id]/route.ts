export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { ApprovalItem } from '@/types/alerts';

// In-memory storage reference (same as in route.ts)
const approvalsStore = new Map<string, ApprovalItem[]>();

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
    const { status } = body;

    // Validate status
    if (!status || !['approved', 'dismissed', 'auto_approved'].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'approved', 'dismissed', or 'auto_approved'" },
        { status: 400 }
      );
    }

    // Get approvals for agency
    const approvals = approvalsStore.get(agencyId) || [];
    const approvalIndex = approvals.findIndex((a) => a.id === id);

    if (approvalIndex === -1) {
      return NextResponse.json(
        { error: 'Approval item not found' },
        { status: 404 }
      );
    }

    // Update approval item
    const approval = approvals[approvalIndex];
    approval.status = status;
    approval.reviewedAt = new Date().toISOString();
    approval.reviewedBy = user.id;

    // Update store
    approvalsStore.set(agencyId, approvals);

    return NextResponse.json(approval);
  } catch (error) {
    console.error('Error updating approval:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
