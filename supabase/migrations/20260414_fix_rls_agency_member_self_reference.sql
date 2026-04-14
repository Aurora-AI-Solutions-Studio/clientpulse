-- Sprint 7B: Fix RLS self-referencing alias bug (multi-tenant data leak)
-- Applied to clientpulse-eu on 2026-04-14.
--
-- Bug pattern discovered during RLS audit:
--   EXISTS (SELECT 1 FROM agency_members am
--           WHERE am.user_id = auth.uid() AND am.agency_id = am.agency_id)
-- The trailing `am.agency_id = am.agency_id` is a tautology (always TRUE), so any
-- authenticated user who was a member of ANY agency passed the check for ALL rows.
-- Result: cross-tenant read/write leak across agencies/agency_members/clients/meetings/monday_briefs.
--
-- Separately, two `agencies` policies used `am.agency_id = am.id` (comparing agency_id
-- to the agency_members PK) which is also wrong — fixed to `am.agency_id = agencies.id`.
--
-- Fix pattern: qualify the right-hand side with the OUTER table name so the subquery
-- actually filters by the row being checked.
--
-- Verified via synthetic negative test (user_a vs user_b, client_a vs client_b):
--   old policy: all 4 matrix cells visible (leak)
--   new policy: only same-tenant cells visible (correct)

-- ===== agencies =====
DROP POLICY IF EXISTS "Agency members can view agency" ON public.agencies;
CREATE POLICY "Agency members can view agency" ON public.agencies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = agencies.id
    )
  );

DROP POLICY IF EXISTS "Managers and owners can update agency" ON public.agencies;
CREATE POLICY "Managers and owners can update agency" ON public.agencies
  FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = agencies.id
        AND am.role = ANY (ARRAY['owner'::text, 'manager'::text])
    )
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = agencies.id
        AND am.role = ANY (ARRAY['owner'::text, 'manager'::text])
    )
  );

-- ===== agency_members =====
DROP POLICY IF EXISTS "Agency members can view other members" ON public.agency_members;
CREATE POLICY "Agency members can view other members" ON public.agency_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = agency_members.agency_id
    )
  );

-- ===== clients =====
DROP POLICY IF EXISTS "Agency members can view agency clients" ON public.clients;
CREATE POLICY "Agency members can view agency clients" ON public.clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = clients.agency_id
    )
    OR EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = clients.agency_id
        AND a.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers and owners can create clients" ON public.clients;
CREATE POLICY "Managers and owners can create clients" ON public.clients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = clients.agency_id
        AND am.role = ANY (ARRAY['owner'::text, 'manager'::text])
    )
    OR EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = clients.agency_id
        AND a.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers and owners can update clients" ON public.clients;
CREATE POLICY "Managers and owners can update clients" ON public.clients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = clients.agency_id
        AND am.role = ANY (ARRAY['owner'::text, 'manager'::text])
    )
    OR EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = clients.agency_id
        AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = clients.agency_id
        AND am.role = ANY (ARRAY['owner'::text, 'manager'::text])
    )
    OR EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = clients.agency_id
        AND a.owner_id = auth.uid()
    )
  );

-- ===== meetings =====
DROP POLICY IF EXISTS "Agency members can view meetings" ON public.meetings;
CREATE POLICY "Agency members can view meetings" ON public.meetings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = meetings.agency_id
    )
    OR EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = meetings.agency_id
        AND a.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers and owners can create meetings" ON public.meetings;
CREATE POLICY "Managers and owners can create meetings" ON public.meetings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = meetings.agency_id
        AND am.role = ANY (ARRAY['owner'::text, 'manager'::text])
    )
    OR EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = meetings.agency_id
        AND a.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers and owners can update meetings" ON public.meetings;
CREATE POLICY "Managers and owners can update meetings" ON public.meetings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = meetings.agency_id
        AND am.role = ANY (ARRAY['owner'::text, 'manager'::text])
    )
    OR EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = meetings.agency_id
        AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = meetings.agency_id
        AND am.role = ANY (ARRAY['owner'::text, 'manager'::text])
    )
    OR EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = meetings.agency_id
        AND a.owner_id = auth.uid()
    )
  );

-- ===== monday_briefs =====
DROP POLICY IF EXISTS "Agency members can view briefs" ON public.monday_briefs;
CREATE POLICY "Agency members can view briefs" ON public.monday_briefs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.user_id = auth.uid()
        AND am.agency_id = monday_briefs.agency_id
    )
    OR EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = monday_briefs.agency_id
        AND a.owner_id = auth.uid()
    )
  );
