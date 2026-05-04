export const dynamic = 'force-dynamic';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, agencyId, serviceClient: supabase } = auth.ctx;
    const { id } = await params;

    const body = await request.json();
    const { status } = body;

    if (!status || !['approved', 'dismissed', 'auto_approved'].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'approved', 'dismissed', or 'auto_approved'" },
        { status: 400 }
      );
    }

    const { data: approval, error: updateError } = await supabase
      .from('approvals')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (updateError || !approval) {
      return NextResponse.json(
        { error: 'Approval item not found' },
        { status: 404 }
      );
    }

    const mapped = {
      id: approval.id,
      agencyId: approval.agency_id,
      clientId: approval.client_id,
      clientName: approval.client_name,
      type: approval.type,
      status: approval.status,
      title: approval.title,
      description: approval.description,
      content: approval.content,
      createdAt: approval.created_at,
      reviewedAt: approval.reviewed_at,
      reviewedBy: approval.reviewed_by,
      autoApproveEnabled: approval.auto_approve_enabled,
    };

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error updating approval:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
