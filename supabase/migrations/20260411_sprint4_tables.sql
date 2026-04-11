-- ============================================================================
-- Sprint 4 Tables: alerts, approvals, churn_predictions, upsell_opportunities
-- Migration: 20260411_sprint4_tables
-- Purpose: Replace in-memory Map stores with persistent Supabase tables
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- alerts: In-app notifications when client health drops or risk detected
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients ON DELETE CASCADE,
  client_name text NOT NULL,
  type text NOT NULL CHECK (type IN ('churn_risk', 'health_drop', 'upsell_opportunity', 'action_required')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT NULL,
  read boolean NOT NULL DEFAULT false,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- approvals: HITL approval queue for automated actions (briefs, alerts, save plans)
CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients ON DELETE CASCADE,
  client_name text NOT NULL,
  type text NOT NULL CHECK (type IN ('monday_brief', 'churn_alert', 'save_plan', 'check_in_invite')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed', 'auto_approved')),
  title text NOT NULL,
  description text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  auto_approve_enabled boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- churn_predictions: Computed churn probability per client
CREATE TABLE IF NOT EXISTS public.churn_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients ON DELETE CASCADE,
  client_name text NOT NULL,
  churn_probability integer NOT NULL CHECK (churn_probability >= 0 AND churn_probability <= 100),
  risk_level text NOT NULL CHECK (risk_level IN ('critical', 'high', 'moderate', 'low')),
  driving_factors jsonb NOT NULL DEFAULT '[]',
  suggested_actions jsonb NOT NULL DEFAULT '[]',
  save_plan jsonb DEFAULT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id, client_id)
);

-- upsell_opportunities: Detected expansion opportunities per client
CREATE TABLE IF NOT EXISTS public.upsell_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients ON DELETE CASCADE,
  client_name text NOT NULL,
  signal text NOT NULL,
  context text NOT NULL,
  current_services text NOT NULL,
  suggested_service text NOT NULL,
  estimated_value numeric(10, 2) DEFAULT NULL,
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  source_type text NOT NULL DEFAULT 'usage_pattern' CHECK (source_type IN ('meeting_transcript', 'usage_pattern', 'market_signal')),
  source_meeting_id uuid REFERENCES meetings ON DELETE SET NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_agency_id ON alerts(agency_id);
CREATE INDEX IF NOT EXISTS idx_alerts_client_id ON alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_read_dismissed ON alerts(agency_id, read, dismissed);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- approvals indexes
CREATE INDEX IF NOT EXISTS idx_approvals_agency_id ON approvals(agency_id);
CREATE INDEX IF NOT EXISTS idx_approvals_client_id ON approvals(client_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON approvals(created_at DESC);

-- churn_predictions indexes
CREATE INDEX IF NOT EXISTS idx_churn_predictions_agency_id ON churn_predictions(agency_id);
CREATE INDEX IF NOT EXISTS idx_churn_predictions_client_id ON churn_predictions(client_id);
CREATE INDEX IF NOT EXISTS idx_churn_predictions_risk_level ON churn_predictions(risk_level);

-- upsell_opportunities indexes
CREATE INDEX IF NOT EXISTS idx_upsell_opportunities_agency_id ON upsell_opportunities(agency_id);
CREATE INDEX IF NOT EXISTS idx_upsell_opportunities_client_id ON upsell_opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_upsell_opportunities_confidence ON upsell_opportunities(confidence);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upsell_opportunities ENABLE ROW LEVEL SECURITY;

-- alerts RLS: agency members can view, managers/owners can manage
CREATE POLICY "Agency members can view alerts" ON alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = alerts.agency_id
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = alerts.agency_id AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Managers and owners can manage alerts" ON alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = alerts.agency_id
      AND am.role IN ('owner', 'manager')
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = alerts.agency_id AND a.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = alerts.agency_id
      AND am.role IN ('owner', 'manager')
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = alerts.agency_id AND a.owner_id = auth.uid()
    )
  );

-- approvals RLS
CREATE POLICY "Agency members can view approvals" ON approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = approvals.agency_id
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = approvals.agency_id AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Managers and owners can manage approvals" ON approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = approvals.agency_id
      AND am.role IN ('owner', 'manager')
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = approvals.agency_id AND a.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = approvals.agency_id
      AND am.role IN ('owner', 'manager')
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = approvals.agency_id AND a.owner_id = auth.uid()
    )
  );

-- churn_predictions RLS
CREATE POLICY "Agency members can view churn predictions" ON churn_predictions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = churn_predictions.agency_id
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = churn_predictions.agency_id AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Managers and owners can manage churn predictions" ON churn_predictions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = churn_predictions.agency_id
      AND am.role IN ('owner', 'manager')
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = churn_predictions.agency_id AND a.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = churn_predictions.agency_id
      AND am.role IN ('owner', 'manager')
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = churn_predictions.agency_id AND a.owner_id = auth.uid()
    )
  );

-- upsell_opportunities RLS
CREATE POLICY "Agency members can view upsell opportunities" ON upsell_opportunities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = upsell_opportunities.agency_id
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = upsell_opportunities.agency_id AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Managers and owners can manage upsell opportunities" ON upsell_opportunities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = upsell_opportunities.agency_id
      AND am.role IN ('owner', 'manager')
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = upsell_opportunities.agency_id AND a.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.agency_id = upsell_opportunities.agency_id
      AND am.role IN ('owner', 'manager')
    ) OR EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = upsell_opportunities.agency_id AND a.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE SCHEMA FILE REFERENCE
-- ============================================================================
-- These 4 tables complete Sprint 4's data layer.
-- All API routes should now use Supabase directly instead of in-memory Maps.
-- ============================================================================
