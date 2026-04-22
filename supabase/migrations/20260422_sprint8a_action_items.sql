-- Migration: ClientPulse Sprint 8A — action_items backfill + onboarding flag
--
-- (1) Backfills the public.action_items table schema. The table was
--     applied to prod Supabase via the MCP tool without a committed
--     migration (pre-PR #33). This file makes the repo the source of
--     truth. All DDL is IF NOT EXISTS so it is a no-op on environments
--     that already have the table (prod), and green on fresh branches.
--
-- (2) Adds profiles.onboarding_completed_at (timestamptz, nullable).
--     Nullable = onboarding not done. Gates the Sprint 8A onboarding
--     wizard redirect: /dashboard → /dashboard/onboarding while NULL.
--
-- Consumers already in code:
--   - src/lib/llm/mcp/tools/writes.ts  (createActionItemTool)
--   - src/lib/health/refresh.ts        (open/overdue aggregation)
--   - src/lib/agents/monday-brief-agent.ts (topActionItems)

-- ─── action_items ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.action_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  meeting_id   UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status = ANY (ARRAY['open'::text, 'done'::text, 'overdue'::text])),
  due_date     DATE,
  assigned_to  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_items_client_id   ON public.action_items (client_id);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting_id  ON public.action_items (meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status      ON public.action_items (status);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned_to ON public.action_items (assigned_to);

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- Mirrors prod policies exactly (verified via MCP pg_policies query).
-- Ownership chain: action_items.client_id → clients.agency_id →
-- agency_members.user_id = auth.uid()  OR  agencies.owner_id = auth.uid().
-- DROP/CREATE is idempotent: re-applying produces the same policy set.
DROP POLICY IF EXISTS "Agency members can view action items" ON public.action_items;
CREATE POLICY "Agency members can view action items" ON public.action_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = action_items.client_id
        AND am.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.agencies a ON c.agency_id = a.id
      WHERE c.id = action_items.client_id
        AND a.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers and owners can manage action items" ON public.action_items;
CREATE POLICY "Managers and owners can manage action items" ON public.action_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = action_items.client_id
        AND am.user_id = auth.uid()
        AND am.role = ANY (ARRAY['owner'::text, 'manager'::text])
    )
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.agencies a ON c.agency_id = a.id
      WHERE c.id = action_items.client_id
        AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = action_items.client_id
        AND am.user_id = auth.uid()
        AND am.role = ANY (ARRAY['owner'::text, 'manager'::text])
    )
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.agencies a ON c.agency_id = a.id
      WHERE c.id = action_items.client_id
        AND a.owner_id = auth.uid()
    )
  );

-- ─── profiles.onboarding_completed_at ────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ NULL;
