export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  ActionItemOwnershipError,
  ActionItemValidationError,
  createActionItem,
} from '@/lib/action-items/create';
import { requireTier, TierLimitError } from '@/lib/tiers';

// POST /api/action-items
//
// Dashboard-side Accept path. Goes through the same insert pipeline as
// the MCP tool (src/lib/llm/mcp/tools/writes.ts createActionItemTool),
// via the shared core in src/lib/action-items/create.ts.
//
// Tier gate: Solo or higher. Free agencies cannot create action items
// (they have 0 clients via enforceClientLimit); returning a 403 here
// is friendlier than a 404 on the ownership lookup.
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
      .select('agency_id, subscription_plan')
      .eq('id', user.id)
      .single();
    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    try {
      requireTier({ subscription_plan: profile.subscription_plan }, 'solo');
    } catch (err) {
      if (err instanceof TierLimitError) {
        return NextResponse.json(
          { error: err.message, dimension: err.dimension, tier: err.tier },
          { status: err.status }
        );
      }
      throw err;
    }

    const body = await request.json().catch(() => ({}));
    const { clientId, title, description, dueDate, meetingId } = body ?? {};

    try {
      const row = await createActionItem({
        supabase,
        agencyId: profile.agency_id as string,
        input: { clientId, title, description, dueDate, meetingId },
      });
      return NextResponse.json({ actionItem: row }, { status: 201 });
    } catch (err) {
      if (err instanceof ActionItemValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err instanceof ActionItemOwnershipError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      throw err;
    }
  } catch (error) {
    console.error('[/api/action-items POST]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/action-items?status=open|done|overdue&clientId=uuid&limit=50
//
// Agency-scoped list. RLS on action_items gates by the authenticated
// user's agency via the clients→agencies chain, so we just query with
// the session-bound supabase client.
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

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const clientId = url.searchParams.get('clientId');
    const limitRaw = url.searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10) || 50, 1), 200);

    let q = supabase
      .from('action_items')
      .select(
        'id, client_id, meeting_id, title, description, status, due_date, assigned_to, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && ['open', 'done', 'overdue'].includes(status)) {
      q = q.eq('status', status);
    }
    if (clientId) {
      q = q.eq('client_id', clientId);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ actionItems: data ?? [] });
  } catch (error) {
    console.error('[/api/action-items GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
